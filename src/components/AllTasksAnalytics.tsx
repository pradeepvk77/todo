"use client";

import { useState } from "react";
import { AllTasksAnalyticsData, TimeRange } from "@/app/actions/analytics";
import {
  Check,
  RotateCcw,
  Minus,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Flame,
  Crown,
  ChevronRight,
  Quote,
  Lightbulb,
  Calendar,
  X,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DayOffModal } from "@/components/DayOffModal";

interface AllTasksAnalyticsProps {
  initialData: AllTasksAnalyticsData;
  onSelectTimeRange: (range: TimeRange) => void;
  onSelectTask: (taskId: number) => void;
  isOtherUser?: boolean;
  otherUserName?: string;
}

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "all_time", label: "All Time" },
];

export function AllTasksAnalytics({
  initialData,
  onSelectTimeRange,
  onSelectTask,
  isOtherUser = false,
  otherUserName = "User",
}: AllTasksAnalyticsProps) {
  const router = useRouter();
  const [selectedRange, setSelectedRange] = useState<TimeRange>(initialData.timeRange);
  const [isDayOffOpen, setIsDayOffOpen] = useState(false);
  const data = initialData;

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    onSelectTimeRange(range);
  };

  // SVG Line/Area Chart calculations
  const chartWidth = 500;
  const chartHeight = 150;
  const padding = { top: 15, right: 15, bottom: 25, left: 30 };
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
      <DayOffModal
        isOpen={isDayOffOpen}
        onClose={() => setIsDayOffOpen(false)}
        onUpdate={() => onSelectTimeRange(selectedRange)}
      />

      {/* SECTION 1: HEADER & TIME RANGE SELECTOR */}
      <div className="flex justify-between items-center gap-3 pb-3 border-b border-border/70">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            {isOtherUser ? `${otherUserName}'s Insights` : "Insights"}
          </h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5 hidden sm:block">
            Understand your progress and build a better you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isOtherUser && (
            <button
              onClick={() => setIsDayOffOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer px-3 py-1.5 rounded-xl border border-amber-500/30 shadow-2xs"
            >
              <span>🏖️</span>
              <span>Manage Days Off</span>
            </button>
          )}
          <Link href="/">
            <button className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-2.5 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted shadow-2xs">
              <ArrowLeft className="size-4" />
              <span>Back</span>
            </button>
          </Link>
        </div>
      </div>

      {/* TIME RANGE PILL TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
        {TIME_RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => handleRangeChange(r.key)}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              selectedRange === r.key
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* SECTION 2: OVERALL PERFORMANCE SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {/* CARD 1: OVERALL CONSISTENCY */}
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
                  strokeDasharray={`${data.overallConsistency}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-black text-foreground">{data.overallConsistency}%</span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center text-center">
            <h4 className="text-xs font-bold text-foreground">Overall Consistency</h4>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-0.5 mt-0.5">
              <TrendingUp className="size-3" />
              <span>{data.consistencyChange >= 0 ? `+${data.consistencyChange}%` : `${data.consistencyChange}%`}</span>
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
            <span className="text-[10px] text-muted-foreground block font-medium">
              of {data.totalTasksDue} tasks
            </span>
          </div>
        </div>

        {/* CARD 3: SKIPPED */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
          <div className="size-7 rounded-xl bg-muted text-muted-foreground flex items-center justify-center border border-border">
            <X className="size-4 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-foreground block leading-none">
              {data.skippedCount}
            </span>
            <span className="text-xs font-bold text-foreground block mt-1">Skipped</span>
            <span className="text-[10px] text-muted-foreground block font-medium">
              {data.skippedPercentage}%
            </span>
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
            <span className="text-[10px] text-muted-foreground block font-medium">
              {data.rescheduledPercentage}%
            </span>
          </div>
        </div>

        {/* CARD 5: NO ACTION */}
        <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2 shadow-2xs">
          <div className="size-7 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center border border-rose-500/25">
            <Minus className="size-4 stroke-[3]" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-foreground block leading-none">
              {data.noActionCount}
            </span>
            <span className="text-xs font-bold text-foreground block mt-1">No Action</span>
            <span className="text-[10px] text-muted-foreground block font-medium">
              {data.noActionPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: MOTIVATIONAL QUOTE STRIP */}
      <div className="rounded-2xl border border-emerald-200/50 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-emerald-100/40 dark:from-emerald-950/30 dark:to-teal-950/20 p-4 shadow-2xs flex items-center gap-3">
        <span className="text-xl font-serif text-emerald-700 dark:text-emerald-400 shrink-0">“</span>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold italic text-foreground">
            &ldquo;Small progress each day adds up to big results.&rdquo;
          </p>
          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
            Keep going, you&apos;re doing great!
          </p>
        </div>
      </div>

      {/* SECTION 4: COMPLETION TREND & TASK BREAKDOWN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* COMPLETION TREND CHART */}
        <div className="lg:col-span-2 rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <div>
              <h3 className="font-bold text-foreground text-sm">Completion Trend</h3>
              <span className="text-muted-foreground font-medium">
                {data.overallConsistency}% this period{" "}
                <span className="text-emerald-600 font-bold">
                  {data.consistencyChange >= 0 ? `↑ ${data.consistencyChange}%` : `↓ ${data.consistencyChange}%`}
                </span>
              </span>
            </div>
          </div>

          <div className="h-44 w-full pt-2">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="size-full overflow-visible">
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
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
              {areaPoints && <polygon points={areaPoints} fill="url(#trendGradient)" />}

              {/* Polyline */}
              {points.length > 0 && (
                <polyline points={points.join(" ")} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}

              {/* Data Node Circles */}
              {trendPoints.map((item, idx) => {
                if (!points[idx]) return null;
                const [x, y] = points[idx].split(",");
                const isDayOff = (item as any).isDayOff;
                return (
                  <g key={idx}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isDayOff ? "5" : "4"}
                      fill={isDayOff ? "#f59e0b" : "#10b981"}
                      stroke="#ffffff"
                      strokeWidth="2"
                    >
                      <title>{isDayOff ? `${item.label}: Day Off 🏖️` : `${item.label}: ${item.percentage}%`}</title>
                    </circle>
                    <text x={x} y={chartHeight - 4} textAnchor="middle" fill="#9ca3af" fontSize="9" fontWeight="600">
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* TASK BREAKDOWN DONUT CHART */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs flex flex-col justify-between">
          <h3 className="font-bold text-foreground text-sm">Task Breakdown</h3>

          <div className="flex items-center justify-center my-2 relative">
            <div className="size-32 rounded-full flex items-center justify-center relative shadow-inner" style={{
              background: `conic-gradient(#10b981 0% ${data.completedPercentage}%, #9ca3af ${data.completedPercentage}% ${data.completedPercentage + data.skippedPercentage}%, #3b82f6 ${data.completedPercentage + data.skippedPercentage}% ${data.completedPercentage + data.skippedPercentage + data.rescheduledPercentage}%, #f43f5e ${data.completedPercentage + data.skippedPercentage + data.rescheduledPercentage}% 100%)`
            }}>
              <div className="size-20 rounded-full bg-card flex flex-col items-center justify-center shadow-xs">
                <span className="text-lg font-black text-foreground leading-none">{data.totalTasksDue}</span>
                <span className="text-[10px] font-bold text-muted-foreground">Tasks</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-xs font-semibold pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                <span>Completed</span>
              </span>
              <span className="text-foreground">{data.completedCount} ({data.completedPercentage}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-gray-400" />
                <span>Skipped</span>
              </span>
              <span className="text-foreground">{data.skippedCount} ({data.skippedPercentage}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-blue-500" />
                <span>Rescheduled</span>
              </span>
              <span className="text-foreground">{data.rescheduledCount} ({data.rescheduledPercentage}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-500" />
                <span>No Action</span>
              </span>
              <span className="text-foreground">{data.noActionCount} ({data.noActionPercentage}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: PERFORMANCE BY TASK */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-base tracking-tight">Performance by Task</h3>
          <span className="text-xs text-muted-foreground font-semibold">
            {data.performanceByTask.length} tasks
          </span>
        </div>

        {data.performanceByTask.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground italic">
            Complete a few tasks to see your task performance here.
          </p>
        ) : (
          <div className="space-y-2.5 divide-y divide-border/50">
            {data.performanceByTask.map((task) => {
              const rateColor =
                task.completionRate >= 75
                  ? "bg-emerald-500"
                  : task.completionRate >= 50
                  ? "bg-amber-500"
                  : "bg-rose-500";

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group cursor-pointer hover:bg-muted/40 p-2 rounded-xl transition-all"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="text-sm font-bold text-foreground truncate group-hover:text-emerald-600 transition-colors">
                      {task.title}
                    </h4>

                    <div className="flex items-center gap-2.5 w-full">
                      <span className="text-xs font-black text-foreground min-w-[36px]">
                        {task.completionRate}%
                      </span>
                      <div className="w-52 bg-muted rounded-full h-2 overflow-hidden border border-border/40 shrink-0">
                        <div
                          className={`h-full rounded-full transition-all ${rateColor}`}
                          style={{ width: `${task.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 flex justify-end">
                      {task.streak > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap">
                          <Flame className="size-3 text-amber-500 fill-amber-500" />
                          <span>{task.streak}d</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground/30 px-2 py-0.5 whitespace-nowrap">
                          <Flame className="size-3 text-muted-foreground/20" />
                          <span>0d</span>
                        </span>
                      )}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 6: MISSED TASK REASONS & BEST PERFORMING TIMES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* WHY TASKS ARE MISSED */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <h3 className="font-bold text-foreground text-sm">Why Tasks Are Missed</h3>

          {data.missedReasons.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground italic">
              Review missed tasks to discover your patterns.
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
                      className="bg-rose-500/80 h-full rounded-full transition-all"
                      style={{ width: `${reason.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BEST PERFORMING TIMES */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-foreground text-sm mb-3">Best Performing Times</h3>

            <div className="flex items-end justify-between gap-3 pt-2 border-b border-border pb-2 px-2">
              {[
                { label: "Morning", data: data.timeOfDayPerformance.morning },
                { label: "Afternoon", data: data.timeOfDayPerformance.afternoon },
                { label: "Evening", data: data.timeOfDayPerformance.evening },
                { label: "Night", data: data.timeOfDayPerformance.night },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{item.data.percentage}%</span>
                  <div className="w-full max-w-[28px] h-20 bg-muted/60 rounded-t-lg relative flex items-end overflow-hidden border border-border/40">
                    <div
                      className="w-full rounded-t-lg bg-emerald-500 transition-all duration-500"
                      style={{ height: `${Math.max(item.data.percentage, 5)}%` }}
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

      {/* SECTION 7: STREAKS & RECENT IMPROVEMENTS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* STREAKS */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <h3 className="font-bold text-foreground text-sm">Streaks</h3>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Flame className="size-4" />
                <span className="text-lg font-black">{data.streaks.currentBest?.streak || 0} days</span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground block truncate">
                Current streak ({data.streaks.currentBest?.taskTitle || "No streak"})
              </span>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-600">
                <Crown className="size-4" />
                <span className="text-lg font-black">{data.streaks.longestBest?.streak || 0} days</span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground block truncate">
                Longest streak ({data.streaks.longestBest?.taskTitle || "No streak"})
              </span>
            </div>
          </div>
        </div>

        {/* RECENT IMPROVEMENTS */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
          <h3 className="font-bold text-foreground text-sm">Recent Improvements</h3>

          {data.recentImprovements.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground italic">
              Neutral performance across periods. Keep completing tasks to see rate changes.
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentImprovements.map((item) => {
                const isImp = item.type === "improving";
                return (
                  <div
                    key={item.taskId}
                    onClick={() => onSelectTask(item.taskId)}
                    className="flex items-center justify-between p-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-7 rounded-lg flex items-center justify-center ${
                          isImp ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
                        }`}
                      >
                        {isImp ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {item.prevRate}% → {item.currentRate}%
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-full ${
                        isImp ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"
                      }`}
                    >
                      {isImp ? `↑ +${item.change}%` : `↓ ${item.change}%`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
