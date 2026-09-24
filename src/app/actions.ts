"use server";

import {
  sql,
  withTransaction,
  initDb,
  Todo,
  DaySection,
  normalizeDaySection,
  Priority,
  TaskKind,
  Difficulty,
  ExpectedEffort,
  MissedReason,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getISTDateString, getISTDayOfWeek, isTaskActiveOnDay } from "@/lib/time-utils";
import { PushSubscriptionData, sendPushToUser } from "@/lib/push";
import { detectNoActionOccurrences } from "@/lib/no-action-detector";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore when executed outside Next.js request context (e.g., test runner)
  }
}

export interface AnalyticsData {
  today: { completed: number; total: number; percentage: number };
  allTimeCompleted: number;
  bestStreak: number;
  lastSevenDays: { date: string; label: string; completed: number; total: number; percentage: number }[];
  lastThirtyDays: { date: string; label: string; completed: number; total: number; percentage: number }[];
  byCategory: { label: string; value: number }[];
  byDayOfWeek: { label: string; value: number }[];
  taskStreaks: { title: string; streak: number }[];
}

let dbInitPromise: Promise<void> | null = null;
async function ensureDb() {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((error) => {
      console.error("Failed to initialize database:", error);
      dbInitPromise = null;
    });
  }
  await dbInitPromise;
}

async function requireUser() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session.userId;
}

async function verifyTaskOwnership(id: number, userId: string): Promise<boolean> {
  const rows = await sql`
    SELECT id, user_id FROM todos WHERE id = ${id}
  `;
  if (!rows || rows.length === 0) return false;
  return (rows[0] as Todo).user_id === userId;
}

function getOtherUserId(userId: string) {
  return userId === "user1" ? "user2" : "user1";
}

function getUserName(userId: string) {
  return userId === "user1" ? "User 1" : "User 2";
}

async function getFriendNickname(recipientUserId: string, friendUserId: string) {
  const [preference] = await sql`
    SELECT friend_nickname FROM user_preferences WHERE user_id = ${recipientUserId}
  `;
  const nickname = (preference?.friend_nickname as string | undefined)?.trim();
  return nickname || getUserName(friendUserId);
}

function isValidSubscription(subscription: PushSubscriptionData) {
  return Boolean(
    subscription &&
      typeof subscription.endpoint === "string" &&
      subscription.endpoint.length >= 10 &&
      subscription.endpoint.length <= 16384 &&
      typeof subscription.keys?.p256dh === "string" &&
      subscription.keys.p256dh.length <= 4096 &&
      typeof subscription.keys?.auth === "string" &&
      subscription.keys.auth.length <= 4096
  );
}

async function notifyOtherUser(userId: string, action: "added" | "completed", taskTitle: string) {
  try {
    const recipientUserId = getOtherUserId(userId);
    const friendName = await getFriendNickname(recipientUserId, userId);
    await sendPushToUser(recipientUserId, {
      title: "Lets Do It",
      body: `${friendName} ${action} “${taskTitle}”.`,
      url: "/",
    });
  } catch (error) {
    // A delivery failure must never prevent a task from being saved.
    console.error("Failed to send task push notification:", error);
  }
}

/**
 * Daily Reset: Automatically unchecks completed tasks when IST date changes past midnight (12:00 AM IST)
 */
async function checkAndPerformDailyReset(userId: string) {
  const currentISTDate = getISTDateString();
  try {
    await sql`
      UPDATE todos
      SET completed = FALSE, last_reset_date = ${currentISTDate}
      WHERE user_id = ${userId} 
        AND (last_reset_date IS NULL OR last_reset_date = '' OR last_reset_date != ${currentISTDate})
    `;
  } catch (error) {
    console.error("Failed to perform daily reset:", error);
  }
}

/**
 * Backwards compatibility migration: Ensures legacy rows missing day_section are assigned 'MORNING'
 */
async function migrateLegacyTaskSections(userId: string) {
  try {
    await sql`
      UPDATE todos
      SET day_section = 'MORNING'
      WHERE user_id = ${userId}
        AND (day_section IS NULL OR day_section = '' OR day_section NOT IN ('MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'))
    `;
  } catch (error) {
    console.error("Failed to migrate legacy task sections:", error);
  }
}

/**
 * Fetch todos for logged in user.
 */
export async function getTodos(dayFilter: string = "today"): Promise<{ todos: Todo[]; todayDay: string }> {
  try {
    await ensureDb();
    const userId = await requireUser();
    
    // Check and trigger daily reset at midnight IST
    await checkAndPerformDailyReset(userId);
    await migrateLegacyTaskSections(userId);

    // Detect and log no_action task occurrences for past days
    await detectNoActionOccurrences(userId);

    const todayDay = getISTDayOfWeek();
    const rawUserRows = (await sql`
      SELECT * FROM todos 
      WHERE user_id = ${userId} 
      ORDER BY sort_order ASC, created_at DESC
    `) as Todo[];

    const allUserRows = rawUserRows.map((t) => ({
      ...t,
      day_section: normalizeDaySection(t.day_section, t.title),
    }));

    let filteredTodos: Todo[];

    if (dayFilter === "all") {
      filteredTodos = allUserRows;
    } else {
      const targetDay = dayFilter === "today" ? todayDay : dayFilter;
      filteredTodos = allUserRows.filter((t) => isTaskActiveOnDay(t.assigned_day, targetDay));
    }

    return { todos: filteredTodos, todayDay };
  } catch (error) {
    console.error("Failed to fetch todos:", error);
    return { todos: [], todayDay: getISTDayOfWeek() };
  }
}

