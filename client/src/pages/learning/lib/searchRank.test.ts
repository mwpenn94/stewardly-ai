/**
 * Unit tests for the pure search helpers in `searchRank.ts`.
 *
 * Covers scoring tiers, ranking stability, grouping, highlighting
 * edge cases, and counts summary.
 */
import { describe, it, expect } from "vitest";
import {
  scoreResult,
  rankSearchResults,
  groupByType,
  highlightMatches,
  countsByType,
  type SearchResult,
} from "./searchRank";

const r = (over: Partial<SearchResult> & { title: string }): SearchResult => ({
  type: "definition",
  id: 1,
  snippet: "",
  ...over,
});

// ─── scoreResult ─────────────────────────────────────────────────────────

describe("learning/searchRank — scoreResult tiers", () => {
  it("exact title match ranks highest", () => {
    const exact = scoreResult(r({ title: "Sharpe Ratio" }), "sharpe ratio");
    const prefix = scoreResult(r({ title: "Sharpe Ratio Theory" }), "sharpe ratio");
    expect(exact).toBeGreaterThan(prefix);
  });

  it("prefix match beats word prefix beats substring", () => {
    const prefix = scoreResult(r({ title: "Beta coefficient" }), "beta");
    const word = scoreResult(r({ title: "Levered beta" }), "beta");
    const substring = scoreResult(r({ title: "Alphabeta bot" }), "beta");
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(substring);
  });

  it("title substring beats snippet substring", () => {
    const title = scoreResult(
      r({ title: "Something with beta inside", snippet: "" }),
      "beta",
    );
    const snippet = scoreResult(
      r({ title: "Other", snippet: "some beta here" }),
      "beta",
    );
    expect(title).toBeGreaterThan(snippet);
  });

  it("returns 0 on no match", () => {
    expect(scoreResult(r({ title: "Alpha" }), "beta")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(scoreResult(r({ title: "SHARPE" }), "sharpe")).toBeGreaterThan(0);
    expect(scoreResult(r({ title: "sharpe" }), "SHARPE")).toBeGreaterThan(0);
  });

  it("type bias boosts definitions over flashcards at ties", () => {
    const def = scoreResult(
      { type: "definition", id: 1, title: "foo", snippet: "" },
      "foo",
    );
    const fc = scoreResult(
      { type: "flashcard", id: 1, title: "foo", snippet: "" },
      "foo",
    );
    expect(def).toBeGreaterThan(fc);
  });

  it("empty query returns 0", () => {
    expect(scoreResult(r({ title: "Sharpe" }), "")).toBe(0);
    expect(scoreResult(r({ title: "Sharpe" }), "  ")).toBe(0);
  });
});

// ─── rankSearchResults ──────────────────────────────────────────────────

describe("learning/searchRank — rankSearchResults", () => {
  it("orders by score descending", () => {
    const results: SearchResult[] = [
      { type: "definition", id: 1, title: "Alphabeta bot", snippet: "" },
      { type: "definition", id: 2, title: "Beta coefficient", snippet: "" },
      { type: "definition", id: 3, title: "Levered beta", snippet: "" },
    ];
    const ranked = rankSearchResults(results, "beta");
    expect(ranked.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("drops non-matches", () => {
    const results: SearchResult[] = [
      { type: "definition", id: 1, title: "Alpha", snippet: "" },
      { type: "definition", id: 2, title: "Beta", snippet: "" },
    ];
    const ranked = rankSearchResults(results, "beta");
    expect(ranked.map((r) => r.id)).toEqual([2]);
  });

  it("returns copy of input when query is empty", () => {
    const results: SearchResult[] = [
      { type: "definition", id: 1, title: "Alpha", snippet: "" },
    ];
    const ranked = rankSearchResults(results, "");
    expect(ranked).toEqual(results);
    expect(ranked).not.toBe(results);
  });

  it("is deterministic for tied scores", () => {
    const results: SearchResult[] = [
      { type: "flashcard", id: 5, title: "beta", snippet: "" },
      { type: "definition", id: 10, title: "beta", snippet: "" },
    ];
    const a = rankSearchResults(results, "beta");
    const b = rankSearchResults(results, "beta");
    expect(a.map((r) => `${r.type}:${r.id}`)).toEqual(
      b.map((r) => `${r.type}:${r.id}`),
    );
    // definition wins over flashcard due to type bias
    expect(a[0]!.type).toBe("definition");
  });
});

// ─── groupByType ────────────────────────────────────────────────────────

describe("learning/searchRank — groupByType", () => {
  it("buckets results by type", () => {
    const results: SearchResult[] = [
      { type: "definition", id: 1, title: "a", snippet: "" },
      { type: "flashcard", id: 2, title: "b", snippet: "" },
      { type: "track", id: 3, title: "c", snippet: "" },
      { type: "question", id: 4, title: "d", snippet: "" },
      { type: "formula", id: 5, title: "e", snippet: "" },
    ];
    const g = groupByType(results);
    expect(g.definitions).toHaveLength(1);
    expect(g.flashcards).toHaveLength(1);
    expect(g.tracks).toHaveLength(1);
    expect(g.questions).toHaveLength(1);
    expect(g.other).toHaveLength(1);
  });

  it("preserves within-bucket order", () => {
    const results: SearchResult[] = [
      { type: "definition", id: 3, title: "c", snippet: "" },
      { type: "definition", id: 1, title: "a", snippet: "" },
      { type: "definition", id: 2, title: "b", snippet: "" },
    ];
    const g = groupByType(results);
    expect(g.definitions.map((d) => d.id)).toEqual([3, 1, 2]);
  });

  it("returns empty buckets for empty input", () => {
    const g = groupByType([]);
    expect(g.definitions).toEqual([]);
    expect(g.flashcards).toEqual([]);
    expect(g.tracks).toEqual([]);
    expect(g.questions).toEqual([]);
    expect(g.other).toEqual([]);
  });
});

// ─── highlightMatches ───────────────────────────────────────────────────

describe("learning/searchRank — highlightMatches", () => {
  it("marks single matches", () => {
    const segs = highlightMatches("Sharpe ratio", "sharpe");
    expect(segs.map((s) => s.matched)).toEqual([true, false]);
    expect(segs[0]!.text).toBe("Sharpe");
  });

  it("marks multiple matches", () => {
    const segs = highlightMatches("beta and more beta", "beta");
    expect(segs.filter((s) => s.matched)).toHaveLength(2);
  });

  it("preserves original casing in matches", () => {
    const segs = highlightMatches("Sharpe SHARPE sharpe", "sharpe");
    const matched = segs.filter((s) => s.matched);
    expect(matched.map((s) => s.text)).toEqual(["Sharpe", "SHARPE", "sharpe"]);
  });

  it("returns a single unmarked segment on no match", () => {
    const segs = highlightMatches("nothing here", "beta");
    expect(segs).toEqual([{ text: "nothing here", matched: false }]);
  });

  it("empty query returns single unmarked segment", () => {
    expect(highlightMatches("text", "")).toEqual([{ text: "text", matched: false }]);
    expect(highlightMatches("text", "  ")).toEqual([{ text: "text", matched: false }]);
  });

  it("empty text returns empty array", () => {
    expect(highlightMatches("", "query")).toEqual([]);
  });

  it("handles match at start, middle, and end", () => {
    const start = highlightMatches("beta is a word", "beta");
    expect(start[0]!.matched).toBe(true);

    const middle = highlightMatches("the beta here", "beta");
    expect(middle[0]!.matched).toBe(false);
    expect(middle[1]!.matched).toBe(true);

    const end = highlightMatches("word beta", "beta");
    expect(end[end.length - 1]!.matched).toBe(true);
  });

  it("is case-insensitive but preserves original text", () => {
    const segs = highlightMatches("Some Beta here", "BETA");
    expect(segs[1]!.matched).toBe(true);
    expect(segs[1]!.text).toBe("Beta");
  });
});

// ─── countsByType ───────────────────────────────────────────────────────

describe("learning/searchRank — countsByType", () => {
  it("sums by bucket and total", () => {
    const results: SearchResult[] = [
      { type: "definition", id: 1, title: "a", snippet: "" },
      { type: "definition", id: 2, title: "b", snippet: "" },
      { type: "flashcard", id: 3, title: "c", snippet: "" },
      { type: "track", id: 4, title: "d", snippet: "" },
    ];
    const c = countsByType(groupByType(results));
    expect(c).toEqual({
      definitions: 2,
      flashcards: 1,
      tracks: 1,
      questions: 0,
      total: 4,
    });
  });
});
