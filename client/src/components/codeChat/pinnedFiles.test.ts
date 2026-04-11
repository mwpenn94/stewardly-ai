/**
 * Tests for pinnedFiles.ts (Pass 224).
 */

import { describe, it, expect } from "vitest";
import {
  parsePinned,
  addPinned,
  removePinned,
  togglePinned,
  buildMentionsPrefix,
  applyPinnedToMessage,
} from "./pinnedFiles";

describe("parsePinned", () => {
  it("returns empty for null / invalid", () => {
    expect(parsePinned(null)).toEqual([]);
    expect(parsePinned("{bad")).toEqual([]);
    expect(parsePinned('{"not":"array"}')).toEqual([]);
  });
  it("parses a valid array", () => {
    expect(parsePinned('["a.ts","b.ts"]')).toEqual(["a.ts", "b.ts"]);
  });
  it("drops empty / non-string entries", () => {
    expect(parsePinned('["a.ts","",null,42,"b.ts"]')).toEqual(["a.ts", "b.ts"]);
  });
  it("dedupes preserving first-seen order", () => {
    expect(parsePinned('["a.ts","b.ts","a.ts"]')).toEqual(["a.ts", "b.ts"]);
  });
  it("caps at MAX_PINNED_FILES (10)", () => {
    const many = Array.from({ length: 15 }, (_, i) => `f${i}.ts`);
    const parsed = parsePinned(JSON.stringify(many));
    expect(parsed).toHaveLength(10);
  });
});

describe("addPinned", () => {
  it("appends a new path", () => {
    expect(addPinned([], "a.ts")).toEqual(["a.ts"]);
    expect(addPinned(["a.ts"], "b.ts")).toEqual(["a.ts", "b.ts"]);
  });
  it("is a no-op for duplicates", () => {
    expect(addPinned(["a.ts"], "a.ts")).toEqual(["a.ts"]);
  });
  it("refuses empty paths", () => {
    expect(addPinned([], "")).toEqual([]);
    expect(addPinned([], "   ")).toEqual([]);
  });
  it("trims the path", () => {
    expect(addPinned([], "  a.ts  ")).toEqual(["a.ts"]);
  });
  it("drops the oldest when overflowing", () => {
    const nine = Array.from({ length: 10 }, (_, i) => `f${i}.ts`);
    const after = addPinned(nine, "new.ts");
    expect(after).toHaveLength(10);
    expect(after[after.length - 1]).toBe("new.ts");
    expect(after).not.toContain("f0.ts");
  });
});

describe("removePinned", () => {
  it("removes the matching path", () => {
    expect(removePinned(["a.ts", "b.ts"], "a.ts")).toEqual(["b.ts"]);
  });
  it("is a no-op when missing", () => {
    expect(removePinned(["a.ts"], "b.ts")).toEqual(["a.ts"]);
  });
});

describe("togglePinned", () => {
  it("pins when absent", () => {
    expect(togglePinned([], "a.ts")).toEqual(["a.ts"]);
  });
  it("unpins when present", () => {
    expect(togglePinned(["a.ts", "b.ts"], "a.ts")).toEqual(["b.ts"]);
  });
});

describe("buildMentionsPrefix", () => {
  it("returns empty string when no pinned files", () => {
    expect(buildMentionsPrefix([], "hello")).toBe("");
  });
  it("prepends plain @refs for simple paths", () => {
    expect(buildMentionsPrefix(["a.ts", "b.ts"], "hello")).toBe("@a.ts @b.ts ");
  });
  it("uses brackets for paths with spaces", () => {
    expect(buildMentionsPrefix(["my file.ts"], "hello")).toBe(
      "@{my file.ts} ",
    );
  });
  it("skips files already @-mentioned in the message", () => {
    expect(buildMentionsPrefix(["a.ts", "b.ts"], "explain @a.ts now")).toBe(
      "@b.ts ",
    );
  });
  it("recognizes bracketed mentions in the message", () => {
    expect(
      buildMentionsPrefix(["a.ts", "weird path.ts"], "look at @{weird path.ts}"),
    ).toBe("@a.ts ");
  });
});

describe("applyPinnedToMessage", () => {
  it("prepends pinned refs to the message", () => {
    const result = applyPinnedToMessage(["a.ts"], "explain this");
    expect(result).toBe("@a.ts explain this");
  });
  it("leaves messages untouched when nothing to inject", () => {
    expect(applyPinnedToMessage([], "hello")).toBe("hello");
    expect(applyPinnedToMessage(["a.ts"], "explain @a.ts")).toBe("explain @a.ts");
  });
});
