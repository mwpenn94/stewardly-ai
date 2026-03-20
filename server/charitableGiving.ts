/**
 * Charitable Giving Optimizer — Tax-efficient donation strategies
 * Part F: Market Completeness
 *
 * Pure computation — no API keys needed.
 * Covers: DAF, QCD, bunching, appreciated stock, CRT modeling.
 */

export type DonationVehicle = "cash" | "appreciated_stock" | "daf" | "qcd" | "crt" | "ira_rollover";
export type FilingStatus = "single" | "mfj" | "hoh";

export interface DonationInput {
  annualIncome: number;
  filingStatus: FilingStatus;
  marginalRate: number; // e.g. 0.32
  stateRate: number;
  itemizedDeductions: number; // non-charitable
  standardDeduction?: number;
  age: number;
  iraBalance?: number;
  appreciatedStockBasis?: number;
  appreciatedStockFMV?: number;
  desiredAnnualGiving: number;
  yearsToModel?: number;
}

export interface DonationStrategy {
  vehicle: DonationVehicle;
  label: string;
  annualAmount: number;
  taxSavings: number;
  effectiveCost: number; // after tax benefit
  costPerDollarGiven: number;
  eligible: boolean;
  notes: string[];
}

export interface CharitableResult {
  strategies: DonationStrategy[];
  bestStrategy: string;
  bunchingAnalysis: {
    bunchEveryNYears: number;
    bunchedAmount: number;
    annualTaxSavings: number;
    standardYearSavings: number;
    netBenefit: number;
  };
  totalTaxSavings: number;
  effectiveGivingRate: number;
}

const STD_DEDUCTIONS_2025: Record<FilingStatus, number> = {
  single: 15000,
  mfj: 30000,
  hoh: 22500,
};

