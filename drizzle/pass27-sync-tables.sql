-- Pass 27: Platform KV Store + Sync Run History tables
-- Platform KV: lightweight key-value for sync stats, configs
CREATE TABLE IF NOT EXISTS `platform_kv` (
  `key` varchar(255) NOT NULL PRIMARY KEY,
  `value` text NOT NULL,
  `updated_at` bigint NOT NULL
);

-- Sync Run History: audit trail for reconciliation runs
CREATE TABLE IF NOT EXISTS `sync_run_history` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `run_type` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL,
  `ghl_total` int DEFAULT 0,
  `stewardly_total` int DEFAULT 0,
  `matched` int DEFAULT 0,
  `created_in_stewardly` int DEFAULT 0,
  `created_in_ghl` int DEFAULT 0,
  `updated_in_stewardly` int DEFAULT 0,
  `updated_in_ghl` int DEFAULT 0,
  `conflicts_resolved` int DEFAULT 0,
  `orphans_fixed` int DEFAULT 0,
  `errors` int DEFAULT 0,
  `duration_ms` int DEFAULT 0,
  `resume_cursor` varchar(255),
  `complete` boolean DEFAULT false,
  `triggered_by` varchar(128),
  `started_at` bigint NOT NULL,
  `completed_at` bigint
);

CREATE INDEX `idx_srh_status` ON `sync_run_history` (`status`);
CREATE INDEX `idx_srh_started` ON `sync_run_history` (`started_at`);
