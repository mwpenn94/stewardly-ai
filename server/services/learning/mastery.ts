/**
 * EMBA Learning — Spaced Repetition System (SRS) mastery service.
 *
 * Ports the EMBA Knowledge Explorer `MasteryContext` into a DB-backed
 * server module. Confidence scale is 0-5 (EMBA convention). The
 * `scheduleNextReview` helper is pure and unit-tested.
 */

import { getDb } from "../../db";
import { learningMasteryProgress, type LearningMastery } from "../../../drizzle/schema";
import { and, eq, lte, desc, sql } from "drizzle-orm";
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
      .orderBy(desc(learningMasteryProgress.nextDue))
      .limit(limit);
  } catch (err) {
    log.warn({ err: String(err) }, "getDueItems failed");
    return [];
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
