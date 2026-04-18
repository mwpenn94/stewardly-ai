/**
 * Industry Benchmarks & Data Sourcing for Wealth Engine Panels
 *
 * Sources: Kitces Research 2024, Cerulli Associates, InvestmentNews,
 * FA Insight, Schwab Benchmarking, Morningstar, CFP Board, LIMRA,
 * Bureau of Labor Statistics, Federal Reserve, IRS, SSA
 *
 * Updated: Q1 2026
 */

/* ═══ PRACTICE MANAGEMENT BENCHMARKS ═══ */
export const PRACTICE_BENCHMARKS = {
  /** Revenue per advisor by channel (Cerulli 2024) */
  revenuePerAdvisor: {
    wirehouse: 1_250_000,
    ria: 850_000,
    independentBD: 420_000,
    bankTrust: 650_000,
    insurance: 310_000,
    hybrid: 580_000,
  },
  /** Operating profit margin by AUM tier (FA Insight 2024) */
  profitMarginByAUM: [
    { tier: 'Under $250M', margin: 0.18 },
    { tier: '$250M–$500M', margin: 0.24 },
    { tier: '$500M–$1B', margin: 0.29 },
    { tier: '$1B–$3B', margin: 0.33 },
    { tier: 'Over $3B', margin: 0.37 },
  ],
  /** Client-to-staff ratio benchmarks (Schwab Benchmarking 2024) */
  clientStaffRatio: {
    topQuartile: 42,
    median: 68,
    bottomQuartile: 95,
  },
  /** Revenue per client benchmarks */
  revenuePerClient: {
    topQuartile: 12_500,
    median: 7_800,
    bottomQuartile: 4_200,
  },
  /** Overhead allocation benchmarks (% of revenue) */
  overheadPct: {
    compensation: 0.42,
    technology: 0.06,
    occupancy: 0.05,
    marketing: 0.03,
    compliance: 0.02,
    other: 0.07,
    totalOverhead: 0.65,
  },
} as const;

/* ═══ PLANNING HIERARCHY BENCHMARKS ═══ */
export const PLANNING_BENCHMARKS = {
  /** Average planning engagement fees (Kitces Research 2024) */
  engagementFees: {
    comprehensivePlan: { median: 3_500, range: [1_500, 7_500] as [number, number] },
    modularPlan: { median: 1_500, range: [500, 3_000] as [number, number] },
    hourlyRate: { median: 275, range: [150, 450] as [number, number] },
    retainerAnnual: { median: 6_000, range: [2_400, 18_000] as [number, number] },
  },
  /** Planning completion rates */
  completionRates: {
    dataGathering: 0.92,
    goalSetting: 0.88,
    analysisPresentation: 0.78,
    implementationBegin: 0.65,
    implementationComplete: 0.48,
    annualReview: 0.42,
  },
  /** Client satisfaction by planning depth (J.D. Power 2024) */
  satisfactionByDepth: {
    transactional: 680,
    goalsBased: 745,
    comprehensiveFinancial: 812,
    wealthManagement: 848,
  },
} as const;

/* ═══ PROTECTION BENCHMARKS ═══ */
export const PROTECTION_BENCHMARKS = {
  /** Life insurance ownership rates (LIMRA 2024) */
  ownershipRates: {
    anyLifeInsurance: 0.52,
    individualLife: 0.37,
    groupOnly: 0.15,
    adequateCoverage: 0.22,
  },
  /** Average coverage multiples */
  coverageMultiples: {
    recommended: { min: 10, max: 15, source: 'DIME method' },
    actual: { median: 4.2, source: 'LIMRA 2024' },
    gap: 'Most Americans underinsured by 5-10x income',
  },
  /** DI ownership and claim rates */
  disabilityInsurance: {
    ownershipRate: 0.35,
    claimRate5Year: 0.25,
    averageDuration: 34.6, // months
    replacementRatio: 0.60,
  },
  /** LTC planning */
  longTermCare: {
    needRate: 0.70, // % of 65+ who will need some form
    averageCostNursingHome: 108_405, // annual, Genworth 2024
    averageCostHomeCare: 75_504,
    averageCostAssistedLiving: 64_200,
    medianStay: 2.5, // years
  },
} as const;

