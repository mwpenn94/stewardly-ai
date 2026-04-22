/**
 * FSRS-5 Spaced Repetition Scheduler — P0-1
 *
 * Implements the Free Spaced Repetition Scheduler v5 algorithm.
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 *
 * Key concepts:
 * - Stability (S): expected number of days until retrievability drops to 90%
 * - Difficulty (D): inherent difficulty of the card [0,1]
 * - Retrievability (R): probability of recall at a given elapsed time
 *
 * Feature-flagged: "fsrs5" arm uses this, "control" arm uses legacy SM-style.
 */

import { getDb } from "../../db";
import { cardSchedules, cardReviews, type CardSchedule } from "../../../drizzle/schema";
import { and, eq, lte, asc, sql } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/fsrs5" });

// ─── FSRS-5 Parameters (default weights from the paper) ──────────────────
const FSRS5_PARAMS = {
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
  requestRetention: 0.9, // target 90% retrievability
  maximumInterval: 36500, // 100 years cap
};

// Rating enum: 1=Again, 2=Hard, 3=Good, 4=Easy
type Rating = 1 | 2 | 3 | 4;
type CardState = "new" | "learning" | "review" | "relearning";

interface ScheduleResult {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: CardState;
  nextDue: Date;
}

// ─── Pure FSRS-5 Algorithm ────────────────────────────────────────────────

/** Initial stability for a new card based on first rating */
function initStability(rating: Rating): number {
  const w = FSRS5_PARAMS.w;
  return Math.max(0.1, w[rating - 1]);
}

/** Initial difficulty for a new card based on first rating */
function initDifficulty(rating: Rating): number {
  const w = FSRS5_PARAMS.w;
  return Math.min(1, Math.max(0, w[4] - Math.exp(w[5] * (rating - 1)) + 1));
}

/** Calculate retrievability given stability and elapsed days */
export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/** Update difficulty after a review */
function nextDifficulty(d: number, rating: Rating): number {
  const w = FSRS5_PARAMS.w;
  const newD = d - w[6] * (rating - 3);
  // Mean reversion
  const meanReverted = w[7] * initDifficulty(4) + (1 - w[7]) * newD;
  return Math.min(1, Math.max(0, meanReverted));
}

/** Calculate next stability after a successful recall */
function nextRecallStability(d: number, s: number, r: number, rating: Rating): number {
  const w = FSRS5_PARAMS.w;
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) *
    (11 - d) *
    Math.pow(s, -w[9]) *
    (Math.exp((1 - r) * w[10]) - 1) *
    hardPenalty *
    easyBonus);
}

/** Calculate next stability after a lapse (forgetting) */
function nextForgetStability(d: number, s: number, r: number): number {
  const w = FSRS5_PARAMS.w;
  return Math.max(0.1,
    w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(s + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14])
  );
}

/** Convert stability to interval in days for target retention */
function stabilityToInterval(s: number): number {
  const r = FSRS5_PARAMS.requestRetention;
  const interval = 9 * s * (1 / r - 1);
  return Math.min(Math.max(1, Math.round(interval)), FSRS5_PARAMS.maximumInterval);
}

/**
 * Pure FSRS-5 scheduling function.
 * Given current card state and a rating, returns the next schedule.
 */
export function fsrs5Schedule(
  current: {
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    state: CardState;
  },
  rating: Rating,
  now = new Date(),
): ScheduleResult {
  const isNew = current.state === "new";
  const isLearning = current.state === "learning" || current.state === "relearning";

  let s: number;
  let d: number;
  let newState: CardState;
  let newLapses = current.lapses;

  if (isNew) {
    // First review of a new card
    s = initStability(rating);
    d = initDifficulty(rating);
    newState = rating === 1 ? "learning" : "review";
    if (rating === 1) newLapses++;
  } else if (isLearning) {
    // Learning/relearning phase
    s = current.stability;
    d = current.difficulty;
    if (rating === 1) {
      newState = "learning";
      s = Math.max(0.1, current.stability * 0.5);
    } else {
      newState = "review";
      s = current.stability;
    }
  } else {
    // Review phase
    const r = retrievability(current.stability, current.elapsedDays);
    d = nextDifficulty(current.difficulty, rating);
    if (rating === 1) {
      // Lapse
      s = nextForgetStability(d, current.stability, r);
      newState = "relearning";
      newLapses++;
    } else {
      s = nextRecallStability(d, current.stability, r, rating);
      newState = "review";
    }
  }

  // For new cards, d is already set above
  if (!isNew && !isLearning) {
    // d already updated
  } else if (isLearning) {
    d = current.difficulty;
  }

  const interval = (newState === "learning" || newState === "relearning")
    ? (rating === 1 ? 0.00694 : 0.04167) // ~10min or ~1hr in days
    : stabilityToInterval(s);

  const nextDue = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    stability: s,
    difficulty: d,
    elapsedDays: current.elapsedDays,
    scheduledDays: interval,
    reps: current.reps + 1,
    lapses: newLapses,
    state: newState,
    nextDue,
  };
}

// ─── DB Operations ────────────────────────────────────────────────────────

