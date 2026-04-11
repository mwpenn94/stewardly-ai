/**
 * Shared financial profile store — the force-multiplier data layer
 * that every calculator, quick-quote flow, and planning page reads
 * and writes through.
 *
 * Before this store existed, every page (Calculators, FinancialPlanning,
 * QuickQuoteFlow, TaxPlanning, EstatePlanning, RiskAssessment, the four
 * Wealth-Engine pages, and each public calculator) held its own `useState`
 * of the same handful of fields — age, income, savings, dependents,
 * marginalRate, etc. Users had to re-enter them on every page.
 *
 * This module is the single source of truth. It is intentionally pure
 * (no React imports) so it can be exercised in tests and consumed by
 * the companion `useFinancialProfile` React hook OR by plain DOM code
 * in the public calculators.
 *
 * Scope: keeps the canonical ClientProfile shape from
 * server/shared/calculators/types.ts aligned, plus a handful of
 * quick-quote-only UI fields (dependents bool-ish, homeowner flag, etc.)
 * and a derived completeness score that drives the "resume" CTAs.
 */

/** Canonical client profile — mirrors server/shared/calculators types. */
export interface FinancialProfile {
  // Core — used by nearly every calculator
  age?: number;
  income?: number;
  netWorth?: number;
  savings?: number;
  monthlySavings?: number;
  dependents?: number;
  mortgage?: number;
  debts?: number;
  marginalRate?: number;
  equitiesReturn?: number;
  existingInsurance?: number;
  isBizOwner?: boolean;

  // Retirement-specific
  retirementAge?: number;
  yearsInRetirement?: number;
  desiredRetirementIncome?: number;

  // Estate / tax
  stateOfResidence?: string;
  filingStatus?: "single" | "mfj" | "mfs" | "hoh" | "qw";
  estateGoal?: "minimize_tax" | "maximize_gift" | "charitable" | "none";

  // Insurance / protection
  lifeInsuranceCoverage?: number;
  hasLtc?: boolean;
  hasDisability?: boolean;
  hasHomeowner?: boolean;

  // Business owner (BIE feeder)
  businessRevenue?: number;
  businessEmployees?: number;
  businessRole?: "new" | "exp" | "sa" | "dir" | "md" | "rvp" | "partner";

  // Meta
  updatedAt?: string;
  source?: "user" | "quick_quote" | "advisor_intake" | "csv_import" | "api";
}

/** Internal state wrapper — versioned for safe migrations. */
export interface FinancialProfileState {
  version: number;
  profile: FinancialProfile;
}

/** Current on-disk schema version — bump when a breaking change lands. */
export const FINANCIAL_PROFILE_VERSION = 1;

/** localStorage key (prefixed to avoid colliding with guest prefs). */
export const FINANCIAL_PROFILE_STORAGE_KEY = "stewardly_financial_profile";

/** Known scalar numeric fields (used for clamp + completeness scoring). */
const NUMERIC_FIELDS: (keyof FinancialProfile)[] = [
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
  "retirementAge",
  "yearsInRetirement",
  "desiredRetirementIncome",
  "lifeInsuranceCoverage",
  "businessRevenue",
  "businessEmployees",
];

const BOOLEAN_FIELDS: (keyof FinancialProfile)[] = [
  "isBizOwner",
  "hasLtc",
  "hasDisability",
  "hasHomeowner",
];

/** Fields used by the completeness score (weighted). */
const CORE_COMPLETENESS_FIELDS: (keyof FinancialProfile)[] = [
  "age",
  "income",
  "savings",
  "monthlySavings",
  "dependents",
  "marginalRate",
];

/** Empty profile — safe to render in a form without undefineds. */
export const EMPTY_PROFILE: FinancialProfile = Object.freeze({});

/**
 * Defensive parse — tolerates malformed JSON, unknown schema versions,
 * and non-object top-level shapes by falling back to the empty profile.
 * Runs field-level sanitization (clamping, numeric coercion, stripping
 * unknown keys) to prevent a corrupted localStorage blob from crashing
 * every calculator on mount.
 */
export function parseFinancialProfile(raw: string | null): FinancialProfileState {
  if (!raw || typeof raw !== "string") {
    return { version: FINANCIAL_PROFILE_VERSION, profile: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { version: FINANCIAL_PROFILE_VERSION, profile: {} };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { version: FINANCIAL_PROFILE_VERSION, profile: {} };
  }
  const obj = parsed as Record<string, unknown>;
  const version = typeof obj.version === "number" ? obj.version : 0;
  const rawProfile =
    obj.profile && typeof obj.profile === "object" && !Array.isArray(obj.profile)
      ? (obj.profile as Record<string, unknown>)
      : {};
  return {
    version: FINANCIAL_PROFILE_VERSION,
    profile: sanitizeProfile(rawProfile, version),
  };
}

/**
 * Coerce and clamp a raw object into a typed FinancialProfile.
 * Silently drops unknown keys and non-finite numerics.
 * `fromVersion` is reserved for future migrations — noop today.
 */
export function sanitizeProfile(
  raw: Record<string, unknown>,
  _fromVersion = FINANCIAL_PROFILE_VERSION,
): FinancialProfile {
  const next: FinancialProfile = {};
  for (const key of NUMERIC_FIELDS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      next[key] = clampFor(key, v) as never;
    } else if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) {
        next[key] = clampFor(key, n) as never;
      }
    }
  }
  for (const key of BOOLEAN_FIELDS) {
    const v = raw[key];
    if (typeof v === "boolean") {
      next[key] = v as never;
    }
  }
  if (typeof raw.stateOfResidence === "string" && raw.stateOfResidence.length <= 4) {
    next.stateOfResidence = raw.stateOfResidence.toUpperCase();
  }
  if (
    raw.filingStatus === "single" ||
    raw.filingStatus === "mfj" ||
    raw.filingStatus === "mfs" ||
    raw.filingStatus === "hoh" ||
    raw.filingStatus === "qw"
  ) {
    next.filingStatus = raw.filingStatus;
  }
  if (
    raw.estateGoal === "minimize_tax" ||
    raw.estateGoal === "maximize_gift" ||
    raw.estateGoal === "charitable" ||
    raw.estateGoal === "none"
  ) {
    next.estateGoal = raw.estateGoal;
  }
  if (
    raw.businessRole === "new" ||
    raw.businessRole === "exp" ||
    raw.businessRole === "sa" ||
    raw.businessRole === "dir" ||
    raw.businessRole === "md" ||
    raw.businessRole === "rvp" ||
    raw.businessRole === "partner"
  ) {
    next.businessRole = raw.businessRole;
  }
  if (typeof raw.updatedAt === "string") {
    next.updatedAt = raw.updatedAt;
  }
  if (
    raw.source === "user" ||
    raw.source === "quick_quote" ||
    raw.source === "advisor_intake" ||
    raw.source === "csv_import" ||
    raw.source === "api"
  ) {
    next.source = raw.source;
  }
  return next;
}

