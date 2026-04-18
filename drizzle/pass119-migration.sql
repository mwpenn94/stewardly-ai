-- Pass 119: Section 7.2 Enhancements - 5 new tables

CREATE TABLE IF NOT EXISTS `engagement_letters` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `client_id` int NOT NULL,
  `advisor_id` int NOT NULL,
  `client_name` varchar(255) NOT NULL,
  `advisor_name` varchar(255) NOT NULL,
  `firm_name` varchar(255) NOT NULL,
  `scope_json` json,
  `fee_schedule_json` json,
  `fiduciary_standard` varchar(50) DEFAULT 'fiduciary',
  `engagement_type` varchar(50) DEFAULT 'initial',
  `effective_date` varchar(20),
  `term_months` int DEFAULT 12,
  `auto_renew` boolean DEFAULT true,
  `termination_notice_days` int DEFAULT 30,
  `form_crs_json` json,
  `adv_delivery_json` json,
  `privacy_policy_delivered` boolean DEFAULT false,
  `arbitration_clause` boolean DEFAULT false,
  `status` varchar(50) DEFAULT 'draft',
  `letter_html` text,
  `letter_markdown` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_engagement_letters_client` (`client_id`),
  INDEX `idx_engagement_letters_advisor` (`advisor_id`),
  INDEX `idx_engagement_letters_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `planning_snapshots` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `client_id` int NOT NULL,
  `advisor_id` int,
  `snapshot_date` varchar(20),
  `snapshot_type` varchar(50) DEFAULT 'manual',
  `label` varchar(255),
  `nodes_json` json,
  `goals_json` json,
  `metrics_json` json,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_planning_snapshots_client` (`client_id`),
  INDEX `idx_planning_snapshots_date` (`snapshot_date`),
  INDEX `idx_planning_snapshots_type` (`snapshot_type`)
);

CREATE TABLE IF NOT EXISTS `underwriting_tracking` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `client_id` int NOT NULL,
  `carrier` varchar(255),
  `product` varchar(255),
  `status` varchar(50) DEFAULT 'submitted',
  `requirements_json` json,
  `submitted_at` varchar(30),
  `last_status_update` varchar(30),
  `expected_decision_date` varchar(30),
  `notes` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_underwriting_tracking_client` (`client_id`),
  INDEX `idx_underwriting_tracking_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `compliance_audit_samples` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `review_period` varchar(50),
  `sample_size` int,
  `selected_accounts_json` json,
  `review_type` varchar(50) DEFAULT 'random',
  `findings_json` json,
  `supervisor_id` int,
  `review_date` varchar(20),
  `status` varchar(50) DEFAULT 'pending',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_compliance_audit_samples_supervisor` (`supervisor_id`),
  INDEX `idx_compliance_audit_samples_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `privacy_consent_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `client_id` int NOT NULL,
  `advisor_id` int,
  `consent_type` varchar(50),
  `granted` boolean DEFAULT false,
  `details` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_privacy_consent_log_client` (`client_id`),
  INDEX `idx_privacy_consent_log_type` (`consent_type`)
);

-- Add archival columns to personal_financial_reviews if they don't exist
ALTER TABLE `personal_financial_reviews` ADD COLUMN IF NOT EXISTS `archived` boolean DEFAULT false;
ALTER TABLE `personal_financial_reviews` ADD COLUMN IF NOT EXISTS `archived_at` timestamp NULL;
ALTER TABLE `personal_financial_reviews` ADD COLUMN IF NOT EXISTS `retention_expiry` timestamp NULL;
