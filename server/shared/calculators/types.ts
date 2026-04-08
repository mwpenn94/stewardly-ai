/**
 * Shared types for the WealthBridge financial calculator engines.
 *
 * Ported verbatim from the v7 HTML reference (UWE/BIE/HE IIFEs) and
 * promoted to first-class TypeScript interfaces. The runtime semantics
 * intentionally match the original JS so that downstream callers and
 * convergence tests stay green during the recursive optimization passes.
 */

// ─── ClientProfile (consumer financial snapshot) ───
export interface ClientProfile {
  age?: number;
  income?: number;
  netWorth?: number;
  savings?: number;
  monthlySavings?: number;
  dependents?: number;
  mortgage?: number;
  debts?: number;
  marginalRate?: number;
  equitiesReturn?: number;
  existingInsurance?: number;
  isBizOwner?: boolean;
  // Allow ad-hoc properties without losing type safety on known fields
  [key: string]: unknown;
}

// ─── Product configuration (UWE input) ───
export type ProductType =
  | "term"
  | "iul"
  | "wl"
  | "di"
  | "ltc"
  | "fia"
  | "aum"
  | "401k"
  | "roth"
  | "529"
  | "estate"
  | "premfin"
  | "splitdollar"
  | "deferredcomp";

export interface ProductConfig {
  type: ProductType;
  // life products
  face?: number;
  termYears?: number;
  fundingYears?: number;
  payYears?: number;
  livingBenPct?: number;
  dividendRate?: number;
  // disability
  annualBenefit?: number;
  toAge?: number;
  // ltc
  benefitPool?: number;
  inflationRate?: number;
  // fia
  deposit?: number;
  avgReturn?: number;
  riderFee?: number;
  rollUpRate?: number;
  withdrawalRate?: number;
  // aum
  initialAUM?: number;
  annualAdd?: number;
  feeRate?: number;
  grossReturn?: number;
  advisoryAlpha?: number;
  taxDrag?: number;
  // 401k / roth
  initialBalance?: number;
  annualContrib?: number;
  employerMatch?: number;
  isRoth?: boolean;
  // estate
  netWorth?: number;
  growthRate?: number;
  exemption?: number;
  setupCost?: number;
  annualReview?: number;
  // premfin
  loanRate?: number;
  creditingRate?: number;
  cashOutlay?: number;
  // splitdollar
  employerShare?: number;
  // shared
  annualPremium?: number;
  carrier?: string;
  marginalRate?: number;
  startAge?: number;
  // internal carry-state used by the year-by-year simulation
  _prevCashValue?: number;
  _prevValue?: number;
  _incomeBase?: number;
  _cumExpected?: number;
  [key: string]: unknown;
}

export interface ProductYearResult {
  cashValue: number;
  deathBenefit: number;
  taxSaving: number;
  livingBenefit: number;
  legacyValue: number;
  annualCost: number;
  expectedValue?: number;
  label: string;
  carrier: string;
  details?: Record<string, unknown>;
}

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

export interface CompanyStrategyInfo {
  whyChoose: string;
  included: string;
  omitted: string;
  idealFor: string;
  sources: string;
}

export interface CompanyDefinition {
  name: string;
  desc: string;
  color: string;
  aumFee: number;
  advisoryAlpha: number;
  taxDrag: number;
  products: ProductType[];
  features: CompanyFeatures;
  notes: string;
  strategyInfo?: CompanyStrategyInfo;
}

export interface UWEStrategy {
  company: string;
  companyName: string;
  color: string;
  profile: ClientProfile;
  products: ProductConfig[];
  features: CompanyFeatures;
  notes: string;
}

export interface ProductDetailRow {
  type: ProductType;
  label: string;
  carrier: string;
  cashValue: number;
  deathBenefit: number;
  taxSaving: number;
  livingBenefit: number;
  legacyValue: number;
  annualCost: number;
}

export interface SimulationSnapshot {
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
  productDetails: ProductDetailRow[];
  cumulativeTaxSaving: number;
  totalValue: number;
  netValue: number;
  roi: number;
}

// ─── Monte Carlo ───
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

// ─── BIE (Business Income Engine) ───
export type BIERoleKey =
  | "new"
  | "exp"
  | "sa"
  | "dir"
  | "md"
  | "rvp"
  | "affA"
  | "affB"
  | "affC"
  | "affD"
  | "partner";

