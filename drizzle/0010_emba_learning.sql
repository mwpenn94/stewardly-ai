-- Migration: EMBA Learning Integration — full set of learning_* tables
-- Generated manually from drizzle/schema.ts (learning* tables)
-- Date: 2026-04-08
--
-- This migration introduces the EMBA Knowledge Explorer tables merged
-- into Stewardly under the `learning_` prefix. It includes:
--   - SRS / study: mastery_progress, study_sessions, achievements, settings, ai_quiz_questions
--   - Groups & challenges: study_groups, group_members, shared_quizzes, quiz_challenges, challenge_results
--   - Bookmarks, playlists, discovery
--   - NEW: licensure & CE credits
--   - NEW: content versions + regulatory updates pipeline
--   - NEW: dynamic content CRUD — disciplines, definitions, formulas, cases,
--     fs_applications, connections, tracks, chapters, subsections,
--     practice_questions, flashcards, content_history
--
-- All user FKs reference stewardly.users.id. The server services in
-- server/services/learning/* degrade gracefully to in-memory stubs when
-- the tables do not yet exist, so applying this migration is a
-- non-blocking upgrade — no downtime required.

-- ── SRS / study ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `learning_mastery_progress` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `item_key` VARCHAR(255) NOT NULL,
  `item_type` VARCHAR(64) NOT NULL,
  `seen` INT NOT NULL DEFAULT 0,
  `mastered` BOOLEAN NOT NULL DEFAULT FALSE,
  `confidence` INT NOT NULL DEFAULT 0,
  `review_count` INT NOT NULL DEFAULT 0,
  `last_reviewed` TIMESTAMP NULL,
  `next_due` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_mastery_user` (`user_id`),
  INDEX `idx_learning_mastery_item` (`item_key`)
);

CREATE TABLE IF NOT EXISTS `learning_study_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `discipline` VARCHAR(128),
  `track_key` VARCHAR(128),
  `duration_minutes` INT NOT NULL DEFAULT 0,
  `items_studied` INT NOT NULL DEFAULT 0,
  `items_mastered` INT NOT NULL DEFAULT 0,
  `quiz_score` DECIMAL(5,2),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_sessions_user` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `learning_achievements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `achievement_key` VARCHAR(128) NOT NULL,
  `unlocked_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_achievements_user` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `learning_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `setting_key` VARCHAR(128) NOT NULL,
  `setting_value` JSON,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_settings_user_key` (`user_id`, `setting_key`)
);

CREATE TABLE IF NOT EXISTS `learning_ai_quiz_questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `discipline` VARCHAR(128),
  `topic` VARCHAR(255),
  `difficulty` ENUM('easy','medium','hard') DEFAULT 'medium',
  `question_type` ENUM('multiple_choice','free_response','cloze') DEFAULT 'multiple_choice',
  `prompt` TEXT NOT NULL,
  `options` JSON,
  `correct_answer` TEXT,
  `explanation` TEXT,
  `usage_count` INT NOT NULL DEFAULT 0,
  `quality_score` DECIMAL(4,3) DEFAULT 0.500,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_aiq_discipline` (`discipline`)
);

-- ── Groups & challenges ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `learning_study_groups` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `invite_code` VARCHAR(32) NOT NULL UNIQUE,
  `owner_user_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_group_members` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `group_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `role` ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
  `joined_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_group_members_group` (`group_id`),
  INDEX `idx_learning_group_members_user` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `learning_shared_quizzes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `group_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `question_ids` JSON,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_quiz_challenges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `group_id` INT NOT NULL,
  `shared_quiz_id` INT,
  `title` VARCHAR(255) NOT NULL,
  `time_limit_seconds` INT,
  `starts_at` TIMESTAMP NULL,
  `ends_at` TIMESTAMP NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_challenge_results` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `challenge_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `score` DECIMAL(5,2) DEFAULT 0,
  `completed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_challenge_results_challenge` (`challenge_id`)
);

-- ── Bookmarks, playlists, discovery ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `learning_bookmarks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `content_type` VARCHAR(64) NOT NULL,
  `content_id` VARCHAR(255) NOT NULL,
  `note` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_bookmarks_user` (`user_id`)
);

CREATE TABLE IF NOT EXISTS `learning_playlists` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `owner_user_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `is_public` BOOLEAN NOT NULL DEFAULT FALSE,
  `share_token` VARCHAR(64),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_playlist_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `playlist_id` INT NOT NULL,
  `content_type` VARCHAR(64) NOT NULL,
  `content_id` VARCHAR(255) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  INDEX `idx_learning_playlist_items_playlist` (`playlist_id`)
);

CREATE TABLE IF NOT EXISTS `learning_playlist_shares` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `playlist_id` INT NOT NULL,
  `shared_with_user_id` INT NOT NULL,
  `permission` ENUM('view','edit') DEFAULT 'view',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_pending_invites` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `playlist_id` INT NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `permission` ENUM('view','edit') DEFAULT 'view',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_discovery_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `seed_query` TEXT,
  `follow_ups` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_discovery_user` (`user_id`)
);

-- ── Licensure & CE credits ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `learning_licenses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `license_type` VARCHAR(128) NOT NULL,
  `license_state` VARCHAR(64),
  `license_number` VARCHAR(128),
  `issue_date` DATE,
  `expiration_date` DATE,
  `status` ENUM('active','expired','pending','suspended') NOT NULL DEFAULT 'active',
  `ce_credits_required` INT DEFAULT 0,
  `ce_credits_completed` INT DEFAULT 0,
  `ce_deadline` DATE,
  `last_verified` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_licenses_user` (`user_id`),
  INDEX `idx_learning_licenses_type` (`license_type`)
);

CREATE TABLE IF NOT EXISTS `learning_ce_credits` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `license_id` INT NOT NULL,
  `credit_type` VARCHAR(128),
  `credit_hours` DECIMAL(5,2) DEFAULT 0,
  `completed_date` DATE,
  `provider_name` VARCHAR(255),
  `course_title` VARCHAR(512),
  `certificate_url` TEXT,
  `verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_ce_credits_user` (`user_id`),
  INDEX `idx_learning_ce_credits_license` (`license_id`)
);

-- ── Content freshness & regulatory pipeline ───────────────────────────────
CREATE TABLE IF NOT EXISTS `learning_content_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `content_source` VARCHAR(128) NOT NULL,
  `content_key` VARCHAR(255) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `checksum` VARCHAR(64),
  `last_updated` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_source` VARCHAR(128),
  `changelog` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_cv_source_key` (`content_source`, `content_key`)
);

CREATE TABLE IF NOT EXISTS `learning_regulatory_updates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source` VARCHAR(128) NOT NULL,
  `category` VARCHAR(128),
  `title` VARCHAR(512) NOT NULL,
  `summary` TEXT,
  `effective_date` DATE,
  `affected_licenses` JSON,
  `affected_content` JSON,
  `reg_status` ENUM('new','reviewed','applied','dismissed') NOT NULL DEFAULT 'new',
  `reviewed_by` INT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_reg_status` (`reg_status`)
);

-- ── Dynamic content system (Task 7) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `learning_disciplines` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(128) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `color` VARCHAR(32),
  `icon` VARCHAR(32),
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_core` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_by` INT,
  `visibility` ENUM('public','team','private') NOT NULL DEFAULT 'public',
  `status` ENUM('active','draft','archived') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_definitions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `discipline_id` INT,
  `term` VARCHAR(512) NOT NULL,
  `definition` TEXT NOT NULL,
  `created_by` INT,
  `visibility` ENUM('public','team','private') NOT NULL DEFAULT 'public',
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `version` INT NOT NULL DEFAULT 1,
  `source_ref` TEXT,
  `tags` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_def_discipline` (`discipline_id`),
  INDEX `idx_learning_def_term` (`term`)
);

CREATE TABLE IF NOT EXISTS `learning_formulas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `discipline_id` INT,
  `name` VARCHAR(255) NOT NULL,
  `formula` TEXT NOT NULL,
  `variables` JSON,
  `created_by` INT,
  `visibility` ENUM('public','team','private') NOT NULL DEFAULT 'public',
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `version` INT NOT NULL DEFAULT 1,
  `source_ref` TEXT,
  `tags` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_cases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `discipline_id` INT,
  `title` VARCHAR(512) NOT NULL,
  `content` TEXT NOT NULL,
  `created_by` INT,
  `visibility` ENUM('public','team','private') NOT NULL DEFAULT 'public',
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `version` INT NOT NULL DEFAULT 1,
  `source_ref` TEXT,
  `tags` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_fs_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `discipline_id` INT,
  `title` VARCHAR(512) NOT NULL,
  `content` TEXT NOT NULL,
  `created_by` INT,
  `visibility` ENUM('public','team','private') NOT NULL DEFAULT 'public',
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `version` INT NOT NULL DEFAULT 1,
  `source_ref` TEXT,
  `tags` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_connections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `from_definition_id` INT NOT NULL,
  `to_definition_id` INT NOT NULL,
  `relationship` VARCHAR(255),
  `created_by` INT,
  `visibility` ENUM('public','team','private') NOT NULL DEFAULT 'public',
  `status` ENUM('published','draft','archived') NOT NULL DEFAULT 'published',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `learning_tracks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(128) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `category` ENUM('securities','planning','insurance','custom') NOT NULL DEFAULT 'custom',
  `title` VARCHAR(512),
  `subtitle` TEXT,
  `description` TEXT,
  `color` VARCHAR(32),
  `emoji` VARCHAR(8),
  `tagline` TEXT,
  `exam_overview` JSON,
  `created_by` INT,
  `visibility` ENUM('public','team','private') NOT NULL DEFAULT 'public',
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `version` INT NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_tracks_category` (`category`)
);

CREATE TABLE IF NOT EXISTS `learning_chapters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `track_id` INT NOT NULL,
  `title` VARCHAR(512) NOT NULL,
  `intro` TEXT,
  `is_practice` BOOLEAN NOT NULL DEFAULT FALSE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` INT,
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_chapters_track` (`track_id`)
);

CREATE TABLE IF NOT EXISTS `learning_subsections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `chapter_id` INT NOT NULL,
  `title` VARCHAR(512),
  `level` INT NOT NULL DEFAULT 2,
  `paragraphs` JSON,
  `tables` JSON,
  `is_question` BOOLEAN NOT NULL DEFAULT FALSE,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` INT,
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_subsections_chapter` (`chapter_id`)
);

CREATE TABLE IF NOT EXISTS `learning_practice_questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `track_id` INT,
  `chapter_id` INT,
  `prompt` TEXT NOT NULL,
  `options` JSON,
  `correct_index` INT,
  `explanation` TEXT,
  `difficulty` ENUM('easy','medium','hard') NOT NULL DEFAULT 'medium',
  `tags` JSON,
  `created_by` INT,
  `source` ENUM('manual','ai_generated','user_authored') NOT NULL DEFAULT 'manual',
  `status` ENUM('published','draft','review','retired') NOT NULL DEFAULT 'published',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_pq_track` (`track_id`),
  INDEX `idx_learning_pq_chapter` (`chapter_id`)
);

CREATE TABLE IF NOT EXISTS `learning_flashcards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `track_id` INT,
  `chapter_id` INT,
  `term` VARCHAR(512) NOT NULL,
  `definition` TEXT NOT NULL,
  `source_label` VARCHAR(255),
  `created_by` INT,
  `source` ENUM('manual','ai_generated','user_authored') NOT NULL DEFAULT 'manual',
  `status` ENUM('published','draft','review','archived') NOT NULL DEFAULT 'published',
  `tags` JSON,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_learning_fc_track` (`track_id`)
);

CREATE TABLE IF NOT EXISTS `learning_content_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `content_table` VARCHAR(128) NOT NULL,
  `content_id` INT NOT NULL,
  `action` ENUM('create','update','delete','restore','publish','archive') NOT NULL,
  `previous_data` JSON,
  `new_data` JSON,
  `changed_by` INT,
  `change_reason` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_learning_ch_content` (`content_table`, `content_id`)
);
