"use server";

import { sql, initDb, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getISTDateString } from "@/lib/time-utils";
import { revalidatePath } from "next/cache";

export interface HistoryDaySummary {
  date: string;
  formattedDate: string;
  totalTasks: number;
  completedTasks: number;
  missingDetails: number;
  isEditable: boolean;
}

export interface DayTaskItem {
  todoId: number;
  occurrenceId: number | null;
  title: string;
  category: string;
  taskType: string; // input, number, time, checkbox
  scheduledTime: string;
  status: "completed" | "no_action" | "skipped" | "rescheduled" | "pending";
  targetValue: number | null;
  unit: string;
  completedValue: number | null;
  completedAt: string | null;
  isRecorded: boolean; // true if completed_value is non-null
  isMissingValue: boolean; // true if measurable + completed + completed_value === null
}

export interface TaskHistoryUpdateItem {
  todoId: number;
  status: "completed" | "no_action" | "skipped" | "rescheduled";
  completedValue?: number | null;
  completedAtTime?: string | null; // e.g. "05:20 PM" or ISO timestamp
}

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.userId;
}

function resolveUserId(currentUserId: string, targetUserId?: string): string {
  if (targetUserId === "other") {
    return currentUserId === "user1" ? "user2" : "user1";
  }
  return targetUserId || currentUserId;
}

/**
 * Computes the 5-day editable boundary date string in IST.
 * Editable window: TODAY + PREVIOUS 5 CALENDAR DAYS (6 days total).
 */
export async function getEditableMinDate(todayStr: string = getISTDateString()): Promise<string> {
  const [year, month, day] = todayStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 5);
  return d.toISOString().slice(0, 10);
}

/**
 * Checks if a given occurrence_date is within the 5-day editable window [today - 5 days, today].
 */
export async function isDateInEditableWindow(
  dateStr: string,
  todayStr: string = getISTDateString()
): Promise<boolean> {
  const minDate = await getEditableMinDate(todayStr);
  return dateStr >= minDate && dateStr <= todayStr;
}

/**
 * Fetches date-grouped history summary table data for the history page.
 */
