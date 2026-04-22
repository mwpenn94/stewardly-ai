-- Pass 64d-ext6: Add enrichment_data column to lead_pipeline table
-- This column was defined in drizzle/schema.ts but never migrated to the database
-- Also add segment_data if missing

-- Add enrichment_data column (JSON) to lead_pipeline
ALTER TABLE `lead_pipeline` ADD COLUMN IF NOT EXISTS `enrichment_data` json DEFAULT NULL;

-- Add segment_data column (JSON) to lead_pipeline if missing
ALTER TABLE `lead_pipeline` ADD COLUMN IF NOT EXISTS `segment_data` json DEFAULT NULL;
