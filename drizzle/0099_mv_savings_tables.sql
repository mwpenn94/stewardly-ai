CREATE TABLE IF NOT EXISTS `mv_savings_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `event_id` varchar(64) NOT NULL,
  `user_id` int NOT NULL,
  `mv_category` enum('ai_cost_optimization','time_savings','search_efficiency','document_processing','compliance_automation','memory_context_reduction') NOT NULL,
  `actual_cost` decimal(10,6) NOT NULL,
  `baseline_cost` decimal(10,6) NOT NULL,
  `savings` decimal(10,6) NOT NULL,
  `operation` varchar(128) NOT NULL,
  `model` varchar(100),
  `tokens_used` int,
  `tokens_baseline` int,
  `time_ms` int,
  `baseline_time_ms` int,
  `metadata` json,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `mv_savings_events_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_mv_user_category` ON `mv_savings_events` (`user_id`,`mv_category`);
CREATE INDEX `idx_mv_user_date` ON `mv_savings_events` (`user_id`,`created_at`);
CREATE INDEX `idx_mv_category_date` ON `mv_savings_events` (`mv_category`,`created_at`);

CREATE TABLE IF NOT EXISTS `mv_period_summaries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `period_start` timestamp NOT NULL,
  `period_end` timestamp NOT NULL,
  `total_savings` decimal(12,4) NOT NULL,
  `ai_cost_optimization_amt` decimal(10,4) DEFAULT '0',
  `time_savings_amt` decimal(10,4) DEFAULT '0',
  `search_efficiency_amt` decimal(10,4) DEFAULT '0',
  `document_processing_amt` decimal(10,4) DEFAULT '0',
  `compliance_automation_amt` decimal(10,4) DEFAULT '0',
  `memory_context_reduction_amt` decimal(10,4) DEFAULT '0',
  `event_count` int NOT NULL DEFAULT 0,
  `customer_savings_share` decimal(5,4) DEFAULT '0.3000',
  `credit_amount` decimal(10,4) DEFAULT '0',
  `invoice_id` varchar(128),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `mv_period_summaries_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_mvps_user_period` ON `mv_period_summaries` (`user_id`,`period_start`);
CREATE INDEX `idx_mvps_invoice` ON `mv_period_summaries` (`invoice_id`);
