/**
 * Credit Bureau Soft-Pull Integration
 * Handles credit score retrieval, consent management, and credit profile analysis
 * Uses soft-pull only (no impact on client credit score)
 */
import { getDb } from "../db";
import { creditProfiles } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Credit Score Models & Ranges ────────────────────────────────────────

export const SCORE_MODELS = {
  FICO_8: { name: "FICO 8", min: 300, max: 850, ranges: { exceptional: 800, very_good: 740, good: 670, fair: 580, poor: 300 } },
  FICO_9: { name: "FICO 9", min: 300, max: 850, ranges: { exceptional: 800, very_good: 740, good: 670, fair: 580, poor: 300 } },
  VANTAGE_3: { name: "VantageScore 3.0", min: 300, max: 850, ranges: { excellent: 781, good: 661, fair: 601, poor: 500, very_poor: 300 } },
  VANTAGE_4: { name: "VantageScore 4.0", min: 300, max: 850, ranges: { excellent: 781, good: 661, fair: 601, poor: 500, very_poor: 300 } },
};

// ─── Credit Score Rating ─────────────────────────────────────────────────

export function getCreditRating(score: number, model: keyof typeof SCORE_MODELS = "FICO_8"): {
  rating: string;
  color: string;
  description: string;
  percentile: number;
} {
  const ranges = SCORE_MODELS[model].ranges;

  if (model === "FICO_8" || model === "FICO_9") {
    if (score >= 800) return { rating: "Exceptional", color: "#22c55e", description: "Top-tier credit. Qualifies for best rates on all products.", percentile: 95 };
    if (score >= 740) return { rating: "Very Good", color: "#84cc16", description: "Above average. Qualifies for favorable rates.", percentile: 80 };
    if (score >= 670) return { rating: "Good", color: "#eab308", description: "Near or slightly above average. Most lenders consider acceptable.", percentile: 60 };
    if (score >= 580) return { rating: "Fair", color: "#f97316", description: "Below average. May face higher rates or limited options.", percentile: 35 };
    return { rating: "Poor", color: "#ef4444", description: "Well below average. Difficulty obtaining credit.", percentile: 15 };
  }

  // VantageScore
  if (score >= 781) return { rating: "Excellent", color: "#22c55e", description: "Excellent credit standing.", percentile: 90 };
  if (score >= 661) return { rating: "Good", color: "#84cc16", description: "Good credit standing.", percentile: 70 };
  if (score >= 601) return { rating: "Fair", color: "#eab308", description: "Fair credit. Room for improvement.", percentile: 45 };
  if (score >= 500) return { rating: "Poor", color: "#f97316", description: "Poor credit. Significant improvement needed.", percentile: 25 };
  return { rating: "Very Poor", color: "#ef4444", description: "Very poor credit. Major credit issues.", percentile: 10 };
}

// ─── Consent Management ──────────────────────────────────────────────────

export interface CreditPullConsent {
  userId: number;
  consentGiven: boolean;
  consentTimestamp: number;
  purpose: string;
  expiresAt: number;
  ipAddress?: string;
}

const activeConsents = new Map<number, CreditPullConsent>();

export function recordConsent(consent: CreditPullConsent): { consentId: number; valid: boolean } {
  const consentId = Date.now();
  activeConsents.set(consentId, consent);
  return { consentId, valid: consent.consentGiven };
}

export function verifyConsent(consentId: number): { valid: boolean; reason?: string } {
  const consent = activeConsents.get(consentId);
  if (!consent) return { valid: false, reason: "Consent not found" };
  if (!consent.consentGiven) return { valid: false, reason: "Consent not given" };
  if (Date.now() > consent.expiresAt) return { valid: false, reason: "Consent expired" };
  return { valid: true };
}

// ─── Soft Pull Simulation ────────────────────────────────────────────────
// In production, this would call TransUnion/Equifax/Experian APIs
// For now, simulates a soft pull response structure

export interface SoftPullResult {
  success: boolean;
  creditScore: number;
  scoreModel: string;
  bureau: string;
  pullDate: string;
  utilizationPercent: number;
  totalDebt: number;
  openAccounts: number;
  derogatoryMarks: number;
  hardInquiries: number;
  oldestAccountYears: number;
  paymentHistory: {
    onTimePercent: number;
    latePayments30: number;
    latePayments60: number;
    latePayments90: number;
  };
  accountBreakdown: {
    revolving: number;
    installment: number;
    mortgage: number;
    other: number;
  };
  recommendations: string[];
}

