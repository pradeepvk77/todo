export const ON_TIME_TOLERANCE_MINUTES = 15; // Configurable business threshold for punctuality (minutes)

export function getISTHourFromTimestamp(timestampStr?: string | null): number | null {
  if (!timestampStr) return null;
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return null;
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(d);
    return parseInt(hourStr, 10) % 24;
  } catch {
    return null;
  }
}

export function getTimeOfDaySection(hour: number | null): "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | null {
  if (hour === null) return null;
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "AFTERNOON";
  if (hour >= 17 && hour < 21) return "EVENING";
  return "NIGHT"; // 21:00 - 04:59
}

export function parseScheduledTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || !timeStr.trim()) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function parseTimestampToISTMinutes(timestampStr?: string | null): number | null {
  if (!timestampStr) return null;
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

export function parseTargetValueAndUnit(typeValue?: string | null): { targetValue: number | null; unit: string } {
  if (!typeValue || !typeValue.trim()) {
    return { targetValue: null, unit: "" };
  }
  const str = typeValue.trim();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z%]*)$/);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2] ? match[2].toLowerCase() : "";
    return { targetValue: isNaN(val) ? null : val, unit };
  }
  return { targetValue: null, unit: "" };
}

/**
 * Calculates a basic directional trend from an ordered list of numeric values.
 *
 * Formula:
 *   Requires N >= 5 values (chronological order).
 *   earlyHalf  = average of first floor(N/2) values
 *   recentHalf = average of last  floor(N/2) values
 *   delta      = recentHalf - earlyHalf
 *   threshold  = max(earlyHalf * 0.05, 0.1)  — 5% relative or 0.1 absolute minimum
 *   if delta >  threshold  → "improving"
 *   if delta < -threshold  → "declining"
 *   else                   → "stable"
 *
 * Returns:
 *   trend: directional bucket
 *   reason: human-readable explanation of the comparison (shown in UI as sub-text)
 */
export function calculateProgressTrend(values: number[]): {
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  reason: string;
} {
  if (values.length < 5) {
    return {
      trend: "insufficient_data",
      reason: `Need at least 5 recorded values to calculate a trend. Currently have ${values.length}.`,
    };
  }

  const halfLen = Math.floor(values.length / 2);
  const earlySlice = values.slice(0, halfLen);
  const recentSlice = values.slice(values.length - halfLen);

  const earlyAvg = earlySlice.reduce((s, v) => s + v, 0) / earlySlice.length;
  const recentAvg = recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length;
  const delta = recentAvg - earlyAvg;

  // 5% relative threshold; fall back to 0.1 absolute if earlyAvg is near zero
  const threshold = earlyAvg > 0 ? earlyAvg * 0.05 : 0.1;

  const earlyStr = earlyAvg.toFixed(2);
  const recentStr = recentAvg.toFixed(2);

  if (delta > threshold) {
    return {
      trend: "improving",
      reason: `Recent avg (${recentStr}) is higher than earlier avg (${earlyStr}) across ${values.length} records.`,
    };
  } else if (delta < -threshold) {
    return {
      trend: "declining",
      reason: `Recent avg (${recentStr}) is lower than earlier avg (${earlyStr}) across ${values.length} records.`,
    };
  } else {
    return {
      trend: "stable",
      reason: `Recent avg (${recentStr}) is close to earlier avg (${earlyStr}) across ${values.length} records.`,
    };
  }
}

// ─── Phase 3: Progress Insights & Pattern Analysis Utilities ─────────────────

export interface TargetGapData {
  totalTargetSessions: number;
  metTargetSessions: number;
  belowTargetSessions: number;
  /** Percentage of valid target sessions where actual completed_value >= historical target_value */
  targetAchievementPercentage: number | null;
  summaryText: string;
}

export interface ProgressInsight {
  type: "performance" | "target" | "consistency" | "trend" | "focus";
  title: string;
  description: string;
  value?: string;
  severity?: "neutral" | "positive" | "attention";
}

export interface PeriodSummaryData {
  totalTasksDue: number;
  completedCount: number;
  completionRate: number;
  measurableTaskCount: number;
  improvingCount: number;
  decliningCount: number;
  stableCount: number;
  insufficientDataCount: number;
  summaryText: string;
}

/**
 * Calculates Target Gap observations using HISTORICAL target snapshots.
 * Excludes records where historical targetValue is NULL or <= 0.
 */
