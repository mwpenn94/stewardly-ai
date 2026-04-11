/**
 * Unit tests for the pure trackProgress builder (`trackProgress.ts`).
 *
 * Locks in:
 *   - Mastery lookup population + skip-empty-keys
 *   - Per-chapter bucketing (matched chapter, unknown chapter,
 *     null chapter)
 *   - mastered / inProgress / unseen classification rules
 *   - Track-level totals == sum of chapter + unchaptered totals
 *   - Completion + attempted percentage rounding
 *   - completionStatus tier boundaries
 *   - formatProgressPct edge cases
 */
import { describe, it, expect } from "vitest";
import {
  buildMasteryLookup,
  buildTrackProgress,
  formatProgressPct,
  completionStatus,
  type ChapterRef,
  type ItemWithChapter,
} from "./trackProgress";

const chapters: ChapterRef[] = [
  { id: 10, title: "Ch 1: Equities" },
  { id: 11, title: "Ch 2: Options" },
  { id: 12, title: "Ch 3: Bonds" },
];

// ─── buildMasteryLookup ─────────────────────────────────────────────────

describe("learning/trackProgress — buildMasteryLookup", () => {
  it("maps itemKey → {confidence, mastered}", () => {
    const m = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 3, mastered: false },
      { itemKey: "flashcard:2", confidence: 5, mastered: true },
    ]);
    expect(m.get("flashcard:1")).toEqual({ confidence: 3, mastered: false });
    expect(m.get("flashcard:2")).toEqual({ confidence: 5, mastered: true });
  });

  it("skips rows with empty itemKey", () => {
    const m = buildMasteryLookup([
      { itemKey: "", confidence: 3, mastered: false },
      { itemKey: "flashcard:1", confidence: 1, mastered: false },
    ]);
    expect(m.size).toBe(1);
  });

  it("treats null confidence/mastered as 0/false", () => {
    const m = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: null, mastered: null },
    ]);
    expect(m.get("flashcard:1")).toEqual({ confidence: 0, mastered: false });
  });
});

// ─── buildTrackProgress ─────────────────────────────────────────────────

describe("learning/trackProgress — buildTrackProgress empty cases", () => {
  it("returns zeros for empty inputs", () => {
    const r = buildTrackProgress([], [], [], new Map());
    expect(r.trackTotal).toBe(0);
    expect(r.trackCompletionPct).toBe(0);
    expect(r.chapters).toEqual([]);
    expect(r.unchaptered).toEqual({ total: 0, mastered: 0, inProgress: 0, unseen: 0 });
  });

  it("renders chapters with zero counts when no items", () => {
    const r = buildTrackProgress(chapters, [], [], new Map());
    expect(r.chapters).toHaveLength(3);
    for (const c of r.chapters) {
      expect(c.total).toBe(0);
      expect(c.mastered).toBe(0);
      expect(c.completionPct).toBe(0);
    }
  });
});

describe("learning/trackProgress — bucketing", () => {
  it("places items into the correct chapter bucket", () => {
    const flashcards: ItemWithChapter[] = [
      { id: 1, chapterId: 10 },
      { id: 2, chapterId: 11 },
      { id: 3, chapterId: 11 },
    ];
    const questions: ItemWithChapter[] = [
      { id: 4, chapterId: 10 },
    ];
    const r = buildTrackProgress(chapters, flashcards, questions, new Map());
    expect(r.chapters[0]!.total).toBe(2); // ch 10 → flashcard 1 + question 4
    expect(r.chapters[1]!.total).toBe(2); // ch 11 → flashcards 2 + 3
    expect(r.chapters[2]!.total).toBe(0);
  });

  it("places null-chapter items in the unchaptered bucket", () => {
    const flashcards: ItemWithChapter[] = [
      { id: 1, chapterId: null },
      { id: 2, chapterId: 10 },
    ];
    const r = buildTrackProgress(chapters, flashcards, [], new Map());
    expect(r.unchaptered.total).toBe(1);
    expect(r.chapters[0]!.total).toBe(1);
  });

  it("places undefined chapterId items in the unchaptered bucket", () => {
    const flashcards: ItemWithChapter[] = [
      { id: 1 }, // no chapterId
    ];
    const r = buildTrackProgress(chapters, flashcards, [], new Map());
    expect(r.unchaptered.total).toBe(1);
  });

  it("dispatches items with unknown chapterId to unchaptered", () => {
    const flashcards: ItemWithChapter[] = [
      { id: 1, chapterId: 999 }, // not in chapters list
    ];
    const r = buildTrackProgress(chapters, flashcards, [], new Map());
    expect(r.unchaptered.total).toBe(1);
    expect(r.chapters[0]!.total).toBe(0);
  });
});

