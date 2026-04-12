/**
 * EMBA Learning — Spaced Repetition System (SRS) mastery service.
 *
 * Ports the EMBA Knowledge Explorer `MasteryContext` into a DB-backed
 * server module. Confidence scale is 0-5 (EMBA convention). The
 * `scheduleNextReview` helper is pure and unit-tested.
 */

import { getDb } from "../../db";
import {
  learningMasteryProgress,
  learningFlashcards,
  learningPracticeQuestions,
  type LearningMastery,
} from "../../../drizzle/schema";
import { and, asc, eq, lte, notInArray, sql } from "drizzle-orm";
import { logger } from "../../_core/logger";
import {
  getTrackBySlug,
  listFlashcardsForTrack,
  listQuestionsForTrack,
} from "./content";

const log = logger.child({ module: "learning/mastery" });

// ─── Pure helpers ─────────────────────────────────────────────────────────

const INTERVALS_DAYS: Record<number, number> = {
  0: 0,   // immediately
  1: 1,   // 1 day
  2: 3,   // 3 days
  3: 7,   // 1 week
  4: 14,  // 2 weeks
  5: 30,  // 1 month
};

/**
 * Pure: given a current confidence level (0-5) and a review outcome
 * (correct/incorrect), return the new confidence and the next-due date.
 * This is the SRS heart — adapted from EMBA's MasteryContext logic.
 */
export function scheduleNextReview(
  currentConfidence: number,
  correct: boolean,
  now = new Date(),
): { confidence: number; nextDue: Date; mastered: boolean } {
  let confidence = Math.max(0, Math.min(5, currentConfidence));
  if (correct) {
    confidence = Math.min(5, confidence + 1);
  } else {
    // Halve confidence, minimum 0, on incorrect — classic SM-style lapse.
    confidence = Math.max(0, Math.floor(confidence / 2));
  }
  const days = INTERVALS_DAYS[confidence] ?? 1;
  const nextDue = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return {
    confidence,
    nextDue,
    mastered: confidence >= 4,
  };
}

// ─── DB operations ────────────────────────────────────────────────────────

export async function getUserMastery(userId: number): Promise<LearningMastery[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(learningMasteryProgress).where(eq(learningMasteryProgress.userId, userId));
  } catch (err) {
    log.warn({ err: String(err) }, "getUserMastery failed");
    return [];
  }
}

export async function upsertMastery(data: {
  userId: number;
  itemKey: string;
  itemType: string;
  correct: boolean;
}): Promise<LearningMastery | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    // Read current row (if any)
    const [existing] = await db
      .select()
      .from(learningMasteryProgress)
      .where(and(eq(learningMasteryProgress.userId, data.userId), eq(learningMasteryProgress.itemKey, data.itemKey)));

    const next = scheduleNextReview(existing?.confidence ?? 0, data.correct);

    if (existing) {
      await db
        .update(learningMasteryProgress)
        .set({
          seen: existing.seen + 1,
          reviewCount: existing.reviewCount + 1,
          confidence: next.confidence,
          mastered: next.mastered,
          lastReviewed: new Date(),
          nextDue: next.nextDue,
        } as any)
        .where(eq(learningMasteryProgress.id, existing.id));
      return { ...existing, confidence: next.confidence, mastered: next.mastered } as LearningMastery;
    } else {
      const [row] = await db.insert(learningMasteryProgress).values({
        userId: data.userId,
        itemKey: data.itemKey,
        itemType: data.itemType,
        seen: 1,
        reviewCount: 1,
        confidence: next.confidence,
        mastered: next.mastered,
        lastReviewed: new Date(),
        nextDue: next.nextDue,
      });
      return { id: row.insertId } as any;
    }
  } catch (err) {
    log.warn({ err: String(err) }, "upsertMastery failed");
    return null;
  }
}

export async function batchUpsertMastery(
  userId: number,
  items: Array<{ itemKey: string; itemType: string; correct: boolean }>,
): Promise<number> {
  let ok = 0;
  for (const item of items) {
    const r = await upsertMastery({ userId, ...item });
    if (r) ok += 1;
  }
  return ok;
}

/**
 * Returns mastery rows whose `nextDue` is at or before now, ordered by
 * `nextDue` ASC — the most-overdue item first. This is the correct SRS
 * behavior: when the learner opens a review session, the item their memory
 * has been decaying on the longest should be reviewed first. The previous
 * implementation sorted DESC which surfaced the near-future items first.
 */
