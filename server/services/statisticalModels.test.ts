/**
 * Unit tests for the Statistical Models library.
 * Covers deterministic pure functions: optimizeDebt and scoreRiskTolerance.
 * Monte Carlo functions are stochastic and tested for structural correctness
 * (return shape, bounds, invariants) rather than exact values.
 */
import { describe, it, expect } from "vitest";
import {
  optimizeDebt,
  scoreRiskTolerance,
  monteCarloRetirement,
  type DebtOptimizationInput,
  type RiskToleranceInput,
  type RetirementInput,
} from "./statisticalModels";

// ─── Test Data ──────────────────────────────────────────────────────────────

const TWO_DEBTS: DebtOptimizationInput = {
  debts: [
    { name: "Credit Card", balance: 5000, interestRate: 0.18, minimumPayment: 100, type: "credit_card" },
    { name: "Student Loan", balance: 15000, interestRate: 0.06, minimumPayment: 200, type: "student_loan" },
  ],
  monthlyBudget: 500,
  extraPayment: 200,
};

const SMALL_DEBTS: DebtOptimizationInput = {
  debts: [
    { name: "Store Card A", balance: 400, interestRate: 0.22, minimumPayment: 25, type: "credit_card" },
    { name: "Store Card B", balance: 600, interestRate: 0.20, minimumPayment: 30, type: "credit_card" },
    { name: "Auto Loan", balance: 8000, interestRate: 0.05, minimumPayment: 200, type: "auto" },
  ],
  monthlyBudget: 400,
  extraPayment: 145,
};

const RISK_INPUT: RiskToleranceInput = {
  questionnaireAnswers: [
    { questionId: "q1", answer: 4, category: "capacity" },
    { questionId: "q2", answer: 3, category: "willingness" },
    { questionId: "q3", answer: 5, category: "need" },
    { questionId: "q4", answer: 3, category: "knowledge" },
    { questionId: "q5", answer: 2, category: "willingness" },
    { questionId: "q6", answer: 4, category: "capacity" },
  ],
  behavioralSignals: {
    portfolioChangesLast12m: 2,
    panicSellEvents: 0,
    riskAssetAllocation: 0.6,
    loginFrequencyDuringVolatility: 1.5,
    averageHoldingPeriod: 36,
  },
  financialContext: {
    age: 35,
    yearsToRetirement: 30,
    incomeStability: 4,
    emergencyFundMonths: 6,
    debtToIncomeRatio: 0.2,
    dependents: 1,
  },
};

const RETIREMENT_INPUT: RetirementInput = {
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  currentSavings: 100000,
  annualContribution: 20000,
  contributionGrowthRate: 0.02,
  expectedReturn: 0.07,
  returnStdDev: 0.15,
  inflationRate: 0.03,
  annualExpensesInRetirement: 60000,
  socialSecurityAnnual: 24000,
  socialSecurityStartAge: 67,
  simulations: 100, // low count for speed
};

// ─── Debt Optimization Tests ────────────────────────────────────────────────

