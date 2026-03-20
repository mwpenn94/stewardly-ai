/**
 * Charitable Giving Optimizer — Tax-efficient donation strategies
 * Part F: Market Completeness
 *
 * No API keys needed. Models DAF, QCD, CRT, appreciated stock, bunching.
 */

export type DonationVehicle = "cash" | "appreciated_stock" | "daf" | "qcd" | "crt" | "private_foundation";

export interface CharitableInput {
  annualDonationGoal: number;
  marginalTaxRate: number;
  stateTaxRate: number;
  age: number;
  filingStatus: "single" | "mfj";
  agi: number;
  appreciatedStockValue?: number;
  appreciatedStockBasis?: number;
  iraBalance?: number;
  rmdRequired?: boolean;
  itemizesDeductions: boolean;
  standardDeduction?: number;
  currentItemizedDeductions?: number;
  yearsToModel?: number;
}

export interface VehicleAnalysis {
  vehicle: DonationVehicle;
  label: string;
  taxDeduction: number;
  taxSavings: number;
  capitalGainsSaved: number;
  totalBenefit: number;
  effectiveCostOfGiving: number;
  eligible: boolean;
  eligibilityNote?: string;
  pros: string[];
  cons: string[];
}

export interface BunchingAnalysis {
  bunchingBenefit: number;
  standardYearDeduction: number;
  bunchYearDeduction: number;
  twoYearSavings: number;
  twoYearSavingsWithoutBunching: number;
  recommendation: string;
}

export interface CharitableResult {
  vehicles: VehicleAnalysis[];
  bestVehicle: string;
  bunchingAnalysis: BunchingAnalysis;
  totalTaxSavings: number;
  effectiveCostOfGiving: number;
  strategies: string[];
  agiLimits: { vehicle: string; limit: string; maxDeduction: number }[];
}

