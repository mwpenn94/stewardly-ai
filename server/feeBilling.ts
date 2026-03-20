/**
 * Fee Billing Calculator — AUM, flat, hourly, tiered fee modeling
 * Part F: Operational Tools
 *
 * No API keys needed. Calculates advisory fees across billing models.
 */

export type FeeModel = "aum_flat" | "aum_tiered" | "flat_fee" | "hourly" | "retainer" | "performance";

export interface AUMTier {
  upTo: number; // e.g. 500000
  rate: number; // e.g. 0.01 for 1%
}

export interface FeeInput {
  model: FeeModel;
  aum?: number;
  aumTiers?: AUMTier[];
  flatRate?: number; // For aum_flat, e.g. 0.01
  flatFeeAnnual?: number; // For flat_fee model
  hourlyRate?: number;
  hoursPerQuarter?: number;
  retainerMonthly?: number;
  performanceFeeRate?: number;
  benchmarkReturn?: number;
  actualReturn?: number;
  billingFrequency: "monthly" | "quarterly" | "semi_annual" | "annual";
  householdDiscount?: number; // e.g. 0.10 for 10%
  minimumFee?: number;
}

export interface FeeBreakdown {
  model: string;
  annualFee: number;
  periodicFee: number;
  periodicLabel: string;
  effectiveRate: number;
  tierBreakdown?: { tier: string; amount: number; rate: number }[];
  discountApplied: number;
  minimumApplied: boolean;
  feePercentOfAUM: number;
  comparisonToIndustry: {
    averageRate: number;
    percentile: string;
    savings: number;
  };
}

export interface FeeComparisonResult {
  models: FeeBreakdown[];
  bestValue: string;
  totalFeesOverTime: { year: number; fee: number; cumulativeFee: number; portfolioWithFee: number; portfolioWithout: number }[];
  feeImpactOn1M: number;
}

function periodDivisor(freq: string): number {
  switch (freq) {
    case "monthly": return 12;
    case "quarterly": return 4;
    case "semi_annual": return 2;
    case "annual": return 1;
    default: return 4;
  }
}

function periodLabel(freq: string): string {
  switch (freq) {
    case "monthly": return "Monthly";
    case "quarterly": return "Quarterly";
    case "semi_annual": return "Semi-Annual";
    case "annual": return "Annual";
    default: return "Quarterly";
  }
}

export function calculateFee(input: FeeInput): FeeBreakdown {
  let annualFee = 0;
  let tierBreakdown: { tier: string; amount: number; rate: number }[] | undefined;
  const aum = input.aum || 0;

  switch (input.model) {
    case "aum_flat":
      annualFee = aum * (input.flatRate || 0.01);
      break;

    case "aum_tiered": {
      tierBreakdown = [];
      const tiers = input.aumTiers || [
        { upTo: 500000, rate: 0.012 },
        { upTo: 1000000, rate: 0.01 },
        { upTo: 5000000, rate: 0.008 },
        { upTo: Infinity, rate: 0.005 },
      ];
      let remaining = aum;
      let prevLimit = 0;
      for (const tier of tiers) {
        const tierAmount = Math.min(remaining, tier.upTo - prevLimit);
        if (tierAmount <= 0) break;
        const fee = tierAmount * tier.rate;
        annualFee += fee;
        tierBreakdown.push({
          tier: `$${prevLimit.toLocaleString()} - $${tier.upTo === Infinity ? "∞" : tier.upTo.toLocaleString()}`,
          amount: Math.round(fee),
          rate: tier.rate,
        });
        remaining -= tierAmount;
        prevLimit = tier.upTo;
      }
      break;
    }

    case "flat_fee":
      annualFee = input.flatFeeAnnual || 5000;
      break;

    case "hourly":
      annualFee = (input.hourlyRate || 250) * (input.hoursPerQuarter || 5) * 4;
      break;

    case "retainer":
      annualFee = (input.retainerMonthly || 500) * 12;
      break;

    case "performance": {
      const baseFee = aum * 0.005; // 0.5% base
      const excess = Math.max(0, (input.actualReturn || 0) - (input.benchmarkReturn || 0));
      const perfFee = aum * excess * (input.performanceFeeRate || 0.20);
      annualFee = baseFee + perfFee;
      break;
    }
  }

  // Apply household discount
  const discount = annualFee * (input.householdDiscount || 0);
  annualFee -= discount;

  // Apply minimum
  const minimumApplied = input.minimumFee ? annualFee < input.minimumFee : false;
  if (minimumApplied && input.minimumFee) annualFee = input.minimumFee;

  const periods = periodDivisor(input.billingFrequency);
  const effectiveRate = aum > 0 ? annualFee / aum : 0;

  // Industry comparison (approximate)
  const industryAvg = 0.01; // 1% average
  const savings = aum * industryAvg - annualFee;

  return {
    model: input.model,
    annualFee: Math.round(annualFee),
    periodicFee: Math.round(annualFee / periods),
    periodicLabel: periodLabel(input.billingFrequency),
    effectiveRate: +effectiveRate.toFixed(4),
    tierBreakdown,
    discountApplied: Math.round(discount),
    minimumApplied,
    feePercentOfAUM: aum > 0 ? +(effectiveRate * 100).toFixed(2) : 0,
    comparisonToIndustry: {
      averageRate: industryAvg,
      percentile: effectiveRate < 0.005 ? "Bottom 25%" : effectiveRate < 0.01 ? "Below Average" : effectiveRate < 0.015 ? "Average" : "Above Average",
      savings: Math.round(savings),
    },
  };
}

export function compareFeeModels(aum: number, years: number = 20, returnRate: number = 0.07): FeeComparisonResult {
  const models: FeeInput[] = [
    { model: "aum_flat", aum, flatRate: 0.01, billingFrequency: "quarterly" },
    { model: "aum_tiered", aum, billingFrequency: "quarterly" },
    { model: "flat_fee", aum, flatFeeAnnual: 5000, billingFrequency: "quarterly" },
    { model: "hourly", aum, hourlyRate: 300, hoursPerQuarter: 5, billingFrequency: "quarterly" },
    { model: "retainer", aum, retainerMonthly: 500, billingFrequency: "monthly" },
  ];

  const results = models.map(m => calculateFee(m));
  const best = results.reduce((a, b) => a.annualFee < b.annualFee ? a : b);

  // Project fee impact over time
  const timeline: { year: number; fee: number; cumulativeFee: number; portfolioWithFee: number; portfolioWithout: number }[] = [];
  let portfolioWith = aum;
  let portfolioWithout = aum;
  let cumulativeFee = 0;
  const avgFeeRate = best.effectiveRate;

  for (let y = 1; y <= years; y++) {
    portfolioWithout *= (1 + returnRate);
    const yearFee = portfolioWith * avgFeeRate;
    portfolioWith = portfolioWith * (1 + returnRate) - yearFee;
    cumulativeFee += yearFee;
    timeline.push({
      year: y,
      fee: Math.round(yearFee),
      cumulativeFee: Math.round(cumulativeFee),
      portfolioWithFee: Math.round(portfolioWith),
      portfolioWithout: Math.round(portfolioWithout),
    });
  }

  return {
    models: results,
    bestValue: best.model,
    totalFeesOverTime: timeline,
    feeImpactOn1M: Math.round(portfolioWithout - portfolioWith),
  };
}
