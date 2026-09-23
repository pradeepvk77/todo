"use client";

import { useState } from "react";
import { Todo } from "@/lib/db";
import { CheckCircle2, Target, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CompleteTaskValueModalProps {
  isOpen: boolean;
  onClose: () => void;
  todo: Todo | null;
  onConfirm: (completedValue: number | null) => void;
}

export function CompleteTaskValueModal({
  isOpen,
  onClose,
  todo,
  onConfirm,
}: CompleteTaskValueModalProps) {
  const targetVal = todo?.target_value ?? null;
  const unitStr = todo?.unit || "";

  // Always start empty — the user must consciously enter their actual value.
  // The target is displayed as a reference badge above the input.
  const [valInput, setValInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!todo) return null;

  const handleSaveWithNumber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valInput.trim()) {
      // Empty input -> complete without recording value
      onConfirm(null);
      return;
    }

    const num = parseFloat(valInput.trim());
    if (isNaN(num)) {
      setErrorMsg("Please enter a valid numeric value.");
      return;
    }

    if (num < 0) {
      setErrorMsg("Completed value cannot be negative.");
      return;
    }

    setErrorMsg(null);
    onConfirm(num);
  };

  const handleCompleteWithoutValue = () => {
    setErrorMsg(null);
    onConfirm(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl bg-card border border-border/80 shadow-lg p-5 space-y-4">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <span>Complete Task</span>
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground font-medium">
            Log your actual performance result for <span className="font-bold text-foreground">&ldquo;{todo.title}&rdquo;</span>.
          </DialogDescription>
        </DialogHeader>

        {/* TARGET BADGE */}
        {(targetVal !== null || todo.type_value) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <Target className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Configured Target:</span>
            <span className="font-extrabold text-foreground">
              {targetVal !== null ? `${targetVal} ${unitStr}`.trim() : todo.type_value}
            </span>
          </div>
        )}

        <form onSubmit={handleSaveWithNumber} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              Actual Completed Value ({unitStr ? unitStr : "quantity"}):
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="any"
                min="0"
                value={valInput}
                onChange={(e) => {
                  setValInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder={targetVal !== null ? `e.g. ${targetVal}` : "Enter your actual value"}
                className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-bold text-foreground shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {unitStr && (
                <span className="absolute right-3.5 text-xs font-bold text-muted-foreground">
                  {unitStr}
                </span>
              )}
            </div>
            {errorMsg && (
              <p className="text-[11px] font-semibold text-rose-500 pt-0.5">{errorMsg}</p>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              <span>Save &amp; Complete</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteWithoutValue}
              className="w-full py-2 px-4 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer text-center"
            >
              Complete without recording value
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
