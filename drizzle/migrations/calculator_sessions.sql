CREATE TABLE IF NOT EXISTS `calculator_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(256) NOT NULL,
  `description` text,
  `inputs` json NOT NULL,
  `results` json,
  `scores` json,
  `overall_score` float,
  `is_auto_save` boolean DEFAULT false,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  CONSTRAINT `calculator_sessions_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_calc_sessions_user` ON `calculator_sessions` (`userId`);
CREATE INDEX `idx_calc_sessions_created` ON `calculator_sessions` (`created_at`);