export async function getDueItems(userId: number, limit = 50): Promise<LearningMastery[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(learningMasteryProgress)
      .where(
        and(
          eq(learningMasteryProgress.userId, userId),
          lte(learningMasteryProgress.nextDue, new Date()),
        ),
      )
      .orderBy(asc(learningMasteryProgress.nextDue))
      .limit(limit);
  } catch (err) {
    log.warn({ err: String(err) }, "getDueItems failed");
    return [];
  }
}

/**
 * Pure: given a mastery row's `itemKey`, parse it into a stable shape the
 * review-session UI can use to route the item to the flashcard renderer or
 * the quiz renderer. Keys follow the convention `<type>:<id>` set by the
 * flashcard / quiz study pages.
 */
export function parseItemKey(itemKey: string): { kind: "flashcard" | "question" | "unknown"; id: number | null } {
  const m = /^(flashcard|question):(\d+)$/.exec(itemKey);
  if (!m) return { kind: "unknown", id: null };
  return { kind: m[1] as "flashcard" | "question", id: Number(m[2]) };
}

// ─── Pure review-session builder ─────────────────────────────────────────
// Pass 4 extracted the `dueReview` tRPC procedure's core logic into a
// pure function so it can be unit-tested without spinning up a DB. The
// function takes already-hydrated due items + already-listed new items
// and produces the final interleaved + padded session list. The router
// in `server/routers/learning.ts` is now a thin DB shim around this.

export interface ReviewSessionFlashcard {
  id: number;
  term: string;
  definition: string;
}

export interface ReviewSessionQuestion {
  id: number;
  prompt: string;
  options: unknown;
  correctIndex: number | null;
  explanation: string | null;
  difficulty: "easy" | "medium" | "hard";
}

export type ReviewSessionItem =
  | { kind: "flashcard"; itemKey: string; flashcard: ReviewSessionFlashcard; isNew: boolean }
  | { kind: "question"; itemKey: string; question: ReviewSessionQuestion; isNew: boolean };

export interface BuildReviewSessionInput {
  /** Mastery rows sorted most-overdue-first. */
  due: Array<{ itemKey: string }>;
  /** Hydrated flashcards keyed by id — must include every flashcard referenced by `due`. */
  flashcardById: Map<number, ReviewSessionFlashcard>;
  /** Hydrated questions keyed by id — must include every question referenced by `due`. */
  questionById: Map<number, ReviewSessionQuestion>;
  /** Candidate new flashcards the user has never seen (empty when studyAhead=false + due is full). */
  newFlashcards: ReviewSessionFlashcard[];
  /** Candidate new questions the user has never seen. */
  newQuestions: ReviewSessionQuestion[];
  /** Maximum number of items in the final session. */
  limit: number;
  /** Maximum number of new items to pad in when `studyAhead=false` and due is short. */
  newQuota: number;
  /** If true, ONLY return new items (ignore due). */
  studyAhead: boolean;
}

/**
 * Pure: assemble the final review session list. First drains the due
 * queue (if not `studyAhead`), then pads with new cards interleaved
 * flashcard → question → flashcard → question so the session has a
 * rhythm instead of front-loading one modality. Total is capped at
 * `limit`. In `studyAhead` mode, the due queue is ignored and the
 * full `limit` is filled from new cards.
 */
