/**
 * Shared financial profile primitives — used by BOTH the client store
 * (`client/src/stores/financialProfile.ts`) and the server-side
 * persistence layer (`server/services/financialProfile/store.ts`).
 *
 * The shape is intentionally tolerant: every field is optional and
 * unknown keys are dropped on the way in. This module is the
 * authoritative source for sanitization, clamping, and the merge
 * semantics that keep client + server in sync.
 *
 * Pass 4 history: extracted from client/src/stores/financialProfile.ts
 * so the new server router (G9) can use the same code path.
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

  // Scores
  protectionScore?: number;  // 0-100, from FinancialProtectionScore questionnaire
  riskToleranceScore?: number;  // 0-5, from ClientOnboarding risk assessment

  // Meta
  updatedAt?: string;
  source?: "user" | "quick_quote" | "advisor_intake" | "csv_import" | "api";
}

export interface FinancialProfileState {
  version: number;
  profile: FinancialProfile;
}

export const FINANCIAL_PROFILE_VERSION = 1;
export const FINANCIAL_PROFILE_STORAGE_KEY = "stewardly_financial_profile";

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

const CORE_COMPLETENESS_FIELDS: (keyof FinancialProfile)[] = [
  "age",
  "income",
  "savings",
  "monthlySavings",
  "dependents",
  "marginalRate",
];

export const EMPTY_PROFILE: FinancialProfile = Object.freeze({});

/**
 * Defensive parse — tolerates malformed JSON, unknown schema versions,
 * and non-object top-level shapes by falling back to the empty profile.
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
  const rawProfile =
    obj.profile && typeof obj.profile === "object" && !Array.isArray(obj.profile)
      ? (obj.profile as Record<string, unknown>)
      : {};
  return {
    version: FINANCIAL_PROFILE_VERSION,
    profile: sanitizeProfile(rawProfile),
  };
}

export function sanitizeProfile(
  raw: Record<string, unknown>,
): FinancialProfile {
  const next: FinancialProfile = {};
  for (const key of NUMERIC_FIELDS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      (next as Record<string, unknown>)[key] = clampFor(key, v);
    } else if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) {
        (next as Record<string, unknown>)[key] = clampFor(key, n);
      }
    }
  }
  for (const key of BOOLEAN_FIELDS) {
    const v = raw[key];
    if (typeof v === "boolean") {
      (next as Record<string, unknown>)[key] = v;
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
      return Math.max(-1_000_000_000, Math.min(1_000_000_000_000, value));
  }
}

export function mergeProfile(
  current: FinancialProfile,
  patch: Partial<FinancialProfile>,
  source: FinancialProfile["source"] = "user",
): FinancialProfile {
  const merged: FinancialProfile = { ...current, ...patch };
  const sanitized = sanitizeProfile(merged as Record<string, unknown>);
  sanitized.updatedAt = new Date().toISOString();
  sanitized.source = source;
  return sanitized;
}

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

export function completenessLabel(pct: number): {
  label: string;
  tone: "empty" | "sparse" | "partial" | "full";
} {
  if (pct <= 0) return { label: "No profile yet", tone: "empty" };
  if (pct < 0.34) return { label: "Just started", tone: "sparse" };
  if (pct < 0.75) return { label: "Partial profile", tone: "partial" };
  return { label: "Profile ready", tone: "full" };
}

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

export function serializeProfileState(state: FinancialProfileState): string {
  return JSON.stringify({
    version: FINANCIAL_PROFILE_VERSION,
    profile: state.profile,
  });
}

export function diffProfiles(
  a: FinancialProfile,
  b: FinancialProfile,
): (keyof FinancialProfile)[] {
  const keySet: Record<string, true> = {};
  for (const k of Object.keys(a)) keySet[k] = true;
  for (const k of Object.keys(b)) keySet[k] = true;
  const out: (keyof FinancialProfile)[] = [];
  for (const k of Object.keys(keySet)) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) {
      out.push(k as keyof FinancialProfile);
    }
  }
  return out.sort();
}
