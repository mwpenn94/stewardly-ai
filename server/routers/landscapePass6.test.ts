/**
 * Pass 6 Landscape Tests — Verify all new routers compile and export correctly
 */
import { describe, it, expect } from "vitest";

// ─── Import verification: all new routers must export properly ───
describe("Pass 6 Landscape — Router Exports", () => {
  it("financialInstrumentsRouter exports correctly", async () => {
    const mod = await import("./financialInstruments");
    expect(mod.financialInstrumentsRouter).toBeDefined();
    expect(mod.financialInstrumentsRouter._def).toBeDefined();
  });

  it("securityPrivacyRouter exports correctly", async () => {
    const mod = await import("./securityPrivacy");
    expect(mod.securityPrivacyRouter).toBeDefined();
    expect(mod.securityPrivacyRouter._def).toBeDefined();
  });

  it("aiAutonomyRouter exports correctly", async () => {
    const mod = await import("./aiAutonomy");
    expect(mod.aiAutonomyRouter).toBeDefined();
    expect(mod.aiAutonomyRouter._def).toBeDefined();
  });

  it("remainingOrphansRouter exports correctly", async () => {
    const mod = await import("./remainingOrphans");
    expect(mod.remainingOrphansRouter).toBeDefined();
    expect(mod.remainingOrphansRouter._def).toBeDefined();
  });

  it("complianceGovernanceRouter exports correctly", async () => {
    const mod = await import("./complianceGovernance");
    expect(mod.complianceGovernanceRouter).toBeDefined();
    expect(mod.complianceGovernanceRouter._def).toBeDefined();
  });

  it("knowledgeGraphRouter exports correctly", async () => {
    const mod = await import("./knowledgeGraph");
    expect(mod.knowledgeGraphRouter).toBeDefined();
    expect(mod.knowledgeGraphRouter._def).toBeDefined();
  });

  it("workflowAutomationRouter exports correctly", async () => {
    const mod = await import("./workflowAutomation");
    expect(mod.workflowAutomationRouter).toBeDefined();
    expect(mod.workflowAutomationRouter._def).toBeDefined();
  });

  it("enrichmentEngineRouter exports correctly", async () => {
    const mod = await import("./enrichmentEngine");
    expect(mod.enrichmentEngineRouter).toBeDefined();
    expect(mod.enrichmentEngineRouter._def).toBeDefined();
  });

  it("professionalPracticeRouter exports correctly", async () => {
    const mod = await import("./professionalPractice");
    expect(mod.professionalPracticeRouter).toBeDefined();
    expect(mod.professionalPracticeRouter._def).toBeDefined();
  });

  it("finalOrphansRouter exports correctly", async () => {
    const mod = await import("./finalOrphans");
    expect(mod.finalOrphansRouter).toBeDefined();
    expect(mod.finalOrphansRouter._def).toBeDefined();
  });
});

