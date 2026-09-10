"use server";

import { sql, initDb, Todo } from "@/lib/db";
import { revalidatePath } from "next/cache";

// Ensure the table exists on every cold start
await initDb();

export async function getTodos(): Promise<Todo[]> {
  try {
    const rows = await sql`SELECT * FROM todos ORDER BY sort_order ASC, created_at DESC`;
    return rows as Todo[];
  } catch (error) {
    console.error("Failed to fetch todos:", error);
    return [];
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
    const [maxRow] = await sql`SELECT MAX(sort_order) AS "maxOrder" FROM todos`;
    const nextOrder = ((maxRow?.maxOrder as number | null) ?? 0) + 1;

    await sql`
      INSERT INTO todos (title, task_type, type_value, sort_order)
      VALUES (${title}, ${task_type}, ${type_value}, ${nextOrder})
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
    await sql`UPDATE todos SET completed = ${!currentCompleted} WHERE id = ${id}`;
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle todo:", error);
    return { error: "Failed to update task" };
  }
}

export async function updateTaskValue(id: number, type_value: string) {
  try {
    await sql`UPDATE todos SET type_value = ${type_value} WHERE id = ${id}`;
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task value:", error);
    return { error: "Failed to update task value" };
  }
}

export async function updateTaskOrder(orderedIds: number[]) {
  try {
    // Run sequential updates — Neon HTTP driver does not support synchronous transactions
    for (let index = 0; index < orderedIds.length; index++) {
      await sql`UPDATE todos SET sort_order = ${index + 1} WHERE id = ${orderedIds[index]}`;
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
    await sql`DELETE FROM todos WHERE id = ${id}`;
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete todo:", error);
    return { error: "Failed to delete task" };
  }
}

export async function clearCompleted() {
  try {
    await sql`DELETE FROM todos WHERE completed = true`;
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to clear completed todos:", error);
    return { error: "Failed to clear completed tasks" };
  }
}
