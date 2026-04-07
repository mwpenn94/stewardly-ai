-- Add missing columns to messages table (schema drift from 0001 migration)
ALTER TABLE `messages` ADD COLUMN `modelVersion` varchar(64) DEFAULT NULL;
--> statement-breakpoint
ALTER TABLE `messages` ADD COLUMN `parentMessageId` int DEFAULT NULL;
