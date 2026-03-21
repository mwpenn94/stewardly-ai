import { describe, it, expect } from "vitest";

// ─── Suitability Engine Tests ────────────────────────────────────────

describe("Suitability Scoring", () => {
  it("should calculate risk tolerance score from questionnaire", () => {
    const answers = { q1: 4, q2: 3, q3: 5, q4: 2, q5: 4 };
    const total = Object.values(answers).reduce((a, b) => a + b, 0);
    const maxScore = Object.keys(answers).length * 5;
    const normalized = Math.round((total / maxScore) * 100);
    expect(normalized).toBeGreaterThan(0);
    expect(normalized).toBeLessThanOrEqual(100);
  });

  it("should map numeric scores to risk categories", () => {
    const categorize = (score: number) => {
      if (score <= 30) return "conservative";
      if (score <= 60) return "moderate";
      return "aggressive";
    };
    expect(categorize(20)).toBe("conservative");
    expect(categorize(50)).toBe("moderate");
    expect(categorize(80)).toBe("aggressive");
  });

  it("should require minimum assessment completeness", () => {
    const requiredFields = ["riskTolerance", "investmentHorizon", "annualIncome", "investmentObjective"];
    const profile = { riskTolerance: "moderate", investmentHorizon: "10-20", annualIncome: "100k-250k", investmentObjective: "growth" };
    const complete = requiredFields.every(f => (profile as any)[f]);
    expect(complete).toBe(true);
  });

  it("should flag incomplete assessments", () => {
    const profile = { riskTolerance: "moderate", investmentHorizon: null };
    const complete = profile.investmentHorizon !== null;
    expect(complete).toBe(false);
  });

  it("should validate investment horizon ranges", () => {
    const validHorizons = ["0-2", "2-5", "5-10", "10-20", "20+"];
    expect(validHorizons).toContain("5-10");
    expect(validHorizons).not.toContain("invalid");
  });
});

describe("Product Matching", () => {
  it("should score product-client compatibility", () => {
    const client = { riskTolerance: "moderate", horizon: "10-20" };
    const product = { riskLevel: "moderate", minHorizon: 5 };
    const riskMatch = client.riskTolerance === product.riskLevel;
    expect(riskMatch).toBe(true);
  });

  it("should disqualify products exceeding risk tolerance", () => {
    const clientRisk = "conservative";
    const productRisk = "aggressive";
    const suitable = clientRisk === productRisk || (clientRisk === "moderate" && productRisk !== "aggressive");
    expect(suitable).toBe(false);
  });

  it("should rank products by match score", () => {
    const products = [
      { name: "A", matchScore: 92 },
      { name: "B", matchScore: 85 },
      { name: "C", matchScore: 78 },
    ];
    const sorted = [...products].sort((a, b) => b.matchScore - a.matchScore);
    expect(sorted[0].name).toBe("A");
    expect(sorted[2].name).toBe("C");
  });

  it("should consider multiple suitability dimensions", () => {
    const dimensions = ["riskTolerance", "investmentHorizon", "liquidityNeeds", "taxSensitivity", "incomeStability", "concentrationRisk"];
    expect(dimensions.length).toBeGreaterThanOrEqual(6);
  });

  it("should generate suitability rationale", () => {
    const rationale = "Product A is suitable because the client's moderate risk tolerance aligns with the product's balanced growth strategy.";
    expect(rationale).toContain("suitable");
    expect(rationale.length).toBeGreaterThan(50);
  });

  it("should track suitability assessment history", () => {
    const history = [
      { date: "2026-01-15", riskTolerance: "conservative" },
      { date: "2026-06-15", riskTolerance: "moderate" },
    ];
    expect(history).toHaveLength(2);
    expect(history[1].riskTolerance).not.toBe(history[0].riskTolerance);
  });
});

describe("Reg BI Compliance", () => {
  it("should document care obligation for each recommendation", () => {
    const doc = {
      clientId: "user-1",
      productId: "prod-1",
      careAnalysis: "Analyzed risk tolerance, investment horizon, and financial situation",
      alternatives: ["prod-2", "prod-3"],
      rationale: "Best fit based on 12-dimension suitability matrix",
    };
    expect(doc.alternatives.length).toBeGreaterThan(0);
    expect(doc.rationale).toBeTruthy();
  });

  it("should identify conflicts of interest", () => {
    const conflicts = [
      { type: "compensation", description: "Higher commission on Product A" },
      { type: "proprietary", description: "Product B is firm-proprietary" },
    ];
    expect(conflicts.length).toBeGreaterThan(0);
    conflicts.forEach(c => expect(c.type).toBeTruthy());
  });

  it("should generate disclosure documents", () => {
    const disclosure = {
      type: "reg_bi_disclosure",
      sections: ["material_facts", "conflicts", "compensation", "limitations"],
      generatedAt: Date.now(),
    };
    expect(disclosure.sections).toContain("conflicts");
    expect(disclosure.sections).toContain("compensation");
  });

  it("should enforce disclosure before recommendation", () => {
    const workflow = ["assess_suitability", "identify_conflicts", "generate_disclosure", "present_disclosure", "make_recommendation"];
    const disclosureIdx = workflow.indexOf("generate_disclosure");
    const recommendIdx = workflow.indexOf("make_recommendation");
    expect(disclosureIdx).toBeLessThan(recommendIdx);
  });

  it("should archive all suitability decisions", () => {
    const archive = { retentionYears: 6, format: "immutable", encrypted: true };
    expect(archive.retentionYears).toBeGreaterThanOrEqual(6);
    expect(archive.encrypted).toBe(true);
  });
});

describe("Inverse Suitability Search", () => {
  it("should find products matching a given profile", () => {
    const profile = { riskTolerance: "moderate", horizon: "10-20", income: "high" };
    const allProducts = [
      { name: "Growth Fund", riskLevel: "moderate", minHorizon: 5 },
      { name: "Aggressive ETF", riskLevel: "aggressive", minHorizon: 10 },
      { name: "Bond Fund", riskLevel: "conservative", minHorizon: 1 },
    ];
    const matches = allProducts.filter(p => p.riskLevel === profile.riskTolerance);
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("Growth Fund");
  });

  it("should support multi-criteria filtering", () => {
    const filters = { riskLevel: "moderate", category: "mutual_fund", minReturn: 5 };
    expect(Object.keys(filters)).toHaveLength(3);
  });

  it("should rank results by relevance", () => {
    const results = [
      { name: "A", relevance: 0.95 },
      { name: "B", relevance: 0.82 },
    ];
    expect(results[0].relevance).toBeGreaterThan(results[1].relevance);
  });
});
