"use client";

import { useState, useEffect, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Todo } from "@/lib/db";
import {
  toggleTodo,
  skipTodo,
  getTaskPerformanceHistory,
  TaskPerformanceHistory,
  getTodayTaskComparison,
  TodayTaskComparisonData,
} from "@/app/actions";

// Lazy-load modals — only needed after explicit button clicks (Skip / Complete)
const SkipTaskModal = dynamic(
  () => import("@/components/SkipTaskModal").then((mod) => mod.SkipTaskModal),
  { ssr: false }
);
const CompleteTaskValueModal = dynamic(
  () => import("@/components/CompleteTaskValueModal").then((mod) => mod.CompleteTaskValueModal),
  { ssr: false }
);
import {
  Clock,
  ArrowRightLeft,
  Check,
  Calendar,
  TrendingUp,
  MessageSquare,
  Users,
  Target,
  XCircle,
  Loader2,
  BarChart2,
  CheckCircle2,
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
  // Only tasks that are not completed and not skipped
  const pendingTodos = todos.filter((t) => !t.completed && !t.skipped);
  const initialTask = pendingTodos.length > 0 ? pendingTodos[0] : null;

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(initialTask?.id ?? null);
  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [isSkipOpen, setIsSkipOpen] = useState(false);
  const [isValueModalOpen, setIsValueModalOpen] = useState(false);
  const [history, setHistory] = useState<TaskPerformanceHistory | null>(null);
  const [comparison, setComparison] = useState<TodayTaskComparisonData | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Slide animation state: "idle" | "slide-out-left" | "slide-in-start" | "slide-in-end"
  const [slideAnim, setSlideAnim] = useState<"idle" | "slide-out-left" | "slide-in-start" | "slide-in-end">("idle");

  const currentTask = pendingTodos.find((t) => t.id === selectedTaskId) || initialTask;

  useEffect(() => {
    if ((!currentTask || currentTask.completed || currentTask.skipped) && pendingTodos.length > 0) {
      setSelectedTaskId(pendingTodos[0].id);
    }
  }, [todos, currentTask, pendingTodos]);

  useEffect(() => {
    if (!currentTask) {
      setHistory(null);
      setComparison(null);
      return;
    }

    let isMounted = true;
    setLoadingHistory(true);
    Promise.all([
      getTaskPerformanceHistory(currentTask.id),
      getTodayTaskComparison(currentTask.id),
    ])
      .then(([histData, compData]) => {
        if (isMounted) {
          setHistory(histData);
          setComparison(compData);
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

  const triggerSlideTransition = (nextTaskId: number | null) => {
    setSlideAnim("slide-out-left");
    setTimeout(() => {
      if (nextTaskId !== null) {
        setSelectedTaskId(nextTaskId);
      }
      setSlideAnim("slide-in-start");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSlideAnim("slide-in-end");
          setTimeout(() => {
            setSlideAnim("idle");
          }, 250);
        });
      });
    }, 200);
  };

  const executeComplete = (completedVal?: number | null) => {
    if (!currentTask || isOtherUser) return;
    startTransition(async () => {
      await toggleTodo(currentTask.id, false, completedVal);
      const remaining = pendingTodos.filter((t) => t.id !== currentTask.id);
      const nextId = remaining.length > 0 ? remaining[0].id : null;
      triggerSlideTransition(nextId);
    });
  };

  const handleCompleteTask = () => {
    if (!currentTask || isOtherUser) return;
    const isMeasurable = Boolean(currentTask.track_progress);
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
      const remaining = pendingTodos.filter((t) => t.id !== currentTask.id);
      const nextId = remaining.length > 0 ? remaining[0].id : null;
      triggerSlideTransition(nextId);
    });
  };

  if (!currentTask || pendingTodos.length === 0) {
    return null;
  }

  const timeDisplay = currentTask.scheduled_time || "10:30 AM";

  return (
    <div className="space-y-3.5 overflow-hidden">
      {/* SECTION 2 (THIS TASK'S TREND & TODAY'S COMPARISON) GOES FIRST (TOP) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* LEFT CARD: THIS TASK'S TREND + TODAY'S COMPARISON */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-foreground">This Task&apos;s Trend</span>
              <span className="text-[11px] text-muted-foreground font-medium">Last 7 days</span>
            </div>

            {/* 7 VERTICAL DAY BARS */}
            <div className="flex items-end justify-between gap-1.5 h-14 pt-1 mt-2 pb-1 px-1">
              {history?.lastSevenBars && history.lastSevenBars.length === 7 ? (
                history.lastSevenBars.map((bar, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-full max-w-[12px] rounded-sm transition-all ${
                        bar.completed
                          ? "bg-emerald-500 h-9"
                          : bar.status !== "none"
                          ? "bg-emerald-500/30 h-5"
                          : "bg-muted h-2.5"
                      }`}
                      title={`${bar.date}: ${bar.completed ? "Completed" : bar.status}`}
                    />
                    <span className="text-[10px] font-bold text-muted-foreground">{bar.dayLabel}</span>
                  </div>
                ))
              ) : (
                ["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full max-w-[12px] rounded-sm bg-emerald-500/20 h-5" />
                    <span className="text-[10px] font-bold text-muted-foreground">{d}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* TODAY'S COMPARISON (OVERALL TODAY TASK COMPLETION PERCENTAGE) */}
          <div className="pt-2 border-t border-border/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5 text-amber-500 shrink-0" />
                <span>Today&apos;s Comparison</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">Overall Today</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-muted/40 border border-border/50 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground">You</span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {comparison ? `${comparison.myTodayCompleted}/${comparison.myTodayTotal}` : "0/0"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {comparison ? `${comparison.myTodayPercentage}%` : "0%"}
                  </span>
                  {comparison?.myStatus === "completed" && (
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded shrink-0">
                      ✓ Done
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2 rounded-xl bg-muted/40 border border-border/50 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {comparison?.friendName || "Friend"}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {comparison ? `${comparison.friendTodayCompleted}/${comparison.friendTodayTotal}` : "0/0"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-blue-600 dark:text-blue-400">
                    {comparison ? `${comparison.friendTodayPercentage}%` : "0%"}
                  </span>
                  {comparison?.friendStatus === "completed" && (
                    <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 py-0.2 rounded shrink-0">
                      ✓ Done
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CARD: CURRENT STREAK COMPONENT & DIRECT TASK ANALYTICS BUTTON */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Target className="size-4 text-emerald-500 shrink-0" />
                <span>Current Streak</span>
              </span>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {history ? `${history.consistencyPercentage}% consistency` : "100% consistency"}
              </span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20">
              <div className="size-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/30">
                <TrendingUp className="size-5" />
              </div>
              <div>
                <span className="text-lg font-black text-foreground block leading-none">
                  {history ? `${history.currentStreak} days` : "0 days"}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Active habit streak</span>
              </div>
            </div>
          </div>

          {/* TASK ANALYTICS BUTTON MOVED DIRECTLY WITH CURRENT STREAK COMPONENT */}
          <div className="pt-2 border-t border-border/60">
            <Link
              href={`/analytics?taskId=${currentTask.id}${isOtherUser ? "&user=other" : ""}`}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              title={`View direct task insight for ${currentTask.title}`}
            >
              <BarChart2 className="size-4 text-emerald-600 shrink-0" />
              <span>Current Task Insight</span>
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 3 (RUNNING TASK FOCUSED CARD WITH SLIDE CAROUSEL ANIMATION) */}
      <div
        className={`rounded-2xl border border-emerald-500/20 bg-card p-4 sm:p-5 shadow-2xs relative space-y-3.5 ${
          slideAnim === "slide-out-left"
            ? "-translate-x-full opacity-0 duration-200 ease-in transition-all"
            : slideAnim === "slide-in-start"
            ? "translate-x-full opacity-0 transition-none"
            : slideAnim === "slide-in-end"
            ? "translate-x-0 opacity-100 duration-250 ease-out transition-all"
            : "translate-x-0 opacity-100 transition-all"
        }`}
      >
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

        {/* MODAL DIALOG POPUP FOR TASK SWITCHING */}
        <Dialog open={isSwitchOpen} onOpenChange={setIsSwitchOpen}>
          <DialogContent showCloseButton={false} className="max-w-md rounded-2xl p-5">
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

        {/* TASK ACTION BUTTONS: SKIP ON LEFT, COMPLETE TASK ON RIGHT */}
        {!isOtherUser && (
          <div className="pt-1 flex items-center gap-2.5">
            {/* SKIP BUTTON ON LEFT */}
            <button
              type="button"
              disabled={isPending}
              onClick={() => setIsSkipOpen(true)}
              className="py-3 px-4 rounded-xl border border-border/80 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer min-w-[90px]"
              title="Skip this task with a reason"
            >
              <XCircle className="size-4" />
              <span>Skip</span>
            </button>

            {/* COMPLETE TASK PRIMARY BUTTON ON RIGHT */}
            <button
              type="button"
              disabled={isPending}
              onClick={handleCompleteTask}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-80"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin text-white" />
                  <span>Completing...</span>
                </>
              ) : (
                <>
                  <Check className="size-4 stroke-[3]" />
                  <span>Complete Task</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* SKIP MODAL */}
      <SkipTaskModal
        isOpen={isSkipOpen}
        onClose={() => setIsSkipOpen(false)}
        onConfirm={handleSkipConfirm}
        taskTitle={currentTask.title}
        isSubmitting={isPending}
      />

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
