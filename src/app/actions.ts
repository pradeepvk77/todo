"use server";

import { sql, initDb, Todo } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { getISTDateString, getISTDayOfWeek, isTaskActiveOnDay, AssignedDay } from "@/lib/time-utils";

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

    await sql`
      UPDATE todos 
      SET completed = ${!currentCompleted}, last_reset_date = ${currentISTDate}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    revalidatePath("/");
    revalidatePath("/edit-tasks");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle todo:", error);
    return { error: "Failed to update task" };
  }
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