export function calculateTargetGap(
  history: { completedValue: number | null; targetValue: number | null }[]
): TargetGapData {
  const validRecords = history.filter(
    (h) => h.completedValue !== null && h.targetValue !== null && h.targetValue > 0
  );
  const totalTargetSessions = validRecords.length;

  if (totalTargetSessions === 0) {
    return {
      totalTargetSessions: 0,
      metTargetSessions: 0,
      belowTargetSessions: 0,
      targetAchievementPercentage: null,
      summaryText: "No historical target records available for comparison.",
    };
  }

  const metTargetSessions = validRecords.filter(
    (h) => (h.completedValue as number) >= (h.targetValue as number)
  ).length;
  const belowTargetSessions = totalTargetSessions - metTargetSessions;
  const targetAchievementPercentage =
    Math.round((metTargetSessions / totalTargetSessions) * 1000) / 10;

  let summaryText = "";
  if (metTargetSessions === totalTargetSessions) {
    summaryText = `All ${totalTargetSessions} recorded session${totalTargetSessions !== 1 ? "s" : ""} met or exceeded historical target.`;
  } else if (metTargetSessions === 0) {
    summaryText = `Recorded performance was below historical target on all ${totalTargetSessions} session${totalTargetSessions !== 1 ? "s" : ""}.`;
  } else {
    summaryText = `${metTargetSessions} of ${totalTargetSessions} recorded session${totalTargetSessions !== 1 ? "s" : ""} met or exceeded historical target.`;
  }

  return {
    totalTargetSessions,
    metTargetSessions,
    belowTargetSessions,
    targetAchievementPercentage,
    summaryText,
  };
}

/**
 * Generates deterministic task-level insights adhering to Data Sufficiency Rules.
 */
export function deriveTaskInsights(params: {
  taskTitle: string;
  isMeasurable: boolean;
  completionRate: number;
  completedCount: number;
  totalOccurrences: number;
  history: { date: string; completedValue: number | null; targetValue: number | null }[];
  startingValue: number | null;
  currentValue: number | null;
  averageValue: number | null;
  personalBest: number | null;
  unit: string;
  trend: "improving" | "declining" | "stable" | "insufficient_data";
  trendReason: string;
  targetGap: TargetGapData | null;
}): ProgressInsight[] {
  const insights: ProgressInsight[] = [];
  const {
    isMeasurable,
    completionRate,
    completedCount,
    totalOccurrences,
    history,
    startingValue,
    currentValue,
    averageValue,
    unit,
    trend,
    trendReason,
    targetGap,
  } = params;

  const displayUnit = unit ? unit : "units";

  // 1. Consistency vs Performance (always present if occurrences exist)
  if (totalOccurrences > 0) {
    if (isMeasurable && averageValue !== null) {
      insights.push({
        type: "consistency",
        title: "Consistency vs Performance",
        description: `Completion rate was ${completionRate}% across ${totalOccurrences} scheduled session${totalOccurrences !== 1 ? "s" : ""}, with an average recorded performance of ${averageValue} ${displayUnit} when completed.`,
        value: `${completionRate}% rate | ${averageValue} ${displayUnit} avg`,
        severity: completionRate >= 80 ? "positive" : completionRate >= 50 ? "neutral" : "attention",
      });
    } else {
      insights.push({
        type: "consistency",
        title: "Consistency",
        description: `Task was completed ${completedCount} of ${totalOccurrences} scheduled session${totalOccurrences !== 1 ? "s" : ""} (${completionRate}% completion rate).`,
        value: `${completionRate}% rate`,
        severity: completionRate >= 80 ? "positive" : completionRate >= 50 ? "neutral" : "attention",
      });
    }
  }

  if (!isMeasurable || history.length === 0) {
    insights.push({
      type: "performance",
      title: "Quantitative Performance",
      description: "No quantitative measurements recorded yet for this task.",
      severity: "neutral",
    });
    return insights;
  }

  // 2. Performance Insight
  if (startingValue !== null && currentValue !== null && averageValue !== null) {
    const diff = Math.round((currentValue - startingValue) * 100) / 100;
    const sign = diff > 0 ? "+" : "";
    const perfDesc = `Starting: ${startingValue} ${displayUnit} → Current: ${currentValue} ${displayUnit} (Average: ${averageValue} ${displayUnit} across ${history.length} recorded session${history.length !== 1 ? "s" : ""}).`;
    insights.push({
      type: "performance",
      title: "Performance Snapshot",
      description: perfDesc,
      value: history.length >= 2 ? `${sign}${diff} ${displayUnit}` : `${currentValue} ${displayUnit}`,
      severity: diff > 0 ? "positive" : diff < 0 ? "attention" : "neutral",
    });
  }

  // 3. Target Gap Insight
  if (targetGap && targetGap.totalTargetSessions > 0) {
    const metPct = targetGap.targetAchievementPercentage ?? 0;
    insights.push({
      type: "target",
      title: "Target Gap Analysis",
      description: targetGap.summaryText,
      value: `${targetGap.metTargetSessions}/${targetGap.totalTargetSessions} met (${metPct}%)`,
      severity: metPct >= 80 ? "positive" : metPct >= 50 ? "neutral" : "attention",
    });
  }

  // 4. Pattern / Trend Insight (Data Sufficiency Rules)
  if (history.length === 1) {
    insights.push({
      type: "trend",
      title: "Pattern Analysis",
      description: `1 quantitative record available (${history[0].completedValue} ${displayUnit}). Trend comparison requires at least 5 recorded sessions.`,
      severity: "neutral",
    });
  } else if (history.length >= 2 && history.length < 5) {
    insights.push({
      type: "trend",
      title: "Pattern Analysis",
      description: `Not enough recorded data to identify a reliable pattern. Currently have ${history.length} record${history.length !== 1 ? "s" : ""}; need at least 5.`,
      severity: "neutral",
    });
  } else if (history.length >= 5) {
    let title = "Recent vs Historical Pattern";
    let severity: "positive" | "attention" | "neutral" = "neutral";
    if (trend === "improving") {
      title = "Recent Performance is Higher";
      severity = "positive";
    } else if (trend === "declining") {
      title = "Recent Performance is Lower";
      severity = "attention";
    } else if (trend === "stable") {
      title = "Recent Performance is Stable";
      severity = "neutral";
    }
    insights.push({
      type: "trend",
      title,
      description: trendReason,
      severity,
    });
  }

  return insights;
}

