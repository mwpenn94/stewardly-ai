-- Phase 4: Advanced Workflows Migration
-- Policy Deliveries, 1035 Exchange Analyses, Beneficiary Reviews, Tax Return Reviews, Benchmark Comparisons

CREATE TABLE IF NOT EXISTS `policy_deliveries` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `applicationId` int NOT NULL,
  `clientId` int NOT NULL,
  `advisorId` int NOT NULL,
  `policyNumber` varchar(255) NOT NULL,
  `carrierName` varchar(255) NOT NULL,
  `productType` varchar(100) NOT NULL,
  `faceAmount` bigint,
  `annualPremium` bigint,
  `deliveryMethod` enum('in_person','mail','electronic','video_call') DEFAULT 'in_person',
  `deliveredAt` bigint,
  `clientAcknowledgedAt` bigint,
  `freeLookStartDate` bigint,
  `freeLookEndDate` bigint,
  `freeLookDays` int DEFAULT 10,
  `freeLookStatus` enum('not_started','active','expired','exercised') DEFAULT 'not_started',
  `freeLookExercisedAt` bigint,
  `deliveryReceiptUrl` text,
  `clientSignatureUrl` text,
  `notesJson` json,
  `status` enum('pending_delivery','delivered','acknowledged','free_look_active','placed','returned') DEFAULT 'pending_delivery',
  `planningNodeId` int,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL
);

CREATE INDEX `idx_policy_deliveries_client` ON `policy_deliveries` (`clientId`);
CREATE INDEX `idx_policy_deliveries_advisor` ON `policy_deliveries` (`advisorId`);
CREATE INDEX `idx_policy_deliveries_application` ON `policy_deliveries` (`applicationId`);
CREATE INDEX `idx_policy_deliveries_status` ON `policy_deliveries` (`status`);
CREATE INDEX `idx_policy_deliveries_free_look` ON `policy_deliveries` (`freeLookStatus`, `freeLookEndDate`);

CREATE TABLE IF NOT EXISTS `exchange_analyses` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `clientId` int NOT NULL,
  `advisorId` int NOT NULL,
  `existingPolicyNumber` varchar(255),
  `existingCarrier` varchar(255),
  `existingProductType` varchar(100),
  `existingCashValue` bigint,
  `existingSurrenderValue` bigint,
  `existingSurrenderCharge` bigint,
  `existingDeathBenefit` bigint,
  `existingAnnualPremium` bigint,
  `existingLoanBalance` bigint,
  `existingCostBasis` bigint,
  `existingFeaturesJson` json,
  `proposedCarrier` varchar(255),
  `proposedProductType` varchar(100),
  `proposedDeathBenefit` bigint,
  `proposedAnnualPremium` bigint,
  `proposedFeaturesJson` json,
  `proposedIllustrationUrl` text,
  `comparisonJson` json,
  `taxImplicationsJson` json,
  `surrenderChargeAnalysis` text,
  `suitabilityRationale` text,
  `replacementFormRequired` boolean DEFAULT true,
  `stateReplacementRules` text,
  `naicComplianceJson` json,
  `recommendationSummary` text,
  `recommendationAction` enum('exchange','keep_existing','supplement','needs_further_review'),
  `status` enum('draft','analysis_complete','client_reviewed','approved','submitted','completed','cancelled') DEFAULT 'draft',
  `planningNodeId` int,
  `goalId` int,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL
);

CREATE INDEX `idx_exchange_analyses_client` ON `exchange_analyses` (`clientId`);
CREATE INDEX `idx_exchange_analyses_advisor` ON `exchange_analyses` (`advisorId`);
CREATE INDEX `idx_exchange_analyses_status` ON `exchange_analyses` (`status`);

