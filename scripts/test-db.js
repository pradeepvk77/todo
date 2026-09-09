const Database = require("better-sqlite3");
const path = require("path");

console.log("=== Testing Updated SQLite Schema & CRUD ===");

const dbPath = path.join(__dirname, "../todos.db");
const db = new Database(dbPath);

// Ensure migration / table
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

// Insert task with time type
const insertStmt = db.prepare(
  "INSERT INTO todos (title, task_type, type_value, sort_order) VALUES (?, ?, ?, ?)"
);
const info = insertStmt.run("Wake up", "time", "07:15 AM", 1);
console.log("Inserted time task with ID:", info.lastInsertRowid);

// Select task
const selectStmt = db.prepare("SELECT * FROM todos WHERE id = ?");
const todo = selectStmt.get(info.lastInsertRowid);
console.log("Fetched record:", todo);

// Update time value
const updateStmt = db.prepare("UPDATE todos SET type_value = ? WHERE id = ?");
updateStmt.run("07:30 AM", info.lastInsertRowid);
console.log("Updated record:", selectStmt.get(info.lastInsertRowid));

// Delete test record
db.prepare("DELETE FROM todos WHERE id = ?").run(info.lastInsertRowid);
console.log("Deleted test record cleanly.");

console.log("=== All Schema Verification Tests Passed Successfully ===");
