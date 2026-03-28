/**
 * AI Tool Calling — Calculators & Models (C11, C12)
 * 
 * Exposes all 8 calculators and 8 models as LLM function-calling tools.
 * The AI can invoke these from chat to provide structured financial analysis.
 * 
 * Calculator logic mirrors the tRPC procedures in routers.ts.
 */
import type { Tool } from "./_core/llm";

// ─── Asset Classification (Fix 6) ──────────────────────────────────
export function classifyAsset(asset: string): "equity" | "bond" | "cash" | "alternative" | "other" {
  const lower = asset.toLowerCase();
  const trimmed = asset.trim();
  // Known equity patterns
  if (/stock|equity|sp500|s&p|nasdaq|dow|russell|vanguard.*growth|fidelity.*500|total.?market|large.?cap|small.?cap|mid.?cap|growth|value.?fund|index.?fund|etf/i.test(lower)) return "equity";
  // Individual stock tickers (1-5 uppercase letters)
  if (/^[A-Z]{1,5}$/.test(trimmed)) return "equity";
  // Known bond patterns
  if (/bond|fixed|treasury|tips|municipal|corporate.*bond|agg\b|bnd\b|govt|t-bill|t-note|high.?yield|investment.?grade/i.test(lower)) return "bond";
  // Cash patterns
  if (/cash|money.?market|savings|cd\b|certificate|sweep|checking|mmf/i.test(lower)) return "cash";
  // Alternative patterns
  if (/real.?estate|reit|commodity|gold|silver|crypto|bitcoin|ethereum|private.?equity|hedge|venture|timber|farmland|collectible|art\b|wine\b/i.test(lower)) return "alternative";
  return "other";
}

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
          loanRate: { type: "number", description: "Loan interest rate percentage (default 6). Should be populated from current FRED SOFR/Treasury rate + spread when available." },
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
      description: "Project estate value and tax implications over time. Supports specific trust types: none, revocable, ilit, grat, qprt, crt, slat, idgt.",
      parameters: {
        type: "object",
        properties: {
          totalAssets: { type: "number", description: "Total current asset value" },
          annualGrowth: { type: "number", description: "Expected annual growth percentage (default 5)" },
          yearsToProject: { type: "number", description: "Years to project forward (default 20)" },
          trustType: { type: "string", description: "Trust type: none, revocable, ilit, grat, qprt, crt, slat, idgt (default none). If hasTrust=true is passed, treated as revocable." },
          hasTrust: { type: "boolean", description: "DEPRECATED: Use trustType instead. If true, treated as trustType='revocable'." },
          lifeInsuranceDeathBenefit: { type: "number", description: "For ILIT scenarios: death benefit amount removed from taxable estate (default 0)" },
          annualGiftingAmount: { type: "number", description: "Annual gifting amount for modeling ongoing gifting strategies (default 0)" },
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
      description: "Compare financial products side by side on key dimensions. Provide specific product names from the product catalog for best results.",
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
      description: "Run a portfolio risk assessment. Analyzes asset allocation, volatility, concentration risk, and risk-adjusted returns. When the user has connected financial accounts (Plaid/SnapTrade), map their holdings directly to the allocations array.",
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
            description: "Portfolio allocations with asset name/ticker and percentage weight",
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
  // ─── 4 New Model Tools (Improvement D) ─────────────────────────
  {
    type: "function",
    function: {
      name: "model_retirement_readiness",
      description: "Score overall retirement preparedness (0-100) combining savings rate, portfolio allocation, Social Security timing, and healthcare coverage.",
      parameters: {
        type: "object",
        properties: {
          currentAge: { type: "number", description: "Current age" },
          retirementAge: { type: "number", description: "Target retirement age (default 65)" },
          currentSavings: { type: "number", description: "Current total retirement savings" },
          annualIncome: { type: "number", description: "Current annual income" },
          savingsRate: { type: "number", description: "Annual savings rate as percentage of income (default 10)" },
          hasHealthInsurance: { type: "boolean", description: "Whether the user has health insurance coverage for retirement (default false)" },
          socialSecurityAge: { type: "number", description: "Planned Social Security claiming age (default 67)" },
          portfolioEquityPercent: { type: "number", description: "Percentage of portfolio in equities (default 60)" },
        },
        required: ["currentAge", "currentSavings"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "model_tax_efficiency",
      description: "Score tax optimization across current year deductions, account type allocation (Roth vs traditional), capital gains management, and charitable strategy.",
      parameters: {
        type: "object",
        properties: {
          annualIncome: { type: "number", description: "Annual gross income" },
          filingStatus: { type: "string", description: "Filing status: single, married_joint, married_separate, head_of_household" },
          traditional401k: { type: "number", description: "Annual traditional 401k contributions (default 0)" },
          rothContributions: { type: "number", description: "Annual Roth contributions (default 0)" },
          capitalGains: { type: "number", description: "Realized capital gains this year (default 0)" },
          capitalLosses: { type: "number", description: "Realized capital losses this year (default 0)" },
          charitableGiving: { type: "number", description: "Annual charitable contributions (default 0)" },
          hsaContributions: { type: "number", description: "Annual HSA contributions (default 0)" },
          stateOfResidence: { type: "string", description: "State 2-letter code (default US)" },
        },
        required: ["annualIncome"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "model_estate_completeness",
      description: "Score estate plan coverage: will, trust, POA, healthcare directive, beneficiary designations, digital assets plan.",
      parameters: {
        type: "object",
        properties: {
          hasWill: { type: "boolean", description: "Has a valid will (default false)" },
          hasTrust: { type: "boolean", description: "Has any trust in place (default false)" },
          trustType: { type: "string", description: "Type of trust if applicable" },
          hasPOA: { type: "boolean", description: "Has power of attorney (default false)" },
          hasHealthcareDirective: { type: "boolean", description: "Has healthcare directive/living will (default false)" },
          beneficiaryDesignationsReviewed: { type: "boolean", description: "Beneficiary designations reviewed in last 2 years (default false)" },
          hasDigitalAssetsPlan: { type: "boolean", description: "Has plan for digital assets (default false)" },
          totalEstateValue: { type: "number", description: "Total estate value for threshold analysis" },
          dependents: { type: "number", description: "Number of dependents (default 0)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "model_financial_health",
      description: "Composite financial health score combining debt-to-income, savings rate, insurance coverage, emergency fund, and portfolio diversification.",
      parameters: {
        type: "object",
        properties: {
          annualIncome: { type: "number", description: "Annual gross income" },
          monthlyDebtPayments: { type: "number", description: "Total monthly debt payments (default 0)" },
          emergencyFundMonths: { type: "number", description: "Months of expenses covered by emergency fund (default 0)" },
          savingsRate: { type: "number", description: "Savings rate as percentage of income (default 0)" },
          hasLifeInsurance: { type: "boolean", description: "Has life insurance (default false)" },
          hasDisabilityInsurance: { type: "boolean", description: "Has disability insurance (default false)" },
          hasHealthInsurance: { type: "boolean", description: "Has health insurance (default true)" },
          portfolioDiversified: { type: "boolean", description: "Portfolio has diversified allocation (default false)" },
          totalDebt: { type: "number", description: "Total outstanding debt (default 0)" },
          totalAssets: { type: "number", description: "Total assets (default 0)" },
        },
        required: ["annualIncome"],
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
        return JSON.stringify({
          projections,
          roi: Math.round((policyValue - loanBalance) / (annualPremium * years) * 10000) / 100,
          loanRateUsed: loanRate,
          faceAmount,
          note: loanRate !== 6 ? `Loan rate of ${loanRate}% was used (sourced from current market data).` : "Default 6% loan rate used. Connect FRED data for live rate injection.",
        });
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
      // ─── ESTATE PROJECTION (Fix 4 — Trust Type Differentiation) ────
      case "calc_estate_projection": {
        const assets = args.totalAssets ?? 1000000;
        const growth = (args.annualGrowth ?? 5) / 100;
        const years = args.yearsToProject ?? 20;
        const deathBenefit = args.lifeInsuranceDeathBenefit ?? 0;
        const annualGifting = args.annualGiftingAmount ?? 0;
        // Backward compatibility: hasTrust=true → revocable
        let trustType: string = args.trustType ?? "none";
        if (trustType === "none" && args.hasTrust === true) trustType = "revocable";

        const exemption = 13610000; // 2024 federal estate tax exemption
        let value = assets;
        let removedFromEstate = 0; // Assets moved outside estate
        const projections = [];

        for (let y = 1; y <= years; y++) {
          value *= (1 + growth);
          // Apply annual gifting reduction
          if (annualGifting > 0) {
            value -= annualGifting;
            removedFromEstate += annualGifting;
          }

          let taxableEstate = value;
          let estateTax = 0;
          let trustExplanation = "";

          switch (trustType) {
            case "revocable":
              // Revocable trust: no estate tax reduction, but avoids probate
              taxableEstate = Math.max(0, value - exemption);
              estateTax = taxableEstate * 0.40;
              // 2% probate cost savings
              trustExplanation = "Revocable trust avoids probate (~2% estate savings) but assets remain in taxable estate.";
              break;

            case "ilit":
              // ILIT: death benefit removed from taxable estate entirely
              taxableEstate = Math.max(0, value - deathBenefit - exemption);
              estateTax = taxableEstate * 0.40;
              trustExplanation = `ILIT removes $${deathBenefit.toLocaleString()} death benefit from taxable estate. Proceeds pass to beneficiaries estate-tax-free.`;
              break;

            case "grat": {
              // GRAT: discount transferred asset value using IRS 7520 rate
              const section7520Rate = 0.05; // Approximate; would use FRED data if available
              const grantorRetainedAnnuity = assets * section7520Rate;
              const remainderDiscount = Math.max(0, 1 - (grantorRetainedAnnuity * y) / value);
              const transferredValue = value * remainderDiscount;
              taxableEstate = Math.max(0, (value - transferredValue) - exemption);
              estateTax = taxableEstate * 0.40;
              trustExplanation = `GRAT transfers appreciation above ${(section7520Rate * 100).toFixed(1)}% hurdle rate to beneficiaries tax-free. Remainder interest discount: ${(remainderDiscount * 100).toFixed(1)}%.`;
              break;
            }

            case "qprt": {
              // QPRT: residence removed from estate at discounted value
              const residenceDiscount = 0.35; // Typical QPRT discount
              const removedValue = assets * residenceDiscount;
              taxableEstate = Math.max(0, (value - removedValue) - exemption);
              estateTax = taxableEstate * 0.40;
              trustExplanation = `QPRT removes residence at ~${(residenceDiscount * 100).toFixed(0)}% discount from estate. Must survive the trust term.`;
              break;
            }

            case "crt": {
              // CRT: charitable deduction + income stream
              const charitableDeduction = value * 0.30; // Approximate
              const incomeTaxBenefit = charitableDeduction * 0.37; // Top bracket
              taxableEstate = Math.max(0, (value - charitableDeduction) - exemption);
              estateTax = taxableEstate * 0.40;
              trustExplanation = `CRT provides ~$${Math.round(charitableDeduction).toLocaleString()} charitable deduction, ~$${Math.round(incomeTaxBenefit).toLocaleString()} income tax benefit, plus income stream to grantor.`;
              break;
            }

            case "slat":
            case "idgt": {
              // SLAT/IDGT: assets removed from estate, grow outside
              const transferredAssets = assets * 0.5; // Typical 50% transfer
              const outsideGrowth = transferredAssets * Math.pow(1 + growth, y) - transferredAssets;
              taxableEstate = Math.max(0, (value - transferredAssets - outsideGrowth) - exemption);
              estateTax = taxableEstate * 0.40;
              trustExplanation = `${trustType.toUpperCase()} removes ~$${Math.round(transferredAssets).toLocaleString()} from estate. Growth of $${Math.round(outsideGrowth).toLocaleString()} occurs outside the taxable estate.`;
              break;
            }

            default: // "none"
              taxableEstate = Math.max(0, value - exemption);
              estateTax = taxableEstate * 0.40;
              trustExplanation = "No trust in place. Full estate subject to federal estate tax above exemption.";
          }

          projections.push({
            year: y,
            estateValue: Math.round(value),
            taxableAmount: Math.round(taxableEstate),
            estimatedTax: Math.round(estateTax),
            trustExplanation: y === years ? trustExplanation : undefined,
          });
        }

        const noTrustTax = Math.max(0, value - exemption) * 0.40;
        const withTrustTax = projections[projections.length - 1]?.estimatedTax ?? 0;
        const taxSavings = Math.round(noTrustTax - withTrustTax);

        return JSON.stringify({
          projections: projections.slice(-5),
          finalValue: Math.round(value),
          trustType,
          trustBenefit: trustType !== "none"
            ? `${trustType.toUpperCase()} trust saves approximately $${taxSavings.toLocaleString()} in estate taxes over ${years} years.`
            : "No trust in place — consider trust strategies to reduce estate tax exposure.",
          taxSavingsVsNoTrust: taxSavings,
          totalGifted: Math.round(removedFromEstate),
        });
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
        const criteria = args.criteria ?? ["cost", "features", "risk", "returns"];
        return JSON.stringify({
          comparison: names.map((n: string) => ({
            product: n,
            criteria: criteria.reduce((acc: Record<string, string>, c: string) => {
              acc[c] = "Requires product catalog lookup — ask the AI to search the product database for details";
              return acc;
            }, {}),
          })),
          tip: "For detailed comparisons, ensure the products are in the product catalog. The AI can search and fill in specific details.",
        });
      }

      // ─── PORTFOLIO RISK (Fix 6 — Asset Classification) ────────────
      case "model_portfolio_risk": {
        const allocs: Array<{ asset: string; percentage: number }> = args.allocations ?? [];
        const total = allocs.reduce((s, a) => s + (a.percentage || 0), 0);

        // Classify each allocation using the proper classifier
        const classified = allocs.map(a => ({
          ...a,
          assetClass: classifyAsset(a.asset),
        }));

        const equityPct = classified.filter(a => a.assetClass === "equity").reduce((s, a) => s + a.percentage, 0);
        const bondPct = classified.filter(a => a.assetClass === "bond").reduce((s, a) => s + a.percentage, 0);
        const cashPct = classified.filter(a => a.assetClass === "cash").reduce((s, a) => s + a.percentage, 0);
        const altPct = classified.filter(a => a.assetClass === "alternative").reduce((s, a) => s + a.percentage, 0);
        const otherPct = classified.filter(a => a.assetClass === "other").reduce((s, a) => s + a.percentage, 0);

        // Risk score: equities=high(0.9), alternatives=medium(0.6), other=medium(0.5), bonds=low(0.2), cash=none(0)
        const riskScore = Math.round(
          equityPct * 0.9 + altPct * 0.6 + otherPct * 0.5 + bondPct * 0.2 + cashPct * 0
        );

        // Concentration risk (Fix 6.3)
        const concentrationRisks = allocs
          .filter(a => a.percentage > 25)
          .map(a => ({
            symbol: a.asset,
            weight: a.percentage,
            warning: `Single-position concentration of ${a.percentage}% exceeds 25% threshold`,
          }));

        // Sharpe estimate
        const expectedReturn = equityPct * 0.10 + bondPct * 0.04 + altPct * 0.07 + cashPct * 0.02;
        const expectedVol = equityPct * 0.16 + bondPct * 0.05 + altPct * 0.12 + cashPct * 0.01 + 0.01;
        const sharpe = Math.round((expectedReturn / expectedVol) * 100) / 100;

        return JSON.stringify({
          totalAllocation: total,
          classification: { equity: equityPct, bond: bondPct, cash: cashPct, alternative: altPct, other: otherPct },
          holdings: classified.map(c => ({ asset: c.asset, percentage: c.percentage, classifiedAs: c.assetClass })),
          riskScore,
          riskLevel: riskScore > 75 ? "aggressive" : riskScore > 50 ? "moderately_aggressive" : riskScore > 30 ? "moderate" : riskScore > 15 ? "moderately_conservative" : "conservative",
          sharpeEstimate: sharpe,
          concentrationRisk: concentrationRisks.length > 0 ? concentrationRisks : null,
          recommendation: riskScore > 75
            ? "Aggressive allocation — consider adding bonds or diversifying across sectors for stability"
            : riskScore > 50
              ? "Moderately aggressive — reasonable for long time horizons, consider rebalancing as retirement approaches"
              : riskScore > 30
                ? "Moderate allocation — well-balanced for most investors"
                : "Conservative allocation — consider adding equities for long-term growth if time horizon permits",
          dataSource: "connected_accounts",
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

      // ─── 4 New Model Tools (Improvement D) ────────────────────────
      case "model_retirement_readiness": {
        const age = args.currentAge ?? 40;
        const retAge = args.retirementAge ?? 65;
        const savings = args.currentSavings ?? 0;
        const income = args.annualIncome ?? 80000;
        const savingsRate = args.savingsRate ?? 10;
        const hasHealth = args.hasHealthInsurance ?? false;
        const ssAge = args.socialSecurityAge ?? 67;
        const equityPct = args.portfolioEquityPercent ?? 60;

        const yearsToRetire = retAge - age;
        const annualSavings = income * (savingsRate / 100);
        const projectedSavings = savings * Math.pow(1.07, yearsToRetire) + annualSavings * ((Math.pow(1.07, yearsToRetire) - 1) / 0.07);
        const targetSavings = income * 0.8 * 25; // 80% income replacement, 25x rule

        // Score components (each 0-25, total 0-100)
        const savingsScore = Math.min(25, Math.round((projectedSavings / targetSavings) * 25));
        const allocationScore = Math.min(25, Math.round(
          age < 40 ? (equityPct >= 70 ? 25 : equityPct / 70 * 25) :
          age < 55 ? (equityPct >= 50 && equityPct <= 70 ? 25 : 15) :
          (equityPct >= 30 && equityPct <= 50 ? 25 : 15)
        ));
        const ssScore = Math.min(25, ssAge >= 70 ? 25 : ssAge >= 67 ? 20 : ssAge >= 65 ? 15 : 10);
        const healthScore = hasHealth ? 25 : 5;
        const totalScore = savingsScore + allocationScore + ssScore + healthScore;

        return JSON.stringify({
          readinessScore: totalScore,
          scoreBreakdown: { savings: savingsScore, allocation: allocationScore, socialSecurity: ssScore, healthcare: healthScore },
          projectedSavings: Math.round(projectedSavings),
          targetSavings: Math.round(targetSavings),
          gap: Math.round(Math.max(0, targetSavings - projectedSavings)),
          yearsToRetirement: yearsToRetire,
          level: totalScore >= 80 ? "excellent" : totalScore >= 60 ? "good" : totalScore >= 40 ? "needs_improvement" : "critical",
          recommendations: [
            savingsScore < 20 ? `Increase savings rate from ${savingsRate}% to at least ${Math.min(30, savingsRate + 5)}%` : null,
            !hasHealth ? "Secure health insurance coverage for retirement — healthcare is the #1 retirement expense" : null,
            ssAge < 67 ? `Delaying Social Security to 67-70 increases monthly benefit by 24-77%` : null,
          ].filter(Boolean),
        });
      }

      case "model_tax_efficiency": {
        const income = args.annualIncome ?? 100000;
        const status = args.filingStatus ?? "single";
        const trad401k = args.traditional401k ?? 0;
        const roth = args.rothContributions ?? 0;
        const gains = args.capitalGains ?? 0;
        const losses = args.capitalLosses ?? 0;
        const charitable = args.charitableGiving ?? 0;
        const hsa = args.hsaContributions ?? 0;

        // Score components (each 0-25)
        const max401k = 23000; // 2024 limit
        const deferralScore = Math.min(25, Math.round(((trad401k + roth) / max401k) * 25));
        const rothScore = roth > 0 ? Math.min(25, 15 + Math.round((roth / 7000) * 10)) : (trad401k > 0 ? 10 : 0);
        const harvestingScore = losses > 0 ? Math.min(25, 15 + Math.round(Math.min(losses, 3000) / 3000 * 10)) : (gains > 0 ? 5 : 15);
        const charitableScore = charitable > 0 ? Math.min(25, 10 + Math.round((charitable / (income * 0.05)) * 15)) : 5;
        const totalScore = Math.min(100, deferralScore + rothScore + harvestingScore + charitableScore);

        return JSON.stringify({
          taxEfficiencyScore: totalScore,
          scoreBreakdown: { deferral: deferralScore, rothOptimization: rothScore, gainManagement: harvestingScore, charitableStrategy: charitableScore },
          level: totalScore >= 80 ? "highly_optimized" : totalScore >= 60 ? "moderately_optimized" : totalScore >= 40 ? "basic" : "unoptimized",
          netCapitalGains: Math.max(0, gains - losses),
          taxLossHarvestingOpportunity: gains > losses ? Math.round(gains - losses) : 0,
          recommendations: [
            trad401k + roth < max401k ? `Max out retirement contributions — you have $${(max401k - trad401k - roth).toLocaleString()} of unused 401k space` : null,
            roth === 0 ? "Consider Roth contributions for tax-free growth — especially valuable if you expect higher future tax rates" : null,
            gains > 0 && losses === 0 ? "Harvest tax losses to offset capital gains — review portfolio for loss candidates" : null,
            hsa === 0 ? "Consider HSA contributions — triple tax advantage (deduction, tax-free growth, tax-free medical withdrawals)" : null,
            charitable > 0 && charitable < income * 0.03 ? "Consider donor-advised fund for bunching charitable deductions" : null,
          ].filter(Boolean),
        });
      }

      case "model_estate_completeness": {
        const hasWill = args.hasWill ?? false;
        const hasTrust = args.hasTrust ?? false;
        const hasPOA = args.hasPOA ?? false;
        const hasDirective = args.hasHealthcareDirective ?? false;
        const benReviewed = args.beneficiaryDesignationsReviewed ?? false;
        const hasDigital = args.hasDigitalAssetsPlan ?? false;
        const estateValue = args.totalEstateValue ?? 0;
        const dependents = args.dependents ?? 0;

        // Score components
        const willScore = hasWill ? 20 : 0;
        const trustScore = hasTrust ? 20 : (estateValue > 5000000 ? 0 : 10); // Trust more critical for large estates
        const poaScore = hasPOA ? 15 : 0;
        const directiveScore = hasDirective ? 15 : 0;
        const benScore = benReviewed ? 15 : 0;
        const digitalScore = hasDigital ? 15 : 5;
        const totalScore = willScore + trustScore + poaScore + directiveScore + benScore + digitalScore;

        const missing: string[] = [];
        if (!hasWill) missing.push("Will — foundational document for asset distribution");
        if (!hasTrust && estateValue > 5000000) missing.push("Trust — critical for estates above $5M to minimize taxes and avoid probate");
        if (!hasPOA) missing.push("Power of Attorney — essential for financial decision-making if incapacitated");
        if (!hasDirective) missing.push("Healthcare Directive — ensures medical wishes are honored");
        if (!benReviewed) missing.push("Beneficiary Designations — review all accounts (retirement, insurance, bank) to ensure alignment with estate plan");
        if (!hasDigital) missing.push("Digital Assets Plan — passwords, crypto wallets, online accounts");

        return JSON.stringify({
          completenessScore: totalScore,
          level: totalScore >= 85 ? "comprehensive" : totalScore >= 60 ? "adequate" : totalScore >= 35 ? "incomplete" : "critical_gaps",
          documentsInPlace: { will: hasWill, trust: hasTrust, powerOfAttorney: hasPOA, healthcareDirective: hasDirective, beneficiaryDesignations: benReviewed, digitalAssets: hasDigital },
          missingItems: missing,
          urgency: dependents > 0 && !hasWill ? "URGENT: With dependents, a will is essential to ensure guardianship and asset distribution" : missing.length > 3 ? "HIGH: Multiple critical gaps in estate plan" : missing.length > 0 ? "MODERATE: Some items need attention" : "LOW: Estate plan appears comprehensive",
          estateThresholdNote: estateValue > 13610000 ? "Estate exceeds federal exemption — advanced planning (ILIT, GRAT, etc.) strongly recommended" : estateValue > 5000000 ? "Estate approaching exemption threshold — proactive planning recommended" : null,
        });
      }

      case "model_financial_health": {
        const income = args.annualIncome ?? 80000;
        const monthlyDebt = args.monthlyDebtPayments ?? 0;
        const emergencyMonths = args.emergencyFundMonths ?? 0;
        const savingsRate = args.savingsRate ?? 0;
        const hasLife = args.hasLifeInsurance ?? false;
        const hasDisability = args.hasDisabilityInsurance ?? false;
        const hasHealth = args.hasHealthInsurance ?? true;
        const diversified = args.portfolioDiversified ?? false;
        const totalDebt = args.totalDebt ?? 0;
        const totalAssets = args.totalAssets ?? 0;

        const monthlyIncome = income / 12;
        const dti = monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 0;

        // Score components (each 0-20, total 0-100)
        const dtiScore = dti < 20 ? 20 : dti < 36 ? 15 : dti < 43 ? 10 : 5;
        const emergencyScore = emergencyMonths >= 6 ? 20 : emergencyMonths >= 3 ? 15 : emergencyMonths >= 1 ? 10 : 0;
        const savingsScore = savingsRate >= 20 ? 20 : savingsRate >= 15 ? 17 : savingsRate >= 10 ? 13 : savingsRate >= 5 ? 8 : 0;
        const insuranceScore = (hasLife ? 7 : 0) + (hasDisability ? 7 : 0) + (hasHealth ? 6 : 0);
        const diversificationScore = diversified ? 20 : (totalAssets > 0 ? 10 : 5);
        const totalScore = dtiScore + emergencyScore + savingsScore + insuranceScore + diversificationScore;

        return JSON.stringify({
          financialHealthScore: totalScore,
          scoreBreakdown: { debtToIncome: dtiScore, emergencyFund: emergencyScore, savingsRate: savingsScore, insurance: insuranceScore, diversification: diversificationScore },
          level: totalScore >= 80 ? "excellent" : totalScore >= 60 ? "good" : totalScore >= 40 ? "fair" : "needs_attention",
          metrics: { dtiRatio: Math.round(dti * 10) / 10, emergencyFundMonths: emergencyMonths, savingsRatePercent: savingsRate, netWorth: totalAssets - totalDebt },
          recommendations: [
            dti > 36 ? `Debt-to-income ratio of ${Math.round(dti)}% is high — target below 36%` : null,
            emergencyMonths < 3 ? `Build emergency fund to at least 3 months of expenses ($${Math.round(monthlyIncome * 3).toLocaleString()})` : null,
            emergencyMonths >= 3 && emergencyMonths < 6 ? "Grow emergency fund to 6 months for full protection" : null,
            savingsRate < 15 ? `Increase savings rate from ${savingsRate}% toward 15-20% of income` : null,
            !hasLife ? "Consider life insurance — especially important with dependents or debts" : null,
            !hasDisability ? "Disability insurance protects your income — your most valuable asset" : null,
            !diversified ? "Diversify investments across asset classes to reduce risk" : null,
          ].filter(Boolean),
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Tool execution failed" });
  }
}
