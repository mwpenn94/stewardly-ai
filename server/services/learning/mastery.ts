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
