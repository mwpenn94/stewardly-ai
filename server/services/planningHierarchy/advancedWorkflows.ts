/**
 * advancedWorkflows.ts — Phase 4 Advanced Workflows
 * 
 * 1. Policy Delivery & Free Look Tracking
 * 2. 1035 Exchange Analysis (NAIC Model Regulation 613)
 * 3. Beneficiary Review Workflow
 * 4. Tax Return Review Workflow
 */
import { getDb } from "../../db";
import {
  policyDeliveries, exchangeAnalyses, beneficiaryReviews, taxReturnReviews,
  type InsertPolicyDelivery, type InsertExchangeAnalysis,
  type InsertBeneficiaryReview, type InsertTaxReturnReview,
} from "../../../drizzle/schema";
import { eq, and, desc, lte, gte } from "drizzle-orm";

// ─── 1. POLICY DELIVERY & FREE LOOK TRACKING ────────────────────────────

export async function createPolicyDelivery(data: Omit<InsertPolicyDelivery, "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const [result] = await db.insert(policyDeliveries).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  }).$returningId();
  return result.id;
}

export async function getPolicyDelivery(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(policyDeliveries).where(eq(policyDeliveries.id, id));
  return row ?? null;
}

export async function listPolicyDeliveries(advisorId: number, filters?: { clientId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(policyDeliveries.advisorId, advisorId)];
  if (filters?.clientId) conditions.push(eq(policyDeliveries.clientId, filters.clientId));
  if (filters?.status) conditions.push(eq(policyDeliveries.status, filters.status as any));
  return db.select().from(policyDeliveries).where(and(...conditions)).orderBy(desc(policyDeliveries.createdAt));
}

export async function recordDelivery(id: number, data: {
  deliveredAt: number;
  deliveryMethod: "in_person" | "mail" | "electronic" | "video_call";
  deliveryReceiptUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const delivery = await getPolicyDelivery(id);
  if (!delivery) throw new Error("Policy delivery not found");

  const freeLookDays = delivery.freeLookDays ?? 10;
  const freeLookStartDate = data.deliveredAt;
  const freeLookEndDate = freeLookStartDate + (freeLookDays * 24 * 60 * 60 * 1000);

  await db.update(policyDeliveries).set({
    deliveredAt: data.deliveredAt,
    deliveryMethod: data.deliveryMethod,
    deliveryReceiptUrl: data.deliveryReceiptUrl ?? null,
    freeLookStartDate,
    freeLookEndDate,
    freeLookStatus: "active",
    status: "delivered",
    updatedAt: Date.now(),
  }).where(eq(policyDeliveries.id, id));

  return { freeLookStartDate, freeLookEndDate, freeLookDays };
}

export async function recordClientAcknowledgment(id: number, signatureUrl?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(policyDeliveries).set({
    clientAcknowledgedAt: Date.now(),
    clientSignatureUrl: signatureUrl ?? null,
    status: "acknowledged",
    updatedAt: Date.now(),
  }).where(eq(policyDeliveries.id, id));
}

export async function exerciseFreeLook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const delivery = await getPolicyDelivery(id);
  if (!delivery) throw new Error("Policy delivery not found");
  if (delivery.freeLookStatus !== "active") throw new Error("Free look period is not active");
  if (delivery.freeLookEndDate && Date.now() > delivery.freeLookEndDate) {
    throw new Error("Free look period has expired");
  }
  await db.update(policyDeliveries).set({
    freeLookStatus: "exercised",
    freeLookExercisedAt: Date.now(),
    status: "returned",
    updatedAt: Date.now(),
  }).where(eq(policyDeliveries.id, id));
}

export async function expireFreeLookPeriods() {
  const db = await getDb();
  if (!db) return 0;
  const now = Date.now();
  const expired = await db.select().from(policyDeliveries)
    .where(and(
      eq(policyDeliveries.freeLookStatus, "active"),
      lte(policyDeliveries.freeLookEndDate, now)
    ));
  for (const d of expired) {
    await db.update(policyDeliveries).set({
      freeLookStatus: "expired",
      status: "placed",
      updatedAt: now,
    }).where(eq(policyDeliveries.id, d.id));
  }
  return expired.length;
}

