/**
 * Locale Preferences — user-configurable locale + currency used by
 * the financial calculators. Until pass 13, every calculator
 * assumed USD + en-US + 2026-US tax brackets. This store lets a
 * user select their locale + currency and drops the choice into
 * localStorage so every subsequent render picks it up.
 *
 * Scope (pass 13):
 *
 *   - locale: BCP 47 tag ("en-US", "en-GB", "fr-FR", …)
 *   - currency: ISO 4217 code ("USD", "EUR", "GBP", "CAD", "AUD")
 *   - compactAbove: threshold at which currency formatting drops
 *     the fractional part and switches to K/M/B compact notation.
 *
 * Pure (no React) — the React-side hook is `useLocalePreferences`
 * and calls this module for parsing + writes.
 *
 * Pass 13 history: addresses the i18n/currency gap (new gap G18
 * in PARITY.md).
 */

export interface LocalePreferences {
  locale: string;
  currency: string;
  /** Dollar amount (absolute value) above which we switch to compact
   *  notation ($1.2M instead of $1,200,000). Default 100_000. */
  compactAbove: number;
}

export const LOCALE_PREFERENCES_STORAGE_KEY = "stewardly_locale_prefs";
export const LOCALE_PREFERENCES_VERSION = 1;

export const DEFAULT_LOCALE_PREFERENCES: LocalePreferences = Object.freeze({
  locale: "en-US",
  currency: "USD",
  compactAbove: 100_000,
});

/** Known currencies the picker UI exposes. */
export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$" },
  { code: "INR", label: "Indian Rupee", symbol: "₹" },
] as const;

/** Common locales the picker exposes. */
export const SUPPORTED_LOCALES = [
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-CA", label: "English (Canada)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-IN", label: "English (India)" },
  { code: "fr-FR", label: "Français (France)" },
  { code: "fr-CA", label: "Français (Canada)" },
  { code: "de-DE", label: "Deutsch (Deutschland)" },
  { code: "es-ES", label: "Español (España)" },
  { code: "es-MX", label: "Español (México)" },
  { code: "it-IT", label: "Italiano" },
  { code: "ja-JP", label: "日本語" },
  { code: "zh-CN", label: "简体中文" },
] as const;

/** Pure parse — tolerates malformed JSON, unknown currencies. */
export function parseLocalePreferences(raw: string | null): LocalePreferences {
  if (!raw || typeof raw !== "string") return { ...DEFAULT_LOCALE_PREFERENCES };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_LOCALE_PREFERENCES };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ...DEFAULT_LOCALE_PREFERENCES };
  }
  const obj = parsed as Record<string, unknown>;
  const locale =
    typeof obj.locale === "string" && obj.locale.length >= 2
      ? obj.locale.slice(0, 10)
      : DEFAULT_LOCALE_PREFERENCES.locale;
  const currency =
    typeof obj.currency === "string" && obj.currency.length === 3
      ? obj.currency.toUpperCase()
      : DEFAULT_LOCALE_PREFERENCES.currency;
  const compactAbove =
    typeof obj.compactAbove === "number" && Number.isFinite(obj.compactAbove)
      ? Math.max(0, Math.min(1e12, obj.compactAbove))
      : DEFAULT_LOCALE_PREFERENCES.compactAbove;
  return { locale, currency, compactAbove };
}

export function serializeLocalePreferences(prefs: LocalePreferences): string {
  return JSON.stringify(prefs);
}

// ─── Formatters ────────────────────────────────────────────────────────

/**
 * Locale + currency aware currency formatter. Falls back to the
 * default en-US / USD pair when Intl.NumberFormat throws on an
 * unknown locale or currency code.
 */
export function formatCurrency(
  n: number,
  prefs: LocalePreferences = DEFAULT_LOCALE_PREFERENCES,
  opts: { compact?: boolean; digits?: number } = {},
): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const compact = opts.compact ?? abs >= prefs.compactAbove;
  const digits = opts.digits ?? 0;
  try {
    return new Intl.NumberFormat(prefs.locale, {
      style: "currency",
      currency: prefs.currency,
      maximumFractionDigits: digits,
      notation: compact ? "compact" : "standard",
      compactDisplay: "short",
    }).format(n);
  } catch {
    // Fall back to a minimal format when the locale/currency pair
    // isn't supported in this JS runtime
    return `${prefs.currency} ${n.toLocaleString("en-US", {
      maximumFractionDigits: digits,
    })}`;
  }
}

/** Locale-aware number formatter (no currency). */
export function formatNumber(
  n: number,
  prefs: LocalePreferences = DEFAULT_LOCALE_PREFERENCES,
  digits = 0,
): string {
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(prefs.locale, {
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return n.toLocaleString("en-US", { maximumFractionDigits: digits });
  }
}

/** Locale-aware percent formatter. */
export function formatPercent(
  n: number,
  prefs: LocalePreferences = DEFAULT_LOCALE_PREFERENCES,
  digits = 1,
): string {
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(prefs.locale, {
      style: "percent",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n);
  } catch {
    return `${(n * 100).toFixed(digits)}%`;
  }
}
