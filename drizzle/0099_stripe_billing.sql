-- Add Stripe billing columns to users table
ALTER TABLE `users` ADD COLUMN `stripe_customer_id` varchar(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `stripe_subscription_id` varchar(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `stripe_plan_id` varchar(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `stripe_subscription_status` varchar(50) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `stripe_current_period_end` timestamp NULL DEFAULT NULL;
ALTER TABLE `users` ADD INDEX `idx_users_stripe_customer_id` (`stripe_customer_id`);

-- Billing events log (minimal — most data stays in Stripe)
CREATE TABLE IF NOT EXISTS `billing_events` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `stripe_event_id` varchar(255) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `stripe_customer_id` varchar(255),
  `stripe_subscription_id` varchar(255),
  `stripe_payment_intent_id` varchar(255),
  `stripe_invoice_id` varchar(255),
  `amount_cents` int,
  `currency` varchar(10) DEFAULT 'usd',
  `status` varchar(50),
  `metadata` json,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `idx_billing_events_user_id` (`user_id`),
  INDEX `idx_billing_events_stripe_event_id` (`stripe_event_id`),
  INDEX `idx_billing_events_event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
