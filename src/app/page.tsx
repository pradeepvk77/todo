import { getTodos } from "@/app/actions";
import { TodoList } from "@/components/TodoList";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { Greeting } from "@/components/Greeting";
import { User, Users, Heart } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export const revalidate = 0;



export default async function Home() {
  const todos = await getTodos();

  return (
    <main className="min-h-screen py-10 px-4 sm:px-6 w-full max-w-xl mx-auto">
      {/* Top Header with Greeting & Date */}
      <header className="mb-8 pb-6 border-b border-border w-full">
        <Greeting />
      </header>

      {/* Main Tabs Navigation (Me / You) */}
      <Tabs defaultValue="me" className="w-full">
        {/* Tab bar — flex-1 on each trigger gives equal 50/50 split */}
        <TabsList className="w-full">
          <TabsTrigger value="me">
            <User className="w-4 h-4" />
            <span>Me</span>
          </TabsTrigger>

          <TabsTrigger value="you">
            <Users className="w-4 h-4" />
            <span>You</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Me */}
        <TabsContent value="me" className="w-full space-y-6 focus-visible:outline-none">
          {/* Title Header with Add Task Dialog Button on Right */}
          <div className="flex items-center justify-between pb-2 w-full">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Today we have
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {todos.length} {todos.length === 1 ? "task" : "tasks"} scheduled for today
              </p>
            </div>

            {/* Add Task Modal Trigger */}
            <AddTaskDialog />
          </div>

          {/* Interactive Drag & Drop Task List */}
          <TodoList initialTodos={todos} />
        </TabsContent>

        {/* Tab 2: You (Coming Soon) */}
        <TabsContent value="you" className="w-full focus-visible:outline-none">
          <Card className="w-full border border-border bg-card p-8 text-center shadow-xs rounded-xl">
            <CardContent className="space-y-3 pt-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto text-muted-foreground border border-border">
                <Heart className="w-6 h-6 text-destructive animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-card-foreground">Coming Soon</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
                  The <strong className="text-foreground font-medium">You</strong> tab will allow shared partner task tracking, collaborative daily routines, and mutual goal reporting.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
