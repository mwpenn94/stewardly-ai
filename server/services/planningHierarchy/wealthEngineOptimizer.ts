/**
 * wealthEngineOptimizer.ts — Wealth Engine Optimization Layer
 * 
 * Addresses remaining CFP assessment gaps:
 * 1. Collateral tracking (policy cash value vs. loan balance) for premium finance
 * 2. Exit strategy modeling (when to unwind financing arrangements)
 * 3. Senior investor protections (age-based suitability enhancements)
 * 4. Cross-calculator gap aggregation (unified "current vs. needed" view)
 * 5. SEC Marketing Rule compliance documentation enhancement
 */

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
