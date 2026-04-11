/**
 * Tests for clipboard history — Pass 265.
 */

import { describe, it, expect } from "vitest";
import {
  recordClip,
  removeClip,
  clearClipboardHistory,
  filterClips,
  summarizeClips,
  previewClip,
  parseClips,
  serializeClips,
  MAX_ENTRIES,
  MAX_CONTENT_BYTES,
  type ClipboardEntry,
} from "./clipboardHistory";

function makeClip(partial: Partial<ClipboardEntry> = {}): ClipboardEntry {
  return {
    id: partial.id ?? "c1",
    content: partial.content ?? "hello",
    source: partial.source ?? "message",
    label: partial.label,
    timestamp: partial.timestamp ?? 0,
    bytes: partial.bytes ?? (partial.content?.length ?? 5),
  };
}

describe("recordClip", () => {
  it("prepends a new entry", () => {
    const out = recordClip([], "first", "message");
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("first");
  });

  it("dedupes against most-recent same-source entry", () => {
    let list = recordClip([], "same", "message");
    list = recordClip(list, "same", "message");
    expect(list).toHaveLength(1);
  });

  it("does NOT dedupe when sources differ", () => {
    let list = recordClip([], "same", "message");
    list = recordClip(list, "same", "file");
    expect(list).toHaveLength(2);
  });

  it("ignores empty content", () => {
    expect(recordClip([], "", "other")).toEqual([]);
  });

  it("truncates content over the byte cap", () => {
    const huge = "x".repeat(MAX_CONTENT_BYTES * 2);
    const list = recordClip([], huge, "other");
    expect(list[0].content.length).toBeLessThanOrEqual(MAX_CONTENT_BYTES + 50);
    expect(list[0].content).toContain("truncated");
  });

  it("caps at MAX_ENTRIES", () => {
    let list: ClipboardEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      list = recordClip(list, `content-${i}`, "other");
    }
    expect(list.length).toBe(MAX_ENTRIES);
    expect(list[0].content).toContain(`content-${MAX_ENTRIES + 4}`);
  });

  it("records label when provided", () => {
    const list = recordClip([], "foo", "message", "label");
    expect(list[0].label).toBe("label");
  });
});

describe("removeClip / clear", () => {
  it("removes matching id", () => {
    const list = [
      makeClip({ id: "a" }),
      makeClip({ id: "b", content: "two" }),
    ];
    const out = removeClip(list, "a");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("clearClipboardHistory returns empty", () => {
    expect(clearClipboardHistory()).toEqual([]);
  });
});

describe("filterClips", () => {
  const sample = [
    makeClip({ id: "a", content: "hello world", source: "message" }),
    makeClip({ id: "b", content: "const foo", source: "code-block" }),
    makeClip({ id: "c", content: "hi there", source: "message" }),
  ];

  it("filters by content substring", () => {
    expect(filterClips(sample, "hello")).toHaveLength(1);
  });

  it("filters by source", () => {
    expect(filterClips(sample, "", "message")).toHaveLength(2);
  });

  it("composes content + source", () => {
    expect(filterClips(sample, "hi", "message")).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    expect(filterClips(sample, "HELLO")).toHaveLength(1);
  });

  it("empty query returns all", () => {
    expect(filterClips(sample, "")).toHaveLength(3);
  });
});

describe("summarizeClips", () => {
  it("counts by source and total bytes", () => {
    const list = [
      makeClip({ source: "message", bytes: 10 }),
      makeClip({ source: "message", bytes: 5 }),
      makeClip({ source: "file", bytes: 20 }),
    ];
    const s = summarizeClips(list);
    expect(s.total).toBe(3);
    expect(s.bySource.message).toBe(2);
    expect(s.bySource.file).toBe(1);
    expect(s.totalBytes).toBe(35);
  });
});

describe("previewClip", () => {
  it("returns single-line preview", () => {
    const clip = makeClip({ content: "line one\nline two\nline three" });
    expect(previewClip(clip)).toBe("line one line two line three");
  });

  it("truncates long content", () => {
    const clip = makeClip({ content: "x".repeat(100) });
    expect(previewClip(clip, 20).length).toBe(21);
    expect(previewClip(clip, 20).endsWith("…")).toBe(true);
  });

  it("trims whitespace", () => {
    const clip = makeClip({ content: "  hello  " });
    expect(previewClip(clip)).toBe("hello");
  });
});

describe("parseClips / serializeClips", () => {
  it("round-trips through JSON", () => {
    const list = [makeClip({ id: "a", content: "foo", source: "message" })];
    const out = parseClips(serializeClips(list));
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("foo");
  });

  it("returns empty on null / malformed", () => {
    expect(parseClips(null)).toEqual([]);
    expect(parseClips("{oops")).toEqual([]);
  });

  it("drops entries with invalid source", () => {
    const raw = JSON.stringify([
      { id: "a", content: "x", source: "bogus" },
      { id: "b", content: "y", source: "message" },
    ]);
    const out = parseClips(raw);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("drops entries with missing content", () => {
    const raw = JSON.stringify([{ id: "a", source: "message" }]);
    expect(parseClips(raw)).toEqual([]);
  });

  it("caps on load", () => {
    const arr: unknown[] = [];
    for (let i = 0; i < MAX_ENTRIES + 20; i++) {
      arr.push({ id: `c${i}`, content: `x${i}`, source: "other" });
    }
    const out = parseClips(JSON.stringify(arr));
    expect(out.length).toBe(MAX_ENTRIES);
  });
});
