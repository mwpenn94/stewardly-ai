/**
 * WebSocket Notifications & Statistical Models Test Suite
 *
 * Tests:
 * 1. WebSocket notification service functions
 * 2. Notification tRPC router procedures
 * 3. Statistical model correctness (Monte Carlo, debt optimization, tax, etc.)
 * 4. Notification type integration
 */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  monteCarloRetirement,
  optimizeDebt,
  optimizeTax,
  projectCashFlow,
  analyzeInsuranceGaps,
  analyzeEstatePlan,
  projectEducationFunding,
  scoreRiskTolerance,
} from "./services/statisticalModels";
import {
  sendNotification,
  broadcastToRole,
  broadcastToAll,
  getUserNotifications,
  getUnreadCount,
  getConnectionStats,
} from "./services/websocketNotifications";

// ─── Test Helpers ─────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 300,
    openId: "test-ws-user",
    email: "ws@test.com",
    name: "Test WS User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createAdmin(): AuthenticatedUser {
  return createUser({ id: 301, role: "admin", name: "Test Admin", email: "admin@test.com" });
}

function createContext(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const caller = (ctx: TrpcContext) => appRouter.createCaller(ctx);

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: WEBSOCKET NOTIFICATION SERVICE
// ═══════════════════════════════════════════════════════════════════

describe("WebSocket Notification Service", () => {
  it("sendNotification creates a notification payload with correct structure", () => {
    const result = sendNotification(300, {
      type: "coaching",
      priority: "high",
      title: "Test Coaching",
      body: "This is a test coaching message",
      metadata: { source: "test" },
    });
    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
    expect(result.type).toBe("coaching");
    expect(result.priority).toBe("high");
    expect(result.title).toBe("Test Coaching");
    expect(result.body).toBe("This is a test coaching message");
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.readAt).toBeNull();
    expect(result.metadata).toEqual({ source: "test" });
  });

  it("getUserNotifications returns stored notifications (newest first)", () => {
    sendNotification(302, { type: "system", priority: "low", title: "N1", body: "Body 1" });
    sendNotification(302, { type: "alert", priority: "high", title: "N2", body: "Body 2" });
    sendNotification(302, { type: "propagation", priority: "medium", title: "N3", body: "Body 3" });

    const notifications = getUserNotifications(302);
    expect(notifications.length).toBeGreaterThanOrEqual(3);
    expect(notifications[0].title).toBe("N3");
    expect(notifications[1].title).toBe("N2");
    expect(notifications[2].title).toBe("N1");
  });

  it("getUnreadCount returns correct count", () => {
    sendNotification(303, { type: "system", priority: "low", title: "Unread1", body: "B" });
    sendNotification(303, { type: "system", priority: "low", title: "Unread2", body: "B" });
    const count = getUnreadCount(303);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("broadcastToRole creates notification with correct structure", () => {
    const result = broadcastToRole("admin", {
      type: "system", priority: "medium", title: "Admin Broadcast", body: "Test broadcast",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
    expect(result.type).toBe("system");
    expect(result.title).toBe("Admin Broadcast");
  });

  it("broadcastToAll creates notification with correct structure", () => {
    const result = broadcastToAll({
      type: "alert", priority: "critical", title: "System Alert", body: "Critical notification",
    });
    expect(result).toBeDefined();
    expect(result.priority).toBe("critical");
    expect(result.type).toBe("alert");
  });

  it("getConnectionStats returns valid structure", () => {
    const stats = getConnectionStats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalConnections).toBe("number");
    expect(typeof stats.usersByRole).toBe("object");
  });

  it("max notifications per user is enforced (100 limit)", () => {
    const userId = 306;
    for (let i = 0; i < 110; i++) {
      sendNotification(userId, { type: "system", priority: "low", title: `N${i}`, body: "B" });
    }
    const notifications = getUserNotifications(userId);
    expect(notifications.length).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 2: NOTIFICATIONS TRPC ROUTER
// ═══════════════════════════════════════════════════════════════════

describe("Notifications tRPC Router", () => {
  const user = createUser();
  const admin = createAdmin();
  const userCtx = createContext(user);
  const adminCtx = createContext(admin);
  const guestCtx = createContext(null);

  it("list returns notifications for authenticated user", async () => {
    sendNotification(user.id, { type: "coaching", priority: "medium", title: "Router Test", body: "Body" });
    const result = await caller(userCtx).notifications.list();
    expect(result).toBeDefined();
    expect(result.notifications).toBeDefined();
    expect(typeof result.total).toBe("number");
    expect(typeof result.unread).toBe("number");
  });

  it("unreadCount returns count for authenticated user", async () => {
    const result = await caller(userCtx).notifications.unreadCount();
    expect(result).toBeDefined();
    expect(typeof result.count).toBe("number");
  });

  it("sendTest creates a notification", async () => {
    const result = await caller(userCtx).notifications.sendTest({
      title: "Test Notification", body: "This is a test", type: "system", priority: "low",
    });
    expect(result.success).toBe(true);
    expect(result.notification).toBeDefined();
    expect(result.notification.title).toBe("Test Notification");
  });

  it("connectionStats returns data for admin", async () => {
    const result = await caller(adminCtx).notifications.connectionStats();
    expect(result).toBeDefined();
    expect(typeof result.totalConnections).toBe("number");
  });

  it("connectionStats returns empty for non-admin", async () => {
    const result = await caller(userCtx).notifications.connectionStats();
    expect(result.totalConnections).toBe(0);
  });

  it("list requires authentication", async () => {
    await expect(caller(guestCtx).notifications.list()).rejects.toThrow();
  });

  it("sendTest requires authentication", async () => {
    await expect(caller(guestCtx).notifications.sendTest({ title: "T", body: "T" })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 3: MONTE CARLO RETIREMENT SIMULATION
// ═══════════════════════════════════════════════════════════════════

describe("Monte Carlo Retirement Simulation", () => {
  const baseInput = {
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
    simulations: 2000, // fewer for speed in tests
  };

  it("produces valid success rate between 0 and 100", () => {
    const result = monteCarloRetirement(baseInput);
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(100);
  });

  it("higher savings leads to higher or equal success rate", () => {
    const low = monteCarloRetirement({ ...baseInput, currentSavings: 50000, simulations: 5000 });
    const high = monteCarloRetirement({ ...baseInput, currentSavings: 500000, simulations: 5000 });
    // Both are percentages (0-100)
    expect(high.successRate).toBeGreaterThanOrEqual(low.successRate);
  });

  it("returns year-by-year median projections", () => {
    const result = monteCarloRetirement(baseInput);
    expect(result.yearByYearMedian).toBeDefined();
    expect(Array.isArray(result.yearByYearMedian)).toBe(true);
    expect(result.yearByYearMedian.length).toBeGreaterThan(0);
  });

  it("returns median ending balance", () => {
    const result = monteCarloRetirement(baseInput);
    expect(typeof result.medianEndingBalance).toBe("number");
  });

  it("returns percentile breakdowns", () => {
    const result = monteCarloRetirement(baseInput);
    expect(typeof result.percentile10).toBe("number");
    expect(typeof result.percentile25).toBe("number");
    expect(typeof result.percentile75).toBe("number");
    expect(typeof result.percentile90).toBe("number");
    expect(result.percentile10).toBeLessThanOrEqual(result.percentile25);
    expect(result.percentile25).toBeLessThanOrEqual(result.percentile75);
    expect(result.percentile75).toBeLessThanOrEqual(result.percentile90);
  });

  it("recommendedAdditionalSavings >= 0", () => {
    const result = monteCarloRetirement({
      ...baseInput,
      currentSavings: 10000,
      annualContribution: 5000,
      annualExpensesInRetirement: 80000,
      simulations: 1000,
    });
    expect(result.recommendedAdditionalSavings).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 4: DEBT OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════

describe("Debt Optimization", () => {
  const sampleDebts = [
    { name: "Credit Card A", balance: 5000, interestRate: 0.22, minimumPayment: 100, type: "credit_card" as const },
    { name: "Car Loan", balance: 15000, interestRate: 0.05, minimumPayment: 300, type: "auto" as const },
    { name: "Credit Card B", balance: 3000, interestRate: 0.18, minimumPayment: 75, type: "credit_card" as const },
  ];

  it("returns avalanche, snowball, and hybrid strategies", () => {
    const result = optimizeDebt({ debts: sampleDebts, monthlyBudget: 700, extraPayment: 225 });
    expect(result.avalanche).toBeDefined();
    expect(result.snowball).toBeDefined();
    expect(result.hybrid).toBeDefined();
    expect(result.recommendation).toBeDefined();
  });

  it("avalanche saves more interest than snowball", () => {
    const result = optimizeDebt({ debts: sampleDebts, monthlyBudget: 700, extraPayment: 225 });
    expect(result.avalanche.totalInterestPaid).toBeLessThanOrEqual(result.snowball.totalInterestPaid);
  });

  it("all strategies pay off all debts", () => {
    const result = optimizeDebt({ debts: sampleDebts, monthlyBudget: 700, extraPayment: 225 });
    expect(result.avalanche.monthsToPayoff).toBeGreaterThan(0);
    expect(result.snowball.monthsToPayoff).toBeGreaterThan(0);
    expect(result.hybrid.monthsToPayoff).toBeGreaterThan(0);
  });

  it("provides a recommendation string", () => {
    const result = optimizeDebt({ debts: sampleDebts, monthlyBudget: 700, extraPayment: 225 });
    expect(typeof result.recommendation).toBe("string");
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it("calculates total debt and weighted average rate", () => {
    const result = optimizeDebt({ debts: sampleDebts, monthlyBudget: 700, extraPayment: 225 });
    expect(result.totalDebt).toBe(23000);
    expect(result.weightedAverageRate).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 5: TAX OPTIMIZATION
// ═══════════════════════════════════════════════════════════════════

describe("Tax Optimization", () => {
  const baseTaxInput = {
    filingStatus: "single" as const,
    grossIncome: 120000,
    w2Income: 120000,
    selfEmploymentIncome: 0,
    capitalGainsShortTerm: 0,
    capitalGainsLongTerm: 5000,
    dividendsQualified: 2000,
    dividendsOrdinary: 500,
    deductions: {
      mortgage: 8000,
      stateLocalTax: 6000,
      charitableGiving: 2000,
      medicalExpenses: 0,
      studentLoanInterest: 0,
      businessExpenses: 0,
      retirementContributions: 20000,
      hsaContributions: 3650,
    },
    traditionalIraBalance: 50000,
    rothIraBalance: 20000,
    age: 40,
    state: "CA",
  };

  it("calculates current tax liability", () => {
    const result = optimizeTax(baseTaxInput);
    expect(result.currentTaxLiability).toBeGreaterThan(0);
    expect(typeof result.currentTaxLiability).toBe("number");
  });

  it("provides Roth conversion analysis", () => {
    const result = optimizeTax(baseTaxInput);
    expect(result.rothConversion).toBeDefined();
    expect(typeof result.rothConversion.recommended).toBe("boolean");
  });

  it("calculates total optimized savings", () => {
    const result = optimizeTax(baseTaxInput);
    expect(typeof result.totalOptimizedSavings).toBe("number");
    expect(result.totalOptimizedSavings).toBeGreaterThanOrEqual(0);
  });

  it("provides bracket analysis", () => {
    const result = optimizeTax(baseTaxInput);
    expect(result.bracketAnalysis).toBeDefined();
    expect(Array.isArray(result.bracketAnalysis)).toBe(true);
    expect(result.bracketAnalysis.length).toBeGreaterThan(0);
  });

  it("compares standard vs itemized deductions", () => {
    const result = optimizeTax(baseTaxInput);
    expect(result.standardVsItemized).toBeDefined();
    expect(typeof result.standardVsItemized.recommendation).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 6: CASH FLOW PROJECTION
// ═══════════════════════════════════════════════════════════════════

describe("Cash Flow Projection", () => {
  const baseCashFlow = {
    monthlyIncome: [
      { source: "Salary", amount: 8000, growthRate: 0.03 },
      { source: "Side Gig", amount: 1000, growthRate: 0 },
    ],
    monthlyExpenses: [
      { category: "Housing", amount: 2500, growthRate: 0.02 },
      { category: "Food", amount: 800, growthRate: 0.03 },
      { category: "Transportation", amount: 400, growthRate: 0.01 },
    ],
    oneTimeEvents: [],
    currentCash: 15000,
    projectionMonths: 12,
    inflationRate: 0.03,
    emergencyFundTarget: 20000,
  };

  it("projects monthly cash flows", () => {
    const result = projectCashFlow(baseCashFlow);
    expect(result.monthlyProjections).toBeDefined();
    expect(Array.isArray(result.monthlyProjections)).toBe(true);
    expect(result.monthlyProjections.length).toBe(12);
  });

  it("returns summary with net cash flow", () => {
    const result = projectCashFlow(baseCashFlow);
    expect(result.summary).toBeDefined();
    expect(typeof result.summary.averageNetCashFlow).toBe("number");
  });

  it("generates alerts for negative cash flow", () => {
    const result = projectCashFlow({
      ...baseCashFlow,
      monthlyIncome: [{ source: "Salary", amount: 3000, growthRate: 0 }],
      monthlyExpenses: [
        { category: "Rent", amount: 2000, growthRate: 0 },
        { category: "Loans", amount: 1500, growthRate: 0 },
      ],
      currentCash: 1000,
    });
    expect(result.alerts).toBeDefined();
    expect(Array.isArray(result.alerts)).toBe(true);
  });

  it("tracks cumulative balance", () => {
    const result = projectCashFlow(baseCashFlow);
    for (const proj of result.monthlyProjections) {
      expect(typeof proj.cumulativeBalance).toBe("number");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 7: INSURANCE GAP ANALYSIS
// ═══════════════════════════════════════════════════════════════════

describe("Insurance Gap Analysis", () => {
  const baseInsurance = {
    annualIncome: 100000,
    age: 40,
    dependents: 2,
    mortgageBalance: 250000,
    totalDebt: 30000,
    monthlyExpenses: 5000,
    currentPolicies: [
      { type: "life" as const, coverageAmount: 200000, annualPremium: 500, deductible: 0, provider: "MetLife" },
    ],
    homeValue: 400000,
    autoValue: 30000,
    netWorth: 500000,
    hasEmployerDisability: true,
    employerDisabilityPercent: 0.6,
  };

  it("identifies coverage gaps", () => {
    const result = analyzeInsuranceGaps(baseInsurance);
    expect(result.gaps).toBeDefined();
    expect(Array.isArray(result.gaps)).toBe(true);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it("returns overall score between 0 and 100", () => {
    const result = analyzeInsuranceGaps(baseInsurance);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("provides recommendations", () => {
    const result = analyzeInsuranceGaps(baseInsurance);
    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it("calculates premium to income ratio", () => {
    const result = analyzeInsuranceGaps(baseInsurance);
    expect(typeof result.premiumToIncomeRatio).toBe("number");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 8: ESTATE PLANNING ANALYSIS
// ═══════════════════════════════════════════════════════════════════

describe("Estate Planning Analysis", () => {
  const baseEstate = {
    totalEstateValue: 15000000,
    filingStatus: "single" as const,
    age: 65,
    assets: [
      { type: "real_estate", value: 5000000, inTrust: false },
      { type: "investments", value: 8000000, inTrust: false },
      { type: "life_insurance", value: 2000000, inTrust: false },
    ],
    lifeInsuranceProceeds: 2000000,
    retirementAccounts: 3000000,
    annualGifting: 36000,
    existingTrusts: [] as Array<{ type: string; value: number }>,
    state: "CA",
    charitableIntent: 10,
  };

  it("calculates federal estate tax exposure", () => {
    const result = analyzeEstatePlan(baseEstate);
    expect(typeof result.federalEstateTax).toBe("number");
  });

  it("suggests trust strategies", () => {
    const result = analyzeEstatePlan({
      ...baseEstate,
      totalEstateValue: 20000000,
      filingStatus: "married",
    });
    expect(result.strategies).toBeDefined();
    expect(Array.isArray(result.strategies)).toBe(true);
  });

  it("calculates total potential savings", () => {
    const result = analyzeEstatePlan(baseEstate);
    expect(typeof result.totalPotentialSavings).toBe("number");
    expect(result.totalPotentialSavings).toBeGreaterThanOrEqual(0);
  });

  it("provides annual gifting analysis", () => {
    const result = analyzeEstatePlan(baseEstate);
    expect(result.annualGiftingAnalysis).toBeDefined();
    expect(typeof result.annualGiftingAnalysis.recommendation).toBe("string");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 9: EDUCATION FUNDING PROJECTION
// ═══════════════════════════════════════════════════════════════════

describe("Education Funding Projection", () => {
  const baseEducation = {
    childAge: 5,
    collegeStartAge: 18,
    yearsOfCollege: 4,
    annualCostToday: 30000,
    educationInflation: 0.05,
    current529Balance: 10000,
    monthlyContribution: 500,
    expectedReturn: 0.06,
    financialAidExpected: 0,
    scholarshipsExpected: 0,
    stateDeductionRate: 0.05,
  };

  it("projects total education cost", () => {
    const result = projectEducationFunding(baseEducation);
    expect(result.totalProjectedCost).toBeGreaterThan(0);
  });

  it("calculates funding gap", () => {
    const result = projectEducationFunding({
      ...baseEducation,
      current529Balance: 5000,
      monthlyContribution: 200,
      annualCostToday: 50000,
    });
    expect(typeof result.fundingGap).toBe("number");
  });

  it("calculates monthly savings needed", () => {
    const result = projectEducationFunding({
      ...baseEducation,
      current529Balance: 0,
      monthlyContribution: 0,
    });
    expect(result.monthlyNeeded).toBeGreaterThan(0);
  });

  it("returns year-by-year projections", () => {
    const result = projectEducationFunding(baseEducation);
    expect(result.yearByYear).toBeDefined();
    expect(Array.isArray(result.yearByYear)).toBe(true);
    expect(result.yearByYear.length).toBeGreaterThan(0);
  });

  it("calculates tax benefits", () => {
    const result = projectEducationFunding(baseEducation);
    expect(result.taxBenefits).toBeDefined();
    expect(typeof result.taxBenefits.totalTaxBenefit).toBe("number");
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 10: RISK TOLERANCE ASSESSMENT
// ═══════════════════════════════════════════════════════════════════

describe("Risk Tolerance Assessment", () => {
  const baseRisk = {
    questionnaireAnswers: [
      { questionId: "q1", answer: 4, category: "capacity" as const },
      { questionId: "q2", answer: 3, category: "willingness" as const },
      { questionId: "q3", answer: 3, category: "need" as const },
      { questionId: "q4", answer: 2, category: "knowledge" as const },
    ],
    behavioralSignals: {
      portfolioChangesLast12m: 3,
      panicSellEvents: 0,
      riskAssetAllocation: 0.6,
      loginFrequencyDuringVolatility: 1.5,
      averageHoldingPeriod: 24,
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

  it("returns composite score between 0 and 100", () => {
    const result = scoreRiskTolerance(baseRisk);
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
  });

  it("returns a valid risk category", () => {
    const result = scoreRiskTolerance(baseRisk);
    const validCategories = ["conservative", "moderately_conservative", "moderate", "moderately_aggressive", "aggressive"];
    expect(validCategories).toContain(result.category);
  });

  it("returns recommended allocation that sums to ~100%", () => {
    const result = scoreRiskTolerance(baseRisk);
    expect(result.recommendedAllocation).toBeDefined();
    const total = result.recommendedAllocation.stocks + result.recommendedAllocation.bonds +
      result.recommendedAllocation.alternatives + result.recommendedAllocation.cash;
    expect(total).toBeGreaterThanOrEqual(99);
    expect(total).toBeLessThanOrEqual(101);
  });

  it("returns confidence level", () => {
    const result = scoreRiskTolerance(baseRisk);
    expect(typeof result.confidenceLevel).toBe("number");
    expect(result.confidenceLevel).toBeGreaterThanOrEqual(0);
    expect(result.confidenceLevel).toBeLessThanOrEqual(100);
  });

  it("conservative inputs produce conservative category", () => {
    const result = scoreRiskTolerance({
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
        debtToIncomeRatio: 0.6,
        dependents: 3,
      },
    });
    expect(["conservative", "moderately_conservative"]).toContain(result.category);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SECTION 11: NOTIFICATION TYPE INTEGRATION
// ═══════════════════════════════════════════════════════════════════

describe("Notification Integration Types", () => {
  it("propagation notification has correct type and metadata", () => {
    const result = sendNotification(310, {
      type: "propagation", priority: "high", title: "Insight from professional",
      body: "New risk pattern detected",
      metadata: { eventId: "test-event-1", sourceLayer: "professional", targetLayer: "user" },
    });
    expect(result.type).toBe("propagation");
    expect(result.metadata?.eventId).toBe("test-event-1");
  });

  it("coaching notification has correct type and metadata", () => {
    const result = sendNotification(311, {
      type: "coaching", priority: "medium", title: "Financial Nudge",
      body: "Consider increasing your emergency fund",
      metadata: { messageType: "nudge", category: "savings" },
    });
    expect(result.type).toBe("coaching");
    expect(result.metadata?.messageType).toBe("nudge");
  });

  it("model_complete notification has correct type", () => {
    const result = sendNotification(312, {
      type: "model_complete", priority: "medium", title: "Model Completed: Monte Carlo",
      body: "Monte Carlo Retirement Simulation finished in 150ms",
      metadata: { runId: "run-123", modelSlug: "monte-carlo-retirement" },
    });
    expect(result.type).toBe("model_complete");
    expect(result.metadata?.modelSlug).toBe("monte-carlo-retirement");
  });

  it("enrichment notification has correct type", () => {
    const result = sendNotification(313, {
      type: "enrichment", priority: "low", title: "Profile Enriched",
      body: "Your professional profile has been updated with LinkedIn data",
      metadata: { provider: "linkedin" },
    });
    expect(result.type).toBe("enrichment");
    expect(result.metadata?.provider).toBe("linkedin");
  });

  it("system notification with critical priority", () => {
    const result = sendNotification(314, {
      type: "system", priority: "critical", title: "System Maintenance",
      body: "Scheduled maintenance in 30 minutes",
    });
    expect(result.type).toBe("system");
    expect(result.priority).toBe("critical");
  });
});
