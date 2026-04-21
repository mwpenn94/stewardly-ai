/**
 * Live Reconciliation Runner
 * Runs the full bidirectional sync reconciliation and outputs results.
 * Usage: node --import tsx/esm server/run-reconcile.mjs
 */
import { reconcile, getSyncAggregation } from "./services/syncReconciliation.ts";

console.log("=== Pre-Reconciliation Aggregation ===");
const preSyncAgg = await getSyncAggregation();
console.log(JSON.stringify(preSyncAgg, null, 2));

console.log("\n=== Running Full Bidirectional Reconciliation (max 500 GHL contacts) ===");
const stats = await reconcile({ maxGHLContacts: 500, pushOrphans: true });
console.log(JSON.stringify({
  ...stats,
  conflicts: `${stats.conflicts.length} total (details below)`,
}, null, 2));

console.log("\n=== Post-Reconciliation Aggregation ===");
const postSyncAgg = await getSyncAggregation();
console.log(JSON.stringify(postSyncAgg, null, 2));

console.log("\n=== Reconciliation Summary ===");
console.log(`GHL contacts synced: ${stats.ghlTotal}`);
console.log(`Stewardly leads:     ${stats.stewardlyTotal}`);
console.log(`Matched:             ${stats.matched}`);
console.log(`Created in Stewardly: ${stats.createdInStewardly}`);
console.log(`Created in GHL:      ${stats.createdInGHL}`);
console.log(`Updated in Stewardly: ${stats.updatedInStewardly}`);
console.log(`Updated in GHL:      ${stats.updatedInGHL}`);
console.log(`Conflicts resolved:  ${stats.conflictsResolved}`);
console.log(`Orphans fixed:       ${stats.orphansFixed}`);
console.log(`Errors:              ${stats.errors}`);
console.log(`Duration:            ${stats.duration_ms}ms`);

if (stats.conflicts.length > 0) {
  console.log(`\n=== Conflict Details (first 10 of ${stats.conflicts.length}) ===`);
  for (const c of stats.conflicts.slice(0, 10)) {
    console.log(`  ${c.field}: "${c.stewardlyValue}" vs "${c.ghlValue}" → ${c.resolution}`);
  }
}

// Consistency check
console.log("\n=== Consistency Check ===");
const postLinked = postSyncAgg.ghlLinked;
const postTotal = postSyncAgg.stewardlyTotal;
const linkRate = postTotal > 0 ? ((postLinked / postTotal) * 100).toFixed(1) : "N/A";
console.log(`Link rate: ${postLinked}/${postTotal} (${linkRate}%)`);
console.log(`Unlinked:  ${postSyncAgg.ghlUnlinked}`);

if (postSyncAgg.ghlUnlinked === 0) {
  console.log("✅ TOTAL CONSISTENCY ACHIEVED — every Stewardly lead is linked to a GHL contact");
} else {
  console.log(`⚠️  ${postSyncAgg.ghlUnlinked} leads still unlinked (may be contacts without email/phone)`);
}

process.exit(0);
