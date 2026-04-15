/**
 * Pass 7 Depth Tests — Critical Business Router Verification
 *
 * Tests structural integrity, export correctness, sub-router composition,
 * and procedure type safety for the 8 highest-value untested routers.
 */
import { describe, it, expect } from "vitest";

// ─── wealthEngine (48 procedures, 1358 lines) ───────────────────
describe("wealthEngine Router — Structural Integrity", () => {
  it("exports wealthEngineRouter", async () => {
    const mod = await import("./wealthEngine");
    expect(mod.wealthEngineRouter).toBeDefined();
    expect(mod.wealthEngineRouter._def).toBeDefined();
  });

  it("has all UWE procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("simulate");
    expect(keys).toContain("monteCarloSim");
    expect(keys).toContain("buildStrategy");
    expect(keys).toContain("autoSelectProducts");
    expect(keys).toContain("generateBestOverall");
    expect(keys).toContain("estimatePremium");
  });

  it("has all BIE procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("projectBizIncome");
    expect(keys).toContain("createBizStrategy");
    expect(keys).toContain("backPlanBizIncome");
    expect(keys).toContain("rollUpTeam");
    expect(keys).toContain("rollDownOrg");
    expect(keys).toContain("calcBizEconomics");
  });

  it("has all Holistic Engine procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("holisticSimulate");
    expect(keys).toContain("holisticCompare");
    expect(keys).toContain("findWinners");
    expect(keys).toContain("backPlanHolistic");
  });

  it("has risk analysis procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("historicalBacktest");
    expect(keys).toContain("stressTest");
    expect(keys).toContain("batchStressTest");
    expect(keys).toContain("stressScenarios");
    expect(keys).toContain("sensitivitySweep");
  });

  it("has guardrail procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("getGuardrails");
    expect(keys).toContain("checkGuardrail");
    expect(keys).toContain("checkGuardrails");
  });

  it("has reference data procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("productReferences");
    expect(keys).toContain("industryBenchmarks");
    expect(keys).toContain("sp500History");
    expect(keys).toContain("methodology");
  });

  it("has collaboration procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("createShareLink");
    expect(keys).toContain("resolveShareLink");
    expect(keys).toContain("generateReport");
    expect(keys).toContain("generateAudioNarration");
  });

  it("has AI/chat procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("chatExtractIntent");
    expect(keys).toContain("consensusStream");
    expect(keys).toContain("chatDispatch");
  });

  it("has weight preset CRUD", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys).toContain("listWeightPresets");
    expect(keys).toContain("createWeightPreset");
    expect(keys).toContain("updateWeightPreset");
    expect(keys).toContain("deleteWeightPreset");
  });

  it("has at least 40 procedures", async () => {
    const { wealthEngineRouter } = await import("./wealthEngine");
    const keys = Object.keys(wealthEngineRouter._def.record);
    expect(keys.length).toBeGreaterThanOrEqual(40);
  });
});

// ─── agenticExecution (9 sub-routers, 786 lines) ────────────────
describe("agenticExecution Router — Structural Integrity", () => {
  it("exports agenticRouter", async () => {
    const mod = await import("./agenticExecution");
    expect(mod.agenticRouter).toBeDefined();
    expect(mod.agenticRouter._def).toBeDefined();
  });

  it("has all 9 sub-routers", async () => {
    const { agenticRouter } = await import("./agenticExecution");
    const keys = Object.keys(agenticRouter._def.record);
    expect(keys).toContain("gate");
    expect(keys).toContain("agent");
    expect(keys).toContain("quote");
    expect(keys).toContain("application");
    expect(keys).toContain("advisory");
    expect(keys).toContain("estateDocs");
    expect(keys).toContain("premiumFinance");
    expect(keys).toContain("carrier");
    expect(keys).toContain("performance");
    expect(keys.length).toBe(9);
  });

  it("gate sub-router is defined", async () => {
    const { agenticRouter } = await import("./agenticExecution");
    expect(agenticRouter._def.record.gate).toBeDefined();
  });

  it("agent sub-router is defined", async () => {
    const { agenticRouter } = await import("./agenticExecution");
    expect(agenticRouter._def.record.agent).toBeDefined();
  });

  it("performance sub-router is defined", async () => {
    const { agenticRouter } = await import("./agenticExecution");
    expect(agenticRouter._def.record.performance).toBeDefined();
  });
});

// ─── calculatorEngine (16 procedures, 415 lines) ────────────────
describe("calculatorEngine Router — Structural Integrity", () => {
  it("exports calculatorEngineRouter", async () => {
    const mod = await import("./calculatorEngine");
    expect(mod.calculatorEngineRouter).toBeDefined();
    expect(mod.calculatorEngineRouter._def).toBeDefined();
  });

  it("has all UWE calculator procedures", async () => {
    const { calculatorEngineRouter } = await import("./calculatorEngine");
    const keys = Object.keys(calculatorEngineRouter._def.record);
    expect(keys).toContain("uweBuildStrategy");
    expect(keys).toContain("uweSimulate");
    expect(keys).toContain("uweMonteCarlo");
  });

  it("has all BIE calculator procedures", async () => {
    const { calculatorEngineRouter } = await import("./calculatorEngine");
    const keys = Object.keys(calculatorEngineRouter._def.record);
    expect(keys).toContain("bieSimulate");
    expect(keys).toContain("bieBackPlan");
    expect(keys).toContain("bieRollUp");
    expect(keys).toContain("bieRollDown");
    expect(keys).toContain("bieEconomics");
  });

  it("has all HE calculator procedures", async () => {
    const { calculatorEngineRouter } = await import("./calculatorEngine");
    const keys = Object.keys(calculatorEngineRouter._def.record);
    expect(keys).toContain("heSimulate");
    expect(keys).toContain("heCompare");
    expect(keys).toContain("heMilestones");
    expect(keys).toContain("heChartSeries");
    expect(keys).toContain("heBackPlan");
  });

  it("has risk analysis procedures", async () => {
    const { calculatorEngineRouter } = await import("./calculatorEngine");
    const keys = Object.keys(calculatorEngineRouter._def.record);
    expect(keys).toContain("historicalBacktest");
    expect(keys).toContain("stressTest");
    expect(keys).toContain("batchStressTest");
  });

  it("has at least 16 procedures", async () => {
    const { calculatorEngineRouter } = await import("./calculatorEngine");
    const keys = Object.keys(calculatorEngineRouter._def.record);
    expect(keys.length).toBeGreaterThanOrEqual(16);
  });
});

