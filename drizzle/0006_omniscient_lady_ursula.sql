CREATE TABLE `firm_ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`firmName` varchar(256) NOT NULL,
	`brandVoice` text,
	`approvedProductCategories` json,
	`prohibitedTopics` json,
	`complianceLanguage` text,
	`customDisclaimers` text,
	`promptOverlay` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_ai_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `firm_ai_settings_firmId_unique` UNIQUE(`firmId`)
);
--> statement-breakpoint
CREATE TABLE `firm_landing_page_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_landing_page_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `firm_landing_page_config_firmId_unique` UNIQUE(`firmId`)
);
--> statement-breakpoint
CREATE TABLE `firm_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','manager','professional','user') NOT NULL DEFAULT 'user',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `firm_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `firms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`description` text,
	`website` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firms_id` PRIMARY KEY(`id`),
	CONSTRAINT `firms_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `manager_ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`teamFocusAreas` json,
	`clientSegmentTargeting` text,
	`reportingRequirements` json,
	`promptOverlay` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manager_ai_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `manager_ai_settings_managerId_unique` UNIQUE(`managerId`)
);
--> statement-breakpoint
CREATE TABLE `professional_ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`professionalId` int NOT NULL,
	`specialization` varchar(256),
	`methodology` text,
	`communicationStyle` text,
	`perClientOverrides` json,
	`promptOverlay` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `professional_ai_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `professional_ai_settings_professionalId_unique` UNIQUE(`professionalId`)
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`communicationStyle` enum('simple','detailed','expert') DEFAULT 'detailed',
	`responseLength` enum('concise','standard','comprehensive') DEFAULT 'standard',
	`ttsVoice` varchar(64) DEFAULT 'en-US-JennyNeural',
	`autoPlayVoice` boolean DEFAULT false,
	`handsFreeMode` boolean DEFAULT false,
	`autoGenerateCharts` boolean DEFAULT true,
	`riskTolerance` enum('conservative','moderate','aggressive'),
	`financialGoals` json,
	`taxFilingStatus` varchar(64),
	`stateOfResidence` varchar(64),
	`theme` enum('system','light','dark') DEFAULT 'dark',
	`sidebarDefault` enum('expanded','collapsed') DEFAULT 'expanded',
	`chatDensity` enum('comfortable','compact') DEFAULT 'comfortable',
	`language` varchar(64) DEFAULT 'en',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `view_as_audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`actions` json,
	`reason` text,
	`sessionDuration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `view_as_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`workflowType` enum('professional_onboarding','client_onboarding','licensing','registration') NOT NULL,
	`steps` json NOT NULL,
	`currentStep` int DEFAULT 0,
	`status` enum('not_started','in_progress','completed','paused') DEFAULT 'not_started',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_checklist_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `affiliated_resources` ADD `firmId` int;--> statement-breakpoint
ALTER TABLE `client_associations` ADD `managerId` int;--> statement-breakpoint
ALTER TABLE `client_associations` ADD `firmId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `isPinned` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `documents` ADD `firmId` int;--> statement-breakpoint
ALTER TABLE `products` ADD `firmId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `role`;