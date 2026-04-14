/**
 * Chat → engine natural-language dispatcher — Round A3.
 *
 * Lets users type "run a WealthBridge Pro simulation for a 40-year-old
 * earning $300K" and have the chat extract structured parameters,
 * invoke the right engine tool, and return a `ChatEngineResponse` the
 * UI can render with inline charts + per-message actions.
 *
 * Two layers:
 *  1. `extractIntent(text)` — pure regex/keyword pass that detects
 *     intent + slots (age, income, role, horizon, preset). Fast and
 *     unit-testable; no LLM call needed for the common phrases.
 *  2. `dispatchToEngine(intent)` — runs the right Phase 1 engine
 *     function and returns a fully-formed `ChatEngineResponse`.
 *
 * The chat router (existing chatRouter in server/routers.ts) wraps
 * `dispatchToEngine` so the response can be persisted as a normal
 * assistant message with a `metadata.engineResult` blob the React UI
 * picks up to render inline charts.
 */

import {
  HE_PRESETS,
  heSimulate,
  bieSimulate,
  bieCreateStrategy,
  monteCarloSimulate,
  rollUp as bieRollUp,
  PRODUCT_REFERENCES,
  INDUSTRY_BENCHMARKS,
  type ClientProfile,
  type HolisticStrategy,
} from "../../shared/calculators";
import { safetyWrap } from "./safety";

// ─── Intent shape ──────────────────────────────────────────────────────────

export type EngineIntent =
  | "holistic_simulate"
  | "compare_strategies"
  | "biz_project"
  | "monte_carlo"
  | "back_plan"
  | "stress_test"
  | "historical_backtest"
  | "sensitivity_sweep"
  | "guardrail_check"
  | "roll_up_team"
  | "build_strategy"
  | "none";

export interface ExtractedSlots {
  age?: number;
  income?: number;
  netWorth?: number;
  savings?: number;
  dependents?: number;
  horizon?: number;
  preset?: keyof typeof HE_PRESETS;
  role?: "new" | "exp" | "sa" | "dir" | "md" | "rvp";
  targetIncome?: number;
}

export interface ExtractionResult {
  intent: EngineIntent;
  slots: ExtractedSlots;
  raw: string;
}

// ─── Pure extractor ───────────────────────────────────────────────────────

const PRESET_PHRASES: Array<[RegExp, keyof typeof HE_PRESETS]> = [
  [/wealth ?bridge ?pro\b/i, "wealthbridgePro"],
  [/wealthbridge plan|wealth ?bridge\b/i, "wealthbridgeClient"],
  [/do nothing/i, "doNothing"],
  [/\bdiy\b|robo[- ]?advisor/i, "diy"],
  [/wirehouse/i, "wirehouse"],
  [/captive ?mutual|northwestern mutual|new york life/i, "captivemutual"],
  [/community broker[- ]?dealer|edward jones/i, "communitybd"],
  [/independent ria|fee[- ]?only ria|\bria\b/i, "ria"],
  [/premium finance/i, "wbPremFinance"],
];

const ROLE_PHRASES: Array<[RegExp, ExtractedSlots["role"]]> = [
  [/new (associate|assoc)/i, "new"],
  [/experienced (pro|professional)/i, "exp"],
  [/senior (associate|assoc)/i, "sa"],
  [/managing director|md\b/i, "md"],
  [/regional (vp|vice president)|rvp/i, "rvp"],
  [/director/i, "dir"],
];

