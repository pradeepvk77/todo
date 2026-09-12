import { getTodos } from "@/app/actions";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { EditTasksList } from "@/components/EditTasksList";

export const revalidate = 0;

export default async function EditTasksPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { todos } = await getTodos("all");

  return (
    <main className="min-h-screen py-10 px-4 sm:px-6 w-full max-w-xl mx-auto space-y-6">
      <header className="pb-4 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Edit & Manage Tasks
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Create new tasks, assign them to specific days of the week, or delete existing tasks.
        </p>
      </header>

      <EditTasksList initialTodos={todos} />
    </main>
  );
}
