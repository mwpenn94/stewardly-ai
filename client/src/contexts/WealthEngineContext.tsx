/* ═══════════════════════════════════════════════════════════════
   WealthEngineContext — Cascade Data Propagation Layer
   Provides computed engine results to all Wealth Engine panels
   so they can react to changes in any upstream panel.
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
  /* Cascade metadata */
  lastUpdated: number;
  panelVersions: Record<string, number>;
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
  lastUpdated: Date.now(),
  panelVersions: {},
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

export { DEFAULT_DATA, DEFAULT_CLIENT };
