/**
 * SCUI — Stress Testing, Compliance, Historical Data, Industry Benchmarks
 * Faithfully extracted from WealthBridge v7 HTML calculators.
 *
 * Contains: SP500 history (1928-2025), stress scenarios, historical backtesting,
 * product references with citations, industry benchmarks, methodology disclosures.
 */

import type {
  StressScenario, BacktestResult, BacktestSummary,
  ProductReference, MethodologyDisclosure,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// S&P 500 ANNUAL RETURNS 1928-2025 (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const SP500_HISTORY: Record<number, number> = {
  1928: .438, 1929: -.083, 1930: -.251, 1931: -.435, 1932: -.085, 1933: .540, 1934: -.014, 1935: .477,
  1936: .339, 1937: -.351, 1938: .311, 1939: -.004, 1940: -.098, 1941: -.116, 1942: .205, 1943: .259,
  1944: .198, 1945: .364, 1946: -.081, 1947: .057, 1948: .055, 1949: .187, 1950: .317, 1951: .244,
  1952: .183, 1953: -.010, 1954: .526, 1955: .316, 1956: .066, 1957: -.108, 1958: .434, 1959: .120,
  1960: .007, 1961: .269, 1962: -.088, 1963: .227, 1964: .164, 1965: .124, 1966: -.101, 1967: .240,
  1968: .110, 1969: -.085, 1970: .040, 1971: .143, 1972: .189, 1973: -.146, 1974: -.264, 1975: .372,
  1976: .239, 1977: -.072, 1978: .066, 1979: .184, 1980: .324, 1981: -.049, 1982: .215, 1983: .225,
  1984: .063, 1985: .316, 1986: .186, 1987: .052, 1988: .168, 1989: .315, 1990: -.031, 1991: .305,
  1992: .076, 1993: .100, 1994: .013, 1995: .376, 1996: .230, 1997: .333, 1998: .286, 1999: .210,
  2000: -.091, 2001: -.119, 2002: -.221, 2003: .287, 2004: .109, 2005: .049, 2006: .158, 2007: .055,
  2008: -.370, 2009: .265, 2010: .151, 2011: .021, 2012: .160, 2013: .324, 2014: .137, 2015: .014,
  2016: .120, 2017: .218, 2018: -.044, 2019: .314, 2020: .184, 2021: .286, 2022: -.181, 2023: .263,
  2024: .250, 2025: .100,
};

