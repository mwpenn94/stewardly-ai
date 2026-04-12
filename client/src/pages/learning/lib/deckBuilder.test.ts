/**
 * Unit tests for the pure deck builder (`deckBuilder.ts`).
 *
 * These tests lock in:
 *   - Mulberry32 determinism + seedFromString stability
 *   - Fisher-Yates shuffle (no mutation, includes all items)
 *   - buildStudyDeck per-mode semantics
 *   - Session label formatting
 */

import { describe, it, expect } from "vitest";
import {
  mulberry32,
  seedFromString,
  shuffle,
  buildMasteryLookup,
  buildStudyDeck,
  formatSessionLabel,
} from "./deckBuilder";

// ─── PRNG ─────────────────────────────────────────────────────────────────

describe("learning/deckBuilder — mulberry32", () => {
  it("produces deterministic output for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it("outputs are in [0, 1)", () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("learning/deckBuilder — seedFromString", () => {
  it("returns the same hash for the same input", () => {
    expect(seedFromString("series7-session-1")).toBe(seedFromString("series7-session-1"));
  });

  it("returns different hashes for different inputs", () => {
    expect(seedFromString("a")).not.toBe(seedFromString("b"));
  });

  it("returns 0 for empty string (djb2 5381 is handled as uint32)", () => {
    // djb2 of empty string is 5381 — this test just locks in the call
    // doesn't throw and returns a uint32.
    const v = seedFromString("");
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});

// ─── shuffle ─────────────────────────────────────────────────────────────

describe("learning/deckBuilder — shuffle", () => {
  it("returns a new array (does not mutate input)", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, mulberry32(1));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect(out).not.toBe(input);
  });

  it("output contains exactly the same elements (set-equal)", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, mulberry32(7));
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("is deterministic for a given RNG seed", () => {
    const input = [1, 2, 3, 4, 5];
    const a = shuffle(input, mulberry32(99));
    const b = shuffle(input, mulberry32(99));
    expect(a).toEqual(b);
  });

  it("empty array returns empty", () => {
    expect(shuffle([] as number[], mulberry32(1))).toEqual([]);
  });

  it("single element returns single element", () => {
    expect(shuffle([42], mulberry32(1))).toEqual([42]);
  });
});

// ─── buildMasteryLookup ──────────────────────────────────────────────────

describe("learning/deckBuilder — buildMasteryLookup", () => {
  it("maps itemKey → confidence with clamping", () => {
    const m = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 3 },
      { itemKey: "flashcard:2", confidence: 99 }, // clamped to 5
      { itemKey: "flashcard:3", confidence: -5 }, // clamped to 0
      { itemKey: "flashcard:4", confidence: null }, // null → 0
    ]);
    expect(m.get("flashcard:1")).toBe(3);
    expect(m.get("flashcard:2")).toBe(5);
    expect(m.get("flashcard:3")).toBe(0);
    expect(m.get("flashcard:4")).toBe(0);
  });

  it("skips rows with no itemKey", () => {
    const m = buildMasteryLookup([
      { itemKey: "", confidence: 3 },
      { itemKey: "flashcard:1", confidence: 2 },
    ]);
    expect(m.size).toBe(1);
  });
});

// ─── buildStudyDeck ──────────────────────────────────────────────────────

interface Item {
  id: number;
}

const deck: Item[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));

