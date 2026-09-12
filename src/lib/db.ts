import { neon } from "@neondatabase/serverless";
import { AssignedDay } from "./time-utils";

export interface Todo {
  id: number;
  user_id: string;
  title: string;
  completed: boolean;
  task_type: "time" | "checkbox" | "input" | "number";
  category: string;
  type_value: string;
  sort_order: number;
  assigned_day: AssignedDay;
  last_reset_date: string;
  created_at: string;
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const sql = neon(process.env.DATABASE_URL);

// Initialize the todos table if it doesn't exist
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS todos (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT    DEFAULT 'user1',
      title           TEXT    NOT NULL,
      completed       BOOLEAN DEFAULT FALSE,
      task_type       TEXT    DEFAULT 'checkbox',
      category        TEXT    DEFAULT 'Personal',
      type_value      TEXT    DEFAULT '',
      sort_order      INTEGER DEFAULT 0,
      assigned_day    TEXT    DEFAULT 'everyday',
      last_reset_date TEXT    DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'user1'
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_day TEXT DEFAULT 'everyday'
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS last_reset_date TEXT DEFAULT ''
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal'
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS task_completions (
      id              SERIAL PRIMARY KEY,
      user_id         TEXT NOT NULL,
      todo_id         INTEGER NOT NULL,
      todo_title      TEXT NOT NULL,
      task_type       TEXT NOT NULL,
      category        TEXT NOT NULL DEFAULT 'Personal',
      completed_date  TEXT NOT NULL,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, todo_id, completed_date)
    )
  `;
  await sql`
    ALTER TABLE task_completions ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Personal'
  `;
}
