"use server";

import { db, Todo } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getTodos(): Promise<Todo[]> {
  try {
    const stmt = db.prepare("SELECT * FROM todos ORDER BY sort_order ASC, created_at DESC");
    return stmt.all() as Todo[];
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
    // Get highest sort_order
    const maxOrderRow = db.prepare("SELECT MAX(sort_order) as maxOrder FROM todos").get() as { maxOrder: number | null };
    const nextOrder = (maxOrderRow?.maxOrder ?? 0) + 1;

    const stmt = db.prepare(
      "INSERT INTO todos (title, task_type, type_value, sort_order) VALUES (?, ?, ?, ?)"
    );
    stmt.run(title, task_type, type_value, nextOrder);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to add todo:", error);
    return { error: "Failed to save task to database" };
  }
}

export async function toggleTodo(id: number, currentCompleted: boolean) {
  try {
    const stmt = db.prepare("UPDATE todos SET completed = ? WHERE id = ?");
    stmt.run(currentCompleted ? 0 : 1, id);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle todo:", error);
    return { error: "Failed to update task" };
  }
}

export async function updateTaskValue(id: number, type_value: string) {
  try {
    const stmt = db.prepare("UPDATE todos SET type_value = ? WHERE id = ?");
    stmt.run(type_value, id);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task value:", error);
    return { error: "Failed to update task value" };
  }
}

export async function updateTaskOrder(orderedIds: number[]) {
  try {
    const stmt = db.prepare("UPDATE todos SET sort_order = ? WHERE id = ?");
    const transaction = db.transaction((ids: number[]) => {
      ids.forEach((id, index) => {
        stmt.run(index + 1, id);
      });
    });
    transaction(orderedIds);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to update task order:", error);
    return { error: "Failed to save task order" };
  }
}

export async function deleteTodo(id: number) {
  try {
    const stmt = db.prepare("DELETE FROM todos WHERE id = ?");
    stmt.run(id);
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete todo:", error);
    return { error: "Failed to delete task" };
  }
}

export async function clearCompleted() {
  try {
    const stmt = db.prepare("DELETE FROM todos WHERE completed = 1");
    stmt.run();
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to clear completed todos:", error);
    return { error: "Failed to clear completed tasks" };
  }
}