export function optimizeCharitable(input: CharitableInput): CharitableResult {
  const combinedRate = input.marginalTaxRate + input.stateTaxRate;
  const standardDed = input.standardDeduction || (input.filingStatus === "mfj" ? 30000 : 15000);
  const currentItemized = input.currentItemizedDeductions || 0;
  const stockGain = (input.appreciatedStockValue || 0) - (input.appreciatedStockBasis || 0);
  const capGainsRate = 0.238; // 20% + 3.8% NIIT

  const vehicles: VehicleAnalysis[] = [];

  // Cash donation
  const cashDeduction = input.itemizesDeductions ? input.annualDonationGoal : 0;
  vehicles.push({
    vehicle: "cash",
    label: "Cash Donation",
    taxDeduction: Math.round(cashDeduction),
    taxSavings: Math.round(cashDeduction * combinedRate),
    capitalGainsSaved: 0,
    totalBenefit: Math.round(cashDeduction * combinedRate),
    effectiveCostOfGiving: Math.round(input.annualDonationGoal - cashDeduction * combinedRate),
    eligible: true,
    pros: ["Simple and straightforward", "Up to 60% AGI deduction limit"],
    cons: ["No capital gains benefit", "Must itemize to deduct"],
  });

  // Appreciated stock
  const stockDonation = Math.min(input.annualDonationGoal, input.appreciatedStockValue || 0);
  const stockCapGainsSaved = stockDonation > 0 ? Math.round(Math.max(0, stockGain) * (stockDonation / (input.appreciatedStockValue || 1)) * capGainsRate) : 0;
  vehicles.push({
    vehicle: "appreciated_stock",
    label: "Appreciated Stock",
    taxDeduction: Math.round(input.itemizesDeductions ? stockDonation : 0),
    taxSavings: Math.round((input.itemizesDeductions ? stockDonation : 0) * combinedRate),
    capitalGainsSaved: stockCapGainsSaved,
    totalBenefit: Math.round((input.itemizesDeductions ? stockDonation * combinedRate : 0) + stockCapGainsSaved),
    effectiveCostOfGiving: Math.round(stockDonation - (input.itemizesDeductions ? stockDonation * combinedRate : 0) - stockCapGainsSaved),
    eligible: (input.appreciatedStockValue || 0) > 0 && stockGain > 0,
    eligibilityNote: stockGain <= 0 ? "No unrealized gains — cash may be better" : undefined,
    pros: ["Deduct FMV, avoid capital gains tax", "Double tax benefit", "30% AGI limit for appreciated assets"],
    cons: ["Must hold >1 year", "30% AGI limit (vs 60% for cash)", "Requires transfer to charity"],
  });

  // DAF (Donor-Advised Fund)
  const dafDeduction = input.itemizesDeductions ? input.annualDonationGoal : 0;
  vehicles.push({
    vehicle: "daf",
    label: "Donor-Advised Fund (DAF)",
    taxDeduction: Math.round(dafDeduction),
    taxSavings: Math.round(dafDeduction * combinedRate),
    capitalGainsSaved: stockCapGainsSaved,
    totalBenefit: Math.round(dafDeduction * combinedRate + (stockGain > 0 ? stockCapGainsSaved : 0)),
    effectiveCostOfGiving: Math.round(input.annualDonationGoal - dafDeduction * combinedRate),
    eligible: true,
    pros: ["Immediate deduction, distribute later", "Can fund with appreciated stock", "Simplifies record-keeping", "Investment growth tax-free"],
    cons: ["Irrevocable contribution", "No deduction for non-itemizers", "Minimum initial contribution often $5K+"],
  });

  // QCD (Qualified Charitable Distribution)
  const qcdEligible = input.age >= 70.5;
  const qcdAmount = Math.min(input.annualDonationGoal, 105000, input.iraBalance || 0);
  const qcdBenefit = qcdEligible ? qcdAmount * combinedRate : 0;
  vehicles.push({
    vehicle: "qcd",
    label: "Qualified Charitable Distribution (QCD)",
    taxDeduction: 0, // Not a deduction — exclusion from income
    taxSavings: Math.round(qcdBenefit),
    capitalGainsSaved: 0,
    totalBenefit: Math.round(qcdBenefit),
    effectiveCostOfGiving: Math.round(qcdAmount - qcdBenefit),
    eligible: qcdEligible,
    eligibilityNote: !qcdEligible ? "Must be 70½ or older" : undefined,
    pros: ["Reduces AGI (better than deduction)", "Satisfies RMD", "Works even if you don't itemize", "Reduces IRMAA/ACA premium impacts"],
    cons: ["Age 70½+ only", "$105K annual limit", "Must go directly from IRA to charity"],
  });

  // CRT (Charitable Remainder Trust)
  const crtEligible = input.annualDonationGoal >= 100000;
  const crtDeduction = crtEligible ? input.annualDonationGoal * 0.35 : 0; // Approximate
  vehicles.push({
    vehicle: "crt",
    label: "Charitable Remainder Trust (CRT)",
    taxDeduction: Math.round(crtDeduction),
    taxSavings: Math.round(crtDeduction * combinedRate),
    capitalGainsSaved: Math.round(stockCapGainsSaved * 0.8),
    totalBenefit: Math.round(crtDeduction * combinedRate + stockCapGainsSaved * 0.8),
    effectiveCostOfGiving: Math.round(input.annualDonationGoal - crtDeduction * combinedRate),
    eligible: crtEligible,
    eligibilityNote: !crtEligible ? "Typically requires $100K+ to be cost-effective" : undefined,
    pros: ["Income stream for life/term", "Partial tax deduction", "Avoid capital gains on appreciated assets", "Reduce estate size"],
    cons: ["Irrevocable", "Complex and expensive to set up", "Income is taxable", "Charity gets remainder only"],
  });

  const best = vehicles.filter(v => v.eligible).reduce((a, b) => a.totalBenefit > b.totalBenefit ? a : b, vehicles[0]);

  // Bunching analysis
  const twoYearDonation = input.annualDonationGoal * 2;
  const bunchYearItemized = currentItemized + twoYearDonation;
  const noBunchYear1 = Math.max(standardDed, currentItemized + input.annualDonationGoal);
  const noBunchYear2 = noBunchYear1;
  const bunchYear1 = Math.max(standardDed, bunchYearItemized);
  const bunchYear2 = standardDed; // Standard deduction in off year
  const twoYearWithout = (noBunchYear1 + noBunchYear2) * combinedRate;
  const twoYearWith = (bunchYear1 + bunchYear2) * combinedRate;

  const bunchingAnalysis: BunchingAnalysis = {
    bunchingBenefit: Math.round(twoYearWith - twoYearWithout),
    standardYearDeduction: Math.round(noBunchYear1),
    bunchYearDeduction: Math.round(bunchYear1),
    twoYearSavings: Math.round(twoYearWith),
    twoYearSavingsWithoutBunching: Math.round(twoYearWithout),
    recommendation: twoYearWith > twoYearWithout
      ? "Bunching donations every 2 years saves more in taxes"
      : "Annual giving is more tax-efficient for your situation",
  };

  const strategies: string[] = [];
  if (stockGain > 0) strategies.push("Donate appreciated stock instead of cash to avoid capital gains");
  if (qcdEligible) strategies.push("Use QCDs to satisfy RMDs while supporting charities");
  if (!input.itemizesDeductions) strategies.push("Consider bunching donations with a DAF to exceed standard deduction threshold");
  if (input.agi > 500000) strategies.push("Consider CRT for large appreciated asset positions");
  strategies.push("Time donations before year-end for current-year deduction");
  strategies.push("Keep detailed records of all charitable contributions");

  return {
    vehicles,
    bestVehicle: best.vehicle,
    bunchingAnalysis,
    totalTaxSavings: Math.round(best.totalBenefit),
    effectiveCostOfGiving: Math.round(best.effectiveCostOfGiving),
    strategies,
    agiLimits: [
      { vehicle: "Cash", limit: "60% of AGI", maxDeduction: Math.round(input.agi * 0.6) },
      { vehicle: "Appreciated Stock", limit: "30% of AGI", maxDeduction: Math.round(input.agi * 0.3) },
      { vehicle: "Private Foundation", limit: "30% cash / 20% property", maxDeduction: Math.round(input.agi * 0.3) },
    ],
  };
}
