/**
 * calculatorEngine Router — tRPC procedures for all v7 engines
 *
 * Exposes UWE, BIE, HE, SCUI as typed RPC endpoints.
 * Each procedure validates input with Zod and returns typed results.
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { UWE } from "../engines/uwe";
import { BIE } from "../engines/bie";
import { HE } from "../engines/he";
import { SCUI } from "../engines/scui";
import type {
  CompanyKey, RoleKey, SeasonalityKey, FrequencyKey,
  ClientProfile, StrategyConfig, BIEStrategy,
  HolisticStrategyConfig,
} from "../engines/types";

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────

const clientProfileSchema = z.object({
  age: z.number().min(18).max(100).default(40),
  income: z.number().min(0).default(120000),
  netWorth: z.number().default(350000),
  savings: z.number().min(0).default(180000),
  dependents: z.number().min(0).default(2),
  mortgage: z.number().min(0).default(250000),
  debts: z.number().min(0).default(30000),
}).partial();

const companyKeySchema = z.enum([
  "wealthbridge", "captivemutual", "wirehouse", "ria", "communitybd", "diy", "donothing", "bestoverall",
]);

const roleKeySchema = z.enum([
  "new", "exp", "sa", "dir", "md", "rvp", "affA", "affB", "affC", "affD", "partner",
]);

const seasonalitySchema = z.enum(["flat", "q4Heavy", "summer", "eventDriven", "ramp", "custom"]);

const teamMemberSchema = z.object({
  name: z.string().default(""),
  role: roleKeySchema.default("new"),
  fyc: z.number().min(0).default(65000),
  f: z.number().optional(),
});

const campaignSchema = z.object({
  name: z.string().optional(),
  start: z.number().min(1).max(12).default(1),
  end: z.number().min(1).max(12).default(12),
  boost: z.number().min(0).max(2).default(0),
});

const affiliateASchema = z.object({ low: z.number(), med: z.number(), high: z.number() });
const affiliateBSchema = z.object({ referrals: z.number(), avgGDC: z.number(), commRate: z.number() });
const affiliateCSchema = z.object({ cases: z.number(), avgGDC: z.number(), splitRate: z.number() });
const affiliateDSchema = z.object({ subAgents: z.number(), avgGDC: z.number(), overrideRate: z.number() });

const bieStrategySchema = z.object({
  name: z.string().default("Untitled"),
  role: roleKeySchema.default("new"),
  streams: z.record(z.string(), z.boolean()).default({ personal: true }),
  team: z.array(teamMemberSchema).default([]),
  channelSpend: z.record(z.string(), z.number()).default({}),
  seasonality: seasonalitySchema.default("flat"),
  customSeason: z.array(z.number()).nullable().optional(),
  personalGrowth: z.number().optional(),
  teamGrowth: z.number().optional(),
  aumGrowth: z.number().optional(),
  channelGrowth: z.number().optional(),
  hiringRate: z.number().optional(),
  retentionRate: z.number().optional(),
  affA: affiliateASchema.optional(),
  affB: affiliateBSchema.optional(),
  affC: affiliateCSchema.optional(),
  affD: affiliateDSchema.optional(),
  partnerIncome: z.number().optional(),
  partnerGrowth: z.number().optional(),
  existingAUM: z.number().optional(),
  newAUMAnnual: z.number().optional(),
  aumFeeRate: z.number().optional(),
  personalGDC: z.number().nullable().optional(),
  wbPct: z.number().optional(),
  bracketOverride: z.number().nullable().optional(),
  overrideRate: z.number().optional(),
  overrideBonusRate: z.number().optional(),
  gen2Rate: z.number().optional(),
  renewalRate: z.number().optional(),
  renewalStartYear: z.number().optional(),
  bonusPct: z.number().optional(),
  campaigns: z.array(campaignSchema).default([]),
  notes: z.string().default(""),
});

const holisticStrategySchema = z.object({
  name: z.string().default("Untitled"),
  color: z.string().default("#16A34A"),
  bizStrategy: bieStrategySchema.nullable().optional(),
  hasBizIncome: z.boolean().default(false),
  profile: clientProfileSchema.default({}),
  wealthStrategy: z.any().nullable().optional(),
  companyKey: companyKeySchema.default("wealthbridge"),
  customProducts: z.any().nullable().optional(),
  savingsRate: z.number().default(0.15),
  investmentReturn: z.number().default(0.07),
  inflationRate: z.number().default(0.03),
  taxRate: z.number().default(0.25),
  reinvestTaxSavings: z.boolean().default(true),
  notes: z.string().default(""),
});

// ─── ROUTER ──────────────────────────────────────────────────────

export const calculatorEngineRouter = router({
  // ═══ UWE ENDPOINTS ═══════════════════════════════════════════════

  /** Get all company profiles */
  uweCompanies: publicProcedure.query(() => {
    return UWE.getCompanyKeys().map((key) => ({
      key,
      ...UWE.getCompany(key),
    }));
  }),

  /** Get product types for a company */
  uweProducts: publicProcedure
    .input(z.object({ companyKey: companyKeySchema }))
    .query(({ input }) => {
      return UWE.getCompany(input.companyKey as CompanyKey);
    }),

  /** Build auto-selected strategy for a profile */
  uweBuildStrategy: protectedProcedure
    .input(z.object({
      companyKey: companyKeySchema,
      profile: clientProfileSchema,
      customProducts: z.any().nullable().optional(),
    }))
    .mutation(({ input }) => {
      return UWE.buildStrategy(
        input.companyKey as CompanyKey,
        input.profile as ClientProfile,
        input.customProducts,
      );
    }),

  /** Run UWE simulation */
  uweSimulate: protectedProcedure
    .input(z.object({
      strategy: z.any(), // StrategyConfig
      years: z.number().min(1).max(200).default(30),
    }))
    .mutation(({ input }) => {
      return UWE.simulate(input.strategy as StrategyConfig, input.years);
    }),

  /** Run Monte Carlo simulation */
  uweMonteCarlo: protectedProcedure
    .input(z.object({
      strategy: z.any(),
      years: z.number().min(1).max(100).default(30),
      trials: z.number().min(100).max(10000).default(1000),
      volatility: z.number().min(0).max(0.5).default(0.15),
    }))
    .mutation(({ input }) => {
      return UWE.monteCarlo(input.strategy as StrategyConfig, input.years, input.trials, input.volatility);
    }),

  /** Estimate premium for a product */
  uweEstPrem: publicProcedure
    .input(z.object({
      type: z.string(),
      age: z.number().min(18).max(100),
      face: z.number().min(0),
    }))
    .query(({ input }) => {
      return { premium: UWE.estPrem(input.type as any, input.age, input.face) };
    }),

  // ═══ BIE ENDPOINTS ═══════════════════════════════════════════════

  /** Get all roles */
  bieRoles: publicProcedure.query(() => {
    return Object.entries(BIE.ROLES).map(([key, role]) => ({ key, ...role }));
  }),

  /** Get all channels */
  bieChannels: publicProcedure.query(() => {
    return Object.entries(BIE.CHANNELS).map(([key, ch]) => ({ key, ...ch }));
  }),

  /** Get GDC brackets */
  bieBrackets: publicProcedure.query(() => BIE.GDC_BRACKETS),

  /** Run BIE simulation */
  bieSimulate: protectedProcedure
    .input(z.object({
      strategy: bieStrategySchema,
      years: z.number().min(1).max(200).default(30),
    }))
    .mutation(({ input }) => {
      const strategy = BIE.createStrategy(input.strategy.name, input.strategy as any);
      return BIE.simulate(strategy, input.years);
    }),

  /** Back-plan: target income → required GDC */
  bieBackPlan: protectedProcedure
    .input(z.object({
      targetIncome: z.number().min(1),
      role: roleKeySchema.default("new"),
    }))
    .mutation(({ input }) => {
      return BIE.backPlan(input.targetIncome, input.role as RoleKey);
    }),

  /** Roll-up multiple strategies */
  bieRollUp: protectedProcedure
    .input(z.object({
      strategies: z.array(bieStrategySchema),
      year: z.number().min(1).max(200).default(1),
    }))
    .mutation(({ input }) => {
      const strats = input.strategies.map((s) => BIE.createStrategy(s.name, s as any));
      return BIE.rollUp(strats, input.year);
    }),

  /** Roll-down a single strategy */
  bieRollDown: protectedProcedure
    .input(z.object({
      strategy: bieStrategySchema,
      year: z.number().min(1).max(200).default(1),
    }))
    .mutation(({ input }) => {
      const strat = BIE.createStrategy(input.strategy.name, input.strategy as any);
      return BIE.rollDown(strat, input.year);
    }),

  /** Calculate economics */
  bieEconomics: protectedProcedure
    .input(z.object({
      strategy: bieStrategySchema,
      years: z.number().min(1).max(50).default(5),
    }))
    .mutation(({ input }) => {
      const strat = BIE.createStrategy(input.strategy.name, input.strategy as any);
      return BIE.calcEconomics(strat, input.years);
    }),

  /** Get BIE presets */
  biePresets: publicProcedure.query(() => {
    return Object.entries(BIE.PRESETS).map(([key, fn]) => ({
      key,
      strategy: fn(),
    }));
  }),

  /** Convert income to frequency */
  bieToFrequency: publicProcedure
    .input(z.object({
      annual: z.number(),
      frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"]),
    }))
    .query(({ input }) => {
      return { amount: BIE.toFrequency(input.annual, input.frequency as FrequencyKey) };
    }),

  // ═══ HE ENDPOINTS ════════════════════════════════════════════════

  /** Run holistic simulation */
  heSimulate: protectedProcedure
    .input(z.object({
      strategy: holisticStrategySchema,
      years: z.number().min(1).max(200).default(30),
    }))
    .mutation(({ input }) => {
      const hs = HE.createHolisticStrategy(input.strategy.name, input.strategy as any);
      return HE.simulate(hs, input.years);
    }),

  /** Compare multiple holistic strategies */
  heCompare: protectedProcedure
    .input(z.object({
      strategies: z.array(holisticStrategySchema),
      horizon: z.number().min(1).max(200).default(30),
    }))
    .mutation(({ input }) => {
      const strats = input.strategies.map((s) => HE.createHolisticStrategy(s.name, s as any));
      return HE.compareStrategies(strats, input.horizon);
    }),

  /** Milestone comparison */
  heMilestones: protectedProcedure
    .input(z.object({
      strategies: z.array(holisticStrategySchema),
      milestoneYears: z.array(z.number()).default([1, 5, 10, 15, 20, 25, 30]),
    }))
    .mutation(({ input }) => {
      const strats = input.strategies.map((s) => HE.createHolisticStrategy(s.name, s as any));
      return HE.milestoneCompare(strats, input.milestoneYears);
    }),

  /** Get chart series data */
  heChartSeries: protectedProcedure
    .input(z.object({
      strategies: z.array(holisticStrategySchema),
      metric: z.string(),
      maxYear: z.number().min(1).max(200).default(30),
    }))
    .mutation(({ input }) => {
      const strats = input.strategies.map((s) => HE.createHolisticStrategy(s.name, s as any));
      return HE.getChartSeries(strats, input.metric as any, input.maxYear);
    }),

  /** Back-plan holistic: target value → required income */
  heBackPlan: protectedProcedure
    .input(z.object({
      targetValue: z.number().min(1),
      targetYear: z.number().min(1).max(200),
      baseStrategy: holisticStrategySchema,
    }))
    .mutation(({ input }) => {
      const hs = HE.createHolisticStrategy(input.baseStrategy.name, input.baseStrategy as any);
      return HE.backPlanHolistic(input.targetValue, input.targetYear, hs);
    }),

  /** Get HE presets */
  hePresets: publicProcedure
    .input(z.object({ profile: clientProfileSchema.optional() }).optional())
    .query(({ input }) => {
      return Object.entries(HE.PRESETS).map(([key, fn]) => ({
        key,
        strategy: fn(input?.profile as any),
      }));
    }),

  // ═══ SCUI ENDPOINTS ══════════════════════════════════════════════

  /** Historical backtest */
  historicalBacktest: protectedProcedure
    .input(z.object({
      startBalance: z.number().min(0),
      annualContribution: z.number().min(0).default(0),
      annualCost: z.number().min(0).default(0),
      horizon: z.number().min(1).max(50).default(30),
    }))
    .mutation(({ input }) => {
      return SCUI.historicalBacktest(input.startBalance, input.annualContribution, input.annualCost, input.horizon);
    }),

  /** Stress test */
  stressTest: protectedProcedure
    .input(z.object({
      scenarioKey: z.string(),
      startBalance: z.number().min(0),
      annualContribution: z.number().min(0).default(0),
      annualCost: z.number().min(0).default(0),
    }))
    .mutation(({ input }) => {
      return SCUI.stressTest(input.scenarioKey, input.startBalance, input.annualContribution, input.annualCost);
    }),

  /** Get stress scenarios */
  stressScenarios: publicProcedure.query(() => {
    return Object.entries(SCUI.STRESS_SCENARIOS).map(([key, s]) => ({ key, ...s }));
  }),

  /** Get product references */
  productReferences: publicProcedure.query(() => {
    return Object.entries(SCUI.PRODUCT_REFERENCES).map(([key, ref]) => ({ key, ...ref }));
  }),

  /** Get industry benchmarks */
  industryBenchmarks: publicProcedure.query(() => SCUI.INDUSTRY_BENCHMARKS),

  /** Get methodology disclosures */
  methodology: publicProcedure.query(() => SCUI.METHODOLOGY_DISCLOSURE),

  /** Check guardrails */
  checkGuardrails: publicProcedure
    .input(z.object({ params: z.record(z.string(), z.number()) }))
    .query(({ input }) => {
      return SCUI.checkGuardrails(input.params as Record<string, number>);
    }),

  /** Get S&P 500 history */
  sp500History: publicProcedure.query(() => {
    return Object.entries(SCUI.SP500_HISTORY).map(([year, ret]) => ({ year: Number(year), return: ret as number }));
  }),
});
