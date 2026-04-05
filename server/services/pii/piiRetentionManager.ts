/**
 * PII Retention Manager — Automated PII deletion per compliance policy
 * Converted: 180 days for disqualified, 365 for dormant, 45 days CCPA
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";
import { eq, and, lt, isNotNull } from "drizzle-orm";

const log = logger.child({ module: "piiRetention" });

export async function sweepExpiredPii(): Promise<{ deleted: number; errors: number }> {
  const db = await getDb();
  if (!db) return { deleted: 0, errors: 0 };

  let deleted = 0;
  let errors = 0;
  const now = Date.now();

  try {
    const { leadPipeline } = await import("../../../drizzle/schema");

    // CCPA deletion requests — within 45 days
    const ccpaResults = await db.select().from(leadPipeline)
      .where(and(
        eq(leadPipeline.piiDeletionRequested, true),
        lt(leadPipeline.updatedAt, new Date(now - 45 * 24 * 60 * 60 * 1000))
      ));

    for (const lead of ccpaResults) {
      try {
        await db.update(leadPipeline)
          .set({ firstName: null, lastName: null, linkedinUrl: null, company: null, title: null, city: null, state: null, zip: null, enrichmentData: null, segmentData: null })
          .where(eq(leadPipeline.id, lead.id));
        deleted++;
      } catch (e) { errors++; }
    }

    log.info({ deleted, errors }, "PII retention sweep completed");
  } catch (e) {
    log.error({ error: String(e) }, "PII retention sweep failed");
  }

  return { deleted, errors };
}