export async function getOtherUserTodos(): Promise<{ userId: string; todos: Todo[]; todayDay: string }> {
  try {
    await ensureDb();
    const userId = await requireUser();
    const otherUserId = getOtherUserId(userId);

    // Perform daily reset check for other user
    await checkAndPerformDailyReset(otherUserId);
    await migrateLegacyTaskSections(otherUserId);
    await detectNoActionOccurrences(otherUserId);

    const todayDay = getISTDayOfWeek();
    const rawOtherRows = (await sql`
      SELECT * FROM todos 
      WHERE user_id = ${otherUserId} 
      ORDER BY sort_order ASC, created_at DESC
    `) as Todo[];

    const allOtherRows = rawOtherRows.map((t) => ({
      ...t,
      day_section: normalizeDaySection(t.day_section, t.title),
    }));

    const filteredTodos = allOtherRows.filter((t) => isTaskActiveOnDay(t.assigned_day, todayDay));

    return {
      userId: otherUserId,
      todos: filteredTodos,
      todayDay,
    };
  } catch (error) {
    console.error("Failed to fetch other user todos:", error);
    return { userId: "user2", todos: [], todayDay: getISTDayOfWeek() };
  }
}

export async function addTodo(data: {
  title: string;
  task_type?: string;
  type_value?: string;
  assigned_day?: string;
  category?: string;
  day_section?: string;
  // Phase 1 extended fields
  priority?: Priority;
  task_kind?: TaskKind;
  estimated_duration?: number;
  difficulty?: Difficulty;
  expected_effort?: ExpectedEffort;
  goal_reason?: string;
  note?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  track_progress?: boolean;
  target_value?: number | null;
  unit?: string | null;
}) {
  const title = data.title?.trim();
  const task_type = data.task_type || "checkbox";
  const type_value = data.type_value || "";
  const assigned_day = data.assigned_day !== undefined ? data.assigned_day : "everyday";
  const category = data.category?.trim().slice(0, 40) || "Personal";
  const day_section = normalizeDaySection(data.day_section, title);
  const currentISTDate = getISTDateString();

  const priority = data.priority || "should_do";
  const task_kind = data.task_kind || "other";
  const estimated_duration = data.estimated_duration || 15;
  const difficulty = data.difficulty || "medium";
  const expected_effort = data.expected_effort || "medium";
  const goal_reason = data.goal_reason?.trim() || "";
  const note = data.note?.trim() || "";
  const scheduled_date = data.scheduled_date?.trim() || "";
  const scheduled_time = data.scheduled_time?.trim() || "";

  if (!title) {
    return { error: "Title is required" };
  }

  try {
    await ensureDb();
    const userId = await requireUser();
    const [maxRow] = await sql`
      SELECT MAX(sort_order) AS "maxOrder" FROM todos WHERE user_id = ${userId}
    `;
    const nextOrder = ((maxRow?.maxOrder as number | null) ?? 0) + 1;

    const { parseTargetValueAndUnit } = await import("@/lib/analytics-utils");
    const { targetValue: parsedTargetValue, unit: parsedUnit } = parseTargetValueAndUnit(type_value);

    const trackProgress = data.track_progress ?? false;
    const finalTargetValue = trackProgress
      ? (data.target_value !== undefined ? data.target_value : parsedTargetValue)
      : null;
    const finalUnit = trackProgress
      ? (data.unit !== undefined ? (data.unit?.trim() || null) : (parsedUnit || null))
      : null;

    const [inserted] = (await sql`
      INSERT INTO todos (
        user_id, title, task_type, type_value, sort_order, assigned_day, category, day_section, last_reset_date,
        priority, task_kind, estimated_duration, difficulty, expected_effort, goal_reason, note, scheduled_date, scheduled_time,
        target_value, unit, track_progress
      )
      VALUES (
        ${userId}, ${title}, ${task_type}, ${type_value}, ${nextOrder}, ${assigned_day}, ${category}, ${day_section}, ${currentISTDate},
        ${priority}, ${task_kind}, ${estimated_duration}, ${difficulty}, ${expected_effort}, ${goal_reason}, ${note}, ${scheduled_date}, ${scheduled_time},
        ${finalTargetValue}, ${finalUnit}, ${trackProgress}
      )
      RETURNING id
    `) as { id: number }[];

    const todoId = inserted?.id;

    if (todoId) {
      await sql`
        INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, new_value)
        VALUES (${userId}, ${todoId}, ${currentISTDate}, 'created', ${JSON.stringify({ title, priority, task_kind, category })})
      `;
    }

    await notifyOtherUser(userId, "added", title);
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    return { success: true, id: todoId };
  } catch (error) {
    console.error("Failed to add todo:", error);
    return { error: "Failed to save task to database" };
  }
}

