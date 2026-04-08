/**
 * Phase 2 integration smoke tests — exercise the orchestrator and the
 * wealth-engine tool dispatch end-to-end without touching the DB.
 *
 * Why these tests exist:
 *  - The orchestrator chains UWE/BIE/HE and relies on the singleton
 *    strategy registry in he.ts. Any regression there (stale registry,
 *    null propagation, type mismatch) would silently break the ReAct
 *    agent path. These tests lock that down.
 *  - The ReAct tool dispatch in aiToolCalling.ts uses dynamic imports
 *    — we verify every `we_*` tool returns valid JSON so the agent can
 *    parse the output.
 */

import { describe, it, expect } from "vitest";
import {
  generateCompletePlan,
  detectOpportunities,
  recalibrateDefaults,
  loadClientProfile,
  dryRunWealthStrategy,
  backPlanForRole,
} from "./calculatorOrchestrator";
import { executeAITool, WEALTH_ENGINE_TOOLS } from "../../aiToolCalling";

describe("Phase 2 — calculator orchestrator", () => {
  describe("loadClientProfile (stub)", () => {
    it("returns a deterministic profile for a given id", async () => {
      const c = await loadClientProfile("client-123");
      expect(c.clientId).toBe("client-123");
      expect(c.profile.age).toBe(40);
      expect(c.planningHorizon).toBe(30);
      expect(c.hasBizIncome).toBe(false);
    });
  });

  describe("generateCompletePlan", () => {
    it("chains HE simulate + Monte Carlo + compare into a single plan", async () => {
      const plan = await generateCompletePlan("client-123", "user_requested");
      expect(plan.clientId).toBe("client-123");
      expect(plan.projection.snapshots.length).toBe(30);
      expect(plan.monteCarlo.bands.length).toBeGreaterThan(0);
      expect(plan.strategies.compareRows.length).toBe(4); // wb + doNothing + diy + ria
      expect(plan.strategies.winners.totalValue).toBeDefined();
    });

    it("WB plan wins totalValue against peer set", async () => {
      const plan = await generateCompletePlan("client-456", "new_client_onboarding");
      expect(plan.strategies.winners.totalValue?.name).toBe("WealthBridge Plan");
    });
  });

  describe("detectOpportunities", () => {
    it("scans multiple clients and returns a list", async () => {
      const opps = await detectOpportunities(async () => [
        "a",
        "b",
        "c",
      ]);
      expect(Array.isArray(opps)).toBe(true);
      // Every opportunity carries a narrative and metrics object
      opps.forEach((o) => {
        expect(o.clientId).toBeTruthy();
        expect(o.narrative).toBeTruthy();
        expect(o.metrics).toBeDefined();
      });
    });

    it("returns empty for zero clients", async () => {
      const opps = await detectOpportunities(async () => []);
      expect(opps.length).toBe(0);
    });
  });

  describe("recalibrateDefaults", () => {
    it("returns a stub result that the improvement loop can consume", async () => {
      const r = await recalibrateDefaults();
      expect(r.calibratedAt).toBeInstanceOf(Date);
      expect(r.proposedAdjustments).toEqual([]);
    });
  });

  describe("helpers", () => {
    it("dryRunWealthStrategy returns 30 snapshots by default", () => {
      const r = dryRunWealthStrategy("wealthbridge", { age: 40, income: 120000 });
      expect(r.length).toBe(30);
    });

    it("backPlanForRole returns a funnel with daily cadence", () => {
      const p = backPlanForRole(120000, "exp");
      expect(p.funnel.daily.approaches).toBeGreaterThan(0);
    });
  });
});

describe("Phase 2 — ReAct wealth-engine tool dispatch", () => {
  it("WEALTH_ENGINE_TOOLS exposes exactly 6 tools", () => {
    expect(WEALTH_ENGINE_TOOLS.length).toBe(6);
  });

  it("every tool definition carries a name, description, parameters", () => {
    WEALTH_ENGINE_TOOLS.forEach((t) => {
      expect(t.type).toBe("function");
      const fn = (t as { function: { name: string; description: string; parameters: unknown } }).function;
      expect(fn.name).toMatch(/^we_/);
      expect(fn.description.length).toBeGreaterThan(10);
      expect(fn.parameters).toBeDefined();
    });
  });

  describe("dispatch", () => {
    it("we_holistic_simulate returns valid JSON with a final snapshot", async () => {
      const out = await executeAITool("we_holistic_simulate", {
        preset: "wealthbridgeClient",
        age: 40,
        income: 120000,
        netWorth: 350000,
        savings: 180000,
        dependents: 2,
      });
      const parsed = JSON.parse(out);
      expect(parsed.preset).toBe("wealthbridgeClient");
      expect(parsed.snapshots.length).toBeGreaterThan(0);
      expect(parsed.final.totalValue).toBeGreaterThan(0);
    });

    it("we_compare_strategies returns rows + winners", async () => {
      const out = await executeAITool("we_compare_strategies", {
        presets: ["wealthbridgeClient", "doNothing"],
        age: 40,
        income: 120000,
        years: 20,
      });
      const parsed = JSON.parse(out);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.winners.totalValue).toBeDefined();
    });

    it("we_compare_strategies errors if < 2 presets", async () => {
      const out = await executeAITool("we_compare_strategies", {
        presets: ["wealthbridgeClient"],
      });
      const parsed = JSON.parse(out);
      expect(parsed.error).toBeTruthy();
    });

    it("we_project_biz_income returns year-over-year summary", async () => {
      const out = await executeAITool("we_project_biz_income", {
        role: "exp",
        years: 5,
      });
      const parsed = JSON.parse(out);
      expect(parsed.summary.length).toBe(5);
      expect(parsed.final.totalIncome).toBeGreaterThan(0);
    });

    it("we_backplan_income returns a funnel", async () => {
      const out = await executeAITool("we_backplan_income", {
        targetIncome: 150000,
        role: "dir",
      });
      const parsed = JSON.parse(out);
      expect(parsed.funnel.daily.approaches).toBeGreaterThan(0);
      expect(parsed.neededGDC).toBeGreaterThan(0);
    });

    it("we_monte_carlo returns tail percentiles + final band", async () => {
      const out = await executeAITool("we_monte_carlo", {
        investReturn: 0.07,
        volatility: 0.15,
        years: 10,
        trials: 50,
      });
      const parsed = JSON.parse(out);
      expect(parsed.tailPercentiles.length).toBe(5);
      expect(parsed.final.p10).toBeLessThanOrEqual(parsed.final.p50);
      expect(parsed.final.p50).toBeLessThanOrEqual(parsed.final.p90);
    });

    it("we_detect_opportunities returns opportunity list for a client", async () => {
      const out = await executeAITool("we_detect_opportunities", {
        clientId: "test-opportunity-client",
      });
      const parsed = JSON.parse(out);
      expect(parsed.clientId).toBe("test-opportunity-client");
      expect(Array.isArray(parsed.opportunities)).toBe(true);
    });

    it("unknown wealth-engine tool returns an error JSON", async () => {
      const out = await executeAITool("we_bogus_tool", {});
      const parsed = JSON.parse(out);
      expect(parsed.error).toBeTruthy();
    });
  });
});
