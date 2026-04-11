/**
 * Tests for grepMatches.ts (Pass 225).
 */

import { describe, it, expect } from "vitest";
import { extractGrepMatches, groupMatchesByFile } from "./grepMatches";

describe("extractGrepMatches", () => {
  it("returns null for non-grep tools", () => {
    expect(extractGrepMatches("read_file", '{"kind":"read"}')).toBeNull();
    expect(extractGrepMatches(undefined, '{"kind":"grep"}')).toBeNull();
  });

  it("returns null for missing preview", () => {
    expect(extractGrepMatches("grep_search", undefined)).toBeNull();
    expect(extractGrepMatches("grep_search", "")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(extractGrepMatches("grep_search", "{bad json")).toBeNull();
  });

  it("returns null when kind is not grep", () => {
    expect(
      extractGrepMatches(
        "grep_search",
        JSON.stringify({ kind: "read", result: { matches: [] } }),
      ),
    ).toBeNull();
  });

  it("parses a valid grep result", () => {
    const raw = JSON.stringify({
      kind: "grep",
      result: {
        matches: [
          { file: "server/index.ts", line: 42, text: "  getDb()" },
          { file: "server/index.ts", line: 100, text: "  await getDb()" },
          { file: "client/App.tsx", line: 5, text: "  const db = getDb();" },
        ],
        truncated: false,
      },
    });
    const r = extractGrepMatches("grep_search", raw);
    expect(r).not.toBeNull();
    expect(r!.matches).toHaveLength(3);
    expect(r!.truncated).toBe(false);
  });

  it("drops malformed match entries", () => {
    const raw = JSON.stringify({
      kind: "grep",
      result: {
        matches: [
          { file: "a.ts", line: 1, text: "ok" },
          { file: "b.ts" },
          null,
          { file: "c.ts", line: "not-a-number", text: "bad" },
        ],
        truncated: false,
      },
    });
    const r = extractGrepMatches("grep_search", raw);
    expect(r!.matches).toHaveLength(1);
    expect(r!.matches[0].file).toBe("a.ts");
  });

  it("preserves the truncated flag", () => {
    const raw = JSON.stringify({
      kind: "grep",
      result: { matches: [], truncated: true },
    });
    expect(extractGrepMatches("grep_search", raw)!.truncated).toBe(true);
  });
});

describe("groupMatchesByFile", () => {
  it("returns empty array for no matches", () => {
    expect(groupMatchesByFile([])).toEqual([]);
  });

  it("groups by file and sorts matches by line", () => {
    const matches = [
      { file: "b.ts", line: 5, text: "x" },
      { file: "a.ts", line: 10, text: "y" },
      { file: "a.ts", line: 3, text: "z" },
      { file: "b.ts", line: 2, text: "w" },
    ];
    const groups = groupMatchesByFile(matches);
    expect(groups.map((g) => g.file)).toEqual(["a.ts", "b.ts"]);
    expect(groups[0].matches.map((m) => m.line)).toEqual([3, 10]);
    expect(groups[1].matches.map((m) => m.line)).toEqual([2, 5]);
  });

  it("groups a single-file result", () => {
    const matches = [
      { file: "a.ts", line: 1, text: "x" },
      { file: "a.ts", line: 2, text: "y" },
    ];
    expect(groupMatchesByFile(matches)).toEqual([
      {
        file: "a.ts",
        matches: [
          { file: "a.ts", line: 1, text: "x" },
          { file: "a.ts", line: 2, text: "y" },
        ],
      },
    ]);
  });
});
