"use client";

import { Todo } from "@/lib/db";
import { TaskWidget } from "@/components/TaskWidget";
import { HeartHandshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface YouTodoListProps {
  todos: Todo[];
  otherUserLabel: string;
}

export function YouTodoList({ todos, otherUserLabel }: YouTodoListProps) {
  if (todos.length === 0) {
    return (
      <Card className="border border-border bg-card p-8 text-center shadow-xs rounded-xl">
        <CardContent className="space-y-3 pt-4">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto text-muted-foreground border border-border">
            <HeartHandshake className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-card-foreground">
              {otherUserLabel} has no tasks scheduled today
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Tasks created by {otherUserLabel} will appear here in real-time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {todos.map((todo) => {
        const isCompleted = todo.completed;

        return (
          <Card
            key={todo.id}
            className={`border border-border bg-card rounded-xl shadow-xs transition-opacity ${
              isCompleted ? "opacity-60" : ""
            }`}
          >
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Checkbox checked={isCompleted} disabled className="cursor_not_allowed opacity-70" />

                <span
                  className={`text-card-foreground text-sm font-medium truncate ${
                    isCompleted ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {todo.title}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <TaskWidget todo={todo} isCompleted={isCompleted} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
