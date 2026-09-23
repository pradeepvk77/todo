"use client";

import { useState } from "react";
import { X, Check, Calendar, ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitMissedTaskReview } from "@/app/actions";

export interface UnreviewedOccurence {
  id: number;
  user_id: string;
  todo_id: number;
  occurrence_date: string;
  status: string;
  scheduled_time?: string;
  missed_reason?: string;
  missed_reason_notes?: string;
  review_status?: string;
  app_update_reason?: string;
  app_update_reason_notes?: string;
  todo_title: string;
  category?: string;
  day_section?: string;
}

interface MissedTaskReviewModalProps {
  isOpen: boolean;
  occurrences: UnreviewedOccurence[];
  onClose: () => void;
  onCompleteAll: () => void;
}

const TASK_REASONS = [
  { id: "too_tired", label: "Too tired", icon: "😴" },
  { id: "forgot", label: "Forgot", icon: "🧠" },
  { id: "not_in_mood", label: "Not in the mood", icon: "😔" },
  { id: "ran_out_of_time", label: "Ran out of time", icon: "⏰" },
  { id: "something_came_up", label: "Something came up", icon: "🔗" },
  { id: "not_important", label: "Not important", icon: "🚩" },
  { id: "other", label: "Other", icon: "💬" },
];

const APP_UPDATE_REASONS = [
  { id: "forgot_to_update", label: "Forgot to update", icon: "🧠" },
  { id: "didnt_open_app", label: "Didn't open the app", icon: "📱" },
  { id: "was_busy", label: "Was busy", icon: "⏳" },
  { id: "didnt_think_necessary", label: "Didn't think it was necessary", icon: "🤷" },
  { id: "didnt_have_time", label: "Didn't have time", icon: "⏰" },
  { id: "other", label: "Other", icon: "💬" },
];

export function MissedTaskReviewModal({
  isOpen,
  occurrences,
  onClose,
  onCompleteAll,
}: MissedTaskReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedTaskReason, setSelectedTaskReason] = useState<string>("too_tired");
  const [taskNotes, setTaskNotes] = useState<string>("");
  const [selectedAppReason, setSelectedAppReason] = useState<string>("forgot_to_update");
  const [appNotes, setAppNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || occurrences.length === 0) return null;

  const currentItem = occurrences[currentIndex];
  const isLast = currentIndex === occurrences.length - 1;

  const handleSaveCurrent = async () => {
    if (!currentItem) return;
    setIsSubmitting(true);
    try {
      await submitMissedTaskReview(currentItem.id, {
        missedReason: selectedTaskReason,
        missedReasonNotes: taskNotes,
        appUpdateReason: selectedAppReason,
        appUpdateReasonNotes: appNotes,
      });

      if (isLast) {
        onCompleteAll();
      } else {
        setCurrentIndex((prev) => prev + 1);
        setSelectedTaskReason("too_tired");
        setTaskNotes("");
        setSelectedAppReason("forgot_to_update");
        setAppNotes("");
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipCurrent = () => {
    if (isLast) {
      onCompleteAll();
    } else {
      setCurrentIndex((prev) => prev + 1);
      setSelectedTaskReason("too_tired");
      setTaskNotes("");
      setSelectedAppReason("forgot_to_update");
      setAppNotes("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl text-foreground relative">
        {/* Progress Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <span className="text-[11px] font-black uppercase text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              Daily Reflection ({currentIndex + 1} of {occurrences.length})
            </span>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground mt-1">
              Unfinished Tasks Review
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Current Task Detail Box */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-bold text-foreground truncate">{currentItem.todo_title}</h4>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 whitespace-nowrap">
              No Action
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium pt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {currentItem.occurrence_date}
            </span>
            <span>·</span>
            <span>Scheduled: {currentItem.scheduled_time || "Default time"}</span>
          </div>
        </div>

        {/* Form Questions Container */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {/* Question 1: Why task was not completed */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <HelpCircle className="size-3.5 text-amber-500 shrink-0" />
              <span>Why didn&apos;t you complete it?</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {TASK_REASONS.map((r) => {
                const isSelected = selectedTaskReason === r.id;
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => setSelectedTaskReason(r.id)}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 font-bold text-foreground"
                        : "border-border/60 hover:bg-muted/50 text-muted-foreground font-medium"
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{r.icon}</span>
                      <span className="truncate">{r.label}</span>
                    </span>
                    {isSelected && <Check className="size-3.5 text-emerald-600 stroke-[3] shrink-0" />}
                  </button>
                );
              })}
            </div>
            {selectedTaskReason === "other" && (
              <input
                type="text"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Optional task reason notes..."
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSkipCurrent}
            disabled={isSubmitting}
            className="rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Skip for now
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold cursor-pointer"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCurrent}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer gap-1.5"
            >
              <span>{isSubmitting ? "Saving..." : isLast ? "Save & Finish" : "Save & Continue"}</span>
              {!isLast && <ArrowRight className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
