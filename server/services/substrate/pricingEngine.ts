/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Substrate Primitive: Pricing Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Implements the unified pricing formula:
 *   MonthlyInvoice = PlatformFee + DirectCost(0% markup) + InfrastructureMargin
 *                    − CustomerSavingsShare × MeasuredSavings
 *
 * Three billing modes:
 *   1. On-Demand — No PlatformFee; per-call pricing
 *   2. Subscription — Fixed PlatformFee + included usage
 *   3. Hybrid — Reduced PlatformFee + reduced per-call rate
 *
 * BYOM scenarios (S1-S4):
 *   S1: BYO-local (Ollama) → DirectCost = $0 for local calls
 *   S2: BYO-enterprise (own API key) → DirectCost = $0 for BYO calls
 *   S3: Mixed → DirectCost only for Stewardly-routed calls
 *   S4: Full BYO → PlatformFee only
 *
 * @substrate-primitive: pricing-engine
 * @spec-ref: plan/07-pricing-and-billing-implementation.md
 */
import { getPeriodSummary, calculateCeiling } from "./measurementVerification";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "substrate:pricing" });

// ─── Types ───────────────────────────────────────────────────────────────────

export type BillingMode = "on_demand" | "subscription" | "hybrid";
export type BYOMScenario = "S1_local" | "S2_enterprise" | "S3_mixed" | "S4_full_byo" | "none";

export interface BillingProfile {
  userId: number;
  mode: BillingMode;
  planId: string;
  byomScenario: BYOMScenario;
  customSavingsShare?: number; // Override default if negotiated
}

export interface UsageSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDirectCost: number;
  byoCallCount: number;
  stewardlyCallCount: number;
}

export interface InvoiceCalculation {
  platformFee: number;
  directCost: number;
  infrastructureMargin: number;
  grossTotal: number;
  measuredSavings: number;
  savingsCredit: number;
  netInvoice: number;
  ceilingAmount: number;
  ceilingApplied: boolean;
  breakdown: {
    label: string;
    amount: number;
    type: "charge" | "credit" | "ceiling";
  }[];
}

export interface TrialConfig {
  mode: BillingMode;
  durationDays: number;
  freeDirectCostCap?: number; // For on-demand trials
  startDate: number;
}

// ─── Plan Fee Table ──────────────────────────────────────────────────────────

interface PlanFees {
  monthlyFee: number;
  yearlyFee: number;
  includedCalls: number;
  overageRate: number; // Per call after included
  savingsShareRate: number;
}

const PLAN_FEES: Record<string, PlanFees> = {
  starter: {
    monthlyFee: 49_00, // cents
    yearlyFee: 470_00,
    includedCalls: 100,
    overageRate: 5, // $0.05 per call
    savingsShareRate: 0.15,
  },
  professional: {
    monthlyFee: 149_00,
    yearlyFee: 1430_00,
    includedCalls: 500,
    overageRate: 3,
    savingsShareRate: 0.25,
  },
  enterprise: {
    monthlyFee: 499_00,
    yearlyFee: 4790_00,
    includedCalls: 2000,
    overageRate: 2,
    savingsShareRate: 0.35,
  },
  on_demand: {
    monthlyFee: 0,
    yearlyFee: 0,
    includedCalls: 0,
    overageRate: 10, // $0.10 per call
    savingsShareRate: 0.10,
  },
};

// ─── Invoice Calculation ─────────────────────────────────────────────────────

/**
 * Calculate a monthly invoice based on the unified pricing formula.
 */
