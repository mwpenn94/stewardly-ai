/**
 * Unit tests for the pure SRS scheduler (scheduleNextReview) +
 * parseItemKey helper + buildReviewSession composition — all pure
 * functions the dueReview tRPC procedure composes to produce the
 * final mixed SRS session.
 */
import { describe, it, expect } from "vitest";
import {
  scheduleNextReview,
  parseItemKey,
  buildReviewSession,
  type ReviewSessionFlashcard,
  type ReviewSessionQuestion,
} from "./mastery";

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

describe("learning/mastery — parseItemKey", () => {
  it("parses flashcard keys", () => {
    expect(parseItemKey("flashcard:42")).toEqual({ kind: "flashcard", id: 42 });
    expect(parseItemKey("flashcard:1")).toEqual({ kind: "flashcard", id: 1 });
  });

  it("parses question keys", () => {
    expect(parseItemKey("question:7")).toEqual({ kind: "question", id: 7 });
  });

  it("returns unknown for unrecognized kinds", () => {
    expect(parseItemKey("track:cfp:intro")).toEqual({ kind: "unknown", id: null });
    expect(parseItemKey("definition:5")).toEqual({ kind: "unknown", id: null });
    expect(parseItemKey("garbage")).toEqual({ kind: "unknown", id: null });
    expect(parseItemKey("")).toEqual({ kind: "unknown", id: null });
  });

  it("rejects non-numeric ids", () => {
    expect(parseItemKey("flashcard:abc")).toEqual({ kind: "unknown", id: null });
    expect(parseItemKey("question:1.5")).toEqual({ kind: "unknown", id: null });
  });

  it("requires trailing id — key-only is unknown", () => {
    expect(parseItemKey("flashcard:")).toEqual({ kind: "unknown", id: null });
    expect(parseItemKey("flashcard")).toEqual({ kind: "unknown", id: null });
  });
});

