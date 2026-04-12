/**
 * Divorce Financial Analyzer — Pure-function unit tests
 * Tests analyzeDivorce covering: asset division scenarios,
 * after-tax value computation, support analysis, lifestyle analysis, and tax considerations.
 */
import { describe, expect, it } from "vitest";
import { analyzeDivorce, type DivorceInput, type DivorceAsset } from "./divorceFinancial";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAsset(overrides: Partial<DivorceAsset> = {}): DivorceAsset {
  return {
    name: "Test Asset",
    type: "cash",
    fairMarketValue: 100000,
    classification: "marital",
    owner: "joint",
    ...overrides,
  };
}

function baseInput(overrides: Partial<DivorceInput> = {}): DivorceInput {
  return {
    assets: [
      makeAsset({ name: "Joint Savings", type: "cash", fairMarketValue: 100000 }),
      makeAsset({ name: "401(k)", type: "retirement_pretax", fairMarketValue: 200000 }),
      makeAsset({ name: "Brokerage", type: "brokerage", fairMarketValue: 150000, costBasis: 80000 }),
      makeAsset({ name: "Home", type: "real_estate", fairMarketValue: 400000 }),
    ],
    spouse1Income: 120000,
    spouse2Income: 60000,
    spouse1Age: 45,
    spouse2Age: 43,
    yearsMarried: 15,
    childrenCount: 2,
    childrenAges: [10, 14],
    state: "CA",
    filingStatus: "single_post",
    marginalRate: 0.24,
    alimonyAnnual: 24000,
    alimonyYears: 5,
    childSupportMonthly: 1500,
    ...overrides,
  };
}

// ── Scenario generation ──────────────────────────────────────────────────────

describe("Divorce Financial — Scenario generation", () => {
  it("should generate exactly 2 division scenarios", () => {
    const result = analyzeDivorce(baseInput());
    expect(result.scenarios.length).toBe(2);
    expect(result.scenarios[0].name).toBe("50/50 Fair Market Value");
    expect(result.scenarios[1].name).toBe("Tax-Equalized Split");
  });

  it("should recommend Tax-Equalized Split as best", () => {
    const result = analyzeDivorce(baseInput());
    expect(result.bestScenario).toBe("Tax-Equalized Split");
  });

  it("should assign all marital assets to one of the two spouses", () => {
    const result = analyzeDivorce(baseInput());
    for (const scenario of result.scenarios) {
      const totalAssigned = scenario.spouse1Assets.length + scenario.spouse2Assets.length;
      const maritalAssets = baseInput().assets.filter(a =>
        a.classification === "marital" || a.classification === "commingled"
      );
      expect(totalAssigned).toBe(maritalAssets.length);
    }
  });
});

// ── 50/50 FMV split ──────────────────────────────────────────────────────────

describe("Divorce Financial — 50/50 FMV split", () => {
  it("should divide total FMV approximately 50/50", () => {
    const result = analyzeDivorce(baseInput());
    const scenario = result.scenarios[0];
    const total = scenario.spouse1Total + scenario.spouse2Total;
    // Each spouse should get roughly half (within one asset's value of exact half)
    expect(scenario.spouse1Total).toBeGreaterThan(0);
    expect(scenario.spouse2Total).toBeGreaterThan(0);
    expect(total).toBe(result.totalMaritalEstate);
  });

  it("should compute after-tax values alongside FMV", () => {
    const result = analyzeDivorce(baseInput());
    const scenario = result.scenarios[0];
    expect(scenario.spouse1AfterTax).toBeLessThanOrEqual(scenario.spouse1Total);
    expect(scenario.spouse2AfterTax).toBeLessThanOrEqual(scenario.spouse2Total);
  });
});

// ── After-tax value computation ──────────────────────────────────────────────

