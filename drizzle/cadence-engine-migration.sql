-- Cadence Engine Migration
-- Expert Panel A — Convergence Pass
-- Creates: cadence_enrollments, cadence_touch_log, cadence_compliance_audit,
--          cadence_opt_out_registry, meddpicc_scores, recruit_dimension_scores,
--          hnw_narrative_scores, pattern_transition_assessments

CREATE TABLE IF NOT EXISTS `cadence_enrollments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `lead_id` int NOT NULL,
  `cadence_id` varchar(100) NOT NULL,
  `cadence_status` enum('active','paused','completed','stopped','opted_out') DEFAULT 'active',
  `current_touch_number` int DEFAULT 0,
  `total_touches` int NOT NULL,
  `enrolled_at` bigint NOT NULL,
  `paused_at` bigint,
  `pause_reason` varchar(255),
  `completed_at` bigint,
  `stopped_at` bigint,
  `stop_reason` varchar(255),
  `next_touch_due_at` bigint,
  `esi_pre_approval_id` varchar(100),
  `esi_pre_approval_expiry` bigint,
  `anti_rebate_verified` boolean DEFAULT false,
  `metadata` json,
  INDEX `idx_ce_user_lead` (`user_id`, `lead_id`),
  INDEX `idx_ce_status` (`cadence_status`),
  INDEX `idx_ce_next_touch` (`next_touch_due_at`)
);

CREATE TABLE IF NOT EXISTS `cadence_touch_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` int NOT NULL,
  `user_id` int NOT NULL,
  `lead_id` int NOT NULL,
  `cadence_id` varchar(100) NOT NULL,
  `touch_number` int NOT NULL,
  `channel` varchar(50) NOT NULL,
  `touch_status` enum('drafted','approved','sent','delivered','opened','replied','bounced','failed','skipped') DEFAULT 'drafted',
  `subject_line` varchar(500),
  `body_preview` text,
  `esi_pre_approval_id` varchar(100),
  `compliance_grade` enum('Pass','Conditional Pass','Fail'),
  `compliance_notes` text,
  `sent_at` bigint,
  `delivered_at` bigint,
  `opened_at` bigint,
  `replied_at` bigint,
  `reply_classification` varchar(50),
  `reply_analysis_json` json,
  `created_at` bigint NOT NULL,
  INDEX `idx_ctl_enrollment` (`enrollment_id`),
  INDEX `idx_ctl_user_lead` (`user_id`, `lead_id`),
  INDEX `idx_ctl_status` (`touch_status`),
  INDEX `idx_ctl_sent_at` (`sent_at`)
);

CREATE TABLE IF NOT EXISTS `cadence_compliance_audit` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `audit_id` varchar(100) NOT NULL,
  `audit_type` enum('daily_random','monthly_full','ad_hoc') NOT NULL,
  `touch_log_id` int,
  `grade` enum('Pass','Conditional Pass','Fail') NOT NULL,
  `findings_json` json,
  `remediation_json` json,
  `auditor_notes` text,
  `created_at` bigint NOT NULL,
  INDEX `idx_cca_user` (`user_id`),
  INDEX `idx_cca_type` (`audit_type`),
  INDEX `idx_cca_grade` (`grade`)
);

CREATE TABLE IF NOT EXISTS `cadence_opt_out_registry` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `lead_id` int NOT NULL,
  `opt_out_channel` varchar(50) NOT NULL,
  `scope` varchar(50) NOT NULL DEFAULT 'all_channels',
  `opt_out_text` text,
  `opt_out_at` bigint NOT NULL,
  `processed_by` varchar(100),
  `reference_id` varchar(100),
  INDEX `idx_cor_user_lead` (`user_id`, `lead_id`),
  INDEX `idx_cor_opt_out_at` (`opt_out_at`)
);

CREATE TABLE IF NOT EXISTS `meddpicc_scores` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `lead_id` int NOT NULL,
  `metrics` int DEFAULT 0,
  `economic_buyer` int DEFAULT 0,
  `decision_criteria` int DEFAULT 0,
  `decision_process` int DEFAULT 0,
  `paper_process` int DEFAULT 0,
  `identify_pain` int DEFAULT 0,
  `champion` int DEFAULT 0,
  `competition` int DEFAULT 0,
  `composite_score` decimal(5,2),
  `tier` varchar(20),
  `notes_json` json,
  `last_scored_at` bigint NOT NULL,
  `scored_by` varchar(100),
  INDEX `idx_meddpicc_user_lead` (`user_id`, `lead_id`),
  INDEX `idx_meddpicc_tier` (`tier`)
);

CREATE TABLE IF NOT EXISTS `recruit_dimension_scores` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `lead_id` int NOT NULL,
  `production_fit` int DEFAULT 0,
  `cultural_fit` int DEFAULT 0,
  `geographic_fit` int DEFAULT 0,
  `network_leverage` int DEFAULT 0,
  `compliance_posture` int DEFAULT 0,
  `engagement_signal` int DEFAULT 0,
  `composite_score` int DEFAULT 0,
  `tier` varchar(20),
  `cascade_potential_count` int DEFAULT 0,
  `cascade_rationale` text,
  `priority_actions_json` json,
  `full_result_json` json,
  `scored_at` bigint NOT NULL,
  INDEX `idx_rds_user_lead` (`user_id`, `lead_id`),
  INDEX `idx_rds_tier` (`tier`),
  INDEX `idx_rds_composite` (`composite_score`)
);

CREATE TABLE IF NOT EXISTS `hnw_narrative_scores` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `lead_id` int NOT NULL,
  `wealth_signal_strength` varchar(20),
  `funnel_fit` varchar(20),
  `engagement_difficulty` varchar(20),
  `summary_paragraph` text,
  `recommended_cadence` varchar(100),
  `personalization_json` json,
  `compliance_flags_json` json,
  `scored_at` bigint NOT NULL,
  INDEX `idx_hns_user_lead` (`user_id`, `lead_id`),
  INDEX `idx_hns_cadence` (`recommended_cadence`)
);

CREATE TABLE IF NOT EXISTS `pattern_transition_assessments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `current_pattern` varchar(20) NOT NULL,
  `readiness_score` int DEFAULT 0,
  `recommendation` varchar(50),
  `rationale` text,
  `metrics_json` json,
  `gating_factors_json` json,
  `next_review_date` varchar(10),
  `assessed_at` bigint NOT NULL,
  INDEX `idx_pta_user` (`user_id`),
  INDEX `idx_pta_assessed_at` (`assessed_at`)
);
