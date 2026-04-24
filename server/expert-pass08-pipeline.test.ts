/**
 * Expert Pass 8 — Pipeline & Funnel
 * Validates funnel metrics with correct FunnelInput interface.
 */
import { describe, it, expect } from "vitest";

const SAMPLE_FUNNEL_INPUT = {
  funnelId: "f-test-1",
  funnelName: "Test Funnel",
  period: { startDate: "2026-01-01", endDate: "2026-01-31" },
  spend: 5000,
  touchesSent: 500,
  leadsEntered: 100,
  leadsQualified: 40,
  leadsSolutionDesign: 20,
  leadsValidation: 10,
  leadsCommit: 5,
  leadsConverted: 3,
  avgDaysToConvert: 45,
  revenue: 30000,
  cogs: 5000,
  avgClientRetentionMonths: 24,
  referralsGenerated: 2,
  referralConversions: 1,
  referralRevenue: 10000,
  referralSpend: 500,
};

describe("Expert Pass 8 — Pipeline & Funnel", () => {
  it("calculateFunnelMetrics returns costs with CAC", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const r = calculateFunnelMetrics(SAMPLE_FUNNEL_INPUT);
    expect(r.costs.cac).toBeGreaterThan(0);
  });
  it("calculateFunnelMetrics returns revenue metrics", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const r = calculateFunnelMetrics(SAMPLE_FUNNEL_INPUT);
    expect(r.revenue).toBeDefined();
  });
  it("calculateFunnelMetrics returns LTV metrics", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const r = calculateFunnelMetrics(SAMPLE_FUNNEL_INPUT);
    expect(r.ltv).toBeDefined();
  });
  it("calculateFunnelMetrics returns conversion funnel", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const r = calculateFunnelMetrics(SAMPLE_FUNNEL_INPUT);
    expect(r.conversionFunnel).toBeDefined();
    expect(r.conversionFunnel.entered).toBe(100);
  });
  it("calculateFunnelRollup aggregates multiple funnels", async () => {
    const { calculateFunnelMetrics, calculateFunnelRollup } = await import("./services/funnelMetrics");
    const f1 = calculateFunnelMetrics(SAMPLE_FUNNEL_INPUT);
    const f2 = calculateFunnelMetrics({ ...SAMPLE_FUNNEL_INPUT, funnelId: "f-test-2", funnelName: "Funnel 2" });
    const rollup = calculateFunnelRollup([f1, f2]);
    expect(rollup).toBeDefined();
    expect(rollup.totalFunnels).toBe(2);
  });
  it("getExpectedMetrics returns array", async () => {
    const { getExpectedMetrics } = await import("./services/funnelMetrics");
    const expected = getExpectedMetrics();
    expect(Array.isArray(expected)).toBe(true);
  });
  it("funnel metrics handles zero conversions gracefully", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const r = calculateFunnelMetrics({ ...SAMPLE_FUNNEL_INPUT, leadsConverted: 0, revenue: 0 });
    expect(r).toBeDefined();
    expect(r.costs.cac).toBe(0); // 0 conversions = 0 CAC (safeDiv)
  });
  it("calculatePipelineCoverage returns coverage object", async () => {
    const { calculatePipelineCoverage } = await import("./services/patternTransition");
    const cov = calculatePipelineCoverage({
      discoveryValue: 500000, solutionDesignValue: 300000,
      validationValue: 200000, commitValue: 100000, targetQuotaValue: 250000,
    });
    expect(cov).toBeDefined();
    expect(typeof cov.discoveryMultiple).toBe("number");
  });
  it("assessTransition returns TransitionAssessment", async () => {
    const { assessTransition } = await import("./services/patternTransition");
    const r = assessTransition({
      aumSignedThisMonth: 3000000, dealsAbove500K: 3, activeAffiliates: 5,
      newProducersOnboarded: 2, totalPipelineValue: 10000000,
      conversionRate: 0.08, avgDealSize: 500000, monthlyRecurringRevenue: 20000,
    });
    expect(r).toBeDefined();
    expect(["stay", "prepare_transition", "transition_ready"]).toContain(r.recommendation);
    expect(typeof r.readinessScore).toBe("number");
  });
});