CREATE TABLE IF NOT EXISTS `beneficiary_reviews` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `clientId` int NOT NULL,
  `advisorId` int NOT NULL,
  `policyOrAccountRef` varchar(255) NOT NULL,
  `accountType` enum('life_insurance','annuity','ira','401k','roth_ira','brokerage','trust','bank','other') NOT NULL,
  `carrierOrCustodian` varchar(255),
  `currentBeneficiariesJson` json,
  `proposedBeneficiariesJson` json,
  `reviewTrigger` enum('annual_review','life_event','estate_plan_change','divorce','death','new_policy','client_request','regulatory') DEFAULT 'annual_review',
  `lifeEventDescription` text,
  `estateAlignmentNotes` text,
  `taxImplicationsNotes` text,
  `perStirpesVsPerCapita` enum('per_stirpes','per_capita','not_applicable') DEFAULT 'not_applicable',
  `contingentBeneficiarySet` boolean DEFAULT false,
  `minorBeneficiaryProtection` text,
  `changeRequired` boolean DEFAULT false,
  `changeFormUrl` text,
  `changeSubmittedAt` bigint,
  `changeConfirmedAt` bigint,
  `status` enum('pending_review','reviewed','changes_needed','changes_submitted','confirmed','no_changes_needed') DEFAULT 'pending_review',
  `nextReviewDate` bigint,
  `planningNodeId` int,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL
);

CREATE INDEX `idx_beneficiary_reviews_client` ON `beneficiary_reviews` (`clientId`);
CREATE INDEX `idx_beneficiary_reviews_advisor` ON `beneficiary_reviews` (`advisorId`);
CREATE INDEX `idx_beneficiary_reviews_status` ON `beneficiary_reviews` (`status`);
CREATE INDEX `idx_beneficiary_reviews_next_review` ON `beneficiary_reviews` (`nextReviewDate`);

CREATE TABLE IF NOT EXISTS `tax_return_reviews` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `clientId` int NOT NULL,
  `advisorId` int NOT NULL,
  `taxYear` int NOT NULL,
  `filingStatus` enum('single','married_filing_jointly','married_filing_separately','head_of_household','qualifying_widow'),
  `adjustedGrossIncome` bigint,
  `taxableIncome` bigint,
  `totalTaxLiability` bigint,
  `effectiveTaxRate` varchar(20),
  `marginalBracket` varchar(20),
  `capitalGainsShortTerm` bigint,
  `capitalGainsLongTerm` bigint,
  `dividendIncome` bigint,
  `interestIncome` bigint,
  `businessIncome` bigint,
  `rentalIncome` bigint,
  `retirementDistributions` bigint,
  `charitableDeductions` bigint,
  `mortgageInterest` bigint,
  `saltDeductions` bigint,
  `itemizedVsStandard` enum('itemized','standard'),
  `findingsJson` json,
  `opportunitiesJson` json,
  `riskFlagsJson` json,
  `planningRecommendations` text,
  `documentUrl` text,
  `status` enum('pending_upload','uploaded','under_review','reviewed','action_items_created','completed') DEFAULT 'pending_upload',
  `reviewedAt` bigint,
  `planningNodeId` int,
  `goalId` int,
  `createdAt` bigint NOT NULL,
  `updatedAt` bigint NOT NULL
);

CREATE INDEX `idx_tax_return_reviews_client` ON `tax_return_reviews` (`clientId`);
CREATE INDEX `idx_tax_return_reviews_advisor` ON `tax_return_reviews` (`advisorId`);
CREATE INDEX `idx_tax_return_reviews_year` ON `tax_return_reviews` (`taxYear`);
CREATE INDEX `idx_tax_return_reviews_status` ON `tax_return_reviews` (`status`);

CREATE TABLE IF NOT EXISTS `benchmark_comparisons` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `clientId` int NOT NULL,
  `advisorId` int NOT NULL,
  `comparisonType` enum('retirement_readiness','savings_rate','debt_ratio','insurance_coverage','estate_planning','tax_efficiency','investment_returns','overall') NOT NULL,
  `clientValue` varchar(100),
  `peerMedian` varchar(100),
  `peerP25` varchar(100),
  `peerP75` varchar(100),
  `percentileRank` int,
  `peerGroupCriteria` json,
  `peerGroupSize` int,
  `dataSourceJson` json,
  `insightsJson` json,
  `planningNodeId` int,
  `goalId` int,
  `snapshotDate` bigint NOT NULL,
  `createdAt` bigint NOT NULL
);

CREATE INDEX `idx_benchmark_comparisons_client` ON `benchmark_comparisons` (`clientId`);
CREATE INDEX `idx_benchmark_comparisons_type` ON `benchmark_comparisons` (`comparisonType`);
CREATE INDEX `idx_benchmark_comparisons_snapshot` ON `benchmark_comparisons` (`snapshotDate`);
