/**
 * EMBA Learning — cross-track SRS due-review service.
 *
 * Problem this module solves: `learning.mastery.dueNow` returns a list
 * of `learning_mastery_progress` rows whose `nextDue <= now`, but the
 * rows only carry the synthetic `itemKey` strings the flashcard and
 * quiz runners write (`flashcard:<id>`, `question:<id>`). Without
 * hydration the client can only show a count — it cannot actually
 * start a review session.
 *
 * This service parses those itemKeys, joins them against
 * `learning_flashcards` / `learning_practice_questions`, folds in the
 * track name, and returns a ranked mixed deck the client can page
 * through.
 *
 * Key design decisions:
 *
 *   1. Pure parser (`parseItemKey`) so the itemKey → {type, id}
 *      mapping is unit-testable in isolation. It accepts every format
 *      we have ever written: `flashcard:42`, `question:17`, and the
 *      track-prefixed `track:series7:flashcard:42` form left room for
 *      future migrations without breaking existing data.
 *
 *   2. Pure selector (`selectReviewDeck`) so the mix/order/cap logic
 *      is independent of the DB layer. The selector sorts by most
 *      overdue first (largest positive `overdueMs`), breaks ties by
 *      lowest confidence, and caps at a configurable deck size.
 *
 *   3. Graceful degradation — missing content rows (deleted between
 *      review time and hydration) are filtered out silently rather
 *      than thrown. The SRS row survives so the confidence isn't
 *      destroyed; it just doesn't surface until the content comes
 *      back.
 *
 *   4. Zero schema changes. Everything here reads existing tables.
 *      The itemKey format on future writes can migrate at leisure.
 */

import { getDb } from "../../db";
import {
  learningMasteryProgress,
  learningFlashcards,
  learningPracticeQuestions,
  learningTracks,
  type LearningMastery,
} from "../../../drizzle/schema";
import { and, eq, inArray, lte } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/dueReview" });

// ─── Pure helpers ─────────────────────────────────────────────────────────

export type ReviewItemKind = "flashcard" | "question";

export interface ParsedItemKey {
  kind: ReviewItemKind;
  id: number;
  /** Optional track slug if the key was stored in the richer format. */
  trackSlug?: string;
}

/**
 * Pure. Parse a mastery `itemKey` into `{kind, id, trackSlug?}`. Returns
 * `null` on anything unrecognized (unknown kind, non-numeric id, empty
 * string). Accepted shapes:
 *
 *   flashcard:42
 *   question:17
 *   track:series7:flashcard:42
 *   track:series-7:question:17
 *
 * Track slugs are passed through verbatim minus surrounding colons;
 * callers that need canonicalization should slugify before compare.
 */
export function parseItemKey(raw: string | null | undefined): ParsedItemKey | null {
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split(":");
  if (parts.length < 2) return null;

  // Track-prefixed form: `track:<slug>:<kind>:<id>`
  if (parts[0] === "track" && parts.length >= 4) {
    const trackSlug = parts[1];
    const kindPart = parts[2];
    const idPart = parts[3];
    const kind = toKind(kindPart);
    const id = toId(idPart);
    if (!kind || id == null) return null;
    return { kind, id, trackSlug: trackSlug || undefined };
  }

  // Bare form: `<kind>:<id>`
  const kind = toKind(parts[0]);
  const id = toId(parts[1]);
  if (!kind || id == null) return null;
  return { kind, id };
}

function toKind(raw: string | undefined): ReviewItemKind | null {
  if (raw === "flashcard" || raw === "question") return raw;
  return null;
}

