/**
 * useLocalePreferences — React binding for the locale preferences
 * store in `@/stores/localePreferences`. Gives every calculator a
 * consistent locale/currency without re-implementing the
 * localStorage glue.
 *
 * Cross-tab sync via the `storage` event — if the user picks EUR
 * in one tab, every other open tab picks it up on the next render.
 *
 * Pass 18 history: ships the React layer for gap G18.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE_PREFERENCES,
  LOCALE_PREFERENCES_STORAGE_KEY,
  type LocalePreferences,
  formatCurrency as fmtCurrency,
  formatNumber as fmtNumber,
  formatPercent as fmtPercent,
  parseLocalePreferences,
  serializeLocalePreferences,
} from "@/stores/localePreferences";

function readFromStorage(): LocalePreferences {
  if (typeof window === "undefined") return { ...DEFAULT_LOCALE_PREFERENCES };
  try {
    return parseLocalePreferences(
      window.localStorage.getItem(LOCALE_PREFERENCES_STORAGE_KEY),
    );
  } catch {
    return { ...DEFAULT_LOCALE_PREFERENCES };
  }
}

function writeToStorage(prefs: LocalePreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCALE_PREFERENCES_STORAGE_KEY,
      serializeLocalePreferences(prefs),
    );
  } catch {
    /* quota full — noop */
  }
}

export interface UseLocalePreferencesResult {
  prefs: LocalePreferences;
  setPrefs: (patch: Partial<LocalePreferences>) => void;
  resetPrefs: () => void;
  formatCurrency: (n: number, opts?: { compact?: boolean; digits?: number }) => string;
  formatNumber: (n: number, digits?: number) => string;
  formatPercent: (n: number, digits?: number) => string;
}

export function useLocalePreferences(): UseLocalePreferencesResult {
  const [prefs, setPrefsState] = useState<LocalePreferences>(() =>
    readFromStorage(),
  );

  // Cross-tab sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key !== LOCALE_PREFERENCES_STORAGE_KEY) return;
      setPrefsState(readFromStorage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setPrefs = useCallback((patch: Partial<LocalePreferences>) => {
    setPrefsState((prev) => {
      const next: LocalePreferences = { ...prev, ...patch };
      // Re-parse through the store's sanitizer so unknown values
      // (e.g., a 4-letter currency code) silently fall back.
      const sanitized = parseLocalePreferences(
        serializeLocalePreferences(next),
      );
      writeToStorage(sanitized);
      return sanitized;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    writeToStorage(DEFAULT_LOCALE_PREFERENCES);
    setPrefsState({ ...DEFAULT_LOCALE_PREFERENCES });
  }, []);

  const formatCurrency = useCallback(
    (n: number, opts?: { compact?: boolean; digits?: number }) =>
      fmtCurrency(n, prefs, opts),
    [prefs],
  );
  const formatNumber = useCallback(
    (n: number, digits = 0) => fmtNumber(n, prefs, digits),
    [prefs],
  );
  const formatPercent = useCallback(
    (n: number, digits = 1) => fmtPercent(n, prefs, digits),
    [prefs],
  );

  return useMemo(
    () => ({
      prefs,
      setPrefs,
      resetPrefs,
      formatCurrency,
      formatNumber,
      formatPercent,
    }),
    [prefs, setPrefs, resetPrefs, formatCurrency, formatNumber, formatPercent],
  );
}
