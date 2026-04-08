/**
 * Benchmarks, guardrails, product references, and methodology disclosures.
 *
 * Ported verbatim from the v7 WealthBridge HTML calculators
 * (Business-Calculator-v7, lines 4770–4828). The data is intentionally
 * identical to the source so existing consumers (the v7 host pages and the
 * new TypeScript engines) see the same numbers to the dollar / basis point.
 *
 * NOTE: this module deliberately does NOT merge with the separate
 * `INDUSTRY_BENCHMARKS_DATA` in server/services/estatePlanningKnowledge.ts
 * or the `INDUSTRY_BENCHMARKS` in server/services/reporting/industryComparisonReport.ts
 * — those have different shapes, different consumers, and different source
 * citations. Each one stays scoped to its own caller.
 */

import type {
  GuardrailRule,
  GuardrailCheck,
  ProductReference,
  IndustryBenchmark,
  ProductType,
} from "./types";

// ─── ASSUMPTION GUARDRAILS ───────────────────────────────────────────────────
// Rails on the inputs that drive every simulation. "default" is what the
// engines use when a caller omits the field; "warn" fires at 80% of max.
export const GUARDRAILS: Record<string, GuardrailRule> = {
  returnRate: {
    min: 0,
    max: 0.15,
    default: 0.07,
    label: "Return Rate",
    warn:
      "Return rates above 12% are historically rare for diversified portfolios (Morningstar 2025). Proceed with caution.",
  },
  savingsRate: {
    min: 0,
    max: 0.8,
    default: 0.15,
    label: "Savings Rate",
    warn: "Savings rates above 50% may not be sustainable long-term.",
  },
  inflationRate: {
    min: 0,
    max: 0.1,
    default: 0.03,
    label: "Inflation Rate",
    warn:
      "US inflation has averaged 3.2% since 1913 (BLS). Rates above 6% reflect extreme scenarios.",
  },
  aumFee: {
    min: 0,
    max: 0.03,
    default: 0.01,
    label: "Advisory Fee",
    warn:
      "Advisory fees above 2% are well above industry average of 1.02% (Kitces 2025).",
  },
  loanRate: {
    min: 0.02,
    max: 0.12,
    default: 0.055,
    label: "Loan Rate (PremFin)",
    warn:
      "Current SOFR is ~4.3% (NY Fed April 2026). Typical PremFin spread: SOFR + 1-2%.",
  },
  creditingRate: {
    min: 0.03,
    max: 0.12,
    default: 0.07,
    label: "IUL Crediting Rate",
    warn:
      "AG 49-A limits illustrated IUL rates. Current NLG FlexLife cap: 10-12%.",
  },
};

/**
 * Validate a user input against a guardrail. Returns:
 *  - `{type:"error"}` if outside [min, max]
 *  - `{type:"warn"}` if > 80% of max (soft limit)
 *  - `null` if the value is inside the green zone or the key is unknown
 */
export function checkGuardrail(
  key: string,
  value: number,
): GuardrailCheck | null {
  const g = GUARDRAILS[key];
  if (!g) return null;
  if (value < g.min) {
    return {
      type: "error",
      msg: `${g.label} cannot be below ${(g.min * 100).toFixed(1)}%`,
    };
  }
  if (value > g.max) {
    return {
      type: "error",
      msg: `${g.label} cannot exceed ${(g.max * 100).toFixed(1)}%`,
    };
  }
  if (value > g.max * 0.8) {
    return { type: "warn", msg: g.warn };
  }
  return null;
}

