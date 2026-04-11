/**
 * Unit tests for the pure helpers in `dueReview.ts`.
 *
 * The DB-aware `getDueReviewDeck` is covered by integration tests
 * (gated on DB availability). These tests lock in the itemKey parser
 * + the selector ranking semantics so the ordering guarantees can't
 * silently regress.
 */

import { describe, it, expect } from "vitest";
import {
  parseItemKey,
  buildItemKey,
  selectReviewDeck,
  masteryRowsToCandidates,
  type DeckCandidate,
} from "./dueReview";

// ─── parseItemKey ─────────────────────────────────────────────────────────

describe("learning/dueReview — parseItemKey", () => {
  it("parses bare flashcard form", () => {
    expect(parseItemKey("flashcard:42")).toEqual({ kind: "flashcard", id: 42 });
  });

  it("parses bare question form", () => {
    expect(parseItemKey("question:17")).toEqual({ kind: "question", id: 17 });
  });

  it("parses track-prefixed form and returns slug", () => {
    expect(parseItemKey("track:series7:flashcard:42")).toEqual({
      kind: "flashcard",
      id: 42,
      trackSlug: "series7",
    });
  });

  it("parses track-prefixed question", () => {
    expect(parseItemKey("track:cfp:question:9")).toEqual({
      kind: "question",
      id: 9,
      trackSlug: "cfp",
    });
  });

  it("rejects unknown kind", () => {
    expect(parseItemKey("definition:1")).toBeNull();
    expect(parseItemKey("formula:1")).toBeNull();
  });

  it("rejects non-numeric id", () => {
    expect(parseItemKey("flashcard:abc")).toBeNull();
    expect(parseItemKey("flashcard:1.5")).toBeNull();
    expect(parseItemKey("flashcard:-1")).toBeNull();
    expect(parseItemKey("flashcard:")).toBeNull();
  });

  it("rejects empty / non-string input", () => {
    expect(parseItemKey("")).toBeNull();
    expect(parseItemKey(null)).toBeNull();
    expect(parseItemKey(undefined)).toBeNull();
    expect(parseItemKey("junk")).toBeNull();
  });

  it("rejects zero id", () => {
    expect(parseItemKey("flashcard:0")).toBeNull();
  });

  it("buildItemKey round-trips via parseItemKey", () => {
    const key = buildItemKey("flashcard", 42);
    expect(key).toBe("flashcard:42");
    expect(parseItemKey(key)).toEqual({ kind: "flashcard", id: 42 });
  });
});

// ─── selectReviewDeck ─────────────────────────────────────────────────────

function cand(
  over: Partial<DeckCandidate> & Pick<DeckCandidate, "kind" | "id" | "overdueMs">,
): DeckCandidate {
  return {
    masteryId: 0,
    confidence: 0,
    lastReviewedMs: 0,
    ...over,
  };
}

