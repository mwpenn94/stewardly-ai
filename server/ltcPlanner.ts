import { getDb } from "./db";
import { ltcAnalyses } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Types ─────────────────────────────────────────────────────
export interface LtcInput {
  currentAge: number;
  retirementAge?: number;
  state: string;
  gender: "male" | "female" | "other";
  maritalStatus: "single" | "married" | "divorced" | "widowed";
  healthStatus: "excellent" | "good" | "fair" | "poor";
  annualIncome?: number;
  totalAssets?: number;
  hasLtcInsurance: boolean;
  existingDailyBenefit?: number;
  existingBenefitPeriodYears?: number;
}

export interface LtcProjection {
  probabilityOfNeed: number;
  averageDurationYears: number;
  projectedAnnualCost: number;
  projectedTotalCost: number;
  inflationAdjustedCost: number;
  fundingGap: number;
  strategies: FundingStrategy[];
  readinessScore: number;
}

export interface FundingStrategy {
  name: string;
  type: "traditional_ltc" | "hybrid_life_ltc" | "self_fund" | "medicaid" | "annuity" | "hsa";
  description: string;
  estimatedAnnualCost: number;
  pros: string[];
  cons: string[];
  suitabilityScore: number; // 0-100
}

// ─── Cost Data by State (2026 estimates) ───────────────────────
const STATE_DAILY_COSTS: Record<string, { homeHealth: number; assistedLiving: number; nursingHome: number }> = {
  AZ: { homeHealth: 185, assistedLiving: 155, nursingHome: 280 },
  CA: { homeHealth: 220, assistedLiving: 195, nursingHome: 370 },
  NY: { homeHealth: 210, assistedLiving: 185, nursingHome: 420 },
  TX: { homeHealth: 170, assistedLiving: 140, nursingHome: 240 },
  FL: { homeHealth: 175, assistedLiving: 145, nursingHome: 310 },
  IL: { homeHealth: 190, assistedLiving: 160, nursingHome: 290 },
  PA: { homeHealth: 185, assistedLiving: 155, nursingHome: 340 },
  OH: { homeHealth: 165, assistedLiving: 135, nursingHome: 260 },
  GA: { homeHealth: 165, assistedLiving: 130, nursingHome: 240 },
  NC: { homeHealth: 165, assistedLiving: 140, nursingHome: 275 },
  DEFAULT: { homeHealth: 180, assistedLiving: 150, nursingHome: 290 },
};

// ─── Probability Model ────────────────────────────────────────
export function calculateProbabilityOfNeed(input: LtcInput): number {
  // Base: ~52% of people turning 65 will need some form of LTC
  let probability = 0.52;

  // Gender adjustment (women need care more often and longer)
  if (input.gender === "female") probability += 0.08;
  if (input.gender === "male") probability -= 0.05;

  // Health status
  const healthAdj: Record<string, number> = { excellent: -0.10, good: -0.03, fair: 0.08, poor: 0.15 };
  probability += healthAdj[input.healthStatus] || 0;

  // Marital status (married people have spousal care option)
  if (input.maritalStatus === "married") probability -= 0.05;
  if (input.maritalStatus === "single" || input.maritalStatus === "divorced") probability += 0.03;

  return Math.max(0.1, Math.min(0.95, probability));
}

export function estimateCareDuration(input: LtcInput): number {
  // Average: 3.7 years for women, 2.2 years for men
  let duration = input.gender === "female" ? 3.7 : 2.2;

  if (input.healthStatus === "poor") duration += 1.5;
  if (input.healthStatus === "fair") duration += 0.5;
  if (input.healthStatus === "excellent") duration -= 0.5;

  return Math.max(0.5, duration);
}

// ─── Cost Projection ──────────────────────────────────────────
export function projectCosts(input: LtcInput): { annualCost: number; totalCost: number; inflationAdjusted: number } {
  const costs = STATE_DAILY_COSTS[input.state] || STATE_DAILY_COSTS.DEFAULT;
  // Weighted average: 40% home health, 35% assisted living, 25% nursing home
  const dailyCost = costs.homeHealth * 0.4 + costs.assistedLiving * 0.35 + costs.nursingHome * 0.25;
  const annualCost = dailyCost * 365;
  const duration = estimateCareDuration(input);
  const totalCost = annualCost * duration;

  // Inflation adjustment (3.5% healthcare inflation, projected to retirement age)
  const yearsToRetirement = Math.max(0, (input.retirementAge || 65) - input.currentAge);
  const inflationFactor = Math.pow(1.035, yearsToRetirement);
  const inflationAdjusted = totalCost * inflationFactor;

  return { annualCost, totalCost, inflationAdjusted };
}

// ─── Funding Gap ──────────────────────────────────────────────
export function calculateFundingGap(input: LtcInput, inflationAdjustedCost: number): number {
  let covered = 0;
  if (input.hasLtcInsurance && input.existingDailyBenefit && input.existingBenefitPeriodYears) {
    covered = input.existingDailyBenefit * 365 * input.existingBenefitPeriodYears;
  }
  return Math.max(0, inflationAdjustedCost - covered);
}

