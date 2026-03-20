/**
 * Statistical Models Library
 * Full implementations for all 8 analytical models:
 * 1. Monte Carlo Retirement Simulation
 * 2. Debt Optimization (Avalanche/Snowball/Hybrid)
 * 3. Tax Optimization (Bracket analysis, Roth conversion)
 * 4. Cash Flow Projection (Income/expense forecasting)
 * 5. Insurance Gap Analysis (Coverage needs vs policies)
 * 6. Estate Planning (Tax exposure, beneficiary optimization)
 * 7. Education Funding (529 projections, financial aid)
 * 8. Risk Tolerance Scoring (Questionnaire + behavioral)
 */

// ─── Utility: Random Normal Distribution (Box-Muller) ──────────────────────

function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. MONTE CARLO RETIREMENT SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

export interface RetirementInput {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  annualContribution: number;
  contributionGrowthRate: number; // annual % increase in contributions
  expectedReturn: number; // annual mean return (e.g., 0.07)
  returnStdDev: number; // annual return std deviation (e.g., 0.15)
  inflationRate: number; // e.g., 0.03
  annualExpensesInRetirement: number; // today's dollars
  socialSecurityAnnual: number;
  socialSecurityStartAge: number;
  simulations?: number; // default 10000
}

export interface RetirementOutput {
  successRate: number; // % of simulations where money lasted
  medianEndingBalance: number;
  percentile10: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  medianBalanceAtRetirement: number;
  yearByYearMedian: Array<{ age: number; balance: number }>;
  shortfallYears: number; // median years short if failed
  recommendedAdditionalSavings: number;
  inflationAdjustedExpenses: number;
  totalContributions: number;
}

export function monteCarloRetirement(input: RetirementInput): RetirementOutput {
  const sims = input.simulations ?? 10000;
  const yearsToRetirement = input.retirementAge - input.currentAge;
  const yearsInRetirement = input.lifeExpectancy - input.retirementAge;
  const totalYears = yearsToRetirement + yearsInRetirement;

  const endingBalances: number[] = [];
  const balancesAtRetirement: number[] = [];
  const shortfallYears: number[] = [];
  const yearBalances: number[][] = Array.from({ length: totalYears + 1 }, () => []);

  for (let sim = 0; sim < sims; sim++) {
    let balance = input.currentSavings;
    let contribution = input.annualContribution;
    let failed = false;
    let failYear = totalYears;

    for (let year = 0; year <= totalYears; year++) {
      yearBalances[year].push(balance);

      if (year === yearsToRetirement) {
        balancesAtRetirement.push(balance);
      }

      if (year >= totalYears) break;

      // Annual return with random variation
      const annualReturn = randomNormal(input.expectedReturn, input.returnStdDev);
      balance *= (1 + annualReturn);

      if (year < yearsToRetirement) {
        // Accumulation phase
        balance += contribution;
        contribution *= (1 + input.contributionGrowthRate);
      } else {
        // Distribution phase
        const yearsFromNow = year;
        const inflationMultiplier = Math.pow(1 + input.inflationRate, yearsFromNow);
        const adjustedExpenses = input.annualExpensesInRetirement * inflationMultiplier;

        let ssIncome = 0;
        const currentAge = input.currentAge + year;
        if (currentAge >= input.socialSecurityStartAge) {
          ssIncome = input.socialSecurityAnnual * inflationMultiplier;
        }

        const withdrawal = Math.max(0, adjustedExpenses - ssIncome);
        balance -= withdrawal;

        if (balance <= 0 && !failed) {
          failed = true;
          failYear = year - yearsToRetirement;
          balance = 0;
        }
      }
    }

    endingBalances.push(Math.max(0, balance));
    if (failed) {
      shortfallYears.push(yearsInRetirement - failYear);
    }
  }

  const successCount = endingBalances.filter(b => b > 0).length;
  const successRate = (successCount / sims) * 100;

  // Year-by-year median balances
  const yearByYearMedian = yearBalances.map((balances, idx) => ({
    age: input.currentAge + idx,
    balance: Math.round(percentile(balances, 50)),
  }));

  // Calculate recommended additional savings if success rate < 90%
  let recommendedAdditional = 0;
  if (successRate < 90) {
    // Binary search for the additional contribution needed
    let low = 0;
    let high = input.annualContribution * 5;
    for (let iter = 0; iter < 20; iter++) {
      const mid = (low + high) / 2;
      const testInput = { ...input, annualContribution: input.annualContribution + mid, simulations: 1000 };
      const testResult = monteCarloRetirementQuick(testInput);
      if (testResult < 90) {
        low = mid;
      } else {
        high = mid;
      }
    }
    recommendedAdditional = Math.round((low + high) / 2);
  }

  const inflationAdjustedExpenses = input.annualExpensesInRetirement *
    Math.pow(1 + input.inflationRate, yearsToRetirement);

  const totalContributions = calculateTotalContributions(
    input.annualContribution, input.contributionGrowthRate, yearsToRetirement
  );

  return {
    successRate: Math.round(successRate * 10) / 10,
    medianEndingBalance: Math.round(percentile(endingBalances, 50)),
    percentile10: Math.round(percentile(endingBalances, 10)),
    percentile25: Math.round(percentile(endingBalances, 25)),
    percentile75: Math.round(percentile(endingBalances, 75)),
    percentile90: Math.round(percentile(endingBalances, 90)),
    medianBalanceAtRetirement: Math.round(percentile(balancesAtRetirement, 50)),
    yearByYearMedian,
    shortfallYears: shortfallYears.length > 0 ? Math.round(percentile(shortfallYears, 50)) : 0,
    recommendedAdditionalSavings: recommendedAdditional,
    inflationAdjustedExpenses: Math.round(inflationAdjustedExpenses),
    totalContributions: Math.round(totalContributions),
  };
}

function monteCarloRetirementQuick(input: RetirementInput): number {
  const sims = input.simulations ?? 1000;
  const yearsToRetirement = input.retirementAge - input.currentAge;
  const totalYears = yearsToRetirement + (input.lifeExpectancy - input.retirementAge);
  let successCount = 0;

  for (let sim = 0; sim < sims; sim++) {
    let balance = input.currentSavings;
    let contribution = input.annualContribution;
    let survived = true;

    for (let year = 0; year < totalYears; year++) {
      const annualReturn = randomNormal(input.expectedReturn, input.returnStdDev);
      balance *= (1 + annualReturn);

      if (year < yearsToRetirement) {
        balance += contribution;
        contribution *= (1 + input.contributionGrowthRate);
      } else {
        const inflationMultiplier = Math.pow(1 + input.inflationRate, year);
        const expenses = input.annualExpensesInRetirement * inflationMultiplier;
        const currentAge = input.currentAge + year;
        const ss = currentAge >= input.socialSecurityStartAge
          ? input.socialSecurityAnnual * inflationMultiplier : 0;
        balance -= Math.max(0, expenses - ss);
        if (balance <= 0) { survived = false; break; }
      }
    }
    if (survived) successCount++;
  }
  return (successCount / sims) * 100;
}

