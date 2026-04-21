import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(DATABASE_URL + "&multipleStatements=true");

// Execute each statement individually
const statements = [
  `CREATE TABLE IF NOT EXISTS \`platform_kv\` (
    \`key\` varchar(255) NOT NULL PRIMARY KEY,
    \`value\` text NOT NULL,
    \`updated_at\` bigint NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS \`sync_run_history\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`run_type\` varchar(64) NOT NULL,
    \`status\` varchar(32) NOT NULL,
    \`ghl_total\` int DEFAULT 0,
    \`stewardly_total\` int DEFAULT 0,
    \`matched\` int DEFAULT 0,
    \`created_in_stewardly\` int DEFAULT 0,
    \`created_in_ghl\` int DEFAULT 0,
    \`updated_in_stewardly\` int DEFAULT 0,
    \`updated_in_ghl\` int DEFAULT 0,
    \`conflicts_resolved\` int DEFAULT 0,
    \`orphans_fixed\` int DEFAULT 0,
    \`errors\` int DEFAULT 0,
    \`duration_ms\` int DEFAULT 0,
    \`resume_cursor\` varchar(255),
    \`complete\` boolean DEFAULT false,
    \`triggered_by\` varchar(128),
    \`started_at\` bigint NOT NULL,
    \`completed_at\` bigint
  )`,
];

for (const stmt of statements) {
  console.log("Executing:", stmt.substring(0, 60) + "...");
  await conn.execute(stmt);
  console.log("  OK");
}

// Add indexes (may already exist)
try {
  await conn.execute("CREATE INDEX `idx_srh_status` ON `sync_run_history` (`status`)");
  console.log("  Index idx_srh_status created");
} catch (e) { console.log("  Index idx_srh_status already exists or error:", e.message); }

try {
  await conn.execute("CREATE INDEX `idx_srh_started` ON `sync_run_history` (`started_at`)");
  console.log("  Index idx_srh_started created");
} catch (e) { console.log("  Index idx_srh_started already exists or error:", e.message); }

console.log("Migration complete");
await conn.end();
