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
  assert.strictEqual(runningData.noActionCount, 13, "No Action count in all_time should be 13");
  assert.strictEqual(runningData.totalOccurrences, 16, "Total occurrences should be 16");
  assert.strictEqual(runningData.completionRate, 19, "Completion rate should be 19%");
  console.log("  ✓ Running analytics matches database metrics exactly (19%, 3 completed, 13 no action, Unscheduled)");

  console.log("\nTest 9: Wake up (todo_id=1, user2) Individual Analytics (all_time)");
  const wakeupData = await getIndividualTaskAnalytics(1, "all_time", "user2", true);
  assert.strictEqual(wakeupData.taskTitle, "Wake up");
  assert.strictEqual(wakeupData.scheduledTime, "05:15 PM", "Scheduled time should be 05:15 PM");
  assert.strictEqual(wakeupData.completedCount, 5, "Completed count in all_time should be 5");
  assert.strictEqual(wakeupData.noActionCount, 11, "No Action count in all_time should be 11");
  assert.strictEqual(wakeupData.totalOccurrences, 16, "Total occurrences should be 16");
  assert.strictEqual(wakeupData.completionRate, 31, "Completion rate should be 31%");
  console.log("  ✓ Wake up analytics matches database metrics exactly (31%, 5 completed, 11 no action, 05:15 PM)");

  console.log("\nTest 10: Overall Analytics for user2 (all_time)");
  const overallData = await getAllTasksAnalytics("all_time", "user2", true);
  assert.strictEqual(overallData.completedCount, 50, "Total completed count across tasks in all_time should be 50");
  console.log("  ✓ Overall analytics returned correct completion count (50)");

  console.log("\n=========================================");
  console.log("ALL 10 TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("=========================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