describe("learning/mastery — buildReviewSession", () => {
  // ── Fixture helpers ──
  const fc = (id: number): ReviewSessionFlashcard => ({
    id,
    term: `Term ${id}`,
    definition: `Definition ${id}`,
  });
  const q = (id: number): ReviewSessionQuestion => ({
    id,
    prompt: `Question ${id}?`,
    options: ["A", "B", "C", "D"],
    correctIndex: 0,
    explanation: "Because.",
    difficulty: "medium",
  });

  const baseline = {
    due: [] as Array<{ itemKey: string }>,
    flashcardById: new Map<number, ReviewSessionFlashcard>(),
    questionById: new Map<number, ReviewSessionQuestion>(),
    newFlashcards: [] as ReviewSessionFlashcard[],
    newQuestions: [] as ReviewSessionQuestion[],
    limit: 20,
    newQuota: 10,
    studyAhead: false,
  };

  it("returns empty session when nothing is due and no new cards", () => {
    const out = buildReviewSession(baseline);
    expect(out.items).toEqual([]);
    expect(out.reviewItems).toBe(0);
    expect(out.newItems).toBe(0);
  });

  it("hydrates due flashcards + questions in the order they were given", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [
        { itemKey: "flashcard:1" },
        { itemKey: "question:2" },
        { itemKey: "flashcard:3" },
      ],
      flashcardById: new Map([[1, fc(1)], [3, fc(3)]]),
      questionById: new Map([[2, q(2)]]),
    });
    expect(out.items.length).toBe(3);
    expect(out.items[0].kind).toBe("flashcard");
    expect(out.items[1].kind).toBe("question");
    expect(out.items[2].kind).toBe("flashcard");
    expect(out.reviewItems).toBe(3);
    expect(out.newItems).toBe(0);
    // All review items carry isNew=false
    expect(out.items.every((i) => i.isNew === false)).toBe(true);
  });

  it("skips due rows whose item has been deleted (hydration miss)", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [
        { itemKey: "flashcard:1" },
        { itemKey: "flashcard:999" }, // not in hydration map
        { itemKey: "question:2" },
      ],
      flashcardById: new Map([[1, fc(1)]]),
      questionById: new Map([[2, q(2)]]),
    });
    expect(out.items.length).toBe(2);
    expect((out.items[0] as any).flashcard.id).toBe(1);
    expect((out.items[1] as any).question.id).toBe(2);
  });

  it("skips due rows with unknown itemKey shape", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [
        { itemKey: "flashcard:1" },
        { itemKey: "definition:5" }, // unknown kind
        { itemKey: "garbage" },
        { itemKey: "question:2" },
      ],
      flashcardById: new Map([[1, fc(1)]]),
      questionById: new Map([[2, q(2)]]),
    });
    expect(out.items.length).toBe(2);
  });

  it("pads with new cards when due queue is short (newQuota respected)", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [{ itemKey: "flashcard:1" }],
      flashcardById: new Map([[1, fc(1)]]),
      newFlashcards: [fc(10), fc(11), fc(12)],
      newQuestions: [q(20), q(21), q(22)],
      newQuota: 4,
      limit: 20,
    });
    // 1 review + up to 4 new items, interleaved fc→q→fc→q
    expect(out.reviewItems).toBe(1);
    expect(out.newItems).toBe(4);
    expect(out.items.length).toBe(5);
    // First item is the review, then new items alternate
    expect(out.items[0].isNew).toBe(false);
    expect(out.items[1]).toMatchObject({ kind: "flashcard", isNew: true });
    expect(out.items[2]).toMatchObject({ kind: "question", isNew: true });
    expect(out.items[3]).toMatchObject({ kind: "flashcard", isNew: true });
    expect(out.items[4]).toMatchObject({ kind: "question", isNew: true });
  });

  it("does not add new cards when the due queue already fills the limit", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [{ itemKey: "flashcard:1" }, { itemKey: "question:2" }],
      flashcardById: new Map([[1, fc(1)]]),
      questionById: new Map([[2, q(2)]]),
      newFlashcards: [fc(10)],
      newQuestions: [q(20)],
      limit: 2,
    });
    expect(out.items.length).toBe(2);
    expect(out.newItems).toBe(0);
  });

  it("hard-caps total items at `limit` even when new cards are plentiful", () => {
    const out = buildReviewSession({
      ...baseline,
      newFlashcards: Array.from({ length: 50 }, (_, i) => fc(i + 100)),
      newQuestions: Array.from({ length: 50 }, (_, i) => q(i + 200)),
      limit: 5,
      newQuota: 5,
    });
    expect(out.items.length).toBe(5);
    expect(out.newItems).toBe(5);
  });

  it("studyAhead mode ignores due queue and fills the full limit from new cards", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [{ itemKey: "flashcard:1" }], // should be ignored
      flashcardById: new Map([[1, fc(1)]]),
      newFlashcards: [fc(10), fc(11), fc(12)],
      newQuestions: [q(20), q(21), q(22)],
      limit: 4,
      newQuota: 2, // should be OVERRIDDEN by studyAhead
      studyAhead: true,
    });
    expect(out.reviewItems).toBe(0);
    expect(out.newItems).toBe(4);
    expect(out.items.every((i) => i.isNew)).toBe(true);
    expect(out.items.every((i) => !i.itemKey.startsWith("definition:"))).toBe(true);
  });

  it("interleaves new cards in fc→q→fc→q order when both lists are non-empty", () => {
    const out = buildReviewSession({
      ...baseline,
      newFlashcards: [fc(1), fc(2)],
      newQuestions: [q(10), q(11)],
      limit: 10,
      newQuota: 10,
    });
    expect(out.items.map((i) => i.kind)).toEqual([
      "flashcard",
      "question",
      "flashcard",
      "question",
    ]);
  });

  it("handles uneven new-card lists gracefully (more flashcards than questions)", () => {
    const out = buildReviewSession({
      ...baseline,
      newFlashcards: [fc(1), fc(2), fc(3)],
      newQuestions: [q(10)],
      limit: 10,
      newQuota: 10,
    });
    expect(out.items.length).toBe(4);
    expect(out.items.map((i) => i.kind)).toEqual([
      "flashcard",
      "question",
      "flashcard",
      "flashcard",
    ]);
  });

  it("carries correct isNew flags — never both in one item", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [{ itemKey: "flashcard:1" }],
      flashcardById: new Map([[1, fc(1)]]),
      newFlashcards: [fc(2)],
      newQuestions: [],
      limit: 5,
      newQuota: 5,
    });
    expect(out.items[0].isNew).toBe(false);
    expect(out.items[1].isNew).toBe(true);
  });

  it("newQuota=0 disables padding even when due is short", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [{ itemKey: "flashcard:1" }],
      flashcardById: new Map([[1, fc(1)]]),
      newFlashcards: [fc(10), fc(11)],
      newQuestions: [q(20), q(21)],
      limit: 20,
      newQuota: 0,
    });
    expect(out.items.length).toBe(1);
    expect(out.newItems).toBe(0);
  });

  it("preserves itemKey format for both existing and new items", () => {
    const out = buildReviewSession({
      ...baseline,
      due: [{ itemKey: "question:2" }],
      questionById: new Map([[2, q(2)]]),
      newFlashcards: [fc(10)],
      limit: 5,
      newQuota: 5,
    });
    expect(out.items[0].itemKey).toBe("question:2");
    expect(out.items[1].itemKey).toBe("flashcard:10");
  });
});
