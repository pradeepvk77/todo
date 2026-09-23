"use client";

/**
 * TaskCircleCheckbox
 *
 * A polished circular task-completion control that replaces the default
 * square checkbox on the Dashboard task list and "Next Up" card.
 *
 * - Micro-burst particles on check
 * - Spring scale bounce animation
 * - Animated checkmark draw
 * - Pulsing spinner ring during async server state update
 */

import { useRef, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface TaskCircleCheckboxProps {
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
  label?: string;
  /** extra Tailwind classes for the outer circle element */
  className?: string;
  /** size variant – defaults to "md" */
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-7 h-7",
};

export function TaskCircleCheckbox({
  checked,
  onCheckedChange,
  disabled = false,
  label = "Toggle task completion",
  className = "",
  size = "md",
}: TaskCircleCheckboxProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [burstKey, setBurstKey] = useState(0);

  const handleClick = () => {
    if (disabled) return;
    if (!checked) {
      // Trigger burst particles on checking off
      setBurstKey((prev) => prev + 1);
    }
    onCheckedChange();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
      {/* ── Outer Burst Ring (Fires on check) ────────────────────────────────── */}
      {burstKey > 0 && checked && (
        <span
          key={`ring-${burstKey}`}
          className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ring-burst pointer-events-none"
        />
      )}

      {/* ── 4 Sparkle Particles Burst ────────────────────────────────────────── */}
      {burstKey > 0 && checked && (
        <div key={`particles-${burstKey}`} className="absolute inset-0 pointer-events-none">
          <span className="absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-p-tl" />
          <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-p-tr" />
          <span className="absolute bottom-0 left-0 w-1.5 h-1.5 rounded-full bg-indigo-400 animate-p-bl" />
          <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-p-br" />
        </div>
      )}

      <button
        ref={btnRef}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={[
          // layout
          "relative flex-shrink-0 flex items-center justify-center rounded-full",
          // sizing
          sizeMap[size],
          // interaction
          "cursor-pointer select-none",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-1",
          "active:scale-85",
          disabled ? "cursor-wait opacity-90" : "",
          // Pop animation when checked
          checked ? "animate-spring-pop bg-emerald-500 border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]" : "bg-transparent border-2 border-border hover:border-emerald-400/80 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Loading Spinner Ring when disabled / saving to server */}
        {disabled ? (
          <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
        ) : (
          /* Checkmark SVG — animated stroke draw when checked */
          <svg
            viewBox="0 0 12 10"
            fill="none"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={[
              "w-3 transition-all duration-200",
              checked ? "opacity-100 animate-checkmark-draw" : "opacity-0 scale-50",
            ].join(" ")}
            aria-hidden="true"
          >
            <polyline points="1,5 4,9 11,1" />
          </svg>
        )}
      </button>
    </div>
  );
}

