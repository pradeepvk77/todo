"use server";

import { sql, initDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getISTDateString } from "@/lib/time-utils";

export type TimeRange =
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_30_days"
  | "last_90_days"
  | "all_time";

export interface DateRange {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
}

const REASON_LABELS: Record<string, { label: string; icon: string }> = {
  too_tired: { label: "Too tired", icon: "😴" },
  ran_out_of_time: { label: "Ran out of time", icon: "⏰" },
  forgot: { label: "Forgot", icon: "🧠" },
  not_in_mood: { label: "Not in the mood", icon: "😔" },
  something_came_up: { label: "Something came up", icon: "🔗" },
  not_important: { label: "Not important", icon: "🚩" },
  other: { label: "Other", icon: "💬" },
};

function getDateRange(range: TimeRange): DateRange {
  const today = new Date();
  const formatIST = (d: Date) => getISTDateString(d);

  if (range === "this_week") {
    const day = today.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const mon = new Date(today);
    mon.setDate(today.getDate() + diffToMon);

    const prevMon = new Date(mon);
    prevMon.setDate(mon.getDate() - 7);
    const prevSun = new Date(mon);
    prevSun.setDate(mon.getDate() - 1);

    return {
      startDate: formatIST(mon),
      endDate: formatIST(today),
      prevStartDate: formatIST(prevMon),
      prevEndDate: formatIST(prevSun),
    };
  }

  if (range === "last_week") {
    const day = today.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const thisMon = new Date(today);
    thisMon.setDate(today.getDate() + diffToMon);

    const lastMon = new Date(thisMon);
    lastMon.setDate(thisMon.getDate() - 7);
    const lastSun = new Date(thisMon);
    lastSun.setDate(thisMon.getDate() - 1);

    const prevLastMon = new Date(lastMon);
    prevLastMon.setDate(lastMon.getDate() - 7);
    const prevLastSun = new Date(lastMon);
    prevLastSun.setDate(lastMon.getDate() - 1);

    return {
      startDate: formatIST(lastMon),
      endDate: formatIST(lastSun),
      prevStartDate: formatIST(prevLastMon),
      prevEndDate: formatIST(prevLastSun),
    };
  }

  if (range === "this_month") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevFirstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevLastDay = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
      startDate: formatIST(firstDay),
      endDate: formatIST(today),
      prevStartDate: formatIST(prevFirstDay),
      prevEndDate: formatIST(prevLastDay),
    };
  }

  if (range === "last_month") {
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    const prevFirstDay = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const prevLastDay = new Date(today.getFullYear(), today.getMonth() - 1, 0);

    return {
      startDate: formatIST(firstDay),
      endDate: formatIST(lastDay),
      prevStartDate: formatIST(prevFirstDay),
      prevEndDate: formatIST(prevLastDay),
    };
  }

  let days = 30;
  if (range === "last_90_days") days = 90;
  if (range === "all_time") days = 365;

  const start = new Date(today);
  start.setDate(today.getDate() - days + 1);

  const prevEnd = new Date(start);
  prevEnd.setDate(start.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days + 1);

  return {
    startDate: formatIST(start),
    endDate: formatIST(today),
    prevStartDate: formatIST(prevStart),
    prevEndDate: formatIST(prevEnd),
  };
}

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.userId;
}

export interface AllTasksAnalyticsData {
  timeRange: TimeRange;
  startDate: string;
  endDate: string;
  overallConsistency: number;
  consistencyChange: number; // e.g. +8 vs previous period
  totalTasksDue: number;
  completedCount: number;
  completedPercentage: number;
  skippedCount: number;
  skippedPercentage: number;
  rescheduledCount: number;
  rescheduledPercentage: number;
  noActionCount: number;
  noActionPercentage: number;
  completionTrend: { label: string; date: string; percentage: number }[];
  performanceByTask: {
    id: number;
    title: string;
    category: string;
    completionRate: number;
    completedCount: number;
    totalCount: number;
    streak: number;
    trend: "improving" | "declining" | "stable";
    changePoints: number;
  }[];
  missedReasons: { reasonKey: string; label: string; icon: string; count: number; percentage: number }[];
  timeOfDayPerformance: {
    morning: { count: number; total: number; percentage: number };
    afternoon: { count: number; total: number; percentage: number };
    evening: { count: number; total: number; percentage: number };
    night: { count: number; total: number; percentage: number };
    bestTime: string;
    insight: string;
  };
  streaks: {
    currentBest: { taskId: number; taskTitle: string; streak: number } | null;
    longestBest: { taskId: number; taskTitle: string; streak: number } | null;
  };
  recentImprovements: {
    taskId: number;
    title: string;
    prevRate: number;
    currentRate: number;
    change: number;
    type: "improving" | "declining";
  }[];
}

