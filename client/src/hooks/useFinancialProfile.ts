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

const STORAGE_KEY = "stewardly-financial-profile";

/** Canonical financial profile — shared across all calculator pages. */
export interface FinancialProfile {
  // ─── Demographics ───────────────────────────────────
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  filingStatus?: "single" | "mfj" | "hoh";
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

  // ─── Meta ───────────────────────────────────────────
  lastUpdated?: string;
  lastUpdatedBy?: string; // page name that last wrote
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

/**
 * Hook: read/write the shared financial profile.
 *
 * @param pageName — identifier for which page is using the hook
 * (e.g., "tax-planning", "estate-planning")
 *
 * @returns {profile, updateProfile, hasData, clearProfile}
 */
export function useFinancialProfile(pageName: string) {
  const [profile, setProfile] = useState<FinancialProfile>(loadProfile);

  // Reload from localStorage if another tab or page changed it
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setProfile(loadProfile());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  /** Merge new values into the profile and persist. */
  const updateProfile = useCallback((updates: Partial<FinancialProfile>) => {
    setProfile(prev => {
      const next = {
        ...prev,
        ...updates,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: pageName,
      };
      saveProfile(next);
      return next;
    });
  }, [pageName]);

  /** Clear the entire profile. */
  const clearProfile = useCallback(() => {
    setProfile({});
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  }, []);

  /** Whether there is any meaningful data in the profile. */
  const hasData = useMemo(() => {
    const { lastUpdated, lastUpdatedBy, ...rest } = profile;
    return Object.values(rest).some(v => v != null && v !== 0);
  }, [profile]);

  /** Derive which pages have contributed data. */
  const source = profile.lastUpdatedBy;

  return { profile, updateProfile, hasData, clearProfile, source };
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
