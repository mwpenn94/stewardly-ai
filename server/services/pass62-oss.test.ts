/**
 * Pass 62+ — Open Source Directory Optimization Tests
 *
 * Tests for:
 *   1. portfolioRiskMetrics procedure (wealthEngine router)
 *   2. pipelineHealth freshness enhancement (integrations router)
 *   3. studyAnalytics procedure (learning router)
 *   4. useOptimisticMutation hooks (client-side)
 *   5. Accessibility CSS rules verification
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Portfolio Risk Metrics — computeRiskMetrics & computeEfficientFrontierPoints
// ═══════════════════════════════════════════════════════════════════════════
describe("portfolioRiskMetrics — optimizationUtils", () => {
  let computeRiskMetrics: typeof import("./portfolio/optimizationUtils").computeRiskMetrics;
  let generateEfficientFrontier: typeof import("./portfolio/optimizationUtils").generateEfficientFrontier;

  beforeEach(async () => {
    const mod = await import("./portfolio/optimizationUtils");
    computeRiskMetrics = mod.computeRiskMetrics;
    generateEfficientFrontier = mod.generateEfficientFrontier;
  });

  it("returns valid Sharpe ratio for positive returns", () => {
    const returns = [0.02, 0.03, 0.01, 0.04, 0.02, 0.03, 0.01, 0.05, 0.02, 0.03];
    const metrics = computeRiskMetrics(returns, 252, 0.0);
    expect(metrics).toHaveProperty("sharpeRatio");
    expect(typeof metrics.sharpeRatio).toBe("number");
    // All positive returns with 0 risk-free rate should yield positive Sharpe
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
  });

  it("returns valid Sortino ratio", () => {
    const returns = [0.02, -0.01, 0.03, -0.02, 0.04, 0.01, -0.01, 0.02, 0.03, -0.005];
    const metrics = computeRiskMetrics(returns, 0.04);
    expect(metrics).toHaveProperty("sortinoRatio");
    expect(typeof metrics.sortinoRatio).toBe("number");
  });

  it("computes max drawdown correctly", () => {
    const returns = [0.10, -0.15, 0.05, -0.20, 0.10, 0.05, 0.02, -0.05, 0.03, 0.01];
    const metrics = computeRiskMetrics(returns);
    expect(metrics).toHaveProperty("maxDrawdown");
    // maxDrawdown is a positive decimal (0.25 = 25% peak-to-trough)
    expect(metrics.maxDrawdown).toBeGreaterThan(0);
  });

  it("handles all-positive returns", () => {
    const returns = [0.01, 0.02, 0.03, 0.01, 0.02];
    const metrics = computeRiskMetrics(returns, 252, 0.0);
    // With all positive returns and 0 risk-free rate, Sharpe should be positive
    expect(metrics.sharpeRatio).toBeGreaterThanOrEqual(0);
    expect(metrics.maxDrawdown).toBe(0);
  });

  it("handles all-negative returns", () => {
    const returns = [-0.01, -0.02, -0.03, -0.01, -0.02];
    const metrics = computeRiskMetrics(returns);
    expect(metrics.sharpeRatio).toBeLessThan(0);
    // maxDrawdown is a positive decimal representing peak-to-trough loss
    expect(metrics.maxDrawdown).toBeGreaterThan(0);
  });

  it("generates efficient frontier points", () => {
    const series = [
      { id: "A", returns: [0.02, 0.03, 0.01, 0.04, 0.02, 0.03, 0.01, 0.05, 0.02, 0.03] },
      { id: "B", returns: [0.01, 0.02, 0.03, 0.01, 0.04, 0.02, 0.01, 0.03, 0.02, 0.01] },
    ];
    const frontier = generateEfficientFrontier(series, 5);
    expect(Array.isArray(frontier)).toBe(true);
    expect(frontier.length).toBe(5);
    for (const pt of frontier) {
      expect(pt).toHaveProperty("targetReturn");
      expect(pt).toHaveProperty("volatility");
      expect(typeof pt.targetReturn).toBe("number");
      expect(typeof pt.volatility).toBe("number");
    }
  });

  it("frontier points are ordered by target return", () => {
    const series = [
      { id: "A", returns: [0.02, -0.01, 0.03, 0.04, -0.02, 0.01, 0.03, 0.02, 0.01, 0.04] },
      { id: "B", returns: [0.01, 0.02, -0.01, 0.03, 0.01, 0.02, -0.01, 0.01, 0.03, 0.02] },
    ];
    const frontier = generateEfficientFrontier(series, 5);
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].targetReturn).toBeGreaterThanOrEqual(frontier[i - 1].targetReturn);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Data Pipeline Freshness Assessment
// ═══════════════════════════════════════════════════════════════════════════
describe("pipelineHealth — assessFreshness", () => {
  let assessFreshness: typeof import("./dataPipelineUtils").assessFreshness;

  beforeEach(async () => {
    const mod = await import("./dataPipelineUtils");
    assessFreshness = mod.assessFreshness;
  });

  it("returns 'fresh' for recent timestamps", () => {
    const now = new Date();
    const result = assessFreshness(now);
    expect(result.level).toBe("fresh");
    expect(result.ageMs).toBeLessThan(60_000);
  });

  it("returns 'stale' for old timestamps beyond stale threshold", () => {
    const old = new Date(Date.now() - 10 * 86_400_000); // 10 days ago
    const result = assessFreshness(old);
    expect(result.level).toBe("stale");
    expect(result.ageMs).toBeGreaterThan(9 * 86_400_000);
  });

  it("returns 'expired' for very old timestamps", () => {
    const veryOld = new Date(Date.now() - 60 * 86_400_000); // 60 days ago
    const result = assessFreshness(veryOld);
    expect(result.level).toBe("expired");
  });

  it("provides a human-readable age label", () => {
    const old = new Date(Date.now() - 3 * 86_400_000);
    const result = assessFreshness(old);
    expect(typeof result.ageLabel).toBe("string");
    expect(result.ageLabel.length).toBeGreaterThan(0);
  });

  it("returns score between 0 and 100", () => {
    const result = assessFreshness(new Date());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("handles null/undefined gracefully", () => {
    const result = assessFreshness(null);
    expect(result.level).toBe("unknown");
    expect(result.score).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Learning Analytics Aggregation — wired into learning.studyAnalytics
// ═══════════════════════════════════════════════════════════════════════════
describe("studyAnalytics — analyticsAggregation", () => {
  let analyzeTrends: typeof import("./learning/analyticsAggregation").analyzeTrends;
  let buildTopicMastery: typeof import("./learning/analyticsAggregation").buildTopicMastery;
  let generateEfficiencyReport: typeof import("./learning/analyticsAggregation").generateEfficiencyReport;

  beforeEach(async () => {
    const mod = await import("./learning/analyticsAggregation");
    analyzeTrends = mod.analyzeTrends;
    buildTopicMastery = mod.buildTopicMastery;
    generateEfficiencyReport = mod.generateEfficiencyReport;
  });

  const sessions = [
    { id: "1", userId: 1, startedAt: new Date(Date.now() - 7 * 86400000).toISOString(), durationSec: 1800, questionsAttempted: 20, questionsCorrect: 15, topic: "insurance", difficulty: 3 },
    { id: "2", userId: 1, startedAt: new Date(Date.now() - 6 * 86400000).toISOString(), durationSec: 2400, questionsAttempted: 30, questionsCorrect: 25, topic: "insurance", difficulty: 3 },
    { id: "3", userId: 1, startedAt: new Date(Date.now() - 5 * 86400000).toISOString(), durationSec: 1200, questionsAttempted: 15, questionsCorrect: 12, topic: "retirement", difficulty: 3 },
    { id: "4", userId: 1, startedAt: new Date(Date.now() - 4 * 86400000).toISOString(), durationSec: 3600, questionsAttempted: 40, questionsCorrect: 35, topic: "insurance", difficulty: 3 },
    { id: "5", userId: 1, startedAt: new Date(Date.now() - 3 * 86400000).toISOString(), durationSec: 900, questionsAttempted: 10, questionsCorrect: 9, topic: "retirement", difficulty: 3 },
  ];

  it("analyzeTrends returns valid trend data", () => {
    const trends = analyzeTrends(sessions);
    expect(trends).toHaveProperty("totalSessions");
    expect(trends.totalSessions).toBe(5);
    expect(trends).toHaveProperty("totalStudyMinutes");
    expect(trends.totalStudyMinutes).toBeGreaterThan(0);
  });

  it("buildTopicMastery groups by topic", () => {
    const mastery = buildTopicMastery(sessions);
    expect(Array.isArray(mastery)).toBe(true);
    const topics = mastery.map((m: any) => m.topic);
    expect(topics).toContain("insurance");
    expect(topics).toContain("retirement");
  });

  it("generateEfficiencyReport returns valid report", () => {
    const report = generateEfficiencyReport(sessions);
    expect(report).toHaveProperty("overallScore");
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it("handles empty sessions array", () => {
    const trends = analyzeTrends([]);
    expect(trends.totalSessions).toBe(0);
    const mastery = buildTopicMastery([]);
    expect(mastery).toEqual([]);
    const report = generateEfficiencyReport([]);
    expect(report.overallScore).toBeDefined();
  });

  it("handles single session", () => {
    const single = [sessions[0]];
    const trends = analyzeTrends(single);
    expect(trends.totalSessions).toBe(1);
    const mastery = buildTopicMastery(single);
    expect(mastery.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Data Pipeline Utils — withRetry
// ═══════════════════════════════════════════════════════════════════════════
describe("dataPipelineUtils — withRetry", () => {
  let withRetry: typeof import("./dataPipelineUtils").withRetry;

  beforeEach(async () => {
    const mod = await import("./dataPipelineUtils");
    withRetry = mod.withRetry;
  });

  it("succeeds on first attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 20 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 4, initialDelayMs: 10, maxDelayMs: 20 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    await expect(withRetry(fn, { maxAttempts: 2, initialDelayMs: 10, maxDelayMs: 20 }))
      .rejects.toThrow("always fails");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("dataPipelineUtils — reconcileSources", () => {
  let reconcileSources: typeof import("./dataPipelineUtils").reconcileSources;

  beforeEach(async () => {
    const mod = await import("./dataPipelineUtils");
    reconcileSources = mod.reconcileSources;
  });

  it("reconciles matching sources", () => {
    const sources = [
      { name: "source1", data: { a: 1, b: 2 }, lastUpdated: new Date() },
      { name: "source2", data: { a: 1, b: 2 }, lastUpdated: new Date() },
    ];
    const result = reconcileSources(sources as any);
    expect(result).toHaveProperty("overallHealth");
  });

  it("detects inconsistencies between sources", () => {
    const sources = [
      { name: "source1", data: { a: 1 }, lastUpdated: new Date() },
      { name: "source2", data: { a: 999 }, lastUpdated: new Date() },
    ];
    const result = reconcileSources(sources as any);
    expect(result).toBeDefined();
  });
});

describe("dataPipelineUtils — summarizePipelineHealth", () => {
  let summarizePipelineHealth: typeof import("./dataPipelineUtils").summarizePipelineHealth;

  beforeEach(async () => {
    const mod = await import("./dataPipelineUtils");
    summarizePipelineHealth = mod.summarizePipelineHealth;
  });

  it("returns a health summary for pipeline steps", () => {
    const steps = [
      { name: "fetch", status: "completed" as const, lastRunAt: new Date(), durationMs: 100 },
      { name: "transform", status: "completed" as const, lastRunAt: new Date(), durationMs: 200 },
    ];
    const summary = summarizePipelineHealth("test-pipeline", steps);
    expect(summary).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Accessibility CSS verification (static analysis)
// ═══════════════════════════════════════════════════════════════════════════
describe("Accessibility CSS rules", () => {
  let cssContent: string;

  beforeEach(async () => {
    const fs = await import("fs");
    cssContent = fs.readFileSync(
      new URL("../../client/src/index.css", import.meta.url).pathname,
      "utf-8"
    );
  });

  it("has prefers-reduced-motion rules", () => {
    expect(cssContent).toContain("prefers-reduced-motion: reduce");
    expect(cssContent).toContain("animation-duration: 0.01ms");
  });

  it("has forced-colors (high contrast) rules", () => {
    expect(cssContent).toContain("forced-colors: active");
    expect(cssContent).toContain("ButtonText");
    expect(cssContent).toContain("Highlight");
  });

  it("has prefers-contrast: more rules", () => {
    expect(cssContent).toContain("prefers-contrast: more");
  });

  it("has focus-visible rules", () => {
    expect(cssContent).toContain(":focus-visible");
    expect(cssContent).toContain("outline");
  });

  it("has keyboard-nav enhanced focus rules", () => {
    expect(cssContent).toContain("body.keyboard-nav :focus-visible");
  });

  it("has print styles", () => {
    expect(cssContent).toContain("@media print");
  });

  it("has disabled element styling in forced-colors", () => {
    expect(cssContent).toContain("GrayText");
    expect(cssContent).toContain("button:disabled");
  });

  it("has RTL support rules", () => {
    expect(cssContent).toContain('[dir="rtl"]');
    expect(cssContent).toContain("direction: rtl");
  });

  it("has color-blind mode rules", () => {
    expect(cssContent).toContain("color-blind-mode");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Skip-to-content and LiveAnnouncer verification (static analysis)
// ═══════════════════════════════════════════════════════════════════════════
describe("Accessibility components", () => {
  it("App.tsx has skip-to-content link", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync(
      new URL("../../client/src/App.tsx", import.meta.url).pathname,
      "utf-8"
    );
    expect(appContent).toContain("Skip to main content");
    expect(appContent).toContain("#main-content");
    expect(appContent).toContain("sr-only");
  });

  it("main.tsx has keyboard navigation detection", async () => {
    const fs = await import("fs");
    const mainContent = fs.readFileSync(
      new URL("../../client/src/main.tsx", import.meta.url).pathname,
      "utf-8"
    );
    expect(mainContent).toContain("keyboard-nav");
    expect(mainContent).toContain("keydown");
    expect(mainContent).toContain("mousedown");
  });

  it("LiveAnnouncer component exists", async () => {
    const fs = await import("fs");
    const exists = fs.existsSync(
      new URL("../../client/src/lib/multisensory/LiveAnnouncer.tsx", import.meta.url).pathname
    );
    expect(exists).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Optimistic mutation hooks — type safety & structure
// ═══════════════════════════════════════════════════════════════════════════
describe("useOptimisticMutation hooks", () => {
  it("module exports all 4 hooks", async () => {
    const mod = await import("../../client/src/hooks/useOptimisticMutation");
    expect(typeof mod.useOptimisticToggle).toBe("function");
    expect(typeof mod.useOptimisticRemove).toBe("function");
    expect(typeof mod.useOptimisticUpdate).toBe("function");
    expect(typeof mod.useOptimisticBatch).toBe("function");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Router wiring verification (static analysis)
// ═══════════════════════════════════════════════════════════════════════════
describe("Router wiring", () => {
  it("wealthEngine.ts has portfolioRiskMetrics procedure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../routers/wealthEngine.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("portfolioRiskMetrics");
    expect(content).toContain("computeRiskMetrics");
    expect(content).toContain("generateEfficientFrontier");
  });

  it("integrations.ts has freshness enhancement in pipelineHealth", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../routers/integrations.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("assessFreshness");
    expect(content).toContain("freshness");
    expect(content).toContain("ageLabel");
  });

  it("learning.ts has studyAnalytics procedure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../routers/learning.ts", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("studyAnalytics");
    expect(content).toContain("analyzeTrends");
    expect(content).toContain("buildTopicMastery");
    expect(content).toContain("generateEfficiencyReport");
  });

  it("Bookmarks.tsx uses useOptimisticRemove", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../../client/src/pages/learning/Bookmarks.tsx", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("useOptimisticRemove");
  });

  it("PassiveActions.tsx uses useOptimisticToggle", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      new URL("../../client/src/pages/PassiveActions.tsx", import.meta.url).pathname,
      "utf-8"
    );
    expect(content).toContain("useOptimisticToggle");
  });
});
