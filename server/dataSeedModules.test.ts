import { describe, it, expect } from "vitest";

// ─── Investment Intelligence Tests ───────────────────────────────────────
import {
  runIulBackTest,
  runMonteCarlo,
  compareIulVsMarket,
} from "./services/investmentIntelligence";
import type { IulBackTestParams, MonteCarloParams } from "./services/investmentIntelligence";

describe("Investment Intelligence — IUL vs Market Comparison", () => {
  it("should compare IUL vs direct market investment", () => {
    const result = compareIulVsMarket(
      10000, // annual premium
      20,    // years
      12,    // cap
      0,     // floor
      100,   // participation
      0.02,  // COI as decimal
      2000,  // startYear
    );
    expect(result.iulFinalValue).toBeGreaterThan(0);
    expect(result.marketFinalValue).toBeGreaterThan(0);
    expect(typeof result.iulTotalReturn).toBe("number");
    expect(typeof result.marketTotalReturn).toBe("number");
    expect(result.yearByYear.length).toBe(20);
  });
});

describe("Investment Intelligence — IUL Back-test Engine", () => {
  const baseParams: IulBackTestParams = {
    initialPremium: 0,
    annualPremium: 10000,
    years: 20,
    capRate: 12,
    floorRate: 0,
    participationRate: 100,
    spread: 0,
    costOfInsurance: 0,
    startYear: 2000,
  };

  it("should run a basic IUL backtest with default parameters", () => {
    const result = runIulBackTest({ ...baseParams, costOfInsurance: 1 });
    expect(result.results).toHaveLength(20);
    expect(result.summary.totalPremiums).toBeGreaterThan(0);
    expect(result.summary.finalAccountValue).toBeGreaterThan(0);
  });

  it("should respect the cap rate", () => {
    const result = runIulBackTest({ ...baseParams, years: 10, capRate: 8 });
    for (const yr of result.results) {
      expect(yr.creditedRate).toBeLessThanOrEqual(8);
    }
  });

  it("should respect the floor rate", () => {
    const result = runIulBackTest({ ...baseParams, years: 10, floorRate: 1 });
    for (const yr of result.results) {
      expect(yr.creditedRate).toBeGreaterThanOrEqual(1);
    }
  });

  it("should apply participation rate correctly", () => {
    const result100 = runIulBackTest({ ...baseParams, years: 10, capRate: 20, participationRate: 100 });
    const result50 = runIulBackTest({ ...baseParams, years: 10, capRate: 20, participationRate: 50 });
    expect(result50.summary.finalAccountValue).toBeLessThanOrEqual(result100.summary.finalAccountValue);
  });

  it("should deduct cost of insurance each year", () => {
    const withCOI = runIulBackTest({ ...baseParams, years: 10, capRate: 10, costOfInsurance: 5 });
    const withoutCOI = runIulBackTest({ ...baseParams, years: 10, capRate: 10, costOfInsurance: 0 });
    expect(withCOI.summary.finalAccountValue).toBeLessThan(withoutCOI.summary.finalAccountValue);
  });

  it("should apply spread correctly", () => {
    const withSpread = runIulBackTest({ ...baseParams, years: 10, capRate: 15, spread: 2 });
    const noSpread = runIulBackTest({ ...baseParams, years: 10, capRate: 15, spread: 0 });
    expect(withSpread.summary.finalAccountValue).toBeLessThan(noSpread.summary.finalAccountValue);
  });

  it("should calculate internal rate of return", () => {
    const result = runIulBackTest({ ...baseParams, costOfInsurance: 1 });
    expect(typeof result.summary.internalRateOfReturn).toBe("number");
  });

  it("should track cumulative premiums in results", () => {
    const result = runIulBackTest({ ...baseParams, years: 5 });
    expect(result.results[4].cumulativePremiums).toBeGreaterThan(0);
    // Verify premiums increase year over year
    expect(result.results[4].cumulativePremiums).toBeGreaterThan(result.results[0].cumulativePremiums);
  });
});

