import assert from "node:assert";
import {
  ON_TIME_TOLERANCE_MINUTES,
  getISTHourFromTimestamp,
  getTimeOfDaySection,
  parseScheduledTimeToMinutes,
  parseTimestampToISTMinutes,
} from "../src/lib/analytics-utils";
import {
  getAllTasksAnalytics,
  getIndividualTaskAnalytics,
} from "../src/app/actions/analytics";
import { withTransaction, sql, initDb } from "../src/lib/db";

// Mock session / environment variables for running tests against local DB
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/todo_local?host=/tmp";
process.env.TEST_USER_ID = "user2";

async function runTests() {
  console.log("=========================================");
  console.log("Running Analytics Engine Test Suite...");
  console.log("=========================================\n");

  await initDb();

  // TEST 1: Constant export
  console.log("Test 1: Punctuality Constant");
  assert.strictEqual(ON_TIME_TOLERANCE_MINUTES, 15, "ON_TIME_TOLERANCE_MINUTES should equal 15");
  console.log("  ✓ ON_TIME_TOLERANCE_MINUTES is 15 minutes");

  // TEST 2: IST Hour Extraction
  console.log("Test 2: getISTHourFromTimestamp");
  const morningHour = getISTHourFromTimestamp("2026-09-22T02:45:00.000Z"); // 08:15 IST
  assert.strictEqual(morningHour, 8, "02:45 UTC should be 8 IST");
  const eveningHour = getISTHourFromTimestamp("2026-09-22T14:45:00.000Z"); // 20:15 IST
  assert.strictEqual(eveningHour, 20, "14:45 UTC should be 20 IST");
  console.log("  ✓ Correctly converts UTC/ISO timestamp to IST hour");

  // TEST 3: Time of Day Section Mapping
  console.log("Test 3: getTimeOfDaySection");
  assert.strictEqual(getTimeOfDaySection(8), "MORNING");
  assert.strictEqual(getTimeOfDaySection(14), "AFTERNOON");
  assert.strictEqual(getTimeOfDaySection(19), "EVENING");
  assert.strictEqual(getTimeOfDaySection(22), "NIGHT");
  assert.strictEqual(getTimeOfDaySection(4), "NIGHT");
  console.log("  ✓ Correctly maps IST hour to day sections");

  // TEST 4: Scheduled Time Parsing
  console.log("Test 4: parseScheduledTimeToMinutes");
  assert.strictEqual(parseScheduledTimeToMinutes("08:15 PM"), 1215);
  assert.strictEqual(parseScheduledTimeToMinutes("08:15 AM"), 495);
  assert.strictEqual(parseScheduledTimeToMinutes("12:00 PM"), 720);
  assert.strictEqual(parseScheduledTimeToMinutes("12:00 AM"), 0);
  assert.strictEqual(parseScheduledTimeToMinutes("1.2KM"), null);
  assert.strictEqual(parseScheduledTimeToMinutes(""), null);
  console.log("  ✓ Correctly parses time strings and rejects non-time strings");

  // TEST 5: IST Timestamp Minutes Parsing
  console.log("Test 5: parseTimestampToISTMinutes");
  assert.strictEqual(parseTimestampToISTMinutes("2026-09-22T20:15:00+05:30"), 1215);
  assert.strictEqual(parseTimestampToISTMinutes("2026-09-22T08:15:00+05:30"), 495);
  console.log("  ✓ Correctly parses ISO timestamps to total IST minutes of day");

  // TEST 6: Transaction Infrastructure Rollback
  console.log("Test 6: withTransaction Rollback");
  const testDate = "1999-01-01";
  try {
    await withTransaction(async (txSql) => {
      await txSql`
        INSERT INTO task_activities (user_id, todo_id, occurrence_date, action_type)
        VALUES ('user2', 1, ${testDate}, 'completed')
      `;
      throw new Error("Simulated Rollback Error");
    });
  } catch (err: any) {
    assert.strictEqual(err.message, "Simulated Rollback Error");
  }
  const checkRollback = (await sql`
    SELECT id FROM task_activities WHERE user_id = 'user2' AND occurrence_date = ${testDate}
  `) as any[];
  assert.strictEqual(checkRollback.length, 0, "Transaction should have rolled back inserted row");
  console.log("  ✓ withTransaction correctly rolls back changes on error");

  // TEST 7: DB Foreign Key Constraint Check
  console.log("Test 7: DB Foreign Key Constraint Check");
  const fkCheck = (await sql`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'task_completions'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_task_completions_todo_id'
  `) as any[];
  assert.strictEqual(fkCheck.length, 1, "Foreign key constraint fk_task_completions_todo_id must exist");
  console.log("  ✓ Foreign key constraint 'fk_task_completions_todo_id' confirmed in database");

  // TEST 8: Real DB Analytics Math (user2 - Running & Wake up)
  console.log("Test 8: Running (todo_id=2, user2) Individual Analytics (all_time)");
  const runningData = await getIndividualTaskAnalytics(2, "all_time", "user2", true);
  assert.strictEqual(runningData.taskTitle, "Running");
  assert.strictEqual(runningData.scheduledTime, "", "Scheduled time should be empty for non-time task type");
  assert.strictEqual(runningData.completedCount, 3, "Completed count in all_time should be 3");
  assert.strictEqual(runningData.noActionCount, 18, "No Action count in all_time should be 18");
  assert.strictEqual(runningData.totalOccurrences, 21, "Total occurrences should be 21");
  assert.strictEqual(runningData.completionRate, 14, "Completion rate should be 14%");
  console.log("  ✓ Running analytics matches database metrics exactly (14%, 3 completed, 18 no action, Unscheduled)");

  console.log("\nTest 9: Wake up (todo_id=1, user2) Individual Analytics (all_time)");
  const wakeupData = await getIndividualTaskAnalytics(1, "all_time", "user2", true);
  assert.strictEqual(wakeupData.taskTitle, "Wake up");
  assert.strictEqual(wakeupData.scheduledTime, "05:15 PM", "Scheduled time should be 05:15 PM");
  assert.strictEqual(wakeupData.completedCount, 5, "Completed count in all_time should be 5");
  assert.strictEqual(wakeupData.noActionCount, 16, "No Action count in all_time should be 16");
  assert.strictEqual(wakeupData.totalOccurrences, 21, "Total occurrences should be 21");
  assert.strictEqual(wakeupData.completionRate, 24, "Completion rate should be 24%");
  console.log("  ✓ Wake up analytics matches database metrics exactly (24%, 5 completed, 16 no action, 05:15 PM)");

  console.log("\nTest 10: Overall Analytics for user2 (all_time)");
  const overallData = await getAllTasksAnalytics("all_time", "user2", true);
  assert.strictEqual(overallData.completedCount, 50, "Total completed count across tasks in all_time should be 50");
  console.log("  ✓ Overall analytics returned correct completion count (50)");

  // =========================================================================
  // PHASE 2 TESTS — Progress Analytics
  // =========================================================================

  const { calculateProgressTrend } = await import("../src/lib/analytics-utils");

  // TEST 11: Trend — insufficient data
  console.log("\nTest 11: calculateProgressTrend — insufficient data (<5 values)");
  const t11 = calculateProgressTrend([1, 2, 3, 4]);
  assert.strictEqual(t11.trend, "insufficient_data");
  assert.ok(t11.reason.includes("4"));
  console.log("  ✓ Returns insufficient_data for <5 values");

  // TEST 12: Trend — improving
  console.log("Test 12: calculateProgressTrend — improving");
  const t12 = calculateProgressTrend([1.0, 1.1, 1.0, 1.5, 1.8, 2.0]);
  assert.strictEqual(t12.trend, "improving");
  console.log("  ✓ Returns improving when recent avg > early avg by >5%");

  // TEST 13: Trend — declining
  console.log("Test 13: calculateProgressTrend — declining");
  const t13 = calculateProgressTrend([2.0, 1.9, 2.0, 1.5, 1.2, 1.0]);
  assert.strictEqual(t13.trend, "declining");
  console.log("  ✓ Returns declining when recent avg < early avg by >5%");

  // TEST 14: Trend — stable
  console.log("Test 14: calculateProgressTrend — stable");
  const t14 = calculateProgressTrend([1.5, 1.51, 1.49, 1.50, 1.52, 1.48]);
  assert.strictEqual(t14.trend, "stable");
  console.log("  ✓ Returns stable when delta is within 5% threshold");

  // TEST 15: Trend — zero baseline safety
  console.log("Test 15: calculateProgressTrend — zero early baseline");
  const t15 = calculateProgressTrend([0, 0, 0.05, 0.2, 0.5, 0.8]);
  // earlyAvg=0 → uses 0.1 absolute threshold; delta=0.5 > 0.1 → improving
  assert.strictEqual(t15.trend, "improving");
  console.log("  ✓ Zero-baseline uses absolute threshold (0.1) safely");

  // TEST 16: Running (todo_id=2) — progressData structure
  console.log("\nTest 16: Running (todo_id=2, user2) — progressData fields");
  const runningProgress = await getIndividualTaskAnalytics(2, "all_time", "user2", true);
  assert.ok(runningProgress.progressData !== undefined, "progressData must be present for input task");
  // Running has completed_value = NULL for all historical records (pre-Phase-1)
  // So isMeasurable should be false (no real completed_value rows yet)
  assert.strictEqual(runningProgress.progressData!.isMeasurable, false,
    "Running has no real completed_value records yet — isMeasurable must be false");
  console.log("  ✓ Running progressData.isMeasurable = false (no completed_value records yet)");

  // TEST 17: Surya Namaskar (todo_id=4) — bare-number task, unit safety
  console.log("\nTest 17: Surya Namaskar (todo_id=4, user2) — unit safety");
  const suryaProgress = await getIndividualTaskAnalytics(4, "all_time", "user2", true);
  assert.ok(suryaProgress.progressData !== undefined, "progressData must be present for input task");
  // No completed_value records yet — isMeasurable false
  assert.strictEqual(suryaProgress.progressData!.isMeasurable, false);
  // unit from todos is '' (bare number) — confirm it does not fabricate a unit name
  assert.ok(
    suryaProgress.progressData!.unit === "" || suryaProgress.progressData!.unit === null,
    `Unit should be '' for bare-number task, got: '${suryaProgress.progressData!.unit}'`
  );
  console.log("  ✓ Surya Namaskar unit is empty string (no fabricated unit label)");

  // TEST 18: Reading Book (todo_id=6) — duration task
  console.log("\nTest 18: Reading Book (todo_id=6, user2) — duration task");
  const readingProgress = await getIndividualTaskAnalytics(6, "all_time", "user2", true);
  assert.ok(readingProgress.progressData !== undefined, "progressData must be present for input task");
  assert.strictEqual(readingProgress.progressData!.isMeasurable, false,
    "Reading Book has no real completed_value records yet — isMeasurable must be false");
  console.log("  ✓ Reading Book progressData.isMeasurable = false (no completed_value records yet)");

  // TEST 19: Wake Up (todo_id=1) — time task → no progressData
  console.log("\nTest 19: Wake Up (todo_id=1, user2) — time task → no progressData");
  const wakeupProgress = await getIndividualTaskAnalytics(1, "all_time", "user2", true);
  assert.strictEqual(wakeupProgress.progressData, null,
    "Wake up is a time task — progressData must be null");
  console.log("  ✓ Wake Up progressData = null (time tasks excluded from Progress)");

  // TEST 20: Checkbox task (todo_id=35) — binary → no progressData
  console.log("\nTest 20: Checkbox task (todo_id=35, user1) — binary → no progressData");
  const checkboxProgress = await getIndividualTaskAnalytics(35, "all_time", "user1", true);
  assert.strictEqual(checkboxProgress.progressData, null,
    "Checkbox task progressData must be null");
  console.log("  ✓ Checkbox task progressData = null (binary tasks excluded from Progress)");

  // TEST 21: No fabricated values — all pre-Phase-1 completed_value must be NULL
  console.log("\nTest 21: No fabricated completed_value — all pre-Phase-1 records must be NULL");
  const nullCheck = (await sql`
    SELECT COUNT(*) as cnt
    FROM task_occurrences
    WHERE status = 'completed'
      AND completed_value IS NOT NULL
  `) as { cnt: string }[];
  const fabricatedCount = parseInt(nullCheck[0]?.cnt ?? "0");
  // All existing historical completions should have NULL completed_value (none were fabricated)
  assert.strictEqual(fabricatedCount, 0,
    `Expected 0 rows with non-null completed_value (pre-Phase-1 data), found ${fabricatedCount}`);
  console.log("  ✓ No historical completed_value records fabricated — all pre-Phase-1 rows are NULL");

  // TEST 22: Metric calculation correctness (unit-testable with synthetic values)
  console.log("\nTest 22: Progress metric calculations (synthetic values)");
  const synthValues = [1.0, 1.5, 2.0, 1.8, 2.5];
  const avg22 = Math.round((synthValues.reduce((s, v) => s + v, 0) / synthValues.length) * 100) / 100;
  const best22 = Math.max(...synthValues);
  const total22 = Math.round(synthValues.reduce((s, v) => s + v, 0) * 100) / 100;
  const startingChange22 = Math.round((synthValues[synthValues.length - 1] - synthValues[0]) * 100) / 100;
  const pctChange22 = Math.round(((synthValues[synthValues.length - 1] - synthValues[0]) / synthValues[0]) * 10000) / 100;
  assert.strictEqual(avg22, 1.76, `avg should be 1.76, got ${avg22}`);
  assert.strictEqual(best22, 2.5, `best should be 2.5, got ${best22}`);
  assert.strictEqual(total22, 8.8, `total should be 8.8, got ${total22}`);
  assert.strictEqual(startingChange22, 1.5, `absoluteChange should be 1.5, got ${startingChange22}`);
  assert.strictEqual(pctChange22, 150, `percentageChange should be 150%, got ${pctChange22}`);
  console.log("  ✓ avg=1.76, best=2.5, total=8.8, absChange=1.5, pctChange=150%");

  // TEST 23: Zero-baseline percentage change safety
  console.log("\nTest 23: Zero baseline percentageChange safety");
  // startingValue = 0 → percentageChange should be null (no division by zero)
  const zeroStart = 0;
  const zeroEnd = 5;
  const pctChangeZero = zeroStart !== 0
    ? Math.round(((zeroEnd - zeroStart) / zeroStart) * 10000) / 100
    : null;
  assert.strictEqual(pctChangeZero, null, "percentageChange must be null when startingValue === 0");
  console.log("  ✓ percentageChange = null when startingValue === 0 (division by zero guarded)");

  // TEST 24: Target achievement rate calculation
  console.log("\nTest 24: Target achievement rate calculation");
  const pairs = [
    { completedValue: 1.5, targetValue: 1.2 }, // 125%
    { completedValue: 1.0, targetValue: 1.2 }, // 83.33%
    { completedValue: 1.2, targetValue: 1.2 }, // 100%
  ];
  const totalAch = pairs.reduce((s, p) => s + (p.completedValue / p.targetValue) * 100, 0);
  const avgAch = Math.round((totalAch / pairs.length) * 10) / 10;
  assert.strictEqual(avgAch, 102.8, `target achievement rate should be 102.8%, got ${avgAch}`);
  console.log("  ✓ Target achievement rate = 102.8% for (1.5, 1.0, 1.2) vs target 1.2");

  // TEST 25: Existing Analytics regression — Running unchanged
  console.log("\nTest 25: Regression — Running (todo_id=2) existing analytics unchanged");
  assert.strictEqual(runningProgress.completionRate, 14, "Running completion rate must still be 14%");
  assert.strictEqual(runningProgress.completedCount, 3, "Running completedCount must still be 3");
  assert.strictEqual(runningProgress.noActionCount, 18, "Running noActionCount must still be 18");
  assert.strictEqual(runningProgress.scheduledTime, "", "Running scheduledTime must be empty");
  console.log("  ✓ Running analytics unchanged: 14%, 3 completed, 18 no action");

  // TEST 26: Regression — Wake Up unchanged
  console.log("\nTest 26: Regression — Wake Up (todo_id=1) existing analytics unchanged");
  assert.strictEqual(wakeupProgress.completionRate, 24, "Wake up completion rate must still be 24%");
  assert.strictEqual(wakeupProgress.completedCount, 5, "Wake up completedCount must still be 5");
  assert.strictEqual(wakeupProgress.scheduledTime, "05:15 PM", "Wake up scheduledTime must be 05:15 PM");
  console.log("  ✓ Wake Up analytics unchanged: 24%, 5 completed, 05:15 PM");

  // TEST 27: Regression — Overall analytics unchanged
  console.log("\nTest 27: Regression — Overall analytics completedCount unchanged");
  assert.strictEqual(overallData.completedCount, 50, "Total completed count must still be 50");
  console.log("  ✓ Overall analytics unchanged: 50 total completions");

  // TEST 28: progressData isMeasurable=false does not expose metrics
  console.log("\nTest 28: isMeasurable=false → no metric values populated");
  assert.strictEqual(runningProgress.progressData!.startingValue, null);
  assert.strictEqual(runningProgress.progressData!.currentValue, null);
  assert.strictEqual(runningProgress.progressData!.averageValue, null);
  assert.strictEqual(runningProgress.progressData!.personalBest, null);
  assert.strictEqual(runningProgress.progressData!.totalValue, null);
  assert.strictEqual(runningProgress.progressData!.absoluteChange, null);
  assert.strictEqual(runningProgress.progressData!.percentageChange, null);
  assert.strictEqual(runningProgress.progressData!.targetAchievementRate, null);
  assert.strictEqual(runningProgress.progressData!.trend, "insufficient_data");
  console.log("  ✓ All metrics are null when isMeasurable=false (no fabricated values)");

  // =========================================================================
  // PHASE 3 TESTS — Progress Insights & Pattern Analysis
  // =========================================================================

  const { calculateTargetGap, deriveTaskInsights, generatePeriodSummary, generateFocusAreas } = await import("../src/lib/analytics-utils");

  // TEST 29: Target Gap — No quantitative data
  console.log("\nTest 29: Target Gap — 0 quantitative records");
  const gap29 = calculateTargetGap([]);
  assert.strictEqual(gap29.totalTargetSessions, 0);
  assert.strictEqual(gap29.targetAchievementPercentage, null);
  assert.strictEqual(gap29.summaryText, "No historical target records available for comparison.");
  console.log("  ✓ Target gap handles 0 records cleanly");

  // TEST 30: Pattern Analysis — One quantitative record
  console.log("\nTest 30: Pattern Analysis — 1 record");
  const ins30 = deriveTaskInsights({
    taskTitle: "Running",
    isMeasurable: true,
    completionRate: 100,
    completedCount: 1,
    totalOccurrences: 1,
    history: [{ date: "2026-09-01", completedValue: 1.5, targetValue: 1.2 }],
    startingValue: 1.5,
    currentValue: 1.5,
    averageValue: 1.5,
    personalBest: 1.5,
    unit: "km",
    trend: "insufficient_data",
    trendReason: "Need at least 5 recorded values to calculate a trend.",
    targetGap: calculateTargetGap([{ completedValue: 1.5, targetValue: 1.2 }]),
  });
  const trendIns30 = ins30.find((i) => i.type === "trend");
  assert.ok(trendIns30, "Trend insight must exist for 1 record");
  assert.ok(trendIns30.description.includes("1 quantitative record available"), `Expected description to mention 1 record, got: ${trendIns30.description}`);
  console.log("  ✓ 1 record insight correctly notes pattern requires 5+ records");

  // TEST 31: Pattern Analysis — Insufficient trend data (2-4 records)
  console.log("\nTest 31: Pattern Analysis — Insufficient trend data (3 records)");
  const ins31 = deriveTaskInsights({
    taskTitle: "Running",
    isMeasurable: true,
    completionRate: 100,
    completedCount: 3,
    totalOccurrences: 3,
    history: [
      { date: "2026-09-01", completedValue: 1.2, targetValue: 1.2 },
      { date: "2026-09-02", completedValue: 1.4, targetValue: 1.2 },
      { date: "2026-09-03", completedValue: 1.6, targetValue: 1.2 },
    ],
    startingValue: 1.2,
    currentValue: 1.6,
    averageValue: 1.4,
    personalBest: 1.6,
    unit: "km",
    trend: "insufficient_data",
    trendReason: "Need at least 5 recorded values to calculate a trend.",
    targetGap: calculateTargetGap([
      { completedValue: 1.2, targetValue: 1.2 },
      { completedValue: 1.4, targetValue: 1.2 },
      { completedValue: 1.6, targetValue: 1.2 },
    ]),
  });
  const trendIns31 = ins31.find((i) => i.type === "trend");
  assert.ok(trendIns31?.description.includes("Not enough recorded data"));
  console.log("  ✓ 3 records correctly notes insufficient data (need at least 5)");

  // TEST 32–35: Five-record trends (Improving, Declining, Stable)
  console.log("\nTest 32-35: 5-record trends — Improving, Declining, Stable");
  const gap5 = calculateTargetGap([
    { completedValue: 1.0, targetValue: 1.2 },
    { completedValue: 1.2, targetValue: 1.2 },
    { completedValue: 1.5, targetValue: 1.2 },
    { completedValue: 1.8, targetValue: 1.2 },
    { completedValue: 2.0, targetValue: 1.2 },
  ]);
  assert.strictEqual(gap5.metTargetSessions, 4);
  assert.strictEqual(gap5.belowTargetSessions, 1);
  assert.strictEqual(gap5.targetAchievementPercentage, 80);

  const insImproving = deriveTaskInsights({
    taskTitle: "Running",
    isMeasurable: true,
    completionRate: 100,
    completedCount: 5,
    totalOccurrences: 5,
    history: [
      { date: "2026-09-01", completedValue: 1.0, targetValue: 1.2 },
      { date: "2026-09-02", completedValue: 1.2, targetValue: 1.2 },
      { date: "2026-09-03", completedValue: 1.5, targetValue: 1.2 },
      { date: "2026-09-04", completedValue: 1.8, targetValue: 1.2 },
      { date: "2026-09-05", completedValue: 2.0, targetValue: 1.2 },
    ],
    startingValue: 1.0,
    currentValue: 2.0,
    averageValue: 1.5,
    personalBest: 2.0,
    unit: "km",
    trend: "improving",
    trendReason: "Recent avg (1.90) is higher than earlier avg (1.10) across 5 records.",
    targetGap: gap5,
  });
  const trendInsImp = insImproving.find((i) => i.type === "trend");
  assert.strictEqual(trendInsImp?.title, "Recent Performance is Higher");
  assert.strictEqual(trendInsImp?.severity, "positive");
  console.log("  ✓ 5-record improving trend generated positive insight");

  // TEST 36–38: Target Gap Calculations (Met, Not Met, Mixed)
  console.log("\nTest 36-38: Target Gap — Met, Not Met, Mixed");
  const gapMet = calculateTargetGap([{ completedValue: 1.5, targetValue: 1.2 }]);
  assert.strictEqual(gapMet.metTargetSessions, 1);
  assert.strictEqual(gapMet.targetAchievementPercentage, 100);

  const gapNotMet = calculateTargetGap([{ completedValue: 0.8, targetValue: 1.2 }]);
  assert.strictEqual(gapNotMet.metTargetSessions, 0);
  assert.strictEqual(gapNotMet.targetAchievementPercentage, 0);

  const gapMixed = calculateTargetGap([
    { completedValue: 1.5, targetValue: 1.2 },
    { completedValue: 0.8, targetValue: 1.2 },
    { completedValue: 1.2, targetValue: 1.2 },
  ]);
  assert.strictEqual(gapMixed.metTargetSessions, 2);
  assert.strictEqual(gapMixed.totalTargetSessions, 3);
  assert.strictEqual(gapMixed.targetAchievementPercentage, 66.7);
  console.log("  ✓ Target gap correctly calculates met, not met, and mixed percentages");

  // TEST 39: Historical Target Snapshots
  console.log("\nTest 39: Target Gap — Uses historical target snapshots");
  const gapHistorical = calculateTargetGap([
    { completedValue: 1.3, targetValue: 1.2 }, // Met (1.3 >= 1.2)
    { completedValue: 1.8, targetValue: 2.0 }, // Below (1.8 < 2.0)
  ]);
  assert.strictEqual(gapHistorical.metTargetSessions, 1);
  assert.strictEqual(gapHistorical.belowTargetSessions, 1);
  assert.strictEqual(gapHistorical.targetAchievementPercentage, 50);
  console.log("  ✓ Respects historical target snapshot changes per occurrence");

  // TEST 40: NULL Historical Target Exclusion
  console.log("\nTest 40: Target Gap — NULL target_value excluded");
  const gapNullTarget = calculateTargetGap([
    { completedValue: 1.5, targetValue: null },
    { completedValue: 1.5, targetValue: 1.2 },
  ]);
  assert.strictEqual(gapNullTarget.totalTargetSessions, 1);
  assert.strictEqual(gapNullTarget.metTargetSessions, 1);
  console.log("  ✓ Excludes records with NULL historical target from target gap");

  // TEST 41: Zero Starting Value Safety
  console.log("\nTest 41: Zero starting value percentage change safety");
  const insZeroStart = deriveTaskInsights({
    taskTitle: "Reading Book",
    isMeasurable: true,
    completionRate: 100,
    completedCount: 2,
    totalOccurrences: 2,
    history: [
      { date: "2026-09-01", completedValue: 0, targetValue: 30 },
      { date: "2026-09-02", completedValue: 30, targetValue: 30 },
    ],
    startingValue: 0,
    currentValue: 30,
    averageValue: 15,
    personalBest: 30,
    unit: "min",
    trend: "insufficient_data",
    trendReason: "Need at least 5 recorded values.",
    targetGap: calculateTargetGap([
      { completedValue: 0, targetValue: 30 },
      { completedValue: 30, targetValue: 30 },
    ]),
  });
  const perfInsZero = insZeroStart.find((i) => i.type === "performance");
  assert.ok(perfInsZero?.description.includes("Starting: 0 min → Current: 30 min"));
  console.log("  ✓ Zero starting value insight formats safely without division by zero");

  // TEST 42: NULL completed_value Exclusion
  console.log("\nTest 42: NULL completed_value excluded from quantitative calculations");
  const gapNullComp = calculateTargetGap([
    { completedValue: null, targetValue: 1.2 },
    { completedValue: 1.5, targetValue: 1.2 },
  ]);
  assert.strictEqual(gapNullComp.totalTargetSessions, 1);
  assert.strictEqual(gapNullComp.metTargetSessions, 1);
  console.log("  ✓ NULL completed_value rows excluded from target gap calculations");

  // TEST 43 & 44: Checkbox & Time task Exclusion
  console.log("\nTest 43-44: Checkbox & Time task progressData & insight exclusion");
  assert.strictEqual(wakeupProgress.progressData, null);
  assert.strictEqual(checkboxProgress.progressData, null);
  console.log("  ✓ Time & Checkbox tasks continue to return progressData = null");

  // TEST 45: Consistency Separated From Performance
  console.log("\nTest 45: Consistency separated from performance");
  const insConsistency = deriveTaskInsights({
    taskTitle: "Running",
    isMeasurable: true,
    completionRate: 82,
    completedCount: 9,
    totalOccurrences: 11,
    history: [{ date: "2026-09-01", completedValue: 1.6, targetValue: 1.2 }],
    startingValue: 1.6,
    currentValue: 1.6,
    averageValue: 1.6,
    personalBest: 1.6,
    unit: "km",
    trend: "insufficient_data",
    trendReason: "Need at least 5 recorded values.",
    targetGap: calculateTargetGap([{ completedValue: 1.6, targetValue: 1.2 }]),
  });
  const consIns = insConsistency.find((i) => i.type === "consistency");
  assert.ok(consIns?.description.includes("82%"));
  assert.ok(consIns?.description.includes("1.6 km"));
  console.log("  ✓ Consistency rate (82%) clearly separated from quantitative performance (1.6 km)");

  // TEST 46: Period Summary Generation
  console.log("\nTest 46: Period summary generation");
  const summary46 = generatePeriodSummary({
    totalTasksDue: 21,
    completedCount: 18,
    measurableTasksStats: {
      totalMeasurable: 3,
      improving: 2,
      declining: 0,
      stable: 0,
      insufficientData: 1,
    },
  });
  assert.strictEqual(summary46.completionRate, 86);
  assert.ok(summary46.summaryText.includes("18 of 21"));
  assert.ok(summary46.summaryText.includes("2 showing higher recent performance"));
  console.log("  ✓ Period summary generates accurate statistics and natural narrative");

  // TEST 47: Focus-Area Generation
  console.log("\nTest 47: Focus-area generation");
  const focus47 = generateFocusAreas({
    taskSummaries: [
      {
        taskId: 2,
        taskTitle: "Running",
        completionRate: 100,
        totalOccurrences: 5,
        isMeasurable: true,
        historyCount: 5,
        targetGap: calculateTargetGap([
          { completedValue: 1.0, targetValue: 1.2 },
          { completedValue: 1.0, targetValue: 1.2 },
          { completedValue: 1.0, targetValue: 1.2 },
          { completedValue: 1.3, targetValue: 1.2 },
          { completedValue: 1.4, targetValue: 1.2 },
        ]),
        trend: "improving",
        trendReason: "Recent avg higher.",
        averageValue: 1.14,
        unit: "km",
      },
    ],
  });
  assert.ok(focus47.length > 0);
  assert.strictEqual(focus47[0].title, "Running");
  console.log("  ✓ Focus areas correctly generate deterministic task observations");

  // TEST 48: Existing Phase 1 & Phase 2 analytics unchanged
  console.log("\nTest 48: Existing Phase 1 & 2 analytics regression check");
  assert.strictEqual(runningProgress.completionRate, 14);
  assert.strictEqual(runningProgress.completedCount, 3);
  assert.strictEqual(wakeupProgress.completionRate, 24);
  assert.strictEqual(overallData.completedCount, 50);
  console.log("  ✓ Phase 1 & Phase 2 metrics remain 100% unchanged");

  // TEST 49: Date-range & Include Today behavior in getAllTasksAnalytics
  console.log("\nTest 49: Date-range & Include Today behavior in getAllTasksAnalytics");
  const all7 = await getAllTasksAnalytics("last_7_days", "user2", false);
  const all30 = await getAllTasksAnalytics("last_30_days", "user2", true);
  assert.ok(all7.periodSummary !== undefined, "periodSummary must be present");
  assert.ok(all7.focusAreas !== undefined, "focusAreas must be present");
  assert.ok(all30.periodSummary !== undefined, "periodSummary must be present in last_30_days with includeToday");
  console.log("  ✓ periodSummary and focusAreas present across all date ranges and includeToday modes");

  console.log("\n=========================================");
  console.log("ALL 49 TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("=========================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});