export function buildReviewSession(input: BuildReviewSessionInput): {
  items: ReviewSessionItem[];
  reviewItems: number;
  newItems: number;
} {
  const { due, flashcardById, questionById, newFlashcards, newQuestions, limit, newQuota, studyAhead } = input;
  const items: ReviewSessionItem[] = [];

  if (!studyAhead) {
    for (const row of due) {
      if (items.length >= limit) break;
      const parsed = parseItemKey(row.itemKey);
      if (parsed.kind === "flashcard" && parsed.id != null) {
        const fc = flashcardById.get(parsed.id);
        if (fc) items.push({ kind: "flashcard", itemKey: row.itemKey, flashcard: fc, isNew: false });
      } else if (parsed.kind === "question" && parsed.id != null) {
        const q = questionById.get(parsed.id);
        if (q) items.push({ kind: "question", itemKey: row.itemKey, question: q, isNew: false });
      }
    }
  }

  const canAddNew = studyAhead
    ? Math.max(0, limit - items.length)
    : Math.max(0, Math.min(newQuota, limit - items.length));
  if (canAddNew > 0) {
    const maxPair = Math.max(newFlashcards.length, newQuestions.length);
    let newAdded = 0;
    for (let i = 0; i < maxPair; i++) {
      if (newAdded >= canAddNew) break;
      if (items.length >= limit) break;
      if (i < newFlashcards.length) {
        const fc = newFlashcards[i];
        items.push({
          kind: "flashcard",
          itemKey: `flashcard:${fc.id}`,
          flashcard: fc,
          isNew: true,
        });
        newAdded += 1;
        if (newAdded >= canAddNew) break;
        if (items.length >= limit) break;
      }
      if (i < newQuestions.length) {
        const q = newQuestions[i];
        items.push({
          kind: "question",
          itemKey: `question:${q.id}`,
          question: q,
          isNew: true,
        });
        newAdded += 1;
      }
    }
  }

  const newItems = items.filter((i) => i.isNew).length;
  return {
    items,
    reviewItems: items.length - newItems,
    newItems,
  };
}

/**
 * Returns the set of `itemKey`s already in the user's mastery table.
 * Used by the `listNewFlashcards` / `listNewQuestions` helpers below to
 * exclude items the user has already seen, so the Review session's
 * "new card queue" only surfaces genuinely new material.
 */
export async function getSeenItemKeys(userId: number): Promise<Set<string>> {
  const db = await getDb();
  if (!db) return new Set();
  try {
    const rows = await db
      .select({ itemKey: learningMasteryProgress.itemKey })
      .from(learningMasteryProgress)
      .where(eq(learningMasteryProgress.userId, userId));
    return new Set(rows.map((r) => r.itemKey));
  } catch (err) {
    log.warn({ err: String(err) }, "getSeenItemKeys failed");
    return new Set();
  }
}

/**
 * Returns at most `limit` published flashcards the user has NEVER
 * reviewed. This powers the "new card queue" in the Review session —
 * without it, a fresh user with 366 imported flashcards sees nothing
 * to review because the mastery table is empty and `getDueItems`
 * only surfaces items that already have a past `nextDue`. Anki and
 * every other SRS ships with a new-card queue; this brings Stewardly
 * to parity.
 */
export async function listNewFlashcards(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [] as Array<{ id: number; term: string; definition: string; trackId: number | null }>;
  try {
    const seen = await getSeenItemKeys(userId);
    const seenFlashcardIds = Array.from(seen)
      .map((k) => parseItemKey(k))
      .filter((p) => p.kind === "flashcard" && p.id != null)
      .map((p) => p.id as number);

    const conds: any[] = [eq(learningFlashcards.status, "published")];
    if (seenFlashcardIds.length > 0) {
      conds.push(notInArray(learningFlashcards.id, seenFlashcardIds));
    }
    return await db
      .select({
        id: learningFlashcards.id,
        term: learningFlashcards.term,
        definition: learningFlashcards.definition,
        trackId: learningFlashcards.trackId,
      })
      .from(learningFlashcards)
      .where(and(...conds))
      .orderBy(asc(learningFlashcards.id))
      .limit(limit);
  } catch (err) {
    log.warn({ err: String(err) }, "listNewFlashcards failed");
    return [];
  }
}

/** Mirror of `listNewFlashcards` for practice questions. */
export async function listNewQuestions(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [] as Array<{
    id: number;
    prompt: string;
    options: unknown;
    correctIndex: number | null;
    explanation: string | null;
    difficulty: "easy" | "medium" | "hard";
    trackId: number | null;
  }>;
  try {
    const seen = await getSeenItemKeys(userId);
    const seenQuestionIds = Array.from(seen)
      .map((k) => parseItemKey(k))
      .filter((p) => p.kind === "question" && p.id != null)
      .map((p) => p.id as number);

    const conds: any[] = [eq(learningPracticeQuestions.status, "published")];
    if (seenQuestionIds.length > 0) {
      conds.push(notInArray(learningPracticeQuestions.id, seenQuestionIds));
    }
    return await db
      .select({
        id: learningPracticeQuestions.id,
        prompt: learningPracticeQuestions.prompt,
        options: learningPracticeQuestions.options,
        correctIndex: learningPracticeQuestions.correctIndex,
        explanation: learningPracticeQuestions.explanation,
        difficulty: learningPracticeQuestions.difficulty,
        trackId: learningPracticeQuestions.trackId,
      })
      .from(learningPracticeQuestions)
      .where(and(...conds))
      .orderBy(asc(learningPracticeQuestions.id))
      .limit(limit);
  } catch (err) {
    log.warn({ err: String(err) }, "listNewQuestions failed");
    return [];
  }
}

