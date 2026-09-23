const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/todo_local?host=/tmp",
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Starting Phase 2 Foreign Key Migration...");
    await client.query("BEGIN");

    // 1. Identify orphan rows
    const orphanRes = await client.query(`
      SELECT id, user_id, todo_id, completed_date, created_at
      FROM task_completions
      WHERE todo_id NOT IN (SELECT id FROM todos)
    `);

    console.log(`Found ${orphanRes.rowCount} orphan task_completions rows:`);
    console.table(orphanRes.rows);

    // 2. Delete orphan rows
    if (orphanRes.rowCount > 0) {
      const deleteRes = await client.query(`
        DELETE FROM task_completions
        WHERE todo_id NOT IN (SELECT id FROM todos)
      `);
      console.log(`Cleaned ${deleteRes.rowCount} orphan task_completions rows.`);
    } else {
      console.log("No orphan rows to clean.");
    }

    // 3. Add FK constraint if not exists
    const checkFkRes = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'task_completions'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_task_completions_todo_id'
    `);

    if (checkFkRes.rowCount === 0) {
      await client.query(`
        ALTER TABLE task_completions
        ADD CONSTRAINT fk_task_completions_todo_id
        FOREIGN KEY (todo_id) REFERENCES todos(id)
        ON DELETE CASCADE
      `);
      console.log("Successfully added Foreign Key constraint 'fk_task_completions_todo_id' to task_completions.");
    } else {
      console.log("Foreign Key constraint 'fk_task_completions_todo_id' already exists.");
    }

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
