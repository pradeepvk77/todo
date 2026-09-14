"use client";

import { useState, useSyncExternalStore } from "react";
import { Todo, DaySection } from "@/lib/db";
import { TaskWidget } from "@/components/TaskWidget";
import { formatAssignedDays } from "@/lib/time-utils";
import { HeartHandshake, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskFilter, TaskFilters } from "@/components/TaskFilters";

interface YouTodoListProps {
  todos: Todo[];
  otherUserLabel: string;
}

const SECTIONS: { key: DaySection; label: string; icon: string }[] = [
  { key: "MORNING", label: "Morning", icon: "🌅" },
  { key: "AFTERNOON", label: "Afternoon", icon: "☀️" },
  { key: "EVENING", label: "Evening", icon: "🌆" },
  { key: "NIGHT", label: "Night", icon: "🌙" },
];

const emptySubscribe = () => () => {};

function getCurrentDaySection(): DaySection {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Kolkata",
    }).format(new Date())
  );

  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 20) return "EVENING";
  return "NIGHT";
}

export function YouTodoList({ todos, otherUserLabel }: YouTodoListProps) {
  const [filter, setFilter] = useState<TaskFilter>("all");
  const currentSection = useSyncExternalStore<DaySection>(
    emptySubscribe,
    getCurrentDaySection,
    () => "MORNING"
  );

  if (todos.length === 0) {
    return (
      <Card className="border border-border/80 bg-card p-6 text-center shadow-2xs rounded-xl">
        <CardContent className="space-y-2.5 p-0">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center mx-auto text-muted-foreground border border-border/60">
            <HeartHandshake className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">
              {otherUserLabel} has no tasks scheduled today
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tasks created by {otherUserLabel} will appear here in real-time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = todos.filter((todo) => !todo.completed).length;
  const completedCount = todos.length - pendingCount;
  const visibleTodos = todos.filter((todo) => filter === "all" || (filter === "completed" ? todo.completed : !todo.completed));

  return (
    <div className="space-y-3">
      <TaskFilters value={filter} onChange={setFilter} total={todos.length} pending={pendingCount} completed={completedCount} />
      {visibleTodos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
          No {filter} tasks for today.
        </p>
      ) : (
        <div className="space-y-3.5 pt-1">
          {SECTIONS.map((sec) => {
            const sectionTodos = visibleTodos.filter(
              (t) => (t.day_section || "MORNING") === sec.key
            );
            const sectionCompleted = sectionTodos.filter((t) => t.completed).length;
            const sectionTotal = sectionTodos.length;
            const isCurrentSection = currentSection === sec.key;

            return (
              <div key={sec.key} className="space-y-1.5">
                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/90 flex items-center gap-1.5">
                      <span>{sec.icon}</span>
                      <span>{sec.label}</span>
                    </h3>
                    {isCurrentSection && (
                      <span className="text-[9px] font-extrabold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 leading-none">
                        NOW
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-semibold text-muted-foreground/80">
                    {sectionCompleted} / {sectionTotal}
                  </span>
                </div>

                <div
                  className={
                    sectionTotal > 0
                      ? "rounded-xl border border-border/80 bg-card shadow-2xs divide-y divide-border/60 overflow-hidden"
                      : "min-h-[38px] rounded-lg border border-dashed border-border/50 bg-muted/15 flex items-center justify-center p-2"
                  }
                >
                  {sectionTotal === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60 font-medium select-none">
                      No {sec.label.toLowerCase()} tasks
                    </p>
                  ) : (
                    sectionTodos.map((todo) => {
                      const isCompleted = todo.completed;

                      return (
                        <div
                          key={todo.id}
                          className={[
                            "px-3 py-2 sm:px-3.5 flex items-center justify-between gap-3 transition-colors",
                            isCompleted
                              ? "bg-muted/30"
                              : "bg-card hover:bg-muted/20",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <Checkbox checked={isCompleted} disabled className="h-4.5 w-4.5 rounded-md border-border shrink-0 cursor-not-allowed opacity-70" />

                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <span
                                className={`text-xs sm:text-sm truncate transition-colors ${
                                  isCompleted
                                    ? "line-through text-muted-foreground/70 font-normal"
                                    : "text-foreground font-semibold"
                                }`}
                              >
                                {todo.title}
                              </span>
                              <span className="text-[10px] font-medium text-muted-foreground/75 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-2.5 h-2.5 text-primary/60 inline shrink-0" />
                                <span>{formatAssignedDays(todo.assigned_day)}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <TaskWidget todo={todo} isCompleted={isCompleted} readOnly={true} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}




