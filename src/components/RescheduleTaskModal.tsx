"use client";

import { useState } from "react";
import { X, Calendar, Clock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getISTDateString } from "@/lib/time-utils";

interface RescheduleTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newDate: string, newTime: string, reason?: string, notes?: string) => void;
  taskTitle: string;
  currentDate?: string;
  currentTime?: string;
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

function getTomorrowDateStr(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getISTDateString(tomorrow);
}

export function RescheduleTaskModal({
  isOpen,
  onClose,
  onConfirm,
  taskTitle,
  currentDate,
  currentTime = "09:00 AM",
  isSubmitting = false,
}: RescheduleTaskModalProps) {
  const tomorrowStr = getTomorrowDateStr();
  const [newDate, setNewDate] = useState<string>(tomorrowStr);
  const [newTime, setNewTime] = useState<string>(currentTime || "09:00 AM");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    onConfirm(newDate, newTime, selectedReason, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl text-foreground">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <h3 className="text-base font-bold tracking-tight">Reschedule Task</h3>
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
          {/* Quick Date Select Pills */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <Calendar className="size-3.5 text-emerald-600" />
              <span>Select New Date</span>
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setNewDate(tomorrowStr)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  newDate === tomorrowStr
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                Tomorrow
              </button>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-1 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* New Time Input */}
          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-blue-600" />
              <span>Select New Time</span>
            </label>
            <input
              type="text"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              placeholder="e.g. 10:30 AM"
              className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Optional Reason Selection */}
          <div className="space-y-1.5 text-xs pt-1 border-t border-border/50">
            <label className="font-bold text-muted-foreground">Why are you rescheduling? (Optional)</label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="">Select a reason...</option>
              {REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select>
          </div>

          {selectedReason === "other" && (
            <div className="space-y-1 text-xs">
              <label className="font-bold text-muted-foreground">Notes:</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional details..."
                className="w-full px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
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
              disabled={isSubmitting || !newDate}
              className="rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              {isSubmitting ? "Rescheduling..." : "Reschedule Task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
