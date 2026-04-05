/**
 * Feedback Collector — Human response ratings for quality calibration
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "feedbackCollector" });

export async function recordRating(params: {
  userId: number;
  messageId: number;
  rating: "thumbs_up" | "thumbs_down";
  feedbackText?: string;
  model?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { responseRatings } = await import("../../drizzle/schema");
    await db.insert(responseRatings).values({
      userId: params.userId,
      messageId: params.messageId,
      responseType: "chat",
      rating: params.rating,
      feedbackText: params.feedbackText,
      model: params.model,
    });
  } catch (e: any) {
    log.warn({ error: e.message }, "Failed to record rating");
  }
}

export async function getAggregateRatings(model?: string): Promise<{ thumbsUp: number; thumbsDown: number; total: number; approvalRate: number }> {
  const db = await getDb();
  if (!db) return { thumbsUp: 0, thumbsDown: 0, total: 0, approvalRate: 0 };

  try {
    const { responseRatings } = await import("../../drizzle/schema");
    const { eq, count } = await import("drizzle-orm");

    const [up] = await db.select({ count: count() }).from(responseRatings).where(eq(responseRatings.rating, "thumbs_up"));
    const [down] = await db.select({ count: count() }).from(responseRatings).where(eq(responseRatings.rating, "thumbs_down"));

    const thumbsUp = up?.count || 0;
    const thumbsDown = down?.count || 0;
    const total = thumbsUp + thumbsDown;

    return { thumbsUp, thumbsDown, total, approvalRate: total > 0 ? Math.round((thumbsUp / total) * 100) : 0 };
  } catch {
    return { thumbsUp: 0, thumbsDown: 0, total: 0, approvalRate: 0 };
  }
}