/* ═══ RETIREMENT BENCHMARKS ═══ */
export const RETIREMENT_BENCHMARKS = {
  /** Retirement readiness (EBRI 2024) */
  readiness: {
    veryConfident: 0.23,
    somewhatConfident: 0.43,
    notConfident: 0.34,
  },
  /** Average retirement savings by age (Federal Reserve SCF 2022) */
  savingsByAge: [
    { ageRange: '25-34', median: 37_211, mean: 120_738 },
    { ageRange: '35-44', median: 91_281, mean: 315_504 },
    { ageRange: '45-54', median: 168_646, mean: 555_320 },
    { ageRange: '55-64', median: 212_500, mean: 690_000 },
    { ageRange: '65-74', median: 200_000, mean: 609_230 },
  ],
  /** Replacement rate targets */
  replacementRates: {
    low: 0.70,
    moderate: 0.80,
    comfortable: 0.90,
    affluent: 0.60, // lower due to lower spending-to-income ratio
  },
  /** Social Security */
  socialSecurity: {
    maxBenefit2025: 4_873, // monthly at age 70
    averageBenefit: 1_907,
    fullRetirementAge: 67,
    earlyReduction: 0.30, // at 62
    delayedCredit: 0.24, // 8% per year from FRA to 70
    colaAvg10yr: 0.032,
  },
} as const;

/* ═══ TAX PLANNING BENCHMARKS ═══ */
export const TAX_BENCHMARKS = {
  /** Average effective tax rates by income (IRS SOI 2023) */
  effectiveRates: [
    { income: '$50K-$75K', effectiveRate: 0.068 },
    { income: '$75K-$100K', effectiveRate: 0.082 },
    { income: '$100K-$200K', effectiveRate: 0.103 },
    { income: '$200K-$500K', effectiveRate: 0.156 },
    { income: '$500K-$1M', effectiveRate: 0.221 },
    { income: 'Over $1M', effectiveRate: 0.268 },
  ],
  /** Common tax-saving strategies and typical savings */
  strategies: [
    { name: 'Max 401(k) + catch-up', typicalSaving: 7_050, applicability: 'W-2 earners over 50' },
    { name: 'Backdoor Roth IRA', typicalSaving: 1_680, applicability: 'High earners above Roth limits' },
    { name: 'HSA triple tax benefit', typicalSaving: 2_490, applicability: 'HDHP enrollees' },
    { name: 'QBI deduction (§199A)', typicalSaving: 8_000, applicability: 'Pass-through business owners' },
    { name: 'Charitable bunching', typicalSaving: 3_500, applicability: 'Itemizers near standard deduction' },
    { name: 'Tax-loss harvesting', typicalSaving: 3_000, applicability: 'Taxable investment accounts' },
    { name: 'Roth conversion ladder', typicalSaving: 15_000, applicability: 'Early retirees in low-income years' },
    { name: 'SALT workaround (PTE)', typicalSaving: 5_000, applicability: 'S-corp/partnership owners in high-tax states' },
  ],
} as const;

