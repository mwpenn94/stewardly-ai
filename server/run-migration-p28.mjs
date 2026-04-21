import mysql from "mysql2/promise";

const pool = mysql.createPool(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS ghl_locations (
    id int NOT NULL AUTO_INCREMENT,
    location_id varchar(100) NOT NULL,
    name varchar(256) NOT NULL,
    region varchar(128) DEFAULT NULL,
    organization_id int DEFAULT NULL,
    is_active tinyint(1) DEFAULT 1,
    sync_direction enum('bidirectional','pull_only','push_only','disabled') DEFAULT 'bidirectional',
    sync_frequency enum('hourly','every_6h','daily','weekly','manual') DEFAULT 'daily',
    conflict_policy enum('ghl_wins','stewardly_wins','newest_wins','manual_review') DEFAULT 'newest_wins',
    max_contacts_per_run int DEFAULT 0,
    rate_limit_ms int DEFAULT 50,
    api_key_encrypted text DEFAULT NULL,
    last_sync_at bigint DEFAULT NULL,
    last_sync_cursor varchar(255) DEFAULT NULL,
    last_sync_status enum('success','partial','failed','running') DEFAULT NULL,
    total_contacts int DEFAULT 0,
    linked_contacts int DEFAULT 0,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ghl_locations_location_id (location_id),
    KEY idx_ghl_locations_org (organization_id),
    KEY idx_ghl_locations_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS user_locations (
    id int NOT NULL AUTO_INCREMENT,
    user_id int NOT NULL,
    ghl_location_id int NOT NULL,
    access_level enum('view','manage','admin') DEFAULT 'view',
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_locations_user (user_id),
    KEY idx_user_locations_location (ghl_location_id),
    KEY idx_user_locations_unique (user_id, ghl_location_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `ALTER TABLE lead_pipeline ADD COLUMN location_id int DEFAULT NULL`,
  `ALTER TABLE lead_pipeline ADD INDEX idx_lead_pipeline_location (location_id)`,

  `ALTER TABLE integration_webhook_events ADD COLUMN location_id int DEFAULT NULL`,
  `ALTER TABLE integration_webhook_events ADD INDEX idx_iwe_location (location_id)`,

  `ALTER TABLE sync_run_history ADD COLUMN location_id int DEFAULT NULL`,
  `ALTER TABLE sync_run_history ADD INDEX idx_srh_location (location_id)`,

  `INSERT INTO ghl_locations (location_id, name, region, is_active, sync_direction, sync_frequency, conflict_policy)
   VALUES ('yUVrjyvzf0txCiJXuYGn', 'Stewardly HQ (Default)', 'National', 1, 'bidirectional', 'daily', 'newest_wins')
   ON DUPLICATE KEY UPDATE name = VALUES(name)`,
];

for (const stmt of statements) {
  try {
    await pool.query(stmt);
    console.log("OK:", stmt.slice(0, 80).replace(/\n/g, " ") + "...");
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.code === "ER_DUP_KEYNAME" || err.message?.includes("Duplicate")) {
      console.log("SKIP (exists):", stmt.slice(0, 80).replace(/\n/g, " "));
    } else {
      console.error("FAIL:", stmt.slice(0, 80).replace(/\n/g, " "), "→", err.message);
    }
  }
}

await pool.end();
console.log("Migration complete.");