// ═══════════════════════════════════════════════════════════════════════════
// STRESS SCENARIOS (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const STRESS_SCENARIOS: Record<string, StressScenario> = {
  dotcom: {
    name: "Dot-Com Crash (2000-2002)",
    years: [2000, 2001, 2002, 2003, 2004],
    returns: [-0.091, -0.119, -0.221, 0.287, 0.109],
    description: "Tech bubble burst. S&P 500 fell 49% peak-to-trough over 30 months.",
  },
  gfc: {
    name: "Financial Crisis (2007-2009)",
    years: [2007, 2008, 2009, 2010, 2011],
    returns: [0.055, -0.370, 0.265, 0.151, 0.021],
    description: "Housing/credit crisis. S&P 500 fell 57% peak-to-trough. Lehman Brothers collapsed.",
  },
  covid: {
    name: "COVID Crash (2020)",
    years: [2019, 2020, 2021, 2022, 2023],
    returns: [0.314, 0.184, 0.286, -0.181, 0.263],
    description: "Pandemic shock. S&P 500 fell 34% in 23 trading days, then recovered within 5 months.",
  },
  stagflation: {
    name: "Stagflation (1973-1974)",
    years: [1972, 1973, 1974, 1975, 1976],
    returns: [0.189, -0.146, -0.264, 0.372, 0.239],
    description: "Oil embargo + high inflation. S&P 500 fell 48% peak-to-trough. CPI hit 12.3%. Double whammy of declining portfolio + eroding purchasing power.",
  },
  rising_rates: {
    name: "Rising Rates (2022)",
    years: [2020, 2021, 2022, 2023, 2024],
    returns: [0.184, 0.286, -0.181, 0.263, 0.250],
    description: "Fed hiked rates from 0% to 5.25% in 16 months. S&P 500 fell 25%. Bonds fell simultaneously — traditional 60/40 portfolio offered no refuge.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HISTORICAL BACKTESTING
// ═══════════════════════════════════════════════════════════════════════════

export function historicalBacktest(
  startBalance: number,
  annualContribution: number,
  annualCost: number,
  horizon: number,
): BacktestSummary {
  const years = Object.keys(SP500_HISTORY).map(Number).sort((a, b) => a - b);
  let survived = 0, total = 0;
  let worst = { year: 0, final: Infinity, min: Infinity };
  let best = { year: 0, final: 0 };
  const allPaths: BacktestResult[] = [];

  for (let i = 0; i < years.length; i++) {
    const startYr = years[i];
    if (startYr + horizon > 2025) break;
    total++;
    let bal = startBalance;
    let minBal = startBalance;
    const path: number[] = [startBalance];
    let failed = false;

    for (let y = 0; y < horizon; y++) {
      const ret = SP500_HISTORY[startYr + y] || 0.07;
      bal = (bal + annualContribution - annualCost) * (1 + ret);
      if (bal < 0) { bal = 0; failed = true; }
      path.push(Math.max(0, Math.round(bal)));
      if (bal < minBal) minBal = bal;
    }

    if (!failed && bal > 0) survived++;
    allPaths.push({ startYear: startYr, finalBalance: Math.round(bal), minBalance: Math.round(minBal), path });
    if (bal < worst.final) worst = { year: startYr, final: Math.round(bal), min: Math.round(minBal) };
    if (bal > best.final) best = { year: startYr, final: Math.round(bal) };
  }

  const survivalRate = total > 0 ? survived / total : 1;
  const finals = allPaths.map((p) => p.finalBalance).sort((a, b) => a - b);
  const medianFinal = finals[Math.floor(finals.length / 2)] || 0;

  return {
    survivalRate,
    survived,
    total,
    worst,
    best,
    medianFinal,
    allPaths,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STRESS TEST (apply specific scenario to a balance)
// ═══════════════════════════════════════════════════════════════════════════

export function stressTest(
  scenarioKey: string,
  startBalance: number,
  annualContribution: number = 0,
  annualCost: number = 0,
): { scenario: StressScenario; path: number[]; finalBalance: number; maxDrawdown: number; recoveryYears: number } | null {
  const scenario = STRESS_SCENARIOS[scenarioKey];
  if (!scenario) return null;

  let bal = startBalance;
  let peak = startBalance;
  let maxDrawdown = 0;
  const path: number[] = [startBalance];

  for (let i = 0; i < scenario.returns.length; i++) {
    bal = (bal + annualContribution - annualCost) * (1 + scenario.returns[i]);
    if (bal < 0) bal = 0;
    path.push(Math.round(bal));
    if (bal > peak) peak = bal;
    const dd = peak > 0 ? (peak - bal) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Recovery years (continue at 7% avg until back to peak)
  let recoveryYears = 0;
  let recBal = bal;
  while (recBal < peak && recoveryYears < 20) {
    recBal = (recBal + annualContribution) * 1.07;
    recoveryYears++;
  }

  return {
    scenario,
    path,
    finalBalance: Math.round(bal),
    maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
    recoveryYears,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT REFERENCES (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const PRODUCT_REFERENCES: Record<string, ProductReference> = {
  term: { src: "LIMRA 2025 Term Life Study, Quotacy Rate Tables 2025, SOA 2017 CSO Mortality Table", url: "https://www.limra.com", benchmark: "Avg 20yr term for 40yo male: $56/mo per $500K. Best-in-class: Haven Life $45/mo." },
  iul: { src: "Penn Mutual Accumulation IUL II Illustration 2025, Transamerica Financial Foundation IUL, Pacific Life PDX", url: "https://www.pennmutual.com", benchmark: "Avg IUL cap: 10-12%. Floor: 0%. Avg crediting: 6-7%. COI increases with age." },
  wl: { src: "NWM 2025 Dividend Scale (5.0%), MassMutual (6.2%), Guardian (5.85%), NYL (5.4%)", url: "https://www.northwesternmutual.com", benchmark: "NWM 2025 dividend: 5.0%. MassMutual: 6.2%. Industry avg: 4.5-5.5%." },
  di: { src: "Guardian DI Premium Rates 2025, Principal DI, Ameritas DI", url: "https://www.guardianlife.com", benchmark: "Avg DI premium: 2-4% of benefit. Own-occ to age 65. 90-day elimination typical." },
  ltc: { src: "Mutual of Omaha LTC Rate Tables 2025, Genworth Cost of Care Survey 2025, AALTCI 2025", url: "https://www.mutualofomaha.com", benchmark: "Avg LTC cost: $108K/yr nursing home. Hybrid LTC/Life growing 25%+ annually." },
  fia: { src: "Annuity.org 2026, Bankrate FIA Guide 2025, NAIC Annuity Suitability Model", url: "https://www.annuity.org", benchmark: "FIA avg crediting: 4-6% with 0% floor. Participation rates: 40-100%." },
  aum: { src: "Kitces 2025 Advisory Fee Study (avg 1.02%), ESI Fee Schedule, Morningstar Fund Flows 2025", url: "https://adviserinfo.sec.gov", benchmark: "Industry avg AUM fee: 1.02% (Kitces). Vanguard: 0.30%. Wirehouse: 1.35%." },
  "401k": { src: "IRS Notice 2024-80 (2025 limits: $23,500 + $7,500 catch-up), DOL 401K Fee Disclosure 2025", url: "https://www.irs.gov/retirement-plans", benchmark: "2025 limit: $23,500 ($31,000 with catch-up 50+). Avg employer match: 4.7% (Fidelity)." },
  roth: { src: "IRC §408A, IRS Publication 590-A, Tax Foundation Roth Analysis 2025", url: "https://www.irs.gov/retirement-plans/roth-iras", benchmark: "2025 limit: $7,000 ($8,000 50+). Phase-out: $150K-$165K single." },
  "529": { src: "Saving for College 2025, College Board Trends in College Pricing 2025, IRC §529", url: "https://www.savingforcollege.com", benchmark: "Avg 4yr public: $28K/yr. Private: $60K+/yr. Education inflation: 5-6%/yr." },
  estate: { src: "One Big Beautiful Bill Act (Aug 2025): $15M exemption permanent, IRC §2010, Boston College CRR", url: "https://taxfoundation.org", benchmark: "Estate exemption: $13.99M (2025), $15M+ (2026+). Top rate: 40%." },
  premfin: { src: "NY Fed SOFR (current ~4.3%), NLG Premium Finance Director, IRC §7702, JFSP Jan 2025 (premium finance risk study)", url: "https://www.newyorkfed.org/markets/reference-rates/sofr", benchmark: "Typical spread: 1-2% (crediting vs loan). Min case: $1M+ face, $250K+ NW." },
  splitdollar: { src: "IRC §61, §83, §7872 (economic benefit/loan regime), IRS Notice 2002-8", url: "https://www.irs.gov", benchmark: "Employer funds 80%+ of premium. Employee gets death benefit above employer recovery." },
  deferredcomp: { src: "IRC §409A (NQDC rules), IRC §457(b) (governmental), DOL Advisory Opinion 2025", url: "https://www.irs.gov/retirement-plans/nonqualified-deferred-compensation-plans", benchmark: "No contribution limit (vs $23.5K for 401K). Deferred at top marginal rate (37%)." },
};

// ═══════════════════════════════════════════════════════════════════════════
// INDUSTRY BENCHMARKS (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const INDUSTRY_BENCHMARKS = {
  savingsRate: { national: 0.062, source: "BEA Personal Saving Rate 2025", url: "https://fred.stlouisfed.org/series/PSAVERT" },
  investorBehaviorGap: { gap: 0.035, source: "Dalbar QAIB 2025: avg investor underperforms by 3.5%/yr", url: "https://www.dalbar.com" },
  lifeInsuranceGap: { pct: 0.41, source: "Life Happens/LIMRA 2025: 41% of Americans lack adequate coverage", url: "https://lifehappens.org" },
  retirementReadiness: { pct: 0.56, source: "Federal Reserve SCF 2025: 56% feel behind on retirement", url: "https://www.federalreserve.gov" },
  estatePlanningGap: { pct: 0.67, source: "Caring.com 2025: 67% of Americans lack a will", url: "https://www.caring.com" },
  advisorAlpha: { value: 0.03, source: "Vanguard Advisor Alpha Study 2025: ~3% added value/yr", url: "https://advisors.vanguard.com" },
  avgAdvisoryFee: { value: 0.0102, source: "Kitces 2025 Advisory Fee Benchmarking Study", url: "https://www.kitces.com" },
  avgWealthGrowth: { sp500: 0.103, bonds: 0.05, balanced: 0.075, source: "Morningstar 2025 SBBI Yearbook", url: "https://www.morningstar.com" },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// METHODOLOGY DISCLOSURES (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const METHODOLOGY_DISCLOSURE: MethodologyDisclosure = {
  uwe: "The Unified Wealth Engine runs a year-by-year compounding simulation for each financial product. Tax savings are reinvested. Advisory alpha compounds on the growing portfolio. IUL cash value uses cap/floor mechanics. Whole Life includes guaranteed rates plus estimated dividends.",
  bie: "The Business Income Engine models personal production (GDC × bracket rate), team overrides (Gen1 + Gen2 cascade), affiliate income (Tracks A-D), AUM trail, channel marketing ROI, and partner streams with configurable seasonality patterns.",
  he: "The Holistic Engine combines BIE and UWE simulations. Business income feeds savings contributions (net income × savings rate), which feed product growth, which compounds with tax savings reinvestment.",
  mc: "Monte Carlo simulation runs 1,000 trials with randomized annual returns using a normal distribution (Box-Muller transform) around the expected return with configurable volatility (default: 15% annual standard deviation, consistent with US equity markets). Returns are capped at -40% to +60% per year.",
  pf: "Premium Finance modeling uses year-by-year loan balance tracking (SOFR + spread) versus IUL cash value accumulation (crediting rate - COI). Net equity = CSV - loan balance. Stress testing varies rates at +50/+100/+200 basis points.",
  disclaimer: "All projections are hypothetical illustrations for educational purposes. Actual results will vary based on market conditions, policy performance, tax law changes, and individual circumstances. This tool does not constitute investment, tax, or legal advice. Consult qualified professionals before making financial decisions.",
};

// ═══════════════════════════════════════════════════════════════════════════
// GUARDRAIL CHECKS
// ═══════════════════════════════════════════════════════════════════════════

export interface GuardrailWarning {
  field: string;
  value: number;
  threshold: number;
  message: string;
  severity: "info" | "warning" | "error";
}

export function checkGuardrails(params: Record<string, number>): GuardrailWarning[] {
  const warnings: GuardrailWarning[] = [];

  const checks: { field: string; max: number; message: string; severity: "info" | "warning" | "error" }[] = [
    { field: "returnRate", max: 0.12, message: "Return rate exceeds historical S&P 500 average (10.3%). Consider using a more conservative estimate.", severity: "warning" },
    { field: "savingsRate", max: 0.50, message: "Savings rate above 50% is unusual. National average is 6.2% (BEA 2025).", severity: "info" },
    { field: "growthRate", max: 0.20, message: "Growth rate above 20% is aggressive. Consider industry benchmarks.", severity: "warning" },
    { field: "inflationRate", max: 0.06, message: "Inflation rate above 6% is historically unusual for sustained periods.", severity: "info" },
    { field: "taxRate", max: 0.50, message: "Effective tax rate above 50% is unusual. Top marginal federal rate is 37%.", severity: "warning" },
  ];

  for (const check of checks) {
    const val = params[check.field];
    if (val !== undefined && val > check.max) {
      warnings.push({
        field: check.field,
        value: val,
        threshold: check.max,
        message: check.message,
        severity: check.severity,
      });
    }
  }

  return warnings;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const SCUI = {
  SP500_HISTORY,
  STRESS_SCENARIOS,
  PRODUCT_REFERENCES,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
  historicalBacktest,
  stressTest,
  checkGuardrails,
  getStressScenarioKeys: () => Object.keys(STRESS_SCENARIOS),
  getProductReferenceKeys: () => Object.keys(PRODUCT_REFERENCES),
  getBenchmarkKeys: () => Object.keys(INDUSTRY_BENCHMARKS),
};

export default SCUI;