/* ═══ ESTATE PLANNING BENCHMARKS ═══ */
export const ESTATE_BENCHMARKS = {
  /** Estate planning completion rates (WealthCounsel 2024) */
  completionRates: {
    hasWill: 0.34,
    hasTrust: 0.18,
    hasPOA: 0.26,
    hasHealthcareDirective: 0.28,
    hasCompletePlan: 0.12,
  },
  /** Federal estate tax */
  federalEstateTax: {
    exemption2025: 13_990_000,
    sunsetExemption2026: 7_000_000, // approximate after TCJA sunset
    rate: 0.40,
    portability: true,
    coupleExemption2025: 27_980_000,
  },
  /** Trust types and use cases */
  trustTypes: [
    { type: 'Revocable Living Trust', purpose: 'Probate avoidance, privacy', costRange: [1_500, 5_000] as [number, number] },
    { type: 'Irrevocable Life Insurance Trust (ILIT)', purpose: 'Remove life insurance from estate', costRange: [2_500, 7_500] as [number, number] },
    { type: 'Grantor Retained Annuity Trust (GRAT)', purpose: 'Transfer appreciation tax-free', costRange: [5_000, 15_000] as [number, number] },
    { type: 'Qualified Personal Residence Trust (QPRT)', purpose: 'Transfer home at reduced gift value', costRange: [3_000, 8_000] as [number, number] },
    { type: 'Charitable Remainder Trust (CRT)', purpose: 'Income stream + charitable deduction', costRange: [5_000, 15_000] as [number, number] },
    { type: 'Dynasty Trust', purpose: 'Multi-generational wealth transfer', costRange: [10_000, 30_000] as [number, number] },
  ],
} as const;

/* ═══ GROWTH / INVESTMENT BENCHMARKS ═══ */
export const GROWTH_BENCHMARKS = {
  /** Long-term asset class returns (Morningstar/Ibbotson 2024) */
  assetClassReturns: {
    largeCap: { nominal: 0.102, real: 0.069 },
    smallCap: { nominal: 0.117, real: 0.084 },
    intlDeveloped: { nominal: 0.081, real: 0.048 },
    emergingMarkets: { nominal: 0.093, real: 0.060 },
    bonds: { nominal: 0.052, real: 0.019 },
    tips: { nominal: 0.038, real: 0.005 },
    reits: { nominal: 0.095, real: 0.062 },
    commodities: { nominal: 0.035, real: 0.002 },
  },
  /** IUL cap rates and participation (industry average 2024-2025) */
  iulBenchmarks: {
    avgCap: 0.105,
    avgParticipation: 0.95,
    avgFloor: 0.00,
    historicalCredited: 0.065,
    avgCOI: 0.008,
  },
  /** FIA benchmarks */
  fiaBenchmarks: {
    avgCap: 0.065,
    avgParticipation: 0.80,
    avgSpread: 0.015,
    historicalCredited: 0.042,
    avgRiderFee: 0.01,
  },
} as const;

/* ═══ EDUCATION PLANNING BENCHMARKS ═══ */
export const EDUCATION_BENCHMARKS = {
  /** Average annual costs (College Board 2024-2025) */
  annualCosts: {
    publicInState: 11_260,
    publicOutOfState: 29_150,
    privateNonprofit: 43_350,
    communityCollege: 3_990,
  },
  /** Cost inflation rate */
  costInflation: 0.05, // 5% annual college cost inflation
  /** 529 plan statistics */
  plan529: {
    averageBalance: 30_287,
    medianBalance: 12_350,
    maxContributionSupergifting: 90_000, // 5-year election
    stateTaxDeductionAvg: 5_000,
  },
} as const;

/* ═══ MACRO ECONOMIC INDICATORS (defaults, updated via Financial Data Hub) ═══ */
export const MACRO_DEFAULTS = {
  fedFundsRate: 4.50,
  inflation: 2.8,
  gdpGrowth: 2.1,
  unemployment: 3.9,
  sp500PE: 21.5,
  tenYearYield: 4.25,
  mortgageRate30yr: 6.75,
  primeRate: 7.50,
  source: 'Federal Reserve, BLS, BEA — Q1 2026 defaults',
  note: 'Live data available via Financial Data Hub when FRED/BLS/BEA API keys are configured',
} as const;

