-- Pass 64d-ext7: Schema Reconciliation for lead_pipeline
-- Add columns that exist in the Drizzle schema but not in the actual DB
-- These are useful business columns that should exist

-- LinkedIn and professional info
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500) DEFAULT NULL;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS company VARCHAR(200) DEFAULT NULL;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT NULL;

-- Location info
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT NULL;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT NULL;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS zip VARCHAR(20) DEFAULT NULL;

-- Segmentation
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS target_segment VARCHAR(100) DEFAULT NULL;

-- Scoring
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS propensity_tier ENUM('hot','warm','cool','cold') DEFAULT NULL;

-- Assignment
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS assigned_advisor_id INT DEFAULT NULL;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS assigned_at BIGINT DEFAULT NULL;

-- Compliance
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS is_control_group TINYINT(1) DEFAULT 0;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS email_consent_granted TINYINT(1) DEFAULT 0;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS unsubscribed TINYINT(1) DEFAULT 0;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS pii_deletion_requested TINYINT(1) DEFAULT 0;

-- GHL integration
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS ghl_contact_id VARCHAR(200) DEFAULT NULL;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS ghl_opportunity_id VARCHAR(200) DEFAULT NULL;

-- Pipeline management
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) DEFAULT NULL;
ALTER TABLE lead_pipeline ADD COLUMN IF NOT EXISTS tags JSON DEFAULT NULL;

-- Add indexes for new columns
ALTER TABLE lead_pipeline ADD INDEX IF NOT EXISTS idx_lp_ghl_contact (ghl_contact_id);
ALTER TABLE lead_pipeline ADD INDEX IF NOT EXISTS idx_lp_assigned_advisor (assigned_advisor_id);
ALTER TABLE lead_pipeline ADD INDEX IF NOT EXISTS idx_lp_status (status);
