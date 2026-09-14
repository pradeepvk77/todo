"use client";

import { Sparkles } from "lucide-react";
import { Todo } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  todos: Todo[];
}

export function StatsCard({ todos }: StatsCardProps) {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const pending = total - completed;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="border border-border/80 bg-gradient-to-r from-card via-card to-muted/20 rounded-xl shadow-2xs overflow-hidden">
      <CardContent className="p-3.5 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Today&apos;s Progress</span>
          </div>
          {total > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              <strong className="text-foreground font-semibold">{completionPercentage}%</strong> complete
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            {completed} <span className="text-sm font-normal text-muted-foreground">of {total} {total === 1 ? "task" : "tasks"} completed</span>
          </p>
          {total > 0 && pending > 0 && (
            <p className="text-xs text-muted-foreground shrink-0">
              <span className="font-semibold text-foreground">{pending}</span> remaining
            </p>
          )}
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden border border-border/40">
          <div
            className="bg-gradient-to-r from-primary/80 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${total > 0 ? completionPercentage : 0}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}


