/**
 * Tests for regex playground — Pass 264.
 */

import { describe, it, expect } from "vitest";
import {
  compileRegex,
  sanitizeFlags,
  testRegex,
  applyReplacement,
  PRESET_PATTERNS,
} from "./regexPlayground";

describe("compileRegex", () => {
  it("returns a RegExp on valid input", () => {
    const result = compileRegex("foo", "gi");
    expect("regex" in result).toBe(true);
    if ("regex" in result) {
      expect(result.regex.source).toBe("foo");
      expect(result.regex.flags).toContain("g");
    }
  });

  it("returns an error on invalid pattern", () => {
    const result = compileRegex("[oops", "g");
    expect("error" in result).toBe(true);
  });

  it("returns an error on invalid flag", () => {
    const result = compileRegex("foo", "zzz");
    expect("error" in result).toBe(true);
  });
});

describe("sanitizeFlags", () => {
  it("forces 'g' flag", () => {
    expect(sanitizeFlags("")).toContain("g");
    expect(sanitizeFlags("i")).toContain("g");
  });

  it("drops invalid characters", () => {
    // y is valid (sticky), x and z are not
    const out = sanitizeFlags("gxyz");
    expect(out).toContain("g");
    expect(out).not.toContain("x");
    expect(out).not.toContain("z");
    expect(sanitizeFlags("gim!@#")).toMatch(/^[gim]+$/);
  });

  it("dedupes flags", () => {
    expect(sanitizeFlags("gggi")).toBe("gi");
  });
});

describe("testRegex", () => {
  it("returns empty for no matches", () => {
    const result = testRegex("xyz", "g", "nothing here");
    expect(result.ok).toBe(true);
    expect(result.matches).toEqual([]);
  });

  it("finds simple matches", () => {
    const result = testRegex("foo", "g", "foo bar foo baz foo");
    expect(result.matches).toHaveLength(3);
    expect(result.matches[0].index).toBe(0);
    expect(result.matches[0].value).toBe("foo");
  });

  it("captures numeric groups", () => {
    const result = testRegex("(\\w+)=(\\w+)", "g", "a=1 b=2");
    expect(result.matches[0].groups).toHaveLength(2);
    expect(result.matches[0].groups[0]).toEqual({ name: "$1", value: "a" });
    expect(result.matches[0].groups[1]).toEqual({ name: "$2", value: "1" });
  });

  it("captures named groups", () => {
    const result = testRegex("(?<key>\\w+)=(?<val>\\w+)", "g", "foo=bar");
    const named = result.matches[0].groups.filter((g) => g.name.startsWith("<"));
    expect(named.find((g) => g.name === "<key>")?.value).toBe("foo");
    expect(named.find((g) => g.name === "<val>")?.value).toBe("bar");
  });

  it("returns error for invalid pattern", () => {
    const result = testRegex("[oops", "g", "anything");
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("caps at maxMatches", () => {
    const long = "x".repeat(100);
    const result = testRegex("x", "g", long, { maxMatches: 10 });
    expect(result.matches.length).toBeLessThanOrEqual(10);
  });

  it("handles zero-width matches without infinite loop", () => {
    const result = testRegex("(?=x)", "g", "xxx");
    expect(result.ok).toBe(true);
    // Should terminate
  });
});

describe("applyReplacement", () => {
  it("replaces all matches", () => {
    const result = applyReplacement("foo", "g", "foo bar foo", "baz");
    expect(result.ok).toBe(true);
    expect(result.output).toBe("baz bar baz");
  });

  it("supports numeric backrefs", () => {
    const result = applyReplacement(
      "(\\w+)=(\\w+)",
      "g",
      "a=1 b=2",
      "$2=$1",
    );
    expect(result.output).toBe("1=a 2=b");
  });

  it("returns error on invalid pattern", () => {
    const result = applyReplacement("[oops", "g", "x", "y");
    expect(result.ok).toBe(false);
  });
});

describe("PRESET_PATTERNS", () => {
  it("has a non-empty list", () => {
    expect(PRESET_PATTERNS.length).toBeGreaterThan(5);
  });

  it("every preset compiles cleanly", () => {
    for (const preset of PRESET_PATTERNS) {
      const result = compileRegex(preset.pattern, preset.flags);
      expect("regex" in result).toBe(true);
    }
  });

  it("Email preset matches sample", () => {
    const preset = PRESET_PATTERNS.find((p) => p.name === "Email")!;
    const result = testRegex(preset.pattern, preset.flags, preset.sample ?? "");
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it("UUID preset matches sample", () => {
    const preset = PRESET_PATTERNS.find((p) => p.name === "UUID v4")!;
    const result = testRegex(preset.pattern, preset.flags, preset.sample ?? "");
    expect(result.matches.length).toBe(1);
  });

  it("Semver preset matches sample", () => {
    const preset = PRESET_PATTERNS.find((p) => p.name === "Semver")!;
    const result = testRegex(preset.pattern, preset.flags, preset.sample ?? "");
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it("Hex color preset matches sample", () => {
    const preset = PRESET_PATTERNS.find((p) => p.name === "Hex color")!;
    const result = testRegex(preset.pattern, preset.flags, preset.sample ?? "");
    expect(result.matches.length).toBe(2);
  });
});
