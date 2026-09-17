import { sql, initDb } from "./db";
import { getISTDateString, getISTDayOfWeek, isTaskActiveOnDay } from "./time-utils";

function dateFromISTString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:30`);
}

function formatISTDate(date: Date): string {
  return getISTDateString(date);
}

/**
 * Scans active task occurrences for past dates (up to yesterday IST)
 * and marks any un-acted task occurrences as 'no_action'.
 */
export async function detectNoActionOccurrences(userId: string, daysBack = 7) {
  try {
    await initDb();
    const todayStr = getISTDateString();
    const todayDate = dateFromISTString(todayStr);

    // 1. Cleanup false no_action entries where task_completions exist (matched by todo_id or title)
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

    // 2. Auto-mark historical no_action entries older than 3 days as 'reviewed'
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

    // Fetch user's todos
    const todos = (await sql`
      SELECT id, user_id, title, assigned_day, scheduled_date, scheduled_time, created_at
      FROM todos
      WHERE user_id = ${userId}
    `) as { id: number; user_id: string; title: string; assigned_day: string; scheduled_date?: string; scheduled_time?: string; created_at: string }[];

    if (todos.length === 0) return;

    // Scan previous N days (excluding today)
    for (let i = 1; i <= daysBack; i++) {
      const pastCursor = new Date(todayDate);
      pastCursor.setDate(pastCursor.getDate() - i);
      const pastDateStr = formatISTDate(pastCursor);
      const pastDayOfWeek = getISTDayOfWeek(pastCursor);

      for (const todo of todos) {
        // Skip dates before the task was created
        const taskCreatedDate = getISTDateString(new Date(todo.created_at));
        if (pastDateStr < taskCreatedDate) continue;

        // Check existing occurrence record
        const [occurrence] = (await sql`
          SELECT id, status FROM task_occurrences
          WHERE user_id = ${userId} AND todo_id = ${todo.id} AND occurrence_date = ${pastDateStr}
        `) as { id: number; status: string }[];

        // If occurrence already processed as completed, skipped, rescheduled, or no_action, skip
        if (occurrence && occurrence.status !== "pending") {
          continue;
        }

        // Check if task was scheduled/active on pastDateStr
        const isActive =
          occurrence?.status === "pending" ||
          (todo.scheduled_date
            ? todo.scheduled_date === pastDateStr
            : isTaskActiveOnDay(todo.assigned_day, pastDayOfWeek));

        if (!isActive) continue;

        // Check task_completions table (by todo_id OR matching title)
        const [completion] = (await sql`
          SELECT id, completed_at FROM task_completions
          WHERE user_id = ${userId}
            AND (todo_id = ${todo.id} OR LOWER(TRIM(todo_title)) = LOWER(TRIM(${todo.title})))
            AND completed_date = ${pastDateStr}
        `) as { id: number; completed_at?: string }[];

        if (completion) {
          // It was completed in task_completions
          await sql`
            INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, scheduled_time, completed_at, review_status)
            VALUES (${userId}, ${todo.id}, ${pastDateStr}, 'completed', ${todo.scheduled_time || ""}, ${completion.completed_at || new Date().toISOString()}, 'reviewed')
            ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
            SET status = 'completed', completed_at = EXCLUDED.completed_at, review_status = 'reviewed', updated_at = NOW()
          `;
        } else {
          // No action taken! Mark as no_action
          await sql`
            INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, scheduled_time, review_status)
            VALUES (${userId}, ${todo.id}, ${pastDateStr}, 'no_action', ${todo.scheduled_time || ""}, 'unreviewed')
            ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
            SET status = 'no_action', updated_at = NOW()
          `;

          // Log no_action activity if not already logged for this date
          const [existingActivity] = (await sql`
            SELECT id FROM task_activities
            WHERE user_id = ${userId} AND todo_id = ${todo.id} AND occurrence_date = ${pastDateStr} AND action_type = 'no_action'
          `) as { id: number }[];

          if (!existingActivity) {
            await sql`
              INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, metadata)
              VALUES (${userId}, ${todo.id}, ${pastDateStr}, 'no_action', ${JSON.stringify({ reason: "scheduled_occurrence_passed" })})
            `;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in detectNoActionOccurrences:", error);
    throw error;
  }
}
