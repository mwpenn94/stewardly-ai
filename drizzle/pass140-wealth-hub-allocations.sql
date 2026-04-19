-- Pass 140: Wealth Hub Allocations (persist hub slider allocations + general defaults)
CREATE TABLE IF NOT EXISTS `wealth_hub_allocations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int,
  `hub_type` varchar(30) NOT NULL,
  `label` varchar(100) NOT NULL,
  `allocations` json NOT NULL,
  `input_overrides` json,
  `is_default` boolean DEFAULT false,
  `is_active` boolean DEFAULT true,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL
);

CREATE INDEX `idx_wha_user` ON `wealth_hub_allocations` (`user_id`);
CREATE INDEX `idx_wha_hub_type` ON `wealth_hub_allocations` (`hub_type`);
CREATE INDEX `idx_wha_default` ON `wealth_hub_allocations` (`is_default`);

-- Seed general defaults for client hub (available to all users including guests)
INSERT INTO `wealth_hub_allocations` (`user_id`, `hub_type`, `label`, `allocations`, `input_overrides`, `is_default`, `is_active`, `created_at`, `updated_at`)
VALUES
  (NULL, 'client', 'Balanced Growth', '{"cashFlow":20,"protection":20,"growth":20,"retirement":15,"tax":10,"estate":10,"education":5}', '{"retireAge":67,"monthlyGoal":8000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'client', 'Protection First', '{"cashFlow":15,"protection":30,"growth":15,"retirement":15,"tax":10,"estate":10,"education":5}', '{"retireAge":65,"monthlyGoal":6000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'client', 'Aggressive Growth', '{"cashFlow":15,"protection":10,"growth":35,"retirement":20,"tax":10,"estate":5,"education":5}', '{"retireAge":60,"monthlyGoal":12000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'client', 'Family Focus', '{"cashFlow":20,"protection":20,"growth":15,"retirement":10,"tax":10,"estate":10,"education":15}', '{"retireAge":67,"monthlyGoal":7000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'client', 'Pre-Retirement', '{"cashFlow":20,"protection":15,"growth":10,"retirement":30,"tax":10,"estate":10,"education":5}', '{"retireAge":62,"monthlyGoal":10000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'advanced', 'Balanced Strategies', '{"premiumFinance":25,"ilit":20,"execComp":20,"charitable":15,"business":20}', '{"benefitGoal":500000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'advanced', 'Estate Focused', '{"premiumFinance":15,"ilit":35,"execComp":10,"charitable":20,"business":20}', '{"benefitGoal":750000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'advanced', 'Tax Optimization', '{"premiumFinance":30,"ilit":15,"execComp":25,"charitable":20,"business":10}', '{"benefitGoal":400000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000),
  (NULL, 'advanced', 'Business Owner', '{"premiumFinance":15,"ilit":15,"execComp":15,"charitable":10,"business":45}', '{"benefitGoal":600000}', true, true, UNIX_TIMESTAMP()*1000, UNIX_TIMESTAMP()*1000);
