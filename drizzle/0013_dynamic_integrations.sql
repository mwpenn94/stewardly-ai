-- Migration: 0013_dynamic_integrations.sql
-- Adds tables for the user/AI-defined dynamic integration + pipeline CRUD runtime.
-- Lets operators wire up any data source (documented or not) without writing code,
-- and lets the AI draft blueprints from a URL + description.

CREATE TABLE IF NOT EXISTS integration_blueprints (
  id VARCHAR(36) PRIMARY KEY,
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  owner_id INT,
  organization_id INT,
  ownership_tier VARCHAR(20) NOT NULL DEFAULT 'professional',
  visibility VARCHAR(20) NOT NULL DEFAULT 'private',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  source_kind VARCHAR(20) NOT NULL,
  source_config JSON NOT NULL,
  auth_config JSON,
  extraction_config JSON NOT NULL,
  transform_steps JSON NOT NULL,
  validation_rules JSON,
  sink_config JSON NOT NULL,
  schedule_cron VARCHAR(100),
  rate_limit_per_min INT DEFAULT 60,
  max_records_per_run INT DEFAULT 10000,
  current_version INT NOT NULL DEFAULT 1,
  ai_drafted BOOLEAN DEFAULT FALSE,
  ai_drafted_by VARCHAR(100),
  tags JSON,
  last_run_at BIGINT,
  last_run_status VARCHAR(20),
  last_run_error TEXT,
  total_runs INT DEFAULT 0,
  total_records_ingested INT DEFAULT 0,
  created_by INT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_blueprint_slug (slug),
  INDEX idx_blueprint_owner (owner_id),
  INDEX idx_blueprint_org (organization_id),
  INDEX idx_blueprint_status (status)
);

CREATE TABLE IF NOT EXISTS integration_blueprint_versions (
  id VARCHAR(36) PRIMARY KEY,
  blueprint_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  snapshot_json JSON NOT NULL,
  change_note TEXT,
  created_by INT,
  created_at BIGINT NOT NULL,
  INDEX idx_bpv_blueprint (blueprint_id),
  UNIQUE INDEX idx_bpv_blueprint_version (blueprint_id, version)
);

CREATE TABLE IF NOT EXISTS integration_blueprint_samples (
  id VARCHAR(36) PRIMARY KEY,
  blueprint_id VARCHAR(36) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  raw_sample LONGTEXT,
  raw_format VARCHAR(20),
  inferred_schema JSON NOT NULL,
  record_count INT NOT NULL DEFAULT 0,
  source_hash VARCHAR(64),
  fetched_at BIGINT NOT NULL,
  INDEX idx_bps_blueprint (blueprint_id)
);

CREATE TABLE IF NOT EXISTS integration_blueprint_runs (
  id VARCHAR(36) PRIMARY KEY,
  blueprint_id VARCHAR(36) NOT NULL,
  blueprint_version INT NOT NULL DEFAULT 1,
  triggered_by INT,
  trigger_source VARCHAR(30) NOT NULL DEFAULT 'manual',
  dry_run BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  records_fetched INT DEFAULT 0,
  records_parsed INT DEFAULT 0,
  records_transformed INT DEFAULT 0,
  records_validated INT DEFAULT 0,
  records_written INT DEFAULT 0,
  records_skipped INT DEFAULT 0,
  records_errored INT DEFAULT 0,
  error_log TEXT,
  warnings JSON,
  output_summary JSON,
  started_at BIGINT NOT NULL,
  completed_at BIGINT,
  duration_ms INT,
  INDEX idx_bpr_blueprint (blueprint_id),
  INDEX idx_bpr_status (status),
  INDEX idx_bpr_started (started_at)
);
