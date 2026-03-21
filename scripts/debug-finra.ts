/**
 * Debug FINRA BrokerCheck API response format
 */
async function main() {
  const resp = await fetch(
    "https://api.brokercheck.finra.org/search/firm?query=charles+schwab&filter=active=true&hl=true&nrows=1&start=0",
    {
      headers: {
        "Accept": "application/json",
        "User-Agent": "WealthBridgeAI support@wealthbridge.ai",
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  console.log(`Status: ${resp.status}`);
  const text = await resp.text();
  console.log(`Response length: ${text.length}`);
  
  try {
    const data = JSON.parse(text);
    console.log(`Top-level keys: ${Object.keys(data).join(", ")}`);
    console.log(`hits keys: ${Object.keys(data.hits || {}).join(", ")}`);
    console.log(`hits.total: ${JSON.stringify(data.hits?.total)}`);
    
    const hits = data.hits?.hits;
    if (Array.isArray(hits) && hits.length > 0) {
      const hit = hits[0];
      console.log(`\nhit keys: ${Object.keys(hit).join(", ")}`);
      console.log(`_source keys: ${Object.keys(hit._source || {}).join(", ")}`);
      console.log(`\nFull _source:\n${JSON.stringify(hit._source, null, 2).substring(0, 3000)}`);
    }
  } catch (e: any) {
    console.log(`Not JSON. First 500 chars:\n${text.substring(0, 500)}`);
  }

  // Also try individual search
  console.log("\n\n=== Individual search ===");
  const resp2 = await fetch(
    "https://api.brokercheck.finra.org/search/individual?query=*&filter=active=true&nrows=0&start=0",
    {
      headers: { "Accept": "application/json", "User-Agent": "WealthBridgeAI support@wealthbridge.ai" },
      signal: AbortSignal.timeout(15000),
    },
  );
  console.log(`Status: ${resp2.status}`);
  const text2 = await resp2.text();
  console.log(`Response length: ${text2.length}`);
  try {
    const data2 = JSON.parse(text2);
    console.log(`Top keys: ${Object.keys(data2).join(", ")}`);
    console.log(`hits.total: ${JSON.stringify(data2.hits?.total)}`);
  } catch {
    console.log(`Not JSON. First 500:\n${text2.substring(0, 500)}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