function parseDollar(text: string, anchor: RegExp): number | undefined {
  const match = text.match(anchor);
  if (!match) return undefined;
  const raw = match[1] ?? "";
  const numeric = Number(raw.replace(/[, $]/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) return undefined;
  // Honor the K/M suffix
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") return numeric * 1000;
  if (suffix === "m") return numeric * 1_000_000;
  return numeric;
}

const AGE_RX = /\b(\d{1,2})[- ]?year[- ]?old\b/i;
const AGE_AT_RX = /\bage\s+(\d{1,2})\b/i;
const INCOME_RX =
  /\b(?:earning|income|salary|makes?)\s+\$?([\d,]+(?:\.\d+)?)\s*([kmKM])?/i;
const SAVINGS_RX =
  /\b(?:saving|savings|saved|nest egg)\s*(?:of)?\s*\$?([\d,]+(?:\.\d+)?)\s*([kmKM])?/i;
const NET_WORTH_RX =
  /\bnet ?worth\s*(?:of)?\s*\$?([\d,]+(?:\.\d+)?)\s*([kmKM])?/i;
const DEPENDENTS_RX = /\b(\d+)\s*(?:dependents?|kids?|children)/i;
const HORIZON_RX = /\b(?:over|for|in)\s+(\d{1,3})[- ]?(?:years?|yrs?)/i;
const TARGET_RX =
  /\bto (?:earn|make|hit)\s+\$?([\d,]+(?:\.\d+)?)\s*([kmKM])?/i;

export function extractIntent(text: string): ExtractionResult {
  const slots: ExtractedSlots = {};

  // Age
  const ageMatch = text.match(AGE_RX) || text.match(AGE_AT_RX);
  if (ageMatch) {
    const n = Number(ageMatch[1]);
    if (n >= 18 && n <= 100) slots.age = n;
  }

  // Income / savings / net worth — parse with shared helper
  const inc = parseDollar(text, INCOME_RX);
  if (inc) slots.income = inc;
  const sav = parseDollar(text, SAVINGS_RX);
  if (sav) slots.savings = sav;
  const nw = parseDollar(text, NET_WORTH_RX);
  if (nw) slots.netWorth = nw;
  const target = parseDollar(text, TARGET_RX);
  if (target) slots.targetIncome = target;

  // Dependents
  const depMatch = text.match(DEPENDENTS_RX);
  if (depMatch) {
    const n = Number(depMatch[1]);
    if (Number.isFinite(n)) slots.dependents = n;
  }

  // Horizon
  const horMatch = text.match(HORIZON_RX);
  if (horMatch) {
    const n = Number(horMatch[1]);
    if (n >= 1 && n <= 100) slots.horizon = n;
  }

  // Preset
  for (const [pattern, key] of PRESET_PHRASES) {
    if (pattern.test(text)) {
      slots.preset = key;
      break;
    }
  }

  // Role
  for (const [pattern, role] of ROLE_PHRASES) {
    if (pattern.test(text)) {
      slots.role = role;
      break;
    }
  }

  // Intent classification — preference order
  const lower = text.toLowerCase();
  let intent: EngineIntent = "none";
  // holistic_simulate fires when:
  //  - the user explicitly asks to simulate / project / run a plan
  //  - they mentioned a wealth-engine preset by name
  //  - they used the verb "simulate" with a profile slot (age/income)
  if (
    /\brun (a|the) .*(simulation|projection|plan)\b/.test(lower) ||
    /(simulate|project|run)\b.*\bplan\b/.test(lower) ||
    slots.preset ||
    (/\bsimulate\b/.test(lower) && (slots.age !== undefined || slots.income !== undefined))
  ) {
    intent = "holistic_simulate";
  }
  if (/\bcompare\b|\bvs\b|\bversus\b/.test(lower)) {
    intent = "compare_strategies";
  }
  if (slots.role || /practice income|business income|gdc|production/i.test(lower)) {
    intent = "biz_project";
  }
  if (/monte ?carlo|confidence|percentile|success rate|worst case/i.test(lower)) {
    intent = "monte_carlo";
  }
  if (/back ?plan|need to (?:do|earn|make)|what does it take to/i.test(lower) || slots.targetIncome) {
    intent = "back_plan";
  }
  if (/stress ?test|crash|recession|crisis|bear ?market|downturn|what (?:if|happens).*(crash|recession|market drops)/i.test(lower)) {
    intent = "stress_test";
  }
  if (/backtest|historical.*(?:success|survival|odds)|run.*out.*money|survive.*(?:history|market)|safe.*withdrawal/i.test(lower)) {
    intent = "historical_backtest";
  }
  if (/sensitivity|what.if.*(?:change|vary|adjust)|sweep|heat.?map/i.test(lower)) {
    intent = "sensitivity_sweep";
  }
  if (/guardrail|realistic|reasonable|too (?:high|aggressive|optimistic)|assumption/i.test(lower)) {
    intent = "guardrail_check";
  }
  if (/roll.?up|team (?:income|revenue|production)|aggregate.*team|organization.*income/i.test(lower)) {
    intent = "roll_up_team";
  }
  if (/build.*(?:strategy|plan|portfolio)|recommend.*products|what.*(?:products|insurance).*(?:need|should)/i.test(lower)) {
    intent = "build_strategy";
  }

  return { intent, slots, raw: text };
}

// ─── Engine response shape ────────────────────────────────────────────────

export interface ChatChartHint {
  component:
    | "ProjectionChart"
    | "GuardrailsGauge"
    | "StrategyCard"
    | "MonteCarloBands"
    | "FunnelTable"
    | "ComparisonGrid";
  caption: string;
  props: Record<string, unknown>;
}

export interface ChatEngineResponse {
  intent: EngineIntent;
  narrative: string;
  data: Record<string, unknown>;
  charts: ChatChartHint[];
  /** Tool that was actually invoked (for analytics) */
  tool: string;
  /** Per-message actions the UI should expose */
  actions: {
    copy: boolean;
    tts: boolean;
    download: boolean;
    share: boolean;
  };
}

const DEFAULT_PROFILE: ClientProfile = {
  age: 40,
  income: 120_000,
  netWorth: 350_000,
  savings: 180_000,
  dependents: 2,
  mortgage: 250_000,
  debts: 30_000,
  marginalRate: 0.25,
};

function buildProfile(slots: ExtractedSlots): ClientProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(slots.age !== undefined ? { age: slots.age } : {}),
    ...(slots.income !== undefined ? { income: slots.income } : {}),
    ...(slots.netWorth !== undefined ? { netWorth: slots.netWorth } : {}),
    ...(slots.savings !== undefined ? { savings: slots.savings } : {}),
    ...(slots.dependents !== undefined ? { dependents: slots.dependents } : {}),
  };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────

