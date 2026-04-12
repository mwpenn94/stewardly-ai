/**
 * Financial Profile Validators — pure per-field and cross-field
 * validators that calculators use to verify user input BEFORE
 * writing to the shared profile.
 *
 * The shared store's `sanitizeProfile` already clamps numerics
 * and drops unknowns, but sanitization is *silent*: a user who
 * enters "$200,000" as age sees it silently become 120 and may
 * never know. These validators let the UI surface the problem
 * explicitly so the user can correct it.
 *
 * Split from `sanitizeProfile` on purpose — sanitization is the
 * last-line defense for corrupted data; validation is the
 * first-line nudge for user-facing forms.
 *
 * Pass 14 history: ships gap G19 (build-found).
 */

import type { FinancialProfile } from "@shared/financialProfile";

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  field: keyof FinancialProfile | "_cross";
  severity: ValidationSeverity;
  message: string;
}

// ─── Per-field validators ───────────────────────────────────────────────

export interface FieldRule {
  validate: (value: unknown, profile: FinancialProfile) => ValidationIssue | null;
}

/** Validate a single numeric field against a min/max range. */
export function rangeRule(
  field: keyof FinancialProfile,
  opts: { min?: number; max?: number; label?: string } = {},
): FieldRule {
  return {
    validate: (value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }
      const label = opts.label ?? String(field);
      if (opts.min !== undefined && value < opts.min) {
        return {
          field,
          severity: "error",
          message: `${label} must be at least ${opts.min}`,
        };
      }
      if (opts.max !== undefined && value > opts.max) {
        return {
          field,
          severity: "error",
          message: `${label} must be at most ${opts.max}`,
        };
      }
      return null;
    },
  };
}

/** Require a field to be present. */
export function requiredRule(
  field: keyof FinancialProfile,
  label?: string,
): FieldRule {
  return {
    validate: (value) => {
      const present =
        value !== undefined &&
        value !== null &&
        !(typeof value === "number" && !Number.isFinite(value)) &&
        !(typeof value === "string" && value.trim() === "");
      if (present) return null;
      return {
        field,
        severity: "error",
        message: `${label ?? String(field)} is required`,
      };
    },
  };
}

// ─── Cross-field validators ────────────────────────────────────────────

/** Require retirementAge > age + 1. */
export function retirementAfterAgeRule(): FieldRule {
  return {
    validate: (_v, profile) => {
      if (profile.age === undefined || profile.retirementAge === undefined) {
        return null;
      }
      if (profile.retirementAge <= profile.age) {
        return {
          field: "_cross",
          severity: "error",
          message: "Retirement age must be greater than current age",
        };
      }
      if (profile.retirementAge - profile.age < 2) {
        return {
          field: "_cross",
          severity: "warning",
          message: "Less than 2 years until retirement — switch to decumulation planning",
        };
      }
      return null;
    },
  };
}

/** Warn when savings > 10x income (likely unit error). */
export function savingsToIncomeSanityRule(): FieldRule {
  return {
    validate: (_v, profile) => {
      if (
        profile.savings === undefined ||
        profile.income === undefined ||
        profile.income === 0
      ) {
        return null;
      }
      if (profile.savings > profile.income * 50) {
        return {
          field: "_cross",
          severity: "warning",
          message:
            "Savings is 50× income — did you enter a unit error (millions vs thousands)?",
        };
      }
      return null;
    },
  };
}

/** Warn when mortgage > net worth (underwater). */
export function mortgageNetWorthRule(): FieldRule {
  return {
    validate: (_v, profile) => {
      if (profile.mortgage === undefined || profile.netWorth === undefined) {
        return null;
      }
      if (profile.mortgage > profile.netWorth && profile.netWorth > 0) {
        return {
          field: "_cross",
          severity: "warning",
          message:
            "Mortgage balance exceeds net worth — protection planning is a priority",
        };
      }
      return null;
    },
  };
}

/** Info-level reminder when marginalRate is unset but income is known. */
export function marginalRateReminderRule(): FieldRule {
  return {
    validate: (_v, profile) => {
      if (profile.income === undefined) return null;
      if (profile.marginalRate !== undefined) return null;
      return {
        field: "marginalRate",
        severity: "info",
        message: "Set marginal tax rate for more accurate tax projection",
      };
    },
  };
}

// ─── Validator bundles ──────────────────────────────────────────────────

/** Standard set of rules every calculator should run. */
export function standardRules(): Array<{
  field: keyof FinancialProfile | "_cross";
  rule: FieldRule;
}> {
  return [
    { field: "age", rule: rangeRule("age", { min: 0, max: 120, label: "Age" }) },
    {
      field: "retirementAge",
      rule: rangeRule("retirementAge", { min: 30, max: 100, label: "Retirement age" }),
    },
    {
      field: "income",
      rule: rangeRule("income", { min: 0, max: 100_000_000, label: "Income" }),
    },
    {
      field: "savings",
      rule: rangeRule("savings", { min: 0, max: 1_000_000_000, label: "Savings" }),
    },
    {
      field: "dependents",
      rule: rangeRule("dependents", { min: 0, max: 50, label: "Dependents" }),
    },
    {
      field: "marginalRate",
      rule: rangeRule("marginalRate", { min: 0, max: 0.55, label: "Marginal rate" }),
    },
    { field: "_cross", rule: retirementAfterAgeRule() },
    { field: "_cross", rule: savingsToIncomeSanityRule() },
    { field: "_cross", rule: mortgageNetWorthRule() },
    { field: "marginalRate", rule: marginalRateReminderRule() },
  ];
}

/**
 * Run every rule over a profile and return the aggregated issues.
 * Dedupes issues by (field, message) so the same cross-field rule
 * doesn't fire twice.
 */
export function validateProfile(
  profile: FinancialProfile,
  rules: Array<{
    field: keyof FinancialProfile | "_cross";
    rule: FieldRule;
  }> = standardRules(),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const { field, rule } of rules) {
    const value =
      field === "_cross"
        ? undefined
        : (profile[field as keyof FinancialProfile] as unknown);
    const issue = rule.validate(value, profile);
    if (!issue) continue;
    const key = `${issue.field}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  return issues;
}

/** True iff the profile has no error-severity issues. */
export function profileIsValid(profile: FinancialProfile): boolean {
  return !validateProfile(profile).some((i) => i.severity === "error");
}

/** Return counts grouped by severity for a quick badge. */
export function validationSummary(
  issues: ValidationIssue[],
): { errors: number; warnings: number; infos: number } {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const i of issues) {
    if (i.severity === "error") errors++;
    else if (i.severity === "warning") warnings++;
    else infos++;
  }
  return { errors, warnings, infos };
}
