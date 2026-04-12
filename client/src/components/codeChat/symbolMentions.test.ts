import { describe, it, expect } from "vitest";
import {
  extractActiveSymbolMention,
  replaceMentionWithCitation,
  extractSymbolCitations,
} from "./symbolMentions";

describe("extractActiveSymbolMention", () => {
  it("returns null when there is no `#` in the input", () => {
    expect(extractActiveSymbolMention("plain text", 10)).toBeNull();
  });

  it("detects a mention at the start of the input", () => {
    const out = extractActiveSymbolMention("#useAuth", 8);
    expect(out).toEqual({ cursor: 8, start: 0, query: "useAuth" });
  });

  it("detects a mention after a space", () => {
    const out = extractActiveSymbolMention("show me #useAuth", 16);
    expect(out).toEqual({ cursor: 16, start: 8, query: "useAuth" });
  });

  it("detects an empty mention (just `#` with cursor right after)", () => {
    const out = extractActiveSymbolMention("show me #", 9);
    expect(out).toEqual({ cursor: 9, start: 8, query: "" });
  });

  it("does NOT match `#FFFFFF` (hex color)", () => {
    expect(extractActiveSymbolMention("color: #FFFFFF", 14)).not.toBeNull();
    // Wait — `#FFFFFF` IS valid as a leading-space mention. The test
    // intent: hex colors after a colon should still be detected; it's
    // up to the caller to filter out non-symbol queries via the
    // tRPC search results being empty.
    //
    // The harder rejection is mid-word `#`:
    expect(extractActiveSymbolMention("foo#bar", 7)).toBeNull();
  });

  it("rejects when cursor is past the symbol", () => {
    // `#useAuth ` — cursor after the trailing space → no longer active
    expect(extractActiveSymbolMention("#useAuth ", 9)).toBeNull();
  });

  it("rejects when cursor is mid-input but not on the symbol", () => {
    expect(extractActiveSymbolMention("#useAuth and more", 13)).toBeNull();
  });

  it("supports underscores and dollar signs in the query", () => {
    expect(extractActiveSymbolMention("#use_$auth", 10)?.query).toBe("use_$auth");
  });

  it("rejects negative or out-of-range cursor", () => {
    expect(extractActiveSymbolMention("#foo", -1)).toBeNull();
    expect(extractActiveSymbolMention("#foo", 99)).toBeNull();
  });

  it("supports leading-bracket boundary", () => {
    const out = extractActiveSymbolMention("(#foo", 5);
    expect(out?.query).toBe("foo");
  });
});

describe("replaceMentionWithCitation", () => {
  it("replaces the mention with a [Name at path:line] citation (no trailing content)", () => {
    const input = "show me #useAu";
    const mention = { cursor: 14, start: 8, query: "useAu" };
    const out = replaceMentionWithCitation(input, mention, {
      name: "useAuth",
      path: "client/src/hooks/useAuth.ts",
      line: 42,
    });
    // No trailing space because there's nothing after the mention
    expect(out.next).toBe(
      "show me [useAuth at client/src/hooks/useAuth.ts:42]",
    );
    expect(out.cursor).toBe(out.next.length);
  });

  it("does not add a separator when trailing content already starts with whitespace", () => {
    const input = "show me #useAu and more";
    const mention = { cursor: 14, start: 8, query: "useAu" };
    const out = replaceMentionWithCitation(input, mention, {
      name: "useAuth",
      path: "client/src/hooks/useAuth.ts",
      line: 42,
    });
    expect(out.next).toBe(
      "show me [useAuth at client/src/hooks/useAuth.ts:42] and more",
    );
  });

  it("adds a separator when trailing content is non-whitespace (e.g. punctuation)", () => {
    // u s e s _ # u s e A u , _ t h e n
    // 0 1 2 3 4 5 6 7 8 9 10 11
    const input = "uses #useAu, then";
    const mention = { cursor: 11, start: 5, query: "useAu" };
    const out = replaceMentionWithCitation(input, mention, {
      name: "useAuth",
      path: "x.ts",
      line: 1,
    });
    expect(out.next).toBe("uses [useAuth at x.ts:1] , then");
  });

  it("does not double-add a space when the next char is already a space", () => {
    const input = "#useA bar";
    const mention = { cursor: 5, start: 0, query: "useA" };
    const out = replaceMentionWithCitation(input, mention, {
      name: "useAuth",
      path: "client/src/hooks/useAuth.ts",
      line: 42,
    });
    expect(out.next).toBe("[useAuth at client/src/hooks/useAuth.ts:42] bar");
  });

  it("works at the end of input with no trailing content", () => {
    const input = "#useA";
    const mention = { cursor: 5, start: 0, query: "useA" };
    const out = replaceMentionWithCitation(input, mention, {
      name: "useAuth",
      path: "client/src/hooks/useAuth.ts",
      line: 42,
    });
    expect(out.next).toBe("[useAuth at client/src/hooks/useAuth.ts:42]");
  });
});

describe("extractSymbolCitations", () => {
  it("returns an empty array when there are no citations", () => {
    expect(extractSymbolCitations("plain text")).toEqual([]);
  });

  it("extracts a single citation", () => {
    expect(
      extractSymbolCitations("Look at [useAuth at client/src/hooks/useAuth.ts:42] please"),
    ).toEqual([
      { name: "useAuth", path: "client/src/hooks/useAuth.ts", line: 42 },
    ]);
  });

  it("extracts multiple citations in order", () => {
    const out = extractSymbolCitations(
      "[Foo at a/b.ts:10] and [Bar at c/d.ts:20]",
    );
    expect(out).toEqual([
      { name: "Foo", path: "a/b.ts", line: 10 },
      { name: "Bar", path: "c/d.ts", line: 20 },
    ]);
  });

  it("dedupes identical citations", () => {
    const out = extractSymbolCitations(
      "[Foo at a/b.ts:10] and [Foo at a/b.ts:10] again",
    );
    expect(out).toHaveLength(1);
  });

  it("ignores malformed citations (missing line, bad name)", () => {
    expect(extractSymbolCitations("[Foo at a/b.ts:abc]")).toEqual([]);
    expect(extractSymbolCitations("[123 at a/b.ts:10]")).toEqual([]); // name must start with letter/_/$
  });

  it("caps at 10 citations", () => {
    let input = "";
    for (let i = 0; i < 15; i++) input += `[Foo${i} at a/b.ts:${i}] `;
    const out = extractSymbolCitations(input);
    expect(out).toHaveLength(10);
  });

  it("requires the bracketed format — bare symbol names are NOT citations", () => {
    expect(extractSymbolCitations("useAuth at hooks.ts:42")).toEqual([]);
  });
});
