#!/usr/bin/env node
/**
 * Helper script to manage local PostgreSQL server lifecycle for the Todo app.
 *
 * Usage:
 *   node scripts/db-manager.js start
 *   node scripts/db-manager.js stop
 *   node scripts/db-manager.js status
 */

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const pgDataDir = path.join(__dirname, "../.pgdata");
const logFile = path.join(pgDataDir, "logfile");
const action = process.argv[2] || "status";

if (!fs.existsSync(pgDataDir)) {
  console.error("❌ Local database directory (.pgdata) does not exist.");
  process.exit(1);
}

switch (action) {
  case "start": {
    try {
      execSync(`/usr/lib/postgresql/14/bin/pg_isready -h /tmp -p 5432`, { stdio: "ignore" });
      console.log("⚡ Local PostgreSQL database is already running!");
    } catch {
      console.log("🚀 Starting local PostgreSQL database server...");
      const bg = spawn(
        "/usr/lib/postgresql/14/bin/postgres",
        ["-D", pgDataDir, "-p", "5432", "-k", "/tmp"],
        { detached: true, stdio: "ignore" }
      );
      bg.unref();
      console.log("✅ Local PostgreSQL database started on port 5432.");
    }
    break;
  }
  case "stop": {
    try {
      execSync(`/usr/lib/postgresql/14/bin/pg_ctl -D "${pgDataDir}" stop -m fast`, { stdio: "inherit" });
      console.log("🛑 Local PostgreSQL database stopped.");
    } catch (err) {
      console.error("⚠️ Failed to stop PostgreSQL (it may not be running).");
    }
    break;
  }
  case "status": {
    try {
      const output = execSync(`/usr/lib/postgresql/14/bin/pg_isready -h /tmp -p 5432`).toString();
      console.log("🟢 Status:", output.trim());
    } catch {
      console.log("🔴 Local PostgreSQL database server is NOT running.");
    }
    break;
  }
  default:
    console.log("Usage: node scripts/db-manager.js [start|stop|status]");
}
