/* ═══════════════════════════════════════════════════════════════
   WealthEngineContext — Cascade Data Propagation Layer
   Provides computed engine results to all Wealth Engine panels
   so they can react to changes in any upstream panel.

   Pass 139: Enhanced with:
   - General defaults for planning (industry-standard assumptions)
   - Advanced strategies cascade data
   - Holistic cascade bridge (ClientWealthHub ↔ AdvancedStrategiesHub)
   ═══════════════════════════════════════════════════════════════ */
import { createContext, useContext, type ReactNode } from 'react';

/* ─── Types for cascade data ─── */
export interface ScorecardDomain {
  name: string;
  score: number;
}

export interface Scorecard {
  overall: number;
  maxScore: number;
  pctScore: number;
  domains: ScorecardDomain[];
}

export interface Recommendation {
  product: string;
  coverage: string;
  premium: number;
  carrier: string;
  priority: string;
  category?: string;
}

export interface CashFlowResult {
  grossMonthly: number;
  totalExpenses: number;
  netCashFlow: number;
  savingsRate: number;
  emergencyMonths: number;
  emergencyTarget: number;
  emergencyGap: number;
}

export interface ProtectionResult {
  totalNeed: number;
  gap: number;
  diNeed: number;
  diPremium: number;
  ltcNeed: number;
  ltcPremium: number;
}

export interface GrowthResult {
  taxableProjected: number;
  iulProjected: number;
  fiaProjected: number;
  totalProjected: number;
  monthlyNeeded: number;
  onTrack: boolean;
}

export interface RetirementResult {
  projectedNest: number;
  monthlyIncome: number;
  ssOptimal: string;
  gap: number;
  replacementRate: number;
}

export interface TaxResult {
  effectiveRate: number;
  totalTax: number;
  marginalRate: number;
  strategies: { name: string; saving: number }[];
  totalSavings: number;
}

export interface EstateResult {
  taxableEstate: number;
  estateTax: number;
  effectiveRate: number;
  giftingImpact: number;
  trustBenefit: number;
}

export interface EducationResult {
  totalCost: number;
  projected529: number;
  gap: number;
  monthlyNeeded: number;
}

export interface HorizonDataPoint {
  year: number;
  label: string;
  products: { product: string; premium: number; benefit: number }[];
  totalPremium: number;
  totalBenefit: number;
}

export interface PracticeIncomeResult {
  annualGDC: number;
  annualAUM: number;
  annualOverride: number;
  annualExpanded: number;
  annualChannelRev: number;
  grandTotal: number;
  streamCount: number;
  items: { label: string; amount: number }[];
  pnlNetIncome: number;
  pnlEbitda: number;
  pnlRevenue: number;
  monthlyGDC: number;
  monthlyNet: number;
}

/* ─── Client Profile (inputs that cascade everywhere) ─── */
export interface ClientProfile {
  clientName: string;
  age: number;
  spouseAge: number;
  dep: number;
  income: number;
  spouseIncome: number;
  totalIncome: number;
  nw: number;
  savings: number;
  retirement401k: number;
  mortgage: number;
  debt: number;
  existIns: number;
  filing: string;
  stateRate: number;
  riskTolerance: string;
  isBiz: boolean;
  bizRevenue: number;
  bizEmployees: number;
  bizEntityType: string;
}

/* ═══ GENERAL PLANNING DEFAULTS ═══
   Industry-standard assumptions used across all planning domains.
   These serve as reasonable starting points for any client scenario
   and can be overridden by specific panel inputs.
   Sources: Trinity Study, Morningstar, IRS, BLS, AALU, LIMRA
   ═══════════════════════════════════════════════════════════════ */
export interface GeneralPlanningDefaults {
  // Growth & Investment
  equityReturn: number;          // 7% nominal long-term S&P 500 avg
  bondReturn: number;            // 4% nominal long-term bond avg
  blendedReturn: number;         // 6% moderate portfolio
  iulCreditingRate: number;      // 6.5% indexed universal life avg
  fiaCreditingRate: number;      // 4.5% fixed indexed annuity avg
  inflationRate: number;         // 3% long-term CPI avg

