-- Migration: Pass 61 — workflow_instances table for cross-session persistence
-- Generated manually from drizzle/schema.ts (workflowInstances)
-- Date: 2026-04-08
--
-- This table persists in-progress user workflow runs from the
-- Workflows.tsx page. Before this migration the UI stored state in
-- localStorage, so a browser refresh or cross-device switch wiped
-- any in-progress workflow (including 30-minute FINRA registration
-- paperwork). The server-side router degrades gracefully to a
-- read-empty / write-noop state until this migration runs, so
-- applying it is a non-blocking upgrade — no downtime required.

CREATE TABLE IF NOT EXISTS `workflow_instances` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `template_id` VARCHAR(128) NOT NULL,
  `template_name` VARCHAR(255),
  `state_json` JSON NOT NULL,
  `current_step` INT NOT NULL DEFAULT 0,
  `status` ENUM('in_progress', 'completed', 'abandoned') NOT NULL DEFAULT 'in_progress',
  `started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_workflow_instances_user` (`user_id`),
  INDEX `idx_workflow_instances_user_template` (`user_id`, `template_id`)
);
