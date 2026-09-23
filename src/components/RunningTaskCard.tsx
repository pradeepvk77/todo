"use client";

import { useState, useEffect, useTransition } from "react";
import { Todo } from "@/lib/db";
import { toggleTodo, skipTodo, rescheduleTodo, getTaskPerformanceHistory, TaskPerformanceHistory } from "@/app/actions";
import { SkipTaskModal } from "@/components/SkipTaskModal";
import { RescheduleTaskModal } from "@/components/RescheduleTaskModal";
import { CompleteTaskValueModal } from "@/components/CompleteTaskValueModal";
import {
  Clock,
  ArrowRightLeft,
  Check,
  Calendar,
  TrendingUp,
  MessageSquare,
  Lightbulb,
  Target,
  RotateCcw,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RunningTaskCardProps {
  todos: Todo[];
  isOtherUser?: boolean;
}

export function RunningTaskCard({ todos, isOtherUser = false }: RunningTaskCardProps) {
  // Always default to the first uncompleted task
  const pendingTodos = todos.filter((t) => !t.completed);
  const initialTask = pendingTodos.length > 0 ? pendingTodos[0] : null;
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(initialTask?.id ?? null);
  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [isSkipOpen, setIsSkipOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isValueModalOpen, setIsValueModalOpen] = useState(false);
  const [history, setHistory] = useState<TaskPerformanceHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Selected task object
  const currentTask = todos.find((t) => t.id === selectedTaskId && !t.completed) || initialTask;

  // Auto-switch to next pending task if currentTask is completed or missing
  useEffect(() => {
    if ((!currentTask || currentTask.completed) && pendingTodos.length > 0) {
      setSelectedTaskId(pendingTodos[0].id);
    }
  }, [todos, currentTask, pendingTodos]);

  // Fetch performance history whenever currentTask changes
  useEffect(() => {
    if (!currentTask) {
      setHistory(null);
      return;
    }

    let isMounted = true;
    setLoadingHistory(true);
    getTaskPerformanceHistory(currentTask.id)
      .then((data) => {
        if (isMounted) {
          setHistory(data);
          setLoadingHistory(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentTask?.id]);

  const executeComplete = (completedVal?: number | null) => {
    if (!currentTask || isOtherUser) return;
    startTransition(async () => {
      await toggleTodo(currentTask.id, false, completedVal);
      const remaining = todos.filter((t) => t.id !== currentTask.id && !t.completed);
      if (remaining.length > 0) {
        setSelectedTaskId(remaining[0].id);
      }
    });
  };

  const handleCompleteTask = () => {
    if (!currentTask || isOtherUser) return;
    const isMeasurable = currentTask.task_type === "input" || currentTask.task_type === "number";
    if (isMeasurable) {
      setIsValueModalOpen(true);
      return;
    }
    executeComplete();
  };

  const handleSkipConfirm = (reason?: string, notes?: string) => {
    if (!currentTask || isOtherUser) return;
    setIsSkipOpen(false);
    startTransition(async () => {
      await skipTodo(currentTask.id, undefined, reason, notes);
      const remaining = todos.filter((t) => t.id !== currentTask.id && !t.completed);
      if (remaining.length > 0) {
        setSelectedTaskId(remaining[0].id);
      }
    });
  };

  const handleRescheduleConfirm = (newDate: string, newTime: string, reason?: string, notes?: string) => {
    if (!currentTask || isOtherUser) return;
    setIsRescheduleOpen(false);
    startTransition(async () => {
      await rescheduleTodo(currentTask.id, {
        newScheduledDate: newDate,
        newScheduledTime: newTime,
        reason,
        notes,
      });
      const remaining = todos.filter((t) => t.id !== currentTask.id && !t.completed);
      if (remaining.length > 0) {
        setSelectedTaskId(remaining[0].id);
      }
    });
  };

  // If no pending tasks remain, return null (parent container will display completion message)
  if (!currentTask || pendingTodos.length === 0) {
    return null;
  }

  const timeDisplay = currentTask.scheduled_time || "10:30 AM";

  return (
    <div className="space-y-4">
      {/* SECTION 1: CURRENT / RUNNING TASK CARD */}
      <div className="rounded-2xl border border-emerald-500/20 bg-card p-4 sm:p-5 shadow-2xs relative space-y-3.5">
        {/* TOP ROW: RUNNING TASK BADGE & SWITCH BUTTON */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              RUNNING TASK
            </span>
          </div>

          {!isOtherUser && pendingTodos.length > 1 && (
            <button
              type="button"
              onClick={() => setIsSwitchOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-colors px-2 py-1 rounded-lg hover:bg-muted cursor-pointer"
            >
              <span>Switch</span>
              <ArrowRightLeft className="size-3.5 text-emerald-600" />
            </button>
          )}
        </div>

        {/* SHADCN MODAL DIALOG POPUP FOR TASK SWITCHING */}
        <Dialog open={isSwitchOpen} onOpenChange={setIsSwitchOpen}>
          <DialogContent className="max-w-md rounded-2xl p-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">Switch Focus Task</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Select a task from today&apos;s list to make it your active running task.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-64 overflow-y-auto space-y-1.5 mt-2 pr-1">
              {pendingTodos.map((todo) => (
                <button
                  key={todo.id}
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(todo.id);
                    setIsSwitchOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    todo.id === currentTask.id
                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                      : "hover:bg-muted/80 text-foreground border border-border/50"
                  }`}
                >
                  <span className="truncate pr-2 text-sm">{todo.title}</span>
                  {todo.id === currentTask.id && (
                    <span className="text-[10px] uppercase tracking-wider bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-full font-extrabold shrink-0">
                      Active
                    </span>
                  )}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* MAIN TASK BODY WITH ICON */}
        <div className="flex items-start gap-3.5">
          <div className="size-12 shrink-0 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/15 mt-0.5">
            <MessageSquare className="size-6 text-blue-500" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {currentTask.title}
            </h2>
            <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5 text-muted-foreground/70" />
                Today
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5 text-muted-foreground/70" />
                {timeDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* TASK ACTION BUTTONS: COMPLETE, SKIP, RESCHEDULE */}
        {!isOtherUser && (
          <div className="pt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleCompleteTask}
              className="flex-1 py-3 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer min-w-[140px] disabled:opacity-80"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin text-white" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <Check className="size-4 stroke-[3] animate-spring-pop" />
                  <span>Complete Task</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => setIsSkipOpen(true)}
              className="py-3 px-3.5 rounded-xl border border-border/80 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Skip this task with a reason"
            >
              <XCircle className="size-4" />
              <span>Skip</span>
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => setIsRescheduleOpen(true)}
              className="py-3 px-3.5 rounded-xl border border-border/80 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Reschedule to another date/time"
            >
              <RotateCcw className="size-4 text-blue-500" />
              <span>Reschedule</span>
            </button>
          </div>
        )}
      </div>

      {/* SKIP & RESCHEDULE MODALS */}
      <SkipTaskModal
        isOpen={isSkipOpen}
        onClose={() => setIsSkipOpen(false)}
        onConfirm={handleSkipConfirm}
        taskTitle={currentTask.title}
        isSubmitting={isPending}
      />

      <RescheduleTaskModal
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        onConfirm={handleRescheduleConfirm}
        taskTitle={currentTask.title}
        currentDate={currentTask.scheduled_date}
        currentTime={currentTask.scheduled_time}
        isSubmitting={isPending}
      />

      {/* SECTION 2: 2-COLUMN TREND & QUICK INSIGHT ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* LEFT CARD: THIS TASK'S TREND */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-bold text-foreground">This Task&apos;s Trend</span>
              <span className="text-[11px] text-muted-foreground font-medium">Last 7 days</span>
            </div>

            {/* 7 VERTICAL DAY BARS */}
            <div className="flex items-end justify-between gap-1.5 h-16 pt-2 pb-1 px-1">
              {history?.lastSevenBars && history.lastSevenBars.length === 7 ? (
                history.lastSevenBars.map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-full max-w-[12px] rounded-sm transition-all ${
                        bar.completed
                          ? "bg-emerald-500 h-10"
                          : bar.status !== "none"
                          ? "bg-emerald-500/30 h-6"
                          : "bg-muted h-3"
                      }`}
                      title={`${bar.date}: ${bar.completed ? "Completed" : bar.status}`}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground">{bar.dayLabel}</span>
                  </div>
                ))
              ) : (
                ["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full max-w-[12px] rounded-sm bg-emerald-500/20 h-6" />
                    <span className="text-[10px] font-bold text-muted-foreground">{d}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* INNER GREEN INSIGHT BOX */}
          <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 space-y-0.5 text-emerald-800 dark:text-emerald-300">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <TrendingUp className="size-4 text-emerald-600 shrink-0" />
              <span>{history ? `${history.consistencyPercentage}% consistency` : "80% consistency"}</span>
            </div>
            <p className="text-[11px] font-medium text-emerald-700/90 dark:text-emerald-400/90 leading-tight">
              {history?.insight || "You completed this task in 5 of the last 7 days."}
            </p>
          </div>
        </div>

        {/* RIGHT CARD: QUICK INSIGHT */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Lightbulb className="size-4 text-amber-500 shrink-0" />
              <span>Quick Insight</span>
            </div>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              {history?.timeOfDayInsight || "You usually complete this task in the morning."}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/60">

            <div className="flex items-center gap-2 text-xs">
              <Target className="size-3.5 text-muted-foreground/80 shrink-0" />
              <div>
                <span className="text-[10px] text-muted-foreground block leading-none">Current streak</span>
                <span className="font-bold text-foreground text-xs">{history ? `${history.currentStreak} days` : "5 days"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CompleteTaskValueModal
        isOpen={isValueModalOpen}
        onClose={() => setIsValueModalOpen(false)}
        todo={currentTask}
        onConfirm={(completedVal) => {
          setIsValueModalOpen(false);
          executeComplete(completedVal);
        }}
      />
    </div>
  );
}
