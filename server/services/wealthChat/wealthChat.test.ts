/**
 * Phase 6 wealth-chat tests — exercises chatTools, safety, and proactive
 * trigger modules. Covers the conversational layer of the wealth engine.
 */

import { describe, it, expect } from "vitest";

import {
  explainNumber,
  modifyAndRerun,
  compareScenarios,
  showVisualization,
  projectRecruitImpact,
  smokeStrategy,
  buildHolisticForChat,
} from "./chatTools";
import {
  scrubDirectivePhrasing,
  ensureDisclaimer,
  safetyWrap,
  detectBannedTopic,
  REFUSAL_MESSAGES,
  buildRegBIRationale,
  NO_ADVICE_DISCLAIMER,
} from "./safety";
import {
  onLoginTrigger,
  guardrailCrossedTrigger,
  rothWindowTrigger,
  hierarchyMilestoneTrigger,
  strategyComparerTrigger,
} from "./proactive";
import {
  WEALTH_CHAT_TOOLS,
  ALL_AI_TOOLS,
  executeAITool,
} from "../../aiToolCalling";

const profile = {
  age: 40,
  income: 120_000,
  netWorth: 350_000,
  savings: 180_000,
  dependents: 2,
  mortgage: 250_000,
  debts: 30_000,
  marginalRate: 0.25,
};

