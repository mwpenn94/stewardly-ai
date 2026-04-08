/**
 * Tests for the natural-language → engine dispatcher (Round A3).
 *
 * Pure-function tests for extractIntent + integration tests for
 * dispatchToEngine that exercise the full intent → engine → response
 * shape without hitting the database.
 */

import { describe, it, expect } from "vitest";
import {
  extractIntent,
  dispatchToEngine,
} from "./chatEngineDispatcher";

describe("Round A3 — chatEngineDispatcher", () => {
  describe("extractIntent — slot extraction", () => {
    it("pulls age from '40-year-old'", () => {
      const r = extractIntent("Run a simulation for a 40-year-old");
      expect(r.slots.age).toBe(40);
    });

    it("pulls age from 'age 35'", () => {
      const r = extractIntent("simulate at age 35");
      expect(r.slots.age).toBe(35);
    });

    it("rejects out-of-range ages", () => {
      const r = extractIntent("a 5-year-old just kidding");
      // 5 is outside the 18-100 range so the slot should be undefined
      // (the AGE_RX regex matches but the bounds check rejects it)
      // The regex requires 1-2 digit numbers so this becomes 5 which is rejected
      expect(r.slots.age).toBeUndefined();
    });

    it("pulls income with K suffix", () => {
      const r = extractIntent("earning $300K");
      expect(r.slots.income).toBe(300_000);
    });

    it("pulls income with M suffix", () => {
      const r = extractIntent("salary 1.2M");
      expect(r.slots.income).toBe(1_200_000);
    });

    it("pulls income with comma-separated dollars", () => {
      const r = extractIntent("income $250,000");
      expect(r.slots.income).toBe(250_000);
    });

    it("pulls savings", () => {
      const r = extractIntent("with savings of $500K");
      expect(r.slots.savings).toBe(500_000);
    });

    it("pulls net worth", () => {
      const r = extractIntent("net worth $2M");
      expect(r.slots.netWorth).toBe(2_000_000);
    });

    it("pulls dependents", () => {
      const r = extractIntent("3 dependents in the household");
      expect(r.slots.dependents).toBe(3);
    });

    it("pulls horizon from 'over 25 years'", () => {
      const r = extractIntent("project over 25 years");
      expect(r.slots.horizon).toBe(25);
    });

    it("pulls preset wealthbridgePro", () => {
      const r = extractIntent("run a WealthBridge Pro simulation");
      expect(r.slots.preset).toBe("wealthbridgePro");
    });

    it("pulls preset wealthbridgeClient", () => {
      const r = extractIntent("show me the WealthBridge plan");
      expect(r.slots.preset).toBe("wealthbridgeClient");
    });

    it("pulls preset doNothing", () => {
      const r = extractIntent("compare to do nothing");
      expect(r.slots.preset).toBe("doNothing");
    });

    it("pulls role MD", () => {
      const r = extractIntent("project an MD's income for 10 years");
      expect(r.slots.role).toBe("md");
    });

    it("pulls role new associate", () => {
      const r = extractIntent("new associate income trajectory");
      expect(r.slots.role).toBe("new");
    });

    it("pulls target income from 'to earn'", () => {
      const r = extractIntent("what does it take to earn $250K");
      expect(r.slots.targetIncome).toBe(250_000);
    });
  });

  describe("extractIntent — intent classification", () => {
    it("detects holistic_simulate from preset mention", () => {
      const r = extractIntent("run a WealthBridge Pro simulation for a 40-year-old earning $300K");
      expect(r.intent).toBe("holistic_simulate");
    });

    it("detects compare_strategies from 'vs'", () => {
      const r = extractIntent("compare WealthBridge vs Do Nothing at year 30");
      expect(r.intent).toBe("compare_strategies");
    });

    it("detects biz_project from role mention", () => {
      const r = extractIntent("project a director's income over 10 years");
      expect(r.intent).toBe("biz_project");
    });

    it("detects monte_carlo from 'percentile'", () => {
      const r = extractIntent("show me the percentile bands for my portfolio");
      expect(r.intent).toBe("monte_carlo");
    });

    it("detects back_plan from target income phrase", () => {
      const r = extractIntent("what do I need to do to earn $200K");
      expect(r.intent).toBe("back_plan");
    });

    it("returns 'none' for unrelated text", () => {
      const r = extractIntent("hello, how are you?");
      expect(r.intent).toBe("none");
    });
  });

  describe("dispatchToEngine", () => {
    it("holistic_simulate returns chart + final snapshot", async () => {
      const intent = extractIntent(
        "run a WealthBridge simulation for a 40-year-old earning $300K",
      );
      const response = await dispatchToEngine(intent);
      expect(response.intent).toBe("holistic_simulate");
      expect(response.tool).toBe("he.simulate");
      expect(response.charts.length).toBe(1);
      expect(response.charts[0].component).toBe("ProjectionChart");
      expect(response.actions.copy).toBe(true);
      expect(response.actions.tts).toBe(true);
      expect(response.actions.download).toBe(true);
    });

    it("holistic_simulate narrative includes the income figure", async () => {
      const intent = extractIntent(
        "simulate a 40-year-old earning $300K",
      );
      const response = await dispatchToEngine(intent);
      expect(response.narrative).toContain("300,000");
    });

    it("compare_strategies returns 2 rows + delta", async () => {
      const intent = extractIntent("compare WealthBridge vs Do Nothing");
      const response = await dispatchToEngine(intent);
      expect(response.tool).toBe("he.compareAt");
      const data = response.data as { delta: number };
      expect(data.delta).toBeGreaterThan(0);
      expect(response.charts[0].component).toBe("ComparisonGrid");
    });

    it("biz_project returns BIE chart", async () => {
      const intent = extractIntent("project a director's income for 10 years");
      const response = await dispatchToEngine(intent);
      expect(response.tool).toBe("bie.simulate");
      expect(response.charts[0].component).toBe("ProjectionChart");
      const props = response.charts[0].props as { series: Array<{ isPracticeIncome?: boolean }> };
      expect(props.series[0].isPracticeIncome).toBe(true);
    });

    it("monte_carlo returns bands", async () => {
      const intent = extractIntent("show me Monte Carlo bands over 20 years");
      const response = await dispatchToEngine(intent);
      expect(response.tool).toBe("montecarlo.simulate");
      expect(response.charts[0].component).toBe("MonteCarloBands");
    });

    it("back_plan returns funnel table", async () => {
      const intent = extractIntent("what do I need to do to earn $250K as an MD");
      const response = await dispatchToEngine(intent);
      expect(response.tool).toBe("bie.backPlan");
      expect(response.charts[0].component).toBe("FunnelTable");
    });

    it("returns 'none' fallback for unrelated text", async () => {
      const intent = extractIntent("the weather is nice today");
      const response = await dispatchToEngine(intent);
      expect(response.intent).toBe("none");
      expect(response.tool).toBe("none");
      expect(response.charts.length).toBe(0);
    });

    it("response narrative is safety-wrapped", async () => {
      const intent = extractIntent(
        "run a WealthBridge simulation for a 40-year-old earning $300K",
      );
      const response = await dispatchToEngine(intent);
      expect(response.narrative.toLowerCase()).toContain("simulation");
    });
  });
});
