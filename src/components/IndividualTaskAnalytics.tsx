"use client";

import { useState } from "react";
import { IndividualTaskAnalyticsData, TimeRange } from "@/app/actions/analytics";
import {
  ArrowLeft,
  Check,
  RotateCcw,
  X,
  Minus,
  TrendingUp,
  Flame,
  Crown,
  Clock,
  Pencil,
  MessageSquare,
  Lightbulb,
  Info,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface IndividualTaskAnalyticsProps {
  data: IndividualTaskAnalyticsData;
  onBack: () => void;
  onSelectTimeRange: (range: TimeRange) => void;
  isOtherUser?: boolean;
}

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "this_week", label: "7 Days" },
  { key: "last_90_days", label: "90 Days" },
  { key: "all_time", label: "All Time" },
];

export function IndividualTaskAnalytics({
  data,
  onBack,
  onSelectTimeRange,
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
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/70">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          <span>Back</span>
        </button>

        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">Task Analytics</h1>

        <div className="relative">
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
                  Default: {data.scheduledTime}
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
