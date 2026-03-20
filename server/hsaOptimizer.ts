/**
 * HSA Optimizer — Health Savings Account strategy engine
 * Part F: Market Completeness
 *
 * Pure computation — no API keys needed.
 * Triple tax advantage modeling, investment growth, Medicare coordination.
 */

export type CoverageType = "self" | "family";

export interface HSAInput {
  age: number;
  coverageType: CoverageType;
  currentBalance: number;
  annualContribution: number;
  employerContribution?: number;
  annualMedicalExpenses: number;
  investmentReturn?: number; // default 0.07
  marginalTaxRate: number;
  stateTaxRate: number;
  yearsToRetirement: number;
  yearsInRetirement?: number;
  expectedRetirementMedicalExpenses?: number;
}

export interface HSAProjection {
  year: number;
  age: number;
  contribution: number;
  employerContribution: number;
  medicalExpenses: number;
  investmentGrowth: number;
  endBalance: number;
  taxSavings: number;
  cumulativeTaxSavings: number;
}

export interface HSAStrategy {
  name: string;
  description: string;
  projections: HSAProjection[];
  finalBalance: number;
  totalTaxSavings: number;
  totalContributions: number;
  totalGrowth: number;
  effectiveTaxRate: number;
}

export interface HSAResult {
  strategies: HSAStrategy[];
  bestStrategy: string;
  maxContribution: number;
  catchUpEligible: boolean;
  catchUpAmount: number;
  medicareNote: string;
  tripleAdvantage: {
    incomeTaxSaved: number;
    ficaSaved: number;
    investmentTaxSaved: number;
    totalLifetimeSavings: number;
  };
}

// 2025 limits
const HSA_LIMITS_2025 = {
  self: 4300,
  family: 8550,
  catchUp: 1000, // age 55+
};

export function optimizeHSA(input: HSAInput): HSAResult {
  const returnRate = input.investmentReturn || 0.07;
  const combinedRate = input.marginalTaxRate + input.stateTaxRate;
  const catchUpEligible = input.age >= 55;
  const maxContrib = HSA_LIMITS_2025[input.coverageType] + (catchUpEligible ? HSA_LIMITS_2025.catchUp : 0);
  const employerContrib = input.employerContribution || 0;
  const retirementYears = input.yearsInRetirement || 25;
  const retMedExpenses = input.expectedRetirementMedicalExpenses || input.annualMedicalExpenses * 2.5;

  function buildProjections(strategy: "maximize" | "pay_medical" | "minimum", label: string): HSAStrategy {
    const projections: HSAProjection[] = [];
    let balance = input.currentBalance;
    let cumulativeTax = 0;
    let totalContribs = 0;
    let totalGrowth = 0;

    const totalYears = input.yearsToRetirement + retirementYears;

    for (let y = 0; y < totalYears; y++) {
      const currentAge = input.age + y;
      const isRetired = y >= input.yearsToRetirement;
      const isMedicare = currentAge >= 65;

      // Contributions (stop at Medicare for new contributions, but can still use)
      let contrib = 0;
      if (!isMedicare) {
        const yearCatchUp = currentAge >= 55 ? HSA_LIMITS_2025.catchUp : 0;
        const yearMax = HSA_LIMITS_2025[input.coverageType] + yearCatchUp;
        switch (strategy) {
          case "maximize": contrib = Math.min(yearMax - employerContrib, yearMax); break;
          case "pay_medical": contrib = Math.min(input.annualContribution, yearMax - employerContrib); break;
          case "minimum": contrib = Math.min(input.annualMedicalExpenses, yearMax - employerContrib); break;
        }
      }

      const empContrib = isMedicare ? 0 : employerContrib;
      const medExpenses = strategy === "maximize" ? 0 : (isRetired ? retMedExpenses : input.annualMedicalExpenses);
      const withdrawal = strategy === "maximize" && !isRetired ? 0 : Math.min(medExpenses, balance + contrib + empContrib);

      balance += contrib + empContrib - withdrawal;
      const growth = balance * returnRate;
      balance += growth;

      const taxSaved = (contrib + empContrib) * combinedRate + (withdrawal > 0 ? withdrawal * combinedRate : 0) + growth * 0.238;
      cumulativeTax += taxSaved;
      totalContribs += contrib + empContrib;
      totalGrowth += growth;

      projections.push({
        year: y + 1,
        age: currentAge,
        contribution: Math.round(contrib + empContrib),
        employerContribution: Math.round(empContrib),
        medicalExpenses: Math.round(withdrawal),
        investmentGrowth: Math.round(growth),
        endBalance: Math.round(balance),
        taxSavings: Math.round(taxSaved),
        cumulativeTaxSavings: Math.round(cumulativeTax),
      });
    }

    return {
      name: label,
      description: strategy === "maximize"
        ? "Max contributions, invest everything, pay medical out-of-pocket"
        : strategy === "pay_medical"
          ? "Contribute and use for current medical expenses"
          : "Contribute only enough to cover medical expenses",
      projections,
      finalBalance: Math.round(balance),
      totalTaxSavings: Math.round(cumulativeTax),
      totalContributions: Math.round(totalContribs),
      totalGrowth: Math.round(totalGrowth),
      effectiveTaxRate: totalContribs > 0 ? +(cumulativeTax / totalContribs).toFixed(3) : 0,
    };
  }

  const strategies = [
    buildProjections("maximize", "Maximize & Invest"),
    buildProjections("pay_medical", "Balanced"),
    buildProjections("minimum", "Medical-Only"),
  ];

  const best = strategies.reduce((a, b) => a.totalTaxSavings > b.totalTaxSavings ? a : b);

  // Triple advantage calculation
  const annualContrib = Math.min(input.annualContribution, maxContrib);
  const ficaRate = 0.0765;
  const incomeTaxSaved = annualContrib * combinedRate * input.yearsToRetirement;
  const ficaSaved = annualContrib * ficaRate * input.yearsToRetirement;
  const investmentTaxSaved = best.totalGrowth * 0.238;

  return {
    strategies,
    bestStrategy: best.name,
    maxContribution: maxContrib,
    catchUpEligible,
    catchUpAmount: catchUpEligible ? HSA_LIMITS_2025.catchUp : 0,
    medicareNote: input.age >= 63
      ? "Stop HSA contributions 6 months before Medicare enrollment to avoid penalties"
      : "Plan to stop contributions before Medicare Part A enrollment",
    tripleAdvantage: {
      incomeTaxSaved: Math.round(incomeTaxSaved),
      ficaSaved: Math.round(ficaSaved),
      investmentTaxSaved: Math.round(investmentTaxSaved),
      totalLifetimeSavings: Math.round(incomeTaxSaved + ficaSaved + investmentTaxSaved),
    },
  };
}
