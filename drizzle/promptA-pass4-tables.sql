-- Prompt A Pass 4: P1-3 (CE credits) + P1-4 (peer groups) tables
-- P1-1 (Capacitor) is config-only, no DB tables needed

-- P1-3: CE Credit Issuance Pipeline
CREATE TABLE IF NOT EXISTS `ce_credits` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int NOT NULL,
  `track_id` int NOT NULL,
  `credits_earned` decimal(5,2) NOT NULL DEFAULT 0,
  `credit_type` varchar(50) NOT NULL DEFAULT 'self_serve',
  `status` varchar(30) NOT NULL DEFAULT 'pending',
  `issued_at` timestamp NULL,
  `expires_at` timestamp NULL,
  `certificate_url` varchar(500) NULL,
  `issuer` varchar(200) NOT NULL DEFAULT 'Stewardly Learning Platform',
  `notes` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX `idx_ce_credits_user` ON `ce_credits` (`user_id`);
CREATE INDEX `idx_ce_credits_track` ON `ce_credits` (`track_id`);
CREATE INDEX `idx_ce_credits_status` ON `ce_credits` (`status`);

-- P1-4: Compliant Professional Peer Groups
CREATE TABLE IF NOT EXISTS `peer_groups` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(200) NOT NULL,
  `description` text NULL,
  `track_id` int NULL,
  `created_by` int NOT NULL,
  `max_members` int NOT NULL DEFAULT 20,
  `current_members` int NOT NULL DEFAULT 0,
  `is_compliance_gated` tinyint(1) NOT NULL DEFAULT 1,
  `required_role` varchar(30) NOT NULL DEFAULT 'advisor',
  `status` varchar(30) NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX `idx_peer_groups_track` ON `peer_groups` (`track_id`);
CREATE INDEX `idx_peer_groups_status` ON `peer_groups` (`status`);

CREATE TABLE IF NOT EXISTS `peer_group_members` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `group_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` varchar(30) NOT NULL DEFAULT 'member',
  `status` varchar(30) NOT NULL DEFAULT 'active',
  `joined_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_pgm_group` ON `peer_group_members` (`group_id`);
CREATE INDEX `idx_pgm_user` ON `peer_group_members` (`user_id`);
CREATE UNIQUE INDEX `idx_pgm_unique` ON `peer_group_members` (`group_id`, `user_id`);

CREATE TABLE IF NOT EXISTS `peer_group_messages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `group_id` int NOT NULL,
  `user_id` int NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `idx_pgmsg_group` ON `peer_group_messages` (`group_id`);
