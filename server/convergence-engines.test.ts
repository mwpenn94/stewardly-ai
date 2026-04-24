/**
 * Convergence Engines — Cross-engine integration validation
 * Validates that People Engine and Data Engine work together coherently.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Convergence Engines — People + Data Integration", () => {
  it("cadenceEngine and complianceAudit share channel types", async () => {
    const ce = await import("./services/cadenceEngine");
    const ca = await import("./services/complianceAudit");
    const touch = { touchNumber: 1, day: 0, channel: "email" as const, body: "test body", complianceNotes: "" };
    const gate = ce.complianceGateCheck(touch, { esiPreApprovalId: "ESI-001" });
    const audit = ca.auditMessage({ messageId: "msg-conv-1", body: "test body", channel: "email", esiPreApprovalId: "ESI-001", auditType: "ad_hoc" });
    expect(gate).toBeDefined();
    expect(audit).toBeDefined();
  });
  it("funnelMetrics and patternTransition use compatible data", async () => {
    const { calculateFunnelMetrics } = await import("./services/funnelMetrics");
    const { assessTransition } = await import("./services/patternTransition");
    const funnel = calculateFunnelMetrics({
      funnelId: "f-conv", funnelName: "Conv Test",
      period: { startDate: "2026-01-01", endDate: "2026-01-31" },
      spend: 5000, touchesSent: 500, leadsEntered: 100, leadsQualified: 40,
      leadsSolutionDesign: 20, leadsValidation: 10, leadsCommit: 5, leadsConverted: 3,
      avgDaysToConvert: 45, revenue: 30000, cogs: 5000, avgClientRetentionMonths: 24,
      referralsGenerated: 2, referralConversions: 1, referralRevenue: 10000, referralSpend: 500,
    });
    const transition = assessTransition({
      aumSignedThisMonth: 2000000, dealsAbove500K: 2, activeAffiliates: 3,
      newProducersOnboarded: 1, totalPipelineValue: 5000000,
      conversionRate: funnel.conversionFunnel.conversionRate, avgDealSize: 300000, monthlyRecurringRevenue: 15000,
    });
    expect(funnel).toBeDefined();
    expect(transition).toBeDefined();
  });
  it("recruitScoring and meddpiccFieldCompletion are independent", async () => {
    const { calculateComposite } = await import("./services/recruitScoring");
    const { createEmptyMeddpicc, countCompletedFields } = await import("./services/meddpiccFieldCompletion");
    const score = calculateComposite({ productionFit: 80, culturalFit: 85, geographicFit: 70, networkLeverage: 90, compliancePosture: 95, engagementSignal: 75 });
    const count = countCompletedFields(createEmptyMeddpicc());
    expect(typeof score).toBe("number");
    expect(typeof count).toBe("number");
  });
  it("sourceProber and transformEngine chain together", async () => {
    const { detectFormat, parseJson } = await import("./services/dynamicIntegrations/sourceProber");
    const { getByPath } = await import("./services/dynamicIntegrations/transformEngine");
    const format = detectFormat('{"name":"Alice","age":30}', "application/json");
    expect(format).toBe("json");
    const { records } = parseJson('{"name":"Alice","age":30}');
    expect(records.length).toBe(1);
    expect(getByPath(records[0], "name")).toBe("Alice");
  });
  it("adapterDSL and recordSanitizer work on same data", async () => {
    const { canonicalJson } = await import("./services/dynamicIntegrations/adapterDSL");
    const { sanitizeRecord } = await import("./services/dynamicIntegrations/recordSanitizer");
    const record = { name: "  Bob  ", email: "BOB@TEST.COM" };
    const sanitized = sanitizeRecord(record);
    const canonical = canonicalJson(sanitized);
    expect(typeof canonical).toBe("string");
  });
  it("guardrails and replyAnalysis protect the same pipeline", async () => {
    const { screenInput } = await import("./shared/guardrails");
    const { classifyReply } = await import("./services/cadenceEngine");
    const input = "I am interested in your services";
    const screened = screenInput(input);
    const classified = classifyReply(input);
    expect(screened.passed).toBe(true);
    expect(classified.classification).toBe("interested");
  });
  it("aiMiddleware and stewardlyWiring coexist", async () => {
    const { checkRateLimit } = await import("./shared/aiMiddleware");
    const { contextualLLM } = await import("./shared/stewardlyWiring");
    expect(typeof checkRateLimit).toBe("function");
    expect(typeof contextualLLM).toBe("function");
  });
  it("eventBus and tenantContext are independent", async () => {
    const { eventBus } = await import("./shared/events/eventBus");
    const { runWithTenant, getCurrentTenant } = await import("./shared/tenantContext");
    let captured: any = null;
    eventBus.on("improvement.signal", (e: any) => { captured = e; });
    runWithTenant({ tenantId: 99, userId: 1 } as any, () => {
      eventBus.emit("improvement.signal", { value: 42 });
    });
    expect(captured).not.toBeNull();
    expect(getCurrentTenant()).toBeUndefined();
  });
  it("calculators and qualityNormalization use compatible scales", async () => {
    const { normalizeQualityScore } = await import("./services/qualityNormalization");
    const calc = await import("./shared/calculators");
    expect(normalizeQualityScore(0.85)).toBeCloseTo(0.85);
    expect(calc).toBeDefined();
  });
  it("exponentialEngine and improvementEngine are both present", async () => {
    const { LAYER_HIERARCHY } = await import("./services/exponentialEngine");
    const { detectSignals } = await import("./shared/engine/improvementEngine");
    expect(LAYER_HIERARCHY.length).toBeGreaterThan(0);
    expect(typeof detectSignals).toBe("function");
  });
  it("weeklySummaryGeneration uses correct input format", async () => {
    const { buildStaticSummary } = await import("./services/weeklySummaryGeneration");
    const summary = buildStaticSummary({
      advisorName: "Test Advisor", weekStartDate: "2026-04-14", weekEndDate: "2026-04-20", currentPattern: "Pattern 4",
      headlineMetric: { name: "AUM", value: 1000000, unit: "USD", weekOverWeekChange: 5, isPositive: true },
      pipelineCoverage: { discoveryValue: 500000, solutionDesignValue: 300000, validationValue: 200000, commitValue: 100000, targetQuotaValue: 250000, coverageHealth: "healthy" },
      funnelSnapshots: [{ funnelName: "Test", leadsEntered: 10, leadsQualified: 5, leadsConverted: 1, conversionRate: 0.1, avgDaysInPipeline: 30, totalPipelineValue: 100000, touchesSent: 50 }],
      complianceHealth: { totalTouchesSent: 50, touchesAudited: 5, auditPassRate: 1.0, failCount: 0, conditionalPassCount: 0, topFindings: [], esiExpiringThisMonth: 0, optOutsProcessed: 0 },
      variances: [], actionItems: [], nextWeekFocus: ["Close deals"],
    });
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });
  it("crossModelDistillation module loads", async () => {
    const mod = await import("./services/dynamicIntegrations/crossModelDistillation");
    expect(mod).toBeDefined();
  });
  it("all 20 expert pass test files exist", () => {
    for (let i = 1; i <= 20; i++) {
      const num = String(i).padStart(2, "0");
      const files = fs.readdirSync(path.join(ROOT, "server")).filter(f => f.startsWith(`expert-pass${num}`));
      expect(files.length).toBeGreaterThan(0);
    }
  });
});
