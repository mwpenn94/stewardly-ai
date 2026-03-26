# Stewardly Database Schema

Total tables: 263

## access_policies

```sql
CREATE TABLE `access_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `resource_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `required_attributes` json DEFAULT NULL,
  `effect` enum('allow','deny') COLLATE utf8mb4_unicode_ci DEFAULT 'allow',
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## advisory_executions

```sql
CREATE TABLE `advisory_executions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `professionalId` int NOT NULL,
  `executionType` enum('account_open','rebalance','harvest','transfer','trade','rollover') COLLATE utf8mb4_unicode_ci NOT NULL,
  `executionDataJson` json DEFAULT NULL,
  `taxImpactEstimate` decimal(12,2) DEFAULT NULL,
  `gateStatus` enum('draft','pending_review','approved','executing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `gateReviewId` int DEFAULT NULL,
  `reviewerId` int DEFAULT NULL,
  `approvedAt` bigint DEFAULT NULL,
  `executedAt` bigint DEFAULT NULL,
  `custodianConfirmation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postExecutionAuditJson` json DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## affiliated_resources

```sql
CREATE TABLE `affiliated_resources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('carrier','lender','ria','advanced_markets','general_partner') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contactInfo` json DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `organizationId` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_affiliated_org` (`organizationId`),
  CONSTRAINT `fk_affiliated_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## agent_actions

```sql
CREATE TABLE `agent_actions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `agentInstanceId` int NOT NULL,
  `actionType` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetSystem` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `targetUrl` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dataAccessedSummary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dataModifiedSummary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `screenshotHash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complianceTier` int DEFAULT '1',
  `gateResult` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `durationMs` int DEFAULT NULL,
  `errorMessage` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## agent_autonomy_levels

```sql
CREATE TABLE `agent_autonomy_levels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `agent_template_id` int NOT NULL,
  `current_level` int DEFAULT '1',
  `level_1_runs` int DEFAULT '0',
  `level_2_runs` int DEFAULT '0',
  `promoted_at` timestamp NULL DEFAULT NULL,
  `promoted_by` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## agent_instances

```sql
CREATE TABLE `agent_instances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `firmId` int DEFAULT NULL,
  `workflowType` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deploymentMode` enum('local','cloud','hybrid') COLLATE utf8mb4_unicode_ci DEFAULT 'local',
  `instanceStatus` enum('spawning','active','paused','terminated','error') COLLATE utf8mb4_unicode_ci DEFAULT 'spawning',
  `configJson` json DEFAULT NULL,
  `budgetLimitUsd` decimal(10,2) DEFAULT NULL,
  `runtimeLimitMinutes` int DEFAULT '60',
  `totalActions` int DEFAULT '0',
  `totalCostUsd` decimal(10,2) DEFAULT '0',
  `spawnedAt` bigint NOT NULL,
  `terminatedAt` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## agent_performance

```sql
CREATE TABLE `agent_performance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `agent_template_id` int NOT NULL,
  `runs` int DEFAULT '0',
  `successes` int DEFAULT '0',
  `avg_duration_ms` int DEFAULT NULL,
  `avg_cost_usd` float DEFAULT NULL,
  `avg_satisfaction_score` float DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## agent_templates

```sql
CREATE TABLE `agent_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `steps_json` json DEFAULT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `org_id` int DEFAULT NULL,
  `is_built_in` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ai_tool_calls

```sql
CREATE TABLE `ai_tool_calls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tool_id` int NOT NULL,
  `conversation_id` int DEFAULT NULL,
  `message_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `input_json` json DEFAULT NULL,
  `output_json` json DEFAULT NULL,
  `success` tinyint(1) NOT NULL DEFAULT '1',
  `latency_ms` int DEFAULT NULL,
  `user_modified_input` tinyint(1) NOT NULL DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_atc_tool` (`tool_id`),
  KEY `idx_atc_conversation` (`conversation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ai_tools

```sql
CREATE TABLE `ai_tools` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tool_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tool_type` enum('calculator','model','action','query','report') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_schema` json NOT NULL,
  `output_schema` json DEFAULT NULL,
  `trpc_procedure` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requires_auth` tinyint(1) NOT NULL DEFAULT '1',
  `requires_confirmation` tinyint(1) NOT NULL DEFAULT '0',
  `usage_count` int NOT NULL DEFAULT '0',
  `success_rate` float DEFAULT '1',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_at_type` (`tool_type`),
  KEY `idx_at_active` (`active`),
  UNIQUE KEY `tool_name` (`tool_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## analytical_models

```sql
CREATE TABLE `analytical_models` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('risk','suitability','compliance','engagement','financial','behavioral','market','operational') COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_schema` json DEFAULT NULL,
  `output_schema` json DEFAULT NULL,
  `dependencies` json DEFAULT NULL,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '1.0.0',
  `is_active` tinyint(1) DEFAULT '1',
  `execution_type` enum('llm','statistical','rule_based','hybrid') COLLATE utf8mb4_unicode_ci DEFAULT 'hybrid',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## annual_reviews

```sql
CREATE TABLE `annual_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `professional_id` int NOT NULL,
  `phase` enum('identify','prepare','schedule','conduct','document','followup') COLLATE utf8mb4_unicode_ci DEFAULT 'identify',
  `due_date` timestamp NULL DEFAULT NULL,
  `scheduled_date` timestamp NULL DEFAULT NULL,
  `completed_date` timestamp NULL DEFAULT NULL,
  `prep_report_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `agenda_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meeting_summary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_items_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `compliance_checklist` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','scheduled','in_progress','completed','overdue') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## audit_trail

```sql
CREATE TABLE `audit_trail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `conversationId` int DEFAULT NULL,
  `messageId` int DEFAULT NULL,
  `action` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complianceFlags` json DEFAULT NULL,
  `piiDetected` tinyint(1) DEFAULT '0',
  `disclaimerAppended` tinyint(1) DEFAULT '0',
  `reviewStatus` enum('auto_approved','pending_review','approved','rejected','modified') COLLATE utf8mb4_unicode_ci DEFAULT 'auto_approved',
  `reviewedBy` int DEFAULT NULL,
  `reviewNotes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=420001;
```

## auth_enrichment_log

```sql
CREATE TABLE `auth_enrichment_log` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `provider` enum('linkedin','google','email','apollo','pdl','manus') COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` enum('initial_signup','re_auth','token_refresh','manual_enrich','periodic_refresh') COLLATE utf8mb4_unicode_ci NOT NULL,
  `fields_captured` json NOT NULL,
  `fields_new` json NOT NULL,
  `fields_updated` json NOT NULL,
  `raw_response_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `suitability_dimensions_updated` json DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## auth_provider_tokens

```sql
CREATE TABLE `auth_provider_tokens` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `provider` enum('linkedin','google') COLLATE utf8mb4_unicode_ci NOT NULL,
  `access_token_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `refresh_token_encrypted` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `token_expires_at` timestamp NULL DEFAULT NULL,
  `scopes_granted` json NOT NULL,
  `last_profile_fetch_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_provider` (`user_id`,`provider`),
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## benchmark_aggregates

```sql
CREATE TABLE `benchmark_aggregates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dimension` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `age_bracket` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `income_bracket` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `percentile_25` float DEFAULT NULL,
  `percentile_50` float DEFAULT NULL,
  `percentile_75` float DEFAULT NULL,
  `sample_size` int DEFAULT '0',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## browser_sessions

```sql
CREATE TABLE `browser_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `agent_run_id` int DEFAULT NULL,
  `target_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('initializing','active','completed','failed','timeout') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'initializing',
  `actions_log` json DEFAULT NULL,
  `screenshots` json DEFAULT NULL,
  `domain` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `allowed` tinyint(1) NOT NULL DEFAULT '0',
  `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## bulk_import_batches

```sql
CREATE TABLE `bulk_import_batches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `batch_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `import_type` enum('csv_upload','api_bulk','multi_url_scrape','rss_feed','sitemap_crawl') COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_items` int DEFAULT '0',
  `processed_items` int DEFAULT '0',
  `success_items` int DEFAULT '0',
  `failed_items` int DEFAULT '0',
  `status` enum('pending','processing','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `input_data` json DEFAULT NULL,
  `results_json` json DEFAULT NULL,
  `triggered_by` int DEFAULT NULL,
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## business_exit_plans

```sql
CREATE TABLE `business_exit_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `business_name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `business_type` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annual_revenue` float DEFAULT NULL,
  `annual_profit` float DEFAULT NULL,
  `employee_count` int DEFAULT NULL,
  `owner_dependence_score` int DEFAULT NULL,
  `readiness_score` int DEFAULT NULL,
  `preferred_exit_path` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `analysis_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## calculator_scenarios

```sql
CREATE TABLE `calculator_scenarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `calculator_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `inputs_json` json DEFAULT NULL,
  `results_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## capability_modes

```sql
CREATE TABLE `capability_modes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `system_prompt_additions` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `required_knowledge_categories` json DEFAULT NULL,
  `available_tools` json DEFAULT NULL,
  `available_models` json DEFAULT NULL,
  `default_for_roles` json DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## carrier_connections

```sql
CREATE TABLE `carrier_connections` (
  `id` int NOT NULL AUTO_INCREMENT,
  `firmId` int NOT NULL,
  `carrierName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connectionType` enum('api','browser') COLLATE utf8mb4_unicode_ci DEFAULT 'browser',
  `apiEndpoint` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credentialsVaultRef` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supportedOperationsJson` json DEFAULT NULL,
  `stateAppointmentsJson` json DEFAULT NULL,
  `lastVerified` bigint DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## carrier_import_templates

```sql
CREATE TABLE `carrier_import_templates` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `carrier_slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `report_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `column_mappings` json NOT NULL,
  `parser_type` enum('csv','pdf_table','pdf_ocr','excel') COLLATE utf8mb4_unicode_ci NOT NULL,
  `sample_headers` json DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## carrier_submissions

