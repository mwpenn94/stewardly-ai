/**
 * Pass 35 Migration: sync_event_metrics + location_alert_thresholds
 *
 * sync_event_metrics — tracks individual sync events from both webhook and polling
 * channels, enabling latency comparison and channel health analysis.
 *
 * location_alert_thresholds — per-location configurable warning/critical thresholds
 * for sync lag, error rate, and data freshness metrics.
 */
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);

  console.log("[P35 Migration] Creating sync_event_metrics table...");
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sync_event_metrics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id VARCHAR(128) NOT NULL,
      location_id VARCHAR(100),
      location_db_id INT,
      channel VARCHAR(20) NOT NULL COMMENT 'webhook or polling',
      event_type VARCHAR(64) NOT NULL COMMENT 'contact_create, contact_update, contact_delete, opportunity_update',
      contact_external_id VARCHAR(128),
      detected_at BIGINT NOT NULL COMMENT 'epoch ms when the event was detected by our system',
      ghl_timestamp BIGINT COMMENT 'epoch ms of the original change in GHL (if available)',
      latency_ms BIGINT COMMENT 'detected_at - ghl_timestamp (if both available)',
      payload_size INT DEFAULT 0,
      success TINYINT(1) DEFAULT 1,
      error_message TEXT,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sem_channel (channel),
      INDEX idx_sem_location (location_id),
      INDEX idx_sem_detected (detected_at),
      INDEX idx_sem_event_type (event_type),
      INDEX idx_sem_contact (contact_external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("[P35 Migration] sync_event_metrics created.");

  console.log("[P35 Migration] Creating location_alert_thresholds table...");
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS location_alert_thresholds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      location_db_id INT NOT NULL,
      location_id VARCHAR(100) NOT NULL,
      metric_name VARCHAR(64) NOT NULL COMMENT 'sync_lag_minutes, error_rate_pct, data_freshness_hours, poll_failures',
      warning_threshold DOUBLE NOT NULL,
      critical_threshold DOUBLE NOT NULL,
      enabled TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_lat_location_metric (location_db_id, metric_name),
      INDEX idx_lat_location (location_db_id),
      INDEX idx_lat_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("[P35 Migration] location_alert_thresholds created.");

  await conn.end();
  console.log("[P35 Migration] Done.");
}

run().catch((err) => {
  console.error("[P35 Migration] Error:", err);
  process.exit(1);
});
