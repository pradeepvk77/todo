import { getFriendNicknamePreference, getTodos, getOtherUserTodos } from "@/app/actions";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TodoList } from "@/components/TodoList";
import { YouTodoList } from "@/components/YouTodoList";
import { Greeting } from "@/components/Greeting";
import { Calendar } from "lucide-react";
import { TaskMenu } from "@/components/TaskMenu";
import { DashboardMenu } from "@/components/DashboardMenu";
import { DailyQuote } from "@/components/DailyQuote";

export const revalidate = 0;

export default async function Home({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const currentUserId = session.userId;
  const { user } = await searchParams;
  const viewingOtherUser = user === "other";
  const defaultOtherUserName = currentUserId === "user1" ? "User 2" : "User 1";

  const [{ todos: myTodos, todayDay }, otherData, friendNickname] = await Promise.all([
    getTodos("today"),
    getOtherUserTodos(),
    getFriendNicknamePreference(),
  ]);
  const otherUserName = friendNickname || defaultOtherUserName;

  const formattedDay = todayDay.charAt(0).toUpperCase() + todayDay.slice(1);

  return (
    <main className="min-h-screen py-10 px-4 sm:px-6 w-full max-w-xl mx-auto">
      {/* Top Header */}
      <header className="mb-8 pb-6 border-b border-border w-full space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Greeting />
          <DashboardMenu otherUserName={otherUserName} viewingOtherUser={viewingOtherUser} />
        </div>
      </header>

      <div className="space-y-6">
        {!viewingOtherUser && <DailyQuote />}
        {!viewingOtherUser ? (
          <>
          <div className="flex items-center justify-between pb-2 w-full">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>My Tasks</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary inline" />
                <span>{myTodos.length} {myTodos.length === 1 ? "task" : "tasks"} scheduled for {formattedDay} (IST)</span>
              </p>
            </div>

            <TaskMenu />
          </div>

          <TodoList initialTodos={myTodos} />
          </>
        ) : (
          <>
          <div className="flex items-center justify-between pb-2 w-full">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {`${otherUserName}'s Tasks`}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary inline" />
                <span>{otherData.todos.length} {otherData.todos.length === 1 ? "task" : "tasks"} scheduled for {formattedDay} (IST)</span>
              </p>
            </div>
            <TaskMenu otherUser />
          </div>

          <YouTodoList todos={otherData.todos} otherUserLabel={otherUserName} />
          </>
        )}
      </div>
    </main>
  );
}
