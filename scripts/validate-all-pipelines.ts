/**
 * Validate all 6 data pipelines end-to-end with real API calls
 */
import { runAllDataPipelines, getCachedData, getEconomicDataSummary } from "../server/services/governmentDataPipelines";

async function main() {
  console.log("=== Validating All 6 Data Pipelines ===\n");
  
  const results = await runAllDataPipelines();
  
  let totalRecords = 0;
  let successCount = 0;
  let errorCount = 0;
  
  for (const r of results) {
    const icon = r.status === "success" ? "✓" : r.status === "skipped" ? "⊘" : "✗";
    console.log(`${icon} ${r.pipeline.padEnd(20)} | ${r.status.padEnd(8)} | ${String(r.recordsFetched).padStart(3)} records | ${r.duration}ms${r.error ? ` | ERROR: ${r.error}` : ""}`);
    totalRecords += r.recordsFetched;
    if (r.status === "success") successCount++;
    if (r.status === "error") errorCount++;
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total records: ${totalRecords}`);
  console.log(`Successful: ${successCount}/${results.length}`);
  console.log(`Errors: ${errorCount}/${results.length}`);

  // Check cached data for all providers
  console.log("\n\n=== Cached Data by Provider ===\n");
  const slugs = ["bls", "fred", "bea", "census-bureau", "sec-edgar", "finra-brokercheck"];
  for (const slug of slugs) {
    const cached = await getCachedData(slug);
    console.log(`${slug}: ${cached.length} cached records`);
    for (const entry of cached.slice(0, 3)) {
      const d = entry.resultJson as any;
      console.log(`  - ${d?.label}: ${d?.value} ${d?.unit || ""}`);
    }
    if (cached.length > 3) console.log(`  ... and ${cached.length - 3} more`);
  }

  // Get AI summary
  console.log("\n\n=== AI Economic Data Summary ===\n");
  const summary = await getEconomicDataSummary();
  const lines = summary.split("\n");
  console.log(`Summary: ${lines.length} lines, ${summary.length} chars`);
  // Show first 20 lines
  console.log(lines.slice(0, 20).join("\n"));
  if (lines.length > 20) console.log(`... and ${lines.length - 20} more lines`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
