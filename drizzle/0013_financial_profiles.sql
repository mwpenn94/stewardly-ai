-- Migration: Pass 4 — financial_profiles table for cross-device profile sync
-- Generated manually from drizzle/schema.ts (financialProfiles)
-- Date: 2026-04-11
--
-- This table backs the new server-side financialProfile.get/set tRPC
-- procedures (gap G9 in docs/PARITY.md). Before this migration the
-- shared financial profile lived in localStorage only, so a signed-in
-- user lost their entered values whenever they switched devices or
-- cleared their browser storage.
--
-- Schema design: one row per user, profile shape stored as a JSON
-- blob so the client store stays the source-of-truth for the field
-- list. Server-side code adds source / completeness / version
-- columns alongside for analytics + future migrations.
--
-- The router degrades gracefully when the table is missing (read
-- returns null, write becomes a noop) so this migration is a non-
-- blocking upgrade.

CREATE TABLE IF NOT EXISTS `financial_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `profile_json` JSON NOT NULL,
  `source` VARCHAR(32) DEFAULT 'user',
  `completeness` FLOAT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_financial_profiles_user` (`user_id`)
);