function toId(raw: string | undefined): number | null {
  if (!raw) return null;
  // Reject negative / floating / non-numeric — mastery PK is a positive int.
  if (!/^[0-9]+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Pure. Build the itemKey the runners write today for a given kind/id. */
export function buildItemKey(kind: ReviewItemKind, id: number): string {
  return `${kind}:${id}`;
}

// ─── Selector (pure) ─────────────────────────────────────────────────────

export interface DeckCandidate {
  kind: ReviewItemKind;
  id: number;
  masteryId: number;
  confidence: number;
  /** Positive = overdue (nextDue is in the past). */
  overdueMs: number;
  /** Milliseconds since epoch. 0 if unknown. */
  lastReviewedMs: number;
}

export interface SelectorOptions {
  /** Hard cap for the deck. Default 20. Clamped 1..200. */
  limit?: number;
  /** Optional kind filter if the caller only wants flashcards or questions. */
  kind?: ReviewItemKind;
}

/**
 * Pure. Given raw candidate rows (already filtered to `nextDue <= now`
 * at the DB level), rank them for the current review session.
 *
 * Ranking rules:
 *
 *   1. Largest `overdueMs` first — highest memory-decay pressure.
 *   2. Break ties by lowest confidence (weaker material gets more air
 *      time).
 *   3. Then oldest `lastReviewedMs` (longest since last touched).
 *   4. Finally kind then id, for deterministic output under tests.
 *
 * The selector then applies the optional `kind` filter and clamps to
 * `limit`. Deterministic for a given input.
 */
export function selectReviewDeck(
  candidates: DeckCandidate[],
  opts: SelectorOptions = {},
): DeckCandidate[] {
  const limit = Math.max(1, Math.min(200, Math.floor(opts.limit ?? 20)));
  const filtered = opts.kind
    ? candidates.filter((c) => c.kind === opts.kind)
    : candidates;
  const sorted = [...filtered].sort((a, b) => {
    if (b.overdueMs !== a.overdueMs) return b.overdueMs - a.overdueMs;
    if (a.confidence !== b.confidence) return a.confidence - b.confidence;
    if (a.lastReviewedMs !== b.lastReviewedMs)
      return a.lastReviewedMs - b.lastReviewedMs;
    if (a.kind !== b.kind) return a.kind === "flashcard" ? -1 : 1;
    return a.id - b.id;
  });
  return sorted.slice(0, limit);
}

/**
 * Pure. Convert mastery rows into parsed `DeckCandidate`s, skipping
 * rows whose itemKey does not parse into a supported kind.
 */
export function masteryRowsToCandidates(
  rows: Array<Pick<LearningMastery, "id" | "itemKey" | "confidence" | "nextDue" | "lastReviewed">>,
  now: Date = new Date(),
): DeckCandidate[] {
  const nowMs = now.getTime();
  const out: DeckCandidate[] = [];
  for (const r of rows) {
    const parsed = parseItemKey(r.itemKey);
    if (!parsed) continue;
    const nextDueMs = r.nextDue ? new Date(r.nextDue as any).getTime() : nowMs;
    const lastReviewedMs = r.lastReviewed
      ? new Date(r.lastReviewed as any).getTime()
      : 0;
    out.push({
      kind: parsed.kind,
      id: parsed.id,
      masteryId: r.id,
      confidence: Math.max(0, Math.min(5, r.confidence ?? 0)),
      overdueMs: nowMs - nextDueMs,
      lastReviewedMs,
    });
  }
  return out;
}

// ─── Hydration (DB-aware) ─────────────────────────────────────────────────

export interface HydratedFlashcard {
  kind: "flashcard";
  masteryId: number;
  itemKey: string;
  confidence: number;
  overdueMs: number;
  card: {
    id: number;
    term: string;
    definition: string;
    trackId: number | null;
    trackSlug: string | null;
    trackName: string | null;
  };
}

export interface HydratedQuestion {
  kind: "question";
  masteryId: number;
  itemKey: string;
  confidence: number;
  overdueMs: number;
  question: {
    id: number;
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string | null;
    difficulty: "easy" | "medium" | "hard";
    trackId: number | null;
    trackSlug: string | null;
    trackName: string | null;
  };
}

export type HydratedReviewItem = HydratedFlashcard | HydratedQuestion;

export interface DueReviewResponse {
  items: HydratedReviewItem[];
  counts: {
    totalDue: number;
    returned: number;
    flashcards: number;
    questions: number;
    unresolved: number;
  };
  generatedAt: string;
}

/**
 * Fetch every `nextDue <= now` mastery row for the user, hydrate the
 * referenced flashcards / questions with track metadata, rank via
 * `selectReviewDeck`, and return a ready-to-play mixed deck.
 *
 * `opts.limit` clamps the final deck size (default 20). `opts.kind`
 * restricts to flashcards or questions only.
 */
export async function getDueReviewDeck(
  userId: number,
  opts: SelectorOptions = {},
): Promise<DueReviewResponse> {
  const generatedAt = new Date().toISOString();
  const db = await getDb();
  if (!db) {
    return {
      items: [],
      counts: { totalDue: 0, returned: 0, flashcards: 0, questions: 0, unresolved: 0 },
      generatedAt,
    };
  }

  // 1. Read every mastery row that's due right now.
  let dueRows: LearningMastery[] = [];
  try {
    dueRows = await db
      .select()
      .from(learningMasteryProgress)
      .where(
        and(
          eq(learningMasteryProgress.userId, userId),
          lte(learningMasteryProgress.nextDue, new Date()),
        ),
      );
  } catch (err) {
    log.warn({ err: String(err), userId }, "getDueReviewDeck mastery read failed");
    return {
      items: [],
      counts: { totalDue: 0, returned: 0, flashcards: 0, questions: 0, unresolved: 0 },
      generatedAt,
    };
  }

  // 2. Rank via the pure selector. We rank the *entire* due set first
  //    so the `limit` always picks the most overdue/weakest items
  //    regardless of insertion order.
  const allCandidates = masteryRowsToCandidates(dueRows);
  const ranked = selectReviewDeck(allCandidates, opts);

  // 3. Hydrate. Batch by kind to keep the query count at 2.
  const flashcardIds = ranked.filter((c) => c.kind === "flashcard").map((c) => c.id);
  const questionIds = ranked.filter((c) => c.kind === "question").map((c) => c.id);

  const [flashcardRows, questionRows] = await Promise.all([
    flashcardIds.length > 0
      ? db
          .select()
          .from(learningFlashcards)
          .where(inArray(learningFlashcards.id, flashcardIds))
          .catch((err: unknown) => {
            log.warn({ err: String(err) }, "hydrate flashcards failed");
            return [] as any[];
          })
      : Promise.resolve([] as any[]),
    questionIds.length > 0
      ? db
          .select()
          .from(learningPracticeQuestions)
          .where(inArray(learningPracticeQuestions.id, questionIds))
          .catch((err: unknown) => {
            log.warn({ err: String(err) }, "hydrate questions failed");
            return [] as any[];
          })
      : Promise.resolve([] as any[]),
  ]);

  // 4. Look up track metadata in a single query per unique track id so
  //    we can show "Series 7 · Ethics" in the deck header.
  const trackIds = Array.from(
    new Set(
      [...(flashcardRows as any[]), ...(questionRows as any[])]
        .map((r) => r.trackId)
        .filter((id): id is number => typeof id === "number"),
    ),
  );
  const trackById = new Map<
    number,
    { id: number; slug: string | null; name: string | null }
  >();
  if (trackIds.length > 0) {
    try {
      const trackRows = await db
        .select({
          id: learningTracks.id,
          slug: learningTracks.slug,
          name: learningTracks.name,
        })
        .from(learningTracks)
        .where(inArray(learningTracks.id, trackIds));
      for (const t of trackRows) {
        trackById.set(t.id, {
          id: t.id,
          slug: (t.slug as any) ?? null,
          name: (t.name as any) ?? null,
        });
      }
    } catch (err) {
      log.warn({ err: String(err) }, "hydrate tracks failed");
    }
  }

  // 5. Build the result, preserving the selector's ranked order.
  const flashcardById = new Map<number, any>();
  for (const r of flashcardRows as any[]) flashcardById.set(r.id, r);
  const questionById = new Map<number, any>();
  for (const r of questionRows as any[]) questionById.set(r.id, r);

  const items: HydratedReviewItem[] = [];
  let unresolved = 0;
  for (const c of ranked) {
    const itemKey = buildItemKey(c.kind, c.id);
    if (c.kind === "flashcard") {
      const row = flashcardById.get(c.id);
      if (!row) {
        unresolved += 1;
        continue;
      }
      const track = typeof row.trackId === "number" ? trackById.get(row.trackId) : null;
      items.push({
        kind: "flashcard",
        masteryId: c.masteryId,
        itemKey,
        confidence: c.confidence,
        overdueMs: c.overdueMs,
        card: {
          id: row.id,
          term: row.term,
          definition: row.definition,
          trackId: row.trackId ?? null,
          trackSlug: track?.slug ?? null,
          trackName: track?.name ?? null,
        },
      });
    } else {
      const row = questionById.get(c.id);
      if (!row) {
        unresolved += 1;
        continue;
      }
      const track = typeof row.trackId === "number" ? trackById.get(row.trackId) : null;
      items.push({
        kind: "question",
        masteryId: c.masteryId,
        itemKey,
        confidence: c.confidence,
        overdueMs: c.overdueMs,
        question: {
          id: row.id,
          prompt: row.prompt,
          options: Array.isArray(row.options) ? row.options : [],
          correctIndex: row.correctIndex ?? 0,
          explanation: row.explanation ?? null,
          difficulty: (row.difficulty ?? "medium") as "easy" | "medium" | "hard",
          trackId: row.trackId ?? null,
          trackSlug: track?.slug ?? null,
          trackName: track?.name ?? null,
        },
      });
    }
  }

  return {
    items,
    counts: {
      totalDue: allCandidates.length,
      returned: items.length,
      flashcards: items.filter((i) => i.kind === "flashcard").length,
      questions: items.filter((i) => i.kind === "question").length,
      unresolved,
    },
    generatedAt,
  };
}