export function optimizeCharitable(input: DonationInput): CharitableResult {
  const stdDed = input.standardDeduction || STD_DEDUCTIONS_2025[input.filingStatus];
  const combinedRate = Math.min(input.marginalRate + input.stateRate, 0.50);
  const amount = input.desiredAnnualGiving;

  const strategies: DonationStrategy[] = [];

  // 1. Cash donation
  const cashItemized = input.itemizedDeductions + amount;
  const cashBenefit = cashItemized > stdDed ? (cashItemized - stdDed) * combinedRate : 0;
  // If already itemizing, benefit is full marginal rate
  const alreadyItemizing = input.itemizedDeductions > stdDed;
  const cashTaxSavings = alreadyItemizing ? amount * combinedRate : cashBenefit;
  strategies.push({
    vehicle: "cash",
    label: "Cash Donation",
    annualAmount: amount,
    taxSavings: Math.round(cashTaxSavings),
    effectiveCost: Math.round(amount - cashTaxSavings),
    costPerDollarGiven: amount > 0 ? +((amount - cashTaxSavings) / amount).toFixed(3) : 1,
    eligible: true,
    notes: alreadyItemizing ? ["Already itemizing — full deduction benefit"] : ["May not exceed standard deduction threshold"],
  });

  // 2. Appreciated stock
  const stockFMV = input.appreciatedStockFMV || 0;
  const stockBasis = input.appreciatedStockBasis || 0;
  const stockGain = stockFMV - stockBasis;
  const stockEligible = stockFMV > 0 && stockGain > 0;
  const stockCapGainsTaxAvoided = stockGain * 0.238; // 20% + 3.8% NIIT
  const stockDeductionBenefit = alreadyItemizing ? Math.min(amount, stockFMV) * combinedRate : 0;
  const stockTotalSavings = stockCapGainsTaxAvoided + stockDeductionBenefit;
  strategies.push({
    vehicle: "appreciated_stock",
    label: "Appreciated Stock",
    annualAmount: Math.min(amount, stockFMV),
    taxSavings: Math.round(stockEligible ? stockTotalSavings : 0),
    effectiveCost: Math.round(stockEligible ? amount - stockTotalSavings : amount),
    costPerDollarGiven: stockEligible && amount > 0 ? +((amount - stockTotalSavings) / amount).toFixed(3) : 1,
    eligible: stockEligible,
    notes: stockEligible
      ? [`Avoids $${Math.round(stockCapGainsTaxAvoided).toLocaleString()} in capital gains tax`, `Gain: $${Math.round(stockGain).toLocaleString()}`]
      : ["No appreciated stock available"],
  });

  // 3. Donor-Advised Fund (DAF)
  const dafTaxSavings = alreadyItemizing ? amount * combinedRate : Math.max(0, (input.itemizedDeductions + amount - stdDed) * combinedRate);
  strategies.push({
    vehicle: "daf",
    label: "Donor-Advised Fund",
    annualAmount: amount,
    taxSavings: Math.round(dafTaxSavings),
    effectiveCost: Math.round(amount - dafTaxSavings),
    costPerDollarGiven: amount > 0 ? +((amount - dafTaxSavings) / amount).toFixed(3) : 1,
    eligible: true,
    notes: ["Immediate deduction, distribute over time", "Can fund with appreciated stock for double benefit"],
  });

  // 4. QCD (Qualified Charitable Distribution) — age 70.5+
  const qcdEligible = input.age >= 70 && (input.iraBalance || 0) > 0;
  const qcdAmount = Math.min(amount, 105000, input.iraBalance || 0);
  const qcdTaxSavings = qcdAmount * input.marginalRate; // Excludes from income entirely
  strategies.push({
    vehicle: "qcd",
    label: "QCD (IRA Rollover)",
    annualAmount: qcdAmount,
    taxSavings: Math.round(qcdEligible ? qcdTaxSavings : 0),
    effectiveCost: Math.round(qcdEligible ? qcdAmount - qcdTaxSavings : amount),
    costPerDollarGiven: qcdEligible && qcdAmount > 0 ? +((qcdAmount - qcdTaxSavings) / qcdAmount).toFixed(3) : 1,
    eligible: qcdEligible,
    notes: qcdEligible
      ? ["Satisfies RMD", "Excludes from AGI (better than deduction)", `Max $105,000/year`]
      : ["Must be age 70½+ with IRA balance"],
  });

  // 5. Charitable Remainder Trust (CRT) — for large gifts
  const crtEligible = amount >= 100000;
  const crtIncomeStream = amount * 0.05; // 5% annual payout
  const crtDeduction = amount * 0.35; // Approximate present value of remainder
  const crtTaxSavings = crtDeduction * combinedRate;
  strategies.push({
    vehicle: "crt",
    label: "Charitable Remainder Trust",
    annualAmount: amount,
    taxSavings: Math.round(crtEligible ? crtTaxSavings : 0),
    effectiveCost: Math.round(crtEligible ? amount - crtTaxSavings - crtIncomeStream * 10 : amount),
    costPerDollarGiven: crtEligible && amount > 0 ? Math.max(0, +((amount - crtTaxSavings) / amount).toFixed(3)) : 1,
    eligible: crtEligible,
    notes: crtEligible
      ? [`Income stream: ~$${Math.round(crtIncomeStream).toLocaleString()}/yr`, `Upfront deduction: ~$${Math.round(crtDeduction).toLocaleString()}`]
      : ["Typically requires $100K+ gift"],
  });

  // Bunching analysis
  const years = input.yearsToModel || 3;
  const bunchedAmount = amount * years;
  const bunchedItemized = input.itemizedDeductions + bunchedAmount;
  const bunchedBenefit = bunchedItemized > stdDed ? (bunchedItemized - stdDed) * combinedRate : 0;
  const standardYearsBenefit = (years - 1) * 0; // Take standard deduction in off years
  const annualBunchSavings = bunchedBenefit / years;
  const annualStandardSavings = cashTaxSavings;
  const bunchingBenefit = annualBunchSavings - annualStandardSavings;

  const eligible = strategies.filter(s => s.eligible);
  const best = eligible.reduce((a, b) => a.taxSavings > b.taxSavings ? a : b, eligible[0]);

  return {
    strategies,
    bestStrategy: best?.vehicle || "cash",
    bunchingAnalysis: {
      bunchEveryNYears: years,
      bunchedAmount: Math.round(bunchedAmount),
      annualTaxSavings: Math.round(annualBunchSavings),
      standardYearSavings: Math.round(annualStandardSavings),
      netBenefit: Math.round(bunchingBenefit),
    },
    totalTaxSavings: Math.round(best?.taxSavings || 0),
    effectiveGivingRate: amount > 0 ? +(1 - (best?.taxSavings || 0) / amount).toFixed(3) : 1,
  };
}
