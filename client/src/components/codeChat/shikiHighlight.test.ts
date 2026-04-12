/**
 * Tests for shikiHighlight.ts (Pass 207).
 *
 * Only the pure language-normalization helper is tested here —
 * the dynamic shiki import is skipped because loading the full
 * highlighter in a unit test would pull ~1MB of WASM that isn't
 * relevant to the language-mapping logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeLanguage,
  highlightCode,
  setShikiFailureNotifier,
  __resetShikiForTests,
  __setShikiFactoryForTests,
} from "./shikiHighlight";

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

  // Pass v5 #82: expanded bundled language coverage
  it("recognizes Pass v5 #82 languages and aliases", () => {
    expect(normalizeLanguage("dockerfile")).toBe("dockerfile");
    expect(normalizeLanguage("docker")).toBe("dockerfile");
    expect(normalizeLanguage("graphql")).toBe("graphql");
    expect(normalizeLanguage("gql")).toBe("graphql");
    expect(normalizeLanguage("hcl")).toBe("hcl");
    expect(normalizeLanguage("terraform")).toBe("hcl");
    expect(normalizeLanguage("tf")).toBe("hcl");
    expect(normalizeLanguage("prisma")).toBe("prisma");
    expect(normalizeLanguage("proto")).toBe("proto");
    expect(normalizeLanguage("protobuf")).toBe("proto");
    expect(normalizeLanguage("nginx")).toBe("nginx");
    expect(normalizeLanguage("vue")).toBe("vue");
    expect(normalizeLanguage("svelte")).toBe("svelte");
  });
});

// Pass v5 #81: transient failures auto-retry on the next call
describe("shiki retry after failed load", () => {
  beforeEach(() => {
    __resetShikiForTests();
  });
  afterEach(() => {
    setShikiFailureNotifier(null);
    __setShikiFactoryForTests(null);
    __resetShikiForTests();
    vi.restoreAllMocks();
  });

  it("retries after a transient failure and succeeds on the third call", async () => {
    let callCount = 0;
    __setShikiFactoryForTests(async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("transient");
      }
      return {
        codeToHtml: (_code: string, _opts: { lang: string; theme: string }) =>
          `<pre class="stub">ok</pre>`,
      };
    });

    const notifier = vi.fn();
    setShikiFailureNotifier(notifier);

    // First call — fails, highlighter cache reset so next call retries
    const r1 = await highlightCode("const x = 1", "ts");
    expect(r1).toBeNull();

    // Second call — also fails
    const r2 = await highlightCode("const x = 1", "ts");
    expect(r2).toBeNull();

    // Third call — succeeds
    const r3 = await highlightCode("const x = 1", "ts");
    expect(r3).toBe('<pre class="stub">ok</pre>');

    // The shiki factory was attempted 3 times total
    expect(callCount).toBe(3);

    // Failure notifier fired exactly once (one-time per page load)
    expect(notifier).toHaveBeenCalledTimes(1);
  });

  it("stops retrying after MAX_RETRIES consecutive failures", async () => {
    let callCount = 0;
    __setShikiFactoryForTests(async () => {
      callCount++;
      throw new Error("persistent");
    });

    // 5 calls, but only 3 should actually hit the factory
    for (let i = 0; i < 5; i++) {
      const r = await highlightCode("const x = 1", "ts");
      expect(r).toBeNull();
    }
    expect(callCount).toBe(3);
  });
});
