"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SkipTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string, notes?: string) => void;
  taskTitle: string;
  isSubmitting?: boolean;
}

const REASONS = [
  { id: "too_tired", label: "Too tired", icon: "😴" },
  { id: "forgot", label: "Forgot", icon: "🧠" },
  { id: "not_in_mood", label: "Not in the mood", icon: "😔" },
  { id: "ran_out_of_time", label: "Ran out of time", icon: "⏰" },
  { id: "something_came_up", label: "Something came up", icon: "🔗" },
  { id: "not_important", label: "Not important right now", icon: "🚩" },
  { id: "other", label: "Other", icon: "💬" },
];

export function SkipTaskModal({
  isOpen,
  onClose,
  onConfirm,
  taskTitle,
  isSubmitting = false,
}: SkipTaskModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("too_tired");
  const [notes, setNotes] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selectedReason, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl text-foreground">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Why are you skipping this task?</h3>
            <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate max-w-xs">
              Task: <span className="font-bold text-foreground">{taskTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1 text-xs">
            {REASONS.map((r) => {
              const isSelected = selectedReason === r.id;
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setSelectedReason(r.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10 font-bold text-foreground"
                      : "border-border/60 hover:bg-muted/50 text-muted-foreground font-medium"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{r.icon}</span>
                    <span>{r.label}</span>
                  </span>
                  {isSelected && <Check className="size-4 text-emerald-600 stroke-[3]" />}
                </button>
              );
            })}
          </div>

          {selectedReason === "other" && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">Optional note:</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specify your reason..."
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="rounded-xl text-xs font-bold bg-muted-foreground text-card hover:bg-foreground cursor-pointer"
            >
              {isSubmitting ? "Skipping..." : "Skip Task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