export async function getFreeLookAlerts(advisorId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const active = await db.select().from(policyDeliveries)
    .where(and(
      eq(policyDeliveries.advisorId, advisorId),
      eq(policyDeliveries.freeLookStatus, "active"),
    ));
  return active.map(d => ({
    id: d.id,
    policyNumber: d.policyNumber,
    clientId: d.clientId,
    carrierName: d.carrierName,
    freeLookEndDate: d.freeLookEndDate,
    daysRemaining: d.freeLookEndDate ? Math.max(0, Math.ceil((d.freeLookEndDate - now) / (24 * 60 * 60 * 1000))) : 0,
    isUrgent: d.freeLookEndDate ? (d.freeLookEndDate - now) <= threeDaysMs : false,
  }));
}

// ─── 2. 1035 EXCHANGE ANALYSIS ──────────────────────────────────────────

export async function createExchangeAnalysis(data: Omit<InsertExchangeAnalysis, "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const [result] = await db.insert(exchangeAnalyses).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  }).$returningId();
  return result.id;
}

export async function getExchangeAnalysis(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(exchangeAnalyses).where(eq(exchangeAnalyses.id, id));
  return row ?? null;
}

export async function listExchangeAnalyses(advisorId: number, clientId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(exchangeAnalyses.advisorId, advisorId)];
  if (clientId) conditions.push(eq(exchangeAnalyses.clientId, clientId));
  return db.select().from(exchangeAnalyses).where(and(...conditions)).orderBy(desc(exchangeAnalyses.createdAt));
}

export async function updateExchangeAnalysis(id: number, data: Partial<InsertExchangeAnalysis>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(exchangeAnalyses).set({
    ...data,
    updatedAt: Date.now(),
  }).where(eq(exchangeAnalyses.id, id));
}

/**
 * Compute the 1035 exchange comparison metrics.
 * Returns a structured comparison of existing vs. proposed policy.
 */
export function compute1035Comparison(existing: {
  cashValue: number;
  surrenderValue: number;
  surrenderCharge: number;
  deathBenefit: number;
  annualPremium: number;
  loanBalance: number;
  costBasis: number;
}, proposed: {
  deathBenefit: number;
  annualPremium: number;
}) {
  const netSurrenderValue = existing.surrenderValue - existing.loanBalance;
  const gainOverBasis = Math.max(0, existing.cashValue - existing.costBasis);
  const taxDeferred = gainOverBasis > 0; // 1035 exchange defers this gain
  const surrenderChargePercent = existing.cashValue > 0
    ? ((existing.surrenderCharge / existing.cashValue) * 100).toFixed(2)
    : "0";
  const deathBenefitDelta = proposed.deathBenefit - existing.deathBenefit;
  const premiumDelta = proposed.annualPremium - existing.annualPremium;

  return {
    netSurrenderValue,
    gainOverBasis,
    taxDeferred,
    taxDeferredAmount: gainOverBasis,
    surrenderChargePercent: parseFloat(surrenderChargePercent),
    deathBenefitDelta,
    premiumDelta,
    breakEvenYears: existing.surrenderCharge > 0 && premiumDelta < 0
      ? Math.ceil(existing.surrenderCharge / Math.abs(premiumDelta))
      : null,
    naicReplacementRequired: true, // Always required for 1035 exchanges
    considerations: [
      existing.surrenderCharge > 0 ? `Surrender charge of $${existing.surrenderCharge.toLocaleString()} applies` : null,
      existing.loanBalance > 0 ? `Outstanding loan of $${existing.loanBalance.toLocaleString()} must be resolved` : null,
      gainOverBasis > 0 ? `$${gainOverBasis.toLocaleString()} gain deferred via 1035 exchange` : null,
      deathBenefitDelta > 0 ? `Death benefit increases by $${deathBenefitDelta.toLocaleString()}` : null,
      deathBenefitDelta < 0 ? `Death benefit decreases by $${Math.abs(deathBenefitDelta).toLocaleString()}` : null,
    ].filter(Boolean),
  };
}

// ─── 3. BENEFICIARY REVIEW WORKFLOW ─────────────────────────────────────

export async function createBeneficiaryReview(data: Omit<InsertBeneficiaryReview, "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const [result] = await db.insert(beneficiaryReviews).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  }).$returningId();
  return result.id;
}

export async function getBeneficiaryReview(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(beneficiaryReviews).where(eq(beneficiaryReviews.id, id));
  return row ?? null;
}

