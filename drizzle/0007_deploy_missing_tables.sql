-- Migration: Deploy 131 missing tables + audit hash columns
-- Generated from drizzle/schema.ts
-- Date: 2026-03-26

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `openId` VARCHAR(64) NOT NULL UNIQUE,
  `name` TEXT,
  `email` VARCHAR(320),
  `loginMethod` VARCHAR(64),
  `role` ENUM('user', 'advisor', 'manager', 'admin') NOT NULL DEFAULT 'user',
  `authTier` ENUM('anonymous', 'email', 'full', 'advisor_connected') NOT NULL DEFAULT 'full',
  `affiliateOrgId` INT,
  `anonymousConversationCount` INT NOT NULL DEFAULT 0,
  `passwordHash` TEXT,
  `styleProfile` TEXT,
  `suitabilityCompleted` BOOLEAN DEFAULT FALSE,
  `suitabilityData` JSON,
  `settings` JSON,
  `avatarUrl` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `tosAcceptedAt` TIMESTAMP,
  `authProvider` VARCHAR(20) DEFAULT 'manus',
  `linkedinId` VARCHAR(100),
  `googleId` VARCHAR(100),
  `linkedinProfileUrl` VARCHAR(500),
  `linkedinHeadline` VARCHAR(300),
  `linkedinIndustry` VARCHAR(100),
  `linkedinLocation` VARCHAR(200),
  `googlePhone` VARCHAR(50),
  `googleBirthday` TIMESTAMP,
  `googleGender` VARCHAR(20),
  `googleAddressJson` JSON,
  `googleOrganizationsJson` JSON,
  `employerName` VARCHAR(200),
  `jobTitle` VARCHAR(200),
  `profileEnrichedAt` TIMESTAMP,
  `profileEnrichmentSource` VARCHAR(50),
  `signInDataJson` JSON
);

CREATE TABLE IF NOT EXISTS `ltc_analyses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `currentAge` INT,
  `retirementAge` INT,
  `state` VARCHAR(2),
  `zipCode` VARCHAR(10),
  `healthStatus` ENUM('excellent', 'good', 'fair', 'poor') DEFAULT 'good',
  `gender` ENUM('male', 'female', 'other'),
  `maritalStatus` ENUM('single', 'married', 'divorced', 'widowed'),
  `annualIncome` TEXT,
  `totalAssets` TEXT,
  `ltcInsuranceHas` BOOLEAN DEFAULT FALSE,
  `ltcInsuranceDailyBenefit` TEXT,
  `ltcInsuranceBenefitPeriod` INT,
  `projectedAnnualCost` TEXT,
  `projectedDurationYears` TEXT,
  `probabilityOfNeed` TEXT,
  `fundingGap` TEXT,
  `recommendedStrategy` VARCHAR(50),
  `analysisJson` TEXT,
  `notes` TEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `portal_engagement` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `sessionDate` TEXT NOT NULL,
  `loginCount` INT DEFAULT 0,
  `timeSpentSeconds` INT DEFAULT 0,
  `pagesVisited` INT DEFAULT 0,
  `featuresUsed` TEXT,
  `goalsChecked` INT DEFAULT 0,
  `actionsCompleted` INT DEFAULT 0,
  `engagementScore` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `health_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `totalScore` INT NOT NULL DEFAULT 0,
  `spendScore` INT NOT NULL DEFAULT 0,
  `saveScore` INT NOT NULL DEFAULT 0,
  `borrowScore` INT NOT NULL DEFAULT 0,
  `planScore` INT NOT NULL DEFAULT 0,
  `status` ENUM('healthy', 'coping', 'vulnerable') NOT NULL DEFAULT 'coping',
  `insightsJson` TEXT,
  `recommendationsJson` TEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `business_exit_plans` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `businessName` VARCHAR(256) NOT NULL,
  `businessType` VARCHAR(128),
  `annualRevenue` FLOAT,
  `annualProfit` FLOAT,
  `employeeCount` INT,
  `ownerDependenceScore` INT,
  `readinessScore` INT,
  `preferredExitPath` VARCHAR(64),
  `analysisJson` TEXT,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `integration_providers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `slug` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `category` ENUM('crm', 'messaging', 'carrier', 'investments', 'insurance', 'demographics', 'economic', 'enrichment', 'regulatory', 'property', 'middleware') NOT NULL,
  `ownershipTier` ENUM('platform', 'organization', 'professional', 'client') NOT NULL,
  `authMethod` ENUM('oauth2', 'api_key', 'bearer_token', 'hmac_webhook', 'manual_upload', 'none') NOT NULL,
  `baseUrl` VARCHAR(500),
  `docsUrl` VARCHAR(500),
  `signupUrl` VARCHAR(500),
  `freeTierDescription` TEXT,
  `freeTierLimit` VARCHAR(200),
  `logoUrl` VARCHAR(500),
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `integration_connections` (
  `id` VARCHAR(36) PRIMARY KEY,
  `providerId` VARCHAR(36) NOT NULL,
  `ownershipTier` ENUM('platform', 'organization', 'professional', 'client') NOT NULL,
  `ownerId` VARCHAR(36) NOT NULL,
  `organizationId` INT,
  `userId` INT,
  `status` ENUM('connected', 'disconnected', 'error', 'pending', 'expired') DEFAULT 'pending',
  `credentialsEncrypted` TEXT,
  `configJson` JSON,
  `lastSyncAt` TIMESTAMP,
  `lastSyncStatus` ENUM('success', 'partial', 'failed'),
  `lastSyncError` TEXT,
  `recordsSynced` INT DEFAULT 0,
  `usageThisPeriod` INT DEFAULT 0,
  `usagePeriodStart` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `integration_sync_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `connectionId` VARCHAR(36) NOT NULL,
  `syncType` ENUM('full', 'incremental', 'webhook', 'manual_upload', 'on_demand') NOT NULL,
  `direction` ENUM('inbound', 'outbound', 'bidirectional') NOT NULL,
  `startedAt` TIMESTAMP NOT NULL,
  `completedAt` TIMESTAMP,
  `status` ENUM('running', 'success', 'partial', 'failed', 'cancelled') NOT NULL,
  `recordsCreated` INT DEFAULT 0,
  `recordsUpdated` INT DEFAULT 0,
  `recordsFailed` INT DEFAULT 0,
  `errorDetails` JSON,
  `triggeredBy` ENUM('schedule', 'webhook', 'manual', 'system') NOT NULL,
  `triggeredByUserId` INT
);

