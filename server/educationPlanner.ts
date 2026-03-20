/**
 * Education Planner — 529/UTMA/Coverdell comparison & funding projections
 * Part F: Market Completeness
 *
 * Pure computation — no API keys needed.
 */

export type VehicleType = "529" | "coverdell" | "utma" | "roth_ira" | "taxable";

export interface EducationPlanInput {
  childAge: number;
  childName?: string;
  targetAge: number; // e.g. 18
  annualCostToday: number; // current annual college cost
  yearsOfSchool: number; // e.g. 4
  currentSavings: number;
  monthlyContribution: number;
  investmentReturn?: number; // default 0.07
  inflationRate?: number; // education inflation, default 0.05
  marginalTaxRate: number;
  stateTaxRate: number;
  state529Deduction?: boolean; // state offers 529 deduction
  state529DeductionMax?: number;
}

export interface VehicleComparison {
  vehicle: VehicleType;
  label: string;
  projectedBalance: number;
  taxSavings: number;
  effectiveCost: number;
  fundingGap: number;
  pros: string[];
  cons: string[];
  annualContributionLimit: number | null;
}

export interface EducationPlanResult {
  totalProjectedCost: number;
  costByYear: { year: number; age: number; cost: number }[];
  vehicles: VehicleComparison[];
  bestVehicle: string;
  fundingGap: number;
  monthlyNeeded: number;
  strategies: string[];
}

