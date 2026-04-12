import { describe, it, expect, afterEach } from "vitest";
import {
  _formatWebSearchEmptyResult,
  getSearchProvider,
  type StructuredSearchResult,
} from "./webSearchTool";

describe("_formatWebSearchEmptyResult", () => {
  it("returns the canonical empty shape with the supplied reason", () => {
    const out = _formatWebSearchEmptyResult("foo bar", "no provider available");
    expect(out.provider).toBe("llm-fallback");
    expect(out.query).toBe("foo bar");
    expect(out.results).toEqual([]);
    expect(out.truncated).toBe(false);
    expect(out.error).toBe("no provider available");
  });

  it("preserves long queries unchanged", () => {
    const long = "a".repeat(1000);
    const out = _formatWebSearchEmptyResult(long, "x");
    expect(out.query).toBe(long);
  });
});

describe("getSearchProvider", () => {
  // Snapshot the env so we can mutate freely.
  const snapshot = { ...process.env };
  afterEach(() => {
    // Reset to snapshot to avoid leaking between tests
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, snapshot);
  });

  it("prefers tavily when its key is set", () => {
    process.env.TAVILY_API_KEY = "test-tavily";
    expect(getSearchProvider()).toBe("tavily");
  });

  it("falls back to brave when only brave is set", () => {
    delete process.env.TAVILY_API_KEY;
    process.env.BRAVE_SEARCH_API_KEY = "test-brave";
    expect(getSearchProvider()).toBe("brave");
  });

  it("falls back to manus-google when forge api key is set", () => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.BRAVE_SEARCH_API_KEY;
    process.env.BUILT_IN_FORGE_API_KEY = "forge";
    expect(getSearchProvider()).toBe("manus-google");
  });

  it("falls back to llm-fallback when no provider env vars are set", () => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    expect(getSearchProvider()).toBe("llm-fallback");
  });
});

describe("StructuredSearchResult shape (TS check)", () => {
  it("compiles a valid StructuredSearchResult literal", () => {
    const x: StructuredSearchResult = {
      provider: "tavily",
      query: "react",
      results: [{ title: "React", url: "https://react.dev", snippet: "" }],
      truncated: false,
    };
    expect(x.provider).toBe("tavily");
  });
});