export async function listBeneficiaryReviews(advisorId: number, clientId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(beneficiaryReviews.advisorId, advisorId)];
  if (clientId) conditions.push(eq(beneficiaryReviews.clientId, clientId));
  return db.select().from(beneficiaryReviews).where(and(...conditions)).orderBy(desc(beneficiaryReviews.createdAt));
}

export async function updateBeneficiaryReview(id: number, data: Partial<InsertBeneficiaryReview>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(beneficiaryReviews).set({
    ...data,
    updatedAt: Date.now(),
  }).where(eq(beneficiaryReviews.id, id));
}

export async function getBeneficiaryReviewsDue(advisorId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = Date.now();
  return db.select().from(beneficiaryReviews)
    .where(and(
      eq(beneficiaryReviews.advisorId, advisorId),
      lte(beneficiaryReviews.nextReviewDate, now),
    ))
    .orderBy(beneficiaryReviews.nextReviewDate);
}

/**
 * Analyze beneficiary designations for common issues.
 */
export function analyzeBeneficiaryDesignations(beneficiaries: Array<{
  name: string;
  relationship: string;
  percentage: number;
  type: "primary" | "contingent";
  isMinor?: boolean;
  isTrust?: boolean;
}>) {
  const issues: string[] = [];
  const primaryBeneficiaries = beneficiaries.filter(b => b.type === "primary");
  const contingentBeneficiaries = beneficiaries.filter(b => b.type === "contingent");

  const primaryTotal = primaryBeneficiaries.reduce((sum, b) => sum + b.percentage, 0);
  if (Math.abs(primaryTotal - 100) > 0.01) {
    issues.push(`Primary beneficiary percentages total ${primaryTotal}% (should be 100%)`);
  }

  if (contingentBeneficiaries.length === 0) {
    issues.push("No contingent beneficiary designated — proceeds may go to estate");
  }

  const minors = beneficiaries.filter(b => b.isMinor);
  if (minors.length > 0) {
    issues.push(`${minors.length} minor beneficiary(ies) — consider UTMA custodian or trust designation`);
  }

  if (primaryBeneficiaries.length === 1 && primaryBeneficiaries[0].relationship === "estate") {
    issues.push("Estate as sole beneficiary — may be subject to probate and creditor claims");
  }

  return {
    primaryCount: primaryBeneficiaries.length,
    contingentCount: contingentBeneficiaries.length,
    primaryTotalPercent: primaryTotal,
    hasMinors: minors.length > 0,
    issues,
    needsAttention: issues.length > 0,
  };
}

// ─── 4. TAX RETURN REVIEW WORKFLOW ──────────────────────────────────────

export async function createTaxReturnReview(data: Omit<InsertTaxReturnReview, "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const now = Date.now();
  const [result] = await db.insert(taxReturnReviews).values({
    ...data,
    createdAt: now,
    updatedAt: now,
  }).$returningId();
  return result.id;
}

export async function getTaxReturnReview(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(taxReturnReviews).where(eq(taxReturnReviews.id, id));
  return row ?? null;
}

export async function listTaxReturnReviews(advisorId: number, clientId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(taxReturnReviews.advisorId, advisorId)];
  if (clientId) conditions.push(eq(taxReturnReviews.clientId, clientId));
  return db.select().from(taxReturnReviews).where(and(...conditions)).orderBy(desc(taxReturnReviews.createdAt));
}

export async function updateTaxReturnReview(id: number, data: Partial<InsertTaxReturnReview>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(taxReturnReviews).set({
    ...data,
    updatedAt: Date.now(),
  }).where(eq(taxReturnReviews.id, id));
}

/**
 * Analyze a tax return for planning opportunities.
 * Returns structured findings, opportunities, and risk flags.
 */