export async function toggleTodo(id: number, currentCompleted: boolean, completedValue?: number | null) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const currentISTDate = getISTDateString();
    const nowIso = new Date().toISOString();

    const [todo] = (await sql`
      SELECT id, title, task_type, type_value, target_value, unit, category, scheduled_time FROM todos WHERE id = ${id} AND user_id = ${userId}
    `) as any[];

    const { parseTargetValueAndUnit } = await import("@/lib/analytics-utils");
    let targetVal = todo?.target_value ?? null;
    let unitVal = todo?.unit ?? null;
    if (targetVal === null && todo?.type_value) {
      const parsed = parseTargetValueAndUnit(todo.type_value);
      targetVal = parsed.targetValue;
      unitVal = parsed.unit || null;
    }

    const valToSave = (completedValue !== undefined && completedValue !== null) ? completedValue : null;

    await withTransaction(async (txSql) => {
      await txSql`
        UPDATE todos 
        SET completed = ${!currentCompleted}, last_reset_date = ${currentISTDate}
        WHERE id = ${id} AND user_id = ${userId}
      `;

      if (!currentCompleted && todo) {
        await txSql`
          INSERT INTO task_completions (user_id, todo_id, todo_title, task_type, category, completed_date, completed_at, target_value, completed_value, unit)
          VALUES (${userId}, ${id}, ${todo.title}, ${todo.task_type}, ${todo.category || "Personal"}, ${currentISTDate}, NOW(), ${targetVal}, ${valToSave}, ${unitVal})
          ON CONFLICT (user_id, todo_id, completed_date) DO UPDATE
          SET completed_at = NOW(), target_value = ${targetVal}, completed_value = ${valToSave}, unit = ${unitVal}
        `;

        await txSql`
          INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, scheduled_time, completed_at, target_value, completed_value, unit)
          VALUES (${userId}, ${id}, ${currentISTDate}, 'completed', ${todo.scheduled_time || ""}, NOW(), ${targetVal}, ${valToSave}, ${unitVal})
          ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
          SET status = 'completed', completed_at = NOW(), target_value = ${targetVal}, completed_value = ${valToSave}, unit = ${unitVal}, updated_at = NOW()
        `;

        await txSql`
          INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, new_value)
          VALUES (${userId}, ${id}, ${currentISTDate}, 'completed', ${JSON.stringify({ completed_at: nowIso, target_value: targetVal, completed_value: valToSave, unit: unitVal })})
        `;
      } else {
        await txSql`
          DELETE FROM task_completions
          WHERE user_id = ${userId} AND todo_id = ${id} AND completed_date = ${currentISTDate}
        `;

        await txSql`
          INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, completed_at, completed_value)
          VALUES (${userId}, ${id}, ${currentISTDate}, 'pending', NULL, NULL)
          ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
          SET status = 'pending', completed_at = NULL, completed_value = NULL, updated_at = NOW()
        `;

        await txSql`
          INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type)
          VALUES (${userId}, ${id}, ${currentISTDate}, 'uncompleted')
        `;
      }
    });

    if (!currentCompleted && todo) {
      await notifyOtherUser(userId, "completed", todo.title);
    }
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    safeRevalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle todo:", error);
    return { error: "Failed to update task" };
  }
}

export async function skipTodo(
  id: number,
  date?: string,
  reason?: string,
  notes?: string
) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const occurrenceDate = date || getISTDateString();
    const missedReason = reason || "";
    const missedNotes = notes?.trim() || "";

    const [todo] = await sql`
      SELECT scheduled_time FROM todos WHERE id = ${id} AND user_id = ${userId}
    `;

    await withTransaction(async (txSql) => {
      await txSql`
        INSERT INTO task_occurrences (
          user_id, todo_id, occurrence_date, status, scheduled_time, skipped_at, missed_reason, missed_reason_notes
        )
        VALUES (
          ${userId}, ${id}, ${occurrenceDate}, 'skipped', ${todo?.scheduled_time || ""}, NOW(), ${missedReason}, ${missedNotes}
        )
        ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
        SET status = 'skipped',
            skipped_at = NOW(),
            missed_reason = ${missedReason},
            missed_reason_notes = ${missedNotes},
            updated_at = NOW()
      `;

      await txSql`
        INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, metadata)
        VALUES (${userId}, ${id}, ${occurrenceDate}, 'skipped', ${JSON.stringify({ missed_reason: missedReason, notes: missedNotes })})
      `;
    });

    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    safeRevalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    console.error("Failed to skip todo:", error);
    return { error: "Failed to skip task" };
  }
}

export async function rescheduleTodo(
  id: number,
  data: {
    newScheduledDate: string;
    newScheduledTime?: string;
    occurrenceDate?: string;
    reason?: string;
    notes?: string;
  }
) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const [todo] = (await sql`
      SELECT scheduled_date, scheduled_time FROM todos WHERE id = ${id} AND user_id = ${userId}
    `) as { scheduled_date?: string; scheduled_time?: string }[];

    const prevDate = todo?.scheduled_date || "";
    const prevTime = todo?.scheduled_time || "";
    const occurrenceDate = data.occurrenceDate || getISTDateString();
    const newScheduledTime = data.newScheduledTime || "";
    const missedReason = data.reason || "";
    const missedNotes = data.notes?.trim() || "";

    await withTransaction(async (txSql) => {
      await txSql`
        UPDATE todos
        SET scheduled_date = ${data.newScheduledDate}, scheduled_time = ${newScheduledTime}
        WHERE id = ${id} AND user_id = ${userId}
      `;

      await txSql`
        INSERT INTO task_occurrences (
          user_id, todo_id, occurrence_date, status, scheduled_time, rescheduled_at,
          rescheduled_to_date, rescheduled_to_time, missed_reason, missed_reason_notes
        )
        VALUES (
          ${userId}, ${id}, ${occurrenceDate}, 'rescheduled', ${prevTime}, NOW(),
          ${data.newScheduledDate}, ${newScheduledTime}, ${missedReason}, ${missedNotes}
        )
        ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
        SET status = 'rescheduled',
            rescheduled_at = NOW(),
            rescheduled_to_date = ${data.newScheduledDate},
            rescheduled_to_time = ${newScheduledTime},
            missed_reason = ${missedReason},
            missed_reason_notes = ${missedNotes},
            updated_at = NOW()
      `;

      await txSql`
        INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, previous_value, new_value, metadata)
        VALUES (
          ${userId},
          ${id},
          ${occurrenceDate},
          'rescheduled',
          ${JSON.stringify({ scheduled_date: prevDate, scheduled_time: prevTime })},
          ${JSON.stringify({ scheduled_date: data.newScheduledDate, scheduled_time: newScheduledTime })},
          ${JSON.stringify({ reason: missedReason, notes: missedNotes })}
        )
      `;
    });

    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    safeRevalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    console.error("Failed to reschedule todo:", error);
    return { error: "Failed to reschedule task" };
  }
}

