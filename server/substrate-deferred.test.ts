/**
 * substrate-deferred.test.ts — Tests for Phase 6 deferred items
 */
import { describe, it, expect } from "vitest";

import {
  recordAICostSavings,
  recordTimeSavings,
  recordSearchEfficiency,
  getPeriodSummary,
} from "./services/substrate/measurementVerification";

import {
  addToWorkingMemory,
  getWorkingMemory,
  consolidateWorkingMemory,
  getMemoryStats,
  clearWorkingMemory,
} from "./services/substrate/memorySubstrate";

import {
  calculateInvoice,
  getPlanFees,
  getAllPlanFees,
  determineBYOMScenario,
} from "./services/substrate/pricingEngine";

import {
  getCapabilities,
  getCapability,
  getActiveTier,
  degradeCapability,
  restoreCapability,
} from "./services/substrate/capabilityTiers";

import { decomposeGoal } from "./services/substrate/atlas";

describe("Phase 6 — Deferred Items Integration", () => {

  describe("M&V Recording Service", () => {
    it("records AI cost savings with correct params", () => {
      const event = recordAICostSavings({
        userId: 99901,
        actualModel: "gpt-4o-mini",
        baselineModel: "default",
        inputTokens: 1000,
        outputTokens: 500,
        actualCost: 0.02,
      });
      expect(event).toBeDefined();
      expect(event.category).toBe("ai_cost_optimization");
      expect(event.userId).toBe(99901);
      expect(event.savings).toBeGreaterThanOrEqual(0);
    });

    it("records time savings", () => {
      const event = recordTimeSavings({
        userId: 99902,
        operation: "document_review",
        automatedTimeMs: 2000,
        manualBenchmarkMinutes: 30,
      });
      expect(event).toBeDefined();
      expect(event.category).toBe("time_savings");
      expect(event.savings).toBeGreaterThan(0);
    });

    it("records search efficiency", () => {
      const event = recordSearchEfficiency({
        userId: 99903,
        cascadeTimeMs: 45,
        singleProviderTimeMs: 2000,
        cascadeCost: 0.001,
        singleProviderCost: 0.01,
      });
      expect(event).toBeDefined();
      expect(event.category).toBe("search_efficiency");
    });

    it("retrieves period summary", () => {
      const now = Date.now();
      const summary = getPeriodSummary(99901, now - 86400000, now + 1000);
      expect(summary).toBeDefined();
      expect(summary.totalSavings).toBeGreaterThanOrEqual(0);
      expect(summary.eventCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Memory Substrate Working Memory", () => {
    const testUserId = 99910;

    it("adds entries to working memory", () => {
      clearWorkingMemory(testUserId);
      const entry = addToWorkingMemory(testUserId, {
        content: "User prefers conservative investments",
        type: "semantic",
        confidence: 0.9,
        metadata: { source: "conversation" },
      });
      expect(entry.id).toBeDefined();
      expect(entry.content).toBe("User prefers conservative investments");
    });

    it("retrieves working memory for user", () => {
      const wm = getWorkingMemory(testUserId);
      expect(wm.entries.length).toBeGreaterThanOrEqual(1);
      expect(wm.userId).toBe(testUserId);
    });

    it("consolidates working memory", () => {
      for (let i = 0; i < 5; i++) {
        addToWorkingMemory(testUserId, {
          content: `Memory entry ${i} about financial planning`,
          type: "episodic",
          confidence: 0.7,
        });
      }
      const result = consolidateWorkingMemory(testUserId);
      expect(result).toBeDefined();
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it("provides memory statistics", () => {
      const stats = getMemoryStats(testUserId);
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1);
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeGreaterThan(0);
    });
  });

  describe("Pricing Engine", () => {
    it("calculates invoice with correct structure", () => {
      const invoice = calculateInvoice({
        profile: {
          userId: 99920,
          mode: "subscription",
          planId: "professional",
          byomScenario: "none",
        },
        usage: {
          totalCalls: 100,
          totalInputTokens: 100000,
          totalOutputTokens: 50000,
          totalDirectCost: 500,
          byoCallCount: 0,
          stewardlyCallCount: 100,
        },
        periodStart: Date.now() - 86400000 * 30,
        periodEnd: Date.now(),
      });
      expect(invoice).toBeDefined();
      expect(invoice.platformFee).toBeGreaterThanOrEqual(0);
      expect(invoice.directCost).toBeGreaterThanOrEqual(0);
      expect(invoice.netInvoice).toBeDefined();
      expect(invoice.ceilingAmount).toBeDefined();
      expect(invoice.breakdown).toBeDefined();
      expect(Array.isArray(invoice.breakdown)).toBe(true);
    });

    it("returns plan fees for known plans", () => {
      const starter = getPlanFees("starter");
      const professional = getPlanFees("professional");
      const enterprise = getPlanFees("enterprise");
      expect(starter).not.toBeNull();
      expect(professional).not.toBeNull();
      expect(enterprise).not.toBeNull();
      expect(starter!.monthlyFee).toBeLessThan(professional!.monthlyFee);
      expect(professional!.monthlyFee).toBeLessThan(enterprise!.monthlyFee);
    });

    it("returns null for unknown plan", () => {
      const unknown = getPlanFees("nonexistent_plan");
      expect(unknown).toBeNull();
    });

    it("applies BYO discount for S4 scenario", () => {
      const s1Invoice = calculateInvoice({
        profile: { userId: 99921, mode: "subscription", planId: "professional", byomScenario: "none" },
        usage: { totalCalls: 100, totalInputTokens: 100000, totalOutputTokens: 50000, totalDirectCost: 500, byoCallCount: 0, stewardlyCallCount: 100 },
        periodStart: Date.now() - 86400000 * 30,
        periodEnd: Date.now(),
      });
      const s4Invoice = calculateInvoice({
        profile: { userId: 99922, mode: "subscription", planId: "professional", byomScenario: "S4_full_byo" },
        usage: { totalCalls: 100, totalInputTokens: 100000, totalOutputTokens: 50000, totalDirectCost: 500, byoCallCount: 100, stewardlyCallCount: 0 },
        periodStart: Date.now() - 86400000 * 30,
        periodEnd: Date.now(),
      });
      expect(s4Invoice.directCost).toBe(0);
      expect(s4Invoice.netInvoice).toBeLessThan(s1Invoice.netInvoice);
    });

    it("determines BYOM scenario correctly", () => {
      const scenario = determineBYOMScenario({
        hasLocalModel: false,
        hasEnterpriseKey: false,
        hasMixedSetup: false,
        hasFullBYO: false,
      });
      expect(scenario).toBe("none");
    });
  });

  describe("Capability Tiers", () => {
    it("returns all capabilities", () => {
      const caps = getCapabilities();
      expect(caps).toBeDefined();
      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBeGreaterThan(0);
    });

    it("returns specific capability by domain", () => {
      const cap = getCapability("llm");
      expect(cap).toBeDefined();
      expect(cap!.domain).toBe("llm");
      expect(cap!.tiers).toBeDefined();
      expect(cap!.tiers.length).toBeGreaterThan(0);
    });

    it("gets active tier for a domain", () => {
      const tier = getActiveTier("llm");
      expect(tier).toBeDefined();
      expect(tier!.level).toBeGreaterThanOrEqual(0);
      expect(tier!.name).toBeDefined();
    });

    it("degrades and restores capability", () => {
      const degraded = degradeCapability("llm", "test degradation");
      if (degraded !== null) {
        expect(degraded).toBeGreaterThanOrEqual(0);
        const restored = restoreCapability("llm", 3 as any);
        expect(typeof restored).toBe("boolean");
      }
    });
  });

  describe("ATLAS Goal Decomposition", () => {
    it("decomposes a financial goal", async () => {
      const result = await decomposeGoal({
        description: "Create a retirement savings plan",
        userId: 99930,
      });
      expect(result).toBeDefined();
      expect(result.tasks).toBeDefined();
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.goalId).toBeDefined();
    }, 30000);

    it("decomposes a complex multi-step goal", async () => {
      const result = await decomposeGoal({
        description: "Complete estate planning including trust setup, beneficiary designations, and tax optimization",
        userId: 99931,
        priority: "high",
      });
      expect(result.tasks.length).toBeGreaterThan(2);
      expect(result.estimatedCost).toBeGreaterThanOrEqual(0);
    }, 30000);
  });
});
