/**
 * Unit tests for the pure helpers in `mastery.ts`:
 *  - `scheduleNextReview` (SRS ladder)
 *  - `computeReadiness` (track readiness scoring)
 */
import { describe, it, expect } from "vitest";
import { scheduleNextReview, computeReadiness } from "./mastery";

describe("learning/mastery — scheduleNextReview", () => {
  const now = new Date("2026-04-08T12:00:00Z");

  it("boots to confidence=1 and due tomorrow on first correct", () => {
    const r = scheduleNextReview(0, true, now);
    expect(r.confidence).toBe(1);
    expect(r.mastered).toBe(false);
    expect(r.nextDue.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("advances through the interval ladder on consecutive correct", () => {
    let conf = 0;
    for (let i = 0; i < 5; i++) {
      const r = scheduleNextReview(conf, true, now);
      conf = r.confidence;
    }
    expect(conf).toBe(5);
    expect(scheduleNextReview(conf, true, now).mastered).toBe(true);
  });

  it("marks mastered once confidence reaches 4", () => {
    expect(scheduleNextReview(3, true, now).mastered).toBe(true);
    expect(scheduleNextReview(2, true, now).mastered).toBe(false);
  });

  it("halves confidence on incorrect", () => {
    expect(scheduleNextReview(4, false, now).confidence).toBe(2);
    expect(scheduleNextReview(2, false, now).confidence).toBe(1);
    expect(scheduleNextReview(1, false, now).confidence).toBe(0);
  });

  it("clamps confidence to 0..5", () => {
    expect(scheduleNextReview(-1, true, now).confidence).toBe(1);
    expect(scheduleNextReview(10, true, now).confidence).toBe(5);
  });

  it("schedules 30d out at confidence=5", () => {
    const r = scheduleNextReview(4, true, now);
    expect(r.confidence).toBe(5);
    expect(r.nextDue.getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

// ─── computeReadiness ─────────────────────────────────────────────────────

describe("learning/mastery — computeReadiness", () => {
  function makeInput(
    expected: string[],
    mastery: Array<{ itemKey: string; confidence: number; mastered: boolean }>,
    labels: Record<string, string> = {},
    legacyPrefix?: string,
  ) {
    return {
      expectedKeys: new Set(expected),
      keyToLabel: new Map(Object.entries(labels)),
      masteryRows: mastery,
      legacyPrefix,
    };
  }

  it("returns zeros for an empty track (no content)", () => {
    const r = computeReadiness(makeInput([], []));
    expect(r).toEqual({
      itemsTracked: 0,
      mastered: 0,
      totalItems: 0,
      readiness: 0,
      coverage: 0,
      weakAreas: [],
    });
  });

  it("returns zeros when user has never touched the track", () => {
    const r = computeReadiness(
      makeInput(
        ["flashcard:1", "flashcard:2", "question:10"],
        [],
      ),
    );
    expect(r.totalItems).toBe(3);
    expect(r.itemsTracked).toBe(0);
    expect(r.mastered).toBe(0);
    expect(r.readiness).toBe(0);
    expect(r.coverage).toBe(0);
  });

  it("scores readiness as mastered / totalItems — NOT mastered / tracked", () => {
    // 5 items total, user has touched 2, mastered both → 0.4 ready.
    const r = computeReadiness(
      makeInput(
        ["flashcard:1", "flashcard:2", "flashcard:3", "flashcard:4", "flashcard:5"],
        [
          { itemKey: "flashcard:1", confidence: 5, mastered: true },
          { itemKey: "flashcard:2", confidence: 5, mastered: true },
        ],
      ),
    );
    expect(r.totalItems).toBe(5);
    expect(r.itemsTracked).toBe(2);
    expect(r.mastered).toBe(2);
    expect(r.readiness).toBe(0.4);
    expect(r.coverage).toBe(0.4);
  });

  it("ignores mastery rows outside the expected-key set", () => {
    // flashcard:99 belongs to a different track — must NOT count.
    const r = computeReadiness(
      makeInput(
        ["flashcard:1", "flashcard:2"],
        [
          { itemKey: "flashcard:1", confidence: 5, mastered: true },
          { itemKey: "flashcard:99", confidence: 5, mastered: true },
        ],
      ),
    );
    expect(r.itemsTracked).toBe(1);
    expect(r.mastered).toBe(1);
    expect(r.readiness).toBe(0.5);
  });

  it("accepts legacy prefix-format keys via legacyPrefix param", () => {
    const r = computeReadiness(
      makeInput(
        ["flashcard:1", "flashcard:2"],
        [
          // legacy format from pre-pass-1 data
          { itemKey: "track:series7:risk_profiles", confidence: 5, mastered: true },
          // modern format
          { itemKey: "flashcard:1", confidence: 3, mastered: false },
        ],
        {},
        "track:series7:",
      ),
    );
    // totalItems still 2 (derived from expected set), itemsTracked=2
    // because both rows matched
    expect(r.itemsTracked).toBe(2);
    expect(r.mastered).toBe(1);
    expect(r.readiness).toBe(0.5);
  });

  it("returns weak areas ordered by list position, label-resolved", () => {
    const r = computeReadiness(
      makeInput(
        ["flashcard:1", "flashcard:2", "flashcard:3"],
        [
          { itemKey: "flashcard:1", confidence: 0, mastered: false },
          { itemKey: "flashcard:2", confidence: 2, mastered: false },
          { itemKey: "flashcard:3", confidence: 5, mastered: true },
        ],
        { "flashcard:1": "Risk profile", "flashcard:2": "Asset allocation" },
      ),
    );
    expect(r.weakAreas).toEqual(["Risk profile", "Asset allocation"]);
  });

  it("caps weak areas at 10", () => {
    const expected: string[] = [];
    const mastery: Array<{ itemKey: string; confidence: number; mastered: boolean }> = [];
    const labels: Record<string, string> = {};
    for (let i = 1; i <= 20; i++) {
      expected.push(`flashcard:${i}`);
      mastery.push({ itemKey: `flashcard:${i}`, confidence: 0, mastered: false });
      labels[`flashcard:${i}`] = `card_${i}`;
    }
    const r = computeReadiness(makeInput(expected, mastery, labels));
    expect(r.weakAreas).toHaveLength(10);
    expect(r.weakAreas[0]).toBe("card_1");
    expect(r.weakAreas[9]).toBe("card_10");
  });

  it("rounds readiness + coverage to two decimal places", () => {
    const r = computeReadiness(
      makeInput(
        ["flashcard:1", "flashcard:2", "flashcard:3"],
        [
          { itemKey: "flashcard:1", confidence: 5, mastered: true },
        ],
      ),
    );
    // 1/3 = 0.333… → 0.33
    expect(r.readiness).toBe(0.33);
    expect(r.coverage).toBe(0.33);
  });

  it("falls back to raw itemKey in weakAreas when no label present", () => {
    const r = computeReadiness(
      makeInput(
        ["flashcard:1"],
        [{ itemKey: "flashcard:1", confidence: 1, mastered: false }],
        {},
      ),
    );
    expect(r.weakAreas).toEqual(["flashcard:1"]);
  });

  it("does not include mastered items in weak areas", () => {
    const r = computeReadiness(
      makeInput(
        ["flashcard:1", "flashcard:2"],
        [
          { itemKey: "flashcard:1", confidence: 5, mastered: true },
          { itemKey: "flashcard:2", confidence: 2, mastered: false },
        ],
        { "flashcard:1": "mastered term", "flashcard:2": "weak term" },
      ),
    );
    expect(r.weakAreas).toEqual(["weak term"]);
  });
});
