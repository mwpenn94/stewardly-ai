-- Unified Hierarchical Planning Architecture Migration
-- Pass 114: Aligns client planning with practice management in a single
-- forward/backward, roll-up/roll-down hierarchy with rich reasoning & references.

CREATE TABLE IF NOT EXISTS `planning_nodes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `parent_id` int,
  `level` enum('platform','region','team','advisor','client','goal','strategy','implementation') NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` int NOT NULL,
  `owner_id` int NOT NULL,
  `label` varchar(500),
  `forward_target` decimal(14,2),
  `forward_target_date` date,
  `forward_milestones` json,
  `forward_assumptions` json,
  `backward_required_input` decimal(14,2),
  `backward_required_date` date,
  `backward_steps` json,
  `current_value` decimal(14,2),
  `gap_value` decimal(14,2),
  `gap_percentage` decimal(6,2),
  `node_trend` enum('improving','stable','declining') DEFAULT 'stable',
  `probability_of_success` decimal(5,2),
  `reasoning_chain` json,
  `alternatives_considered` json,
  `suitability_score` decimal(5,2),
  `compliance_flags` json,
  `last_review_date` date,
  `next_review_date` date,
  `node_status` enum('draft','active','review','archived') DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `planning_nodes_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_planning_nodes_parent` ON `planning_nodes` (`parent_id`);
CREATE INDEX `idx_planning_nodes_owner` ON `planning_nodes` (`owner_id`);
CREATE INDEX `idx_planning_nodes_level` ON `planning_nodes` (`level`);
CREATE INDEX `idx_planning_nodes_entity` ON `planning_nodes` (`entity_type`, `entity_id`);

CREATE TABLE IF NOT EXISTS `client_goals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `client_id` int NOT NULL,
  `advisor_id` int,
  `planning_node_id` int,
  `goal_category` enum('protection','retirement','estate','tax','education','debt','growth','business','cash_flow','premium_finance','ilit','exec_comp','charitable','legacy','healthcare') NOT NULL,
  `goal_name` varchar(255) NOT NULL,
  `goal_description` text,
  `target_amount` decimal(14,2),
  `current_amount` decimal(14,2),
  `target_date` date,
  `time_horizon_years` int,
  `priority_rank` int,
  `probability_of_success` decimal(5,2),
  `confidence_interval_low` decimal(14,2),
  `confidence_interval_high` decimal(14,2),
  `depends_on_goals` json,
  `conflicts_with_goals` json,
  `goal_status` enum('identified','agreed','in_progress','on_track','at_risk','achieved','deferred','abandoned') DEFAULT 'identified',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `client_goals_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_client_goals_client` ON `client_goals` (`client_id`);
CREATE INDEX `idx_client_goals_advisor` ON `client_goals` (`advisor_id`);
CREATE INDEX `idx_client_goals_node` ON `client_goals` (`planning_node_id`);
CREATE INDEX `idx_client_goals_category` ON `client_goals` (`goal_category`);

CREATE TABLE IF NOT EXISTS `planning_references` (
  `id` int AUTO_INCREMENT NOT NULL,
  `planning_node_id` int NOT NULL,
  `ref_type` enum('regulatory','academic','carrier','market_data','case_law','internal','illustration','fact_sheet') NOT NULL,
  `title` varchar(500) NOT NULL,
  `citation` text,
  `url` varchar(2000),
  `relevance` text,
  `date_accessed` date,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `planning_references_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_planning_refs_node` ON `planning_references` (`planning_node_id`);
CREATE INDEX `idx_planning_refs_type` ON `planning_references` (`ref_type`);

CREATE TABLE IF NOT EXISTS `personal_financial_reviews` (
  `id` int AUTO_INCREMENT NOT NULL,
  `client_id` int NOT NULL,
  `advisor_id` int NOT NULL,
  `planning_node_id` int,
  `review_type` enum('initial','annual','life_event','regulatory','ad_hoc') NOT NULL,
  `review_date` date NOT NULL,
  `document_url` varchar(2000),
  `document_key` varchar(500),
  `sections_included` json,
  `calculator_outputs_snapshot` json,
  `goal_hierarchy_snapshot` json,
  `recommendations_snapshot` json,
  `advisor_approved_at` timestamp,
  `client_acknowledged_at` timestamp,
  `e_signature_id` int,
  `suitability_documentation` json,
  `compliance_review_status` enum('pending','approved','flagged','escalated') DEFAULT 'pending',
  `compliance_reviewer_id` int,
  `compliance_review_date` timestamp,
  `retention_expires_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `personal_financial_reviews_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_pfr_client` ON `personal_financial_reviews` (`client_id`);
CREATE INDEX `idx_pfr_advisor` ON `personal_financial_reviews` (`advisor_id`);
CREATE INDEX `idx_pfr_review_type` ON `personal_financial_reviews` (`review_type`);

CREATE TABLE IF NOT EXISTS `client_discovery` (
  `id` int AUTO_INCREMENT NOT NULL,
  `client_id` int NOT NULL,
  `advisor_id` int,
  `values_priorities` json,
  `risk_attitudes` json,
  `family_dynamics` json,
  `health_status` json,
  `employer_benefits` json,
  `existing_documents` json,
  `anticipated_life_events` json,
  `preferred_contact_method` varchar(50),
  `preferred_meeting_frequency` varchar(50),
  `preferred_report_detail_level` enum('summary','standard','detailed') DEFAULT 'standard',
  `completeness_score` decimal(5,2),
  `last_discovery_date` date,
  `next_discovery_date` date,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `client_discovery_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_client_discovery_client` ON `client_discovery` (`client_id`);
CREATE INDEX `idx_client_discovery_advisor` ON `client_discovery` (`advisor_id`);

CREATE TABLE IF NOT EXISTS `planning_assumptions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `owner_id` int NOT NULL,
  `assumption_scope` enum('platform','firm','advisor','client') DEFAULT 'advisor',
  `scope_entity_id` int,
  `inflation_rate` decimal(5,4),
  `equity_return` decimal(5,4),
  `bond_return` decimal(5,4),
  `risk_free_rate` decimal(5,4),
  `tax_bracket_federal` decimal(5,4),
  `tax_bracket_state` decimal(5,4),
  `capital_gains_rate` decimal(5,4),
  `estate_exemption` decimal(14,2),
  `sofr_rate` decimal(5,4),
  `mortality_table` varchar(100),
  `custom_assumptions` json,
  `assumption_source` enum('manual','fred_api','market_data','firm_default') DEFAULT 'manual',
  `effective_date` date,
  `expires_date` date,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `planning_assumptions_id` PRIMARY KEY(`id`)
);

CREATE INDEX `idx_planning_assumptions_owner` ON `planning_assumptions` (`owner_id`);
CREATE INDEX `idx_planning_assumptions_scope` ON `planning_assumptions` (`assumption_scope`, `scope_entity_id`);
