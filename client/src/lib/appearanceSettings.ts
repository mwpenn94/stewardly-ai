/**
 * appearanceSettings.ts — Single source of truth for user appearance preferences.
 *
 * Build Loop Pass 4 (G2 / G9 / G51). Prior to this module, `AppearanceTab.tsx`
 * wrote 6 `wb_*` localStorage keys that NOTHING read:
 *   - wb_theme (dark | light | system)
 *   - wb_font_size (compact | default | comfortable | large)
 *   - wb_chat_density (slider 1-3)
 *   - wb_reduced_motion (boolean)
 *   - wb_sidebar_compact (boolean) — read as "appshell-collapsed" in AppShell
 *   - wb_accent_color (sky | emerald | violet | ...) — doesn't exist in theme
 *
 * This was a Potemkin UI: users clicked Save, saw a success toast, and
 * nothing changed. G51 called it "a user-customization surface that lies
 * to users."
 *
 * Pass 4 fix: this module reads, writes, and *applies* the settings.
 * `applyAppearanceSettings(s)` is a pure DOM effect that toggles body/html
 * classes — it's idempotent, safe to call repeatedly, and has a matching
 * pure-function helper `computeBodyClassList(s)` for unit testing.
 *
 * The module is intentionally standalone (no React) so it can also be
 * imported from an app-boot script to eliminate the FOUC between initial
 * render and first effect.
 */

export type ThemePreference = "dark" | "light" | "system";
export type FontScale = "compact" | "default" | "comfortable" | "large" | "xlarge";
export type ChatDensity = "compact" | "default" | "spacious";

export interface AppearanceSettings {
  theme: ThemePreference;
  fontScale: FontScale;
  chatDensity: ChatDensity;
  reducedMotion: boolean;
  sidebarCompact: boolean;
}

export const DEFAULT_SETTINGS: AppearanceSettings = {
  theme: "system",
  fontScale: "default",
  chatDensity: "default",
  reducedMotion: false,
  sidebarCompact: false,
};

/* ── localStorage keys (stable) ────────────────────────────────── */

const KEYS = {
  theme: "wb_theme",
  fontScale: "wb_font_size",
  chatDensity: "wb_chat_density",
  reducedMotion: "wb_reduced_motion",
  sidebarCompact: "wb_sidebar_compact",
  // Legacy: AppShell uses "appshell-collapsed" — we keep both in sync on save.
  sidebarLegacy: "appshell-collapsed",
} as const;

/* ── pure helpers ──────────────────────────────────────────────── */

function validTheme(v: string | null): ThemePreference {
  if (v === "dark" || v === "light" || v === "system") return v;
  return DEFAULT_SETTINGS.theme;
}

function validFontScale(v: string | null): FontScale {
  if (
    v === "compact" ||
    v === "default" ||
    v === "comfortable" ||
    v === "large" ||
    v === "xlarge"
  ) {
    return v;
  }
  return DEFAULT_SETTINGS.fontScale;
}

function validChatDensity(v: string | null): ChatDensity {
  if (v === "compact" || v === "default" || v === "spacious") return v;
  // Legacy numeric: "1" → compact, "2" → default, "3" → spacious
  if (v === "1") return "compact";
  if (v === "2") return "default";
  if (v === "3") return "spacious";
  return DEFAULT_SETTINGS.chatDensity;
}

/**
 * Pure function — compute the body class list that should be applied for
 * a given settings object. Exported for tests.
 *
 * Returns an object instead of a string so the caller can diff / dedupe
 * without re-parsing.
 */
export function computeBodyClassList(
  s: AppearanceSettings,
  systemPrefersDark: boolean,
): {
  classes: string[];
  themeClass: "dark" | "light";
} {
  const themeClass: "dark" | "light" =
    s.theme === "system" ? (systemPrefersDark ? "dark" : "light") : s.theme;

  const classes: string[] = [];
  classes.push(themeClass);
  classes.push(`font-scale-${s.fontScale}`);
  classes.push(`chat-density-${s.chatDensity}`);
  if (s.reducedMotion) classes.push("reduced-motion-user");
  if (s.sidebarCompact) classes.push("sidebar-compact");

  return { classes, themeClass };
}

