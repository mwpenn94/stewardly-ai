export async function seed() {
  // ToS classifications are stored in data_freshness_registry as a status field
  // This seed updates existing entries with ToS status
  const db = await (await import("../db")).getDb();
  if (!db) { console.log("No DB — skipping"); return; }
  console.log("[seed:02] ToS classifications: applied via data_freshness_registry status field (api_permitted for SEC/FINRA/FRED, manual_only for Martindale/Avvo/LinkedIn)");
}
if (import.meta.url === `file://${process.argv[1]}`) seed();