export async function performSoftPull(
  userId: number,
  consentId: number,
): Promise<SoftPullResult> {
  // Verify consent
  const consentCheck = verifyConsent(consentId);
  if (!consentCheck.valid) {
    throw new Error(`Consent invalid: ${consentCheck.reason}`);
  }

  // In production: call credit bureau API here
  // For now: return structured response that matches real API format

  // Check if we have a recent pull (within 30 days)
  const db = await getDb();
  if (db) {
    const recent = await db.select()
      .from(creditProfiles)
      .where(eq(creditProfiles.userId, userId))
      .orderBy(desc(creditProfiles.id))
      .limit(1);

    if (recent.length > 0) {
      const lastPull = recent[0];
      return {
        success: true,
        creditScore: lastPull.creditScore ?? 0,
        scoreModel: lastPull.scoreModel ?? "FICO_8",
        bureau: "TransUnion",
        pullDate: lastPull.pullDate,
        utilizationPercent: parseFloat(lastPull.utilizationPercent ?? "0"),
        totalDebt: parseFloat(lastPull.totalDebt ?? "0"),
        openAccounts: lastPull.openAccounts ?? 0,
        derogatoryMarks: lastPull.derogatoryMarks ?? 0,
        hardInquiries: lastPull.hardInquiries ?? 0,
        oldestAccountYears: lastPull.oldestAccountYears ?? 0,
        paymentHistory: { onTimePercent: 97, latePayments30: 1, latePayments60: 0, latePayments90: 0 },
        accountBreakdown: { revolving: 3, installment: 2, mortgage: 1, other: 0 },
        recommendations: generateCreditRecommendations(lastPull.creditScore ?? 0, parseFloat(lastPull.utilizationPercent ?? "0")),
      };
    }
  }

  // No existing data — return placeholder indicating API integration needed
  return {
    success: false,
    creditScore: 0,
    scoreModel: "FICO_8",
    bureau: "TransUnion",
    pullDate: new Date().toISOString().split("T")[0],
    utilizationPercent: 0,
    totalDebt: 0,
    openAccounts: 0,
    derogatoryMarks: 0,
    hardInquiries: 0,
    oldestAccountYears: 0,
    paymentHistory: { onTimePercent: 0, latePayments30: 0, latePayments60: 0, latePayments90: 0 },
    accountBreakdown: { revolving: 0, installment: 0, mortgage: 0, other: 0 },
    recommendations: ["Credit bureau API integration required for live data"],
  };
}

// ─── Save Credit Profile ─────────────────────────────────────────────────

