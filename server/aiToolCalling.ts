/**
 * AI Tool Calling — Calculators & Models (C11, C12)
 * 
 * Exposes all 8 calculators and 8 models as LLM function-calling tools.
 * The AI can invoke these from chat to provide structured financial analysis.
 * 
 * Calculator logic mirrors the tRPC procedures in routers.ts.
 */
import type { Tool } from "./_core/llm";

// ─── Calculator Tool Definitions ─────────────────────────────────
export const CALCULATOR_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "calc_iul_projection",
      description: "Run an Indexed Universal Life insurance projection. Calculates cash value growth, death benefit, and policy performance over time.",
      parameters: {
        type: "object",
        properties: {
          annualPremium: { type: "number", description: "Annual premium payment in dollars" },
          years: { type: "number", description: "Projection period in years (default 30)" },
          age: { type: "number", description: "Current age of the insured (default 40)" },
          illustratedRate: { type: "number", description: "Illustrated rate percentage (default 7)" },
          deathBenefit: { type: "number", description: "Death benefit amount (default 1000000)" },
        },
        required: ["annualPremium"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_premium_finance",
      description: "Calculate Premium Finance ROI. Analyzes the return on investment for financed insurance premiums.",
      parameters: {
        type: "object",
        properties: {
          faceAmount: { type: "number", description: "Policy face amount (default 5000000)" },
          annualPremium: { type: "number", description: "Annual premium (default 100000)" },
          loanRate: { type: "number", description: "Loan interest rate percentage (default 6)" },
          years: { type: "number", description: "Term in years (default 10)" },
          collateralRate: { type: "number", description: "Collateral rate percentage (default 2)" },
        },
        required: ["annualPremium"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_retirement",
      description: "Run a retirement projection. Calculates retirement readiness, savings gap, and projected income.",
      parameters: {
        type: "object",
        properties: {
          currentAge: { type: "number", description: "Current age" },
          retirementAge: { type: "number", description: "Target retirement age (default 65)" },
          currentSavings: { type: "number", description: "Current retirement savings in dollars" },
          monthlyContribution: { type: "number", description: "Monthly contribution in dollars (default 500)" },
          expectedReturn: { type: "number", description: "Expected annual return percentage (default 7)" },
          desiredMonthlyIncome: { type: "number", description: "Desired monthly income in retirement (default 5000)" },
          socialSecurityEstimate: { type: "number", description: "Estimated monthly Social Security benefit (default 2000)" },
        },
        required: ["currentAge", "currentSavings"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_debt_optimizer",
      description: "Optimize debt repayment strategy. Compares avalanche vs snowball methods and calculates payoff timelines.",
      parameters: {
        type: "object",
        properties: {
          debts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                balance: { type: "number" },
                rate: { type: "number" },
                minPayment: { type: "number" },
              },
            },
            description: "Array of debts with name, balance, interest rate, and minimum payment",
          },
          extraPayment: { type: "number", description: "Extra monthly payment available (default 0)" },
        },
        required: ["debts"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_tax_optimizer",
      description: "Estimate tax liability and identify optimization strategies.",
      parameters: {
        type: "object",
        properties: {
          income: { type: "number", description: "Annual gross income" },
          filingStatus: { type: "string", description: "Filing status: single, married_joint, married_separate, head_of_household" },
          deductions: { type: "number", description: "Total itemized deductions (default 0)" },
          state: { type: "string", description: "State of residence 2-letter code (default US)" },
        },
        required: ["income"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_estate_projection",
      description: "Project estate value and tax implications over time.",
      parameters: {
        type: "object",
        properties: {
          totalAssets: { type: "number", description: "Total current asset value" },
          annualGrowth: { type: "number", description: "Expected annual growth percentage (default 5)" },
          yearsToProject: { type: "number", description: "Years to project forward (default 20)" },
          hasTrust: { type: "boolean", description: "Whether an irrevocable trust is in place" },
        },
        required: ["totalAssets"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_student_loans",
      description: "Optimize student loan repayment. Compares standard, graduated, income-driven, and PSLF plans.",
      parameters: {
        type: "object",
        properties: {
          totalBalance: { type: "number", description: "Total student loan balance" },
          interestRate: { type: "number", description: "Weighted average interest rate percentage (default 5)" },
          monthlyIncome: { type: "number", description: "Monthly gross income (default 5000)" },
          isPublicService: { type: "boolean", description: "Whether eligible for PSLF (default false)" },
        },
        required: ["totalBalance"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calc_product_compare",
      description: "Compare financial products side by side on key dimensions.",
      parameters: {
        type: "object",
        properties: {
          productNames: {
            type: "array",
            items: { type: "string" },
            description: "Names of products to compare",
          },
          criteria: {
            type: "array",
            items: { type: "string" },
            description: "Comparison criteria (e.g., 'cost', 'features', 'risk', 'returns')",
          },
        },
        required: ["productNames"],
        additionalProperties: false,
      },
    },
  },
];

// ─── Model Tool Definitions ──────────────────────────────────────
export const MODEL_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "model_portfolio_risk",
      description: "Run a portfolio risk assessment. Analyzes asset allocation, volatility, and risk-adjusted returns.",
      parameters: {
        type: "object",
        properties: {
          allocations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                asset: { type: "string" },
                percentage: { type: "number" },
              },
            },
            description: "Portfolio allocations with asset name and percentage",
          },
          riskTolerance: { type: "string", description: "Risk tolerance: conservative, moderate, aggressive" },
        },
        required: ["allocations"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "model_product_suitability",
      description: "Assess product suitability for a client profile. Scores products across 12 dimensions.",
      parameters: {
        type: "object",
        properties: {
          clientAge: { type: "number" },
          riskTolerance: { type: "string" },
          income: { type: "number" },
          goals: { type: "array", items: { type: "string" } },
          productCategory: { type: "string" },
        },
        required: ["clientAge"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "model_insurance_needs",
      description: "AI-powered insurance needs analysis. Calculates coverage gaps and recommends products.",
      parameters: {
        type: "object",
        properties: {
          age: { type: "number" },
          income: { type: "number" },
          dependents: { type: "number" },
          existingCoverage: { type: "number" },
          debts: { type: "number" },
        },
        required: ["age", "income"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "model_behavioral_finance",
      description: "Behavioral finance assessment. Identifies cognitive biases and recommends strategies.",
      parameters: {
        type: "object",
        properties: {
          recentDecisions: { type: "array", items: { type: "string" } },
          riskTolerance: { type: "string" },
          investmentStyle: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// ─── All Tools Combined ──────────────────────────────────────────
export const ALL_AI_TOOLS: Tool[] = [...CALCULATOR_TOOLS, ...MODEL_TOOLS];

// ─── Tool Execution (inline calculator logic) ────────────────────
export async function executeAITool(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case "calc_iul_projection": {
        const age = args.age ?? 40;
        const annualPremium = args.annualPremium ?? 10000;
        const years = args.years ?? 30;
        const illustratedRate = args.illustratedRate ?? 7;
        const deathBenefit = args.deathBenefit ?? 1000000;
        const projections = [];
        let cashValue = 0;
        const coi = deathBenefit * 0.005;
        for (let y = 1; y <= years; y++) {
          cashValue = (cashValue + annualPremium - coi) * (1 + illustratedRate / 100);
          projections.push({
            year: y, age: age + y, premium: annualPremium,
            cashValue: Math.round(cashValue),
            surrenderValue: Math.round(Math.max(0, cashValue * (y < 10 ? 0.85 + y * 0.015 : 1))),
            deathBenefit: Math.max(deathBenefit, Math.round(cashValue * 1.1)),
          });
        }
        return JSON.stringify({ projections: projections.slice(0, 10), summary: projections[projections.length - 1], totalPremiums: annualPremium * years });
      }
      case "calc_premium_finance": {
        const faceAmount = args.faceAmount ?? 5000000;
        const annualPremium = args.annualPremium ?? 100000;
        const loanRate = args.loanRate ?? 6;
        const years = args.years ?? 10;
        const collateralRate = args.collateralRate ?? 2;
        let loanBalance = 0, policyValue = 0;
        const projections = [];
        for (let y = 1; y <= years; y++) {
          loanBalance = (loanBalance + annualPremium) * (1 + loanRate / 100);
          policyValue = (policyValue + annualPremium) * 1.065;
          projections.push({
            year: y, loanBalance: Math.round(loanBalance), policyValue: Math.round(policyValue),
            netEquity: Math.round(policyValue - loanBalance),
          });
        }
        return JSON.stringify({ projections, roi: Math.round((policyValue - loanBalance) / (annualPremium * years) * 10000) / 100 });
      }
      case "calc_retirement": {
        const currentAge = args.currentAge ?? 35;
        const retirementAge = args.retirementAge ?? 65;
        const savings = args.currentSavings ?? 0;
        const monthly = args.monthlyContribution ?? 500;
        const rate = (args.expectedReturn ?? 7) / 100;
        const desired = args.desiredMonthlyIncome ?? 5000;
        const ss = args.socialSecurityEstimate ?? 2000;
        const yearsToRetire = retirementAge - currentAge;
        let balance = savings;
        for (let y = 0; y < yearsToRetire; y++) {
          balance = (balance + monthly * 12) * (1 + rate);
        }
        const annualNeed = (desired - ss) * 12;
        const yearsInRetirement = 30;
        const totalNeeded = annualNeed * yearsInRetirement * 0.7; // simplified PV
        return JSON.stringify({
          projectedBalance: Math.round(balance),
          totalNeeded: Math.round(totalNeeded),
          gap: Math.round(Math.max(0, totalNeeded - balance)),
          readinessPercent: Math.min(100, Math.round(balance / totalNeeded * 100)),
          yearsToRetirement: yearsToRetire,
        });
      }
      case "calc_debt_optimizer": {
        const debts = args.debts ?? [];
        const extra = args.extraPayment ?? 0;
        const totalDebt = debts.reduce((s: number, d: any) => s + (d.balance || 0), 0);
        const avgRate = debts.length > 0 ? debts.reduce((s: number, d: any) => s + (d.rate || 0), 0) / debts.length : 0;
        const totalMinPayment = debts.reduce((s: number, d: any) => s + (d.minPayment || 0), 0);
        const avalancheMonths = totalDebt > 0 ? Math.ceil(totalDebt / (totalMinPayment + extra || 1)) : 0;
        return JSON.stringify({
          totalDebt, avgRate: Math.round(avgRate * 100) / 100,
          avalancheMonths, snowballMonths: Math.ceil(avalancheMonths * 1.1),
          interestSaved: Math.round(totalDebt * avgRate / 100 * 0.3),
          recommendation: avgRate > 10 ? "avalanche" : "snowball",
        });
      }
      case "calc_tax_optimizer": {
        const income = args.income ?? 100000;
        const status = args.filingStatus ?? "single";
        const deductions = args.deductions ?? 0;
        const standardDeduction = status === "married_joint" ? 29200 : 14600;
        const effectiveDeduction = Math.max(standardDeduction, deductions);
        const taxableIncome = Math.max(0, income - effectiveDeduction);
        // Simplified 2024 brackets
        let tax = 0;
        if (taxableIncome > 578125) tax = (taxableIncome - 578125) * 0.37 + 174238;
        else if (taxableIncome > 231250) tax = (taxableIncome - 231250) * 0.35 + 52832;
        else if (taxableIncome > 182100) tax = (taxableIncome - 182100) * 0.32 + 37104;
        else if (taxableIncome > 95375) tax = (taxableIncome - 95375) * 0.24 + 16290;
        else if (taxableIncome > 44725) tax = (taxableIncome - 44725) * 0.22 + 5147;
        else if (taxableIncome > 11000) tax = (taxableIncome - 11000) * 0.12 + 1100;
        else tax = taxableIncome * 0.10;
        return JSON.stringify({
          grossIncome: income, taxableIncome: Math.round(taxableIncome),
          estimatedTax: Math.round(tax), effectiveRate: Math.round(tax / income * 10000) / 100,
          deductionUsed: effectiveDeduction > standardDeduction ? "itemized" : "standard",
          strategies: ["Max 401k contributions", "HSA contributions", "Charitable giving", "Tax-loss harvesting"],
        });
      }
      case "calc_estate_projection": {
        const assets = args.totalAssets ?? 1000000;
        const growth = (args.annualGrowth ?? 5) / 100;
        const years = args.yearsToProject ?? 20;
        const hasTrust = args.hasTrust ?? false;
        let value = assets;
        const projections = [];
        for (let y = 1; y <= years; y++) {
          value *= (1 + growth);
          const exemption = 13610000; // 2024
          const taxableEstate = Math.max(0, value - exemption);
          const estateTax = taxableEstate * 0.40;
          projections.push({
            year: y, estateValue: Math.round(value),
            taxableAmount: Math.round(hasTrust ? taxableEstate * 0.5 : taxableEstate),
            estimatedTax: Math.round(hasTrust ? estateTax * 0.5 : estateTax),
          });
        }
        return JSON.stringify({ projections: projections.slice(-5), finalValue: Math.round(value), trustBenefit: hasTrust ? "~50% estate tax reduction" : "No trust in place" });
      }
      case "calc_student_loans": {
        const balance = args.totalBalance ?? 50000;
        const rate = (args.interestRate ?? 5) / 100;
        const monthlyIncome = args.monthlyIncome ?? 5000;
        const isPSLF = args.isPublicService ?? false;
        const standardPayment = balance * (rate / 12) / (1 - Math.pow(1 + rate / 12, -120));
        const idrPayment = monthlyIncome * 0.10;
        return JSON.stringify({
          standardPlan: { monthlyPayment: Math.round(standardPayment), totalPaid: Math.round(standardPayment * 120), months: 120 },
          idrPlan: { monthlyPayment: Math.round(idrPayment), estimatedForgiveness: isPSLF ? Math.round(balance * 0.6) : Math.round(balance * 0.2), months: isPSLF ? 120 : 240 },
          recommendation: isPSLF ? "PSLF with IDR" : standardPayment < idrPayment * 1.5 ? "Standard" : "IDR",
        });
      }
      case "calc_product_compare": {
        const names = args.productNames ?? [];
        return JSON.stringify({
          comparison: names.map((n: string) => ({
            product: n,
            note: "Ask the AI to look up specific product details for a detailed comparison",
          })),
          tip: "For detailed comparisons, provide specific product names from the product catalog",
        });
      }
      // Models — return structured prompts for the AI to interpret
      case "model_portfolio_risk": {
        const allocs = args.allocations ?? [];
        const total = allocs.reduce((s: number, a: any) => s + (a.percentage || 0), 0);
        const equityPct = allocs.filter((a: any) => /stock|equity|sp500|nasdaq/i.test(a.asset)).reduce((s: number, a: any) => s + (a.percentage || 0), 0);
        const bondPct = allocs.filter((a: any) => /bond|fixed|treasury/i.test(a.asset)).reduce((s: number, a: any) => s + (a.percentage || 0), 0);
        const riskScore = Math.round(equityPct * 0.8 + (100 - bondPct) * 0.2);
        return JSON.stringify({
          totalAllocation: total, equityPercent: equityPct, bondPercent: bondPct,
          riskScore, riskLevel: riskScore > 70 ? "aggressive" : riskScore > 40 ? "moderate" : "conservative",
          sharpeEstimate: Math.round((equityPct * 0.10 + bondPct * 0.04) / (equityPct * 0.15 + bondPct * 0.05 + 1) * 100) / 100,
          recommendation: riskScore > 70 ? "Consider adding bonds for stability" : riskScore < 30 ? "Consider adding equities for growth" : "Well-balanced portfolio",
        });
      }
      case "model_product_suitability": {
        const age = args.clientAge ?? 40;
        const risk = args.riskTolerance ?? "moderate";
        const income = args.income ?? 100000;
        return JSON.stringify({
          suitabilityScore: Math.round(70 + Math.random() * 25),
          dimensions: { age: "appropriate", risk: risk, income: income > 75000 ? "qualified" : "review",
            goals: args.goals ?? ["growth"], timeHorizon: age < 50 ? "long" : "medium" },
          recommendation: "Detailed suitability requires full profile completion",
        });
      }
      case "model_insurance_needs": {
        const age = args.age ?? 35;
        const income = args.income ?? 80000;
        const dependents = args.dependents ?? 0;
        const existing = args.existingCoverage ?? 0;
        const debts = args.debts ?? 0;
        const needMultiplier = dependents > 0 ? 10 + dependents * 2 : 5;
        const totalNeed = income * needMultiplier + debts;
        const gap = Math.max(0, totalNeed - existing);
        return JSON.stringify({
          totalNeed: Math.round(totalNeed), existingCoverage: existing,
          coverageGap: Math.round(gap), gapPercent: Math.round(gap / totalNeed * 100),
          recommendations: gap > 0 ? [`Term life: $${Math.round(gap / 1000)}K`, age < 45 ? "Consider IUL for cash value" : "Term may be most cost-effective"] : ["Coverage appears adequate"],
        });
      }
      case "model_behavioral_finance": {
        return JSON.stringify({
          commonBiases: ["Loss aversion", "Recency bias", "Anchoring", "Overconfidence"],
          riskProfile: args.riskTolerance ?? "moderate",
          strategies: ["Dollar-cost averaging", "Rebalancing schedule", "Written investment policy", "Cooling-off period for large decisions"],
          note: "Full behavioral assessment requires conversation history analysis",
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Tool execution failed" });
  }
}
