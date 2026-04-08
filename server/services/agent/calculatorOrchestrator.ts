/**
 * Calculator orchestrator — the agent-side entry point that chains
 * wealth-engine tool calls into complete plans and proactive checks.
 *
 * Called from: the ReAct loop, cron jobs, Plaid perception hooks, and
 * inbound webhook handlers. NOT called directly by tRPC user procedures
 * (those live in server/routers/wealthEngine.ts and go through the
 * regular UI path).
 *
 * Spec mapping (Phase 2B):
 *  - generateCompletePlan(clientId, trigger)
 *  - monitorAllPlans()         — scheduled monthly
 *  - detectOpportunities()     — scheduled weekly
 *  - recalibrateDefaults()     — scheduled quarterly
 *
 * Each workflow is a composition of Phase 1 engine calls glued together
 * with persistence so the improvement engine has audit trail to learn
 * from. The workflows return structured summaries the caller can hand
 * directly to emailCampaign / regBIDocumentation / notifications.
 */

import {
  uweBuildStrategy,
  uweSimulate,
  heSimulate,
  createHolisticStrategy,
  compareAt,
  findWinners,
  addStrategy,
  clearStrategies,
  setHorizon,
  monteCarloSimulate,
  HE_PRESETS,
  backPlan as bieBackPlan,
  bieSimulate,
  bieCreateStrategy,
  type ClientProfile,
  type BIEStrategy,
  type HolisticStrategy,
  type HolisticSnapshot,
  type ComparisonRow,
  type WinnersMap,
  type SimulationSnapshot,
} from "../../shared/calculators";
import {
  persistComputation,
  getLatestRun,
  diffRuns,
} from "./calculatorPersistence";

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT PROFILE LOADER
// ═══════════════════════════════════════════════════════════════════════════
// In production this pulls from the clients/users tables joined to
// suitability profile + Plaid snapshot. For Phase 2 we expose an
// interface that Phase 7's plaidProduction hook can fulfil later —
// everything downstream just needs { profile, bizConfig?, advisorId }.

export interface LoadedClient {
  clientId: string;
  advisorId: number | null;
  name: string;
  email?: string;
  profile: ClientProfile;
  planningHorizon: number;
  hasBizIncome: boolean;
  bizStrategy?: BIEStrategy;
  taxInputs: { marginalRate?: number; projectedIncome?: number };
  retirementInputs: { currentAge?: number; retirementAge?: number };
  planInputs: Record<string, unknown>;
}

