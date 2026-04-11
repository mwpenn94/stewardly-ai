import { describe, it, expect } from "vitest";
import {
  scoreMatch,
  unifiedSearch,
  symbolToResult,
  grepToResult,
  todoToResult,
  groupResults,
} from "./workspaceSearch";
import type { SymbolEntry } from "./symbolIndex";
import type { TodoMarker } from "./todoMarkers";

const sym = (over: Partial<SymbolEntry> = {}): SymbolEntry => ({
  name: "foo",
  kind: "function",
  path: "a.ts",
  line: 1,
  snippet: "function foo()",
  exported: false,
  ...over,
});

const todo = (over: Partial<TodoMarker> = {}): TodoMarker => ({
  kind: "TODO",
  message: "refactor this",
  path: "a.ts",
  line: 10,
  ...over,
});

describe("workspaceSearch — scoreMatch", () => {
  it("returns 100 for an exact match", () => {
    expect(scoreMatch("foo", "foo")).toBe(100);
  });

  it("returns 90 for a prefix match", () => {
    expect(scoreMatch("foobar", "foo")).toBe(90);
  });

  it("returns <=70 for substring matches with position penalty", () => {
    const score = scoreMatch("barfoo", "foo");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(70);
    expect(score).toBeLessThan(scoreMatch("xfoo", "foo"));
  });

  it("returns 30 for subsequence fallback", () => {
    expect(scoreMatch("f_o_o_bar", "foo")).toBe(30);
  });

  it("returns 0 for a miss", () => {
    expect(scoreMatch("zzz", "foo")).toBe(0);
  });

  it("returns 0 for an empty query", () => {
    expect(scoreMatch("anything", "")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(scoreMatch("FooBar", "foo")).toBe(90);
    expect(scoreMatch("BARFOO", "foo")).toBeGreaterThan(0);
  });
});

describe("workspaceSearch — per-source conversion", () => {
  it("symbolToResult returns null on miss", () => {
    expect(symbolToResult(sym({ name: "foo" }), "zzz")).toBeNull();
  });

  it("symbolToResult boosts exported symbols", () => {
    const priv = symbolToResult(sym({ name: "foobar", exported: false }), "fo");
    const pub = symbolToResult(sym({ name: "foobar", exported: true }), "fo");
    expect(pub!.score).toBeGreaterThan(priv!.score);
  });

  it("symbolToResult boosts function/class over const", () => {
    const fn = symbolToResult(sym({ name: "foobar", kind: "function" }), "fo");
    const cn = symbolToResult(sym({ name: "foobar", kind: "const" }), "fo");
    expect(fn!.score).toBeGreaterThan(cn!.score);
  });

  it("grepToResult applies the grep penalty", () => {
    const r = grepToResult({ file: "a.ts", line: 3, text: "foo" }, "foo");
    expect(r).not.toBeNull();
    // exact match = 100, grep penalty -10 = 90
    expect(r!.score).toBe(90);
  });

  it("todoToResult matches message, kind, or author", () => {
    expect(todoToResult(todo({ message: "foo bar" }), "foo")).not.toBeNull();
    expect(todoToResult(todo({ kind: "FIXME" }), "fixme")).not.toBeNull();
    expect(
      todoToResult(todo({ author: "alice", message: "stuff" }), "alice"),
    ).not.toBeNull();
    expect(todoToResult(todo({ message: "nothing" }), "foo")).toBeNull();
  });
});

describe("workspaceSearch — unifiedSearch", () => {
  it("returns empty output for an empty query", () => {
    const out = unifiedSearch({
      query: "",
      symbols: [sym({ name: "foo" })],
    });
    expect(out.results).toHaveLength(0);
    expect(out.facets.total).toBe(0);
  });

  it("merges symbol + grep + todo hits and sorts by score", () => {
    const out = unifiedSearch({
      query: "foo",
      symbols: [
        sym({ name: "foo", path: "x.ts", line: 1, exported: true }),
        sym({ name: "barfoo", path: "y.ts", line: 2 }),
      ],
      grepMatches: [
        { file: "z.ts", line: 9, text: "const foo = 1" },
        { file: "w.ts", line: 12, text: "/* nothing here */" },
      ],
      todos: [
        todo({ message: "fix the foo loop", path: "t.ts", line: 5 }),
      ],
    });
    expect(out.facets.symbols).toBe(2);
    expect(out.facets.grep).toBe(1); // one grep match ignored (no "foo")
    expect(out.facets.todos).toBe(1);
    // The exact exported "foo" symbol should be first
    expect(out.results[0]!.kind).toBe("symbol");
    expect(out.results[0]!.title).toBe("foo");
    // Scores descend
    for (let i = 1; i < out.results.length; i++) {
      expect(out.results[i - 1]!.score).toBeGreaterThanOrEqual(out.results[i]!.score);
    }
  });

  it("respects the kinds filter", () => {
    const out = unifiedSearch({
      query: "foo",
      symbols: [sym({ name: "foo" })],
      grepMatches: [{ file: "z.ts", line: 1, text: "foo" }],
      todos: [todo({ message: "foo" })],
      kinds: ["symbol"],
    });
    expect(out.results.every((r) => r.kind === "symbol")).toBe(true);
    expect(out.facets.symbols).toBe(1);
    expect(out.facets.grep).toBe(0);
    expect(out.facets.todos).toBe(0);
  });

  it("caps per-kind results at perKindLimit", () => {
    const syms = Array.from({ length: 100 }, (_, i) =>
      sym({ name: `foo${i}`, path: `a${i}.ts`, line: i + 1 }),
    );
    const out = unifiedSearch({
      query: "foo",
      symbols: syms,
      perKindLimit: 10,
    });
    expect(out.results.filter((r) => r.kind === "symbol").length).toBe(10);
    expect(out.facets.symbols).toBe(100); // facet counts reflect pre-cap totals
  });

  it("caps total results at totalLimit and marks truncated", () => {
    const syms = Array.from({ length: 80 }, (_, i) =>
      sym({ name: `foo${i}`, path: `a${i}.ts`, line: i + 1 }),
    );
    const greps = Array.from({ length: 80 }, (_, i) => ({
      file: `b${i}.ts`,
      line: i + 1,
      text: "foo here",
    }));
    const out = unifiedSearch({
      query: "foo",
      symbols: syms,
      grepMatches: greps,
      perKindLimit: 40,
      totalLimit: 50,
    });
    expect(out.results.length).toBe(50);
    expect(out.truncated).toBe(true);
  });

  it("tie-breaks by kind then path then line on equal scores", () => {
    const out = unifiedSearch({
      query: "foo",
      symbols: [sym({ name: "foo", path: "b.ts", line: 2 })],
      grepMatches: [{ file: "a.ts", line: 1, text: "foo" }],
    });
    // Symbol score = 100 + boosts, grep score = 90 — symbol wins regardless
    expect(out.results[0]!.kind).toBe("symbol");
  });
});

describe("workspaceSearch — groupResults", () => {
  it("buckets by kind and path", () => {
    const out = unifiedSearch({
      query: "foo",
      symbols: [sym({ name: "foo", path: "a.ts" })],
      grepMatches: [
        { file: "a.ts", line: 5, text: "foo" },
        { file: "b.ts", line: 7, text: "foo" },
      ],
    });
    const grouped = groupResults(out.results);
    expect(grouped.byKind.symbol.length).toBe(1);
    expect(grouped.byKind.grep.length).toBe(2);
    expect(grouped.byPath.get("a.ts")!.length).toBe(2);
    expect(grouped.byPath.get("b.ts")!.length).toBe(1);
  });
});