export async function getHistoryTableData(
  targetUserId?: string
): Promise<HistoryDaySummary[]> {
  await initDb();
  const currentUserId = await requireUser();
  const userId = resolveUserId(currentUserId, targetUserId);

  const todayStr = getISTDateString();
  const minEditableDate = getEditableMinDate(todayStr);

  // Fetch all active todos for user
  const activeTodos = (await sql`
    SELECT id, title, task_type, target_value, unit, type_value
    FROM todos
    WHERE user_id = ${userId}
      AND (exclude_from_analytics IS NULL OR exclude_from_analytics = false)
  `) as { id: number; title: string; task_type: string; target_value: any; unit: string; type_value: string }[];

  const todoIdSet = new Set(activeTodos.map((t) => t.id));
  const todoTypeMap = new Map(activeTodos.map((t) => [t.id, t.task_type || "checkbox"]));

  // Fetch all occurrences for active todos
  const occurrences = (await sql`
    SELECT id, todo_id, occurrence_date, status, completed_value, completed_at
    FROM task_occurrences
    WHERE user_id = ${userId}
    ORDER BY occurrence_date DESC
  `) as {
    id: number;
    todo_id: number;
    occurrence_date: string;
    status: string;
    completed_value: any;
    completed_at: string | null;
  }[];

  // Group occurrences by date
  const grouped: Record<
    string,
    { totalTasks: number; completedTasks: number; missingDetails: number }
  > = {};

  occurrences.forEach((o) => {
    if (!todoIdSet.has(o.todo_id)) return;
    const date = o.occurrence_date;
    if (!grouped[date]) {
      grouped[date] = { totalTasks: 0, completedTasks: 0, missingDetails: 0 };
    }

    grouped[date].totalTasks++;
    if (o.status === "completed") {
      grouped[date].completedTasks++;

      const taskType = todoTypeMap.get(o.todo_id) || "checkbox";
      const isMeasurable = taskType === "input" || taskType === "number";

      if (isMeasurable) {
        if (o.completed_value === null || o.completed_value === undefined) {
          grouped[date].missingDetails++;
        }
      } else if (taskType === "time") {
        if (!o.completed_at) {
          grouped[date].missingDetails++;
        }
      }
      // Checkbox tasks have no quantitative missing requirement.
    }
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return Promise.all(
    sortedDates.map(async (dStr) => {
      const parts = dStr.split("-").map(Number);
      const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const formattedDate = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(dateObj);

      const isEditable = await isDateInEditableWindow(dStr, todayStr);

      return {
        date: dStr,
        formattedDate,
        totalTasks: grouped[dStr].totalTasks,
        completedTasks: grouped[dStr].completedTasks,
        missingDetails: grouped[dStr].missingDetails,
        isEditable,
      };
    })
  );
}

/**
 * Fetches all task details for a single day to populate the day-level edit form.
 */
export async function getDayHistoryDetails(
  dateStr: string,
  targetUserId?: string
): Promise<{
  date: string;
  formattedDate: string;
  isEditable: boolean;
  tasks: DayTaskItem[];
}> {
  await initDb();
  const currentUserId = await requireUser();
  const userId = resolveUserId(currentUserId, targetUserId);

  const todayStr = getISTDateString();
  const isEditable = await isDateInEditableWindow(dateStr, todayStr);

  const parts = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateObj);

  // Fetch active todos
  const todos = (await sql`
    SELECT id, title, category, task_type, scheduled_time, target_value, unit, type_value
    FROM todos
    WHERE user_id = ${userId}
      AND (exclude_from_analytics IS NULL OR exclude_from_analytics = false)
    ORDER BY sort_order ASC
  `) as any[];

  // Fetch occurrences for this date
  const occurrences = (await sql`
    SELECT id, todo_id, status, scheduled_time, completed_at, target_value, completed_value, unit
    FROM task_occurrences
    WHERE user_id = ${userId} AND occurrence_date = ${dateStr}
  `) as any[];

  const occMap = new Map(occurrences.map((o) => [o.todo_id, o]));
  const { parseTargetValueAndUnit } = await import("@/lib/analytics-utils");

  const tasks: DayTaskItem[] = todos.map((todo) => {
    const occ = occMap.get(todo.id);
    const taskType = todo.task_type || "checkbox";
    const status = (occ?.status || "no_action") as DayTaskItem["status"];

    let targetVal = occ?.target_value !== undefined && occ?.target_value !== null
      ? parseFloat(String(occ.target_value))
      : todo.target_value !== undefined && todo.target_value !== null
      ? parseFloat(String(todo.target_value))
      : null;

    let unitVal = occ?.unit ?? todo.unit ?? "";

    if (targetVal === null && todo.type_value) {
      const parsed = parseTargetValueAndUnit(todo.type_value);
      targetVal = parsed.targetValue;
      if (!unitVal) unitVal = parsed.unit;
    }

    const completedValue = occ?.completed_value !== undefined && occ?.completed_value !== null
      ? parseFloat(String(occ.completed_value))
      : null;

    const isMeasurable = taskType === "input" || taskType === "number";
    const isRecorded = completedValue !== null;
    const isMissingValue = isMeasurable && status === "completed" && completedValue === null;

    return {
      todoId: todo.id,
      occurrenceId: occ?.id ?? null,
      title: todo.title,
      category: todo.category || "Personal",
      taskType,
      scheduledTime: occ?.scheduled_time || todo.scheduled_time || "",
      status,
      targetValue: targetVal,
      unit: unitVal || "",
      completedValue,
      completedAt: occ?.completed_at ? new Date(occ.completed_at).toISOString() : null,
      isRecorded,
      isMissingValue,
    };
  });

  return {
    date: dateStr,
    formattedDate,
    isEditable,
    tasks,
  };
}

/**
 * Atomically saves modifications for all edited tasks on a single date.
 * Server-enforces 5-day editable window and task ownership.
 */
export async function saveDayHistory(
  dateStr: string,
  updates: TaskHistoryUpdateItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await initDb();
    const userId = await requireUser();

    // 1. SERVER ENFORCEMENT: 5-Day Editable Window Check
    const todayStr = getISTDateString();
    if (!(await isDateInEditableWindow(dateStr, todayStr))) {
      const minDate = await getEditableMinDate(todayStr);
      return {
        success: false,
        error: `Date ${dateStr} is outside the 5-day editable window (must be between ${minDate} and ${todayStr}).`,
      };
    }

    // 2. Validate input items & verify ownership
    const { parseTargetValueAndUnit } = await import("@/lib/analytics-utils");

    for (const update of updates) {
      const [todo] = (await sql`
        SELECT id, user_id, title, task_type, target_value, unit, type_value, category, scheduled_time
        FROM todos WHERE id = ${update.todoId} AND user_id = ${userId}
      `) as any[];

      if (!todo) {
        return { success: false, error: `Unauthorized: Task ID ${update.todoId} not found or does not belong to user.` };
      }

      // Input validation for numeric values
      if (update.completedValue !== undefined && update.completedValue !== null) {
        if (typeof update.completedValue !== "number" || isNaN(update.completedValue) || !isFinite(update.completedValue)) {
          return { success: false, error: `Invalid quantitative value for task ${todo.title}. Must be a valid finite number.` };
        }
        if (update.completedValue < 0) {
          return { success: false, error: `Negative value for task ${todo.title} is not allowed.` };
        }
      }
    }

    // 3. Atomic Transaction for Day Updates
    await withTransaction(async (txSql) => {
      for (const update of updates) {
        const [todo] = (await txSql`
          SELECT id, title, task_type, target_value, unit, type_value, category, scheduled_time
          FROM todos WHERE id = ${update.todoId} AND user_id = ${userId}
        `) as any[];

        // Check existing occurrence
        const [existingOcc] = (await txSql`
          SELECT id, target_value, unit, completed_value, completed_at, status
          FROM task_occurrences
          WHERE user_id = ${userId} AND todo_id = ${todo.id} AND occurrence_date = ${dateStr}
        `) as any[];

        let targetVal = existingOcc?.target_value !== undefined && existingOcc?.target_value !== null
          ? parseFloat(String(existingOcc.target_value))
          : todo.target_value !== undefined && todo.target_value !== null
          ? parseFloat(String(todo.target_value))
          : null;

        let unitVal = existingOcc?.unit ?? todo.unit ?? null;
        if (targetVal === null && todo.type_value) {
          const parsed = parseTargetValueAndUnit(todo.type_value);
          targetVal = parsed.targetValue;
          if (!unitVal) unitVal = parsed.unit || null;
        }

        const valToSave = update.completedValue !== undefined && update.completedValue !== null
          ? update.completedValue
          : existingOcc?.completed_value !== undefined && existingOcc?.completed_value !== null
          ? parseFloat(String(existingOcc.completed_value))
          : null;

        const newStatus = update.status;

        if (newStatus === "completed") {
          const completedAtIso = update.completedAtTime
            ? new Date(`${dateStr}T${update.completedAtTime}`).toISOString()
            : existingOcc?.completed_at
            ? existingOcc.completed_at
            : new Date().toISOString();

          // Insert or Update task_completions
          await txSql`
            INSERT INTO task_completions (
              user_id, todo_id, todo_title, task_type, category, completed_date, completed_at, target_value, completed_value, unit
            ) VALUES (
              ${userId}, ${todo.id}, ${todo.title}, ${todo.task_type || "checkbox"}, ${todo.category || "Personal"}, ${dateStr}, ${completedAtIso}, ${targetVal}, ${valToSave}, ${unitVal}
            )
            ON CONFLICT (user_id, todo_id, completed_date) DO UPDATE
            SET completed_at = ${completedAtIso}, target_value = ${targetVal}, completed_value = ${valToSave}, unit = ${unitVal}
          `;

          // Insert or Update task_occurrences
          await txSql`
            INSERT INTO task_occurrences (
              user_id, todo_id, occurrence_date, status, scheduled_time, completed_at, target_value, completed_value, unit, updated_at
            ) VALUES (
              ${userId}, ${todo.id}, ${dateStr}, 'completed', ${todo.scheduled_time || ""}, ${completedAtIso}, ${targetVal}, ${valToSave}, ${unitVal}, NOW()
            )
            ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
            SET status = 'completed', completed_at = ${completedAtIso}, target_value = ${targetVal}, completed_value = ${valToSave}, unit = ${unitVal}, updated_at = NOW()
          `;

          // Insert activity record
          await txSql`
            INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type, new_value)
            VALUES (${userId}, ${todo.id}, ${dateStr}, 'completed_history_update', ${JSON.stringify({ completed_at: completedAtIso, target_value: targetVal, completed_value: valToSave, unit: unitVal })})
          `;
        } else if (newStatus === "no_action") {
          // Remove completion record
          await txSql`
            DELETE FROM task_completions
            WHERE user_id = ${userId} AND todo_id = ${todo.id} AND completed_date = ${dateStr}
          `;

          // Update occurrence to no_action
          await txSql`
            INSERT INTO task_occurrences (
              user_id, todo_id, occurrence_date, status, scheduled_time, completed_at, completed_value, updated_at
            ) VALUES (
              ${userId}, ${todo.id}, ${dateStr}, 'no_action', ${todo.scheduled_time || ""}, NULL, NULL, NOW()
            )
            ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
            SET status = 'no_action', completed_at = NULL, completed_value = NULL, updated_at = NOW()
          `;

          await txSql`
            INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type)
            VALUES (${userId}, ${todo.id}, ${dateStr}, 'no_action_history_update')
          `;
        } else if (newStatus === "skipped") {
          await txSql`
            DELETE FROM task_completions
            WHERE user_id = ${userId} AND todo_id = ${todo.id} AND completed_date = ${dateStr}
          `;

          await txSql`
            INSERT INTO task_occurrences (
              user_id, todo_id, occurrence_date, status, scheduled_time, skipped_at, updated_at
            ) VALUES (
              ${userId}, ${todo.id}, ${dateStr}, 'skipped', ${todo.scheduled_time || ""}, NOW(), NOW()
            )
            ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
            SET status = 'skipped', skipped_at = NOW(), completed_at = NULL, completed_value = NULL, updated_at = NOW()
          `;
        }
      }
    });

    try {
      revalidatePath("/history");
      revalidatePath("/analytics");
      revalidatePath("/");
    } catch {
      // revalidatePath throws outside Next.js request context during unit testing
    }

    return { success: true };
  } catch (err: any) {
    console.error("Failed to save day history:", err);
    return { success: false, error: err.message || "Failed to save history changes." };
  }
}
