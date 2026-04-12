/**
 * Completeness gate — pure helpers for deciding whether a profile
 * is "ready enough" to run a specific calculator, which fields
 * are missing, and what confidence tier the result should carry.
 *
 * The gate is the second force-multiplier layer on top of the
 * shared financial profile: every calculator previously ran with
 * whatever defaults the page seeded, and the user had no idea
 * which fields would make the output meaningfully better. The
 * gate turns that into a visible "fill in 3 more fields for a
 * high-confidence result" affordance.
 *
 * Pure — no React imports — so it's callable from the agent
 * tool registry, the chat pipeline, and the component tests.
 *
 * Pass 9 history: ships gap G10 from docs/PARITY.md.
 */

import type { FinancialProfile } from "@shared/financialProfile";

export type ConfidenceTier = "low" | "medium" | "high";

export interface CompletenessGateResult {
  /** True when every required field is populated. */
  ready: boolean;
  /** How many required fields are populated, total number. */
  populated: number;
  /** Required field names that are still missing. */
  missing: (keyof FinancialProfile)[];
  /** 0..1 ratio of populated required fields. */
  ratio: number;
  /** Human-readable tier mapping the ratio into low/medium/high. */
  tier: ConfidenceTier;
  /** Short summary string for the UI banner. */
  summary: string;
}

/**
 * Evaluate whether a profile meets the required-field list for
 * a specific calculator run.
 *
 * `requiredFields` is the minimum set needed for the engine to
 * produce a meaningful answer; `optionalFields` raise confidence
 * but aren't blockers.
 */
export function evaluateGate(
  profile: FinancialProfile,
  requiredFields: (keyof FinancialProfile)[],
  optionalFields: (keyof FinancialProfile)[] = [],
): CompletenessGateResult {
  const required = dedupe(requiredFields);
  const optional = dedupe(optionalFields.filter((f) => !required.includes(f)));

  const missing: (keyof FinancialProfile)[] = [];
  let populated = 0;
  for (const f of required) {
    if (hasValue(profile[f])) {
      populated++;
    } else {
      missing.push(f);
    }
  }
  const ready = missing.length === 0;

  // Optional-field score: contributes to the tier but NOT to ready.
  let optPopulated = 0;
  for (const f of optional) {
    if (hasValue(profile[f])) optPopulated++;
  }

  const reqRatio = required.length > 0 ? populated / required.length : 1;
  const optRatio =
    optional.length > 0 ? optPopulated / optional.length : 1;
  // Weighted blend: required counts 3×, optional 1×.
  const blendedRatio =
    (reqRatio * 3 + optRatio) / 4;

  const tier: ConfidenceTier =
    blendedRatio >= 0.85 ? "high" : blendedRatio >= 0.5 ? "medium" : "low";

  const summary = ready
    ? `Ready to run (${tier} confidence)`
    : `Missing ${missing.length} of ${required.length} required field${
        required.length === 1 ? "" : "s"
      }`;

  return {
    ready,
    populated,
    missing,
    ratio: reqRatio,
    tier,
    summary,
  };
}

/**
 * Rank missing fields by their cross-calculator impact score.
 * `impactScores` is typically derived from the quickQuoteRegistry's
 * `fieldImpactScore` but is passed in explicitly so this module
 * stays pure + portable.
 */
export function rankMissingByImpact(
  missing: (keyof FinancialProfile)[],
  impactScores: Partial<Record<keyof FinancialProfile, number>>,
): (keyof FinancialProfile)[] {
  return [...missing].sort((a, b) => {
    const sa = impactScores[a] ?? 0;
    const sb = impactScores[b] ?? 0;
    return sb - sa;
  });
}

/**
 * Friendly per-field labels the UI can drop into a form.
 * If a field isn't in the map the UI should fall back to a
 * toTitleCase of the field name.
 */
export const FIELD_LABELS: Partial<Record<keyof FinancialProfile, string>> = {
  age: "Current age",
  income: "Annual income",
  netWorth: "Net worth",
  savings: "Current savings",
  monthlySavings: "Monthly savings",
  dependents: "Number of dependents",
  mortgage: "Mortgage balance",
  debts: "Outstanding debts",
  marginalRate: "Marginal tax rate",
  equitiesReturn: "Expected equities return",
  existingInsurance: "Existing life insurance coverage",
  isBizOwner: "Business owner?",
  retirementAge: "Target retirement age",
  yearsInRetirement: "Years in retirement",
  desiredRetirementIncome: "Desired retirement income",
  stateOfResidence: "State of residence",
  filingStatus: "Tax filing status",
  estateGoal: "Estate planning goal",
  lifeInsuranceCoverage: "Life insurance coverage",
  hasLtc: "Long-term care coverage?",
  hasDisability: "Disability coverage?",
  hasHomeowner: "Homeowner?",
  businessRevenue: "Business revenue",
  businessEmployees: "Business employees",
  businessRole: "Business role",
};

/** Friendly label for a given field, falling back to title case. */
export function labelFor(field: keyof FinancialProfile): string {
  return FIELD_LABELS[field] ?? toTitleCase(String(field));
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function hasValue(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  return true;
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function toTitleCase(s: string): string {
  return s
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