describe("learning/trackProgress — classification", () => {
  it("classifies mastered, in-progress, and unseen items", () => {
    const flashcards: ItemWithChapter[] = [
      { id: 1, chapterId: 10 },
      { id: 2, chapterId: 10 },
      { id: 3, chapterId: 10 },
    ];
    const mastery = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 5, mastered: true },
      { itemKey: "flashcard:2", confidence: 2, mastered: false },
      // flashcard:3 has no mastery row → unseen
    ]);
    const r = buildTrackProgress(chapters, flashcards, [], mastery);
    expect(r.chapters[0]!.mastered).toBe(1);
    expect(r.chapters[0]!.inProgress).toBe(1);
    expect(r.chapters[0]!.unseen).toBe(1);
  });

  it("conf=0 with a mastery row counts as in-progress (seen but failed first try)", () => {
    const flashcards: ItemWithChapter[] = [{ id: 1, chapterId: 10 }];
    const mastery = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 0, mastered: false },
    ]);
    const r = buildTrackProgress(chapters, flashcards, [], mastery);
    expect(r.chapters[0]!.inProgress).toBe(1);
    expect(r.chapters[0]!.unseen).toBe(0);
  });
});

describe("learning/trackProgress — totals", () => {
  it("track totals equal sum of chapters + unchaptered", () => {
    const flashcards: ItemWithChapter[] = [
      { id: 1, chapterId: 10 },
      { id: 2, chapterId: 11 },
      { id: 3, chapterId: null },
    ];
    const questions: ItemWithChapter[] = [{ id: 4, chapterId: 10 }];
    const r = buildTrackProgress(chapters, flashcards, questions, new Map());
    const sumOfChapters = r.chapters.reduce((acc, c) => acc + c.total, 0);
    expect(r.trackTotal).toBe(sumOfChapters + r.unchaptered.total);
  });

  it("trackCompletionPct = mastered / total rounded to 2 decimals", () => {
    const flashcards: ItemWithChapter[] = [
      { id: 1, chapterId: 10 },
      { id: 2, chapterId: 10 },
      { id: 3, chapterId: 10 },
    ];
    const mastery = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 5, mastered: true },
    ]);
    const r = buildTrackProgress(chapters, flashcards, [], mastery);
    // 1/3 = 0.333… → 0.33
    expect(r.trackCompletionPct).toBe(0.33);
  });
});

describe("learning/trackProgress — completionStatus", () => {
  it("0 → unstarted", () => expect(completionStatus(0)).toBe("unstarted"));
  it("0.1 → started", () => expect(completionStatus(0.1)).toBe("started"));
  it("0.3 → in-progress", () => expect(completionStatus(0.3)).toBe("in-progress"));
  it("0.7 → near-mastery", () => expect(completionStatus(0.7)).toBe("near-mastery"));
  it("1 → mastered", () => expect(completionStatus(1)).toBe("mastered"));
  it("just under 1 → near-mastery", () =>
    expect(completionStatus(0.99)).toBe("near-mastery"));
});

describe("learning/trackProgress — formatProgressPct", () => {
  it("formats as integer percent", () => {
    expect(formatProgressPct(0)).toBe("0%");
    expect(formatProgressPct(0.5)).toBe("50%");
    expect(formatProgressPct(1)).toBe("100%");
    expect(formatProgressPct(0.333)).toBe("33%");
  });

  it("handles edge cases", () => {
    expect(formatProgressPct(NaN)).toBe("0%");
    expect(formatProgressPct(-0.1)).toBe("0%");
  });
});
