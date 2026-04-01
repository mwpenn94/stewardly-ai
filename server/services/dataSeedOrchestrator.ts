import { seedTaxParameters2025 } from "./taxParameters";
import { seedSsaParameters2025 } from "./ssaParameters";
import { seedMedicareParameters2025 } from "./medicareParameters";
import { seedInsuranceCarriers, seedSampleProducts } from "./insuranceData";
import { seedIulCreditingHistory, seedMarketIndexHistory } from "./iulMarketData";
import { seedEconomicHistory } from "./investmentIntelligence";
import { seedIndustryBenchmarks } from "./estatePlanningKnowledge";
import { logger } from "../_core/logger";

export interface SeedResult {
  module: string;
  recordsInserted: number;
  durationMs: number;
  error: string | null;
}

export async function runFullSeed(): Promise<{ results: SeedResult[]; totalRecords: number }> {
  const results: SeedResult[] = [];
  let totalRecords = 0;

  // Phase 1: Core reference data (no dependencies)
  const phase1 = [
    { name: "Tax Parameters 2025", fn: seedTaxParameters2025 },
    { name: "SSA Parameters 2025", fn: seedSsaParameters2025 },
    { name: "Medicare Parameters 2025", fn: seedMedicareParameters2025 },
    { name: "Insurance Carriers (Top 50)", fn: seedInsuranceCarriers },
  ];

  // Phase 2: Depends on carriers
  const phase2 = [
    { name: "Insurance Products (Sample)", fn: seedSampleProducts },
    { name: "Economic History (Shiller CAPE)", fn: seedEconomicHistory },
    { name: "Industry Benchmarks (LIMRA/LOMA)", fn: seedIndustryBenchmarks },
  ];

  // Phase 3: Depends on products
  const phase3 = [
    { name: "IUL Crediting History", fn: seedIulCreditingHistory },
    { name: "Market Index History", fn: seedMarketIndexHistory },
  ];

  const allPhases = [phase1, phase2, phase3];

  for (const phase of allPhases) {
    for (const { name, fn } of phase) {
      const start = Date.now();
      try {
        const count = await fn();
        results.push({ module: name, recordsInserted: count, durationMs: Date.now() - start, error: null });
        totalRecords += count;
      } catch (e: any) {
        results.push({ module: name, recordsInserted: 0, durationMs: Date.now() - start, error: e?.message ?? "Unknown error" });
      }
    }
  }

  logger.info( { operation: "dataSeed" },`[DataSeed] Complete: ${totalRecords} records across ${results.length} modules`);
  return { results, totalRecords };
}

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
}> {
  const { getDb } = await import("../db");
  const {
    taxParameters, ssaParameters, medicareParameters,
    insuranceCarriers, insuranceProducts,
    iulCreditingHistory, marketIndexHistory, economicHistory, industryBenchmarks,
  } = await import("../../drizzle/schema");
  const { sql } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) return { taxParams: 0, ssaParams: 0, medicareParams: 0, carriers: 0, products: 0, iulCrediting: 0, marketIndex: 0, economicHistory: 0, benchmarks: 0 };

  const [tp, sp, mp, ic, ip, iul, mi, eh, ib] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(taxParameters),
    db.select({ count: sql<number>`count(*)` }).from(ssaParameters),
    db.select({ count: sql<number>`count(*)` }).from(medicareParameters),
    db.select({ count: sql<number>`count(*)` }).from(insuranceCarriers),
    db.select({ count: sql<number>`count(*)` }).from(insuranceProducts),
    db.select({ count: sql<number>`count(*)` }).from(iulCreditingHistory),
    db.select({ count: sql<number>`count(*)` }).from(marketIndexHistory),
    db.select({ count: sql<number>`count(*)` }).from(economicHistory),
    db.select({ count: sql<number>`count(*)` }).from(industryBenchmarks),
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
  };
}