function calculateTotalContributions(annual: number, growth: number, years: number): number {
  let total = 0;
  let current = annual;
  for (let i = 0; i < years; i++) {
    total += current;
    current *= (1 + growth);
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. DEBT OPTIMIZATION MODEL
// ═══════════════════════════════════════════════════════════════════════════

export interface DebtItem {
  name: string;
  balance: number;
  interestRate: number; // annual, e.g., 0.18
  minimumPayment: number;
  type: "credit_card" | "student_loan" | "mortgage" | "auto" | "personal" | "other";
}

export interface DebtOptimizationInput {
  debts: DebtItem[];
  monthlyBudget: number; // total available for debt payments
  extraPayment: number; // additional monthly amount above minimums
}

interface DebtPayoffSchedule {
  strategy: string;
  totalInterestPaid: number;
  totalPaid: number;
  monthsToPayoff: number;
  debtFreeDate: string;
  monthlySchedule: Array<{
    month: number;
    debtName: string;
    payment: number;
    remainingBalance: number;
    interestPaid: number;
  }>;
  payoffOrder: string[];
  interestSaved: number; // vs minimum payments only
}

export interface DebtOptimizationOutput {
  avalanche: DebtPayoffSchedule;
  snowball: DebtPayoffSchedule;
  hybrid: DebtPayoffSchedule;
  minimumOnly: { totalInterestPaid: number; monthsToPayoff: number; totalPaid: number };
  recommendation: string;
  totalDebt: number;
  weightedAverageRate: number;
}

export function optimizeDebt(input: DebtOptimizationInput): DebtOptimizationOutput {
  const totalDebt = input.debts.reduce((sum, d) => sum + d.balance, 0);
  const weightedRate = input.debts.reduce((sum, d) => sum + d.balance * d.interestRate, 0) / totalDebt;

  // Calculate minimum-only payoff
  const minOnly = simulatePayoff(input.debts, 0, "avalanche");

  // Avalanche: highest interest rate first
  const avalanche = simulatePayoff(input.debts, input.extraPayment, "avalanche");
  avalanche.interestSaved = minOnly.totalInterestPaid - avalanche.totalInterestPaid;

  // Snowball: lowest balance first
  const snowball = simulatePayoff(input.debts, input.extraPayment, "snowball");
  snowball.interestSaved = minOnly.totalInterestPaid - snowball.totalInterestPaid;

  // Hybrid: small debts first (< $1000) then avalanche
  const hybrid = simulatePayoff(input.debts, input.extraPayment, "hybrid");
  hybrid.interestSaved = minOnly.totalInterestPaid - hybrid.totalInterestPaid;

  // Recommendation logic
  const interestDiff = avalanche.totalInterestPaid - snowball.totalInterestPaid;
  const smallDebts = input.debts.filter(d => d.balance < 1000).length;
  let recommendation: string;

  if (interestDiff > 500 && smallDebts === 0) {
    recommendation = "Avalanche method recommended — saves the most interest with no quick wins available.";
  } else if (smallDebts >= 2 && interestDiff < 200) {
    recommendation = "Snowball method recommended — quick wins from small debts will build momentum with minimal interest cost.";
  } else {
    recommendation = "Hybrid method recommended — eliminates small debts quickly then targets highest-rate debts.";
  }

  return {
    avalanche,
    snowball,
    hybrid,
    minimumOnly: {
      totalInterestPaid: minOnly.totalInterestPaid,
      monthsToPayoff: minOnly.monthsToPayoff,
      totalPaid: minOnly.totalPaid,
    },
    recommendation,
    totalDebt: Math.round(totalDebt * 100) / 100,
    weightedAverageRate: Math.round(weightedRate * 10000) / 10000,
  };
}

function simulatePayoff(
  debts: DebtItem[],
  extraPayment: number,
  strategy: "avalanche" | "snowball" | "hybrid",
): DebtPayoffSchedule {
  const balances = debts.map(d => d.balance);
  const rates = debts.map(d => d.interestRate / 12);
  const mins = debts.map(d => d.minimumPayment);
  const names = debts.map(d => d.name);

  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const maxMonths = 600; // 50 years cap
  const payoffOrder: string[] = [];
  const schedule: DebtPayoffSchedule["monthlySchedule"] = [];

  // Determine priority order
  let priorityOrder: number[];
  if (strategy === "avalanche") {
    priorityOrder = debts.map((_, i) => i).sort((a, b) => debts[b].interestRate - debts[a].interestRate);
  } else if (strategy === "snowball") {
    priorityOrder = debts.map((_, i) => i).sort((a, b) => debts[a].balance - debts[b].balance);
  } else {
    // Hybrid: small debts first (< $1000), then avalanche
    const small = debts.map((_, i) => i).filter(i => debts[i].balance < 1000).sort((a, b) => debts[a].balance - debts[b].balance);
    const large = debts.map((_, i) => i).filter(i => debts[i].balance >= 1000).sort((a, b) => debts[b].interestRate - debts[a].interestRate);
    priorityOrder = [...small, ...large];
  }

  while (balances.some(b => b > 0.01) && month < maxMonths) {
    month++;

    // Apply interest
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] > 0) {
        const interest = balances[i] * rates[i];
        balances[i] += interest;
        totalInterest += interest;
      }
    }

    // Pay minimums
    let remaining = extraPayment;
    for (let i = 0; i < balances.length; i++) {
      if (balances[i] > 0) {
        const payment = Math.min(mins[i], balances[i]);
        balances[i] -= payment;
        totalPaid += payment;

        if (balances[i] <= 0.01) {
          remaining += mins[i] - payment; // freed-up minimum
          balances[i] = 0;
          if (!payoffOrder.includes(names[i])) payoffOrder.push(names[i]);
        }
      }
    }

    // Apply extra payment to priority debt
    for (const idx of priorityOrder) {
      if (balances[idx] > 0 && remaining > 0) {
        const payment = Math.min(remaining, balances[idx]);
        balances[idx] -= payment;
        remaining -= payment;
        totalPaid += payment;

        if (balances[idx] <= 0.01) {
          balances[idx] = 0;
          if (!payoffOrder.includes(names[idx])) payoffOrder.push(names[idx]);
        }
      }
    }

    // Record first 12 months and every 6th month after
    if (month <= 12 || month % 6 === 0) {
      for (let i = 0; i < balances.length; i++) {
        if (balances[i] > 0 || month <= 2) {
          schedule.push({
            month,
            debtName: names[i],
            payment: mins[i] + (priorityOrder[0] === i ? extraPayment : 0),
            remainingBalance: Math.round(balances[i] * 100) / 100,
            interestPaid: Math.round(balances[i] * rates[i] * 100) / 100,
          });
        }
      }
    }
  }

  const now = new Date();
  now.setMonth(now.getMonth() + month);

  return {
    strategy,
    totalInterestPaid: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    monthsToPayoff: month,
    debtFreeDate: now.toISOString().split("T")[0],
    monthlySchedule: schedule,
    payoffOrder,
    interestSaved: 0, // filled in by caller
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. TAX OPTIMIZATION MODEL
// ═══════════════════════════════════════════════════════════════════════════

export interface TaxOptimizationInput {
  filingStatus: "single" | "married_joint" | "married_separate" | "head_of_household";
  grossIncome: number;
  w2Income: number;
  selfEmploymentIncome: number;
  capitalGainsShortTerm: number;
  capitalGainsLongTerm: number;
  dividendsQualified: number;
  dividendsOrdinary: number;
  deductions: {
    mortgage: number;
    stateLocalTax: number;
    charitableGiving: number;
    medicalExpenses: number;
    studentLoanInterest: number;
    businessExpenses: number;
    retirementContributions: number;
    hsaContributions: number;
  };
  traditionalIraBalance: number;
  rothIraBalance: number;
  age: number;
  state: string;
}

export interface TaxOptimizationOutput {
  currentTaxLiability: number;
  effectiveRate: number;
  marginalRate: number;
  standardVsItemized: { standard: number; itemized: number; recommendation: string };
  rothConversion: {
    recommended: boolean;
    optimalAmount: number;
    taxCostNow: number;
    projectedSavings20yr: number;
    breakEvenYears: number;
  };
  taxLossHarvesting: { potentialSavings: number; recommendation: string };
  charitableStrategy: { currentDeduction: number; bundlingBenefit: number; dafRecommended: boolean };
  retirementOptimization: {
    current401kBenefit: number;
    maxContributionBenefit: number;
    hsaBenefit: number;
    recommendation: string;
  };
  bracketAnalysis: Array<{ bracket: string; rate: number; taxInBracket: number; incomeInBracket: number }>;
  totalOptimizedSavings: number;
}

// 2025/2026 Federal Tax Brackets
const TAX_BRACKETS = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  married_joint: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  married_separate: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 365600, rate: 0.35 },
    { min: 365600, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION = {
  single: 14600,
  married_joint: 29200,
  married_separate: 14600,
  head_of_household: 21900,
};

export function optimizeTax(input: TaxOptimizationInput): TaxOptimizationOutput {
  const brackets = TAX_BRACKETS[input.filingStatus];
  const standardDed = STANDARD_DEDUCTION[input.filingStatus];

  // Calculate itemized deductions
  const saltCap = Math.min(input.deductions.stateLocalTax, 10000);
  const medicalThreshold = input.grossIncome * 0.075;
  const medicalDed = Math.max(0, input.deductions.medicalExpenses - medicalThreshold);
  const itemizedTotal = input.deductions.mortgage + saltCap + input.deductions.charitableGiving +
    medicalDed + input.deductions.studentLoanInterest;

  const useItemized = itemizedTotal > standardDed;
  const deduction = useItemized ? itemizedTotal : standardDed;

  // Above-the-line deductions
  const aboveLine = input.deductions.retirementContributions + input.deductions.hsaContributions +
    input.deductions.studentLoanInterest;

  // Taxable income
  const ordinaryIncome = input.grossIncome - input.capitalGainsLongTerm - input.dividendsQualified;
  const taxableOrdinary = Math.max(0, ordinaryIncome - aboveLine - deduction);

  // Calculate tax on ordinary income
  const bracketAnalysis: TaxOptimizationOutput["bracketAnalysis"] = [];
  let remainingIncome = taxableOrdinary;
  let ordinaryTax = 0;
  let marginalRate = 0.10;

  for (const bracket of brackets) {
    const incomeInBracket = Math.min(Math.max(0, remainingIncome), bracket.max - bracket.min);
    const taxInBracket = incomeInBracket * bracket.rate;
    ordinaryTax += taxInBracket;
    remainingIncome -= incomeInBracket;

    if (incomeInBracket > 0) {
      marginalRate = bracket.rate;
      bracketAnalysis.push({
        bracket: `$${bracket.min.toLocaleString()} - $${bracket.max === Infinity ? "∞" : bracket.max.toLocaleString()}`,
        rate: bracket.rate,
        taxInBracket: Math.round(taxInBracket),
        incomeInBracket: Math.round(incomeInBracket),
      });
    }
  }

  // Long-term capital gains tax (simplified: 0%, 15%, 20%)
  const ltcgRate = taxableOrdinary > 492300 ? 0.20 : taxableOrdinary > 44625 ? 0.15 : 0;
  const ltcgTax = input.capitalGainsLongTerm * ltcgRate;
  const stcgTax = input.capitalGainsShortTerm * marginalRate;
  const qualDivTax = input.dividendsQualified * ltcgRate;

  const totalTax = ordinaryTax + ltcgTax + stcgTax + qualDivTax;
  const effectiveRate = totalTax / input.grossIncome;

  // Roth conversion analysis
  const rothConversion = analyzeRothConversion(input, marginalRate, brackets);

  // Charitable strategy
  const bundlingBenefit = input.deductions.charitableGiving * 2 > standardDed
    ? (input.deductions.charitableGiving * 2 - standardDed) * marginalRate : 0;

  // Retirement optimization
  const max401k = input.age >= 50 ? 30500 : 23000;
  const maxHsa = input.filingStatus === "married_joint" ? 8300 : 4150;
  const additional401kBenefit = Math.max(0, max401k - input.deductions.retirementContributions) * marginalRate;
  const additionalHsaBenefit = Math.max(0, maxHsa - input.deductions.hsaContributions) * marginalRate;

  let retirementRec = "Current retirement contributions are well-optimized.";
  if (additional401kBenefit > 1000) {
    retirementRec = `Increasing 401(k) contributions to the maximum ($${max401k.toLocaleString()}) would save approximately $${Math.round(additional401kBenefit).toLocaleString()} in taxes.`;
  }

  const totalSavings = additional401kBenefit + additionalHsaBenefit +
    (rothConversion.recommended ? rothConversion.projectedSavings20yr : 0) + bundlingBenefit;

  return {
    currentTaxLiability: Math.round(totalTax),
    effectiveRate: Math.round(effectiveRate * 10000) / 10000,
    marginalRate,
    standardVsItemized: {
      standard: standardDed,
      itemized: Math.round(itemizedTotal),
      recommendation: useItemized
        ? `Itemize — saves $${Math.round((itemizedTotal - standardDed) * marginalRate)} vs standard deduction`
        : `Standard deduction — saves $${Math.round((standardDed - itemizedTotal) * marginalRate)} vs itemizing`,
    },
    rothConversion,
    taxLossHarvesting: {
      potentialSavings: Math.round(input.capitalGainsShortTerm * marginalRate * 0.3),
      recommendation: input.capitalGainsShortTerm > 5000
        ? "Consider harvesting losses to offset short-term gains"
        : "Limited tax-loss harvesting opportunity at current gain levels",
    },
    charitableStrategy: {
      currentDeduction: Math.round(input.deductions.charitableGiving),
      bundlingBenefit: Math.round(bundlingBenefit),
      dafRecommended: input.deductions.charitableGiving > 10000,
    },
    retirementOptimization: {
      current401kBenefit: Math.round(input.deductions.retirementContributions * marginalRate),
      maxContributionBenefit: Math.round(additional401kBenefit),
      hsaBenefit: Math.round(additionalHsaBenefit),
      recommendation: retirementRec,
    },
    bracketAnalysis,
    totalOptimizedSavings: Math.round(totalSavings),
  };
}

function analyzeRothConversion(
  input: TaxOptimizationInput,
  currentMarginalRate: number,
  brackets: typeof TAX_BRACKETS.single,
): TaxOptimizationOutput["rothConversion"] {
  if (input.traditionalIraBalance <= 0) {
    return { recommended: false, optimalAmount: 0, taxCostNow: 0, projectedSavings20yr: 0, breakEvenYears: 0 };
  }

  // Find optimal conversion amount: fill up to next bracket boundary
  const taxableIncome = input.grossIncome - STANDARD_DEDUCTION[input.filingStatus];
  let optimalAmount = 0;

  for (const bracket of brackets) {
    if (taxableIncome < bracket.max && bracket.rate <= currentMarginalRate) {
      optimalAmount = bracket.max - taxableIncome;
      break;
    }
  }

  optimalAmount = Math.min(optimalAmount, input.traditionalIraBalance);
  const taxCostNow = optimalAmount * currentMarginalRate;

  // Project 20-year benefit assuming 7% growth and 25% future tax rate
  const futureGrowth = optimalAmount * Math.pow(1.07, 20);
  const futureTaxOnGrowth = futureGrowth * 0.25;
  const projectedSavings = futureTaxOnGrowth - taxCostNow;

  const breakEvenYears = taxCostNow > 0
    ? Math.ceil(Math.log(taxCostNow / (optimalAmount * 0.25)) / Math.log(1.07))
    : 0;

  return {
    recommended: projectedSavings > 0 && input.age < 60,
    optimalAmount: Math.round(optimalAmount),
    taxCostNow: Math.round(taxCostNow),
    projectedSavings20yr: Math.round(Math.max(0, projectedSavings)),
    breakEvenYears: Math.max(0, breakEvenYears),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. CASH FLOW PROJECTION MODEL
// ═══════════════════════════════════════════════════════════════════════════

export interface CashFlowInput {
  monthlyIncome: Array<{ source: string; amount: number; growthRate: number; seasonal?: number[] }>;
  monthlyExpenses: Array<{ category: string; amount: number; growthRate: number; seasonal?: number[] }>;
  oneTimeEvents: Array<{ month: number; amount: number; description: string; type: "income" | "expense" }>;
  currentCash: number;
  projectionMonths: number; // e.g., 24
  inflationRate: number;
  emergencyFundTarget: number;
}

export interface CashFlowOutput {
  monthlyProjections: Array<{
    month: number;
    date: string;
    totalIncome: number;
    totalExpenses: number;
    netCashFlow: number;
    cumulativeBalance: number;
    emergencyFundRatio: number;
  }>;
  summary: {
    averageMonthlyIncome: number;
    averageMonthlyExpenses: number;
    averageNetCashFlow: number;
    lowestBalance: number;
    lowestBalanceMonth: number;
    highestBalance: number;
    monthsNegative: number;
    savingsRate: number;
    projectedEndBalance: number;
  };
  alerts: Array<{ month: number; type: "warning" | "danger"; message: string }>;
  recommendations: string[];
}

export function projectCashFlow(input: CashFlowInput): CashFlowOutput {
  const projections: CashFlowOutput["monthlyProjections"] = [];
  const alerts: CashFlowOutput["alerts"] = [];
  let balance = input.currentCash;
  let lowestBalance = balance;
  let lowestMonth = 0;
  let highestBalance = balance;
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthsNegative = 0;

  const now = new Date();

  for (let m = 1; m <= input.projectionMonths; m++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() + m);
    const monthIndex = date.getMonth(); // 0-11

    // Calculate income for this month
    let monthIncome = 0;
    for (const src of input.monthlyIncome) {
      const growthFactor = Math.pow(1 + src.growthRate / 12, m);
      const seasonalFactor = src.seasonal ? src.seasonal[monthIndex] ?? 1 : 1;
      monthIncome += src.amount * growthFactor * seasonalFactor;
    }

    // Calculate expenses for this month
    let monthExpenses = 0;
    for (const exp of input.monthlyExpenses) {
      const growthFactor = Math.pow(1 + (exp.growthRate + input.inflationRate) / 12, m);
      const seasonalFactor = exp.seasonal ? exp.seasonal[monthIndex] ?? 1 : 1;
      monthExpenses += exp.amount * growthFactor * seasonalFactor;
    }

    // Add one-time events
    for (const event of input.oneTimeEvents) {
      if (event.month === m) {
        if (event.type === "income") monthIncome += event.amount;
        else monthExpenses += event.amount;
      }
    }

    const netCashFlow = monthIncome - monthExpenses;
    balance += netCashFlow;
    totalIncome += monthIncome;
    totalExpenses += monthExpenses;

    if (balance < lowestBalance) { lowestBalance = balance; lowestMonth = m; }
    if (balance > highestBalance) highestBalance = balance;
    if (netCashFlow < 0) monthsNegative++;

    const emergencyRatio = balance / (input.emergencyFundTarget || 1);

    // Generate alerts
    if (balance < 0) {
      alerts.push({ month: m, type: "danger", message: `Cash balance goes negative ($${Math.round(balance).toLocaleString()})` });
    } else if (emergencyRatio < 0.5) {
      alerts.push({ month: m, type: "warning", message: `Emergency fund below 50% target ($${Math.round(balance).toLocaleString()})` });
    }

    projections.push({
      month: m,
      date: date.toISOString().split("T")[0],
      totalIncome: Math.round(monthIncome),
      totalExpenses: Math.round(monthExpenses),
      netCashFlow: Math.round(netCashFlow),
      cumulativeBalance: Math.round(balance),
      emergencyFundRatio: Math.round(emergencyRatio * 100) / 100,
    });
  }

  const avgIncome = totalIncome / input.projectionMonths;
  const avgExpenses = totalExpenses / input.projectionMonths;
  const savingsRate = avgIncome > 0 ? (avgIncome - avgExpenses) / avgIncome : 0;

  const recommendations: string[] = [];
  if (savingsRate < 0.1) recommendations.push("Savings rate is below 10% — consider reducing discretionary spending.");
  if (savingsRate < 0) recommendations.push("Expenses exceed income — immediate budget review recommended.");
  if (lowestBalance < input.emergencyFundTarget * 0.5) {
    recommendations.push("Emergency fund will drop below 50% — build reserves before major expenses.");
  }
  if (monthsNegative > 3) {
    recommendations.push(`${monthsNegative} months with negative cash flow projected — consider income diversification.`);
  }

  return {
    monthlyProjections: projections,
    summary: {
      averageMonthlyIncome: Math.round(avgIncome),
      averageMonthlyExpenses: Math.round(avgExpenses),
      averageNetCashFlow: Math.round(avgIncome - avgExpenses),
      lowestBalance: Math.round(lowestBalance),
      lowestBalanceMonth: lowestMonth,
      highestBalance: Math.round(highestBalance),
      monthsNegative,
      savingsRate: Math.round(savingsRate * 10000) / 10000,
      projectedEndBalance: Math.round(balance),
    },
    alerts,
    recommendations,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. INSURANCE GAP ANALYSIS MODEL
// ═══════════════════════════════════════════════════════════════════════════

export interface InsurancePolicy {
  type: "life" | "disability" | "health" | "auto" | "home" | "umbrella" | "long_term_care";
  coverageAmount: number;
  annualPremium: number;
  deductible: number;
  provider: string;
  expirationDate?: string;
}

export interface InsuranceGapInput {
  annualIncome: number;
  age: number;
  dependents: number;
  mortgageBalance: number;
  totalDebt: number;
  monthlyExpenses: number;
  currentPolicies: InsurancePolicy[];
  homeValue: number;
  autoValue: number;
  netWorth: number;
  hasEmployerDisability: boolean;
  employerDisabilityPercent: number; // e.g., 0.6
}

export interface InsuranceGapOutput {
  gaps: Array<{
    type: string;
    currentCoverage: number;
    recommendedCoverage: number;
    gap: number;
    priority: "critical" | "high" | "medium" | "low";
    estimatedAnnualCost: number;
    rationale: string;
  }>;
  overallScore: number; // 0-100
  totalAnnualPremiums: number;
  premiumToIncomeRatio: number;
  recommendations: string[];
}

export function analyzeInsuranceGaps(input: InsuranceGapInput): InsuranceGapOutput {
  const gaps: InsuranceGapOutput["gaps"] = [];
  const recommendations: string[] = [];

  // Life Insurance: 10-12x income + debts - assets
  const lifeNeeded = Math.max(0,
    input.annualIncome * (input.dependents > 0 ? 12 : 5) +
    input.mortgageBalance + input.totalDebt -
    input.netWorth
  );
  const lifeCurrent = input.currentPolicies
    .filter(p => p.type === "life")
    .reduce((sum, p) => sum + p.coverageAmount, 0);
  const lifeGap = Math.max(0, lifeNeeded - lifeCurrent);

  gaps.push({
    type: "Life Insurance",
    currentCoverage: lifeCurrent,
    recommendedCoverage: Math.round(lifeNeeded),
    gap: Math.round(lifeGap),
    priority: lifeGap > input.annualIncome * 3 ? "critical" : lifeGap > 0 ? "high" : "low",
    estimatedAnnualCost: Math.round(lifeGap * 0.005), // ~$5 per $1000
    rationale: `Based on ${input.dependents} dependents, $${input.mortgageBalance.toLocaleString()} mortgage, and income replacement needs.`,
  });

  // Disability Insurance: 60-70% of income
  const disabilityNeeded = input.annualIncome * 0.65;
  const employerDisability = input.hasEmployerDisability ? input.annualIncome * input.employerDisabilityPercent : 0;
  const disabilityCurrent = input.currentPolicies
    .filter(p => p.type === "disability")
    .reduce((sum, p) => sum + p.coverageAmount, 0) + employerDisability;
  const disabilityGap = Math.max(0, disabilityNeeded - disabilityCurrent);

  gaps.push({
    type: "Disability Insurance",
    currentCoverage: Math.round(disabilityCurrent),
    recommendedCoverage: Math.round(disabilityNeeded),
    gap: Math.round(disabilityGap),
    priority: disabilityGap > input.annualIncome * 0.2 ? "critical" : disabilityGap > 0 ? "high" : "low",
    estimatedAnnualCost: Math.round(disabilityGap * 0.02),
    rationale: "Income replacement at 65% of gross income, accounting for employer coverage.",
  });

  // Home Insurance: replacement value
  const homeNeeded = input.homeValue > 0 ? input.homeValue * 1.0 : 0;
  const homeCurrent = input.currentPolicies
    .filter(p => p.type === "home")
    .reduce((sum, p) => sum + p.coverageAmount, 0);
  const homeGap = Math.max(0, homeNeeded - homeCurrent);

  if (input.homeValue > 0) {
    gaps.push({
      type: "Homeowner's Insurance",
      currentCoverage: homeCurrent,
      recommendedCoverage: Math.round(homeNeeded),
      gap: Math.round(homeGap),
      priority: homeGap > input.homeValue * 0.2 ? "high" : homeGap > 0 ? "medium" : "low",
      estimatedAnnualCost: Math.round(homeGap * 0.005),
      rationale: "Full replacement value coverage recommended.",
    });
  }

  // Umbrella Insurance: net worth > $500k
  const umbrellaNeeded = input.netWorth > 500000 ? Math.max(1000000, input.netWorth) : 0;
  const umbrellaCurrent = input.currentPolicies
    .filter(p => p.type === "umbrella")
    .reduce((sum, p) => sum + p.coverageAmount, 0);
  const umbrellaGap = Math.max(0, umbrellaNeeded - umbrellaCurrent);

  if (umbrellaNeeded > 0) {
    gaps.push({
      type: "Umbrella Liability",
      currentCoverage: umbrellaCurrent,
      recommendedCoverage: umbrellaNeeded,
      gap: umbrellaGap,
      priority: umbrellaGap > 0 ? "medium" : "low",
      estimatedAnnualCost: Math.round(umbrellaGap / 1000000 * 300),
      rationale: `Net worth of $${input.netWorth.toLocaleString()} warrants umbrella coverage.`,
    });
  }

  // Long-term care: age > 50
  if (input.age >= 50) {
    const ltcCurrent = input.currentPolicies
      .filter(p => p.type === "long_term_care")
      .reduce((sum, p) => sum + p.coverageAmount, 0);
    const ltcNeeded = input.monthlyExpenses * 12 * 3; // 3 years of expenses

    gaps.push({
      type: "Long-Term Care",
      currentCoverage: ltcCurrent,
      recommendedCoverage: Math.round(ltcNeeded),
      gap: Math.round(Math.max(0, ltcNeeded - ltcCurrent)),
      priority: input.age >= 60 && ltcCurrent === 0 ? "high" : "medium",
      estimatedAnnualCost: Math.round((ltcNeeded - ltcCurrent) * 0.03),
      rationale: "3-year benefit period at current expense levels.",
    });
  }

  // Calculate overall score
  const criticalGaps = gaps.filter(g => g.priority === "critical").length;
  const highGaps = gaps.filter(g => g.priority === "high").length;
  const totalGapAmount = gaps.reduce((sum, g) => sum + g.gap, 0);
  const totalNeeded = gaps.reduce((sum, g) => sum + g.recommendedCoverage, 0);
  const coverageRatio = totalNeeded > 0 ? 1 - (totalGapAmount / totalNeeded) : 1;
  const overallScore = Math.round(Math.max(0, Math.min(100,
    coverageRatio * 100 - criticalGaps * 15 - highGaps * 8
  )));

  const totalPremiums = input.currentPolicies.reduce((sum, p) => sum + p.annualPremium, 0);

  if (criticalGaps > 0) recommendations.push("Address critical coverage gaps immediately to protect family.");
  if (totalPremiums / input.annualIncome > 0.10) {
    recommendations.push("Insurance premiums exceed 10% of income — consider policy consolidation.");
  }

  return {
    gaps,
    overallScore,
    totalAnnualPremiums: Math.round(totalPremiums),
    premiumToIncomeRatio: Math.round((totalPremiums / input.annualIncome) * 10000) / 10000,
    recommendations,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. ESTATE PLANNING MODEL
// ═══════════════════════════════════════════════════════════════════════════

export interface EstatePlanningInput {
  totalEstateValue: number;
  filingStatus: "single" | "married";
  age: number;
  spouseAge?: number;
  assets: Array<{ type: string; value: number; beneficiary?: string; inTrust: boolean }>;
  lifeInsuranceProceeds: number;
  retirementAccounts: number;
  annualGifting: number;
  existingTrusts: Array<{ type: string; value: number }>;
  state: string;
  charitableIntent: number; // % of estate
}

export interface EstatePlanningOutput {
  grossEstate: number;
  taxableEstate: number;
  federalEstateTax: number;
  effectiveEstateTaxRate: number;
  exemptionUsed: number;
  exemptionRemaining: number;
  strategies: Array<{
    strategy: string;
    potentialSavings: number;
    complexity: "low" | "medium" | "high";
    description: string;
    priority: number;
  }>;
  beneficiaryAnalysis: Array<{ beneficiary: string; totalValue: number; percentOfEstate: number }>;
  annualGiftingAnalysis: {
    currentAnnualGifts: number;
    maxAnnualExclusion: number;
    lifetimeGiftUsed: number;
    recommendation: string;
  };
  totalPotentialSavings: number;
}

export function analyzeEstatePlan(input: EstatePlanningInput): EstatePlanningOutput {
  const FEDERAL_EXEMPTION = 13610000; // 2026 projected
  const ANNUAL_GIFT_EXCLUSION = 18000;
  const ESTATE_TAX_RATE = 0.40;

  const grossEstate = input.totalEstateValue + input.lifeInsuranceProceeds;
  const maritalDeduction = input.filingStatus === "married" ? grossEstate * 0.5 : 0;
  const charitableDeduction = grossEstate * (input.charitableIntent / 100);
  const trustReduction = input.existingTrusts.reduce((sum, t) => sum + t.value, 0);

  const taxableEstate = Math.max(0,
    grossEstate - maritalDeduction - charitableDeduction - trustReduction - FEDERAL_EXEMPTION
  );
  const federalTax = taxableEstate * ESTATE_TAX_RATE;
  const effectiveRate = grossEstate > 0 ? federalTax / grossEstate : 0;

  const strategies: EstatePlanningOutput["strategies"] = [];

  // ILIT (Irrevocable Life Insurance Trust)
  if (input.lifeInsuranceProceeds > 0) {
    strategies.push({
      strategy: "Irrevocable Life Insurance Trust (ILIT)",
      potentialSavings: Math.round(input.lifeInsuranceProceeds * ESTATE_TAX_RATE),
      complexity: "medium",
      description: "Remove life insurance proceeds from taxable estate by transferring ownership to an ILIT.",
      priority: 1,
    });
  }

  // Charitable Remainder Trust
  if (input.charitableIntent > 0) {
    const crtValue = grossEstate * (input.charitableIntent / 100) * 0.3;
    strategies.push({
      strategy: "Charitable Remainder Trust (CRT)",
      potentialSavings: Math.round(crtValue * ESTATE_TAX_RATE),
      complexity: "high",
      description: "Provides income stream while reducing estate and generating charitable deduction.",
      priority: 2,
    });
  }

  // Annual gifting maximization
  const maxAnnualGifts = ANNUAL_GIFT_EXCLUSION * 10; // assume 10 recipients
  if (input.annualGifting < maxAnnualGifts) {
    const additionalGifting = maxAnnualGifts - input.annualGifting;
    strategies.push({
      strategy: "Maximize Annual Gift Exclusions",
      potentialSavings: Math.round(additionalGifting * 20 * ESTATE_TAX_RATE), // 20 years
      complexity: "low",
      description: `Increase annual gifting by $${additionalGifting.toLocaleString()} per year to reduce estate over time.`,
      priority: 3,
    });
  }

  // GRAT (Grantor Retained Annuity Trust)
  if (grossEstate > FEDERAL_EXEMPTION * 1.5) {
    strategies.push({
      strategy: "Grantor Retained Annuity Trust (GRAT)",
      potentialSavings: Math.round(grossEstate * 0.05 * ESTATE_TAX_RATE),
      complexity: "high",
      description: "Transfer appreciation of assets to beneficiaries with minimal gift tax impact.",
      priority: 4,
    });
  }

  // Dynasty Trust
  if (grossEstate > FEDERAL_EXEMPTION * 2) {
    strategies.push({
      strategy: "Dynasty Trust",
      potentialSavings: Math.round(grossEstate * 0.1 * ESTATE_TAX_RATE),
      complexity: "high",
      description: "Multi-generational wealth transfer that avoids estate tax at each generation.",
      priority: 5,
    });
  }

  // Beneficiary analysis
  const beneficiaryMap = new Map<string, number>();
  for (const asset of input.assets) {
    const bene = asset.beneficiary || "Undesignated";
    beneficiaryMap.set(bene, (beneficiaryMap.get(bene) || 0) + asset.value);
  }
  const beneficiaryAnalysis = Array.from(beneficiaryMap.entries()).map(([beneficiary, totalValue]) => ({
    beneficiary,
    totalValue,
    percentOfEstate: Math.round((totalValue / grossEstate) * 10000) / 100,
  }));

  const totalPotentialSavings = strategies.reduce((sum, s) => sum + s.potentialSavings, 0);

  return {
    grossEstate: Math.round(grossEstate),
    taxableEstate: Math.round(taxableEstate),
    federalEstateTax: Math.round(federalTax),
    effectiveEstateTaxRate: Math.round(effectiveRate * 10000) / 10000,
    exemptionUsed: Math.round(Math.min(grossEstate, FEDERAL_EXEMPTION)),
    exemptionRemaining: Math.round(Math.max(0, FEDERAL_EXEMPTION - grossEstate)),
    strategies: strategies.sort((a, b) => a.priority - b.priority),
    beneficiaryAnalysis,
    annualGiftingAnalysis: {
      currentAnnualGifts: input.annualGifting,
      maxAnnualExclusion: ANNUAL_GIFT_EXCLUSION,
      lifetimeGiftUsed: 0,
      recommendation: input.annualGifting < ANNUAL_GIFT_EXCLUSION * 5
        ? "Consider maximizing annual gift exclusions to reduce estate over time."
        : "Annual gifting strategy is well-utilized.",
    },
    totalPotentialSavings: Math.round(totalPotentialSavings),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. EDUCATION FUNDING MODEL
// ═══════════════════════════════════════════════════════════════════════════

export interface EducationFundingInput {
  childAge: number;
  collegeStartAge: number; // typically 18
  yearsOfCollege: number; // typically 4
  annualCostToday: number; // current annual cost
  educationInflation: number; // e.g., 0.05 (5%)
  current529Balance: number;
  monthlyContribution: number;
  expectedReturn: number; // e.g., 0.06
  financialAidExpected: number; // annual amount
  scholarshipsExpected: number; // annual amount
  stateDeductionRate: number; // state tax deduction for 529 contributions
}

export interface EducationFundingOutput {
  totalProjectedCost: number;
  totalAfterAid: number;
  projected529Balance: number;
  fundingGap: number;
  fundingPercentage: number;
  monthlyNeeded: number; // to close gap
  yearByYear: Array<{
    year: number;
    childAge: number;
    contribution: number;
    growth: number;
    balance: number;
    withdrawal?: number;
  }>;
  taxBenefits: {
    stateTaxSavings: number;
    taxFreeGrowth: number;
    totalTaxBenefit: number;
  };
  alternativeStrategies: Array<{ strategy: string; impact: number; description: string }>;
}

export function projectEducationFunding(input: EducationFundingInput): EducationFundingOutput {
  const yearsUntilCollege = input.collegeStartAge - input.childAge;

  // Project total cost
  let totalCost = 0;
  const annualCosts: number[] = [];
  for (let y = 0; y < input.yearsOfCollege; y++) {
    const inflatedCost = input.annualCostToday * Math.pow(1 + input.educationInflation, yearsUntilCollege + y);
    annualCosts.push(inflatedCost);
    totalCost += inflatedCost;
  }

  const totalAid = (input.financialAidExpected + input.scholarshipsExpected) * input.yearsOfCollege;
  const totalAfterAid = Math.max(0, totalCost - totalAid);

  // Project 529 balance
  const yearByYear: EducationFundingOutput["yearByYear"] = [];
  let balance = input.current529Balance;
  let totalContributions = 0;

  for (let y = 0; y <= yearsUntilCollege + input.yearsOfCollege; y++) {
    const childAge = input.childAge + y;
    let yearContribution = 0;
    let yearGrowth = 0;
    let withdrawal = 0;

    if (y < yearsUntilCollege) {
      // Accumulation phase
      yearContribution = input.monthlyContribution * 12;
      yearGrowth = (balance + yearContribution / 2) * input.expectedReturn;
      balance += yearContribution + yearGrowth;
      totalContributions += yearContribution;
    } else {
      // Distribution phase
      const collegeYear = y - yearsUntilCollege;
      if (collegeYear < input.yearsOfCollege) {
        withdrawal = annualCosts[collegeYear] - input.financialAidExpected - input.scholarshipsExpected;
        withdrawal = Math.max(0, Math.min(withdrawal, balance));
        yearGrowth = (balance - withdrawal / 2) * input.expectedReturn * 0.5; // conservative in distribution
        balance = balance + yearGrowth - withdrawal;
      }
    }

    yearByYear.push({
      year: y,
      childAge,
      contribution: Math.round(yearContribution),
      growth: Math.round(yearGrowth),
      balance: Math.round(Math.max(0, balance)),
      ...(withdrawal > 0 ? { withdrawal: Math.round(withdrawal) } : {}),
    });
  }

  const projected529 = yearByYear.find(y => y.childAge === input.collegeStartAge)?.balance ?? balance;
  const fundingGap = Math.max(0, totalAfterAid - projected529);
  const fundingPercentage = totalAfterAid > 0 ? Math.min(100, (projected529 / totalAfterAid) * 100) : 100;

  // Calculate monthly needed to close gap
  let monthlyNeeded = 0;
  if (fundingGap > 0 && yearsUntilCollege > 0) {
    const monthsLeft = yearsUntilCollege * 12;
    const monthlyRate = input.expectedReturn / 12;
    // Future value of annuity formula solved for payment
    monthlyNeeded = fundingGap / ((Math.pow(1 + monthlyRate, monthsLeft) - 1) / monthlyRate);
  }

  // Tax benefits
  const stateTaxSavings = totalContributions * input.stateDeductionRate;
  const taxFreeGrowth = Math.max(0, projected529 - input.current529Balance - totalContributions);

  return {
    totalProjectedCost: Math.round(totalCost),
    totalAfterAid: Math.round(totalAfterAid),
    projected529Balance: Math.round(projected529),
    fundingGap: Math.round(fundingGap),
    fundingPercentage: Math.round(fundingPercentage * 10) / 10,
    monthlyNeeded: Math.round(monthlyNeeded),
    yearByYear,
    taxBenefits: {
      stateTaxSavings: Math.round(stateTaxSavings),
      taxFreeGrowth: Math.round(taxFreeGrowth),
      totalTaxBenefit: Math.round(stateTaxSavings + taxFreeGrowth * 0.15), // estimated tax on growth
    },
    alternativeStrategies: [
      {
        strategy: "Increase monthly contributions",
        impact: Math.round(monthlyNeeded),
        description: `Adding $${Math.round(monthlyNeeded)} per month would fully fund the education goal.`,
      },
      {
        strategy: "Consider in-state public university",
        impact: Math.round(totalCost * 0.4),
        description: "In-state public universities typically cost 40-60% less than private institutions.",
      },
      {
        strategy: "Apply for merit scholarships",
        impact: Math.round(totalCost * 0.15),
        description: "Average merit scholarship covers 10-20% of total costs.",
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. RISK TOLERANCE SCORING MODEL
// ═══════════════════════════════════════════════════════════════════════════

export interface RiskToleranceInput {
  questionnaireAnswers: Array<{
    questionId: string;
    answer: number; // 1-5 scale (1=conservative, 5=aggressive)
    category: "capacity" | "willingness" | "need" | "knowledge";
  }>;
  behavioralSignals: {
    portfolioChangesLast12m: number;
    panicSellEvents: number;
    riskAssetAllocation: number; // current % in stocks/alternatives
    loginFrequencyDuringVolatility: number; // relative to normal
    averageHoldingPeriod: number; // months
  };
  financialContext: {
    age: number;
    yearsToRetirement: number;
    incomeStability: number; // 1-5
    emergencyFundMonths: number;
    debtToIncomeRatio: number;
    dependents: number;
  };
}

export interface RiskToleranceOutput {
  compositeScore: number; // 0-100
  category: "conservative" | "moderately_conservative" | "moderate" | "moderately_aggressive" | "aggressive";
  dimensions: {
    capacity: { score: number; weight: number; factors: string[] };
    willingness: { score: number; weight: number; factors: string[] };
    need: { score: number; weight: number; factors: string[] };
    knowledge: { score: number; weight: number; factors: string[] };
    behavioral: { score: number; weight: number; factors: string[] };
  };
  recommendedAllocation: {
    stocks: number;
    bonds: number;
    alternatives: number;
    cash: number;
  };
  confidenceLevel: number; // 0-100
  warnings: string[];
  behavioralInsights: string[];
}

export function scoreRiskTolerance(input: RiskToleranceInput): RiskToleranceOutput {
  const warnings: string[] = [];
  const behavioralInsights: string[] = [];

  // Score questionnaire dimensions
  const dimensionScores: Record<string, number[]> = {
    capacity: [], willingness: [], need: [], knowledge: [],
  };

  for (const answer of input.questionnaireAnswers) {
    if (dimensionScores[answer.category]) {
      dimensionScores[answer.category].push(answer.answer);
    }
  }

  const avgScore = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 3;

  // Capacity score (financial ability to take risk)
  const capacityBase = avgScore(dimensionScores.capacity) * 20;
  const capacityAdjustments =
    (input.financialContext.emergencyFundMonths >= 6 ? 5 : -5) +
    (input.financialContext.debtToIncomeRatio < 0.3 ? 5 : -5) +
    (input.financialContext.incomeStability >= 4 ? 5 : -3) +
    (input.financialContext.dependents <= 1 ? 3 : -3);
  const capacityScore = Math.max(0, Math.min(100, capacityBase + capacityAdjustments));

  const capacityFactors: string[] = [];
  if (input.financialContext.emergencyFundMonths < 3) capacityFactors.push("Low emergency fund reduces risk capacity");
  if (input.financialContext.debtToIncomeRatio > 0.4) capacityFactors.push("High debt-to-income ratio limits risk capacity");
  if (input.financialContext.incomeStability >= 4) capacityFactors.push("Stable income supports higher risk capacity");

  // Willingness score (emotional comfort with risk)
  const willingnessBase = avgScore(dimensionScores.willingness) * 20;
  const willingnessScore = Math.max(0, Math.min(100, willingnessBase));

  // Need score (required return to meet goals)
  const needBase = avgScore(dimensionScores.need) * 20;
  const yearsAdj = input.financialContext.yearsToRetirement > 20 ? 10 :
    input.financialContext.yearsToRetirement > 10 ? 5 : -5;
  const needScore = Math.max(0, Math.min(100, needBase + yearsAdj));

  // Knowledge score
  const knowledgeBase = avgScore(dimensionScores.knowledge) * 20;
  const knowledgeScore = Math.max(0, Math.min(100, knowledgeBase));

  // Behavioral score (revealed preferences from actual behavior)
  let behavioralScore = 50; // neutral starting point
  const bs = input.behavioralSignals;

  if (bs.panicSellEvents > 0) {
    behavioralScore -= bs.panicSellEvents * 15;
    behavioralInsights.push(`${bs.panicSellEvents} panic sell event(s) detected — suggests lower actual risk tolerance.`);
  }
  if (bs.portfolioChangesLast12m > 6) {
    behavioralScore -= 10;
    behavioralInsights.push("Frequent portfolio changes suggest anxiety about market movements.");
  }
  if (bs.loginFrequencyDuringVolatility > 2) {
    behavioralScore -= 5;
    behavioralInsights.push("Increased login frequency during volatility indicates stress response.");
  }
  if (bs.averageHoldingPeriod > 36) {
    behavioralScore += 15;
    behavioralInsights.push("Long average holding period demonstrates patience and conviction.");
  }
  if (bs.riskAssetAllocation > 70) {
    behavioralScore += 10;
    behavioralInsights.push("Current high equity allocation aligns with aggressive risk profile.");
  }

  behavioralScore = Math.max(0, Math.min(100, behavioralScore));

  // Weighted composite
  const weights = { capacity: 0.25, willingness: 0.25, need: 0.20, knowledge: 0.10, behavioral: 0.20 };
  const compositeScore = Math.round(
    capacityScore * weights.capacity +
    willingnessScore * weights.willingness +
    needScore * weights.need +
    knowledgeScore * weights.knowledge +
    behavioralScore * weights.behavioral
  );

  // Category
  let category: RiskToleranceOutput["category"];
  if (compositeScore < 25) category = "conservative";
  else if (compositeScore < 40) category = "moderately_conservative";
  else if (compositeScore < 60) category = "moderate";
  else if (compositeScore < 75) category = "moderately_aggressive";
  else category = "aggressive";

  // Recommended allocation
  const stockAlloc = Math.round(Math.min(95, Math.max(20, compositeScore * 0.9 + 10)));
  const bondAlloc = Math.round(Math.min(60, Math.max(5, (100 - compositeScore) * 0.7)));
  const altAlloc = Math.round(Math.min(20, compositeScore > 50 ? (compositeScore - 50) * 0.4 : 0));
  const cashAlloc = Math.max(0, 100 - stockAlloc - bondAlloc - altAlloc);

  // Warnings for mismatches
  if (Math.abs(willingnessScore - capacityScore) > 30) {
    warnings.push("Significant gap between risk willingness and financial capacity — recommend advisor review.");
  }
  if (behavioralScore < willingnessScore - 20) {
    warnings.push("Stated risk tolerance exceeds demonstrated behavior — actual tolerance may be lower.");
  }
  if (input.financialContext.age > 60 && compositeScore > 70) {
    warnings.push("High risk score with limited time horizon — consider age-appropriate adjustments.");
  }

  // Confidence level based on data completeness
  const totalQuestions = input.questionnaireAnswers.length;
  const hasBehavioral = bs.averageHoldingPeriod > 0;
  const confidenceLevel = Math.min(100, Math.round(
    (totalQuestions / 20) * 50 + (hasBehavioral ? 30 : 0) + 20
  ));

  return {
    compositeScore,
    category,
    dimensions: {
      capacity: { score: Math.round(capacityScore), weight: weights.capacity, factors: capacityFactors },
      willingness: { score: Math.round(willingnessScore), weight: weights.willingness, factors: [] },
      need: { score: Math.round(needScore), weight: weights.need, factors: [] },
      knowledge: { score: Math.round(knowledgeScore), weight: weights.knowledge, factors: [] },
      behavioral: { score: Math.round(behavioralScore), weight: weights.behavioral, factors: behavioralInsights },
    },
    recommendedAllocation: {
      stocks: stockAlloc,
      bonds: bondAlloc,
      alternatives: altAlloc,
      cash: cashAlloc,
    },
    confidenceLevel,
    warnings,
    behavioralInsights,
  };
}
