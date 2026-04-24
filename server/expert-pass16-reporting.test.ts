/**
 * Expert Pass 16 — Weekly Summary & Reporting
 * Validates summary generation with correct WeeklySummaryInput interface.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
const ROOT = path.resolve(__dirname, "..");

describe("Expert Pass 16 — Reporting & Export", () => {
  it("weeklySummaryGeneration exports buildStaticSummary", async () => {
    const { buildStaticSummary } = await import("./services/weeklySummaryGeneration");
    expect(typeof buildStaticSummary).toBe("function");
  });
  it("buildStaticSummary returns a markdown string", async () => {
    const { buildStaticSummary } = await import("./services/weeklySummaryGeneration");
    const r = buildStaticSummary({
      advisorName: "Mike Penn",
      weekStartDate: "2026-04-14",
      weekEndDate: "2026-04-20",
      currentPattern: "Pattern 4",
      headlineMetric: { name: "AUM Signed", value: 2500000, unit: "USD", weekOverWeekChange: 15, isPositive: true },
      pipelineCoverage: { discoveryValue: 500000, solutionDesignValue: 300000, validationValue: 200000, commitValue: 100000, targetQuotaValue: 250000, coverageHealth: "healthy" },
      funnelSnapshots: [{ funnelName: "Recruit", leadsEntered: 50, leadsQualified: 20, leadsConverted: 5, conversionRate: 0.1, avgDaysInPipeline: 30, totalPipelineValue: 500000, touchesSent: 200 }],
      complianceHealth: { totalTouchesSent: 200, touchesAudited: 20, auditPassRate: 0.95, failCount: 1, conditionalPassCount: 2, topFindings: ["Missing disclaimer"], esiExpiringThisMonth: 0, optOutsProcessed: 3 },
      variances: [{ metric: "CAC", expected: 500, actual: 450, variancePct: -10, direction: "below" }],
      actionItems: [{ id: "a1", description: "Review ESI renewals", priority: "high", dueDate: "2026-04-25", assignedTo: "Mike" }],
      nextWeekFocus: ["Close 2 pending deals", "Onboard new producer"],
    });
    expect(typeof r).toBe("string");
    expect(r).toContain("Weekly Summary");
    expect(r).toContain("Mike Penn");
  });
  it("exportService module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/exportService.ts"))).toBe(true);
  });
  it("reportExporter module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/reportExporter.ts"))).toBe(true);
  });
  it("pdfGenerator module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/pdfGenerator.ts"))).toBe(true);
  });
  it("pdfReportGenerator module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/pdfReportGenerator.ts"))).toBe(true);
  });
  it("practicePlanPdf module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/practicePlanPdf.ts"))).toBe(true);
  });
  it("documentTemplates module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/documentTemplates.ts"))).toBe(true);
  });
  it("documentExtractor module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/documentExtractor.ts"))).toBe(true);
  });
  it("usageTracker module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/usageTracker.ts"))).toBe(true);
  });
  it("syncMetrics module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/syncMetrics.ts"))).toBe(true);
  });
  it("syncHistory module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/syncHistory.ts"))).toBe(true);
  });
  it("differenceHighlighter module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/differenceHighlighter.ts"))).toBe(true);
  });
  it("modelComparison module exists", () => {
    expect(fs.existsSync(path.join(ROOT, "server/services/modelComparison.ts"))).toBe(true);
  });
});
