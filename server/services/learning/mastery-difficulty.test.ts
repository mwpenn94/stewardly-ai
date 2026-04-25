/**
 * Pass 154 — Unit tests for SRS difficulty tuning:
 *  - `scheduleNextReview` with difficulty parameter
 *  - `previewIntervals` helper
 */
import { describe, it, expect } from "vitest";
import { scheduleNextReview, previewIntervals } from "./mastery";

const now = new Date("2026-04-25T12:00:00Z");

describe("scheduleNextReview — difficulty parameter (Pass 154)", () => {
  it("'again' resets confidence to 0 regardless of current level", () => {
    const r = scheduleNextReview(4, true, now, "again");
    expect(r.confidence).toBe(0);
    expect(r.mastered).toBe(false);
  });

  it("'again' at confidence 0 stays at 0 with 0-day interval", () => {
    const r = scheduleNextReview(0, true, now, "again");
    expect(r.confidence).toBe(0);
    // 0 * 0 multiplier = 0 days
    expect(r.nextDue.getTime() - now.getTime()).toBe(0);
  });

  it("'hard' advances confidence but uses 0.5x interval multiplier", () => {
    // From confidence 2 → 3, base interval = 7d, hard = 3.5d
    const r = scheduleNextReview(2, true, now, "hard");
    expect(r.confidence).toBe(3);
    const expectedMs = 3.5 * 24 * 60 * 60 * 1000;
    expect(r.nextDue.getTime() - now.getTime()).toBe(expectedMs);
  });

  it("'good' advances confidence with 1.0x interval multiplier (normal)", () => {
    // From confidence 2 → 3, base interval = 7d, good = 7d
    const r = scheduleNextReview(2, true, now, "good");
    expect(r.confidence).toBe(3);
    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    expect(r.nextDue.getTime() - now.getTime()).toBe(expectedMs);
  });

  it("'easy' advances confidence with 1.5x interval multiplier", () => {
    // From confidence 2 → 3, base interval = 7d, easy = 10.5d
    const r = scheduleNextReview(2, true, now, "easy");
    expect(r.confidence).toBe(3);
    const expectedMs = 10.5 * 24 * 60 * 60 * 1000;
    expect(r.nextDue.getTime() - now.getTime()).toBe(expectedMs);
  });

  it("'good' at confidence 4 → 5 gives 30d interval", () => {
    const r = scheduleNextReview(4, true, now, "good");
    expect(r.confidence).toBe(5);
    expect(r.mastered).toBe(true);
    const expectedMs = 30 * 24 * 60 * 60 * 1000;
    expect(r.nextDue.getTime() - now.getTime()).toBe(expectedMs);
  });

  it("'easy' at confidence 4 → 5 gives 45d interval (1.5x)", () => {
    const r = scheduleNextReview(4, true, now, "easy");
    expect(r.confidence).toBe(5);
    expect(r.mastered).toBe(true);
    const expectedMs = 45 * 24 * 60 * 60 * 1000;
    expect(r.nextDue.getTime() - now.getTime()).toBe(expectedMs);
  });

  it("difficulty overrides the 'correct' boolean", () => {
    // Even if correct=false, 'good' should treat as correct
    const r = scheduleNextReview(2, false, now, "good");
    expect(r.confidence).toBe(3);
    // Even if correct=true, 'again' should treat as incorrect
    const r2 = scheduleNextReview(4, true, now, "again");
    expect(r2.confidence).toBe(0);
  });

  it("without difficulty, behaves exactly as before (backward compat)", () => {
    const rCorrect = scheduleNextReview(2, true, now);
    expect(rCorrect.confidence).toBe(3);
    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    expect(rCorrect.nextDue.getTime() - now.getTime()).toBe(expectedMs);

    const rIncorrect = scheduleNextReview(4, false, now);
    expect(rIncorrect.confidence).toBe(2);
  });
});

describe("previewIntervals (Pass 154)", () => {
  it("returns exactly 4 entries for again/hard/good/easy", () => {
    const previews = previewIntervals(0);
    expect(previews).toHaveLength(4);
    expect(previews.map((p) => p.difficulty)).toEqual(["again", "hard", "good", "easy"]);
  });

  it("all entries have non-negative days", () => {
    for (let conf = 0; conf <= 5; conf++) {
      const previews = previewIntervals(conf);
      for (const p of previews) {
        expect(p.days).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("'again' always shows shortest interval", () => {
    for (let conf = 0; conf <= 5; conf++) {
      const previews = previewIntervals(conf);
      const againDays = previews.find((p) => p.difficulty === "again")!.days;
      const goodDays = previews.find((p) => p.difficulty === "good")!.days;
      expect(againDays).toBeLessThanOrEqual(goodDays);
    }
  });

  it("'easy' always shows longest interval", () => {
    for (let conf = 0; conf <= 5; conf++) {
      const previews = previewIntervals(conf);
      const easyDays = previews.find((p) => p.difficulty === "easy")!.days;
      const goodDays = previews.find((p) => p.difficulty === "good")!.days;
      expect(easyDays).toBeGreaterThanOrEqual(goodDays);
    }
  });

  it("labels are human-readable strings", () => {
    const previews = previewIntervals(3);
    for (const p of previews) {
      expect(typeof p.label).toBe("string");
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("at confidence 0, 'again' label is '<1m' (immediate re-show)", () => {
    const previews = previewIntervals(0);
    const again = previews.find((p) => p.difficulty === "again")!;
    expect(again.label).toBe("<1m");
  });
});