export function planEducation(input: EducationPlanInput): EducationPlanResult {
  const returnRate = input.investmentReturn || 0.07;
  const eduInflation = input.inflationRate || 0.05;
  const yearsToCollege = Math.max(0, input.targetAge - input.childAge);
  const combinedRate = input.marginalTaxRate + input.stateTaxRate;

  // Project future costs
  const costByYear: { year: number; age: number; cost: number }[] = [];
  let totalCost = 0;
  for (let y = 0; y < input.yearsOfSchool; y++) {
    const futureAge = input.targetAge + y;
    const futureCost = input.annualCostToday * Math.pow(1 + eduInflation, yearsToCollege + y);
    costByYear.push({ year: y + 1, age: futureAge, cost: Math.round(futureCost) });
    totalCost += futureCost;
  }

  // Project savings growth for each vehicle
  function projectGrowth(monthlyContrib: number, taxDrag: number): number {
    let balance = input.currentSavings;
    const effectiveReturn = returnRate * (1 - taxDrag);
    for (let m = 0; m < yearsToCollege * 12; m++) {
      balance += monthlyContrib;
      balance *= 1 + effectiveReturn / 12;
    }
    return balance;
  }

  // 529 Plan
  const balance529 = projectGrowth(input.monthlyContribution, 0); // Tax-free growth
  const stateDed = input.state529Deduction ? Math.min(input.monthlyContribution * 12, input.state529DeductionMax || 10000) * input.stateTaxRate : 0;
  const tax529 = stateDed * yearsToCollege;

  // Coverdell ESA
  const coverdellMax = 2000 / 12; // $2K/year limit
  const coverdellMonthly = Math.min(input.monthlyContribution, coverdellMax);
  const balanceCoverdell = projectGrowth(coverdellMonthly, 0);

  // UTMA/UGMA
  const balanceUTMA = projectGrowth(input.monthlyContribution, 0.15); // Kiddie tax drag
  const utmaTaxDrag = (balanceUTMA - input.currentSavings - input.monthlyContribution * yearsToCollege * 12) * 0.15;

  // Roth IRA (for education)
  const rothMax = 583; // ~$7K/year / 12
  const rothMonthly = Math.min(input.monthlyContribution, rothMax);
  const balanceRoth = projectGrowth(rothMonthly, 0);

  // Taxable brokerage
  const balanceTaxable = projectGrowth(input.monthlyContribution, 0.15);

  const vehicles: VehicleComparison[] = [
    {
      vehicle: "529",
      label: "529 College Savings Plan",
      projectedBalance: Math.round(balance529),
      taxSavings: Math.round(tax529 + (balance529 - input.currentSavings - input.monthlyContribution * yearsToCollege * 12) * combinedRate),
      effectiveCost: Math.round(input.monthlyContribution * yearsToCollege * 12 - tax529),
      fundingGap: Math.round(Math.max(0, totalCost - balance529)),
      pros: ["Tax-free growth & withdrawals for education", "High contribution limits ($300K+)", "State tax deduction (if applicable)", "Can change beneficiary"],
      cons: ["10% penalty on non-education withdrawals", "Limited investment options", "Counts as parental asset for FAFSA (5.64%)"],
      annualContributionLimit: null, // Gift tax limit applies
    },
    {
      vehicle: "coverdell",
      label: "Coverdell ESA",
      projectedBalance: Math.round(balanceCoverdell),
      taxSavings: Math.round((balanceCoverdell - input.currentSavings - coverdellMonthly * yearsToCollege * 12) * combinedRate),
      effectiveCost: Math.round(coverdellMonthly * yearsToCollege * 12),
      fundingGap: Math.round(Math.max(0, totalCost - balanceCoverdell)),
      pros: ["Tax-free growth", "Can use for K-12 expenses too", "More investment flexibility than 529"],
      cons: ["$2,000/year contribution limit", "Income limits apply", "Must be used by age 30"],
      annualContributionLimit: 2000,
    },
    {
      vehicle: "utma",
      label: "UTMA/UGMA Custodial",
      projectedBalance: Math.round(balanceUTMA),
      taxSavings: Math.round(-utmaTaxDrag), // Negative = tax cost
      effectiveCost: Math.round(input.monthlyContribution * yearsToCollege * 12 + utmaTaxDrag),
      fundingGap: Math.round(Math.max(0, totalCost - balanceUTMA)),
      pros: ["No contribution limits", "Flexible use (not just education)", "Lower kiddie tax on first $2,500"],
      cons: ["Child owns at age of majority", "Kiddie tax on unearned income", "Counts as student asset for FAFSA (20%)", "Cannot change beneficiary"],
      annualContributionLimit: null,
    },
    {
      vehicle: "roth_ira",
      label: "Roth IRA (for education)",
      projectedBalance: Math.round(balanceRoth),
      taxSavings: Math.round((balanceRoth - input.currentSavings - rothMonthly * yearsToCollege * 12) * combinedRate),
      effectiveCost: Math.round(rothMonthly * yearsToCollege * 12),
      fundingGap: Math.round(Math.max(0, totalCost - balanceRoth)),
      pros: ["Contributions withdrawable anytime tax-free", "Not counted on FAFSA", "If not needed for education, grows for retirement"],
      cons: ["$7,000/year limit", "Earnings withdrawal may be taxed", "Reduces retirement savings"],
      annualContributionLimit: 7000,
    },
    {
      vehicle: "taxable",
      label: "Taxable Brokerage",
      projectedBalance: Math.round(balanceTaxable),
      taxSavings: 0,
      effectiveCost: Math.round(input.monthlyContribution * yearsToCollege * 12),
      fundingGap: Math.round(Math.max(0, totalCost - balanceTaxable)),
      pros: ["No contribution limits", "Complete flexibility", "Tax-loss harvesting available"],
      cons: ["No tax advantages", "Annual tax drag on dividends/gains", "Counts as parental asset for FAFSA"],
      annualContributionLimit: null,
    },
  ];

  const best = vehicles.reduce((a, b) => {
    const aScore = a.projectedBalance + a.taxSavings;
    const bScore = b.projectedBalance + b.taxSavings;
    return aScore > bScore ? a : b;
  });

  // Calculate monthly needed to fully fund
  const gap = Math.max(0, totalCost - input.currentSavings * Math.pow(1 + returnRate, yearsToCollege));
  const monthlyNeeded = yearsToCollege > 0
    ? gap / ((Math.pow(1 + returnRate / 12, yearsToCollege * 12) - 1) / (returnRate / 12))
    : gap;

  const strategies: string[] = [
    `Start with 529 for tax-free growth${input.state529Deduction ? " + state deduction" : ""}`,
    "Consider superfunding: 5-year gift tax averaging ($90K single / $180K couple in one year)",
    yearsToCollege <= 5 ? "Short timeline: shift to conservative allocation (bond-heavy)" : "Long timeline: aggressive growth allocation appropriate",
    "Apply for scholarships early — reduces needed savings",
    "Consider community college for first 2 years to reduce total cost by 40-60%",
  ];

  if (input.childAge <= 5) {
    strategies.push("Maximize time in market — even small monthly contributions compound significantly over 13+ years");
  }

  return {
    totalProjectedCost: Math.round(totalCost),
    costByYear,
    vehicles,
    bestVehicle: best.vehicle,
    fundingGap: Math.round(best.fundingGap),
    monthlyNeeded: Math.round(monthlyNeeded),
    strategies,
  };
}
