import { neon } from "@neondatabase/serverless";

export interface Todo {
  id: number;
  user_id: string;
  title: string;
  completed: boolean;
  task_type: "time" | "checkbox" | "input" | "number";
  type_value: string;
  sort_order: number;
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
      id         SERIAL PRIMARY KEY,
      user_id    TEXT    DEFAULT 'user1',
      title      TEXT    NOT NULL,
      completed  BOOLEAN DEFAULT FALSE,
      task_type  TEXT    DEFAULT 'checkbox',
      type_value TEXT    DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT 'user1'
  `;
}