// ═══════════════════════════════════════════════════════════════════════════
// Phase 6A — chat tools
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 6A — chat tools", () => {
  describe("explainNumber", () => {
    it("returns drivers + narrative for totalValue", () => {
      const r = explainNumber({ metric: "totalValue", value: 3_600_000 });
      expect(r.driverAssumptions.length).toBeGreaterThan(0);
      expect(r.narrative).toContain("3,600,000");
      // The pure narrative ends with "projection, not financial advice".
      // The dispatch path layers on the safetyWrap disclaimer additionally.
      expect(r.narrative.toLowerCase()).toContain("projection");
    });
    it("falls back to a generic driver for unknown metrics", () => {
      const r = explainNumber({ metric: "exoticMetric", value: 100 });
      expect(r.driverAssumptions[0]?.name).toContain("Generic");
    });
  });

  describe("modifyAndRerun", () => {
    it("returns a delta when savings increases", () => {
      const r = modifyAndRerun({
        baseProfile: profile,
        assumption: "savings",
        newValue: 500_000,
      });
      expect(r.original.assumption).toBe(180_000);
      expect(r.modified.assumption).toBe(500_000);
      expect(r.delta.totalValue).not.toBe(0);
    });
    it("includes the no-advice disclaimer in the narrative", () => {
      const r = modifyAndRerun({
        baseProfile: profile,
        assumption: "savings",
        newValue: 200_000,
      });
      expect(r.narrative.toLowerCase()).toContain("not financial advice");
    });
  });

  describe("compareScenarios", () => {
    it("returns winner + delta", () => {
      const r = compareScenarios({
        scenario1: { name: "Do Nothing", profile, preset: "doNothing" },
        scenario2: { name: "WealthBridge", profile, preset: "wealthbridgeClient" },
      });
      expect(r.winner).toBe("WealthBridge");
      expect(r.delta.totalValue).toBeGreaterThan(0);
    });
  });

  describe("showVisualization", () => {
    it("maps every chart type to a component descriptor", () => {
      const types = ["projection", "guardrails", "bracket", "hierarchy", "sankey"] as const;
      types.forEach((t) => {
        const v = showVisualization({ chartType: t, data: {} });
        expect(v.component).toBeTruthy();
        expect(v.caption).toBeTruthy();
      });
    });
  });

  describe("projectRecruitImpact", () => {
    it("returns positive delta for additional recruits", async () => {
      const r = await projectRecruitImpact({
        clientId: "test-recruit",
        additionalRecruits: 3,
      });
      expect(r.delta.totalValue).toBeGreaterThanOrEqual(0);
      expect(r.narrative.toLowerCase()).toContain("recruit");
    });
  });

  describe("smoke helpers", () => {
    it("smokeStrategy builds a wealthbridge UWE strategy", () => {
      const s = smokeStrategy(profile);
      expect(s.company).toBe("wealthbridge");
      expect(s.products.length).toBeGreaterThan(0);
    });
    it("buildHolisticForChat returns a HolisticStrategy", () => {
      const s = buildHolisticForChat(profile);
      expect(s.companyKey).toBe("wealthbridge");
      expect(s.savingsRate).toBe(0.15);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 6E — safety wrappers
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 6E — safety wrappers", () => {
  describe("scrubDirectivePhrasing", () => {
    it("rewrites 'you should'", () => {
      expect(scrubDirectivePhrasing("You should buy term life")).toContain(
        "the projection shows",
      );
    });
    it("rewrites 'I recommend'", () => {
      expect(scrubDirectivePhrasing("I recommend a 15% savings rate")).toContain(
        "the model suggests",
      );
    });
    it("rewrites 'guaranteed' to 'projected'", () => {
      expect(scrubDirectivePhrasing("a guaranteed 7% return")).toContain(
        "projected",
      );
    });
    it("leaves neutral text alone", () => {
      const out = scrubDirectivePhrasing("The projection shows growth.");
      expect(out).toBe("The projection shows growth.");
    });
  });

  describe("ensureDisclaimer", () => {
    it("appends the disclaimer if missing", () => {
      const out = ensureDisclaimer("Total: $3.6M");
      expect(out).toContain(NO_ADVICE_DISCLAIMER);
    });
    it("does not double-append", () => {
      const text = `Total: $3.6M\n\n${NO_ADVICE_DISCLAIMER}`;
      const out = ensureDisclaimer(text);
      expect(out.split(NO_ADVICE_DISCLAIMER).length - 1).toBe(1);
    });
  });

  describe("safetyWrap", () => {
    it("rewrites + adds disclaimer in one pass", () => {
      const out = safetyWrap("You should save more.");
      expect(out).toContain("the projection shows");
      expect(out).toContain(NO_ADVICE_DISCLAIMER);
    });
  });

  describe("detectBannedTopic", () => {
    it("flags 'should I buy AAPL'", () => {
      const r = detectBannedTopic("should I buy AAPL?");
      expect(r.banned).toBe(true);
      if (r.banned) expect(r.reason).toBe("specific_security_recommendation");
    });
    it("flags 'guaranteed return'", () => {
      const r = detectBannedTopic("Tell me a guaranteed return strategy");
      expect(r.banned).toBe(true);
    });
    it("flags 'market timing'", () => {
      const r = detectBannedTopic("when is the best market timing for crypto");
      expect(r.banned).toBe(true);
    });
    it("does not flag a legitimate question", () => {
      const r = detectBannedTopic("How does Roth conversion work?");
      expect(r.banned).toBe(false);
    });
  });

  describe("REFUSAL_MESSAGES", () => {
    it("provides a refusal for every banned topic", () => {
      expect(REFUSAL_MESSAGES.specific_security_recommendation).toBeTruthy();
      expect(REFUSAL_MESSAGES.guaranteed_return_claim).toBeTruthy();
      expect(REFUSAL_MESSAGES.market_timing).toBeTruthy();
    });
  });

  describe("buildRegBIRationale", () => {
    it("includes drivers + disclaimer", () => {
      const r = buildRegBIRationale("Add a Roth conversion this year", [
        { name: "Marginal rate", value: "22%" },
        { name: "Bracket headroom", value: "$28K" },
      ]);
      expect(r).toContain("Marginal rate: 22%");
      expect(r).toContain(NO_ADVICE_DISCLAIMER);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 6D — proactive triggers
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 6D — proactive triggers", () => {
  it("onLoginTrigger info when in band", () => {
    const m = onLoginTrigger({
      portfolioBalance: 1_000_000,
      practiceIncomeMTD: 8_000,
      practiceIncomePctVsProjection: 5,
      guardrailLow: 800_000,
      guardrailHigh: 1_200_000,
    });
    expect(m.priority).toBe("info");
    expect(m.body).toContain("simulation");
  });

  it("onLoginTrigger warn when outside band", () => {
    const m = onLoginTrigger({
      portfolioBalance: 1_300_000,
      practiceIncomeMTD: 8_000,
      practiceIncomePctVsProjection: 5,
      guardrailLow: 800_000,
      guardrailHigh: 1_200_000,
    });
    expect(m.priority).toBe("warn");
  });

  it("guardrailCrossedTrigger has warn priority", () => {
    const m = guardrailCrossedTrigger({
      portfolioBalance: 1_100_000,
      oldGuardrailHigh: 1_050_000,
      newGuardrailHigh: 1_200_000,
      newSpendCeiling: 80_000,
    });
    expect(m.priority).toBe("warn");
  });

  it("rothWindowTrigger has CTA", () => {
    const m = rothWindowTrigger({
      conversionWindowSize: 28_000,
      bracketRate: 0.22,
      reasonNarrative: "Your practice income dipped this quarter.",
    });
    expect(m.ctaLabel).toBeTruthy();
    expect(m.body).toContain("Roth");
  });

  it("hierarchyMilestoneTrigger embeds the gap dollar amount", () => {
    const m = hierarchyMilestoneTrigger({
      currentRole: "MD",
      nextRole: "RVP",
      productionGap: 15_000,
      paceMonths: 4,
    });
    expect(m.body).toContain("15,000");
  });

  it("strategyComparerTrigger references this week's count", () => {
    const m = strategyComparerTrigger({
      scenariosThisWeek: 3,
      topStrategy: "WealthBridge Plan",
      topStrategyValue: 3_600_000,
    });
    expect(m.body).toContain("3 scenarios");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 6A integration — ReAct dispatch
// ═══════════════════════════════════════════════════════════════════════════

describe("Phase 6A — ReAct dispatch", () => {
  it("WEALTH_CHAT_TOOLS exposes 5 tools", () => {
    expect(WEALTH_CHAT_TOOLS.length).toBe(5);
  });

  it("ALL_AI_TOOLS includes the chat tools", () => {
    const names = ALL_AI_TOOLS.map(
      (t) => (t as { function: { name: string } }).function.name,
    );
    expect(names).toContain("chat_explain_number");
    expect(names).toContain("chat_modify_and_rerun");
    expect(names).toContain("chat_compare_scenarios");
    expect(names).toContain("chat_show_visualization");
    expect(names).toContain("chat_project_recruit_impact");
  });

  it("chat_explain_number dispatch returns JSON with narrative + disclaimer", async () => {
    const out = await executeAITool("chat_explain_number", {
      metric: "totalValue",
      value: 3_600_000,
    });
    const parsed = JSON.parse(out);
    expect(parsed.metric).toBe("totalValue");
    expect(parsed.narrative.toLowerCase()).toContain("simulation");
  });

  it("chat_modify_and_rerun dispatch returns delta", async () => {
    const out = await executeAITool("chat_modify_and_rerun", {
      assumption: "savings",
      newValue: 300_000,
      age: 40,
      income: 120_000,
      netWorth: 350_000,
      savings: 180_000,
    });
    const parsed = JSON.parse(out);
    expect(parsed.delta.totalValue).toBeDefined();
    expect(parsed.narrative.toLowerCase()).toContain("not financial advice");
  });

  it("chat_compare_scenarios dispatch picks WealthBridge over Do Nothing", async () => {
    const out = await executeAITool("chat_compare_scenarios", {
      scenario1Name: "Do Nothing",
      scenario1Preset: "doNothing",
      scenario2Name: "WealthBridge",
      scenario2Preset: "wealthbridgeClient",
    });
    const parsed = JSON.parse(out);
    expect(parsed.winner).toBe("WealthBridge");
  });

  it("chat_show_visualization dispatch returns component descriptor", async () => {
    const out = await executeAITool("chat_show_visualization", {
      chartType: "guardrails",
      data: { currentValue: 1000000 },
    });
    const parsed = JSON.parse(out);
    expect(parsed.component).toBe("GuardrailsGauge");
  });

  it("chat_project_recruit_impact dispatch returns delta + narrative", async () => {
    const out = await executeAITool("chat_project_recruit_impact", {
      clientId: "test-client",
      additionalRecruits: 2,
    });
    const parsed = JSON.parse(out);
    expect(parsed.delta.totalValue).toBeGreaterThanOrEqual(0);
    expect(parsed.narrative).toContain("recruit");
  });
});
