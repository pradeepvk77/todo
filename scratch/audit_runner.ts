import { Pool } from "pg";
import { getIndividualTaskAnalytics, getAllTasksAnalytics } from "../src/app/actions/analytics";
import { getAnalytics, getTaskPerformanceHistory } from "../src/app/actions";
import { ON_TIME_TOLERANCE_MINUTES, getISTHourFromTimestamp, getTimeOfDaySection, parseScheduledTimeToMinutes } from "../src/lib/analytics-utils";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/todo_local?host=/tmp",
});

async function main() {
  console.log("==================================================");
  console.log("STEP 2: INDIVIDUAL ANALYTICS API COMPARISON");
  console.log("==================================================");

  const testTasks = [
    { id: 2, title: "Running" },
    { id: 1, title: "Wake up" },
    { id: 6, title: "Reading Book" },
  ];

  for (const t of testTasks) {
    console.log(`\n=================== TASK ${t.id}: ${t.title} (all_time, includeToday=true) ===================`);
    const apiData = await getIndividualTaskAnalytics(t.id, "all_time", "user2", true);

    // SQL calculations
    const occRes = await pool.query(
      "SELECT occurrence_date, status, scheduled_time, completed_at, missed_reason FROM task_occurrences WHERE user_id = 'user2' AND todo_id = $1 ORDER BY occurrence_date DESC",
      [t.id]
    );

    const totalOccs = occRes.rowCount || 0;
    const completedCount = occRes.rows.filter((r: any) => r.status === "completed").length;
    const noActionCount = occRes.rows.filter((r: any) => r.status === "no_action").length;
    const skippedCount = occRes.rows.filter((r: any) => r.status === "skipped").length;
    const rescheduledCount = occRes.rows.filter((r: any) => r.status === "rescheduled").length;
    const expectedRate = totalOccs > 0 ? Math.round((completedCount / totalOccs) * 100) : 0;

    // Streaks
    let currentStreak = 0;
    for (const r of occRes.rows) {
      if (r.status === "completed") currentStreak++;
      else break;
    }
    let longestStreak = 0, tempStreak = 0;
    for (const r of occRes.rows) {
      if (r.status === "completed") {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else tempStreak = 0;
    }

    const checks = [
      { name: "totalOccurrences", expected: totalOccs, actual: apiData.totalOccurrences },
      { name: "completedCount", expected: completedCount, actual: apiData.completedCount },
      { name: "noActionCount", expected: noActionCount, actual: apiData.noActionCount },
      { name: "skippedCount", expected: skippedCount, actual: apiData.skippedCount },
      { name: "rescheduledCount", expected: rescheduledCount, actual: apiData.rescheduledCount },
      { name: "completionRate", expected: expectedRate, actual: apiData.completionRate },
      { name: "currentStreak", expected: currentStreak, actual: apiData.currentStreak },
      { name: "longestStreak", expected: longestStreak, actual: apiData.longestStreak },
      { name: "scheduledTime", expected: t.id === 1 ? "05:15 PM" : "", actual: apiData.scheduledTime },
    ];

    checks.forEach((c) => {
      const match = c.expected === c.actual;
      console.log(`  ${match ? "MATCH" : "MISMATCH"}: ${c.name} -> Expected: ${c.expected} | Actual: ${c.actual}`);
    });

    console.log("  Time of Day Performance:", JSON.stringify(apiData.timeOfDayPerformance));
    console.log("  Timing metrics -> avgDelay:", apiData.avgDelay, "| onTimePercentage:", apiData.onTimePercentage);
  }

  console.log("\n==================================================");
  console.log("STEP 3 & 4: OVERALL ANALYTICS & DATE RANGE CONTRACT");
  console.log("==================================================");

  const ranges: ("last_7_days" | "last_30_days" | "all_time")[] = ["last_7_days", "last_30_days", "all_time"];
  for (const r of ranges) {
    for (const inc of [false, true]) {
      const data = await getAllTasksAnalytics(r, "user2", inc);
      console.log(`getAllTasksAnalytics(${r}, includeToday=${inc}) => startDate: ${data.startDate}, endDate: ${data.endDate}, totalTasksDue: ${data.totalTasksDue}, completedCount: ${data.completedCount}, overallConsistency: ${data.overallConsistency}%`);
    }
  }

  console.log("\nChecking getAnalytics() date boundaries...");
  const analyticsOff = await getAnalytics(true, false);
  const analyticsOn = await getAnalytics(true, true);
  console.log("getAnalytics(includeToday=false) 7-day range ends at:", analyticsOff.lastSevenDays[6]?.date);
  console.log("getAnalytics(includeToday=true) 7-day range ends at:", analyticsOn.lastSevenDays[6]?.date);

  console.log("\nChecking getTaskPerformanceHistory() for todo 1...");
  const histOff = await getTaskPerformanceHistory(1, "user2", false);
  const histOn = await getTaskPerformanceHistory(1, "user2", true);
  console.log("getTaskPerformanceHistory(includeToday=false) ends at:", histOff.lastSevenBars[6]?.date);
  console.log("getTaskPerformanceHistory(includeToday=true) ends at:", histOn.lastSevenBars[6]?.date);

  console.log("\n==================================================");
  console.log("STEP 5: TIME OF DAY BREAKDOWN FOR COMPLETED OCCURRENCES");
  console.log("==================================================");

  for (const id of [1, 2]) {
    const todoRes = await pool.query("SELECT title FROM todos WHERE id = $1", [id]);
    const title = todoRes.rows[0].title;
    console.log(`\nCompleted occurrences for Task ${id} (${title}):`);
    const occRes = await pool.query(
      "SELECT occurrence_date, completed_at FROM task_occurrences WHERE user_id = 'user2' AND todo_id = $1 AND status = 'completed' ORDER BY occurrence_date ASC",
      [id]
    );

    occRes.rows.forEach((r: any) => {
      const utcStr = r.completed_at ? new Date(r.completed_at).toISOString() : "N/A";
      const istHour = getISTHourFromTimestamp(r.completed_at);
      const sec = getTimeOfDaySection(istHour);
      console.log(`  Date: ${r.occurrence_date} | UTC: ${utcStr} | IST Hour: ${istHour} | Section: ${sec}`);
    });
  }

  console.log("\n==================================================");
  console.log("STEP 10: FOREIGN KEY & ORPHAN CHECK");
  console.log("==================================================");

  const orphanRes = await pool.query("SELECT COUNT(*) as count FROM task_completions WHERE todo_id NOT IN (SELECT id FROM todos)");
  console.log(`Orphan count in task_completions: ${orphanRes.rows[0].count}`);

  const fkRes = await pool.query(`
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'task_completions'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'fk_task_completions_todo_id'
  `);
  console.log(`Foreign key constraint exists: ${(fkRes.rowCount ?? 0) > 0 ? "YES" : "NO"}`);

  console.log("\n==================================================");
  console.log("STEP 11: ALL TIME DATES");
  console.log("==================================================");

  const minMaxRes = await pool.query("SELECT MIN(occurrence_date) as min_date, MAX(occurrence_date) as max_date FROM task_occurrences WHERE user_id = 'user2'");
  console.log(`user2 occurrence date range in DB: MIN=${minMaxRes.rows[0].min_date} | MAX=${minMaxRes.rows[0].max_date}`);

  await pool.end();
}

main().catch(console.error);
