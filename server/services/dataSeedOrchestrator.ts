import { seedTaxParameters2025 } from "./taxParameters";
import { seedSsaParameters2025 } from "./ssaParameters";
import { seedMedicareParameters2025 } from "./medicareParameters";
import { seedInsuranceCarriers, seedSampleProducts } from "./insuranceData";

export interface SeedResult {
  module: string;
  recordsInserted: number;
  durationMs: number;
  error: string | null;
}

export async function runFullSeed(): Promise<{ results: SeedResult[]; totalRecords: number }> {
  const results: SeedResult[] = [];
  let totalRecords = 0;

  const seedFunctions = [
    { name: "Tax Parameters 2025", fn: seedTaxParameters2025 },
    { name: "SSA Parameters 2025", fn: seedSsaParameters2025 },
    { name: "Medicare Parameters 2025", fn: seedMedicareParameters2025 },
    { name: "Insurance Carriers (Top 50)", fn: seedInsuranceCarriers },
    { name: "Insurance Products (Sample)", fn: seedSampleProducts },
  ];

  for (const { name, fn } of seedFunctions) {
    const start = Date.now();
    try {
      const count = await fn();
      results.push({ module: name, recordsInserted: count, durationMs: Date.now() - start, error: null });
      totalRecords += count;
    } catch (e: any) {
      results.push({ module: name, recordsInserted: 0, durationMs: Date.now() - start, error: e?.message ?? "Unknown error" });
    }
  }

  console.log(`[DataSeed] Complete: ${totalRecords} records across ${results.length} modules`);
  return { results, totalRecords };
}

export async function getSeedStatus(): Promise<{
  taxParams: number;
  ssaParams: number;
  medicareParams: number;
  carriers: number;
  products: number;
}> {
  const { getDb } = await import("../db");
  const { taxParameters } = await import("../../drizzle/schema");
  const { ssaParameters } = await import("../../drizzle/schema");
  const { medicareParameters } = await import("../../drizzle/schema");
  const { insuranceCarriers, insuranceProducts } = await import("../../drizzle/schema");
  const { sql } = await import("drizzle-orm");

  const db = await getDb();
  if (!db) return { taxParams: 0, ssaParams: 0, medicareParams: 0, carriers: 0, products: 0 };

  const [tp, sp, mp, ic, ip] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(taxParameters),
    db.select({ count: sql<number>`count(*)` }).from(ssaParameters),
    db.select({ count: sql<number>`count(*)` }).from(medicareParameters),
    db.select({ count: sql<number>`count(*)` }).from(insuranceCarriers),
    db.select({ count: sql<number>`count(*)` }).from(insuranceProducts),
  ]);

  return {
    taxParams: Number(tp[0]?.count ?? 0),
    ssaParams: Number(sp[0]?.count ?? 0),
    medicareParams: Number(mp[0]?.count ?? 0),
    carriers: Number(ic[0]?.count ?? 0),
    products: Number(ip[0]?.count ?? 0),
  };
}
