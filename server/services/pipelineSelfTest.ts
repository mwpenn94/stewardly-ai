/**
 * Pipeline Startup Self-Test
 * 
 * Validates DB connectivity, API reachability, and credential decryption
 * before the scheduler starts running pipelines. Logs detailed diagnostics
 * so production issues can be traced immediately.
 */

import { getDb } from "../db";
import { integrationProviders, integrationConnections } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { decryptCredentials } from "./encryption";

export interface SelfTestResult {
  provider: string;
  slug: string;
  dbLookup: "pass" | "fail";
  credentialDecrypt: "pass" | "fail" | "skip" | "no_connection";
  apiReachable: "pass" | "fail" | "skip";
  error?: string;
  details?: string;
}

const API_HEALTH_ENDPOINTS: Record<string, { url: string; method?: string; headers?: Record<string, string> }> = {
  "bls": { url: "https://api.bls.gov/publicAPI/v2/timeseries/data/", method: "HEAD" },
  "fred": { url: "https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=DEMO_KEY&file_type=json" },
  "bea": { url: "https://apps.bea.gov/api/data?UserID=DEMO&method=GetParameterList&DatasetName=NIPA&ResultFormat=JSON" },
  "census-bureau": { url: "https://api.census.gov/data.json" },
  "sec-edgar": { url: "https://data.sec.gov/submissions/CIK0000320193.json", headers: { "User-Agent": "Stewardly support@stewardly.com" } },
  "finra-brokercheck": { url: "https://api.brokercheck.finra.org/search/firm?query=test&nrows=1", headers: { "Accept": "application/json" } },
};

/**
 * Run full self-test for all pipeline providers.
 * Returns detailed results for each provider.
 */
export async function runPipelineSelfTest(): Promise<{
  overall: "pass" | "partial" | "fail";
  dbConnected: boolean;
  results: SelfTestResult[];
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();
  console.log(`[SelfTest] Starting pipeline self-test at ${timestamp}`);

  // 1. Test DB connectivity
  let dbConnected = false;
  let db: Awaited<ReturnType<typeof getDb>> = null;
  try {
    db = await getDb();
    if (db) {
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`SELECT 1`);
      dbConnected = true;
      console.log("[SelfTest] ✓ Database connected");
    }
  } catch (e: any) {
    console.error(`[SelfTest] ✗ Database connection failed: ${e.message}`);
  }

  if (!dbConnected || !db) {
    console.error("[SelfTest] CRITICAL: Database not available. All pipelines will fail.");
    return {
      overall: "fail",
      dbConnected: false,
      results: Object.keys(API_HEALTH_ENDPOINTS).map(slug => ({
        provider: slug,
        slug,
        dbLookup: "fail" as const,
        credentialDecrypt: "skip" as const,
        apiReachable: "skip" as const,
        error: "Database not available",
      })),
      timestamp,
    };
  }

  // 2. Test each provider
  const results: SelfTestResult[] = [];
  const slugs = Object.keys(API_HEALTH_ENDPOINTS);

  for (const slug of slugs) {
    const result: SelfTestResult = {
      provider: slug,
      slug,
      dbLookup: "fail",
      credentialDecrypt: "skip",
      apiReachable: "skip",
    };

    // 2a. DB lookup — can we find the provider?
    try {
      const providers = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.slug, slug));
      if (providers.length > 0) {
        result.dbLookup = "pass";
        
        // 2b. Credential decryption — can we decrypt stored credentials?
        const connections = await db.select().from(integrationConnections)
          .where(and(
            eq(integrationConnections.providerId, providers[0].id),
            eq(integrationConnections.status, "connected"),
          ));

        if (connections.length === 0) {
          result.credentialDecrypt = "no_connection";
          result.details = "No active connection found";
        } else {
          const conn = connections[0];
          if (conn.credentialsEncrypted) {
            try {
              const creds = decryptCredentials(conn.credentialsEncrypted);
              const key = (creds.api_key || creds.apiKey || creds.access_token || "") as string;
              if (key) {
                result.credentialDecrypt = "pass";
                result.details = `Key decrypted (${key.substring(0, 4)}...${key.substring(key.length - 4)})`;
              } else {
                result.credentialDecrypt = "fail";
                result.error = "Decrypted credentials but no api_key/apiKey/access_token found";
              }
            } catch (e: any) {
              result.credentialDecrypt = "fail";
              result.error = `Decryption failed: ${e.message}`;
            }
          } else {
            // Keyless API (SEC EDGAR, FINRA)
            result.credentialDecrypt = "skip";
            result.details = "Keyless API — no credentials needed";
          }
        }
      } else {
        result.error = `Provider "${slug}" not found in database`;
      }
    } catch (e: any) {
      result.error = `DB lookup failed: ${e.message}`;
    }

    // 2c. API reachability — can we reach the API endpoint?
    const endpoint = API_HEALTH_ENDPOINTS[slug];
    try {
      const resp = await fetch(endpoint.url, {
        method: endpoint.method || "GET",
        headers: endpoint.headers || {},
        signal: AbortSignal.timeout(10000),
      });
      // We don't need 200 — just that the server responds (even 400/401 means it's reachable)
      result.apiReachable = resp.status < 500 ? "pass" : "fail";
      if (result.apiReachable === "fail") {
        result.error = (result.error ? result.error + "; " : "") + `API returned HTTP ${resp.status}`;
      }
    } catch (e: any) {
      result.apiReachable = "fail";
      result.error = (result.error ? result.error + "; " : "") + `API unreachable: ${e.message}`;
    }

    const statusIcon = result.dbLookup === "pass" && result.apiReachable === "pass" ? "✓" : "✗";
    console.log(`[SelfTest] ${statusIcon} ${slug}: db=${result.dbLookup}, creds=${result.credentialDecrypt}, api=${result.apiReachable}${result.error ? ` (${result.error})` : ""}`);
    results.push(result);
  }

  // 3. Determine overall status
  const allPass = results.every(r => r.dbLookup === "pass" && r.apiReachable === "pass");
  const allFail = results.every(r => r.dbLookup === "fail" || r.apiReachable === "fail");
  const overall = allPass ? "pass" : allFail ? "fail" : "partial";

  console.log(`[SelfTest] Complete: ${overall.toUpperCase()} (${results.filter(r => r.dbLookup === "pass").length}/${results.length} DB, ${results.filter(r => r.apiReachable === "pass").length}/${results.length} API)`);

  return { overall, dbConnected, results, timestamp };
}