// ─── Strategy Generation ──────────────────────────────────────
export function generateStrategies(input: LtcInput, gap: number): FundingStrategy[] {
  const strategies: FundingStrategy[] = [];
  const age = input.currentAge;

  // Traditional LTC Insurance
  if (age < 70) {
    const annualPremium = age < 55 ? gap * 0.015 : age < 65 ? gap * 0.025 : gap * 0.04;
    strategies.push({
      name: "Traditional LTC Insurance",
      type: "traditional_ltc",
      description: "Standalone LTC policy with daily benefit and inflation rider. Best purchased before age 60 for lower premiums.",
      estimatedAnnualCost: Math.round(annualPremium),
      pros: ["Dedicated coverage", "Tax-deductible premiums (if itemizing)", "Inflation protection available"],
      cons: ["Use-it-or-lose-it (no death benefit)", "Premium increases possible", "Underwriting required"],
      suitabilityScore: age < 60 ? 85 : age < 65 ? 70 : 55,
    });
  }

  // Hybrid Life/LTC
  strategies.push({
    name: "Hybrid Life/LTC Policy",
    type: "hybrid_life_ltc",
    description: "Life insurance with LTC rider. If you don't use LTC benefits, heirs receive death benefit.",
    estimatedAnnualCost: Math.round(gap * 0.03),
    pros: ["Death benefit if LTC not needed", "Guaranteed premiums", "No use-it-or-lose-it concern"],
    cons: ["Higher initial cost", "Lower LTC benefit per dollar", "Less flexible than standalone"],
    suitabilityScore: 75,
  });

  // Self-Fund
  if ((input.totalAssets || 0) > gap * 1.5) {
    strategies.push({
      name: "Self-Fund (Dedicated Savings)",
      type: "self_fund",
      description: "Set aside dedicated assets for potential LTC needs. Works best with substantial assets.",
      estimatedAnnualCost: Math.round(gap / Math.max(1, (input.retirementAge || 65) - age)),
      pros: ["Full control of assets", "No premiums or underwriting", "Assets pass to heirs if unused"],
      cons: ["Requires significant assets", "Opportunity cost", "No leverage (dollar-for-dollar)"],
      suitabilityScore: (input.totalAssets || 0) > gap * 3 ? 90 : 60,
    });
  }

  // Medicaid Planning
  strategies.push({
    name: "Medicaid Planning",
    type: "medicaid",
    description: "Structure assets to qualify for Medicaid LTC coverage. Requires 5-year look-back compliance.",
    estimatedAnnualCost: 0,
    pros: ["No premium cost", "Covers nursing home care", "Available regardless of health"],
    cons: ["Asset spend-down required", "Limited facility choice", "5-year look-back period", "May not cover preferred care type"],
    suitabilityScore: (input.totalAssets || 0) < 200000 ? 70 : 30,
  });

  // HSA Strategy
  if (age < 65) {
    strategies.push({
      name: "HSA Accumulation Strategy",
      type: "hsa",
      description: "Maximize HSA contributions and invest for growth. Triple tax advantage for qualified medical expenses including LTC.",
      estimatedAnnualCost: 4300, // 2026 family HSA limit estimate
      pros: ["Triple tax advantage", "Flexible use for any medical expense", "Rolls over indefinitely"],
      cons: ["Requires HDHP", "Contribution limits", "May not cover full gap alone"],
      suitabilityScore: age < 55 ? 80 : 60,
    });
  }

  return strategies.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

// ─── Full Analysis ────────────────────────────────────────────
export function analyzeLtc(input: LtcInput): LtcProjection {
  const probability = calculateProbabilityOfNeed(input);
  const duration = estimateCareDuration(input);
  const costs = projectCosts(input);
  const gap = calculateFundingGap(input, costs.inflationAdjusted);
  const strategies = generateStrategies(input, gap);

  // Readiness score
  let readiness = 50;
  if (input.hasLtcInsurance) readiness += 30;
  if ((input.totalAssets || 0) > costs.inflationAdjusted) readiness += 15;
  if (input.healthStatus === "excellent" || input.healthStatus === "good") readiness += 5;
  readiness = Math.min(100, readiness);

  return {
    probabilityOfNeed: Math.round(probability * 100),
    averageDurationYears: Math.round(duration * 10) / 10,
    projectedAnnualCost: Math.round(costs.annualCost),
    projectedTotalCost: Math.round(costs.totalCost),
    inflationAdjustedCost: Math.round(costs.inflationAdjusted),
    fundingGap: Math.round(gap),
    strategies,
    readinessScore: readiness,
  };
}

// ─── DB Helpers ────────────────────────────────────────────────
export async function saveLtcAnalysis(userId: number, input: LtcInput, result: LtcProjection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(ltcAnalyses).values({
    userId,
    currentAge: input.currentAge,
    retirementAge: input.retirementAge || 65,
    state: input.state,
    healthStatus: input.healthStatus,
    gender: input.gender,
    maritalStatus: input.maritalStatus,
    annualIncome: input.annualIncome?.toString(),
    totalAssets: input.totalAssets?.toString(),
    ltcInsuranceHas: input.hasLtcInsurance,
    ltcInsuranceDailyBenefit: input.existingDailyBenefit?.toString(),
    ltcInsuranceBenefitPeriod: input.existingBenefitPeriodYears,
    projectedAnnualCost: result.projectedAnnualCost.toString(),
    projectedDurationYears: result.averageDurationYears.toString(),
    probabilityOfNeed: (result.probabilityOfNeed / 100).toString(),
    fundingGap: result.fundingGap.toString(),
    recommendedStrategy: result.strategies[0]?.type || "self_fund",
    analysisJson: JSON.stringify(result),
  });
}

export async function getUserLtcAnalyses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ltcAnalyses)
    .where(eq(ltcAnalyses.userId, userId))
    .orderBy(desc(ltcAnalyses.createdAt));
}