// ─── financialProfile (4 procedures, 162 lines) ─────────────────
describe("financialProfile Router — Structural Integrity", () => {
  it("exports financialProfileRouter", async () => {
    const mod = await import("./financialProfile");
    expect(mod.financialProfileRouter).toBeDefined();
    expect(mod.financialProfileRouter._def).toBeDefined();
  });

  it("has CRUD procedures", async () => {
    const { financialProfileRouter } = await import("./financialProfile");
    const keys = Object.keys(financialProfileRouter._def.record);
    expect(keys).toContain("get");
    expect(keys).toContain("set");
    expect(keys).toContain("replace");
    expect(keys).toContain("delete");
    expect(keys).toContain("suggest");
    expect(keys.length).toBe(5);
  });
});

// ─── portfolioLedger (7 procedures, 218 lines) ──────────────────
describe("portfolioLedger Router — Structural Integrity", () => {
  it("exports portfolioLedgerRouter", async () => {
    const mod = await import("./portfolioLedger");
    expect(mod.portfolioLedgerRouter).toBeDefined();
    expect(mod.portfolioLedgerRouter._def).toBeDefined();
  });

  it("has all portfolio procedures", async () => {
    const { portfolioLedgerRouter } = await import("./portfolioLedger");
    const keys = Object.keys(portfolioLedgerRouter._def.record);
    expect(keys).toContain("run");
    expect(keys).toContain("valueWithPrices");
    expect(keys).toContain("lossHarvest");
    expect(keys).toContain("detectWashSales");
    expect(keys).toContain("canHarvest");
    expect(keys).toContain("trackShorts");
    expect(keys).toContain("valueShorts");
    expect(keys.length).toBe(7);
  });
});

// ─── tax (7 procedures, 131 lines) ──────────────────────────────
describe("tax Router — Structural Integrity", () => {
  it("exports taxRouter", async () => {
    const mod = await import("./tax");
    expect(mod.taxRouter).toBeDefined();
    expect(mod.taxRouter._def).toBeDefined();
  });

  it("has all tax procedures", async () => {
    const { taxRouter } = await import("./tax");
    const keys = Object.keys(taxRouter._def.record);
    expect(keys).toContain("projectYear");
    expect(keys).toContain("projectYears");
    expect(keys).toContain("rothLadder");
    expect(keys).toContain("rmd");
    expect(keys).toContain("irmaa");
    expect(keys).toContain("projectStateTax");
    expect(keys).toContain("supportedStates");
    expect(keys.length).toBe(7);
  });
});

// ─── rebalancing (3 procedures, 102 lines) ──────────────────────
describe("rebalancing Router — Structural Integrity", () => {
  it("exports rebalancingRouter", async () => {
    const mod = await import("./rebalancing");
    expect(mod.rebalancingRouter).toBeDefined();
    expect(mod.rebalancingRouter._def).toBeDefined();
  });

  it("has all rebalancing procedures", async () => {
    const { rebalancingRouter } = await import("./rebalancing");
    const keys = Object.keys(rebalancingRouter._def.record);
    expect(keys).toContain("simulate");
    expect(keys).toContain("simulateNewCash");
    expect(keys).toContain("validateTargets");
    expect(keys.length).toBe(3);
  });
});

// ─── estate (1 procedure, 41 lines) ─────────────────────────────
describe("estate Router — Structural Integrity", () => {
  it("exports estateRouter", async () => {
    const mod = await import("./estate");
    expect(mod.estateRouter).toBeDefined();
    expect(mod.estateRouter._def).toBeDefined();
  });

  it("has parseDocumentOffline procedure", async () => {
    const { estateRouter } = await import("./estate");
    const keys = Object.keys(estateRouter._def.record);
    expect(keys).toContain("parseDocumentOffline");
  });
});

// ─── Cross-cutting: All critical routers registered in appRouter ─
describe("Critical Routers — AppRouter Registration", () => {
  it("appRouter includes all 8 critical routers", async () => {
    const { appRouter } = await import("../routers");
    const keys = Object.keys(appRouter._def.record);
    expect(keys).toContain("wealthEngine");
    expect(keys).toContain("agentic");
    expect(keys).toContain("calculatorEngine");
    expect(keys).toContain("financialProfile");
    expect(keys).toContain("portfolioLedger");
    expect(keys).toContain("tax");
    expect(keys).toContain("rebalancing");
    expect(keys).toContain("estate");
  }, 15000);
});
