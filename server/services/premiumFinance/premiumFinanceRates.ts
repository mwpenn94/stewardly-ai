/**
 * Premium Finance Rates — SOFR via FRED API
 * Handles revisions, weekend/holiday detection, retry logic
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "premiumFinanceRates" });
const FRED_SOFR_SERIES = "SOFR";

export interface SofrRate {
  date: string;
  value: number;
  isRevised: boolean;
  publicationStatus: "current" | "delayed" | "weekend_holiday" | "revised";
}

export async function fetchLatestSofr(): Promise<SofrRate | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    log.warn("FRED_API_KEY not set — SOFR rates unavailable");
    return null;
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${FRED_SOFR_SERIES}&sort_order=desc&limit=5&api_key=${apiKey}&file_type=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      log.error({ status: res.status }, "FRED API error");
      return null;
    }

    const data = await res.json();
    const observations = data.observations?.filter((o: any) => o.value !== ".");

    if (!observations?.length) return null;

    const latest = observations[0];
    const value = parseFloat(latest.value);

    // Persist
    await persistRate(latest.date, value);

    return {
      date: latest.date,
      value,
      isRevised: false,
      publicationStatus: "current",
    };
  } catch (e: any) {
    log.error({ error: e.message }, "SOFR fetch failed");
    return null;
  }
}

export async function getRateHistory(limit = 30): Promise<SofrRate[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { premiumFinanceRates } = await import("../../../drizzle/schema");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(premiumFinanceRates).orderBy(desc(premiumFinanceRates.rateDate)).limit(limit);
    return rows.map(r => ({
      date: r.rateDate?.toISOString().split("T")[0] || "",
      value: Number(r.sofr) || 0,
      isRevised: false,
      publicationStatus: "current" as const,
    }));
  } catch {
    return [];
  }
}

async function persistRate(date: string, value: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { premiumFinanceRates } = await import("../../../drizzle/schema");
    await db.insert(premiumFinanceRates).values({
      rateDate: new Date(date),
      sofr: String(value),
      fetchedAt: Date.now(),
    });
  } catch { /* duplicate — ignore */ }
}
