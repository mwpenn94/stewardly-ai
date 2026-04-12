/**
 * useFinancialProfile — Cross-calculator shared financial profile.
 *
 * Provides a unified client-side data layer that planning pages read
 * from and write to, so users don't re-enter the same information
 * across Tax Planning, Estate Planning, Income Projection, Insurance
 * Analysis, etc.
 *
 * Data persists to localStorage under 'stewardly-financial-profile'.
 * Each page reads the profile on mount and can write updated values
 * back. When Page A updates income, Page B picks it up automatically.
 *
 * The profile is a flat record of canonical financial facts — not page
 * inputs. Each planning page maps profile fields to its own input state
 * on mount, and writes back any values the user changed.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { FinancialProfile as SharedFinancialProfile } from "@shared/financialProfile";

const STORAGE_KEY = "stewardly-financial-profile";

/**
 * Extended financial profile — superset of the shared type with
 * additional fields for the more detailed hook-based calculators.
 * Compatible with the shared FinancialProfile through structural subtyping.
 */
export interface FinancialProfile extends SharedFinancialProfile {
  // ─── Demographics ───────────────────────────────────
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  filingStatus?: "single" | "mfj" | "mfs" | "hoh" | "qw";
  isMarried?: boolean;
  stateCode?: string;
  childrenCount?: number;

  // ─── Income ─────────────────────────────────────────
  annualIncome?: number;
  spouseIncome?: number;
  selfEmploymentIncome?: number;
  rentalIncome?: number;
  interestIncome?: number;
  dividendIncome?: number;
  longTermCapGains?: number;

  // ─── Assets & Savings ───────────────────────────────
  portfolioBalance?: number;
  retirementContributions?: number;
  hsaContributions?: number;
  monthlyContribution?: number;
  netWorth?: number;

  // ─── Debt & Housing ─────────────────────────────────
  mortgageBalance?: number;
  otherDebts?: number;

  // ─── Insurance ──────────────────────────────────────
  existingLifeInsurance?: number;
  annualPremiums?: number;

  // ─── Estate ─────────────────────────────────────────
  netEstate?: number;
  lifeInsuranceInEstate?: number;

  // ─── Social Security ────────────────────────────────
  estimatedSSBenefit?: number;

  // ─── Deductions ─────────────────────────────────────
  itemizedDeductions?: number;

  // ─── Education ──────────────────────────────────────
  educationCostPerChild?: number;

  // ─── Retirement Planning ─────────────────────────────
  desiredRetirementIncome?: number;
  yearsInRetirement?: number;
  equitiesReturn?: number;
  marginalRate?: number;

  // ─── Aliases (used by some calculator pages) ────────
  /** Alias for portfolioBalance — used by FinancialPlanning */
  savings?: number;
  /** Alias for monthlyContribution — used by FinancialPlanning */
  monthlySavings?: number;
  /** Alias for currentAge — used by FinancialPlanning */
  age?: number;
  /** Alias for annualIncome — used by some pages */
  income?: number;
  /** Alias for childrenCount — used by some pages */
  dependents?: number;
  /** Alias for mortgageBalance */
  mortgage?: number;
  /** Alias for otherDebts */
  debts?: number;
  /** Alias for stateCode */
  stateOfResidence?: string;
  /** Business owner flag */
  isBizOwner?: boolean;
  /** Business role (BIE feeder) — extends shared type */
  businessRole?: "new" | "exp" | "sa" | "dir" | "md" | "rvp" | "partner";
  /** Business revenue */
  businessRevenue?: number;
  /** Business employee count */
  businessEmployees?: number;
  /** Homeowner flag */
  hasHomeowner?: boolean;
  /** Alias for existingLifeInsurance */
  lifeInsuranceCoverage?: number;

  // ─── Meta ───────────────────────────────────────────
  lastUpdated?: string;
  lastUpdatedBy?: string; // page name that last wrote

  updatedAt?: string;        // alias for lastUpdated

  // ─── Allow arbitrary extra keys for extensibility ───────
  [key: string]: unknown;
}

