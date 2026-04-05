/**
 * Unified Seed Runner
 * Imports and orchestrates all seed modules in dependency order.
 * Re-exports individual seed functions for selective seeding.
 */
import { logger } from "../_core/logger";

// ─── Existing service-level seeds ───────────────────────────────────────────
import { seedTaxParameters2025 } from "../services/taxParameters";
import { seedSsaParameters2025 } from "../services/ssaParameters";
import { seedMedicareParameters2025 } from "../services/medicareParameters";
import { seedInsuranceCarriers, seedSampleProducts } from "../services/insuranceData";
import { seedIulCreditingHistory, seedMarketIndexHistory } from "../services/iulMarketData";
import { seedEconomicHistory } from "../services/investmentIntelligence";
import { seedIndustryBenchmarks } from "../services/estatePlanningKnowledge";
import { seedRateProfiles, seedFreshnessRegistry } from "../services/foundationLayer";
import { seedAnalyticalModels } from "../services/modelEngine";
import { seedIntegrationProviders, seedCarrierTemplates } from "../services/seedIntegrations";

// ─── Numbered seed files (from GitHub) ──────────────────────────────────────
import { seed as seedRateLimitProfiles } from "./00-rateLimitProfiles";
import { seed as seedDataFreshnessRegistry } from "./01-dataFreshnessRegistry";
import { seed as seedTosClassifications } from "./02-tosClassifications";
import { seed as seedLeadSources } from "./13-leadSources";
import { seed as seedPropensityFeatures } from "./14-propensityFeatures";
import { seed as seedComplianceRules } from "./16-complianceRules";
import { seed as seedLeadCaptureConfigs } from "./17-leadCaptureConfigs";
import { seed as seedVerificationBadgeTypes } from "./19-verificationBadgeTypes";
import { seed as seedHolisticSummaryActions } from "./31-holisticSummaryActions";
import { seed as seedChannelPilotDefaults } from "./32-channelPilotDefaults";

// ─── New seed modules ───────────────────────────────────────────────────────
import { seedFeatureFlags } from "./seedFeatureFlags";
import { seedGlossaryTerms } from "./seedGlossaryTerms";
import { seedEducationModules } from "./seedEducationModules";
import { seedContentArticles } from "./seedContentArticles";
import {
  seedLeadCaptureConfig, seedPropensityModels,
  seedPlatformAISettings, seedPromptVariants,
  seedFairnessTestPrompts, seedDisclaimerVersions,
} from "./seedLeadAndAIConfig";
import {
  seedWorkflowEventChains, seedKbSharingDefaults,
  seedCompensationBrackets, seedZipCodeDemographics,
  seedPlatformChangelog, seedUsageBudgets,
} from "./seedPlatformConfig";

export interface SeedResult {
  module: string;
  recordsInserted: number;
  durationMs: number;
  error: string | null;
}

/**
 * Run all seeds in dependency order.
 * Phase 1: Core reference data (no dependencies)
 * Phase 2: Products & market data (depends on carriers)
 * Phase 3: Platform configuration
 * Phase 4: Content & education
 * Phase 5: Lead, AI, compliance
 */