/** Per-field clamping — keeps UI + engines out of NaN/Infinity country. */
function clampFor(key: keyof FinancialProfile, value: number): number {
  switch (key) {
    case "age":
    case "retirementAge":
      return Math.max(0, Math.min(120, value));
    case "yearsInRetirement":
      return Math.max(0, Math.min(60, value));
    case "dependents":
    case "businessEmployees":
      return Math.max(0, Math.min(200, Math.round(value)));
    case "marginalRate":
      return Math.max(0, Math.min(0.55, value));
    case "equitiesReturn":
      return Math.max(-0.5, Math.min(0.5, value));
    default:
      // Monetary fields — block negatives and absurd sentinels.
      return Math.max(-1_000_000_000, Math.min(1_000_000_000_000, value));
  }
}

/**
 * Merge a patch over an existing profile, bumping updatedAt.
 * Pure — returns a new object; does NOT touch localStorage.
 */
export function mergeProfile(
  current: FinancialProfile,
  patch: Partial<FinancialProfile>,
  source: FinancialProfile["source"] = "user",
): FinancialProfile {
  const merged: FinancialProfile = { ...current, ...patch };
  // Re-sanitize the patched keys through the numeric clamper so
  // callers can shove raw input events in without pre-validating.
  const sanitized = sanitizeProfile(merged as Record<string, unknown>);
  sanitized.updatedAt = new Date().toISOString();
  sanitized.source = source;
  return sanitized;
}

/**
 * Derive a 0..1 completeness score.
 * Core fields count double; everything else is best-effort.
 */
export function profileCompleteness(profile: FinancialProfile): number {
  if (!profile) return 0;
  const core = CORE_COMPLETENESS_FIELDS.filter(
    (k) => profile[k] !== undefined && profile[k] !== null,
  ).length;
  const coreMax = CORE_COMPLETENESS_FIELDS.length;
  const coreScore = coreMax > 0 ? (core / coreMax) * 0.7 : 0;

  const nonCoreKeys: (keyof FinancialProfile)[] = [
    "netWorth",
    "mortgage",
    "debts",
    "stateOfResidence",
    "filingStatus",
    "isBizOwner",
    "hasHomeowner",
    "lifeInsuranceCoverage",
  ];
  const nonCore = nonCoreKeys.filter(
    (k) => profile[k] !== undefined && profile[k] !== null,
  ).length;
  const nonCoreScore =
    nonCoreKeys.length > 0 ? (nonCore / nonCoreKeys.length) * 0.3 : 0;

  return Math.min(1, coreScore + nonCoreScore);
}

/** Describe completeness in a short human label for CTAs. */
export function completenessLabel(pct: number): {
  label: string;
  tone: "empty" | "sparse" | "partial" | "full";
} {
  if (pct <= 0) return { label: "No profile yet", tone: "empty" };
  if (pct < 0.34) return { label: "Just started", tone: "sparse" };
  if (pct < 0.75) return { label: "Partial profile", tone: "partial" };
  return { label: "Profile ready", tone: "full" };
}

/**
 * Shape a profile into the canonical ClientProfile that the wealth-engine
 * router schemas accept. Drops UI-only fields that the server doesn't
 * understand. Returns `{}` on empty input rather than undefined so the
 * caller can safely spread the result into a zod parse.
 */
export function toEngineProfile(
  profile: FinancialProfile,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const engineKeys = [
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
  for (const k of engineKeys) {
    const v = profile[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** Serialize a state object for localStorage write. */
export function serializeProfileState(state: FinancialProfileState): string {
  return JSON.stringify({
    version: FINANCIAL_PROFILE_VERSION,
    profile: state.profile,
  });
}

/**
 * Diff two profiles — returns only the keys that differ.
 * Used by the debug panel + the resume CTA to explain what changed
 * when a user loads a saved profile over in-progress form state.
 */
export function diffProfiles(
  a: FinancialProfile,
  b: FinancialProfile,
): (keyof FinancialProfile)[] {
  const keySet: Record<string, true> = {};
  for (const k of Object.keys(a)) keySet[k] = true;
  for (const k of Object.keys(b)) keySet[k] = true;
  const out: (keyof FinancialProfile)[] = [];
  for (const k of Object.keys(keySet)) {
    const key = k as keyof FinancialProfile;
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) {
      out.push(key);
    }
  }
  return out.sort();
}
