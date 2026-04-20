/**
 * v8.3 Pass 11 — Recommended Next Steps Regression Tests
 *
 * Tests notification workflows, usage analytics, signal bridge,
 * and greeting fix.
 */
import { describe, it, expect } from "vitest";

// ─── Notification Workflow Service ──────────────────────────────────────────
describe("Notification Workflow Service", () => {
  it("dispatchWorkflowEvent is a function", async () => {
    const mod = await import("../../../../server/services/notificationWorkflows");
    expect(typeof mod.dispatchWorkflowEvent).toBe("function");
  });

  it("getWorkflowRules returns an array", async () => {
    const mod = await import("../../../../server/services/notificationWorkflows");
    const rules = mod.getWorkflowRules();
    expect(Array.isArray(rules)).toBe(true);
  });

  it("default rules include lead and compliance types", async () => {
    const mod = await import("../../../../server/services/notificationWorkflows");
    const rules = mod.getWorkflowRules();
    const eventTypes = rules.map((r: any) => r.eventType);
    expect(eventTypes).toContain("lead.created");
    expect(eventTypes).toContain("compliance.license_expiring");
  });

  it("dispatchWorkflowEvent handles unknown event type gracefully", async () => {
    const mod = await import("../../../../server/services/notificationWorkflows");
    // Should not throw
    mod.dispatchWorkflowEvent({
      type: "unknown.event.type",
      userId: 1,
      data: {},
      timestamp: Date.now(),
    });
  });

  it("rules have required fields: id, eventType, description", async () => {
    const mod = await import("../../../../server/services/notificationWorkflows");
    const rules = mod.getWorkflowRules();
    for (const rule of rules) {
      expect(rule).toHaveProperty("id");
      expect(rule).toHaveProperty("eventType");
      expect(rule).toHaveProperty("description");
      expect(typeof rule.description).toBe("string");
    }
  });
});

