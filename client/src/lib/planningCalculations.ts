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
