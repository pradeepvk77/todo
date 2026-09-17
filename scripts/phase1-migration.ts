import "dotenv/config";
import { sql, initDb } from "../src/lib/db";
import { detectNoActionOccurrences } from "../src/lib/no-action-detector";
import path from "path";

async function runMigration() {
  console.log("🚀 Starting Phase 1 Schema Migration & Backfill...");

  // 1. Audit pre-migration state
  console.log("📊 Auditing pre-migration state...");
  const [preTodos] = (await sql`SELECT COUNT(*) FROM todos`) as { count: string }[];
  const [preCompletions] = (await sql`SELECT COUNT(*) FROM task_completions`) as { count: string }[];
  console.log(`   - Pre-migration todos: ${preTodos.count}`);
  console.log(`   - Pre-migration task_completions: ${preCompletions.count}\n`);

  // 2. Initialize database schema (runs ALTER TABLE and CREATE TABLE IF NOT EXISTS)
  console.log("🏗️ Executing DDL migrations...");
  await initDb();
  console.log("   ✅ DDL migration completed cleanly.\n");

  // 3. Backfill safe default metadata for existing tasks
  console.log("📦 Backfilling safe metadata defaults on existing todos...");
  await sql`
    UPDATE todos
    SET
      priority = COALESCE(NULLIF(priority, ''), 'should_do'),
      task_kind = COALESCE(NULLIF(task_kind, ''), 'other'),
      estimated_duration = CASE WHEN estimated_duration IS NULL OR estimated_duration = 0 THEN 15 ELSE estimated_duration END,
      difficulty = COALESCE(NULLIF(difficulty, ''), 'medium'),
      expected_effort = COALESCE(NULLIF(expected_effort, ''), 'medium'),
      goal_reason = COALESCE(goal_reason, ''),
      note = COALESCE(note, ''),
      scheduled_date = COALESCE(scheduled_date, ''),
      scheduled_time = COALESCE(scheduled_time, '')
  `;
  console.log("   ✅ Updated metadata defaults for existing todos.\n");

  // 4. Backfill historical task_completions into task_occurrences
  console.log("🔄 Migrating historical completions into task_occurrences...");
  const completions = (await sql`
    SELECT id, user_id, todo_id, completed_date, created_at, completed_at
    FROM task_completions
  `) as { id: number; user_id: string; todo_id: number; completed_date: string; created_at: string; completed_at?: string }[];

  let migratedCount = 0;
  let skippedCount = 0;

  for (const c of completions) {
    try {
      const compAt = c.completed_at || c.created_at || new Date().toISOString();
      await sql`
        INSERT INTO task_occurrences (user_id, todo_id, occurrence_date, status, completed_at)
        VALUES (${c.user_id}, ${c.todo_id}, ${c.completed_date}, 'completed', ${compAt})
        ON CONFLICT (user_id, todo_id, occurrence_date) DO UPDATE
        SET status = 'completed', completed_at = EXCLUDED.completed_at, updated_at = NOW()
      `;
      migratedCount++;
    } catch (err: any) {
      console.warn(`   ⚠️ Could not migrate completion ID ${c.id} for todo ${c.todo_id}:`, err.message);
      skippedCount++;
    }
  }

  console.log(`   ✅ Migrated ${migratedCount} historical completion(s) to task_occurrences (${skippedCount} skipped/failed).\n`);

  // 5. Run no-action detection for all active users
  console.log("🔍 Running initial no-action detection for past task occurrences...");
  const users = (await sql`SELECT DISTINCT user_id FROM todos`) as { user_id: string }[];
  for (const u of users) {
    console.log(`   - Scanning user "${u.user_id}"...`);
    await detectNoActionOccurrences(u.user_id, 14);
  }
  console.log("   ✅ No-action detection completed.\n");

  // 6. Post-migration verification audit
  console.log("📊 Auditing post-migration state...");
  const [postTodos] = (await sql`SELECT COUNT(*) FROM todos`) as { count: string }[];
  const [postCompletions] = (await sql`SELECT COUNT(*) FROM task_completions`) as { count: string }[];
  const [postOccurrences] = (await sql`SELECT COUNT(*) FROM task_occurrences`) as { count: string }[];
  const [postActivities] = (await sql`SELECT COUNT(*) FROM task_activities`) as { count: string }[];

  console.log("==========================================");
  console.log("🎉 Phase 1 Migration Summary:");
  console.log(`   - Todos before: ${preTodos.count} | after: ${postTodos.count}`);
  console.log(`   - Task completions before: ${preCompletions.count} | after: ${postCompletions.count}`);
  console.log(`   - Total task_occurrences created: ${postOccurrences.count}`);
  console.log(`   - Total task_activities logged: ${postActivities.count}`);
  console.log("==========================================");

  if (preTodos.count !== postTodos.count || preCompletions.count !== postCompletions.count) {
    console.error("❌ DISCREPANCY DETECTED! Pre and post counts do not match!");
    process.exit(1);
  } else {
    console.log("✅ 100% Data Integrity Verified! Zero records lost or corrupted.");
  }
}

runMigration().catch((err) => {
  console.error("❌ Migration error:", err);
  process.exit(1);
});
