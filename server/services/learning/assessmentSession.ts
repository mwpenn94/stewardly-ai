/**
 * Assessment Session Service — P0-3 (No-AI Zone)
 *
 * Manages graded assessment sessions where AI assistance is blocked.
 * When a session is active, all AI endpoints should check for an active
 * session and refuse to respond.
 */

import { getDb } from "../../db";
import { assessmentSessions, type AssessmentSession } from "../../../drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "learning/assessment" });

type AssessmentType = "quiz" | "exam" | "smartcase" | "capstone";

/** Start a new assessment session — blocks AI for this user */
export async function startSession(
  userId: number,
  assessmentType: AssessmentType,
): Promise<AssessmentSession | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Check for existing active session
    const active = await getActiveSession(userId);
    if (active) {
      log.warn({ userId }, "User already has an active assessment session");
      return active; // Return existing rather than creating duplicate
    }

    const [result] = await db.insert(assessmentSessions).values({
      userId,
      assessmentType,
      status: "active",
      aiBlockActive: true,
      focusLossCount: 0,
      aiAttemptCount: 0,
    });

    const [created] = await db.select().from(assessmentSessions)
      .where(eq(assessmentSessions.id, result.insertId));
    return created ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "startSession failed");
    return null;
  }
}

/** Get the active assessment session for a user (if any) */
export async function getActiveSession(userId: number): Promise<AssessmentSession | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const [session] = await db.select().from(assessmentSessions)
      .where(and(
        eq(assessmentSessions.userId, userId),
        eq(assessmentSessions.status, "active"),
      ))
      .orderBy(desc(assessmentSessions.startedAt))
      .limit(1);
    return session ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "getActiveSession failed");
    return null;
  }
}

/** Check if AI should be blocked for this user */
export async function isAiBlocked(userId: number): Promise<boolean> {
  const session = await getActiveSession(userId);
  return session?.aiBlockActive === true;
}

/** Record an AI invocation attempt during an active session */
export async function recordAiAttempt(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const session = await getActiveSession(userId);
    if (!session) return;

    await db.update(assessmentSessions)
      .set({ aiAttemptCount: (session.aiAttemptCount ?? 0) + 1 })
      .where(eq(assessmentSessions.id, session.id));

    log.info({ userId, sessionId: session.id, attempts: (session.aiAttemptCount ?? 0) + 1 },
      "AI attempt blocked during assessment");
  } catch (err) {
    log.warn({ err: String(err) }, "recordAiAttempt failed");
  }
}

/** Record a focus loss event (tab switch, window blur) */
export async function recordFocusLoss(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const session = await getActiveSession(userId);
    if (!session) return;

    await db.update(assessmentSessions)
      .set({ focusLossCount: (session.focusLossCount ?? 0) + 1 })
      .where(eq(assessmentSessions.id, session.id));
  } catch (err) {
    log.warn({ err: String(err) }, "recordFocusLoss failed");
  }
}

/** Complete an assessment session with a score */
export async function completeSession(
  userId: number,
  sessionId: number,
  score: number,
  maxScore: number,
): Promise<AssessmentSession | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(assessmentSessions)
      .set({
        status: "completed",
        completedAt: new Date(),
        aiBlockActive: false,
        score,
        maxScore,
      })
      .where(and(
        eq(assessmentSessions.id, sessionId),
        eq(assessmentSessions.userId, userId),
      ));

    const [updated] = await db.select().from(assessmentSessions)
      .where(eq(assessmentSessions.id, sessionId));
    return updated ?? null;
  } catch (err) {
    log.warn({ err: String(err) }, "completeSession failed");
    return null;
  }
}

/** Abandon an assessment session */
export async function abandonSession(userId: number, sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.update(assessmentSessions)
      .set({
        status: "abandoned",
        aiBlockActive: false,
        completedAt: new Date(),
      })
      .where(and(
        eq(assessmentSessions.id, sessionId),
        eq(assessmentSessions.userId, userId),
      ));
  } catch (err) {
    log.warn({ err: String(err) }, "abandonSession failed");
  }
}

/** Get assessment history for a user */
export async function getSessionHistory(
  userId: number,
  limit = 20,
): Promise<AssessmentSession[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(assessmentSessions)
      .where(eq(assessmentSessions.userId, userId))
      .orderBy(desc(assessmentSessions.startedAt))
      .limit(limit);
  } catch (err) {
    log.warn({ err: String(err) }, "getSessionHistory failed");
    return [];
  }
}