  // Retirement
  safeWithdrawalRate: number;    // 4% Trinity Study
  ssColaRate: number;            // 2.5% Social Security COLA avg
  retirementReplaceRate: number; // 80% income replacement target
  medicareStartAge: number;      // 65

  // Tax
  topFederalRate: number;        // 37% (2024)
  ltcgRate: number;              // 20% top LTCG rate
  niitRate: number;              // 3.8% Net Investment Income Tax
  estateExemption: number;       // $13,610,000 (2024)
  annualGiftExclusion: number;   // $18,000 (2024)
  estateTaxRate: number;         // 40%

  // Protection
  incomeMultiplierLife: number;  // 10x income for life insurance
  diReplacementPct: number;      // 60% income for disability
  ltcDailyBenefit: number;       // $300/day LTC benefit
  emergencyMonths: number;       // 6 months expenses

  // Education
  collegeCostAnnual: number;     // $35,000 avg annual (2024)
  collegeCostGrowth: number;     // 5% annual tuition inflation
  plan529Return: number;         // 6% avg 529 return

  // Business
  keyPersonMultiplier: number;   // 5x salary
  buySellDiscount: number;       // 15% minority discount
  groupBenefitPerEmp: number;    // $8,400/yr per employee

  // Premium Finance
  pfLoanRateDefault: number;     // 5% SOFR + spread
  pfCreditRateDefault: number;   // 6.5% IUL crediting
  pfLeverageTarget: number;      // 10x leverage target

  // Charitable
  crtPayoutMin: number;          // 5% minimum CRT payout
  crtPayoutMax: number;          // 50% maximum CRT payout
  dafDeductionRate: number;      // 37% top rate deduction
}

export const GENERAL_DEFAULTS: GeneralPlanningDefaults = {
  // Growth & Investment
  equityReturn: 7,
  bondReturn: 4,
  blendedReturn: 6,
  iulCreditingRate: 6.5,
  fiaCreditingRate: 4.5,
  inflationRate: 3,

  // Retirement
  safeWithdrawalRate: 4,
  ssColaRate: 2.5,
  retirementReplaceRate: 80,
  medicareStartAge: 65,

  // Tax
  topFederalRate: 37,
  ltcgRate: 20,
  niitRate: 3.8,
  estateExemption: 13610000,
  annualGiftExclusion: 18000,
  estateTaxRate: 40,

  // Protection
  incomeMultiplierLife: 10,
  diReplacementPct: 60,
  ltcDailyBenefit: 300,
  emergencyMonths: 6,

  // Education
  collegeCostAnnual: 35000,
  collegeCostGrowth: 5,
  plan529Return: 6,

  // Business
  keyPersonMultiplier: 5,
  buySellDiscount: 15,
  groupBenefitPerEmp: 8400,

  // Premium Finance
  pfLoanRateDefault: 5,
  pfCreditRateDefault: 6.5,
  pfLeverageTarget: 10,

  // Charitable
  crtPayoutMin: 5,
  crtPayoutMax: 50,
  dafDeductionRate: 37,
};

/* ═══ PRACTICE MANAGEMENT CASCADE (optional third hub dimension) ═══
   Opt-in: when practice management data is available, it feeds into
   the holistic bridge as a third scoring dimension.
   ═══════════════════════════════════════════════════════════════ */
export interface PracticeManagementCascade {
  enabled: boolean;               // opt-in toggle
  // Revenue metrics
  annualRevenue: number;
  monthlyGDC: number;
  aumRevenue: number;
  overrideRevenue: number;
  // Team metrics
  teamSize: number;
  revenuePerAdvisor: number;
  clientsPerAdvisor: number;
  // Client book
  totalClients: number;
  avgClientValue: number;
  retentionRate: number;
  // Production
  annualProduction: number;
  productionGrowthRate: number;
  // Practice score (0-100)
  practiceScore: number;
  // Cascade to client planning
  practiceToClient: {
    incomeFromPractice: number;     // practice income feeds client cash flow
    practiceEquity: number;         // practice value feeds client net worth
    benefitsCostOffset: number;     // group benefits offset personal insurance
  };
}

