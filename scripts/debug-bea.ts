/**
 * Debug BEA API responses to understand why 0 records are stored
 */
import { getDb } from "../server/db";
import { integrationConnections, integrationProviders } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { decryptCredentials } from "../server/services/encryption";

async function getApiKey(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("No DB");
  const providers = await db.select().from(integrationProviders).where(eq(integrationProviders.slug, "bea"));
  const provider = providers[0];
  if (!provider) throw new Error("No BEA provider");
  const conns = await db.select().from(integrationConnections)
    .where(and(eq(integrationConnections.providerId, provider.id), eq(integrationConnections.status, "connected")));
  for (const conn of conns) {
    if (conn.credentialsEncrypted) {
      const creds = decryptCredentials(conn.credentialsEncrypted);
      const key = (creds.api_key || creds.apiKey || "") as string;
      if (key) return key;
    }
  }
  throw new Error("No BEA API key");
}

async function main() {
  const apiKey = await getApiKey();
  console.log(`BEA API Key: ${apiKey.substring(0, 8)}... (length: ${apiKey.length})`);

  // Test 1: GDP NIPA Table T10101
  console.log("\n=== Test 1: GDP NIPA T10101 ===");
  const url1 = `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GetData&DatasetName=NIPA&Frequency=Q&TableName=T10101&Year=LAST5&ResultFormat=JSON`;
  const resp1 = await fetch(url1, { signal: AbortSignal.timeout(20000) });
  console.log(`Status: ${resp1.status}`);
  const text1 = await resp1.text();
  console.log(`Response length: ${text1.length}`);
  
  try {
    const data1 = JSON.parse(text1);
    const results1 = data1?.BEAAPI?.Results?.Data;
    const error1 = data1?.BEAAPI?.Results?.Error;
    if (error1) {
      console.log(`ERROR: ${JSON.stringify(error1)}`);
    }
    console.log(`Is array: ${Array.isArray(results1)}, length: ${results1?.length || 0}`);
    if (results1?.[0]) {
      console.log(`First row keys: ${Object.keys(results1[0]).join(", ")}`);
      console.log(`First row: ${JSON.stringify(results1[0])}`);
      // Check for LineNumber field
      const lineNumbers = [...new Set(results1.map((r: any) => r.LineNumber))].slice(0, 10);
      console.log(`Line numbers found: ${lineNumbers.join(", ")}`);
      // Check for target lines
      const targetLines = ["1", "2", "7", "13", "22"];
      for (const ln of targetLines) {
        const match = results1.find((r: any) => r.LineNumber === ln);
        console.log(`  Line ${ln}: ${match ? JSON.stringify(match) : "NOT FOUND"}`);
      }
    }
  } catch (e: any) {
    console.log(`Parse error: ${e.message}`);
    console.log(`First 300 chars: ${text1.substring(0, 300)}`);
  }

  // Test 2: Personal Income T20100
  console.log("\n=== Test 2: Personal Income T20100 ===");
  const url2 = `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GetData&DatasetName=NIPA&Frequency=M&TableName=T20100&Year=X&ResultFormat=JSON`;
  const resp2 = await fetch(url2, { signal: AbortSignal.timeout(20000) });
  console.log(`Status: ${resp2.status}`);
  const text2 = await resp2.text();
  console.log(`Response length: ${text2.length}`);
  
  try {
    const data2 = JSON.parse(text2);
    const results2 = data2?.BEAAPI?.Results?.Data;
    const error2 = data2?.BEAAPI?.Results?.Error;
    if (error2) {
      console.log(`ERROR: ${JSON.stringify(error2)}`);
    }
    console.log(`Is array: ${Array.isArray(results2)}, length: ${results2?.length || 0}`);
    if (results2?.[0]) {
      console.log(`First row keys: ${Object.keys(results2[0]).join(", ")}`);
      console.log(`First row: ${JSON.stringify(results2[0])}`);
    }
  } catch (e: any) {
    console.log(`Parse error: ${e.message}`);
    console.log(`First 300 chars: ${text2.substring(0, 300)}`);
  }

  // Test 3: Try a simpler BEA request — GetDataSetList
  console.log("\n=== Test 3: GetDataSetList (sanity check) ===");
  const url3 = `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GETDATASETLIST&ResultFormat=JSON`;
  const resp3 = await fetch(url3, { signal: AbortSignal.timeout(20000) });
  const data3 = await resp3.json();
  const datasets = data3?.BEAAPI?.Results?.Dataset;
  console.log(`Datasets found: ${datasets?.length || 0}`);
  if (datasets) {
    for (const ds of datasets.slice(0, 5)) {
      console.log(`  - ${ds.DatasetName}: ${ds.DatasetDescription}`);
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
