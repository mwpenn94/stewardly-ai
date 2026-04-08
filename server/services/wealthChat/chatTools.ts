/**
 * Wealth chat tools — Phase 6A.
 *
 * Conversational extensions on top of the Phase 2C `we_*` tools. These
 * are higher-level: they explain numbers, modify-and-rerun, compare
 * scenarios, render inline visualizations, and project recruit impact
 * — all of which the ReAct loop can call from a chat conversation.
 *
 * The handlers here are pure async functions that return JSON-serializable
 * objects. The aiToolCalling.ts dispatch table imports them and exposes
 * them as `chat_*` tools so the agent can pick the right level of
 * conversational sophistication per query.
 */

import {
  uweBuildStrategy,
  heSimulate,
  createHolisticStrategy,
  HE_PRESETS,
  type ClientProfile,
  type HolisticSnapshot,
} from "../../shared/calculators";
import { generateCompletePlan } from "../agent/calculatorOrchestrator";

// ─── Tool 1: explain_number ──────────────────────────────────────────────
// "Why is my projected retirement total $3.6M and not $4M?" — trace the
// engine's assumption chain. We pull the most recent persisted run for
// the same user via the orchestrator's persistence helper.

export interface ExplainNumberInput {
  metric: string; // e.g. "totalValue", "totalLiquidWealth", "roi"
  value: number;
  context?: string;
}

export interface ExplainNumberOutput {
  metric: string;
  observed: number;
  driverAssumptions: Array<{ name: string; value: string; impact: string }>;
  narrative: string;
}

export function explainNumber(input: ExplainNumberInput): ExplainNumberOutput {
  // Static driver mapping per metric — derived from the v7 engine
  // assumption table. Real Phase 7 will overlay user-specific defaults.
  const driverMap: Record<string, ExplainNumberOutput["driverAssumptions"]> = {
    totalValue: [
      { name: "Investment return", value: "7%/yr", impact: "compounds annually" },
      { name: "Savings rate", value: "15% of net income", impact: "drives liquid wealth" },
      { name: "Tax savings", value: "reinvested", impact: "boosts long-term ROI" },
      { name: "Death benefit", value: "stacked into total value", impact: "+$X at death" },
    ],
    totalLiquidWealth: [
      { name: "Equities return", value: "7% net", impact: "after AUM fee + tax drag" },
      { name: "Monthly savings contribution", value: "from net income", impact: "compounds" },
      { name: "Tax-savings reinvestment", value: "on", impact: "adds to balance each year" },
    ],
    roi: [
      { name: "Cumulative cost", value: "annual costs across horizon", impact: "denominator" },
      { name: "Total value", value: "stacked benefits + liquid wealth", impact: "numerator" },
    ],
  };

  const drivers = driverMap[input.metric] ?? [
    {
      name: "Generic engine assumption",
      value: "see methodology",
      impact: "varies",
    },
  ];

  return {
    metric: input.metric,
    observed: input.value,
    driverAssumptions: drivers,
    narrative: `${input.metric} of $${input.value.toLocaleString()} is driven primarily by ${drivers[0]?.name.toLowerCase()} (${drivers[0]?.value}), and ${drivers[1]?.name.toLowerCase() ?? "the secondary driver"}. This is a projection, not financial advice.`,
  };
}

// ─── Tool 2: modify_and_rerun ────────────────────────────────────────────
// Change one assumption in a base profile and re-run HE.simulate() to
// show the delta. Returns: original final value, new final value,
// delta, and a narrative explanation.

export interface ModifyAndRerunInput {
  baseProfile: ClientProfile;
  assumption: keyof ClientProfile;
  newValue: number;
  years?: number;
}

export function modifyAndRerun(input: ModifyAndRerunInput): {
  original: { final: HolisticSnapshot; assumption: number | undefined };
  modified: { final: HolisticSnapshot; assumption: number };
  delta: { totalValue: number; totalValuePct: number };
  narrative: string;
} {
  const years = input.years ?? 30;
  const original = HE_PRESETS.wealthbridgeClient(input.baseProfile);
  const originalRun = heSimulate(original, years);

  const modifiedProfile: ClientProfile = {
    ...input.baseProfile,
    [input.assumption]: input.newValue,
  };
  const modified = HE_PRESETS.wealthbridgeClient(modifiedProfile);
  const modifiedRun = heSimulate(modified, years);

  const origFinal = originalRun[originalRun.length - 1];
  const modFinal = modifiedRun[modifiedRun.length - 1];
  const deltaAbs = modFinal.totalValue - origFinal.totalValue;
  const deltaPct = origFinal.totalValue
    ? (deltaAbs / origFinal.totalValue) * 100
    : 0;

  return {
    original: {
      final: origFinal,
      assumption: input.baseProfile[input.assumption] as number | undefined,
    },
    modified: {
      final: modFinal,
      assumption: input.newValue,
    },
    delta: { totalValue: deltaAbs, totalValuePct: deltaPct },
    narrative: `Changing ${input.assumption} to ${input.newValue} would shift your year-${years} projected value by ${deltaAbs >= 0 ? "+" : ""}$${deltaAbs.toLocaleString()} (${deltaPct.toFixed(1)}%). This is a projection, not financial advice.`,
  };
}

// ─── Tool 3: compare_scenarios ───────────────────────────────────────────
// Run two named scenarios end-to-end through HE.simulate and return a
// side-by-side delta table.

export interface CompareScenariosInput {
  scenario1: { name: string; profile: ClientProfile; preset?: keyof typeof HE_PRESETS };
  scenario2: { name: string; profile: ClientProfile; preset?: keyof typeof HE_PRESETS };
  years?: number;
}

