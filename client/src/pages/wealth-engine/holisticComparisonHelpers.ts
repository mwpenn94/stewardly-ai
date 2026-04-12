/**
 * Pure (non-React) helpers for the HolisticComparison page.
 *
 * The Holistic Engine (HE) lets a user compare their current
 * trajectory against an alternative strategy. The most powerful
 * comparison is "do nothing vs. WealthBridge plan" — the gap is
 * usually massive and is the easiest illustration of the value
 * proposition. This module owns the registry of comparison
 * presets and the pure aggregation that turns two HE simulations
 * into a side-by-side delta summary.
 *
 * Extracted into its own module so the test suite can exercise
 * the logic without pulling React (AppShell, wouter, ProjectionChart)
 * into a node-environment vitest run.
 */

import type { FinancialProfile } from "@/stores/financialProfile";

/** Server-side enum for HE_PRESETS — keep in sync with wealthEngine.runPreset. */
export type HePresetKey =
  | "wealthbridgeClient"
  | "doNothing"
  | "diy"
  | "wirehouse"
  | "ria"
  | "captivemutual"
  | "communitybd"
  | "wbPremFinance";

export interface HePresetMeta {
  key: HePresetKey;
  label: string;
  short: string;
  /** Tone color hint — matches the HE preset color so charts stay consistent. */
  color: string;
  /** One-line description for the picker UI. */
  description: string;
}

/** All 8 HE comparison presets — server runPreset enum, in ranking order. */
export const HE_PRESET_REGISTRY: HePresetMeta[] = [
  {
    key: "doNothing",
    label: "Do Nothing (Current Path)",
    short: "Do nothing",
    color: "#94A3B8",
    description: "Stay on the current trajectory. Baseline for every comparison.",
  },
  {
    key: "diy",
    label: "DIY (Self-Directed)",
    short: "DIY",
    color: "#7C3AED",
    description: "Self-directed brokerage / robo-advisor with no advisor fees.",
  },
  {
    key: "wirehouse",
    label: "Wirehouse (Full Service)",
    short: "Wirehouse",
    color: "#2563EB",
    description: "Traditional full-service broker-dealer with bundled advisory fees.",
  },
  {
    key: "ria",
    label: "Independent RIA",
    short: "RIA",
    color: "#0891B2",
    description: "Fee-only fiduciary advisor with reinvested tax savings.",
  },
  {
    key: "captivemutual",
    label: "Captive Mutual Carrier",
    short: "Captive",
    color: "#1E40AF",
    description: "Insurance-led captive carrier focused on whole life + annuity.",
  },
  {
    key: "communitybd",
    label: "Community Broker-Dealer",
    short: "Community BD",
    color: "#0891B2",
    description: "Local independent broker-dealer with limited advisory layering.",
  },
  {
    key: "wealthbridgeClient",
    label: "WealthBridge Plan",
    short: "WealthBridge",
    color: "#16A34A",
    description: "WealthBridge holistic plan with reinvested tax savings.",
  },
  {
    key: "wbPremFinance",
    label: "WealthBridge + Premium Finance",
    short: "WB + PremFin",
    color: "#059669",
    description: "WealthBridge plan layered with premium financing for HNW clients.",
  },
];

/** Lookup a preset by key — returns undefined if missing. */
export function findPreset(key: HePresetKey | string): HePresetMeta | undefined {
  return HE_PRESET_REGISTRY.find((p) => p.key === key);
}

/**
 * Map the shared FinancialProfile into the canonical HE input shape.
 * Drops UI-only fields the engine doesn't understand.
 */
export function profileToHolisticInput(
  p: FinancialProfile,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = [
    "age",
    "income",
    "netWorth",
    "savings",
    "monthlySavings",
    "dependents",
    "mortgage",
    "debts",
    "marginalRate",
    "equitiesReturn",
    "existingInsurance",
    "isBizOwner",
  ] as const;
  for (const k of keys) {
    const v = p[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/**
 * Compute the delta summary between two HE projections.
 * Each projection is an array of HolisticSnapshot rows; we read
 * `liquidWealth` from the final row and the cumulative-savings
 * trajectory to compute total contribution and drift.
 *
 * Pure — both arrays may be empty / undefined; the result is
 * always a populated object with zero defaults.
 */
export interface ComparisonDelta {
  /** Final liquid wealth for strategy A. */
  finalA: number;
  /** Final liquid wealth for strategy B. */
  finalB: number;
  /** B − A (positive means B wins). */
  delta: number;
  /** delta / max(A, 1) so the UI can show "37% more". */
  pctImprovement: number;
  /** Number of years compared. */
  years: number;
}

export function computeComparisonDelta(
  a: Array<{ liquidWealth?: number; year?: number }> | undefined,
  b: Array<{ liquidWealth?: number; year?: number }> | undefined,
): ComparisonDelta {
  const finalA = a && a.length > 0 ? (a[a.length - 1].liquidWealth ?? 0) : 0;
  const finalB = b && b.length > 0 ? (b[b.length - 1].liquidWealth ?? 0) : 0;
  const delta = finalB - finalA;
  const denom = Math.max(Math.abs(finalA), 1);
  const pctImprovement = delta / denom;
  // Use the longer of the two arrays as the comparison horizon. If
  // they differ in length the UI will pad with the shorter one's
  // last value, but for the headline number we care about the
  // longest.
  const years = Math.max(a?.length ?? 0, b?.length ?? 0);
  return { finalA, finalB, delta, pctImprovement, years };
}

/**
 * Format a delta into a readable headline string. Pure for tests.
 */
export function formatDeltaHeadline(delta: ComparisonDelta, presetA: string, presetB: string): string {
  if (delta.delta === 0) {
    return `${presetA} and ${presetB} project to the same liquid wealth.`;
  }
  const sign = delta.delta > 0 ? "more" : "less";
  const absPct = Math.abs(delta.pctImprovement * 100);
  return `${presetB} projects ${absPct.toFixed(0)}% ${sign} liquid wealth than ${presetA} over ${delta.years} years.`;
}

/**
 * Score how confident the comparison is, based on profile completeness
 * and projection length. 0 = unreliable, 1 = high-confidence.
 */
export function comparisonConfidence(
  profileCompleteness: number,
  years: number,
): number {
  if (years <= 0) return 0;
  // Linear blend: 70% from profile completeness, 30% from horizon
  // length saturating at 30 years.
  const horizonScore = Math.min(1, years / 30);
  return Math.max(0, Math.min(1, profileCompleteness * 0.7 + horizonScore * 0.3));
}
