/**
 * Smoke tests for the pure helper functions in animations.ts.
 * Hooks (useReducedMotion, useCountUp) are exercised indirectly via
 * the React component rendering tests in Phase 4 — these tests
 * lock down the pure utilities the chart components rely on.
 */

import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatPercent,
  linearScale,
  buildLinePath,
  buildSmoothPath,
} from "./animations";

describe("Phase 4A — animation helpers", () => {
  describe("formatCurrency", () => {
    it("formats billions", () => {
      expect(formatCurrency(2_500_000_000)).toBe("$2.5B");
    });
    it("formats millions", () => {
      expect(formatCurrency(2_500_000)).toBe("$2.5M");
    });
    it("formats thousands", () => {
      expect(formatCurrency(2_500)).toBe("$2.5K");
    });
    it("falls back to full Intl format below 1K", () => {
      expect(formatCurrency(750)).toContain("750");
    });
    it("returns em dash for non-finite", () => {
      expect(formatCurrency(NaN)).toBe("—");
      expect(formatCurrency(Infinity)).toBe("—");
    });
  });

  describe("formatCurrencyPrecise", () => {
    it("uses Intl with no decimals", () => {
      expect(formatCurrencyPrecise(1_234_567)).toBe("$1,234,567");
    });
    it("returns em dash for invalid", () => {
      expect(formatCurrencyPrecise(NaN)).toBe("—");
    });
  });

  describe("formatPercent", () => {
    it("formats decimals as percentages", () => {
      expect(formatPercent(0.123)).toBe("12.3%");
    });
    it("respects digit option", () => {
      expect(formatPercent(0.123456, 3)).toBe("12.346%");
    });
  });

  describe("linearScale", () => {
    it("maps domain to range", () => {
      expect(linearScale(5, 0, 10, 0, 100)).toBe(50);
    });
    it("clamps when domain min == max", () => {
      expect(linearScale(5, 5, 5, 0, 100)).toBe(0);
    });
  });

  describe("buildLinePath", () => {
    it("returns empty string for empty input", () => {
      expect(buildLinePath([])).toBe("");
    });
    it("starts with M for first point", () => {
      const d = buildLinePath([
        { x: 0, y: 0 },
        { x: 10, y: 5 },
      ]);
      expect(d).toMatch(/^M0\.00 0\.00 L10\.00 5\.00$/);
    });
  });

  describe("buildSmoothPath", () => {
    it("returns line path for <2 points", () => {
      expect(buildSmoothPath([])).toBe("");
      expect(buildSmoothPath([{ x: 0, y: 0 }])).toBe("M0.00 0.00");
    });
    it("uses Catmull-Rom curves for 3+ points", () => {
      const d = buildSmoothPath([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ]);
      expect(d).toContain("M0.00 0.00");
      expect(d).toContain("C");
    });
  });
});
