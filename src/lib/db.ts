import Database from "better-sqlite3";
import path from "path";

export interface Todo {
  id: number;
  title: string;
  completed: number; // 0 for false, 1 for true
  task_type: "time" | "checkbox" | "input" | "number";
  type_value: string;
  sort_order: number;
  created_at: string;
}

const dbPath = path.join(process.cwd(), "todos.db");

// Maintain single instance in development hot-reload mode
const globalForDb = global as unknown as { db?: Database.Database };

export const db = globalForDb.db || new Database(dbPath);

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

// Enable Write-Ahead Logging for speed & concurrency
db.pragma("journal_mode = WAL");

// Initialize table
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    task_type TEXT DEFAULT 'checkbox',
    type_value TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Safe column migrations for existing databases
try {
  const columns = db.prepare("PRAGMA table_info(todos)").all() as { name: string }[];
  const colNames = columns.map((c) => c.name);

  if (!colNames.includes("task_type")) {
    db.exec("ALTER TABLE todos ADD COLUMN task_type TEXT DEFAULT 'checkbox'");
  }
  if (!colNames.includes("type_value")) {
    db.exec("ALTER TABLE todos ADD COLUMN type_value TEXT DEFAULT ''");
  }
  if (!colNames.includes("sort_order")) {
    db.exec("ALTER TABLE todos ADD COLUMN sort_order INTEGER DEFAULT 0");
  }
} catch (e) {
  console.error("Database migration error:", e);
}