export async function runAllSeeds(): Promise<{ results: SeedResult[]; totalRecords: number }> {
  const results: SeedResult[] = [];
  let totalRecords = 0;

  const phases = [
    // Phase 1: Core reference data
    [
      { name: "Tax Parameters 2025", fn: seedTaxParameters2025 },
      { name: "SSA Parameters 2025", fn: seedSsaParameters2025 },
      { name: "Medicare Parameters 2025", fn: seedMedicareParameters2025 },
      { name: "Insurance Carriers (Top 50)", fn: seedInsuranceCarriers },
      { name: "Rate Limit Profiles", fn: seedRateProfiles },
      { name: "Freshness Registry", fn: seedFreshnessRegistry },
    ],
    // Phase 2: Products & market data
    [
      { name: "Insurance Products (Sample)", fn: seedSampleProducts },
      { name: "Economic History (Shiller CAPE)", fn: seedEconomicHistory },
      { name: "Industry Benchmarks (LIMRA/LOMA)", fn: seedIndustryBenchmarks },
      { name: "IUL Crediting History", fn: seedIulCreditingHistory },
      { name: "Market Index History", fn: seedMarketIndexHistory },
      { name: "Analytical Models", fn: seedAnalyticalModels },
    ],
    // Phase 3: Platform configuration
    [
      { name: "Feature Flags", fn: seedFeatureFlags },
      { name: "Platform AI Settings", fn: seedPlatformAISettings },
      { name: "Usage Budgets", fn: seedUsageBudgets },
      { name: "Compensation Brackets", fn: seedCompensationBrackets },
      { name: "Platform Changelog", fn: seedPlatformChangelog },
      { name: "Workflow Event Chains", fn: seedWorkflowEventChains },
      { name: "Integration Providers", fn: seedIntegrationProviders },
      { name: "Carrier Import Templates", fn: seedCarrierTemplates },
    ],
    // Phase 4: Content & education
    [
      { name: "Glossary Terms", fn: seedGlossaryTerms },
      { name: "Education Modules", fn: seedEducationModules },
      { name: "Content Articles", fn: seedContentArticles },
      { name: "KB Sharing Defaults", fn: seedKbSharingDefaults },
      { name: "ZIP Code Demographics (AZ)", fn: seedZipCodeDemographics },
    ],
    // Phase 5: Lead, AI, compliance
    [
      { name: "Lead Capture Config", fn: seedLeadCaptureConfig },
      { name: "Propensity Models", fn: seedPropensityModels },
      { name: "Prompt Variants", fn: seedPromptVariants },
      { name: "Fairness Test Prompts", fn: seedFairnessTestPrompts },
      { name: "Disclaimer Versions", fn: seedDisclaimerVersions },
      { name: "Lead Sources", fn: seedLeadSources },
      { name: "Propensity Features", fn: seedPropensityFeatures },
      { name: "Compliance Rules", fn: seedComplianceRules },
      { name: "Lead Capture Configs (numbered)", fn: seedLeadCaptureConfigs },
      { name: "Verification Badge Types", fn: seedVerificationBadgeTypes },
    ],
    // Phase 6: Platform operations & advanced config
    [
      { name: "Rate Limit Profiles (numbered)", fn: seedRateLimitProfiles },
      { name: "Data Freshness Registry (numbered)", fn: seedDataFreshnessRegistry },
      { name: "TOS Classifications", fn: seedTosClassifications },
      { name: "Holistic Summary Actions", fn: seedHolisticSummaryActions },
      { name: "Channel Pilot Defaults", fn: seedChannelPilotDefaults },
    ],
  ];

  for (const phase of phases) {
    for (const { name, fn } of phase) {
      const start = Date.now();
      try {
        const count = await fn();
        const inserted = (typeof count === "number" && !isNaN(count)) ? count : 0;
        results.push({ module: name, recordsInserted: inserted, durationMs: Date.now() - start, error: null });
        totalRecords += inserted;
      } catch (e: any) {
        results.push({ module: name, recordsInserted: 0, durationMs: Date.now() - start, error: e?.message ?? "Unknown error" });
        logger.error({ operation: "runAllSeeds", module: name, err: e }, `[Seed] ${name} failed: ${e?.message}`);
      }
    }
  }

  logger.info({ operation: "runAllSeeds" }, `[Seed] Complete: ${totalRecords} records across ${results.length} modules`);
  return { results, totalRecords };
}

// Re-export all individual seed functions
export {
  // Service-level seeds
  seedTaxParameters2025, seedSsaParameters2025, seedMedicareParameters2025,
  seedInsuranceCarriers, seedSampleProducts,
  seedIulCreditingHistory, seedMarketIndexHistory,
  seedEconomicHistory, seedIndustryBenchmarks,
  seedRateProfiles, seedFreshnessRegistry,
  seedAnalyticalModels, seedIntegrationProviders, seedCarrierTemplates,
  // New seed modules
  seedFeatureFlags, seedGlossaryTerms, seedEducationModules, seedContentArticles,
  seedLeadCaptureConfig, seedPropensityModels, seedPlatformAISettings,
  seedPromptVariants, seedFairnessTestPrompts, seedDisclaimerVersions,
  seedWorkflowEventChains, seedKbSharingDefaults, seedCompensationBrackets,
  seedZipCodeDemographics, seedPlatformChangelog, seedUsageBudgets,
  // Numbered seed files
  seedRateLimitProfiles, seedDataFreshnessRegistry, seedTosClassifications,
  seedLeadSources, seedPropensityFeatures, seedComplianceRules,
  seedLeadCaptureConfigs, seedVerificationBadgeTypes,
  seedHolisticSummaryActions, seedChannelPilotDefaults,
};
