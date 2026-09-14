"use client";

/**
 * TaskCircleCheckbox
 *
 * A polished circular task-completion control that replaces the default
 * square checkbox on the Dashboard task list and "Next Up" card.
 *
 * - Pending  : plain circle with a subtle border, inviting the user to tap
 * - Completed: filled green circle with an animated white checkmark
 * - Animates : circle fills + checkmark scales/draws in ~300ms
 * - Accessible: role="checkbox", aria-checked, aria-label, keyboard Enter/Space
 */

import { useRef } from "react";

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!disabled) onCheckedChange();
    }
  };

  return (
    <button
      ref={btnRef}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange()}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={[
        // layout
        "relative flex-shrink-0 flex items-center justify-center rounded-full",
        // sizing
        sizeMap[size],
        // interaction
        "cursor-pointer select-none",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-1",
        "active:scale-90",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        // Pending vs Completed appearance
        checked
          ? "bg-emerald-500 border-2 border-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"
          : "bg-transparent border-2 border-border hover:border-emerald-400/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Checkmark SVG — scales in when checked */}
      <svg
        viewBox="0 0 12 10"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={[
          "w-[52%] h-[52%] transition-all duration-200",
          checked ? "opacity-100 scale-100" : "opacity-0 scale-50",
        ].join(" ")}
        aria-hidden="true"
      >
        <polyline points="1,5 4,9 11,1" />
      </svg>
    </button>
  );
}
