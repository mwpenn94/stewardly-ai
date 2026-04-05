/**
 * Data Seed Orchestrator
 * Delegates to the unified seed runner in server/seeds/index.ts.
 * Maintains backward-compatible API for the dataSeed router.
 */
import { runAllSeeds, type SeedResult } from "../seeds/index";
import { logger } from "../_core/logger";

export type { SeedResult };

/**
 * Run the full seed pipeline (all 30 modules across 5 phases).
 * Called by dataSeed.runSeed tRPC mutation.
 */
export async function runFullSeed(): Promise<{ results: SeedResult[]; totalRecords: number }> {
  logger.info({ operation: "dataSeed" }, "[DataSeed] Starting full seed via unified runner...");
  return runAllSeeds();
}

/**
 * Get counts of seeded reference data across all major tables.
 * Called by dataSeed.seedStatus tRPC query.
 */
export async function getSeedStatus(): Promise<{
  taxParams: number;
  ssaParams: number;
  medicareParams: number;
  carriers: number;
  products: number;
  iulCrediting: number;
  marketIndex: number;
  economicHistory: number;
  benchmarks: number;
  featureFlags: number;
  glossaryTerms: number;
  educationModules: number;
  contentArticles: number;
  promptVariants: number;
  disclaimerVersions: number;
  platformChangelog: number;
}> {
  const { getDb } = await import("../db");
  const {
    taxParameters, ssaParameters, medicareParameters,
    insuranceCarriers, insuranceProducts,
    iulCreditingHistory, marketIndexHistory, economicHistory, industryBenchmarks,
    featureFlags, glossaryTerms, educationModules, contentArticles,
    promptVariants, disclaimerVersions, platformChangelog,
  } = await import("../../drizzle/schema");
  const { sql } = await import("drizzle-orm");

  const db = await getDb();
  const zero = {
    taxParams: 0, ssaParams: 0, medicareParams: 0, carriers: 0, products: 0,
    iulCrediting: 0, marketIndex: 0, economicHistory: 0, benchmarks: 0,
    featureFlags: 0, glossaryTerms: 0, educationModules: 0, contentArticles: 0,
    promptVariants: 0, disclaimerVersions: 0, platformChangelog: 0,
  };
  if (!db) return zero;

  try {
    const [tp, sp, mp, ic, ip, iul, mi, eh, ib, ff, gt, em, ca, pv, dv, pc] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(taxParameters),
      db.select({ count: sql<number>`count(*)` }).from(ssaParameters),
      db.select({ count: sql<number>`count(*)` }).from(medicareParameters),
      db.select({ count: sql<number>`count(*)` }).from(insuranceCarriers),
      db.select({ count: sql<number>`count(*)` }).from(insuranceProducts),
      db.select({ count: sql<number>`count(*)` }).from(iulCreditingHistory),
      db.select({ count: sql<number>`count(*)` }).from(marketIndexHistory),
      db.select({ count: sql<number>`count(*)` }).from(economicHistory),
      db.select({ count: sql<number>`count(*)` }).from(industryBenchmarks),
      db.select({ count: sql<number>`count(*)` }).from(featureFlags),
      db.select({ count: sql<number>`count(*)` }).from(glossaryTerms),
      db.select({ count: sql<number>`count(*)` }).from(educationModules),
      db.select({ count: sql<number>`count(*)` }).from(contentArticles),
      db.select({ count: sql<number>`count(*)` }).from(promptVariants),
      db.select({ count: sql<number>`count(*)` }).from(disclaimerVersions),
      db.select({ count: sql<number>`count(*)` }).from(platformChangelog),
    ]);

    return {
      taxParams: Number(tp[0]?.count ?? 0),
      ssaParams: Number(sp[0]?.count ?? 0),
      medicareParams: Number(mp[0]?.count ?? 0),
      carriers: Number(ic[0]?.count ?? 0),
      products: Number(ip[0]?.count ?? 0),
      iulCrediting: Number(iul[0]?.count ?? 0),
      marketIndex: Number(mi[0]?.count ?? 0),
      economicHistory: Number(eh[0]?.count ?? 0),
      benchmarks: Number(ib[0]?.count ?? 0),
      featureFlags: Number(ff[0]?.count ?? 0),
      glossaryTerms: Number(gt[0]?.count ?? 0),
      educationModules: Number(em[0]?.count ?? 0),
      contentArticles: Number(ca[0]?.count ?? 0),
      promptVariants: Number(pv[0]?.count ?? 0),
      disclaimerVersions: Number(dv[0]?.count ?? 0),
      platformChangelog: Number(pc[0]?.count ?? 0),
    };
  } catch (e: any) {
    logger.error({ operation: "getSeedStatus", err: e }, `[DataSeed] Status check failed: ${e?.message}`);
    return zero;
  }
}
