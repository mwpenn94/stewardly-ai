/**
 * WealthBridge Engine Types — Shared type definitions for UWE, BIE, HE, SCUI
 * Faithfully extracted from v7 HTML calculator reference implementations.
 */

// ─── PRODUCT MODELS ─────────────────────────────────────────────────────────

export type ProductType =
  | "term" | "iul" | "wl" | "di" | "ltc" | "fia"
  | "aum" | "401k" | "roth" | "529" | "estate"
  | "premfin" | "splitdollar" | "deferredcomp";

export interface ProductResult {
  cashValue: number;
  deathBenefit: number;
  taxSaving: number;
  livingBenefit: number;
  legacyValue: number;
  annualCost: number;
  label: string;
  carrier: string;
  expectedValue?: number;
  details?: Record<string, any>;
}

export interface ProductConfig {
  type: ProductType;
  face?: number;
  termYears?: number;
  annualPremium?: number;
  fundingYears?: number;
  livingBenPct?: number;
  payYears?: number;
  dividendRate?: number;
  annualBenefit?: number;
  toAge?: number;
  benefitPool?: number;
  inflationRate?: number;
  deposit?: number;
  avgReturn?: number;
  riderFee?: number;
  rollUpRate?: number;
  withdrawalRate?: number;
  initialAUM?: number;
  annualAdd?: number;
  feeRate?: number;
  grossReturn?: number;
  advisoryAlpha?: number;
  taxDrag?: number;
  initialBalance?: number;
  annualContrib?: number;
  employerMatch?: number;
  isRoth?: boolean;
  netWorth?: number;
  growthRate?: number;
  setupCost?: number;
  annualReview?: number;
  exemption?: number;
  cashOutlay?: number;
  loanRate?: number;
  creditingRate?: number;
  employerShare?: number;
  carrier?: string;
  marginalRate?: number;
  startAge?: number;
  // Internal mutable state (used during simulation)
  _prevCashValue?: number;
  _prevValue?: number;
  _incomeBase?: number;
  _cumExpected?: number;
}

// ─── CLIENT PROFILE ─────────────────────────────────────────────────────────

export interface ClientProfile {
  age?: number;
  income?: number;
  netWorth?: number;
  savings?: number;
  monthlySavings?: number;
  dependents?: number;
  mortgage?: number;
  debts?: number;
  existingInsurance?: number;
  equitiesReturn?: number;
  marginalRate?: number;
  isBizOwner?: boolean;
}

// ─── COMPANY PROFILES ───────────────────────────────────────────────────────

export type CompanyKey =
  | "wealthbridge" | "captivemutual" | "wirehouse" | "ria"
  | "communitybd" | "diy" | "donothing" | "bestoverall";

export interface CompanyFeatures {
  holistic: boolean;
  taxFree: boolean;
  livingBen: boolean;
  advisor: boolean;
  estate: boolean;
  group: boolean;
  fiduciary: boolean;
  lowFees: boolean;
  insurance: boolean;
  premFinance?: boolean;
  advancedPlanning?: boolean;
}

export interface StrategyInfo {
  whyChoose: string;
  included: string;
  omitted: string;
  idealFor: string;
  sources: string;
}

export interface CompanyProfile {
  name: string;
  desc: string;
  color: string;
  aumFee: number;
  advisoryAlpha: number;
  taxDrag: number;
  products: ProductType[];
  features: CompanyFeatures;
  notes: string;
  strategyInfo: StrategyInfo;
}

// ─── UWE TYPES ──────────────────────────────────────────────────────────────

export interface StrategyConfig {
  company: CompanyKey;
  companyName: string;
  color: string;
  profile: ClientProfile;
  products: ProductConfig[];
  features: CompanyFeatures;
  notes: string;
}

export interface YearlySnapshot {
  year: number;
  age: number;
  productCashValue: number;
  productDeathBenefit: number;
  productTaxSaving: number;
  productLivingBenefit: number;
  productLegacyValue: number;
  productAnnualCost: number;
  productExpectedValue: number;
  savingsBalance: number;
  totalWealth: number;
  totalProtection: number;
  totalAnnualCost: number;
  cumulativeCost: number;
  cumulativeTaxSaving: number;
  totalValue: number;
  netValue: number;
  roi: number;
  productDetails: ProductResult[];
}

export interface MonteCarloPercentile {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean?: number;
  min?: number;
  max?: number;
  successRate?: number;
}

// ─── BIE TYPES ──────────────────────────────────────────────────────────────

