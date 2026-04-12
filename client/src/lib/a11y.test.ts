/**
 * Tests for the a11y helpers. Pure math + tabbable helpers that
 * don't require a jsdom environment — we test the DOM-dependent
 * bits by building minimal fake elements.
 */

import { describe, it, expect } from "vitest";
import {
  MIN_TOUCH_TARGET_PX,
  WCAG_AA_LARGE,
  WCAG_AA_TEXT,
  contrastRatio,
  isTouchTargetLarge,
  meetsAATextContrast,
  parseHexColor,
  relativeLuminance,
} from "./a11y";

describe("a11y / isTouchTargetLarge", () => {
  it("accepts 44×44", () => {
    expect(isTouchTargetLarge({ width: 44, height: 44 })).toBe(true);
  });

  it("rejects 43×44", () => {
    expect(isTouchTargetLarge({ width: 43, height: 44 })).toBe(false);
  });

  it("rejects 44×43", () => {
    expect(isTouchTargetLarge({ width: 44, height: 43 })).toBe(false);
  });

  it("accepts larger-than-min", () => {
    expect(isTouchTargetLarge({ width: 88, height: 120 })).toBe(true);
  });

  it("exposes the MIN_TOUCH_TARGET_PX constant", () => {
    expect(MIN_TOUCH_TARGET_PX).toBe(44);
  });
});

describe("a11y / parseHexColor", () => {
  it("parses a 6-digit hex", () => {
    expect(parseHexColor("#16A34A")).toEqual({ r: 22, g: 163, b: 74 });
  });

  it("parses a 3-digit hex", () => {
    expect(parseHexColor("#abc")).toEqual({ r: 170, g: 187, b: 204 });
  });

  it("accepts hex without a leading #", () => {
    expect(parseHexColor("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("rejects bad input", () => {
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("not a color")).toBeNull();
    expect(parseHexColor("#gg1122")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
  });
});

describe("a11y / relativeLuminance", () => {
  it("returns 0 for black", () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0, 6);
  });

  it("returns 1 for white", () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 6);
  });

  it("returns ~0.2126 for pure red (matches spec coefficient)", () => {
    expect(relativeLuminance(255, 0, 0)).toBeCloseTo(0.2126, 3);
  });

  it("clamps out-of-range channels", () => {
    expect(relativeLuminance(-50, 400, 128)).toBeCloseTo(
      relativeLuminance(0, 255, 128),
      6,
    );
  });
});

describe("a11y / contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(
      contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }),
    ).toBeCloseTo(21, 0);
  });

  it("returns 1 for identical colors", () => {
    expect(
      contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 }),
    ).toBeCloseTo(1, 6);
  });

  it("is symmetric", () => {
    const a = { r: 100, g: 50, b: 200 };
    const b = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 6);
  });
});

describe("a11y / meetsAATextContrast", () => {
  it("approves black on white", () => {
    expect(meetsAATextContrast("#000000", "#ffffff")).toBe(true);
  });

  it("rejects light gray on white (too low contrast)", () => {
    expect(meetsAATextContrast("#cccccc", "#ffffff")).toBe(false);
  });

  it("approves the stewardship gold on dark bg used in the banner", () => {
    // Warm gold #D4A843 on near-black #0F1419 should clear 4.5:1
    expect(meetsAATextContrast("#D4A843", "#0F1419")).toBe(true);
  });

  it("rejects invalid color strings", () => {
    expect(meetsAATextContrast("not", "black")).toBe(false);
  });
});

describe("a11y / WCAG thresholds", () => {
  it("ships canonical constants", () => {
    expect(WCAG_AA_TEXT).toBe(4.5);
    expect(WCAG_AA_LARGE).toBe(3);
  });
});