describe("Divorce Financial — After-tax values", () => {
  it("should apply tax to pre-tax retirement accounts", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "401k", type: "retirement_pretax", fairMarketValue: 500000 }),
      ],
    });
    const result = analyzeDivorce(input);
    const scenario = result.scenarios[0];
    const allAssets = [...scenario.spouse1Assets, ...scenario.spouse2Assets];
    const retirementAsset = allAssets.find(a => a.asset === "401k")!;
    // After-tax = 500000 * (1 - 0.24) = 380000
    expect(retirementAsset.afterTaxValue).toBe(Math.round(500000 * (1 - 0.24)));
  });

  it("should apply capital gains tax to brokerage accounts", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Brokerage", type: "brokerage", fairMarketValue: 200000, costBasis: 100000 }),
      ],
    });
    const result = analyzeDivorce(input);
    const allAssets = [...result.scenarios[0].spouse1Assets, ...result.scenarios[0].spouse2Assets];
    const brokerage = allAssets.find(a => a.asset === "Brokerage")!;
    // After-tax = 200000 - (100000 * 0.238) = 200000 - 23800 = 176200
    expect(brokerage.afterTaxValue).toBe(Math.round(200000 - 100000 * 0.238));
  });

  it("should not tax Roth retirement accounts", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Roth IRA", type: "retirement_roth", fairMarketValue: 100000 }),
      ],
    });
    const result = analyzeDivorce(input);
    const allAssets = [...result.scenarios[0].spouse1Assets, ...result.scenarios[0].spouse2Assets];
    const roth = allAssets.find(a => a.asset === "Roth IRA")!;
    expect(roth.afterTaxValue).toBe(100000);
  });

  it("should not tax cash assets", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Cash", type: "cash", fairMarketValue: 50000 }),
      ],
    });
    const result = analyzeDivorce(input);
    const allAssets = [...result.scenarios[0].spouse1Assets, ...result.scenarios[0].spouse2Assets];
    const cash = allAssets.find(a => a.asset === "Cash")!;
    expect(cash.afterTaxValue).toBe(50000);
  });

  it("should apply income tax rate to stock options", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Options", type: "stock_options", fairMarketValue: 200000 }),
      ],
      marginalRate: 0.32,
    });
    const result = analyzeDivorce(input);
    const allAssets = [...result.scenarios[0].spouse1Assets, ...result.scenarios[0].spouse2Assets];
    const options = allAssets.find(a => a.asset === "Options")!;
    expect(options.afterTaxValue).toBe(Math.round(200000 * (1 - 0.32)));
  });
});

// ── Marital vs separate property ─────────────────────────────────────────────

describe("Divorce Financial — Property classification", () => {
  it("should total marital estate from marital + commingled assets", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Joint", fairMarketValue: 100000, classification: "marital" }),
        makeAsset({ name: "Mixed", fairMarketValue: 50000, classification: "commingled" }),
        makeAsset({ name: "Inheritance", fairMarketValue: 200000, classification: "separate" }),
      ],
    });
    const result = analyzeDivorce(input);
    expect(result.totalMaritalEstate).toBe(150000);
    expect(result.totalSeparateProperty).toBe(200000);
  });

  it("should not divide separate property in scenarios", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Joint", fairMarketValue: 100000, classification: "marital" }),
        makeAsset({ name: "Separate", fairMarketValue: 200000, classification: "separate" }),
      ],
    });
    const result = analyzeDivorce(input);
    for (const scenario of result.scenarios) {
      const allNames = [
        ...scenario.spouse1Assets.map(a => a.asset),
        ...scenario.spouse2Assets.map(a => a.asset),
      ];
      expect(allNames).not.toContain("Separate");
    }
  });
});

// ── Support analysis ─────────────────────────────────────────────────────────

describe("Divorce Financial — Support analysis", () => {
  it("should calculate total alimony", () => {
    const result = analyzeDivorce(baseInput({
      alimonyAnnual: 30000,
      alimonyYears: 10,
    }));
    expect(result.supportAnalysis.alimonyTotal).toBe(300000);
  });

  it("should report zero alimony tax impact (post-TCJA)", () => {
    const result = analyzeDivorce(baseInput());
    expect(result.supportAnalysis.alimonyTaxImpact).toBe(0);
  });

  it("should calculate child support total based on youngest child", () => {
    const result = analyzeDivorce(baseInput({
      childSupportMonthly: 2000,
      childrenAges: [8, 14],
    }));
    // Max years until 18 = max(18-8, 18-14) = 10
    const expected = 2000 * 12 * 10;
    expect(result.supportAnalysis.childSupportTotal).toBe(expected);
  });

  it("should handle no children", () => {
    const result = analyzeDivorce(baseInput({
      childrenCount: 0,
      childrenAges: [],
      childSupportMonthly: 0,
    }));
    expect(result.supportAnalysis.childSupportTotal).toBe(0);
  });

  it("should calculate totalSupportCost = alimony + child support", () => {
    const result = analyzeDivorce(baseInput());
    expect(result.supportAnalysis.totalSupportCost).toBe(
      result.supportAnalysis.alimonyTotal + result.supportAnalysis.childSupportTotal
    );
  });
});

// ── Lifestyle analysis ───────────────────────────────────────────────────────