export type RoleKey = "new" | "exp" | "sa" | "dir" | "md" | "rvp" | "affA" | "affB" | "affC" | "affD" | "partner";

export interface RoleProfile {
  name: string;
  short: string;
  level: number;
  manages: string[];
  reports: string[];
  canProduce: boolean;
  baseGDC: number;
  rampMonths: number;
  rampPct: number;
  growthRate: number;
}

export interface GDCBracket {
  min: number;
  max: number;
  rate: number;
  label: string;
}

export interface ChannelProfile {
  name: string;
  cpl: number;
  cv: number;
  revPerClient: number;
  ltv: number;
  attr: number;
  growthRate: number;
}

export type SeasonalityKey = "flat" | "q4Heavy" | "summer" | "eventDriven" | "ramp" | "custom";

export interface TeamMember {
  name: string;
  role: RoleKey;
  fyc: number;
  f?: number; // alias for fyc
}

export interface AffiliateA { low: number; med: number; high: number; }
export interface AffiliateB { referrals: number; avgGDC: number; commRate: number; }
export interface AffiliateC { cases: number; avgGDC: number; splitRate: number; }
export interface AffiliateD { subAgents: number; avgGDC: number; overrideRate: number; }

export interface Campaign {
  start: number; // month 1-12
  end: number;
  boost: number; // percentage
}

export interface BIEStreamConfig {
  personal?: boolean;
  expanded?: boolean;
  override?: boolean;
  overrideG2?: boolean;
  aum?: boolean;
  affA?: boolean;
  affB?: boolean;
  affC?: boolean;
  affD?: boolean;
  channels?: boolean;
  partner?: boolean;
  renewal?: boolean;
  bonus?: boolean;
}

export interface BIEStrategy {
  name: string;
  role: RoleKey;
  streams: BIEStreamConfig;
  team: TeamMember[];
  channelSpend: Record<string, number>;
  seasonality: SeasonalityKey;
  customSeason?: number[] | null;
  personalGrowth?: number | null;
  teamGrowth?: number;
  aumGrowth?: number;
  channelGrowth?: number;
  hiringRate?: number;
  retentionRate?: number;
  affA?: AffiliateA;
  affB?: AffiliateB;
  affC?: AffiliateC;
  affD?: AffiliateD;
  partnerIncome?: number;
  partnerGrowth?: number;
  existingAUM?: number;
  newAUMAnnual?: number;
  aumFeeRate?: number;
  personalGDC?: number | null;
  wbPct?: number;
  bracketOverride?: number | null;
  overrideRate?: number;
  overrideBonusRate?: number;
  gen2Rate?: number;
  renewalRate?: number;
  renewalStartYear?: number;
  bonusPct?: number;
  campaigns?: Campaign[];
  notes?: string;
}

export interface BIEStreamResult {
  income: number;
  label: string;
  gdc?: number;
  bracket?: number;
  teamFYC?: number;
  teamSize?: number;
  rate?: number;
  gen2FYC?: number;
  aum?: number;
  feeRate?: number;
  intros?: number;
  cost?: number;
  net?: number;
  cumulativePlaced?: number;
  pct?: number;
}

export interface BIEMonthlyDetail {
  month: number;
  multiplier: number;
  personalGDC: number;
  totalIncome: number;
}

export interface BIEYearResult {
  year: number;
  streams: Record<string, BIEStreamResult>;
  totalIncome: number;
  totalCost: number;
  netIncome: number;
  cumulativeIncome: number;
  cumulativeCost: number;
  cumulativeNet: number;
  cumulativePlaced?: number;
  teamSize: number;
  aum: number;
  monthly: BIEMonthlyDetail[];
}

export interface BackPlanResult {
  neededGDC: number;
  bracketRate: number;
  bracketLabel: string;
  funnel: {
    approaches: number;
    set: number;
    held: number;
    apps: number;
    placed: number;
    avgCase: number;
    daily: { approaches: number };
    weekly: { approaches: number };
    monthly: { approaches: number; apps: number; gdc: number };
    annual: { approaches: number; apps: number; gdc: number };
  };
  teamNeeded?: number;
  overrideTarget?: number;
  personalTarget?: number;
}

export interface RollUpResult {
  totalGDC: number;
  totalIncome: number;
  totalOverride: number;
  totalAUM: number;
  totalChannelRev: number;
  totalCost: number;
  teamSize: number;
  avgGDC: number;
  avgIncome: number;
  byRole: Record<string, { count: number; income: number; gdc: number }>;
  byStream: Record<string, number>;
}