// ─── Sub-router structure verification ───────────────────────────
describe("Pass 6 Landscape — Sub-router Structure", () => {
  it("financialInstruments has all 8 sub-routers", async () => {
    const { financialInstrumentsRouter } = await import("./financialInstruments");
    const keys = Object.keys(financialInstrumentsRouter._def.record);
    expect(keys).toContain("equity");
    expect(keys).toContain("ltc");
    expect(keys).toContain("exitPlans");
    expect(keys).toContain("paperTrades");
    expect(keys).toContain("digitalAssets");
    expect(keys).toContain("healthScores");
    expect(keys).toContain("savedAnalyses");
    expect(keys).toContain("sharedLinks");
    expect(keys.length).toBe(8);
  });

  it("securityPrivacy has all 7 sub-routers", async () => {
    const { securityPrivacyRouter } = await import("./securityPrivacy");
    const keys = Object.keys(securityPrivacyRouter._def.record);
    expect(keys).toContain("keys");
    expect(keys).toContain("fieldsRegistry");
    expect(keys).toContain("policies");
    expect(keys).toContain("delegations");
    expect(keys).toContain("sharing");
    expect(keys).toContain("retentionPolicies");
    expect(keys).toContain("retentionLog");
    expect(keys.length).toBe(7);
  });

  it("aiAutonomy has all 6 sub-routers", async () => {
    const { aiAutonomyRouter } = await import("./aiAutonomy");
    const keys = Object.keys(aiAutonomyRouter._def.record);
    expect(keys).toContain("browserSessions");
    expect(keys).toContain("autonomyProfiles");
    expect(keys).toContain("signals");
    expect(keys).toContain("hypothesis");
    expect(keys).toContain("traces");
    expect(keys).toContain("escalation");
    expect(keys.length).toBe(6);
  });

  it("remainingOrphans has all 15 sub-routers", async () => {
    const { remainingOrphansRouter } = await import("./remainingOrphans");
    const keys = Object.keys(remainingOrphansRouter._def.record);
    expect(keys).toContain("reconciliation");
    expect(keys).toContain("marketSubs");
    expect(keys).toContain("marketEvents");
    expect(keys).toContain("regulatory");
    expect(keys).toContain("txCategories");
    expect(keys).toContain("eduProgress");
    expect(keys).toContain("eduTriggers");
    expect(keys).toContain("studyProgress");
    expect(keys).toContain("backtests");
    expect(keys).toContain("loadTests");
    expect(keys).toContain("leadSources");
    expect(keys).toContain("propensity");
    expect(keys).toContain("platformLearnings");
    expect(keys).toContain("healthChecks");
    expect(keys).toContain("carrierSubs");
    expect(keys.length).toBe(15);
  });

  it("complianceGovernance has all 6 sub-routers", async () => {
    const { complianceGovernanceRouter } = await import("./complianceGovernance");
    const keys = Object.keys(complianceGovernanceRouter._def.record);
    expect(keys).toContain("audit");
    expect(keys).toContain("privacy");
    expect(keys).toContain("violations");
    expect(keys).toContain("predictions");
    expect(keys).toContain("orgPrompts");
    expect(keys).toContain("aiBoundaries");
    expect(keys.length).toBe(6);
  });

  it("knowledgeGraph has 2 sub-routers", async () => {
    const { knowledgeGraphRouter } = await import("./knowledgeGraph");
    const keys = Object.keys(knowledgeGraphRouter._def.record);
    expect(keys).toContain("nodes");
    expect(keys).toContain("edges");
    expect(keys.length).toBe(2);
  });

  it("workflowAutomation has 3 sub-routers", async () => {
    const { workflowAutomationRouter } = await import("./workflowAutomation");
    const keys = Object.keys(workflowAutomationRouter._def.record);
    expect(keys).toContain("chains");
    expect(keys).toContain("executions");
    expect(keys).toContain("checkpoints");
    expect(keys.length).toBe(3);
  });

  it("enrichmentEngine has 3 sub-routers", async () => {
    const { enrichmentEngineRouter } = await import("./enrichmentEngine");
    const keys = Object.keys(enrichmentEngineRouter._def.record);
    expect(keys).toContain("datasets");
    expect(keys).toContain("cohorts");
    expect(keys).toContain("matches");
    expect(keys.length).toBe(3);
  });

  it("professionalPractice has 11 sub-routers", async () => {
    const { professionalPracticeRouter } = await import("./professionalPractice");
    const keys = Object.keys(professionalPracticeRouter._def.record);
    expect(keys.length).toBe(11);
  });

  it("finalOrphans has 13 sub-routers", async () => {
    const { finalOrphansRouter } = await import("./finalOrphans");
    const keys = Object.keys(finalOrphansRouter._def.record);
    expect(keys).toContain("syncConfig");
    expect(keys).toContain("plaidWebhooks");
    expect(keys).toContain("exportJobs");
    expect(keys).toContain("docTemplates");
    expect(keys).toContain("optimizationCycles");
    expect(keys).toContain("promptExperiments");
    expect(keys).toContain("modelSchedules");
    expect(keys).toContain("modelBacktests");
    expect(keys).toContain("documentVersions");
    expect(keys).toContain("documentAnnotations");
    expect(keys).toContain("aiToolExecutions");
    expect(keys).toContain("aiResponseQuality");
    expect(keys).toContain("aiConfigLayers");
    expect(keys.length).toBe(13);
  });
});

// ─── AppRouter integration verification ──────────────────────────
describe("Pass 6 Landscape — AppRouter Integration", () => {
  it("appRouter includes all new routers", async () => {
    const { appRouter } = await import("../routers");
    const keys = Object.keys(appRouter._def.record);
    expect(keys).toContain("financialInstruments");
    expect(keys).toContain("securityPrivacy");
    expect(keys).toContain("aiAutonomy");
    expect(keys).toContain("remainingOrphans");
    expect(keys).toContain("complianceGovernance");
    expect(keys).toContain("knowledgeGraph");
    expect(keys).toContain("workflowAutomation");
    expect(keys).toContain("enrichmentEngine");
    expect(keys).toContain("professionalPractice");
    expect(keys).toContain("finalOrphans");
  }, 15000);
});