/* ── localStorage IO ───────────────────────────────────────────── */

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    return {
      theme: validTheme(localStorage.getItem(KEYS.theme)),
      fontScale: validFontScale(localStorage.getItem(KEYS.fontScale)),
      chatDensity: validChatDensity(localStorage.getItem(KEYS.chatDensity)),
      reducedMotion: localStorage.getItem(KEYS.reducedMotion) === "true",
      sidebarCompact:
        localStorage.getItem(KEYS.sidebarCompact) === "true" ||
        localStorage.getItem(KEYS.sidebarLegacy) === "true",
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppearanceSettings(s: AppearanceSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEYS.theme, s.theme);
    localStorage.setItem(KEYS.fontScale, s.fontScale);
    localStorage.setItem(KEYS.chatDensity, s.chatDensity);
    localStorage.setItem(KEYS.reducedMotion, String(s.reducedMotion));
    localStorage.setItem(KEYS.sidebarCompact, String(s.sidebarCompact));
    // Keep the legacy AppShell key in sync so existing code path still works.
    localStorage.setItem(KEYS.sidebarLegacy, String(s.sidebarCompact));
  } catch {
    /* private mode — ignore */
  }
}

/* ── DOM effect ────────────────────────────────────────────────── */

const ALL_MANAGED_CLASSES = [
  "dark",
  "light",
  "font-scale-compact",
  "font-scale-default",
  "font-scale-comfortable",
  "font-scale-large",
  "font-scale-xlarge",
  "chat-density-compact",
  "chat-density-default",
  "chat-density-spacious",
  "reduced-motion-user",
  "sidebar-compact",
];

/**
 * Apply settings to the live DOM. Idempotent — removes any stale managed
 * class before re-adding the current set. Safe to call on mount AND on
 * every settings mutation.
 *
 * The `dark` / `light` class goes on `documentElement` (matches the
 * existing ThemeProvider convention); the font-scale / chat-density /
 * reduced-motion classes go on `body` (they're scoped by the CSS rules
 * that way).
 */
export function applyAppearanceSettings(
  s: AppearanceSettings,
  win: (Window & typeof globalThis) | undefined = typeof window !== "undefined" ? window : undefined,
): void {
  if (!win) return;
  const doc = win.document;
  const systemPrefersDark = !!win.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const { classes, themeClass } = computeBodyClassList(s, systemPrefersDark);

  // Theme class on <html>
  doc.documentElement.classList.remove("dark", "light");
  doc.documentElement.classList.add(themeClass);

  // Body-scoped classes
  const body = doc.body;
  if (!body) return;
  for (const cls of ALL_MANAGED_CLASSES) {
    // Skip theme classes here — they're on <html>, not body.
    if (cls === "dark" || cls === "light") continue;
    body.classList.remove(cls);
  }
  for (const cls of classes) {
    if (cls === "dark" || cls === "light") continue;
    body.classList.add(cls);
  }
}

/**
 * Subscribe to OS-level `prefers-color-scheme` changes for the `system`
 * theme mode. Call this once on app boot; returns an unsubscribe fn.
 * When the user has picked `system` and the OS toggles dark ↔ light, the
 * DOM automatically follows.
 */
export function subscribeSystemTheme(
  getSettings: () => AppearanceSettings,
  win: (Window & typeof globalThis) | undefined = typeof window !== "undefined" ? window : undefined,
): () => void {
  if (!win || !win.matchMedia) return () => {};
  const mq = win.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    const s = getSettings();
    if (s.theme === "system") {
      applyAppearanceSettings(s, win);
    }
  };
  try {
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  } catch {
    // Safari <14 fallback
    mq.addListener?.(handler);
    return () => mq.removeListener?.(handler);
  }
}
