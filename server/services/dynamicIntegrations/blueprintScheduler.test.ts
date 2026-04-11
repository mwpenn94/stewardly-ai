import { describe, it, expect } from "vitest";
import {
  parseCron,
  cronMatchesDate,
  isDue,
} from "./blueprintScheduler";

describe("parseCron", () => {
  it("parses a simple every-minute cron", () => {
    const p = parseCron("* * * * *");
    expect(p).not.toBeNull();
    expect(p!.minute.size).toBe(60);
    expect(p!.hour.size).toBe(24);
  });
  it("parses a literal hourly schedule", () => {
    const p = parseCron("0 * * * *");
    expect(p!.minute.has(0)).toBe(true);
    expect(p!.minute.size).toBe(1);
  });
  it("parses a step — every 5 minutes", () => {
    const p = parseCron("*/5 * * * *");
    expect(Array.from(p!.minute).sort((a, b) => a - b)).toEqual(
      [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
    );
  });
  it("parses a comma list", () => {
    const p = parseCron("0,30 * * * *");
    expect(Array.from(p!.minute).sort((a, b) => a - b)).toEqual([0, 30]);
  });
  it("parses a range", () => {
    const p = parseCron("0 9-17 * * *");
    expect(p!.hour.size).toBe(9);
    expect(p!.hour.has(9)).toBe(true);
    expect(p!.hour.has(17)).toBe(true);
    expect(p!.hour.has(18)).toBe(false);
  });
  it("parses dow=7 as Sunday (0)", () => {
    const p = parseCron("0 0 * * 7");
    expect(p!.dayOfWeek.has(0)).toBe(true);
    expect(p!.dayOfWeek.has(7)).toBe(false);
  });
  it("returns null on wrong field count", () => {
    expect(parseCron("* * * *")).toBeNull();
    expect(parseCron("* * * * * *")).toBeNull();
  });
  it("returns null on out-of-range literal", () => {
    expect(parseCron("99 * * * *")).toBeNull();
    expect(parseCron("* 25 * * *")).toBeNull();
  });
  it("returns null on bad range", () => {
    expect(parseCron("* * * * nonsense")).toBeNull();
  });
});

describe("cronMatchesDate", () => {
  it("matches every-minute against any time", () => {
    const p = parseCron("* * * * *")!;
    expect(cronMatchesDate(p, new Date("2026-04-11T12:34:56"))).toBe(true);
  });
  it("matches top-of-hour only", () => {
    const p = parseCron("0 * * * *")!;
    expect(cronMatchesDate(p, new Date("2026-04-11T12:00:00"))).toBe(true);
    expect(cronMatchesDate(p, new Date("2026-04-11T12:01:00"))).toBe(false);
  });
  it("matches 9am Monday-Friday", () => {
    const p = parseCron("0 9 * * 1-5")!;
    // 2026-04-13 is a Monday
    expect(cronMatchesDate(p, new Date(2026, 3, 13, 9, 0))).toBe(true);
    expect(cronMatchesDate(p, new Date(2026, 3, 13, 10, 0))).toBe(false);
    // 2026-04-12 is Sunday → 0, not in 1-5
    expect(cronMatchesDate(p, new Date(2026, 3, 12, 9, 0))).toBe(false);
  });
  it("OR-combines DOM and DOW when both restricted (POSIX)", () => {
    const p = parseCron("0 0 1 * 0")!; // first of month OR Sunday
    // 2026-04-01 is a Wednesday — DOM matches
    expect(cronMatchesDate(p, new Date(2026, 3, 1, 0, 0))).toBe(true);
    // 2026-04-05 is a Sunday — DOW matches
    expect(cronMatchesDate(p, new Date(2026, 3, 5, 0, 0))).toBe(true);
    // 2026-04-07 is a Tuesday, not first — neither matches
    expect(cronMatchesDate(p, new Date(2026, 3, 7, 0, 0))).toBe(false);
  });
  it("matches on specific month", () => {
    const p = parseCron("0 0 1 1 *")!; // Jan 1
    expect(cronMatchesDate(p, new Date(2026, 0, 1, 0, 0))).toBe(true);
    expect(cronMatchesDate(p, new Date(2026, 1, 1, 0, 0))).toBe(false);
  });
});

describe("isDue", () => {
  it("returns false on invalid cron", () => {
    expect(isDue("not a cron", new Date(), null)).toBe(false);
  });
  it("returns false when lastRunAt is within dedup window", () => {
    const now = new Date(2026, 3, 11, 12, 0, 0);
    // cron matches, but last run was 10s ago
    expect(isDue("0 * * * *", now, now.getTime() - 10_000)).toBe(false);
  });
  it("returns true when lastRunAt is older than dedup window and cron matches", () => {
    const now = new Date(2026, 3, 11, 12, 0, 0);
    expect(isDue("0 * * * *", now, now.getTime() - 120_000)).toBe(true);
  });
  it("returns true when lastRunAt is null", () => {
    const now = new Date(2026, 3, 11, 12, 0, 0);
    expect(isDue("0 * * * *", now, null)).toBe(true);
  });
});
