"use server";

import { sql, initDb, Todo } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

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

export async function getTodos(): Promise<Todo[]> {
  try {
    await ensureDb();
    const userId = await requireUser();
    const rows = await sql`
      SELECT * FROM todos 
      WHERE user_id = ${userId} 
      ORDER BY sort_order ASC, created_at DESC
    `;
    return rows as Todo[];
  } catch (error) {
    console.error("Failed to fetch todos:", error);
    return [];
  }
}

export async function getOtherUserTodos(): Promise<{ userId: string; todos: Todo[] }> {
  try {
    await ensureDb();
    const userId = await requireUser();
    const otherUserId = userId === "user1" ? "user2" : "user1";
    const rows = await sql`
      SELECT * FROM todos 
      WHERE user_id = ${otherUserId} 
      ORDER BY sort_order ASC, created_at DESC
    `;
    return {
      userId: otherUserId,
      todos: rows as Todo[],
    };
  } catch (error) {
    console.error("Failed to fetch other user todos:", error);
    return { userId: "user2", todos: [] };
  }
}

export async function addTodo(data: { title: string; task_type: string; type_value?: string }) {
  const title = data.title?.trim();
  const task_type = data.task_type || "checkbox";
  const type_value = data.type_value || "";

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
      INSERT INTO todos (user_id, title, task_type, type_value, sort_order)
      VALUES (${userId}, ${title}, ${task_type}, ${type_value}, ${nextOrder})
    `;
    revalidatePath("/");
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

    await sql`
      UPDATE todos 
      SET completed = ${!currentCompleted} 
      WHERE id = ${id} AND user_id = ${userId}
    `;
    revalidatePath("/");
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
    return { success: true };
  } catch (error) {
    console.error("Failed to update task order:", error);
    return { error: "Failed to save task order" };
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
    return { success: true };
  } catch (error) {
    console.error("Failed to clear completed todos:", error);
    return { error: "Failed to clear completed tasks" };
  }
}