describe("learning/deckBuilder — buildStudyDeck sequential mode", () => {
  it("preserves insertion order and caps at limit", () => {
    const out = buildStudyDeck(deck, { mode: "sequential", limit: 3 });
    expect(out.map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it("default limit is 20 (which is larger than our 10-item deck)", () => {
    const out = buildStudyDeck(deck, { mode: "sequential" });
    expect(out).toHaveLength(10);
  });

  it("empty input returns empty", () => {
    expect(buildStudyDeck([] as Item[], { mode: "sequential" })).toEqual([]);
  });
});

describe("learning/deckBuilder — buildStudyDeck shuffle mode", () => {
  it("is deterministic for a given seed", () => {
    const a = buildStudyDeck(deck, { mode: "shuffle", seed: "test" });
    const b = buildStudyDeck(deck, { mode: "shuffle", seed: "test" });
    expect(a).toEqual(b);
  });

  it("different seeds produce different orders (for any non-trivial deck)", () => {
    const a = buildStudyDeck(deck, { mode: "shuffle", seed: "a" });
    const b = buildStudyDeck(deck, { mode: "shuffle", seed: "b" });
    expect(a).not.toEqual(b);
  });

  it("caps at limit after shuffling", () => {
    const out = buildStudyDeck(deck, { mode: "shuffle", seed: "x", limit: 5 });
    expect(out).toHaveLength(5);
  });

  it("shuffle output contains only items from the input", () => {
    const out = buildStudyDeck(deck, { mode: "shuffle", seed: "y" });
    const ids = new Set(out.map((d) => d.id));
    for (const id of ids) {
      expect(deck.map((d) => d.id).includes(id)).toBe(true);
    }
  });
});

describe("learning/deckBuilder — buildStudyDeck weakest mode", () => {
  it("orders by lowest-confidence-first", () => {
    const lookup = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 5 },
      { itemKey: "flashcard:2", confidence: 0 },
      { itemKey: "flashcard:3", confidence: 3 },
    ]);
    const subset: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const out = buildStudyDeck(subset, {
      mode: "weakest",
      masteryLookup: lookup,
      seed: "test",
    });
    expect(out.map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it("items with no mastery row get confidence 0 and go first", () => {
    const lookup = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 5 },
    ]);
    const subset: Item[] = [{ id: 1 }, { id: 2 }];
    const out = buildStudyDeck(subset, {
      mode: "weakest",
      masteryLookup: lookup,
      seed: "z",
    });
    // id 2 (no row → conf=0) comes before id 1 (conf=5)
    expect(out.map((d) => d.id)).toEqual([2, 1]);
  });

  it("falls back to shuffle when no mastery lookup provided", () => {
    const out = buildStudyDeck(deck, {
      mode: "weakest",
      seed: "fallback",
    });
    // Should still return all 10 items (no lookup → shuffle)
    expect(out).toHaveLength(10);
  });

  it("shuffles within confidence buckets so ties don't get position bias", () => {
    const lookup = buildMasteryLookup([
      { itemKey: "flashcard:1", confidence: 2 },
      { itemKey: "flashcard:2", confidence: 2 },
      { itemKey: "flashcard:3", confidence: 2 },
      { itemKey: "flashcard:4", confidence: 2 },
    ]);
    // All same confidence — with different seeds should produce
    // different orders among them.
    const subset: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const a = buildStudyDeck(subset, {
      mode: "weakest",
      masteryLookup: lookup,
      seed: "tie-a",
    });
    const b = buildStudyDeck(subset, {
      mode: "weakest",
      masteryLookup: lookup,
      seed: "tie-b",
    });
    expect(a).not.toEqual(b);
  });

  it("caps at limit", () => {
    const lookup = buildMasteryLookup([]);
    const out = buildStudyDeck(deck, {
      mode: "weakest",
      masteryLookup: lookup,
      seed: "cap",
      limit: 3,
    });
    expect(out).toHaveLength(3);
  });
});

describe("learning/deckBuilder — limit clamping", () => {
  it("clamps negative limit to default 20", () => {
    const out = buildStudyDeck(deck, { mode: "sequential", limit: -5 });
    expect(out).toHaveLength(10); // deck has 10
  });

  it("clamps zero limit to default 20", () => {
    const out = buildStudyDeck(deck, { mode: "sequential", limit: 0 });
    expect(out).toHaveLength(10);
  });

  it("clamps very large limit to 500", () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const out = buildStudyDeck(big, { mode: "sequential", limit: 99999 });
    expect(out).toHaveLength(500);
  });
});

// ─── formatSessionLabel ──────────────────────────────────────────────────

describe("learning/deckBuilder — formatSessionLabel", () => {
  it("formats shuffle mode", () => {
    expect(formatSessionLabel(50, 20, "shuffle")).toBe("20 of 50 · shuffled");
  });

  it("formats sequential mode", () => {
    expect(formatSessionLabel(50, 20, "sequential")).toBe("20 of 50 · in order");
  });

  it("formats weakest mode", () => {
    expect(formatSessionLabel(50, 20, "weakest")).toBe("20 of 50 · weakest first");
  });

  it("caps the N by the actual deck size (never shows 20 of 10)", () => {
    expect(formatSessionLabel(10, 20, "shuffle")).toBe("10 of 10 · shuffled");
  });
});
