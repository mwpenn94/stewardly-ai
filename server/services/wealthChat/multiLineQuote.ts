/**
 * Multi-Line Quick Quote engine — force multiplier.
 *
 * Given a minimal client profile, returns a bundled proposal covering
 * every major line of financial protection + planning the average
 * household needs:
 *
 *   LIFE:         Term life (income replacement), permanent life (IUL/WL)
 *   DISABILITY:   Individual disability income (DI)
 *   LTC:          Long-term care (hybrid or traditional)
 *   HEALTH:       High-deductible health + HSA recommendation
 *   P&C:          Homeowners, auto, renters (illustrative premiums)
 *   UMBRELLA:     Personal liability umbrella
 *   BUSINESS:     BOP, key-person life, buy-sell funding (business owners)
 *   PLANNING:     Roth / 529 / estate documents / emergency fund
 *
 * Premium estimates come from the calibrated `estPrem` rate tables in
 * UWE so outputs stay numerically consistent with the Strategy
 * Comparison page. P&C / health / umbrella use market median rate
 * heuristics because UWE doesn't model them.
 *
 * This service is called by:
 *   • `/wealth-engine` hub → "Bundle quick quote" tile
 *   • `QuickQuoteFlow` step 4 → full multi-line grid
 *   • tRPC `wealthEngine.multiLineQuickQuote` for chat + agent use
 *
 * Pure function — no IO, no persistence. Callers persist.
 */

import { estPrem } from "../../shared/calculators/uwe";

export interface QuickQuoteProfile {
  age: number;
  income: number;
  netWorth?: number;
  savings?: number;
  dependents: number;
  monthlySavings?: number;
  hasHome?: boolean;
  homeValue?: number;
  isBizOwner?: boolean;
  businessRevenue?: number;
  numEmployees?: number;
  stateCode?: string;
  healthClass?: "preferred" | "standard" | "substandard";
  occupation?: "professional" | "skilled" | "manual";
}

export type CoverageCategory =
  | "life"
  | "disability"
  | "ltc"
  | "health"
  | "property"
  | "auto"
  | "umbrella"
  | "business"
  | "planning";

export interface CoverageLine {
  category: CoverageCategory;
  product: string;
  coverageAmount: number;
  annualPremium: number;
  monthlyPremium: number;
  rationale: string;
  priority: "critical" | "recommended" | "optional";
  /** Optional CTA — "/wealth-engine/strategy-comparison" etc. */
  deepLinkPath?: string;
}

export interface PlanningAction {
  action: string;
  impact: string;
  priority: "critical" | "recommended" | "optional";
  annualAmount?: number;
}

export interface MultiLineQuickQuoteResult {
  profileSummary: {
  income: number;
  protectionGap: number;
  recommendedCoverage: number;
  emergencyFundMonths: number;
  };
  coverageLines: CoverageLine[];
  planningActions: PlanningAction[];
  totals: {
  annualPremiumCritical: number;
  annualPremiumRecommended: number;
  annualPremiumAll: number;
  asPctOfIncome: number;
  };
  warnings: string[];
  generatedAt: string;
}

