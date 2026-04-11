import { describe, it, expect } from "vitest";
import {
  normalizeCalculatorKey,
  pushCalculator,
  parseStorageValue,
  MAX_RECENT_CALCULATORS,
} from "./recentCalculators";

describe("learning/recentCalculators — normalizeCalculatorKey", () => {
  it("trims whitespace and accepts normal keys", () => {
    expect(normalizeCalculatorKey("  rothExplorer ")).toBe("rothExplorer");
    expect(normalizeCalculatorKey("stressTest")).toBe("stressTest");
  });

  it("rejects non-strings", () => {
    expect(normalizeCalculatorKey(null)).toBe(null);
    expect(normalizeCalculatorKey(42)).toBe(null);
    expect(normalizeCalculatorKey({ foo: 1 })).toBe(null);
    expect(normalizeCalculatorKey([])).toBe(null);
    expect(normalizeCalculatorKey(undefined)).toBe(null);
  });

  it("rejects empty + whitespace-only strings", () => {
    expect(normalizeCalculatorKey("")).toBe(null);
    expect(normalizeCalculatorKey("   ")).toBe(null);
  });

  it("clamps pathological lengths at 64 chars", () => {
    const r = normalizeCalculatorKey("x".repeat(200));
    expect(r?.length).toBe(64);
  });
});

describe("learning/recentCalculators — pushCalculator", () => {
  it("adds to the front of an empty list", () => {
    expect(pushCalculator([], "rothExplorer")).toEqual(["rothExplorer"]);
  });

  it("adds to the front of an existing list", () => {
    expect(pushCalculator(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("dedupes an existing entry and moves it to the front", () => {
    expect(pushCalculator(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    expect(pushCalculator(["stressTest", "rothExplorer"], "rothExplorer")).toEqual([
      "rothExplorer",
      "stressTest",
    ]);
  });

  it("is pure — does not mutate the input", () => {
    const input = ["a", "b"];
    const out = pushCalculator(input, "c");
    expect(input).toEqual(["a", "b"]);
    expect(out).not.toBe(input);
  });

  it("drops invalid inputs and returns a copy", () => {
    const input = ["a"];
    const out = pushCalculator(input, null);
    expect(out).toEqual(["a"]);
    expect(out).not.toBe(input);
  });

  it("clamps to MAX_RECENT_CALCULATORS", () => {
    const existing = ["k1", "k2", "k3", "k4", "k5", "k6", "k7", "k8", "k9", "k10"];
    const out = pushCalculator(existing, "k11");
    expect(out.length).toBe(MAX_RECENT_CALCULATORS);
    expect(out[0]).toBe("k11");
    expect(out[out.length - 1]).toBe("k9"); // k10 should have been dropped
  });
});

describe("learning/recentCalculators — parseStorageValue", () => {
  it("returns empty on null/undefined/empty", () => {
    expect(parseStorageValue(null)).toEqual([]);
    expect(parseStorageValue(undefined)).toEqual([]);
    expect(parseStorageValue("")).toEqual([]);
  });

  it("returns empty on malformed JSON", () => {
    expect(parseStorageValue("{not valid")).toEqual([]);
    expect(parseStorageValue("undefined")).toEqual([]);
  });

  it("returns empty on non-array JSON", () => {
    expect(parseStorageValue('{"foo":"bar"}')).toEqual([]);
    expect(parseStorageValue('"just a string"')).toEqual([]);
    expect(parseStorageValue("42")).toEqual([]);
  });

  it("parses a valid string array", () => {
    expect(parseStorageValue('["a","b"]')).toEqual(["a", "b"]);
  });

  it("drops non-string entries silently", () => {
    expect(parseStorageValue('["a",42,null,"b"]')).toEqual(["a", "b"]);
  });

  it("caps to MAX_RECENT_CALCULATORS entries", () => {
    const huge = Array.from({ length: 50 }, (_, i) => `k${i}`);
    const raw = JSON.stringify(huge);
    const out = parseStorageValue(raw);
    expect(out.length).toBe(MAX_RECENT_CALCULATORS);
    expect(out[0]).toBe("k0");
  });
});