export interface BIERole {
  name: string;
  short: string;
  level: number;
  manages: BIERoleKey[];
  reports: BIERoleKey[];
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

export interface ChannelDefinition {
  name: string;
  cpl: number;
  cv: number;
  revPerClient: number;
  ltv: number;
  attr: number;
  growthRate: number;
}

export type SeasonProfileKey =
  | "flat"
  | "q4Heavy"
  | "summer"
  | "eventDriven"
  | "ramp"
  | "custom";

export type SeasonProfile = number[]; // 12 multipliers

export interface StreamTypeMeta {
  label: string;
  category: string;
  requiresProduction: boolean;
}

export interface BIETeamMember {
  name: string;
  role: BIERoleKey;
  fyc?: number;
  // Some legacy presets use `f` as a shorthand for FYC
  f?: number;
}

export interface AffAConfig {
  low?: number;
  med?: number;
  high?: number;
}

export interface AffBConfig {
  referrals?: number;
  avgGDC?: number;
  commRate?: number;
}

export interface AffCConfig {
  cases?: number;
  avgGDC?: number;
  splitRate?: number;
}

export interface AffDConfig {
  subAgents?: number;
  avgGDC?: number;
  overrideRate?: number;
}

export interface BIECampaign {
  start: number; // 1-12
  end: number;
  boost?: number; // percent
}

export interface BIEStrategy {
  name: string;
  role: BIERoleKey;
  streams: Partial<Record<string, boolean>>;
  team: BIETeamMember[];
  channelSpend: Record<string, number>;
  seasonality: SeasonProfileKey;
  customSeason: number[] | null;
  personalGrowth: number | null;
  teamGrowth: number;
  aumGrowth: number;
  channelGrowth: number;
  hiringRate: number;
  retentionRate: number;
  affA: AffAConfig;
  affB: AffBConfig;
  affC: AffCConfig;
  affD: AffDConfig;
  partnerIncome: number;
  partnerGrowth: number;
  existingAUM: number;
  newAUMAnnual: number;
  aumFeeRate: number;
  personalGDC: number | null;
  wbPct: number;
  bracketOverride: number | null;
  overrideRate: number;
  overrideBonusRate: number;
  gen2Rate: number;
  renewalRate: number;
  renewalStartYear: number;
  bonusPct: number;
  campaigns: BIECampaign[];
  notes: string;
}

export interface BIEStreamResult {
  income?: number;
  gdc?: number;
  bracket?: number;
  cost?: number;
  net?: number;
  teamFYC?: number;
  teamSize?: number;
  rate?: number;
  gen2FYC?: number;
  aum?: number;
  feeRate?: number;
  intros?: number;
  cumulativePlaced?: number;
  pct?: number;
  label?: string;
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
  teamSize: number;
  aum: number;
  monthly: BIEMonthlyDetail[];
  cumulativePlaced?: number;
}

export interface BIEBackPlanResult {
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

// ─── HE (Holistic Engine) ───
export interface HolisticStrategy {
  name: string;
  color: string;
  bizStrategy: BIEStrategy | null;
  hasBizIncome: boolean;
  profile: ClientProfile;
  wealthStrategy: UWEStrategy | null;
  companyKey: string;
  customProducts: ProductConfig[] | null;
  savingsRate: number;
  investmentReturn: number;
  inflationRate: number;
  taxRate: number;
  reinvestTaxSavings: boolean;
  notes: string;
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
  productDetails: ProductDetailRow[];
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

export interface WinnerEntry {
  name: string;
  color: string;
  value: number;
}

export type WinnersMap = Record<string, WinnerEntry>;

export interface MilestoneRow {
  year: number;
  strategies: Array<{
    name: string;
    color: string;
    totalValue: number;
    totalLiquidWealth: number;
    netValue: number;
    bizIncome: number;
    totalGrossIncome: number;
    roi: number;
  }>;
}

export interface ChartSeriesResult {
  series: Array<{ n: string; c: string; pts: number[] }>;
  labels: string[];
  years: number[];
}

// ─── Benchmarks / Guardrails ───
export interface ProductReference {
  src: string;
  url: string;
  benchmark: string;
}

export interface IndustryBenchmark {
  source: string;
  url: string;
  // Different benchmarks expose different headline numbers
  national?: number;
  gap?: number;
  pct?: number;
  value?: number;
  sp500?: number;
  bonds?: number;
  balanced?: number;
}

export interface GuardrailRule {
  min: number;
  max: number;
  default: number;
  label: string;
  warn: string;
}

export interface GuardrailCheck {
  type: "error" | "warn";
  msg: string;
}


// ─── SCUI types (stress testing, backtesting, methodology) ───

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

export interface MethodologyDisclosure {
  uwe: string;
  bie: string;
  he: string;
  mc: string;
  pf: string;
  disclaimer: string;
}

export interface GuardrailWarning {
  field: string;
  value: number;
  threshold: number;
  message: string;
  severity: "info" | "warning" | "error";
}
