"use server";

import { sql, initDb, Todo } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getISTDateString, getISTDayOfWeek, isTaskActiveOnDay } from "@/lib/time-utils";

export interface AnalyticsData {
  today: { completed: number; total: number; percentage: number };
  allTimeCompleted: number;
  bestStreak: number;
  lastSevenDays: { date: string; label: string; completed: number; total: number; percentage: number }[];
  lastThirtyDays: { date: string; label: string; completed: number; total: number; percentage: number }[];
  byTaskType: { label: string; value: number }[];
  byDayOfWeek: { label: string; value: number }[];
  taskStreaks: { title: string; streak: number }[];
}

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
    }
  }
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
 * Fetch todos for logged in user.
 * If dayFilter === "today" (default), fetches tasks active for today's IST day of week (or "everyday").
 * If dayFilter === "all", fetches all tasks regardless of day (for Edit Tasks management page).
 * If dayFilter is a specific day name, filters for tasks active on that day.
 */
export async function getTodos(dayFilter: string = "today"): Promise<{ todos: Todo[]; todayDay: string }> {
  try {
    await ensureDb();
    const userId = await requireUser();
    
    // Check and trigger daily reset at midnight IST
    await checkAndPerformDailyReset(userId);

    const todayDay = getISTDayOfWeek();
    const allUserRows = (await sql`
      SELECT * FROM todos 
      WHERE user_id = ${userId} 
      ORDER BY sort_order ASC, created_at DESC
    `) as Todo[];

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
    const otherUserId = userId === "user1" ? "user2" : "user1";

    // Perform daily reset check for other user
    await checkAndPerformDailyReset(otherUserId);

    const todayDay = getISTDayOfWeek();
    const allOtherRows = (await sql`
      SELECT * FROM todos 
      WHERE user_id = ${otherUserId} 
      ORDER BY sort_order ASC, created_at DESC
    `) as Todo[];

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
  task_type: string;
  type_value?: string;
  assigned_day?: string;
}) {
  const title = data.title?.trim();
  const task_type = data.task_type || "checkbox";
  const type_value = data.type_value || "";
  const assigned_day = data.assigned_day !== undefined ? data.assigned_day : "everyday";
  const currentISTDate = getISTDateString();

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

    await sql`
      INSERT INTO todos (user_id, title, task_type, type_value, sort_order, assigned_day, last_reset_date)
      VALUES (${userId}, ${title}, ${task_type}, ${type_value}, ${nextOrder}, ${assigned_day}, ${currentISTDate})
    `;
    revalidatePath("/");
    revalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to add todo:", error);
    return { error: "Failed to save task to database" };
  }
}

export async function toggleTodo(id: number, currentCompleted: boolean) {
  try {
    await ensureDb();
    const userId = await requireUser();
    const isOwner = await verifyTaskOwnership(id, userId);
    if (!isOwner) {
      return { error: "Unauthorized: You can only modify your own tasks" };
    }

    const currentISTDate = getISTDateString();

    const [todo] = await sql`
      SELECT id, title, task_type FROM todos WHERE id = ${id} AND user_id = ${userId}
    `;

    await sql`
      UPDATE todos 
      SET completed = ${!currentCompleted}, last_reset_date = ${currentISTDate}
      WHERE id = ${id} AND user_id = ${userId}
    `;

    if (!currentCompleted && todo) {
      await sql`
        INSERT INTO task_completions (user_id, todo_id, todo_title, task_type, completed_date)
        VALUES (${userId}, ${id}, ${todo.title}, ${todo.task_type}, ${currentISTDate})
        ON CONFLICT (user_id, todo_id, completed_date) DO NOTHING
      `;
    } else {
      await sql`
        DELETE FROM task_completions
        WHERE user_id = ${userId} AND todo_id = ${id} AND completed_date = ${currentISTDate}
      `;
    }
    revalidatePath("/");
    revalidatePath("/edit-tasks");
    revalidatePath("/analytics");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle todo:", error);
    return { error: "Failed to update task" };
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

export async function getAnalytics(): Promise<AnalyticsData> {
  await ensureDb();
  const userId = await requireUser();
  const today = getISTDateString();
  const todos = (await sql`SELECT * FROM todos WHERE user_id = ${userId}`) as Todo[];
  const completions = (await sql`
    SELECT todo_id, todo_title, task_type, completed_date
    FROM task_completions
    WHERE user_id = ${userId}
    ORDER BY completed_date DESC
  `) as { todo_id: number; todo_title: string; task_type: string; completed_date: string }[];

  const completionDates = new Set(completions.map((item) => item.completed_date));
  const buildDailyAnalytics = (days: number) => Array.from({ length: days }, (_, index) => {
      const date = dateFromISTString(today);
      date.setDate(date.getDate() - (days - 1 - index));
      const key = formatISTDate(date);
      const day = getISTDayOfWeek(date);
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
      };
    });
  const lastSevenDays = buildDailyAnalytics(7);
  const lastThirtyDays = buildDailyAnalytics(30);

  const todayData = lastSevenDays[lastSevenDays.length - 1];
  const typeCounts = new Map<string, number>();
  completions.forEach(({ task_type }) => typeCounts.set(task_type, (typeCounts.get(task_type) ?? 0) + 1));
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
    byTaskType: Array.from(typeCounts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    byDayOfWeek: weekdayCounts,
    taskStreaks,
  };
}

export async function getTaskHistory(date: string) {
  await ensureDb();
  const userId = await requireUser();
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

    await sql`
      UPDATE todos 
      SET type_value = ${type_value} 
      WHERE id = ${id} AND user_id = ${userId}
    `;
    revalidatePath("/");
    revalidatePath("/edit-tasks");
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
    revalidatePath("/");
    revalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task order:", error);
    return { error: "Failed to save task order" };
  }
}

export async function editTodo(
  id: number,
  data: {
    title: string;
    task_type: string;
    type_value?: string;
    assigned_day?: string;
  }
) {
  const title = data.title?.trim();
  const task_type = data.task_type || "checkbox";
  const type_value = data.type_value || "";
  const assigned_day = data.assigned_day !== undefined ? data.assigned_day : "everyday";

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

    await sql`
      UPDATE todos 
      SET title = ${title}, task_type = ${task_type}, type_value = ${type_value}, assigned_day = ${assigned_day}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    revalidatePath("/");
    revalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to edit todo:", error);
    return { error: "Failed to update task" };
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
    revalidatePath("/");
    revalidatePath("/edit-tasks");
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
    revalidatePath("/");
    revalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to clear completed todos:", error);
    return { error: "Failed to clear completed tasks" };
  }
}
