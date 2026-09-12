"use client";

import { useState } from "react";
import type { AnalyticsData } from "@/app/actions";
import { Flame, ListChecks, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const typeNames: Record<string, string> = {
  checkbox: "Checklist",
  time: "Timed",
  number: "Number",
  input: "Input",
};

const colors = ["#4f83a5", "#6b987b", "#d58a36", "#ad5777"];

export function AnalyticsDashboard({ analytics }: { analytics: AnalyticsData }) {
  const [range, setRange] = useState<"week" | "month">("week");
  const rangeData = range === "week" ? analytics.lastSevenDays : analytics.lastThirtyDays;
  const chartWidth = 680;
  const chartHeight = 180;
  const chartPadding = { top: 12, right: 12, bottom: 30, left: 28 };
  const points = rangeData.map((item, index) => {
    const x = chartPadding.left + (index * (chartWidth - chartPadding.left - chartPadding.right)) / Math.max(rangeData.length - 1, 1);
    const y = chartPadding.top + ((100 - item.percentage) * (chartHeight - chartPadding.top - chartPadding.bottom)) / 100;
    return `${x},${y}`;
  });
  const maxDayCount = Math.max(...analytics.byDayOfWeek.map((item) => item.value), 1);
  const totalByType = analytics.byTaskType.reduce((total, item) => total + item.value, 0);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard icon={<TrendingUp className="size-4" />} label="Today" value={`${analytics.today.percentage}%`} detail={`${analytics.today.completed}/${analytics.today.total} done`} />
        <MetricCard icon={<Flame className="size-4" />} label="Best streak" value={`${analytics.bestStreak}d`} detail={analytics.bestStreak ? "Keep it going" : "Complete a task to start"} />
        <MetricCard icon={<ListChecks className="size-4" />} label="All-time" value={String(analytics.allTimeCompleted)} detail="tasks completed" />
      </section>

      <Card className="rounded-xl border border-border shadow-xs">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-bold">Last {range === "week" ? "7 days" : "30 days"}</h2><p className="mt-1 text-xs text-muted-foreground">Your daily completion rate</p></div><div className="flex rounded-lg border border-border bg-muted p-0.5 text-xs"><button onClick={() => setRange("week")} className={`rounded-md px-2.5 py-1.5 font-medium cursor-pointer ${range === "week" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>Week</button><button onClick={() => setRange("month")} className={`rounded-md px-2.5 py-1.5 font-medium cursor-pointer ${range === "month" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>Month</button></div></div>
          <div className="mt-4 h-52 w-full">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="size-full overflow-visible" role="img" aria-label="Seven day completion rate chart">
              {[0, 25, 50, 75, 100].map((value) => {
                const y = chartPadding.top + ((100 - value) * (chartHeight - chartPadding.top - chartPadding.bottom)) / 100;
                return <g key={value}><line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="#e4e4e7" /><text x="0" y={y + 4} fill="#a1a1aa" fontSize="11">{value}</text></g>;
              })}
              <polyline points={points.join(" ")} fill="none" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {rangeData.map((item, index) => {
                const [x, y] = points[index].split(",");
                const showLabel = range === "week" || index % 5 === 0 || index === rangeData.length - 1;
                return <g key={item.date}><circle cx={x} cy={y} r={range === "week" ? "4.5" : "2.5"} fill="#18181b"><title>{`${item.date}: ${item.percentage}% (${item.completed}/${item.total})`}</title></circle>{showLabel && <text x={x} y={chartHeight - 4} textAnchor="middle" fill="#a1a1aa" fontSize="11">{range === "week" ? item.label : item.label}</text>}</g>;
              })}
            </svg>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="rounded-xl border border-border shadow-xs">
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-sm font-bold">By task type</h2>
            <p className="mt-1 text-xs text-muted-foreground">Where your completed effort goes</p>
            {totalByType ? <div className="mt-7 flex items-center gap-6"><div className="size-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${analytics.byTaskType.map((item, index) => `${colors[index % colors.length]} ${(analytics.byTaskType.slice(0, index).reduce((sum, entry) => sum + entry.value, 0) / totalByType) * 100}% ${((analytics.byTaskType.slice(0, index + 1).reduce((sum, entry) => sum + entry.value, 0) / totalByType) * 100)}%`).join(", ")}` }}><div className="m-7 size-[72px] rounded-full bg-card" /></div><div className="space-y-2 text-xs">{analytics.byTaskType.map((item, index) => <div className="flex items-center gap-2" key={item.label}><span className="size-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{typeNames[item.label] ?? item.label}: {item.value}</div>)}</div></div> : <EmptyState />}
          </CardContent>
        </Card>
        <Card className="rounded-xl border border-border shadow-xs">
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-sm font-bold">By day of week</h2>
            <p className="mt-1 text-xs text-muted-foreground">When you&apos;re most active</p>
            <div className="mt-6 flex h-36 items-end justify-between gap-2 border-b border-border px-1">{analytics.byDayOfWeek.map((item) => <div className="flex h-full flex-1 flex-col justify-end" key={item.label}><div className="min-h-0 rounded-t-sm bg-[#4f83a5] transition-all" style={{ height: `${(item.value / maxDayCount) * 100}%` }} title={`${item.label}: ${item.value} completed`} /><span className="mt-2 text-center text-[10px] text-muted-foreground">{item.label}</span></div>)}</div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-xl border border-border shadow-xs"><CardContent className="p-5 sm:p-6"><h2 className="text-sm font-bold">Task streaks</h2><p className="mt-1 text-xs text-muted-foreground">Consecutive days completed, most consistent first</p>{analytics.taskStreaks.length ? <div className="mt-5 divide-y divide-border">{analytics.taskStreaks.map((item) => <div className="flex items-center justify-between py-3 text-sm" key={item.title}><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-[#4f83a5]" />{item.title}</span><span className="flex items-center gap-1 font-semibold"><Flame className="size-3.5 text-orange-500" />{item.streak}d</span></div>)}</div> : <EmptyState />}</CardContent></Card>
    </div>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <Card className="rounded-xl border border-border shadow-xs"><CardContent className="p-4"><div className="flex items-center gap-1.5 text-xs font-semibold">{icon}{label}</div><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function EmptyState() { return <p className="py-10 text-center text-xs text-muted-foreground">Complete tasks to see your activity here.</p>; }