export const EMPTY_PRACTICE_CASCADE: PracticeManagementCascade = {
  enabled: false,
  annualRevenue: 0, monthlyGDC: 0, aumRevenue: 0, overrideRevenue: 0,
  teamSize: 0, revenuePerAdvisor: 0, clientsPerAdvisor: 0,
  totalClients: 0, avgClientValue: 0, retentionRate: 0,
  annualProduction: 0, productionGrowthRate: 0,
  practiceScore: 0,
  practiceToClient: { incomeFromPractice: 0, practiceEquity: 0, benefitsCostOffset: 0 },
};

/* ═══ ADVANCED STRATEGIES CASCADE DATA ═══
   Flows from AdvancedStrategiesHub into client planning domains.
   ═══════════════════════════════════════════════════════════════ */
export interface AdvancedStrategiesCascade {
  // Strategy-level benefits
  pfNetBenefit: number;
  pfTaxEfficiency: number;
  ilitEstateTaxSaved: number;
  ilitNetToHeirs: number;
  execTaxBenefit: number;
  execRetentionValue: number;
  charitableTaxDeduction: number;
  charitableAnnualIncome: number;
  businessTotalProtection: number;
  businessContinuityScore: number;

  // Aggregate cascade to client planning
  totalAnnualBenefit: number;
  totalAnnualCost: number;
  estateTaxReduction: number;
  taxSavingsBoost: number;
  protectionEnhancement: number;
  retirementBoost: number;
  netWorthImpact: number;
}

const EMPTY_ADVANCED_CASCADE: AdvancedStrategiesCascade = {
  pfNetBenefit: 0,
  pfTaxEfficiency: 0,
  ilitEstateTaxSaved: 0,
  ilitNetToHeirs: 0,
  execTaxBenefit: 0,
  execRetentionValue: 0,
  charitableTaxDeduction: 0,
  charitableAnnualIncome: 0,
  businessTotalProtection: 0,
  businessContinuityScore: 0,
  totalAnnualBenefit: 0,
  totalAnnualCost: 0,
  estateTaxReduction: 0,
  taxSavingsBoost: 0,
  protectionEnhancement: 0,
  retirementBoost: 0,
  netWorthImpact: 0,
};

/* ═══ HOLISTIC CASCADE BRIDGE ═══
   Unifies ClientWealthHub and AdvancedStrategiesHub into a single
   cascading system. Changes in one hub propagate to the other.
   ═══════════════════════════════════════════════════════════════ */
export interface HolisticCascadeBridge {
  // Client → Advanced: client profile drives strategy sizing
  clientToAdvanced: {
    incomeForSizing: number;       // Total income → sizes PF, exec comp
    estateForILIT: number;         // Gross estate → sizes ILIT
    protectionGap: number;         // Protection gap → business planning
    taxBurden: number;             // Effective tax → charitable strategy
    retirementGap: number;         // Retirement gap → CRT income
  };
  // Advanced → Client: strategy benefits cascade back
  advancedToClient: {
    additionalProtection: number;  // Business + ILIT coverage
    taxSavings: number;            // PF + exec + charitable deductions
    estateReduction: number;       // ILIT estate tax savings
    incomeBoost: number;           // CRT annual income
    netWorthBoost: number;         // Combined net worth impact
  };
  // Optional practice management dimension
  practiceManagement?: {
    practiceScore: number;
    incomeFromPractice: number;
    practiceEquity: number;
    benefitsCostOffset: number;
  };
  // Holistic score: weighted combination of all hubs
  holisticScore: number;           // 0-100
  clientHubScore: number;          // 0-100
  advancedHubScore: number;        // 0-100
  practiceHubScore: number;        // 0-100 (0 if not enabled)
  // Weights (adjustable)
  weights: { client: number; advanced: number; practice: number };
  // Cascade health
  lastCascadeTimestamp: number;
  cascadeDirection: 'client→advanced' | 'advanced→client' | 'bidirectional' | 'none';
}

