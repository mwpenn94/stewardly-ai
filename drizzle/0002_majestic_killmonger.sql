CREATE TABLE `prompt_experiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`variantId` int NOT NULL,
	`conversationId` int NOT NULL,
	`messageId` int,
	`feedbackRating` enum('up','down'),
	`confidenceScore` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_experiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`promptTemplate` text NOT NULL,
	`category` varchar(64) DEFAULT 'system',
	`isActive` boolean DEFAULT true,
	`weight` float DEFAULT 1,
	`totalUses` int DEFAULT 0,
	`avgRating` float DEFAULT 0,
	`positiveCount` int DEFAULT 0,
	`negativeCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prompt_variants_id` PRIMARY KEY(`id`)
);
