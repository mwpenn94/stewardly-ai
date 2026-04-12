/**
 * planningCalculations — Pure calculation functions extracted from planning pages
 * for testability. No React, no DOM, no side effects.
 */

// ─── Estate Tax Calculator ─────────────────────────────────
export const FEDERAL_EXEMPTION_2026 = 13_610_000;
export const FEDERAL_EXEMPTION_SUNSET = 7_000_000;
export const ESTATE_TAX_RATE = 0.40;

export interface EstateTaxResult {
  taxableEstate: number;
  estateTax: number;
  exemption: number;
  headroom: number;
}

export function computeEstateTax(
  netEstate: number,
  isMarried: boolean,
  portabilityUsed: number,
  useSunset: boolean,
): EstateTaxResult {
  const exemption = useSunset ? FEDERAL_EXEMPTION_SUNSET : FEDERAL_EXEMPTION_2026;
  const totalExemption = isMarried ? exemption + portabilityUsed : exemption;
  const taxableEstate = Math.max(0, netEstate - totalExemption);
  const estateTax = taxableEstate * ESTATE_TAX_RATE;
  return { taxableEstate, estateTax, exemption: totalExemption, headroom: totalExemption - netEstate };
}

// ─── DIME Insurance Needs Calculator ────────────────────────
export interface DIMEInput {
  annualIncome: number;
  yearsToReplace: number;
  mortgageBalance: number;
  otherDebts: number;
  childrenCount: number;
  educationPerChild: number;
  finalExpenses: number;
  existingLifeInsurance: number;
  spouseIncome: number;
}

export interface DIMEResult {
  debt: number;
  income: number;
  education: number;
  finalExpenses: number;
  total: number;
  gap: number;
  recommended: number;
  coverageRatio: number;
}

export function computeDIME(input: DIMEInput): DIMEResult {
  const debt = input.mortgageBalance + input.otherDebts;
  const income = input.annualIncome * input.yearsToReplace;
  const education = input.childrenCount * input.educationPerChild;
  const total = debt + income + education + input.finalExpenses;
  const gap = Math.max(0, total - input.existingLifeInsurance);
  const withSpouseOffset = Math.max(0, gap - (input.spouseIncome * input.yearsToReplace * 0.3));
  const coverageRatio = input.existingLifeInsurance > 0
    ? Math.min(100, Math.round((input.existingLifeInsurance / total) * 100))
    : 0;
  return { debt, income, education, finalExpenses: input.finalExpenses, total, gap, recommended: withSpouseOffset, coverageRatio };
}

// ─── Risk Assessment Scoring ────────────────────────────────
export interface RiskQuestion {
  id: string;
  weight: number;
}

export interface RiskProfile {
  name: string;
  min: number;
  max: number;
  equity: number;
  fixed: number;
  alternatives: number;
  cash: number;
}

export const RISK_PROFILES: RiskProfile[] = [
  { name: "Conservative", min: 0, max: 25, equity: 20, fixed: 50, alternatives: 10, cash: 20 },
  { name: "Moderately Conservative", min: 26, max: 40, equity: 35, fixed: 40, alternatives: 10, cash: 15 },
  { name: "Moderate", min: 41, max: 60, equity: 50, fixed: 30, alternatives: 10, cash: 10 },
  { name: "Moderately Aggressive", min: 61, max: 75, equity: 65, fixed: 20, alternatives: 10, cash: 5 },
  { name: "Aggressive", min: 76, max: 100, equity: 80, fixed: 10, alternatives: 8, cash: 2 },
];

export function computeRiskScore(
  answers: Record<string, number>,
  questions: RiskQuestion[],
): { score: number; categoryScores: { category: string; score: number; weight: number }[] } {
  const cats: { category: string; score: number; weight: number }[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;
  for (const q of questions) {
    const ans = answers[q.id];
    if (ans != null) {
      cats.push({ category: q.id, score: ans, weight: q.weight });
      totalWeightedScore += ans * q.weight;
      totalWeight += q.weight;
    }
  }
  const score = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight / 10) * 100) : 0;
  return { score, categoryScores: cats };
}

export function getRiskProfile(score: number): RiskProfile {
  return RISK_PROFILES.find(p => score >= p.min && score <= p.max) ?? RISK_PROFILES[2];
}

