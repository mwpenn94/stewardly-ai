/**
 * Calculator Chat Tools — Exposes Wealth Engine capabilities to the AI chat surface.
 *
 * These tools allow users to invoke retirement projections, tax estimates,
 * protection scoring, estate analysis, Monte Carlo simulations, and business
 * income projections directly from the chat interface.
 *
 * The LLM calls these tools when users ask questions like:
 *   "Run a retirement projection for a 45-year-old making $150k"
 *   "What's the tax impact of converting $50k from traditional to Roth IRA?"
 *   "How much life insurance does a family with 2 kids and $300k mortgage need?"
 *   "Run a Monte Carlo simulation on a 60/40 portfolio"
 *   "Compare business entity types for a consultant making $200k"
 */
import { type Tool } from "./_core/llm";
import {
  uweBuildStrategy,
  uweSimulate,
  monteCarloSimulate,
  bieCreateStrategy,
  bieSimulate,
  backPlan,
  buildOwnerCompSnapshot,
  compareEntities,
  valueBusiness,
  RATES,
  GUARDRAILS,
  checkGuardrails,
  STRESS_SCENARIOS,
  stressTest,
  type ClientProfile,
} from "./shared/calculators";

// ─── Tool Definitions ────────────────────────────────────────────
export const CALCULATOR_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "run_retirement_projection",
      description: "Run a retirement projection for a client. Calculates future retirement income needs, savings trajectory, Social Security estimates, and gap analysis. Use when the user asks about retirement planning, retirement savings, or when they will be able to retire.",
      parameters: {
        type: "object",
        properties: {
          age: { type: "number", description: "Current age of the client" },
          retirement_age: { type: "number", description: "Target retirement age (default 65)" },
          annual_income: { type: "number", description: "Current annual gross income" },
          current_savings: { type: "number", description: "Current retirement savings (401k + IRA + other)" },
          monthly_contribution: { type: "number", description: "Monthly retirement contribution amount" },
          income_replacement_rate: { type: "number", description: "Desired income replacement rate in retirement (default 0.80 = 80%)" },
          filing_status: { type: "string", enum: ["single", "married"], description: "Tax filing status" },
        },
        required: ["age", "annual_income"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_tax_estimate",
      description: "Estimate federal income tax for a given income scenario. Includes bracket analysis, effective rate, and optimization suggestions. Use when the user asks about taxes, tax brackets, tax planning, Roth conversions, or tax impact of financial decisions.",
      parameters: {
        type: "object",
        properties: {
          gross_income: { type: "number", description: "Total gross income" },
          filing_status: { type: "string", enum: ["single", "married"], description: "Tax filing status (default married)" },
          deductions: { type: "number", description: "Total itemized deductions (0 = use standard deduction)" },
          retirement_contributions: { type: "number", description: "Pre-tax retirement contributions (401k, traditional IRA)" },
          state: { type: "string", description: "State of residence for state tax estimate" },
        },
        required: ["gross_income"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_protection_analysis",
      description: "Analyze insurance and protection needs for a client. Calculates life insurance need, disability income gap, long-term care exposure, and overall protection score. Use when the user asks about insurance needs, life insurance, disability insurance, or protection planning.",
      parameters: {
        type: "object",
        properties: {
          age: { type: "number", description: "Current age" },
          annual_income: { type: "number", description: "Annual gross income" },
          spouse_income: { type: "number", description: "Spouse's annual income (0 if single)" },
          dependents: { type: "number", description: "Number of dependents" },
          mortgage_balance: { type: "number", description: "Outstanding mortgage balance" },
          other_debt: { type: "number", description: "Other outstanding debt" },
          current_life_insurance: { type: "number", description: "Current life insurance coverage" },
          current_disability: { type: "boolean", description: "Has disability insurance?" },
          current_ltc: { type: "boolean", description: "Has long-term care insurance?" },
          savings: { type: "number", description: "Total liquid savings / emergency fund" },
        },
        required: ["age", "annual_income"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_monte_carlo",
      description: "Run a Monte Carlo simulation on a portfolio to project outcomes across thousands of scenarios. Shows probability of success, percentile outcomes, and risk metrics. Use when the user asks about portfolio projections, probability of success, or risk analysis.",
      parameters: {
        type: "object",
        properties: {
          initial_balance: { type: "number", description: "Starting portfolio balance" },
          annual_contribution: { type: "number", description: "Annual contribution amount" },
          annual_withdrawal: { type: "number", description: "Annual withdrawal amount (0 during accumulation)" },
          years: { type: "number", description: "Number of years to project" },
          equity_allocation: { type: "number", description: "Equity allocation as decimal (0.6 = 60% stocks)" },
          num_simulations: { type: "number", description: "Number of simulations to run (default 1000)" },
        },
        required: ["initial_balance", "years"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_estate_analysis",
      description: "Analyze estate planning needs including estate tax exposure, beneficiary planning, and trust recommendations. Use when the user asks about estate planning, inheritance, estate taxes, trusts, or wealth transfer.",
      parameters: {
        type: "object",
        properties: {
          total_estate_value: { type: "number", description: "Total estimated estate value (assets - liabilities)" },
          filing_status: { type: "string", enum: ["single", "married"], description: "Filing status" },
          state: { type: "string", description: "State of residence (some states have estate tax)" },
          has_trust: { type: "boolean", description: "Whether client has an existing trust" },
          has_will: { type: "boolean", description: "Whether client has a will" },
          beneficiaries: { type: "number", description: "Number of beneficiaries" },
          charitable_intent: { type: "boolean", description: "Whether client has charitable giving goals" },
        },
        required: ["total_estate_value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_business_entity_comparison",
      description: "Compare business entity types (Sole Prop, LLC, S-Corp, C-Corp) for tax efficiency, liability protection, and retirement planning. Use when the user asks about business structure, entity selection, S-Corp election, or business tax planning.",
      parameters: {
        type: "object",
        properties: {
          gross_revenue: { type: "number", description: "Annual gross business revenue" },
          business_expenses: { type: "number", description: "Annual business expenses" },
          owner_salary: { type: "number", description: "Reasonable owner salary (for S-Corp comparison)" },
          state: { type: "string", description: "State of business operation" },
          filing_status: { type: "string", enum: ["single", "married"], description: "Personal filing status" },
        },
        required: ["gross_revenue", "business_expenses"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_income_projection",
      description: "Project advisor/practice income using the Business Income Engine. Models GDC, overrides, bonuses, and channel diversification. Use when the user asks about practice income, GDC projections, advisor compensation, or business planning for financial professionals.",
      parameters: {
        type: "object",
        properties: {
          role: { type: "string", description: "Advisor role (e.g., 'associate', 'experienced', 'director', 'md', 'rvp')" },
          base_gdc: { type: "number", description: "Base GDC (Gross Dealer Concession) amount" },
          override_rate: { type: "number", description: "Override rate as decimal (e.g., 0.05 = 5%)" },
          team_size: { type: "number", description: "Number of team members for override calculation" },
          years: { type: "number", description: "Number of years to project (default 5)" },
          growth_rate: { type: "number", description: "Annual growth rate as decimal (default 0.10 = 10%)" },
        },
        required: ["base_gdc"],
      },
    },
  },
];

// ─── Tool Execution ──────────────────────────────────────────────
export async function executeCalculatorTool(
  toolName: string,
  args: Record<string, any>,
): Promise<string> {
  try {
    switch (toolName) {
      case "run_retirement_projection":
        return runRetirementProjection(args);
      case "run_tax_estimate":
        return runTaxEstimate(args);
      case "run_protection_analysis":
        return runProtectionAnalysis(args);
      case "run_monte_carlo":
        return runMonteCarlo(args);
      case "run_estate_analysis":
        return runEstateAnalysis(args);
      case "run_business_entity_comparison":
        return runBusinessEntityComparison(args);
      case "run_income_projection":
        return runIncomeProjection(args);
      default:
        return JSON.stringify({ error: `Unknown calculator tool: ${toolName}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Calculator tool failed: ${err.message}` });
  }
}

// ─── Implementation ──────────────────────────────────────────────

function runRetirementProjection(args: Record<string, any>): string {
  const age = args.age || 35;
  const retirementAge = args.retirement_age || 65;
  const income = args.annual_income || 100000;
  const savings = args.current_savings || 0;
  const monthlyContrib = args.monthly_contribution || (income * 0.15 / 12);
  const replacementRate = args.income_replacement_rate || 0.80;
  const yearsToRetirement = Math.max(retirementAge - age, 1);
  const yearsInRetirement = 30;
  const inflationRate = 0.03;
  const returnRate = 0.07;
  const ssEstimate = Math.min(income * 0.35, 45000); // rough SS estimate

  // Future value of current savings
  const fvSavings = savings * Math.pow(1 + returnRate, yearsToRetirement);
  // Future value of contributions (annuity)
  const annualContrib = monthlyContrib * 12;
  const fvContributions = annualContrib * ((Math.pow(1 + returnRate, yearsToRetirement) - 1) / returnRate);
  const totalAtRetirement = fvSavings + fvContributions;

  // Income need in retirement (inflation-adjusted)
  const retirementIncomeNeed = income * replacementRate * Math.pow(1 + inflationRate, yearsToRetirement);
  const annualNeedAfterSS = retirementIncomeNeed - ssEstimate * Math.pow(1 + inflationRate, yearsToRetirement);
  
  // Required nest egg (4% rule)
  const requiredNestEgg = Math.max(annualNeedAfterSS, 0) * 25;
  const gap = requiredNestEgg - totalAtRetirement;
  const funded = Math.min((totalAtRetirement / requiredNestEgg) * 100, 100);
  
  // Safe withdrawal rate analysis
  const safeWithdrawal = totalAtRetirement * 0.04;
  const monthlyIncome = safeWithdrawal / 12;

  return JSON.stringify({
    summary: `Retirement projection for a ${age}-year-old retiring at ${retirementAge}`,
    current: {
      age,
      income: Math.round(income),
      currentSavings: Math.round(savings),
      monthlyContribution: Math.round(monthlyContrib),
    },
    projection: {
      yearsToRetirement,
      projectedSavingsAtRetirement: Math.round(totalAtRetirement),
      requiredNestEgg: Math.round(requiredNestEgg),
      fundedPercentage: Math.round(funded),
      gap: Math.round(Math.max(gap, 0)),
      estimatedSocialSecurity: Math.round(ssEstimate),
    },
    retirement: {
      annualIncomeNeed: Math.round(retirementIncomeNeed),
      safeAnnualWithdrawal: Math.round(safeWithdrawal),
      monthlyIncomeFromSavings: Math.round(monthlyIncome),
      estimatedMonthlySS: Math.round(ssEstimate / 12),
      totalMonthlyIncome: Math.round(monthlyIncome + ssEstimate / 12),
    },
    recommendations: gap > 0 ? [
      `Increase monthly contributions by $${Math.round(gap / yearsToRetirement / 12 * (returnRate / ((Math.pow(1 + returnRate, yearsToRetirement) - 1))))} to close the gap`,
      funded < 50 ? "Consider delaying retirement by 2-3 years to significantly improve funded status" : null,
      "Review asset allocation — ensure equity exposure is appropriate for time horizon",
      "Maximize employer match if available (free money)",
      income > 150000 ? "Consider backdoor Roth IRA for tax-free retirement income" : null,
    ].filter(Boolean) : [
      "On track for retirement! Consider Roth conversions for tax diversification",
      "Review estate planning to protect accumulated wealth",
    ],
    assumptions: {
      returnRate: `${(returnRate * 100).toFixed(1)}% annual return`,
      inflationRate: `${(inflationRate * 100).toFixed(1)}% annual inflation`,
      withdrawalRate: "4% safe withdrawal rate",
      ssEstimate: "Estimated Social Security (actual may vary)",
    },
  });
}

function runTaxEstimate(args: Record<string, any>): string {
  const income = args.gross_income || 100000;
  const filing = args.filing_status || "married";
  const deductions = args.deductions || 0;
  const retirementContrib = args.retirement_contributions || 0;

  // 2024 brackets
  const brackets = filing === "married" ? [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ] : [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ];

  const standardDeduction = filing === "married" ? 29200 : 14600;
  const usedDeduction = deductions > standardDeduction ? deductions : standardDeduction;
  const taxableIncome = Math.max(income - retirementContrib - usedDeduction, 0);

  let tax = 0;
  let marginalRate = 0;
  const bracketBreakdown: any[] = [];
  for (const b of brackets) {
    if (taxableIncome > b.min) {
      const taxable = Math.min(taxableIncome, b.max) - b.min;
      const bracketTax = taxable * b.rate;
      tax += bracketTax;
      marginalRate = b.rate;
      bracketBreakdown.push({
        bracket: `${(b.rate * 100).toFixed(0)}%`,
        taxableInBracket: Math.round(taxable),
        taxFromBracket: Math.round(bracketTax),
      });
    }
  }

  const effectiveRate = taxableIncome > 0 ? tax / income : 0;
  const ficaTax = Math.min(income, 168600) * 0.0765 + Math.max(income - 168600, 0) * 0.0145;

  return JSON.stringify({
    summary: `Federal tax estimate for ${filing} filer with $${income.toLocaleString()} gross income`,
    income: {
      grossIncome: Math.round(income),
      retirementContributions: Math.round(retirementContrib),
      deduction: Math.round(usedDeduction),
      deductionType: deductions > standardDeduction ? "itemized" : "standard",
      taxableIncome: Math.round(taxableIncome),
    },
    tax: {
      federalIncomeTax: Math.round(tax),
      ficaTax: Math.round(ficaTax),
      totalFederalTax: Math.round(tax + ficaTax),
      marginalRate: `${(marginalRate * 100).toFixed(0)}%`,
      effectiveRate: `${(effectiveRate * 100).toFixed(1)}%`,
      bracketBreakdown,
    },
    optimization: [
      retirementContrib < 23500 ? `Maximize 401(k) contributions — you can contribute up to $23,500 (saving ~$${Math.round((23500 - retirementContrib) * marginalRate)} in taxes)` : null,
      income > 150000 && filing === "married" ? "Consider backdoor Roth IRA ($7,000 per spouse)" : null,
      income > 200000 ? "Review qualified business income (QBI) deduction eligibility" : null,
      "Consider tax-loss harvesting in taxable accounts",
      deductions <= standardDeduction ? "Bunching charitable donations into alternating years may allow itemizing" : null,
    ].filter(Boolean),
  });
}

function runProtectionAnalysis(args: Record<string, any>): string {
  const age = args.age || 35;
  const income = args.annual_income || 100000;
  const spouseIncome = args.spouse_income || 0;
  const dependents = args.dependents || 0;
  const mortgage = args.mortgage_balance || 0;
  const otherDebt = args.other_debt || 0;
  const currentLife = args.current_life_insurance || 0;
  const hasDisability = args.current_disability || false;
  const hasLTC = args.current_ltc || false;
  const savings = args.savings || 0;

  // Life insurance need (income replacement + debt payoff + education + final expenses)
  const incomeReplacementYears = Math.max(67 - age, 10);
  const incomeNeed = income * incomeReplacementYears * 0.7; // 70% of income
  const educationNeed = dependents * 120000; // $120k per child for education
  const debtPayoff = mortgage + otherDebt;
  const finalExpenses = 25000;
  const totalLifeNeed = incomeNeed + educationNeed + debtPayoff + finalExpenses - savings;
  const lifeGap = Math.max(totalLifeNeed - currentLife, 0);

  // Disability need
  const monthlyIncome = income / 12;
  const disabilityBenefit = hasDisability ? monthlyIncome * 0.6 : 0;
  const disabilityGap = monthlyIncome * 0.6 - disabilityBenefit;

  // LTC exposure
  const ltcAnnualCost = 108000; // national average for nursing home
  const ltcExposure = hasLTC ? 0 : ltcAnnualCost * 3; // 3-year average stay

  // Protection score (0-100)
  const lifeScore = currentLife >= totalLifeNeed ? 100 : Math.round((currentLife / Math.max(totalLifeNeed, 1)) * 100);
  const diScore = hasDisability ? 80 : 0;
  const ltcScore = hasLTC ? 80 : (age < 45 ? 50 : 0); // younger people get partial credit
  const emergencyScore = savings >= income * 0.5 ? 100 : Math.round((savings / (income * 0.5)) * 100);
  const overallScore = Math.round((lifeScore * 0.35 + diScore * 0.25 + ltcScore * 0.15 + emergencyScore * 0.25));

  return JSON.stringify({
    summary: `Protection analysis for a ${age}-year-old with $${income.toLocaleString()} income and ${dependents} dependent(s)`,
    protectionScore: {
      overall: overallScore,
      grade: overallScore >= 80 ? "A" : overallScore >= 60 ? "B" : overallScore >= 40 ? "C" : "D",
      components: {
        lifeInsurance: lifeScore,
        disabilityInsurance: diScore,
        longTermCare: ltcScore,
        emergencyFund: emergencyScore,
      },
    },
    lifeInsurance: {
      totalNeed: Math.round(totalLifeNeed),
      currentCoverage: Math.round(currentLife),
      gap: Math.round(lifeGap),
      breakdown: {
        incomeReplacement: Math.round(incomeNeed),
        educationFunding: Math.round(educationNeed),
        debtPayoff: Math.round(debtPayoff),
        finalExpenses,
        lessSavings: -Math.round(savings),
      },
      estimatedMonthlyPremium: age < 40 ? Math.round(lifeGap / 1000000 * 35) : Math.round(lifeGap / 1000000 * 65),
    },
    disability: {
      monthlyIncomeAtRisk: Math.round(monthlyIncome),
      currentBenefit: Math.round(disabilityBenefit),
      gap: Math.round(disabilityGap),
      recommendation: hasDisability ? "Review existing policy for own-occupation definition" : "Strongly recommend individual disability insurance",
    },
    longTermCare: {
      annualCostEstimate: ltcAnnualCost,
      totalExposure: ltcExposure,
      hasCoverage: hasLTC,
      recommendation: hasLTC ? "Review existing LTC policy for inflation protection" : (age > 50 ? "Priority: obtain LTC coverage before premiums increase" : "Consider hybrid life/LTC policy for dual protection"),
    },
    recommendations: [
      lifeGap > 0 ? `Obtain $${Math.round(lifeGap / 1000)}k additional life insurance coverage` : null,
      !hasDisability ? "Obtain individual disability insurance (own-occupation definition)" : null,
      !hasLTC && age > 45 ? "Evaluate long-term care insurance or hybrid life/LTC policy" : null,
      savings < income * 0.5 ? `Build emergency fund to $${Math.round(income * 0.5 / 1000)}k (6 months expenses)` : null,
      dependents > 0 ? "Review beneficiary designations on all accounts" : null,
      "Schedule annual insurance review to keep coverage aligned with needs",
    ].filter(Boolean),
  });
}

function runMonteCarlo(args: Record<string, any>): string {
  const balance = args.initial_balance || 500000;
  const contribution = args.annual_contribution || 0;
  const withdrawal = args.annual_withdrawal || 0;
  const years = args.years || 30;
  const equity = args.equity_allocation || 0.6;
  const numSims = Math.min(args.num_simulations || 1000, 5000);

  const bondReturn = 0.04;
  const equityReturn = 0.10;
  const bondVol = 0.06;
  const equityVol = 0.18;
  const expectedReturn = equity * equityReturn + (1 - equity) * bondReturn;
  const portfolioVol = Math.sqrt(equity * equity * equityVol * equityVol + (1 - equity) * (1 - equity) * bondVol * bondVol);

  // Run simulations
  const finalValues: number[] = [];
  const failedCount = { count: 0 };
  
  for (let sim = 0; sim < numSims; sim++) {
    let value = balance;
    let failed = false;
    for (let y = 0; y < years; y++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const annualReturn = expectedReturn + portfolioVol * z;
      value = value * (1 + annualReturn) + contribution - withdrawal;
      if (value <= 0) { value = 0; failed = true; break; }
    }
    finalValues.push(value);
    if (failed) failedCount.count++;
  }

  finalValues.sort((a, b) => a - b);
  const percentile = (p: number) => finalValues[Math.floor(p / 100 * numSims)] || 0;
  const successRate = Math.round(((numSims - failedCount.count) / numSims) * 100);

  return JSON.stringify({
    summary: `Monte Carlo simulation: ${numSims} scenarios over ${years} years`,
    inputs: {
      initialBalance: Math.round(balance),
      annualContribution: Math.round(contribution),
      annualWithdrawal: Math.round(withdrawal),
      equityAllocation: `${(equity * 100).toFixed(0)}%`,
      expectedReturn: `${(expectedReturn * 100).toFixed(1)}%`,
      portfolioVolatility: `${(portfolioVol * 100).toFixed(1)}%`,
    },
    results: {
      successRate: `${successRate}%`,
      medianOutcome: Math.round(percentile(50)),
      percentiles: {
        p10: Math.round(percentile(10)),
        p25: Math.round(percentile(25)),
        p50: Math.round(percentile(50)),
        p75: Math.round(percentile(75)),
        p90: Math.round(percentile(90)),
      },
      worstCase: Math.round(percentile(5)),
      bestCase: Math.round(percentile(95)),
    },
    interpretation: successRate >= 90
      ? "Strong probability of success. Portfolio is well-positioned."
      : successRate >= 75
      ? "Good probability but consider reducing withdrawal rate or increasing contributions."
      : successRate >= 50
      ? "Moderate risk of shortfall. Review asset allocation and withdrawal strategy."
      : "High risk of portfolio depletion. Significant adjustments recommended.",
    recommendations: [
      successRate < 90 ? "Consider reducing annual withdrawal by 10-15%" : null,
      equity < 0.4 && years > 15 ? "Consider increasing equity allocation for longer time horizons" : null,
      equity > 0.8 ? "Consider reducing equity allocation to manage downside risk" : null,
      withdrawal > balance * 0.05 ? "Withdrawal rate exceeds 5% — consider dynamic withdrawal strategy" : null,
      "Review and rebalance portfolio annually",
      "Consider bucket strategy: 2-3 years cash, 3-7 years bonds, remainder equities",
    ].filter(Boolean),
  });
}

function runEstateAnalysis(args: Record<string, any>): string {
  const estateValue = args.total_estate_value || 1000000;
  const filing = args.filing_status || "married";
  const hasTrust = args.has_trust || false;
  const hasWill = args.has_will || false;
  const beneficiaries = args.beneficiaries || 2;
  const charitableIntent = args.charitable_intent || false;

  const exemption = filing === "married" ? 27220000 : 13610000; // 2024 portability
  const taxableEstate = Math.max(estateValue - exemption, 0);
  const estateTax = taxableEstate * 0.40;
  const isExposed = taxableEstate > 0;

  // Estate planning score
  let score = 0;
  if (hasWill) score += 25;
  if (hasTrust) score += 30;
  if (!isExposed) score += 20;
  if (beneficiaries > 0) score += 15;
  score += 10; // base

  return JSON.stringify({
    summary: `Estate analysis for $${(estateValue / 1000000).toFixed(1)}M estate (${filing} filer)`,
    estateOverview: {
      totalEstateValue: Math.round(estateValue),
      federalExemption: exemption,
      taxableEstate: Math.round(taxableEstate),
      estimatedEstateTax: Math.round(estateTax),
      effectiveRate: taxableEstate > 0 ? `${((estateTax / estateValue) * 100).toFixed(1)}%` : "0%",
      isExposed,
    },
    planningStatus: {
      hasWill,
      hasTrust,
      beneficiaries,
      charitableIntent,
      planningScore: Math.min(score, 100),
      grade: score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
    },
    recommendations: [
      !hasWill ? "URGENT: Create a will to ensure assets are distributed according to your wishes" : null,
      !hasTrust && estateValue > 500000 ? "Establish a revocable living trust to avoid probate and maintain privacy" : null,
      isExposed ? "Consider irrevocable life insurance trust (ILIT) to remove life insurance from taxable estate" : null,
      isExposed ? "Explore annual gifting strategy ($18,000/person exclusion) to reduce estate" : null,
      charitableIntent ? "Consider charitable remainder trust (CRT) for income + charitable deduction" : null,
      charitableIntent ? "Donor-advised fund (DAF) for immediate deduction with flexible granting" : null,
      beneficiaries > 1 ? "Review beneficiary designations on all retirement accounts and insurance policies" : null,
      estateValue > 1000000 ? "Consider umbrella liability insurance to protect estate from lawsuits" : null,
      "Review and update estate documents every 3-5 years or after major life events",
      filing === "married" ? "Ensure portability election is filed to preserve unused exemption" : null,
    ].filter(Boolean),
    keyDates: {
      exemptionSunset: "2025 — current exemption may revert to ~$7M per person",
      annualGiftExclusion: "$18,000 per person per year (2024)",
      requiredMinimumDistributions: "Age 73 for most retirement accounts",
    },
  });
}

function runBusinessEntityComparison(args: Record<string, any>): string {
  const revenue = args.gross_revenue || 200000;
  const expenses = args.business_expenses || 50000;
  const ownerSalary = args.owner_salary || Math.round((revenue - expenses) * 0.6);
  const filing = args.filing_status || "married";
  const netIncome = revenue - expenses;

  try {
    const comparison = compareEntities({
      // @ts-expect-error — excess property in object literal
      revenue,
      expenses,
      ownerSalary,
      filingStatus: filing as any,
      state: args.state || "FL",
    });

    return JSON.stringify({
      summary: `Business entity comparison for $${(revenue / 1000).toFixed(0)}k revenue, $${(expenses / 1000).toFixed(0)}k expenses`,
      inputs: {
        grossRevenue: revenue,
        businessExpenses: expenses,
        netBusinessIncome: netIncome,
        ownerSalary: ownerSalary,
        filingStatus: filing,
      },
      comparison,
      recommendations: [
        netIncome > 80000 ? "S-Corp election likely beneficial — saves self-employment tax on distributions" : null,
        netIncome > 400000 ? "Consider C-Corp for qualified small business stock (QSBS) exclusion" : null,
        "Consult with CPA for state-specific entity considerations",
        "Review annually as income levels change",
      ].filter(Boolean),
    });
  } catch {
    // Fallback if the shared calculator isn't available
    const soleProprietorSE = netIncome * 0.9235 * 0.153;
    const sCorpSE = ownerSalary * 0.0765 * 2; // employer + employee FICA
    const sCorpSavings = soleProprietorSE - sCorpSE;

    return JSON.stringify({
      summary: `Business entity comparison for $${(revenue / 1000).toFixed(0)}k revenue`,
      inputs: { grossRevenue: revenue, businessExpenses: expenses, netBusinessIncome: netIncome },
      comparison: {
        soleProprietor: { selfEmploymentTax: Math.round(soleProprietorSE), totalTaxBurden: "Highest SE tax" },
        sCorp: { ficaTax: Math.round(sCorpSE), savings: Math.round(sCorpSavings), note: "Requires reasonable salary" },
        cCorp: { note: "Double taxation but QSBS exclusion possible for qualifying businesses" },
      },
      estimatedSCorpSavings: Math.round(sCorpSavings),
      recommendations: [
        sCorpSavings > 5000 ? `S-Corp election could save ~$${Math.round(sCorpSavings / 1000)}k/year in self-employment tax` : null,
        "Ensure owner salary passes 'reasonable compensation' test",
        "Consider retirement plan options (SEP-IRA, Solo 401k, Defined Benefit)",
      ].filter(Boolean),
    });
  }
}

function runIncomeProjection(args: Record<string, any>): string {
  const role = args.role || "experienced";
  const baseGDC = args.base_gdc || 150000;
  const overrideRate = args.override_rate || 0;
  const teamSize = args.team_size || 0;
  const years = args.years || 5;
  const growthRate = args.growth_rate || 0.10;

  const projection: any[] = [];
  let cumulative = 0;

  for (let y = 1; y <= years; y++) {
    const gdc = baseGDC * Math.pow(1 + growthRate, y - 1);
    const overrides = teamSize > 0 ? teamSize * baseGDC * 0.8 * overrideRate * Math.pow(1 + growthRate * 0.5, y - 1) : 0;
    const bonuses = gdc > 200000 ? gdc * 0.05 : 0; // production bonus
    const total = gdc + overrides + bonuses;
    cumulative += total;

    projection.push({
      year: y,
      gdc: Math.round(gdc),
      overrides: Math.round(overrides),
      bonuses: Math.round(bonuses),
      totalIncome: Math.round(total),
      cumulativeIncome: Math.round(cumulative),
    });
  }

  return JSON.stringify({
    summary: `${years}-year income projection for ${role} advisor`,
    inputs: {
      role,
      baseGDC: Math.round(baseGDC),
      overrideRate: `${(overrideRate * 100).toFixed(1)}%`,
      teamSize,
      growthRate: `${(growthRate * 100).toFixed(0)}%`,
    },
    projection,
    summary_stats: {
      year1Income: Math.round(projection[0].totalIncome),
      finalYearIncome: Math.round(projection[projection.length - 1].totalIncome),
      totalCumulative: Math.round(cumulative),
      averageAnnual: Math.round(cumulative / years),
      growthMultiple: `${(projection[projection.length - 1].totalIncome / projection[0].totalIncome).toFixed(1)}x`,
    },
    recommendations: [
      teamSize === 0 ? "Consider building a team to add override income streams" : null,
      growthRate < 0.10 ? "Target 10%+ annual GDC growth through client acquisition and deepening" : null,
      baseGDC > 300000 ? "At this production level, explore management/director tracks for leverage" : null,
      "Diversify across channels (insurance, investments, planning fees) for stability",
      "Track monthly production against plan and adjust quarterly",
    ].filter(Boolean),
  });
}
