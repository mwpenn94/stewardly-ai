/**
 * Tax Projector — Multi-year tax projection engine
 * Part F: Market Completeness — D9
 * 
 * Features:
 * - Federal income tax bracket calculation (2024/2025 brackets)
 * - State tax estimation (flat vs progressive)
 * - Capital gains (short-term vs long-term)
 * - AMT screening
 * - Multi-year projection with inflation adjustment
 * - Roth conversion optimization
 * - Tax-loss harvesting scenarios
 */

// 2025 Federal Tax Brackets (Married Filing Jointly)
const FEDERAL_BRACKETS_MFJ = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Infinity, rate: 0.37 },
];

// 2025 Federal Tax Brackets (Single)
const FEDERAL_BRACKETS_SINGLE = [
  { min: 0, max: 11925, rate: 0.10 },
  { min: 11925, max: 48475, rate: 0.12 },
  { min: 48475, max: 103350, rate: 0.22 },
  { min: 103350, max: 197300, rate: 0.24 },
  { min: 197300, max: 250525, rate: 0.32 },
  { min: 250525, max: 626350, rate: 0.35 },
  { min: 626350, max: Infinity, rate: 0.37 },
];

const STANDARD_DEDUCTION = { single: 15000, mfj: 30000, hoh: 22500 };
const LTCG_RATES = [
  { max: 47025, rate: 0 },    // Single 0% bracket
  { max: 518900, rate: 0.15 },
  { max: Infinity, rate: 0.20 },
];
const NIIT_THRESHOLD = { single: 200000, mfj: 250000 };
const NIIT_RATE = 0.038;
const SS_TAX_RATE = 0.062;
const MEDICARE_RATE = 0.0145;
const ADDITIONAL_MEDICARE_THRESHOLD = 200000;
const ADDITIONAL_MEDICARE_RATE = 0.009;
const SS_WAGE_BASE_2025 = 176100;

export type FilingStatus = "single" | "mfj" | "hoh";

export interface TaxInput {
  filingStatus: FilingStatus;
  wages: number;
  selfEmploymentIncome: number;
  interestIncome: number;
  dividendIncome: number;       // qualified dividends
  ordinaryDividends: number;    // non-qualified
  shortTermCapGains: number;
  longTermCapGains: number;
  rentalIncome: number;
  otherIncome: number;
  rothConversion: number;
  itemizedDeductions: number;   // 0 = use standard
  retirementContributions: number; // 401k, IRA
  hsaContributions: number;
  stateCode: string;            // "AZ", "CA", etc.
  dependents: number;
  year: number;
}

export interface TaxResult {
  year: number;
  grossIncome: number;
  agi: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  ficaTax: number;
  niit: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  bracketBreakdown: { bracket: string; taxableInBracket: number; taxOnBracket: number }[];
  ltcgTax: number;
  amtExposure: boolean;
  recommendations: string[];
}

// Simple state tax rates (flat or top marginal)
const STATE_TAX_RATES: Record<string, number> = {
  AK: 0, FL: 0, NV: 0, NH: 0, SD: 0, TN: 0, TX: 0, WA: 0, WY: 0,
  AZ: 0.025, CO: 0.044, GA: 0.055, IL: 0.0495, IN: 0.0305, KY: 0.04,
  MA: 0.05, MI: 0.0425, NC: 0.0475, PA: 0.0307, UT: 0.0465, VA: 0.0575,
  CA: 0.133, NY: 0.109, NJ: 0.1075, OR: 0.099, MN: 0.0985, HI: 0.11,
  VT: 0.0875, IA: 0.06, WI: 0.0765, CT: 0.0699, DC: 0.1075, ME: 0.0715,
  MD: 0.0575, NM: 0.059, SC: 0.065, AL: 0.05, AR: 0.047, DE: 0.066,
  ID: 0.058, KS: 0.057, LA: 0.0425, MO: 0.048, MS: 0.05, MT: 0.0675,
  NE: 0.0664, ND: 0.025, OH: 0.0399, OK: 0.0475, RI: 0.0599, WV: 0.0512,
};

function calcProgressiveTax(income: number, brackets: typeof FEDERAL_BRACKETS_MFJ): { total: number; breakdown: TaxResult["bracketBreakdown"]; marginalRate: number } {
  let total = 0;
  let marginalRate = 0.10;
  const breakdown: TaxResult["bracketBreakdown"] = [];

  for (const b of brackets) {
    if (income <= b.min) break;
    const taxableInBracket = Math.min(income, b.max) - b.min;
    const taxOnBracket = taxableInBracket * b.rate;
    total += taxOnBracket;
    marginalRate = b.rate;
    breakdown.push({
      bracket: `${(b.rate * 100).toFixed(0)}% ($${b.min.toLocaleString()} - $${b.max === Infinity ? "∞" : b.max.toLocaleString()})`,
      taxableInBracket,
      taxOnBracket,
    });
  }

  return { total, breakdown, marginalRate };
}

