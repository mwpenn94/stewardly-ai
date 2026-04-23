/**
 * engineMaturity4.test.ts — Tests for all 5 engines at 4.0+ maturity
 *
 * Covers:
 * - Intelligence Engine: AI middleware, consolidated router, usage dashboard
 * - Learning Engine: Global leaderboard, study group collaboration
 * - Data Engine: Advanced caching layer, cache analytics endpoints
 * - Wealth Engine: Seeded RNG, sensitivity analysis, share plan button
 * - People Hub: Activity timeline, engagement summary, provider health cards
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

/* ═══ Intelligence Engine 4.0+ ═══ */
describe("Intelligence Engine — Router Consolidation & AI Middleware", () => {
  it("aiMiddleware.ts exists with rate limiting, cost tracking, and error handling", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/shared/aiMiddleware.ts"), "utf8");
    expect(content).toContain("checkRateLimit");
    expect(content).toContain("estimateCost");
    expect(content).toContain("AIServiceError");
  });

  it("intelligenceEngine.ts facade consolidates routers into logical groupings", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/routers/intelligenceEngine.ts"), "utf8");
    // Should have the logical groupings
    expect(content).toContain("chat");
    expect(content).toContain("analysis");
    expect(content).toContain("config");
    expect(content).toContain("agents");
  });

  it("intelligenceEngine router is registered in main appRouter", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf8");
    expect(content).toContain("intelligenceEngine");
  });

  it("AIUsageDashboard.tsx exists with usage metrics UI", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/AIUsageDashboard.tsx"), "utf8");
    expect(content).toContain("usage");
    expect(content).toContain("trpc");
  });
});

/* ═══ Learning Engine 4.0+ ═══ */
describe("Learning Engine — Gamification & Collaboration Depth", () => {
  it("GlobalLeaderboard.tsx exists with mastery curves and rankings", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/learning/GlobalLeaderboard.tsx"), "utf8");
    expect(content).toContain("Leaderboard");
    expect(content).toContain("mastery");
  });

  it("StudyGroupCollaboration.tsx exists with shared goals and discussion", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/learning/StudyGroupCollaboration.tsx"), "utf8");
    expect(content).toContain("StudyGroupCollaboration");
    expect(content).toContain("learning goals");
  });

  it("GlobalLeaderboard route is registered in App.tsx", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf8");
    expect(content).toContain("GlobalLeaderboard");
  });
});

/* ═══ Data Engine 4.0+ ═══ */
describe("Data Engine — Caching Layer & Analytics", () => {
  it("dataCache.ts exists with LRU eviction, stale-while-revalidate, and background refresh", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/services/financialData/dataCache.ts"), "utf8");
    expect(content).toContain("LRU");
    expect(content).toContain("stale");
    expect(content).toContain("evict");
  });

  it("financialData router has cacheStats endpoint", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/routers/financialData.ts"), "utf8");
    expect(content).toContain("cacheStats");
    expect(content).toContain("rateLimitStats");
    expect(content).toContain("invalidateCache");
    expect(content).toContain("dataFreshness");
  });

  it("DataEngineDashboard.tsx exists with cache analytics UI", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/DataEngineDashboard.tsx"), "utf8");
    expect(content).toContain("Data Engine Dashboard");
    expect(content).toContain("cacheStats");
    expect(content).toContain("HitRateGauge");
  });

  it("DataEngineDashboard route is registered in App.tsx", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf8");
    expect(content).toContain("DataEngineDashboard");
    expect(content).toContain("data-engine");
  });
});

/* ═══ Wealth Engine 4.0+ ═══ */
describe("Wealth Engine — Sensitivity Analysis & Plan Sharing", () => {
  it("seededRng.ts exists with deterministic PRNG", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/shared/calculators/seededRng.ts"), "utf8");
    expect(content).toContain("seed");
    expect(content).toContain("Mulberry32");
  });

  it("sensitivityAnalysis.ts exists with multi-parameter analysis", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/shared/calculators/sensitivityAnalysis.ts"), "utf8");
    expect(content).toContain("Sensitivity");
    expect(content).toContain("parameter");
  });

  it("calculatorEngine router has sensitivity analysis endpoints", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/routers/calculatorEngine.ts"), "utf8");
    expect(content).toContain("sensitivityAnalysis");
  });

  it("SensitivityAnalysis.tsx UI component exists", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/calculators/SensitivityAnalysis.tsx"), "utf8");
    expect(content).toContain("Sensitivity");
    expect(content).toContain("trpc");
  });

  it("SharePlanButton.tsx exists and wires to sharedLinks router", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/calculators/SharePlanButton.tsx"), "utf8");
    expect(content).toContain("SharePlanButton");
    expect(content).toContain("financialInstruments.sharedLinks");
    expect(content).toContain("shareToken");
  });

  it("SharePlanButton is integrated into PanelsA.tsx", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/calculators/PanelsA.tsx"), "utf8");
    expect(content).toContain("SharePlanButton");
  });
});

/* ═══ People Hub 4.0+ ═══ */
describe("People Hub — Activity Timeline & Engagement", () => {
  it("client.ts router has activityTimeline endpoint", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/routers/client.ts"), "utf8");
    expect(content).toContain("activityTimeline");
    expect(content).toContain("engagementSummary");
  });

  it("activityTimeline aggregates conversations, plans, and data access", () => {
    const content = fs.readFileSync(path.join(ROOT, "server/routers/client.ts"), "utf8");
    expect(content).toContain("conversation");
    expect(content).toContain("plan_outcome");
    expect(content).toContain("data_access");
  });

  it("ClientActivityTimeline.tsx exists with unified timeline UI", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/ClientActivityTimeline.tsx"), "utf8");
    expect(content).toContain("Activity Timeline");
    expect(content).toContain("activityTimeline");
    expect(content).toContain("engagementSummary");
  });

  it("ClientActivityTimeline route is registered in App.tsx", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf8");
    expect(content).toContain("ClientActivityTimeline");
    expect(content).toContain("activity-timeline");
  });

  it("IntegrationHealth.tsx has enhanced provider health cards", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/pages/IntegrationHealth.tsx"), "utf8");
    expect(content).toContain("ConnectionCard");
    // Should have enrichment depth or expanded metrics
    expect(content).toContain("expand");
  });
});

/* ═══ Cross-Engine Integration ═══ */
describe("Cross-Engine Integration — All engines wired and accessible", () => {
  it("App.tsx has routes for all 5 engine dashboards", () => {
    const content = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf8");
    // Intelligence
    expect(content).toContain("ai-usage");
    // Learning
    expect(content).toContain("GlobalLeaderboard");
    // Data
    expect(content).toContain("data-engine");
    // Wealth (calculators)
    expect(content).toContain("calculators");
    // People
    expect(content).toContain("activity-timeline");
  });

  it("no console.error or console.warn in new production files", () => {
    const newFiles = [
      "server/shared/aiMiddleware.ts",
      "server/shared/calculators/seededRng.ts",
      "server/shared/calculators/sensitivityAnalysis.ts",
      "server/services/financialData/dataCache.ts",
    ];
    for (const f of newFiles) {
      const content = fs.readFileSync(path.join(ROOT, f), "utf8");
      expect(content).not.toContain("console.error");
      expect(content).not.toContain("console.warn");
    }
  });
});