/**
 * Generates deterministic period summary statistics and natural summary text for selected date range.
 */
export function generatePeriodSummary(params: {
  totalTasksDue: number;
  completedCount: number;
  measurableTasksStats: {
    totalMeasurable: number;
    improving: number;
    declining: number;
    stable: number;
    insufficientData: number;
  };
}): PeriodSummaryData {
  const { totalTasksDue, completedCount, measurableTasksStats } = params;
  const completionRate = totalTasksDue > 0 ? Math.round((completedCount / totalTasksDue) * 100) : 0;
  const { totalMeasurable, improving, declining, stable, insufficientData } = measurableTasksStats;

  let summaryText = `During this period, ${completedCount} of ${totalTasksDue} scheduled task occurrence${totalTasksDue !== 1 ? "s were" : " was"} completed (${completionRate}% completion rate).`;

  if (totalMeasurable > 0) {
    const parts: string[] = [];
    if (improving > 0) parts.push(`${improving} showing higher recent performance`);
    if (declining > 0) parts.push(`${declining} showing lower recent performance`);
    if (stable > 0) parts.push(`${stable} showing stable performance`);
    if (insufficientData > 0) parts.push(`${insufficientData} with insufficient quantitative data for trend analysis`);
    summaryText += ` ${totalMeasurable} measurable task${totalMeasurable !== 1 ? "s have" : " has"} recorded values (${parts.join(", ")}).`;
  } else {
    summaryText += ` No measurable tasks have recorded quantitative values during this period.`;
  }

  return {
    totalTasksDue,
    completedCount,
    completionRate,
    measurableTaskCount: totalMeasurable,
    improvingCount: improving,
    decliningCount: declining,
    stableCount: stable,
    insufficientDataCount: insufficientData,
    summaryText,
  };
}

/**
 * Generates deterministic focus area observations across tasks.
 */
export function generateFocusAreas(params: {
  taskSummaries: {
    taskId: number;
    taskTitle: string;
    completionRate: number;
    totalOccurrences: number;
    isMeasurable: boolean;
    historyCount: number;
    targetGap: TargetGapData | null;
    trend: "improving" | "declining" | "stable" | "insufficient_data";
    trendReason: string;
    averageValue: number | null;
    unit: string;
  }[];
}): ProgressInsight[] {
  const focusAreas: ProgressInsight[] = [];

  for (const t of params.taskSummaries) {
    // 1. High completion rate but insufficient quantitative measurements
    if (t.isMeasurable && t.completionRate >= 70 && t.historyCount < 5 && t.totalOccurrences >= 3) {
      focusAreas.push({
        type: "focus",
        title: t.taskTitle,
        description: `Has a high completion rate (${t.completionRate}%) across ${t.totalOccurrences} sessions, but only ${t.historyCount} quantitative measurement${t.historyCount !== 1 ? "s" : ""} recorded for performance analysis.`,
        value: `${t.completionRate}% completed | ${t.historyCount} values`,
        severity: "neutral",
      });
    }

    // 2. Below historical target on multiple sessions (only when totalTargetSessions >= 3)
    if (t.targetGap && t.targetGap.totalTargetSessions >= 3 && t.targetGap.belowTargetSessions > 0) {
      focusAreas.push({
        type: "focus",
        title: t.taskTitle,
        description: `Has ${t.targetGap.totalTargetSessions} recorded measurement${t.targetGap.totalTargetSessions !== 1 ? "s" : ""} but remained below historical target on ${t.targetGap.belowTargetSessions} session${t.targetGap.belowTargetSessions !== 1 ? "s" : ""}.`,
        value: `${t.targetGap.metTargetSessions}/${t.targetGap.totalTargetSessions} target met`,
        severity: "attention",
      });
    }

    // 3. Sufficient trend data showing notable pattern
    if (t.historyCount >= 5 && t.trend === "improving") {
      focusAreas.push({
        type: "focus",
        title: t.taskTitle,
        description: `Has ${t.historyCount} recorded sessions showing higher recent performance. ${t.trendReason}`,
        value: "Improving",
        severity: "positive",
      });
    } else if (t.historyCount >= 5 && t.trend === "declining") {
      focusAreas.push({
        type: "focus",
        title: t.taskTitle,
        description: `Has ${t.historyCount} recorded sessions showing lower recent performance. ${t.trendReason}`,
        value: "Declining",
        severity: "attention",
      });
    }
  }

  // Cap at 4 focus area observations max
  return focusAreas.slice(0, 4);
}