const EMPTY_CASCADE_BRIDGE: HolisticCascadeBridge = {
  clientToAdvanced: {
    incomeForSizing: 0,
    estateForILIT: 0,
    protectionGap: 0,
    taxBurden: 0,
    retirementGap: 0,
  },
  advancedToClient: {
    additionalProtection: 0,
    taxSavings: 0,
    estateReduction: 0,
    incomeBoost: 0,
    netWorthBoost: 0,
  },
  holisticScore: 0,
  clientHubScore: 0,
  advancedHubScore: 0,
  practiceHubScore: 0,
  weights: { client: 0.6, advanced: 0.4, practice: 0 },
  lastCascadeTimestamp: 0,
  cascadeDirection: 'none',
};

/* ─── Full Cascade Context Shape ─── */
export interface WealthEngineData {
  /* Client profile */
  client: ClientProfile;
  /* Computed results */
  scorecard: Scorecard;
  recommendations: Recommendation[];
  totalAnnualPremium: number;
  cfResult: CashFlowResult;
  prResult: ProtectionResult;
  grResult: GrowthResult;
  rtResult: RetirementResult;
  txResult: TaxResult;
  esResult: EstateResult;
  edResult: EducationResult;
  horizonData: HorizonDataPoint[];
  practiceIncome: PracticeIncomeResult;
  /* Scores map */
  scores: Record<string, number>;
  /* General planning defaults */
  generalDefaults: GeneralPlanningDefaults;
  /* Advanced strategies cascade */
  advancedCascade: AdvancedStrategiesCascade;
  /* Practice management cascade (optional) */
  practiceCascade: PracticeManagementCascade;
  /* Holistic cascade bridge */
  holisticBridge: HolisticCascadeBridge;
  /* Cascade metadata */
  lastUpdated: number;
  panelVersions: Record<string, number>;
  /* Cascade audit trail (session-level) */
  cascadeAuditEntries: import('../pages/calculators/CascadeAuditTrail').CascadeAuditEntry[];
}

/* ─── Default empty state ─── */
const EMPTY_SCORECARD: Scorecard = { overall: 0, maxScore: 36, pctScore: 0, domains: [] };
const EMPTY_CF: CashFlowResult = { grossMonthly: 0, totalExpenses: 0, netCashFlow: 0, savingsRate: 0, emergencyMonths: 0, emergencyTarget: 0, emergencyGap: 0 };
const EMPTY_PR: ProtectionResult = { totalNeed: 0, gap: 0, diNeed: 0, diPremium: 0, ltcNeed: 0, ltcPremium: 0 };
const EMPTY_GR: GrowthResult = { taxableProjected: 0, iulProjected: 0, fiaProjected: 0, totalProjected: 0, monthlyNeeded: 0, onTrack: false };
const EMPTY_RT: RetirementResult = { projectedNest: 0, monthlyIncome: 0, ssOptimal: '', gap: 0, replacementRate: 0 };
const EMPTY_TX: TaxResult = { effectiveRate: 0, totalTax: 0, marginalRate: 0, strategies: [], totalSavings: 0 };
const EMPTY_ES: EstateResult = { taxableEstate: 0, estateTax: 0, effectiveRate: 0, giftingImpact: 0, trustBenefit: 0 };
const EMPTY_ED: EducationResult = { totalCost: 0, projected529: 0, gap: 0, monthlyNeeded: 0 };
const EMPTY_PI: PracticeIncomeResult = { annualGDC: 0, annualAUM: 0, annualOverride: 0, annualExpanded: 0, annualChannelRev: 0, grandTotal: 0, streamCount: 0, items: [], pnlNetIncome: 0, pnlEbitda: 0, pnlRevenue: 0, monthlyGDC: 0, monthlyNet: 0 };

const DEFAULT_CLIENT: ClientProfile = {
  clientName: '', age: 40, spouseAge: 38, dep: 2, income: 150000, spouseIncome: 0,
  totalIncome: 150000, nw: 500000, savings: 200000, retirement401k: 350000,
  mortgage: 300000, debt: 25000, existIns: 250000, filing: 'mfj', stateRate: 0.05,
  riskTolerance: 'moderate', isBiz: false, bizRevenue: 0, bizEmployees: 0, bizEntityType: 'llc',
};