// ─── Improvement Signal Bridge ──────────────────────────────────────────────
describe("Improvement Signal Bridge", () => {
  it("exports all 6 loop processors", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    expect(typeof mod.processTransactionSignal).toBe("function");
    expect(typeof mod.processUserActionSignal).toBe("function");
    expect(typeof mod.checkDataFreshness).toBe("function");
    expect(typeof mod.processModelQualitySignal).toBe("function");
    expect(typeof mod.processComplianceSignal).toBe("function");
    expect(typeof mod.getPerformanceMetrics).toBe("function");
  });

  it("getSignalBridgeMetrics returns aggregated data", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    mod.resetSignalBridgeMetrics();
    const metrics = mod.getSignalBridgeMetrics();
    expect(metrics).toHaveProperty("transactionSyncs");
    expect(metrics).toHaveProperty("totalTransactions");
    expect(metrics).toHaveProperty("featureUsage");
    expect(metrics).toHaveProperty("dataFreshness");
    expect(metrics).toHaveProperty("performance");
    expect(metrics).toHaveProperty("satisfactionRate");
    expect(metrics).toHaveProperty("complianceRate");
  });

  it("processTransactionSignal increments counters", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    mod.resetSignalBridgeMetrics();
    mod.processTransactionSignal({
      userId: "test-1",
      accountId: "acc-1",
      transactionCount: 10,
      totalAmount: 5000,
      categories: ["food", "transport"],
      dateRange: { start: "2026-01-01", end: "2026-01-31" },
      syncLatencyMs: 500,
    });
    const metrics = mod.getSignalBridgeMetrics();
    expect(metrics.transactionSyncs).toBe(1);
    expect(metrics.totalTransactions).toBe(10);
    expect(metrics.avgSyncLatencyMs).toBe(500);
  });

  it("processUserActionSignal tracks feature usage", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    mod.resetSignalBridgeMetrics();
    mod.processUserActionSignal({
      userId: "test-1",
      action: "simulate",
      feature: "wealth-engine",
      durationMs: 200,
      success: true,
    });
    mod.processUserActionSignal({
      userId: "test-1",
      action: "chat",
      feature: "chat",
      durationMs: 100,
      success: true,
    });
    const metrics = mod.getSignalBridgeMetrics();
    expect(metrics.userActions).toBe(2);
    expect(metrics.featureUsage["wealth-engine"]).toBe(1);
    expect(metrics.featureUsage["chat"]).toBe(1);
  });

  it("processModelQualitySignal tracks satisfaction", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    mod.resetSignalBridgeMetrics();
    mod.processModelQualitySignal({ userId: "t", conversationId: 1, messageId: 1, rating: "up" });
    mod.processModelQualitySignal({ userId: "t", conversationId: 1, messageId: 2, rating: "up" });
    mod.processModelQualitySignal({ userId: "t", conversationId: 1, messageId: 3, rating: "down" });
    const metrics = mod.getSignalBridgeMetrics();
    expect(metrics.feedbackPositive).toBe(2);
    expect(metrics.feedbackNegative).toBe(1);
    expect(metrics.satisfactionRate).toBe(67); // 2/3 = 66.7 -> 67
  });

  it("processComplianceSignal tracks compliance rate", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    mod.resetSignalBridgeMetrics();
    mod.processComplianceSignal({ userId: "t", checkType: "license", passed: true });
    mod.processComplianceSignal({ userId: "t", checkType: "ce", passed: true });
    mod.processComplianceSignal({ userId: "t", checkType: "aml", passed: false });
    const metrics = mod.getSignalBridgeMetrics();
    expect(metrics.complianceChecks).toBe(3);
    expect(metrics.compliancePassed).toBe(2);
    expect(metrics.complianceRate).toBe(67);
  });

  it("checkDataFreshness returns freshness status", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    mod.resetSignalBridgeMetrics();
    const freshness = mod.checkDataFreshness();
    expect(freshness).toHaveProperty("lastSync");
    expect(freshness).toHaveProperty("staleness");
    expect(freshness).toHaveProperty("isStale");
    expect(freshness.isStale).toBe(false); // Just reset, so not stale
  });

  it("getPerformanceMetrics returns error rate", async () => {
    const mod = await import("../../../../server/services/improvementSignalBridge");
    mod.resetSignalBridgeMetrics();
    mod.processUserActionSignal({ userId: "t", action: "x", feature: "chat", durationMs: 100, success: true });
    mod.processUserActionSignal({ userId: "t", action: "y", feature: "chat", durationMs: 100, success: false });
    const perf = mod.getPerformanceMetrics();
    expect(perf.totalActions).toBe(2);
    expect(perf.errorRate).toBe(0.5);
  });
});

// ─── Greeting Fix (en.ts) ──────────────────────────────────────────────────
describe("Greeting Fix", () => {
  it("en.ts chat.greeting does not start with Good", async () => {
    const mod = await import("../../../../client/src/locales/en");
    const en = mod.default || mod.en || mod;
    // The greeting template should be "{{timeOfDay}}, {{name}}" not "Good {{timeOfDay}}, {{name}}"
    const greeting = en?.chat?.greeting || en?.["chat.greeting"] || "";
    expect(greeting).not.toMatch(/^Good\s/);
    expect(greeting).toContain("{{timeOfDay}}");
    expect(greeting).toContain("{{name}}");
  });

  it("en.ts common time-of-day values include Good prefix", async () => {
    const mod = await import("../../../../client/src/locales/en");
    const en = mod.default || mod.en || mod;
    const common = en?.common || {};
    // These should be complete greetings like "Good morning"
    if (common.morning) expect(common.morning).toMatch(/^Good morning$/i);
    if (common.afternoon) expect(common.afternoon).toMatch(/^Good afternoon$/i);
    if (common.evening) expect(common.evening).toMatch(/^Good evening$/i);
  });
});

// ─── Usage Analytics Router (structure check) ───────────────────────────────
describe("Usage Analytics Router", () => {
  it("usageAnalytics router exports exist", async () => {
    const mod = await import("../../../../server/routers/usageAnalytics");
    expect(mod.usageAnalyticsRouter).toBeDefined();
  });
});

// ─── Admin Usage Analytics Page (structure check) ───────────────────────────
describe("AdminUsageAnalytics Page", () => {
  it("exports a default component", async () => {
    const mod = await import("../../../../client/src/pages/AdminUsageAnalytics");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