// Heuristic constants — conservative mid-market medians. Annotated with
// source so future tuning passes know where to revise.
const HEURISTICS = {
  /** Income replacement multiple — 10x income is the retail industry
   *  rule of thumb, 15x for HNW clients with higher savings targets. */
  LIFE_COVERAGE_MULTIPLE: 10,
  HNW_LIFE_COVERAGE_MULTIPLE: 15,
  HNW_THRESHOLD: 250_000,
  /** DI benefit — 65% of gross income is the typical non-cancellable
   *  own-occupation cap (~$15k/mo on high-income clients). */
  DI_BENEFIT_PCT: 0.65,
  DI_MAX_MONTHLY: 20_000,
  /** LTC pool — $250k is median starting pool, $500k for HNW. */
  LTC_POOL: 250_000,
  HNW_LTC_POOL: 500_000,
  /** Umbrella — $1M minimum, stack $1M per $1M of net worth above $500k. */
  UMBRELLA_BASE: 1_000_000,
  UMBRELLA_PER_MILLION_NW: 1_000_000,
  /** Emergency fund — 3 months basic / 6 months for single earners. */
  EMERGENCY_MONTHS_BASE: 3,
  EMERGENCY_MONTHS_SINGLE: 6,
  /** Homeowner rate: 0.35% of home value (HO-3 nationwide median). */
  HOMEOWNER_RATE: 0.0035,
  /** Auto: $1,500 / year median (national); $2,200 in high-risk states. */
  AUTO_BASE: 1_500,
  AUTO_HIGH_RISK_STATES: ["MI", "LA", "FL", "NY", "NJ", "RI"],
  AUTO_HIGH_RISK_PREMIUM: 2_200,
  /** Renters: $180 / year. */
  RENTERS_BASE: 180,
  /** Umbrella: $350 / million. */
  UMBRELLA_PER_MILLION: 350,
  /** Health HDHP: $8k / year family, $3.5k single. */
  HDHP_FAMILY: 8_000,
  HDHP_SINGLE: 3_500,
  /** BOP: 0.8% of revenue, min $500. */
  BOP_RATE: 0.008,
  BOP_MIN: 500,
  /** Key person life: 5× salary. */
  KEY_PERSON_MULTIPLE: 5,
  /** 529 target: $12k/yr per dependent. */
  COLLEGE_PER_DEPENDENT: 12_000,
  /** Roth IRA annual limit. */
  ROTH_IRA_LIMIT: 7_000,
};

function roundPremium(p: number): number {
  return Math.round(p / 10) * 10;
}

function monthly(p: number): number {
  return Math.round(p / 12);
}

function effectiveAge(age: number): number {
  // Clamp into UWE's rate tables (18-85)
  return Math.min(85, Math.max(18, Math.round(age)));
}

/**
 * Core entry point — builds a bundled multi-line quote for any profile.
 */
