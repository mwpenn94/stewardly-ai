CREATE TABLE `audit_trail` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int,
	`messageId` int,
	`action` varchar(128) NOT NULL,
	`details` text,
	`complianceFlags` json,
	`piiDetected` boolean DEFAULT false,
	`disclaimerAppended` boolean DEFAULT false,
	`reviewStatus` enum('auto_approved','pending_review','approved','rejected','modified') DEFAULT 'auto_approved',
	`reviewedBy` int,
	`reviewNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_trail_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) DEFAULT 'New Conversation',
	`mode` enum('client','coach','manager') NOT NULL DEFAULT 'client',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`chunkIndex` int NOT NULL,
	`category` enum('personal_docs','financial_products','regulations') NOT NULL DEFAULT 'personal_docs',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`mimeType` varchar(128),
	`category` enum('personal_docs','financial_products','regulations') NOT NULL DEFAULT 'personal_docs',
	`extractedText` text,
	`chunkCount` int DEFAULT 0,
	`status` enum('uploading','processing','ready','error') NOT NULL DEFAULT 'uploading',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`messageId` int NOT NULL,
	`conversationId` int NOT NULL,
	`rating` enum('up','down') NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('fact','preference','goal','relationship','financial','temporal') NOT NULL DEFAULT 'fact',
	`content` text NOT NULL,
	`source` varchar(128),
	`confidence` float DEFAULT 0.8,
	`validFrom` timestamp,
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`confidenceScore` float,
	`complianceStatus` enum('pending','approved','flagged','rejected'),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company` varchar(128) NOT NULL,
	`name` varchar(256) NOT NULL,
	`category` enum('iul','term_life','disability','ltc','premium_finance','whole_life','variable_life') NOT NULL,
	`description` text,
	`features` json,
	`riskLevel` enum('low','moderate','moderate_high','high'),
	`minPremium` float,
	`maxPremium` float,
	`targetAudience` text,
	`competitorFlag` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quality_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`conversationId` int NOT NULL,
	`score` float NOT NULL,
	`reasoning` text,
	`improvementSuggestions` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quality_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`conversationId` int NOT NULL,
	`messageId` int NOT NULL,
	`confidenceScore` float NOT NULL,
	`autonomyLevel` enum('high','medium','low') NOT NULL,
	`aiReasoning` text,
	`aiRecommendation` text,
	`complianceNotes` text,
	`status` enum('pending','approved','rejected','modified') NOT NULL DEFAULT 'pending',
	`reviewerAction` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suitability_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`riskTolerance` enum('conservative','moderate','aggressive'),
	`investmentHorizon` varchar(64),
	`annualIncome` varchar(64),
	`netWorth` varchar(64),
	`investmentExperience` enum('none','limited','moderate','extensive'),
	`financialGoals` json,
	`insuranceNeeds` json,
	`responses` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suitability_assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `styleProfile` text;--> statement-breakpoint
ALTER TABLE `users` ADD `suitabilityCompleted` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `suitabilityData` json;--> statement-breakpoint
ALTER TABLE `users` ADD `settings` json;