/**
 * wealthEngineOptimizer.ts — Wealth Engine Optimization Layer
 * 
 * Addresses remaining CFP assessment gaps:
 * 1. Collateral tracking (policy cash value vs. loan balance) for premium finance
 * 2. Exit strategy modeling (when to unwind financing arrangements)
 * 3. Senior investor protections (age-based suitability enhancements)
 * 4. Cross-calculator gap aggregation (unified "current vs. needed" view)
 * 5. SEC Marketing Rule compliance documentation enhancement
 * 6-12. Pass 119 comprehensive optimization (fiduciary file, assumption drift, orphan prevention, staleness, health scoring, consistency, diagnostic)
 */

import { getDb } from "../../db";
import { sql } from "drizzle-orm";

// ─── 1. COLLATERAL TRACKING ─────────────────────────────────────────────

export interface CollateralPosition {
  year: number;
  policyCashValue: number;
  loanBalance: number;
  loanToValue: number; // LTV ratio as percentage
  collateralCushion: number; // Cash value minus loan balance
  collateralCushionPercent: number; // Cushion as % of cash value
  marginCallRisk: "none" | "low" | "moderate" | "high" | "critical";
  requiredAdditionalCollateral: number; // If LTV exceeds threshold
}

export function computeCollateralTracking(projections: Array<{
  year: number;
  policyValue: number;
  loanBalance: number;
  netEquity: number;
}>, maxLTV: number = 90): CollateralPosition[] {
  return projections.map(p => {
    const ltv = p.policyValue > 0 ? (p.loanBalance / p.policyValue) * 100 : 0;
    const cushion = p.policyValue - p.loanBalance;
    const cushionPct = p.policyValue > 0 ? (cushion / p.policyValue) * 100 : 0;
    const requiredAdditional = ltv > maxLTV
      ? Math.round(p.loanBalance - (p.policyValue * maxLTV / 100))
      : 0;

    let risk: CollateralPosition["marginCallRisk"];
    if (ltv <= 60) risk = "none";
    else if (ltv <= 75) risk = "low";
    else if (ltv <= 85) risk = "moderate";
    else if (ltv <= maxLTV) risk = "high";
    else risk = "critical";

    return {
      year: p.year,
      policyCashValue: p.policyValue,
      loanBalance: p.loanBalance,
      loanToValue: Math.round(ltv * 100) / 100,
      collateralCushion: cushion,
      collateralCushionPercent: Math.round(cushionPct * 100) / 100,
      marginCallRisk: risk,
      requiredAdditionalCollateral: requiredAdditional,
    };
  });
}

// ─── 2. EXIT STRATEGY MODELING ──────────────────────────────────────────

export interface ExitStrategy {
  year: number;
  strategy: "hold" | "surrender_and_repay" | "partial_surrender" | "1035_exchange" | "death_benefit_payoff" | "refinance";
  netProceeds: number;
  taxImplication: number; // Estimated tax on gain
  loanPayoff: number;
  remainingCashValue: number;
  remainingDeathBenefit: number;
  isOptimal: boolean;
  reasoning: string;
}

export function modelExitStrategies(projections: Array<{
  year: number;
  policyValue: number;
  loanBalance: number;
  netEquity: number;
  deathBenefit: number;
  cumulativeCashOutlay: number;
}>, costBasis: number = 0, marginalTaxRate: number = 0.37): ExitStrategy[] {
  const strategies: ExitStrategy[] = [];
  let optimalYear = -1;
  let optimalNetProceeds = -Infinity;

  for (const p of projections) {
    // Surrender and repay strategy
    const surrenderProceeds = p.policyValue - p.loanBalance;
    const gain = Math.max(0, p.policyValue - costBasis);
    const taxOnSurrender = Math.round(gain * marginalTaxRate);
    const netAfterTax = surrenderProceeds - taxOnSurrender;

    const strategy: ExitStrategy = {
      year: p.year,
      strategy: "surrender_and_repay",
      netProceeds: Math.round(netAfterTax),
      taxImplication: taxOnSurrender,
      loanPayoff: p.loanBalance,
      remainingCashValue: 0,
      remainingDeathBenefit: 0,
      isOptimal: false,
      reasoning: "",
    };

    // Determine reasoning
    if (p.netEquity <= 0) {
      strategy.reasoning = `Year ${p.year}: Negative equity — exit not recommended. Loan balance exceeds cash value.`;
    } else if (netAfterTax > optimalNetProceeds) {
      strategy.reasoning = `Year ${p.year}: Net proceeds of $${netAfterTax.toLocaleString()} after tax — improving trajectory.`;
      optimalNetProceeds = netAfterTax;
      optimalYear = p.year;
    } else {
      strategy.reasoning = `Year ${p.year}: Net proceeds declining from peak — consider exit.`;
    }

    strategies.push(strategy);
  }

  // Mark optimal year
  if (optimalYear > 0) {
    const optimal = strategies.find(s => s.year === optimalYear);
    if (optimal) {
      optimal.isOptimal = true;
      optimal.reasoning = `Year ${optimalYear}: OPTIMAL EXIT — Maximum net proceeds of $${optimalNetProceeds.toLocaleString()} after tax.`;
    }
  }

  return strategies;
}

