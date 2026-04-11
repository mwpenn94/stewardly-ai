/**
 * useFinancialProfile — React binding for the shared financial profile
 * store in `@/stores/financialProfile`.
 *
 * Gives any calculator, quick-quote wizard, or planning page a single
 * hook to read, patch, reset, and subscribe to the client's financial
 * profile. Backed by localStorage with cross-tab sync via the
 * `storage` event so a two-tab user sees consistent values everywhere.
 *
 * Pure by design: no network, no tRPC, no side effects beyond
 * localStorage. A future pass can add optional DB persistence by
 * wrapping this hook with a mutation on save.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_PROFILE,
  FINANCIAL_PROFILE_STORAGE_KEY,
  type FinancialProfile,
  mergeProfile,
  parseFinancialProfile,
  profileCompleteness,
  completenessLabel,
  serializeProfileState,
  toEngineProfile,
} from "@/stores/financialProfile";

function readFromStorage(): FinancialProfile {
  if (typeof window === "undefined") return { ...EMPTY_PROFILE };
  try {
    const raw = window.localStorage.getItem(FINANCIAL_PROFILE_STORAGE_KEY);
    return parseFinancialProfile(raw).profile;
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

function writeToStorage(profile: FinancialProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FINANCIAL_PROFILE_STORAGE_KEY,
      serializeProfileState({ version: 1, profile }),
    );
  } catch {
    // quota full / private mode — silently drop; in-memory state is
    // still live for the rest of this tab.
  }
}

export interface UseFinancialProfileResult {
  /** The current profile. Empty object when nothing is saved yet. */
  profile: FinancialProfile;
  /** Patch the profile — merges over existing values and persists. */
  setProfile: (
    patch: Partial<FinancialProfile>,
    source?: FinancialProfile["source"],
  ) => void;
  /** Replace the profile wholesale with a new sanitized value. */
  replaceProfile: (
    next: FinancialProfile,
    source?: FinancialProfile["source"],
  ) => void;
  /** Reset to empty + clear localStorage. */
  resetProfile: () => void;
  /** 0..1 score of how "filled in" the profile is. */
  completeness: number;
  /** Human-friendly label for the completeness score. */
  completenessStatus: { label: string; tone: "empty" | "sparse" | "partial" | "full" };
  /** Canonical shape for feeding into wealth-engine tRPC procedures. */
  engineProfile: Record<string, unknown>;
  /** True iff the profile has at least one core field populated. */
  hasProfile: boolean;
}

/**
 * React hook binding for the shared financial profile store.
 * Components can use `profile` directly in JSX, call `setProfile` on
 * form events, and render a "Profile ready / partial / empty" chip
 * from `completenessStatus`.
 */
export function useFinancialProfile(): UseFinancialProfileResult {
  const [profile, setProfileState] = useState<FinancialProfile>(readFromStorage);

  // Cross-tab sync via the storage event
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== FINANCIAL_PROFILE_STORAGE_KEY) return;
      try {
        setProfileState(parseFinancialProfile(e.newValue).profile);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setProfile = useCallback(
    (patch: Partial<FinancialProfile>, source: FinancialProfile["source"] = "user") => {
      setProfileState((prev) => {
        const next = mergeProfile(prev, patch, source);
        writeToStorage(next);
        return next;
      });
    },
    [],
  );

  const replaceProfile = useCallback(
    (next: FinancialProfile, source: FinancialProfile["source"] = "user") => {
      const merged = mergeProfile({}, next, source);
      writeToStorage(merged);
      setProfileState(merged);
    },
    [],
  );

  const resetProfile = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(FINANCIAL_PROFILE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setProfileState({});
  }, []);

  const completeness = useMemo(() => profileCompleteness(profile), [profile]);
  const completenessStatus = useMemo(() => completenessLabel(completeness), [completeness]);
  const engineProfile = useMemo(() => toEngineProfile(profile), [profile]);
  const hasProfile = useMemo(
    () =>
      profile.age !== undefined ||
      profile.income !== undefined ||
      profile.savings !== undefined,
    [profile],
  );

  return {
    profile,
    setProfile,
    replaceProfile,
    resetProfile,
    completeness,
    completenessStatus,
    engineProfile,
    hasProfile,
  };
}