export interface EconomicsResult {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  marketingCost: number;
  netProfit: number;
  netMarginPct: number;
  roi: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  yr1Income: number;
  yr5Income: number;
  totalYears: number;
  clientsAcquired: number;
}

export type FrequencyKey = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual";

// ─── HE TYPES ───────────────────────────────────────────────────────────────

export interface HolisticStrategyConfig {
  name: string;
  color: string;
  bizStrategy?: BIEStrategy | null;
  hasBizIncome: boolean;
  profile: ClientProfile;
  wealthStrategy?: StrategyConfig | null;
  companyKey: CompanyKey;
  customProducts?: ProductConfig[] | null;
  savingsRate: number;
  investmentReturn: number;
  inflationRate: number;
  taxRate: number;
  reinvestTaxSavings: boolean;
  notes?: string;
}

export interface HolisticSnapshot {
  year: number;
  age: number;
  bizIncome: number;
  bizCost: number;
  bizNetIncome: number;
  bizStreams: Record<string, BIEStreamResult>;
  bizTeamSize: number;
  bizAUM: number;
  personalIncome: number;
  totalGrossIncome: number;
  totalTaxes: number;
  totalNetIncome: number;
  annualSavingsContrib: number;
  savingsBalance: number;
  productCashValue: number;
  productDeathBenefit: number;
  productTaxSaving: number;
  productLivingBenefit: number;
  productLegacyValue: number;
  productAnnualCost: number;
  productExpectedValue: number;
  productDetails: ProductResult[];
  totalLiquidWealth: number;
  totalProtection: number;
  totalTaxSavings: number;
  totalValue: number;
  totalCost: number;
  netValue: number;
  roi: number;
  cumulativeBizIncome: number;
  cumulativePersonalIncome: number;
  cumulativeTotalIncome: number;
  cumulativeTotalCost: number;
  cumulativeNetValue: number;
  // Exposed stream breakdowns
  affiliateIncomeA?: number;
  affiliateIncomeB?: number;
  affiliateIncomeC?: number;
  affiliateIncomeD?: number;
  affiliateTotalIncome?: number;
  partnerIncome?: number;
  overrideIncome?: number;
  channelIncome?: number;
  renewalIncome?: number;
  personalProdIncome?: number;
}

export interface ComparisonRow {
  index: number;
  name: string;
  color: string;
  bizIncome: number;
  bizCumIncome: number;
  bizTeamSize: number;
  bizAUM: number;
  personalProdIncome: number;
  overrideIncome: number;
  affiliateIncomeA: number;
  affiliateIncomeB: number;
  affiliateIncomeC: number;
  affiliateIncomeD: number;
  affiliateTotalIncome: number;
  partnerIncome: number;
  channelIncome: number;
  renewalIncome: number;
  personalIncome: number;
  totalGrossIncome: number;
  totalNetIncome: number;
  savingsBalance: number;
  productCashValue: number;
  totalLiquidWealth: number;
  productDeathBenefit: number;
  productLivingBenefit: number;
  totalProtection: number;
  totalTaxSavings: number;
  totalValue: number;
  totalCost: number;
  netValue: number;
  roi: number;
}

// ─── SCUI TYPES ─────────────────────────────────────────────────────────────

export interface StressScenario {
  name: string;
  years: number[];
  returns: number[];
  description: string;
}

export interface BacktestResult {
  startYear: number;
  finalBalance: number;
  minBalance: number;
  path: number[];
}

export interface BacktestSummary {
  survivalRate: number;
  survived: number;
  total: number;
  worst: { year: number; final: number; min: number };
  best: { year: number; final: number };
  medianFinal: number;
  allPaths: BacktestResult[];
}

export interface ProductReference {
  src: string;
  url: string;
  benchmark: string;
}

export interface IndustryBenchmark {
  [key: string]: number | string;
  source: string;
  url: string;
}

export interface MethodologyDisclosure {
  uwe: string;
  bie: string;
  he: string;
  mc: string;
  pf: string;
  disclaimer: string;
}

// ─── RATE TABLES ────────────────────────────────────────────────────────────

export interface RatePoint {
  age: number;
  rate: number;
}

export interface RateTables {
  termPer100K: RatePoint[];
  iulPer100K: RatePoint[];
  wlPer100K: RatePoint[];
  diPctBenefit: RatePoint[];
  ltcAnnual: RatePoint[];
  aumFee: (aum: number) => number;
  fiaRiderFee: number;
  groupPerEmp: number;
}
