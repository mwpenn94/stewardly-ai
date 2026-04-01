-- Migration 0008: Add 5 missing tables and 6 missing columns
-- Generated: 2026-04-01
-- 
-- Missing tables: user_autonomy_profiles, improvement_signals, improvement_hypotheses, 
--                 hypothesis_test_results, reasoning_traces
-- Missing columns: 6 columns in onboarding_progress

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CREATE MISSING TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- User Autonomy Profiles (trust-based autonomy levels)
CREATE TABLE IF NOT EXISTS `user_autonomy_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `level` enum('supervised','guided','semi_autonomous','autonomous') NOT NULL DEFAULT 'supervised',
  `trust_score` float NOT NULL DEFAULT 0,
  `total_interactions` int NOT NULL DEFAULT 0,
  `successful_actions` int NOT NULL DEFAULT 0,
  `overridden_actions` int NOT NULL DEFAULT 0,
  `escalations` int NOT NULL DEFAULT 0,
  `last_escalation` timestamp NULL DEFAULT NULL,
  `level_history` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_autonomy_profiles_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Improvement Signals (quality regressions, unused tools, etc.)
CREATE TABLE IF NOT EXISTS `improvement_signals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `signal_type` varchar(50) NOT NULL,
  `severity` varchar(20) NOT NULL,
  `source_metric` varchar(100) DEFAULT NULL,
  `source_value` text DEFAULT NULL,
  `threshold` varchar(100) DEFAULT NULL,
  `detected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by_hypothesis_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_improvement_signals_type_detected` (`signal_type`, `detected_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Improvement Hypotheses (generated to address detected signals)
CREATE TABLE IF NOT EXISTS `improvement_hypotheses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `signal_id` int NOT NULL,
  `pass_type` varchar(50) NOT NULL,
  `scope` json DEFAULT NULL,
  `hypothesis_text` text NOT NULL,
  `expected_delta` float DEFAULT NULL,
  `credit_budget` float DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'pending',
  `test_count` int NOT NULL DEFAULT 0,
  `timeout_at` timestamp NULL DEFAULT NULL,
  `promoted_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejected_reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_improvement_hypotheses_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hypothesis Test Results (A/B test outcomes)
CREATE TABLE IF NOT EXISTS `hypothesis_test_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `hypothesis_id` int NOT NULL,
  `session_id` int DEFAULT NULL,
  `quality_before` json DEFAULT NULL,
  `quality_after` json DEFAULT NULL,
  `regression_detected` tinyint(1) NOT NULL DEFAULT 0,
  `cost_delta` float DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_hypothesis_test_results_hypothesis_id` (`hypothesis_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reasoning Traces (ReAct step-by-step thought/action/observation logs)
CREATE TABLE IF NOT EXISTS `reasoning_traces` (
  `id` int NOT NULL AUTO_INCREMENT,
  `session_id` int DEFAULT NULL,
  `step_number` int NOT NULL,
  `thought` text DEFAULT NULL,
  `action` text DEFAULT NULL,
  `observation` text DEFAULT NULL,
  `tool_name` varchar(100) DEFAULT NULL,
  `duration_ms` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reasoning_traces_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ADD MISSING COLUMNS TO onboarding_progress
-- ═══════════════════════════════════════════════════════════════════════════

-- The onboarding_progress table was originally created with tour-related columns.
-- The Drizzle schema was updated with new onboarding-path columns.
-- Adding the new columns without removing old ones (backward compatible).

ALTER TABLE `onboarding_progress` ADD COLUMN IF NOT EXISTS `path` enum('advisor','client','admin') DEFAULT NULL;
ALTER TABLE `onboarding_progress` ADD COLUMN IF NOT EXISTS `current_step` int DEFAULT 0;
ALTER TABLE `onboarding_progress` ADD COLUMN IF NOT EXISTS `total_steps` int DEFAULT 5;
ALTER TABLE `onboarding_progress` ADD COLUMN IF NOT EXISTS `completed_steps` json DEFAULT NULL;
ALTER TABLE `onboarding_progress` ADD COLUMN IF NOT EXISTS `skipped_basics` tinyint(1) DEFAULT 0;
ALTER TABLE `onboarding_progress` ADD COLUMN IF NOT EXISTS `completed_at` timestamp NULL DEFAULT NULL;
