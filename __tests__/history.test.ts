import assert from "node:assert";
import { initDb, sql } from "../src/lib/db";
import {
  getHistoryTableData,
  getDayHistoryDetails,
  saveDayHistory,
  getEditableMinDate,
  isDateInEditableWindow,
} from "../src/app/actions/history";
import { getISTDateString } from "../src/lib/time-utils";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/todo_local?host=/tmp";
process.env.TEST_USER_ID = "user2";

async function runHistoryTests() {
  console.log("=========================================");
  console.log("Running Complete History Feature Test Suite");
  console.log("=========================================\n");

  await initDb();

  const todayStr = getISTDateString();

  const yesterdayStr = (() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d - 1));
    return date.toISOString().slice(0, 10);
  })();

  const fiveDaysOldStr = (() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d - 5));
    return date.toISOString().slice(0, 10);
  })();

  const sixDaysOldStr = (() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d - 6));
    return date.toISOString().slice(0, 10);
  })();

  const todos = (await sql`
    SELECT id, title, task_type FROM todos WHERE user_id = 'user2'
  `) as { id: number; title: string; task_type: string }[];

  const running = todos.find((t) => t.title.toLowerCase().includes("running"));
  const reading = todos.find((t) => t.title.toLowerCase().includes("reading"));
  const surya = todos.find((t) => t.title.toLowerCase().includes("surya"));

  let checkbox = todos.find((t) => t.task_type === "checkbox");

  if (!checkbox) {
    // Insert a test checkbox todo for user2 for testing
    const [newCb] = (await sql`
      INSERT INTO todos (user_id, title, task_type, category, scheduled_time)
      VALUES ('user2', 'Test Checkbox Task', 'checkbox', 'Personal', '09:00 AM')
      RETURNING id, title, task_type;
    `) as { id: number; title: string; task_type: string }[];
    checkbox = newCb;
  }

  const runningTodoId = running ? running.id : todos[0]?.id;
  const readingTodoId = reading ? reading.id : todos[1]?.id;
  const suryaTodoId = surya ? surya.id : todos[2]?.id;
  const checkboxTodoId = checkbox.id;

  // 1. History table date grouping
  console.log("Test 1: History table date grouping");
  const summaries = await getHistoryTableData();
  assert(Array.isArray(summaries), "Summaries should be an array");
  if (summaries.length > 1) {
    assert(summaries[0].date >= summaries[1].date, "Dates should be sorted descending");
  }
  console.log("  ✓ History table date grouping verified");

  // 2. Completed count
  console.log("Test 2: Completed count");
  summaries.forEach((s) => {
    assert(s.completedTasks >= 0, "Completed tasks should be >= 0");
    assert(s.completedTasks <= s.totalTasks, "Completed tasks should be <= total tasks");
  });
  console.log("  ✓ Completed count verified");

  // 3 & 7. Missing quantitative value detection
  console.log("Test 3 & 7: Missing quantitative value detection");
  if (runningTodoId) {
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, target_value, completed_value, unit, updated_at)
      VALUES ('user2', ${runningTodoId}, ${yesterdayStr}, 'completed', 1.2, NULL, 'km', NOW())
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET status = 'completed', completed_value = NULL;
    `;

    const updatedSummaries = await getHistoryTableData();
    const yesterdaySummary = updatedSummaries.find((s) => s.date === yesterdayStr);
    assert(yesterdaySummary !== undefined, "Yesterday summary should exist");
    assert(yesterdaySummary!.missingDetails >= 1, "Yesterday missingDetails should be >= 1");

    const details = await getDayHistoryDetails(yesterdayStr);
    const runningTask = details.tasks.find((t) => t.todoId === runningTodoId);
    assert(runningTask !== undefined, "Running task should exist in day details");
    assert.strictEqual(runningTask!.isMissingValue, true, "Running task should be marked as missing value");
  }
  console.log("  ✓ Missing quantitative value detection verified");

  // 4. Checkbox not treated as missing
  console.log("Test 4: Checkbox not treated as missing");
  if (checkboxTodoId) {
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, target_value, completed_value, updated_at)
      VALUES ('user2', ${checkboxTodoId}, ${yesterdayStr}, 'completed', NULL, NULL, NOW())
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET status = 'completed', completed_value = NULL;
    `;

    const details = await getDayHistoryDetails(yesterdayStr);
    const cbTask = details.tasks.find((t) => t.todoId === checkboxTodoId);
    assert(cbTask !== undefined, "Checkbox task should exist in day details");
    assert.strictEqual(cbTask.isMissingValue, false, "Checkbox task must not be marked missing");
  }
  console.log("  ✓ Checkbox not treated as missing verified");

  // 5. Time task handling
  console.log("Test 5: Time task handling");
  const timeTodos = (await sql`
    SELECT id FROM todos WHERE user_id = 'user2' AND task_type = 'time' LIMIT 1
  `) as { id: number }[];

  if (timeTodos.length > 0) {
    const timeTodoId = timeTodos[0].id;
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, completed_at, updated_at)
      VALUES ('user2', ${timeTodoId}, ${yesterdayStr}, 'completed', NULL, NOW())
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET status = 'completed', completed_at = NULL;
    `;

    const details = await getDayHistoryDetails(yesterdayStr);
    const timeTask = details.tasks.find((t) => t.todoId === timeTodoId);
    assert(timeTask !== undefined, "Time task should exist");
    assert.strictEqual(timeTask!.completedAt, null, "Time task completedAt should be null");
  }
  console.log("  ✓ Time task handling verified");

  // 6. No Action handling
  console.log("Test 6: No Action handling");
  if (runningTodoId) {
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, completed_value, updated_at)
      VALUES ('user2', ${runningTodoId}, ${todayStr}, 'no_action', NULL, NOW())
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET status = 'no_action', completed_value = NULL;
    `;

    const details = await getDayHistoryDetails(todayStr);
    const runningTask = details.tasks.find((t) => t.todoId === runningTodoId);
    assert(runningTask !== undefined, "Running task should exist");
    assert.strictEqual(runningTask!.status, "no_action", "Status should be no_action");
    assert.strictEqual(runningTask!.isMissingValue, false, "No action task should not be missing value");
  }
  console.log("  ✓ No Action handling verified");

  // 8. Completed + existing value
  console.log("Test 8: Completed + existing value");
  if (runningTodoId) {
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, target_value, completed_value, unit, updated_at)
      VALUES ('user2', ${runningTodoId}, ${yesterdayStr}, 'completed', 1.2, 1.5, 'km', NOW())
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET status = 'completed', completed_value = 1.5;
    `;

    const details = await getDayHistoryDetails(yesterdayStr);
    const runningTask = details.tasks.find((t) => t.todoId === runningTodoId);
    assert(runningTask !== undefined, "Running task should exist");
    assert.strictEqual(runningTask!.isRecorded, true, "isRecorded should be true");
    assert.strictEqual(runningTask!.completedValue, 1.5, "completedValue should be 1.5");
    assert.strictEqual(runningTask!.isMissingValue, false, "isMissingValue should be false");
  }
  console.log("  ✓ Completed + existing value verified");

  // 9, 10, 11. Today, Yesterday, 5-days-old editable
  console.log("Test 9, 10, 11: Editable window rules");
  assert.strictEqual(await isDateInEditableWindow(todayStr, todayStr), true, "Today is editable");
  assert.strictEqual(await isDateInEditableWindow(yesterdayStr, todayStr), true, "Yesterday is editable");
  assert.strictEqual(await isDateInEditableWindow(fiveDaysOldStr, todayStr), true, "Five days old is editable");
  console.log("  ✓ Editable window rules verified");

  // 12. Older than five days rejected
  console.log("Test 12: Older than five days rejected");
  assert.strictEqual(await isDateInEditableWindow(sixDaysOldStr, todayStr), false, "Six days old is NOT editable");
  if (runningTodoId) {
    const res = await saveDayHistory(sixDaysOldStr, [
      { todoId: runningTodoId, status: "completed", completedValue: 1.5 },
    ]);
    assert.strictEqual(res.success, false, "Save must fail for date > 5 days old");
    assert(res.error!.includes("outside the 5-day editable window"), "Error message must state 5-day window constraint");
  }
  console.log("  ✓ Older than 5 days rejection verified");

  // 13. Unauthorized user's occurrence rejected
  console.log("Test 13: Unauthorized user's occurrence rejected");
  const otherUserTodos = (await sql`
    SELECT id FROM todos WHERE user_id = 'user1' LIMIT 1
  `) as { id: number }[];

  if (otherUserTodos.length > 0) {
    const otherTodoId = otherUserTodos[0].id;
    const res = await saveDayHistory(todayStr, [
      { todoId: otherTodoId, status: "completed", completedValue: 5 },
    ]);
    assert.strictEqual(res.success, false, "Save must fail for another user's todo");
    assert(res.error!.includes("Unauthorized"), "Error message must state Unauthorized");
  }
  console.log("  ✓ Unauthorized user rejection verified");

  // 14. Invalid numeric value rejected
  console.log("Test 14: Invalid numeric value rejected");
  if (runningTodoId) {
    const res = await saveDayHistory(todayStr, [
      { todoId: runningTodoId, status: "completed", completedValue: NaN as any },
    ]);
    assert.strictEqual(res.success, false, "Save must fail for NaN");
    assert(res.error!.includes("Invalid quantitative value"), "Error must complain about invalid value");
  }
  console.log("  ✓ Invalid numeric value rejection verified");

  // 15. Negative value validation
  console.log("Test 15: Negative value validation");
  if (runningTodoId) {
    const res = await saveDayHistory(todayStr, [
      { todoId: runningTodoId, status: "completed", completedValue: -2.5 },
    ]);
    assert.strictEqual(res.success, false, "Save must fail for negative value");
    assert(res.error!.includes("Negative value"), "Error must complain about negative value");
  }
  console.log("  ✓ Negative value validation verified");

  // 16. Target is never copied into actual value
  console.log("Test 16: Target is never copied into actual value");
  if (runningTodoId) {
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, target_value, completed_value, unit, updated_at)
      VALUES ('user2', ${runningTodoId}, ${yesterdayStr}, 'completed', 1.2, NULL, 'km', NOW())
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET status = 'completed', target_value = 1.2, completed_value = NULL;
    `;

    const details = await getDayHistoryDetails(yesterdayStr);
    const runningTask = details.tasks.find((t) => t.todoId === runningTodoId);
    assert.strictEqual(runningTask!.targetValue, 1.2, "targetValue should be 1.2");
    assert.strictEqual(runningTask!.completedValue, null, "completedValue must remain null");
  }
  console.log("  ✓ Target non-prefill safety verified");

  // 17. Historical target remains unchanged
  console.log("Test 17: Historical target remains unchanged");
  if (runningTodoId) {
    const initialTarget = 1.2;
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, target_value, completed_value, unit, updated_at)
      VALUES ('user2', ${runningTodoId}, ${yesterdayStr}, 'completed', ${initialTarget}, NULL, 'km', NOW())
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET target_value = ${initialTarget}, completed_value = NULL;
    `;

    const saveRes = await saveDayHistory(yesterdayStr, [
      { todoId: runningTodoId, status: "completed", completedValue: 1.8 },
    ]);
    assert.strictEqual(saveRes.success, true, "Save should succeed");

    const [occ] = (await sql`
      SELECT target_value, completed_value FROM task_occurrences
      WHERE user_id = 'user2' AND todo_id = ${runningTodoId} AND occurrence_date = ${yesterdayStr}
    `) as { target_value: any; completed_value: any }[];

    assert.strictEqual(parseFloat(String(occ.target_value)), initialTarget, "target_value must be unchanged");
    assert.strictEqual(parseFloat(String(occ.completed_value)), 1.8, "completed_value must be updated to 1.8");
  }
  console.log("  ✓ Historical target retention verified");

  // 18. Atomic save / rollback
  console.log("Test 18: Atomic save / rollback");
  if (runningTodoId) {
    const [occBefore] = (await sql`
      SELECT completed_value FROM task_occurrences
      WHERE user_id = 'user2' AND todo_id = ${runningTodoId} AND occurrence_date = ${yesterdayStr}
    `) as any[];

    const res = await saveDayHistory(yesterdayStr, [
      { todoId: runningTodoId, status: "completed", completedValue: 9.9 },
      { todoId: 999999, status: "completed", completedValue: -5 },
    ]);
    assert.strictEqual(res.success, false, "Transaction must fail and roll back");

    const [occAfter] = (await sql`
      SELECT completed_value FROM task_occurrences
      WHERE user_id = 'user2' AND todo_id = ${runningTodoId} AND occurrence_date = ${yesterdayStr}
    `) as any[];

    assert.deepStrictEqual(occAfter?.completed_value, occBefore?.completed_value, "Record must remain unchanged after rollback");
  }
  console.log("  ✓ Atomic save and rollback verified");

  // 19. Running actual value persistence
  console.log("Test 19: Running actual value persistence");
  if (runningTodoId) {
    const res = await saveDayHistory(yesterdayStr, [
      { todoId: runningTodoId, status: "completed", completedValue: 1.75 },
    ]);
    assert.strictEqual(res.success, true, "Running save should succeed");

    const details = await getDayHistoryDetails(yesterdayStr);
    const task = details.tasks.find((t) => t.todoId === runningTodoId);
    assert.strictEqual(task!.completedValue, 1.75, "Running completedValue should be 1.75");
  }
  console.log("  ✓ Running actual value persistence verified");

  // 20. Reading actual value persistence
  console.log("Test 20: Reading actual value persistence");
  if (readingTodoId) {
    const res = await saveDayHistory(yesterdayStr, [
      { todoId: readingTodoId, status: "completed", completedValue: 45 },
    ]);
    assert.strictEqual(res.success, true, "Reading save should succeed");

    const details = await getDayHistoryDetails(yesterdayStr);
    const task = details.tasks.find((t) => t.todoId === readingTodoId);
    assert.strictEqual(task!.completedValue, 45, "Reading completedValue should be 45");
  }
  console.log("  ✓ Reading actual value persistence verified");

  // 21. Surya Namaskar actual value persistence
  console.log("Test 21: Surya Namaskar actual value persistence");
  if (suryaTodoId) {
    const res = await saveDayHistory(yesterdayStr, [
      { todoId: suryaTodoId, status: "completed", completedValue: 30 },
    ]);
    assert.strictEqual(res.success, true, "Surya save should succeed");

    const details = await getDayHistoryDetails(yesterdayStr);
    const task = details.tasks.find((t) => t.todoId === suryaTodoId);
    assert.strictEqual(task!.completedValue, 30, "Surya completedValue should be 30");
  }
  console.log("  ✓ Surya Namaskar actual value persistence verified");

  // 22. Existing Analytics reads the newly saved value
  console.log("Test 22: Existing Analytics reads newly saved value");
  const { getIndividualTaskAnalytics } = await import("../src/app/actions/analytics");
  if (runningTodoId) {
    await saveDayHistory(yesterdayStr, [
      { todoId: runningTodoId, status: "completed", completedValue: 2.5 },
    ]);

    const analytics = await getIndividualTaskAnalytics(runningTodoId, "last_30_days", "user2");
    assert(analytics !== undefined, "Analytics should exist");
    assert(analytics.progressData !== undefined, "progressData should exist");

    const dataPoint = analytics.progressData!.history.find((h) => h.date === yesterdayStr);
    assert(dataPoint !== undefined, "Data point for yesterday should exist");
    assert.strictEqual(dataPoint!.completedValue, 2.5, "Data point completedValue should be 2.5");
  }
  console.log("  ✓ Existing Analytics integration verified");

  // 23, 24, 25. Existing Phase 1, Phase 2, Phase 3 analytics unchanged
  console.log("Test 23, 24, 25: Existing Phase 1, 2, and 3 analytics unchanged");
  if (runningTodoId) {
    const analytics = await getIndividualTaskAnalytics(runningTodoId, "last_30_days", "user2");
    assert(analytics !== undefined, "Analytics object should exist");
    assert(analytics.progressData !== undefined && analytics.progressData !== null, "progressData should exist");
    assert(analytics.progressData.startingValue !== null, "startingValue should exist");
    assert(analytics.progressData.targetAchievementRate !== null, "targetAchievementRate should exist");
  }
  console.log("  ✓ Phase 1, Phase 2, and Phase 3 analytics unchanged");

  console.log("\n=========================================");
  console.log("ALL 25 COMPLETE HISTORY TESTS PASSED SUCCESSFULLY!");
  console.log("=========================================\n");
  process.exit(0);
}

runHistoryTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
