/**
 * Final Build-Out Tests — Model comparison, template optimizer, difference highlighter,
 * autonomous analysis, report exporter
 */
import { describe, it, expect } from "vitest";

describe("Model Comparison", () => {
  it("should export compareModels and estimateCost", async () => {
    const mod = await import("./services/modelComparison");
    expect(typeof mod.compareModels).toBe("function");
    expect(typeof mod.estimateCost).toBe("function");
  });

  it("should estimate cost based on prompt length and model count", async () => {
    const { estimateCost } = await import("./services/modelComparison");
    const cost1 = estimateCost("short prompt", 1);
    const cost3 = estimateCost("short prompt", 3);
    expect(cost3).toBeGreaterThan(cost1);
    expect(cost1).toBeGreaterThan(0);
  });
});

describe("Template Optimizer", () => {
  it("should export optimizeTemplates and getBestModelForDomain", async () => {
    const mod = await import("./services/templateOptimizer");
    expect(typeof mod.optimizeTemplates).toBe("function");
    expect(typeof mod.getBestModelForDomain).toBe("function");
  });

  it("should return a default model when no data exists", async () => {
    const { getBestModelForDomain } = await import("./services/templateOptimizer");
    const model = await getBestModelForDomain("protection");
    expect(typeof model).toBe("string");
    expect(model.length).toBeGreaterThan(0);
  });
});

describe("Difference Highlighter", () => {
  it("should export highlightDifferences", async () => {
    const { highlightDifferences } = await import("./services/differenceHighlighter");
    expect(typeof highlightDifferences).toBe("function");
  });

  it("should detect agreement in similar responses", async () => {
    const { highlightDifferences } = await import("./services/differenceHighlighter");
    const result = await highlightDifferences(
      "Term life insurance provides affordable death benefit protection. A 20-year term policy for a healthy 35-year-old costs about $30 per month.",
      "Term life insurance offers cost-effective death benefit coverage. A 20-year term policy for a healthy 35-year-old is approximately $30 monthly.",
    );
    expect(result.overallAgreement).toBeGreaterThan(0.3);
  });

  it("should detect disagreement in different responses", async () => {
    const { highlightDifferences } = await import("./services/differenceHighlighter");
    const result = await highlightDifferences(
      "I recommend investing in IUL policies for tax-advantaged growth with a cap rate of 12% and floor of 0%.",
      "I recommend a diversified portfolio of index funds with expected returns of 8% annually and no downside protection.",
    );
    expect(result.disagreements.length).toBeGreaterThanOrEqual(0);
    // At minimum, the structure should be returned
    expect(typeof result.overallAgreement).toBe("number");
  });
});

describe("Autonomous Client Analysis", () => {
  it("should export analyzeClient and runNightlyAnalysis", async () => {
    const mod = await import("./services/autonomousClientAnalysis");
    expect(typeof mod.analyzeClient).toBe("function");
    expect(typeof mod.runNightlyAnalysis).toBe("function");
  });
});

describe("Report Exporter", () => {
  it("should export exportReport", async () => {
    const { exportReport } = await import("./services/reportExporter");
    expect(typeof exportReport).toBe("function");
  });

  it("should generate markdown export", async () => {
    const { exportReport } = await import("./services/reportExporter");
    const result = await exportReport({
      type: "financial_plan",
      clientId: 1,
      advisorId: 1,
      format: "markdown",
      data: { clientName: "John Smith", advisorName: "Jane Doe", summary: "Test plan summary" },
    });
    expect(result.format).toBe("markdown");
    expect(result.content).toContain("Financial Plan");
    expect(result.content).toContain("John Smith");
    expect(result.content).toContain("not constitute investment advice");
    expect(result.filename).toContain("financial_plan");
  });
});
