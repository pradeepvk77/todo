const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/todo_local?host=/tmp",
});

function parseTargetValueAndUnit(typeValue) {
  if (!typeValue || !typeValue.trim()) {
    return { targetValue: null, unit: "" };
  }
  const str = typeValue.trim();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z%]*)$/);
  if (match) {
    const val = parseFloat(match[1]);
    const unit = match[2] ? match[2].toLowerCase() : "";
    return { targetValue: isNaN(val) ? null : val, unit };
  }
  return { targetValue: null, unit: "" };
}

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Starting Phase 1 Quantitative Schema Migration...");
    await client.query("BEGIN");

    // 1. Add nullable quantitative columns to todos, task_occurrences, task_completions
    await client.query(`
      ALTER TABLE todos
        ADD COLUMN IF NOT EXISTS target_value NUMERIC(10,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT NULL;
    `);

    await client.query(`
      ALTER TABLE task_occurrences
        ADD COLUMN IF NOT EXISTS target_value NUMERIC(10,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS completed_value NUMERIC(10,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT NULL;
    `);

    await client.query(`
      ALTER TABLE task_completions
        ADD COLUMN IF NOT EXISTS target_value NUMERIC(10,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS completed_value NUMERIC(10,2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT NULL;
    `);
    console.log("  ✓ Added target_value, completed_value, and unit columns.");

    // 2. Populate target_value and unit on existing todos from type_value
    const todosRes = await client.query("SELECT id, type_value, task_type FROM todos");
    let updatedTodosCount = 0;

    for (const todo of todosRes.rows) {
      if (todo.task_type === "input" || todo.task_type === "number") {
        const { targetValue, unit } = parseTargetValueAndUnit(todo.type_value);
        if (targetValue !== null || unit) {
          await client.query(
            "UPDATE todos SET target_value = $1, unit = $2 WHERE id = $3",
            [targetValue, unit, todo.id]
          );
          updatedTodosCount++;
        }
      }
    }
    console.log(`  ✓ Populated target_value and unit on ${updatedTodosCount} measurable todos.`);
    console.log("  ✓ Historical completed_value records left as NULL (no fabricated data).");

    await client.query("COMMIT");
    console.log("Migration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, transaction rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
