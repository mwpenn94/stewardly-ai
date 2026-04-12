/**
 * Wealth Engine tRPC router — exposes the Phase 1 UWE / BIE / HE /
 * Monte Carlo / benchmarks engines to the React UI and the ReAct agent.
 *
 * Naming note: the existing `calculators` key in the root appRouter
 * points to a separate, simpler calculator set (iulProjection /
 * premiumFinance / retirement) wired directly inside server/routers.ts.
 * This new router is registered as `wealthEngine` to avoid collision
 * while keeping the old callers untouched.
 *
 * Every mutation persists via `persistComputation` so the admin
 * improvement dashboard and the agent orchestrator can diff runs,
 * detect significant changes, and proactively alert.
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  // UWE
  uweSimulate,
  uweBuildStrategy,
  generateBestOverall,
  autoSelectProducts,
  COMPANIES,
  estPrem,
  // BIE
  bieCreateStrategy,
  bieSimulate,
  backPlan,
  rollUp,
  rollDown,
  calcEconomics,
  BIE_PRESETS,
  // HE
  createHolisticStrategy,
  heSimulate,
  addStrategy,
  clearStrategies,
  setHorizon,
  compareAt,
  findWinners,
  milestoneCompare,
  backPlanHolistic,
  HE_PRESETS,
  // Monte Carlo
  monteCarloSimulate,
  // Benchmarks
  GUARDRAILS,
  checkGuardrail,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
} from "../shared/calculators";
import {
  persistComputation,
  getLatestRun,
  diffRuns,
} from "../services/agent/calculatorPersistence";
import {
  generateWealthEngineReport,
  reportFilename,
} from "../services/wealthEngineReports/generator";
import {
  buildListenToPlanScript,
  chaptersFromSections,
  buildNarration,
} from "../services/wealthEngineReports/audioNarration";
import {
  createShareLink,
  resolveShareLink,
} from "../services/wealthEngineReports/shareableLinks";
import {
  extractIntent,
  dispatchToEngine,
} from "../services/wealthChat/chatEngineDispatcher";
import { runConsensus } from "../services/consensusStream";
import {
  listPresets as listWeightPresets,
  createPreset as createWeightPreset,
  updatePreset as updateWeightPreset,
  deletePreset as deleteWeightPreset,
  mergePresetWithSelection,
  BUILT_IN_PRESETS,
  type WeightPresetData,
} from "../services/weightPresets";

// ─── SHARED ZOD SCHEMAS ─────────────────────────────────────────────────────

const ClientProfileSchema = z
  .object({
    age: z.number().min(0).max(120).optional(),
    income: z.number().min(0).optional(),
    netWorth: z.number().optional(),
    savings: z.number().min(0).optional(),
    monthlySavings: z.number().min(0).optional(),
    dependents: z.number().min(0).max(20).optional(),
    mortgage: z.number().min(0).optional(),
    debts: z.number().min(0).optional(),
    marginalRate: z.number().min(0).max(1).optional(),
    equitiesReturn: z.number().min(-0.5).max(0.5).optional(),
    existingInsurance: z.number().min(0).optional(),
    isBizOwner: z.boolean().optional(),
  })
  .passthrough();

const ProductConfigSchema = z
  .object({
    type: z.enum([
      "term",
      "iul",
      "wl",
      "di",
      "ltc",
      "fia",
      "aum",
      "401k",
      "roth",
      "529",
      "estate",
      "premfin",
      "splitdollar",
      "deferredcomp",
    ]),
  })
  .passthrough();

const CompanyKeySchema = z.enum([
  "wealthbridge",
  "captivemutual",
  "wirehouse",
  "ria",
  "communitybd",
  "diy",
  "donothing",
]);

const BIEStrategyConfigSchema = z
  .object({
    role: z
      .enum([
        "new",
        "exp",
        "sa",
        "dir",
        "md",
        "rvp",
        "affA",
        "affB",
        "affC",
        "affD",
        "partner",
      ])
      .optional(),
    streams: z.record(z.string(), z.boolean()).optional(),
    team: z.array(z.any()).optional(),
    channelSpend: z.record(z.string(), z.number()).optional(),
    seasonality: z
      .enum(["flat", "q4Heavy", "summer", "eventDriven", "ramp", "custom"])
      .optional(),
    customSeason: z.array(z.number()).length(12).nullable().optional(),
    personalGDC: z.number().nullable().optional(),
  })
  .passthrough();

const HolisticConfigSchema = z
  .object({
    color: z.string().optional(),
    hasBizIncome: z.boolean().optional(),
    profile: ClientProfileSchema.optional(),
    companyKey: CompanyKeySchema.optional(),
    customProducts: z.array(ProductConfigSchema).nullable().optional(),
    savingsRate: z.number().min(0).max(1).optional(),
    investmentReturn: z.number().optional(),
    inflationRate: z.number().optional(),
    taxRate: z.number().min(0).max(1).optional(),
    reinvestTaxSavings: z.boolean().optional(),
    bizStrategy: z.any().optional(),
  })
  .passthrough();

/**
 * Small helper: wrap a synchronous engine call so every procedure gets
 * consistent duration tracking, persistence, and a uniform response
 * envelope. The envelope matches the spec's `EngineResult<T>` idea:
 * { data, durationMs, runId, cached }.
 */