/** Get or create a card schedule for a user+item */
export async function getOrCreateSchedule(
  userId: number,
  itemKey: string,
  itemType: string,
  featureFlag: "control" | "fsrs5" = "fsrs5",
): Promise<CardSchedule | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const existing = await db.select().from(cardSchedules)
      .where(and(
        eq(cardSchedules.userId, userId),
        eq(cardSchedules.itemKey, itemKey),
        eq(cardSchedules.itemType, itemType),
      ))
      .limit(1);

    if (existing.length > 0) return existing[0];

    // Create new schedule
    const [result] = await db.insert(cardSchedules).values({
      userId,
      itemKey,
      itemType,
      featureFlag,
      stability: 0.4,
      difficulty: 0.3,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: "new",
    });

    const [created] = await db.select().from(cardSchedules)
      .where(eq(cardSchedules.id, result.insertId));
    return created ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "getOrCreateSchedule failed");
    return null;
  }
}

/** Process a review and update the schedule */
export async function processReview(
  userId: number,
  itemKey: string,
  itemType: string,
  rating: Rating,
  now = new Date(),
): Promise<ScheduleResult | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const schedule = await getOrCreateSchedule(userId, itemKey, itemType);
    if (!schedule) return null;

    const elapsedDays = schedule.lastReview
      ? (now.getTime() - new Date(schedule.lastReview).getTime()) / (24 * 60 * 60 * 1000)
      : 0;

    const current = {
      stability: schedule.stability,
      difficulty: schedule.difficulty,
      elapsedDays,
      scheduledDays: schedule.scheduledDays,
      reps: schedule.reps,
      lapses: schedule.lapses,
      state: schedule.state as CardState,
    };

    const result = schedule.featureFlag === "fsrs5"
      ? fsrs5Schedule(current, rating, now)
      : legacySchedule(current, rating >= 3, now);

    // Log the review
    await db.insert(cardReviews).values({
      userId,
      itemKey,
      itemType,
      rating,
      reviewedAt: now,
      elapsedDays,
      scheduledDays: result.scheduledDays,
      stabilityBefore: schedule.stability,
      stabilityAfter: result.stability,
      difficultyBefore: schedule.difficulty,
      difficultyAfter: result.difficulty,
      stateBefore: schedule.state,
      stateAfter: result.state,
      featureFlag: schedule.featureFlag ?? "fsrs5",
    });

    // Update the schedule
    await db.update(cardSchedules)
      .set({
        stability: result.stability,
        difficulty: result.difficulty,
        elapsedDays: result.elapsedDays,
        scheduledDays: result.scheduledDays,
        reps: result.reps,
        lapses: result.lapses,
        state: result.state,
        lastReview: now,
        nextDue: result.nextDue,
        updatedAt: now,
      })
      .where(eq(cardSchedules.id, schedule.id));

    return result;
  } catch (err) {
    log.warn({ err: String(err) }, "processReview failed");
    return null;
  }
}

/** Legacy SM-style scheduler (control arm) */
function legacySchedule(
  current: { stability: number; difficulty: number; elapsedDays: number; scheduledDays: number; reps: number; lapses: number; state: CardState },
  correct: boolean,
  now: Date,
): ScheduleResult {
  const INTERVALS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  let confidence = Math.round(current.stability); // use stability as proxy for confidence
  if (correct) {
    confidence = Math.min(5, confidence + 1);
  } else {
    confidence = Math.max(0, Math.floor(confidence / 2));
  }
  const days = INTERVALS[confidence] ?? 1;
  return {
    stability: confidence,
    difficulty: current.difficulty,
    elapsedDays: current.elapsedDays,
    scheduledDays: days,
    reps: current.reps + 1,
    lapses: correct ? current.lapses : current.lapses + 1,
    state: confidence >= 4 ? "review" : "learning",
    nextDue: new Date(now.getTime() + days * 24 * 60 * 60 * 1000),
  };
}

/** Get due cards for a user (FSRS-5 aware) */
export async function getDueCards(
  userId: number,
  limit = 20,
  now = new Date(),
): Promise<CardSchedule[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(cardSchedules)
      .where(and(
        eq(cardSchedules.userId, userId),
        lte(cardSchedules.nextDue, now),
      ))
      .orderBy(asc(cardSchedules.nextDue))
      .limit(limit);
  } catch (err) {
    log.warn({ err: String(err) }, "getDueCards failed");
    return [];
  }
}

/** Get user's review stats */
export async function getReviewStats(userId: number): Promise<{
  totalReviews: number;
  averageRetention: number;
  cardsInReview: number;
  cardsMastered: number;
}> {
  const db = await getDb();
  if (!db) return { totalReviews: 0, averageRetention: 0, cardsInReview: 0, cardsMastered: 0 };

  try {
    const [reviewCount] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(cardReviews)
      .where(eq(cardReviews.userId, userId));

    const schedules = await db.select().from(cardSchedules)
      .where(eq(cardSchedules.userId, userId));

    const inReview = schedules.filter(s => s.state === "review").length;
    const mastered = schedules.filter(s => s.stability >= 21).length; // ~21 days stability = well-learned

    // Average retrievability across all cards
    const now = new Date();
    const retrievabilities = schedules
      .filter(s => s.lastReview && s.stability > 0)
      .map(s => {
        const elapsed = (now.getTime() - new Date(s.lastReview!).getTime()) / (24 * 60 * 60 * 1000);
        return retrievability(s.stability, elapsed);
      });

    const avgRetention = retrievabilities.length > 0
      ? retrievabilities.reduce((a, b) => a + b, 0) / retrievabilities.length
      : 0;

    return {
      totalReviews: reviewCount?.count ?? 0,
      averageRetention: Math.round(avgRetention * 100),
      cardsInReview: inReview,
      cardsMastered: mastered,
    };
  } catch (err) {
    log.warn({ err: String(err) }, "getReviewStats failed");
    return { totalReviews: 0, averageRetention: 0, cardsInReview: 0, cardsMastered: 0 };
  }
}
