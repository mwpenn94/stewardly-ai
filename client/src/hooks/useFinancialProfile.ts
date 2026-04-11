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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

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
 *
 * Pass 4 (G9): when the user is authenticated, the hook also
 * mirrors writes to the server-side `financialProfile.set` tRPC
 * procedure so the profile follows them across devices. The
 * localStorage acts as the L1 cache; the server is the L2 cache.
 * Reads pull from the server on mount once and merge over the
 * local copy if the server value is newer.
 */
export function useFinancialProfile(): UseFinancialProfileResult {
  const { isAuthenticated } = useAuth();
  const [profile, setProfileState] = useState<FinancialProfile>(readFromStorage);

  // Server-side hydration on mount when authenticated. Skips on
  // guest sessions so anonymous users get the local-only experience.
  const serverGet = trpc.financialProfile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
  });
  const serverSet = trpc.financialProfile.set.useMutation();
  const serverDelete = trpc.financialProfile.delete.useMutation();

  // When the server returns a non-null profile, merge it over the
  // local copy. The server's `updatedAt` wins as the tiebreaker so
  // a different-device update overrides stale localStorage.
  const didHydrateRef = useRef(false);
  useEffect(() => {
    if (didHydrateRef.current) return;
    if (!isAuthenticated || !serverGet.data) return;
    const remote = serverGet.data.profile as FinancialProfile | null;
    if (!remote) {
      didHydrateRef.current = true;
      return;
    }
    const localUpdated = profile.updatedAt ? Date.parse(profile.updatedAt) : 0;
    const remoteUpdated = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
    // Prefer the newer of the two
    if (remoteUpdated >= localUpdated) {
      writeToStorage(remote);
      setProfileState(remote);
    }
    didHydrateRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, serverGet.data]);

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
        // Fire-and-forget sync to server when authenticated. The
        // server-side store is idempotent so a missed mutation
        // (e.g., offline) only costs a one-tab divergence until
        // the next save.
        if (isAuthenticated) {
          serverSet.mutate(
            { patch: patch as Record<string, never>, source },
            // Errors are non-fatal — the local copy is still right.
            { onError: () => undefined },
          );
        }
        return next;
      });
    },
    [isAuthenticated, serverSet],
  );

  const replaceProfile = useCallback(
    (next: FinancialProfile, source: FinancialProfile["source"] = "user") => {
      const merged = mergeProfile({}, next, source);
      writeToStorage(merged);
      setProfileState(merged);
      if (isAuthenticated) {
        serverSet.mutate(
          { patch: merged as Record<string, never>, source },
          { onError: () => undefined },
        );
      }
    },
    [isAuthenticated, serverSet],
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
    if (isAuthenticated) {
      serverDelete.mutate(undefined, { onError: () => undefined });
    }
  }, [isAuthenticated, serverDelete]);

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