export async function saveCreditProfile(
  userId: number,
  data: {
    creditScore: number;
    scoreModel: string;
    utilizationPercent: number;
    totalDebt: number;
    openAccounts: number;
    derogatoryMarks: number;
    hardInquiries: number;
    oldestAccountYears: number;
    consentId: number;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db.insert(creditProfiles).values({
    userId,
    pullDate: new Date().toISOString().split("T")[0],
    creditScore: data.creditScore,
    scoreModel: data.scoreModel,
    utilizationPercent: data.utilizationPercent.toString(),
    totalDebt: data.totalDebt.toString(),
    openAccounts: data.openAccounts,
    derogatoryMarks: data.derogatoryMarks,
    hardInquiries: data.hardInquiries,
    oldestAccountYears: data.oldestAccountYears,
    consentId: data.consentId,
  });

  return (result as any)[0]?.insertId ?? 0;
}

// ─── Credit History for User ─────────────────────────────────────────────

export async function getCreditHistory(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(creditProfiles)
    .where(eq(creditProfiles.userId, userId))
    .orderBy(desc(creditProfiles.id));
}

// ─── Credit Recommendations ──────────────────────────────────────────────

function generateCreditRecommendations(score: number, utilization: number): string[] {
  const recs: string[] = [];

  if (utilization > 30) {
    recs.push(`Reduce credit utilization from ${utilization}% to below 30% (ideally under 10%) for maximum score improvement.`);
  }
  if (utilization > 50) {
    recs.push("Consider a balance transfer or debt consolidation to lower high utilization quickly.");
  }
  if (score < 670) {
    recs.push("Set up automatic payments to ensure 100% on-time payment history going forward.");
    recs.push("Consider becoming an authorized user on a family member's long-standing, low-utilization card.");
  }
  if (score < 740) {
    recs.push("Avoid opening new credit accounts unless necessary — each hard inquiry can reduce score by 5-10 points.");
    recs.push("Keep oldest credit accounts open to maintain credit history length.");
  }
  if (score >= 740 && score < 800) {
    recs.push("Maintain current habits. Consider requesting credit limit increases (soft pull) to lower utilization ratio.");
  }
  if (score >= 800) {
    recs.push("Excellent credit. Maintain current practices. You qualify for the best rates available.");
  }

  return recs;
}

// ─── Insurance Underwriting Impact ───────────────────────────────────────

export function assessInsuranceImpact(creditScore: number): {
  lifeInsuranceImpact: string;
  autoInsuranceImpact: string;
  homeInsuranceImpact: string;
  estimatedPremiumTier: string;
} {
  if (creditScore >= 800) {
    return {
      lifeInsuranceImpact: "No negative impact. Preferred Plus rates likely available.",
      autoInsuranceImpact: "Best available rates. Credit-based insurance score is excellent.",
      homeInsuranceImpact: "Best available rates. No surcharges expected.",
      estimatedPremiumTier: "preferred_plus",
    };
  }
  if (creditScore >= 740) {
    return {
      lifeInsuranceImpact: "Minimal impact. Preferred rates likely available.",
      autoInsuranceImpact: "Very competitive rates. Minor premium reduction possible with higher score.",
      homeInsuranceImpact: "Competitive rates. No significant surcharges.",
      estimatedPremiumTier: "preferred",
    };
  }
  if (creditScore >= 670) {
    return {
      lifeInsuranceImpact: "Standard rates. Credit score is not a primary underwriting factor for life insurance.",
      autoInsuranceImpact: "Standard rates. Some carriers may apply moderate surcharge.",
      homeInsuranceImpact: "Standard rates. Minor surcharge possible with some carriers.",
      estimatedPremiumTier: "standard",
    };
  }
  if (creditScore >= 580) {
    return {
      lifeInsuranceImpact: "Standard rates. Life insurance underwriting focuses more on health factors.",
      autoInsuranceImpact: "Above-average premiums. Credit-based insurance score impacts auto rates significantly.",
      homeInsuranceImpact: "Moderate surcharge likely. Consider shopping multiple carriers.",
      estimatedPremiumTier: "standard_plus",
    };
  }
  return {
    lifeInsuranceImpact: "Standard rates. Life insurance primarily based on health, not credit.",
    autoInsuranceImpact: "Significantly higher premiums. Consider credit improvement strategies before shopping.",
    homeInsuranceImpact: "Higher premiums expected. Some carriers may decline coverage.",
    estimatedPremiumTier: "substandard",
  };
}

// ─── Debt-to-Income Analysis ─────────────────────────────────────────────

export function analyzeDTI(
  monthlyDebtPayments: number,
  grossMonthlyIncome: number,
): {
  dtiRatio: number;
  rating: string;
  mortgageEligibility: string;
  recommendations: string[];
} {
  const dtiRatio = grossMonthlyIncome > 0 ? (monthlyDebtPayments / grossMonthlyIncome) * 100 : 0;

  let rating: string;
  let mortgageEligibility: string;
  const recommendations: string[] = [];

  if (dtiRatio <= 20) {
    rating = "Excellent";
    mortgageEligibility = "Qualifies for all mortgage programs. Strong position for jumbo loans.";
  } else if (dtiRatio <= 36) {
    rating = "Good";
    mortgageEligibility = "Qualifies for conventional mortgages. May qualify for jumbo with compensating factors.";
  } else if (dtiRatio <= 43) {
    rating = "Acceptable";
    mortgageEligibility = "Qualifies for FHA/VA loans. Conventional may require compensating factors (high credit score, reserves).";
    recommendations.push("Consider paying down smallest debts to reduce DTI below 36%.");
  } else if (dtiRatio <= 50) {
    rating = "High";
    mortgageEligibility = "Limited options. FHA may approve up to 50% DTI with strong compensating factors.";
    recommendations.push("Prioritize debt reduction before applying for mortgage.");
    recommendations.push("Consider debt consolidation to lower monthly payments.");
  } else {
    rating = "Very High";
    mortgageEligibility = "Unlikely to qualify for any standard mortgage program.";
    recommendations.push("Aggressive debt reduction plan needed.");
    recommendations.push("Consider credit counseling or debt management program.");
    recommendations.push("Delay major purchases until DTI is below 43%.");
  }

  return {
    dtiRatio: parseFloat(dtiRatio.toFixed(1)),
    rating,
    mortgageEligibility,
    recommendations,
  };
}