```sql
CREATE TABLE `carrier_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `quote_id` int DEFAULT NULL,
  `carrier_id` int DEFAULT NULL,
  `submission_method` enum('api','pdf','manual') COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `status` enum('draft','submitted','accepted','rejected','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `response_received_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## client_associations

```sql
CREATE TABLE `client_associations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `professionalId` int NOT NULL,
  `status` enum('active','inactive') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `organizationId` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `unique_assoc` (`clientId`,`professionalId`),
  KEY `fk_client_assoc_org` (`organizationId`),
  CONSTRAINT `fk_client_assoc_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## client_segments

```sql
CREATE TABLE `client_segments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `professionalId` int NOT NULL,
  `valueScore` float DEFAULT '0',
  `growthScore` float DEFAULT '0',
  `engagementScore` float DEFAULT '0',
  `relationshipScore` float DEFAULT '0',
  `totalScore` float DEFAULT '0',
  `tier` enum('platinum','gold','silver','bronze') COLLATE utf8mb4_unicode_ci DEFAULT 'silver',
  `serviceModelJson` json DEFAULT NULL,
  `previousTier` enum('platinum','gold','silver','bronze') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lastClassified` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## coaching_messages

```sql
CREATE TABLE `coaching_messages` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `organization_id` int DEFAULT NULL,
  `message_type` enum('nudge','celebration','reminder','education','insight','alert') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` enum('critical','high','medium','low') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `trigger_event` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','delivered','read','acted','dismissed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `delivered_at` timestamp NULL DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## coi_contacts

```sql
CREATE TABLE `coi_contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professionalId` int NOT NULL,
  `firmId` int DEFAULT NULL,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `coiFirm` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `specialty` enum('cpa','attorney','insurance_agent','mortgage_broker','real_estate','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `contactJson` json DEFAULT NULL,
  `relationshipStrength` enum('strong','moderate','new') COLLATE utf8mb4_unicode_ci DEFAULT 'new',
  `referralsSent` int DEFAULT '0',
  `referralsReceived` int DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## coi_disclosures

```sql
CREATE TABLE `coi_disclosures` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `advisor_id` int DEFAULT NULL,
  `org_id` int DEFAULT NULL,
  `disclosure_type` enum('compensation','affiliation','ownership','referral','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `related_product_id` int DEFAULT NULL,
  `related_recommendation_id` int DEFAULT NULL,
  `severity` enum('low','medium','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `status` enum('pending','disclosed','acknowledged','resolved') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `disclosed_at` timestamp NULL DEFAULT NULL,
  `acknowledged_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## coi_verification_badges

```sql
CREATE TABLE `coi_verification_badges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `coi_contact_id` int DEFAULT NULL,
  `professional_id` int DEFAULT NULL,
  `badge_type` enum('license_active','cfp_certified','cpa_active','bar_good_standing','nmls_authorized','nipr_licensed','cbi_certified','no_disclosures','fiduciary','am_best_rated','peer_rated') COLLATE utf8mb4_unicode_ci NOT NULL,
  `badge_label` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `badge_data` json DEFAULT NULL,
  `confidence_score` decimal(3,2) DEFAULT NULL,
  `source_verification_id` int DEFAULT NULL,
  `granted_at` bigint NOT NULL,
  `expires_at` bigint DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_coi_badges` (`coi_contact_id`),
  KEY `idx_prof_badges` (`professional_id`),
  KEY `idx_badge_type` (`badge_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## comms_log

```sql
CREATE TABLE `comms_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `client_id` int DEFAULT NULL,
  `template_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` enum('email','sms','letter','portal_message') COLLATE utf8mb4_unicode_ci DEFAULT 'email',
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('draft','sent','scheduled','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `compliance_flags` json DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## compliance_audit

```sql
CREATE TABLE `compliance_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `messageId` int NOT NULL,
  `userId` int NOT NULL,
  `conversationId` int DEFAULT NULL,
  `classification` enum('general_education','product_discussion','personalized_recommendation','investment_advice') COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidenceScore` float NOT NULL,
  `flagsJson` json DEFAULT NULL,
  `reasoningChainJson` json DEFAULT NULL,
  `modificationsJson` json DEFAULT NULL,
  `reviewTier` enum('auto_approved','auto_modified','human_review','blocked') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewerId` int DEFAULT NULL,
  `modelVersion` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `promptHash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deliveryStatus` enum('delivered','held','blocked','modified') COLLATE utf8mb4_unicode_ci DEFAULT 'delivered',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=330001;
```

## compliance_flags

```sql
CREATE TABLE `compliance_flags` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reviewId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ruleCode` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ruleName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'warning',
  `fixApplied` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## compliance_predictions

```sql
CREATE TABLE `compliance_predictions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `agent_action_id` int DEFAULT NULL,
  `predicted_risk_score` int DEFAULT NULL,
  `risk_factors` json DEFAULT NULL,
  `prediction_model_version` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requires_approval` tinyint(1) DEFAULT '0',
  `approved` tinyint(1) DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## compliance_prescreening

```sql
CREATE TABLE `compliance_prescreening` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `check_type` enum('unsuitable_recommendation','promissory_language','unauthorized_practice','concentration_risk','missing_disclosure') COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'low',
  `details` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_taken` enum('passed','warning_injected','held_for_review') COLLATE utf8mb4_unicode_ci DEFAULT 'passed',
  `reviewed_by` int DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## compliance_reviews

```sql
CREATE TABLE `compliance_reviews` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `review_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'content_review',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `content_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_content` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `flagged_issues` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `applied_fixes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'low',
  `reviewer_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_compliance_reviews_user` (`user_id`),
  KEY `idx_compliance_reviews_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## compliance_weekly_briefs

```sql
CREATE TABLE `compliance_weekly_briefs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `week_start` date NOT NULL,
  `brief_json` json DEFAULT NULL,
  `distributed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## consent_tracking

```sql
CREATE TABLE `consent_tracking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `consent_type` enum('ai_chat','voice','doc_upload','data_sharing','marketing','analytics','third_party') COLLATE utf8mb4_unicode_ci NOT NULL,
  `granted` tinyint(1) NOT NULL DEFAULT '0',
  `granted_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## constitutional_violations

```sql
CREATE TABLE `constitutional_violations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `message_id` int DEFAULT NULL,
  `principle_number` int NOT NULL,
  `principle_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `violation_description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` enum('low','medium','high') COLLATE utf8mb4_unicode_ci DEFAULT 'low',
  `original_response_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `corrected_response_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## consultation_bookings

```sql
CREATE TABLE `consultation_bookings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `professional_id` int NOT NULL,
  `scheduled_at` timestamp NOT NULL,
  `duration_minutes` int DEFAULT '30',
  `pre_brief_id` int DEFAULT NULL,
  `status` enum('scheduled','confirmed','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `daily_room_url` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## context_assembly_log

```sql
CREATE TABLE `context_assembly_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `message_id` int DEFAULT NULL,
  `layer` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `items_considered` int DEFAULT '0',
  `items_included` int DEFAULT '0',
  `items_pruned` int DEFAULT '0',
  `token_budget` int DEFAULT NULL,
  `tokens_used` int DEFAULT NULL,
  `complexity_level` enum('simple','moderate','complex') COLLATE utf8mb4_unicode_ci DEFAULT 'moderate',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## conversation_compliance_scores

```sql
CREATE TABLE `conversation_compliance_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `score` int DEFAULT '100',
  `checks_run` int DEFAULT '0',
  `checks_passed` int DEFAULT '0',
  `flagged_for_review` tinyint(1) DEFAULT '0',
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## conversation_folders

```sql
CREATE TABLE `conversation_folders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT '#6366f1',
  `sortOrder` int NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## conversation_topics

```sql
CREATE TABLE `conversation_topics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `message_id` int DEFAULT NULL,
  `topic` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_topic` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disclaimer_injected` tinyint(1) DEFAULT '0',
  `detected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## conversations

```sql
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'New Conversation',
  `mode` enum('client','coach','manager') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'client',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `organizationId` int DEFAULT NULL,
  `pinned` tinyint(1) NOT NULL DEFAULT '0',
  `folderId` int DEFAULT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_conversations_org` (`organizationId`),
  CONSTRAINT `fk_conversations_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=690001;
```

## credit_profiles

```sql
CREATE TABLE `credit_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `pull_date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `credit_score` int DEFAULT NULL,
  `score_model` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `utilization_percent` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_debt` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `open_accounts` int DEFAULT NULL,
  `derogatory_marks` int DEFAULT NULL,
  `hard_inquiries` int DEFAULT NULL,
  `oldest_account_years` int DEFAULT NULL,
  `consent_id` int DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## crm_sync_log

```sql
CREATE TABLE `crm_sync_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `direction` enum('push','pull') COLLATE utf8mb4_unicode_ci NOT NULL,
  `crm_provider` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `records_synced` int DEFAULT '0',
  `sync_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('started','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'started',
  `error_details` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## data_freshness_registry

```sql
CREATE TABLE `data_freshness_registry` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data_category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_refreshed_at` timestamp NULL DEFAULT NULL,
  `next_refresh_at` timestamp NULL DEFAULT NULL,
  `refresh_interval_hours` int DEFAULT '24',
  `record_count` int DEFAULT '0',
  `status` enum('fresh','stale','refreshing','error','paused') COLLATE utf8mb4_unicode_ci DEFAULT 'fresh',
  `consecutive_failures` int DEFAULT '0',
  `max_consecutive_failures` int DEFAULT '3',
  `last_error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auto_paused` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## data_quality_scores

```sql
CREATE TABLE `data_quality_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_source_id` int NOT NULL,
  `ingestion_job_id` int DEFAULT NULL,
  `completeness` decimal(5,2) DEFAULT '0.00',
  `accuracy` decimal(5,2) DEFAULT '0.00',
  `freshness` decimal(5,2) DEFAULT '0.00',
  `consistency` decimal(5,2) DEFAULT '0.00',
  `overall_score` decimal(5,2) DEFAULT '0.00',
  `issues_found` json DEFAULT NULL,
  `recommendations` json DEFAULT NULL,
  `scored_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## data_sources

```sql
CREATE TABLE `data_sources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `firmId` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sourceType` enum('document_upload','web_scrape','api_feed','market_data','regulatory','product_catalog','news_feed','competitor','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `authType` enum('none','api_key','oauth','basic','bearer') COLLATE utf8mb4_unicode_ci DEFAULT 'none',
  `credentialsVaultRef` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduleCron` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` int DEFAULT '5',
  `lastRunAt` bigint DEFAULT NULL,
  `lastSuccessAt` bigint DEFAULT NULL,
  `totalRecordsIngested` int DEFAULT '0',
  `configJson` json DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## data_value_scores

```sql
CREATE TABLE `data_value_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_score` decimal(8,2) DEFAULT '0.00',
  `last_scored_at` timestamp NULL DEFAULT NULL,
  `refresh_priority` enum('critical','high','normal','low','dormant') COLLATE utf8mb4_unicode_ci DEFAULT 'normal',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## delegations

```sql
CREATE TABLE `delegations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `delegator_id` int NOT NULL,
  `delegate_id` int NOT NULL,
  `scope` json DEFAULT NULL,
  `granted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## deployment_checks

```sql
CREATE TABLE `deployment_checks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `check_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `passed` tinyint(1) DEFAULT '0',
  `details` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duration_ms` int DEFAULT NULL,
  `run_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## deployment_history

```sql
CREATE TABLE `deployment_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `version` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tests_passed` int DEFAULT NULL,
  `tests_total` int DEFAULT NULL,
  `bundle_size_kb` int DEFAULT NULL,
  `rollout_percentage` int DEFAULT '5',
  `status` enum('deploying','canary','rolling_out','complete','rolled_back') COLLATE utf8mb4_unicode_ci DEFAULT 'deploying',
  `error_rate` float DEFAULT NULL,
  `previous_version` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deployed_by` int DEFAULT NULL,
  `deployed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## digital_asset_inventory

```sql
CREATE TABLE `digital_asset_inventory` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `assetType` enum('crypto_wallet','exchange_account','brokerage','bank','social_media','email','cloud_storage','loyalty_program','domain','digital_content','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `approximateValue` float DEFAULT NULL,
  `accessMethod` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hasAccessPlan` tinyint(1) DEFAULT '0',
  `legacyContactSet` tinyint(1) DEFAULT '0',
  `lastVerified` timestamp NULL DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## disclaimer_audit

```sql
CREATE TABLE `disclaimer_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `disclaimer_id` int NOT NULL,
  `disclaimer_version` int DEFAULT '1',
  `shown_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## disclaimer_interactions

```sql
CREATE TABLE `disclaimer_interactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `disclaimer_id` int NOT NULL,
  `user_id` int NOT NULL,
  `action` enum('shown','scrolled','clicked','acknowledged') COLLATE utf8mb4_unicode_ci DEFAULT 'shown',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## disclaimer_translations

```sql
CREATE TABLE `disclaimer_translations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `disclaimer_id` int NOT NULL,
  `language` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `translated_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `verified_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## disclaimer_versions

```sql
CREATE TABLE `disclaimer_versions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `topic` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `disclaimer_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int DEFAULT '1',
  `effective_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `superseded_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## document_annotations

```sql
CREATE TABLE `document_annotations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `documentId` int NOT NULL,
  `userId` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `highlightText` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `highlightStart` int DEFAULT NULL,
  `highlightEnd` int DEFAULT NULL,
  `annotationType` enum('comment','highlight','question','action_item','ai_insight') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'comment',
  `parentId` int DEFAULT NULL,
  `resolved` tinyint NOT NULL DEFAULT '0',
  `resolvedBy` int DEFAULT NULL,
  `resolvedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_annotations_doc` (`documentId`),
  KEY `idx_annotations_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## document_chunks

```sql
CREATE TABLE `document_chunks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `documentId` int NOT NULL,
  `userId` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `chunkIndex` int NOT NULL,
  `category` enum('personal_docs','financial_products','regulations') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'personal_docs',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## document_extractions

```sql
CREATE TABLE `document_extractions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int DEFAULT NULL,
  `documentId` int DEFAULT NULL,
  `ingestionJobId` int DEFAULT NULL,
  `extractionType` enum('financial_statement','tax_return','insurance_policy','investment_statement','bank_statement','pay_stub','estate_document','medical_record','custom') COLLATE utf8mb4_unicode_ci NOT NULL,
  `extractedData` json NOT NULL,
  `extractedEntities` json DEFAULT NULL,
  `extractedAmounts` json DEFAULT NULL,
  `extractionConfidence` decimal(3,2) DEFAULT '0.80',
  `pageCount` int DEFAULT NULL,
  `processingTimeMs` int DEFAULT NULL,
  `llmModelUsed` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## document_tag_map

```sql
CREATE TABLE `document_tag_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `documentId` int NOT NULL,
  `tagId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_doc_tag_map_doc` (`documentId`),
  KEY `idx_doc_tag_map_tag` (`tagId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## document_tags

```sql
CREATE TABLE `document_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT '#6366f1',
  `isAiGenerated` tinyint(1) DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_doc_tags_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## document_templates

```sql
CREATE TABLE `document_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('compliance','client_report','proposal','agreement','disclosure','meeting_notes','review','planning','custom') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'custom',
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `variables` json DEFAULT NULL,
  `output_format` enum('pdf','docx','html') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pdf',
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `version` int NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## document_versions

```sql
CREATE TABLE `document_versions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `documentId` int NOT NULL,
  `userId` int NOT NULL,
  `versionNumber` int NOT NULL,
  `filename` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileUrl` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileKey` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `mimeType` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extractedText` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chunkCount` int DEFAULT '0',
  `sizeBytes` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_docver_docid` (`documentId`),
  KEY `idx_docver_userid` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## documents

```sql
CREATE TABLE `documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `filename` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileUrl` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `fileKey` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `mimeType` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('personal_docs','financial_products','regulations','training_materials','artifacts','skills') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'personal_docs',
  `visibility` enum('private','professional','management','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'professional',
  `extractedText` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chunkCount` int DEFAULT '0',
  `status` enum('uploading','processing','ready','error') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'uploading',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `organizationId` int DEFAULT NULL,
  `sortOrder` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_documents_org` (`organizationId`),
  CONSTRAINT `fk_documents_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=60001;
```

## economic_history

```sql
CREATE TABLE `economic_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metric_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## education_modules

```sql
CREATE TABLE `education_modules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('budgeting','investing','insurance','tax','estate','retirement','debt','credit','real_estate','general') COLLATE utf8mb4_unicode_ci NOT NULL,
  `difficulty` enum('beginner','intermediate','advanced') COLLATE utf8mb4_unicode_ci DEFAULT 'beginner',
  `estimatedMinutes` int DEFAULT '5',
  `content` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## education_progress

```sql
CREATE TABLE `education_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `moduleId` int NOT NULL,
  `assignedBy` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'system',
  `startedAt` timestamp NULL DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `score` float DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## education_triggers

```sql
CREATE TABLE `education_triggers` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trigger_condition` json NOT NULL,
  `education_module_id` int DEFAULT NULL,
  `target_audience` enum('all','new_users','professionals','managers','admins') COLLATE utf8mb4_unicode_ci DEFAULT 'all',
  `title` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_method` enum('in_app','chat_injection','notification','email') COLLATE utf8mb4_unicode_ci DEFAULT 'in_app',
  `priority` int DEFAULT '50',
  `is_active` tinyint(1) DEFAULT '1',
  `times_triggered` int DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## email_campaigns

```sql
CREATE TABLE `email_campaigns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body_html` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `body_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('draft','scheduled','sending','sent','paused','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `recipient_filter` json DEFAULT NULL,
  `total_recipients` int DEFAULT '0',
  `sent_count` int DEFAULT '0',
  `open_count` int DEFAULT '0',
  `click_count` int DEFAULT '0',
  `bounce_count` int DEFAULT '0',
  `scheduled_at` bigint DEFAULT NULL,
  `sent_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## email_sends

```sql
CREATE TABLE `email_sends` (
  `id` int NOT NULL AUTO_INCREMENT,
  `campaign_id` int NOT NULL,
  `recipient_email` varchar(320) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recipient_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','sent','delivered','opened','clicked','bounced','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `sent_at` bigint DEFAULT NULL,
  `opened_at` bigint DEFAULT NULL,
  `clicked_at` bigint DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## encrypted_fields_registry

```sql
CREATE TABLE `encrypted_fields_registry` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `column_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `encryption_method` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'AES-256-GCM',
  `key_alias` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## encryption_keys

```sql
CREATE TABLE `encryption_keys` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key_alias` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','rotating','retired') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `rotated_at` timestamp NULL DEFAULT NULL,
  `retired_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## engagement_scores

```sql
CREATE TABLE `engagement_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `client_id` int DEFAULT NULL,
  `organization_id` int DEFAULT NULL,
  `login_frequency` decimal(5,2) DEFAULT '0',
  `meeting_cadence` decimal(5,2) DEFAULT '0',
  `response_time_avg` decimal(10,2) DEFAULT '0',
  `portal_activity` decimal(5,2) DEFAULT '0',
  `overall_score` decimal(5,2) DEFAULT '0',
  `risk_level` enum('healthy','at_risk','critical') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'healthy',
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_engagement_user` (`user_id`),
  KEY `idx_engagement_risk` (`risk_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## enrichment_cache

```sql
CREATE TABLE `enrichment_cache` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lookup_key` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `lookup_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_json` json NOT NULL,
  `quality_score` decimal(3,2) DEFAULT NULL,
  `fetched_at` timestamp NOT NULL,
  `expires_at` timestamp NOT NULL,
  `hit_count` int DEFAULT '1',
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  UNIQUE KEY `uq_cache_lookup` (`provider_slug`,`lookup_key`,`lookup_type`),
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## enrichment_cohorts

```sql
CREATE TABLE `enrichment_cohorts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `datasetId` int NOT NULL,
  `matchCriteria` json NOT NULL,
  `enrichmentFields` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## enrichment_datasets

```sql
CREATE TABLE `enrichment_datasets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `applicableDomains` json DEFAULT NULL,
  `dataType` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `matchDimensions` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## enrichment_matches

```sql
CREATE TABLE `enrichment_matches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `datasetId` int NOT NULL,
  `cohortId` int NOT NULL,
  `matchFields` json DEFAULT NULL,
  `confidenceScore` float DEFAULT '0',
  `applicableDomains` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## entity_resolution_rules

```sql
CREATE TABLE `entity_resolution_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pattern` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `canonical_entity_id` int NOT NULL,
  `confidence` float DEFAULT '0.9',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## equity_grants

```sql
CREATE TABLE `equity_grants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `grantType` enum('iso','nso','rsu','espp') COLLATE utf8mb4_unicode_ci NOT NULL,
  `company` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grantDate` timestamp NULL DEFAULT NULL,
  `vestingSchedule` json DEFAULT NULL,
  `exercisePrice` float DEFAULT NULL,
  `currentFMV` float DEFAULT NULL,
  `sharesGranted` int DEFAULT NULL,
  `sharesVested` int DEFAULT '0',
  `sharesExercised` int DEFAULT '0',
  `expirationDate` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## esignature_tracking

```sql
CREATE TABLE `esignature_tracking` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professional_id` int NOT NULL,
  `client_user_id` int DEFAULT NULL,
  `envelope_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'created',
  `sent_at` bigint DEFAULT NULL,
  `signed_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `related_product_id` int DEFAULT NULL,
  `related_quote_id` int DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_professional` (`professional_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## estate_documents

```sql
CREATE TABLE `estate_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `documentType` enum('trust','will','poa_financial','poa_healthcare','directive','beneficiary_audit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `draftVersion` int DEFAULT '1',
  `draftContentUrl` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `draftContentHash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complexityLevel` enum('simple','standard','complex') COLLATE utf8mb4_unicode_ci DEFAULT 'standard',
  `reviewPath` enum('self_help','attorney_review') COLLATE utf8mb4_unicode_ci DEFAULT 'attorney_review',
  `attorneyId` int DEFAULT NULL,
  `attorneyStatus` enum('pending','reviewing','approved','revision_requested') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `stateJurisdiction` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `executedDate` bigint DEFAULT NULL,
  `archiveRef` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## export_jobs

```sql
CREATE TABLE `export_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `org_id` int DEFAULT NULL,
  `format` enum('csv','excel','pdf','docx','json') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'csv',
  `entity_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filters` json DEFAULT NULL,
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `file_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `file_key` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `row_count` int DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## extraction_plan_jobs

```sql
CREATE TABLE `extraction_plan_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `job_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduled_day` int DEFAULT NULL,
  `requests_allocated` int DEFAULT NULL,
  `records_target` int DEFAULT NULL,
  `records_completed` int DEFAULT '0',
  `status` enum('pending','running','completed','failed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_log` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## extraction_plans

```sql
CREATE TABLE `extraction_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_type` enum('initial_seed','scheduled_refresh','on_demand','ai_suggested') COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_records` int DEFAULT '0',
  `estimated_duration_hours` decimal(8,2) DEFAULT NULL,
  `plan_json` json DEFAULT NULL,
  `optimization_notes` json DEFAULT NULL,
  `status` enum('draft','approved','running','completed','paused','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `approved_by` int DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `records_completed` int DEFAULT '0',
  `records_failed` int DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## fairness_test_prompts

```sql
CREATE TABLE `fairness_test_prompts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `demographic` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `prompt_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expected_behavior` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## fairness_test_results

```sql
CREATE TABLE `fairness_test_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `run_id` int NOT NULL,
  `prompt_id` int NOT NULL,
  `response` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tone_score` float DEFAULT NULL,
  `quality_score` float DEFAULT NULL,
  `bias_indicators` json DEFAULT NULL,
  `disclaimer_present` tinyint(1) DEFAULT '0',
  `response_time_ms` int DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## fairness_test_runs

```sql
CREATE TABLE `fairness_test_runs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `run_by` int NOT NULL,
  `status` enum('pending','running','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `total_prompts` int DEFAULT '0',
  `completed_prompts` int DEFAULT '0',
  `overall_score` float DEFAULT NULL,
  `bias_detected` tinyint(1) DEFAULT '0',
  `summary` json DEFAULT NULL,
  `findings` json DEFAULT NULL,
  `recommendations` json DEFAULT NULL,
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## feature_flags

```sql
CREATE TABLE `feature_flags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `flagKey` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `scope` enum('platform','organization') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'platform',
  `organizationId` int DEFAULT NULL,
  `updatedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `flagKey` (`flagKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## feedback

```sql
CREATE TABLE `feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `messageId` int NOT NULL,
  `conversationId` int NOT NULL,
  `rating` enum('up','down') COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## field_sharing_controls

```sql
CREATE TABLE `field_sharing_controls` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `field_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `share_with_role` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `granted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## file_chunks

```sql
CREATE TABLE `file_chunks` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chunk_index` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type` enum('text','table','image_description','header','metadata') COLLATE utf8mb4_unicode_ci DEFAULT 'text',
  `token_count` int DEFAULT NULL,
  `embedding` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## file_derived_enrichments

```sql
CREATE TABLE `file_derived_enrichments` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `enrichment_type` enum('suitability_signal','risk_indicator','product_match','compliance_flag','financial_metric','life_event') COLLATE utf8mb4_unicode_ci NOT NULL,
  `dimension_key` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extracted_value` json DEFAULT NULL,
  `confidence` float DEFAULT NULL,
  `applied_to_profile` tinyint(1) DEFAULT '0',
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## file_uploads

```sql
CREATE TABLE `file_uploads` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `organization_id` int DEFAULT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filename` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `size_bytes` bigint DEFAULT NULL,
  `storage_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_key` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stage` enum('uploaded','validated','parsed','enriched','indexed','complete','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'uploaded',
  `stage_error` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('personal_docs','financial_products','regulations','training','artifacts','skills','carrier_report','client_data','compliance') COLLATE utf8mb4_unicode_ci DEFAULT 'personal_docs',
  `visibility` enum('private','professional','management','admin') COLLATE utf8mb4_unicode_ci DEFAULT 'private',
  `metadata` json DEFAULT NULL,
  `parsed_content` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## gate_reviews

```sql
CREATE TABLE `gate_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actionId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actionType` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `complianceTier` int NOT NULL DEFAULT '1',
  `classificationRationale` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewerId` int DEFAULT NULL,
  `reviewerLicenseNumber` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewerLicenseState` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewerLicenseExpiry` bigint DEFAULT NULL,
  `decision` enum('pending','approved','modified','rejected','escalated') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `modificationDetails` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complianceNotes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `decisionTimestamp` bigint DEFAULT NULL,
  `archiveRef` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `workflowType` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clientId` int DEFAULT NULL,
  `professionalId` int DEFAULT NULL,
  `firmId` int DEFAULT NULL,
  `slaDeadline` bigint DEFAULT NULL,
  `escalatedTo` int DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## generated_documents

```sql
CREATE TABLE `generated_documents` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `organization_id` int DEFAULT NULL,
  `template_slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `format` enum('pdf','docx','xlsx','csv','json','html') COLLATE utf8mb4_unicode_ci NOT NULL,
  `storage_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `storage_key` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `input_data` json DEFAULT NULL,
  `status` enum('generating','complete','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'generating',
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## health_scores

```sql
CREATE TABLE `health_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `total_score` int NOT NULL DEFAULT '0',
  `spend_score` int NOT NULL DEFAULT '0',
  `save_score` int NOT NULL DEFAULT '0',
  `borrow_score` int NOT NULL DEFAULT '0',
  `plan_score` int NOT NULL DEFAULT '0',
  `status` enum('healthy','coping','vulnerable') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'coping',
  `insights_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recommendations_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## improvement_actions

```sql
CREATE TABLE `improvement_actions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `audit_id` int NOT NULL,
  `layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system_infrastructure',
  `action_type` enum('auto_implement','recommend','escalate','monitor') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `implementation_plan` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `config_changes` json DEFAULT NULL,
  `before_state` json DEFAULT NULL,
  `after_state` json DEFAULT NULL,
  `status` enum('proposed','approved','implementing','implemented','rejected','failed','rolled_back') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'proposed',
  `priority` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `estimated_impact` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actual_impact` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` bigint DEFAULT NULL,
  `rejected_by` int DEFAULT NULL,
  `rejected_at` bigint DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `implemented_at` bigint DEFAULT NULL,
  `implemented_by` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rolled_back_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## improvement_feedback

```sql
CREATE TABLE `improvement_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `action_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` int NOT NULL,
  `helpful` tinyint(1) DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## industry_benchmarks

```sql
CREATE TABLE `industry_benchmarks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `benchmark_category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `benchmark_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `benchmark_value` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `benchmark_unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reporting_period` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ingested_records

```sql
CREATE TABLE `ingested_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dataSourceId` int NOT NULL,
  `ingestionJobId` int DEFAULT NULL,
  `recordType` enum('customer_profile','organization','product','market_price','regulatory_update','news_article','competitor_intel','document_extract','entity','metric') COLLATE utf8mb4_unicode_ci NOT NULL,
  `entityId` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contentSummary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `structuredData` json DEFAULT NULL,
  `rawDataUrl` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confidenceScore` decimal(3,2) DEFAULT '0.80',
  `freshnessAt` bigint DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `verifiedBy` int DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ingestion_insights

```sql
CREATE TABLE `ingestion_insights` (
  `id` int NOT NULL AUTO_INCREMENT,
  `insight_type` enum('trend','anomaly','opportunity','risk','recommendation','competitive_intel','market_shift','regulatory_change') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `data_source_ids` json DEFAULT NULL,
  `related_entity_ids` json DEFAULT NULL,
  `actionable` tinyint(1) DEFAULT '1',
  `acknowledged` tinyint(1) DEFAULT '0',
  `acknowledged_by` int DEFAULT NULL,
  `expires_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ingestion_jobs

```sql
CREATE TABLE `ingestion_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dataSourceId` int NOT NULL,
  `triggeredBy` int DEFAULT NULL,
  `status` enum('queued','running','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'queued',
  `progressPct` int DEFAULT '0',
  `recordsProcessed` int DEFAULT '0',
  `recordsCreated` int DEFAULT '0',
  `recordsUpdated` int DEFAULT '0',
  `recordsSkipped` int DEFAULT '0',
  `recordsErrored` int DEFAULT '0',
  `errorLog` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `startedAt` bigint DEFAULT NULL,
  `completedAt` bigint DEFAULT NULL,
  `durationMs` int DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## insight_actions

```sql
CREATE TABLE `insight_actions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `insight_id` int NOT NULL,
  `action_type` enum('task_created','notification_sent','alert_escalated','review_scheduled','auto_dismissed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_payload` json DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `status` enum('pending','in_progress','completed','dismissed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `due_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## insurance_applications

```sql
CREATE TABLE `insurance_applications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `professionalId` int DEFAULT NULL,
  `carrierName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `applicationDataJson` json DEFAULT NULL,
  `preliminaryUwAssessment` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `compliancePreflightJson` json DEFAULT NULL,
  `gateStatus` enum('draft','pending_review','approved','submitted','issued','declined','counter_offer') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `gateReviewId` int DEFAULT NULL,
  `reviewerId` int DEFAULT NULL,
  `reviewerLicense` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewedAt` bigint DEFAULT NULL,
  `submittedAt` bigint DEFAULT NULL,
  `carrierStatus` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `carrierRefNumber` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pendingRequirementsJson` json DEFAULT NULL,
  `policyNumber` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `issuedAt` bigint DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## insurance_carriers

```sql
CREATE TABLE `insurance_carriers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `carrier_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `carrier_name_aliases` json DEFAULT NULL,
  `am_best_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `am_best_fsr` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `am_best_fsr_numeric` int DEFAULT NULL,
  `am_best_outlook` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sp_rating` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moodys_rating` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fitch_rating` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `naic_id` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `domicile_state` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `year_founded` int DEFAULT NULL,
  `total_assets_billions` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `statutory_surplus_billions` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complaint_ratio` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `product_lines` json DEFAULT NULL,
  `rating_last_updated` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_fsr` (`am_best_fsr_numeric`),
  KEY `idx_name` (`carrier_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## insurance_products

```sql
CREATE TABLE `insurance_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `carrier_id` int NOT NULL,
  `product_name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_category` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `features` json DEFAULT NULL,
  `min_face_amount` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `max_face_amount` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `min_issue_age` int DEFAULT NULL,
  `max_issue_age` int DEFAULT NULL,
  `underwriting_types` json DEFAULT NULL,
  `riders_available` json DEFAULT NULL,
  `state_availability` json DEFAULT NULL,
  `compulife_product_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `last_rate_update` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_carrier` (`carrier_id`),
  KEY `idx_type` (`product_type`),
  KEY `idx_category` (`product_category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## insurance_quotes

```sql
CREATE TABLE `insurance_quotes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `professionalId` int DEFAULT NULL,
  `quoteRunId` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `carrierName` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productType` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `productName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `premiumMonthly` decimal(12,2) DEFAULT NULL,
  `premiumAnnual` decimal(12,2) DEFAULT NULL,
  `deathBenefit` decimal(15,2) DEFAULT NULL,
  `cashValueYr10` decimal(15,2) DEFAULT NULL,
  `cashValueYr20` decimal(15,2) DEFAULT NULL,
  `ridersJson` json DEFAULT NULL,
  `uwClassEstimated` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amBestRating` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quoteDate` bigint NOT NULL,
  `source` enum('api','browser','manual') COLLATE utf8mb4_unicode_ci DEFAULT 'manual',
  `status` enum('illustrative','reviewed','selected','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'illustrative',
  `comparisonNotes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_analysis_log

```sql
CREATE TABLE `integration_analysis_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `robots_txt` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rate_headers_found` json DEFAULT NULL,
  `source_classification` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_recommendation` json DEFAULT NULL,
  `admin_adjusted` tinyint(1) DEFAULT '0',
  `admin_final_config` json DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## integration_connections

```sql
CREATE TABLE `integration_connections` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ownership_tier` enum('platform','organization','professional','client') COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organization_id` int DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `status` enum('connected','disconnected','error','pending','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `credentials_encrypted` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `config_json` json DEFAULT NULL,
  `last_sync_at` timestamp NULL DEFAULT NULL,
  `last_sync_status` enum('success','partial','failed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_sync_error` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `records_synced` int DEFAULT '0',
  `usage_this_period` int DEFAULT '0',
  `usage_period_start` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_provider_owner` (`provider_id`,`ownership_tier`,`owner_id`),
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_field_mappings

```sql
CREATE TABLE `integration_field_mappings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_field` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `internal_table` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `internal_field` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transform` enum('direct','lowercase','uppercase','date_parse','phone_e164','currency_cents','boolean_parse','custom') COLLATE utf8mb4_unicode_ci DEFAULT 'direct',
  `custom_transform` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_health_checks

```sql
CREATE TABLE `integration_health_checks` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `check_type` enum('connectivity','auth','data_freshness','rate_limit','schema_drift') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('healthy','degraded','unhealthy','unknown') COLLATE utf8mb4_unicode_ci NOT NULL,
  `latency_ms` int DEFAULT NULL,
  `response_code` int DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `checked_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_health_summary

```sql
CREATE TABLE `integration_health_summary` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `overall_status` enum('healthy','degraded','unhealthy','unknown') COLLATE utf8mb4_unicode_ci DEFAULT 'unknown',
  `uptime_percent` decimal(5,2) DEFAULT '0',
  `avg_latency_ms` int DEFAULT NULL,
  `checks_total` int DEFAULT '0',
  `checks_healthy` int DEFAULT '0',
  `checks_failed` int DEFAULT '0',
  `last_healthy_at` timestamp NULL DEFAULT NULL,
  `last_unhealthy_at` timestamp NULL DEFAULT NULL,
  `consecutive_failures` int DEFAULT '0',
  `data_freshness_minutes` int DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_improvement_log

```sql
CREATE TABLE `integration_improvement_log` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `provider_id` varchar(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_type` enum('auto_reconnect','key_rotation_reminder','rate_limit_backoff','schema_migration','data_quality_alert','performance_optimization','degradation_detected','recovery_confirmed','user_notification','ai_context_updated','feature_suggestion') COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` enum('info','warning','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'info',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `suggested_action` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_taken` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_generated` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_providers

```sql
CREATE TABLE `integration_providers` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('crm','messaging','carrier','investments','insurance','demographics','economic','enrichment','regulatory','property','middleware') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ownership_tier` enum('platform','organization','professional','client') COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth_method` enum('oauth2','api_key','bearer_token','hmac_webhook','manual_upload','none') COLLATE utf8mb4_unicode_ci NOT NULL,
  `base_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `docs_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signup_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `free_tier_description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `free_tier_limit` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_sync_config

```sql
CREATE TABLE `integration_sync_config` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sync_type` enum('full','incremental','webhook') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'incremental',
  `schedule` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_sync_at` timestamp NULL DEFAULT NULL,
  `next_sync_at` timestamp NULL DEFAULT NULL,
  `retry_count` int DEFAULT '0',
  `max_retries` int DEFAULT '3',
  `backoff_minutes` int DEFAULT '5',
  `field_mapping_overrides` json DEFAULT NULL,
  `filter_criteria` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_sync_logs

```sql
CREATE TABLE `integration_sync_logs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sync_type` enum('full','incremental','webhook','manual_upload','on_demand') COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` enum('inbound','outbound','bidirectional') COLLATE utf8mb4_unicode_ci NOT NULL,
  `started_at` timestamp NOT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `status` enum('running','success','partial','failed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL,
  `records_created` int DEFAULT '0',
  `records_updated` int DEFAULT '0',
  `records_failed` int DEFAULT '0',
  `error_details` json DEFAULT NULL,
  `triggered_by` enum('schedule','webhook','manual','system') COLLATE utf8mb4_unicode_ci NOT NULL,
  `triggered_by_user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## integration_webhook_events

```sql
CREATE TABLE `integration_webhook_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload_json` json NOT NULL,
  `signature_valid` tinyint(1) NOT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `processing_status` enum('pending','processed','failed','skipped') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `processing_error` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## iul_crediting_history

```sql
CREATE TABLE `iul_crediting_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `effective_date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `index_strategy` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cap_rate` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `participation_rate` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `floor_rate` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `spread` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `multiplier_bonus` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_product_date` (`product_id`,`effective_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## kb_access_transitions

```sql
CREATE TABLE `kb_access_transitions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `from_grantee_id` int NOT NULL,
  `to_grantee_id` int NOT NULL,
  `topic` enum('insurance','investments','tax','estate','retirement','debt','budgeting','real_estate','business','education','health_finance','general','all') COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_access_level` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `new_access_level` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` enum('client_switched','professional_left','org_change','manual','expired') COLLATE utf8mb4_unicode_ci NOT NULL,
  `transitioned_at` bigint NOT NULL,
  `transitioned_by` int NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## kb_sharing_defaults

```sql
CREATE TABLE `kb_sharing_defaults` (
  `id` int NOT NULL AUTO_INCREMENT,
  `relationship_type` enum('financial_advisor','insurance_agent','tax_professional','estate_attorney','accountant','mortgage_broker','real_estate_agent','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `topic` enum('insurance','investments','tax','estate','retirement','debt','budgeting','real_estate','business','education','health_finance','general','all') COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_access_level` enum('none','summary','read','contribute','full') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'read',
  `rationale` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## kb_sharing_permissions

```sql
CREATE TABLE `kb_sharing_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `owner_id` int NOT NULL,
  `grantee_id` int NOT NULL,
  `grantee_type` enum('professional','manager','organization','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `topic` enum('insurance','investments','tax','estate','retirement','debt','budgeting','real_estate','business','education','health_finance','general','all') COLLATE utf8mb4_unicode_ci NOT NULL,
  `access_level` enum('none','summary','read','contribute','full') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'read',
  `source` enum('default','user_set','professional_request','admin_override') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `granted_at` bigint NOT NULL,
  `revoked_at` bigint DEFAULT NULL,
  `expires_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## kg_edges

```sql
CREATE TABLE `kg_edges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `sourceNodeId` int NOT NULL,
  `targetNodeId` int NOT NULL,
  `edgeType` enum('owns','benefits_from','funds','pays','governs','depends_on','conflicts_with','beneficiary_of','manages','insures','employs','related_to') COLLATE utf8mb4_unicode_ci NOT NULL,
  `weight` float DEFAULT '1',
  `metadataJson` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## kg_nodes

```sql
CREATE TABLE `kg_nodes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `nodeType` enum('person','account','goal','insurance','property','liability','income','tax','estate','product','regulation','document','advisor','beneficiary') COLLATE utf8mb4_unicode_ci NOT NULL,
  `label` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dataJson` json DEFAULT NULL,
  `status` enum('active','inactive','pending') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## knowledge_article_feedback

```sql
CREATE TABLE `knowledge_article_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `article_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `helpful` tinyint(1) NOT NULL,
  `feedback_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `context` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_kaf_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## knowledge_article_versions

```sql
CREATE TABLE `knowledge_article_versions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `article_id` int NOT NULL,
  `version` int NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by` int DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `change_reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_kav_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## knowledge_articles

```sql
CREATE TABLE `knowledge_articles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subcategory` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_type` enum('process','concept','reference','template','faq','policy','guide') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'concept',
  `metadata` json DEFAULT NULL,
  `version` int NOT NULL DEFAULT '1',
  `effective_date` datetime DEFAULT NULL,
  `expiry_date` datetime DEFAULT NULL,
  `source` enum('manual','ingested','ai_generated','conversation_mining') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `source_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `usage_count` int NOT NULL DEFAULT '0',
  `avg_helpfulness_score` float DEFAULT '0',
  `freshness_score` float DEFAULT '100',
  `last_used_at` datetime DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_ka_category` (`category`),
  KEY `idx_ka_content_type` (`content_type`),
  KEY `idx_ka_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## knowledge_gap_feedback

```sql
CREATE TABLE `knowledge_gap_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `gapId` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gapTitle` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gapCategory` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` enum('dismiss','acknowledge','resolved','not_applicable') COLLATE utf8mb4_unicode_ci NOT NULL,
  `userNote` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_gap_feedback_user` (`userId`),
  KEY `idx_gap_feedback_gap` (`gapId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## knowledge_gaps

```sql
CREATE TABLE `knowledge_gaps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `topic_cluster` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `query_count` int NOT NULL DEFAULT '1',
  `sample_queries` json DEFAULT NULL,
  `suggested_article_draft` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('open','in_progress','resolved','dismissed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_kg_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## knowledge_graph_edges

```sql
CREATE TABLE `knowledge_graph_edges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_entity_id` int NOT NULL,
  `to_entity_id` int NOT NULL,
  `relationship_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `weight` float DEFAULT '1',
  `valid_from` timestamp NULL DEFAULT NULL,
  `valid_until` timestamp NULL DEFAULT NULL,
  `source` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## knowledge_graph_entities

```sql
CREATE TABLE `knowledge_graph_entities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entity_type` enum('person','company','product','concept','regulation','account') COLLATE utf8mb4_unicode_ci NOT NULL,
  `canonical_name` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `aliases` json DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `last_verified` timestamp NULL DEFAULT NULL,
  `confidence` float DEFAULT '1',
  `source` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## knowledge_ingestion_jobs

```sql
CREATE TABLE `knowledge_ingestion_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source_type` enum('document','url','conversation','api','template','bulk') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_filename` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `articles_created` int NOT NULL DEFAULT '0',
  `articles_updated` int NOT NULL DEFAULT '0',
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `error` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_kij_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## layer_audits

```sql
CREATE TABLE `layer_audits` (
  `id` int NOT NULL AUTO_INCREMENT,
  `layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `audit_type` enum('scheduled','manual','triggered','continuous') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled',
  `audit_direction` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system_infrastructure',
  `target_id` int DEFAULT NULL,
  `status` enum('pending','running','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `findings` json DEFAULT NULL,
  `overall_health_score` float DEFAULT NULL,
  `metrics_snapshot` json DEFAULT NULL,
  `ai_analysis` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recommendations` json DEFAULT NULL,
  `run_by` int DEFAULT NULL,
  `started_at` bigint DEFAULT NULL,
  `completed_at` bigint DEFAULT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## layer_metrics

```sql
CREATE TABLE `layer_metrics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` int DEFAULT NULL,
  `metric_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metric_value` float NOT NULL,
  `metric_unit` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `context` json DEFAULT NULL,
  `period` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recorded_at` bigint NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## load_test_results

```sql
CREATE TABLE `load_test_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `test_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `scenario` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `concurrent_users` int DEFAULT NULL,
  `requests_per_second` float DEFAULT NULL,
  `p95_latency_ms` int DEFAULT NULL,
  `errors` int DEFAULT '0',
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ltc_analyses

```sql
CREATE TABLE `ltc_analyses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `current_age` int DEFAULT NULL,
  `retirement_age` int DEFAULT '65',
  `state` varchar(2) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zip_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `health_status` enum('excellent','good','fair','poor') COLLATE utf8mb4_unicode_ci DEFAULT 'good',
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `marital_status` enum('single','married','divorced','widowed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annual_income` decimal(15,2) DEFAULT NULL,
  `total_assets` decimal(15,2) DEFAULT NULL,
  `ltc_insurance_has` tinyint(1) DEFAULT '0',
  `ltc_insurance_daily_benefit` decimal(10,2) DEFAULT NULL,
  `ltc_insurance_benefit_period` int DEFAULT NULL,
  `projected_annual_cost` decimal(15,2) DEFAULT NULL,
  `projected_duration_years` decimal(5,2) DEFAULT NULL,
  `probability_of_need` decimal(5,2) DEFAULT NULL,
  `funding_gap` decimal(15,2) DEFAULT NULL,
  `recommended_strategy` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `analysis_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## manager_ai_settings

```sql
CREATE TABLE `manager_ai_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `managerId` int NOT NULL,
  `organizationId` int DEFAULT NULL,
  `teamFocusAreas` json DEFAULT NULL,
  `clientSegmentTargeting` text DEFAULT NULL,
  `reportingRequirements` json DEFAULT NULL,
  `promptOverlay` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `toneStyle` varchar(64) DEFAULT NULL,
  `responseFormat` varchar(64) DEFAULT NULL,
  `responseLength` varchar(64) DEFAULT NULL,
  `modelPreferences` json DEFAULT NULL,
  `ensembleWeights` json DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `maxTokens` int DEFAULT NULL,
  `defaultTtsVoice` varchar(64) DEFAULT NULL,
  `defaultSpeechRate` float DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `managerId` (`managerId`),
  KEY `fk_2` (`organizationId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`managerId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

## market_data_cache

```sql
CREATE TABLE `market_data_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `symbol` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dataType` enum('price','fx_rate','interest_rate','index','economic_indicator','commodity') COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` decimal(18,6) NOT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `source` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `observedAt` bigint NOT NULL,
  `metadataJson` json DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## market_data_subscriptions

```sql
CREATE TABLE `market_data_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `symbol` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subscribed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## market_events

```sql
CREATE TABLE `market_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `symbol` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL,
  `magnitude` float DEFAULT NULL,
  `details` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `insight_generated` tinyint(1) DEFAULT '0',
  `detected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## market_index_history

```sql
CREATE TABLE `market_index_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `index_symbol` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `open_price` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `close_price` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `daily_return` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_return_index` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_symbol_date` (`index_symbol`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## medicare_parameters

```sql
CREATE TABLE `medicare_parameters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parameter_year` int NOT NULL,
  `parameter_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_json` json NOT NULL,
  `source_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effective_date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## meeting_action_items

```sql
CREATE TABLE `meeting_action_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `meetingId` int NOT NULL,
  `userId` int NOT NULL,
  `title` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assignedTo` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `status` enum('pending','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `dueDate` timestamp NULL DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## meetings

```sql
CREATE TABLE `meetings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `organizationId` int DEFAULT NULL,
  `clientName` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `clientId` int DEFAULT NULL,
  `meetingType` enum('initial_consultation','portfolio_review','financial_plan','tax_planning','estate_planning','insurance_review','general','follow_up') COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `status` enum('scheduled','preparing','in_progress','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'scheduled',
  `scheduledAt` timestamp NULL DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `preMeetingBrief` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postMeetingSummary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `transcript` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keyDecisions` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `followUpDate` timestamp NULL DEFAULT NULL,
  `followUpEmail` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complianceNotes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## memories

```sql
CREATE TABLE `memories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `category` enum('fact','preference','goal','relationship','financial','temporal') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'fact',
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `source` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confidence` float DEFAULT '0.8',
  `validFrom` timestamp NULL DEFAULT NULL,
  `validUntil` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=150001;
```

## memory_episodes

```sql
CREATE TABLE `memory_episodes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `conversationId` int NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `keyTopics` json DEFAULT NULL,
  `emotionalTone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## messages

```sql
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversationId` int NOT NULL,
  `userId` int NOT NULL,
  `role` enum('user','assistant','system') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidenceScore` float DEFAULT NULL,
  `complianceStatus` enum('pending','approved','flagged','rejected') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=420001;
```

## mfa_backup_codes

```sql
CREATE TABLE `mfa_backup_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `code_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## mfa_secrets

```sql
CREATE TABLE `mfa_secrets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `secret` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` enum('totp','sms','email') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'totp',
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `last_used_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## model_backtests

```sql
CREATE TABLE `model_backtests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `model_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `historical_event` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_year` int NOT NULL,
  `portfolio_params` json DEFAULT NULL,
  `result_json` json DEFAULT NULL,
  `max_drawdown` float DEFAULT NULL,
  `recovery_months` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## model_cards

```sql
CREATE TABLE `model_cards` (
  `id` int NOT NULL AUTO_INCREMENT,
  `model_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0',
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `intended_use` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `limitations` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `training_data_summary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `performance_metrics` json DEFAULT NULL,
  `fairness_metrics` json DEFAULT NULL,
  `ethical_considerations` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `update_frequency` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_evaluated_at` timestamp NULL DEFAULT NULL,
  `published` tinyint(1) NOT NULL DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## model_output_records

```sql
CREATE TABLE `model_output_records` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `run_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` enum('user','organization','team','platform') COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `entity_id` int DEFAULT NULL,
  `output_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `output_value` json DEFAULT NULL,
  `confidence` float DEFAULT NULL,
  `previous_value` json DEFAULT NULL,
  `delta` json DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## model_runs

```sql
CREATE TABLE `model_runs` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `triggered_by` enum('schedule','event','manual','dependency') COLLATE utf8mb4_unicode_ci NOT NULL,
  `trigger_source` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `input_data` json DEFAULT NULL,
  `output_data` json DEFAULT NULL,
  `status` enum('pending','running','completed','failed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `duration_ms` int DEFAULT NULL,
  `affected_user_ids` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## model_scenarios

```sql
CREATE TABLE `model_scenarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `base_run_id` int DEFAULT NULL,
  `model_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `scenario_name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `adjusted_params` json DEFAULT NULL,
  `result_json` json DEFAULT NULL,
  `comparison_notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## model_schedules

```sql
CREATE TABLE `model_schedules` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cron_expression` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'UTC',
  `is_active` tinyint(1) DEFAULT '1',
  `last_run_at` timestamp NULL DEFAULT NULL,
  `next_run_at` timestamp NULL DEFAULT NULL,
  `filter_criteria` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## nitrogen_risk_profiles

```sql
CREATE TABLE `nitrogen_risk_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `nitrogen_risk_number` int DEFAULT NULL,
  `portfolio_risk_number` int DEFAULT NULL,
  `risk_alignment_score` int DEFAULT NULL,
  `last_synced_at` bigint DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## notification_log

```sql
CREATE TABLE `notification_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` enum('in_app','email','push','sms') COLLATE utf8mb4_unicode_ci DEFAULT 'in_app',
  `urgency` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `title` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deliveredAt` timestamp NULL DEFAULT NULL,
  `readAt` timestamp NULL DEFAULT NULL,
  `suppressed` tinyint(1) DEFAULT '0',
  `suppressionReason` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## onboarding_progress

```sql
CREATE TABLE `onboarding_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `tour_completed` tinyint(1) DEFAULT '0',
  `tour_step` int DEFAULT '0',
  `dismissed_tips` json DEFAULT NULL,
  `completed_features` json DEFAULT NULL,
  `last_seen_changelog` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_login_at` bigint DEFAULT NULL,
  `created_at` bigint DEFAULT NULL,
  `updated_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `idx_user_onboarding` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## org_ai_config

```sql
CREATE TABLE `org_ai_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `preferred_model` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `monthly_token_budget` int DEFAULT NULL,
  `tokens_used_this_month` int DEFAULT '0',
  `custom_system_prompt_additions` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `budget_alert_sent` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## org_prompt_customizations

```sql
CREATE TABLE `org_prompt_customizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `prompt_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## org_retention_policies

```sql
CREATE TABLE `org_retention_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `data_category` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `retention_days` int NOT NULL,
  `action` enum('delete','archive','anonymize') COLLATE utf8mb4_unicode_ci DEFAULT 'archive',
  `configured_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## organization_ai_settings

```sql
CREATE TABLE `organization_ai_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL,
  `organizationName` varchar(256) NOT NULL,
  `brandVoice` text DEFAULT NULL,
  `approvedProductCategories` json DEFAULT NULL,
  `prohibitedTopics` json DEFAULT NULL,
  `complianceLanguage` text DEFAULT NULL,
  `customDisclaimers` text DEFAULT NULL,
  `promptOverlay` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `toneStyle` varchar(64) DEFAULT 'professional',
  `responseFormat` varchar(64) DEFAULT 'mixed',
  `responseLength` varchar(64) DEFAULT 'standard',
  `modelPreferences` json DEFAULT NULL,
  `ensembleWeights` json DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `maxTokens` int DEFAULT NULL,
  `enabledFocusModes` json DEFAULT NULL,
  `defaultTtsVoice` varchar(64) DEFAULT NULL,
  `defaultSpeechRate` float DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `organizationId` (`organizationId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
```

## organization_landing_page_config

```sql
CREATE TABLE `organization_landing_page_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL,
  `headline` varchar(512) DEFAULT 'Your Complete Financial Picture, Understood by Us',
  `subtitle` text DEFAULT NULL,
  `ctaText` varchar(128) DEFAULT 'Start Your Financial Twin →',
  `secondaryLinkText` varchar(128) DEFAULT 'Try it anonymously',
  `logoUrl` text DEFAULT NULL,
  `primaryColor` varchar(7) DEFAULT '#0F172A',
  `accentColor` varchar(7) DEFAULT '#0EA5E9',
  `backgroundOption` varchar(64) DEFAULT 'gradient',
  `trustSignal1` text DEFAULT NULL,
  `trustSignal2` text DEFAULT NULL,
  `trustSignal3` text DEFAULT NULL,
  `disclaimerText` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `organizationId` (`organizationId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
```

## organization_relationships

```sql
CREATE TABLE `organization_relationships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parentOrgId` int NOT NULL,
  `childOrgId` int NOT NULL,
  `relationshipType` enum('partner','subsidiary','affiliate','referral','vendor','client') NOT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'active',
  `metadata` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `unique_org_relationship` (`parentOrgId`,`childOrgId`,`relationshipType`),
  KEY `fk_2` (`childOrgId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`parentOrgId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`childOrgId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

## organizations

```sql
CREATE TABLE `organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) NOT NULL,
  `slug` varchar(128) NOT NULL,
  `description` text DEFAULT NULL,
  `website` varchar(512) DEFAULT NULL,
  `ein` varchar(20) DEFAULT NULL,
  `industry` varchar(128) DEFAULT NULL,
  `size` enum('solo','small','medium','large','enterprise') DEFAULT 'small',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
```

## paper_trades

```sql
CREATE TABLE `paper_trades` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `symbol` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `trade_type` enum('buy','sell') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` decimal(18,6) NOT NULL,
  `price` decimal(18,6) NOT NULL,
  `total_value` decimal(18,2) NOT NULL,
  `ai_suggested` tinyint(1) NOT NULL DEFAULT '0',
  `ai_reasoning` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actual_price_at_close` decimal(18,6) DEFAULT NULL,
  `pnl` decimal(18,2) DEFAULT NULL,
  `pnl_percent` float DEFAULT NULL,
  `status` enum('open','closed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `opened_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## passive_action_log

```sql
CREATE TABLE `passive_action_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `preference_id` int NOT NULL,
  `source` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('success','failed','skipped','partial') COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_summary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `records_affected` int DEFAULT '0',
  `duration_ms` int DEFAULT NULL,
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `executed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## passive_action_preferences

```sql
CREATE TABLE `passive_action_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `source` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_type` enum('auto_refresh','background_sync','monitoring_alerts','scheduled_reports','anomaly_detection','smart_enrichment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '0',
  `config_json` json DEFAULT NULL,
  `last_triggered_at` timestamp NULL DEFAULT NULL,
  `trigger_count` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## performance_metrics

```sql
CREATE TABLE `performance_metrics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `metric_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metric_category` enum('latency','throughput','error_rate','availability','ai_quality','user_satisfaction') COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` float NOT NULL,
  `unit` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tags` json DEFAULT NULL,
  `sla_target` float DEFAULT NULL,
  `sla_met` tinyint(1) DEFAULT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## plaid_holdings

```sql
CREATE TABLE `plaid_holdings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `account_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `security_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ticker` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cost_basis` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_value` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_synced` bigint DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## plaid_webhook_log

```sql
CREATE TABLE `plaid_webhook_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `item_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `webhook_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `webhook_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `processed_at` bigint DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## plaid_webhooks_log

```sql
CREATE TABLE `plaid_webhooks_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `webhook_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_id` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `status` enum('received','processing','processed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'received',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## plan_adherence

```sql
CREATE TABLE `plan_adherence` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `category` enum('savings','spending','investment','debt','insurance','estate') COLLATE utf8mb4_unicode_ci NOT NULL,
  `targetValue` float DEFAULT NULL,
  `actualValue` float DEFAULT NULL,
  `adherenceScore` float DEFAULT NULL,
  `trend` enum('improving','stable','declining') COLLATE utf8mb4_unicode_ci DEFAULT 'stable',
  `lastNudgeTier` enum('none','gentle','contextual','advisor_alert','plan_revision') COLLATE utf8mb4_unicode_ci DEFAULT 'none',
  `periodStart` timestamp NULL DEFAULT NULL,
  `periodEnd` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## platform_ai_settings

```sql
CREATE TABLE `platform_ai_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `settingKey` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `baseSystemPrompt` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `defaultTone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'professional',
  `defaultResponseFormat` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'mixed',
  `defaultResponseLength` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'standard',
  `modelPreferences` json DEFAULT NULL,
  `ensembleWeights` json DEFAULT NULL,
  `globalGuardrails` json DEFAULT NULL,
  `prohibitedTopics` json DEFAULT NULL,
  `maxTokensDefault` int DEFAULT '4096',
  `temperatureDefault` float DEFAULT '0.7',
  `enabledFocusModes` json DEFAULT NULL,
  `platformDisclaimer` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `defaultTtsVoice` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `defaultSpeechRate` float DEFAULT NULL,
  `defaultAutoPlayVoice` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `settingKey` (`settingKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## platform_changelog

```sql
CREATE TABLE `platform_changelog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `version` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `feature_keys` json DEFAULT NULL,
  `change_type` enum('new_feature','improvement','fix','removal') COLLATE utf8mb4_unicode_ci NOT NULL,
  `impacted_roles` json DEFAULT NULL,
  `announced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=150001;
```

## platform_learnings

```sql
CREATE TABLE `platform_learnings` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `learning_type` enum('pattern','anomaly','trend','correlation','best_practice','risk_factor') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `evidence` json DEFAULT NULL,
  `confidence` float DEFAULT NULL,
  `impact_score` float DEFAULT NULL,
  `applicable_layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_recommendation` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('detected','validated','applied','rejected','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'detected',
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## portal_engagement

```sql
CREATE TABLE `portal_engagement` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `session_date` date NOT NULL,
  `login_count` int DEFAULT '0',
  `time_spent_seconds` int DEFAULT '0',
  `pages_visited` int DEFAULT '0',
  `features_used` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goals_checked` int DEFAULT '0',
  `actions_completed` int DEFAULT '0',
  `engagement_score` int DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## practice_metrics

```sql
CREATE TABLE `practice_metrics` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professionalId` int NOT NULL,
  `firmId` int DEFAULT NULL,
  `periodEndDate` timestamp NOT NULL,
  `organicGrowthRate` float DEFAULT NULL,
  `netNewClients` int DEFAULT NULL,
  `revenuePerClient` float DEFAULT NULL,
  `costToServeJson` json DEFAULT NULL,
  `attritionRiskClientsJson` json DEFAULT NULL,
  `engagementScoresJson` json DEFAULT NULL,
  `benchmarkPercentilesJson` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## predictive_triggers

```sql
CREATE TABLE `predictive_triggers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trigger_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `condition_json` json DEFAULT NULL,
  `action_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action_json` json DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## premium_finance_cases

```sql
CREATE TABLE `premium_finance_cases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `clientId` int NOT NULL,
  `professionalId` int NOT NULL,
  `insurancePolicyRef` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `financedPremiumAnnual` decimal(15,2) DEFAULT NULL,
  `loanAmount` decimal(15,2) DEFAULT NULL,
  `lenderName` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `interestRate` decimal(5,3) DEFAULT NULL,
  `termYears` int DEFAULT NULL,
  `collateralType` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `collateralValue` decimal(15,2) DEFAULT NULL,
  `structureJson` json DEFAULT NULL,
  `stressTestJson` json DEFAULT NULL,
  `gateStatus` enum('modeling','pending_review','approved','applied','funded','monitoring','closed') COLLATE utf8mb4_unicode_ci DEFAULT 'modeling',
  `gateReviewId` int DEFAULT NULL,
  `status` enum('modeling','applied','funded','monitoring','closed') COLLATE utf8mb4_unicode_ci DEFAULT 'modeling',
  `monitoringAlertsJson` json DEFAULT NULL,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## premium_finance_rates

```sql
CREATE TABLE `premium_finance_rates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rate_date` date NOT NULL,
  `sofr` decimal(6,4) DEFAULT NULL,
  `sofr_30` decimal(6,4) DEFAULT NULL,
  `sofr_90` decimal(6,4) DEFAULT NULL,
  `treasury_10y` decimal(6,4) DEFAULT NULL,
  `treasury_30y` decimal(6,4) DEFAULT NULL,
  `prime_rate` decimal(6,4) DEFAULT NULL,
  `fetched_at` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `uq_rate_date` (`rate_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## privacy_audit

```sql
CREATE TABLE `privacy_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `apiCallPurpose` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dataCategories` json DEFAULT NULL,
  `piiMasked` tinyint(1) DEFAULT '0',
  `modelUsed` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tokensSent` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=330001;
```

## proactive_escalation_rules

```sql
CREATE TABLE `proactive_escalation_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trigger_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `condition_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `threshold` float DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## proactive_insights

```sql
CREATE TABLE `proactive_insights` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `organization_id` int DEFAULT NULL,
  `client_id` int DEFAULT NULL,
  `category` enum('compliance','portfolio','tax','engagement','spending','life_event') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'portfolio',
  `priority` enum('low','medium','high','critical') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `title` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `suggested_action` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('new','viewed','acted','dismissed','snoozed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `snooze_until` datetime DEFAULT NULL,
  `acted_at` datetime DEFAULT NULL,
  `dismissed_at` datetime DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_insights_user` (`user_id`),
  KEY `idx_insights_status` (`status`),
  KEY `idx_insights_category` (`category`),
  KEY `idx_insights_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## probe_results

```sql
CREATE TABLE `probe_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `domain` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `probe_timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `batches_completed` int DEFAULT '0',
  `first_throttle_batch` int DEFAULT NULL,
  `discovered_rpm` int DEFAULT NULL,
  `confidence` decimal(3,2) DEFAULT NULL,
  `raw_log` json DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `applied` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## product_suitability_evaluations

```sql
CREATE TABLE `product_suitability_evaluations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `suitability_score` float DEFAULT NULL,
  `evaluation_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `qualifying_dimensions` json DEFAULT NULL,
  `disqualifying_dimensions` json DEFAULT NULL,
  `status` enum('qualified','marginal','disqualified','needs_review') COLLATE utf8mb4_unicode_ci DEFAULT 'qualified',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## products

```sql
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('iul','term_life','disability','ltc','premium_finance','whole_life','variable_life') COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `features` json DEFAULT NULL,
  `riskLevel` enum('low','moderate','moderate_high','high') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `minPremium` float DEFAULT NULL,
  `maxPremium` float DEFAULT NULL,
  `targetAudience` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `competitorFlag` tinyint(1) DEFAULT '0',
  `isPlatform` tinyint(1) DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `organizationId` int DEFAULT NULL,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_products_org` (`organizationId`),
  CONSTRAINT `fk_products_org` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=60001;
```

## professional_ai_settings

```sql
CREATE TABLE `professional_ai_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professionalId` int NOT NULL,
  `organizationId` int DEFAULT NULL,
  `specialization` varchar(256) DEFAULT NULL,
  `methodology` text DEFAULT NULL,
  `communicationStyle` text DEFAULT NULL,
  `perClientOverrides` json DEFAULT NULL,
  `promptOverlay` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `managerId` int DEFAULT NULL,
  `toneStyle` varchar(64) DEFAULT NULL,
  `responseFormat` varchar(64) DEFAULT NULL,
  `responseLength` varchar(64) DEFAULT NULL,
  `modelPreferences` json DEFAULT NULL,
  `ensembleWeights` json DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `maxTokens` int DEFAULT NULL,
  `defaultTtsVoice` varchar(64) DEFAULT NULL,
  `defaultSpeechRate` float DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `professionalId` (`professionalId`),
  KEY `fk_2` (`organizationId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`professionalId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

## professional_availability

```sql
CREATE TABLE `professional_availability` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professional_id` int NOT NULL,
  `day_of_week` int NOT NULL,
  `start_time` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `end_time` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'America/New_York',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## professional_context

```sql
CREATE TABLE `professional_context` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `addedBy` int NOT NULL,
  `rawInput` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `parsedDomains` json DEFAULT NULL,
  `visibleToClient` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## professional_relationships

```sql
CREATE TABLE `professional_relationships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `professional_id` int NOT NULL,
  `relationship_type` enum('financial_advisor','insurance_agent','tax_professional','estate_attorney','accountant','mortgage_broker','real_estate_agent','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','inactive','pending','ended') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `started_at` bigint DEFAULT NULL,
  `ended_at` bigint DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_contact_at` bigint DEFAULT NULL,
  `referral_source` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## professional_reviews

```sql
CREATE TABLE `professional_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professional_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` int NOT NULL,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `review` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_anonymous` tinyint(1) DEFAULT '0',
  `status` enum('published','pending','flagged','removed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## professional_verifications

```sql
CREATE TABLE `professional_verifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professional_id` int NOT NULL,
  `verification_source` enum('finra_brokercheck','sec_iapd','cfp_board','nasba_cpaverify','nipr_pdb','nmls','state_bar','ibba','martindale','avvo') COLLATE utf8mb4_unicode_ci NOT NULL,
  `verification_status` enum('verified','not_found','flagged','expired','pending') COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `external_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `raw_data` json DEFAULT NULL,
  `disclosures` json DEFAULT NULL,
  `license_states` json DEFAULT NULL,
  `license_expiration` timestamp NULL DEFAULT NULL,
  `verified_at` bigint NOT NULL,
  `expires_at` bigint DEFAULT NULL,
  `verification_method` enum('api','scrape','manual','n8n_workflow') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_prof_source` (`professional_id`,`verification_source`),
  KEY `idx_status` (`verification_status`),
  KEY `idx_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## professionals

```sql
CREATE TABLE `professionals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `linked_user_id` int DEFAULT NULL,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `firm` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `credentials` json DEFAULT NULL,
  `licenses` json DEFAULT NULL,
  `specializations` json DEFAULT NULL,
  `tier` enum('tier1_existing','tier2_org_affiliated','tier3_specialty','tier4_location','tier5_general') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tier5_general',
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `verified_at` bigint DEFAULT NULL,
  `source` enum('manual','directory_import','org_roster','self_registered','referral') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `avg_rating` float DEFAULT '0',
  `review_count` int DEFAULT '0',
  `years_experience` int DEFAULT NULL,
  `aum_range` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fee_structure` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `minimum_investment` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `services_offered` json DEFAULT NULL,
  `languages_spoken` json DEFAULT NULL,
  `status` enum('active','inactive','pending_verification','suspended') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## prompt_experiment_results

```sql
CREATE TABLE `prompt_experiment_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `experiment_name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variant_a_id` int NOT NULL,
  `variant_b_id` int NOT NULL,
  `total_samples` int DEFAULT '0',
  `variant_a_positive` int DEFAULT '0',
  `variant_b_positive` int DEFAULT '0',
  `variant_a_avg_latency` float DEFAULT NULL,
  `variant_b_avg_latency` float DEFAULT NULL,
  `p_value` float DEFAULT NULL,
  `significance_reached` tinyint(1) DEFAULT '0',
  `winner_id` int DEFAULT NULL,
  `auto_promoted` tinyint(1) DEFAULT '0',
  `status` enum('running','completed','cancelled') COLLATE utf8mb4_unicode_ci DEFAULT 'running',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## prompt_experiments

```sql
CREATE TABLE `prompt_experiments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `variantId` int NOT NULL,
  `conversationId` int NOT NULL,
  `messageId` int DEFAULT NULL,
  `feedbackRating` enum('up','down') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confidenceScore` float DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## prompt_golden_tests

```sql
CREATE TABLE `prompt_golden_tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prompt_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expected_response_pattern` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `compliance_must_pass` tinyint(1) DEFAULT '1',
  `min_similarity_score` float DEFAULT '0.7',
  `is_active` tinyint(1) DEFAULT '1',
  `last_tested_at` timestamp NULL DEFAULT NULL,
  `last_passed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## prompt_interactions

```sql
CREATE TABLE `prompt_interactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `prompt_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `prompt_category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` enum('suggested','typed','voice','command_palette') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'typed',
  `was_suggested` tinyint(1) NOT NULL DEFAULT '0',
  `was_clicked` tinyint(1) NOT NULL DEFAULT '0',
  `response_quality_score` float DEFAULT NULL,
  `session_context` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## prompt_regression_runs

```sql
CREATE TABLE `prompt_regression_runs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `variant_id` int DEFAULT NULL,
  `total_tests` int DEFAULT '0',
  `passed_tests` int DEFAULT '0',
  `avg_similarity` float DEFAULT NULL,
  `compliance_pass_rate` float DEFAULT NULL,
  `quality_drop` tinyint(1) DEFAULT '0',
  `promotion_blocked` tinyint(1) DEFAULT '0',
  `run_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## prompt_variants

```sql
CREATE TABLE `prompt_variants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `promptTemplate` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT 'system',
  `isActive` tinyint(1) DEFAULT '1',
  `weight` float DEFAULT '1',
  `totalUses` int DEFAULT '0',
  `avgRating` float DEFAULT '0',
  `positiveCount` int DEFAULT '0',
  `negativeCount` int DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## propagation_actions

```sql
CREATE TABLE `propagation_actions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_id` int NOT NULL,
  `action_type` enum('acknowledge','act','dismiss','escalate','snooze','delegate') COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_data` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## propagation_events

```sql
CREATE TABLE `propagation_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` enum('insight','alert','recommendation','compliance','milestone','risk_change','opportunity') COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_entity_id` int DEFAULT NULL,
  `target_entity_id` int DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `priority` enum('critical','high','medium','low') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `status` enum('pending','delivered','acknowledged','acted','dismissed','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `delivered_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## quality_ratings

```sql
CREATE TABLE `quality_ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `messageId` int NOT NULL,
  `conversationId` int NOT NULL,
  `score` float NOT NULL,
  `reasoning` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `improvementSuggestions` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## rate_profiles

```sql
CREATE TABLE `rate_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `current_rpm` int NOT NULL DEFAULT '10',
  `discovered_limit` int DEFAULT NULL,
  `static_maximum` int NOT NULL DEFAULT '60',
  `safety_factor` decimal(3,2) DEFAULT '0.70',
  `daily_budget` int DEFAULT '1000',
  `daily_used` int DEFAULT '0',
  `daily_reset_at` timestamp NULL DEFAULT NULL,
  `success_rate` decimal(5,2) DEFAULT '100.00',
  `avg_latency_ms` int DEFAULT NULL,
  `last_throttled_at` timestamp NULL DEFAULT NULL,
  `last_blocked_at` timestamp NULL DEFAULT NULL,
  `is_government` tinyint(1) DEFAULT '0',
  `probe_enabled` tinyint(1) DEFAULT '0',
  `enabled` tinyint(1) DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `provider` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## rate_recommendations

```sql
CREATE TABLE `rate_recommendations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recommendation_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recommendation_json` json NOT NULL,
  `confidence` decimal(3,2) DEFAULT NULL,
  `status` enum('pending_review','auto_applicable','approved','rejected','applied') COLLATE utf8mb4_unicode_ci DEFAULT 'pending_review',
  `reviewed_by` int DEFAULT NULL,
  `applied_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## rate_signal_log

```sql
CREATE TABLE `rate_signal_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `signal_type` enum('rate_limit_header','retry_after','http_429','http_403','latency_spike','connection_reset','timeout','captcha_detected','soft_block','rate_reduction') COLLATE utf8mb4_unicode_ci NOT NULL,
  `signal_data` json DEFAULT NULL,
  `http_status` int DEFAULT NULL,
  `retry_after_seconds` int DEFAULT NULL,
  `rate_headers` json DEFAULT NULL,
  `previous_rpm` int DEFAULT NULL,
  `adjusted_rpm` int DEFAULT NULL,
  `auto_applied` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## recommendations_log

```sql
CREATE TABLE `recommendations_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `advisor_id` int DEFAULT NULL,
  `conversation_id` int DEFAULT NULL,
  `message_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `recommendation_type` enum('product','strategy','action','allocation','rebalance') COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `reasoning` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `factors` json DEFAULT NULL,
  `confidence_score` float DEFAULT NULL,
  `suitability_score` float DEFAULT NULL,
  `risk_level` enum('low','medium','high','very_high') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disclaimers` json DEFAULT NULL,
  `coi_disclosure_ids` json DEFAULT NULL,
  `status` enum('suggested','accepted','rejected','implemented','expired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'suggested',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## reconciliation_log

```sql
CREATE TABLE `reconciliation_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_id` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expected_balance` decimal(18,2) DEFAULT NULL,
  `actual_balance` decimal(18,2) DEFAULT NULL,
  `discrepancy` decimal(18,2) DEFAULT NULL,
  `resolved` tinyint(1) DEFAULT '0',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## referrals

```sql
CREATE TABLE `referrals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fromProfessionalId` int NOT NULL,
  `toCoiId` int NOT NULL,
  `clientId` int DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outcome` enum('pending','accepted','completed','declined') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## regulatory_alerts

```sql
CREATE TABLE `regulatory_alerts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filing_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relevance_to_user` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alert_sent` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## regulatory_impact_analyses

```sql
CREATE TABLE `regulatory_impact_analyses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `update_id` int NOT NULL,
  `impact_level` enum('high','medium','low') COLLATE utf8mb4_unicode_ci DEFAULT 'low',
  `affected_areas` json DEFAULT NULL,
  `recommended_actions` json DEFAULT NULL,
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## regulatory_updates

```sql
CREATE TABLE `regulatory_updates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `source` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relevance_score` float DEFAULT NULL,
  `categories` json DEFAULT NULL,
  `action_required` tinyint(1) DEFAULT '0',
  `reviewed_by` int DEFAULT NULL,
  `published_at` timestamp NULL DEFAULT NULL,
  `ingested_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## report_jobs

```sql
CREATE TABLE `report_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `org_id` int DEFAULT NULL,
  `template_id` int NOT NULL,
  `client_id` int DEFAULT NULL,
  `parameters` json DEFAULT NULL,
  `status` enum('pending','generating','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `output_url` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `output_key` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `output_format` enum('pdf','docx','html') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pdf',
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `recurring_cron` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## report_templates

```sql
CREATE TABLE `report_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('portfolio_review','financial_plan','insurance_analysis','tax_summary','estate_plan','quarterly_report','annual_review','custom') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'custom',
  `template_body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `sections` json DEFAULT NULL,
  `branding` json DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## retention_actions_log

```sql
CREATE TABLE `retention_actions_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `action` enum('delete','archive','anonymize') COLLATE utf8mb4_unicode_ci NOT NULL,
  `records_affected` int DEFAULT '0',
  `executed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## review_queue

```sql
CREATE TABLE `review_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `conversationId` int NOT NULL,
  `messageId` int NOT NULL,
  `confidenceScore` float NOT NULL,
  `autonomyLevel` enum('high','medium','low') COLLATE utf8mb4_unicode_ci NOT NULL,
  `aiReasoning` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `aiRecommendation` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complianceNotes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','approved','rejected','modified') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `reviewerAction` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewedBy` int DEFAULT NULL,
  `reviewedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=120001;
```

## role_elevations

```sql
CREATE TABLE `role_elevations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `from_role` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `to_role` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `granted_by` int NOT NULL,
  `granted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## saved_analyses

```sql
CREATE TABLE `saved_analyses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `client_id` int DEFAULT NULL,
  `analysis_type` enum('tax_projection','ss_optimization','hsa_optimization','medicare_navigation','charitable_giving','divorce_financial','education_plan','fee_comparison') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `input_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## scrape_schedules

```sql
CREATE TABLE `scrape_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `data_source_id` int NOT NULL,
  `cron_expression` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `next_run_at` bigint DEFAULT NULL,
  `last_run_at` bigint DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `retry_on_failure` tinyint(1) DEFAULT '1',
  `max_retries` int DEFAULT '3',
  `notify_on_failure` tinyint(1) DEFAULT '1',
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## scraping_audit

```sql
CREATE TABLE `scraping_audit` (
  `id` int NOT NULL AUTO_INCREMENT,
  `provider` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `method` enum('GET','POST','PUT','DELETE','PATCH') COLLATE utf8mb4_unicode_ci DEFAULT 'GET',
  `status_code` int DEFAULT NULL,
  `response_time_ms` int DEFAULT NULL,
  `rate_limit_remaining` int DEFAULT NULL,
  `rate_limit_reset` timestamp NULL DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `robots_txt_checked` tinyint(1) DEFAULT '0',
  `robots_txt_allowed` tinyint(1) DEFAULT '1',
  `cache_hit` tinyint(1) DEFAULT '0',
  `error_message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## scraping_cache

```sql
CREATE TABLE `scraping_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `cache_key` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `endpoint` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_body` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `response_headers` json DEFAULT NULL,
  `status_code` int DEFAULT NULL,
  `ttl_seconds` int DEFAULT '86400',
  `hit_count` int DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `cache_key` (`cache_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=30001;
```

## search_cache

```sql
CREATE TABLE `search_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `query_hash` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `query_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_json` json DEFAULT NULL,
  `source_citations` json DEFAULT NULL,
  `hit_count` int DEFAULT '1',
  `expires_at` bigint NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_query_hash` (`query_hash`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## self_discovery_history

```sql
CREATE TABLE `self_discovery_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `trigger_message_id` int DEFAULT NULL,
  `last_user_query` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_ai_response` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `generated_query` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` enum('deeper','broader','applied') COLLATE utf8mb4_unicode_ci NOT NULL,
  `layer_context` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `proficiency_level` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `feature_context` json DEFAULT NULL,
  `status` enum('generated','sent','dismissed','completed') COLLATE utf8mb4_unicode_ci DEFAULT 'generated',
  `user_engaged` tinyint(1) DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=120001;
```

## server_errors

```sql
CREATE TABLE `server_errors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `error_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stack` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `component_name` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `resolved` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## snaptrade_accounts

```sql
CREATE TABLE `snaptrade_accounts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `connection_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snaptrade_account_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_number` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `account_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institution_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cash_balance` decimal(18,4) DEFAULT NULL,
  `market_value` decimal(18,4) DEFAULT NULL,
  `total_value` decimal(18,4) DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `last_sync_at` timestamp NULL DEFAULT NULL,
  `sync_data_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## snaptrade_brokerage_connections

```sql
CREATE TABLE `snaptrade_brokerage_connections` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `snaptrade_user_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brokerage_authorization_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `brokerage_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `brokerage_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','disabled','error','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `disabled_reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_sync_at` timestamp NULL DEFAULT NULL,
  `last_sync_status` enum('success','partial','failed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## snaptrade_positions

```sql
CREATE TABLE `snaptrade_positions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `account_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `symbol_ticker` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol_name` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `symbol_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `units` decimal(18,8) DEFAULT NULL,
  `average_price` decimal(18,4) DEFAULT NULL,
  `current_price` decimal(18,4) DEFAULT NULL,
  `market_value` decimal(18,4) DEFAULT NULL,
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'USD',
  `raw_json` json DEFAULT NULL,
  `last_sync_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## snaptrade_users

```sql
CREATE TABLE `snaptrade_users` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `snaptrade_user_id` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snaptrade_user_secret_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('active','disabled','deleted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ssa_life_tables

```sql
CREATE TABLE `ssa_life_tables` (
  `id` int NOT NULL AUTO_INCREMENT,
  `age` int NOT NULL,
  `sex` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `probability_of_death` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `life_expectancy` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_year` int NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## ssa_parameters

```sql
CREATE TABLE `ssa_parameters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parameter_year` int NOT NULL,
  `parameter_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_json` json NOT NULL,
  `source_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effective_date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## student_loans

```sql
CREATE TABLE `student_loans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `servicer` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `balance` float NOT NULL,
  `rate` float NOT NULL,
  `loanType` enum('subsidized','unsubsidized','plus','grad_plus','private','consolidation') COLLATE utf8mb4_unicode_ci NOT NULL,
  `repaymentPlan` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paymentsMade` int DEFAULT '0',
  `remainingTerm` int DEFAULT NULL,
  `pslfQualifyingPayments` int DEFAULT '0',
  `pslfEligible` tinyint(1) DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## study_progress

```sql
CREATE TABLE `study_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `certification` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `topics_covered` json DEFAULT NULL,
  `quiz_scores` json DEFAULT NULL,
  `weak_areas` json DEFAULT NULL,
  `study_time_minutes` int NOT NULL DEFAULT '0',
  `total_questions_attempted` int NOT NULL DEFAULT '0',
  `total_questions_correct` int NOT NULL DEFAULT '0',
  `current_difficulty` enum('beginner','intermediate','advanced') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'beginner',
  `last_session_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_sp_user` (`user_id`),
  KEY `idx_sp_cert` (`certification`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## suitability_assessments

```sql
CREATE TABLE `suitability_assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `riskTolerance` enum('conservative','moderate','aggressive') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `investmentHorizon` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `annualIncome` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `netWorth` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `investmentExperience` enum('none','limited','moderate','extensive') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `financialGoals` json DEFAULT NULL,
  `insuranceNeeds` json DEFAULT NULL,
  `responses` json DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=60001;
```

## suitability_change_events

```sql
CREATE TABLE `suitability_change_events` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dimension_key` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `change_type` enum('user_input','advisor_update','system_inference','integration_sync','decay','milestone') COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `source` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confidence` float DEFAULT NULL,
  `triggered_by` int DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## suitability_dimensions

```sql
CREATE TABLE `suitability_dimensions` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dimension_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dimension_label` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` json DEFAULT NULL,
  `score` float DEFAULT NULL,
  `confidence` float DEFAULT '0',
  `sources` json DEFAULT NULL,
  `last_updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `decay_rate` float DEFAULT '0.01',
  `next_review_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## suitability_household_links

```sql
CREATE TABLE `suitability_household_links` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `primary_user_id` int NOT NULL,
  `linked_user_id` int NOT NULL,
  `relationship` enum('spouse','partner','dependent','parent','sibling','other') COLLATE utf8mb4_unicode_ci NOT NULL,
  `shared_dimensions` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## suitability_profiles

```sql
CREATE TABLE `suitability_profiles` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `organization_id` int DEFAULT NULL,
  `overall_score` float DEFAULT NULL,
  `confidence_level` float DEFAULT '0',
  `data_completeness` float DEFAULT '0',
  `last_synthesized_at` timestamp NULL DEFAULT NULL,
  `synthesis_version` int DEFAULT '1',
  `dimension_scores` json DEFAULT NULL,
  `source_breakdown` json DEFAULT NULL,
  `change_velocity` float DEFAULT NULL,
  `status` enum('draft','active','needs_review','archived') COLLATE utf8mb4_unicode_ci DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## suitability_questions_queue

```sql
CREATE TABLE `suitability_questions_queue` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `dimension_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `question` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `question_type` enum('multiple_choice','scale','free_text','yes_no','numeric') COLLATE utf8mb4_unicode_ci DEFAULT 'multiple_choice',
  `options` json DEFAULT NULL,
  `priority` int DEFAULT '50',
  `status` enum('pending','asked','answered','skipped','expired') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `asked_at` timestamp NULL DEFAULT NULL,
  `answered_at` timestamp NULL DEFAULT NULL,
  `answer` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## tasks

```sql
CREATE TABLE `tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `assigned_to` int DEFAULT NULL,
  `client_id` int DEFAULT NULL,
  `title` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `priority` enum('urgent','high','medium','low') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `status` enum('pending','in_progress','completed','cancelled','overdue') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `category` enum('client_review','compliance','onboarding','follow_up','planning','admin','meeting_prep','document','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  `due_date` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `recurring` tinyint(1) DEFAULT '0',
  `recurring_interval` enum('daily','weekly','monthly','quarterly','annually') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_entity_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_entity_id` int DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## tax_parameters

```sql
CREATE TABLE `tax_parameters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tax_year` int NOT NULL,
  `parameter_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parameter_category` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filing_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'all',
  `value_json` json NOT NULL,
  `source_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `effective_date` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiry_date` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `idx_year_param_status` (`tax_year`,`parameter_name`,`filing_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## transaction_categories

```sql
CREATE TABLE `transaction_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_id` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `ai_category` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_override_category` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confidence` float DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## user_ai_boundaries

```sql
CREATE TABLE `user_ai_boundaries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `boundary_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## user_changelog_awareness

```sql
CREATE TABLE `user_changelog_awareness` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `changelog_id` int NOT NULL,
  `informed_via` enum('ai_chat','notification','changelog_page','onboarding') COLLATE utf8mb4_unicode_ci NOT NULL,
  `informed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_uca_user` (`user_id`),
  UNIQUE KEY `idx_uca_user_changelog` (`user_id`,`changelog_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=150001;
```

## user_consents

```sql
CREATE TABLE `user_consents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `consent_type` enum('ai_chat','voice_input','document_upload','data_sharing','marketing','analytics') COLLATE utf8mb4_unicode_ci NOT NULL,
  `granted` tinyint(1) NOT NULL DEFAULT '0',
  `granted_at` bigint DEFAULT NULL,
  `revoked_at` bigint DEFAULT NULL,
  `version` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '1.0',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` bigint NOT NULL,
  `updated_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## user_feature_proficiency

```sql
CREATE TABLE `user_feature_proficiency` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `feature_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `feature_label` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_interactions` int NOT NULL DEFAULT '0',
  `total_duration_ms` bigint NOT NULL DEFAULT '0',
  `proficiency_score` float NOT NULL DEFAULT '0',
  `proficiency_level` enum('undiscovered','novice','familiar','proficient','expert') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'undiscovered',
  `first_used_at` timestamp NULL DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `idx_ufp_user_feature` (`user_id`,`feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=330001;
```

## user_guardrails

```sql
CREATE TABLE `user_guardrails` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `guardrail_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## user_insights_cache

```sql
CREATE TABLE `user_insights_cache` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `insight_type` enum('people_performance','system_infrastructure','usage_optimization') COLLATE utf8mb4_unicode_ci NOT NULL,
  `layer` enum('platform','organization','manager','professional','user') COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `computed_at` bigint NOT NULL,
  `expires_at` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_user_insights_user` (`user_id`),
  KEY `idx_user_insights_type_layer` (`user_id`,`insight_type`,`layer`),
  KEY `idx_user_insights_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=150001;
```

## user_organization_roles

```sql
CREATE TABLE `user_organization_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `organizationId` int NOT NULL,
  `globalRole` enum('global_admin','user') DEFAULT 'user',
  `organizationRole` enum('org_admin','manager','professional','user') DEFAULT 'user',
  `managerId` int DEFAULT NULL,
  `professionalId` int DEFAULT NULL,
  `status` enum('active','inactive','invited','pending_approval') DEFAULT 'active',
  `invitedAt` timestamp NULL DEFAULT NULL,
  `approvedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `unique_user_org_role` (`userId`,`organizationId`),
  KEY `fk_2` (`organizationId`),
  KEY `fk_3` (`managerId`),
  KEY `fk_4` (`professionalId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_3` FOREIGN KEY (`managerId`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_4` FOREIGN KEY (`professionalId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
```

## user_platform_events

```sql
CREATE TABLE `user_platform_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `event_type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `feature_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `metadata` json DEFAULT NULL,
  `session_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_upe_user` (`user_id`),
  KEY `idx_upe_feature` (`feature_key`),
  KEY `idx_upe_user_feature` (`user_id`,`feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=330001;
```

## user_preferences

```sql
CREATE TABLE `user_preferences` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `communicationStyle` enum('simple','detailed','expert') DEFAULT 'detailed',
  `responseLength` enum('concise','standard','comprehensive') DEFAULT 'standard',
  `ttsVoice` varchar(64) DEFAULT 'en-US-JennyNeural',
  `autoPlayVoice` tinyint(1) DEFAULT '0',
  `handsFreeMode` tinyint(1) DEFAULT '0',
  `autoGenerateCharts` tinyint(1) DEFAULT '1',
  `riskTolerance` enum('conservative','moderate','aggressive') DEFAULT NULL,
  `financialGoals` json DEFAULT NULL,
  `taxFilingStatus` varchar(64) DEFAULT NULL,
  `stateOfResidence` varchar(64) DEFAULT NULL,
  `theme` enum('system','light','dark') DEFAULT 'dark',
  `sidebarDefault` enum('expanded','collapsed') DEFAULT 'expanded',
  `chatDensity` enum('comfortable','compact') DEFAULT 'comfortable',
  `language` varchar(64) DEFAULT 'en',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `modelPreferences` json DEFAULT NULL,
  `ensembleWeights` json DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `maxTokens` int DEFAULT NULL,
  `customPromptAdditions` text DEFAULT NULL,
  `responseFormat` varchar(64) DEFAULT 'mixed',
  `focusModeDefaults` varchar(128) DEFAULT 'general,financial',
  `thinkingDepth` enum('quick','standard','deep','extended') DEFAULT 'standard',
  `creativity` float DEFAULT '0.7',
  `contextDepth` enum('recent','moderate','full') DEFAULT 'moderate',
  `disclaimerVerbosity` enum('minimal','standard','comprehensive') DEFAULT 'standard',
  `autoFollowUp` tinyint(1) DEFAULT '0',
  `autoFollowUpCount` int DEFAULT '1',
  `crossModelVerify` tinyint(1) DEFAULT '0',
  `citationStyle` enum('none','inline','footnotes') DEFAULT 'none',
  `reasoningTransparency` tinyint(1) DEFAULT '0',
  `discoveryDirection` enum('deeper','broader','applied','auto') DEFAULT 'auto',
  `discoveryIdleThresholdMs` int DEFAULT '120000',
  `discoveryContinuous` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `userId` (`userId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;
```

## user_profiles

```sql
CREATE TABLE `user_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `age` int DEFAULT NULL,
  `zipCode` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jobTitle` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `incomeRange` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `savingsRange` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `familySituation` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lifeStage` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `goals` json DEFAULT NULL,
  `sharedContext` json DEFAULT NULL,
  `insuranceSummary` json DEFAULT NULL,
  `investmentSummary` json DEFAULT NULL,
  `estateExposure` json DEFAULT NULL,
  `businessOwner` tinyint(1) DEFAULT '0',
  `focusPreference` enum('general','financial','both') COLLATE utf8mb4_unicode_ci DEFAULT 'both',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `unique_user` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## user_relationships

```sql
CREATE TABLE `user_relationships` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `relatedUserId` int NOT NULL,
  `relationshipType` enum('manager','team_member','mentor','mentee','peer','client','advisor','colleague') NOT NULL,
  `organizationId` int DEFAULT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'active',
  `metadata` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `unique_user_relationship` (`userId`,`relatedUserId`,`relationshipType`,`organizationId`),
  KEY `fk_2` (`relatedUserId`),
  KEY `fk_3` (`organizationId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`relatedUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_3` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

## users

```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `loginMethod` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','advisor','manager','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `authTier` enum('anonymous','email','full','advisor_connected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'full',
  `affiliateOrgId` int DEFAULT NULL,
  `anonymousConversationCount` int NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `styleProfile` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `suitabilityCompleted` tinyint(1) DEFAULT '0',
  `suitabilityData` json DEFAULT NULL,
  `settings` json DEFAULT NULL,
  `avatarUrl` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tosAcceptedAt` timestamp NULL DEFAULT NULL,
  `passwordHash` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `auth_provider` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'manus',
  `linkedin_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linkedin_profile_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linkedin_headline` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linkedin_industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `linkedin_location` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_birthday` date DEFAULT NULL,
  `google_gender` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `google_address_json` json DEFAULT NULL,
  `google_organizations_json` json DEFAULT NULL,
  `employer_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `job_title` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_enriched_at` timestamp NULL DEFAULT NULL,
  `profile_enrichment_source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sign_in_data_json` json DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `users_openId_unique` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1470001;
```

## verification_schedules

```sql
CREATE TABLE `verification_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `professional_id` int NOT NULL,
  `verification_source` enum('finra_brokercheck','sec_iapd','cfp_board','nasba_cpaverify','nipr_pdb','nmls','state_bar','ibba','martindale','avvo') COLLATE utf8mb4_unicode_ci NOT NULL,
  `frequency_days` int NOT NULL DEFAULT '30',
  `last_run_at` bigint DEFAULT NULL,
  `next_run_at` bigint NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `idx_next_run` (`next_run_at`,`enabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## view_as_audit_log

```sql
CREATE TABLE `view_as_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actorId` int NOT NULL,
  `targetUserId` int NOT NULL,
  `organizationId` int DEFAULT NULL,
  `startTime` timestamp NOT NULL,
  `endTime` timestamp NULL DEFAULT NULL,
  `actions` json DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `sessionDuration` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_1` (`actorId`),
  KEY `fk_2` (`targetUserId`),
  KEY `fk_3` (`organizationId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`actorId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`targetUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_3` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

## web_scrape_results

```sql
CREATE TABLE `web_scrape_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `dataSourceId` int DEFAULT NULL,
  `ingestionJobId` int DEFAULT NULL,
  `url` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pageTitle` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contentText` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extractedEntities` json DEFAULT NULL,
  `extractedMetrics` json DEFAULT NULL,
  `scrapeStatus` enum('success','partial','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'success',
  `httpStatus` int DEFAULT NULL,
  `contentHash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `scrapedAt` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## workflow_checklist

```sql
CREATE TABLE `workflow_checklist` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `organizationId` int DEFAULT NULL,
  `workflowType` enum('professional_onboarding','client_onboarding','licensing','registration') NOT NULL,
  `steps` json NOT NULL,
  `currentStep` int DEFAULT '0',
  `status` enum('not_started','in_progress','completed','paused') DEFAULT 'not_started',
  `completedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `fk_1` (`userId`),
  KEY `fk_2` (`organizationId`),
  CONSTRAINT `fk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=210001;
```

## workflow_checkpoints

```sql
CREATE TABLE `workflow_checkpoints` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_id` int NOT NULL,
  `agent_run_id` int DEFAULT NULL,
  `step_index` int NOT NULL DEFAULT '0',
  `step_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` json DEFAULT NULL,
  `status` enum('saved','restored','compensating','compensated','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'saved',
  `compensation_action` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `retry_count` int NOT NULL DEFAULT '0',
  `max_retries` int NOT NULL DEFAULT '3',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## workflow_event_chains

```sql
CREATE TABLE `workflow_event_chains` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `event_type` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actions_json` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## workflow_execution_log

```sql
CREATE TABLE `workflow_execution_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `chain_id` int NOT NULL,
  `event_source` varchar(256) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `triggered_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `actions_executed` int DEFAULT '0',
  `actions_failed` int DEFAULT '0',
  `result_json` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('running','completed','failed','partial') COLLATE utf8mb4_unicode_ci DEFAULT 'running',
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

