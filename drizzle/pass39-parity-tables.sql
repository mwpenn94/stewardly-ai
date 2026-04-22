-- P0-1: FSRS-5 Card Schedules
CREATE TABLE IF NOT EXISTS `card_schedules` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `item_key` varchar(255) NOT NULL,
  `item_type` varchar(32) NOT NULL,
  `stability` float NOT NULL DEFAULT 0.4,
  `difficulty` float NOT NULL DEFAULT 0.3,
  `elapsed_days` float NOT NULL DEFAULT 0,
  `scheduled_days` float NOT NULL DEFAULT 0,
  `reps` int NOT NULL DEFAULT 0,
  `lapses` int NOT NULL DEFAULT 0,
  `state` enum('new','learning','review','relearning') NOT NULL DEFAULT 'new',
  `last_review` timestamp NULL,
  `next_due` timestamp NULL,
  `feature_flag` enum('control','fsrs5') NOT NULL DEFAULT 'fsrs5',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX `idx_cs_user_item` ON `card_schedules` (`user_id`, `item_key`, `item_type`);
CREATE INDEX `idx_cs_user_due` ON `card_schedules` (`user_id`, `next_due`);
CREATE INDEX `idx_cs_flag` ON `card_schedules` (`feature_flag`);

-- P0-1: FSRS-5 Card Reviews
CREATE TABLE IF NOT EXISTS `card_reviews` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `item_key` varchar(255) NOT NULL,
  `item_type` varchar(32) NOT NULL,
  `rating` int NOT NULL,
  `reviewed_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `elapsed_days` float NOT NULL DEFAULT 0,
  `scheduled_days` float NOT NULL DEFAULT 0,
  `stability_before` float NULL,
  `stability_after` float NULL,
  `difficulty_before` float NULL,
  `difficulty_after` float NULL,
  `state_before` varchar(16) NULL,
  `state_after` varchar(16) NULL,
  `feature_flag` enum('control','fsrs5') NOT NULL DEFAULT 'fsrs5'
);
CREATE INDEX `idx_cr_user_item` ON `card_reviews` (`user_id`, `item_key`);
CREATE INDEX `idx_cr_user_date` ON `card_reviews` (`user_id`, `reviewed_at`);
CREATE INDEX `idx_cr_flag` ON `card_reviews` (`feature_flag`);

-- P0-3: Assessment Sessions (no-AI zone)
CREATE TABLE IF NOT EXISTS `assessment_sessions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `assessment_type` varchar(64) NOT NULL,
  `status` enum('active','completed','abandoned','invalidated') NOT NULL DEFAULT 'active',
  `started_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL,
  `ai_block_active` tinyint(1) NOT NULL DEFAULT 1,
  `focus_loss_count` int NOT NULL DEFAULT 0,
  `ai_attempt_count` int NOT NULL DEFAULT 0,
  `score` float NULL,
  `max_score` float NULL,
  `metadata` json NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX `idx_as_user` ON `assessment_sessions` (`user_id`);
CREATE INDEX `idx_as_status` ON `assessment_sessions` (`status`);
CREATE INDEX `idx_as_user_status` ON `assessment_sessions` (`user_id`, `status`);

-- P0-5: Learning Streaks
CREATE TABLE IF NOT EXISTS `learning_streaks` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `current_streak` int NOT NULL DEFAULT 0,
  `longest_streak` int NOT NULL DEFAULT 0,
  `last_activity_date` varchar(10) NULL,
  `daily_goal_minutes` int NOT NULL DEFAULT 15,
  `nudge_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `nudge_time` varchar(5) NULL,
  `total_days_active` int NOT NULL DEFAULT 0,
  `feature_flag` enum('control','treatment') NOT NULL DEFAULT 'treatment',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX `idx_ls_user` ON `learning_streaks` (`user_id`);
CREATE INDEX `idx_ls_flag` ON `learning_streaks` (`feature_flag`);
