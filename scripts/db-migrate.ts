import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { initDb, initVocabularyTables, initReleaseNotificationsTable } from "../src/lib/db";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log("=== Running Complete Database Migration ===");

  console.log("\n1. Initializing core database tables & columns...");
  await initDb();
  console.log("   ✓ Core tables verified (todos, task_completions, task_occurrences, task_activities, push_subscriptions, user_preferences)");

  console.log("\n2. Initializing vocabulary tables...");
  await initVocabularyTables();
  console.log("   ✓ Vocabulary tables verified (daily_vocabulary, vocabulary_words)");

  console.log("\n3. Ensuring release notification tables...");
  await initReleaseNotificationsTable();
  console.log("   ✓ Release notification tables verified");

  console.log("\n4. Applying performance indexes...");
  const indexes = [
    {
      name: "todos_user_id_sort_order_idx",
      sql: sql`CREATE INDEX IF NOT EXISTS todos_user_id_sort_order_idx ON todos (user_id, sort_order ASC, created_at DESC)`,
    },
    {
      name: "todos_user_id_assigned_day_idx",
      sql: sql`CREATE INDEX IF NOT EXISTS todos_user_id_assigned_day_idx ON todos (user_id, assigned_day)`,
    },
    {
      name: "task_occurrences_user_status_date_idx",
      sql: sql`CREATE INDEX IF NOT EXISTS task_occurrences_user_status_date_idx ON task_occurrences (user_id, status, occurrence_date)`,
    },
    {
      name: "vocabulary_words_day_word_key_uidx",
      sql: sql`CREATE UNIQUE INDEX IF NOT EXISTS vocabulary_words_day_word_key_uidx ON vocabulary_words (daily_vocabulary_id, word_key)`,
    },
  ];

  for (const idx of indexes) {
    await idx.sql;
    console.log(`   ✓ Index ensured: ${idx.name}`);
  }

  console.log("\n5. Checking Hindi vocabulary data status...");
  const hindiCheck = await sql`
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN hindi_meaning IS NOT NULL AND hindi_meaning != '' THEN 1 END) as with_hindi
    FROM vocabulary_words
  `;
  console.log(`   ✓ Vocabulary words in DB: ${hindiCheck[0].total} (with Hindi meanings: ${hindiCheck[0].with_hindi})`);

  console.log("\n✅ Database migration completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
