/**
 * Pass 121 Migration — Apply financial data tables
 */
import mysql from "mysql2/promise";
import fs from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS \`data_access_audit\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`adapter_id\` varchar(50) NOT NULL,
    \`action\` varchar(100) NOT NULL,
    \`user_id\` int NOT NULL,
    \`client_id\` int,
    \`request_params\` text,
    \`response_status\` varchar(20) NOT NULL,
    \`latency_ms\` int,
    \`timestamp\` bigint NOT NULL
  )`,
  `CREATE INDEX \`idx_data_access_audit_adapter\` ON \`data_access_audit\` (\`adapter_id\`)`,
  `CREATE INDEX \`idx_data_access_audit_user\` ON \`data_access_audit\` (\`user_id\`)`,
  `CREATE INDEX \`idx_data_access_audit_ts\` ON \`data_access_audit\` (\`timestamp\`)`,
  `CREATE TABLE IF NOT EXISTS \`pfm_imports\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`user_id\` int NOT NULL,
    \`source\` varchar(30) NOT NULL,
    \`filename\` varchar(255),
    \`total_rows\` int DEFAULT 0,
    \`imported_rows\` int DEFAULT 0,
    \`skipped_rows\` int DEFAULT 0,
    \`date_range_start\` varchar(10),
    \`date_range_end\` varchar(10),
    \`category_breakdown\` text,
    \`warnings\` text,
    \`status\` varchar(20) DEFAULT 'completed',
    \`created_at\` timestamp DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX \`idx_pfm_imports_user\` ON \`pfm_imports\` (\`user_id\`)`,
  `CREATE INDEX \`idx_pfm_imports_status\` ON \`pfm_imports\` (\`status\`)`,
  `CREATE TABLE IF NOT EXISTS \`data_authorizations\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`client_id\` int NOT NULL,
    \`advisor_id\` int NOT NULL,
    \`data_scope\` varchar(100) NOT NULL,
    \`consent_language\` text,
    \`state_jurisdiction\` varchar(50),
    \`granted_at\` bigint NOT NULL,
    \`expires_at\` bigint,
    \`revoked_at\` bigint,
    \`status\` varchar(20) DEFAULT 'active'
  )`,
  `CREATE INDEX \`idx_data_auth_client\` ON \`data_authorizations\` (\`client_id\`)`,
  `CREATE INDEX \`idx_data_auth_advisor\` ON \`data_authorizations\` (\`advisor_id\`)`,
  `CREATE INDEX \`idx_data_auth_status\` ON \`data_authorizations\` (\`status\`)`,
];

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  for (const sql of statements) {
    try {
      await conn.execute(sql);
      console.log("OK:", sql.substring(0, 60) + "...");
    } catch (err) {
      // Ignore "index already exists" errors
      if (err.code === "ER_DUP_KEYNAME" || err.message?.includes("Duplicate key name")) {
        console.log("SKIP (exists):", sql.substring(0, 60) + "...");
      } else {
        console.error("ERROR:", err.message, "\nSQL:", sql.substring(0, 80));
      }
    }
  }
  await conn.end();
  console.log("Migration complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
