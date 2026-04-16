-- Pass 59: Feature Permissions, Permission Audit Log, Content Shares, View Shares

CREATE TABLE IF NOT EXISTS `feature_permissions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `user_id` int,
  `org_id` int,
  `role_scope` enum('user','advisor','manager','admin','org_default'),
  `feature_id` varchar(100) NOT NULL,
  `enabled` boolean NOT NULL DEFAULT true,
  `disclosure_ceiling` int NOT NULL DEFAULT 4,
  `granted_by` int,
  `reason` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX `idx_feature_permissions_user_id` ON `feature_permissions` (`user_id`);
CREATE INDEX `idx_feature_permissions_org_id` ON `feature_permissions` (`org_id`);
CREATE INDEX `idx_feature_permissions_feature_id` ON `feature_permissions` (`feature_id`);

CREATE TABLE IF NOT EXISTS `permission_audit_log` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `actor_id` int NOT NULL,
  `target_user_id` int,
  `target_org_id` int,
  `action_type` varchar(50) NOT NULL,
  `feature_id` varchar(100),
  `previous_value` text,
  `new_value` text,
  `reason` text,
  `metadata` json,
  `created_at` timestamp NOT NULL DEFAULT (now())
);

CREATE INDEX `idx_perm_audit_actor_id` ON `permission_audit_log` (`actor_id`);
CREATE INDEX `idx_perm_audit_target_user_id` ON `permission_audit_log` (`target_user_id`);
CREATE INDEX `idx_perm_audit_action_type` ON `permission_audit_log` (`action_type`);
CREATE INDEX `idx_perm_audit_created_at` ON `permission_audit_log` (`created_at`);

CREATE TABLE IF NOT EXISTS `content_shares` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `content_type` varchar(50) NOT NULL,
  `content_id` varchar(100) NOT NULL,
  `owner_id` int NOT NULL,
  `shared_with_user_id` int,
  `shared_with_org_id` int,
  `shared_with_role` enum('user','advisor','manager','admin'),
  `permission_level` enum('view','comment','edit','admin') NOT NULL DEFAULT 'view',
  `expires_at` timestamp,
  `revoked_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX `idx_content_shares_content` ON `content_shares` (`content_type`, `content_id`);
CREATE INDEX `idx_content_shares_owner_id` ON `content_shares` (`owner_id`);
CREATE INDEX `idx_content_shares_shared_with_user` ON `content_shares` (`shared_with_user_id`);
CREATE INDEX `idx_content_shares_shared_with_org` ON `content_shares` (`shared_with_org_id`);

CREATE TABLE IF NOT EXISTS `view_shares` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `view_name` varchar(200) NOT NULL,
  `view_type` varchar(50) NOT NULL,
  `view_config` json NOT NULL,
  `owner_id` int NOT NULL,
  `shared_with_user_id` int,
  `shared_with_org_id` int,
  `shared_with_role` enum('user','advisor','manager','admin'),
  `permission_level` enum('view','edit') NOT NULL DEFAULT 'view',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX `idx_view_shares_owner_id` ON `view_shares` (`owner_id`);
CREATE INDEX `idx_view_shares_shared_with_user` ON `view_shares` (`shared_with_user_id`);
CREATE INDEX `idx_view_shares_view_type` ON `view_shares` (`view_type`);