// ─── ENRICHED REFERENCES WITH INLINE CITATIONS & INDUSTRY BENCHMARKS ─────────
export const PRODUCT_REFERENCES: Record<ProductType, ProductReference> = {
  term: {
    src:
      "LIMRA 2025 ($17.5B record individual life premium), NLG Rate Sheet April 2026, IRC §101 (income tax-free death benefit)",
    url: "https://www.limra.com",
    benchmark: "Avg term premium age 40: $30-50/mo per $500K (NerdWallet 2025)",
  },
  iul: {
    src:
      "NLG LSW FlexLife Product Guide 2026, AG 49-A (illustrated rate caps), IRC §7702 (tax-free policy loans)",
    url: "https://www.nationallife.com",
    benchmark:
      "IUL cap rates: 8-12% (current), historical S&P 500 avg: 10.3% (Morningstar)",
  },
  wl: {
    src:
      "WSJ Best Whole Life Rankings 2026 (#2 NLG), MassMutual Dividend History, AM Best A++ ratings",
    url: "https://www.ambest.com",
    benchmark:
      "NLG WL dividend: ~2-3%, NWM WL dividend: ~5% (carrier annual reports)",
  },
  di: {
    src:
      "Council for Disability Awareness 2025, Guardian/Berkshire DI rate sheets, SSA disability statistics",
    url: "https://disabilitycanhappen.org",
    benchmark:
      "1-in-4 workers becomes disabled before 67 (SSA). DI replaces 60% of income.",
  },
  ltc: {
    src:
      "Genworth Cost of Care Survey 2025, Lincoln MoneyGuard product specs, AALTCI 2025",
    url: "https://www.genworth.com/aging-and-you/finances/cost-of-care.html",
    benchmark:
      "Avg nursing home: $108,405/yr (Genworth 2025). 70% of 65+ will need LTC.",
  },
  fia: {
    src:
      "Annuity.org 2026, Bankrate FIA Guide 2025, NAIC Annuity Suitability Model",
    url: "https://www.annuity.org",
    benchmark:
      "FIA avg crediting: 4-6% with 0% floor. Participation rates: 40-100%.",
  },
  aum: {
    src:
      "Kitces 2025 Advisory Fee Study (avg 1.02%), ESI Fee Schedule, Morningstar Fund Flows 2025",
    url: "https://adviserinfo.sec.gov",
    benchmark:
      "Industry avg AUM fee: 1.02% (Kitces). Vanguard: 0.30%. Wirehouse: 1.35%.",
  },
  "401k": {
    src:
      "IRS Notice 2024-80 (2025 limits: $23,500 + $7,500 catch-up), DOL 401K Fee Disclosure 2025",
    url: "https://www.irs.gov/retirement-plans",
    benchmark:
      "2025 limit: $23,500 ($31,000 with catch-up 50+). Avg employer match: 4.7% (Fidelity).",
  },
  roth: {
    src: "IRC §408A, IRS Publication 590-A, Tax Foundation Roth Analysis 2025",
    url: "https://www.irs.gov/retirement-plans/roth-iras",
    benchmark:
      "2025 limit: $7,000 ($8,000 50+). Phase-out: $150K-$165K single.",
  },
  "529": {
    src:
      "Saving for College 2025, College Board Trends in College Pricing 2025, IRC §529",
    url: "https://www.savingforcollege.com",
    benchmark:
      "Avg 4yr public: $28K/yr. Private: $60K+/yr. Education inflation: 5-6%/yr.",
  },
  estate: {
    src:
      "One Big Beautiful Bill Act (Aug 2025): $15M exemption permanent, IRC §2010, Boston College CRR",
    url: "https://taxfoundation.org",
    benchmark:
      "Estate exemption: $13.99M (2025), $15M+ (2026+). Top rate: 40%.",
  },
  premfin: {
    src:
      "NY Fed SOFR (current ~4.3%), NLG Premium Finance Director, IRC §7702, JFSP Jan 2025 (premium finance risk study)",
    url: "https://www.newyorkfed.org/markets/reference-rates/sofr",
    benchmark:
      "Typical spread: 1-2% (crediting vs loan). Min case: $1M+ face, $250K+ NW.",
  },
  splitdollar: {
    src: "IRC §61, §83, §7872 (economic benefit/loan regime), IRS Notice 2002-8",
    url: "https://www.irs.gov",
    benchmark:
      "Employer funds 80%+ of premium. Employee gets death benefit above employer recovery.",
  },
  deferredcomp: {
    src:
      "IRC §409A (NQDC rules), IRC §457(b) (governmental), DOL Advisory Opinion 2025",
    url:
      "https://www.irs.gov/retirement-plans/nonqualified-deferred-compensation-plans",
    benchmark:
      "No contribution limit (vs $23.5K for 401K). Deferred at top marginal rate (37%).",
  },
};

