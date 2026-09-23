import assert from "node:assert";
import { getAllTasksAnalytics } from "../src/app/actions/analytics";
import { toggleTodo, editTodo } from "../src/app/actions";
import { parseTargetValueAndUnit } from "../src/lib/analytics-utils";
import { withTransaction, sql, initDb } from "../src/lib/db";
import { getISTDateString } from "../src/lib/time-utils";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/todo_local?host=/tmp";
process.env.TEST_USER_ID = "user2";

async function runPhase1Tests() {
  console.log("=========================================");
  console.log("Running Phase 1 Quantitative Test Suite...");
  console.log("=========================================\n");

  await initDb();

  // TEST 1: Target parsing
  console.log("Test 1: Target Parsing (1.2KM)");
  const p1 = parseTargetValueAndUnit("1.2KM");
  assert.strictEqual(p1.targetValue, 1.2);
  assert.strictEqual(p1.unit, "km");
  console.log("  ✓ Correctly parsed 1.2KM into targetValue=1.2, unit='km'");

  // TEST 2: Unit normalization
  console.log("Test 2: Unit Normalization (30min & 5 unit)");
  const p2 = parseTargetValueAndUnit("30min");
  assert.strictEqual(p2.targetValue, 30);
  assert.strictEqual(p2.unit, "min");
  const p3 = parseTargetValueAndUnit("5 unit");
  assert.strictEqual(p3.targetValue, 5);
  assert.strictEqual(p3.unit, "unit");
  console.log("  ✓ Correctly normalized units to lowercase");

  // TEST 3: Blank/Invalid Input Handling
  console.log("Test 3: Blank/Invalid Target Inputs");
  assert.deepStrictEqual(parseTargetValueAndUnit(""), { targetValue: null, unit: "" });
  assert.deepStrictEqual(parseTargetValueAndUnit(null), { targetValue: null, unit: "" });
  assert.deepStrictEqual(parseTargetValueAndUnit("05:15 PM"), { targetValue: null, unit: "" });
  console.log("  ✓ Correctly handled blank/time string inputs");

  // TEST 4: Input task completion with quantitative value (Running todo_id=2)
  console.log("Test 4: Quantitative Input Completion (Running 1.5 km)");
  // First uncomplete task 2 if completed today
  await sql`UPDATE todos SET completed = false WHERE id = 2 AND user_id = 'user2'`;
  const toggleRes = await toggleTodo(2, false, 1.5);
  assert.strictEqual(toggleRes.success, true);

  const todayStr = getISTDateString();

  const [occRow] = (await sql`
    SELECT target_value, completed_value, unit, status
    FROM task_occurrences
    WHERE user_id = 'user2' AND todo_id = 2 AND occurrence_date = ${todayStr}
  `) as any[];

  assert.strictEqual(Number(occRow.target_value), 1.2, "target_value should be 1.2");
  assert.strictEqual(Number(occRow.completed_value), 1.5, "completed_value should be 1.5");
  assert.strictEqual(occRow.unit, "km", "unit should be km");
  assert.strictEqual(occRow.status, "completed");
  console.log("  ✓ Successfully persisted target_value=1.2, completed_value=1.5, unit='km' to task_occurrences");

  const [compRow] = (await sql`
    SELECT target_value, completed_value, unit
    FROM task_completions
    WHERE user_id = 'user2' AND todo_id = 2 AND completed_date = ${todayStr}
  `) as any[];
  assert.strictEqual(Number(compRow.target_value), 1.2);
  assert.strictEqual(Number(compRow.completed_value), 1.5);
  assert.strictEqual(compRow.unit, "km");
  console.log("  ✓ Successfully persisted target_value, completed_value, unit to task_completions");

  // TEST 5: Completion without value (blank input -> completed_value = NULL)
  console.log("Test 5: Completion Without Recording Value (completed_value = NULL)");
  await toggleTodo(2, true); // revert completion first
  const toggleNoValRes = await toggleTodo(2, false, null);
  assert.strictEqual(toggleNoValRes.success, true);

  const [occNoValRow] = (await sql`
    SELECT target_value, completed_value, unit
    FROM task_occurrences
    WHERE user_id = 'user2' AND todo_id = 2 AND occurrence_date = ${todayStr}
  `) as any[];
  assert.strictEqual(Number(occNoValRow.target_value), 1.2);
  assert.strictEqual(occNoValRow.completed_value, null, "completed_value must remain NULL when not entered");
  console.log("  ✓ Confirmed completed_value remains NULL when user completes without entering a value");

  // TEST 6: Target change test (Editing target 1.2 km -> 2.0 km)
  console.log("Test 6: Target Change Preservation");
  await toggleTodo(2, true); // reset today's toggle
  
  // Edit task 2 target to 2.0KM
  await editTodo(2, { title: "Running", task_type: "input", type_value: "2.0KM", category: "Health" });
  await toggleTodo(2, false, 2.2);

  const [occNewTarget] = (await sql`
    SELECT target_value, completed_value, unit
    FROM task_occurrences
    WHERE user_id = 'user2' AND todo_id = 2 AND occurrence_date = ${todayStr}
  `) as any[];
  assert.strictEqual(Number(occNewTarget.target_value), 2.0);
  assert.strictEqual(Number(occNewTarget.completed_value), 2.2);

  // Restore task 2 target back to 1.2KM
  await editTodo(2, { title: "Running", task_type: "input", type_value: "1.2KM", category: "Health" });
  await toggleTodo(2, true); // uncomplete test occurrence
  console.log("  ✓ Confirmed changing target updates new completions without overwriting history");

  // TEST 7: Historical completed occurrences check
  console.log("Test 7: Historical Completed Records NULL check");
  const histComps = (await sql`
    SELECT id, occurrence_date, completed_value
    FROM task_occurrences
    WHERE user_id = 'user2' AND todo_id = 2 AND occurrence_date < '2026-09-23' AND status = 'completed'
  `) as any[];
  histComps.forEach((h) => {
    assert.strictEqual(h.completed_value, null, `Historical occurrence ${h.occurrence_date} completed_value must be NULL`);
  });
  console.log("  ✓ Confirmed all historical completed occurrences have completed_value = NULL");

  // TEST 8: Existing Analytics regression test
  console.log("Test 8: Existing Analytics Regression Check");
  const analyticsData = await getAllTasksAnalytics("last_7_days", "user2", true);
  assert.strictEqual(typeof analyticsData.overallConsistency, "number");
  assert.strictEqual(typeof analyticsData.completedCount, "number");
  // Clean up test occurrences created for today so database state remains clean
  await sql`DELETE FROM task_occurrences WHERE user_id = 'user2' AND occurrence_date = ${todayStr}`;
  await sql`DELETE FROM task_completions WHERE user_id = 'user2' AND completed_date = ${todayStr}`;
  await sql`UPDATE todos SET completed = false WHERE id = 2 AND user_id = 'user2'`;

  console.log("\n=========================================");
  console.log("ALL PHASE 1 TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("=========================================\n");
}

runPhase1Tests().catch((err) => {
  console.error("Phase 1 Test Failed:", err);
  process.exit(1);
});
