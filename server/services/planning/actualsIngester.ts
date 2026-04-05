/**
 * Actuals Ingester — Ingest actual production data for plan vs actual comparison
 * Maps to productionActuals table schema: userId, periodType, periodStart, periodEnd, etc.
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "actualsIngester" });

export interface ActualRecord {
  userId: number;
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  gdcActual?: number;
  casesPlaced?: number;
  casesSubmitted?: number;
  premiumVolume?: number;
  aumAdded?: number;
  teamRecruited?: number;
  dataSource?: "manual" | "ghl_sync" | "carrier_import" | "calculated";
}

export async function ingestActuals(records: ActualRecord[]): Promise<{ ingested: number; errors: string[] }> {
  const db = await getDb();
  if (!db) return { ingested: 0, errors: ["Database not available"] };

  let ingested = 0;
  const errors: string[] = [];

  try {
    const { productionActuals } = await import("../../../drizzle/schema");

    for (const record of records) {
      try {
        await db.insert(productionActuals).values({
          userId: record.userId,
          periodType: record.periodType,
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          gdcActual: record.gdcActual != null ? String(record.gdcActual) : null,
          casesPlaced: record.casesPlaced ?? null,
          casesSubmitted: record.casesSubmitted ?? null,
          premiumVolume: record.premiumVolume != null ? String(record.premiumVolume) : null,
          aumAdded: record.aumAdded != null ? String(record.aumAdded) : null,
          teamRecruited: record.teamRecruited ?? null,
          dataSource: record.dataSource || "manual",
        } as any);
        ingested++;
      } catch (e: any) {
        errors.push(`${record.periodStart}: ${e.message}`);
      }
    }

    log.info({ ingested, total: records.length }, "Actuals ingested");
  } catch (e: any) {
    log.warn({ error: e.message }, "Actuals ingestion skipped — table may not exist");
    errors.push(e.message);
  }

  return { ingested, errors };
}

export async function getActualsByUser(userId: number, periodType?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { productionActuals } = await import("../../../drizzle/schema");
    const { eq, and } = await import("drizzle-orm");

    const conditions: any[] = [eq(productionActuals.userId, userId)];
    if (periodType) {
      conditions.push(eq(productionActuals.periodType, periodType as any));
    }

    return await db.select().from(productionActuals)
      .where(and(...conditions));
  } catch {
    return [];
  }
}
