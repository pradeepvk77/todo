"use client";

import { useState, useRef, useEffect } from "react";
import { Todo } from "@/lib/db";
import { getUnreviewedMissedOccurrences } from "@/app/actions";
import { MissedTaskReviewModal, UnreviewedOccurence } from "@/components/MissedTaskReviewModal";
import { Greeting } from "@/components/Greeting";
import { TaskMenu } from "@/components/TaskMenu";
import { DailyQuote } from "@/components/DailyQuote";
import { DailyWordStrip } from "@/components/DailyWordStrip";
import { RunningTaskCard } from "@/components/RunningTaskCard";
import { TodoList } from "@/components/TodoList";
import { YouTodoList } from "@/components/YouTodoList";
import { DayOffModal } from "@/components/DayOffModal";
import { ListTodo, ChevronDown, ChevronUp, Pencil, PartyPopper, CheckCircle2, AlertCircle, ArrowRight, Sun, Palmtree } from "lucide-react";
import Link from "next/link";

interface DashboardViewProps {
  myTodos: Todo[];
  otherTodos: Todo[];
  otherUserName: string;
  viewingOtherUser: boolean;
}

export function DashboardView({
  myTodos,
  otherTodos,
  otherUserName,
  viewingOtherUser,
}: DashboardViewProps) {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [unreviewed, setUnreviewed] = useState<UnreviewedOccurence[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isDayOffOpen, setIsDayOffOpen] = useState(false);
  const allTasksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewingOtherUser) {
      getUnreviewedMissedOccurrences().then((items) => {
        if (items && items.length > 0) {
          setUnreviewed(items);
          setIsReviewOpen(true);
        }
      }).catch((err) => console.error(err));
    }
  }, [viewingOtherUser]);

  const targetTodos = viewingOtherUser ? otherTodos : myTodos;
  const totalCount = targetTodos.length;
  const completedCount = targetTodos.filter((t) => t.completed).length;
  const pendingCount = totalCount - completedCount;
  const allCompleted = totalCount > 0 && pendingCount === 0;

  const handleViewAllClick = () => {
    if (!showAllTasks) {
      setShowAllTasks(true);
    }
    setTimeout(() => {
      allTasksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-4">
      {/* DAY OFF MODAL */}
      <DayOffModal
        isOpen={isDayOffOpen}
        onClose={() => setIsDayOffOpen(false)}
      />

      {/* NEXT-DAY MISSED TASK REVIEW BANNER (IF UNREVIEWED MISSED TASKS EXIST) */}
      {!viewingOtherUser && unreviewed.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="size-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                Yesterday you had {unreviewed.length} task{unreviewed.length > 1 ? "s" : ""} you didn&apos;t complete
              </h4>
              <p className="text-[11px] text-muted-foreground font-medium truncate">
                Can you tell us what happened?
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsReviewOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
          >
            <span>Review Now</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}

      {/* MISSED TASK REVIEW MODAL */}
      <MissedTaskReviewModal
        isOpen={isReviewOpen}
        occurrences={unreviewed}
        onClose={() => setIsReviewOpen(false)}
        onCompleteAll={() => {
          setIsReviewOpen(false);
          setUnreviewed([]);
        }}
      />

      {/* 1. GREETING & HEADER */}
      <header className="flex items-center justify-between gap-4 pb-3 border-b border-border/70 w-full">
        <Greeting userName={viewingOtherUser ? otherUserName : ""} />
        <TaskMenu
          otherUserName={otherUserName}
          otherUser={viewingOtherUser}
          onOpenDayOff={() => setIsDayOffOpen(true)}
        />
      </header>

      {/* 2. QUOTE */}
      {!viewingOtherUser && <DailyQuote />}

      {/* 3. DAILY WORD */}
      {!viewingOtherUser && <DailyWordStrip />}

      {/* 4. ALL TASKS COMPLETED MESSAGE OR RUNNING TASK SECTION */}
      {allCompleted ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-emerald-500/5 p-6 text-center space-y-3 shadow-2xs">
          <div className="size-14 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-500/30">
            <PartyPopper className="size-7" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-xl font-bold text-foreground tracking-tight">Amazing work!</h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
              You’ve completed everything for today. Take a moment to be proud of your progress.
            </p>
          </div>
        </div>
      ) : (
        <RunningTaskCard todos={targetTodos} isOtherUser={viewingOtherUser} />
      )}

      {/* 5. TASK PROGRESS CARD */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-4.5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-bold text-foreground">
          <span className="text-sm tracking-tight">Task Progress</span>
          <span className="text-muted-foreground font-semibold">
            <strong className="text-foreground">{completedCount}</strong>/{totalCount} completed
          </span>
        </div>

        {/* SEGMENTED PROGRESS BAR */}
        <div className="flex items-center gap-1.5 w-full">
          {Array.from({ length: Math.max(totalCount, 1) }).map((_, idx) => {
            const isFilled = idx < completedCount;
            return (
              <div
                key={idx}
                className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${
                  isFilled ? "bg-emerald-500" : "bg-muted/80"
                }`}
              />
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground font-medium pt-0.5">
          {allCompleted
            ? "🎉 Amazing work! You've completed everything for today."
            : "You're doing great! Keep it up."}
        </p>
      </div>

      {/* 6. VIEW ALL TASKS SMOOTH SCROLL BUTTON */}
      <div className="pt-1 space-y-3">
        <button
          type="button"
          onClick={handleViewAllClick}
          className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer"
        >
          <ListTodo className="size-4" />
          <span>{`View All Tasks (${totalCount})`}</span>
          <ChevronDown className="size-4" />
        </button>

        {/* ALL TASKS SECTION (WITH SMOOTH SCROLL TARGET) */}
        <div ref={allTasksRef} className="scroll-mt-4">
          {showAllTasks && (
            <div className="space-y-3 pt-3 animate-in fade-in-50 zoom-in-98 duration-200">
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    {viewingOtherUser ? `${otherUserName}'s Tasks` : "Today's Tasks"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Drag to reorder, view notes, and manage section filters
                  </p>
                </div>

                {!viewingOtherUser && (
                  <Link
                    href="/edit-tasks"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Pencil className="size-3" />
                    <span>Edit All</span>
                  </Link>
                )}
              </div>

              {!viewingOtherUser ? (
                <TodoList initialTodos={myTodos} />
              ) : (
                <YouTodoList todos={otherTodos} otherUserLabel={otherUserName} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
