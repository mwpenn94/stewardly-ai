-- Migration: Round C4 — weight_presets table for multi-model consensus
-- Generated manually from drizzle/schema.ts (weightPresets)
-- Date: 2026-04-08
--
-- This table stores named per-model weight profiles for the consensus
-- stream. user_id NULL indicates a platform built-in seed preset. The
-- DB layer in server/services/weightPresets.ts degrades gracefully to
-- in-memory built-ins until this migration runs, so applying it is a
-- non-blocking upgrade — no downtime required.

CREATE TABLE IF NOT EXISTS `weight_presets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500),
  `weights` JSON NOT NULL,
  `optimized_for` JSON,
  `is_built_in` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_weight_presets_user_id` (`userId`)
);
