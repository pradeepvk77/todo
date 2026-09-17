import "dotenv/config";
import { initDb, sql } from "../src/lib/db";
import {
  skipTodo,
  rescheduleTodo,
  getUnreviewedMissedOccurrences,
  submitMissedTaskReview,
  updateTaskReviewReason,
  toggleTodo,
  addTodo,
  deleteTodo,
} from "../src/app/actions";
import { getISTDateString } from "../src/lib/time-utils";

async function runTaskOutcomeReviewTests() {
  console.log("🧪 Starting Task Outcome & Missed Task Review Test Suite...\n");

  const testUserId = "user1";
  process.env.TEST_USER_ID = testUserId;
  let testTodoId: number | null = null;
  const todayStr = getISTDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = getISTDateString(yesterdayDate);

  try {
    await initDb();

    // 1. Create a test task
    console.log("1. Creating test task...");
    const createRes = await addTodo({
      title: "Test Task Outcome Workflow",
      category: "Personal Growth",
      day_section: "MORNING",
      task_type: "checkbox",
    });

    if (createRes.error) {
      throw new Error(`Failed to create test task: ${createRes.error}`);
    }

    const [newTodo] = (await sql`
      SELECT id FROM todos WHERE title = 'Test Task Outcome Workflow' AND user_id = ${testUserId} ORDER BY id DESC LIMIT 1
    `) as { id: number }[];

    testTodoId = newTodo.id;
    console.log(`   ✅ Test task created with ID: ${testTodoId}`);

    // 2. Test Complete Task (without asking for reason)
    console.log("\n2. Testing Complete Task...");
    await toggleTodo(testTodoId, false);
    const [compOcc] = (await sql`
      SELECT status, completed_at FROM task_occurrences WHERE todo_id = ${testTodoId} AND occurrence_date = ${todayStr}
    `) as { status: string; completed_at?: string }[];

    if (compOcc?.status !== "completed" || !compOcc?.completed_at) {
      throw new Error(`Completion failed. Expected status 'completed', got ${compOcc?.status}`);
    }
    console.log("   ✅ Complete Task verified. Status: 'completed', completed_at:", compOcc.completed_at);

    // 3. Test Skip Task with reason
    console.log("\n3. Testing Skip Task with reason...");
    const skipRes = await skipTodo(testTodoId, todayStr, "too_tired", "Fell asleep early");
    if (skipRes.error) throw new Error(`skipTodo failed: ${skipRes.error}`);

    const [skipOcc] = (await sql`
      SELECT status, skipped_at, missed_reason, missed_reason_notes FROM task_occurrences WHERE todo_id = ${testTodoId} AND occurrence_date = ${todayStr}
    `) as { status: string; skipped_at?: string; missed_reason?: string; missed_reason_notes?: string }[];

    if (skipOcc.status !== "skipped" || skipOcc.missed_reason !== "too_tired") {
      throw new Error(`Skip failed. Expected missed_reason 'too_tired', got '${skipOcc.missed_reason}'`);
    }
    console.log("   ✅ Skip Task verified. Reason:", skipOcc.missed_reason, "Notes:", skipOcc.missed_reason_notes);

    // 4. Test Reschedule Task with new date & reason
    console.log("\n4. Testing Reschedule Task with reason...");
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getISTDateString(tomorrowDate);

    const reschedRes = await rescheduleTodo(testTodoId, {
      newScheduledDate: tomorrowStr,
      newScheduledTime: "11:00 AM",
      occurrenceDate: todayStr,
      reason: "ran_out_of_time",
      notes: "Busy with work project",
    });

    if (reschedRes.error) throw new Error(`rescheduleTodo failed: ${reschedRes.error}`);

    const [reschedOcc] = (await sql`
      SELECT status, rescheduled_at, rescheduled_to_date, rescheduled_to_time, missed_reason FROM task_occurrences WHERE todo_id = ${testTodoId} AND occurrence_date = ${todayStr}
    `) as { status: string; rescheduled_at?: string; rescheduled_to_date?: string; rescheduled_to_time?: string; missed_reason?: string }[];

    if (reschedOcc.status !== "rescheduled" || reschedOcc.rescheduled_to_date !== tomorrowStr) {
      throw new Error(`Reschedule failed. Expected target date '${tomorrowStr}', got '${reschedOcc.rescheduled_to_date}'`);
    }
    console.log("   ✅ Reschedule Task verified. Rescheduled to:", reschedOcc.rescheduled_to_date, reschedOcc.rescheduled_to_time, "Reason:", reschedOcc.missed_reason);

    // 5. Test Automatic No Action occurrence creation for yesterday
    console.log("\n5. Testing Automatic No Action & Unreviewed State for yesterday...");
    await sql`
      INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, review_status)
      VALUES (${testUserId}, ${testTodoId}, ${yesterdayStr}, 'no_action', 'unreviewed')
      ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
      SET status = 'no_action', review_status = 'unreviewed', updated_at = NOW()
    `;

    const unreviewedOccs = await getUnreviewedMissedOccurrences();
    const testUnreviewed = unreviewedOccs.find((o: any) => o.todo_id === testTodoId && o.occurrence_date === yesterdayStr);

    if (!testUnreviewed) {
      throw new Error("getUnreviewedMissedOccurrences did not return yesterday's no_action occurrence");
    }
    console.log("   ✅ Unreviewed No Action occurrence retrieved. ID:", testUnreviewed.id, "Date:", testUnreviewed.occurrence_date);

    // 6. Test Submitting Next-Day Review (distinguishing Task Outcome Reason & App Update Reason)
    console.log("\n6. Testing Submit Next-Day Review (Task Reason vs App Update Reason)...");
    const reviewRes = await submitMissedTaskReview(testUnreviewed.id, {
      missedReason: "too_tired",
      missedReasonNotes: "Exhausted from travel",
      appUpdateReason: "didnt_open_app",
      appUpdateReasonNotes: "Phone was out of battery",
    });

    if (reviewRes.error) throw new Error(`submitMissedTaskReview failed: ${reviewRes.error}`);

    const [reviewedOcc] = (await sql`
      SELECT status, review_status, reviewed_at, missed_reason, app_update_reason FROM task_occurrences WHERE id = ${testUnreviewed.id}
    `) as { status: string; review_status: string; reviewed_at?: string; missed_reason?: string; app_update_reason?: string }[];

    if (reviewedOcc.review_status !== "reviewed" || reviewedOcc.missed_reason !== "too_tired" || reviewedOcc.app_update_reason !== "didnt_open_app") {
      throw new Error(`Review submission failed. Got review_status '${reviewedOcc.review_status}', missed_reason '${reviewedOcc.missed_reason}', app_update_reason '${reviewedOcc.app_update_reason}'`);
    }
    console.log("   ✅ Next-Day Review verified! Task Reason:", reviewedOcc.missed_reason, "| App Update Reason:", reviewedOcc.app_update_reason, "| Reviewed at:", reviewedOcc.reviewed_at);

    // 7. Test User Changing Previous Review
    console.log("\n7. Testing Editing Previous Review...");
    const editRes = await updateTaskReviewReason(testUnreviewed.id, {
      missedReason: "forgot",
      missedReasonNotes: "Totally slipped my mind",
      appUpdateReason: "was_busy",
      appUpdateReasonNotes: "Had back-to-back meetings",
    });

    if (editRes.error) throw new Error(`updateTaskReviewReason failed: ${editRes.error}`);

    const [editedOcc] = (await sql`
      SELECT missed_reason, app_update_reason FROM task_occurrences WHERE id = ${testUnreviewed.id}
    `) as { missed_reason?: string; app_update_reason?: string }[];

    if (editedOcc.missed_reason !== "forgot" || editedOcc.app_update_reason !== "was_busy") {
      throw new Error(`Edit review failed. Got missed_reason '${editedOcc.missed_reason}', app_update_reason '${editedOcc.app_update_reason}'`);
    }
    console.log("   ✅ Edit review verified! Updated Task Reason:", editedOcc.missed_reason, "| Updated App Reason:", editedOcc.app_update_reason);

    console.log("\n==========================================");
    console.log("🎉 All Task Outcome & Review Tests Passed!");
    console.log("==========================================");
  } finally {
    // Cleanup test todo
    if (testTodoId) {
      await deleteTodo(testTodoId);
      console.log(`\n🧹 Cleaned up test task ID: ${testTodoId}`);
    }
  }
}

runTaskOutcomeReviewTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
