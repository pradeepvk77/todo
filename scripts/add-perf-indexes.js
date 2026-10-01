require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function addIndexes() {
  console.log("Adding performance indexes to PostgreSQL...");
  
  await sql`
    CREATE INDEX IF NOT EXISTS todos_user_id_sort_order_idx 
    ON todos (user_id, sort_order ASC, created_at DESC)
  `;
  console.log("✓ Created index todos_user_id_sort_order_idx");

  await sql`
    CREATE INDEX IF NOT EXISTS todos_user_id_assigned_day_idx 
    ON todos (user_id, assigned_day)
  `;
  console.log("✓ Created index todos_user_id_assigned_day_idx");

  await sql`
    CREATE INDEX IF NOT EXISTS task_occurrences_user_status_date_idx 
    ON task_occurrences (user_id, status, occurrence_date)
  `;
  console.log("✓ Created index task_occurrences_user_status_date_idx");

  console.log("All performance indexes added successfully!");
}

addIndexes().catch(console.error);
