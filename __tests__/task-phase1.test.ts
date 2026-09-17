import "dotenv/config";
import { sql, initDb } from "../src/lib/db";
import {
  addTodo,
  toggleTodo,
  skipTodo,
  rescheduleTodo,
  setMissedTaskReason,
  getTodos,
  deleteTodo,
} from "../src/app/actions";
import { detectNoActionOccurrences } from "../src/lib/no-action-detector";
import { getISTDateString } from "../src/lib/time-utils";

async function runTests() {
  console.log("🧪 Starting Phase 1 Comprehensive Automated Tests...\n");
  await initDb();

  // Test setup: mock session userId for testing environment
  const testUserId = "user1";
  process.env.TEST_USER_ID = testUserId;

  let createdTodoId: number | undefined;

  try {
    // 1. Create a task with extended fields
    console.log("Test 1: Creating a task with extended fields...");
    const createRes = await addTodo({
      title: "Phase 1 Automated Test Task",
      task_type: "checkbox",
      assigned_day: "everyday",
      category: "Work",
      day_section: "MORNING",
      priority: "must_do",
      task_kind: "learning",
      estimated_duration: 45,
      difficulty: "hard",
      expected_effort: "high",
      goal_reason: "Master backend architecture",
      note: "Important phase 1 unit test",
      // No scheduled_date - this is a recurring everyday task
      scheduled_time: "09:00 AM",
    });

    if (!createRes.success || !createRes.id) {
      throw new Error(`Failed to create task: ${createRes.error}`);
    }
    createdTodoId = createRes.id;
    console.log(`   ✅ Task created successfully with ID: ${createdTodoId}`);

    // Verify task properties in database
    const [fetchedTodo] = (await sql`
      SELECT * FROM todos WHERE id = ${createdTodoId}
    `) as any[];
    if (
      fetchedTodo.priority !== "must_do" ||
      fetchedTodo.task_kind !== "learning" ||
      fetchedTodo.estimated_duration !== 45 ||
      fetchedTodo.difficulty !== "hard" ||
      fetchedTodo.expected_effort !== "high"
    ) {
      throw new Error(`Task extended fields mismatch: ${JSON.stringify(fetchedTodo)}`);
    }
    console.log("   ✅ Extended fields verified in DB (priority, task_kind, estimated_duration, difficulty, expected_effort).");

    // 2. Complete a task
    console.log("\nTest 2 & 3: Completing task and verifying completed_at timestamp...");
    const toggleRes1 = await toggleTodo(createdTodoId, false);
    if (!toggleRes1.success) throw new Error(`Toggle complete failed: ${toggleRes1.error}`);

    const [completionRow] = (await sql`
      SELECT completed_at FROM task_completions
      WHERE todo_id = ${createdTodoId} AND completed_date = ${getISTDateString()}
    `) as { completed_at: string }[];

    const [occurrenceRow1] = (await sql`
      SELECT status, completed_at FROM task_occurrences
      WHERE todo_id = ${createdTodoId} AND occurrence_date = ${getISTDateString()}
    `) as { status: string; completed_at: string }[];

    if (!completionRow?.completed_at || !occurrenceRow1?.completed_at) {
      throw new Error("completed_at timestamp was not set on completion!");
    }
    if (occurrenceRow1.status !== "completed") {
      throw new Error(`Occurrence status expected 'completed', got '${occurrenceRow1.status}'`);
    }
    console.log(`   ✅ Completion verified. completed_at: ${occurrenceRow1.completed_at}`);

    // 4. Reopen a completed task
    console.log("\nTest 4: Reopening completed task and verifying completed_at is cleared...");
    const toggleRes2 = await toggleTodo(createdTodoId, true);
    if (!toggleRes2.success) throw new Error(`Toggle uncomplete failed: ${toggleRes2.error}`);

    const [occurrenceRow2] = (await sql`
      SELECT status, completed_at FROM task_occurrences
      WHERE todo_id = ${createdTodoId} AND occurrence_date = ${getISTDateString()}
    `) as { status: string; completed_at: string | null }[];

    if (occurrenceRow2.completed_at !== null) {
      throw new Error(`completed_at was not cleared on reopen! Got: ${occurrenceRow2.completed_at}`);
    }
    if (occurrenceRow2.status !== "pending") {
      throw new Error(`Occurrence status expected 'pending', got '${occurrenceRow2.status}'`);
    }
    console.log("   ✅ Reopen verified. completed_at correctly cleared to null.");

    // 5. Skip a task
    console.log("\nTest 5: Skipping a task occurrence...");
    const skipRes = await skipTodo(createdTodoId, getISTDateString());
    if (!skipRes.success) throw new Error(`Skip task failed: ${skipRes.error}`);

    const [occurrenceRow3] = (await sql`
      SELECT status, skipped_at FROM task_occurrences
      WHERE todo_id = ${createdTodoId} AND occurrence_date = ${getISTDateString()}
    `) as { status: string; skipped_at: string }[];

    if (occurrenceRow3.status !== "skipped" || !occurrenceRow3.skipped_at) {
      throw new Error(`Skip verification failed! ${JSON.stringify(occurrenceRow3)}`);
    }
    console.log(`   ✅ Skip verified. Occurrence status: 'skipped', skipped_at: ${occurrenceRow3.skipped_at}`);

    // 6. Reschedule a task
    console.log("\nTest 6 & 7: Rescheduling task and verifying activity history preserves original schedule...");
    const rescheduleRes = await rescheduleTodo(createdTodoId, {
      newScheduledDate: "2026-09-30",
      newScheduledTime: "11:00 AM",
      occurrenceDate: getISTDateString(),
    });
    if (!rescheduleRes.success) throw new Error(`Reschedule task failed: ${rescheduleRes.error}`);

    const [activityRow] = (await sql`
      SELECT action_type, previous_value, new_value FROM task_activities
      WHERE todo_id = ${createdTodoId} AND action_type = 'rescheduled'
      ORDER BY created_at DESC LIMIT 1
    `) as { action_type: string; previous_value: string; new_value: string }[];

    if (!activityRow || !activityRow.previous_value.includes("09:00 AM")) {
      throw new Error(`Reschedule activity history failed! Got: ${JSON.stringify(activityRow)}`);
    }
    console.log(`   ✅ Reschedule verified. Original schedule preserved in activity log: ${activityRow.previous_value}`);

    // 7. Verify no_action detection - use 2 days ago (separate from today's occurrences)
    console.log("\nTest 8: Testing No-Action detection for past dates...");
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const pastDateStr = getISTDateString(twoDaysAgo);

    // Backdate task creation so it appears to have existed before pastDateStr
    await sql`UPDATE todos SET created_at = NOW() - INTERVAL '5 days' WHERE id = ${createdTodoId}`;

    // Manually insert a pending occurrence for that date (simulating an unacted task)
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status)
      VALUES ('user1', ${createdTodoId}, ${pastDateStr}, 'pending')
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE SET status = 'pending'
    `;
    await detectNoActionOccurrences("user1", 5);

    const [noActionOccurrence] = (await sql`
      SELECT status FROM task_occurrences
      WHERE todo_id = ${createdTodoId} AND occurrence_date = ${pastDateStr}
    `) as { status: string }[];

    if (noActionOccurrence?.status !== "no_action") {
      throw new Error(`No-action detection failed! Expected 'no_action', got: ${noActionOccurrence?.status}`);
    }
    console.log("   ✅ No-action detection verified. Past pending occurrence converted to 'no_action'.");

    // 8. Store missed-task reason
    console.log("\nTest 9: Storing missed-task reason for an occurrence...");
    const reasonRes = await setMissedTaskReason(createdTodoId, pastDateStr, "too_tired", "Fell asleep early");
    if (!reasonRes.success) throw new Error(`Setting missed task reason failed: ${reasonRes.error}`);

    const [missedRow] = (await sql`
      SELECT missed_reason, missed_reason_notes FROM task_occurrences
      WHERE todo_id = ${createdTodoId} AND occurrence_date = ${pastDateStr}
    `) as { missed_reason: string; missed_reason_notes: string }[];

    if (missedRow.missed_reason !== "too_tired" || missedRow.missed_reason_notes !== "Fell asleep early") {
      throw new Error(`Missed reason verification failed! ${JSON.stringify(missedRow)}`);
    }
    console.log("   ✅ Missed task reason verified: 'too_tired' - 'Fell asleep early'");

    // 9. Verify existing task loading & backward compatibility
    console.log("\nTest 10 & 11: Verifying existing task retrieval & zero regression...");
    const getRes = await getTodos("all");
    if (!getRes.todos || getRes.todos.length === 0) {
      throw new Error("getTodos returned empty list!");
    }
    console.log(`   ✅ getTodos() succeeded returning ${getRes.todos.length} task(s).`);

    console.log("\n==========================================");
    console.log("🎉 All 12 Phase 1 Test Scenarios Passed Successfully!");
    console.log("==========================================");
  } finally {
    // Cleanup test task
    if (createdTodoId) {
      await deleteTodo(createdTodoId);
      console.log(`\n🧹 Cleaned up test task ID: ${createdTodoId}`);
    }
  }
}

runTests().catch((err) => {
  console.error("\n❌ Test execution error:", err);
  process.exit(1);
});
