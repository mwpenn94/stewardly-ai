/**
 * Phase P Tests — Pricing, M&V, and Memory Engine
 *
 * Validates:
 *   1. Measurement & Verification engine (savings recording, aggregation, ceiling)
 *   2. Pricing Engine (invoice calculation, BYOM scenarios, trial)
 *   3. M8 Prompt Engine (assembly, token reduction)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  recordAICostSavings,
  recordTimeSavings,
  recordSearchEfficiency,
  recordDocumentProcessingSavings,
  recordMemoryContextSavings,
  getPeriodSummary,
  calculateCeiling,
  getUserSavingsEvents,
  getGlobalSavingsSummary,
  clearAllEvents,
  updateMVConfig,
  getMVConfig,
} from "./services/substrate/measurementVerification";
import {
  calculateInvoice,
  determineBYOMScenario,
  isInTrial,
  getPlanFees,
  getAllPlanFees,
  type BillingProfile,
  type UsageSummary,
} from "./services/substrate/pricingEngine";
import {
  assemblePrompt,
  getAssemblyStats,
} from "./services/substrate/promptEngine";
import {
  addToWorkingMemory,
  clearWorkingMemory,
} from "./services/substrate/memorySubstrate";

// ─── M&V Engine Tests ────────────────────────────────────────────────────────

describe("Substrate: Measurement & Verification", () => {
  beforeEach(() => {
    clearAllEvents();
  });

  describe("Savings Recording", () => {
    it("records AI cost optimization savings", () => {
      const event = recordAICostSavings({
        userId: 1,
        actualModel: "gpt-4o-mini",
        baselineModel: "gpt-4",
        inputTokens: 1000,
        outputTokens: 500,
        actualCost: 0.001,
      });

      expect(event.category).toBe("ai_cost_optimization");
      expect(event.savings).toBeGreaterThan(0);
      expect(event.actualCost).toBe(0.001);
      expect(event.baselineCost).toBeGreaterThan(event.actualCost);
    });

    it("records time savings", () => {
      const event = recordTimeSavings({
        userId: 1,
        operation: "document_review",
        automatedTimeMs: 5000,
        manualBenchmarkMinutes: 30,
      });

      expect(event.category).toBe("time_savings");
      expect(event.savings).toBeGreaterThan(0);
      expect(event.baselineCost).toBe(75); // 30min / 60 * $150/hr
    });

    it("records search efficiency savings", () => {
      const event = recordSearchEfficiency({
        userId: 1,
        cascadeTimeMs: 200,
        singleProviderTimeMs: 2000,
        cascadeCost: 0.01,
        singleProviderCost: 0.05,
      });

      expect(event.category).toBe("search_efficiency");
      expect(event.savings).toBe(0.04);
    });

    it("records document processing savings", () => {
      const event = recordDocumentProcessingSavings({
        userId: 1,
        processingTimeMs: 3000,
        aiCost: 0.02,
      });

      expect(event.category).toBe("document_processing");
      expect(event.savings).toBeGreaterThan(0);
    });

    it("records memory context reduction savings", () => {
      const event = recordMemoryContextSavings({
        userId: 1,
        actualTokens: 500,
        fullContextTokens: 5000,
        model: "gpt-4o",
      });

      expect(event.category).toBe("memory_context_reduction");
      expect(event.savings).toBeGreaterThan(0);
      expect(event.metadata.tokensUsed).toBe(500);
      expect(event.metadata.tokensBaseline).toBe(5000);
    });

    it("savings are never negative", () => {
      const event = recordSearchEfficiency({
        userId: 1,
        cascadeTimeMs: 5000,
        singleProviderTimeMs: 200,
        cascadeCost: 0.10,
        singleProviderCost: 0.01,
      });

      expect(event.savings).toBe(0); // Max(0, baseline - actual)
    });
  });

  describe("Period Summary", () => {
    it("aggregates savings for a period", () => {
      const now = Date.now();
      recordAICostSavings({ userId: 1, actualModel: "mini", baselineModel: "gpt-4", inputTokens: 1000, outputTokens: 500, actualCost: 0.001 });
      recordTimeSavings({ userId: 1, operation: "review", automatedTimeMs: 5000, manualBenchmarkMinutes: 30 });

      const summary = getPeriodSummary(1, now - 1000, now + 1000);
      expect(summary.eventCount).toBe(2);
      expect(summary.totalSavings).toBeGreaterThan(0);
      expect(summary.creditAmount).toBeGreaterThan(0);
    });

    it("filters by user", () => {
      const now = Date.now();
      recordTimeSavings({ userId: 1, operation: "a", automatedTimeMs: 1000, manualBenchmarkMinutes: 10 });
      recordTimeSavings({ userId: 2, operation: "b", automatedTimeMs: 1000, manualBenchmarkMinutes: 10 });

      const summary = getPeriodSummary(1, now - 1000, now + 1000);
      expect(summary.eventCount).toBe(1);
    });

    it("filters by time period", () => {
      const now = Date.now();
      recordTimeSavings({ userId: 1, operation: "a", automatedTimeMs: 1000, manualBenchmarkMinutes: 10 });

      const futureSummary = getPeriodSummary(1, now + 10000, now + 20000);
      expect(futureSummary.eventCount).toBe(0);
    });
  });

  describe("Cost-Plus Ceiling", () => {
    it("calculates ceiling correctly", () => {
      const result = calculateCeiling({
        directCost: 100_00, // $100
        platformFee: 49_00,
        measuredSavings: 20_00,
      });

      expect(result.directCost).toBe(100_00);
      expect(result.infrastructureMargin).toBe(15_00); // 15% of $100
      expect(result.ceilingAmount).toBe(115_00); // directCost + margin
    });

    it("detects ceiling hit", () => {
      const result = calculateCeiling({
        directCost: 10_00,
        platformFee: 200_00, // Very high platform fee
        measuredSavings: 0,
      });

      // Ceiling = directCost + margin = $10 + $1.50 = $11.50
      // Actual = platformFee + directCost - savings = $200 + $10 - $0 = $210
      expect(result.ceilingHit).toBe(true);
    });
  });

  describe("Global Summary", () => {
    it("aggregates across all users", () => {
      recordTimeSavings({ userId: 1, operation: "a", automatedTimeMs: 1000, manualBenchmarkMinutes: 10 });
      recordTimeSavings({ userId: 2, operation: "b", automatedTimeMs: 1000, manualBenchmarkMinutes: 10 });
      recordTimeSavings({ userId: 3, operation: "c", automatedTimeMs: 1000, manualBenchmarkMinutes: 10 });

      const global = getGlobalSavingsSummary();
      expect(global.totalEvents).toBe(3);
      expect(global.uniqueUsers).toBe(3);
      expect(global.totalSavings).toBeGreaterThan(0);
    });
  });

  describe("Configuration", () => {
    it("allows config updates", () => {
      const original = getMVConfig();
      updateMVConfig({ customerSavingsShare: 0.5 });
      const updated = getMVConfig();
      expect(updated.customerSavingsShare).toBe(0.5);
      // Restore
      updateMVConfig({ customerSavingsShare: original.customerSavingsShare });
    });
  });
});

// ─── Pricing Engine Tests ────────────────────────────────────────────────────

describe("Substrate: Pricing Engine", () => {
  beforeEach(() => {
    clearAllEvents();
  });

  describe("Invoice Calculation", () => {
    it("calculates subscription invoice", () => {
      const profile: BillingProfile = {
        userId: 1,
        mode: "subscription",
        planId: "professional",
        byomScenario: "none",
      };
      const usage: UsageSummary = {
        totalCalls: 100,
        totalInputTokens: 100000,
        totalOutputTokens: 50000,
        totalDirectCost: 50_00, // $50 in cents
        byoCallCount: 0,
        stewardlyCallCount: 100,
      };

      const invoice = calculateInvoice({
        profile,
        usage,
        periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
        periodEnd: Date.now(),
      });

      expect(invoice.platformFee).toBe(149_00);
      expect(invoice.directCost).toBe(50_00);
      expect(invoice.infrastructureMargin).toBe(7_50); // 15% of $50
      expect(invoice.netInvoice).toBeGreaterThan(0);
    });

    it("applies BYO S4 (full BYO) — zero direct cost", () => {
      const profile: BillingProfile = {
        userId: 1,
        mode: "subscription",
        planId: "starter",
        byomScenario: "S4_full_byo",
      };
      const usage: UsageSummary = {
        totalCalls: 100,
        totalInputTokens: 100000,
        totalOutputTokens: 50000,
        totalDirectCost: 50_00,
        byoCallCount: 100,
        stewardlyCallCount: 0,
      };

      const invoice = calculateInvoice({
        profile,
        usage,
        periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
        periodEnd: Date.now(),
      });

      expect(invoice.directCost).toBe(0);
      expect(invoice.platformFee).toBe(49_00);
    });

    it("applies savings credit", () => {
      const now = Date.now();
      // Record some savings first
      recordTimeSavings({ userId: 1, operation: "review", automatedTimeMs: 5000, manualBenchmarkMinutes: 30 });

      const profile: BillingProfile = {
        userId: 1,
        mode: "subscription",
        planId: "professional",
        byomScenario: "none",
      };
      const usage: UsageSummary = {
        totalCalls: 50,
        totalInputTokens: 50000,
        totalOutputTokens: 25000,
        totalDirectCost: 25_00,
        byoCallCount: 0,
        stewardlyCallCount: 50,
      };

      const invoice = calculateInvoice({
        profile,
        usage,
        periodStart: now - 1000,
        periodEnd: now + 1000,
      });

      expect(invoice.savingsCredit).toBeGreaterThan(0);
      expect(invoice.netInvoice).toBeLessThan(invoice.grossTotal);
    });
  });

  describe("BYOM Scenario Detection", () => {
    it("detects no BYO", () => {
      expect(determineBYOMScenario({ hasLocalProvider: false, hasEnterpriseKey: false, localCallPercentage: 0 })).toBe("none");
    });

    it("detects S1 (local only)", () => {
      expect(determineBYOMScenario({ hasLocalProvider: true, hasEnterpriseKey: false, localCallPercentage: 0.5 })).toBe("S1_local");
    });

    it("detects S2 (enterprise key only)", () => {
      expect(determineBYOMScenario({ hasLocalProvider: false, hasEnterpriseKey: true, localCallPercentage: 0 })).toBe("S2_enterprise");
    });

    it("detects S3 (mixed)", () => {
      expect(determineBYOMScenario({ hasLocalProvider: true, hasEnterpriseKey: true, localCallPercentage: 0.5 })).toBe("S3_mixed");
    });

    it("detects S4 (full BYO)", () => {
      expect(determineBYOMScenario({ hasLocalProvider: true, hasEnterpriseKey: true, localCallPercentage: 0.98 })).toBe("S4_full_byo");
    });
  });

  describe("Trial Detection", () => {
    it("detects active trial", () => {
      expect(isInTrial({ mode: "subscription", durationDays: 14, startDate: Date.now() - 1000 })).toBe(true);
    });

    it("detects expired trial", () => {
      expect(isInTrial({ mode: "subscription", durationDays: 14, startDate: Date.now() - 15 * 24 * 60 * 60 * 1000 })).toBe(false);
    });

    it("handles null trial", () => {
      expect(isInTrial(null)).toBe(false);
    });
  });

  describe("Plan Fees", () => {
    it("returns fees for known plans", () => {
      const starter = getPlanFees("starter");
      expect(starter).not.toBeNull();
      expect(starter!.monthlyFee).toBe(49_00);
    });

    it("returns null for unknown plans", () => {
      expect(getPlanFees("nonexistent")).toBeNull();
    });

    it("getAllPlanFees returns all plans", () => {
      const all = getAllPlanFees();
      expect(Object.keys(all)).toContain("starter");
      expect(Object.keys(all)).toContain("professional");
      expect(Object.keys(all)).toContain("enterprise");
    });
  });
});

// ─── M8 Prompt Engine Tests ──────────────────────────────────────────────────

describe("Substrate: M8 Prompt Engine", () => {
  const testUserId = 88888;

  beforeEach(() => {
    clearWorkingMemory(testUserId);
  });

  it("assembles prompt with empty memory", async () => {
    const result = await assemblePrompt({
      userId: testUserId,
      query: "What is my portfolio allocation?",
    });

    expect(result.systemMessage).toBeTruthy();
    expect(result.totalTokenEstimate).toBeGreaterThan(0);
    expect(result.assemblyTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("includes relevant memory in assembly", async () => {
    addToWorkingMemory(testUserId, {
      type: "semantic",
      content: "User has a moderate risk tolerance",
      importance: 0.9,
      metadata: {},
    });
    addToWorkingMemory(testUserId, {
      type: "semantic",
      content: "User's retirement goal is age 55",
      importance: 0.8,
      metadata: {},
    });

    const result = await assemblePrompt({
      userId: testUserId,
      query: "What investments match my risk profile?",
    });

    expect(result.memorySourcesUsed.length).toBeGreaterThan(0);
  });

  it("includes conversation history as temporal memory", async () => {
    const result = await assemblePrompt({
      userId: testUserId,
      query: "Continue from where we left off",
      conversationHistory: [
        { role: "user", content: "Tell me about index funds" },
        { role: "assistant", content: "Index funds are diversified investments..." },
      ],
    });

    expect(result.memorySourcesUsed).toContain("M5:temporal");
  });

  it("applies engine-specific instructions", async () => {
    const wealthResult = await assemblePrompt({
      userId: testUserId,
      query: "Review my portfolio",
      activeEngine: "wealth",
    });

    expect(wealthResult.systemMessage).toContain("financial advisory");

    const learningResult = await assemblePrompt({
      userId: testUserId,
      query: "Teach me about bonds",
      activeEngine: "learning",
    });

    expect(learningResult.systemMessage).toContain("educational");
  });

  it("reports token reduction ratio", async () => {
    const result = await assemblePrompt({
      userId: testUserId,
      query: "Simple question",
      conversationHistory: Array(10).fill({ role: "user", content: "A long message that takes many tokens to represent in the context window" }),
    });

    expect(result.reductionRatio).toBeLessThanOrEqual(1);
    expect(result.fullContextTokenEstimate).toBeGreaterThan(0);
  });

  it("getAssemblyStats returns stats object", () => {
    const stats = getAssemblyStats(testUserId);
    expect(stats).toHaveProperty("totalAssemblies");
    expect(stats).toHaveProperty("avgReductionRatio");
    expect(stats).toHaveProperty("avgAssemblyTimeMs");
    expect(stats).toHaveProperty("totalTokensSaved");
  });
});
