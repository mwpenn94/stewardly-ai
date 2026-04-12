/**
 * Comparables scoring — pure helpers that turn the catalog in data.ts
 * into a gap matrix, per-axis rankings, and priority recommendations.
 *
 * Everything here is pure (no DB, no fetch) so the unit tests can run
 * offline. The router layer wraps these helpers for tRPC consumption.
 */

import {
  COMPARABLES,
  FEATURE_AXES,
  type ComparableApp,
  type FeatureAxis,
  type FeatureAxisId,
  type ComparableAppFeature,
  type ComparableCategory,
  CATEGORY_LABELS,
} from "./data";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AxisLeaderboardEntry {
  app: ComparableApp;
  score: number;
}

export interface AxisGap {
  axis: FeatureAxis;
  /** Best score any comparable achieves on this axis. */
  bestExternal: number;
  /** Stewardly's current score. */
  stewardly: number;
  /** bestExternal - stewardly (positive = trailing). */
  gap: number;
  /** Top 3 comparables on this axis sorted desc. */
  leaders: AxisLeaderboardEntry[];
}

export type GapBand = "leading" | "parity" | "trailing" | "missing";

export interface OverallSummary {
  /** Total stewardly-score across every axis. */
  stewardlyTotal: number;
  /** Max possible (3 * axes). */
  maxTotal: number;
  /** Stewardly's rank among all apps (1 = best). */
  stewardlyRank: number;
  /** Number of axes in each band. */
  bands: Record<GapBand, number>;
  /** Single headline score 0..100. */
  overallPct: number;
}

export interface PriorityRecommendation {
  axis: FeatureAxis;
  gap: number;
  reason: string;
  /** Which comparables demonstrate this feature in market (top 3). */
  exemplars: ComparableApp[];
  /** Suggested Stewardly module path (informational only). */
  suggestedPath: string;
}

export interface AppSummary {
  app: ComparableApp;
  /** Sum of all feature scores for this app. */
  totalScore: number;
  /** Number of axes on which this app beats Stewardly. */
  beatsStewardlyOn: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Resolve a feature score for an app on an axis, defaulting to 0. */
export function getFeatureScore(
  app: ComparableApp,
  axisId: FeatureAxisId,
): number {
  const hit = app.features.find((f: ComparableAppFeature) => f.axis === axisId);
  return hit ? clampScore(hit.score) : 0;
}

/** Clamp a raw score to the 0..3 rubric. */
export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 3) return 3;
  return Math.round(n);
}

/** Sum of every feature score an app declares. */
export function totalScoreFor(app: ComparableApp): number {
  return app.features.reduce((sum, f) => sum + clampScore(f.score), 0);
}

/** Sum of Stewardly's scores across every axis. */
export function stewardlyTotal(
  axes: readonly FeatureAxis[] = FEATURE_AXES,
): number {
  return axes.reduce((sum, axis) => sum + clampScore(axis.stewardlyScore), 0);
}

/** Classify a single axis by how Stewardly compares. */
export function classifyAxis(
  axis: FeatureAxis,
  bestExternal: number,
): GapBand {
  const s = clampScore(axis.stewardlyScore);
  if (s === 0 && bestExternal >= 2) return "missing";
  if (s > bestExternal) return "leading";
  if (s === bestExternal) return "parity";
  return "trailing";
}

/** Top-N comparables on a given axis, sorted desc by score then by name. */
export function leadersForAxis(
  axisId: FeatureAxisId,
  limit = 3,
  pool: readonly ComparableApp[] = COMPARABLES,
): AxisLeaderboardEntry[] {
  return pool
    .map((app) => ({ app, score: getFeatureScore(app, axisId) }))
    .filter((e) => e.score > 0)
    .sort((a, b) =>
      b.score - a.score || a.app.name.localeCompare(b.app.name),
    )
    .slice(0, limit);
}

/** Build the full gap matrix for every axis. */
export function buildGapMatrix(
  axes: readonly FeatureAxis[] = FEATURE_AXES,
  pool: readonly ComparableApp[] = COMPARABLES,
): AxisGap[] {
  return axes.map((axis) => {
    const leaders = leadersForAxis(axis.id, 3, pool);
    const bestExternal = leaders.length ? leaders[0].score : 0;
    return {
      axis,
      bestExternal,
      stewardly: clampScore(axis.stewardlyScore),
      gap: bestExternal - clampScore(axis.stewardlyScore),
      leaders,
    };
  });
}

/**
 * Rank all comparables AND Stewardly together. Used for
 * `overallSummary().stewardlyRank`.
 *
 * The ranking metric is total score across all axes (higher is
 * better), with ties broken alphabetically so the result is stable.
 */
export function overallRanking(
  axes: readonly FeatureAxis[] = FEATURE_AXES,
  pool: readonly ComparableApp[] = COMPARABLES,
): Array<{ name: string; total: number; isStewardly: boolean }> {
  const rows: Array<{ name: string; total: number; isStewardly: boolean }> = [
    { name: "Stewardly", total: stewardlyTotal(axes), isStewardly: true },
    ...pool.map((app) => ({
      name: app.name,
      total: totalScoreFor(app),
      isStewardly: false,
    })),
  ];
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return rows;
}