export function getExitRecommendation(strategies: ExitStrategy[]): {
  optimalExitYear: number | null;
  optimalNetProceeds: number;
  holdRecommendation: string;
  riskFactors: string[];
} {
  const optimal = strategies.find(s => s.isOptimal);
  const negativeEquityYears = strategies.filter(s => s.netProceeds < 0);
  const riskFactors: string[] = [];

  if (negativeEquityYears.length > 5) {
    riskFactors.push(`Extended negative equity period (${negativeEquityYears.length} years) — client must sustain premium payments`);
  }

  const lastStrategy = strategies[strategies.length - 1];
  if (lastStrategy && lastStrategy.netProceeds < 0) {
    riskFactors.push("Projection ends with negative equity — arrangement may not be self-sustaining");
  }

  const peakYear = optimal?.year ?? null;
  const decliningYears = strategies.filter(s => s.year > (peakYear ?? Infinity) && s.netProceeds < (optimal?.netProceeds ?? 0));
  if (decliningYears.length > 3) {
    riskFactors.push("Significant value erosion after peak — timing of exit is critical");
  }

  return {
    optimalExitYear: peakYear,
    optimalNetProceeds: optimal?.netProceeds ?? 0,
    holdRecommendation: peakYear
      ? `Optimal exit at year ${peakYear} with net proceeds of $${(optimal?.netProceeds ?? 0).toLocaleString()}`
      : "No profitable exit point identified within projection period",
    riskFactors,
  };
}

// ─── 3. SENIOR INVESTOR PROTECTIONS ─────────────────────────────────────

export interface SeniorInvestorCheck {
  isApplicable: boolean;
  age: number;
  protectionLevel: "standard" | "enhanced" | "maximum";
  requiredChecks: Array<{
    check: string;
    description: string;
    required: boolean;
    completed?: boolean;
  }>;
  coolingOffPeriod: number | null; // Days, or null if not applicable
  trustedContactRequired: boolean;
  additionalDisclosures: string[];
  regulatoryBasis: string[];
}

export function evaluateSeniorProtections(age: number, productType: string, transactionAmount: number): SeniorInvestorCheck {
  const isApplicable = age >= 60;
  const isSenior = age >= 65;
  const isElderly = age >= 75;

  const protectionLevel: SeniorInvestorCheck["protectionLevel"] =
    isElderly ? "maximum" : isSenior ? "enhanced" : "standard";

  const requiredChecks: SeniorInvestorCheck["requiredChecks"] = [];
  const additionalDisclosures: string[] = [];
  const regulatoryBasis: string[] = [];

  if (isApplicable) {
    // FINRA Rule 2165 — Financial exploitation of specified adults
    regulatoryBasis.push("FINRA Rule 2165 (Financial Exploitation of Specified Adults)");
    requiredChecks.push({
      check: "trusted_contact",
      description: "Obtain trusted contact person designation",
      required: true,
    });

    // NAIC Suitability in Annuity Transactions Model Regulation
    if (productType.includes("annuit") || productType.includes("iul") || productType.includes("life")) {
      regulatoryBasis.push("NAIC Suitability in Annuity Transactions Model Regulation (2020)");
      requiredChecks.push({
        check: "suitability_enhanced",
        description: "Enhanced suitability review for insurance product",
        required: true,
      });
      requiredChecks.push({
        check: "surrender_period_review",
        description: "Verify surrender period does not extend beyond reasonable life expectancy",
        required: true,
      });
    }
  }

  if (isSenior) {
    requiredChecks.push({
      check: "cognitive_assessment",
      description: "Document client's capacity to understand the transaction",
      required: true,
    });
    requiredChecks.push({
      check: "liquidity_needs",
      description: "Verify client has sufficient liquid assets outside this product",
      required: true,
    });
    additionalDisclosures.push("This product may have limited liquidity. Ensure you have adequate emergency funds and income sources.");
  }

  if (isElderly) {
    requiredChecks.push({
      check: "family_notification",
      description: "Consider notifying trusted contact of significant transaction",
      required: transactionAmount > 50000,
    });
    requiredChecks.push({
      check: "cooling_off_extended",
      description: "Extended cooling-off period for senior investor",
      required: true,
    });
    requiredChecks.push({
      check: "independent_review",
      description: "Transaction reviewed by compliance officer or supervisor",
      required: true,
    });
    additionalDisclosures.push("As a senior investor, you have additional protections including an extended review period.");
    additionalDisclosures.push("You may designate a trusted contact person who can be contacted in case of concerns about your account.");
  }

  // Premium finance specific
  if (productType.includes("premium_finance") || productType.includes("premfin")) {
    if (age >= 65) {
      requiredChecks.push({
        check: "premium_finance_suitability",
        description: "Enhanced suitability review for premium financing arrangement — verify client understands collateral risk",
        required: true,
      });
      additionalDisclosures.push("Premium financing involves borrowing to pay insurance premiums. If the policy underperforms, you may need to provide additional collateral or repay the loan from other assets.");
    }
  }

  return {
    isApplicable,
    age,
    protectionLevel,
    requiredChecks,
    coolingOffPeriod: isElderly ? 30 : isSenior ? 15 : isApplicable ? 10 : null,
    trustedContactRequired: isApplicable,
    additionalDisclosures,
    regulatoryBasis,
  };
}

// ─── 4. CROSS-CALCULATOR GAP AGGREGATION ────────────────────────────────

export interface GapItem {
  domain: string;
  metric: string;
  currentValue: number;
  targetValue: number;
  gapValue: number;
  gapPercent: number;
  priority: "critical" | "high" | "medium" | "low";
  source: string; // Which calculator/tool produced this
  recommendation: string;
}

