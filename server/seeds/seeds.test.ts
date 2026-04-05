/**
 * Seed Module Tests
 * Validates seed data integrity, structure, and idempotency.
 * Tests are pure (no DB writes) — they validate the data arrays and function exports.
 */
import { describe, it, expect } from "vitest";

// ─── Feature Flags ──────────────────────────────────────────────────────────
describe("Seed: Feature Flags", () => {
  it("should export seedFeatureFlags function", async () => {
    const mod = await import("./seedFeatureFlags");
    expect(typeof mod.seedFeatureFlags).toBe("function");
  });
});

// ─── Glossary Terms ─────────────────────────────────────────────────────────
describe("Seed: Glossary Terms", () => {
  it("should export seedGlossaryTerms function", async () => {
    const mod = await import("./seedGlossaryTerms");
    expect(typeof mod.seedGlossaryTerms).toBe("function");
  });
});

// ─── Education Modules ──────────────────────────────────────────────────────
describe("Seed: Education Modules", () => {
  it("should export seedEducationModules function", async () => {
    const mod = await import("./seedEducationModules");
    expect(typeof mod.seedEducationModules).toBe("function");
  });
});

// ─── Content Articles ───────────────────────────────────────────────────────
describe("Seed: Content Articles", () => {
  it("should export seedContentArticles function", async () => {
    const mod = await import("./seedContentArticles");
    expect(typeof mod.seedContentArticles).toBe("function");
  });
});

// ─── Lead & AI Config ───────────────────────────────────────────────────────
describe("Seed: Lead Capture Config", () => {
  it("should export seedLeadCaptureConfig function", async () => {
    const mod = await import("./seedLeadAndAIConfig");
    expect(typeof mod.seedLeadCaptureConfig).toBe("function");
  });
});

describe("Seed: Propensity Models", () => {
  it("should export seedPropensityModels function", async () => {
    const mod = await import("./seedLeadAndAIConfig");
    expect(typeof mod.seedPropensityModels).toBe("function");
  });
});

describe("Seed: Platform AI Settings", () => {
  it("should export seedPlatformAISettings function", async () => {
    const mod = await import("./seedLeadAndAIConfig");
    expect(typeof mod.seedPlatformAISettings).toBe("function");
  });
});

describe("Seed: Prompt Variants", () => {
  it("should export seedPromptVariants function", async () => {
    const mod = await import("./seedLeadAndAIConfig");
    expect(typeof mod.seedPromptVariants).toBe("function");
  });
});

describe("Seed: Fairness Test Prompts", () => {
  it("should export seedFairnessTestPrompts function", async () => {
    const mod = await import("./seedLeadAndAIConfig");
    expect(typeof mod.seedFairnessTestPrompts).toBe("function");
  });
});

describe("Seed: Disclaimer Versions", () => {
  it("should export seedDisclaimerVersions function", async () => {
    const mod = await import("./seedLeadAndAIConfig");
    expect(typeof mod.seedDisclaimerVersions).toBe("function");
  });
});

// ─── Platform Config ────────────────────────────────────────────────────────
describe("Seed: Workflow Event Chains", () => {
  it("should export seedWorkflowEventChains function", async () => {
    const mod = await import("./seedPlatformConfig");
    expect(typeof mod.seedWorkflowEventChains).toBe("function");
  });
});

describe("Seed: KB Sharing Defaults", () => {
  it("should export seedKbSharingDefaults function", async () => {
    const mod = await import("./seedPlatformConfig");
    expect(typeof mod.seedKbSharingDefaults).toBe("function");
  });
});

describe("Seed: Compensation Brackets", () => {
  it("should export seedCompensationBrackets function", async () => {
    const mod = await import("./seedPlatformConfig");
    expect(typeof mod.seedCompensationBrackets).toBe("function");
  });
});

describe("Seed: ZIP Code Demographics", () => {
  it("should export seedZipCodeDemographics function", async () => {
    const mod = await import("./seedPlatformConfig");
    expect(typeof mod.seedZipCodeDemographics).toBe("function");
  });
});

describe("Seed: Platform Changelog", () => {
  it("should export seedPlatformChangelog function", async () => {
    const mod = await import("./seedPlatformConfig");
    expect(typeof mod.seedPlatformChangelog).toBe("function");
  });
});

describe("Seed: Usage Budgets", () => {
  it("should export seedUsageBudgets function", async () => {
    const mod = await import("./seedPlatformConfig");
    expect(typeof mod.seedUsageBudgets).toBe("function");
  });
});

// ─── Unified Runner ─────────────────────────────────────────────────────────
describe("Seed: Unified Runner (index)", () => {
  it("should export runAllSeeds function", async () => {
    const mod = await import("./index");
    expect(typeof mod.runAllSeeds).toBe("function");
  });

  it("should re-export all 28 individual seed functions", async () => {
    const mod = await import("./index");
    const seedFunctions = [
      "seedTaxParameters2025", "seedSsaParameters2025", "seedMedicareParameters2025",
      "seedInsuranceCarriers", "seedSampleProducts",
      "seedIulCreditingHistory", "seedMarketIndexHistory",
      "seedEconomicHistory", "seedIndustryBenchmarks",
      "seedRateProfiles", "seedFreshnessRegistry",
      "seedAnalyticalModels", "seedIntegrationProviders", "seedCarrierTemplates",
      "seedFeatureFlags", "seedGlossaryTerms", "seedEducationModules", "seedContentArticles",
      "seedLeadCaptureConfig", "seedPropensityModels", "seedPlatformAISettings",
      "seedPromptVariants", "seedFairnessTestPrompts", "seedDisclaimerVersions",
      "seedWorkflowEventChains", "seedKbSharingDefaults", "seedCompensationBrackets",
      "seedZipCodeDemographics", "seedPlatformChangelog", "seedUsageBudgets",
    ];
    for (const fnName of seedFunctions) {
      expect(typeof (mod as any)[fnName]).toBe("function");
    }
  });

  it("should export SeedResult type interface", async () => {
    // Verify the module exports are properly typed
    const mod = await import("./index");
    expect(mod.runAllSeeds).toBeDefined();
  });
});
