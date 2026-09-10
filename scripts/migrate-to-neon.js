#!/usr/bin/env node
/**
 * One-time migration script: SQLite (todos.db) → Neon PostgreSQL
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/migrate-to-neon.js
 *
 * Requirements:
 *   - better-sqlite3 installed locally (or run before uninstalling it)
 *   - todos.db present at project root
 *   - DATABASE_URL env var pointing to your Neon database
 */

const Database = require("better-sqlite3");
const { neon } = require("@neondatabase/serverless");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set. Export it before running this script.");
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "todos.db");
const sqliteDb = new Database(dbPath, { readonly: true });
const sql = neon(DATABASE_URL);

async function migrate() {
  console.log("📖  Reading todos from SQLite…");
  const todos = sqliteDb.prepare("SELECT * FROM todos ORDER BY id ASC").all();
  console.log(`   Found ${todos.length} row(s).`);

  if (todos.length === 0) {
    console.log("✅  Nothing to migrate.");
    return;
  }

  console.log("🏗️   Ensuring table exists in Neon…");
  await sql`
    CREATE TABLE IF NOT EXISTS todos (
      id         SERIAL PRIMARY KEY,
      title      TEXT    NOT NULL,
      completed  BOOLEAN DEFAULT FALSE,
      task_type  TEXT    DEFAULT 'checkbox',
      type_value TEXT    DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log("📤  Inserting rows into Neon…");
  for (const todo of todos) {
    await sql`
      INSERT INTO todos (title, completed, task_type, type_value, sort_order, created_at)
      VALUES (
        ${todo.title},
        ${Boolean(todo.completed)},
        ${todo.task_type ?? "checkbox"},
        ${todo.type_value ?? ""},
        ${todo.sort_order ?? 0},
        ${todo.created_at ?? new Date().toISOString()}
      )
    `;
    process.stdout.write(".");
  }

  console.log(`\n✅  Successfully migrated ${todos.length} todo(s) to Neon!`);
  sqliteDb.close();
}

migrate().catch((err) => {
  console.error("❌  Migration failed:", err);
  process.exit(1);
});