export function aggregateGaps(outcomes: Array<{
  planArea: string;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  gapValue?: number;
  gapPercentage?: number;
}>, calculatorResults?: {
  retirement?: { projectedBalance: number; targetBalance: number };
  insurance?: { currentCoverage: number; recommendedCoverage: number };
  estate?: { currentValue: number; targetValue: number };
  tax?: { currentRate: number; targetRate: number };
  debt?: { currentDebt: number; targetDebt: number };
  savings?: { currentRate: number; targetRate: number };
}): {
  gaps: GapItem[];
  overallGapScore: number;
  criticalGaps: number;
  totalGapValue: number;
  summary: string;
} {
  const gaps: GapItem[] = [];

  // From plan outcomes
  for (const o of outcomes) {
    if (o.targetValue && o.currentValue !== undefined) {
      const gapVal = (o.gapValue ?? (o.targetValue - (o.currentValue ?? 0)));
      const gapPct = o.gapPercentage ?? (o.targetValue > 0 ? ((gapVal / o.targetValue) * 100) : 0);
      const priority = gapPct > 50 ? "critical" : gapPct > 25 ? "high" : gapPct > 10 ? "medium" : "low";

      gaps.push({
        domain: o.planArea,
        metric: o.targetMetric ?? o.planArea,
        currentValue: o.currentValue ?? 0,
        targetValue: o.targetValue,
        gapValue: Math.round(gapVal),
        gapPercent: Math.round(gapPct * 10) / 10,
        priority,
        source: "planOutcomes",
        recommendation: getGapRecommendation(o.planArea, gapPct),
      });
    }
  }

  // From calculator results
  if (calculatorResults?.retirement) {
    const r = calculatorResults.retirement;
    const gap = r.targetBalance - r.projectedBalance;
    if (gap > 0) {
      const pct = (gap / r.targetBalance) * 100;
      gaps.push({
        domain: "retirement",
        metric: "Retirement Savings Gap",
        currentValue: r.projectedBalance,
        targetValue: r.targetBalance,
        gapValue: Math.round(gap),
        gapPercent: Math.round(pct * 10) / 10,
        priority: pct > 30 ? "critical" : pct > 15 ? "high" : "medium",
        source: "retirementCalculator",
        recommendation: getGapRecommendation("retirement", pct),
      });
    }
  }

  if (calculatorResults?.insurance) {
    const i = calculatorResults.insurance;
    const gap = i.recommendedCoverage - i.currentCoverage;
    if (gap > 0) {
      const pct = (gap / i.recommendedCoverage) * 100;
      gaps.push({
        domain: "protection",
        metric: "Insurance Coverage Gap",
        currentValue: i.currentCoverage,
        targetValue: i.recommendedCoverage,
        gapValue: Math.round(gap),
        gapPercent: Math.round(pct * 10) / 10,
        priority: pct > 40 ? "critical" : pct > 20 ? "high" : "medium",
        source: "insuranceCalculator",
        recommendation: getGapRecommendation("protection", pct),
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const criticalGaps = gaps.filter(g => g.priority === "critical").length;
  const totalGapValue = gaps.reduce((sum, g) => sum + Math.abs(g.gapValue), 0);
  const overallGapScore = gaps.length > 0
    ? Math.round(gaps.reduce((sum, g) => sum + (100 - g.gapPercent), 0) / gaps.length)
    : 100;

  return {
    gaps,
    overallGapScore,
    criticalGaps,
    totalGapValue,
    summary: criticalGaps > 0
      ? `${criticalGaps} critical gap(s) identified requiring immediate attention. Total gap value: $${totalGapValue.toLocaleString()}.`
      : gaps.length > 0
      ? `${gaps.length} gap(s) identified. Overall plan completion: ${overallGapScore}%.`
      : "No significant gaps identified — plan is on track.",
  };
}

function getGapRecommendation(domain: string, gapPercent: number): string {
  const recs: Record<string, string[]> = {
    retirement: [
      "Increase monthly contributions by at least 3-5% of income",
      "Review asset allocation for age-appropriate growth potential",
      "Consider catch-up contributions if age 50+",
      "Evaluate employer match optimization",
    ],
    protection: [
      "Review life insurance needs analysis based on income replacement",
      "Consider term life for immediate gap coverage",
      "Evaluate disability income insurance",
      "Review umbrella liability coverage",
    ],
    estate: [
      "Schedule estate planning attorney consultation",
      "Review beneficiary designations across all accounts",
      "Consider trust structures for asset protection",
      "Update powers of attorney and healthcare directives",
    ],
    tax: [
      "Review tax-loss harvesting opportunities",
      "Evaluate Roth conversion strategy",
      "Maximize tax-advantaged account contributions",
      "Consider charitable giving strategies",
    ],
    debt: [
      "Prioritize high-interest debt payoff (avalanche method)",
      "Consider debt consolidation if rates are favorable",
      "Review mortgage refinancing opportunities",
      "Establish automated debt payment plan",
    ],
    savings: [
      "Automate savings transfers on payday",
      "Build emergency fund to 3-6 months expenses",
      "Review and reduce discretionary spending",
      "Consider high-yield savings for emergency reserves",
    ],
  };

  const domainRecs = recs[domain] ?? recs["retirement"];
  const idx = gapPercent > 50 ? 0 : gapPercent > 25 ? 1 : gapPercent > 10 ? 2 : 3;
  return domainRecs[Math.min(idx, domainRecs.length - 1)];
}

// ─── 5. SEC MARKETING RULE COMPLIANCE ───────────────────────────────────

export interface MarketingRuleCheck {
  compliant: boolean;
  issues: Array<{
    rule: string;
    description: string;
    severity: "violation" | "warning" | "suggestion";
    remediation: string;
  }>;
  requiredDisclosures: string[];
}

export function checkMarketingRuleCompliance(content: {
  hasPerformanceData?: boolean;
  hasTestimonials?: boolean;
  hasEndorsements?: boolean;
  hasHypotheticalPerformance?: boolean;
  hasBacktestedPerformance?: boolean;
  hasPredictions?: boolean;
  hasGuarantees?: boolean;
  targetAudience?: "retail" | "institutional" | "qualified";
}): MarketingRuleCheck {
  const issues: MarketingRuleCheck["issues"] = [];
  const requiredDisclosures: string[] = [];

  // SEC Rule 206(4)-1 (Marketing Rule) effective November 4, 2022
  if (content.hasPerformanceData) {
    requiredDisclosures.push("Past performance does not guarantee future results.");
    requiredDisclosures.push("Performance data shown is net of fees unless otherwise noted.");
    if (content.targetAudience === "retail") {
      requiredDisclosures.push("Performance shown for the most recent 1-, 5-, and 10-year periods.");
    }
  }

  if (content.hasTestimonials) {
    requiredDisclosures.push("Testimonials may not be representative of all client experiences.");
    requiredDisclosures.push("Compensation was [not] provided for this testimonial.");
    issues.push({
      rule: "SEC Rule 206(4)-1(b)(1)",
      description: "Testimonials require clear disclosure of compensation and material conflicts",
      severity: "warning",
      remediation: "Add testimonial disclosure statement identifying whether compensation was provided",
    });
  }

  if (content.hasHypotheticalPerformance) {
    if (content.targetAudience === "retail") {
      issues.push({
        rule: "SEC Rule 206(4)-1(d)(6)",
        description: "Hypothetical performance shown to retail investors requires additional safeguards",
        severity: "warning",
        remediation: "Ensure hypothetical performance is relevant to the client's financial situation and investment objectives",
      });
    }
    requiredDisclosures.push("Hypothetical performance results have inherent limitations and do not represent actual trading.");
    requiredDisclosures.push("No representation is being made that any account will achieve profits or losses similar to those shown.");
  }

  if (content.hasGuarantees) {
    issues.push({
      rule: "SEC Rule 206(4)-1(a)(2)",
      description: "Statements implying guaranteed results are prohibited",
      severity: "violation",
      remediation: "Remove any language suggesting guaranteed returns or outcomes",
    });
  }

  if (content.hasPredictions) {
    issues.push({
      rule: "SEC Rule 206(4)-1(a)(2)",
      description: "Predictions of specific investment results may be misleading",
      severity: "warning",
      remediation: "Frame projections as illustrations with clear disclaimers about uncertainty",
    });
  }

  return {
    compliant: issues.filter(i => i.severity === "violation").length === 0,
    issues,
    requiredDisclosures,
  };
}


// ═══════════════════════════════════════════════════════════════════════
// PASS 119 — COMPREHENSIVE WEALTH ENGINE OPTIMIZATION
// Addresses all remaining assessment findings across all planning layers
// ═══════════════════════════════════════════════════════════════════════

// ─── 6. UNIFIED FIDUCIARY FILE ─────────────────────────────────────

export interface FiduciaryFileEntry {
  type: "suitability" | "recommendation" | "acknowledgment" | "disclosure" | "review";
  date: string;
  description: string;
  details: Record<string, any>;
  complianceStatus: "compliant" | "needs-review" | "flagged";
}

export interface UnifiedFiduciaryFile {
  clientId: number;
  advisorId: number;
  generatedAt: string;
  entries: FiduciaryFileEntry[];
  summary: {
    totalEntries: number;
    suitabilityAssessments: number;
    recommendations: number;
    acknowledgments: number;
    disclosures: number;
    reviews: number;
    complianceScore: number;
    lastReviewDate: string | null;
    nextReviewDue: string | null;
    flaggedItems: number;
  };
  regBICompliance: {
    basisForRecommendation: boolean;
    costDisclosure: boolean;
    conflictsDisclosure: boolean;
    careObligation: boolean;
    overallCompliant: boolean;
  };
}

export async function generateUnifiedFiduciaryFile(
  clientId: number,
  advisorId: number
): Promise<UnifiedFiduciaryFile> {
  const db = (await getDb())!;
  const entries: FiduciaryFileEntry[] = [];

  // Gather suitability assessments
  try {
    const suitRows = await db.execute(sql`SELECT * FROM suitability_assessments WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 50`);
    for (const row of (suitRows as any)[0] || []) {
      entries.push({
        type: "suitability",
        date: row.created_at?.toISOString?.() || new Date().toISOString(),
        description: `Suitability assessment: ${row.dimension || "general"}`,
        details: { dimension: row.dimension, score: row.score, rationale: row.rationale, riskTolerance: row.risk_tolerance },
        complianceStatus: row.score >= 0.6 ? "compliant" : "needs-review",
      });
    }
  } catch { /* table may not exist */ }

  // Gather recommendations with Reg BI check
  try {
    const recRows = await db.execute(sql`SELECT * FROM recommendations_log WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 100`);
    for (const row of (recRows as any)[0] || []) {
      const reasoning = typeof row.reasoning_chain === "string" ? JSON.parse(row.reasoning_chain || "{}") : row.reasoning_chain || {};
      const hasRegBI = !!(reasoning.basisForRecommendation && reasoning.costDisclosure && reasoning.conflictsDisclosure);
      entries.push({
        type: "recommendation",
        date: row.created_at?.toISOString?.() || new Date().toISOString(),
        description: `Recommendation: ${row.recommendation_type || row.description || "general"}`,
        details: { type: row.recommendation_type, description: row.description, reasoning, goalId: row.goal_id, status: row.status },
        complianceStatus: hasRegBI ? "compliant" : "needs-review",
      });
    }
  } catch { /* table may not exist */ }

  // Gather client acknowledgments (e-signatures)
  try {
    const ackRows = await db.execute(sql`SELECT * FROM engagement_letters WHERE client_id = ${clientId} AND status = 'signed' ORDER BY created_at DESC LIMIT 50`);
    for (const row of (ackRows as any)[0] || []) {
      entries.push({
        type: "acknowledgment",
        date: row.signed_at?.toISOString?.() || row.created_at?.toISOString?.() || new Date().toISOString(),
        description: `Client acknowledgment: ${row.document_type || "document"}`,
        details: { documentType: row.document_type, signedAt: row.signed_at },
        complianceStatus: "compliant",
      });
    }
  } catch { /* table may not exist */ }

  // Gather PFR reviews
  try {
    const pfrRows = await db.execute(sql`SELECT * FROM personal_financial_reviews WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 20`);
    for (const row of (pfrRows as any)[0] || []) {
      entries.push({
        type: "review",
        date: row.review_date?.toISOString?.() || row.created_at?.toISOString?.() || new Date().toISOString(),
        description: `PFR: ${row.review_type || "review"}`,
        details: { reviewType: row.review_type, complianceStatus: row.compliance_review_status, advisorApproved: !!row.advisor_approved_at, clientAcknowledged: !!row.client_acknowledged_at },
        complianceStatus: row.compliance_review_status === "approved" ? "compliant" : "needs-review",
      });
    }
  } catch { /* table may not exist */ }

  // Gather engagement letter disclosures
  try {
    const engRows = await db.execute(sql`SELECT * FROM engagement_letters WHERE client_id = ${clientId} AND status IN ('signed','active') ORDER BY created_at DESC LIMIT 50`);
    for (const row of (engRows as any)[0] || []) {
      entries.push({
        type: "disclosure",
        date: row.created_at?.toISOString?.() || new Date().toISOString(),
        description: `Engagement letter: ${row.engagement_type || "initial"} — ${row.fiduciary_standard || "fiduciary"}`,
        details: {
          engagementType: row.engagement_type,
          fiduciaryStandard: row.fiduciary_standard,
          feeSchedule: typeof row.fee_schedule_json === "string" ? JSON.parse(row.fee_schedule_json || "{}") : row.fee_schedule_json,
          status: row.status,
        },
        complianceStatus: row.status === "active" || row.status === "signed" ? "compliant" : "needs-review",
      });
    }
  } catch { /* table may not exist */ }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const suitCount = entries.filter(e => e.type === "suitability").length;
  const recCount = entries.filter(e => e.type === "recommendation").length;
  const ackCount = entries.filter(e => e.type === "acknowledgment").length;
  const discCount = entries.filter(e => e.type === "disclosure").length;
  const revCount = entries.filter(e => e.type === "review").length;
  const flagged = entries.filter(e => e.complianceStatus === "flagged" || e.complianceStatus === "needs-review").length;
  const compliant = entries.filter(e => e.complianceStatus === "compliant").length;
  const complianceScore = entries.length > 0 ? Math.round((compliant / entries.length) * 100) : 0;
  const reviewDates = entries.filter(e => e.type === "review").map(e => e.date);
  const lastReview = reviewDates.length > 0 ? reviewDates[0] : null;
  const nextReviewDue = lastReview ? new Date(new Date(lastReview).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : null;

  const recEntries = entries.filter(e => e.type === "recommendation");
  const hasRegBI = {
    basisForRecommendation: recEntries.some(e => e.details.reasoning?.basisForRecommendation),
    costDisclosure: recEntries.some(e => e.details.reasoning?.costDisclosure),
    conflictsDisclosure: recEntries.some(e => e.details.reasoning?.conflictsDisclosure),
    careObligation: recEntries.some(e => e.details.reasoning?.careObligation),
    overallCompliant: false,
  };
  hasRegBI.overallCompliant = hasRegBI.basisForRecommendation && hasRegBI.costDisclosure && hasRegBI.conflictsDisclosure && hasRegBI.careObligation;

  return {
    clientId, advisorId, generatedAt: new Date().toISOString(), entries,
    summary: { totalEntries: entries.length, suitabilityAssessments: suitCount, recommendations: recCount, acknowledgments: ackCount, disclosures: discCount, reviews: revCount, complianceScore, lastReviewDate: lastReview, nextReviewDue, flaggedItems: flagged },
    regBICompliance: hasRegBI,
  };
}

// ─── 7. ASSUMPTION DRIFT DETECTION ────────────────────────────────

export interface AssumptionDriftResult {
  clientId: number;
  drifts: Array<{
    assumption: string;
    values: Array<{ source: string; value: number | string }>;
    severity: "low" | "medium" | "high";
    recommendation: string;
  }>;
  overallConsistency: number;
  resolvedAt: string | null;
}

export async function detectAssumptionDrift(clientId: number): Promise<AssumptionDriftResult> {
  const db = (await getDb())!;
  const drifts: AssumptionDriftResult["drifts"] = [];

  try {
    const assumptions = await db.execute(sql`SELECT * FROM shared_assumptions WHERE (scope = 'client' AND scope_id = ${clientId}) OR scope = 'global' ORDER BY scope DESC`);
    const rows = (assumptions as any)[0] || [];
    const byKey: Record<string, Array<{ source: string; value: any }>> = {};
    for (const row of rows) {
      const key = row.assumption_key || row.key_name;
      if (!key) continue;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push({ source: `${row.scope}:${row.scope_id || "global"}`, value: row.value });
    }
    for (const [key, values] of Object.entries(byKey)) {
      if (values.length > 1) {
        const uniqueVals = [...new Set(values.map(v => String(v.value)))];
        if (uniqueVals.length > 1) {
          const isNumeric = values.every(v => !isNaN(Number(v.value)));
          let severity: "low" | "medium" | "high" = "low";
          if (isNumeric) {
            const nums = values.map(v => Number(v.value));
            const range = Math.max(...nums) - Math.min(...nums);
            const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
            const pctDiff = avg > 0 ? (range / avg) * 100 : 0;
            severity = pctDiff > 20 ? "high" : pctDiff > 10 ? "medium" : "low";
          } else { severity = "medium"; }
          drifts.push({
            assumption: key, values, severity,
            recommendation: severity === "high"
              ? `Critical: "${key}" has divergent values across scopes. Resolve immediately.`
              : `"${key}" has minor variation. Consider standardizing to client-level value.`,
          });
        }
      }
    }
  } catch { /* table may not exist */ }

  // Check calculator outputs for common assumption inconsistencies
  const commonKeys = ["inflation_rate", "discount_rate", "tax_rate", "growth_rate", "mortality_age"];
  try {
    const calcOutputs = await db.execute(sql`SELECT * FROM saved_analyses WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 50`);
    const rows = (calcOutputs as any)[0] || [];
    const assumptionsByCalc: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const inputs = typeof row.inputs_json === "string" ? JSON.parse(row.inputs_json || "{}") : row.inputs_json || {};
      const calcType = row.calculator_type || row.panel_type || "unknown";
      if (!assumptionsByCalc[calcType]) assumptionsByCalc[calcType] = {};
      for (const key of commonKeys) { if (inputs[key] !== undefined) assumptionsByCalc[calcType][key] = Number(inputs[key]); }
    }
    for (const key of commonKeys) {
      const sources: Array<{ source: string; value: number }> = [];
      for (const [calc, assumptions] of Object.entries(assumptionsByCalc)) {
        if (assumptions[key] !== undefined) sources.push({ source: calc, value: assumptions[key] });
      }
      if (sources.length > 1) {
        const uniqueVals = [...new Set(sources.map(s => s.value))];
        if (uniqueVals.length > 1) {
          const range = Math.max(...uniqueVals) - Math.min(...uniqueVals);
          const avg = uniqueVals.reduce((a, b) => a + b, 0) / uniqueVals.length;
          const pctDiff = avg > 0 ? (range / avg) * 100 : 0;
          drifts.push({
            assumption: key,
            values: sources.map(s => ({ source: s.source, value: s.value })),
            severity: pctDiff > 15 ? "high" : pctDiff > 5 ? "medium" : "low",
            recommendation: `Calculator assumption "${key}" varies across panels. Use shared assumptions to standardize.`,
          });
        }
      }
    }
  } catch { /* table may not exist */ }

  const highCount = drifts.filter(d => d.severity === "high").length;
  const medCount = drifts.filter(d => d.severity === "medium").length;
  return {
    clientId, drifts,
    overallConsistency: Math.max(0, 100 - (highCount * 20) - (medCount * 5) - drifts.length),
    resolvedAt: drifts.length === 0 ? new Date().toISOString() : null,
  };
}

// ─── 8. RECOMMENDATION ORPHAN PREVENTION ──────────────────────────

export interface OrphanedRecommendation {
  id: number;
  description: string;
  type: string;
  createdAt: string;
  suggestedGoalLinks: Array<{ goalId: number; goalName: string; confidence: number }>;
}

export async function findOrphanedRecommendations(clientId: number): Promise<{
  orphaned: OrphanedRecommendation[];
  linked: number;
  total: number;
  linkageRate: number;
}> {
  const db = (await getDb())!;
  const orphaned: OrphanedRecommendation[] = [];
  let linked = 0, total = 0;
  try {
    const recs = await db.execute(sql`SELECT * FROM recommendations_log WHERE client_id = ${clientId} ORDER BY created_at DESC`);
    const goals = await db.execute(sql`SELECT * FROM client_goals WHERE client_id = ${clientId} AND status != 'abandoned'`);
    const recRows = (recs as any)[0] || [];
    const goalRows = (goals as any)[0] || [];
    total = recRows.length;
    for (const rec of recRows) {
      if (rec.goal_id && rec.goal_id > 0) { linked++; continue; }
      const suggestedGoalLinks: OrphanedRecommendation["suggestedGoalLinks"] = [];
      const recType = (rec.recommendation_type || rec.category || "").toLowerCase();
      for (const goal of goalRows) {
        const goalCat = (goal.goal_category || "").toLowerCase();
        let confidence = 0;
        if (recType.includes(goalCat) || goalCat.includes(recType)) confidence = 0.8;
        else if (recType.includes("insurance") && goalCat.includes("protection")) confidence = 0.7;
        else if (recType.includes("retirement") && goalCat.includes("retirement")) confidence = 0.9;
        else if (recType.includes("estate") && goalCat.includes("estate")) confidence = 0.8;
        else if (recType.includes("tax") && goalCat.includes("tax")) confidence = 0.8;
        if (confidence > 0) suggestedGoalLinks.push({ goalId: goal.id, goalName: goal.goal_name || "", confidence });
      }
      suggestedGoalLinks.sort((a, b) => b.confidence - a.confidence);
      orphaned.push({
        id: rec.id, description: rec.description || rec.recommendation_type || "Unknown",
        type: rec.recommendation_type || "general",
        createdAt: rec.created_at?.toISOString?.() || new Date().toISOString(),
        suggestedGoalLinks: suggestedGoalLinks.slice(0, 3),
      });
    }
  } catch { /* tables may not exist */ }
  return { orphaned, linked, total, linkageRate: total > 0 ? Math.round((linked / total) * 100) : 100 };
}

export async function linkRecommendationToGoal(recommendationId: number, goalId: number): Promise<boolean> {
  const db = (await getDb())!;
  try { await db.execute(sql`UPDATE recommendations_log SET goal_id = ${goalId} WHERE id = ${recommendationId}`); return true; } catch { return false; }
}

// ─── 9. CROSS-HIERARCHY DATA STALENESS RESOLUTION ─────────────────

export interface StalenessReport {
  clientId: number;
  staleItems: Array<{
    entity: string;
    lastUpdated: string;
    staleDays: number;
    severity: "fresh" | "aging" | "stale" | "critical";
    recommendation: string;
  }>;
  overallFreshness: number;
  nextReviewRecommendation: string;
}

export async function detectDataStaleness(clientId: number): Promise<StalenessReport> {
  const db = (await getDb())!;
  const staleItems: StalenessReport["staleItems"] = [];
  const now = Date.now();

  const checkTable = async (tableName: string, entityLabel: string, dateCol: string = "updated_at") => {
    try {
      const rows = await (db as any).execute(sql`SELECT ${sql.raw(dateCol)} as last_date FROM ${sql.raw(tableName)} WHERE client_id = ${clientId} ORDER BY ${sql.raw(dateCol)} DESC LIMIT 1`);
      const result = (rows as any)[0]?.[0];
      if (result?.last_date) {
        const lastDate = new Date(result.last_date);
        const staleDays = Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        const severity = staleDays > 365 ? "critical" : staleDays > 180 ? "stale" : staleDays > 90 ? "aging" : "fresh";
        staleItems.push({
          entity: entityLabel, lastUpdated: lastDate.toISOString().split("T")[0], staleDays, severity,
          recommendation: severity === "critical" ? `${entityLabel} not updated in over a year. Schedule immediate review.`
            : severity === "stale" ? `${entityLabel} is over 6 months old. Schedule review within 30 days.`
            : severity === "aging" ? `${entityLabel} is aging. Consider updating at next client meeting.`
            : `${entityLabel} is current.`,
        });
      }
    } catch { /* table may not exist */ }
  };

  await checkTable("financial_profiles", "Financial Profile");
  await checkTable("suitability_assessments", "Suitability Assessment");
  await checkTable("client_goals", "Goal Hierarchy");
  await checkTable("client_discovery", "Discovery Data");
  await checkTable("planning_nodes", "Planning Hierarchy", "updated_at");
  await checkTable("recommendations_log", "Recommendations");
  await checkTable("personal_financial_reviews", "PFR Document");
  await checkTable("engagement_letters", "Engagement Letter");

  const freshCount = staleItems.filter(s => s.severity === "fresh").length;
  const overallFreshness = staleItems.length > 0 ? Math.round((freshCount / staleItems.length) * 100) : 100;
  const criticalItems = staleItems.filter(s => s.severity === "critical" || s.severity === "stale");

  return {
    clientId, staleItems, overallFreshness,
    nextReviewRecommendation: criticalItems.length > 0
      ? `${criticalItems.length} items need immediate attention: ${criticalItems.map(c => c.entity).join(", ")}`
      : staleItems.filter(s => s.severity === "aging").length > 0
      ? `${staleItems.filter(s => s.severity === "aging").length} items aging — schedule review at next meeting`
      : "All data is current. Next review recommended in 90 days.",
  };
}

// ─── 10. PLANNING NODE HEALTH SCORING ─────────────────────────────

export interface PlanningHealthReport {
  clientId: number;
  overallScore: number;
  dimensions: {
    coverage: { score: number; details: string };
    funding: { score: number; details: string };
    compliance: { score: number; details: string };
    documentation: { score: number; details: string };
    freshness: { score: number; details: string };
    alignment: { score: number; details: string };
  };
  recommendations: string[];
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
}

export async function generatePlanningHealthReport(clientId: number): Promise<PlanningHealthReport> {
  const db = (await getDb())!;
  let coverageScore = 50;
  try {
    const goals = await db.execute(sql`SELECT DISTINCT goal_category FROM client_goals WHERE client_id = ${clientId} AND status != 'abandoned'`);
    const categories = ((goals as any)[0] || []).length;
    coverageScore = Math.min(100, (categories / 8) * 100);
  } catch { /* */ }

  let fundingScore = 50;
  try {
    const goals = await db.execute(sql`SELECT target_amount, current_amount FROM client_goals WHERE client_id = ${clientId} AND status != 'abandoned'`);
    const goalRows = (goals as any)[0] || [];
    if (goalRows.length > 0) { const funded = goalRows.filter((g: any) => g.current_amount > 0).length; fundingScore = Math.round((funded / goalRows.length) * 100); }
  } catch { /* */ }

  const fiduciaryFile = await generateUnifiedFiduciaryFile(clientId, 0);
  const complianceScore = fiduciaryFile.summary.complianceScore;

  let docScore = 50;
  try {
    const pfrs = await db.execute(sql`SELECT COUNT(*) as cnt FROM personal_financial_reviews WHERE client_id = ${clientId}`);
    const engs = await db.execute(sql`SELECT COUNT(*) as cnt FROM engagement_letters WHERE client_id = ${clientId} AND status IN ('active', 'signed')`);
    const pfrCount = (pfrs as any)[0]?.[0]?.cnt || 0;
    const engCount = (engs as any)[0]?.[0]?.cnt || 0;
    docScore = Math.min(100, (pfrCount > 0 ? 50 : 0) + (engCount > 0 ? 50 : 0));
  } catch { /* */ }

  const staleness = await detectDataStaleness(clientId);
  const freshnessScore = staleness.overallFreshness;

  const orphans = await findOrphanedRecommendations(clientId);
  const alignmentScore = orphans.linkageRate;

  const overallScore = Math.round(
    (coverageScore * 0.2) + (fundingScore * 0.15) + (complianceScore * 0.25) +
    (docScore * 0.15) + (freshnessScore * 0.1) + (alignmentScore * 0.15)
  );
  const grade = overallScore >= 95 ? "A+" : overallScore >= 85 ? "A" : overallScore >= 75 ? "B" : overallScore >= 65 ? "C" : overallScore >= 50 ? "D" : "F";

  const recommendations: string[] = [];
  if (coverageScore < 70) recommendations.push("Expand goal coverage — several core planning areas are not addressed.");
  if (fundingScore < 50) recommendations.push("Review funding status — many goals lack current funding.");
  if (complianceScore < 80) recommendations.push("Strengthen compliance documentation — review flagged items in fiduciary file.");
  if (docScore < 70) recommendations.push("Generate or update PFR and engagement letter.");
  if (freshnessScore < 60) recommendations.push("Update stale data — several data sources are aging.");
  if (alignmentScore < 80) recommendations.push("Link orphaned recommendations to specific goals.");

  return {
    clientId, overallScore,
    dimensions: {
      coverage: { score: coverageScore, details: `${Math.round(coverageScore / 12.5)} of 8 core goal categories addressed` },
      funding: { score: fundingScore, details: `${fundingScore}% of goals have active funding` },
      compliance: { score: complianceScore, details: `${fiduciaryFile.summary.totalEntries} fiduciary file entries, ${fiduciaryFile.summary.flaggedItems} flagged` },
      documentation: { score: docScore, details: `PFR: ${docScore >= 50 ? "present" : "missing"}, Engagement: ${docScore >= 100 ? "active" : "missing"}` },
      freshness: { score: freshnessScore, details: staleness.nextReviewRecommendation },
      alignment: { score: alignmentScore, details: `${orphans.linked}/${orphans.total} recommendations linked to goals` },
    },
    recommendations, grade,
  };
}

// ─── 11. CROSS-CALCULATOR CONSISTENCY VALIDATION ──────────────────

export interface ConsistencyValidation {
  clientId: number;
  issues: Array<{
    type: "value-mismatch" | "missing-input" | "circular-dependency" | "stale-output";
    description: string;
    panels: string[];
    severity: "info" | "warning" | "error";
    autoFixAvailable: boolean;
  }>;
  consistencyScore: number;
}

export async function validateCrossCalculatorConsistency(clientId: number): Promise<ConsistencyValidation> {
  const db = (await getDb())!;
  const issues: ConsistencyValidation["issues"] = [];
  try {
    const outputs = await db.execute(sql`SELECT * FROM saved_analyses WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 100`);
    const rows = (outputs as any)[0] || [];
    const now = Date.now();
    for (const row of rows) {
      const created = new Date(row.created_at || row.updated_at);
      const daysSince = Math.floor((now - created.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 90) {
        issues.push({
          type: "stale-output",
          description: `${row.calculator_type || row.panel_type} output is ${daysSince} days old`,
          panels: [row.calculator_type || row.panel_type || "unknown"],
          severity: daysSince > 180 ? "error" : "warning",
          autoFixAvailable: false,
        });
      }
    }
    const inputsByKey: Record<string, Array<{ panel: string; value: any }>> = {};
    for (const row of rows) {
      const inputs = typeof row.inputs_json === "string" ? JSON.parse(row.inputs_json || "{}") : row.inputs_json || {};
      const panel = row.calculator_type || row.panel_type || "unknown";
      for (const [key, value] of Object.entries(inputs)) {
        if (!inputsByKey[key]) inputsByKey[key] = [];
        inputsByKey[key].push({ panel, value });
      }
    }
    for (const [key, values] of Object.entries(inputsByKey)) {
      if (values.length > 1) {
        const uniqueVals = [...new Set(values.map(v => JSON.stringify(v.value)))];
        if (uniqueVals.length > 1) {
          issues.push({
            type: "value-mismatch",
            description: `Input "${key}" has different values across panels`,
            panels: values.map(v => v.panel),
            severity: "warning",
            autoFixAvailable: true,
          });
        }
      }
    }
  } catch { /* table may not exist */ }

  const errorCount = issues.filter(i => i.severity === "error").length;
  const warnCount = issues.filter(i => i.severity === "warning").length;
  return { clientId, issues, consistencyScore: Math.max(0, 100 - (errorCount * 15) - (warnCount * 5)) };
}

// ─── 12. COMPREHENSIVE WEALTH ENGINE DIAGNOSTIC ───────────────────
// Runs all optimization checks and produces a unified diagnostic report.

export interface WealthEngineDiagnostic {
  clientId: number;
  runAt: string;
  fiduciaryFile: UnifiedFiduciaryFile;
  assumptionDrift: AssumptionDriftResult;
  orphanedRecommendations: { orphaned: OrphanedRecommendation[]; linked: number; total: number; linkageRate: number };
  staleness: StalenessReport;
  healthReport: PlanningHealthReport;
  consistency: ConsistencyValidation;
  overallDiagnosticScore: number;
  criticalIssues: string[];
  actionItems: string[];
}

export async function runComprehensiveDiagnostic(clientId: number, advisorId: number): Promise<WealthEngineDiagnostic> {
  const db = (await getDb())!;
  const [fiduciaryFile, assumptionDrift, orphanedRecommendations, staleness, healthReport, consistency] = await Promise.all([
    generateUnifiedFiduciaryFile(clientId, advisorId),
    detectAssumptionDrift(clientId),
    findOrphanedRecommendations(clientId),
    detectDataStaleness(clientId),
    generatePlanningHealthReport(clientId),
    validateCrossCalculatorConsistency(clientId),
  ]);

  const criticalIssues: string[] = [];
  const actionItems: string[] = [];

  // Fiduciary file issues
  if (fiduciaryFile.summary.flaggedItems > 0) criticalIssues.push(`${fiduciaryFile.summary.flaggedItems} flagged items in fiduciary file`);
  if (!fiduciaryFile.regBICompliance.overallCompliant) criticalIssues.push("Reg BI documentation incomplete");

  // Assumption drift
  const highDrifts = assumptionDrift.drifts.filter(d => d.severity === "high");
  if (highDrifts.length > 0) criticalIssues.push(`${highDrifts.length} high-severity assumption drifts detected`);

  // Orphaned recommendations
  if (orphanedRecommendations.orphaned.length > 0) actionItems.push(`Link ${orphanedRecommendations.orphaned.length} orphaned recommendations to goals`);

  // Staleness
  const criticalStale = staleness.staleItems.filter(s => s.severity === "critical" || s.severity === "stale");
  if (criticalStale.length > 0) criticalIssues.push(`${criticalStale.length} stale data sources need immediate update`);

  // Health
  if (healthReport.overallScore < 70) criticalIssues.push(`Planning health score is ${healthReport.overallScore}/100 (grade ${healthReport.grade})`);
  actionItems.push(...healthReport.recommendations);

  // Consistency
  const consistencyErrors = consistency.issues.filter(i => i.severity === "error");
  if (consistencyErrors.length > 0) criticalIssues.push(`${consistencyErrors.length} calculator consistency errors`);

  const overallDiagnosticScore = Math.round(
    (fiduciaryFile.summary.complianceScore * 0.2) +
    (assumptionDrift.overallConsistency * 0.15) +
    (orphanedRecommendations.linkageRate * 0.15) +
    (staleness.overallFreshness * 0.15) +
    (healthReport.overallScore * 0.2) +
    (consistency.consistencyScore * 0.15)
  );

  return {
    clientId, runAt: new Date().toISOString(),
    fiduciaryFile, assumptionDrift, orphanedRecommendations, staleness, healthReport, consistency,
    overallDiagnosticScore, criticalIssues, actionItems,
  };
}
