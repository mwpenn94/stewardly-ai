CREATE TABLE `affiliated_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`category` enum('carrier','lender','ria','advanced_markets','general_partner') NOT NULL,
	`description` text,
	`contactInfo` json,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliated_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_associations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`professionalId` int NOT NULL,
	`status` enum('active','inactive') DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `client_associations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrichment_cohorts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`datasetId` int NOT NULL,
	`matchCriteria` json NOT NULL,
	`enrichmentFields` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrichment_cohorts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrichment_datasets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`applicableDomains` json,
	`dataType` varchar(64),
	`matchDimensions` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrichment_datasets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `enrichment_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`datasetId` int NOT NULL,
	`cohortId` int NOT NULL,
	`matchFields` json,
	`confidenceScore` float DEFAULT 0,
	`applicableDomains` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enrichment_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `professional_context` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`addedBy` int NOT NULL,
	`rawInput` text NOT NULL,
	`parsedDomains` json,
	`visibleToClient` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `professional_context_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`age` int,
	`zipCode` varchar(10),
	`jobTitle` varchar(128),
	`incomeRange` varchar(64),
	`savingsRange` varchar(64),
	`familySituation` varchar(128),
	`lifeStage` varchar(64),
	`goals` json,
	`sharedContext` json,
	`insuranceSummary` json,
	`investmentSummary` json,
	`estateExposure` json,
	`businessOwner` boolean DEFAULT false,
	`focusPreference` enum('general','financial','both') DEFAULT 'both',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `document_chunks` MODIFY COLUMN `category` enum('personal_docs','financial_products','regulations','training_materials','artifacts','skills') NOT NULL DEFAULT 'personal_docs';--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `category` enum('personal_docs','financial_products','regulations','training_materials','artifacts','skills') NOT NULL DEFAULT 'personal_docs';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','advisor','manager','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `documents` ADD `visibility` enum('private','professional','management','admin') DEFAULT 'professional' NOT NULL;