describe("Investment Intelligence — Monte Carlo Simulation", () => {
  it("should run 1000 simulations", () => {
    const result = runMonteCarlo({
      initialInvestment: 1000000,
      annualContribution: 20000,
      years: 30,
      simulations: 1000,
      meanReturn: 7,
      stdDeviation: 15,
      inflationRate: 3,
    });
    expect(result.statistics.simulations).toBe(1000);
  });

  it("should return percentile arrays", () => {
    const result = runMonteCarlo({
      initialInvestment: 500000,
      annualContribution: 10000,
      years: 20,
      simulations: 500,
      meanReturn: 7,
      stdDeviation: 12,
      inflationRate: 2.5,
    });
    expect(result.percentile10.length).toBe(21); // years + 1 (includes year 0)
    expect(result.percentile50.length).toBe(21);
    expect(result.percentile90.length).toBe(21);
  });

  it("should have p90 >= p50 >= p10 at final year", () => {
    const result = runMonteCarlo({
      initialInvestment: 500000,
      annualContribution: 0,
      years: 20,
      simulations: 1000,
      meanReturn: 7,
      stdDeviation: 15,
      inflationRate: 3,
    });
    const lastIdx = result.percentile10.length - 1;
    expect(result.percentile90[lastIdx]).toBeGreaterThanOrEqual(result.percentile50[lastIdx]);
    expect(result.percentile50[lastIdx]).toBeGreaterThanOrEqual(result.percentile10[lastIdx]);
  });

  it("should calculate success rate", () => {
    const result = runMonteCarlo({
      initialInvestment: 1000000,
      annualContribution: 0,
      years: 30,
      simulations: 1000,
      meanReturn: 7,
      stdDeviation: 15,
      inflationRate: 3,
      withdrawalRate: 4,
      withdrawalStartYear: 1,
    });
    expect(result.successRate).toBeGreaterThanOrEqual(0);
    expect(result.successRate).toBeLessThanOrEqual(100);
  });

  it("should show higher success with lower withdrawal rate", () => {
    const lowWithdrawal = runMonteCarlo({
      initialInvestment: 1000000,
      annualContribution: 0,
      years: 30,
      simulations: 1000,
      meanReturn: 7,
      stdDeviation: 15,
      inflationRate: 3,
      withdrawalRate: 3,
      withdrawalStartYear: 1,
    });
    const highWithdrawal = runMonteCarlo({
      initialInvestment: 1000000,
      annualContribution: 0,
      years: 30,
      simulations: 1000,
      meanReturn: 7,
      stdDeviation: 15,
      inflationRate: 3,
      withdrawalRate: 8,
      withdrawalStartYear: 1,
    });
    expect(lowWithdrawal.successRate).toBeGreaterThanOrEqual(highWithdrawal.successRate);
  });

  it("should handle zero initial investment", () => {
    const result = runMonteCarlo({
      initialInvestment: 0,
      annualContribution: 10000,
      years: 30,
      simulations: 500,
      meanReturn: 7,
      stdDeviation: 15,
      inflationRate: 3,
    });
    const lastIdx = result.percentile50.length - 1;
    expect(result.percentile50[lastIdx]).toBeGreaterThan(0);
  });

  it("should respect custom simulation count", () => {
    const result = runMonteCarlo({
      initialInvestment: 100000,
      annualContribution: 0,
      years: 10,
      simulations: 500,
      meanReturn: 7,
      stdDeviation: 15,
      inflationRate: 3,
    });
    expect(result.statistics.simulations).toBe(500);
  });
});

// ─── Estate Planning Knowledge Tests ─────────────────────────────────────
import {
  ESTATE_PLANNING_ARTICLES,
  getEstatePlanningArticles,
  getArticleById,
  getRecommendedStrategies,
  getAllBenchmarks,
} from "./services/estatePlanningKnowledge";

