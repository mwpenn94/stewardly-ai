/**
 * EMBA Learning — pure deck builder (pass 3, build loop).
 *
 * Before this pass the track-scoped flashcard + quiz runners
 * (`LearningFlashcardStudy.tsx`, `LearningQuizRunner.tsx`) iterated
 * the full deck in insertion order every time. That has three
 * failure modes:
 *
 *   1. Position bias. A learner who quits halfway only ever sees
 *      the first half of the deck. The second half stays invisible.
 *   2. Same order every run. Learners get habituated to "term → the
 *      card I just saw" instead of actually memorizing the meaning.
 *   3. No session cap. If a track has 200 flashcards, the runner
 *      loads 200 and offers no off-ramp. This is both a UX and a
 *      pedagogy problem (20-minute focused sessions beat 2-hour
 *      marathons for retention).
 *
 * This module is a pure (no React, no DOM) deck-composition helper
 * that solves all three:
 *
 *   - Fisher-Yates shuffle driven by a seedable PRNG so tests can
 *     lock in ordering and learners can reproduce a session by id.
 *   - `buildStudyDeck` caps at a session size with sane defaults.
 *   - Three modes: `sequential` (insertion order, matching the old
 *     behavior), `shuffle` (seeded random), `weakest` (requires
 *     mastery data — sorts lowest confidence first, then shuffles
 *     ties).
 *
 * Zero dependencies, fully pure, O(n) everywhere.
 */

// ─── Seedable PRNG (mulberry32) ──────────────────────────────────────────
//
// Mulberry32 is a tiny 32-bit PRNG with good statistical quality for
// shuffling. We use it instead of `Math.random` so tests can pin the
// RNG and so users can paste a session id and reproduce a shuffle.

export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let state = (seed | 0) + 0x6d2b79f5;
  return function next() {
    let t = (state = (state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Return a deterministic seed from a string. Cheap djb2 hash — good
 * enough for session-id → seed conversion. Zero allocations.
 */
export function seedFromString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0;
}

// ─── Fisher-Yates shuffle ────────────────────────────────────────────────

/**
 * In-place-style Fisher-Yates. Returns a *new* array; the input is
 * not mutated so the function is safe to call from React state.
 */
export function shuffle<T>(items: readonly T[], rng: RNG = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

// ─── Mastery plumbing ────────────────────────────────────────────────────

/** Minimal mastery shape the builder needs — a subset of LearningMastery. */
export interface MasteryLite {
  itemKey: string;
  confidence: number | null;
  mastered?: boolean;
}

/**
 * Build a `itemKey → confidence` lookup so `weakest` mode can score
 * items without re-parsing per-call.
 */
export function buildMasteryLookup(rows: readonly MasteryLite[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!r.itemKey) continue;
    out.set(r.itemKey, Math.max(0, Math.min(5, r.confidence ?? 0)));
  }
  return out;
}

// ─── Deck builder ────────────────────────────────────────────────────────

export type StudyMode = "sequential" | "shuffle" | "weakest";

export interface DeckBuilderOptions {
  /** Max deck size. Default 20. Clamped 1..500. `0` or negative → defaults. */
  limit?: number;
  /** Ordering mode. Default "shuffle". */
  mode?: StudyMode;
  /**
   * Optional seed — a string (session id) or number. If omitted in
   * "shuffle" / "weakest" modes, uses `Math.random` so every open
   * produces a fresh order.
   */
  seed?: string | number;
  /**
   * Mastery lookup (itemKey → confidence). Required for `weakest`
   * mode; ignored otherwise. If absent in weakest mode, the builder
   * silently falls back to shuffle.
   */
  masteryLookup?: Map<string, number>;
  /**
   * Function to derive an itemKey from a raw item — used to look up
   * mastery for weakest mode. Default: `item => "flashcard:" + item.id`.
   */
  itemKeyOf?: (item: any) => string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;

function clampLimit(raw: number | undefined): number {
  const n = raw == null || raw <= 0 ? DEFAULT_LIMIT : Math.floor(raw);
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

function resolveRng(seed: string | number | undefined): RNG {
  if (seed == null) return Math.random;
  const n = typeof seed === "number" ? seed : seedFromString(seed);
  return mulberry32(n);
}

/**
 * Build a ranked + capped study deck.
 *
 * Modes:
 *
 *   - `sequential` → keeps the input order, caps at `limit`. Matches
 *     the pre-pass-3 behavior; useful for users who want to grind
 *     through a known order.
 *
 *   - `shuffle` → Fisher-Yates with the seeded PRNG, then caps.
 *     Default mode. Same seed produces the same order every run.
 *
 *   - `weakest` → orders by lowest-confidence-first (items the user
 *     hasn't touched get confidence=0 → top), then shuffles within
 *     each confidence bucket so ties don't get position bias, then
 *     caps. Requires `masteryLookup`; falls back to `shuffle` if
 *     missing or if every item has confidence 5.
 *
 * Pure, deterministic given the same seed.
 */
export function buildStudyDeck<T>(
  items: readonly T[],
  opts: DeckBuilderOptions = {},
): T[] {
  const limit = clampLimit(opts.limit);
  if (items.length === 0) return [];
  const mode: StudyMode = opts.mode ?? "shuffle";
  const rng = resolveRng(opts.seed);

  switch (mode) {
    case "sequential": {
      return items.slice(0, limit);
    }

    case "weakest": {
      const lookup = opts.masteryLookup;
      if (!lookup || lookup.size === 0) {
        return shuffle(items, rng).slice(0, limit);
      }
      const itemKeyOf = opts.itemKeyOf ?? ((i: any) => `flashcard:${i?.id}`);

      // Bucket by confidence 0..5 (missing rows default to 0 — unseen
      // material is treated as weakest).
      const buckets: T[][] = [[], [], [], [], [], []];
      for (const item of items) {
        const k = itemKeyOf(item as any);
        const conf = lookup.get(k) ?? 0;
        const idx = Math.max(0, Math.min(5, conf));
        buckets[idx]!.push(item);
      }
      // Shuffle each bucket independently using the seeded RNG so ties
      // don't get deterministic "first-id-wins" position bias. Then
      // concat from lowest to highest confidence.
      const ordered: T[] = [];
      for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i]!;
        if (bucket.length > 1) ordered.push(...shuffle(bucket, rng));
        else ordered.push(...bucket);
      }
      return ordered.slice(0, limit);
    }

    case "shuffle":
    default: {
      return shuffle(items, rng).slice(0, limit);
    }
  }
}

// ─── Helpers used by UI ──────────────────────────────────────────────────

/**
 * Build a human-readable session label for the deck configure card.
 * Pure so tests can assert string shape.
 */
export function formatSessionLabel(
  total: number,
  limit: number,
  mode: StudyMode,
): string {
  const n = Math.min(total, clampLimit(limit));
  const modeLabel =
    mode === "weakest"
      ? "weakest first"
      : mode === "sequential"
        ? "in order"
        : "shuffled";
  return `${n} of ${total} · ${modeLabel}`;
}
