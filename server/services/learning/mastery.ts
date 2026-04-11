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

/**
 * Readiness assessment for a specific track — used by the agent's
 * `assess_readiness` tool. Looks at mastery rows that belong to this
 * track (by itemKey prefix convention `track:<slug>:*`).
 */
export async function assessTrackReadiness(
  userId: number,
  trackSlug: string,
): Promise<{ trackSlug: string; itemsTracked: number; mastered: number; readiness: number; weakAreas: string[] }> {
  const all = await getUserMastery(userId);
  const prefix = `track:${trackSlug}:`;
  const tracked = all.filter((m) => m.itemKey.startsWith(prefix));
  const mastered = tracked.filter((m) => m.mastered).length;
  const readiness = tracked.length > 0 ? mastered / tracked.length : 0;
  const weakAreas = tracked
    .filter((m) => !m.mastered && m.confidence <= 2)
    .slice(0, 10)
    .map((m) => m.itemKey.slice(prefix.length));
  return {
    trackSlug,
    itemsTracked: tracked.length,
    mastered,
    readiness: Math.round(readiness * 100) / 100,
    weakAreas,
  };
}