export function analyzeTaxReturn(data: {
  adjustedGrossIncome: number;
  taxableIncome: number;
  totalTaxLiability: number;
  filingStatus: string;
  capitalGainsShortTerm?: number;
  capitalGainsLongTerm?: number;
  dividendIncome?: number;
  interestIncome?: number;
  businessIncome?: number;
  rentalIncome?: number;
  retirementDistributions?: number;
  charitableDeductions?: number;
  mortgageInterest?: number;
  saltDeductions?: number;
  itemizedVsStandard?: string;
}) {
  const findings: Array<{ category: string; finding: string; severity: "info" | "warning" | "opportunity" }> = [];
  const opportunities: Array<{ strategy: string; estimatedBenefit: string; priority: "high" | "medium" | "low" }> = [];
  const riskFlags: Array<{ flag: string; explanation: string }> = [];

  const effectiveRate = data.adjustedGrossIncome > 0
    ? ((data.totalTaxLiability / data.adjustedGrossIncome) * 100).toFixed(1)
    : "0";
  const marginalBracket = getMarginalBracket(data.taxableIncome, data.filingStatus);

  // Income analysis
  if (data.capitalGainsShortTerm && data.capitalGainsShortTerm > 10000) {
    findings.push({
      category: "Capital Gains",
      finding: `$${data.capitalGainsShortTerm.toLocaleString()} in short-term capital gains taxed at ordinary rates`,
      severity: "warning",
    });
    opportunities.push({
      strategy: "Tax-loss harvesting to offset short-term gains",
      estimatedBenefit: `Up to $${Math.round(data.capitalGainsShortTerm * parseFloat(marginalBracket) / 100).toLocaleString()} tax savings`,
      priority: "high",
    });
  }

  if (data.retirementDistributions && data.retirementDistributions > 0) {
    findings.push({
      category: "Retirement",
      finding: `$${data.retirementDistributions.toLocaleString()} in retirement distributions`,
      severity: "info",
    });
    if (parseFloat(marginalBracket) >= 32) {
      opportunities.push({
        strategy: "Roth conversion strategy to manage future RMDs at lower brackets",
        estimatedBenefit: "Long-term tax bracket management",
        priority: "medium",
      });
    }
  }

  // Deduction analysis
  if (data.itemizedVsStandard === "standard" && data.charitableDeductions && data.charitableDeductions > 5000) {
    opportunities.push({
      strategy: "Charitable bunching strategy — concentrate 2+ years of giving into one year to exceed standard deduction",
      estimatedBenefit: `Potential itemization benefit from $${data.charitableDeductions.toLocaleString()} charitable giving`,
      priority: "medium",
    });
  }

  if (data.saltDeductions && data.saltDeductions > 10000) {
    findings.push({
      category: "SALT",
      finding: `SALT deductions capped at $10,000 — $${(data.saltDeductions - 10000).toLocaleString()} excess not deductible`,
      severity: "warning",
    });
  }

  // Business income
  if (data.businessIncome && data.businessIncome > 50000) {
    opportunities.push({
      strategy: "Qualified Business Income (QBI) deduction optimization — verify 199A eligibility",
      estimatedBenefit: `Up to $${Math.round(data.businessIncome * 0.20).toLocaleString()} QBI deduction`,
      priority: "high",
    });
    if (data.businessIncome > 200000) {
      opportunities.push({
        strategy: "Entity structure review — evaluate S-Corp election for SE tax savings",
        estimatedBenefit: "Potential SE tax reduction on reasonable compensation split",
        priority: "high",
      });
    }
  }

  // Risk flags
  if (data.adjustedGrossIncome > 200000 && data.filingStatus === "single") {
    riskFlags.push({
      flag: "Net Investment Income Tax",
      explanation: "AGI exceeds $200K — 3.8% NIIT applies to investment income",
    });
  }
  if (data.adjustedGrossIncome > 250000 && data.filingStatus === "married_filing_jointly") {
    riskFlags.push({
      flag: "Net Investment Income Tax",
      explanation: "AGI exceeds $250K — 3.8% NIIT applies to investment income",
    });
  }

  return {
    effectiveRate: parseFloat(effectiveRate),
    marginalBracket,
    findings,
    opportunities,
    riskFlags,
  };
}

function getMarginalBracket(taxableIncome: number, filingStatus: string): string {
  // 2024 brackets (simplified)
  const brackets = filingStatus === "married_filing_jointly"
    ? [
        { limit: 23200, rate: "10" }, { limit: 94300, rate: "12" },
        { limit: 201050, rate: "22" }, { limit: 383900, rate: "24" },
        { limit: 487450, rate: "32" }, { limit: 731200, rate: "35" },
        { limit: Infinity, rate: "37" },
      ]
    : [
        { limit: 11600, rate: "10" }, { limit: 47150, rate: "12" },
        { limit: 100525, rate: "22" }, { limit: 191950, rate: "24" },
        { limit: 243725, rate: "32" }, { limit: 609350, rate: "35" },
        { limit: Infinity, rate: "37" },
      ];
  for (const b of brackets) {
    if (taxableIncome <= b.limit) return b.rate;
  }
  return "37";
}