/** Compute the headline dashboard summary. */
export function overallSummary(
  axes: readonly FeatureAxis[] = FEATURE_AXES,
  pool: readonly ComparableApp[] = COMPARABLES,
): OverallSummary {
  const matrix = buildGapMatrix(axes, pool);
  const ranks = overallRanking(axes, pool);
  const stewardlyIdx = ranks.findIndex((r) => r.isStewardly);
  const bands: Record<GapBand, number> = {
    leading: 0,
    parity: 0,
    trailing: 0,
    missing: 0,
  };
  for (const row of matrix) {
    bands[classifyAxis(row.axis, row.bestExternal)] += 1;
  }
  const stewardlyTotalVal = stewardlyTotal(axes);
  const maxTotal = axes.length * 3;
  return {
    stewardlyTotal: stewardlyTotalVal,
    maxTotal,
    stewardlyRank: stewardlyIdx + 1,
    bands,
    overallPct: maxTotal > 0
      ? Math.round((stewardlyTotalVal / maxTotal) * 100)
      : 0,
  };
}

/**
 * Priority recommendations — axes where (a) Stewardly trails, and
 * (b) at least one exemplar clearly ships this feature.
 *
 * Sorted desc by gap; missing axes bubble to the top (gap >= 2).
 */
export function priorityRecommendations(
  limit = 5,
  axes: readonly FeatureAxis[] = FEATURE_AXES,
  pool: readonly ComparableApp[] = COMPARABLES,
): PriorityRecommendation[] {
  const matrix = buildGapMatrix(axes, pool);
  return matrix
    .filter((row) => row.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.axis.label.localeCompare(b.axis.label))
    .slice(0, limit)
    .map((row) => ({
      axis: row.axis,
      gap: row.gap,
      reason: buildReason(row),
      exemplars: row.leaders.map((l) => l.app),
      suggestedPath: suggestedPath(row.axis.id),
    }));
}

function buildReason(row: AxisGap): string {
  if (row.stewardly === 0) {
    const names = row.leaders.map((l) => l.app.name).join(", ");
    return `Not implemented in Stewardly. Shipping in: ${names}.`;
  }
  if (row.gap === 1) {
    return "Close but limited — expand depth to match market leaders.";
  }
  return `Gap of ${row.gap} on the 0..3 rubric — multiple comparables first-class this.`;
}

function suggestedPath(axisId: FeatureAxisId): string {
  // Map each axis to the likely implementation anchor in the Stewardly repo.
  const paths: Record<FeatureAxisId, string> = {
    chat_native_ux: "client/src/pages/Chat.tsx",
    multi_model_ai: "server/services/consensusStream.ts",
    meeting_transcription: "server/routers/meetings.ts + server/_core/voiceTranscription.ts",
    crm_sync: "server/services/ghl/ + server/routers/serviceRouters.ts",
    compliance_archive: "server/services/compliance/",
    portfolio_mgmt: "server/services/portfolio/ (NEW)",
    rebalancing: "server/services/rebalancing/ (NEW)",
    tax_planning: "client/src/pages/TaxPlanning.tsx + shared/calculators/",
    estate_planning: "client/src/pages/EstatePlanning.tsx + shared/calculators/",
    insurance_analysis: "client/src/pages/InsuranceAnalysis.tsx + agent_quotes",
    premium_finance: "server/routers/premiumFinanceRouter.ts",
    lead_capture: "server/routers/leadPipeline.ts + propensity.ts",
    client_portal: "client/src/pages/Portal.tsx + clientPortal router",
    mobile_app: "mobile/ (NEW — React Native or Capacitor shell)",
    white_label: "server/routers/orgBranding.ts + OrgBrandingEditor.tsx",
    api_first: "server/routers/*  — needs a versioned public REST surface",
    agent_framework: "server/routers/openClaw.ts + graduated autonomy",
    wealth_calculators: "server/shared/calculators/",
  };
  return paths[axisId];
}

/** Sort comparables into categories for the UI's grouped view. */
export function groupByCategory(
  pool: readonly ComparableApp[] = COMPARABLES,
): Array<{
  category: ComparableCategory;
  label: string;
  apps: ComparableApp[];
}> {
  const buckets = new Map<ComparableCategory, ComparableApp[]>();
  for (const app of pool) {
    const list = buckets.get(app.category) ?? [];
    list.push(app);
    buckets.set(app.category, list);
  }
  return Array.from(buckets.entries())
    .map(([category, apps]) => ({
      category,
      label: CATEGORY_LABELS[category],
      apps: apps.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Per-app summary with total + how many axes it beats Stewardly on. */
export function appSummaries(
  pool: readonly ComparableApp[] = COMPARABLES,
  axes: readonly FeatureAxis[] = FEATURE_AXES,
): AppSummary[] {
  return pool.map((app) => {
    const totalScore = totalScoreFor(app);
    let beatsStewardlyOn = 0;
    for (const axis of axes) {
      const ext = getFeatureScore(app, axis.id);
      if (ext > clampScore(axis.stewardlyScore)) beatsStewardlyOn += 1;
    }
    return { app, totalScore, beatsStewardlyOn };
  });
}
