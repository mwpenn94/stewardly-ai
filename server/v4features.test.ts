import { describe, it, expect } from "vitest";
import {
  calculateStandardRepayment,
  calculateIDRPayment,
  calculatePSLF,
  calculateRefinance,
  compareAllScenarios,
} from "./studentLoanOptimizer";
import {
  modelExerciseScenario,
  compareExerciseStrategies,
} from "./equityComp";
import {
  applyModifications,
  type ClassificationResult,
} from "./complianceCopilot";
import { detectPII, stripPII } from "./prompts";

// ─── STUDENT LOAN OPTIMIZER ─────────────────────────────────────
describe("Student Loan Optimizer", () => {
  describe("calculateStandardRepayment", () => {
    it("calculates correct standard 10-year repayment", () => {
      const result = calculateStandardRepayment(30000, 5.0, 120);
      expect(result.name).toBe("Standard 10-Year");
      expect(result.monthlyPayment).toBeGreaterThan(300);
      expect(result.monthlyPayment).toBeLessThan(350);
      expect(result.totalPaid).toBeGreaterThan(30000);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.payoffMonths).toBe(120);
      expect(result.forgivenessAmount).toBe(0);
    });

    it("handles zero interest rate", () => {
      const result = calculateStandardRepayment(12000, 0, 120);
      expect(result.monthlyPayment).toBe(100);
      expect(result.totalInterest).toBe(0);
    });
  });

  describe("calculateIDRPayment", () => {
    it("calculates SAVE plan payment", () => {
      const result = calculateIDRPayment(50000, 1, 30000, 5.0, "SAVE");
      expect(result.name).toBe("SAVE Plan");
      expect(result.monthlyPayment).toBeGreaterThanOrEqual(0);
      expect(result.payoffMonths).toBeGreaterThan(0);
    });

    it("calculates PAYE plan payment", () => {
      const result = calculateIDRPayment(50000, 1, 30000, 5.0, "PAYE");
      expect(result.name).toBe("PAYE Plan");
      expect(result.monthlyPayment).toBeGreaterThanOrEqual(0);
    });

    it("calculates IBR plan payment", () => {
      const result = calculateIDRPayment(50000, 1, 30000, 5.0, "IBR");
      expect(result.name).toBe("IBR Plan");
    });

    it("calculates ICR plan payment", () => {
      const result = calculateIDRPayment(50000, 1, 30000, 5.0, "ICR");
      expect(result.name).toBe("ICR Plan");
    });

    it("larger family size reduces payment", () => {
      const single = calculateIDRPayment(50000, 1, 30000, 5.0, "SAVE");
      const family = calculateIDRPayment(50000, 4, 30000, 5.0, "SAVE");
      expect(family.monthlyPayment).toBeLessThanOrEqual(single.monthlyPayment);
    });
  });

  describe("calculatePSLF", () => {
    it("calculates PSLF with 120 payments", () => {
      const result = calculatePSLF(100000, 6.0, 200);
      expect(result.name).toContain("PSLF");
      expect(result.payoffMonths).toBe(120);
      expect(result.taxOnForgiveness).toBe(0); // PSLF is tax-free
    });
  });

  describe("calculateRefinance", () => {
    it("calculates refinance scenario", () => {
      const result = calculateRefinance(30000, 4.0, 120);
      expect(result.name).toContain("Refinance");
      expect(result.monthlyPayment).toBeGreaterThan(0);
    });
  });

  describe("compareAllScenarios", () => {
    it("returns sorted scenarios by total cost", () => {
      const scenarios = compareAllScenarios(30000, 6.0, 50000, 1, false);
      expect(scenarios.length).toBeGreaterThanOrEqual(4); // Standard + 3 IDR plans
      // Should be sorted by totalPaid ascending
      for (let i = 1; i < scenarios.length; i++) {
        expect(scenarios[i].totalPaid).toBeGreaterThanOrEqual(scenarios[i - 1].totalPaid);
      }
    });

    it("includes PSLF when eligible", () => {
      const scenarios = compareAllScenarios(30000, 6.0, 50000, 1, true);
      expect(scenarios.some(s => s.name.includes("PSLF"))).toBe(true);
    });

    it("excludes PSLF when not eligible", () => {
      const scenarios = compareAllScenarios(30000, 6.0, 50000, 1, false);
      expect(scenarios.some(s => s.name.includes("PSLF"))).toBe(false);
    });
  });
});