async function runAndPersist<TInput, TResult>(
  tool: Parameters<typeof persistComputation>[0]["tool"],
  input: TInput,
  engine: () => TResult,
  meta: Parameters<typeof persistComputation>[0]["meta"],
  confidence?: number,
): Promise<{
  data: TResult;
  durationMs: number;
  runId: string | null;
}> {
  const t0 = Date.now();
  const result = engine();
  const durationMs = Date.now() - t0;
  const runId = await persistComputation({
    tool,
    input,
    result,
    durationMs,
    meta,
    confidence,
  });
  return { data: result, durationMs, runId };
}

// ═══════════════════════════════════════════════════════════════════════════
// WEALTH ENGINE ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const wealthEngineRouter = router({
  // ── UWE: simulate a strategy year by year ────────────────────────────────
  simulate: protectedProcedure
    .input(
      z.object({
        strategy: z.object({
          company: z.string(),
          companyName: z.string(),
          color: z.string(),
          profile: ClientProfileSchema,
          products: z.array(ProductConfigSchema),
          features: z.any(),
          notes: z.string(),
        }),
        maxYears: z.number().min(1).max(100).optional().default(30),
        sessionId: z.string().optional(),
        clientId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "uwe.simulate",
        input,
        () => uweSimulate(input.strategy as never, input.maxYears),
        {
          userId: ctx.user.id,
          clientId: input.clientId,
          sessionId: input.sessionId,
          trigger: "user_ui",
        },
        0.85,
      );
    }),

  // ── UWE: Monte Carlo percentile bands ────────────────────────────────────
  monteCarloSim: protectedProcedure
    .input(
      z.object({
        strategyConfig: z
          .object({
            investReturn: z.number().optional(),
            volatility: z.number().optional(),
          })
          .passthrough(),
        maxYears: z.number().min(1).max(100).optional().default(30),
        numTrials: z.number().min(10).max(5000).optional().default(1000),
        sessionId: z.string().optional(),
        clientId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "montecarlo.simulate",
        input,
        () =>
          monteCarloSimulate(input.strategyConfig, input.maxYears, input.numTrials),
        {
          userId: ctx.user.id,
          clientId: input.clientId,
          sessionId: input.sessionId,
          trigger: "user_ui",
        },
        0.7,
      );
    }),

  // ── UWE: build strategy + auto-select products ───────────────────────────
  buildStrategy: protectedProcedure
    .input(
      z.object({
        companyKey: CompanyKeySchema,
        profile: ClientProfileSchema,
        customProducts: z.array(ProductConfigSchema).nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "uwe.buildStrategy",
        input,
        () =>
          uweBuildStrategy(
            input.companyKey,
            input.profile,
            input.customProducts ?? undefined,
          ),
        { userId: ctx.user.id, trigger: "user_ui" },
        0.9,
      );
    }),

  autoSelectProducts: protectedProcedure
    .input(
      z.object({
        companyKey: CompanyKeySchema,
        profile: ClientProfileSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const company = COMPANIES[input.companyKey];
      return runAndPersist(
        "uwe.autoSelectProducts",
        input,
        () => autoSelectProducts(company, input.profile, input.companyKey),
        { userId: ctx.user.id, trigger: "user_ui" },
        0.9,
      );
    }),

  generateBestOverall: protectedProcedure
    .input(z.object({ profile: ClientProfileSchema }))
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "uwe.generateBestOverall",
        input,
        () => generateBestOverall(input.profile),
        { userId: ctx.user.id, trigger: "user_ui" },
        0.85,
      );
    }),

  // ── BIE: forward project income ──────────────────────────────────────────
  projectBizIncome: protectedProcedure
    .input(
      z.object({
        strategy: z.any(),
        years: z.number().min(1).max(50).optional().default(30),
        presetKey: z
          .enum([
            "newAssociate",
            "experiencedPro",
            "director",
            "md",
            "rvp",
            "affiliateBB" as never,
            "affiliateB",
            "strategicPartner",
          ])
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // If a preset key is supplied, resolve via BIE_PRESETS. Otherwise
      // trust the caller-supplied strategy object (must already be the
      // result of createStrategy).
      const strategy =
        input.presetKey && input.presetKey in BIE_PRESETS
          ? BIE_PRESETS[input.presetKey as keyof typeof BIE_PRESETS]()
          : input.strategy;
      return runAndPersist(
        "bie.simulate",
        input,
        () => bieSimulate(strategy, input.years),
        { userId: ctx.user.id, trigger: "user_ui" },
        0.8,
      );
    }),

  createBizStrategy: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        config: BIEStrategyConfigSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "bie.simulate",
        input,
        () => bieCreateStrategy(input.name, input.config as never),
        { userId: ctx.user.id, trigger: "user_ui" },
      );
    }),

  // ── BIE: back-plan required GDC for a target income ─────────────────────
  backPlanBizIncome: protectedProcedure
    .input(
      z.object({
        targetIncome: z.number().min(1),
        strategy: z.any(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "bie.backPlan",
        input,
        () => backPlan(input.targetIncome, input.strategy),
        { userId: ctx.user.id, trigger: "user_ui" },
      );
    }),

  rollUpTeam: protectedProcedure
    .input(z.object({ strategies: z.array(z.any()) }))
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "bie.rollUp",
        input,
        () => rollUp(input.strategies),
        { userId: ctx.user.id, trigger: "user_ui" },
      );
    }),

  rollDownOrg: protectedProcedure
    .input(
      z.object({
        orgTarget: z.number().min(1),
        teamComposition: z.array(
          z.object({
            role: z.enum([
              "new",
              "exp",
              "sa",
              "dir",
              "md",
              "rvp",
              "affA",
              "affB",
              "affC",
              "affD",
              "partner",
            ]),
            count: z.number().min(1),
          }),
        ),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "bie.rollDown",
        input,
        () => rollDown(input.orgTarget, input.teamComposition),
        { userId: ctx.user.id, trigger: "user_ui" },
      );
    }),

  calcBizEconomics: protectedProcedure
    .input(
      z.object({
        strategy: z.any(),
        years: z.number().min(1).max(50).optional().default(5),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return runAndPersist(
        "bie.calcEconomics",
        input,
        () => calcEconomics(input.strategy, input.years),
        { userId: ctx.user.id, trigger: "user_ui" },
      );
    }),

  // ── HE: holistic combined simulation ─────────────────────────────────────
  holisticSimulate: protectedProcedure
    .input(
      z.object({
        name: z.string().optional().default("Untitled"),
        config: HolisticConfigSchema,
        years: z.number().min(1).max(100).optional().default(30),
        clientId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const strategy = createHolisticStrategy(input.name, input.config as never);
      return runAndPersist(
        "he.simulate",
        input,
        () => heSimulate(strategy, input.years),
        {
          userId: ctx.user.id,
          clientId: input.clientId,
          trigger: "user_ui",
        },
        0.85,
      );
    }),

  // ── HE: registry-backed multi-strategy comparison ───────────────────────
  // These procedures reset the singleton registry per call so concurrent
  // users don't see each other's strategies. For the full agent loop we
  // also expose a server-side registry snapshot in the orchestrator.
  holisticCompare: protectedProcedure
    .input(
      z.object({
        strategies: z.array(
          z.object({
            name: z.string(),
            config: HolisticConfigSchema,
          }),
        ),
        horizon: z.number().min(1).max(100).optional().default(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      clearStrategies();
      setHorizon(input.horizon);
      input.strategies.forEach((s) =>
        addStrategy(createHolisticStrategy(s.name, s.config as never)),
      );
      const compareRows = compareAt(input.horizon);
      const winners = findWinners(input.horizon);
      const milestones = milestoneCompare();
      return runAndPersist(
        "he.compareAt",
        input,
        () => ({ compareRows, winners, milestones }),
        { userId: ctx.user.id, trigger: "user_ui" },
        0.85,
      );
    }),

  findWinners: protectedProcedure
    .input(
      z.object({
        horizon: z.number().min(1).max(100).optional().default(30),
      }),
    )
    .query(async ({ input }) => {
      // Registry must already be populated by a prior holisticCompare call
      // in the same session. No persistence on a read query.
      return { data: findWinners(input.horizon) };
    }),

  backPlanHolistic: protectedProcedure
    .input(
      z.object({
        targetValue: z.number().min(1),
        targetYear: z.number().min(1).max(100),
        baseStrategy: z.object({
          name: z.string(),
          config: HolisticConfigSchema,
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const base = createHolisticStrategy(
        input.baseStrategy.name,
        input.baseStrategy.config as never,
      );
      return runAndPersist(
        "he.backPlanHolistic",
        input,
        () => backPlanHolistic(input.targetValue, input.targetYear, base),
        { userId: ctx.user.id, trigger: "user_ui" },
      );
    }),

  // ── HE presets — convenience shortcut for common scenarios ──────────────
  runPreset: protectedProcedure
    .input(
      z.object({
        preset: z.enum([
          "wealthbridgeClient",
          "doNothing",
          "diy",
          "wirehouse",
          "ria",
          "captivemutual",
          "communitybd",
          "wbPremFinance",
        ]),
        profile: ClientProfileSchema,
        years: z.number().min(1).max(100).optional().default(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const fn = HE_PRESETS[input.preset];
      const strategy = fn(input.profile);
      return runAndPersist(
        "he.simulate",
        input,
        () => heSimulate(strategy, input.years),
        { userId: ctx.user.id, trigger: "user_ui" },
      );
    }),

  // ── Sensitivity sweep — 2D parameter heat map ──────────────────────────
  sensitivitySweep: protectedProcedure
    .input(
      z.object({
        xParam: z.enum(["savingsRate", "investmentReturn", "taxRate", "age", "income", "horizon"]),
        yParam: z.enum(["savingsRate", "investmentReturn", "taxRate", "age", "income", "horizon"]),
        xSteps: z.number().min(3).max(15).default(7),
        ySteps: z.number().min(3).max(15).default(7),
        xRange: z.tuple([z.number(), z.number()]),
        yRange: z.tuple([z.number(), z.number()]),
        metric: z.enum(["totalValue", "netValue", "roi", "savingsBalance", "productCashValue"]).default("totalValue"),
        baseProfile: ClientProfileSchema.optional(),
        companyKey: CompanyKeySchema.optional().default("wealthbridge"),
        horizon: z.number().min(1).max(60).optional().default(30),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const t0 = Date.now();
      const { xParam, yParam, xSteps, ySteps, xRange, yRange, metric, companyKey, horizon } = input;
      const baseProfile = input.baseProfile ?? { age: 40, income: 150000, savings: 50000, monthlySavings: 2000, marginalRate: 0.32 };

      // Generate step values for X and Y axes
      const xValues = Array.from({ length: xSteps }, (_, i) =>
        xRange[0] + (i * (xRange[1] - xRange[0])) / (xSteps - 1),
      );
      const yValues = Array.from({ length: ySteps }, (_, i) =>
        yRange[0] + (i * (yRange[1] - yRange[0])) / (ySteps - 1),
      );

      // Map param names to profile/strategy fields
      function applyParam(
        profile: Record<string, unknown>,
        strategyOverrides: Record<string, unknown>,
        param: string,
        value: number,
      ) {
        switch (param) {
          case "savingsRate": strategyOverrides.savingsRate = value; break;
          case "investmentReturn": strategyOverrides.investmentReturn = value; break;
          case "taxRate": profile.marginalRate = value; strategyOverrides.taxRate = value; break;
          case "age": profile.age = Math.round(value); break;
          case "income": profile.income = Math.round(value); break;
          case "horizon": strategyOverrides._horizon = Math.round(value); break;
        }
      }

      // Sweep grid
      const grid: number[][] = [];
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let yi = 0; yi < ySteps; yi++) {
        const row: number[] = [];
        for (let xi = 0; xi < xSteps; xi++) {
          const profile = { ...baseProfile };
          const overrides: Record<string, unknown> = {};
          applyParam(profile, overrides, xParam, xValues[xi]);
          applyParam(profile, overrides, yParam, yValues[yi]);

          const sweepHorizon = typeof overrides._horizon === "number" ? overrides._horizon : horizon;
          const strategy = createHolisticStrategy("sweep", {
            profile: profile as never,
            companyKey: companyKey as never,
            savingsRate: typeof overrides.savingsRate === "number" ? overrides.savingsRate : 0.15,
            investmentReturn: typeof overrides.investmentReturn === "number" ? overrides.investmentReturn : 0.07,
            taxRate: typeof overrides.taxRate === "number" ? overrides.taxRate : (profile.marginalRate as number) ?? 0.32,
            hasBizIncome: false,
          });
          const snapshots = heSimulate(strategy, sweepHorizon);
          const final = snapshots[snapshots.length - 1];
          const val = final ? (final as unknown as Record<string, unknown>)[metric] as number ?? 0 : 0;
          row.push(Math.round(val));
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
        grid.push(row);
      }

      return {
        grid,
        xValues,
        yValues,
        xParam,
        yParam,
        metric,
        minVal: Math.round(minVal),
        maxVal: Math.round(maxVal),
        durationMs: Date.now() - t0,
      };
    }),

  // ── Guardrails / benchmarks / methodology (read-only) ───────────────────
  getGuardrails: protectedProcedure.query(() => ({
    guardrails: GUARDRAILS,
    benchmarks: INDUSTRY_BENCHMARKS,
    methodology: METHODOLOGY_DISCLOSURE,
  })),

  checkGuardrail: protectedProcedure
    .input(z.object({ key: z.string(), value: z.number() }))
    .query(({ input }) => ({
      check: checkGuardrail(input.key, input.value),
    })),

  estimatePremium: protectedProcedure
    .input(
      z.object({
        type: z.enum(["term", "iul", "wl", "di", "ltc", "group"]),
        age: z.number().min(18).max(90),
        amount: z.number().min(0),
      }),
    )
    .query(({ input }) => ({
      premium: estPrem(input.type, input.age, input.amount),
    })),

  // ── Subscription helpers ────────────────────────────────────────────────
  // Returns the most recent run for a tool + user so the UI can detect
  // "plan updated by agent" events. The React side polls this every
  // few seconds when a subscription would be overkill.
  getLatestRun: protectedProcedure
    .input(
      z.object({
        tool: z.enum([
          "uwe.simulate",
          "uwe.monteCarloSimulate",
          "uwe.buildStrategy",
          "uwe.autoSelectProducts",
          "uwe.generateBestOverall",
          "bie.simulate",
          "bie.backPlan",
          "bie.rollUp",
          "bie.rollDown",
          "bie.calcEconomics",
          "he.simulate",
          "he.compareAt",
          "he.findWinners",
          "he.milestoneCompare",
          "he.backPlanHolistic",
          "montecarlo.simulate",
        ]),
      }),
    )
    .query(async ({ input, ctx }) => {
      const run = await getLatestRun(input.tool, ctx.user.id);
      return { run };
    }),

  // Diff the latest persisted run against a fresh run's output. Used by
  // the agent orchestrator to decide whether to push a notification.
  diffAgainstLatest: protectedProcedure
    .input(
      z.object({
        tool: z.enum([
          "uwe.simulate",
          "he.simulate",
          "he.compareAt",
          "bie.simulate",
          "montecarlo.simulate",
        ]),
        candidate: z.record(z.string(), z.any()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const latest = await getLatestRun(input.tool, ctx.user.id);
      const baseline = (latest?.outputData as Record<string, unknown>) ?? null;
      return { diff: diffRuns(baseline, input.candidate) };
    }),

  // ── Phase 5A — generate a PDF report ─────────────────────────────────
  // Returns the PDF as a base64-encoded string so the client can either
  // render it inline or trigger a download. Heavy operation — guard
  // with the protectedProcedure middleware so only authenticated users
  // can run it.
  generateReport: protectedProcedure
    .input(
      z.object({
        template: z.enum([
          "executive_summary",
          "complete_plan",
          "practice_growth",
          "prospect_preview",
        ]),
        clientName: z.string().min(1),
        advisorName: z.string().optional(),
        firmName: z.string().optional(),
        // Each template takes a different payload — accept the generic
        // bundle and let the templates module type-check at the function
        // boundary. Zod can't fully express the discriminated union, so
        // we trust the engine output shape.
        payload: z.object({
          kind: z.enum([
            "executive_summary",
            "complete_plan",
            "practice_growth",
            "prospect_preview",
          ]),
          input: z.any(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const buf = await generateWealthEngineReport({
        template: input.template,
        clientName: input.clientName,
        advisorName: input.advisorName,
        firmName: input.firmName,
        payload: input.payload as never,
      });
      return {
        filename: reportFilename(input.template, input.clientName),
        base64: buf.toString("base64"),
        sizeBytes: buf.length,
      };
    }),

  // ── Phase 5B — generate the "Listen to your plan" narration ─────────
  generateAudioNarration: protectedProcedure
    .input(
      z.object({
        clientName: z.string(),
        horizon: z.number().min(1).max(100),
        totalValue: z.number(),
        liquidWealth: z.number(),
        netValue: z.number(),
        topStrategy: z.string(),
        voiceId: z.string().optional().default("aria"),
      }),
    )
    .mutation(async ({ input }) => {
      const script = buildListenToPlanScript({
        clientName: input.clientName,
        horizon: input.horizon,
        totalValue: input.totalValue,
        liquidWealth: input.liquidWealth,
        netValue: input.netValue,
        topStrategy: input.topStrategy,
      });
      const chapters = chaptersFromSections(script);
      const narration = await buildNarration(chapters, input.voiceId);
      return {
        audioBase64: narration.audio.toString("base64"),
        chapters: narration.chapters,
        estimatedSeconds: narration.estimatedSeconds,
      };
    }),

  // ── Phase 5C — shareable plan links ──────────────────────────────────
  createShareLink: protectedProcedure
    .input(
      z.object({
        recordId: z.string().min(1),
        clientId: z.string().optional(),
        expiresInHours: z.number().min(1).max(720).optional(),
        password: z.string().optional(),
      }),
    )
    .mutation(({ input }) => createShareLink(input)),

  resolveShareLink: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().optional(),
      }),
    )
    .query(async ({ input }) => resolveShareLink(input.token, input.password)),

  // ── Round A3 — chat → engine natural language dispatch ──────────────
  // The chat UI calls this when a user types a message that might be
  // an engine intent. Returns the extracted intent + slots so the UI
  // can either run `chatDispatch` immediately or ask the user to
  // confirm before running the engine.
  chatExtractIntent: protectedProcedure
    .input(z.object({ text: z.string().min(1).max(2000) }))
    .query(({ input }) => extractIntent(input.text)),

  // ── Round C2 — multi-model consensus stream ─────────────────────────
  // Runs the full consensus stream synchronously and returns the entire
  // event log + final synthesis. The React UI replays the events to
  // render `StreamingResults` / `TimingBreakdown` / `ComparisonView`
  // exactly as if they had streamed live. A future Express SSE endpoint
  // can drive the same `streamConsensus` core for true incremental
  // delivery; this procedure is the convergent baseline.
  consensusStream: protectedProcedure
    .input(
      z.object({
        question: z.string().min(1).max(8000),
        selectedModels: z.array(z.string()).optional(),
        modelWeights: z.record(z.string(), z.number().min(1).max(100)).optional(),
        /** Optional preset id to apply (overrides modelWeights when set) */
        presetId: z.number().optional(),
        timeBudgetMs: z.number().min(2000).max(120_000).optional(),
        maxModels: z.number().min(1).max(8).optional(),
        domain: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Resolve preset → modelWeights (preset wins when both are set)
      let weights = input.modelWeights;
      if (input.presetId !== undefined) {
        const presets = await listWeightPresets(ctx.user.id);
        const preset = presets.find((p) => p.id === input.presetId) ?? null;
        if (preset) {
          weights = mergePresetWithSelection(
            preset,
            input.selectedModels ?? Object.keys(preset.weights),
          );
        }
      }
      return runConsensus({
        question: input.question,
        selectedModels: input.selectedModels,
        modelWeights: weights,
        timeBudgetMs: input.timeBudgetMs,
        maxModels: input.maxModels,
        domain: input.domain,
        userId: ctx.user.id,
      });
    }),

  // ── Round C4 — weight preset CRUD ───────────────────────────────────
  listWeightPresets: protectedProcedure.query(async ({ ctx }) => {
    const presets = await listWeightPresets(ctx.user.id);
    return { presets, builtInCount: BUILT_IN_PRESETS.length };
  }),

  createWeightPreset: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        weights: z.record(z.string(), z.number().min(1).max(100)),
        optimizedFor: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => createWeightPreset(ctx.user.id, input as WeightPresetData)),

  updateWeightPreset: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        patch: z.object({
          name: z.string().min(1).max(100).optional(),
          description: z.string().max(500).optional(),
          weights: z.record(z.string(), z.number().min(1).max(100)).optional(),
          optimizedFor: z.array(z.string()).optional(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) =>
      updateWeightPreset(ctx.user.id, input.id, input.patch),
    ),

  deleteWeightPreset: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => deleteWeightPreset(ctx.user.id, input.id)),

  // ── Round D2 — pre-flight cost estimate for a consensus run ────────
  // Combines the synthesizer/costEstimator pricing table with the
  // model registry latency estimates so the UI can show a single
  // "$X estimated · ~Ys" badge BEFORE running an expensive consensus.
  estimateConsensusCost: protectedProcedure
    .input(
      z.object({
        question: z.string().min(1).max(8000),
        selectedModels: z.array(z.string()).min(1),
        domain: z.string().optional(),
        expectedOutputTokens: z.number().min(1).max(50_000).optional(),
      }),
    )
    .query(async ({ input }) => {
      const { estimateCost, guessTaskType } = await import(
        "../services/synthesizer/costEstimator"
      );
      const { getModelEstimatedResponseMs, SYNTHESIS_OVERHEAD_MS } = await import(
        "../shared/config/modelRegistry"
      );

      // Pricing table — populated from the audit's reference numbers
      // (April 2026 published rates). When a model isn't listed we use
      // a conservative middle-of-pack estimate so the badge is never zero.
      const PRICING: Record<string, { input: number; output: number; medianOutputTokens: number }> = {
        "claude-sonnet-4-20250514": { input: 3, output: 15, medianOutputTokens: 800 },
        "claude-opus-4-20250514": { input: 15, output: 75, medianOutputTokens: 1200 },
        "gpt-4o": { input: 2.5, output: 10, medianOutputTokens: 800 },
        "gpt-4.1": { input: 2, output: 8, medianOutputTokens: 800 },
        "gemini-2.5-pro": { input: 1.25, output: 5, medianOutputTokens: 800 },
        "gemini-2.5-flash": { input: 0.075, output: 0.3, medianOutputTokens: 600 },
        "gemini-2.0-flash": { input: 0.075, output: 0.3, medianOutputTokens: 600 },
      };

      const promptTokens = Math.max(64, Math.ceil(input.question.length / 4));
      const taskType = guessTaskType(
        input.domain ? `${input.question} (${input.domain})` : input.question,
      );

      const models = input.selectedModels.map((id) => ({
        id,
        inputPer1M: PRICING[id]?.input ?? 5,
        outputPer1M: PRICING[id]?.output ?? 20,
        medianOutputTokens: PRICING[id]?.medianOutputTokens ?? 800,
      }));

      const cost = estimateCost({
        models,
        promptTokens,
        taskType,
        expectedOutputTokens: input.expectedOutputTokens,
      });

      // Latency estimate: max of per-model latencies (parallel) + synthesis
      const perModelMs = input.selectedModels.map((id) =>
        getModelEstimatedResponseMs(id),
      );
      const slowestMs = perModelMs.length > 0 ? Math.max(...perModelMs) : 0;
      const estimatedDurationMs = slowestMs + SYNTHESIS_OVERHEAD_MS;

      return {
        promptTokens,
        promptTokensAdjusted: cost.promptTokensAdjusted,
        taskType,
        taskMultiplier: cost.taskMultiplier,
        lines: cost.lines,
        totalUSD: cost.totalUSD,
        warnings: cost.warnings,
        estimatedDurationMs,
        synthesisOverheadMs: SYNTHESIS_OVERHEAD_MS,
      };
    }),

  // Single-shot extract + dispatch path. Returns the full
  // ChatEngineResponse the UI can render with inline charts +
  // per-message actions.
  chatDispatch: protectedProcedure
    .input(z.object({ text: z.string().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      const intent = extractIntent(input.text);
      const response = await dispatchToEngine(intent);
      // Persist the run via the mirror so it shows up in the user's
      // saved scenarios list. Fire-and-forget — UI gets the response
      // immediately.
      if (response.tool !== "none" && response.tool !== "bie.backPlan") {
        const { fireAndForgetMirror } = await import(
          "../services/agent/calculatorScenariosMirror"
        );
        fireAndForgetMirror({
          userId: ctx.user.id,
          tool: response.tool,
          scenarioName: `Chat: ${input.text.slice(0, 60)}`,
          input: { extractedSlots: intent.slots },
          result: response.data,
        });
      }
      return response;
    }),
});
