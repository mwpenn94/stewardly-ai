import { getDb } from "../db";
const PROVIDERS = [
  { provider: "fred_api", dataCategory: "economic_data", refreshIntervalHours: 4 },
  { provider: "sec_edgar", dataCategory: "regulatory_filings", refreshIntervalHours: 24 },
  { provider: "finra_brokercheck", dataCategory: "professional_verification", refreshIntervalHours: 24 },
  { provider: "bls_employment", dataCategory: "labor_statistics", refreshIntervalHours: 720 },
  { provider: "census_acs", dataCategory: "demographics", refreshIntervalHours: 8760 },
  { provider: "cfp_board", dataCategory: "professional_verification", refreshIntervalHours: 720 },
  { provider: "nasba_cpaverify", dataCategory: "professional_verification", refreshIntervalHours: 720 },
  { provider: "nmls_consumer", dataCategory: "professional_verification", refreshIntervalHours: 720 },
  { provider: "nipr_pdb", dataCategory: "professional_verification", refreshIntervalHours: 720 },
  { provider: "am_best", dataCategory: "carrier_ratings", refreshIntervalHours: 720 },
  { provider: "shiller_cape", dataCategory: "market_data", refreshIntervalHours: 720 },
  { provider: "frbny_sofr", dataCategory: "interest_rates", refreshIntervalHours: 24 },
  { provider: "irs_soi", dataCategory: "tax_demographics", refreshIntervalHours: 8760 },
  { provider: "ssa_actuarial", dataCategory: "mortality_tables", refreshIntervalHours: 8760 },
  { provider: "polygon_market", dataCategory: "market_data", refreshIntervalHours: 24 },
  { provider: "limra_benchmarks", dataCategory: "industry_data", refreshIntervalHours: 2160 },
  { provider: "naifa_data", dataCategory: "industry_data", refreshIntervalHours: 2160 },
  { provider: "mdrt_qualifying", dataCategory: "industry_data", refreshIntervalHours: 8760 },
];
export async function seed() {
  const db = await getDb(); if (!db) { console.log("[seed:01] No DB — skipping"); return; }
  const { dataFreshnessRegistry } = await import("../../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  let inserted = 0;
  for (const p of PROVIDERS) {
    const [exists] = await db.select().from(dataFreshnessRegistry).where(and(eq(dataFreshnessRegistry.provider, p.provider), eq(dataFreshnessRegistry.dataCategory, p.dataCategory))).limit(1);
    if (exists) continue;
    await db.insert(dataFreshnessRegistry).values(p); inserted++;
  }
  console.log(`[seed:01] Freshness registry: ${inserted} inserted`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