export async function setMissedTaskReason(
  todoId: number,
  occurrenceDate: string,
  reason: MissedReason,
  notes?: string
) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(todoId, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const missedNotes = notes?.trim() || "";

    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, missed_reason, missed_reason_notes)
      VALUES (${userId}, ${todoId}, ${occurrenceDate}, 'no_action', ${reason}, ${missedNotes})
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET missed_reason = ${reason}, missed_reason_notes = ${missedNotes}, updated_at = NOW()
    `;

    safeRevalidatePath("/");
    safeRevalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    console.error("Failed to set missed task reason:", error);
    return { error: "Failed to save missed task reason" };
  }
}

export async function getUnreviewedMissedOccurrences() {
  try {
    await ensureDb();
    const userId = await requireUser();
    const { detectNoActionOccurrences } = await import("@/lib/no-action-detector");
    await detectNoActionOccurrences(userId, 7);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = getISTDateString(threeDaysAgo);

    const occurrences = (await sql`
      SELECT
        o.id,
        o.user_id,
        o.todo_id,
        o.occurrence_date,
        o.status,
        o.scheduled_time,
        o.missed_reason,
        o.missed_reason_notes,
        o.review_status,
        o.app_update_reason,
        o.app_update_reason_notes,
        t.title as todo_title,
        t.category,
        t.day_section
      FROM task_occurrences o
      JOIN todos t ON o.todo_id = t.id
      WHERE o.user_id = ${userId}
        AND o.status = 'no_action'
        AND (o.review_status = 'unreviewed' OR o.review_status IS NULL OR o.review_status = '')
        AND o.occurrence_date >= ${threeDaysAgoStr}
      ORDER BY o.occurrence_date DESC, o.id DESC
      LIMIT 10
    `) as any[];

    return occurrences;
  } catch (error) {
    console.error("Failed to get unreviewed missed occurrences:", error);
    return [];
  }
}

export async function submitMissedTaskReview(
  occurrenceId: number,
  data: {
    missedReason: string;
    missedReasonNotes?: string;
    appUpdateReason?: string;
    appUpdateReasonNotes?: string;
  }
) {
  try {
    await ensureDb();
    const userId = await requireUser();

    const [occ] = (await sql`
      SELECT id, todo_id, occurrence_date FROM task_occurrences WHERE id = ${occurrenceId} AND user_id = ${userId}
    `) as { id: number; todo_id: number; occurrence_date: string }[];

    if (!occ) {
      return { error: "Occurrence not found" };
    }

    const missedNotes = data.missedReasonNotes?.trim() || "";
    const appReason = data.appUpdateReason || "";
    const appNotes = data.appUpdateReasonNotes?.trim() || "";

    await withTransaction(async (txSql) => {
      await txSql`
        UPDATE task_occurrences
        SET review_status = 'reviewed',
            reviewed_at = NOW(),
            missed_reason = ${data.missedReason},
            missed_reason_notes = ${missedNotes},
            app_update_reason = ${appReason},
            app_update_reason_notes = ${appNotes},
            updated_at = NOW()
        WHERE id = ${occurrenceId} AND user_id = ${userId}
      `;

      await txSql`
        INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, metadata)
        VALUES (
          ${userId},
          ${occ.todo_id},
          ${occ.occurrence_date},
          'reviewed',
          ${JSON.stringify({
            missed_reason: data.missedReason,
            missed_reason_notes: missedNotes,
            app_update_reason: appReason,
            app_update_reason_notes: appNotes,
          })}
        )
      `;
    });

    safeRevalidatePath("/");
    safeRevalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    console.error("Failed to submit missed task review:", error);
    return { error: "Failed to submit review" };
  }
}

export async function updateTaskReviewReason(
  occurrenceId: number,
  data: {
    missedReason: string;
    missedReasonNotes?: string;
    appUpdateReason?: string;
    appUpdateReasonNotes?: string;
  }
) {
  try {
    await ensureDb();
    const userId = await requireUser();

    const [occ] = (await sql`
      SELECT id, todo_id, occurrence_date FROM task_occurrences WHERE id = ${occurrenceId} AND user_id = ${userId}
    `) as { id: number; todo_id: number; occurrence_date: string }[];

    if (!occ) {
      return { error: "Occurrence not found" };
    }

    const missedNotes = data.missedReasonNotes?.trim() || "";
    const appReason = data.appUpdateReason || "";
    const appNotes = data.appUpdateReasonNotes?.trim() || "";

    await sql`
      UPDATE task_occurrences
      SET missed_reason = ${data.missedReason},
          missed_reason_notes = ${missedNotes},
          app_update_reason = ${appReason},
          app_update_reason_notes = ${appNotes},
          updated_at = NOW()
      WHERE id = ${occurrenceId} AND user_id = ${userId}
    `;

    await sql`
      INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, metadata)
      VALUES (
        ${userId},
        ${occ.todo_id},
        ${occ.occurrence_date},
        'updated_review',
        ${JSON.stringify({
          missed_reason: data.missedReason,
          missed_reason_notes: missedNotes,
          app_update_reason: appReason,
          app_update_reason_notes: appNotes,
        })}
      )
    `;

    safeRevalidatePath("/");
    safeRevalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task review reason:", error);
    return { error: "Failed to update review reason" };
  }
}

export async function subscribeToPushNotifications(subscription: PushSubscriptionData) {
  if (!isValidSubscription(subscription)) {
    return { error: "Invalid push subscription" };
  }

  try {
    await ensureDb();
    const userId = await requireUser();
    await sql`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (${userId}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth})
      ON CONFLICT (endpoint) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          updated_at = NOW()
    `;
    return { success: true };
  } catch (error) {
    console.error("Failed to save push subscription:", error);
    return { error: "Failed to enable notifications" };
  }
}

export async function unsubscribeFromPushNotifications(endpoint: string) {
  try {
    await ensureDb();
    const userId = await requireUser();
    await sql`
      DELETE FROM push_subscriptions
      WHERE user_id = ${userId} AND (endpoint = ${endpoint} OR ${endpoint === ""})
    `;
    return { success: true };
  } catch (error) {
    console.error("Failed to remove push subscription:", error);
    return { error: "Failed to disable notifications" };
  }
}

export async function clearUserPushSubscriptions() {
  try {
    await ensureDb();
    const userId = await requireUser();
    await sql`
      DELETE FROM push_subscriptions
      WHERE user_id = ${userId}
    `;
    return { success: true };
  } catch (error) {
    console.error("Failed to clear push subscriptions:", error);
    return { error: "Failed to clear notifications" };
  }
}

export interface TodayTaskComparisonData {
  myStatus: "completed" | "pending" | "skipped";
  myValue?: string | null;
  friendStatus: "completed" | "pending" | "skipped" | "not_scheduled";
  friendValue?: string | null;
  friendName: string;
  myTodayPercentage: number;
  myTodayCompleted: number;
  myTodayTotal: number;
  friendTodayPercentage: number;
  friendTodayCompleted: number;
  friendTodayTotal: number;
}

export async function getTodayTaskComparison(todoId: number): Promise<TodayTaskComparisonData> {
  try {
    await ensureDb();
    const currentUserId = await requireUser();
    const friendUserId = getOtherUserId(currentUserId);
    const friendName = await getFriendNickname(currentUserId, friendUserId);
    const todayStr = getISTDateString();
    const todayDayOfWeek = getISTDayOfWeek();

    // Overall Today Progress for Me
    const myAllTodos = (await sql`
      SELECT id, assigned_day FROM todos WHERE user_id = ${currentUserId} AND (exclude_from_analytics IS NOT TRUE)
    `) as { id: number; assigned_day?: string }[];
    const myTodayScheduledTodos = myAllTodos.filter((t) => isTaskActiveOnDay(t.assigned_day, todayDayOfWeek));
    const myTodayTotal = myTodayScheduledTodos.length;

    const myTodayCompletions = (await sql`
      SELECT DISTINCT c.todo_id 
      FROM task_completions c
      JOIN todos t ON c.todo_id = t.id
      WHERE c.user_id = ${currentUserId} 
        AND c.completed_date = ${todayStr}
        AND (t.exclude_from_analytics IS NOT TRUE)
    `) as { todo_id: number }[];
    const myTodayCompleted = myTodayCompletions.length;
    const myTodayPercentage = myTodayTotal > 0 ? Math.min(100, Math.round((myTodayCompleted / myTodayTotal) * 100)) : 0;

    // Overall Today Progress for Friend (Anu)
    const friendAllTodos = (await sql`
      SELECT id, assigned_day FROM todos WHERE user_id = ${friendUserId} AND (exclude_from_analytics IS NOT TRUE)
    `) as { id: number; assigned_day?: string }[];
    const friendTodayScheduledTodos = friendAllTodos.filter((t) => isTaskActiveOnDay(t.assigned_day, todayDayOfWeek));
    const friendTodayTotal = friendTodayScheduledTodos.length;

    const friendTodayCompletions = (await sql`
      SELECT DISTINCT c.todo_id 
      FROM task_completions c
      JOIN todos t ON c.todo_id = t.id
      WHERE c.user_id = ${friendUserId} 
        AND c.completed_date = ${todayStr}
        AND (t.exclude_from_analytics IS NOT TRUE)
    `) as { todo_id: number }[];
    const friendTodayCompleted = friendTodayCompletions.length;
    const friendTodayPercentage = friendTodayTotal > 0 ? Math.min(100, Math.round((friendTodayCompleted / friendTodayTotal) * 100)) : 0;

    const fallbackReturn = {
      myStatus: "pending" as const,
      friendStatus: "not_scheduled" as const,
      friendName,
      myTodayPercentage,
      myTodayCompleted,
      myTodayTotal,
      friendTodayPercentage,
      friendTodayCompleted,
      friendTodayTotal,
    };

    const [todo] = (await sql`SELECT title FROM todos WHERE id = ${todoId}`) as { title: string }[];
    if (!todo) {
      return fallbackReturn;
    }

    const cleanTitle = todo.title.trim().toLowerCase();

    // Fetch my status for today
    const [myOcc] = (await sql`
      SELECT status, completed_value, unit FROM task_occurrences
      WHERE user_id = ${currentUserId} AND todo_id = ${todoId} AND occurrence_date = ${todayStr}
    `) as { status: string; completed_value?: any; unit?: string }[];

    const [myComp] = (await sql`
      SELECT completed_value, unit FROM task_completions
      WHERE user_id = ${currentUserId} AND todo_id = ${todoId} AND completed_date = ${todayStr}
    `) as { completed_value?: any; unit?: string }[];

    let myStatus: TodayTaskComparisonData["myStatus"] = "pending";
    let myValueStr: string | null = null;

    if (myComp || myOcc?.status === "completed") {
      myStatus = "completed";
      const val = myComp?.completed_value ?? myOcc?.completed_value;
      const unit = myComp?.unit ?? myOcc?.unit;
      if (val !== undefined && val !== null) {
        myValueStr = `${val} ${unit || ""}`.trim();
      }
    } else if (myOcc?.status === "skipped") {
      myStatus = "skipped";
    }

    // Match friend's task cleanly by trimmed lowercase title
    const friendTodos = (await sql`
      SELECT id, title, assigned_day FROM todos WHERE user_id = ${friendUserId}
    `) as { id: number; title: string; assigned_day?: string }[];

    const friendTodo = friendTodos.find(
      (t) => t.title.trim().toLowerCase() === cleanTitle
    );

    let friendStatus: TodayTaskComparisonData["friendStatus"] = "not_scheduled";
    let friendValueStr: string | null = null;

    if (friendTodo) {
      const isActiveToday = isTaskActiveOnDay(friendTodo.assigned_day, todayDayOfWeek);

      const [friendOcc] = (await sql`
        SELECT status, completed_value, unit FROM task_occurrences
        WHERE user_id = ${friendUserId} AND todo_id = ${friendTodo.id} AND occurrence_date = ${todayStr}
      `) as { status: string; completed_value?: any; unit?: string }[];

      const [friendComp] = (await sql`
        SELECT completed_value, unit FROM task_completions
        WHERE user_id = ${friendUserId} AND todo_id = ${friendTodo.id} AND completed_date = ${todayStr}
      `) as { completed_value?: any; unit?: string }[];

      if (friendComp || friendOcc?.status === "completed") {
        friendStatus = "completed";
        const val = friendComp?.completed_value ?? friendOcc?.completed_value;
        const unit = friendComp?.unit ?? friendOcc?.unit;
        if (val !== undefined && val !== null) {
          friendValueStr = `${val} ${unit || ""}`.trim();
        }
      } else if (friendOcc?.status === "skipped") {
        friendStatus = "skipped";
      } else if (isActiveToday) {
        friendStatus = "pending";
      } else {
        friendStatus = "not_scheduled";
      }
    }

    return {
      myStatus,
      myValue: myValueStr,
      friendStatus,
      friendValue: friendValueStr,
      friendName,
      myTodayPercentage,
      myTodayCompleted,
      myTodayTotal,
      friendTodayPercentage,
      friendTodayCompleted,
      friendTodayTotal,
    };
  } catch (error) {
    console.error("Failed to get today task comparison:", error);
    return {
      myStatus: "pending",
      friendStatus: "not_scheduled",
      friendName: "Friend",
      myTodayPercentage: 0,
      myTodayCompleted: 0,
      myTodayTotal: 0,
      friendTodayPercentage: 0,
      friendTodayCompleted: 0,
      friendTodayTotal: 0,
    };
  }
}

export async function getFriendNicknamePreference() {
  try {
    await ensureDb();
    const userId = await requireUser();
    return await getFriendNickname(userId, getOtherUserId(userId));
  } catch (error) {
    console.error("Failed to fetch friend nickname:", error);
    return "";
  }
}

export async function saveFriendNickname(nickname: string) {
  const normalizedNickname = nickname.trim().slice(0, 40);
  try {
    await ensureDb();
    const userId = await requireUser();
    await sql`
      INSERT INTO user_preferences (user_id, friend_nickname)
      VALUES (${userId}, ${normalizedNickname})
      ON CONFLICT (user_id) DO UPDATE
      SET friend_nickname = EXCLUDED.friend_nickname,
          updated_at = NOW()
    `;
    revalidatePath("/");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to save friend nickname:", error);
    return { error: "Failed to save nickname" };
  }
}

function dateFromISTString(value: string) {
  return new Date(`${value}T12:00:00+05:30`);
}

function formatISTDate(date: Date) {
  return getISTDateString(date);
}

function getCompletionStreak(dates: Set<string>, endDate: string) {
  let streak = 0;
  const cursor = dateFromISTString(endDate);
  while (dates.has(formatISTDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getAnalytics(forOtherUser = false, includeToday = false): Promise<AnalyticsData> {
  await ensureDb();
  const currentUserId = await requireUser();
  const userId = forOtherUser ? (currentUserId === "user1" ? "user2" : "user1") : currentUserId;
  const today = getISTDateString();

  const dayOffRows = (await sql`
    SELECT date, type FROM day_offs WHERE user_id = ${userId}
  `) as { date: string; type: string }[];
  const dayOffSet = new Set(dayOffRows.map((d) => d.date));

  const todos = (await sql`SELECT * FROM todos WHERE user_id = ${userId} AND (exclude_from_analytics IS NOT TRUE)`) as Todo[];
  const completions = (await sql`
    SELECT c.todo_id, c.todo_title, c.task_type, c.category, c.completed_date
    FROM task_completions c
    JOIN todos t ON c.todo_id = t.id
    WHERE c.user_id = ${userId}
      AND (t.exclude_from_analytics IS NOT TRUE)
      AND c.completed_date NOT IN (SELECT date FROM day_offs WHERE user_id = ${userId})
    ORDER BY c.completed_date DESC
  `) as { todo_id: number; todo_title: string; task_type: string; category: string; completed_date: string }[];

  const completionDates = new Set(completions.map((item) => item.completed_date));

  // buildDailyAnalytics: for days=7, end at yesterday (today - 1) if includeToday is false.
  const buildDailyAnalytics = (days: number) => Array.from({ length: days }, (_, index) => {
      const date = dateFromISTString(today);
      const endDateOffset = includeToday ? 0 : (days === 7 ? 1 : 0);
      date.setDate(date.getDate() - endDateOffset - (days - 1 - index));
      const key = formatISTDate(date);
      const isDayOff = dayOffSet.has(key);
      const day = getISTDayOfWeek(date);

      if (isDayOff) {
        return {
          date: key,
          label: days === 7
            ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(date)
            : new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "Asia/Kolkata" }).format(date),
          completed: 0,
          total: 0,
          percentage: 100, // Day off doesn't penalize consistency
          isDayOff: true,
        };
      }

      const total = todos.filter((todo) => isTaskActiveOnDay(todo.assigned_day, day)).length;
      const completed = completions.filter((item) => item.completed_date === key).length;
      return {
        date: key,
        label: days === 7
          ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(date)
          : new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "Asia/Kolkata" }).format(date),
        completed,
        total,
        percentage: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
        isDayOff: false,
      };
    });
  const lastSevenDays = buildDailyAnalytics(7);
  const lastThirtyDays = buildDailyAnalytics(30);

  const todayData = lastThirtyDays[lastThirtyDays.length - 1]; // Today's data from 30-day range
  const categoryCounts = new Map<string, number>();
  completions.forEach(({ category }) => {
    const value = category?.trim() || "Personal";
    categoryCounts.set(value, (categoryCounts.get(value) ?? 0) + 1);
  });
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekdayCounts = weekdays.map((label) => ({ label, value: 0 }));
  completions.forEach(({ completed_date }) => {
    const day = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(dateFromISTString(completed_date));
    const item = weekdayCounts.find((entry) => entry.label === day);
    if (item) item.value += 1;
  });
  const byTodo = new Map<number, { title: string; dates: Set<string> }>();
  completions.forEach((item) => {
    const entry = byTodo.get(item.todo_id) ?? { title: item.todo_title, dates: new Set<string>() };
    entry.dates.add(item.completed_date);
    byTodo.set(item.todo_id, entry);
  });
  const taskStreaks = Array.from(byTodo.values())
    .map((item) => ({ title: item.title, streak: getCompletionStreak(item.dates, today) }))
    .filter((item) => item.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 5);

  let bestStreak = 0;
  let runningStreak = 0;
  const sortedDates = Array.from(completionDates).sort();
  let previous: Date | undefined;
  sortedDates.forEach((value) => {
    const current = dateFromISTString(value);
    if (previous && Math.round((current.getTime() - previous.getTime()) / 86_400_000) === 1) runningStreak += 1;
    else runningStreak = 1;
    bestStreak = Math.max(bestStreak, runningStreak);
    previous = current;
  });

  return {
    today: { completed: todayData.completed, total: todayData.total, percentage: todayData.percentage },
    allTimeCompleted: completions.length,
    bestStreak,
    lastSevenDays,
    lastThirtyDays,
    byCategory: Array.from(categoryCounts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    byDayOfWeek: weekdayCounts,
    taskStreaks,
  };
}

export async function getTaskHistory(date: string, forOtherUser = false) {
  await ensureDb();
  const currentUserId = await requireUser();
  const userId = forOtherUser ? (currentUserId === "user1" ? "user2" : "user1") : currentUserId;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const targetDate = dateFromISTString(date);
  const day = getISTDayOfWeek(targetDate);
  const todos = (await sql`
    SELECT * FROM todos WHERE user_id = ${userId} ORDER BY sort_order ASC, created_at DESC
  `) as Todo[];
  const completedRows = (await sql`
    SELECT todo_id FROM task_completions
    WHERE user_id = ${userId} AND completed_date = ${date}
  `) as { todo_id: number }[];
  const completedIds = new Set(completedRows.map((item) => item.todo_id));
  const tasks = todos
    .filter((todo) => isTaskActiveOnDay(todo.assigned_day, day))
    .map((todo) => ({ ...todo, completed: completedIds.has(todo.id) }));
  return { tasks, completed: tasks.filter((task) => task.completed).length };
}

export async function updateTaskValue(id: number, type_value: string) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const { parseTargetValueAndUnit } = await import("@/lib/analytics-utils");
    const { targetValue, unit } = parseTargetValueAndUnit(type_value);

    await sql`
      UPDATE todos 
      SET type_value = ${type_value}, target_value = ${targetValue}, unit = ${unit || null}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task value:", error);
    return { error: "Failed to update task value" };
  }
}