/**
 * Returns the count of "new" items (flashcards + questions) the user
 * has never seen. Used by the Learning Home to surface a first-time
 * "Start learning" CTA when the SRS due-count is 0.
 */
export async function getNewItemCount(userId: number): Promise<{ newFlashcards: number; newQuestions: number; total: number }> {
  const db = await getDb();
  if (!db) return { newFlashcards: 0, newQuestions: 0, total: 0 };
  try {
    const seen = await getSeenItemKeys(userId);
    const seenFlashcardIds = Array.from(seen)
      .map((k) => parseItemKey(k))
      .filter((p) => p.kind === "flashcard" && p.id != null)
      .map((p) => p.id as number);
    const seenQuestionIds = Array.from(seen)
      .map((k) => parseItemKey(k))
      .filter((p) => p.kind === "question" && p.id != null)
      .map((p) => p.id as number);

    const fcConds: any[] = [eq(learningFlashcards.status, "published")];
    if (seenFlashcardIds.length > 0) fcConds.push(notInArray(learningFlashcards.id, seenFlashcardIds));
    const qConds: any[] = [eq(learningPracticeQuestions.status, "published")];
    if (seenQuestionIds.length > 0) qConds.push(notInArray(learningPracticeQuestions.id, seenQuestionIds));

    const [[{ c: fcCount }], [{ c: qCount }]] = await Promise.all([
      db
        .select({ c: sql<number>`count(*)` })
        .from(learningFlashcards)
        .where(and(...fcConds)),
      db
        .select({ c: sql<number>`count(*)` })
        .from(learningPracticeQuestions)
        .where(and(...qConds)),
    ]);
    const newFlashcards = Number(fcCount ?? 0);
    const newQuestions = Number(qCount ?? 0);
    return { newFlashcards, newQuestions, total: newFlashcards + newQuestions };
  } catch (err) {
    log.warn({ err: String(err) }, "getNewItemCount failed");
    return { newFlashcards: 0, newQuestions: 0, total: 0 };
  }
}

export interface MasterySummary {
  total: number;
  mastered: number;
  inProgress: number;
  dueNow: number;
  masteryPct: number;
}

export async function getMasterySummary(userId: number): Promise<MasterySummary> {
  const items = await getUserMastery(userId);
  const now = new Date();
  const total = items.length;
  const mastered = items.filter((i) => i.mastered).length;
  const inProgress = total - mastered;
  const dueNow = items.filter((i) => i.nextDue && new Date(i.nextDue as any) <= now).length;
  const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
  return { total, mastered, inProgress, dueNow, masteryPct };
}

// ─── Readiness (pure helper + DB resolver) ────────────────────────────────

export interface ReadinessInput {
  /** All itemKeys (`flashcard:id` / `question:id`) that belong to the track. */
  expectedKeys: Set<string>;
  /** Label lookup for weak-area display (term for flashcards, prompt for questions). */
  keyToLabel: Map<string, string>;
  /** Mastery rows for the current user — unfiltered. */
  masteryRows: Array<
    Pick<LearningMastery, "itemKey" | "confidence" | "mastered">
  >;
  /**
   * Optional legacy prefix — any mastery row whose key starts with
   * this is included as tracked-and-counted. Exists so data already
   * written under the older `track:<slug>:*` convention keeps
   * contributing to the score rather than vanishing.
   */
  legacyPrefix?: string;
}