describe("Divorce Financial — Lifestyle analysis", () => {
  it("should compute current household income as sum of both spouses", () => {
    const result = analyzeDivorce(baseInput({
      spouse1Income: 150000,
      spouse2Income: 50000,
    }));
    expect(result.lifestyleAnalysis.currentHouseholdIncome).toBe(200000);
  });

  it("should reduce spouse1 income by alimony and child support", () => {
    const result = analyzeDivorce(baseInput({
      spouse1Income: 120000,
      alimonyAnnual: 24000,
      childSupportMonthly: 1500,
    }));
    // 120000 - 24000 - 1500*12 = 120000 - 24000 - 18000 = 78000
    expect(result.lifestyleAnalysis.spouse1PostDivorceIncome).toBe(78000);
  });

  it("should increase spouse2 income by alimony and child support", () => {
    const result = analyzeDivorce(baseInput({
      spouse2Income: 60000,
      alimonyAnnual: 24000,
      childSupportMonthly: 1500,
    }));
    // 60000 + 24000 + 18000 = 102000
    expect(result.lifestyleAnalysis.spouse2PostDivorceIncome).toBe(102000);
  });

  it("should compute lifestyle gap from 50% of household income", () => {
    const result = analyzeDivorce(baseInput({
      spouse1Income: 200000,
      spouse2Income: 50000,
      alimonyAnnual: 0,
      childSupportMonthly: 0,
    }));
    // Gap = (250000/2) - min(200000, 50000) = 125000 - 50000 = 75000
    expect(result.lifestyleAnalysis.lifestyleGap).toBe(75000);
  });
});

// ── Tax considerations ───────────────────────────────────────────────────────

describe("Divorce Financial — Tax considerations", () => {
  it("should always include QDRO guidance", () => {
    const result = analyzeDivorce(baseInput());
    expect(result.taxConsiderations.some(t => t.includes("QDRO"))).toBe(true);
  });

  it("should include alimony post-TCJA note", () => {
    const result = analyzeDivorce(baseInput());
    expect(result.taxConsiderations.some(t => t.includes("Alimony") && t.includes("not deductible"))).toBe(true);
  });

  it("should include business valuation note when business assets exist", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Business", type: "business", fairMarketValue: 500000 }),
      ],
    });
    const result = analyzeDivorce(input);
    expect(result.taxConsiderations.some(t => t.includes("Business valuation"))).toBe(true);
  });

  it("should not include business note when no business assets", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Cash", type: "cash", fairMarketValue: 100000 }),
      ],
    });
    const result = analyzeDivorce(input);
    expect(result.taxConsiderations.some(t => t.includes("Business valuation"))).toBe(false);
  });
});

// ── Timeline ─────────────────────────────────────────────────────────────────

describe("Divorce Financial — Timeline", () => {
  it("should provide a non-empty timeline of action items", () => {
    const result = analyzeDivorce(baseInput());
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.timeline.some(t => t.includes("financial disclosure"))).toBe(true);
    expect(result.timeline.some(t => t.includes("QDRO"))).toBe(true);
    expect(result.timeline.some(t => t.includes("beneficiary"))).toBe(true);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────────

describe("Divorce Financial — Edge cases", () => {
  it("should handle zero-value assets", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Empty Account", type: "cash", fairMarketValue: 0 }),
      ],
    });
    const result = analyzeDivorce(input);
    expect(result.totalMaritalEstate).toBe(0);
  });

  it("should handle no alimony or child support", () => {
    const result = analyzeDivorce(baseInput({
      alimonyAnnual: undefined,
      alimonyYears: undefined,
      childSupportMonthly: undefined,
    }));
    expect(result.supportAnalysis.alimonyTotal).toBe(0);
    expect(result.supportAnalysis.totalSupportCost).toBe(0);
  });

  it("should handle single asset", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "House", type: "real_estate", fairMarketValue: 500000 }),
      ],
    });
    const result = analyzeDivorce(input);
    expect(result.scenarios.length).toBe(2);
    expect(result.totalMaritalEstate).toBe(500000);
  });

  it("should handle brokerage with no cost basis (treated as zero gain)", () => {
    const input = baseInput({
      assets: [
        makeAsset({ name: "Broker", type: "brokerage", fairMarketValue: 100000 }),
      ],
    });
    const result = analyzeDivorce(input);
    const allAssets = [...result.scenarios[0].spouse1Assets, ...result.scenarios[0].spouse2Assets];
    const broker = allAssets.find(a => a.asset === "Broker")!;
    // No cost basis → gain = 0 → afterTax = FMV
    expect(broker.afterTaxValue).toBe(100000);
  });
});