export async function updateTaskOrder(orderedIds: number[]) {
  try {
    await ensureDb();
    const userId = await requireUser();
    
    for (const id of orderedIds) {
      const isOwner = await verifyTaskOwnership(id, userId);
      if (!isOwner) {
        return { error: "Unauthorized: You can only modify your own tasks" };
      }
    }

    for (let index = 0; index < orderedIds.length; index++) {
      await sql`
        UPDATE todos 
        SET sort_order = ${index + 1} 
        WHERE id = ${orderedIds[index]} AND user_id = ${userId}
      `;
    }
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task order:", error);
    return { error: "Failed to save task order" };
  }
}

export async function updateTaskSectionAndOrder(id: number, newSection: DaySection, orderedIds: number[]) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    await sql`
      UPDATE todos
      SET day_section = ${newSection}
      WHERE id = ${id} AND user_id = ${userId}
    `;

    for (let index = 0; index < orderedIds.length; index++) {
      await sql`
        UPDATE todos 
        SET sort_order = ${index + 1} 
        WHERE id = ${orderedIds[index]} AND user_id = ${userId}
      `;
    }
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task section and order:", error);
    return { error: "Failed to save task section update" };
  }
}


export async function editTodo(
  id: number,
  data: {
    title: string;
    task_type: string;
    type_value?: string;
    assigned_day?: string;
    category?: string;
    track_progress?: boolean;
    target_value?: number | null;
    unit?: string | null;
  }
) {
  const title = data.title?.trim();
  const task_type = data.task_type || "checkbox";
  const type_value = data.type_value || "";
  const assigned_day = data.assigned_day !== undefined ? data.assigned_day : "everyday";
  const category = data.category?.trim().slice(0, 40) || "Personal";

  if (!title) {
    return { error: "Title is required" };
  }

  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const { parseTargetValueAndUnit } = await import("@/lib/analytics-utils");
    const { targetValue: parsedTargetValue, unit: parsedUnit } = parseTargetValueAndUnit(type_value);

    const trackProgress = data.track_progress ?? false;
    const finalTargetValue = trackProgress
      ? (data.target_value !== undefined ? data.target_value : parsedTargetValue)
      : null;
    const finalUnit = trackProgress
      ? (data.unit !== undefined ? (data.unit?.trim() || null) : (parsedUnit || null))
      : null;

    await sql`
      UPDATE todos 
      SET title = ${title}, task_type = ${task_type}, type_value = ${type_value}, assigned_day = ${assigned_day}, category = ${category},
          target_value = ${finalTargetValue}, unit = ${finalUnit}, track_progress = ${trackProgress}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to edit todo:", error);
    return { error: "Failed to update task" };
  }
}

export async function toggleTaskExcludeAnalytics(id: number) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const [todo] = (await sql`SELECT exclude_from_analytics FROM todos WHERE id = ${id} AND user_id = ${userId}`) as { exclude_from_analytics?: boolean }[];
    const newValue = !todo?.exclude_from_analytics;

    await sql`
      UPDATE todos 
      SET exclude_from_analytics = ${newValue}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    safeRevalidatePath("/analytics");
    return { success: true, excludeFromAnalytics: newValue };
  } catch (error) {
    console.error("Failed to toggle exclude_from_analytics:", error);
    return { error: "Failed to update task setting" };
  }
}