CREATE TABLE IF NOT EXISTS `integration_field_mappings` (
  `id` VARCHAR(36) PRIMARY KEY,
  `connectionId` VARCHAR(36) NOT NULL,
  `externalField` VARCHAR(200) NOT NULL,
  `internalTable` VARCHAR(100) NOT NULL,
  `internalField` VARCHAR(200) NOT NULL,
  `transform` ENUM('direct', 'lowercase', 'uppercase', 'date_parse', 'phone_e164', 'currency_cents', 'boolean_parse', 'custom') DEFAULT 'direct',
  `customTransform` TEXT,
  `isActive` BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS `integration_webhook_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `connectionId` VARCHAR(36) NOT NULL,
  `providerSlug` VARCHAR(50) NOT NULL,
  `eventType` VARCHAR(100) NOT NULL,
  `payloadJson` JSON NOT NULL,
  `signatureValid` BOOLEAN NOT NULL,
  `processedAt` TIMESTAMP,
  `processingStatus` ENUM('pending', 'processed', 'failed', 'skipped') DEFAULT 'pending',
  `processingError` TEXT,
  `receivedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `enrichment_cache` (
  `id` VARCHAR(36) PRIMARY KEY,
  `providerSlug` VARCHAR(50) NOT NULL,
  `lookupKey` VARCHAR(500) NOT NULL,
  `lookupType` VARCHAR(50) NOT NULL,
  `resultJson` JSON NOT NULL,
  `qualityScore` TEXT,
  `fetchedAt` TIMESTAMP NOT NULL,
  `expiresAt` TIMESTAMP NOT NULL,
  `hitCount` INT DEFAULT 1,
  `connectionId` VARCHAR(36)
);

CREATE TABLE IF NOT EXISTS `carrier_import_templates` (
  `id` VARCHAR(36) PRIMARY KEY,
  `carrierSlug` VARCHAR(50) NOT NULL,
  `reportType` VARCHAR(100) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT,
  `columnMappings` JSON NOT NULL,
  `parserType` ENUM('csv', 'pdf_table', 'pdf_ocr', 'excel') NOT NULL,
  `sampleHeaders` JSON,
  `isSystem` BOOLEAN DEFAULT FALSE,
  `createdBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `integration_sync_config` (
  `id` VARCHAR(36) PRIMARY KEY,
  `connectionId` VARCHAR(36) NOT NULL,
  `syncType` ENUM('full', 'incremental', 'webhook') NOT NULL DEFAULT 'incremental',
  `schedule` VARCHAR(64),
  `lastSyncAt` TIMESTAMP,
  `nextSyncAt` TIMESTAMP,
  `retryCount` INT DEFAULT 0,
  `maxRetries` INT,
  `backoffMinutes` INT,
  `fieldMappingOverrides` JSON,
  `filterCriteria` JSON,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `suitability_profiles` (
  `id` VARCHAR(36) PRIMARY KEY,
  `userId` INT NOT NULL,
  `organizationId` INT,
  `overallScore` FLOAT,
  `confidenceLevel` FLOAT DEFAULT FALSE,
  `dataCompleteness` FLOAT DEFAULT FALSE,
  `lastSynthesizedAt` TIMESTAMP,
  `synthesisVersion` INT DEFAULT 1,
  `dimensionScores` JSON,
  `sourceBreakdown` JSON,
  `changeVelocity` FLOAT,
  `status` ENUM('draft', 'active', 'needs_review', 'archived') DEFAULT 'draft',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `suitability_dimensions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `profileId` VARCHAR(36) NOT NULL,
  `dimensionKey` VARCHAR(64) NOT NULL,
  `dimensionLabel` VARCHAR(128) NOT NULL,
  `value` JSON,
  `score` FLOAT,
  `confidence` FLOAT DEFAULT FALSE,
  `sources` JSON,
  `lastUpdatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decayRate` FLOAT,
  `nextReviewAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `suitability_change_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `profileId` VARCHAR(36) NOT NULL,
  `dimensionKey` VARCHAR(64),
  `changeType` ENUM('user_input', 'advisor_update', 'system_inference', 'integration_sync', 'decay', 'milestone') NOT NULL,
  `previousValue` JSON,
  `newValue` JSON,
  `source` VARCHAR(128),
  `confidence` FLOAT,
  `triggeredBy` INT,
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `suitability_questions_queue` (
  `id` VARCHAR(36) PRIMARY KEY,
  `userId` INT NOT NULL,
  `dimensionKey` VARCHAR(64) NOT NULL,
  `question` TEXT NOT NULL,
  `questionType` ENUM('multiple_choice', 'scale', 'free_text', 'yes_no', 'numeric') DEFAULT 'multiple_choice',
  `options` JSON,
  `priority` INT,
  `status` ENUM('pending', 'asked', 'answered', 'skipped', 'expired') DEFAULT 'pending',
  `askedAt` TIMESTAMP,
  `answeredAt` TIMESTAMP,
  `answer` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `suitability_household_links` (
  `id` VARCHAR(36) PRIMARY KEY,
  `primaryUserId` INT NOT NULL,
  `linkedUserId` INT NOT NULL,
  `relationship` ENUM('spouse', 'partner', 'dependent', 'parent', 'sibling', 'other') NOT NULL,
  `sharedDimensions` JSON,
  `isActive` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `file_uploads` (
  `id` VARCHAR(36) PRIMARY KEY,
  `userId` INT NOT NULL,
  `organizationId` INT,
  `connectionId` VARCHAR(36),
  `filename` VARCHAR(512) NOT NULL,
  `mimeType` VARCHAR(128),
  `sizeBytes` INT,
  `storageUrl` TEXT,
  `storageKey` VARCHAR(512),
  `stage` ENUM('uploaded', 'validated', 'parsed', 'enriched', 'indexed', 'complete', 'failed') DEFAULT 'uploaded',
  `stageError` TEXT,
  `category` ENUM('personal_docs', 'financial_products', 'regulations', 'training', 'artifacts', 'skills', 'carrier_report', 'client_data', 'compliance') DEFAULT 'personal_docs',
  `visibility` ENUM('private', 'professional', 'management', 'admin') DEFAULT 'private',
  `metadata` JSON,
  `parsedContent` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `file_chunks` (
  `id` VARCHAR(36) PRIMARY KEY,
  `fileId` VARCHAR(36) NOT NULL,
  `chunkIndex` INT NOT NULL,
  `content` TEXT NOT NULL,
  `contentType` ENUM('text', 'table', 'image_description', 'header', 'metadata') DEFAULT 'text',
  `tokenCount` INT,
  `embedding` JSON,
  `metadata` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `file_derived_enrichments` (
  `id` VARCHAR(36) PRIMARY KEY,
  `fileId` VARCHAR(36) NOT NULL,
  `userId` INT NOT NULL,
  `enrichmentType` ENUM('suitability_signal', 'risk_indicator', 'product_match', 'compliance_flag', 'financial_metric', 'life_event') NOT NULL,
  `dimensionKey` VARCHAR(64),
  `extractedValue` JSON,
  `confidence` FLOAT,
  `appliedToProfile` BOOLEAN DEFAULT FALSE,
  `appliedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `analytical_models` (
  `id` VARCHAR(36) PRIMARY KEY,
  `name` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT,
  `layer` ENUM('platform', 'organization', 'manager', 'professional', 'user') NOT NULL,
  `category` ENUM('risk', 'suitability', 'compliance', 'engagement', 'financial', 'behavioral', 'market', 'operational') NOT NULL,
  `inputSchema` JSON,
  `outputSchema` JSON,
  `dependencies` JSON,
  `version` VARCHAR(20) DEFAULT '1.0.0',
  `isActive` BOOLEAN DEFAULT TRUE,
  `executionType` ENUM('llm', 'statistical', 'rule_based', 'hybrid') DEFAULT 'hybrid',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `model_runs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `modelId` VARCHAR(36) NOT NULL,
  `triggeredBy` ENUM('schedule', 'event', 'manual', 'dependency') NOT NULL,
  `triggerSource` VARCHAR(128),
  `inputData` JSON,
  `outputData` JSON,
  `status` ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  `errorMessage` TEXT,
  `durationMs` INT,
  `affectedUserIds` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `model_output_records` (
  `id` VARCHAR(36) PRIMARY KEY,
  `runId` VARCHAR(36) NOT NULL,
  `modelId` VARCHAR(36) NOT NULL,
  `entityType` ENUM('user', 'organization', 'team', 'platform') DEFAULT 'user',
  `entityId` INT,
  `outputType` VARCHAR(64) NOT NULL,
  `outputValue` JSON,
  `confidence` FLOAT,
  `previousValue` JSON,
  `delta` JSON,
  `expiresAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `model_schedules` (
  `id` VARCHAR(36) PRIMARY KEY,
  `modelId` VARCHAR(36) NOT NULL,
  `cronExpression` VARCHAR(64) NOT NULL,
  `timezone` VARCHAR(64) DEFAULT 'UTC',
  `isActive` BOOLEAN DEFAULT TRUE,
  `lastRunAt` TIMESTAMP,
  `nextRunAt` TIMESTAMP,
  `filterCriteria` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `generated_documents` (
  `id` VARCHAR(36) PRIMARY KEY,
  `userId` INT NOT NULL,
  `organizationId` INT,
  `templateSlug` VARCHAR(100) NOT NULL,
  `title` VARCHAR(512) NOT NULL,
  `format` ENUM('pdf', 'docx', 'xlsx', 'csv', 'json', 'html') NOT NULL,
  `storageUrl` TEXT,
  `storageKey` VARCHAR(512),
  `inputData` JSON,
  `status` ENUM('generating', 'complete', 'failed') DEFAULT 'generating',
  `errorMessage` TEXT,
  `expiresAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `propagation_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `sourceLayer` ENUM('platform', 'organization', 'manager', 'professional', 'user') NOT NULL,
  `targetLayer` ENUM('platform', 'organization', 'manager', 'professional', 'user') NOT NULL,
  `eventType` ENUM('insight', 'alert', 'recommendation', 'compliance', 'milestone', 'risk_change', 'opportunity') NOT NULL,
  `sourceEntityId` INT,
  `targetEntityId` INT,
  `payload` JSON,
  `priority` ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
  `status` ENUM('pending', 'delivered', 'acknowledged', 'acted', 'dismissed', 'expired') DEFAULT 'pending',
  `deliveredAt` TIMESTAMP,
  `expiresAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `propagation_actions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `eventId` VARCHAR(36) NOT NULL,
  `actorId` INT NOT NULL,
  `actionType` ENUM('acknowledge', 'act', 'dismiss', 'escalate', 'snooze', 'delegate') NOT NULL,
  `notes` TEXT,
  `resultData` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `coaching_messages` (
  `id` VARCHAR(36) PRIMARY KEY,
  `userId` INT NOT NULL,
  `organizationId` INT,
  `messageType` ENUM('nudge', 'celebration', 'reminder', 'education', 'insight', 'alert') NOT NULL,
  `category` VARCHAR(64),
  `title` VARCHAR(256) NOT NULL,
  `content` TEXT NOT NULL,
  `priority` ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
  `triggerEvent` VARCHAR(128),
  `status` ENUM('pending', 'delivered', 'read', 'acted', 'dismissed') DEFAULT 'pending',
  `deliveredAt` TIMESTAMP,
  `readAt` TIMESTAMP,
  `expiresAt` TIMESTAMP,
  `metadata` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `platform_learnings` (
  `id` VARCHAR(36) PRIMARY KEY,
  `learningType` ENUM('pattern', 'anomaly', 'trend', 'correlation', 'best_practice', 'risk_factor') NOT NULL,
  `category` VARCHAR(64),
  `description` TEXT NOT NULL,
  `evidence` JSON,
  `confidence` FLOAT,
  `impactScore` FLOAT,
  `applicableLayer` ENUM('platform', 'organization', 'manager', 'professional', 'user'),
  `actionRecommendation` TEXT,
  `status` ENUM('detected', 'validated', 'applied', 'rejected', 'expired') DEFAULT 'detected',
  `appliedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `education_triggers` (
  `id` VARCHAR(36) PRIMARY KEY,
  `triggerCondition` JSON NOT NULL,
  `educationModuleId` INT,
  `targetAudience` ENUM('all', 'new_users', 'professionals', 'managers', 'admins') DEFAULT 'all',
  `title` VARCHAR(256) NOT NULL,
  `content` TEXT,
  `contentUrl` TEXT,
  `deliveryMethod` ENUM('in_app', 'chat_injection', 'notification', 'email') DEFAULT 'in_app',
  `priority` INT,
  `isActive` BOOLEAN DEFAULT TRUE,
  `timesTriggered` INT DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `auth_provider_tokens` (
  `id` VARCHAR(36) PRIMARY KEY,
  `userId` INT NOT NULL,
  `provider` ENUM('linkedin', 'google') NOT NULL,
  `accessTokenEncrypted` TEXT NOT NULL,
  `refreshTokenEncrypted` TEXT,
  `tokenExpiresAt` TIMESTAMP,
  `scopesGranted` JSON NOT NULL,
  `lastProfileFetchAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `auth_enrichment_log` (
  `id` VARCHAR(36) PRIMARY KEY,
  `userId` INT NOT NULL,
  `provider` ENUM('linkedin', 'google', 'email', 'apollo', 'pdl', 'manus') NOT NULL,
  `eventType` ENUM('initial_signup', 're_auth', 'token_refresh', 'manual_enrich', 'periodic_refresh') NOT NULL,
  `fieldsCaptured` JSON NOT NULL,
  `fieldsNew` JSON NOT NULL,
  `fieldsUpdated` JSON NOT NULL,
  `rawResponseHash` VARCHAR(64) NOT NULL,
  `suitabilityDimensionsUpdated` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `prompt_experiment_results` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `experimentName` VARCHAR(256) NOT NULL,
  `variantAId` INT NOT NULL,
  `variantBId` INT NOT NULL,
  `totalSamples` INT DEFAULT 0,
  `variantAPositive` INT DEFAULT 0,
  `variantBPositive` INT DEFAULT 0,
  `variantAAvgLatency` FLOAT,
  `variantBAvgLatency` FLOAT,
  `pValue` FLOAT,
  `significanceReached` BOOLEAN DEFAULT FALSE,
  `winnerId` INT,
  `autoPromoted` BOOLEAN DEFAULT FALSE,
  `status` ENUM('running', 'completed', 'cancelled') DEFAULT 'running',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `prompt_golden_tests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `promptText` TEXT NOT NULL,
  `expectedResponsePattern` TEXT NOT NULL,
  `category` VARCHAR(64) DEFAULT 'general',
  `complianceMustPass` BOOLEAN DEFAULT TRUE,
  `minSimilarityScore` FLOAT,
  `isActive` BOOLEAN DEFAULT TRUE,
  `lastTestedAt` TIMESTAMP,
  `lastPassedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `prompt_regression_runs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `variantId` INT,
  `totalTests` INT DEFAULT 0,
  `passedTests` INT DEFAULT 0,
  `avgSimilarity` FLOAT,
  `compliancePassRate` FLOAT,
  `qualityDrop` BOOLEAN DEFAULT FALSE,
  `promotionBlocked` BOOLEAN DEFAULT FALSE,
  `runAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `compliance_prescreening` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `messageId` INT NOT NULL,
  `conversationId` INT NOT NULL,
  `checkType` ENUM('unsuitable_recommendation', 'promissory_language', 'unauthorized_practice', 'concentration_risk', 'missing_disclosure') NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
  `details` TEXT,
  `actionTaken` ENUM('passed', 'warning_injected', 'held_for_review') DEFAULT 'passed',
  `reviewedBy` INT,
  `resolvedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `conversation_compliance_scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversationId` INT NOT NULL,
  `score` INT,
  `checksRun` INT DEFAULT 0,
  `checksPassed` INT DEFAULT 0,
  `flaggedForReview` BOOLEAN DEFAULT FALSE,
  `lastUpdated` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `deployment_checks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `checkType` VARCHAR(64) NOT NULL,
  `passed` BOOLEAN DEFAULT FALSE,
  `details` TEXT,
  `durationMs` INT,
  `runAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `deployment_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version` VARCHAR(64) NOT NULL,
  `description` TEXT,
  `testsPassed` INT,
  `testsTotal` INT,
  `bundleSizeKb` INT,
  `rolloutPercentage` INT,
  `status` ENUM('deploying', 'canary', 'rolling_out', 'complete', 'rolled_back') DEFAULT 'deploying',
  `errorRate` FLOAT,
  `previousVersion` VARCHAR(64),
  `deployedBy` INT,
  `deployedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `knowledge_graph_entities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `entityType` ENUM('person', 'company', 'product', 'concept', 'regulation', 'account') NOT NULL,
  `canonicalName` VARCHAR(512) NOT NULL,
  `aliases` JSON,
  `metadata` JSON,
  `lastVerified` TIMESTAMP,
  `confidence` FLOAT,
  `source` VARCHAR(128),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `knowledge_graph_edges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `fromEntityId` INT NOT NULL,
  `toEntityId` INT NOT NULL,
  `relationshipType` VARCHAR(128) NOT NULL,
  `weight` FLOAT,
  `validFrom` TIMESTAMP,
  `validUntil` TIMESTAMP,
  `source` VARCHAR(128),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `entity_resolution_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pattern` VARCHAR(512) NOT NULL,
  `canonicalEntityId` INT NOT NULL,
  `confidence` FLOAT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `model_scenarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `baseRunId` INT,
  `modelType` VARCHAR(64) NOT NULL,
  `scenarioName` VARCHAR(256) NOT NULL,
  `adjustedParams` JSON,
  `resultJson` JSON,
  `comparisonNotes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `model_backtests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `modelType` VARCHAR(64) NOT NULL,
  `historicalEvent` VARCHAR(128) NOT NULL,
  `eventYear` INT NOT NULL,
  `portfolioParams` JSON,
  `resultJson` JSON,
  `maxDrawdown` FLOAT,
  `recoveryMonths` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `context_assembly_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversationId` INT NOT NULL,
  `messageId` INT,
  `layer` VARCHAR(64) NOT NULL,
  `itemsConsidered` INT DEFAULT 0,
  `itemsIncluded` INT DEFAULT 0,
  `itemsPruned` INT DEFAULT 0,
  `tokenBudget` INT,
  `tokensUsed` INT,
  `complexityLevel` ENUM('simple', 'moderate', 'complex') DEFAULT 'moderate',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `server_errors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `errorType` VARCHAR(128) NOT NULL,
  `message` TEXT,
  `stack` TEXT,
  `componentName` VARCHAR(256),
  `userId` INT,
  `url` VARCHAR(1024),
  `metadata` JSON,
  `resolved` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `calculator_scenarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `calculatorType` VARCHAR(64) NOT NULL,
  `name` VARCHAR(256) NOT NULL,
  `inputsJson` JSON,
  `resultsJson` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `predictive_triggers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `triggerType` VARCHAR(128) NOT NULL,
  `conditionJson` JSON,
  `actionType` VARCHAR(64) NOT NULL,
  `actionJson` JSON,
  `active` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `benchmark_aggregates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dimension` VARCHAR(128) NOT NULL,
  `ageBracket` VARCHAR(32),
  `incomeBracket` VARCHAR(32),
  `percentile25` FLOAT,
  `percentile50` FLOAT,
  `percentile75` FLOAT,
  `sampleSize` INT DEFAULT 0,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `regulatory_updates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source` VARCHAR(128) NOT NULL,
  `title` VARCHAR(512) NOT NULL,
  `summary` TEXT,
  `relevanceScore` FLOAT,
  `categories` JSON,
  `actionRequired` BOOLEAN DEFAULT FALSE,
  `reviewedBy` INT,
  `publishedAt` TIMESTAMP,
  `ingestedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `disclaimer_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `topic` VARCHAR(128) NOT NULL,
  `disclaimerText` TEXT NOT NULL,
  `version` INT DEFAULT 1,
  `effectiveDate` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `supersededBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `disclaimer_audit` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversationId` INT NOT NULL,
  `disclaimerId` INT NOT NULL,
  `disclaimerVersion` INT DEFAULT 1,
  `shownAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `regulatory_alerts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source` VARCHAR(128) NOT NULL,
  `filingType` VARCHAR(64),
  `entity` VARCHAR(256),
  `relevanceToUser` TEXT,
  `summary` TEXT,
  `alertSent` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `onboarding_progress` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `path` ENUM('advisor', 'client', 'admin') NOT NULL,
  `currentStep` INT DEFAULT 0,
  `totalSteps` INT,
  `completedSteps` JSON,
  `skippedBasics` BOOLEAN DEFAULT FALSE,
  `completedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `product_suitability_evaluations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `productId` INT NOT NULL,
  `userId` INT NOT NULL,
  `suitabilityScore` FLOAT,
  `evaluationDate` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `qualifyingDimensions` JSON,
  `disqualifyingDimensions` JSON,
  `status` ENUM('qualified', 'marginal', 'disqualified', 'needs_review') DEFAULT 'qualified'
);

CREATE TABLE IF NOT EXISTS `disclaimer_interactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `disclaimerId` INT NOT NULL,
  `userId` INT NOT NULL,
  `action` ENUM('shown', 'scrolled', 'clicked', 'acknowledged') DEFAULT 'shown',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `disclaimer_translations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `disclaimerId` INT NOT NULL,
  `language` VARCHAR(10) NOT NULL,
  `translatedText` TEXT NOT NULL,
  `verifiedBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `conversation_topics` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversationId` INT NOT NULL,
  `messageId` INT,
  `topic` VARCHAR(128) NOT NULL,
  `previousTopic` VARCHAR(128),
  `disclaimerInjected` BOOLEAN DEFAULT FALSE,
  `detectedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `proactive_escalation_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `triggerType` VARCHAR(128) NOT NULL,
  `conditionText` TEXT,
  `threshold` FLOAT,
  `active` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `professional_availability` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `professionalId` INT NOT NULL,
  `dayOfWeek` INT NOT NULL,
  `startTime` VARCHAR(8) NOT NULL,
  `endTime` VARCHAR(8) NOT NULL,
  `timezone` VARCHAR(64) DEFAULT 'America/New_York',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `consultation_bookings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `professionalId` INT NOT NULL,
  `scheduledAt` TIMESTAMP NOT NULL,
  `durationMinutes` INT,
  `preBriefId` INT,
  `status` ENUM('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
  `dailyRoomUrl` VARCHAR(512),
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `user_guardrails` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `guardrailType` VARCHAR(64) NOT NULL,
  `value` VARCHAR(256) NOT NULL,
  `reason` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `role_elevations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `fromRole` VARCHAR(32) NOT NULL,
  `toRole` VARCHAR(32) NOT NULL,
  `grantedBy` INT NOT NULL,
  `grantedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` TIMESTAMP NOT NULL,
  `reason` TEXT,
  `revokedAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `delegations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `delegatorId` INT NOT NULL,
  `delegateId` INT NOT NULL,
  `scope` JSON,
  `grantedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` TIMESTAMP,
  `active` BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS `access_policies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `resourceType` VARCHAR(128) NOT NULL,
  `requiredAttributes` JSON,
  `effect` ENUM('allow', 'deny') DEFAULT 'allow',
  `description` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `encryption_keys` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `keyAlias` VARCHAR(128) NOT NULL,
  `status` ENUM('active', 'rotating', 'retired') DEFAULT 'active',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `rotatedAt` TIMESTAMP,
  `retiredAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `encrypted_fields_registry` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tableName` VARCHAR(128) NOT NULL,
  `columnName` VARCHAR(128) NOT NULL,
  `encryptionMethod` VARCHAR(64) DEFAULT 'AES-256-GCM',
  `keyAlias` VARCHAR(128) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `retention_actions_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dataType` VARCHAR(128) NOT NULL,
  `action` ENUM('delete', 'archive', 'anonymize') NOT NULL,
  `recordsAffected` INT DEFAULT 0,
  `executedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `org_retention_policies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orgId` INT NOT NULL,
  `dataCategory` VARCHAR(128) NOT NULL,
  `retentionDays` INT NOT NULL,
  `action` ENUM('delete', 'archive', 'anonymize') DEFAULT 'archive',
  `configuredBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `user_ai_boundaries` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `boundaryType` VARCHAR(64) NOT NULL,
  `value` TEXT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `field_sharing_controls` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `fieldName` VARCHAR(128) NOT NULL,
  `shareWithRole` VARCHAR(32),
  `grantedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `org_ai_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orgId` INT NOT NULL,
  `preferredModel` VARCHAR(128),
  `monthlyTokenBudget` INT,
  `tokensUsedThisMonth` INT DEFAULT 0,
  `customSystemPromptAdditions` TEXT,
  `budgetAlertSent` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `org_prompt_customizations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orgId` INT NOT NULL,
  `promptText` TEXT NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `reviewedBy` INT,
  `approvedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `agent_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(256) NOT NULL,
  `description` TEXT,
  `stepsJson` JSON,
  `category` VARCHAR(64),
  `orgId` INT,
  `isBuiltIn` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `agent_performance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agentTemplateId` INT NOT NULL,
  `runs` INT DEFAULT 0,
  `successes` INT DEFAULT 0,
  `avgDurationMs` INT,
  `avgCostUsd` FLOAT,
  `avgSatisfactionScore` FLOAT,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `compliance_predictions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agentActionId` INT,
  `predictedRiskScore` INT,
  `riskFactors` JSON,
  `predictionModelVersion` VARCHAR(32),
  `requiresApproval` BOOLEAN DEFAULT FALSE,
  `approved` BOOLEAN,
  `approvedBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `agent_autonomy_levels` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `agentTemplateId` INT NOT NULL,
  `currentLevel` INT DEFAULT 1,
  `level1Runs` INT DEFAULT 0,
  `level2Runs` INT DEFAULT 0,
  `promotedAt` TIMESTAMP,
  `promotedBy` INT
);

CREATE TABLE IF NOT EXISTS `plaid_webhooks_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `webhookType` VARCHAR(128) NOT NULL,
  `itemId` VARCHAR(256),
  `payload` JSON,
  `processedAt` TIMESTAMP,
  `status` ENUM('received', 'processing', 'processed', 'failed') DEFAULT 'received',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `transaction_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transactionId` VARCHAR(256) NOT NULL,
  `userId` INT NOT NULL,
  `aiCategory` VARCHAR(128),
  `userOverrideCategory` VARCHAR(128),
  `confidence` FLOAT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `reconciliation_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `accountId` VARCHAR(256) NOT NULL,
  `expectedBalance` TEXT,
  `actualBalance` TEXT,
  `discrepancy` TEXT,
  `resolved` BOOLEAN DEFAULT FALSE,
  `resolvedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `crm_sync_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `direction` ENUM('push', 'pull') NOT NULL,
  `crmProvider` VARCHAR(128) NOT NULL,
  `recordsSynced` INT DEFAULT 0,
  `syncType` VARCHAR(64),
  `status` ENUM('started', 'completed', 'failed') DEFAULT 'started',
  `errorDetails` TEXT,
  `completedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `carrier_submissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `quoteId` INT,
  `carrierId` INT,
  `submissionMethod` ENUM('api', 'pdf', 'manual') DEFAULT 'manual',
  `status` ENUM('draft', 'submitted', 'accepted', 'rejected', 'pending') DEFAULT 'draft',
  `submittedAt` TIMESTAMP,
  `responseReceivedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `market_data_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `symbol` VARCHAR(16) NOT NULL,
  `subscribedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `market_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `eventType` VARCHAR(64) NOT NULL,
  `symbol` VARCHAR(16) NOT NULL,
  `magnitude` FLOAT,
  `details` TEXT,
  `insightGenerated` BOOLEAN DEFAULT FALSE,
  `detectedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `regulatory_impact_analyses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `updateId` INT NOT NULL,
  `impactLevel` ENUM('high', 'medium', 'low') DEFAULT 'low',
  `affectedAreas` JSON,
  `recommendedActions` JSON,
  `generatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `compliance_weekly_briefs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `weekStart` TEXT NOT NULL,
  `briefJson` JSON,
  `distributedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `load_test_results` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `testDate` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `scenario` VARCHAR(256) NOT NULL,
  `concurrentUsers` INT,
  `requestsPerSecond` FLOAT,
  `p95LatencyMs` INT,
  `errors` INT DEFAULT 0,
  `notes` TEXT
);

CREATE TABLE IF NOT EXISTS `knowledge_articles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `category` VARCHAR(100) NOT NULL,
  `subcategory` VARCHAR(100),
  `title` VARCHAR(500) NOT NULL,
  `content` TEXT NOT NULL,
  `contentType` ENUM('process', 'concept', 'reference', 'template', 'faq', 'policy', 'guide') NOT NULL DEFAULT 'concept',
  `metadata` JSON,
  `version` INT NOT NULL DEFAULT 1,
  `effectiveDate` TIMESTAMP,
  `expiryDate` TIMESTAMP,
  `source` ENUM('manual', 'ingested', 'ai_generated', 'conversation_mining') NOT NULL DEFAULT 'manual',
  `sourceUrl` TEXT,
  `createdBy` INT,
  `approvedBy` INT,
  `approvedAt` TIMESTAMP,
  `usageCount` INT NOT NULL DEFAULT 0,
  `avgHelpfulnessScore` FLOAT DEFAULT FALSE,
  `freshnessScore` FLOAT,
  `lastUsedAt` TIMESTAMP,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `knowledge_article_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `articleId` INT NOT NULL,
  `version` INT NOT NULL,
  `content` TEXT NOT NULL,
  `changedBy` INT,
  `changedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changeReason` TEXT
);

CREATE TABLE IF NOT EXISTS `knowledge_article_feedback` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `articleId` INT NOT NULL,
  `userId` INT,
  `helpful` BOOLEAN NOT NULL,
  `feedbackText` TEXT,
  `context` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `knowledge_gaps` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `topicCluster` VARCHAR(200) NOT NULL,
  `queryCount` INT NOT NULL DEFAULT 1,
  `sampleQueries` JSON,
  `suggestedArticleDraft` TEXT,
  `status` ENUM('open', 'in_progress', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolvedAt` TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `knowledge_ingestion_jobs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sourceType` ENUM('document', 'url', 'conversation', 'api', 'template', 'bulk') NOT NULL,
  `sourceUrl` TEXT,
  `sourceFilename` VARCHAR(500),
  `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `articlesCreated` INT NOT NULL DEFAULT 0,
  `articlesUpdated` INT NOT NULL DEFAULT 0,
  `startedAt` TIMESTAMP,
  `completedAt` TIMESTAMP,
  `error` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `capability_modes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT,
  `icon` VARCHAR(50),
  `systemPromptAdditions` TEXT,
  `requiredKnowledgeCategories` JSON,
  `availableTools` JSON,
  `availableModels` JSON,
  `defaultForRoles` JSON,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `ai_tools` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `toolName` VARCHAR(200) NOT NULL,
  `toolType` ENUM('calculator', 'model', 'action', 'query', 'report') NOT NULL,
  `description` TEXT NOT NULL,
  `inputSchema` JSON NOT NULL,
  `outputSchema` JSON,
  `trpcProcedure` VARCHAR(200) NOT NULL,
  `requiresAuth` BOOLEAN NOT NULL DEFAULT TRUE,
  `requiresConfirmation` BOOLEAN NOT NULL DEFAULT FALSE,
  `usageCount` INT NOT NULL DEFAULT 0,
  `successRate` FLOAT,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `ai_tool_calls` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `toolId` INT NOT NULL,
  `conversationId` INT,
  `messageId` INT,
  `userId` INT,
  `inputJson` JSON,
  `outputJson` JSON,
  `success` BOOLEAN NOT NULL DEFAULT TRUE,
  `latencyMs` INT,
  `userModifiedInput` BOOLEAN NOT NULL DEFAULT FALSE,
  `errorMessage` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `study_progress` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `certification` VARCHAR(100) NOT NULL,
  `topicsCovered` JSON,
  `quizScores` JSON,
  `weakAreas` JSON,
  `studyTimeMinutes` INT NOT NULL DEFAULT 0,
  `totalQuestionsAttempted` INT NOT NULL DEFAULT 0,
  `totalQuestionsCorrect` INT NOT NULL DEFAULT 0,
  `currentDifficulty` ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'beginner',
  `lastSessionAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `export_jobs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `orgId` INT,
  `format` ENUM('csv', 'excel', 'pdf', 'docx', 'json') NOT NULL DEFAULT 'csv',
  `entityType` VARCHAR(100) NOT NULL,
  `filters` JSON,
  `status` ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `fileUrl` TEXT,
  `fileKey` TEXT,
  `rowCount` INT DEFAULT 0,
  `errorMessage` TEXT,
  `startedAt` TIMESTAMP,
  `completedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `document_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orgId` INT,
  `name` VARCHAR(255) NOT NULL,
  `category` ENUM('compliance', 'client_report', 'proposal', 'agreement', 'disclosure', 'meeting_notes', 'review', 'planning', 'custom') NOT NULL DEFAULT 'custom',
  `description` TEXT,
  `templateBody` TEXT NOT NULL,
  `variables` JSON,
  `outputFormat` ENUM('pdf', 'docx', 'html') NOT NULL DEFAULT 'pdf',
  `isSystem` BOOLEAN NOT NULL DEFAULT FALSE,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `version` INT NOT NULL DEFAULT 1,
  `createdBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `mfa_secrets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `secret` VARCHAR(255) NOT NULL,
  `method` ENUM('totp', 'sms', 'email') NOT NULL DEFAULT 'totp',
  `verified` BOOLEAN NOT NULL DEFAULT FALSE,
  `enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `lastUsedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `mfa_backup_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `codeHash` VARCHAR(255) NOT NULL,
  `used` BOOLEAN NOT NULL DEFAULT FALSE,
  `usedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `model_cards` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `modelName` VARCHAR(255) NOT NULL,
  `version` VARCHAR(50) NOT NULL DEFAULT '1.0',
  `description` TEXT,
  `intendedUse` TEXT,
  `limitations` TEXT,
  `trainingDataSummary` TEXT,
  `performanceMetrics` JSON,
  `fairnessMetrics` JSON,
  `ethicalConsiderations` TEXT,
  `updateFrequency` VARCHAR(100),
  `lastEvaluatedAt` TIMESTAMP,
  `published` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `coi_disclosures` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `advisorId` INT,
  `orgId` INT,
  `disclosureType` ENUM('compensation', 'affiliation', 'ownership', 'referral', 'other') NOT NULL,
  `description` TEXT NOT NULL,
  `relatedProductId` INT,
  `relatedRecommendationId` INT,
  `severity` ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  `status` ENUM('pending', 'disclosed', 'acknowledged', 'resolved') NOT NULL DEFAULT 'pending',
  `disclosedAt` TIMESTAMP,
  `acknowledgedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `recommendations_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `advisorId` INT,
  `conversationId` INT,
  `messageId` INT,
  `productId` INT,
  `recommendationType` ENUM('product', 'strategy', 'action', 'allocation', 'rebalance') NOT NULL,
  `summary` TEXT NOT NULL,
  `reasoning` TEXT,
  `factors` JSON,
  `confidenceScore` FLOAT,
  `suitabilityScore` FLOAT,
  `riskLevel` ENUM('low', 'medium', 'high', 'very_high'),
  `disclaimers` JSON,
  `coiDisclosureIds` JSON,
  `status` ENUM('suggested', 'accepted', 'rejected', 'implemented', 'expired') NOT NULL DEFAULT 'suggested',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `report_templates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `orgId` INT,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` ENUM('portfolio_review', 'financial_plan', 'insurance_analysis', 'tax_summary', 'estate_plan', 'quarterly_report', 'annual_review', 'custom') NOT NULL DEFAULT 'custom',
  `templateBody` TEXT NOT NULL,
  `sections` JSON,
  `branding` JSON,
  `isSystem` BOOLEAN NOT NULL DEFAULT FALSE,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `report_jobs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `orgId` INT,
  `templateId` INT NOT NULL,
  `clientId` INT,
  `parameters` JSON,
  `status` ENUM('pending', 'generating', 'completed', 'failed') NOT NULL DEFAULT 'pending',
  `outputUrl` TEXT,
  `outputKey` TEXT,
  `outputFormat` ENUM('pdf', 'docx', 'html') NOT NULL DEFAULT 'pdf',
  `errorMessage` TEXT,
  `scheduledAt` TIMESTAMP,
  `recurringCron` VARCHAR(100),
  `startedAt` TIMESTAMP,
  `completedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `paper_trades` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `tradeType` ENUM('buy', 'sell') NOT NULL,
  `quantity` TEXT NOT NULL,
  `price` TEXT NOT NULL,
  `totalValue` TEXT NOT NULL,
  `aiSuggested` BOOLEAN NOT NULL DEFAULT FALSE,
  `aiReasoning` TEXT,
  `actualPriceAtClose` TEXT,
  `pnl` TEXT,
  `pnlPercent` FLOAT,
  `status` ENUM('open', 'closed', 'cancelled') NOT NULL DEFAULT 'open',
  `openedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `prompt_interactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `promptText` TEXT NOT NULL,
  `promptCategory` VARCHAR(100),
  `source` ENUM('suggested', 'typed', 'voice', 'command_palette') NOT NULL DEFAULT 'typed',
  `wasSuggested` BOOLEAN NOT NULL DEFAULT FALSE,
  `wasClicked` BOOLEAN NOT NULL DEFAULT FALSE,
  `responseQualityScore` FLOAT,
  `sessionContext` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `consent_tracking` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `consentType` ENUM('ai_chat', 'voice', 'doc_upload', 'data_sharing', 'marketing', 'analytics', 'third_party') NOT NULL,
  `granted` BOOLEAN NOT NULL DEFAULT FALSE,
  `grantedAt` TIMESTAMP,
  `revokedAt` TIMESTAMP,
  `ipAddress` VARCHAR(45),
  `userAgent` TEXT,
  `version` VARCHAR(50) NOT NULL DEFAULT '1.0',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `performance_metrics` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `metricName` VARCHAR(255) NOT NULL,
  `metricCategory` ENUM('latency', 'throughput', 'error_rate', 'availability', 'ai_quality', 'user_satisfaction') NOT NULL,
  `value` FLOAT NOT NULL,
  `unit` VARCHAR(50),
  `tags` JSON,
  `slaTarget` FLOAT,
  `slaMet` BOOLEAN,
  `recordedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `browser_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `agentRunId` INT,
  `targetUrl` TEXT NOT NULL,
  `status` ENUM('initializing', 'active', 'completed', 'failed', 'timeout') NOT NULL DEFAULT 'initializing',
  `actionsLog` JSON,
  `screenshots` JSON,
  `domain` VARCHAR(255),
  `allowed` BOOLEAN NOT NULL DEFAULT FALSE,
  `startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `workflow_checkpoints` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `workflowId` INT NOT NULL,
  `agentRunId` INT,
  `stepIndex` INT NOT NULL DEFAULT 0,
  `stepName` VARCHAR(255),
  `state` JSON,
  `status` ENUM('saved', 'restored', 'compensating', 'compensated', 'failed') NOT NULL DEFAULT 'saved',
  `compensationAction` TEXT,
  `retryCount` INT NOT NULL DEFAULT 0,
  `maxRetries` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `professional_verifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `professionalId` INT NOT NULL,
  `verificationSource` ENUM('finra_brokercheck', 'sec_iapd', 'cfp_board', 'nasba_cpaverify', 'nipr_pdb', 'nmls', 'state_bar', 'ibba', 'martindale', 'avvo') NOT NULL,
  `verificationStatus` ENUM('verified', 'not_found', 'flagged', 'expired', 'pending') NOT NULL,
  `externalId` VARCHAR(100),
  `externalUrl` VARCHAR(500),
  `rawData` JSON,
  `disclosures` JSON,
  `licenseStates` JSON,
  `licenseExpiration` TIMESTAMP,
  `verifiedAt` INT NOT NULL,
  `expiresAt` INT,
  `verificationMethod` ENUM('api', 'scrape', 'manual', 'n8n_workflow') NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `coi_verification_badges` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `coiContactId` INT,
  `professionalId` INT,
  `badgeType` ENUM('license_active', 'cfp_certified', 'cpa_active', 'bar_good_standing', 'nmls_authorized', 'nipr_licensed', 'cbi_certified', 'no_disclosures', 'fiduciary', 'am_best_rated', 'peer_rated') NOT NULL,
  `badgeLabel` VARCHAR(100),
  `badgeData` JSON,
  `confidenceScore` TEXT,
  `sourceVerificationId` INT,
  `grantedAt` INT NOT NULL,
  `expiresAt` INT,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `verification_schedules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `professionalId` INT NOT NULL,
  `verificationSource` ENUM('finra_brokercheck', 'sec_iapd', 'cfp_board', 'nasba_cpaverify', 'nipr_pdb', 'nmls', 'state_bar', 'ibba', 'martindale', 'avvo') NOT NULL,
  `frequencyDays` INT NOT NULL,
  `lastRunAt` INT,
  `nextRunAt` INT NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `premium_finance_rates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `rateDate` TEXT NOT NULL,
  `sofr` TEXT,
  `sofr30` TEXT,
  `sofr90` TEXT,
  `treasury10y` TEXT,
  `treasury30y` TEXT,
  `primeRate` TEXT,
  `fetchedAt` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `tax_parameters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `taxYear` INT NOT NULL,
  `parameterName` VARCHAR(100) NOT NULL,
  `parameterCategory` VARCHAR(50) NOT NULL,
  `filingStatus` VARCHAR(50) DEFAULT 'all',
  `valueJson` JSON NOT NULL,
  `sourceUrl` VARCHAR(500),
  `effectiveDate` VARCHAR(20) NOT NULL,
  `expiryDate` VARCHAR(20),
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `ssa_parameters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `parameterYear` INT NOT NULL,
  `parameterName` VARCHAR(100) NOT NULL,
  `valueJson` JSON NOT NULL,
  `sourceUrl` VARCHAR(500),
  `effectiveDate` VARCHAR(20) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `ssa_life_tables` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `age` INT NOT NULL,
  `sex` VARCHAR(10) NOT NULL,
  `probabilityOfDeath` VARCHAR(20) NOT NULL,
  `lifeExpectancy` VARCHAR(10) NOT NULL,
  `tableYear` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `medicare_parameters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `parameterYear` INT NOT NULL,
  `parameterName` VARCHAR(100) NOT NULL,
  `valueJson` JSON NOT NULL,
  `sourceUrl` VARCHAR(500),
  `effectiveDate` VARCHAR(20) NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `insurance_carriers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `carrierName` VARCHAR(200) NOT NULL,
  `carrierNameAliases` JSON,
  `amBestId` VARCHAR(50),
  `amBestFsr` VARCHAR(10),
  `amBestFsrNumeric` INT,
  `amBestOutlook` VARCHAR(20),
  `spRating` VARCHAR(10),
  `moodysRating` VARCHAR(10),
  `fitchRating` VARCHAR(10),
  `naicId` VARCHAR(20),
  `domicileState` VARCHAR(2),
  `companyType` VARCHAR(20),
  `yearFounded` INT,
  `totalAssetsBillions` VARCHAR(20),
  `statutorySurplusBillions` VARCHAR(20),
  `complaintRatio` VARCHAR(10),
  `productLines` JSON,
  `ratingLastUpdated` VARCHAR(20),
  `active` BOOLEAN DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `insurance_products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `carrierId` INT NOT NULL,
  `productName` VARCHAR(200) NOT NULL,
  `productType` VARCHAR(50) NOT NULL,
  `productCategory` VARCHAR(30) NOT NULL,
  `features` JSON,
  `minFaceAmount` VARCHAR(20),
  `maxFaceAmount` VARCHAR(20),
  `minIssueAge` INT,
  `maxIssueAge` INT,
  `underwritingTypes` JSON,
  `ridersAvailable` JSON,
  `stateAvailability` JSON,
  `compulifeProductId` VARCHAR(50),
  `active` BOOLEAN DEFAULT TRUE,
  `lastRateUpdate` VARCHAR(20),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `iul_crediting_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `productId` INT NOT NULL,
  `effectiveDate` VARCHAR(20) NOT NULL,
  `indexStrategy` VARCHAR(100) NOT NULL,
  `capRate` VARCHAR(10),
  `participationRate` VARCHAR(10),
  `floorRate` VARCHAR(10),
  `spread` VARCHAR(10),
  `multiplierBonus` VARCHAR(10),
  `source` VARCHAR(30),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `market_index_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `indexSymbol` VARCHAR(20) NOT NULL,
  `date` VARCHAR(20) NOT NULL,
  `openPrice` VARCHAR(20),
  `closePrice` VARCHAR(20),
  `dailyReturn` VARCHAR(20),
  `totalReturnIndex` VARCHAR(20),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `economic_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` VARCHAR(20) NOT NULL,
  `metricName` VARCHAR(50) NOT NULL,
  `value` VARCHAR(20),
  `source` VARCHAR(50),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `industry_benchmarks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `benchmarkCategory` VARCHAR(100) NOT NULL,
  `benchmarkName` VARCHAR(200) NOT NULL,
  `benchmarkValue` VARCHAR(20),
  `benchmarkUnit` VARCHAR(50),
  `reportingPeriod` VARCHAR(20),
  `source` VARCHAR(100),
  `notes` TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `nitrogen_risk_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `nitrogenRiskNumber` INT,
  `portfolioRiskNumber` INT,
  `riskAlignmentScore` INT,
  `lastSyncedAt` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `esignature_tracking` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `professionalId` INT NOT NULL,
  `clientUserId` INT,
  `envelopeId` VARCHAR(100) NOT NULL,
  `provider` VARCHAR(20) NOT NULL,
  `documentType` VARCHAR(100),
  `status` VARCHAR(20) NOT NULL DEFAULT 'created',
  `sentAt` INT,
  `signedAt` INT,
  `completedAt` INT,
  `relatedProductId` INT,
  `relatedQuoteId` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `plaid_webhook_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `itemId` VARCHAR(100),
  `webhookType` VARCHAR(50) NOT NULL,
  `webhookCode` VARCHAR(50) NOT NULL,
  `errorCode` VARCHAR(50),
  `processedAt` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `plaid_holdings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `accountId` VARCHAR(100) NOT NULL,
  `securityId` VARCHAR(100),
  `ticker` VARCHAR(20),
  `name` VARCHAR(200),
  `quantity` VARCHAR(20),
  `costBasis` VARCHAR(20),
  `currentValue` VARCHAR(20),
  `lastSynced` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `credit_profiles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `pullDate` VARCHAR(20) NOT NULL,
  `creditScore` INT,
  `scoreModel` VARCHAR(50),
  `utilizationPercent` VARCHAR(10),
  `totalDebt` VARCHAR(20),
  `openAccounts` INT,
  `derogatoryMarks` INT,
  `hardInquiries` INT,
  `oldestAccountYears` INT,
  `consentId` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit hash chain columns for existing audit_trail table
ALTER TABLE `audit_trail` ADD COLUMN IF NOT EXISTS `entryHash` VARCHAR(64);
ALTER TABLE `audit_trail` ADD COLUMN IF NOT EXISTS `previousHash` VARCHAR(64);