// Default fallback loader — real Phase 7 implementation will replace
// the body with Plaid + DB calls.
export async function loadClientProfile(
  clientId: string,
): Promise<LoadedClient> {
  // Deterministic stub so tests are reproducible. Real integration swaps
  // this for a DB lookup in Phase 7.
  return {
    clientId,
    advisorId: null,
    name: `Client ${clientId}`,
    profile: {
      age: 40,
      income: 120000,
      netWorth: 350000,
      savings: 180000,
      dependents: 2,
      mortgage: 250000,
      debts: 30000,
      marginalRate: 0.25,
    },
    planningHorizon: 30,
    hasBizIncome: false,
    taxInputs: { marginalRate: 0.25 },
    retirementInputs: { currentAge: 40, retirementAge: 65 },
    planInputs: {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// generateCompletePlan — chains holistic projection + Monte Carlo +
// guardrails proxy + strategy winners. Intended as the single entry
// point the ReAct agent calls when asked to build a plan.
// ═══════════════════════════════════════════════════════════════════════════

export type TriggerContext =
  | "new_client_onboarding"
  | "scheduled_monthly_review"
  | "user_requested"
  | "plaid_divergence";

export interface CompletePlan {
  clientId: string;
  trigger: TriggerContext;
  projection: {
    runId: string | null;
    snapshots: HolisticSnapshot[];
  };
  monteCarlo: {
    runId: string | null;
    bands: ReturnType<typeof monteCarloSimulate>;
  };
  strategies: {
    runId: string | null;
    compareRows: ComparisonRow[];
    winners: WinnersMap;
  };
  deltaSummary: string[];
}

export async function generateCompletePlan(
  clientId: string,
  trigger: TriggerContext,
): Promise<CompletePlan> {
  const client = await loadClientProfile(clientId);

  // ── 1. Holistic projection ───────────────────────────────────────────
  const baseStrategy: HolisticStrategy = HE_PRESETS.wealthbridgeClient(
    client.profile,
  );
  if (client.hasBizIncome && client.bizStrategy) {
    baseStrategy.hasBizIncome = true;
    baseStrategy.bizStrategy = client.bizStrategy;
  }
  const projectionStart = Date.now();
  const snapshots = heSimulate(baseStrategy, client.planningHorizon);
  const projectionRunId = await persistComputation({
    tool: "he.simulate",
    input: { clientId, planningHorizon: client.planningHorizon, trigger },
    result: snapshots,
    durationMs: Date.now() - projectionStart,
    meta: {
      userId: client.advisorId ?? undefined,
      clientId,
      trigger: trigger === "scheduled_monthly_review" ? "scheduled" : "agent_chain",
    },
    confidence: 0.85,
  });

  // ── 2. Monte Carlo bands ─────────────────────────────────────────────
  const mcStart = Date.now();
  const bands = monteCarloSimulate(
    {
      investReturn: baseStrategy.investmentReturn,
      volatility: 0.15,
    },
    client.planningHorizon,
    500, // half the UI default — we're in an agent chain, prefer speed
  );
  const mcRunId = await persistComputation({
    tool: "montecarlo.simulate",
    input: { clientId, horizon: client.planningHorizon },
    result: bands,
    durationMs: Date.now() - mcStart,
    meta: {
      userId: client.advisorId ?? undefined,
      clientId,
      trigger: "agent_chain",
      parentRunId: projectionRunId ?? undefined,
    },
    confidence: 0.7,
  });

  // ── 3. Strategy comparison against the Do Nothing / DIY / RIA peer set
  clearStrategies();
  setHorizon(client.planningHorizon);
  addStrategy(baseStrategy);
  addStrategy(HE_PRESETS.doNothing(client.profile));
  addStrategy(HE_PRESETS.diy(client.profile));
  addStrategy(HE_PRESETS.ria(client.profile));
  const stratStart = Date.now();
  const compareRows = compareAt(client.planningHorizon);
  const winners = findWinners(client.planningHorizon);
  const stratRunId = await persistComputation({
    tool: "he.compareAt",
    input: { clientId, horizon: client.planningHorizon },
    result: { compareRows, winners },
    durationMs: Date.now() - stratStart,
    meta: {
      userId: client.advisorId ?? undefined,
      clientId,
      trigger: "agent_chain",
      parentRunId: projectionRunId ?? undefined,
    },
    confidence: 0.85,
  });

  // ── 4. Diff against last persisted run to decide notification
  let deltaSummary: string[] = [];
  if (trigger === "scheduled_monthly_review" && client.advisorId) {
    const latest = await getLatestRun("he.simulate", client.advisorId);
    const baseline = latest?.outputData as
      | Record<string, unknown>
      | null
      | undefined;
    // Compare the final snapshot's totalValue between runs
    const newFinal = snapshots[snapshots.length - 1] as unknown as
      | Record<string, unknown>
      | undefined;
    if (newFinal) {
      const diff = diffRuns(
        baseline
          ? (Array.isArray(baseline) ? baseline.at(-1) : baseline) as
              | Record<string, unknown>
              | undefined
          : null,
        newFinal,
      );
      deltaSummary = diff.summary;
    }
  }

  return {
    clientId,
    trigger,
    projection: { runId: projectionRunId, snapshots },
    monteCarlo: { runId: mcRunId, bands },
    strategies: {
      runId: stratRunId,
      compareRows,
      winners,
    },
    deltaSummary,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// monitorAllPlans — scheduled monthly
// Iterates all persisted plans, re-runs with current profile, alerts on
// significant changes. Returns a summary of alerts for the caller to
// route through notifications / emailCampaign / etc.
// ═══════════════════════════════════════════════════════════════════════════

export interface MonitoringAlert {
  clientId: string;
  summary: string[];
  newRunId: string | null;
}

export async function monitorAllPlans(
  listClientIds: () => Promise<string[]> = async () => [],
): Promise<MonitoringAlert[]> {
  const ids = await listClientIds();
  const alerts: MonitoringAlert[] = [];
  for (const clientId of ids) {
    const plan = await generateCompletePlan(
      clientId,
      "scheduled_monthly_review",
    );
    if (plan.deltaSummary.length > 0) {
      alerts.push({
        clientId,
        summary: plan.deltaSummary,
        newRunId: plan.projection.runId,
      });
    }
  }
  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════════
// detectOpportunities — scheduled weekly
// Scans for Roth conversion windows, hierarchy advancement proximity,
// guardrail-crossing risk. Returns concrete opportunities the advisor
// can action.
// ═══════════════════════════════════════════════════════════════════════════

export interface Opportunity {
  clientId: string;
  kind: "roth_window" | "hierarchy_advancement" | "guardrail_risk";
  narrative: string;
  metrics: Record<string, number>;
}

export async function detectOpportunities(
  listClientIds: () => Promise<string[]> = async () => [],
): Promise<Opportunity[]> {
  const ids = await listClientIds();
  const opps: Opportunity[] = [];

  for (const clientId of ids) {
    const client = await loadClientProfile(clientId);

    // 1. Roth conversion window — use the simpler "marginal rate + space
    //    in bracket" heuristic until Phase 6 adds a full Roth optimizer.
    const marginal = client.profile.marginalRate ?? 0.25;
    const income = client.profile.income ?? 0;
    if (marginal < 0.32 && income < 250000) {
      opps.push({
        clientId,
        kind: "roth_window",
        narrative: `Client in ${(marginal * 100).toFixed(0)}% bracket with income below $250K has potential Roth conversion window.`,
        metrics: { marginalRate: marginal, income },
      });
    }

    // 2. Business owners near advancement (BIE forward projection)
    if (client.hasBizIncome && client.bizStrategy) {
      const biz = bieSimulate(client.bizStrategy, 2);
      const yr1Income = biz[0]?.totalIncome ?? 0;
      const yr2Income = biz[1]?.totalIncome ?? 0;
      if (yr2Income > yr1Income * 1.1) {
        opps.push({
          clientId,
          kind: "hierarchy_advancement",
          narrative: `Projected ${(
            ((yr2Income - yr1Income) / Math.max(yr1Income, 1)) *
            100
          ).toFixed(1)}% income lift year-over-year — near advancement.`,
          metrics: { yr1Income, yr2Income },
        });
      }
    }

    // 3. Guardrail risk: compare current savings to a conservative
    //    drawdown requirement. This is a placeholder until Phase 4
    //    retirement guardrail logic wires in.
    const savings = client.profile.savings ?? 0;
    const monthlyNeed = (client.profile.income ?? 0) / 12;
    if (savings > 0 && monthlyNeed > 0 && savings / monthlyNeed < 6) {
      opps.push({
        clientId,
        kind: "guardrail_risk",
        narrative: `Savings cover only ${(savings / monthlyNeed).toFixed(1)} months of expenses — below the 6-month guardrail.`,
        metrics: { savings, monthlyNeed },
      });
    }
  }

  // Persist the opportunity scan so the improvement engine can track
  // alert precision/recall over time.
  await persistComputation({
    tool: "he.findWinners", // reuse existing slug; semantic bucket is "opportunity_scan"
    input: { scannedCount: ids.length },
    result: opps,
    durationMs: 0,
    meta: { trigger: "scheduled" },
  });

  return opps;
}

// ═══════════════════════════════════════════════════════════════════════════
// recalibrateDefaults — scheduled quarterly
// Reads recent model_runs + modelOutputRecords, compares projected vs
// actual outcomes where available, and proposes adjustments to the
// engine defaults. For Phase 2 this is a stub that logs the call; the
// full 6-loop implementation lands in Phase 7.
// ═══════════════════════════════════════════════════════════════════════════

export interface RecalibrationResult {
  inspectedCount: number;
  proposedAdjustments: Array<{ field: string; oldValue: number; newValue: number }>;
  calibratedAt: Date;
}

export async function recalibrateDefaults(): Promise<RecalibrationResult> {
  const result: RecalibrationResult = {
    inspectedCount: 0,
    proposedAdjustments: [],
    calibratedAt: new Date(),
  };
  await persistComputation({
    tool: "he.findWinners",
    input: { kind: "recalibrate_defaults" },
    result,
    durationMs: 0,
    meta: { trigger: "scheduled" },
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Small internal helper: run a UWE strategy straight through the
// simulate pipeline without persistence. Used by orchestrator dry-runs.
// ═══════════════════════════════════════════════════════════════════════════

export function dryRunWealthStrategy(
  companyKey: string,
  profile: ClientProfile,
  years = 30,
): SimulationSnapshot[] {
  const strategy = uweBuildStrategy(companyKey, profile);
  return uweSimulate(strategy, years);
}

// Small internal helper: back-plan a BIE target against a role. Used by
// the ReAct agent's "what do I need to do to earn $X?" tool.
export function backPlanForRole(
  targetIncome: number,
  role:
    | "new"
    | "exp"
    | "sa"
    | "dir"
    | "md"
    | "rvp"
    | "affA"
    | "affB"
    | "affC"
    | "affD"
    | "partner",
) {
  const strategy = bieCreateStrategy("back-plan", {
    role,
    streams: { personal: true },
  });
  return bieBackPlan(targetIncome, strategy);
}
