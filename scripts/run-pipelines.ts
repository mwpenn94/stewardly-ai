/**
 * Run all data pipelines and report detailed results
 */
import { runAllDataPipelines, runSinglePipeline, getCachedData, getEconomicDataSummary } from "../server/services/governmentDataPipelines";

async function main() {
  console.log("=== Running All Data Pipelines ===\n");
  
  const results = await runAllDataPipelines();
  
  for (const r of results) {
    console.log(`\n--- ${r.pipeline} (${r.providerSlug}) ---`);
    console.log(`  Status: ${r.status}`);
    console.log(`  Records fetched: ${r.recordsFetched}`);
    console.log(`  Duration: ${r.duration}ms`);
    if (r.error) console.log(`  Error: ${r.error}`);
  }

  // Check cached data for each provider
  console.log("\n\n=== Cached Data Summary ===\n");
  for (const slug of ["bls", "fred", "bea", "census-bureau"]) {
    const cached = await getCachedData(slug);
    console.log(`${slug}: ${cached.length} cached records`);
    for (const entry of cached.slice(0, 3)) {
      const d = entry.resultJson as any;
      console.log(`  - ${d?.label}: ${d?.value} ${d?.unit || ""} (${d?.date})`);
    }
    if (cached.length > 3) console.log(`  ... and ${cached.length - 3} more`);
  }

  // Get economic summary for AI
  console.log("\n\n=== Economic Data Summary for AI ===\n");
  const summary = await getEconomicDataSummary();
  console.log(summary || "(empty)");

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