describe("optimizeDebt", () => {
  it("returns all three strategies + minimumOnly", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.avalanche).toBeDefined();
    expect(result.snowball).toBeDefined();
    expect(result.hybrid).toBeDefined();
    expect(result.minimumOnly).toBeDefined();
  });

  it("calculates totalDebt correctly", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.totalDebt).toBe(20000);
  });

  it("calculates weighted average rate", () => {
    const result = optimizeDebt(TWO_DEBTS);
    // (5000 * 0.18 + 15000 * 0.06) / 20000 = (900 + 900) / 20000 = 0.09
    expect(result.weightedAverageRate).toBe(0.09);
  });

  it("avalanche pays less interest than snowball for high-rate differential", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.avalanche.totalInterestPaid).toBeLessThanOrEqual(result.snowball.totalInterestPaid);
  });

  it("all strategies pay off faster than minimum-only", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.avalanche.monthsToPayoff).toBeLessThan(result.minimumOnly.monthsToPayoff);
    expect(result.snowball.monthsToPayoff).toBeLessThan(result.minimumOnly.monthsToPayoff);
    expect(result.hybrid.monthsToPayoff).toBeLessThan(result.minimumOnly.monthsToPayoff);
  });

  it("interest saved is non-negative for all strategies", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.avalanche.interestSaved).toBeGreaterThanOrEqual(0);
    expect(result.snowball.interestSaved).toBeGreaterThanOrEqual(0);
    expect(result.hybrid.interestSaved).toBeGreaterThanOrEqual(0);
  });

  it("avalanche prioritizes highest-rate debt first in payoffOrder", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.avalanche.payoffOrder[0]).toBe("Credit Card"); // 18% > 6%
  });

  it("snowball prioritizes lowest-balance debt first in payoffOrder", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.snowball.payoffOrder[0]).toBe("Credit Card"); // $5000 < $15000
  });

  it("hybrid recommends quick wins for small debts", () => {
    const result = optimizeDebt(SMALL_DEBTS);
    // With 2 small debts < $1000 and small interest difference, should recommend snowball or hybrid
    expect(result.recommendation).toMatch(/Snowball|Hybrid/i);
  });

  it("totalPaid >= totalDebt for all strategies", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.avalanche.totalPaid).toBeGreaterThanOrEqual(result.totalDebt);
    expect(result.snowball.totalPaid).toBeGreaterThanOrEqual(result.totalDebt);
    expect(result.hybrid.totalPaid).toBeGreaterThanOrEqual(result.totalDebt);
  });

  it("generates a recommendation string", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.recommendation.length).toBeGreaterThan(10);
  });

  it("monthlySchedule is non-empty for all strategies", () => {
    const result = optimizeDebt(TWO_DEBTS);
    expect(result.avalanche.monthlySchedule.length).toBeGreaterThan(0);
    expect(result.snowball.monthlySchedule.length).toBeGreaterThan(0);
    expect(result.hybrid.monthlySchedule.length).toBeGreaterThan(0);
  });
});

// ─── Risk Tolerance Tests ───────────────────────────────────────────────────

