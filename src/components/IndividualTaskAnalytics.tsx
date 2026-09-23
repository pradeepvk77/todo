"use client";

import { useState } from "react";
import { IndividualTaskAnalyticsData, ProgressAnalyticsData, TimeRange } from "@/app/actions/analytics";
import {
  ArrowLeft,
  Check,
  RotateCcw,
  X,
  Minus,
  TrendingUp,
  TrendingDown,
  Flame,
  Crown,
  Clock,
  Pencil,
  MessageSquare,
  Lightbulb,
  Info,
  ChevronRight,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus as MinusIcon,
} from "lucide-react";
import Link from "next/link";

interface IndividualTaskAnalyticsProps {
  data: IndividualTaskAnalyticsData;
  onBack: () => void;
  onSelectTimeRange: (range: TimeRange) => void;
  includeToday?: boolean;
  onToggleIncludeToday?: (checked: boolean) => void;
  isOtherUser?: boolean;
}

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "all_time", label: "All Time" },
];

export function IndividualTaskAnalytics({
  data,
  onBack,
  onSelectTimeRange,
  includeToday = false,
  onToggleIncludeToday,
  isOtherUser = false,
}: IndividualTaskAnalyticsProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(data.timeRange);
  const [activeTab, setActiveTab] = useState<"overview" | "trends" | "time" | "reasons" | "history">(
    "overview"
  );

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    onSelectTimeRange(range);
  };

  // SVG Chart calculation
  const chartWidth = 500;
  const chartHeight = 160;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };
  const trendPoints = data.completionTrend || [];

  const points = trendPoints.map((item, index) => {
    const x =
      padding.left +
      (index * (chartWidth - padding.left - padding.right)) / Math.max(trendPoints.length - 1, 1);
    const y =
      padding.top +
      ((100 - Math.min(Math.max(item.percentage, 0), 100)) *
        (chartHeight - padding.top - padding.bottom)) /
        100;
    return `${x},${y}`;
  });

  const areaPoints = points.length > 0
    ? `${padding.left},${chartHeight - padding.bottom} ${points.join(" ")} ${chartWidth - padding.right},${chartHeight - padding.bottom}`
    : "";

  return (
    <div className="space-y-5">
      {/* SECTION 1: HEADER & BACK BUTTON */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/70">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>

        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">Task Analytics</h1>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none px-2.5 py-1 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors">
            <input
              type="checkbox"
              checked={includeToday}
              onChange={(e) => onToggleIncludeToday?.(e.target.checked)}
              className="size-4 rounded border-border text-emerald-600 focus:ring-emerald-500/30 cursor-pointer accent-emerald-600"
            />
            <span>Include today</span>
          </label>

          <select
            value={selectedRange}
            onChange={(e) => handleRangeChange(e.target.value as TimeRange)}
            className="px-3 py-1.5 rounded-xl border border-border/80 bg-card text-xs font-bold text-foreground cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SECTION 2: TASK INFO HEADER CARD */}
      <div className="rounded-2xl border border-emerald-500/20 bg-card p-4 sm:p-5 shadow-2xs relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className="size-12 shrink-0 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/15">
              <MessageSquare className="size-6 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {data.taskTitle}
              </h2>

              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground font-medium">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-bold text-[11px] border border-blue-500/20">
                  💬 {data.category}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-semibold">
                  <Clock className="size-3.5 text-muted-foreground/80" />
                  {data.scheduledTime ? data.scheduledTime : "Unscheduled"}
                </span>
              </div>
            </div>
          </div>

          {!isOtherUser && (
            <Link
              href="/edit-tasks"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-muted/70 hover:bg-muted text-foreground text-xs font-bold transition-all border border-border/60 shrink-0"
            >
              <Pencil className="size-3.5" />
              <span>Edit</span>
            </Link>
          )}
        </div>
      </div>

      {/* SECTION 3: TASK SUMMARY CARDS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* CARD 1: COMPLETION RATE */}
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs flex flex-col justify-between items-center text-center">
          <div className="flex items-center justify-center w-full">
            <div className="relative size-14 flex items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-muted/60 stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 stroke-current"
                  strokeWidth="3.5"
                  strokeDasharray={`${data.completionRate}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black text-foreground">{data.completionRate}%</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center text-center">
            <h4 className="text-xs font-bold text-foreground">Completion Rate</h4>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-0.5 mt-0.5">
              <TrendingUp className="size-3" />
              <span>{data.rateChange >= 0 ? `+${data.rateChange}%` : `${data.rateChange}%`}</span>
              <span className="text-muted-foreground font-normal">vs prev</span>
            </p>
          </div>
        </div>

        {/* CARD 2: COMPLETED */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
          <div className="size-7 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center border border-emerald-500/25">
            <Check className="size-4 stroke-[3]" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-foreground block leading-none">
              {data.completedCount}
            </span>
            <span className="text-xs font-bold text-foreground block mt-1">Completed</span>
          </div>
        </div>

        {/* CARD 3: SKIPPED */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
          <div className="size-7 rounded-xl bg-muted text-muted-foreground flex items-center justify-center border border-border">
            <Minus className="size-4 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-foreground block leading-none">
              {data.skippedCount}
            </span>
            <span className="text-xs font-bold text-foreground block mt-1">Skipped</span>
          </div>
        </div>

        {/* CARD 4: RESCHEDULED */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
          <div className="size-7 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center border border-blue-500/25">
            <RotateCcw className="size-4" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-foreground block leading-none">
              {data.rescheduledCount}
            </span>
            <span className="text-xs font-bold text-foreground block mt-1">Rescheduled</span>
          </div>
        </div>

        {/* CARD 5: NO ACTION */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
          <div className="size-7 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center border border-rose-500/25">
            <X className="size-4 stroke-[3]" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-foreground block leading-none">
              {data.noActionCount}
            </span>
            <span className="text-xs font-bold text-foreground block mt-1">No Action</span>
          </div>
        </div>
      </div>

      {/* SECTION 4: OVERVIEW TABS */}
      <div className="flex items-center gap-1.5 border-b border-border/70 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
        {[
          { key: "overview", label: "Overview" },
          { key: "trends", label: "Trends" },
          { key: "time", label: "Time Analysis" },
          { key: "reasons", label: "Reasons" },
          { key: "history", label: "History" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-3 py-1.5 rounded-t-xl transition-all cursor-pointer whitespace-nowrap border-b-2 ${
              activeTab === t.key
                ? "border-emerald-500 text-emerald-600 font-extrabold bg-emerald-500/10"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SECTION 5: COMPLETION TREND LINE CHART */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between text-xs">
          <div>
            <h3 className="font-bold text-foreground text-sm">Completion Trend</h3>
            <span className="text-muted-foreground font-medium">
              Task completion over the selected period
            </span>
          </div>
          <div className="relative">
            <select
              value={selectedRange}
              onChange={(e) => handleRangeChange(e.target.value as TimeRange)}
              className="px-2.5 py-1 rounded-lg border border-border bg-muted/60 text-[11px] font-bold text-foreground"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 pt-1">
          <div className="lg:col-span-2 h-44 w-full">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="size-full overflow-visible">
              <defs>
                <linearGradient id="taskTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 25, 50, 75, 100].map((val) => {
                const y = padding.top + ((100 - val) * (chartHeight - padding.top - padding.bottom)) / 100;
                return (
                  <g key={val}>
                    <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke="#e4e4e7" strokeDasharray="3 3" />
                    <text x="0" y={y + 4} fill="#9ca3af" fontSize="9" fontWeight="600">
                      {val}%
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              {areaPoints && <polygon points={areaPoints} fill="url(#taskTrendGradient)" />}

              {/* Polyline */}
              {points.length > 0 && (
                <polyline points={points.join(" ")} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}

              {/* Data Node Circles */}
              {trendPoints.map((item, idx) => {
                if (!points[idx]) return null;
                const [x, y] = points[idx].split(",");
                const showLabel = idx % Math.max(Math.floor(trendPoints.length / 6), 1) === 0;
                return (
                  <g key={idx}>
                    <circle cx={x} cy={y} r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5">
                      <title>{`${item.date}: ${item.percentage}%`}</title>
                    </circle>
                    {showLabel && (
                      <text x={x} y={chartHeight - 4} textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="600">
                        {item.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* STATUS INSIGHT BOX */}
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1.5 text-emerald-800 dark:text-emerald-300 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="size-4" />
              <span className="capitalize">{data.trendStatus}</span>
            </div>
            <p className="text-xs font-medium text-emerald-700/90 dark:text-emerald-400/90 leading-relaxed">
              {data.trendInsight}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 6: STREAKS & TIMING ROW (3 CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1 shadow-2xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/25">
            <Flame className="size-5" />
          </div>
          <div>
            <span className="text-base font-black text-foreground block leading-none">
              {data.currentStreak} days
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Current streak</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1 shadow-2xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/25">
            <Crown className="size-5" />
          </div>
          <div>
            <span className="text-base font-black text-foreground block leading-none">
              {data.longestStreak} days
            </span>
            <span className="text-xs font-semibold text-muted-foreground">Longest streak</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-1 shadow-2xs flex items-center gap-3">
          <div className="size-9 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0 border border-blue-500/25">
            <Clock className="size-5" />
          </div>
          <div>
            <span className="text-base font-black text-foreground block leading-none">
              {data.avgCompletionTime}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 block">
              {data.avgDelay}
            </span>
          </div>
        </div>
      </div>



      {/* SECTION 9: PROGRESS ANALYTICS — only for measurable tasks with real data */}
      {data.progressData && (
        <ProgressSection progress={data.progressData} />
      )}
            {/* SECTION 7: WHY THIS TASK IS MISSED & TIME OF DAY GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* WHY THIS TASK IS MISSED */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm">Why This Task Is Missed</h3>
            <Info className="size-3.5 text-muted-foreground" />
          </div>

          {data.missedReasons.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground italic">
              No reason data available yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {data.missedReasons.map((reason) => (
                <div key={reason.reasonKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5 font-bold text-foreground">
                      <span>{reason.icon}</span>
                      <span>{reason.label}</span>
                    </span>
                    <span className="text-muted-foreground font-bold">{reason.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted/80 rounded-full h-2 overflow-hidden border border-border/40">
                    <div
                      className="bg-amber-500/80 h-full rounded-full transition-all"
                      style={{ width: `${reason.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COMPLETION BY TIME OF DAY */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-foreground text-sm mb-3">Completion by Time of Day</h3>

            <div className="flex items-end justify-between gap-3 pt-2 border-b border-border pb-2 px-2">
              {[
                { label: "Morning", pct: data.timeOfDayPerformance.morning.percentage },
                { label: "Afternoon", pct: data.timeOfDayPerformance.afternoon.percentage },
                { label: "Evening", pct: data.timeOfDayPerformance.evening.percentage },
                { label: "Night", pct: data.timeOfDayPerformance.night.percentage },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{item.pct}%</span>
                  <div className="w-full max-w-[28px] h-20 bg-muted/60 rounded-t-lg relative flex items-end overflow-hidden border border-border/40">
                    <div
                      className="w-full rounded-t-lg bg-emerald-500 transition-all duration-500"
                      style={{ height: `${Math.max(item.pct, 5)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 space-y-1 text-emerald-800 dark:text-emerald-300 mt-2">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <Lightbulb className="size-4 text-amber-500 shrink-0" />
              <span>Insight</span>
            </div>
            <p className="text-[11px] font-medium text-emerald-700/90 dark:text-emerald-400/90 leading-tight">
              {data.timeOfDayPerformance.insight}
            </p>
          </div>
        </div>
      </div>
      {/* SECTION 8: RECENT ACTIVITY & NOTES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* RECENT ACTIVITY */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm">Recent Activity</h3>
            <span className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-0.5">
              View All <ChevronRight className="size-3" />
            </span>
          </div>

          {data.recentActivity.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground italic">
              No recent activity logged for this task yet.
            </p>
          ) : (
            <div className="space-y-2 divide-y divide-border/40">
              {data.recentActivity.map((act, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">{act.date}</span>
                  <div className="flex items-center gap-1.5 font-bold">
                    {act.status === "completed" && <Check className="size-3.5 text-emerald-600 stroke-[3]" />}
                    {act.status === "rescheduled" && <RotateCcw className="size-3 text-blue-600" />}
                    {act.status === "skipped" && <X className="size-3.5 text-rose-600 stroke-[3]" />}
                    {act.status === "no_action" && <Minus className="size-3.5 text-gray-400" />}
                    <span className="capitalize">{act.status.replace("_", " ")}</span>
                    {act.reason && <span className="text-muted-foreground font-normal">({act.reason})</span>}
                  </div>
                  <span className="text-muted-foreground font-medium">{act.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NOTES */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm">Notes</h3>
            <span className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-0.5">
              View All <ChevronRight className="size-3" />
            </span>
          </div>

          {data.notesHistory.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground italic">
              No notes logged for this task yet.
            </p>
          ) : (
            <div className="space-y-2 divide-y divide-border/40">
              {data.notesHistory.map((note, idx) => (
                <div key={idx} className="pt-2 first:pt-0 space-y-0.5">
                  <span className="text-[10px] font-bold text-muted-foreground block">{note.date}</span>
                  <p className="text-xs text-foreground/90 font-medium italic bg-muted/30 p-2 rounded-lg border border-border/40">
                    &ldquo;{note.note}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Progress Section Component ───────────────────────────────────────────────

function fmt(val: number | null, unit: string): string {
  if (val === null) return "—";
  const u = unit || "units";
  return `${val} ${u}`;
}

function fmtChange(val: number | null, unit: string): string {
  if (val === null) return "—";
  const u = unit || "units";
  const sign = val > 0 ? "+" : "";
  return `${sign}${val} ${u}`;
}

function ProgressSection({ progress }: { progress: ProgressAnalyticsData }) {
  const unit = progress.unit || "";
  const displayUnit = unit || "units";

  // ── Metric cards data ──────────────────────────────────────────────────────
  const cards = [
    {
      label: "Starting",
      value: fmt(progress.startingValue, unit),
      color: "text-blue-600",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "Current",
      value: fmt(progress.currentValue, unit),
      color: "text-emerald-600",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Average",
      value: fmt(progress.averageValue, unit),
      color: "text-violet-600",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      label: "Best",
      value: fmt(progress.personalBest, unit),
      color: "text-amber-600",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Total",
      value: fmt(progress.totalValue, unit),
      color: "text-foreground",
      bg: "bg-muted/50 border-border",
    },
    {
      label: "Change",
      value:
        progress.absoluteChange !== null
          ? fmtChange(progress.absoluteChange, unit)
          : "—",
      sub:
        progress.percentageChange !== null
          ? `${progress.percentageChange > 0 ? "+" : ""}${progress.percentageChange}%`
          : undefined,
      color:
        progress.absoluteChange === null
          ? "text-muted-foreground"
          : progress.absoluteChange > 0
          ? "text-emerald-600"
          : progress.absoluteChange < 0
          ? "text-rose-600"
          : "text-foreground",
      bg:
        progress.absoluteChange === null
          ? "bg-muted/50 border-border"
          : progress.absoluteChange > 0
          ? "bg-emerald-500/10 border-emerald-500/20"
          : progress.absoluteChange < 0
          ? "bg-rose-500/10 border-rose-500/20"
          : "bg-muted/50 border-border",
    },
  ];

  // ── SVG chart for Target vs Actual ────────────────────────────────────────
  const chartWidth = 500;
  const chartHeight = 160;
  const pad = { top: 16, right: 20, bottom: 28, left: 42 };
  const plotW = chartWidth - pad.left - pad.right;
  const plotH = chartHeight - pad.top - pad.bottom;

  // Only points that have an actual completed_value
  const chartPoints = progress.history.filter((h) => h.completedValue !== null);

  // Y-axis range
  const allValues: number[] = [];
  chartPoints.forEach((h) => {
    if (h.completedValue !== null) allValues.push(h.completedValue);
    if (h.targetValue !== null) allValues.push(h.targetValue);
  });
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const yPad = (rawMax - rawMin) * 0.15 || 0.5;
  const yMin = Math.max(0, rawMin - yPad);
  const yMax = rawMax + yPad;
  const yRange = yMax - yMin || 1;

  const toX = (i: number, total: number) =>
    pad.left + (total <= 1 ? plotW / 2 : (i / (total - 1)) * plotW);
  const toY = (v: number) =>
    pad.top + ((yMax - v) / yRange) * plotH;

  // Actual line points
  const actualPts = chartPoints.map((h, i) =>
    `${toX(i, chartPoints.length)},${toY(h.completedValue as number)}`
  );
  const areaBase = chartHeight - pad.bottom;
  const areaPoints =
    actualPts.length > 0
      ? `${pad.left},${areaBase} ${actualPts.join(" ")} ${toX(chartPoints.length - 1, chartPoints.length)},${areaBase}`
      : "";

  // Y-axis grid values
  const gridVals = [0, 25, 50, 75, 100].map(
    (pct) => yMin + (yRange * pct) / 100
  );

  // X-axis date labels (sample every ~4th to avoid crowding)
  const labelStep = Math.max(1, Math.floor(chartPoints.length / 5));

  // Trend badge
  const trendConfig = {
    improving: {
      icon: <TrendingUp className="size-3.5" />,
      label: "↑ Recent performance is higher",
      color: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    declining: {
      icon: <TrendingDown className="size-3.5" />,
      label: "↓ Recent performance is lower",
      color: "text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
    },
    stable: {
      icon: <MinusIcon className="size-3.5" />,
      label: "→ Recent performance is stable",
      color: "text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
    },
    insufficient_data: null,
  };
  const tc = trendConfig[progress.trend];

  if (!progress.isMeasurable) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-muted-foreground" />
          <h3 className="font-bold text-foreground text-sm">Progress</h3>
        </div>
        <p className="text-xs text-muted-foreground italic py-4 text-center">
          No quantitative data recorded yet. Complete this task with an actual value to start tracking progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* ── PROGRESS HEADER ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-2">
        <BarChart3 className="size-5 text-violet-500" />
        <h3 className="font-bold text-foreground text-sm">Progress</h3>
        <span className="text-xs text-muted-foreground font-medium">
          · {progress.history.length} recorded value{progress.history.length !== 1 ? "s" : ""}
        </span>
        {progress.targetAchievementRate !== null && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <Target className="size-3 inline mr-0.5" />
            {progress.targetAchievementRate}% vs target
          </span>
        )}
      </div>

      {/* ── METRIC CARDS GRID ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-3 space-y-1 shadow-2xs ${card.bg}`}
          >
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">
              {card.label}
            </span>
            <span className={`text-sm font-extrabold block leading-tight ${card.color}`}>
              {card.value}
            </span>
            {card.sub && (
              <span className={`text-[10px] font-bold block ${card.color}`}>
                {card.sub}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ── TARGET VS ACTUAL CHART ──────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-foreground text-sm">Performance Over Time</h4>
            <span className="text-xs text-muted-foreground font-medium">
              Actual {displayUnit} recorded per completed session
            </span>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 rounded bg-emerald-500" />
              Actual
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 h-0.5 rounded bg-amber-400 border-dashed border-t border-amber-400" />
              Target
            </span>
          </div>
        </div>

        {chartPoints.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground italic">
            No completed values to chart yet.
          </p>
        ) : (
          <div className="h-44 w-full">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="size-full overflow-visible"
            >
              <defs>
                <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines + Y-axis labels */}
              {gridVals.map((v, i) => {
                const y = toY(v);
                return (
                  <g key={i}>
                    <line
                      x1={pad.left}
                      x2={chartWidth - pad.right}
                      y1={y}
                      y2={y}
                      stroke="#e4e4e7"
                      strokeDasharray="3 3"
                    />
                    <text x={pad.left - 4} y={y + 3.5} fill="#9ca3af" fontSize="8" fontWeight="600" textAnchor="end">
                      {v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}
                    </text>
                  </g>
                );
              })}

              {/* Area fill */}
              {areaPoints && (
                <polygon points={areaPoints} fill="url(#progressGradient)" />
              )}

              {/* Per-point historical target lines (dashed amber segments) */}
              {chartPoints.map((h, i) => {
                if (h.targetValue === null) return null;
                const x = toX(i, chartPoints.length);
                const ty = toY(h.targetValue);
                // Draw a short horizontal dashed segment at each point's historical target
                const segHalf = chartPoints.length <= 1 ? 20 : Math.min(20, plotW / chartPoints.length / 2.2);
                return (
                  <line
                    key={`tgt-${i}`}
                    x1={x - segHalf}
                    x2={x + segHalf}
                    y1={ty}
                    y2={ty}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.8"
                  />
                );
              })}

              {/* If all target values are the same, draw a continuous target line */}
              {(() => {
                const targets = chartPoints
                  .map((h) => h.targetValue)
                  .filter((v): v is number => v !== null);
                if (targets.length >= 2) {
                  const allSame = targets.every((v) => v === targets[0]);
                  if (allSame) {
                    const ty = toY(targets[0]);
                    return (
                      <line
                        x1={pad.left}
                        x2={chartWidth - pad.right}
                        y1={ty}
                        y2={ty}
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="6 4"
                        opacity="0.75"
                      />
                    );
                  }
                }
                return null;
              })()}

              {/* Actual line */}
              {actualPts.length > 1 && (
                <polyline
                  points={actualPts.join(" ")}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data dot + tooltip + X label */}
              {chartPoints.map((h, i) => {
                const x = toX(i, chartPoints.length);
                const y = toY(h.completedValue as number);
                const showLabel = i % labelStep === 0 || i === chartPoints.length - 1;
                const dateLabel = h.date.slice(5); // MM-DD
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5">
                      <title>{`${h.date}: ${h.completedValue} ${displayUnit}${h.targetValue !== null ? ` (target ${h.targetValue})` : ""}`}</title>
                    </circle>
                    {showLabel && (
                      <text
                        x={x}
                        y={chartHeight - 4}
                        textAnchor="middle"
                        fill="#9ca3af"
                        fontSize="8"
                        fontWeight="600"
                      >
                        {dateLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* ── TREND INDICATOR ─────────────────────────────────────────────── */}
      {tc ? (
        <div
          className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 ${tc.color}`}
        >
          <span className="mt-0.5 shrink-0">{tc.icon}</span>
          <div>
            <p className="text-xs font-bold">{tc.label}</p>
            <p className="text-[11px] font-medium mt-0.5 opacity-80">{progress.trendReason}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 px-3 py-2 bg-muted/30 text-xs text-muted-foreground font-medium flex items-center gap-2">
          <BarChart3 className="size-3.5 shrink-0" />
          <span>{progress.trendReason}</span>
        </div>
      )}

      {/* ── PHASE 3: PROGRESS INSIGHTS ─────────────────────────────────── */}
      {progress.insights && progress.insights.length > 0 && (
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Lightbulb className="size-4 text-amber-500" />
              <span>Progress Insights</span>
            </h4>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Deterministic Insights
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {progress.insights.map((ins, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-3 border text-xs space-y-1 ${
                  ins.severity === "positive"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                    : ins.severity === "attention"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
                    : "bg-muted/50 border-border/70 text-foreground"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>{ins.title}</span>
                  {ins.value && <span className="text-[10px] opacity-80">{ins.value}</span>}
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{ins.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
