/**
 * Tests for the locale preferences store and formatters.
 *
 * Cover parse tolerance, formatter fallbacks, compact-above
 * threshold behavior, percent + number formatting, and the
 * supported-locale/currency registry integrity.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOCALE_PREFERENCES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LOCALES,
  formatCurrency,
  formatNumber,
  formatPercent,
  parseLocalePreferences,
  serializeLocalePreferences,
} from "./localePreferences";

describe("localePreferences / parse", () => {
  it("returns defaults for null", () => {
    expect(parseLocalePreferences(null)).toEqual(DEFAULT_LOCALE_PREFERENCES);
  });

  it("tolerates malformed JSON", () => {
    expect(parseLocalePreferences("{")).toEqual(DEFAULT_LOCALE_PREFERENCES);
  });

  it("tolerates non-object top-level shapes", () => {
    expect(parseLocalePreferences("[]")).toEqual(DEFAULT_LOCALE_PREFERENCES);
    expect(parseLocalePreferences("42")).toEqual(DEFAULT_LOCALE_PREFERENCES);
  });

  it("hydrates a valid preferences object", () => {
    const raw = JSON.stringify({
      locale: "fr-FR",
      currency: "EUR",
      compactAbove: 50000,
    });
    const parsed = parseLocalePreferences(raw);
    expect(parsed.locale).toBe("fr-FR");
    expect(parsed.currency).toBe("EUR");
    expect(parsed.compactAbove).toBe(50000);
  });

  it("uppercases currency codes", () => {
    const raw = JSON.stringify({ currency: "gbp" });
    expect(parseLocalePreferences(raw).currency).toBe("GBP");
  });

  it("falls back on invalid currency length", () => {
    const raw = JSON.stringify({ currency: "DOLLAR" });
    expect(parseLocalePreferences(raw).currency).toBe("USD");
  });

  it("clamps compactAbove to a safe range", () => {
    expect(
      parseLocalePreferences(JSON.stringify({ compactAbove: -100 })).compactAbove,
    ).toBe(0);
    expect(
      parseLocalePreferences(JSON.stringify({ compactAbove: 1e20 })).compactAbove,
    ).toBe(1e12);
  });

  it("drops non-numeric compactAbove", () => {
    const raw = JSON.stringify({ compactAbove: "lots" });
    expect(parseLocalePreferences(raw).compactAbove).toBe(
      DEFAULT_LOCALE_PREFERENCES.compactAbove,
    );
  });
});

describe("localePreferences / formatCurrency", () => {
  it("returns — for NaN/Infinity", () => {
    expect(formatCurrency(Number.NaN)).toBe("—");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("formats a standard number", () => {
    const s = formatCurrency(1234);
    expect(s).toContain("1,234");
    expect(s).toContain("$");
  });

  it("switches to compact above the threshold", () => {
    const s = formatCurrency(1_200_000, DEFAULT_LOCALE_PREFERENCES);
    // Intl compact yields "$1M" (0-digit default) or "$1.2M" (with
    // fraction digits enabled). Either way there must be an "M"
    // suffix and no comma-separated full number.
    expect(s).toContain("M");
    expect(s).not.toContain("1,200,000");
  });

  it("respects an explicit compact override", () => {
    const s = formatCurrency(
      1234,
      DEFAULT_LOCALE_PREFERENCES,
      { compact: true },
    );
    expect(s).not.toContain("1,234");
  });

  it("honors fr-FR / EUR", () => {
    const s = formatCurrency(
      1234,
      { locale: "fr-FR", currency: "EUR", compactAbove: 100_000 },
    );
    // fr-FR groups with narrow no-break spaces, currency symbol often
    // trails. Assert on the presence of the "€" symbol + "1234" digits
    // normalized.
    const normalized = s.replace(/\s/g, "").replace("\u00a0", "");
    expect(normalized).toContain("€");
    expect(normalized).toContain("1234");
  });

  it("falls back on unknown locale without throwing", () => {
    const s = formatCurrency(
      1234,
      { locale: "xx-XX", currency: "USD", compactAbove: 100_000 },
    );
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });
});

describe("localePreferences / formatNumber", () => {
  it("formats integers in en-US", () => {
    expect(formatNumber(1234567)).toMatch(/1,234,567/);
  });

  it("respects digits", () => {
    const s = formatNumber(1.234, DEFAULT_LOCALE_PREFERENCES, 2);
    expect(s).toContain("1.23");
  });

  it("returns — for NaN", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
  });
});

describe("localePreferences / formatPercent", () => {
  it("formats 0.1234 as 12.3% in en-US", () => {
    const s = formatPercent(0.1234);
    expect(s).toContain("12.3");
    expect(s).toContain("%");
  });

  it("uses the requested digit precision", () => {
    const s = formatPercent(0.5678, DEFAULT_LOCALE_PREFERENCES, 2);
    expect(s).toContain("56.78");
  });

  it("returns — for NaN", () => {
    expect(formatPercent(Number.NaN)).toBe("—");
  });
});

describe("localePreferences / registry integrity", () => {
  it("SUPPORTED_CURRENCIES entries have 3-char codes", () => {
    for (const c of SUPPORTED_CURRENCIES) {
      expect(c.code.length).toBe(3);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it("SUPPORTED_LOCALES entries follow the xx-YY pattern", () => {
    for (const l of SUPPORTED_LOCALES) {
      expect(l.code).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(l.label.length).toBeGreaterThan(0);
    }
  });

  it("at least 8 currencies and 10 locales are shipped", () => {
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(8);
    expect(SUPPORTED_LOCALES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("localePreferences / serialize round-trip", () => {
  it("preserves a non-default config", () => {
    const prefs = {
      locale: "de-DE",
      currency: "EUR",
      compactAbove: 50_000,
    };
    const raw = serializeLocalePreferences(prefs);
    const back = parseLocalePreferences(raw);
    expect(back).toEqual(prefs);
  });
});