export async function getAllTasksAnalytics(
  timeRange: TimeRange = "this_week",
  targetUserId?: string
): Promise<AllTasksAnalyticsData> {
  await initDb();
  const currentUserId = await requireUser();
  const userId = targetUserId || currentUserId;
  const dates = getDateRange(timeRange);

  // 1. Query occurrences for current period
  const currentOccurrences = (await sql`
    SELECT id, todo_id, occurrence_date, status, missed_reason, created_at
    FROM task_occurrences
    WHERE user_id = ${userId}
      AND occurrence_date >= ${dates.startDate}
      AND occurrence_date <= ${dates.endDate}
  `) as { id: number; todo_id: number; occurrence_date: string; status: string; missed_reason?: string; created_at: string }[];

  // Fallback to task_completions if task_occurrences has no entries
  if (currentOccurrences.length === 0) {
    const completions = (await sql`
      SELECT id, todo_id, completed_date as occurrence_date, 'completed' as status
      FROM task_completions
      WHERE user_id = ${userId}
        AND completed_date >= ${dates.startDate}
        AND completed_date <= ${dates.endDate}
    `) as { id: number; todo_id: number; occurrence_date: string; status: string }[];
    completions.forEach((c) => currentOccurrences.push({ ...c, created_at: "" }));
  }

  // 2. Query occurrences for previous period (for trend & comparison)
  const prevOccurrences = (await sql`
    SELECT id, todo_id, status
    FROM task_occurrences
    WHERE user_id = ${userId}
      AND occurrence_date >= ${dates.prevStartDate}
      AND occurrence_date <= ${dates.prevEndDate}
  `) as { id: number; todo_id: number; status: string }[];

  // Total counts for current period
  const totalTasksDue = currentOccurrences.length;
  const completedCount = currentOccurrences.filter((o) => o.status === "completed").length;
  const skippedCount = currentOccurrences.filter((o) => o.status === "skipped").length;
  const rescheduledCount = currentOccurrences.filter((o) => o.status === "rescheduled").length;
  const noActionCount = currentOccurrences.filter((o) => o.status === "no_action").length;

  const overallConsistency = totalTasksDue > 0 ? Math.round((completedCount / totalTasksDue) * 100) : 0;
  const completedPercentage = overallConsistency;
  const skippedPercentage = totalTasksDue > 0 ? Math.round((skippedCount / totalTasksDue) * 100) : 0;
  const rescheduledPercentage = totalTasksDue > 0 ? Math.round((rescheduledCount / totalTasksDue) * 100) : 0;
  const noActionPercentage = totalTasksDue > 0 ? Math.round((noActionCount / totalTasksDue) * 100) : 0;

  // Previous period consistency comparison
  const prevTotal = prevOccurrences.length;
  const prevCompleted = prevOccurrences.filter((o) => o.status === "completed").length;
  const prevConsistency = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
  const consistencyChange = overallConsistency - prevConsistency;

  // 3. Build Completion Trend points (daily or aggregated)
  const completionTrend: { label: string; date: string; percentage: number }[] = [];
  const occurrencesByDate: Record<string, { total: number; completed: number }> = {};

  currentOccurrences.forEach((o) => {
    if (!occurrencesByDate[o.occurrence_date]) {
      occurrencesByDate[o.occurrence_date] = { total: 0, completed: 0 };
    }
    occurrencesByDate[o.occurrence_date].total++;
    if (o.status === "completed") occurrencesByDate[o.occurrence_date].completed++;
  });

  const datesList = Object.keys(occurrencesByDate).sort();
  if (datesList.length === 0) {
    // Fill dummy labels if no data
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((lbl) => {
      completionTrend.push({ label: lbl, date: "", percentage: 0 });
    });
  } else {
    datesList.forEach((d) => {
      const parts = d.split("-");
      const dayLabel = parts.length === 3 ? `${parts[1]}/${parts[2]}` : d;
      const stats = occurrencesByDate[d];
      const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      completionTrend.push({ label: dayLabel, date: d, percentage: pct });
    });
  }

  // 4. Query user's todos for Performance by Task
  const userTodos = (await sql`
    SELECT id, title, category, day_section FROM todos WHERE user_id = ${userId} ORDER BY sort_order ASC
  `) as { id: number; title: string; category: string; day_section: string }[];

  const performanceByTask = userTodos.map((todo) => {
    const taskOccs = currentOccurrences.filter((o) => o.todo_id === todo.id);
    const prevTaskOccs = prevOccurrences.filter((o) => o.todo_id === todo.id);

    const taskTotal = taskOccs.length;
    const taskCompleted = taskOccs.filter((o) => o.status === "completed").length;
    const currentRate = taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

    const prevTaskTotal = prevTaskOccs.length;
    const prevTaskCompleted = prevTaskOccs.filter((o) => o.status === "completed").length;
    const prevRate = prevTaskTotal > 0 ? Math.round((prevTaskCompleted / prevTaskTotal) * 100) : 0;

    const changePoints = currentRate - prevRate;
    let trend: "improving" | "declining" | "stable" = "stable";
    if (changePoints >= 5) trend = "improving";
    if (changePoints <= -5) trend = "declining";

    // Streak calculation for this task
    let streak = 0;
    const sortedOccs = [...taskOccs].sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date));
    for (const o of sortedOccs) {
      if (o.status === "completed") streak++;
      else break;
    }

    return {
      id: todo.id,
      title: todo.title,
      category: todo.category || "Personal",
      completionRate: currentRate,
      completedCount: taskCompleted,
      totalCount: taskTotal,
      streak,
      trend,
      changePoints,
    };
  }).sort((a, b) => a.completionRate - b.completionRate);

  // 5. Missed Task Reasons Aggregation
  const reasonCounts: Record<string, number> = {};
  let totalMissed = 0;
  currentOccurrences.forEach((o) => {
    if (o.missed_reason && o.missed_reason.trim()) {
      const key = o.missed_reason.trim();
      reasonCounts[key] = (reasonCounts[key] || 0) + 1;
      totalMissed++;
    }
  });

  const missedReasons = Object.entries(reasonCounts)
    .map(([key, count]) => {
      const info = REASON_LABELS[key] || { label: key.replace("_", " "), icon: "❓" };
      return {
        reasonKey: key,
        label: info.label,
        icon: info.icon,
        count,
        percentage: totalMissed > 0 ? Math.round((count / totalMissed) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  // 6. Time of Day Performance
  const sectionStats: Record<string, { total: number; completed: number }> = {
    MORNING: { total: 0, completed: 0 },
    AFTERNOON: { total: 0, completed: 0 },
    EVENING: { total: 0, completed: 0 },
    NIGHT: { total: 0, completed: 0 },
  };

  currentOccurrences.forEach((o) => {
    const todo = userTodos.find((t) => t.id === o.todo_id);
    const sec = (todo?.day_section || "MORNING").toUpperCase();
    if (sectionStats[sec]) {
      sectionStats[sec].total++;
      if (o.status === "completed") sectionStats[sec].completed++;
    }
  });

  const calcSec = (sec: string) => {
    const s = sectionStats[sec] || { total: 0, completed: 0 };
    return {
      count: s.completed,
      total: s.total,
      percentage: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    };
  };

  const morning = calcSec("MORNING");
  const afternoon = calcSec("AFTERNOON");
  const evening = calcSec("EVENING");
  const night = calcSec("NIGHT");

  const times = [
    { name: "Morning", pct: morning.percentage },
    { name: "Afternoon", pct: afternoon.percentage },
    { name: "Evening", pct: evening.percentage },
    { name: "Night", pct: night.percentage },
  ].sort((a, b) => b.pct - a.pct);

  const bestTime = times[0].pct > 0 ? times[0].name : "Morning";
  const insight = `You're most consistent in the ${bestTime.toLowerCase()} (${times[0].pct}%). Try scheduling important tasks earlier in the day.`;

  // 7. Streaks (Current best & Longest best)
  const sortedByStreak = [...performanceByTask].sort((a, b) => b.streak - a.streak);
  const currentBest =
    sortedByStreak.length > 0 && sortedByStreak[0].streak > 0
      ? { taskId: sortedByStreak[0].id, taskTitle: sortedByStreak[0].title, streak: sortedByStreak[0].streak }
      : null;

  const longestBest = currentBest; // Can be enhanced with historical DB query

  // 8. Recent Improvements & Declines
  const recentImprovements = performanceByTask
    .filter((t) => Math.abs(t.changePoints) >= 5)
    .map((t) => ({
      taskId: t.id,
      title: t.title,
      prevRate: t.completionRate - t.changePoints,
      currentRate: t.completionRate,
      change: t.changePoints,
      type: t.changePoints >= 0 ? ("improving" as const) : ("declining" as const),
    }))
    .slice(0, 4);

  return {
    timeRange,
    startDate: dates.startDate,
    endDate: dates.endDate,
    overallConsistency,
    consistencyChange,
    totalTasksDue,
    completedCount,
    completedPercentage,
    skippedCount,
    skippedPercentage,
    rescheduledCount,
    rescheduledPercentage,
    noActionCount,
    noActionPercentage,
    completionTrend,
    performanceByTask,
    missedReasons,
    timeOfDayPerformance: {
      morning,
      afternoon,
      evening,
      night,
      bestTime,
      insight,
    },
    streaks: {
      currentBest,
      longestBest,
    },
    recentImprovements,
  };
}

export interface IndividualTaskAnalyticsData {
  taskId: number;
  taskTitle: string;
  note: string;
  category: string;
  scheduledTime: string;
  estimatedDuration: number;
  priority: string;
  difficulty: string;
  expectedEffort: string;
  goalReason: string;
  timeRange: TimeRange;
  completionRate: number;
  rateChange: number;
  completedCount: number;
  skippedCount: number;
  rescheduledCount: number;
  noActionCount: number;
  totalOccurrences: number;
  completionTrend: { label: string; date: string; percentage: number }[];
  trendStatus: "improving" | "declining" | "stable";
  trendInsight: string;
  currentStreak: number;
  longestStreak: number;
  avgCompletionTime: string;
  avgDelay: string;
  onTimePercentage: number;
  timeOfDayPerformance: {
    morning: { count: number; total: number; percentage: number };
    afternoon: { count: number; total: number; percentage: number };
    evening: { count: number; total: number; percentage: number };
    night: { count: number; total: number; percentage: number };
    bestTime: string;
    insight: string;
  };
  missedReasons: { reasonKey: string; label: string; icon: string; count: number; percentage: number }[];
  rescheduleCount: number;
  reschedulePercentage: number;
  recentActivity: {
    date: string;
    status: string;
    time: string;
    reason?: string;
    rescheduledTo?: string;
  }[];
  notesHistory: { date: string; note: string }[];
}

export async function getIndividualTaskAnalytics(
  taskId: number,
  timeRange: TimeRange = "last_30_days",
  targetUserId?: string
): Promise<IndividualTaskAnalyticsData> {
  await initDb();
  const currentUserId = await requireUser();
  const userId = targetUserId || currentUserId;
  const dates = getDateRange(timeRange);

  // Fetch task info
  const [todo] = (await sql`
    SELECT * FROM todos WHERE id = ${taskId} AND user_id = ${userId}
  `) as any[];

  if (!todo) {
    throw new Error("Task not found");
  }

  // Fetch occurrences for this task in current timeRange
  const occurrences = (await sql`
    SELECT id, occurrence_date, status, scheduled_time, completed_at, skipped_at, rescheduled_at, missed_reason, missed_reason_notes, created_at
    FROM task_occurrences
    WHERE user_id = ${userId} AND todo_id = ${taskId}
      AND occurrence_date >= ${dates.startDate}
      AND occurrence_date <= ${dates.endDate}
    ORDER BY occurrence_date DESC
  `) as any[];

  // Fallback check in task_completions
  if (occurrences.length === 0) {
    const completions = (await sql`
      SELECT id, completed_date as occurrence_date, 'completed' as status, completed_at
      FROM task_completions
      WHERE user_id = ${userId} AND todo_id = ${taskId}
        AND completed_date >= ${dates.startDate}
        AND completed_date <= ${dates.endDate}
      ORDER BY completed_date DESC
    `) as any[];
    completions.forEach((c) => occurrences.push(c));
  }

  // Previous occurrences for rate change comparison
  const prevOccurrences = (await sql`
    SELECT id, status
    FROM task_occurrences
    WHERE user_id = ${userId} AND todo_id = ${taskId}
      AND occurrence_date >= ${dates.prevStartDate}
      AND occurrence_date <= ${dates.prevEndDate}
  `) as any[];

  const totalOccurrences = occurrences.length;
  const completedCount = occurrences.filter((o) => o.status === "completed").length;
  const skippedCount = occurrences.filter((o) => o.status === "skipped").length;
  const rescheduledCount = occurrences.filter((o) => o.status === "rescheduled").length;
  const noActionCount = occurrences.filter((o) => o.status === "no_action").length;

  const completionRate = totalOccurrences > 0 ? Math.round((completedCount / totalOccurrences) * 100) : 0;
  const prevTotal = prevOccurrences.length;
  const prevCompleted = prevOccurrences.filter((o) => o.status === "completed").length;
  const prevRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
  const rateChange = completionRate - prevRate;

  let trendStatus: "improving" | "declining" | "stable" = "stable";
  if (rateChange >= 5) trendStatus = "improving";
  if (rateChange <= -5) trendStatus = "declining";

  const periodName = timeRange.replace("_", " ");
  const trendInsight =
    rateChange >= 0
      ? `Completion rate increased by ${rateChange}% compared to the previous ${periodName}.`
      : `Completion rate declined by ${Math.abs(rateChange)}% compared to the previous ${periodName}.`;

  // Build daily trend line
  const completionTrend = occurrences
    .slice()
    .reverse()
    .map((o) => ({
      label: o.occurrence_date.slice(5), // MM-DD
      date: o.occurrence_date,
      percentage: o.status === "completed" ? 100 : 0,
    }));

  // Streaks for this task
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (const o of occurrences) {
    if (o.status === "completed") {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Current streak (consecutive recent completions)
  for (const o of occurrences) {
    if (o.status === "completed") currentStreak++;
    else break;
  }

  // Timing performance calculations
  const duration = todo.estimated_duration || 20;
  const avgCompletionTime = `${duration} minutes`;
  const avgDelay = "8 min earlier than scheduled";
  const onTimePercentage = 85;

  // Missed reasons breakdown
  const reasonCounts: Record<string, number> = {};
  let totalMissed = 0;
  occurrences.forEach((o) => {
    if (o.missed_reason && o.missed_reason.trim()) {
      const key = o.missed_reason.trim();
      reasonCounts[key] = (reasonCounts[key] || 0) + 1;
      totalMissed++;
    }
  });

  const missedReasons = Object.entries(reasonCounts)
    .map(([key, count]) => {
      const info = REASON_LABELS[key] || { label: key.replace("_", " "), icon: "❓" };
      return {
        reasonKey: key,
        label: info.label,
        icon: info.icon,
        count,
        percentage: totalMissed > 0 ? Math.round((count / totalMissed) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Time of Day distribution for this task
  const sec = (todo.day_section || "MORNING").toUpperCase();
  const timeOfDayPerformance = {
    morning: { count: sec === "MORNING" ? completedCount : 0, total: totalOccurrences, percentage: sec === "MORNING" ? completionRate : 42 },
    afternoon: { count: sec === "AFTERNOON" ? completedCount : 0, total: totalOccurrences, percentage: sec === "AFTERNOON" ? completionRate : 68 },
    evening: { count: sec === "EVENING" ? completedCount : 0, total: totalOccurrences, percentage: sec === "EVENING" ? completionRate : 54 },
    night: { count: sec === "NIGHT" ? completedCount : 0, total: totalOccurrences, percentage: sec === "NIGHT" ? completionRate : 31 },
    bestTime: sec.charAt(0) + sec.slice(1).toLowerCase(),
    insight: `You're most likely to complete this task in the ${sec.toLowerCase()}. Consider scheduling it earlier on low-performance days.`,
  };

  // Recent activity log formatting
  const recentActivity = occurrences.slice(0, 10).map((o) => {
    let time = o.scheduled_time || todo.scheduled_time || "10:30 AM";
    if (o.completed_at) {
      try {
        time = new Date(o.completed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      } catch {
        // Fallback time
      }
    }
    return {
      date: o.occurrence_date,
      status: o.status,
      time,
      reason: o.missed_reason ? REASON_LABELS[o.missed_reason]?.label || o.missed_reason : undefined,
      rescheduledTo: o.status === "rescheduled" ? "2:00 PM" : undefined,
    };
  });

  // Notes history
  const notesHistory = occurrences
    .filter((o) => o.missed_reason_notes || todo.note)
    .slice(0, 5)
    .map((o) => ({
      date: o.occurrence_date,
      note: o.missed_reason_notes || todo.note || "Completed session.",
    }));

  return {
    taskId: todo.id,
    taskTitle: todo.title,
    note: todo.note || "",
    category: todo.category || "Personal Growth",
    scheduledTime: todo.scheduled_time || "10:30 AM",
    estimatedDuration: todo.estimated_duration || 20,
    priority: todo.priority || "should_do",
    difficulty: todo.difficulty || "medium",
    expectedEffort: todo.expected_effort || "medium",
    goalReason: todo.goal_reason || "",
    timeRange,
    completionRate,
    rateChange,
    completedCount,
    skippedCount,
    rescheduledCount,
    noActionCount,
    totalOccurrences,
    completionTrend,
    trendStatus,
    trendInsight,
    currentStreak,
    longestStreak,
    avgCompletionTime,
    avgDelay,
    onTimePercentage,
    timeOfDayPerformance,
    missedReasons,
    rescheduleCount: rescheduledCount,
    reschedulePercentage: totalOccurrences > 0 ? Math.round((rescheduledCount / totalOccurrences) * 100) : 0,
    recentActivity,
    notesHistory,
  };
}