// ─── INDUSTRY BENCHMARKS ─────────────────────────────────────────────────────
// Headline numbers we cite in comparison tables and disclosure panels.
export const INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmark> = {
  savingsRate: {
    national: 0.062,
    source: "BEA Personal Saving Rate 2025",
    url: "https://fred.stlouisfed.org/series/PSAVERT",
  },
  investorBehaviorGap: {
    gap: 0.035,
    source: "Dalbar QAIB 2025: avg investor underperforms by 3.5%/yr",
    url: "https://www.dalbar.com",
  },
  lifeInsuranceGap: {
    pct: 0.41,
    source: "Life Happens/LIMRA 2025: 41% of Americans lack adequate coverage",
    url: "https://lifehappens.org",
  },
  retirementReadiness: {
    pct: 0.56,
    source: "Federal Reserve SCF 2025: 56% feel behind on retirement",
    url: "https://www.federalreserve.gov",
  },
  estatePlanningGap: {
    pct: 0.67,
    source: "Caring.com 2025: 67% of Americans lack a will",
    url: "https://www.caring.com",
  },
  advisorAlpha: {
    value: 0.03,
    source: "Vanguard Advisor Alpha Study 2025: ~3% added value/yr",
    url: "https://advisors.vanguard.com",
  },
  avgAdvisoryFee: {
    value: 0.0102,
    source: "Kitces 2025 Advisory Fee Benchmarking Study",
    url: "https://www.kitces.com",
  },
  avgWealthGrowth: {
    sp500: 0.103,
    bonds: 0.05,
    balanced: 0.075,
    source: "Morningstar 2025 SBBI Yearbook",
    url: "https://www.morningstar.com",
  },
};

// ─── METHODOLOGY DISCLOSURE ──────────────────────────────────────────────────
// Surfaced in the "Sources & Methodology" panels and required for
// compliance review (FINRA 2210 fair and balanced presentation).
export const METHODOLOGY_DISCLOSURE = {
  uwe:
    "The Unified Wealth Engine runs a year-by-year compounding simulation for each financial product. Tax savings are reinvested. Advisory alpha compounds on the growing portfolio. IUL cash value uses cap/floor mechanics. Whole Life includes guaranteed rates plus estimated dividends.",
  bie:
    "The Business Income Engine models personal production (GDC × bracket rate), team overrides (Gen1 + Gen2 cascade), affiliate income (Tracks A-D), AUM trail, channel marketing ROI, and partner streams with configurable seasonality patterns.",
  he:
    "The Holistic Engine combines BIE and UWE simulations. Business income feeds savings contributions (net income × savings rate), which feed product growth, which compounds with tax savings reinvestment.",
  mc:
    "Monte Carlo simulation runs 1,000 trials with randomized annual returns using a normal distribution (Box-Muller transform) around the expected return with configurable volatility (default: 15% annual standard deviation, consistent with US equity markets). Returns are capped at -40% to +60% per year.",
  pf:
    "Premium Finance modeling uses year-by-year loan balance tracking (SOFR + spread) versus IUL cash value accumulation (crediting rate - COI). Net equity = CSV - loan balance. Stress testing varies rates at +50/+100/+200 basis points.",
  disclaimer:
    "All projections are hypothetical illustrations for educational purposes. Actual results will vary based on market conditions, policy performance, tax law changes, and individual circumstances. This tool does not constitute investment, tax, or legal advice. Consult qualified professionals before making financial decisions.",
} as const;