export async function deleteTodo(id: number) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    await sql`
      DELETE FROM todos 
      WHERE id = ${id} AND user_id = ${userId}
    `;
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete todo:", error);
    return { error: "Failed to delete task" };
  }
}

export async function clearCompleted() {
  try {
    await ensureDb();
    const userId = await requireUser();
    await sql`
      DELETE FROM todos 
      WHERE completed = true AND user_id = ${userId}
    `;
    safeRevalidatePath("/");
    safeRevalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to clear completed todos:", error);
    return { error: "Failed to clear completed tasks" };
  }
}

export interface TaskPerformanceHistory {
  occurrences: { date: string; status: string }[];
  lastSevenBars: { dayLabel: string; date: string; completed: boolean; status: string }[];
  consistencyPercentage: number;
  totalOccurrences: number;
  completedCount: number;
  currentStreak: number;
  avgTime: string;
  insight: string | null;
  timeOfDayInsight: string;
}

export async function getTaskPerformanceHistory(
  todoId: number,
  targetUserId?: string,
  includeToday: boolean = false
): Promise<TaskPerformanceHistory> {
  try {
    await ensureDb();
    const currentUserId = await requireUser();
    const userId = targetUserId === "other" ? (currentUserId === "user1" ? "user2" : "user1") : (targetUserId || currentUserId);

    // Fetch todo details
    const [todo] = (await sql`
      SELECT id, estimated_duration, day_section FROM todos WHERE id = ${todoId}
    `) as { id: number; estimated_duration?: number; day_section?: string }[];

    // Fetch all occurrences for this todo
    const occurrences = (await sql`
      SELECT occurrence_date as date, status
      FROM task_occurrences
      WHERE user_id = ${userId} AND todo_id = ${todoId}
      ORDER BY occurrence_date DESC
      LIMIT 30
    `) as { date: string; status: string }[];

    // Also fetch completions to ensure no completed date is missed
    const completions = (await sql`
      SELECT completed_date as date
      FROM task_completions
      WHERE user_id = ${userId} AND todo_id = ${todoId}
      ORDER BY completed_date DESC
      LIMIT 30
    `) as { date: string }[];

    const statusMap = new Map<string, string>();
    occurrences.forEach((o) => statusMap.set(o.date, o.status));
    completions.forEach((c) => {
      if (!statusMap.has(c.date)) {
        statusMap.set(c.date, "completed");
      }
    });

    const todayStr = getISTDateString();
    const today = new Date();
    const lastSevenBars: { dayLabel: string; date: string; completed: boolean; status: string }[] = [];
    const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      const startOffset = includeToday ? 0 : 1;
      d.setDate(d.getDate() - startOffset - i);
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const getPart = (t: string) => parts.find((p) => p.type === t)?.value || "";
      const dateStr = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
      const dayIndex = d.getDay();
      const dayLabel = DAY_LABELS[dayIndex];

      const st = statusMap.get(dateStr) || "none";
      const isComp = st === "completed";
      lastSevenBars.push({
        dayLabel,
        date: dateStr,
        completed: isComp,
        status: st,
      });
    }

    // Compute active streak (consecutive completed days)
    let currentStreak = 0;
    const sortedCompletedDates = Array.from(statusMap.entries())
      .filter(([_, st]) => st === "completed")
      .map(([d, _]) => d)
      .sort((a, b) => b.localeCompare(a));

    if (sortedCompletedDates.length > 0) {
      let checkDate = new Date();
      // If today is not completed, start checking from yesterday
      if (!statusMap.has(todayStr) || statusMap.get(todayStr) !== "completed") {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(checkDate);
        const getPart = (t: string) => parts.find((p) => p.type === t)?.value || "";
        const cStr = `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

        if (statusMap.get(cStr) === "completed") {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const lastSevenCompleted = lastSevenBars.filter((b) => b.completed).length;
    const consistencyPercentage = Math.round((lastSevenCompleted / 7) * 100);

    const sec = todo?.day_section?.toLowerCase() || "morning";
    const timeOfDayInsight = `You usually complete this task in the ${sec}.`;
    const duration = todo?.estimated_duration || 20;
    const avgTime = `${duration} minutes`;
    const insight = `You completed this task in ${lastSevenCompleted} of the last 7 days.`;

    return {
      occurrences: occurrences.slice(0, 7).reverse(),
      lastSevenBars,
      consistencyPercentage,
      totalOccurrences: 7,
      completedCount: lastSevenCompleted,
      currentStreak,
      avgTime,
      insight,
      timeOfDayInsight,
    };
  } catch (error) {
    console.error("Failed to fetch task performance history:", error);
    return {
      occurrences: [],
      lastSevenBars: [],
      consistencyPercentage: 0,
      totalOccurrences: 0,
      completedCount: 0,
      currentStreak: 0,
      avgTime: "20 minutes",
      insight: "Keep going to build your habit streak!",
      timeOfDayInsight: "You usually complete this task on time.",
    };
  }
}
