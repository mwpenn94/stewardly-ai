/**
 * ThemeContext — Build Loop Pass 4 (G2 / G9 / G51 rewrite)
 *
 * Before: this provider was a tiny toggle between `dark` and `light`, read
 * a localStorage key called `theme` that no UI actually wrote, and
 * defaulted to dark. Meanwhile AppearanceTab.tsx wrote `wb_theme` which
 * this file never read. A user picking "Light" in Settings → Appearance
 * saved successfully and then nothing happened.
 *
 * After: the provider is a thin React wrapper around the pure
 * `appearanceSettings` module. It:
 *   1. Loads settings from localStorage on mount.
 *   2. Applies them to the DOM immediately (prevents FOUC).
 *   3. Subscribes to `prefers-color-scheme` so `theme: "system"` tracks
 *      OS dark-mode toggles live.
 *   4. Exposes the settings + a `setSettings` mutator so consumer
 *      components (AppearanceTab, future user-prefs UIs) can update all
 *      five knobs without reaching into localStorage.
 *
 * Backwards compatible:
 *   - `theme` / `toggleTheme` / `switchable` remain on the context so
 *     existing callers (ThemeToggle buttons, layout components) still
 *     work.
 *   - The default theme prop is honored for stories/snapshots that mount
 *     ThemeProvider in isolation.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAppearanceSettings,
  loadAppearanceSettings,
  saveAppearanceSettings,
  subscribeSystemTheme,
  type AppearanceSettings,
  type ThemePreference,
  DEFAULT_SETTINGS,
} from "@/lib/appearanceSettings";

type Theme = "light" | "dark";

interface ThemeContextType {
  /** Resolved theme (never "system" — for consumers that only care about rendered). */
  theme: Theme;
  /** Raw user preference (can be "system"). */
  preference: ThemePreference;
  /** Toggle dark ↔ light (always switchable now). */
  toggleTheme: () => void;
  /** Set the theme preference explicitly. */
  setTheme: (pref: ThemePreference) => void;
  /** Full appearance settings bag — font-size, density, motion, sidebar. */
  settings: AppearanceSettings;
  /** Update one or more appearance settings. Persists + applies immediately. */
  updateSettings: (patch: Partial<AppearanceSettings>) => void;
  /** Legacy flag — always true now. Kept for API back-compat. */
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Legacy prop — only honored when localStorage has no saved preference. */
  defaultTheme?: Theme;
  /** Legacy prop — ignored; theme is always switchable in Pass 4. */
  switchable?: boolean;
}

function resolveSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children, defaultTheme }: ThemeProviderProps) {
  // Load once on mount. Honor the `defaultTheme` prop as a fallback when
  // localStorage hasn't been populated yet (first-visit users).
  const [settings, setSettings] = useState<AppearanceSettings>(() => {
    const loaded = loadAppearanceSettings();
    // If no localStorage entry exists at all, fall back to the legacy
    // `defaultTheme` prop (dark, per App.tsx).
    if (
      typeof localStorage === "undefined" ||
      localStorage.getItem("wb_theme") === null
    ) {
      return { ...loaded, theme: (defaultTheme as ThemePreference) || DEFAULT_SETTINGS.theme };
    }
    return loaded;
  });

  // Apply on mount + whenever settings change. This is the key fix: the
  // old provider only toggled a `.dark` class with no light-theme
  // equivalent and never touched the other five knobs.
  useEffect(() => {
    applyAppearanceSettings(settings);
  }, [settings]);

  // Subscribe to OS-level dark-mode toggles for the `system` preference.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    return subscribeSystemTheme(() => settingsRef.current);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppearanceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAppearanceSettings(next);
      return next;
    });
  }, []);

  const setTheme = useCallback(
    (pref: ThemePreference) => updateSettings({ theme: pref }),
    [updateSettings],
  );

  const toggleTheme = useCallback(() => {
    // Toggle: if currently system, flip based on the resolved theme.
    setSettings((prev) => {
      let next: ThemePreference;
      if (prev.theme === "dark") next = "light";
      else if (prev.theme === "light") next = "dark";
      else next = resolveSystemPrefersDark() ? "light" : "dark";
      const patched = { ...prev, theme: next };
      saveAppearanceSettings(patched);
      return patched;
    });
  }, []);

  const resolvedTheme: Theme =
    settings.theme === "system"
      ? resolveSystemPrefersDark()
        ? "dark"
        : "light"
      : settings.theme;

  const value = useMemo<ThemeContextType>(
    () => ({
      theme: resolvedTheme,
      preference: settings.theme,
      toggleTheme,
      setTheme,
      settings,
      updateSettings,
      switchable: true,
    }),
    [resolvedTheme, settings, toggleTheme, setTheme, updateSettings],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
