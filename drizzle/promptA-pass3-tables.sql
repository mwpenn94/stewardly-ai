-- Prompt A Pass 3: P1-2 (Lesson Graph) + P1-5 (Office Hours) tables

CREATE TABLE IF NOT EXISTS `chapter_prerequisites` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `chapter_id` int NOT NULL,
  `prerequisite_chapter_id` int NOT NULL,
  `min_mastery_score` float NOT NULL DEFAULT 0.7,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_cp_chapter` ON `chapter_prerequisites` (`chapter_id`);
CREATE INDEX `idx_cp_prereq` ON `chapter_prerequisites` (`prerequisite_chapter_id`);
CREATE UNIQUE INDEX `idx_cp_unique` ON `chapter_prerequisites` (`chapter_id`, `prerequisite_chapter_id`);

CREATE TABLE IF NOT EXISTS `office_hours` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `host_user_id` int NOT NULL,
  `title` varchar(256) NOT NULL,
  `description` text,
  `track_id` int,
  `scheduled_at` timestamp NOT NULL,
  `duration_minutes` int NOT NULL DEFAULT 60,
  `max_attendees` int NOT NULL DEFAULT 20,
  `current_attendees` int NOT NULL DEFAULT 0,
  `status` enum('scheduled','live','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  `meeting_url` varchar(512),
  `recording_url` varchar(512),
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_oh_host` ON `office_hours` (`host_user_id`);
CREATE INDEX `idx_oh_track` ON `office_hours` (`track_id`);
CREATE INDEX `idx_oh_status` ON `office_hours` (`status`);
CREATE INDEX `idx_oh_scheduled` ON `office_hours` (`scheduled_at`);

CREATE TABLE IF NOT EXISTS `office_hour_registrations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `office_hour_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('registered','attended','no_show','cancelled') NOT NULL DEFAULT 'registered',
  `registered_at` timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_ohr_oh` ON `office_hour_registrations` (`office_hour_id`);
CREATE INDEX `idx_ohr_user` ON `office_hour_registrations` (`user_id`);
CREATE UNIQUE INDEX `idx_ohr_unique` ON `office_hour_registrations` (`office_hour_id`, `user_id`);