// ─── Client-Side Tax Projector (fallback when server unavailable) ──
const BRACKETS_2026_MFJ = [
  { rate: 0.10, from: 0, to: 23_850 },
  { rate: 0.12, from: 23_850, to: 96_950 },
  { rate: 0.22, from: 96_950, to: 206_700 },
  { rate: 0.24, from: 206_700, to: 394_600 },
  { rate: 0.32, from: 394_600, to: 501_050 },
  { rate: 0.35, from: 501_050, to: 751_600 },
  { rate: 0.37, from: 751_600, to: Infinity },
];
const BRACKETS_2026_SINGLE = [
  { rate: 0.10, from: 0, to: 11_925 },
  { rate: 0.12, from: 11_925, to: 48_475 },
  { rate: 0.22, from: 48_475, to: 103_350 },
  { rate: 0.24, from: 103_350, to: 197_300 },
  { rate: 0.32, from: 197_300, to: 250_525 },
  { rate: 0.35, from: 250_525, to: 626_350 },
  { rate: 0.37, from: 626_350, to: Infinity },
];
const BRACKETS_2026_HOH = [
  { rate: 0.10, from: 0, to: 17_000 },
  { rate: 0.12, from: 17_000, to: 64_850 },
  { rate: 0.22, from: 64_850, to: 103_350 },
  { rate: 0.24, from: 103_350, to: 197_300 },
  { rate: 0.32, from: 197_300, to: 250_500 },
  { rate: 0.35, from: 250_500, to: 626_350 },
  { rate: 0.37, from: 626_350, to: Infinity },
];
const STANDARD_DEDUCTIONS: Record<string, number> = { single: 15_700, mfj: 31_400, hoh: 23_550 };

export interface ClientTaxInput {
  filingStatus: "single" | "mfj" | "hoh";
  wages: number;
  selfEmploymentIncome: number;
  interestIncome: number;
  dividendIncome: number;
  longTermCapGains: number;
  rentalIncome: number;
  rothConversion: number;
  itemizedDeductions: number;
  retirementContributions: number;
  hsaContributions: number;
}

export interface ClientTaxResult {
  grossIncome: number;
  agiDeductions: number;
  agi: number;
  deduction: number;
  taxableIncome: number;
  federalTax: number;
  effectiveRate: number;
  marginalRate: number;
  brackets: { rate: number; from: number; to: number; taxInBracket: number; fill: number }[];
}

export function projectTaxClientSide(input: ClientTaxInput): ClientTaxResult {
  const grossIncome = input.wages + input.selfEmploymentIncome + input.interestIncome +
    input.dividendIncome + input.longTermCapGains + input.rentalIncome + input.rothConversion;
  const seDeduction = input.selfEmploymentIncome > 0 ? input.selfEmploymentIncome * 0.0765 : 0;
  const agiDeductions = input.retirementContributions + input.hsaContributions + seDeduction;
  const agi = Math.max(0, grossIncome - agiDeductions);
  const standardDeduction = STANDARD_DEDUCTIONS[input.filingStatus] ?? 15_700;
  const deduction = Math.max(standardDeduction, input.itemizedDeductions);
  const taxableIncome = Math.max(0, agi - deduction);

  const brackets = input.filingStatus === "mfj" ? BRACKETS_2026_MFJ
    : input.filingStatus === "hoh" ? BRACKETS_2026_HOH
    : BRACKETS_2026_SINGLE;

  let remaining = taxableIncome;
  let federalTax = 0;
  let marginalRate = 0.10;
  const bracketResults = brackets.map(b => {
    const width = b.to === Infinity ? remaining : b.to - b.from;
    const taxableInBracket = Math.min(remaining, width);
    const taxInBracket = taxableInBracket * b.rate;
    const fill = width > 0 && width !== Infinity ? taxableInBracket / width : 0;
    remaining -= taxableInBracket;
    federalTax += taxInBracket;
    if (taxableInBracket > 0) marginalRate = b.rate;
    return { rate: b.rate, from: b.from, to: b.to, taxInBracket: Math.round(taxInBracket), fill };
  });

  const effectiveRate = grossIncome > 0 ? federalTax / grossIncome : 0;

  return {
    grossIncome,
    agiDeductions: Math.round(agiDeductions),
    agi: Math.round(agi),
    deduction: Math.round(deduction),
    taxableIncome: Math.round(taxableIncome),
    federalTax: Math.round(federalTax),
    effectiveRate,
    marginalRate,
    brackets: bracketResults,
  };
}

// ─── Monte Carlo Sustainability ─────────────────────────────
export function monteCarloSuccessRate(
  totalGuaranteedMonthly: number,
  targetMonthly: number,
  portfolioBalance: number,
  returnRate: number,
  inflationRate: number,
  yearsInRetirement: number,
  trials = 1000,
): number {
  if (totalGuaranteedMonthly >= targetMonthly) return 99;
  const annualWithdrawal = (targetMonthly - totalGuaranteedMonthly) * 12;
  let successes = 0;
  for (let t = 0; t < trials; t++) {
    let bal = portfolioBalance;
    let failed = false;
    for (let y = 0; y < yearsInRetirement; y++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
      const annualReturn = returnRate + 0.15 * z;
      bal = bal * (1 + annualReturn) - annualWithdrawal * Math.pow(1 + inflationRate, y);
      if (bal <= 0) { failed = true; break; }
    }
    if (!failed) successes++;
  }
  return Math.round((successes / trials) * 100);
}