export function generateMultiLineQuickQuote(
  profile: QuickQuoteProfile,
): MultiLineQuickQuoteResult {
  const warnings: string[] = [];
  const coverageLines: CoverageLine[] = [];
  const planningActions: PlanningAction[] = [];
  const age = effectiveAge(profile.age);

  // ── Derive profile summary ────────────────────────────────────────
  const income = Math.max(0, profile.income);
  const isHnw = (profile.netWorth ?? 0) > HEURISTICS.HNW_THRESHOLD || income > HEURISTICS.HNW_THRESHOLD;
  const lifeMultiple = isHnw
    ? HEURISTICS.HNW_LIFE_COVERAGE_MULTIPLE
    : HEURISTICS.LIFE_COVERAGE_MULTIPLE;
  const recommendedLifeCoverage = income * lifeMultiple;
  const protectionGap = Math.max(0, recommendedLifeCoverage - (profile.netWorth ?? 0) * 0.2);

  const emergencyMonths =
    profile.dependents === 0
      ? HEURISTICS.EMERGENCY_MONTHS_SINGLE
      : HEURISTICS.EMERGENCY_MONTHS_BASE;
  const emergencyTarget = (income / 12) * emergencyMonths;
  const emergencyGap = Math.max(0, emergencyTarget - (profile.savings ?? 0));

  // ── LIFE INSURANCE (Term — critical if dependents) ───────────────
  if (profile.dependents > 0 || income > 0) {
    const termFace = recommendedLifeCoverage;
    const termPremium = estPrem("term", age, termFace);
    coverageLines.push({
      category: "life",
      product: `20-Year Term Life, $${(termFace / 1000).toFixed(0)}K`,
      coverageAmount: termFace,
      annualPremium: roundPremium(termPremium),
      monthlyPremium: monthly(termPremium),
      rationale:
        profile.dependents > 0
          ? `Replaces ${lifeMultiple}× income to protect ${profile.dependents} dependent(s).`
          : "Locks in insurability and covers final expenses + debts.",
      priority: profile.dependents > 0 ? "critical" : "recommended",
      deepLinkPath: "/wealth-engine/strategy-comparison",
    });
  }

  // Permanent layer for HNW
  if (isHnw && age < 65) {
    const iulFace = income * 5;
    const iulPremium = estPrem("iul", age, iulFace);
    coverageLines.push({
      category: "life",
      product: `IUL Permanent, $${(iulFace / 1000).toFixed(0)}K`,
      coverageAmount: iulFace,
      annualPremium: roundPremium(iulPremium),
      monthlyPremium: monthly(iulPremium),
      rationale:
        "Permanent layer for tax-advantaged cash accumulation + lifetime death benefit.",
      priority: "recommended",
      deepLinkPath: "/wealth-engine/strategy-comparison",
    });
  }

  // ── DISABILITY ────────────────────────────────────────────────────
  if (age < 65 && income > 0) {
    const monthlyBenefit = Math.min(
      HEURISTICS.DI_MAX_MONTHLY,
      (income / 12) * HEURISTICS.DI_BENEFIT_PCT,
    );
    const annualBenefit = monthlyBenefit * 12;
    const diPremium = estPrem("di", age, annualBenefit);
    coverageLines.push({
      category: "disability",
      product: `Individual DI, $${Math.round(monthlyBenefit).toLocaleString()}/mo to age 65`,
      coverageAmount: annualBenefit,
      annualPremium: roundPremium(diPremium),
      monthlyPremium: monthly(diPremium),
      rationale:
        "Own-occupation DI replaces 65% of pre-tax income tax-free if you cannot work. Statistically the most-likely-to-be-claimed coverage.",
      priority: age < 55 ? "critical" : "recommended",
      deepLinkPath: "/calculators",
    });
  }

  // ── LTC ───────────────────────────────────────────────────────────
  if (age >= 45 && age <= 75) {
    const pool = isHnw ? HEURISTICS.HNW_LTC_POOL : HEURISTICS.LTC_POOL;
    const ltcPremium = estPrem("ltc", age, pool);
    coverageLines.push({
      category: "ltc",
      product: `Hybrid LTC, $${(pool / 1000).toFixed(0)}K pool`,
      coverageAmount: pool,
      annualPremium: roundPremium(ltcPremium),
      monthlyPremium: monthly(ltcPremium),
      rationale:
        "70% of Americans 65+ will need some LTC. Hybrid designs preserve premiums if unused.",
      priority: age >= 55 ? "recommended" : "optional",
      deepLinkPath: "/insurance-analysis",
    });
  }

  // ── HEALTH (HDHP + HSA) ────────────────────────────────────────────
  const hdhpPremium =
    profile.dependents > 0 ? HEURISTICS.HDHP_FAMILY : HEURISTICS.HDHP_SINGLE;
  coverageLines.push({
    category: "health",
    product: `HDHP + HSA (${profile.dependents > 0 ? "family" : "single"})`,
    coverageAmount: 0,
    annualPremium: hdhpPremium,
    monthlyPremium: monthly(hdhpPremium),
    rationale:
      "High-deductible health plan unlocks HSA triple tax advantage — deductible in, tax-free growth, tax-free medical spending.",
    priority: "recommended",
    deepLinkPath: "/calculators",
  });

  // ── PROPERTY ──────────────────────────────────────────────────────
  if (profile.hasHome) {
    const hv = profile.homeValue ?? Math.max(250_000, income * 3);
    const homePremium = hv * HEURISTICS.HOMEOWNER_RATE;
    coverageLines.push({
      category: "property",
      product: `HO-3 Homeowners, $${(hv / 1000).toFixed(0)}K dwelling`,
      coverageAmount: hv,
      annualPremium: roundPremium(homePremium),
      monthlyPremium: monthly(homePremium),
      rationale:
        "Replacement-cost coverage on dwelling with liability + loss of use. Bundle discount up to 20% when combined with auto.",
      priority: "critical",
    });
  } else {
    coverageLines.push({
      category: "property",
      product: "HO-4 Renters",
      coverageAmount: 30_000,
      annualPremium: HEURISTICS.RENTERS_BASE,
      monthlyPremium: monthly(HEURISTICS.RENTERS_BASE),
      rationale:
        "Protects personal property + liability at rental unit — often < $20/mo and the highest ROI coverage on this list.",
      priority: "recommended",
    });
  }

  // ── AUTO ──────────────────────────────────────────────────────────
  const isHighRisk = HEURISTICS.AUTO_HIGH_RISK_STATES.includes(
    profile.stateCode ?? "",
  );
  const autoPremium = isHighRisk
    ? HEURISTICS.AUTO_HIGH_RISK_PREMIUM
    : HEURISTICS.AUTO_BASE;
  coverageLines.push({
    category: "auto",
    product: "Personal Auto Policy (100/300/100 + UM/UIM)",
    coverageAmount: 300_000,
    annualPremium: autoPremium,
    monthlyPremium: monthly(autoPremium),
    rationale:
      "Stack liability to the umbrella attachment point + always buy UM/UIM — uninsured driver claims are the most common umbrella triggers.",
    priority: "critical",
  });

  // ── UMBRELLA ──────────────────────────────────────────────────────
  const umbrellaTarget = Math.max(
    HEURISTICS.UMBRELLA_BASE,
    Math.min(
      10_000_000,
      HEURISTICS.UMBRELLA_BASE +
        Math.max(0, (profile.netWorth ?? 0) - 500_000) / HEURISTICS.UMBRELLA_PER_MILLION_NW *
          1_000_000,
    ),
  );
  const umbrellaPremium =
    (umbrellaTarget / 1_000_000) * HEURISTICS.UMBRELLA_PER_MILLION;
  coverageLines.push({
    category: "umbrella",
    product: `Personal Umbrella, $${(umbrellaTarget / 1_000_000).toFixed(0)}M`,
    coverageAmount: umbrellaTarget,
    annualPremium: roundPremium(umbrellaPremium),
    monthlyPremium: monthly(umbrellaPremium),
    rationale:
      "Highest-ROI liability coverage — $1M of extra liability costs under $30/mo and protects your net worth from a single lawsuit.",
    priority: (profile.netWorth ?? 0) > 500_000 ? "critical" : "recommended",
  });

  // ── BUSINESS OWNER BUNDLE ─────────────────────────────────────────
  if (profile.isBizOwner) {
    const rev = profile.businessRevenue ?? income * 1.5;
    const bopPremium = Math.max(
      HEURISTICS.BOP_MIN,
      rev * HEURISTICS.BOP_RATE,
    );
    coverageLines.push({
      category: "business",
      product: "Business Owner Policy (BOP)",
      coverageAmount: rev,
      annualPremium: roundPremium(bopPremium),
      monthlyPremium: monthly(bopPremium),
      rationale:
        "Bundles general liability + business property + loss of income — core protection for any small business.",
      priority: "critical",
    });

    // Key-person life
    const keyPersonFace = income * HEURISTICS.KEY_PERSON_MULTIPLE;
    const keyPremium = estPrem("term", age, keyPersonFace);
    coverageLines.push({
      category: "business",
      product: `Key Person Term, $${(keyPersonFace / 1000).toFixed(0)}K`,
      coverageAmount: keyPersonFace,
      annualPremium: roundPremium(keyPremium),
      monthlyPremium: monthly(keyPremium),
      rationale:
        "Business-owned life insurance that funds operations / hires a replacement if the key employee is lost.",
      priority: "recommended",
      deepLinkPath: "/engine-dashboard",
    });

    // Buy-sell / funding if >1 owner is implied by employees
    if ((profile.numEmployees ?? 0) > 0) {
      planningActions.push({
        action: "Formalize buy-sell agreement funded with life insurance",
        impact:
          "Prevents forced sale to outsiders on owner death; disability buy-out coverage handles the more-common disability trigger.",
        priority: "recommended",
      });
    }

    // Group benefits if 5+ employees
    if ((profile.numEmployees ?? 0) >= 5) {
      const groupPremium = estPrem("group", age, profile.numEmployees ?? 5);
      coverageLines.push({
        category: "business",
        product: "Group Life + DI",
        coverageAmount: (profile.numEmployees ?? 5) * 50_000,
        annualPremium: roundPremium(groupPremium),
        monthlyPremium: monthly(groupPremium),
        rationale:
          "Employer-paid group benefits boost retention and qualify the business for QSEHRA/ICHRA plan design.",
        priority: "optional",
      });
    }
  }

  // ── PLANNING ACTIONS ──────────────────────────────────────────────
  if (emergencyGap > 0) {
    planningActions.push({
      action: `Build emergency fund to ${emergencyMonths} months ($${Math.round(emergencyTarget).toLocaleString()})`,
      impact: `Gap of $${Math.round(emergencyGap).toLocaleString()} — parking it in a HYSA earns 4-5% vs savings account 0.5%.`,
      priority: "critical",
      annualAmount: Math.min(emergencyGap, (profile.monthlySavings ?? 0) * 12),
    });
  }

  if (income > 0) {
    const rothEligible = income < 161_000; // 2025 single phase-out ceiling
    planningActions.push({
      action: rothEligible
        ? "Fund Roth IRA to limit"
        : "Execute backdoor Roth IRA contribution",
      impact: `$${HEURISTICS.ROTH_IRA_LIMIT.toLocaleString()}/year tax-free growth + estate-friendly. Compound over 30 years to ~$500K.`,
      priority: "recommended",
      annualAmount: HEURISTICS.ROTH_IRA_LIMIT,
    });
  }

  if (profile.dependents > 0) {
    const target = HEURISTICS.COLLEGE_PER_DEPENDENT * profile.dependents;
    planningActions.push({
      action: `Open 529 plan for ${profile.dependents} dependent(s)`,
      impact: `$${target.toLocaleString()}/yr goal — state tax deduction in most states + tax-free qualified withdrawals.`,
      priority: "recommended",
      annualAmount: target,
    });
  }

  if ((profile.netWorth ?? 0) > 500_000 || profile.dependents > 0) {
    planningActions.push({
      action: "Establish revocable living trust + advance directives",
      impact:
        "Avoids probate, names guardians for minor children, activates HIPAA + healthcare proxy instantly.",
      priority: "critical",
    });
  }

  if (profile.isBizOwner) {
    planningActions.push({
      action: "Elect S-Corp status (if pass-through profit > $60k) and stack Solo 401(k)",
      impact:
        "Can save $8-20k/year in SE tax at typical profit levels + $77.5K tax-deferred retirement.",
      priority: "recommended",
    });
  }

  // Warnings
  if (profile.dependents > 0 && (profile.netWorth ?? 0) === 0 && income === 0) {
    warnings.push(
      "No income or net worth provided — coverage recommendations are minimums only.",
    );
  }
  if (age > 75) {
    warnings.push("Client is 75+ — insurance rates will exceed table values; quote as estimate only.");
  }

  // Totals
  const critical = coverageLines
    .filter((l) => l.priority === "critical")
    .reduce((s, l) => s + l.annualPremium, 0);
  const recommendedPremium = coverageLines
    .filter((l) => l.priority === "recommended")
    .reduce((s, l) => s + l.annualPremium, 0);
  const totalAll = coverageLines.reduce((s, l) => s + l.annualPremium, 0);

  return {
    profileSummary: {
      income,
      protectionGap,
      recommendedCoverage: recommendedLifeCoverage,
      emergencyFundMonths: emergencyMonths,
    },
    coverageLines,
    planningActions,
    totals: {
      annualPremiumCritical: critical,
      annualPremiumRecommended: critical + recommendedPremium,
      annualPremiumAll: totalAll,
      asPctOfIncome: income > 0 ? totalAll / income : 0,
    },
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