const DEFAULT_DATA: WealthEngineData = {
  client: DEFAULT_CLIENT,
  scorecard: EMPTY_SCORECARD,
  recommendations: [],
  totalAnnualPremium: 0,
  cfResult: EMPTY_CF,
  prResult: EMPTY_PR,
  grResult: EMPTY_GR,
  rtResult: EMPTY_RT,
  txResult: EMPTY_TX,
  esResult: EMPTY_ES,
  edResult: EMPTY_ED,
  horizonData: [],
  practiceIncome: EMPTY_PI,
  scores: {},
  generalDefaults: GENERAL_DEFAULTS,
  advancedCascade: EMPTY_ADVANCED_CASCADE,
  practiceCascade: EMPTY_PRACTICE_CASCADE,
  holisticBridge: EMPTY_CASCADE_BRIDGE,
  lastUpdated: Date.now(),
  panelVersions: {},
  cascadeAuditEntries: [],
};

/* ─── Context ─── */
const WealthEngineContext = createContext<WealthEngineData>(DEFAULT_DATA);

export function useWealthEngine(): WealthEngineData {
  return useContext(WealthEngineContext);
}

/* ─── Provider (wraps the Calculators component internals) ─── */
interface WealthEngineProviderProps {
  value: WealthEngineData;
  children: ReactNode;
}

export function WealthEngineProvider({ value, children }: WealthEngineProviderProps) {
  return (
    <WealthEngineContext.Provider value={value}>
      {children}
    </WealthEngineContext.Provider>
  );
}

/* ─── Helper: compute holistic cascade bridge from current state ─── */
export function computeHolisticBridge(
  clientHubScore: number,
  advancedHubScore: number,
  client: ClientProfile,
  prResult: ProtectionResult,
  txResult: TaxResult,
  rtResult: RetirementResult,
  advCascade: AdvancedStrategiesCascade,
  practiceCascade?: PracticeManagementCascade,
): HolisticCascadeBridge {
  const practiceEnabled = practiceCascade?.enabled ?? false;
  const practiceScore = practiceEnabled ? practiceCascade!.practiceScore : 0;

  // Dynamic weights: if practice is enabled, rebalance
  const weights = practiceEnabled
    ? { client: 0.45, advanced: 0.30, practice: 0.25 }
    : { client: 0.60, advanced: 0.40, practice: 0 };

  const holisticScore = Math.round(
    clientHubScore * weights.client +
    advancedHubScore * weights.advanced +
    practiceScore * weights.practice
  );

  return {
    clientToAdvanced: {
      incomeForSizing: client.totalIncome,
      estateForILIT: client.nw + client.totalIncome * 10,
      protectionGap: prResult.gap,
      taxBurden: txResult.effectiveRate,
      retirementGap: rtResult.gap,
    },
    advancedToClient: {
      additionalProtection: advCascade.protectionEnhancement,
      taxSavings: advCascade.taxSavingsBoost,
      estateReduction: advCascade.estateTaxReduction,
      incomeBoost: advCascade.charitableAnnualIncome,
      netWorthBoost: advCascade.netWorthImpact,
    },
    practiceManagement: practiceEnabled ? {
      practiceScore,
      incomeFromPractice: practiceCascade!.practiceToClient.incomeFromPractice,
      practiceEquity: practiceCascade!.practiceToClient.practiceEquity,
      benefitsCostOffset: practiceCascade!.practiceToClient.benefitsCostOffset,
    } : undefined,
    holisticScore,
    clientHubScore,
    advancedHubScore,
    practiceHubScore: practiceScore,
    weights,
    lastCascadeTimestamp: Date.now(),
    cascadeDirection: advCascade.totalAnnualBenefit > 0 ? 'bidirectional' : 'client→advanced',
  };
}

export { DEFAULT_DATA, DEFAULT_CLIENT, EMPTY_ADVANCED_CASCADE, EMPTY_CASCADE_BRIDGE };
