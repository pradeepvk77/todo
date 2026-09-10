import { getTodos, getOtherUserTodos } from "@/app/actions";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TodoList } from "@/components/TodoList";
import { YouTodoList } from "@/components/YouTodoList";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { Greeting } from "@/components/Greeting";
import { logoutAction } from "@/app/actions/auth";
import { User, Users, LogOut, Shield } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

export const revalidate = 0;

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const currentUserId = session.userId;
  const currentUserName = currentUserId === "user1" ? "User 1" : "User 2";
  const otherUserName = currentUserId === "user1" ? "User 2" : "User 1";

  const [myTodos, otherData] = await Promise.all([
    getTodos(),
    getOtherUserTodos(),
  ]);

  return (
    <main className="min-h-screen py-10 px-4 sm:px-6 w-full max-w-xl mx-auto">
      {/* Top Header with Greeting, Session Badge & Logout */}
      <header className="mb-8 pb-6 border-b border-border w-full space-y-4">
        <div className="flex items-start justify-between gap-4">
          <Greeting userName={currentUserName} />
          
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors"
              title="Logout session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </Button>
          </form>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 py-1.5 px-3 rounded-md w-fit border border-border/50">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>Authenticated as <strong className="text-foreground font-semibold">{currentUserName}</strong></span>
        </div>
      </header>

      {/* Main Tabs Navigation (Me / You) */}
      <Tabs defaultValue="me" className="w-full">
        {/* Tab bar — 50/50 split */}
        <TabsList className="w-full">
          <TabsTrigger value="me" className="flex-1">
            <User className="w-4 h-4" />
            <span>Me ({currentUserName})</span>
          </TabsTrigger>

          <TabsTrigger value="you" className="flex-1">
            <Users className="w-4 h-4" />
            <span>You ({otherUserName})</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Me (Authenticated User's Data) */}
        <TabsContent value="me" className="w-full space-y-6 focus-visible:outline-none">
          <div className="flex items-center justify-between pb-2 w-full">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                My Tasks
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {myTodos.length} {myTodos.length === 1 ? "task" : "tasks"} scheduled for today
              </p>
            </div>

            <AddTaskDialog />
          </div>

          <TodoList initialTodos={myTodos} />
        </TabsContent>

        {/* Tab 2: You (Other User's Data) */}
        <TabsContent value="you" className="w-full space-y-6 focus-visible:outline-none">
          <div className="flex items-center justify-between pb-2 w-full">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                {`${otherUserName}'s Tasks`}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {otherData.todos.length} {otherData.todos.length === 1 ? "task" : "tasks"} scheduled
              </p>
            </div>
          </div>

          <YouTodoList todos={otherData.todos} otherUserLabel={otherUserName} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