describe("scoreRiskTolerance", () => {
  it("returns a compositeScore between 0 and 100", () => {
    const result = scoreRiskTolerance(RISK_INPUT);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  it("returns a valid category", () => {
    const result = scoreRiskTolerance(RISK_INPUT);
    expect([
      "conservative",
      "moderately_conservative",
      "moderate",
      "moderately_aggressive",
      "aggressive",
    ]).toContain(result.category);
  });

  it("returns all 5 dimension scores", () => {
    const result = scoreRiskTolerance(RISK_INPUT);
    expect(result.dimensions.capacity).toBeDefined();
    expect(result.dimensions.willingness).toBeDefined();
    expect(result.dimensions.need).toBeDefined();
    expect(result.dimensions.knowledge).toBeDefined();
    expect(result.dimensions.behavioral).toBeDefined();
  });

  it("each dimension score is 0-100", () => {
    const result = scoreRiskTolerance(RISK_INPUT);
    for (const dim of Object.values(result.dimensions)) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });

  it("recommended allocation sums to approximately 100%", () => {
    const result = scoreRiskTolerance(RISK_INPUT);
    const total = result.recommendedAllocation.stocks +
      result.recommendedAllocation.bonds +
      result.recommendedAllocation.alternatives +
      result.recommendedAllocation.cash;
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });

  it("confidenceLevel is between 0 and 100", () => {
    const result = scoreRiskTolerance(RISK_INPUT);
    expect(result.confidenceLevel).toBeGreaterThanOrEqual(0);
    expect(result.confidenceLevel).toBeLessThanOrEqual(100);
  });

  it("conservative inputs yield conservative category", () => {
    const conservativeInput: RiskToleranceInput = {
      questionnaireAnswers: [
        { questionId: "q1", answer: 1, category: "capacity" },
        { questionId: "q2", answer: 1, category: "willingness" },
        { questionId: "q3", answer: 1, category: "need" },
        { questionId: "q4", answer: 1, category: "knowledge" },
      ],
      behavioralSignals: {
        portfolioChangesLast12m: 10,
        panicSellEvents: 3,
        riskAssetAllocation: 0.1,
        loginFrequencyDuringVolatility: 5,
        averageHoldingPeriod: 3,
      },
      financialContext: {
        age: 62,
        yearsToRetirement: 3,
        incomeStability: 2,
        emergencyFundMonths: 1,
        debtToIncomeRatio: 0.5,
        dependents: 3,
      },
    };
    const result = scoreRiskTolerance(conservativeInput);
    expect(["conservative", "moderately_conservative"]).toContain(result.category);
    expect(result.compositeScore).toBeLessThan(40);
  });

  it("aggressive inputs yield aggressive category", () => {
    const aggressiveInput: RiskToleranceInput = {
      questionnaireAnswers: [
        { questionId: "q1", answer: 5, category: "capacity" },
        { questionId: "q2", answer: 5, category: "willingness" },
        { questionId: "q3", answer: 5, category: "need" },
        { questionId: "q4", answer: 5, category: "knowledge" },
      ],
      behavioralSignals: {
        portfolioChangesLast12m: 0,
        panicSellEvents: 0,
        riskAssetAllocation: 0.9,
        loginFrequencyDuringVolatility: 0.5,
        averageHoldingPeriod: 60,
      },
      financialContext: {
        age: 25,
        yearsToRetirement: 40,
        incomeStability: 5,
        emergencyFundMonths: 12,
        debtToIncomeRatio: 0.05,
        dependents: 0,
      },
    };
    const result = scoreRiskTolerance(aggressiveInput);
    expect(["aggressive", "moderately_aggressive"]).toContain(result.category);
    expect(result.compositeScore).toBeGreaterThan(60);
  });

  it("panic sell events generate behavioral insights", () => {
    const panicInput = {
      ...RISK_INPUT,
      behavioralSignals: { ...RISK_INPUT.behavioralSignals, panicSellEvents: 3 },
    };
    const result = scoreRiskTolerance(panicInput);
    expect(result.behavioralInsights.length).toBeGreaterThan(0);
  });
});

// ─── Monte Carlo Retirement (structural tests) ─────────────────────────────

describe("monteCarloRetirement", () => {
  it("returns a successRate between 0 and 100", () => {
    const result = monteCarloRetirement(RETIREMENT_INPUT);
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(100);
  });

  it("returns all required output fields", () => {
    const result = monteCarloRetirement(RETIREMENT_INPUT);
    expect(result.medianEndingBalance).toBeDefined();
    expect(result.percentile10).toBeDefined();
    expect(result.percentile25).toBeDefined();
    expect(result.percentile75).toBeDefined();
    expect(result.percentile90).toBeDefined();
    expect(result.medianBalanceAtRetirement).toBeDefined();
    expect(result.yearByYearMedian).toBeDefined();
    expect(result.inflationAdjustedExpenses).toBeDefined();
    expect(result.totalContributions).toBeDefined();
  });

  it("percentiles are in monotonic order", () => {
    const result = monteCarloRetirement(RETIREMENT_INPUT);
    expect(result.percentile10).toBeLessThanOrEqual(result.percentile25);
    expect(result.percentile25).toBeLessThanOrEqual(result.percentile75);
    expect(result.percentile75).toBeLessThanOrEqual(result.percentile90);
  });

  it("yearByYearMedian has entries for each year from currentAge to lifeExpectancy", () => {
    const result = monteCarloRetirement(RETIREMENT_INPUT);
    const expectedYears = RETIREMENT_INPUT.lifeExpectancy - RETIREMENT_INPUT.currentAge + 1;
    expect(result.yearByYearMedian.length).toBe(expectedYears);
    expect(result.yearByYearMedian[0].age).toBe(RETIREMENT_INPUT.currentAge);
  });

  it("inflationAdjustedExpenses is greater than nominal expenses", () => {
    const result = monteCarloRetirement(RETIREMENT_INPUT);
    expect(result.inflationAdjustedExpenses).toBeGreaterThan(RETIREMENT_INPUT.annualExpensesInRetirement);
  });

  it("totalContributions reflects the contribution schedule", () => {
    const result = monteCarloRetirement(RETIREMENT_INPUT);
    // 30 years of contributions starting at $20k/yr with 2% growth
    expect(result.totalContributions).toBeGreaterThan(600000); // at least 30 * 20k
    expect(result.totalContributions).toBeLessThan(1200000); // bounded by growth rate
  });

  it("shortfallYears is 0 when success rate is 100%", () => {
    const easyInput: RetirementInput = {
      ...RETIREMENT_INPUT,
      currentSavings: 5000000,
      annualExpensesInRetirement: 10000,
      simulations: 50,
    };
    const result = monteCarloRetirement(easyInput);
    if (result.successRate === 100) {
      expect(result.shortfallYears).toBe(0);
    }
  });
});
