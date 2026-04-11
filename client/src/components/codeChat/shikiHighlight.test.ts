/**
 * Tests for shikiHighlight.ts (Pass 207).
 *
 * Only the pure language-normalization helper is tested here —
 * the dynamic shiki import is skipped because loading the full
 * highlighter in a unit test would pull ~1MB of WASM that isn't
 * relevant to the language-mapping logic.
 */

import { describe, it, expect } from "vitest";
import { normalizeLanguage } from "./shikiHighlight";

describe("normalizeLanguage", () => {
  it("returns 'text' for undefined input", () => {
    expect(normalizeLanguage(undefined)).toBe("text");
  });

  it("passes through bundled languages unchanged", () => {
    expect(normalizeLanguage("ts")).toBe("ts");
    expect(normalizeLanguage("tsx")).toBe("tsx");
    expect(normalizeLanguage("json")).toBe("json");
    expect(normalizeLanguage("bash")).toBe("bash");
    expect(normalizeLanguage("python")).toBe("python");
  });

  it("resolves common aliases", () => {
    expect(normalizeLanguage("typescript")).toBe("ts");
    expect(normalizeLanguage("javascript")).toBe("js");
    expect(normalizeLanguage("py")).toBe("python");
    expect(normalizeLanguage("sh")).toBe("bash");
    expect(normalizeLanguage("zsh")).toBe("bash");
    expect(normalizeLanguage("md")).toBe("markdown");
    expect(normalizeLanguage("yml")).toBe("yaml");
    expect(normalizeLanguage("rs")).toBe("rust");
    expect(normalizeLanguage("rb")).toBe("ruby");
  });

  it("returns 'text' for unknown languages", () => {
    expect(normalizeLanguage("cobol")).toBe("text");
    expect(normalizeLanguage("assembly")).toBe("text");
    expect(normalizeLanguage("")).toBe("text");
  });

  it("normalizes case before lookup", () => {
    expect(normalizeLanguage("TypeScript")).toBe("ts");
    expect(normalizeLanguage("PYTHON")).toBe("python");
    expect(normalizeLanguage("Bash")).toBe("bash");
  });
});
