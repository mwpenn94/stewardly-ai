/**
 * Calculator Engine — AI Tool Registration Seed
 *
 * Registers all v7 engine endpoints as AI-callable tools in the aiTools table.
 * Called during server startup or via a seed endpoint.
 */

import { registerTool, getToolByName } from "../services/aiToolsRegistry";

export interface ToolSeedDef {
  toolName: string;
  toolType: "calculator" | "model" | "action" | "query" | "report";
  description: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  trpcProcedure: string;
  requiresAuth: boolean;
  requiresConfirmation: boolean;
}

export const CALCULATOR_TOOL_SEEDS: ToolSeedDef[] = [
  // ═══ UWE TOOLS ═══════════════════════════════════════════════════
  {
    toolName: "uwe_simulate",
    toolType: "calculator",
    description: "Run the Unified Wealth Engine simulation. Models 14 product types (term, IUL, whole life, DI, LTC, FIA, AUM, 401K, Roth, 529, estate, premium finance, split dollar, deferred comp) across 8 company profiles for a given client. Returns year-by-year projections of cash value, death benefit, tax savings, living benefits, and total value.",
    inputSchema: {
      type: "object",
      properties: {
        companyKey: { type: "string", enum: ["wealthbridge", "nwm", "massmutual", "guardian", "nyl", "prudential", "pacific", "transamerica", "donothing"], description: "Company profile to use" },
        profile: {
          type: "object",
          properties: {
            age: { type: "number", description: "Client age (18-100)" },
            income: { type: "number", description: "Annual income" },
            netWorth: { type: "number", description: "Total net worth" },
            savings: { type: "number", description: "Current savings balance" },
            dependents: { type: "number", description: "Number of dependents" },
            mortgage: { type: "number", description: "Outstanding mortgage balance" },
            debts: { type: "number", description: "Other debts" },
          },
          required: ["age", "income"],
        },
        years: { type: "number", description: "Projection horizon (1-200)", default: 30 },
      },
      required: ["companyKey", "profile"],
    },
    trpcProcedure: "calculatorEngine.uweSimulate",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "uwe_monte_carlo",
    toolType: "calculator",
    description: "Run Monte Carlo simulation (1000 trials) on a UWE wealth strategy. Returns percentile outcomes (10th, 25th, 50th, 75th, 90th) for portfolio value at each year, plus survival rate and worst/best case scenarios.",
    inputSchema: {
      type: "object",
      properties: {
        strategy: { type: "object", description: "UWE strategy config (from uwe_simulate)" },
        years: { type: "number", default: 30 },
        trials: { type: "number", default: 1000 },
        volatility: { type: "number", default: 0.15, description: "Annual volatility (0-0.5)" },
      },
      required: ["strategy"],
    },
    trpcProcedure: "calculatorEngine.uweMonteCarlo",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "uwe_estimate_premium",
    toolType: "calculator",
    description: "Estimate annual premium for a specific insurance product type given age, face amount, and health class. Uses industry rate tables with citations.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Product type: term, iul, wl, di, ltc, fia" },
        age: { type: "number", description: "Client age" },
        face: { type: "number", description: "Face amount / benefit amount" },
        health: { type: "string", enum: ["preferred", "standard", "rated"], default: "standard" },
      },
      required: ["type", "age", "face"],
    },
    trpcProcedure: "calculatorEngine.uweEstPrem",
    requiresAuth: false,
    requiresConfirmation: false,
  },

  // ═══ BIE TOOLS ═══════════════════════════════════════════════════
  {
    toolName: "bie_simulate",
    toolType: "calculator",
    description: "Run the Business Income Engine simulation. Models 13 income streams (personal production, team overrides Gen1/Gen2, AUM trail, affiliate tracks A-D, channel marketing, partner income, renewals, bonuses) with configurable roles, GDC brackets, seasonality, and growth rates. Returns year-by-year income breakdown with monthly detail.",
    inputSchema: {
      type: "object",
      properties: {
        strategy: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string", enum: ["new", "exp", "sa", "dir", "md", "rvp", "affA", "affB", "affC", "affD", "partner"] },
            streams: { type: "object", description: "Which streams to enable: { personal: true, override: true, ... }" },
            team: { type: "array", description: "Team members with { name, role, fyc }" },
            channelSpend: { type: "object", description: "Monthly spend per channel: { referral: 200, digital: 500 }" },
            seasonality: { type: "string", enum: ["flat", "q4Heavy", "summer", "eventDriven", "ramp", "custom"] },
          },
          required: ["role"],
        },
        years: { type: "number", default: 30 },
      },
      required: ["strategy"],
    },
    trpcProcedure: "calculatorEngine.bieSimulate",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "bie_back_plan",
    toolType: "calculator",
    description: "Reverse-engineer required GDC from a target income. Returns needed GDC, bracket rate, and full funnel metrics (approaches → set → held → apps → placed) at daily/weekly/monthly/annual frequencies.",
    inputSchema: {
      type: "object",
      properties: {
        targetIncome: { type: "number", description: "Desired annual income" },
        role: { type: "string", enum: ["new", "exp", "sa", "dir", "md", "rvp"], default: "new" },
      },
      required: ["targetIncome"],
    },
    trpcProcedure: "calculatorEngine.bieBackPlan",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "bie_roll_up",
    toolType: "calculator",
    description: "Aggregate multiple BIE strategies into a single roll-up view. Shows total GDC, income, overrides, AUM, channel revenue, and cost across all strategies, broken down by role and stream type.",
    inputSchema: {
      type: "object",
      properties: {
        strategies: { type: "array", description: "Array of BIE strategy configs" },
        year: { type: "number", default: 1 },
      },
      required: ["strategies"],
    },
    trpcProcedure: "calculatorEngine.bieRollUp",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "bie_economics",
    toolType: "calculator",
    description: "Calculate business economics for a BIE strategy: revenue, COGS, gross/net profit, margins, ROI, CAC, LTV, LTV:CAC ratio over a specified period.",
    inputSchema: {
      type: "object",
      properties: {
        strategy: { type: "object", description: "BIE strategy config" },
        years: { type: "number", default: 5 },
      },
      required: ["strategy"],
    },
    trpcProcedure: "calculatorEngine.bieEconomics",
    requiresAuth: true,
    requiresConfirmation: false,
  },

  // ═══ HE TOOLS ════════════════════════════════════════════════════
  {
    toolName: "he_simulate",
    toolType: "calculator",
    description: "Run the Holistic Engine simulation combining business income (BIE) and personal wealth (UWE) into a unified year-by-year projection. Shows how business income feeds savings, which feeds product growth, which compounds with tax savings reinvestment. Returns comprehensive snapshots with all income streams, product values, and holistic totals.",
    inputSchema: {
      type: "object",
      properties: {
        strategy: {
          type: "object",
          properties: {
            name: { type: "string" },
            hasBizIncome: { type: "boolean", default: false },
            bizStrategy: { type: "object", description: "BIE strategy (if hasBizIncome)" },
            profile: { type: "object", description: "Client profile { age, income, savings, ... }" },
            companyKey: { type: "string", default: "wealthbridge" },
            savingsRate: { type: "number", default: 0.15 },
            investmentReturn: { type: "number", default: 0.07 },
            taxRate: { type: "number", default: 0.25 },
          },
        },
        years: { type: "number", default: 30 },
      },
      required: ["strategy"],
    },
    trpcProcedure: "calculatorEngine.heSimulate",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "he_compare",
    toolType: "calculator",
    description: "Compare multiple holistic strategies side-by-side. Returns comparison rows with all metrics at the specified horizon year, plus winners for each metric (total value, net value, ROI, liquid wealth, protection, tax savings, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        strategies: { type: "array", description: "Array of holistic strategy configs" },
        horizon: { type: "number", default: 30 },
      },
      required: ["strategies"],
    },
    trpcProcedure: "calculatorEngine.heCompare",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "he_milestones",
    toolType: "calculator",
    description: "Compare holistic strategies at multiple milestone years (1, 5, 10, 15, 20, 25, 30, etc.). Shows how each strategy performs at key life milestones.",
    inputSchema: {
      type: "object",
      properties: {
        strategies: { type: "array" },
        milestoneYears: { type: "array", items: { type: "number" }, default: [1, 5, 10, 15, 20, 25, 30] },
      },
      required: ["strategies"],
    },
    trpcProcedure: "calculatorEngine.heMilestones",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "he_back_plan",
    toolType: "calculator",
    description: "Reverse-engineer: given a target total value and target year, find the required income level to achieve it. Uses binary search over the holistic simulation.",
    inputSchema: {
      type: "object",
      properties: {
        targetValue: { type: "number", description: "Target total value (e.g., 5000000)" },
        targetYear: { type: "number", description: "Year to achieve target (e.g., 20)" },
        baseStrategy: { type: "object", description: "Base holistic strategy to modify" },
      },
      required: ["targetValue", "targetYear", "baseStrategy"],
    },
    trpcProcedure: "calculatorEngine.heBackPlan",
    requiresAuth: true,
    requiresConfirmation: false,
  },

  // ═══ SCUI TOOLS ══════════════════════════════════════════════════
  {
    toolName: "historical_backtest",
    toolType: "calculator",
    description: "Run historical backtesting using actual S&P 500 returns from 1928-2025. Tests a portfolio across every possible starting year to determine survival rate, worst/best case, and median outcome.",
    inputSchema: {
      type: "object",
      properties: {
        startBalance: { type: "number", description: "Initial portfolio balance" },
        annualContribution: { type: "number", default: 0 },
        annualCost: { type: "number", default: 0 },
        horizon: { type: "number", default: 30, description: "Investment horizon in years" },
      },
      required: ["startBalance"],
    },
    trpcProcedure: "calculatorEngine.historicalBacktest",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "stress_test",
    toolType: "calculator",
    description: "Apply a specific market stress scenario (dot-com crash, 2008 financial crisis, or COVID crash) to a portfolio. Returns the path, max drawdown, and estimated recovery years.",
    inputSchema: {
      type: "object",
      properties: {
        scenarioKey: { type: "string", enum: ["dotcom", "gfc", "covid"] },
        startBalance: { type: "number" },
        annualContribution: { type: "number", default: 0 },
        annualCost: { type: "number", default: 0 },
      },
      required: ["scenarioKey", "startBalance"],
    },
    trpcProcedure: "calculatorEngine.stressTest",
    requiresAuth: true,
    requiresConfirmation: false,
  },
  {
    toolName: "check_guardrails",
    toolType: "calculator",
    description: "Validate financial assumptions against industry benchmarks. Checks return rates, savings rates, growth rates, inflation, and tax rates for reasonableness, returning warnings with severity levels and citations.",
    inputSchema: {
      type: "object",
      properties: {
        params: { type: "object", description: "Key-value pairs of parameters to check (e.g., { returnRate: 0.12, savingsRate: 0.30 })" },
      },
      required: ["params"],
    },
    trpcProcedure: "calculatorEngine.checkGuardrails",
    requiresAuth: false,
    requiresConfirmation: false,
  },
  {
    toolName: "get_product_references",
    toolType: "query",
    description: "Get cited product references and industry benchmarks for all financial product types. Each reference includes source citations, URLs, and current benchmark values.",
    inputSchema: { type: "object", properties: {} },
    trpcProcedure: "calculatorEngine.productReferences",
    requiresAuth: false,
    requiresConfirmation: false,
  },
  {
    toolName: "get_industry_benchmarks",
    toolType: "query",
    description: "Get industry benchmark data: national savings rate, investor behavior gap, life insurance gap, retirement readiness, estate planning gap, advisor alpha, advisory fees, and wealth growth rates. All with citations.",
    inputSchema: { type: "object", properties: {} },
    trpcProcedure: "calculatorEngine.industryBenchmarks",
    requiresAuth: false,
    requiresConfirmation: false,
  },
  {
    toolName: "get_methodology",
    toolType: "query",
    description: "Get methodology disclosures for all engines (UWE, BIE, HE, Monte Carlo, Premium Finance) plus the general disclaimer.",
    inputSchema: { type: "object", properties: {} },
    trpcProcedure: "calculatorEngine.methodology",
    requiresAuth: false,
    requiresConfirmation: false,
  },
];

/**
 * Seed all calculator engine tools into the AI tools registry.
 * Skips tools that already exist (idempotent).
 */
export async function seedCalculatorTools(): Promise<{ seeded: number; skipped: number; errors: string[] }> {
  let seeded = 0, skipped = 0;
  const errors: string[] = [];

  for (const def of CALCULATOR_TOOL_SEEDS) {
    try {
      const existing = await getToolByName(def.toolName);
      if (existing) {
        skipped++;
        continue;
      }
      await registerTool(def);
      seeded++;
    } catch (e: any) {
      errors.push(`${def.toolName}: ${e.message}`);
    }
  }

  return { seeded, skipped, errors };
}
