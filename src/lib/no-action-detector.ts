import { sql } from "./db";
import { getISTDateString, getISTDayOfWeek, isTaskActiveOnDay } from "./time-utils";
import { trackStep } from "./perf";

function dateFromISTString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:30`);
}

function formatISTDate(date: Date): string {
  return getISTDateString(date);
}

/**
 * Bulk no-action detection: replaces the previous O(days × tasks) N+1 query loop
 * with a fixed set of 4 bulk SQL statements, regardless of how many tasks or days.
 *
 * Semantics preserved exactly:
 *  1. Fix any task_occurrences wrongly marked no_action that have a matching task_completion.
 *  2. Auto-mark old no_action entries (>3 days) as 'reviewed'.
 *  3. For each (todo, date) pair that was active but has no occurrence yet, or is still pending →
 *     insert/update as no_action.
 *  4. Log task_activities for newly created no_action records.
 *
 * Idempotency: all writes use ON CONFLICT DO UPDATE or WHERE guards, so concurrent
 * calls (two users loading the page simultaneously) produce exactly the same final state.
 *
 * Query count: always exactly 5 queries (the 2 cleanup UPDATEs + 1 todos SELECT +
 * 1 bulk UPSERT for occurrences + 1 bulk INSERT for activities), down from ~60–420+.
 */
export async function detectNoActionOccurrences(userId: string, daysBack = 7) {
  return trackStep(`detectNoActionOccurrences(${userId})`, async () => {
    try {
      const todayStr = getISTDateString();
      const todayDate = dateFromISTString(todayStr);

      // ── Query 1: Fix false no_action entries that already have a completion ──
      await sql`
        UPDATE task_occurrences o
        SET status = 'completed',
            completed_at = COALESCE(c.completed_at, NOW()),
            review_status = 'reviewed',
            updated_at = NOW()
        FROM task_completions c
        JOIN todos t ON (c.todo_id = t.id OR LOWER(TRIM(c.todo_title)) = LOWER(TRIM(t.title)))
        WHERE o.user_id = ${userId}
          AND o.todo_id = t.id
          AND o.occurrence_date = c.completed_date
          AND o.status = 'no_action'
      `;

      // ── Query 2: Auto-mark old no_action entries (>3 days) as reviewed ──
      const threeDaysAgo = new Date(todayDate);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = formatISTDate(threeDaysAgo);

      await sql`
        UPDATE task_occurrences
        SET review_status = 'reviewed', updated_at = NOW()
        WHERE user_id = ${userId}
          AND status = 'no_action'
          AND occurrence_date < ${threeDaysAgoStr}
          AND (review_status = 'unreviewed' OR review_status IS NULL OR review_status = '')
      `;

      // ── Query 3: Fetch all todos for this user ──
      const todos = (await sql`
        SELECT id, title, assigned_day, scheduled_date, scheduled_time, created_at
        FROM todos
        WHERE user_id = ${userId}
      `) as {
        id: number;
        title: string;
        assigned_day: string;
        scheduled_date?: string;
        scheduled_time?: string;
        created_at: string;
      }[];

      if (todos.length === 0) return;

      // Build the set of (todo_id, date) pairs that were active in the past N days
      // using JavaScript — O(todos × daysBack), no extra DB round trips
      type ActivePair = { todoId: number; dateStr: string; scheduledTime: string };
      const activePairs: ActivePair[] = [];

      for (let i = 1; i <= daysBack; i++) {
        const pastCursor = new Date(todayDate);
        pastCursor.setDate(pastCursor.getDate() - i);
        const pastDateStr = formatISTDate(pastCursor);
        const pastDayOfWeek = getISTDayOfWeek(pastCursor);

        for (const todo of todos) {
          // Skip if date is before the task was created
          const taskCreatedDate = getISTDateString(new Date(todo.created_at));
          if (pastDateStr < taskCreatedDate) continue;

          const isActive = todo.scheduled_date
            ? todo.scheduled_date === pastDateStr
            : isTaskActiveOnDay(todo.assigned_day, pastDayOfWeek);

          if (!isActive) continue;

          activePairs.push({
            todoId: todo.id,
            dateStr: pastDateStr,
            scheduledTime: todo.scheduled_time ?? "",
          });
        }
      }

      if (activePairs.length === 0) return;

      // ── Query 4: Bulk upsert no_action for active pairs with no completed/skipped occurrence ──
      // Build value rows as a VALUES clause. We need parameterised SQL but also want
      // a single statement. We use a CTE with unnest for clean parametrised bulk ops.
      const todoIds = activePairs.map((p) => p.todoId);
      const dateStrs = activePairs.map((p) => p.dateStr);
      const scheduledTimes = activePairs.map((p) => p.scheduledTime);

      await sql`
        INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, scheduled_time, review_status)
        SELECT
          ${userId},
          v.todo_id,
          v.occurrence_date,
          CASE
            WHEN tc.id IS NOT NULL THEN 'completed'
            ELSE 'no_action'
          END,
          v.scheduled_time,
          CASE
            WHEN tc.id IS NOT NULL THEN 'reviewed'
            ELSE 'unreviewed'
          END
        FROM unnest(
          ${todoIds}::int[],
          ${dateStrs}::text[],
          ${scheduledTimes}::text[]
        ) AS v(todo_id, occurrence_date, scheduled_time)
        LEFT JOIN task_completions tc
          ON tc.user_id = ${userId}
          AND (tc.todo_id = v.todo_id OR LOWER(TRIM(tc.todo_title)) = (
            SELECT LOWER(TRIM(title)) FROM todos WHERE id = v.todo_id LIMIT 1
          ))
          AND tc.completed_date = v.occurrence_date
        -- Only insert where the occurrence does not already have a final status
        WHERE NOT EXISTS (
          SELECT 1 FROM task_occurrences o2
          WHERE o2.user_id = ${userId}
            AND o2.todo_id = v.todo_id
            AND o2.occurrence_date = v.occurrence_date
            AND o2.status NOT IN ('pending')
        )
        ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
          SET status = EXCLUDED.status,
              scheduled_time = EXCLUDED.scheduled_time,
              updated_at = NOW()
          WHERE task_occurrences.status = 'pending'
      `;

      // ── Query 5: Bulk insert missing no_action activity log entries ──
      await sql`
        INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, metadata)
        SELECT
          o.user_id,
          o.todo_id,
          o.occurrence_date,
          'no_action',
          '{"reason":"scheduled_occurrence_passed"}'
        FROM task_occurrences o
        WHERE o.user_id = ${userId}
          AND o.status = 'no_action'
          AND o.occurrence_date >= ${formatISTDate(
            (() => {
              const d = new Date(todayDate);
              d.setDate(d.getDate() - daysBack);
              return d;
            })()
          )}
          AND NOT EXISTS (
            SELECT 1 FROM task_activities a
            WHERE a.user_id = o.user_id
              AND a.todo_id = o.todo_id
              AND a.occurrence_date = o.occurrence_date
              AND a.action_type = 'no_action'
          )
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      console.error("Error in detectNoActionOccurrences:", error);
      // Do not re-throw: this is maintenance work; errors must not block the page render.
    }
  }); // end trackStep
}