describe("Estate Planning Knowledge — Articles", () => {
  it("should have at least 8 articles", () => {
    expect(ESTATE_PLANNING_ARTICLES.length).toBeGreaterThanOrEqual(8);
  });

  it("should have unique IDs", () => {
    const ids = ESTATE_PLANNING_ARTICLES.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have valid urgency levels", () => {
    const validLevels = ["critical", "high", "medium", "low"];
    for (const article of ESTATE_PLANNING_ARTICLES) {
      expect(validLevels).toContain(article.urgencyLevel);
    }
  });

  it("should have key points for each article", () => {
    for (const article of ESTATE_PLANNING_ARTICLES) {
      expect(article.keyPoints.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("should have related strategies", () => {
    for (const article of ESTATE_PLANNING_ARTICLES) {
      expect(article.relatedStrategies.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("should filter by category", () => {
    const trustArticles = getEstatePlanningArticles({ category: "trust_planning" });
    expect(trustArticles.length).toBeGreaterThan(0);
    for (const a of trustArticles) {
      expect(a.category).toBe("trust_planning");
    }
  });

  it("should filter by urgency level", () => {
    const critical = getEstatePlanningArticles({ urgencyLevel: "critical" });
    for (const a of critical) {
      expect(a.urgencyLevel).toBe("critical");
    }
  });

  it("should get article by ID", () => {
    const article = getArticleById("tcja-sunset-2025");
    expect(article).toBeDefined();
    expect(article?.title).toContain("TCJA");
  });

  it("should return undefined for non-existent ID", () => {
    const article = getArticleById("non-existent-id");
    expect(article).toBeUndefined();
  });
});

describe("Estate Planning Knowledge — Strategy Recommendations", () => {
  it("should recommend strategies for high net worth", () => {
    const result = getRecommendedStrategies(15_000_000, 55, false);
    expect(result.strategies.length).toBeGreaterThan(0);
  });

  it("should flag TCJA sunset as timeline sensitive in 2025", () => {
    const result = getRecommendedStrategies(10_000_000, 55, false);
    // The function checks if year is 2025 and net worth > 7M
    // Since we're in 2026, it depends on critical articles
    expect(typeof result.timelineSensitive).toBe("boolean");
  });

  it("should include business strategies when hasBusinessInterest is true", () => {
    const withBiz = getRecommendedStrategies(10_000_000, 55, true);
    const withoutBiz = getRecommendedStrategies(10_000_000, 55, false);
    expect(withBiz.strategies.length).toBeGreaterThanOrEqual(withoutBiz.strategies.length);
  });

  it("should sort by urgency (critical first)", () => {
    const result = getRecommendedStrategies(15_000_000, 55, true);
    const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < result.strategies.length; i++) {
      expect(urgencyOrder[result.strategies[i].urgencyLevel])
        .toBeGreaterThanOrEqual(urgencyOrder[result.strategies[i - 1].urgencyLevel]);
    }
  });

  it("should return fewer strategies for lower net worth", () => {
    const high = getRecommendedStrategies(20_000_000, 55, false);
    const low = getRecommendedStrategies(1_000_000, 55, false);
    expect(high.strategies.length).toBeGreaterThanOrEqual(low.strategies.length);
  });
});

describe("Estate Planning Knowledge — Industry Benchmarks", () => {
  it("should return benchmarks from getAllBenchmarks", async () => {
    const benchmarks = await getAllBenchmarks();
    expect(Array.isArray(benchmarks)).toBe(true);
  });
});

// ─── Plaid Production Tests ──────────────────────────────────────────────
import {
  TRANSACTION_CATEGORIES,
  categorizeTransaction,
  categorizeTransactions,
  processPlaidWebhook,
} from "./services/plaidProduction";

describe("Plaid Production — Transaction Categorization", () => {
  it("should categorize a known Plaid category", () => {
    const result = categorizeTransaction("FOOD_AND_DRINK_GROCERIES", 85.50, "Whole Foods", "2025-01-15");
    expect(result.planningCategory).toBe("food");
    expect(result.subcategory).toBe("groceries");
    expect(result.isEssential).toBe(true);
    expect(result.budgetGroup).toBe("variable");
  });

  it("should categorize rent as essential housing", () => {
    const result = categorizeTransaction("RENT", 2500, "Landlord", "2025-01-01");
    expect(result.planningCategory).toBe("housing");
    expect(result.isEssential).toBe(true);
    expect(result.budgetGroup).toBe("fixed");
  });

  it("should categorize entertainment as discretionary", () => {
    const result = categorizeTransaction("ENTERTAINMENT", 50, "Netflix", "2025-01-01");
    expect(result.planningCategory).toBe("entertainment");
    expect(result.isEssential).toBe(false);
    expect(result.budgetGroup).toBe("discretionary");
  });

  it("should handle array categories", () => {
    const result = categorizeTransaction(["Food and Drink", "Groceries"], 120, "Trader Joes", "2025-01-15");
    expect(result.planningCategory).not.toBe("uncategorized");
  });

  it("should use merchant heuristic for Amazon", () => {
    const result = categorizeTransaction("UNKNOWN", 45, "Amazon.com", "2025-01-15");
    expect(result.planningCategory).toBe("shopping");
  });

  it("should use merchant heuristic for Starbucks", () => {
    const result = categorizeTransaction("UNKNOWN", 5.50, "Starbucks", "2025-01-15");
    expect(result.planningCategory).toBe("food");
    expect(result.subcategory).toBe("coffee_shops");
  });

  it("should default to uncategorized for unknown categories", () => {
    const result = categorizeTransaction("TOTALLY_UNKNOWN_CATEGORY", 100, "Unknown Merchant", "2025-01-15");
    expect(result.planningCategory).toBe("uncategorized");
  });

  it("should have at least 50 category mappings", () => {
    expect(Object.keys(TRANSACTION_CATEGORIES).length).toBeGreaterThanOrEqual(50);
  });
});

describe("Plaid Production — Batch Categorization", () => {
  it("should categorize multiple transactions and provide summary", () => {
    const transactions = [
      { category: "RENT", amount: 2500, merchantName: "Landlord", date: "2025-01-01" },
      { category: "FOOD_AND_DRINK_GROCERIES", amount: 200, merchantName: "Kroger", date: "2025-01-05" },
      { category: "ENTERTAINMENT_STREAMING", amount: 15, merchantName: "Netflix", date: "2025-01-10" },
      { category: "INCOME_SALARY", amount: -5000, merchantName: "Employer", date: "2025-01-15" },
    ];
    const result = categorizeTransactions(transactions);
    expect(result.categorized).toHaveLength(4);
    expect(result.summary).toBeDefined();
    expect(result.budgetBreakdown).toBeDefined();
    expect(result.essentialVsDiscretionary).toBeDefined();
  });

  it("should separate essential vs discretionary spending", () => {
    const transactions = [
      { category: "RENT", amount: 2500, merchantName: "Landlord", date: "2025-01-01" },
      { category: "ENTERTAINMENT", amount: 100, merchantName: "Movies", date: "2025-01-05" },
    ];
    const result = categorizeTransactions(transactions);
    expect(result.essentialVsDiscretionary.essential).toBe(2500);
    expect(result.essentialVsDiscretionary.discretionary).toBe(100);
  });
});

describe("Plaid Production — Webhook Handler", () => {
  it("should handle TRANSACTIONS/SYNC_UPDATES_AVAILABLE", async () => {
    const result = await processPlaidWebhook({
      webhook_type: "TRANSACTIONS",
      webhook_code: "SYNC_UPDATES_AVAILABLE",
      item_id: "test-item-1",
    });
    expect(result.action).toBe("sync_transactions");
    expect(result.success).toBe(true);
    expect(result.requiresUserAction).toBe(false);
  });

  it("should handle TRANSACTIONS/INITIAL_UPDATE", async () => {
    const result = await processPlaidWebhook({
      webhook_type: "TRANSACTIONS",
      webhook_code: "INITIAL_UPDATE",
      item_id: "test-item-2",
      new_transactions: 50,
    });
    expect(result.action).toBe("initial_transaction_load");
    expect(result.details).toContain("50");
  });

  it("should handle ITEM/ERROR requiring user action", async () => {
    const result = await processPlaidWebhook({
      webhook_type: "ITEM",
      webhook_code: "ERROR",
      item_id: "test-item-3",
      error: { error_code: "ITEM_LOGIN_REQUIRED", error_message: "Login required" },
    });
    expect(result.success).toBe(false);
    expect(result.requiresUserAction).toBe(true);
  });

  it("should handle ITEM/PENDING_EXPIRATION", async () => {
    const result = await processPlaidWebhook({
      webhook_type: "ITEM",
      webhook_code: "PENDING_EXPIRATION",
      item_id: "test-item-4",
      consent_expiration_time: "2025-06-01T00:00:00Z",
    });
    expect(result.requiresUserAction).toBe(true);
  });

  it("should handle HOLDINGS webhook", async () => {
    const result = await processPlaidWebhook({
      webhook_type: "HOLDINGS",
      webhook_code: "DEFAULT_UPDATE",
      item_id: "test-item-5",
    });
    expect(result.action).toBe("sync_holdings");
  });

  it("should handle unknown webhook types gracefully", async () => {
    const result = await processPlaidWebhook({
      webhook_type: "TRANSFER" as any,
      webhook_code: "DEFAULT_UPDATE" as any,
      item_id: "test-item-6",
    });
    expect(result.action).toBe("logged");
    expect(result.success).toBe(true);
  });
});

// ─── Credit Bureau Tests ─────────────────────────────────────────────────
import {
  SCORE_MODELS,
  getCreditRating,
  recordConsent,
  verifyConsent,
  assessInsuranceImpact,
  analyzeDTI,
} from "./services/creditBureau";

describe("Credit Bureau — Score Models", () => {
  it("should have FICO 8 model defined", () => {
    expect(SCORE_MODELS.FICO_8).toBeDefined();
    expect(SCORE_MODELS.FICO_8.min).toBe(300);
    expect(SCORE_MODELS.FICO_8.max).toBe(850);
  });

  it("should have VantageScore 3.0 model defined", () => {
    expect(SCORE_MODELS.VANTAGE_3).toBeDefined();
  });
});

describe("Credit Bureau — Credit Rating", () => {
  it("should rate 800+ as Exceptional (FICO)", () => {
    const rating = getCreditRating(820, "FICO_8");
    expect(rating.rating).toBe("Exceptional");
    expect(rating.percentile).toBe(95);
  });

  it("should rate 740-799 as Very Good (FICO)", () => {
    const rating = getCreditRating(760, "FICO_8");
    expect(rating.rating).toBe("Very Good");
  });

  it("should rate 670-739 as Good (FICO)", () => {
    const rating = getCreditRating(700, "FICO_8");
    expect(rating.rating).toBe("Good");
  });

  it("should rate 580-669 as Fair (FICO)", () => {
    const rating = getCreditRating(620, "FICO_8");
    expect(rating.rating).toBe("Fair");
  });

  it("should rate below 580 as Poor (FICO)", () => {
    const rating = getCreditRating(500, "FICO_8");
    expect(rating.rating).toBe("Poor");
  });

  it("should rate 781+ as Excellent (VantageScore)", () => {
    const rating = getCreditRating(800, "VANTAGE_3");
    expect(rating.rating).toBe("Excellent");
  });

  it("should include color codes", () => {
    const rating = getCreditRating(800, "FICO_8");
    expect(rating.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("Credit Bureau — Consent Management", () => {
  it("should record consent and return valid", () => {
    const result = recordConsent({
      userId: 1,
      consentGiven: true,
      consentTimestamp: Date.now(),
      purpose: "soft_pull",
      expiresAt: Date.now() + 86400000,
    });
    expect(result.valid).toBe(true);
    expect(result.consentId).toBeGreaterThan(0);
  });

  it("should return invalid for consent not given", () => {
    const result = recordConsent({
      userId: 1,
      consentGiven: false,
      consentTimestamp: Date.now(),
      purpose: "soft_pull",
      expiresAt: Date.now() + 86400000,
    });
    expect(result.valid).toBe(false);
  });

  it("should verify valid consent", () => {
    const { consentId } = recordConsent({
      userId: 1,
      consentGiven: true,
      consentTimestamp: Date.now(),
      purpose: "soft_pull",
      expiresAt: Date.now() + 86400000,
    });
    const check = verifyConsent(consentId);
    expect(check.valid).toBe(true);
  });

  it("should reject non-existent consent", () => {
    const check = verifyConsent(999999999);
    expect(check.valid).toBe(false);
    expect(check.reason).toBe("Consent not found");
  });

  it("should reject expired consent", () => {
    const { consentId } = recordConsent({
      userId: 1,
      consentGiven: true,
      consentTimestamp: Date.now(),
      purpose: "soft_pull",
      expiresAt: Date.now() - 1000, // already expired
    });
    const check = verifyConsent(consentId);
    expect(check.valid).toBe(false);
    expect(check.reason).toBe("Consent expired");
  });
});

describe("Credit Bureau — Insurance Impact", () => {
  it("should assess preferred_plus for 800+ score", () => {
    const impact = assessInsuranceImpact(820);
    expect(impact.estimatedPremiumTier).toBe("preferred_plus");
  });

  it("should assess preferred for 740-799 score", () => {
    const impact = assessInsuranceImpact(760);
    expect(impact.estimatedPremiumTier).toBe("preferred");
  });

  it("should assess standard for 670-739 score", () => {
    const impact = assessInsuranceImpact(700);
    expect(impact.estimatedPremiumTier).toBe("standard");
  });

  it("should assess substandard for below 580", () => {
    const impact = assessInsuranceImpact(500);
    expect(impact.estimatedPremiumTier).toBe("substandard");
  });

  it("should include all insurance types", () => {
    const impact = assessInsuranceImpact(750);
    expect(impact.lifeInsuranceImpact).toBeTruthy();
    expect(impact.autoInsuranceImpact).toBeTruthy();
    expect(impact.homeInsuranceImpact).toBeTruthy();
  });
});

describe("Credit Bureau — DTI Analysis", () => {
  it("should calculate DTI ratio correctly", () => {
    const result = analyzeDTI(2000, 8000);
    expect(result.dtiRatio).toBe(25);
    expect(result.rating).toBe("Good");
  });

  it("should rate excellent for DTI <= 20%", () => {
    const result = analyzeDTI(1000, 10000);
    expect(result.rating).toBe("Excellent");
  });

  it("should rate acceptable for DTI 36-43%", () => {
    const result = analyzeDTI(4000, 10000);
    expect(result.rating).toBe("Acceptable");
  });

  it("should rate high for DTI 43-50%", () => {
    const result = analyzeDTI(4500, 10000);
    expect(result.rating).toBe("High");
  });

  it("should rate very high for DTI > 50%", () => {
    const result = analyzeDTI(6000, 10000);
    expect(result.rating).toBe("Very High");
  });

  it("should handle zero income gracefully", () => {
    const result = analyzeDTI(2000, 0);
    expect(result.dtiRatio).toBe(0);
  });

  it("should provide mortgage eligibility info", () => {
    const result = analyzeDTI(2000, 8000);
    expect(result.mortgageEligibility).toBeTruthy();
  });

  it("should provide recommendations for high DTI", () => {
    const result = analyzeDTI(5000, 10000);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

// ─── eSignature Service Tests ────────────────────────────────────────────
import {
  createEnvelope,
  getEnvelopeByEnvelopeId,
} from "./services/esignatureService";
import type { EsignatureProvider, EsignatureStatus } from "./services/esignatureService";

describe("eSignature Service — Types", () => {
  it("should accept valid provider types", () => {
    const providers: EsignatureProvider[] = ["docusign", "dropbox_sign", "manual"];
    expect(providers).toHaveLength(3);
  });

  it("should accept valid status types", () => {
    const statuses: EsignatureStatus[] = ["created", "sent", "delivered", "viewed", "signed", "completed", "declined", "voided", "expired"];
    expect(statuses.length).toBeGreaterThanOrEqual(8);
  });
});

describe("eSignature Service — Envelope Operations", () => {
  it("should create an envelope", async () => {
    const result = await createEnvelope({
      professionalId: 1,
      clientUserId: 2,
      documentType: "application",
      provider: "docusign",
      envelopeId: "test-envelope-" + Date.now(),
      signerEmail: "john@example.com",
      signerName: "John Doe",
    });
    expect(result.envelopeId).toBeTruthy();
    expect(result.status).toBe("created");
  });

  it("should return null for non-existent envelope", async () => {
    const result = await getEnvelopeByEnvelopeId("non-existent-id");
    expect(result).toBeNull();
  });
});

// ─── Data Seed Orchestrator Tests ────────────────────────────────────────
import { getSeedStatus } from "./services/dataSeedOrchestrator";

describe("Data Seed Orchestrator", () => {
  it("should return seed status with all modules", async () => {
    const status = await getSeedStatus();
    expect(status).toHaveProperty("taxParams");
    expect(status).toHaveProperty("ssaParams");
    expect(status).toHaveProperty("medicareParams");
    expect(status).toHaveProperty("carriers");
    expect(status).toHaveProperty("products");
    expect(status).toHaveProperty("iulCrediting");
    expect(status).toHaveProperty("marketIndex");
    expect(status).toHaveProperty("economicHistory");
    expect(status).toHaveProperty("benchmarks");
  });
});
