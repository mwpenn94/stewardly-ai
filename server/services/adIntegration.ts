/**
 * Ad Integration — Contextual ads in chat without overwhelming UX
 * Placement types:
 *   - contextual_banner: subtle banner between messages on relevant topics
 *   - sponsored_content: "Recommended by [partner]" cards
 *   - product_recommendation: inline product suggestions (from insurance_products)
 *   - inline_cta: small CTA within AI response (e.g., "Get a quote →")
 *
 * UX principles:
 *   - Max 1 ad per 5 messages
 *   - Never interrupt mid-conversation
 *   - Always labeled "Sponsored" or "Recommended"
 *   - Dismissible with "×" button
 *   - Frequency cap: max 3 per session
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "adIntegration" });

const SESSION_AD_CAP = 3;
const MESSAGES_BETWEEN_ADS = 5;

export interface AdPlacement {
  id: number;
  type: "contextual_banner" | "sponsored_content" | "product_recommendation" | "inline_cta";
  advertiser: string;
  content: string;
  ctaUrl?: string;
  ctaText?: string;
  context: string;
}

/** Get a contextual ad based on conversation topic */
export async function getContextualAd(
  context: string,
  messageCount: number,
  sessionAdCount: number,
): Promise<AdPlacement | null> {
  // UX guardrails
  if (sessionAdCount >= SESSION_AD_CAP) return null;
  if (messageCount % MESSAGES_BETWEEN_ADS !== 0) return null;
  if (messageCount < 3) return null; // Don't show ads in first 3 messages

  const db = await getDb();
  if (!db) return null;

  try {
    const { adPlacements } = await import("../../drizzle/schema");
    const { eq, and, sql } = await import("drizzle-orm");

    // Find active ad matching context
    const [ad] = await db.select().from(adPlacements)
      .where(and(
        eq(adPlacements.enabled, true),
        eq(adPlacements.targetContext, context),
      ))
      .orderBy(sql`RAND()`)
      .limit(1);

    if (!ad) return null;

    // Increment impressions
    await db.update(adPlacements)
      .set({ impressions: sql`${adPlacements.impressions} + 1` })
      .where(eq(adPlacements.id, ad.id));

    return {
      id: ad.id,
      type: ad.placementType as any,
      advertiser: ad.advertiserName || "Partner",
      content: ad.contentHtml || "",
      ctaUrl: ad.ctaUrl || undefined,
      ctaText: ad.ctaText || undefined,
      context,
    };
  } catch (e: any) {
    log.warn({ context, error: e.message }, "Ad fetch failed");
    return null;
  }
}

/** Log ad interaction */
export async function logAdEvent(
  adId: number,
  userId: number | undefined,
  eventType: "impression" | "click" | "dismiss",
  context?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { adImpressionLog } = await import("../../drizzle/schema");
    await db.insert(adImpressionLog).values({
      adId,
      userId: userId || null,
      eventType,
      context,
    });
  } catch { /* non-critical */ }
}
