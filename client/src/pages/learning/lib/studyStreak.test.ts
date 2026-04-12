/**
 * Unit tests for the pure streak helpers in `studyStreak.ts`.
 *
 * Covers:
 *   - UTC-anchored date keys
 *   - markStudyDay idempotence + insertion + longest recompute
 *   - currentStreak today / yesterday / broken semantics
 *   - longestStreakFromDays walk
 *   - streakStatus 4-tier classification
 *   - parseStreak defensive filtering
 *   - serialize round-trip
 *   - MAX_STREAK_DAYS ring cap
 */
import { describe, it, expect } from "vitest";
import {
  toDayKey,
  parseDayKey,
  dayDelta,
  emptyStreak,
  markStudyDay,
  currentStreak,
  longestStreakFromDays,
  streakStatus,
  summarizeStreak,
  serializeStreak,
  parseStreak,
  MAX_STREAK_DAYS,
} from "./studyStreak";

// Fixed UTC dates for determinism.
const D = (iso: string) => new Date(iso);

describe("learning/studyStreak — toDayKey / parseDayKey", () => {
  it("formats dates as UTC YYYY-MM-DD", () => {
    expect(toDayKey(D("2026-04-11T23:59:59Z"))).toBe("2026-04-11");
    expect(toDayKey(D("2026-04-12T00:00:00Z"))).toBe("2026-04-12");
  });

  it("round-trips via parseDayKey", () => {
    const d = D("2026-04-11T00:00:00Z");
    expect(toDayKey(parseDayKey(toDayKey(d)))).toBe("2026-04-11");
  });

  it("parseDayKey rejects malformed strings with epoch 0", () => {
    expect(parseDayKey("invalid").getTime()).toBe(0);
    expect(parseDayKey("2026-13-01").getTime()).not.toBe(0); // forgiving regex (13→month overflows)
    expect(parseDayKey("").getTime()).toBe(0);
  });
});

describe("learning/studyStreak — dayDelta", () => {
  it("returns 0 for same day", () => {
    expect(dayDelta("2026-04-11", "2026-04-11")).toBe(0);
  });

  it("returns positive for later b", () => {
    expect(dayDelta("2026-04-11", "2026-04-12")).toBe(1);
    expect(dayDelta("2026-04-11", "2026-04-15")).toBe(4);
  });

  it("returns negative for earlier b", () => {
    expect(dayDelta("2026-04-12", "2026-04-11")).toBe(-1);
  });

  it("handles month boundaries", () => {
    expect(dayDelta("2026-04-30", "2026-05-01")).toBe(1);
  });
});

describe("learning/studyStreak — markStudyDay", () => {
  it("adds today's key on first call", () => {
    const r = markStudyDay(emptyStreak(), D("2026-04-11T10:00:00Z"));
    expect(r.changed).toBe(true);
    expect(r.state.days).toEqual(["2026-04-11"]);
    expect(r.state.longest).toBe(1);
  });

  it("is idempotent on same-day calls (changed=false)", () => {
    const s1 = markStudyDay(emptyStreak(), D("2026-04-11T10:00:00Z"));
    const s2 = markStudyDay(s1.state, D("2026-04-11T23:00:00Z"));
    expect(s2.changed).toBe(false);
    expect(s2.state.days).toEqual(["2026-04-11"]);
  });

  it("inserts days in sorted order", () => {
    const s1 = markStudyDay(emptyStreak(), D("2026-04-11T10:00:00Z"));
    const s2 = markStudyDay(s1.state, D("2026-04-13T10:00:00Z"));
    const s3 = markStudyDay(s2.state, D("2026-04-12T10:00:00Z"));
    expect(s3.state.days).toEqual(["2026-04-11", "2026-04-12", "2026-04-13"]);
  });

  it("recomputes longest on every insert", () => {
    let s = emptyStreak();
    s = markStudyDay(s, D("2026-04-11T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-12T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-13T10:00:00Z")).state;
    expect(s.longest).toBe(3);
    // Break then resume — longest still 3
    s = markStudyDay(s, D("2026-04-15T10:00:00Z")).state;
    expect(s.longest).toBe(3);
  });

  it("ring-caps at MAX_STREAK_DAYS", () => {
    let s = emptyStreak();
    for (let i = 0; i < MAX_STREAK_DAYS + 10; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      s = markStudyDay(s, d).state;
    }
    expect(s.days.length).toBe(MAX_STREAK_DAYS);
    // Oldest dropped — first element should reflect the drop
    expect(s.days[0]).not.toBe("2026-01-01");
  });
});

describe("learning/studyStreak — longestStreakFromDays", () => {
  it("returns 0 for empty", () => {
    expect(longestStreakFromDays([])).toBe(0);
  });

  it("returns 1 for a single day", () => {
    expect(longestStreakFromDays(["2026-04-11"])).toBe(1);
  });

  it("counts consecutive runs", () => {
    expect(longestStreakFromDays(["2026-04-11", "2026-04-12", "2026-04-13"])).toBe(3);
  });

  it("resets on a gap", () => {
    expect(
      longestStreakFromDays([
        "2026-04-11",
        "2026-04-12",
        "2026-04-14",
        "2026-04-15",
        "2026-04-16",
      ]),
    ).toBe(3);
  });
});