/** Load profile from localStorage with defensive parsing. */
function loadProfile(): FinancialProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as FinancialProfile;
  } catch {
    return {};
  }
}

/** Save profile to localStorage. */
function saveProfile(profile: FinancialProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/** Compute how complete the profile is (0..1). */
function computeCompleteness(profile: FinancialProfile): number {
  const coreFields: (keyof FinancialProfile)[] = [
    "currentAge", "retirementAge", "annualIncome", "portfolioBalance",
    "filingStatus", "stateCode", "monthlyContribution",
  ];
  const filled = coreFields.filter(k => profile[k] != null).length;
  return coreFields.length > 0 ? filled / coreFields.length : 0;
}

/** Map completeness ratio to a labeled status. */
function completenessStatus(pct: number): { label: string; tone: "empty" | "sparse" | "partial" | "full" } {
  if (pct <= 0) return { label: "No profile yet", tone: "empty" };
  if (pct < 0.34) return { label: "Just started", tone: "sparse" };
  if (pct < 0.75) return { label: "Partial profile", tone: "partial" };
  return { label: "Profile ready", tone: "full" };
}

/**
 * Hook: read/write the shared financial profile.
 *
 * @param pageName — identifier for which page is using the hook
 * (e.g., "tax-planning", "estate-planning"). Optional for read-only consumers.
 *
 * @returns {profile, updateProfile, hasData, hasProfile, completeness, completenessStatus, clearProfile, replaceProfile}
 */
export function useFinancialProfile(pageName: string = "unknown") {
  const [profile, setProfileState] = useState<FinancialProfile>(loadProfile);

  // Reload from localStorage if another tab or page changed it
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setProfileState(loadProfile());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  /** Merge new values into the profile and persist. */
  const updateProfile = useCallback((updates: Partial<FinancialProfile>) => {
    setProfileState(prev => {
      const next = {
        ...prev,
        ...updates,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: pageName ?? "unknown",
      };
      saveProfile(next);
      return next;
    });
  }, [pageName]);

  /** Clear the entire profile. */
  const clearProfile = useCallback(() => {
    setProfileState({});
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  /** Replace the entire profile (for imports/library loads). */
  const replaceProfile = useCallback((newProfile: FinancialProfile) => {
    const stamped = {
      ...newProfile,
      lastUpdated: new Date().toISOString(),
      lastUpdatedBy: pageName ?? "import",
    };
    setProfileState(stamped);
    saveProfile(stamped);
  }, [pageName]);

  /** Whether there is any meaningful data in the profile. */
  const hasData = useMemo(() => {
    const { lastUpdated, lastUpdatedBy, ...rest } = profile;
    return Object.values(rest).some(v => v != null && v !== 0);
  }, [profile]);

  /** Alias for hasData — used by banner components. */
  const hasProfile = hasData;

  /** 0..1 completeness fraction. */
  const completeness = useMemo(() => computeCompleteness(profile), [profile]);

  /** Derive which pages have contributed data. */
  const source = profile.lastUpdatedBy;

  /** Completeness status label. */
  const completenessStatusLabel = useMemo(() => {
    if (completeness >= 80) return 'complete' as const;
    if (completeness >= 40) return 'partial' as const;
    return 'minimal' as const;
  }, [completeness]);

  /** Legacy setter — calls updateProfile with full replacement. */
  const legacySetProfile = useCallback((newProfile?: Partial<FinancialProfile>, _source?: string) => {
    if (newProfile) updateProfile(newProfile);
  }, [updateProfile]);

  return { profile, updateProfile, hasData, clearProfile, source, hasProfile, completeness, completenessStatus: completenessStatusLabel, setProfile: legacySetProfile, replaceProfile };
}

/**
 * Helper: extract a value from the profile with a fallback default.
 * Used by calculator pages to initialize their local state.
 */
export function profileValue<T>(profile: FinancialProfile, key: keyof FinancialProfile, defaultValue: T): T {
  const val = profile[key];
  if (val == null) return defaultValue;
  return val as unknown as T;
}
