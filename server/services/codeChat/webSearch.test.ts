/**
 * Tests for webSearch.ts (Pass 251). Focuses on the pure helpers
 * (normalizeQuery, parseWebSearchBlob, clampSnippet) plus the
 * runWebSearchForCodeChat orchestrator with a stubbed search
 * backend.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeQuery,
  parseWebSearchBlob,
  clampSnippet,
  runWebSearchForCodeChat,
  WebSearchError,
  MAX_QUERY_LENGTH,
  MAX_SNIPPET_LENGTH,
  MAX_RESULTS,
} from "./webSearch";

// ─── normalizeQuery ──────────────────────────────────────────────────────

describe("normalizeQuery", () => {
  it("accepts and trims a plain string", () => {
    expect(normalizeQuery("  hello  ")).toBe("hello");
  });

  it("returns null for empty", () => {
    expect(normalizeQuery("")).toBeNull();
    expect(normalizeQuery("   ")).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery(42)).toBeNull();
    expect(normalizeQuery({})).toBeNull();
  });

  it("strips control characters", () => {
    expect(normalizeQuery("hello\u0000world")).toBe("hello world");
    expect(normalizeQuery("foo\u0007bar")).toBe("foo bar");
  });

  it("caps length at MAX_QUERY_LENGTH", () => {
    const long = "x".repeat(MAX_QUERY_LENGTH + 50);
    const out = normalizeQuery(long);
    expect(out?.length).toBe(MAX_QUERY_LENGTH);
  });
});

// ─── clampSnippet ────────────────────────────────────────────────────────

describe("clampSnippet", () => {
  it("passes through short strings", () => {
    expect(clampSnippet("hi")).toBe("hi");
  });

  it("clamps at MAX_SNIPPET_LENGTH with ellipsis", () => {
    const long = "a".repeat(MAX_SNIPPET_LENGTH + 100);
    const out = clampSnippet(long);
    expect(out.length).toBe(MAX_SNIPPET_LENGTH);
    expect(out.endsWith("…")).toBe(true);
  });

  it("returns empty string for empty input", () => {
    expect(clampSnippet("")).toBe("");
  });
});

// ─── parseWebSearchBlob ──────────────────────────────────────────────────

describe("parseWebSearchBlob", () => {
  it("returns [] for empty / non-string", () => {
    expect(parseWebSearchBlob("")).toEqual([]);
    // @ts-expect-error — defensive parse
    expect(parseWebSearchBlob(null)).toEqual([]);
  });

  it("parses a single block with title, url, snippet", () => {
    const blob = `**Example Site**\nhttps://example.com/page\nThis is the snippet`;
    const out = parseWebSearchBlob(blob);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      title: "Example Site",
      url: "https://example.com/page",
      snippet: "This is the snippet",
    });
  });

  it("parses multiple blocks separated by blank lines", () => {
    const blob = `**Title A**\nhttps://a.com\nsnippet A\n\n**Title B**\nhttps://b.com\nsnippet B`;
    const out = parseWebSearchBlob(blob);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("Title A");
    expect(out[1].title).toBe("Title B");
  });

  it("joins multi-line snippets into one line", () => {
    const blob = `**T**\nhttps://x.com\nline one\nline two\nline three`;
    const out = parseWebSearchBlob(blob);
    expect(out[0].snippet).toBe("line one line two line three");
  });

  it("handles missing bold markers on title", () => {
    const blob = `No bold title\nhttps://x.com\nsnippet`;
    const out = parseWebSearchBlob(blob);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("No bold title");
  });

  it("handles missing URL gracefully", () => {
    const blob = `**T**\nonly snippet with no url`;
    const out = parseWebSearchBlob(blob);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("");
  });

  it("clamps long snippets", () => {
    const snippet = "x".repeat(MAX_SNIPPET_LENGTH + 200);
    const blob = `**T**\nhttps://x.com\n${snippet}`;
    const out = parseWebSearchBlob(blob);
    expect(out[0].snippet.length).toBe(MAX_SNIPPET_LENGTH);
  });

  it("ignores totally empty blocks", () => {
    const blob = `**A**\nhttps://a.com\ns\n\n\n\n\n**B**\nhttps://b.com\ns2`;
    const out = parseWebSearchBlob(blob);
    expect(out.length).toBe(2);
  });

  it("defaults title when neither bold nor fallback fires", () => {
    const blob = `https://x.com`;
    const out = parseWebSearchBlob(blob);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("(no title)");
    expect(out[0].url).toBe("https://x.com");
  });
});

// ─── runWebSearchForCodeChat ─────────────────────────────────────────────

describe("runWebSearchForCodeChat", () => {
  it("throws BAD_QUERY on empty input", async () => {
    const deps = {
      executeSearchBlob: async () => "",
      getSearchProvider: () => "tavily" as const,
    };
    await expect(runWebSearchForCodeChat("", deps)).rejects.toThrow(
      WebSearchError,
    );
  });

  it("returns structured results when the backend returns a parseable blob", async () => {
    const deps = {
      executeSearchBlob: async () =>
        `**Docs**\nhttps://example.com/docs\nsnippet\n\n**Blog**\nhttps://example.com/blog\nanother snippet`,
      getSearchProvider: () => "tavily" as const,
    };
    const result = await runWebSearchForCodeChat("test query", deps);
    expect(result.provider).toBe("tavily");
    expect(result.results).toHaveLength(2);
    expect(result.results[0].title).toBe("Docs");
    expect(result.fromFallback).toBe(false);
  });

  it("wraps the blob as a fallback hit when parsing fails and the provider is LLM", async () => {
    const deps = {
      executeSearchBlob: async () =>
        "The current prime rate is 8.5% as of April 2026.",
      getSearchProvider: () => "llm-fallback" as const,
    };
    const result = await runWebSearchForCodeChat("prime rate now", deps);
    expect(result.fromFallback).toBe(true);
    // Because there are no blank-line-separated blocks with headers,
    // the parser will wrap the whole blob into a synthetic hit with
    // an empty URL — but only when fromFallback is true. For llm
    // fallback we also accept this wrapping path.
    expect(result.results.length).toBeGreaterThanOrEqual(1);
  });

  it("passes through PROVIDER_FAILED errors", async () => {
    const deps = {
      executeSearchBlob: async () => {
        throw new Error("upstream 500");
      },
      getSearchProvider: () => "tavily" as const,
    };
    try {
      await runWebSearchForCodeChat("hi", deps);
      expect.fail("should throw");
    } catch (err: any) {
      expect(err).toBeInstanceOf(WebSearchError);
      expect(err.code).toBe("PROVIDER_FAILED");
      expect(err.message).toMatch(/upstream 500/);
    }
  });

  it("caps maxResults at MAX_RESULTS", async () => {
    // Construct a blob with 20 results
    const blocks: string[] = [];
    for (let i = 0; i < 20; i++) {
      blocks.push(`**Title ${i}**\nhttps://example.com/${i}\nsnippet ${i}`);
    }
    const deps = {
      executeSearchBlob: async () => blocks.join("\n\n"),
      getSearchProvider: () => "brave" as const,
    };
    const result = await runWebSearchForCodeChat("x", deps, {
      maxResults: 100, // user asked for 100
    });
    expect(result.results.length).toBeLessThanOrEqual(MAX_RESULTS);
  });

  it("respects a smaller maxResults cap", async () => {
    const blocks: string[] = [];
    for (let i = 0; i < 10; i++) {
      blocks.push(`**T${i}**\nhttps://x.com/${i}\ns${i}`);
    }
    const deps = {
      executeSearchBlob: async () => blocks.join("\n\n"),
      getSearchProvider: () => "tavily" as const,
    };
    const result = await runWebSearchForCodeChat("x", deps, { maxResults: 3 });
    expect(result.results).toHaveLength(3);
  });
});
