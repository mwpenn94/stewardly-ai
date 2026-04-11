import { describe, it, expect } from "vitest";
import {
  toLocalDateKey,
  daysBetween,
  recordStudyEventPure,
  parseDailyStreak,
  isStreakLive,
  type DailyStreakState,
} from "./dailyStreak";

const emptyState: DailyStreakState = {
  current: 0,
  best: 0,
  lastStudyDate: null,
  totalStudyEvents: 0,
};

describe("learning/dailyStreak — toLocalDateKey", () => {
  it("pads month and day to 2 digits", () => {
    const d = new Date(2026, 0, 5, 10, 0, 0); // Jan 5 2026, local
    expect(toLocalDateKey(d)).toBe("2026-01-05");
  });

  it("formats December correctly", () => {
    const d = new Date(2026, 11, 31, 23, 59, 0);
    expect(toLocalDateKey(d)).toBe("2026-12-31");
  });
});

describe("learning/dailyStreak — daysBetween", () => {
  it("returns null when the earlier key is missing", () => {
    expect(daysBetween(null, "2026-04-11")).toBe(null);
  });

  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-04-11", "2026-04-11")).toBe(0);
  });

  it("returns 1 for consecutive days", () => {
    expect(daysBetween("2026-04-11", "2026-04-12")).toBe(1);
  });

  it("returns the correct count across months", () => {
    expect(daysBetween("2026-03-30", "2026-04-02")).toBe(3);
  });

  it("returns a negative number for backfill", () => {
    expect(daysBetween("2026-04-11", "2026-04-10")).toBe(-1);
  });

  it("returns null for malformed keys", () => {
    expect(daysBetween("garbage", "2026-04-11")).toBe(null);
    expect(daysBetween("2026-04-11", "not-a-date")).toBe(null);
  });

  it("is DST-safe (uses noon UTC anchor)", () => {
    // Spring forward in the US: 2026-03-08 has 23 hours locally
    expect(daysBetween("2026-03-07", "2026-03-08")).toBe(1);
    // Fall back: 2026-11-01 has 25 hours locally
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
  });
});

describe("learning/dailyStreak — recordStudyEventPure", () => {
  it("boots a fresh streak to 1 on first event", () => {
    const out = recordStudyEventPure(emptyState, "2026-04-11");
    expect(out.current).toBe(1);
    expect(out.best).toBe(1);
    expect(out.lastStudyDate).toBe("2026-04-11");
    expect(out.totalStudyEvents).toBe(1);
  });

  it("keeps streak at 1 on second event same day, bumps lifetime counter", () => {
    const a = recordStudyEventPure(emptyState, "2026-04-11");
    const b = recordStudyEventPure(a, "2026-04-11");
    expect(b.current).toBe(1);
    expect(b.totalStudyEvents).toBe(2);
    expect(b.lastStudyDate).toBe("2026-04-11");
  });

  it("extends streak on consecutive days", () => {
    let s = recordStudyEventPure(emptyState, "2026-04-11");
    s = recordStudyEventPure(s, "2026-04-12");
    s = recordStudyEventPure(s, "2026-04-13");
    s = recordStudyEventPure(s, "2026-04-14");
    expect(s.current).toBe(4);
    expect(s.best).toBe(4);
    expect(s.totalStudyEvents).toBe(4);
  });

  it("resets streak on a skipped day", () => {
    let s = recordStudyEventPure(emptyState, "2026-04-11");
    s = recordStudyEventPure(s, "2026-04-12"); // current=2
    // Skip 2026-04-13 — next study is on 04-14
    s = recordStudyEventPure(s, "2026-04-14");
    expect(s.current).toBe(1);
    expect(s.best).toBe(2); // best preserved
  });

  it("preserves best streak across breaks", () => {
    let s = emptyState;
    s = recordStudyEventPure(s, "2026-04-01");
    s = recordStudyEventPure(s, "2026-04-02");
    s = recordStudyEventPure(s, "2026-04-03"); // current=3, best=3
    s = recordStudyEventPure(s, "2026-04-10"); // gap — reset to 1
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
    // Build up again but not past best
    s = recordStudyEventPure(s, "2026-04-11");
    expect(s.current).toBe(2);
    expect(s.best).toBe(3);
  });

  it("ignores backfill (delta < 0) — history is immutable", () => {
    let s = recordStudyEventPure(emptyState, "2026-04-11");
    s = recordStudyEventPure(s, "2026-04-12"); // current=2
    // User tries to record a study event "yesterday" — should be a no-op
    const before = s;
    s = recordStudyEventPure(s, "2026-04-11");
    expect(s).toEqual(before);
  });

  it("best=current when streak beats the prior best", () => {
    let s = emptyState;
    for (let day = 1; day <= 10; day++) {
      s = recordStudyEventPure(s, `2026-04-${String(day).padStart(2, "0")}`);
    }
    expect(s.current).toBe(10);
    expect(s.best).toBe(10);
  });
});

describe("learning/dailyStreak — parseDailyStreak", () => {
  it("returns empty state on null/undefined/empty", () => {
    expect(parseDailyStreak(null)).toEqual(emptyState);
    expect(parseDailyStreak(undefined)).toEqual(emptyState);
    expect(parseDailyStreak("")).toEqual(emptyState);
  });

  it("returns empty state on malformed JSON", () => {
    expect(parseDailyStreak("{not json")).toEqual(emptyState);
    expect(parseDailyStreak("[1,2,3]")).toEqual(emptyState);
    expect(parseDailyStreak('"a string"')).toEqual(emptyState);
  });

  it("parses a valid payload", () => {
    const raw = JSON.stringify({
      current: 5,
      best: 10,
      lastStudyDate: "2026-04-11",
      totalStudyEvents: 42,
    });
    expect(parseDailyStreak(raw)).toEqual({
      current: 5,
      best: 10,
      lastStudyDate: "2026-04-11",
      totalStudyEvents: 42,
    });
  });

  it("drops a malformed date and defaults numeric fields", () => {
    const raw = JSON.stringify({
      current: "five",
      best: -1,
      lastStudyDate: "not-a-date",
      totalStudyEvents: 42,
    });
    expect(parseDailyStreak(raw)).toEqual({
      current: 0,
      best: 0,
      lastStudyDate: null,
      totalStudyEvents: 42,
    });
  });

  it("floors non-integer numbers", () => {
    const raw = JSON.stringify({
      current: 3.7,
      best: 10.2,
      lastStudyDate: "2026-04-11",
      totalStudyEvents: 12.9,
    });
    const out = parseDailyStreak(raw);
    expect(out.current).toBe(3);
    expect(out.best).toBe(10);
    expect(out.totalStudyEvents).toBe(12);
  });
});

describe("learning/dailyStreak — isStreakLive", () => {
  const withStreak = (date: string): DailyStreakState => ({
    current: 5,
    best: 5,
    lastStudyDate: date,
    totalStudyEvents: 5,
  });

  it("returns false when there's no streak yet", () => {
    expect(isStreakLive(emptyState, "2026-04-11")).toBe(false);
  });

  it("returns true when the user studied today", () => {
    expect(isStreakLive(withStreak("2026-04-11"), "2026-04-11")).toBe(true);
  });

  it("returns true when the user studied yesterday (savable)", () => {
    expect(isStreakLive(withStreak("2026-04-10"), "2026-04-11")).toBe(true);
  });

  it("returns false when the user skipped 2+ days", () => {
    expect(isStreakLive(withStreak("2026-04-09"), "2026-04-11")).toBe(false);
  });
});
