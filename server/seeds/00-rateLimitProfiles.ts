import { getDb } from "../db";
const PROFILES = [
  { provider: "sec_edgar", domain: "efts.sec.gov", currentRpm: 10, staticMaximum: 10, safetyFactor: "0.80", isGovernment: true },
  { provider: "finra_brokercheck", domain: "api.brokercheck.finra.org", currentRpm: 5, staticMaximum: 10, safetyFactor: "0.50", isGovernment: false },
  { provider: "fred_api", domain: "api.stlouisfed.org", currentRpm: 120, staticMaximum: 120, safetyFactor: "0.80", isGovernment: true },
  { provider: "bls_api", domain: "api.bls.gov", currentRpm: 10, staticMaximum: 25, safetyFactor: "0.50", isGovernment: true },
  { provider: "census_acs", domain: "api.census.gov", currentRpm: 60, staticMaximum: 60, safetyFactor: "0.50", isGovernment: true },
  { provider: "cfp_board", domain: "cfp.net", currentRpm: 2, staticMaximum: 5, safetyFactor: "0.50", isGovernment: false },
  { provider: "nasba_cpaverify", domain: "cpaverify.org", currentRpm: 2, staticMaximum: 5, safetyFactor: "0.50", isGovernment: false },
  { provider: "nmls_consumer", domain: "nmlsconsumeraccess.org", currentRpm: 2, staticMaximum: 5, safetyFactor: "0.50", isGovernment: false },
  { provider: "tavily", domain: "api.tavily.com", currentRpm: 60, staticMaximum: 60, safetyFactor: "0.80", isGovernment: false },
  { provider: "brave_search", domain: "api.search.brave.com", currentRpm: 40, staticMaximum: 40, safetyFactor: "0.80", isGovernment: false },
  { provider: "nipr_pdb", domain: "pdb.nipr.com", currentRpm: 5, staticMaximum: 10, safetyFactor: "0.50", isGovernment: false },
];
export async function seed() {
  const db = await getDb(); if (!db) { console.log("[seed:00] No DB — skipping"); return; }
  const { rateProfiles } = await import("../../drizzle/schema");
  const { eq } = await import("drizzle-orm");
  let inserted = 0;
  for (const p of PROFILES) {
    const [exists] = await db.select().from(rateProfiles).where(eq(rateProfiles.provider, p.provider)).limit(1);
    if (exists) continue;
    await db.insert(rateProfiles).values(p); inserted++;
  }
  console.log(`[seed:00] Rate profiles: ${inserted} inserted, ${PROFILES.length - inserted} skipped`);
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