export function compareScenarios(input: CompareScenariosInput): {
  scenario1: { name: string; final: HolisticSnapshot };
  scenario2: { name: string; final: HolisticSnapshot };
  delta: {
    totalValue: number;
    totalLiquidWealth: number;
    netValue: number;
    roi: number;
  };
  winner: string;
  narrative: string;
} {
  const years = input.years ?? 30;
  const buildOne = (s: CompareScenariosInput["scenario1"]) => {
    const fn = (s.preset && s.preset !== "wealthbridgePro"
      ? HE_PRESETS[s.preset]
      : HE_PRESETS.wealthbridgeClient) as (p: ClientProfile) => ReturnType<typeof HE_PRESETS.doNothing>;
    return heSimulate(fn(s.profile), years);
  };
  const r1 = buildOne(input.scenario1);
  const r2 = buildOne(input.scenario2);
  const f1 = r1[r1.length - 1];
  const f2 = r2[r2.length - 1];
  const delta = {
    totalValue: f2.totalValue - f1.totalValue,
    totalLiquidWealth: f2.totalLiquidWealth - f1.totalLiquidWealth,
    netValue: f2.netValue - f1.netValue,
    roi: f2.roi - f1.roi,
  };
  const winner = delta.totalValue >= 0 ? input.scenario2.name : input.scenario1.name;
  return {
    scenario1: { name: input.scenario1.name, final: f1 },
    scenario2: { name: input.scenario2.name, final: f2 },
    delta,
    winner,
    narrative: `${winner} projects a higher year-${years} total value by $${Math.abs(delta.totalValue).toLocaleString()}. This is a projection, not financial advice.`,
  };
}

// ─── Tool 4: show_visualization ──────────────────────────────────────────
// Returns a React-component reference + props the chat UI can render
// inline. We don't return SVG strings (the chat UI is React-aware).

export interface ShowVisualizationInput {
  chartType:
    | "projection"
    | "guardrails"
    | "bracket"
    | "hierarchy"
    | "sankey";
  data: Record<string, unknown>;
}

export interface VisualizationDescriptor {
  component: string; // React component name
  props: Record<string, unknown>;
  caption: string;
}

export function showVisualization(
  input: ShowVisualizationInput,
): VisualizationDescriptor {
  switch (input.chartType) {
    case "projection":
      return {
        component: "ProjectionChart",
        props: input.data,
        caption: "Year-by-year wealth projection",
      };
    case "guardrails":
      return {
        component: "GuardrailsGauge",
        props: input.data,
        caption: "Portfolio vs guardrail thresholds",
      };
    case "bracket":
      return {
        component: "BracketViz",
        props: input.data,
        caption: "Tax bracket utilization",
      };
    case "hierarchy":
      return {
        component: "HierarchyTimeline",
        props: input.data,
        caption: "BIE hierarchy advancement timeline",
      };
    case "sankey":
      return {
        component: "SankeyFlow",
        props: input.data,
        caption: "Cash flow allocation",
      };
  }
}

// ─── Tool 5: project_recruit_impact ──────────────────────────────────────
// Scenario: "What if I added 3 recruits to my team next year?" — chains
// the orchestrator's complete plan with a synthetic team boost.

export interface ProjectRecruitImpactInput {
  clientId: string;
  additionalRecruits: number;
}

export async function projectRecruitImpact(
  input: ProjectRecruitImpactInput,
): Promise<{
  baseline: { totalValue: number; bizIncome: number };
  projected: { totalValue: number; bizIncome: number };
  delta: { totalValue: number; bizIncome: number };
  narrative: string;
}> {
  // Run baseline + a "boosted" hypothetical that bumps savings rate
  // (placeholder for full BIE team-add modeling — Phase 7 hooks in
  // real BIE override math).
  const baseline = await generateCompletePlan(input.clientId, "user_requested");
  const baselineFinal = baseline.projection.snapshots.at(-1);
  const baselineValue = baselineFinal?.totalValue ?? 0;

  // Synthetic boost — each recruit adds an estimated 5% to total value
  // (rough heuristic, Phase 7 replaces with real BIE simulation)
  const boost = 1 + 0.05 * input.additionalRecruits;
  const projectedValue = Math.round(baselineValue * boost);
  const baselineBiz = baselineFinal?.bizIncome ?? 0;
  const projectedBiz = Math.round(baselineBiz * boost);

  return {
    baseline: { totalValue: baselineValue, bizIncome: baselineBiz },
    projected: { totalValue: projectedValue, bizIncome: projectedBiz },
    delta: {
      totalValue: projectedValue - baselineValue,
      bizIncome: projectedBiz - baselineBiz,
    },
    narrative: `Adding ${input.additionalRecruits} recruit${input.additionalRecruits === 1 ? "" : "s"} could lift your year-30 total value by approximately $${(projectedValue - baselineValue).toLocaleString()} based on a heuristic 5%-per-recruit growth assumption. Phase 7 will replace this with real BIE simulation.`,
  };
}

// ─── Reference UWE strategy builder used as a smoke-target ───────────────
// Confirms the chat tools can build a valid strategy from a profile.
export function smokeStrategy(profile: ClientProfile) {
  return uweBuildStrategy("wealthbridge", profile);
}

// Re-export for the smoke tests
export function buildHolisticForChat(profile: ClientProfile) {
  return createHolisticStrategy("Chat Strategy", {
    hasBizIncome: false,
    profile,
    companyKey: "wealthbridge",
    savingsRate: 0.15,
    investmentReturn: 0.07,
    reinvestTaxSavings: true,
  });
}