export function calculateInvoice(params: {
  profile: BillingProfile;
  usage: UsageSummary;
  periodStart: number;
  periodEnd: number;
}): InvoiceCalculation {
  const { profile, usage, periodStart, periodEnd } = params;
  const planFees = PLAN_FEES[profile.planId] ?? PLAN_FEES.on_demand;

  // 1. Platform Fee
  const platformFee = planFees.monthlyFee;

  // 2. Direct Cost (0% markup)
  // BYO calls have $0 direct cost
  let directCost = usage.totalDirectCost;
  if (profile.byomScenario === "S4_full_byo") {
    directCost = 0;
  } else if (profile.byomScenario === "S1_local" || profile.byomScenario === "S2_enterprise") {
    // Only charge for Stewardly-routed calls
    directCost = usage.totalDirectCost * (usage.stewardlyCallCount / Math.max(usage.totalCalls, 1));
  }

  // 3. Infrastructure Margin (15% of direct cost)
  const infrastructureMargin = Math.round(directCost * 0.15);

  // 4. Gross Total
  const grossTotal = platformFee + directCost + infrastructureMargin;

  // 5. Measured Savings (from M&V engine)
  const savingsSummary = getPeriodSummary(profile.userId, periodStart, periodEnd);
  const measuredSavings = savingsSummary.totalSavings;

  // 6. Savings Credit
  const savingsShareRate = profile.customSavingsShare ?? planFees.savingsShareRate;
  const savingsCredit = Math.round(measuredSavings * savingsShareRate * 100); // Convert to cents

  // 7. Net Invoice
  const netBeforeCeiling = grossTotal - savingsCredit;

  // 8. Cost-Plus Ceiling
  const ceiling = calculateCeiling({
    directCost,
    platformFee,
    measuredSavings: measuredSavings * 100, // Convert to cents
  });

  const ceilingApplied = netBeforeCeiling > ceiling.ceilingAmount;
  const netInvoice = ceilingApplied ? ceiling.ceilingAmount : Math.max(0, netBeforeCeiling);

  // Build breakdown
  const breakdown: InvoiceCalculation["breakdown"] = [
    { label: "Platform Fee", amount: platformFee, type: "charge" },
  ];

  if (directCost > 0) {
    breakdown.push({ label: "AI Provider Costs (0% markup)", amount: directCost, type: "charge" });
  }
  if (infrastructureMargin > 0) {
    breakdown.push({ label: "Infrastructure (15%)", amount: infrastructureMargin, type: "charge" });
  }
  if (savingsCredit > 0) {
    breakdown.push({ label: `Savings Credit (${Math.round(savingsShareRate * 100)}% share)`, amount: -savingsCredit, type: "credit" });
  }
  if (ceilingApplied) {
    breakdown.push({ label: "Cost-Plus Ceiling Applied", amount: netInvoice - netBeforeCeiling, type: "ceiling" });
  }

  log.info({
    userId: profile.userId,
    mode: profile.mode,
    platformFee,
    directCost,
    measuredSavings,
    savingsCredit,
    netInvoice,
    ceilingApplied,
  }, "Invoice calculated");

  return {
    platformFee,
    directCost,
    infrastructureMargin,
    grossTotal,
    measuredSavings,
    savingsCredit,
    netInvoice,
    ceilingAmount: ceiling.ceilingAmount,
    ceilingApplied,
    breakdown,
  };
}

/**
 * Determine the effective BYOM scenario based on user configuration.
 */
export function determineBYOMScenario(params: {
  hasLocalProvider: boolean;
  hasEnterpriseKey: boolean;
  localCallPercentage: number;
}): BYOMScenario {
  if (!params.hasLocalProvider && !params.hasEnterpriseKey) return "none";
  if (params.localCallPercentage >= 0.95) return "S4_full_byo";
  if (params.hasLocalProvider && !params.hasEnterpriseKey) return "S1_local";
  if (!params.hasLocalProvider && params.hasEnterpriseKey) return "S2_enterprise";
  return "S3_mixed";
}

/**
 * Check if a user is within their trial period.
 */
export function isInTrial(trial: TrialConfig | null): boolean {
  if (!trial) return false;
  const now = Date.now();
  const trialEnd = trial.startDate + trial.durationDays * 24 * 60 * 60 * 1000;
  return now < trialEnd;
}

/**
 * Get the plan fees for a given plan ID.
 */
export function getPlanFees(planId: string): PlanFees | null {
  return PLAN_FEES[planId] ?? null;
}

/**
 * Get all available plan fee configurations.
 */
export function getAllPlanFees(): Record<string, PlanFees> {
  return { ...PLAN_FEES };
}
