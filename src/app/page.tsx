import { getFriendNicknamePreference, getTodos, getOtherUserTodos } from "@/app/actions";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TodoList } from "@/components/TodoList";
import { YouTodoList } from "@/components/YouTodoList";
import { Greeting } from "@/components/Greeting";
import { StatsCard } from "@/components/StatsCard";
import { Calendar } from "lucide-react";
import { TaskMenu } from "@/components/TaskMenu";
import { DailyQuote } from "@/components/DailyQuote";
import { DailyWordStrip } from "@/components/DailyWordStrip";

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
    <main className="min-h-screen py-5 sm:py-6 px-4 sm:px-6 w-full max-w-xl mx-auto space-y-3.5 sm:space-y-4">
      {/* SECTION 1 — PERSONAL DAILY HEADER */}
      <header className="flex items-center justify-between gap-4 pb-3 border-b border-border/70 w-full">
        <Greeting />
        <TaskMenu otherUserName={otherUserName} otherUser={viewingOtherUser} />
      </header>

      {/* SECTION 2 — DAILY PROGRESS */}
      {!viewingOtherUser ? (
        <StatsCard todos={myTodos} />
      ) : (
        <StatsCard todos={otherData.todos} />
      )}

      {/* SECTION 3 — MOTIVATIONAL QUOTE */}
      {!viewingOtherUser && <DailyQuote />}

      {/* SECTION 3.5 — DAILY VOCABULARY WORD STRIP */}
      {!viewingOtherUser && <DailyWordStrip />}

      {/* SECTION 4 & 5 — TASK SUMMARY, FILTERS AND TASK LIST */}
      {!viewingOtherUser ? (
        <div className="space-y-3 pt-0.5">
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>My Tasks</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary inline shrink-0" />
                <span>{myTodos.length} scheduled today ({formattedDay})</span>
              </p>
            </div>
          </div>

          <TodoList initialTodos={myTodos} />
        </div>
      ) : (
        <div className="space-y-3 pt-0.5">
          <div className="flex items-center justify-between w-full">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                {`${otherUserName}'s Tasks`}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-primary inline shrink-0" />
                <span>{otherData.todos.length} scheduled today ({formattedDay})</span>
              </p>
            </div>
          </div>

          <YouTodoList todos={otherData.todos} otherUserLabel={otherUserName} />
        </div>
      )}
    </main>
  );
}