describe("learning/studyStreak — currentStreak", () => {
  const now = D("2026-04-11T12:00:00Z");

  it("returns 0 for empty state", () => {
    expect(currentStreak(emptyStreak(), now)).toBe(0);
  });

  it("returns 1 when only today is recorded", () => {
    const s = markStudyDay(emptyStreak(), now).state;
    expect(currentStreak(s, now)).toBe(1);
  });

  it("returns the run length when today is the end of a consecutive run", () => {
    let s = emptyStreak();
    s = markStudyDay(s, D("2026-04-09T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-10T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-11T10:00:00Z")).state;
    expect(currentStreak(s, now)).toBe(3);
  });

  it("stays counted when last day is yesterday (at-risk window)", () => {
    let s = emptyStreak();
    s = markStudyDay(s, D("2026-04-09T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-10T10:00:00Z")).state;
    // now is 2026-04-11 but user hasn't opened the app today yet
    expect(currentStreak(s, now)).toBe(2);
  });

  it("returns 0 when last day is 2+ days ago (broken)", () => {
    let s = emptyStreak();
    s = markStudyDay(s, D("2026-04-07T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-08T10:00:00Z")).state;
    expect(currentStreak(s, now)).toBe(0);
  });

  it("doesn't count gaps within the run", () => {
    let s = emptyStreak();
    s = markStudyDay(s, D("2026-04-08T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-10T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-11T10:00:00Z")).state;
    // run is [04-10, 04-11] = 2
    expect(currentStreak(s, now)).toBe(2);
  });
});

describe("learning/studyStreak — streakStatus", () => {
  const now = D("2026-04-11T12:00:00Z");

  it("empty → none", () => {
    expect(streakStatus(emptyStreak(), now)).toBe("none");
  });

  it("today → active", () => {
    const s = markStudyDay(emptyStreak(), now).state;
    expect(streakStatus(s, now)).toBe("active");
  });

  it("yesterday → at-risk", () => {
    const s = markStudyDay(emptyStreak(), D("2026-04-10T10:00:00Z")).state;
    expect(streakStatus(s, now)).toBe("at-risk");
  });

  it("2+ days ago → broken", () => {
    const s = markStudyDay(emptyStreak(), D("2026-04-08T10:00:00Z")).state;
    expect(streakStatus(s, now)).toBe("broken");
  });
});

describe("learning/studyStreak — summarizeStreak", () => {
  const now = D("2026-04-11T12:00:00Z");

  it("provides the full rollup", () => {
    let s = emptyStreak();
    s = markStudyDay(s, D("2026-04-09T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-10T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-11T10:00:00Z")).state;
    expect(summarizeStreak(s, now)).toEqual({
      current: 3,
      longest: 3,
      lastDay: "2026-04-11",
      status: "active",
    });
  });

  it("empty rollup for empty state", () => {
    expect(summarizeStreak(emptyStreak(), now)).toEqual({
      current: 0,
      longest: 0,
      lastDay: null,
      status: "none",
    });
  });
});

describe("learning/studyStreak — parseStreak defensive", () => {
  it("returns empty for null/undefined/empty", () => {
    expect(parseStreak(null).days).toEqual([]);
    expect(parseStreak(undefined).days).toEqual([]);
    expect(parseStreak("").days).toEqual([]);
  });

  it("returns empty for malformed JSON", () => {
    expect(parseStreak("{not json").days).toEqual([]);
  });

  it("returns empty when days is not an array", () => {
    expect(parseStreak('{"version":1,"days":"oops","longest":3}').days).toEqual([]);
  });

  it("filters invalid day strings", () => {
    const raw = JSON.stringify({
      version: 1,
      days: ["2026-04-11", "not-a-date", 42, "2026-04-12", ""],
      longest: 2,
    });
    const s = parseStreak(raw);
    expect(s.days).toEqual(["2026-04-11", "2026-04-12"]);
  });

  it("dedupes and sorts on parse", () => {
    const raw = JSON.stringify({
      version: 1,
      days: ["2026-04-13", "2026-04-11", "2026-04-13", "2026-04-12"],
      longest: 0,
    });
    const s = parseStreak(raw);
    expect(s.days).toEqual(["2026-04-11", "2026-04-12", "2026-04-13"]);
  });

  it("recomputes longest from valid days on load", () => {
    const raw = JSON.stringify({
      version: 1,
      days: ["2026-04-11", "2026-04-12", "2026-04-13"],
      longest: 0, // stale
    });
    const s = parseStreak(raw);
    expect(s.longest).toBe(3);
  });

  it("keeps a larger stored longest (data preservation)", () => {
    const raw = JSON.stringify({
      version: 1,
      days: ["2026-04-11"],
      longest: 7, // claimed historical max
    });
    const s = parseStreak(raw);
    // should be max(stored, derived) = 7
    expect(s.longest).toBe(7);
  });
});

describe("learning/studyStreak — serialize round-trip", () => {
  it("serializeStreak → parseStreak round-trips", () => {
    let s = emptyStreak();
    s = markStudyDay(s, D("2026-04-09T10:00:00Z")).state;
    s = markStudyDay(s, D("2026-04-10T10:00:00Z")).state;
    const raw = serializeStreak(s);
    const parsed = parseStreak(raw);
    expect(parsed).toEqual(s);
  });
});