export function projectTax(input: TaxInput): TaxResult {
  const brackets = input.filingStatus === "mfj" ? FEDERAL_BRACKETS_MFJ : FEDERAL_BRACKETS_SINGLE;
  const stdDeduction = STANDARD_DEDUCTION[input.filingStatus] || STANDARD_DEDUCTION.single;

  // Gross income
  const ordinaryIncome = input.wages + input.selfEmploymentIncome + input.interestIncome +
    input.ordinaryDividends + input.shortTermCapGains + input.rentalIncome +
    input.otherIncome + input.rothConversion;
  const grossIncome = ordinaryIncome + input.dividendIncome + input.longTermCapGains;

  // AGI adjustments
  const seDeduction = input.selfEmploymentIncome > 0 ? input.selfEmploymentIncome * 0.0765 : 0;
  const agi = grossIncome - input.retirementContributions - input.hsaContributions - seDeduction;

  // Deductions
  const deduction = Math.max(stdDeduction, input.itemizedDeductions);
  const taxableOrdinary = Math.max(0, agi - input.dividendIncome - input.longTermCapGains - deduction);

  // Federal tax on ordinary income
  const { total: fedOrdinaryTax, breakdown, marginalRate } = calcProgressiveTax(taxableOrdinary, brackets);

  // LTCG + qualified dividends tax
  const ltcgIncome = input.longTermCapGains + input.dividendIncome;
  let ltcgTax = 0;
  if (ltcgIncome > 0) {
    // Simplified: use top bracket based on total income
    const totalTaxable = taxableOrdinary + ltcgIncome;
    if (totalTaxable <= LTCG_RATES[0].max) {
      ltcgTax = 0;
    } else if (totalTaxable <= LTCG_RATES[1].max) {
      ltcgTax = ltcgIncome * 0.15;
    } else {
      ltcgTax = ltcgIncome * 0.20;
    }
  }

  const federalTax = fedOrdinaryTax + ltcgTax;

  // FICA
  const ssWages = Math.min(input.wages, SS_WAGE_BASE_2025);
  const ssTax = ssWages * SS_TAX_RATE;
  const medicareTax = input.wages * MEDICARE_RATE;
  const additionalMedicare = Math.max(0, input.wages - ADDITIONAL_MEDICARE_THRESHOLD) * ADDITIONAL_MEDICARE_RATE;
  const seSSTax = input.selfEmploymentIncome > 0 ? Math.min(input.selfEmploymentIncome * 0.9235, SS_WAGE_BASE_2025 - ssWages) * 0.124 : 0;
  const seMedicare = input.selfEmploymentIncome > 0 ? input.selfEmploymentIncome * 0.9235 * 0.029 : 0;
  const ficaTax = ssTax + medicareTax + additionalMedicare + seSSTax + seMedicare;

  // NIIT
  const niitThreshold = NIIT_THRESHOLD[input.filingStatus === "mfj" ? "mfj" : "single"];
  const investmentIncome = input.interestIncome + input.dividendIncome + input.ordinaryDividends +
    input.shortTermCapGains + input.longTermCapGains + input.rentalIncome;
  const niit = agi > niitThreshold ? Math.min(investmentIncome, agi - niitThreshold) * NIIT_RATE : 0;

  // State tax (simplified flat rate)
  const stateRate = STATE_TAX_RATES[input.stateCode.toUpperCase()] ?? 0.05;
  const stateTax = Math.max(0, agi - deduction) * stateRate;

  const totalTax = federalTax + stateTax + ficaTax + niit;
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

  // AMT screening
  const amtExposure = input.selfEmploymentIncome > 0 && agi > 250000;

  // Recommendations
  const recommendations: string[] = [];
  if (input.retirementContributions < 23500) {
    recommendations.push(`Maximize 401(k) contributions — you have $${(23500 - input.retirementContributions).toLocaleString()} of room remaining.`);
  }
  if (input.hsaContributions < 4300 && input.filingStatus === "single") {
    recommendations.push("Consider maximizing HSA contributions for triple tax advantage.");
  }
  if (input.longTermCapGains > 50000 && input.shortTermCapGains > 0) {
    recommendations.push("Consider tax-loss harvesting to offset short-term capital gains.");
  }
  if (input.rothConversion === 0 && marginalRate <= 0.22 && agi < 200000) {
    recommendations.push("Your marginal rate is low — consider a Roth conversion to lock in current rates.");
  }
  if (stateRate === 0) {
    recommendations.push("You're in a no-income-tax state — consider maximizing Roth contributions.");
  }
  if (niit > 0) {
    recommendations.push(`Net Investment Income Tax of $${niit.toFixed(0)} applies. Consider tax-efficient fund placement.`);
  }

  return {
    year: input.year,
    grossIncome,
    agi,
    taxableIncome: taxableOrdinary + ltcgIncome,
    federalTax,
    stateTax,
    ficaTax,
    niit,
    totalTax,
    effectiveRate,
    marginalRate,
    bracketBreakdown: breakdown,
    ltcgTax,
    amtExposure,
    recommendations,
  };
}

export function projectMultiYear(baseInput: TaxInput, years: number, inflationRate = 0.03): TaxResult[] {
  const results: TaxResult[] = [];
  for (let i = 0; i < years; i++) {
    const factor = Math.pow(1 + inflationRate, i);
    const yearInput: TaxInput = {
      ...baseInput,
      year: baseInput.year + i,
      wages: Math.round(baseInput.wages * factor),
      selfEmploymentIncome: Math.round(baseInput.selfEmploymentIncome * factor),
      interestIncome: Math.round(baseInput.interestIncome * factor),
      dividendIncome: Math.round(baseInput.dividendIncome * factor),
      ordinaryDividends: Math.round(baseInput.ordinaryDividends * factor),
      rentalIncome: Math.round(baseInput.rentalIncome * factor),
      otherIncome: Math.round(baseInput.otherIncome * factor),
    };
    results.push(projectTax(yearInput));
  }
  return results;
}

export function compareRothConversion(baseInput: TaxInput, conversionAmounts: number[]): { amount: number; result: TaxResult }[] {
  return conversionAmounts.map(amount => ({
    amount,
    result: projectTax({ ...baseInput, rothConversion: amount }),
  }));
}
