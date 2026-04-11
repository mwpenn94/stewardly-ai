import { describe, it, expect } from "vitest";
import {
  parseTrackReadState,
  markChapterRead,
  isChapterRead,
  chaptersReadCount,
  lastReadChapter,
  trackProgressPct,
  clearTrack,
} from "./trackReadState";

describe("learning/trackReadState — parseTrackReadState", () => {
  it("returns empty on null/undefined/empty", () => {
    expect(parseTrackReadState(null)).toEqual({});
    expect(parseTrackReadState(undefined)).toEqual({});
    expect(parseTrackReadState("")).toEqual({});
  });

  it("returns empty on malformed JSON", () => {
    expect(parseTrackReadState("{not valid")).toEqual({});
    expect(parseTrackReadState("undefined")).toEqual({});
  });

  it("returns empty on non-object payloads", () => {
    expect(parseTrackReadState('"just a string"')).toEqual({});
    expect(parseTrackReadState("42")).toEqual({});
    expect(parseTrackReadState("[1,2,3]")).toEqual({});
  });

  it("parses a valid object payload", () => {
    const raw = JSON.stringify({
      "7": { chapterIds: [2, 1], lastChapterId: 2, updatedAt: 1000 },
    });
    expect(parseTrackReadState(raw)).toEqual({
      "7": { chapterIds: [2, 1], lastChapterId: 2, updatedAt: 1000 },
    });
  });

  it("drops entries that are not objects", () => {
    const raw = JSON.stringify({
      "1": "not an object",
      "2": { chapterIds: [1], lastChapterId: 1, updatedAt: 1 },
    });
    const out = parseTrackReadState(raw);
    expect(Object.keys(out)).toEqual(["2"]);
  });

  it("drops non-numeric chapter ids", () => {
    const raw = JSON.stringify({
      "1": { chapterIds: [1, "two", null, 3] as any, lastChapterId: 1, updatedAt: 1 },
    });
    expect(parseTrackReadState(raw)).toEqual({
      "1": { chapterIds: [1, 3], lastChapterId: 1, updatedAt: 1 },
    });
  });

  it("falls back to null lastChapterId on bad type", () => {
    const raw = JSON.stringify({
      "1": { chapterIds: [1], lastChapterId: "x" as any, updatedAt: 1 },
    });
    expect(parseTrackReadState(raw)["1"].lastChapterId).toBe(null);
  });

  it("falls back to updatedAt=0 on bad type", () => {
    const raw = JSON.stringify({
      "1": { chapterIds: [1], lastChapterId: 1, updatedAt: "x" as any },
    });
    expect(parseTrackReadState(raw)["1"].updatedAt).toBe(0);
  });
});

describe("learning/trackReadState — markChapterRead", () => {
  it("adds a fresh entry", () => {
    const out = markChapterRead({}, "cfp", 5, 1000);
    expect(out.cfp.chapterIds).toEqual([5]);
    expect(out.cfp.lastChapterId).toBe(5);
    expect(out.cfp.updatedAt).toBe(1000);
  });

  it("moves an existing chapter to the front", () => {
    let s = markChapterRead({}, "cfp", 1);
    s = markChapterRead(s, "cfp", 2);
    s = markChapterRead(s, "cfp", 3);
    s = markChapterRead(s, "cfp", 2); // touch 2 again
    expect(s.cfp.chapterIds).toEqual([2, 3, 1]);
    expect(s.cfp.lastChapterId).toBe(2);
  });

  it("is pure — does not mutate the input state", () => {
    const s = markChapterRead({}, "cfp", 1);
    const before = JSON.stringify(s);
    const out = markChapterRead(s, "cfp", 2);
    expect(JSON.stringify(s)).toBe(before);
    expect(out).not.toBe(s);
  });

  it("accepts numeric track keys and stringifies them", () => {
    const out = markChapterRead({}, 42, 1);
    expect(out["42"].chapterIds).toEqual([1]);
  });

  it("rejects non-finite chapter ids", () => {
    const out = markChapterRead({}, "cfp", Number.NaN);
    expect(out).toEqual({});
  });

  it("isolates state per track", () => {
    let s: ReturnType<typeof markChapterRead> = {};
    s = markChapterRead(s, "cfp", 1);
    s = markChapterRead(s, "series7", 9);
    expect(s.cfp.chapterIds).toEqual([1]);
    expect(s.series7.chapterIds).toEqual([9]);
  });
});

describe("learning/trackReadState — isChapterRead + counts", () => {
  const s = markChapterRead(markChapterRead({}, "cfp", 1), "cfp", 2);

  it("isChapterRead is true for read chapters", () => {
    expect(isChapterRead(s, "cfp", 1)).toBe(true);
    expect(isChapterRead(s, "cfp", 2)).toBe(true);
  });

  it("isChapterRead is false for unread chapters and unknown tracks", () => {
    expect(isChapterRead(s, "cfp", 99)).toBe(false);
    expect(isChapterRead(s, "unknown", 1)).toBe(false);
  });

  it("chaptersReadCount returns the correct count", () => {
    expect(chaptersReadCount(s, "cfp")).toBe(2);
    expect(chaptersReadCount(s, "unknown")).toBe(0);
  });

  it("lastReadChapter returns the most recent chapter", () => {
    expect(lastReadChapter(s, "cfp")).toBe(2);
    expect(lastReadChapter(s, "unknown")).toBe(null);
  });
});

describe("learning/trackReadState — trackProgressPct", () => {
  it("returns 0 when nothing is read", () => {
    expect(trackProgressPct({}, "cfp", 10)).toBe(0);
  });

  it("returns 0 when totalChapters is 0 (no divide by zero)", () => {
    const s = markChapterRead({}, "cfp", 1);
    expect(trackProgressPct(s, "cfp", 0)).toBe(0);
    expect(trackProgressPct(s, "cfp", -1)).toBe(0);
  });

  it("computes a percentage", () => {
    let s: ReturnType<typeof markChapterRead> = {};
    s = markChapterRead(s, "cfp", 1);
    s = markChapterRead(s, "cfp", 2);
    expect(trackProgressPct(s, "cfp", 10)).toBe(20);
    expect(trackProgressPct(s, "cfp", 4)).toBe(50);
  });

  it("clamps to 100 on over-count", () => {
    let s: ReturnType<typeof markChapterRead> = {};
    s = markChapterRead(s, "cfp", 1);
    s = markChapterRead(s, "cfp", 2);
    s = markChapterRead(s, "cfp", 3);
    // Total chapters now 2 — over-count should cap at 100
    expect(trackProgressPct(s, "cfp", 2)).toBe(100);
  });
});

describe("learning/trackReadState — clearTrack", () => {
  it("removes a track entry", () => {
    const s = markChapterRead({}, "cfp", 1);
    const out = clearTrack(s, "cfp");
    expect(out).toEqual({});
  });

  it("leaves other tracks untouched", () => {
    let s: ReturnType<typeof markChapterRead> = {};
    s = markChapterRead(s, "cfp", 1);
    s = markChapterRead(s, "series7", 2);
    const out = clearTrack(s, "cfp");
    expect(Object.keys(out)).toEqual(["series7"]);
  });

  it("is a no-op for unknown tracks (returns same reference)", () => {
    const s = markChapterRead({}, "cfp", 1);
    const out = clearTrack(s, "unknown");
    expect(out).toBe(s);
  });
});
