-- ─── FIRMS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `firms` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `name` varchar(256) NOT NULL,
  `slug` varchar(128) NOT NULL UNIQUE,
  `description` text,
  `website` varchar(512),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── FIRM LANDING PAGE CONFIG ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `firm_landing_page_config` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `firmId` int NOT NULL UNIQUE,
  `headline` varchar(512) DEFAULT 'Your Complete Financial Picture, Understood by Us',
  `subtitle` text,
  `ctaText` varchar(128) DEFAULT 'Start Your Financial Twin →',
  `secondaryLinkText` varchar(128) DEFAULT 'Try it anonymously',
  `logoUrl` text,
  `primaryColor` varchar(7) DEFAULT '#0F172A',
  `accentColor` varchar(7) DEFAULT '#0EA5E9',
  `backgroundOption` varchar(64) DEFAULT 'gradient',
  `trustSignal1` text,
  `trustSignal2` text,
  `trustSignal3` text,
  `disclaimerText` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── FIRM-TO-FIRM RELATIONSHIPS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `firm_relationships` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `parentFirmId` int NOT NULL,
  `childFirmId` int NOT NULL,
  `relationshipType` enum('partner', 'subsidiary', 'affiliate', 'referral') NOT NULL,
  `status` enum('active', 'inactive', 'pending') DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`parentFirmId`) REFERENCES `firms`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`childFirmId`) REFERENCES `firms`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_firm_relationship` (`parentFirmId`, `childFirmId`, `relationshipType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── USER-FIRM ROLES (Many-to-Many) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_firm_roles` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `firmId` int NOT NULL,
  `globalRole` enum('global_admin', 'user') DEFAULT 'user',
  `firmRole` enum('firm_admin', 'manager', 'professional', 'user'),
  `managerId` int,
  `professionalId` int,
  `status` enum('active', 'inactive') DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_firm_role` (`userId`, `firmId`),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`professionalId`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── ALTER USERS TABLE TO REMOVE SINGLE FIRM REFERENCE ────────────────
ALTER TABLE `users` DROP COLUMN IF EXISTS `firmId`;
ALTER TABLE `users` DROP COLUMN IF EXISTS `globalRole`;
ALTER TABLE `users` DROP COLUMN IF EXISTS `firmRole`;
ALTER TABLE `users` DROP COLUMN IF EXISTS `managerId`;
ALTER TABLE `users` DROP COLUMN IF EXISTS `professionalId`;

-- ─── FIRM AI SETTINGS (Layer 2 Prompt) ────────────────────────────────
CREATE TABLE IF NOT EXISTS `firm_ai_settings` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `firmId` int NOT NULL UNIQUE,
  `firmName` varchar(256) NOT NULL,
  `brandVoice` text,
  `approvedProductCategories` json,
  `prohibitedTopics` json,
  `complianceLanguage` text,
  `customDisclaimers` text,
  `promptOverlay` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── MANAGER AI SETTINGS (Layer 3 Prompt) ────────────────────────────
CREATE TABLE IF NOT EXISTS `manager_ai_settings` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `managerId` int NOT NULL UNIQUE,
  `teamFocusAreas` json,
  `clientSegmentTargeting` text,
  `reportingRequirements` json,
  `promptOverlay` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PROFESSIONAL AI SETTINGS (Layer 4 Prompt) ────────────────────────
CREATE TABLE IF NOT EXISTS `professional_ai_settings` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `professionalId` int NOT NULL UNIQUE,
  `specialization` varchar(256),
  `methodology` text,
  `communicationStyle` text,
  `perClientOverrides` json,
  `promptOverlay` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`professionalId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── USER PREFERENCES (Layer 5 Context) ──────────────────────────────
CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL UNIQUE,
  `communicationStyle` enum('simple', 'detailed', 'expert') DEFAULT 'detailed',
  `responseLength` enum('concise', 'standard', 'comprehensive') DEFAULT 'standard',
  `ttsVoice` varchar(64) DEFAULT 'en-US-JennyNeural',
  `autoPlayVoice` boolean DEFAULT false,
  `handsFreeMode` boolean DEFAULT false,
  `autoGenerateCharts` boolean DEFAULT true,
  `riskTolerance` enum('conservative', 'moderate', 'aggressive'),
  `financialGoals` json,
  `taxFilingStatus` varchar(64),
  `stateOfResidence` varchar(64),
  `theme` enum('system', 'light', 'dark') DEFAULT 'dark',
  `sidebarDefault` enum('expanded', 'collapsed') DEFAULT 'expanded',
  `chatDensity` enum('comfortable', 'compact') DEFAULT 'comfortable',
  `language` varchar(64) DEFAULT 'en',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── VIEW-AS AUDIT LOG ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `view_as_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `actorId` int NOT NULL,
  `targetUserId` int NOT NULL,
  `startTime` timestamp NOT NULL,
  `endTime` timestamp,
  `actions` json,
  `reason` text,
  `sessionDuration` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── WORKFLOW CHECKLIST (Onboarding Steps) ───────────────────────────
CREATE TABLE IF NOT EXISTS `workflow_checklist` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `firmId` int,
  `workflowType` enum('professional_onboarding', 'client_onboarding', 'licensing', 'registration') NOT NULL,
  `steps` json NOT NULL,
  `currentStep` int DEFAULT 0,
  `status` enum('not_started', 'in_progress', 'completed', 'paused') DEFAULT 'not_started',
  `completedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── UPDATE EXISTING TABLES FOR MULTI-TENANT ──────────────────────────
ALTER TABLE `conversations` ADD COLUMN IF NOT EXISTS `firmId` int;
ALTER TABLE `conversations` ADD FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE SET NULL;

ALTER TABLE `documents` ADD COLUMN IF NOT EXISTS `firmId` int;
ALTER TABLE `documents` ADD FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE SET NULL;

ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `firmId` int;
ALTER TABLE `products` ADD FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE SET NULL;

ALTER TABLE `client_associations` ADD COLUMN IF NOT EXISTS `firmId` int;
ALTER TABLE `client_associations` ADD FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE CASCADE;

ALTER TABLE `affiliated_resources` ADD COLUMN IF NOT EXISTS `firmId` int;
ALTER TABLE `affiliated_resources` ADD FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE SET NULL;