export async function dispatchToEngine(
  result: ExtractionResult,
): Promise<ChatEngineResponse> {
  const slots = result.slots;
  const horizon = slots.horizon ?? 30;

  // Holistic simulation — single preset run with inline projection chart
  if (result.intent === "holistic_simulate") {
    const presetKey: keyof typeof HE_PRESETS =
      slots.preset ?? "wealthbridgeClient";
    const profile = buildProfile(slots);
    const presetFn = HE_PRESETS[presetKey] as
      | ((p: ClientProfile) => HolisticStrategy)
      | undefined;
    const strategy =
      presetFn?.(profile) ?? HE_PRESETS.wealthbridgeClient(profile);
    const snapshots = heSimulate(strategy, horizon);
    const final = snapshots[snapshots.length - 1];

    return {
      intent: result.intent,
      tool: "he.simulate",
      narrative: safetyWrap(
        `Ran the ${strategy.name} preset for a ${profile.age}-year-old earning $${profile.income?.toLocaleString()}. At year ${horizon}, the projection shows total value $${final.totalValue.toLocaleString()} (liquid wealth $${final.totalLiquidWealth.toLocaleString()}, total protection $${final.totalProtection.toLocaleString()}).`,
      ),
      data: {
        preset: presetKey,
        profile,
        finalSnapshot: final,
        snapshotCount: snapshots.length,
      },
      charts: [
        {
          component: "ProjectionChart",
          caption: `${strategy.name} — ${horizon}-year liquid wealth`,
          props: {
            series: [
              {
                key: "liquid",
                label: "Liquid Wealth",
                color: strategy.color,
                values: snapshots.map((s) => s.totalLiquidWealth),
                animateOnMount: true,
              },
            ],
            width: 600,
            height: 280,
          },
        },
      ],
      actions: { copy: true, tts: true, download: true, share: true },
    };
  }

  // Strategy comparison — WB vs Do Nothing as the default peer pair
  if (result.intent === "compare_strategies") {
    const profile = buildProfile(slots);
    const wb = HE_PRESETS.wealthbridgeClient(profile);
    const peer = HE_PRESETS.doNothing(profile);
    const wbRun = heSimulate(wb, horizon);
    const peerRun = heSimulate(peer, horizon);
    const wbFinal = wbRun[wbRun.length - 1];
    const peerFinal = peerRun[peerRun.length - 1];
    const delta = wbFinal.totalValue - peerFinal.totalValue;

    return {
      intent: result.intent,
      tool: "he.compareAt",
      narrative: safetyWrap(
        `Compared the WealthBridge Plan against Do Nothing at year ${horizon}. WealthBridge projects total value $${wbFinal.totalValue.toLocaleString()} vs Do Nothing's $${peerFinal.totalValue.toLocaleString()} (delta ${delta >= 0 ? "+" : ""}$${delta.toLocaleString()}).`,
      ),
      data: {
        wb: { name: wb.name, final: wbFinal },
        peer: { name: peer.name, final: peerFinal },
        delta,
      },
      charts: [
        {
          component: "ComparisonGrid",
          caption: "Strategy comparison at horizon",
          props: {
            rows: [
              {
                name: wb.name,
                color: wb.color,
                totalValue: wbFinal.totalValue,
                totalLiquidWealth: wbFinal.totalLiquidWealth,
              },
              {
                name: peer.name,
                color: peer.color,
                totalValue: peerFinal.totalValue,
                totalLiquidWealth: peerFinal.totalLiquidWealth,
              },
            ],
          },
        },
      ],
      actions: { copy: true, tts: true, download: true, share: true },
    };
  }

  // Biz income forward projection
  if (result.intent === "biz_project") {
    const role = slots.role ?? "exp";
    const strategy = bieCreateStrategy("Chat projection", {
      role,
      streams: { personal: true, expanded: true },
    });
    const years = horizon;
    const yrs = bieSimulate(strategy, years);
    const final = yrs[yrs.length - 1];

    return {
      intent: result.intent,
      tool: "bie.simulate",
      narrative: safetyWrap(
        `Projected practice income for a ${role} role over ${years} years. Final-year income: $${(final?.totalIncome ?? 0).toLocaleString()}; cumulative: $${(final?.cumulativeIncome ?? 0).toLocaleString()}.`,
      ),
      data: { role, finalYear: final, snapshotCount: yrs.length },
      charts: [
        {
          component: "ProjectionChart",
          caption: `BIE projection — ${role} role`,
          props: {
            series: [
              {
                key: "income",
                label: "Annual income",
                values: yrs.map((y) => y.totalIncome),
                isPracticeIncome: true,
              },
            ],
          },
        },
      ],
      actions: { copy: true, tts: true, download: true, share: false },
    };
  }

  // Monte Carlo confidence bands
  if (result.intent === "monte_carlo") {
    const bands = monteCarloSimulate(
      { investReturn: 0.07, volatility: 0.15 },
      horizon,
      500,
    );
    const finalBand = bands[bands.length - 1];
    return {
      intent: result.intent,
      tool: "montecarlo.simulate",
      narrative: safetyWrap(
        `Ran a 500-trial Monte Carlo over ${horizon} years. Year-${horizon} bands: p10 $${(finalBand.p10 || 0).toLocaleString()}, p50 $${(finalBand.p50 || 0).toLocaleString()}, p90 $${(finalBand.p90 || 0).toLocaleString()}.`,
      ),
      data: { bands, finalBand },
      charts: [
        {
          component: "MonteCarloBands",
          caption: `Monte Carlo bands — ${horizon} years`,
          props: {
            bands,
          },
        },
      ],
      actions: { copy: true, tts: true, download: true, share: false },
    };
  }

  // Back-plan
  if (result.intent === "back_plan") {
    const target = slots.targetIncome ?? 200_000;
    const role = slots.role ?? "exp";
    const strategy = bieCreateStrategy("Back-plan target", {
      role,
      streams: { personal: true },
    });
    const { backPlan } = await import("../../shared/calculators");
    const plan = backPlan(target, strategy);
    return {
      intent: result.intent,
      tool: "bie.backPlan",
      narrative: safetyWrap(
        `To earn $${target.toLocaleString()} as a ${role}, the back-plan needs $${plan.neededGDC.toLocaleString()} GDC at the ${plan.bracketLabel} bracket. That's ${plan.funnel.daily.approaches} approaches/day.`,
      ),
      data: { plan, role, target },
      charts: [
        {
          component: "FunnelTable",
          caption: "Sales funnel back-plan",
          props: { funnel: plan.funnel },
        },
      ],
      actions: { copy: true, tts: true, download: false, share: false },
    };
  }

  // Stress test — run through a crisis scenario
  if (result.intent === "stress_test") {
    const { stressTest: runStressTest, STRESS_SCENARIOS } = await import("../../shared/calculators/scui");
    const balance = slots.savings ?? slots.netWorth ?? 500_000;
    // Pick the most relevant scenario from the message, default to GFC
    const lower = result.raw.toLowerCase();
    let scenario = "gfc";
    if (/dot.?com|tech|2000/.test(lower)) scenario = "dotcom";
    else if (/covid|pandemic|2020/.test(lower)) scenario = "covid";
    else if (/stagflation|1973|1974|oil/.test(lower)) scenario = "stagflation";
    else if (/rising.rate|2022|fed|interest/.test(lower)) scenario = "rising_rates";
    const stressResult = runStressTest(scenario, balance);
    if (stressResult) {
      const sc = stressResult.scenario;
      return {
        intent: result.intent,
        tool: "scui.stressTest",
        narrative: safetyWrap(
          `Stress tested $${balance.toLocaleString()} through the ${sc.name}. Max drawdown: ${(stressResult.maxDrawdown * 100).toFixed(1)}%. Final balance: $${stressResult.finalBalance.toLocaleString()}. Recovery: ~${stressResult.recoveryYears} years at 7% avg.`,
        ),
        data: { scenario, stressResult },
        charts: [],
        actions: { copy: true, tts: true, download: false, share: false },
      };
    }
  }

  // Historical backtest — rolling S&P 500 survival rate
  if (result.intent === "historical_backtest") {
    const { historicalBacktest: runBacktest } = await import("../../shared/calculators/scui");
    const balance = slots.savings ?? slots.netWorth ?? 500_000;
    const contribution = slots.income ? Math.round(slots.income * 0.15) : 0;
    const bt = runBacktest(balance, contribution, 0, horizon);
    return {
      intent: result.intent,
      tool: "scui.historicalBacktest",
      narrative: safetyWrap(
        `Backtested a $${balance.toLocaleString()} portfolio over ${horizon} years across ${bt.total} starting years (1928-2025). Survival rate: ${(bt.survivalRate * 100).toFixed(1)}% (${bt.survived}/${bt.total}). Median final: $${bt.medianFinal.toLocaleString()}. Best start: ${bt.best.year} ($${bt.best.final.toLocaleString()}). Worst start: ${bt.worst.year} ($${bt.worst.final.toLocaleString()}).`,
      ),
      data: { backtest: { survivalRate: bt.survivalRate, survived: bt.survived, total: bt.total, medianFinal: bt.medianFinal, best: bt.best, worst: bt.worst } },
      charts: [],
      actions: { copy: true, tts: true, download: true, share: false },
    };
  }

  // Guardrail check
  if (result.intent === "guardrail_check") {
    const { checkGuardrails } = await import("../../shared/calculators/scui");
    const params: Record<string, number> = {};
    if (slots.income) params.returnRate = 0.07; // Default — can be overridden
    const warnings = checkGuardrails(params);
    return {
      intent: result.intent,
      tool: "scui.checkGuardrails",
      narrative: safetyWrap(
        warnings.length === 0
          ? "All assumptions are within reasonable ranges based on industry benchmarks."
          : `Found ${warnings.length} guardrail warning(s): ${warnings.map(w => `${w.field}: ${w.message}`).join("; ")}`,
      ),
      data: { warnings },
      charts: [],
      actions: { copy: true, tts: true, download: false, share: false },
    };
  }

  // Roll-up team — aggregate multiple strategies into a team view
  if (result.intent === "roll_up_team") {
    const role = slots.role ?? "dir";
    // Build a representative team: the leader + a few team members
    const leader = bieCreateStrategy("Team Leader", {
      role,
      streams: { personal: true, expanded: true, override: true },
      team: [
        { name: "New Assoc 1", role: "new", f: 60_000 },
        { name: "New Assoc 2", role: "new", f: 45_000 },
        { name: "Exp Pro 1", role: "exp", f: 90_000 },
      ],
    });
    const assoc1 = bieCreateStrategy("Associate 1", {
      role: "new",
      streams: { personal: true },
    });
    const assoc2 = bieCreateStrategy("Associate 2", {
      role: "exp",
      streams: { personal: true, expanded: true },
    });
    const rollUpResult = bieRollUp([leader, assoc1, assoc2]);

    return {
      intent: result.intent,
      tool: "bie.rollUp",
      narrative: safetyWrap(
        `Team roll-up for a ${role}-led organization (3 strategies). ` +
        `Total GDC: $${rollUpResult.totalGDC.toLocaleString()}, ` +
        `Total Income: $${rollUpResult.totalIncome.toLocaleString()}, ` +
        `Override: $${rollUpResult.totalOverride.toLocaleString()}, ` +
        `AUM: $${rollUpResult.totalAUM.toLocaleString()}, ` +
        `Team size: ${rollUpResult.teamSize}. ` +
        `Avg GDC per strategy: $${rollUpResult.avgGDC.toLocaleString()}.`,
      ),
      data: {
        rollUp: rollUpResult,
        strategies: ["Team Leader", "Associate 1", "Associate 2"],
        role,
      },
      charts: [
        {
          component: "ProjectionChart",
          caption: `Team roll-up — ${role} organization`,
          props: {
            series: [
              {
                key: "income",
                label: "Total Team Income",
                values: [rollUpResult.totalIncome],
                isPracticeIncome: true,
              },
            ],
          },
        },
      ],
      actions: { copy: true, tts: true, download: true, share: false },
    };
  }

  // Build strategy — recommend products and structure
  if (result.intent === "build_strategy") {
    const role = slots.role ?? "exp";
    const income = slots.income ?? slots.targetIncome ?? 150_000;
    const profile = buildProfile(slots);

    // Build product recommendations from the Record<ProductType, ProductReference>
    const productEntries = Object.entries(PRODUCT_REFERENCES).slice(0, 8);
    const productLines = productEntries.map(([key, ref]) =>
      `- **${key}**: ${ref.benchmark} (${ref.src.split(",")[0]})`,
    );

    // Build benchmark highlights from the Record<string, IndustryBenchmark>
    const benchmarkEntries = Object.entries(INDUSTRY_BENCHMARKS).slice(0, 5);
    const benchmarkLines = benchmarkEntries.map(([key, bm]) =>
      `- ${key}: ${bm.national != null ? `${(bm.national * 100).toFixed(1)}%` : "N/A"} (${bm.source})`,
    );

    return {
      intent: result.intent,
      tool: "bie.buildStrategy",
      narrative: safetyWrap(
        `Strategy recommendation for a ${role} targeting $${income.toLocaleString()} income:\n\n` +
        `**Recommended Product Mix:**\n` +
        productLines.join("\n") +
        `\n\n**Key Industry Benchmarks:**\n` +
        benchmarkLines.join("\n") +
        `\n\nBased on the ${role} role profile, a balanced approach combining protection products (Term, IUL) with wealth-building (FIA, Advisory) and recurring revenue (AUM trail, renewals) provides the strongest path to your income target.`,
      ),
      data: {
        role,
        targetIncome: income,
        profile,
        products: productEntries.map(([k, v]) => ({ type: k, ...v })),
        benchmarks: benchmarkEntries.map(([k, v]) => ({ key: k, ...v })),
      },
      charts: [
        {
          component: "StrategyCard",
          caption: `Recommended strategy for ${role}`,
          props: {
            role,
            targetIncome: income,
            productCount: productEntries.length,
          },
        },
      ],
      actions: { copy: true, tts: true, download: true, share: true },
    };
  }

  // Sensitivity sweep — what-if analysis on key parameters
  if (result.intent === "sensitivity_sweep") {
    const role = slots.role ?? "exp";
    const baseIncome = slots.income ?? 120_000;
    // Sweep across different GDC levels and WB percentages
    const sweepResults: Array<{ gdc: number; wbPct: number; income: number }> = [];
    const gdcLevels = [50_000, 75_000, 100_000, 150_000, 200_000, 300_000];
    const wbPcts = [0.5, 0.6, 0.7, 0.8, 0.9];

    for (const gdc of gdcLevels) {
      for (const wbPct of wbPcts) {
        const strategy = bieCreateStrategy("Sweep", {
          role,
          streams: { personal: true },
          personalGDC: gdc,
          wbPct,
        });
        const yrs = bieSimulate(strategy, 1);
        const yr1 = yrs[0];
        sweepResults.push({
          gdc,
          wbPct,
          income: yr1?.totalIncome ?? 0,
        });
      }
    }

    // Find the combination closest to target
    const target = slots.targetIncome ?? baseIncome;
    const closest = sweepResults.reduce((best, cur) =>
      Math.abs(cur.income - target) < Math.abs(best.income - target) ? cur : best,
    );

    return {
      intent: result.intent,
      tool: "bie.sensitivitySweep",
      narrative: safetyWrap(
        `Sensitivity sweep for a ${role} role across ${gdcLevels.length} GDC levels and ${wbPcts.length} WB allocation percentages (${sweepResults.length} combinations).\n\n` +
        `To hit ~$${target.toLocaleString()} income, the closest combination is $${closest.gdc.toLocaleString()} GDC at ${(closest.wbPct * 100).toFixed(0)}% WB allocation → $${closest.income.toLocaleString()} income.\n\n` +
        `Higher WB allocation increases payout rates (bracket progression), while higher GDC increases total production. The optimal balance depends on your product mix and market access.`,
      ),
      data: {
        role,
        target,
        sweepResults,
        closest,
        gdcLevels,
        wbPcts,
      },
      charts: [],
      actions: { copy: true, tts: true, download: true, share: false },
    };
  }

  // Fallback — no engine intent detected
  return {
    intent: "none",
    tool: "none",
    narrative:
      "I didn't detect a wealth-engine intent in that message. Try asking 'run a WealthBridge simulation for a 40-year-old earning $300K' or 'compare WealthBridge vs Do Nothing'.",
    data: {},
    charts: [],
    actions: { copy: true, tts: false, download: false, share: false },
  };
}
