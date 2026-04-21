import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(DATABASE_URL + "&multipleStatements=true");

const statements = [
  `CREATE TABLE IF NOT EXISTS \`crm_audit_log\` (
    \`id\` int AUTO_INCREMENT PRIMARY KEY,
    \`actor_id\` int DEFAULT NULL,
    \`actor_name\` varchar(255) DEFAULT NULL,
    \`actor_role\` varchar(64) DEFAULT NULL,
    \`action\` varchar(128) NOT NULL,
    \`category\` varchar(64) NOT NULL DEFAULT 'permission',
    \`target_type\` varchar(64) DEFAULT NULL,
    \`target_id\` varchar(255) DEFAULT NULL,
    \`target_label\` varchar(512) DEFAULT NULL,
    \`location_id\` int DEFAULT NULL,
    \`location_name\` varchar(255) DEFAULT NULL,
    \`before_state\` json DEFAULT NULL,
    \`after_state\` json DEFAULT NULL,
    \`metadata\` json DEFAULT NULL,
    \`ip_address\` varchar(45) DEFAULT NULL,
    \`created_at\` bigint NOT NULL
  )`,
];

for (const stmt of statements) {
  console.log("Executing:", stmt.substring(0, 60) + "...");
  await conn.execute(stmt);
  console.log("  OK");
}

// Add indexes
const indexes = [
  ["idx_cal_actor", "CREATE INDEX `idx_cal_actor` ON `crm_audit_log` (`actor_id`)"],
  ["idx_cal_action", "CREATE INDEX `idx_cal_action` ON `crm_audit_log` (`action`)"],
  ["idx_cal_category", "CREATE INDEX `idx_cal_category` ON `crm_audit_log` (`category`)"],
  ["idx_cal_location", "CREATE INDEX `idx_cal_location` ON `crm_audit_log` (`location_id`)"],
  ["idx_cal_target", "CREATE INDEX `idx_cal_target` ON `crm_audit_log` (`target_type`, `target_id`)"],
  ["idx_cal_created", "CREATE INDEX `idx_cal_created` ON `crm_audit_log` (`created_at`)"],
];

for (const [name, sql] of indexes) {
  try {
    await conn.execute(sql);
    console.log(`  Index ${name} created`);
  } catch (e) {
    console.log(`  Index ${name} already exists or error:`, e.message);
  }
}

console.log("Pass 31 migration complete");
await conn.end();