describe("learning/dueReview — selectReviewDeck", () => {
  it("sorts by most-overdue first", () => {
    const deck = selectReviewDeck([
      cand({ kind: "flashcard", id: 1, overdueMs: 1_000 }),
      cand({ kind: "flashcard", id: 2, overdueMs: 10_000 }),
      cand({ kind: "flashcard", id: 3, overdueMs: 5_000 }),
    ]);
    expect(deck.map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it("breaks overdue ties by lowest confidence", () => {
    const deck = selectReviewDeck([
      cand({ kind: "flashcard", id: 1, overdueMs: 1_000, confidence: 3 }),
      cand({ kind: "flashcard", id: 2, overdueMs: 1_000, confidence: 1 }),
      cand({ kind: "flashcard", id: 3, overdueMs: 1_000, confidence: 2 }),
    ]);
    expect(deck.map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it("breaks confidence ties by oldest lastReviewed", () => {
    const deck = selectReviewDeck([
      cand({ kind: "flashcard", id: 1, overdueMs: 1, confidence: 1, lastReviewedMs: 1000 }),
      cand({ kind: "flashcard", id: 2, overdueMs: 1, confidence: 1, lastReviewedMs: 500 }),
      cand({ kind: "flashcard", id: 3, overdueMs: 1, confidence: 1, lastReviewedMs: 100 }),
    ]);
    expect(deck.map((d) => d.id)).toEqual([3, 2, 1]);
  });

  it("breaks all ties with kind (flashcard first) then id", () => {
    const deck = selectReviewDeck([
      cand({ kind: "question", id: 2, overdueMs: 0 }),
      cand({ kind: "flashcard", id: 3, overdueMs: 0 }),
      cand({ kind: "flashcard", id: 1, overdueMs: 0 }),
    ]);
    expect(deck.map((d) => `${d.kind}:${d.id}`)).toEqual([
      "flashcard:1",
      "flashcard:3",
      "question:2",
    ]);
  });

  it("clamps the deck to the provided limit", () => {
    const deck = selectReviewDeck(
      Array.from({ length: 50 }, (_, i) =>
        cand({ kind: "flashcard", id: i + 1, overdueMs: (50 - i) * 1000 }),
      ),
      { limit: 5 },
    );
    expect(deck).toHaveLength(5);
    expect(deck.map((d) => d.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("default limit is 20", () => {
    const deck = selectReviewDeck(
      Array.from({ length: 50 }, (_, i) =>
        cand({ kind: "flashcard", id: i + 1, overdueMs: 1 }),
      ),
    );
    expect(deck).toHaveLength(20);
  });

  it("limit is clamped to 1..200", () => {
    expect(selectReviewDeck([cand({ kind: "flashcard", id: 1, overdueMs: 1 })], { limit: 0 })).toHaveLength(1);
    expect(
      selectReviewDeck(
        Array.from({ length: 500 }, (_, i) => cand({ kind: "flashcard", id: i + 1, overdueMs: 1 })),
        { limit: 1000 },
      ),
    ).toHaveLength(200);
  });

  it("filters by kind when requested", () => {
    const deck = selectReviewDeck(
      [
        cand({ kind: "flashcard", id: 1, overdueMs: 10_000 }),
        cand({ kind: "question", id: 2, overdueMs: 20_000 }),
        cand({ kind: "flashcard", id: 3, overdueMs: 5_000 }),
      ],
      { kind: "flashcard" },
    );
    expect(deck.map((d) => d.id)).toEqual([1, 3]);
  });

  it("returns empty when input is empty", () => {
    expect(selectReviewDeck([])).toEqual([]);
  });

  it("is deterministic — same input produces same order across runs", () => {
    const input = [
      cand({ kind: "flashcard", id: 5, overdueMs: 100, confidence: 2 }),
      cand({ kind: "question", id: 10, overdueMs: 100, confidence: 2 }),
      cand({ kind: "flashcard", id: 3, overdueMs: 100, confidence: 2 }),
    ];
    const a = selectReviewDeck(input);
    const b = selectReviewDeck(input);
    expect(a.map((d) => `${d.kind}:${d.id}`)).toEqual(b.map((d) => `${d.kind}:${d.id}`));
  });
});

// ─── masteryRowsToCandidates ──────────────────────────────────────────────

describe("learning/dueReview — masteryRowsToCandidates", () => {
  const now = new Date("2026-04-11T12:00:00Z");
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const oneHrAgo = new Date(now.getTime() - 60 * 60 * 1000);

  it("parses and computes overdueMs from nextDue", () => {
    const got = masteryRowsToCandidates(
      [
        {
          id: 1,
          itemKey: "flashcard:10",
          confidence: 2,
          nextDue: fiveMinAgo as any,
          lastReviewed: oneHrAgo as any,
        },
      ],
      now,
    );
    expect(got).toHaveLength(1);
    expect(got[0]!.kind).toBe("flashcard");
    expect(got[0]!.id).toBe(10);
    expect(got[0]!.confidence).toBe(2);
    // 5 min in ms
    expect(got[0]!.overdueMs).toBe(5 * 60 * 1000);
  });

  it("silently drops rows with unparseable itemKey", () => {
    const got = masteryRowsToCandidates(
      [
        {
          id: 1,
          itemKey: "definition:5",
          confidence: 1,
          nextDue: fiveMinAgo as any,
          lastReviewed: null as any,
        },
        {
          id: 2,
          itemKey: "flashcard:10",
          confidence: 1,
          nextDue: fiveMinAgo as any,
          lastReviewed: null as any,
        },
      ],
      now,
    );
    expect(got).toHaveLength(1);
    expect(got[0]!.id).toBe(10);
  });

  it("clamps confidence to 0..5", () => {
    const got = masteryRowsToCandidates(
      [
        {
          id: 1,
          itemKey: "flashcard:10",
          confidence: 99 as any,
          nextDue: fiveMinAgo as any,
          lastReviewed: null as any,
        },
        {
          id: 2,
          itemKey: "flashcard:11",
          confidence: -5 as any,
          nextDue: fiveMinAgo as any,
          lastReviewed: null as any,
        },
      ],
      now,
    );
    expect(got.map((c) => c.confidence).sort()).toEqual([0, 5]);
  });

  it("handles null lastReviewed as 0", () => {
    const got = masteryRowsToCandidates(
      [
        {
          id: 1,
          itemKey: "flashcard:10",
          confidence: 1,
          nextDue: fiveMinAgo as any,
          lastReviewed: null as any,
        },
      ],
      now,
    );
    expect(got[0]!.lastReviewedMs).toBe(0);
  });
});
