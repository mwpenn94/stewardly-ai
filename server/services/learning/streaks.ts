/**
 * Learning Streaks Service — P0-5 (Daily-Practice Loop)
 *
 * Tracks daily learning activity streaks with configurable goals
 * and optional nudge notifications. Feature-flagged for A/B testing.
 */

import { getDb } from "../../db";
import { learningStreaks, type LearningStreak } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/streaks" });

/** Get today's date as YYYY-MM-DD in UTC */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Get yesterday's date as YYYY-MM-DD in UTC */
function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Get or create a streak record for a user */
export async function getOrCreateStreak(
  userId: number,
  featureFlag: "control" | "treatment" = "treatment",
): Promise<LearningStreak | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [existing] = await db.select().from(learningStreaks)
      .where(eq(learningStreaks.userId, userId))
      .limit(1);

    if (existing) return existing;

    const [result] = await db.insert(learningStreaks).values({
      userId,
      currentStreak: 0,
      longestStreak: 0,
      dailyGoalMinutes: 15,
      nudgeEnabled: false,
      totalDaysActive: 0,
      featureFlag,
    });

    const [created] = await db.select().from(learningStreaks)
      .where(eq(learningStreaks.id, result.insertId));
    return created ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "getOrCreateStreak failed");
    return null;
  }
}

/**
 * Record daily activity — call this when a user completes any learning action.
 * Returns the updated streak data.
 */
export async function recordActivity(userId: number): Promise<LearningStreak | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const streak = await getOrCreateStreak(userId);
    if (!streak) return null;

    const today = todayUTC();
    const yesterday = yesterdayUTC();

    // Already recorded today
    if (streak.lastActivityDate === today) {
      return streak;
    }

    let newCurrentStreak: number;
    if (streak.lastActivityDate === yesterday) {
      // Consecutive day — extend streak
      newCurrentStreak = streak.currentStreak + 1;
    } else if (!streak.lastActivityDate) {
      // First ever activity
      newCurrentStreak = 1;
    } else {
      // Streak broken — reset to 1
      newCurrentStreak = 1;
    }

    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

    await db.update(learningStreaks)
      .set({
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: today,
        totalDaysActive: streak.totalDaysActive + 1,
        updatedAt: new Date(),
      })
      .where(eq(learningStreaks.id, streak.id));

    const [updated] = await db.select().from(learningStreaks)
      .where(eq(learningStreaks.id, streak.id));
    return updated ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "recordActivity failed");
    return null;
  }
}

/** Update streak settings (daily goal, nudge preferences) */
export async function updateSettings(
  userId: number,
  settings: {
    dailyGoalMinutes?: number;
    nudgeEnabled?: boolean;
    nudgeTime?: string;
  },
): Promise<LearningStreak | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const streak = await getOrCreateStreak(userId);
    if (!streak) return null;

    const updates: Partial<LearningStreak> = {};
    if (settings.dailyGoalMinutes !== undefined) updates.dailyGoalMinutes = settings.dailyGoalMinutes;
    if (settings.nudgeEnabled !== undefined) updates.nudgeEnabled = settings.nudgeEnabled;
    if (settings.nudgeTime !== undefined) updates.nudgeTime = settings.nudgeTime;

    await db.update(learningStreaks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(learningStreaks.id, streak.id));

    const [updated] = await db.select().from(learningStreaks)
      .where(eq(learningStreaks.id, streak.id));
    return updated ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "updateSettings failed");
    return null;
  }
}

/** Check if user's streak is at risk (last activity was yesterday, not today) */
export async function isStreakAtRisk(userId: number): Promise<boolean> {
  const streak = await getOrCreateStreak(userId);
  if (!streak || streak.currentStreak === 0) return false;

  const today = todayUTC();
  const yesterday = yesterdayUTC();

  // Streak is at risk if last activity was yesterday and they haven't done anything today
  return streak.lastActivityDate === yesterday;
}