export interface ReadinessResult {
  /** Distinct mastery rows the user has touched for this track. */
  itemsTracked: number;
  /** Rows that reached the mastered threshold (confidence >= 4). */
  mastered: number;
  /** Total items in the track (flashcards + questions). */
  totalItems: number;
  /**
   * Readiness = mastered / totalItems (0..1 rounded to two decimals).
   * This is the "true" metric — a user who's studied 5 of 200 is not
   * "100% ready" even if those 5 rows are all mastered.
   */
  readiness: number;
  /** coverage = itemsTracked / totalItems — fraction of the track seen at least once. */
  coverage: number;
  /** Up to 10 labels of weak items (confidence <= 2, not yet mastered). */
  weakAreas: string[];
}

/**
 * Pure. Compute readiness for a track given the expected item keys,
 * a label lookup, and the user's full mastery list.
 *
 * Split out from `assessTrackReadiness` so the DB-free scoring math
 * can be unit-tested in isolation and reused from other call sites
 * (e.g. a batch "readiness across every track" procedure).
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const { expectedKeys, keyToLabel, masteryRows, legacyPrefix } = input;
  const totalItems = expectedKeys.size;
  const tracked = masteryRows.filter((m) => {
    if (expectedKeys.has(m.itemKey)) return true;
    if (legacyPrefix && m.itemKey.startsWith(legacyPrefix)) return true;
    return false;
  });
  const itemsTracked = tracked.length;
  const mastered = tracked.filter((m) => m.mastered).length;
  const readiness = totalItems > 0 ? mastered / totalItems : 0;
  const coverage = totalItems > 0 ? itemsTracked / totalItems : 0;
  const weakAreas = tracked
    .filter((m) => !m.mastered && (m.confidence ?? 0) <= 2)
    .slice(0, 10)
    .map((m) => {
      const label = keyToLabel.get(m.itemKey);
      if (label) return label;
      if (legacyPrefix && m.itemKey.startsWith(legacyPrefix)) {
        return m.itemKey.slice(legacyPrefix.length);
      }
      return m.itemKey;
    });
  return {
    itemsTracked,
    mastered,
    totalItems,
    readiness: Math.round(readiness * 100) / 100,
    coverage: Math.round(coverage * 100) / 100,
    weakAreas,
  };
}

/**
 * Readiness assessment for a specific track — powers the agent's
 * `assess_readiness` and `check_exam_readiness` tools.
 *
 * Before this pass, the function looked for mastery rows whose key
 * started with `track:<slug>:` — but the live flashcard/quiz runners
 * write bare `flashcard:<id>` / `question:<id>` keys, so the filter
 * always matched zero rows and every call returned readiness=0.
 *
 * Now it resolves the track → its flashcards + questions → the set
 * of expected itemKeys, and matches mastery rows against that set.
 * Legacy prefix-formatted keys are still counted via
 * `computeReadiness`'s `legacyPrefix` param, so we never drop prior
 * progress on the floor.
 */
export async function assessTrackReadiness(
  userId: number,
  trackSlug: string,
): Promise<{
  trackSlug: string;
  itemsTracked: number;
  mastered: number;
  totalItems: number;
  readiness: number;
  coverage: number;
  weakAreas: string[];
}> {
  const track = await getTrackBySlug(trackSlug);
  if (!track) {
    return {
      trackSlug,
      itemsTracked: 0,
      mastered: 0,
      totalItems: 0,
      readiness: 0,
      coverage: 0,
      weakAreas: [],
    };
  }

  // Resolve the content for this track and build the expected-key set
  // + label lookup in parallel with the mastery fetch. Any per-query
  // failure returns an empty list (see content.ts graceful degradation)
  // so a bad DB never throws out of this function.
  const [flashcards, questions, masteryRows] = await Promise.all([
    listFlashcardsForTrack(track.id),
    listQuestionsForTrack(track.id),
    getUserMastery(userId),
  ]);

  const expectedKeys = new Set<string>();
  const keyToLabel = new Map<string, string>();
  for (const f of flashcards) {
    const key = `flashcard:${f.id}`;
    expectedKeys.add(key);
    if (f.term) keyToLabel.set(key, String(f.term));
  }
  for (const q of questions) {
    const key = `question:${q.id}`;
    expectedKeys.add(key);
    if (q.prompt) {
      const label = String(q.prompt);
      keyToLabel.set(key, label.length > 80 ? `${label.slice(0, 77)}…` : label);
    }
  }

  const scored = computeReadiness({
    expectedKeys,
    keyToLabel,
    masteryRows,
    legacyPrefix: `track:${trackSlug}:`,
  });

  return { trackSlug, ...scored };
}
