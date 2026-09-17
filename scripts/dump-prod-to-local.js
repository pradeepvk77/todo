#!/usr/bin/env node
/**
 * Dump all production data from Neon PostgreSQL into local PostgreSQL database (todo_local).
 */

const { neon } = require("@neondatabase/serverless");
const { Client } = require("pg");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
if (!PROD_DATABASE_URL || !PROD_DATABASE_URL.includes("neon.tech")) {
  console.error("❌ Production database URL must point to Neon database (PROD_DATABASE_URL or DATABASE_URL in .env)");
  process.exit(1);
}

const LOCAL_DATABASE_URL = process.env.LOCAL_DATABASE_URL || "postgresql://postgres@localhost:5432/todo_local?host=/tmp";

async function dumpAndRestore() {
  console.log("🚀 Starting Production Data Export from Neon...");
  console.log(`🔗 Prod URL: ${PROD_DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`🏠 Local URL: ${LOCAL_DATABASE_URL}`);

  const prodSql = neon(PROD_DATABASE_URL);

  const localClient = new Client({
    connectionString: LOCAL_DATABASE_URL,
  });
  await localClient.connect();

  console.log("🔍 Discovering public tables in Neon production...");
  const tablesResult = await prodSql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `;

  const tables = tablesResult.map((r) => r.table_name);
  console.log(`📦 Found ${tables.length} table(s): ${tables.join(", ")}\n`);

  for (const table of tables) {
    console.log(`➡️ Processing table: "${table}"...`);

    // Fetch column definitions from prod
    const columns = await prodSql`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position ASC
    `;

    // Fetch all rows from prod
    const rows = await prodSql.query(`SELECT * FROM "${table}"`);
    console.log(`   Fetched ${rows.length} row(s) from Neon.`);

    // Drop table if exists locally to ensure clean schema recreation
    await localClient.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);

    // Re-create table schema based on column definitions
    const colDefs = columns.map((col) => {
      let type = col.udt_name.toUpperCase();
      if (type === "INT4") type = "INTEGER";
      if (type === "INT8") type = "BIGINT";
      if (type === "BOOL") type = "BOOLEAN";
      if (type === "VARCHAR" || type === "TEXT") type = "TEXT";
      if (type === "TIMESTAMPTZ") type = "TIMESTAMPTZ";
      if (type === "TIMESTAMP") type = "TIMESTAMP";

      let def = `"${col.column_name}" ${type}`;
      if (col.column_name === "id" && (type === "INTEGER" || type === "BIGINT")) {
        def = `"${col.column_name}" SERIAL PRIMARY KEY`;
      } else if (col.column_name === "user_id" && table === "user_preferences") {
        def = `"${col.column_name}" TEXT PRIMARY KEY`;
      }

      if (col.is_nullable === "NO" && col.column_name !== "id") {
        def += " NOT NULL";
      }
      if (col.column_default && !col.column_default.includes("nextval")) {
        def += ` DEFAULT ${col.column_default}`;
      }
      return def;
    });

    const createTableSql = `CREATE TABLE "${table}" (\n  ${colDefs.join(",\n  ")}\n);`;
    await localClient.query(createTableSql);
    console.log(`   Recreated local table "${table}".`);

    // Insert rows
    if (rows.length > 0) {
      const colNames = Object.keys(rows[0]);
      const colNamesEscaped = colNames.map((c) => `"${c}"`).join(", ");

      for (const row of rows) {
        const values = colNames.map((c) => row[c]);
        const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(", ");
        const insertSql = `INSERT INTO "${table}" (${colNamesEscaped}) VALUES (${valuePlaceholders})`;
        
        // Format non-primitive types if any
        const formattedValues = values.map((val) => {
          if (typeof val === "object" && val !== null && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        await localClient.query(insertSql, formattedValues);
      }
      console.log(`   Inserted ${rows.length} row(s) into local "${table}".`);
    }

    // Reset sequence if id column exists
    const hasId = columns.some((c) => c.column_name === "id");
    if (hasId) {
      const seqName = `${table}_id_seq`;
      await localClient.query(`
        SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true);
      `).catch(() => {});
    }
  }

  console.log("\n✅ Verification - Local Table Row Counts:");
  for (const table of tables) {
    const res = await localClient.query(`SELECT COUNT(*) FROM "${table}"`);
    console.log(`   - ${table}: ${res.rows[0].count} rows`);
  }

  await localClient.end();
  console.log("\n🎉 Prod data successfully dumped to local database!");
}

dumpAndRestore().catch((err) => {
  console.error("❌ Dump/restore error:", err);
  process.exit(1);
});
