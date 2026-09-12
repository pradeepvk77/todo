"use client";

import { useState, useTransition } from "react";
import { Todo } from "@/lib/db";
import { deleteTodo } from "@/app/actions";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { formatAssignedDays } from "@/lib/time-utils";
import { Trash2, Pencil, Calendar, Clock, CheckSquare, FileText, Hash, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface EditTasksListProps {
  initialTodos: Todo[];
}

export function EditTasksList({ initialTodos }: EditTasksListProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [prevInitialTodos, setPrevInitialTodos] = useState<Todo[]>(initialTodos);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [, startTransition] = useTransition();

  if (initialTodos !== prevInitialTodos) {
    setPrevInitialTodos(initialTodos);
    setTodos(initialTodos);
  }

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    setDeletingId(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    
    startTransition(async () => {
      try {
        await deleteTodo(id);
      } finally {
        setDeletingId(null);
      }
    });
  };

  const getTaskTypeIcon = (type: string) => {
    switch (type) {
      case "time":
        return <Clock className="w-3.5 h-3.5 text-primary" />;
      case "number":
        return <Hash className="w-3.5 h-3.5 text-amber-500" />;
      case "input":
        return <FileText className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/">
          <Button variant="outline" size="sm" className="gap-2 text-xs cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Button>
        </Link>

        <AddTaskDialog />
      </div>

      {/* Task List */}
      {todos.length === 0 ? (
        <Card className="border border-border bg-card p-8 text-center rounded-xl">
          <CardContent className="space-y-3 pt-4">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto text-muted-foreground border border-border">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-card-foreground">
                No tasks created yet
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Click <strong className="text-foreground font-medium">+ Add Task</strong> to create your first task.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {todos.map((todo) => {
            const isDeleting = deletingId === todo.id;
            const daysLabel = formatAssignedDays(todo.assigned_day);
            const isUnassigned = daysLabel === "No Days";

            return (
              <Card
                key={todo.id}
                className={`border border-border rounded-xl shadow-xs transition-all bg-card hover:border-border/80 ${
                  isUnassigned
                    ? "bg-red-100/30"
                    : ""
                }`}
              >
                <CardContent className="p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-muted rounded-lg border border-border flex-shrink-0">
                      {getTaskTypeIcon(todo.task_type)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm font-semibold truncate text-foreground`}>
                        {todo.title}
                      </h4>

                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={isUnassigned ? "secondary" : "outline"}
                          className={`text-[10px] font-medium capitalize ${
                            isUnassigned
                              ? "border-muted-foreground/30 text-muted-foreground bg-muted/60"
                              : "border-border text-primary bg-primary/5"
                          }`}
                        >
                          <Calendar className="w-2.5 h-2.5 mr-1" />
                          {daysLabel}
                        </Badge>

                        <Badge
                          variant="secondary"
                          className="text-[10px] font-medium text-muted-foreground capitalize"
                        >
                          {todo.task_type}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Edit (Pen) & Delete (Trash) */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingTodo(todo)}
                      className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                      title="Edit task"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(todo.id)}
                      disabled={isDeleting}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                      title="Delete task permanently"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Task Dialog */}
      {editingTodo && (
        <EditTaskDialog
          todo={editingTodo}
          open={Boolean(editingTodo)}
          onOpenChange={(isOpen) => !isOpen && setEditingTodo(null)}
        />
      )}
    </div>
  );
}