// ─── EQUITY COMPENSATION ────────────────────────────────────────
describe("Equity Compensation", () => {
  const isoGrant = {
    grantType: "iso",
    exercisePrice: 10,
    currentFMV: 50,
    sharesVested: 1000,
    sharesExercised: 0,
  };

  const rsuGrant = {
    grantType: "rsu",
    exercisePrice: null,
    currentFMV: 100,
    sharesVested: 500,
    sharesExercised: null,
  };

  describe("modelExerciseScenario", () => {
    it("models ISO immediate sale (disqualifying disposition)", () => {
      const result = modelExerciseScenario(isoGrant, 100, 100000, "immediate");
      expect(result.name).toContain("ISO");
      expect(result.name).toContain("immediate");
      expect(result.exerciseCost).toBe(1000); // 100 * $10
      expect(result.currentValue).toBe(5000); // 100 * $50
      expect(result.spread).toBe(4000); // (50-10) * 100
      expect(result.ordinaryIncomeTax).toBeGreaterThan(0);
      expect(result.netProceeds).toBeGreaterThan(0);
    });

    it("models ISO long-term hold (qualifying disposition)", () => {
      const result = modelExerciseScenario(isoGrant, 100, 100000, "long_term");
      expect(result.amtExposure).toBeGreaterThan(0); // AMT applies to ISOs
      expect(result.capitalGainsTax).toBeGreaterThanOrEqual(0);
    });

    it("models RSU vesting", () => {
      const result = modelExerciseScenario(rsuGrant, 100, 100000, "immediate");
      expect(result.ordinaryIncomeTax).toBeGreaterThan(0);
      expect(result.currentValue).toBe(10000); // 100 * $100
    });

    it("models NSO exercise", () => {
      const nsoGrant = { ...isoGrant, grantType: "nso" };
      const result = modelExerciseScenario(nsoGrant, 100, 100000, "immediate");
      expect(result.ordinaryIncomeTax).toBeGreaterThan(0);
    });
  });

  describe("compareExerciseStrategies", () => {
    it("returns 3 scenarios (immediate, short_term, long_term)", () => {
      const results = compareExerciseStrategies(isoGrant, 100, 100000);
      expect(results).toHaveLength(3);
      expect(results[0].holdingPeriod).toBe("immediate");
      expect(results[1].holdingPeriod).toBe("short_term");
      expect(results[2].holdingPeriod).toBe("long_term");
    });
  });
});

// ─── COMPLIANCE COPILOT ─────────────────────────────────────────
describe("Compliance Copilot", () => {
  describe("applyModifications", () => {
    it("adds disclaimer for product_discussion", () => {
      const result: ClassificationResult = {
        classification: "product_discussion",
        confidence: 0.9,
        flags: [],
        reasoningChain: [],
        suggestedModifications: [],
        reviewTier: "auto_approved",
      };
      const { content, modifications } = applyModifications("Here is info about VOO index fund.", result);
      expect(content).toContain("educational purposes only");
      expect(modifications.length).toBeGreaterThan(0);
    });

    it("adds stronger disclaimer for personalized_recommendation", () => {
      const result: ClassificationResult = {
        classification: "personalized_recommendation",
        confidence: 0.85,
        flags: [],
        reasoningChain: [],
        suggestedModifications: [],
        reviewTier: "auto_modified",
      };
      const { content } = applyModifications("Based on your situation, consider...", result);
      expect(content).toContain("not a substitute for professional financial advice");
    });

    it("softens guarantee language when flagged", () => {
      const result: ClassificationResult = {
        classification: "general_education",
        confidence: 0.9,
        flags: ["guarantee_language"],
        reasoningChain: [],
        suggestedModifications: [],
        reviewTier: "blocked",
      };
      const { content, modifications } = applyModifications("This investment is guaranteed to grow.", result);
      expect(content).not.toContain("guaranteed");
      expect(content).toContain("potentially");
      expect(modifications).toContain("Softened guarantee language");
    });

    it("does not add disclaimer for general_education", () => {
      const result: ClassificationResult = {
        classification: "general_education",
        confidence: 0.95,
        flags: [],
        reasoningChain: [],
        suggestedModifications: [],
        reviewTier: "auto_approved",
      };
      const { content, modifications } = applyModifications("Compound interest is when interest earns interest.", result);
      expect(content).toBe("Compound interest is when interest earns interest.");
      expect(modifications).toHaveLength(0);
    });
  });
});

// ─── PII DETECTION (existing, extended coverage) ────────────────
describe("PII Detection Extended", () => {
  it("detects SSN patterns", () => {
    const result = detectPII("My SSN is 123-45-6789");
    expect(result.hasPII).toBe(true);
    expect(result.types.some(t => t.toUpperCase() === "SSN")).toBe(true);
  });

  it("detects credit card numbers", () => {
    const result = detectPII("Card: 4111111111111111");
    expect(result.hasPII).toBe(true);
  });

  it("returns false for clean text", () => {
    const result = detectPII("I want to learn about index funds");
    expect(result.hasPII).toBe(false);
  });
});