/* ═══ ADVISOR CHANNEL BENCHMARKS ═══ */
export const CHANNEL_BENCHMARKS = {
  wirehouse: {
    label: 'Wirehouse',
    avgAUM: 180_000_000,
    avgClients: 120,
    payoutRange: [0.35, 0.50] as [number, number],
    techStack: 'Proprietary + limited third-party',
    complianceModel: 'Centralized',
    typicalProducts: ['Managed accounts', 'Proprietary funds', 'Structured products', 'Insurance'],
  },
  ria: {
    label: 'RIA',
    avgAUM: 350_000_000,
    avgClients: 85,
    payoutRange: [0.85, 1.00] as [number, number],
    techStack: 'Best-of-breed custodian + third-party',
    complianceModel: 'Self-regulated (SEC/State)',
    typicalProducts: ['ETFs', 'Mutual funds', 'Direct indexing', 'Alternatives'],
  },
  independentBD: {
    label: 'Independent B/D',
    avgAUM: 95_000_000,
    avgClients: 150,
    payoutRange: [0.80, 0.95] as [number, number],
    techStack: 'B/D platform + add-ons',
    complianceModel: 'B/D supervised',
    typicalProducts: ['Variable annuities', 'Mutual funds', 'Insurance', 'REITs'],
  },
  insurance: {
    label: 'Insurance-focused',
    avgAUM: 25_000_000,
    avgClients: 200,
    payoutRange: [0.60, 0.90] as [number, number],
    techStack: 'Carrier platforms + CRM',
    complianceModel: 'State insurance dept + FINRA',
    typicalProducts: ['Life insurance', 'Annuities', 'DI', 'LTC', 'Group benefits'],
  },
  hybrid: {
    label: 'Hybrid RIA/B-D',
    avgAUM: 200_000_000,
    avgClients: 100,
    payoutRange: [0.80, 0.95] as [number, number],
    techStack: 'Dual-registered platform',
    complianceModel: 'SEC + FINRA dual',
    typicalProducts: ['Full product shelf', 'Fee-based + commission'],
  },
  bankTrust: {
    label: 'Bank Trust',
    avgAUM: 500_000_000,
    avgClients: 300,
    payoutRange: [0.25, 0.40] as [number, number],
    techStack: 'Bank core + trust accounting',
    complianceModel: 'OCC/FDIC regulated',
    typicalProducts: ['Trust services', 'CDs', 'Managed portfolios', 'Lending'],
  },
} as const;

/* ═══ COMPLIANCE BENCHMARKS ═══ */
export const COMPLIANCE_BENCHMARKS = {
  /** Common regulatory examination findings (FINRA 2024 Report) */
  topFindings: [
    'Inadequate supervisory procedures',
    'Failure to maintain accurate books and records',
    'Unsuitable investment recommendations',
    'Failure to disclose conflicts of interest',
    'Inadequate AML/KYC procedures',
    'Misleading communications with public',
    'Failure to report customer complaints',
    'Inadequate cybersecurity controls',
  ],
  /** Average compliance costs */
  complianceCosts: {
    perAdvisor: 35_000,
    asPercentOfRevenue: 0.04,
    ccoSalaryMedian: 165_000,
  },
  /** Key regulatory thresholds */
  thresholds: {
    secRegistrationAUM: 100_000_000,
    accreditedInvestorIncome: 200_000,
    accreditedInvestorNetWorth: 1_000_000,
    qualifiedPurchaser: 5_000_000,
    qualifiedClient: 1_210_000,
  },
} as const;

/** Get a benchmark value with optional override */
export function getBenchmark<T>(category: Record<string, T>, key: string, override?: T): T {
  return override ?? category[key];
}

/** Format benchmark comparison as percentage of benchmark */
export function benchmarkComparison(actual: number, benchmark: number): {
  ratio: number;
  label: string;
  status: 'above' | 'at' | 'below';
} {
  const ratio = benchmark > 0 ? actual / benchmark : 0;
  return {
    ratio,
    label: ratio >= 1.1 ? 'Above benchmark' : ratio >= 0.9 ? 'At benchmark' : 'Below benchmark',
    status: ratio >= 1.1 ? 'above' : ratio >= 0.9 ? 'at' : 'below',
  };
}
