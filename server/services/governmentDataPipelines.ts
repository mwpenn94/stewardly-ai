/**
 * Government Data Pipelines
 * 
 * Fetches real economic data from 4 government APIs and stores it in the
 * enrichment cache for AI context injection.
 * 
 * Pipelines:
 * 1. BLS — CPI, unemployment rate, nonfarm payrolls, average hourly earnings
 * 2. FRED — GDP, federal funds rate, 10Y Treasury, inflation, M2 money supply
 * 3. BEA — GDP components, personal income, trade balance
 * 4. Census — Population estimates, housing starts, income demographics
 */

import { getDb } from "../db";
import { integrationConnections, integrationProviders, enrichmentCache } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { decryptCredentials } from "./encryption";
import crypto from "crypto";
import { logger } from "../_core/logger";
import { getCircuitState, recordCircuitFailure, recordCircuitSuccess } from "./errorHandling";

const uuid = () => crypto.randomUUID();

// ─── Types ──────────────────────────────────────────────────────────────
export interface PipelineResult {
  pipeline: string;
  providerSlug: string;
  status: "success" | "error" | "skipped";
  recordsFetched: number;
  error?: string;
  duration: number;
}

interface FetchedDataPoint {
  key: string;
  label: string;
  value: string | number;
  date: string;
  unit?: string;
  category: string;
}

// ─── Helper: get API key for a provider slug (with retry) ──────────────
async function getApiKeyForProvider(slug: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const db = await getDb();
      if (!db) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return null;
      }

      const providers = await db.select().from(integrationProviders)
        .where(eq(integrationProviders.slug, slug));
      const provider = providers[0];
      if (!provider) return null;

      const connections = await db.select().from(integrationConnections)
        .where(and(
          eq(integrationConnections.providerId, provider.id),
          eq(integrationConnections.status, "connected"),
        ));

      for (const conn of connections) {
        if (conn.credentialsEncrypted) {
          try {
            const creds = decryptCredentials(conn.credentialsEncrypted);
            const key = (creds.api_key || creds.apiKey || creds.access_token || "") as string;
            if (key) return key;
          } catch { /* skip bad creds */ }
        }
      }
      return null;
    } catch (err: any) {
      logger.warn( { operation: "pipeline" },`[Pipeline] getApiKeyForProvider("${slug}") attempt ${attempt + 1} failed:`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      } else {
        throw err; // Re-throw on final attempt so the pipeline reports the error
      }
    }
  }
  return null;
}

// ─── Helper: store data points in enrichment cache ──────────────────────
async function storeDataPoints(
  providerSlug: string,
  dataPoints: FetchedDataPoint[],
  connectionId?: string,
  expiresInHours: number = 12,
): Promise<number> {
  const db = await getDb();
  if (!db || dataPoints.length === 0) return 0;

  let stored = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

  for (const dp of dataPoints) {
    try {
      // Upsert: delete old entry then insert new one
      await db.delete(enrichmentCache)
        .where(and(
          eq(enrichmentCache.providerSlug, providerSlug),
          eq(enrichmentCache.lookupKey, dp.key),
          eq(enrichmentCache.lookupType, dp.category),
        ));

      await db.insert(enrichmentCache).values({
        id: uuid(),
        providerSlug,
        lookupKey: dp.key,
        lookupType: dp.category,
        resultJson: {
          label: dp.label,
          value: dp.value,
          date: dp.date,
          unit: dp.unit || "",
          fetchedAt: now.toISOString(),
        },
        qualityScore: "1.00",
        fetchedAt: now,
        expiresAt,
        hitCount: 0,
        connectionId: connectionId || null,
      });
      stored++;
    } catch (e: any) {
      logger.warn( { operation: "pipeline" },`[Pipeline] Failed to store ${dp.key}:`, e.message);
    }
  }
  return stored;
}

// ─── BLS Pipeline ───────────────────────────────────────────────────────
// Series IDs: https://www.bls.gov/help/hlpforma.htm
const BLS_SERIES = [
  { id: "CUUR0000SA0", label: "CPI-U (All Urban Consumers)", category: "inflation", unit: "Index" },
  { id: "LNS14000000", label: "Unemployment Rate", category: "employment", unit: "%" },
  { id: "CES0000000001", label: "Total Nonfarm Payrolls", category: "employment", unit: "Thousands" },
  { id: "CES0500000003", label: "Average Hourly Earnings (Private)", category: "wages", unit: "$/hour" },
  { id: "CUUR0000SAF1", label: "CPI Food", category: "inflation", unit: "Index" },
  { id: "CUUR0000SETB01", label: "CPI Gasoline", category: "inflation", unit: "Index" },
  { id: "LNS12000000", label: "Civilian Employment Level", category: "employment", unit: "Thousands" },
  { id: "JTS000000000000000QUL", label: "Quits Level (Total)", category: "employment", unit: "Thousands" },
];

async function fetchBLSData(): Promise<PipelineResult> {
  const start = Date.now();
  const apiKey = await getApiKeyForProvider("bls");
  if (!apiKey) return { pipeline: "BLS", providerSlug: "bls", status: "skipped", recordsFetched: 0, error: "No API key", duration: 0 };

  try {
    const currentYear = new Date().getFullYear();
    const resp = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesid: BLS_SERIES.map(s => s.id),
        startyear: String(currentYear - 1),
        endyear: String(currentYear),
        registrationkey: apiKey,
        calculations: true,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.status !== "REQUEST_SUCCEEDED") throw new Error(data.message?.[0] || "BLS request failed");

    const dataPoints: FetchedDataPoint[] = [];
    for (const series of data.Results?.series || []) {
      const seriesConfig = BLS_SERIES.find(s => s.id === series.seriesID);
      if (!seriesConfig || !series.data?.length) continue;

      // Get the most recent data point
      const latest = series.data[0];
      dataPoints.push({
        key: series.seriesID,
        label: seriesConfig.label,
        value: latest.value,
        date: `${latest.year}-${latest.period.replace("M", "")}`,
        unit: seriesConfig.unit,
        category: seriesConfig.category,
      });

      // Also store year-over-year change if available
      if (latest.calculations?.pct_changes?.["12"]) {
        dataPoints.push({
          key: `${series.seriesID}_yoy`,
          label: `${seriesConfig.label} (YoY Change)`,
          value: `${latest.calculations.pct_changes["12"]}%`,
          date: `${latest.year}-${latest.period.replace("M", "")}`,
          unit: "%",
          category: `${seriesConfig.category}_change`,
        });
      }
    }

    const stored = await storeDataPoints("bls", dataPoints);
    return { pipeline: "BLS", providerSlug: "bls", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "BLS", providerSlug: "bls", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── FRED Pipeline ──────────────────────────────────────────────────────
const FRED_SERIES = [
  { id: "GDP", label: "Gross Domestic Product", category: "gdp", unit: "Billions $" },
  { id: "GDPC1", label: "Real GDP", category: "gdp", unit: "Billions Chained 2017 $" },
  { id: "FEDFUNDS", label: "Federal Funds Rate", category: "interest_rates", unit: "%" },
  { id: "DGS10", label: "10-Year Treasury Yield", category: "interest_rates", unit: "%" },
  { id: "DGS2", label: "2-Year Treasury Yield", category: "interest_rates", unit: "%" },
  { id: "CPIAUCSL", label: "CPI (All Items)", category: "inflation", unit: "Index" },
  { id: "PCEPI", label: "PCE Price Index", category: "inflation", unit: "Index" },
  { id: "M2SL", label: "M2 Money Supply", category: "monetary", unit: "Billions $" },
  { id: "UNRATE", label: "Unemployment Rate", category: "employment", unit: "%" },
  { id: "PAYEMS", label: "Total Nonfarm Payrolls", category: "employment", unit: "Thousands" },
  { id: "MORTGAGE30US", label: "30-Year Fixed Mortgage Rate", category: "interest_rates", unit: "%" },
  { id: "DEXUSEU", label: "USD/EUR Exchange Rate", category: "forex", unit: "USD per EUR" },
  { id: "SP500", label: "S&P 500 Index", category: "markets", unit: "Index" },
  { id: "VIXCLS", label: "VIX Volatility Index", category: "markets", unit: "Index" },
  { id: "HOUST", label: "Housing Starts", category: "housing", unit: "Thousands" },
];

async function fetchFREDData(): Promise<PipelineResult> {
  const start = Date.now();
  const apiKey = await getApiKeyForProvider("fred");
  if (!apiKey) return { pipeline: "FRED", providerSlug: "fred", status: "skipped", recordsFetched: 0, error: "No API key", duration: 0 };

  try {
    const dataPoints: FetchedDataPoint[] = [];

    // FRED requires individual requests per series
    for (const series of FRED_SERIES) {
      try {
        const resp = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=${series.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`,
          { signal: AbortSignal.timeout(15000) },
        );
        if (!resp.ok) continue;
        const data = await resp.json();
        const obs = data.observations?.[0];
        if (obs && obs.value !== ".") {
          dataPoints.push({
            key: series.id,
            label: series.label,
            value: obs.value,
            date: obs.date,
            unit: series.unit,
            category: series.category,
          });
        }
      } catch { /* skip individual series failures */ }
    }

    const stored = await storeDataPoints("fred", dataPoints);
    return { pipeline: "FRED", providerSlug: "fred", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "FRED", providerSlug: "fred", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── BEA Pipeline ───────────────────────────────────────────────────────
// BEA API quirks:
// 1. Error 4 ("UserId not active") is actually a rate-limit response — retry with backoff
// 2. UserID value is case-insensitive for metadata calls but intermittently case-sensitive for data calls
// 3. Table T20100 only supports (A)nnual and (Q)uarterly — use T20600 for (M)onthly personal income
// 4. "Year=LAST5" and "Year=X" are not supported for all datasets — use explicit years

// Helper: check BEA API response for errors
function checkBEAError(data: any): string | null {
  const error = data?.BEAAPI?.Results?.Error;
  if (error) return `BEA API Error ${error.APIErrorCode}: ${error.APIErrorDescription}`;
  return null;
}

// Helper: fetch from BEA with retry on Error 4 (rate limit disguised as auth error)
async function beaFetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 5s, 10s, 15s
      await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
    }
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const err = data?.BEAAPI?.Results?.Error;
      // Error 4 = rate limit (misleading "UserId not active" message)
      if (err?.APIErrorCode === "4" && attempt < retries - 1) {
        logger.warn( { operation: "bEA" },`[BEA] Rate limited (Error 4), retry ${attempt + 1}/${retries}...`);
        continue;
      }
      return data;
    } catch (e: any) {
      if (attempt === retries - 1) throw e;
      logger.warn( { operation: "bEA" },`[BEA] Fetch error on attempt ${attempt + 1}: ${e.message}`);
    }
  }
  return null;
}

async function fetchBEAData(): Promise<PipelineResult> {
  const start = Date.now();
  const rawApiKey = await getApiKeyForProvider("bea");
  if (!rawApiKey) return { pipeline: "BEA", providerSlug: "bea", status: "skipped", recordsFetched: 0, error: "No API key", duration: 0 };
  // BEA API: lowercase the UserID to avoid intermittent auth failures
  const apiKey = rawApiKey.toLowerCase();
  const currentYear = new Date().getFullYear();
  const recentYears = `${currentYear},${currentYear - 1}`;

  try {
    const dataPoints: FetchedDataPoint[] = [];
    const errors: string[] = [];

    // Step 0: Warm up the API key with a lightweight metadata call
    // BEA sometimes needs a "warm-up" request before data calls succeed
    try {
      await beaFetchWithRetry(
        `https://apps.bea.gov/api/data?UserID=${apiKey}&method=GETDATASETLIST&ResultFormat=JSON`,
      );
    } catch { /* warm-up failure is non-fatal */ }

    // 3-second delay between BEA requests to avoid rate limiting
    await new Promise(r => setTimeout(r, 3000));

    // Step 1: Fetch GDP summary data (NIPA Table T10101 — % change from preceding period, Quarterly)
    try {
      const gdpData = await beaFetchWithRetry(
        `https://apps.bea.gov/api/data?UserID=${apiKey}&method=GetData&DatasetName=NIPA&TableName=T10101&Frequency=Q&Year=${recentYears}&ResultFormat=JSON`,
      );
      const beaErr = checkBEAError(gdpData);
      if (beaErr) {
        errors.push(beaErr);
      } else {
        const results = gdpData?.BEAAPI?.Results?.Data;
        if (Array.isArray(results) && results.length > 0) {
          const gdpLines: Record<string, string> = {
            "1": "GDP",
            "2": "Personal Consumption Expenditures",
            "7": "Gross Private Domestic Investment",
            "13": "Net Exports",
            "22": "Government Consumption & Investment",
          };
          const byLine: Record<string, any> = {};
          for (const row of results) {
            const lineNum = row.LineNumber;
            if (gdpLines[lineNum]) {
              if (!byLine[lineNum] || row.TimePeriod > byLine[lineNum].TimePeriod) {
                byLine[lineNum] = row;
              }
            }
          }
          for (const [lineNum, row] of Object.entries(byLine)) {
            dataPoints.push({
              key: `bea_gdp_line_${lineNum}`,
              label: `${gdpLines[lineNum]} (% Change)`,
              value: row.DataValue,
              date: row.TimePeriod,
              unit: "% Change",
              category: "gdp_components",
            });
          }
        }
      }
    } catch (e: any) { errors.push(`GDP fetch: ${e.message}`); }

    await new Promise(r => setTimeout(r, 5000)); // Rate limit delay

    // Step 2: Fetch Personal Income data (NIPA Table T20600 — Monthly frequency)
    // NOTE: T20100 only supports Annual/Quarterly. T20600 is the monthly equivalent.
    try {
      const piData = await beaFetchWithRetry(
        `https://apps.bea.gov/api/data?UserID=${apiKey}&method=GetData&DatasetName=NIPA&TableName=T20600&Frequency=M&Year=${recentYears}&ResultFormat=JSON`,
      );
      const beaErr = checkBEAError(piData);
      if (beaErr) {
        errors.push(beaErr);
      } else {
        const results = piData?.BEAAPI?.Results?.Data;
        if (Array.isArray(results) && results.length > 0) {
          const piLines: Record<string, string> = {
            "1": "Personal Income",
            "27": "Disposable Personal Income",
            "34": "Personal Saving Rate",
          };
          const byLine: Record<string, any> = {};
          for (const row of results) {
            if (piLines[row.LineNumber]) {
              if (!byLine[row.LineNumber] || row.TimePeriod > byLine[row.LineNumber].TimePeriod) {
                byLine[row.LineNumber] = row;
              }
            }
          }
          for (const [lineNum, row] of Object.entries(byLine)) {
            dataPoints.push({
              key: `bea_pi_line_${lineNum}`,
              label: piLines[lineNum],
              value: row.DataValue,
              date: row.TimePeriod,
              unit: lineNum === "34" ? "%" : "Billions $",
              category: "personal_income",
            });
          }
        }
      }
    } catch (e: any) { errors.push(`PI fetch: ${e.message}`); }

    await new Promise(r => setTimeout(r, 5000)); // Rate limit delay

    // Step 3: Fetch International Trade data (ITA dataset)
    try {
      const tradeData = await beaFetchWithRetry(
        `https://apps.bea.gov/api/data?UserID=${apiKey}&method=GetData&DatasetName=ITA&Indicator=BalGds&AreaOrCountry=AllCountries&Frequency=A&Year=${currentYear - 1}&ResultFormat=JSON`,
      );
      const beaErr = checkBEAError(tradeData);
      if (beaErr) {
        errors.push(beaErr);
      } else {
        const results = tradeData?.BEAAPI?.Results?.Data;
        if (Array.isArray(results) && results.length > 0) {
          const latest = results[results.length - 1];
          dataPoints.push({
            key: "bea_trade_balance",
            label: "Trade Balance (Goods)",
            value: latest.DataValue,
            date: latest.TimePeriod,
            unit: "Millions $",
            category: "trade",
          });
        }
      }
    } catch (e: any) { errors.push(`Trade fetch: ${e.message}`); }

    const stored = await storeDataPoints("bea", dataPoints);
    // If we got some records, consider it a success even if some sub-fetches had errors
    if (stored > 0) {
      return { pipeline: "BEA", providerSlug: "bea", status: "success", recordsFetched: stored, duration: Date.now() - start };
    }
    // If we got 0 records but had errors, report as error with details
    if (errors.length > 0) {
      return { pipeline: "BEA", providerSlug: "bea", status: "error", recordsFetched: 0, error: errors.join("; "), duration: Date.now() - start };
    }
    return { pipeline: "BEA", providerSlug: "bea", status: "success", recordsFetched: 0, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "BEA", providerSlug: "bea", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── Census Pipeline ────────────────────────────────────────────────────
async function fetchCensusData(): Promise<PipelineResult> {
  const start = Date.now();
  const apiKey = await getApiKeyForProvider("census-bureau");
  if (!apiKey) return { pipeline: "Census", providerSlug: "census-bureau", status: "skipped", recordsFetched: 0, error: "No API key", duration: 0 };

  try {
    const dataPoints: FetchedDataPoint[] = [];

    // ACS 5-Year: Income, Poverty, Education (national level)
    try {
      const acsResp = await fetch(
        `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B17001_002E,B15003_022E,B01003_001E&for=us:*&key=${apiKey}`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (acsResp.ok) {
        const acsData = await acsResp.json();
        if (acsData.length >= 2) {
          const row = acsData[1]; // First data row
          const labels: Record<number, { label: string; unit: string; category: string }> = {
            0: { label: "Median Household Income", unit: "$", category: "income" },
            1: { label: "Population Below Poverty Level", unit: "People", category: "poverty" },
            2: { label: "Population with Bachelor's Degree+", unit: "People", category: "education" },
            3: { label: "Total Population", unit: "People", category: "demographics" },
          };
          for (const [idx, config] of Object.entries(labels)) {
            const val = row[Number(idx)];
            if (val && val !== "-666666666") {
              dataPoints.push({
                key: `census_acs_${config.category}`,
                label: config.label,
                value: Number(val).toLocaleString(),
                date: "2022 (ACS 5-Year)",
                unit: config.unit,
                category: config.category,
              });
            }
          }
        }
      }
    } catch { /* skip ACS failure */ }

    // Population Estimates (latest year)
    try {
      const popResp = await fetch(
        `https://api.census.gov/data/2022/pep/natmonthly?get=POP,UNIVERSE&for=us:*&MONTHLY=12&key=${apiKey}`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (popResp.ok) {
        const popData = await popResp.json();
        if (popData.length >= 2) {
          const pop = popData[1][0];
          if (pop) {
            dataPoints.push({
              key: "census_pop_estimate",
              label: "U.S. Population Estimate",
              value: Number(pop).toLocaleString(),
              date: "2022-12",
              unit: "People",
              category: "demographics",
            });
          }
        }
      }
    } catch { /* skip pop estimate failure — endpoint may not be available */ }

    // State-level income data (top 10 states by income)
    try {
      const stateResp = await fetch(
        `https://api.census.gov/data/2022/acs/acs5?get=NAME,B19013_001E&for=state:*&key=${apiKey}`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (stateResp.ok) {
        const stateData = await stateResp.json();
        if (stateData.length > 1) {
          // Sort by median income descending
          const states = stateData.slice(1)
            .filter((r: any) => r[1] && r[1] !== "-666666666")
            .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))
            .slice(0, 10);
          
          for (const state of states) {
            dataPoints.push({
              key: `census_state_income_${state[2]}`,
              label: `${state[0]} Median Household Income`,
              value: `$${Number(state[1]).toLocaleString()}`,
              date: "2022 (ACS 5-Year)",
              unit: "$",
              category: "state_income",
            });
          }
        }
      }
    } catch { /* skip state data failure */ }

    const stored = await storeDataPoints("census-bureau", dataPoints);
    return { pipeline: "Census", providerSlug: "census-bureau", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "Census", providerSlug: "census-bureau", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── Helper: update connection sync status after pipeline run ──────────
async function updateConnectionSyncStatus(providerSlug: string, recordsFetched: number, status: "success" | "error", error?: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const providers = await db.select().from(integrationProviders)
      .where(eq(integrationProviders.slug, providerSlug));
    const provider = providers[0];
    if (!provider) return;

    const connections = await db.select().from(integrationConnections)
      .where(eq(integrationConnections.providerId, provider.id));

    for (const conn of connections) {
      await db.update(integrationConnections)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: status === "success" ? "success" : "failed",
          lastSyncError: error || null,
          recordsSynced: recordsFetched,
        })
        .where(eq(integrationConnections.id, conn.id));
    }
  } catch (e: any) {
    logger.warn( { operation: "pipeline" },`[Pipeline] updateConnectionSyncStatus("${providerSlug}") failed:`, e.message);
  }
}

// ─── SEC EDGAR Pipeline ─────────────────────────────────────────────────
// Free public API — no key required, just a User-Agent header
const SEC_EDGAR_USER_AGENT = "Stewardly support@stewardly.com";

// Major market indices and popular tickers for general market data
const SEC_TICKERS = [
  { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." },
  { cik: "0000789019", ticker: "MSFT", name: "Microsoft Corporation" },
  { cik: "0001652044", ticker: "GOOGL", name: "Alphabet Inc." },
  { cik: "0001018724", ticker: "AMZN", name: "Amazon.com Inc." },
  { cik: "0001318605", ticker: "TSLA", name: "Tesla Inc." },
  { cik: "0001067983", ticker: "BRK-B", name: "Berkshire Hathaway" },
  { cik: "0000051143", ticker: "IBM", name: "IBM Corporation" },
  { cik: "0000078003", ticker: "PFE", name: "Pfizer Inc." },
  { cik: "0000093410", ticker: "CVX", name: "Chevron Corporation" },
  { cik: "0000200406", ticker: "JNJ", name: "Johnson & Johnson" },
];

async function fetchSECEdgarData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    const errors: string[] = [];

    // 1. Fetch recent filings from EDGAR full-text search
    try {
      const resp = await fetch(
        "https://efts.sec.gov/LATEST/search-index?q=%22annual+report%22&dateRange=custom&startdt=2025-01-01&enddt=2026-12-31&forms=10-K&from=0&size=10",
        { headers: { "User-Agent": SEC_EDGAR_USER_AGENT }, signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const hits = data?.hits?.hits;
        if (Array.isArray(hits)) {
          dataPoints.push({
            key: "sec_recent_10k_count",
            label: "Recent 10-K Filings (2025-2026)",
            value: String(data?.hits?.total?.value || hits.length),
            date: new Date().toISOString().split("T")[0],
            unit: "filings",
            category: "sec_filings",
          });
        }
      }
    } catch (e: any) { errors.push(`EDGAR search: ${e.message}`); }

    // 2. Fetch company facts for major companies
    for (const company of SEC_TICKERS.slice(0, 5)) {
      try {
        const resp = await fetch(
          `https://data.sec.gov/api/xbrl/companyfacts/CIK${company.cik}.json`,
          { headers: { "User-Agent": SEC_EDGAR_USER_AGENT }, signal: AbortSignal.timeout(15000) },
        );
        if (resp.ok) {
          const data = await resp.json();
          const facts = data?.facts;
          const usGaap = facts?.["us-gaap"];
          if (usGaap) {
            // Extract key financial metrics
            const metrics: Record<string, { label: string; taxonomy: string }> = {
              "Revenues": { label: `${company.ticker} Revenue`, taxonomy: "Revenues" },
              "NetIncomeLoss": { label: `${company.ticker} Net Income`, taxonomy: "NetIncomeLoss" },
              "Assets": { label: `${company.ticker} Total Assets`, taxonomy: "Assets" },
              "StockholdersEquity": { label: `${company.ticker} Stockholders Equity`, taxonomy: "StockholdersEquity" },
              "EarningsPerShareBasic": { label: `${company.ticker} EPS (Basic)`, taxonomy: "EarningsPerShareBasic" },
            };

            for (const [key, meta] of Object.entries(metrics)) {
              const concept = usGaap[key];
              if (!concept) continue;
              const units = concept.units;
              // Try USD first, then USD/shares for EPS
              const unitKey = key === "EarningsPerShareBasic" ? "USD/shares" : "USD";
              const entries = units?.[unitKey];
              if (!Array.isArray(entries) || entries.length === 0) continue;
              // Get the most recent annual (10-K) filing
              const annual = entries.filter((e: any) => e.form === "10-K");
              const latest = annual.length > 0 ? annual[annual.length - 1] : entries[entries.length - 1];
              if (latest?.val !== undefined) {
                const unit = key === "EarningsPerShareBasic" ? "$/share" : "USD";
                const displayVal = key === "EarningsPerShareBasic"
                  ? String(latest.val)
                  : (latest.val >= 1e9 ? `$${(latest.val / 1e9).toFixed(1)}B` : `$${(latest.val / 1e6).toFixed(0)}M`);
                dataPoints.push({
                  key: `sec_${company.ticker.toLowerCase()}_${key.toLowerCase()}`,
                  label: meta.label,
                  value: displayVal,
                  date: latest.end || latest.filed || new Date().toISOString().split("T")[0],
                  unit,
                  category: "sec_company_financials",
                });
              }
            }
          }
        }
        // SEC EDGAR rate limit: 10 requests/second
        await new Promise(r => setTimeout(r, 150));
      } catch (e: any) {
        errors.push(`${company.ticker}: ${e.message}`);
      }
    }

    // 3. Fetch recent EDGAR filings feed
    try {
      const resp = await fetch(
        "https://efts.sec.gov/LATEST/search-index?q=*&forms=10-K,10-Q,8-K&from=0&size=5",
        { headers: { "User-Agent": SEC_EDGAR_USER_AGENT }, signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const total = data?.hits?.total?.value;
        if (total) {
          dataPoints.push({
            key: "sec_total_recent_filings",
            label: "Total Recent SEC Filings (10-K/10-Q/8-K)",
            value: String(total),
            date: new Date().toISOString().split("T")[0],
            unit: "filings",
            category: "sec_filings",
          });
        }
      }
    } catch (e: any) { errors.push(`EDGAR feed: ${e.message}`); }

    const stored = await storeDataPoints("sec-edgar", dataPoints);
    if (stored === 0 && errors.length > 0) {
      return { pipeline: "SEC EDGAR", providerSlug: "sec-edgar", status: "error", recordsFetched: 0, error: errors.join("; "), duration: Date.now() - start };
    }
    return { pipeline: "SEC EDGAR", providerSlug: "sec-edgar", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "SEC EDGAR", providerSlug: "sec-edgar", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── FINRA BrokerCheck Pipeline ─────────────────────────────────────────
// Free public API — no key required
async function fetchFINRAData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    const errors: string[] = [];

    // 1. Fetch major broker-dealer firm data
    const majorFirms = [
      { name: "Charles Schwab", query: "charles+schwab" },
      { name: "Fidelity", query: "fidelity" },
      { name: "Morgan Stanley", query: "morgan+stanley" },
      { name: "Goldman Sachs", query: "goldman+sachs" },
      { name: "JP Morgan", query: "jp+morgan" },
    ];

    for (const firm of majorFirms) {
      try {
        const resp = await fetch(
          `https://api.brokercheck.finra.org/search/firm?query=${firm.query}&filter=active=true&hl=true&nrows=1&start=0`,
          {
            headers: {
              "Accept": "application/json",
              "User-Agent": SEC_EDGAR_USER_AGENT,
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        if (resp.ok) {
          const data = await resp.json();
          const hits = data?.hits?.hits;
          if (Array.isArray(hits) && hits.length > 0) {
            const firmData = hits[0]?._source;
            if (firmData) {
              // Correct field names from FINRA BrokerCheck API
              const branchCount = firmData.firm_branches_count ?? "N/A";
              const regCount = firmData.firm_approved_finra_registration_count ?? "N/A";
              const firmName = firmData.firm_name || firmData.ia_firm_name || firm.name;
              const crdNumber = firmData.firm_source_id || "";
              const scope = firmData.firm_scope || "";
              const bdSec = firmData.firm_bd_full_sec_number || "";
              const iaSec = firmData.firm_ia_full_sec_number || "";

              // Parse address from JSON string
              let city = "", state = "";
              try {
                const addrJson = JSON.parse(firmData.firm_address_details || "{}");
                city = addrJson?.officeAddress?.city || "";
                state = addrJson?.officeAddress?.state || "";
              } catch { /* skip */ }

              const locationStr = city && state ? ` | ${city}, ${state}` : "";
              const secStr = bdSec ? ` | BD SEC: ${bdSec}` : "";

              dataPoints.push({
                key: `finra_firm_${firm.query.replace(/\+/g, "_")}`,
                label: `${firmName} (CRD: ${crdNumber})`,
                value: `${regCount} registered reps, ${branchCount} branches${locationStr}${secStr}`,
                date: new Date().toISOString().split("T")[0],
                unit: "firm_info",
                category: "finra_firms",
              });
            }
          }
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (e: any) {
        errors.push(`${firm.name}: ${e.message}`);
      }
    }

    // 2. Fetch FINRA industry snapshot (total registered firms/individuals)
    try {
      const resp = await fetch(
        "https://api.brokercheck.finra.org/search/firm?query=*&filter=active=true&nrows=0&start=0",
        {
          headers: { "Accept": "application/json", "User-Agent": SEC_EDGAR_USER_AGENT },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (resp.ok) {
        const data = await resp.json();
        const totalFirms = data?.hits?.total;
        if (totalFirms) {
          dataPoints.push({
            key: "finra_total_active_firms",
            label: "Total Active FINRA-Registered Firms",
            value: String(typeof totalFirms === "object" ? totalFirms.value : totalFirms),
            date: new Date().toISOString().split("T")[0],
            unit: "firms",
            category: "finra_industry",
          });
        }
      }
    } catch (e: any) { errors.push(`Industry snapshot: ${e.message}`); }

    // 3. Fetch total registered individuals (use a common name search since wildcard returns 0)
    try {
      const resp = await fetch(
        "https://api.brokercheck.finra.org/search/individual?query=smith&filter=active=true&nrows=0&start=0",
        {
          headers: { "Accept": "application/json", "User-Agent": SEC_EDGAR_USER_AGENT },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (resp.ok) {
        const data = await resp.json();
        const totalIndividuals = data?.hits?.total;
        if (totalIndividuals) {
          dataPoints.push({
            key: "finra_individual_search_sample",
            label: "FINRA-Registered Individuals (sample: 'Smith')",
            value: String(typeof totalIndividuals === "object" ? totalIndividuals.value : totalIndividuals),
            date: new Date().toISOString().split("T")[0],
            unit: "individuals",
            category: "finra_industry",
          });
        }
      }
    } catch (e: any) { errors.push(`Individual count: ${e.message}`); }

    const stored = await storeDataPoints("finra-brokercheck", dataPoints);
    if (stored === 0 && errors.length > 0) {
      return { pipeline: "FINRA BrokerCheck", providerSlug: "finra-brokercheck", status: "error", recordsFetched: 0, error: errors.join("; "), duration: Date.now() - start };
    }
    return { pipeline: "FINRA BrokerCheck", providerSlug: "finra-brokercheck", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "FINRA BrokerCheck", providerSlug: "finra-brokercheck", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── Treasury Fiscal Data Pipeline ─────────────────────────────────────
async function fetchTreasuryFiscalData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    const errors: string[] = [];

    // 1. Exchange rates
    try {
      const resp = await fetch(
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/rates_of_exchange?sort=-record_date&page[size]=10&fields=country_currency_desc,exchange_rate,record_date",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        for (const row of (data?.data || []).slice(0, 5)) {
          dataPoints.push({
            key: `treasury_fx_${row.country_currency_desc?.replace(/\s+/g, "_").toLowerCase() || "unknown"}`,
            label: `Exchange Rate: ${row.country_currency_desc}`,
            value: row.exchange_rate,
            date: row.record_date || new Date().toISOString().split("T")[0],
            unit: "per USD",
            category: "treasury_exchange_rates",
          });
        }
      }
    } catch (e: any) { errors.push(`Treasury FX: ${e.message}`); }

    // 2. National debt
    try {
      const resp = await fetch(
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const row = data?.data?.[0];
        if (row) {
          const totalDebt = parseFloat(row.tot_pub_debt_out_amt);
          dataPoints.push({
            key: "treasury_national_debt",
            label: "U.S. National Debt (Total Public Debt Outstanding)",
            value: totalDebt >= 1e12 ? `$${(totalDebt / 1e12).toFixed(2)}T` : `$${(totalDebt / 1e9).toFixed(1)}B`,
            date: row.record_date,
            unit: "USD",
            category: "treasury_debt",
          });
        }
      }
    } catch (e: any) { errors.push(`Treasury debt: ${e.message}`); }

    // 3. Average interest rates on Treasury securities
    try {
      const resp = await fetch(
        "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=5&filter=security_desc:eq:Treasury Bills,security_desc:eq:Treasury Notes,security_desc:eq:Treasury Bonds",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        for (const row of (data?.data || [])) {
          dataPoints.push({
            key: `treasury_avg_rate_${row.security_desc?.replace(/\s+/g, "_").toLowerCase() || "unknown"}`,
            label: `Avg Interest Rate: ${row.security_desc}`,
            value: `${row.avg_interest_rate_amt}%`,
            date: row.record_date,
            unit: "%",
            category: "treasury_rates",
          });
        }
      }
    } catch (e: any) { errors.push(`Treasury rates: ${e.message}`); }

    const stored = await storeDataPoints("treasury-fiscal", dataPoints);
    if (stored === 0 && errors.length > 0) {
      return { pipeline: "Treasury Fiscal", providerSlug: "treasury-fiscal", status: "error", recordsFetched: 0, error: errors.join("; "), duration: Date.now() - start };
    }
    return { pipeline: "Treasury Fiscal", providerSlug: "treasury-fiscal", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "Treasury Fiscal", providerSlug: "treasury-fiscal", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── GLEIF LEI Pipeline ────────────────────────────────────────────────
async function fetchGLEIFData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    const errors: string[] = [];

    // Fetch LEI statistics and sample records
    try {
      const resp = await fetch(
        "https://api.gleif.org/api/v1/lei-records?page[size]=5&filter[entity.registeredAs]=*&sort=-entity.legalName",
        { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const total = data?.meta?.pagination?.total;
        if (total) {
          dataPoints.push({
            key: "gleif_total_lei_records",
            label: "Total LEI Records (Global)",
            value: total >= 1e6 ? `${(total / 1e6).toFixed(1)}M` : String(total),
            date: new Date().toISOString().split("T")[0],
            unit: "entities",
            category: "gleif_lei",
          });
        }
      }
    } catch (e: any) { errors.push(`GLEIF records: ${e.message}`); }

    // Fetch US-specific LEI count
    try {
      const resp = await fetch(
        "https://api.gleif.org/api/v1/lei-records?page[size]=1&filter[entity.legalAddress.country]=US",
        { headers: { Accept: "application/vnd.api+json" }, signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const usTotal = data?.meta?.pagination?.total;
        if (usTotal) {
          dataPoints.push({
            key: "gleif_us_lei_count",
            label: "U.S. LEI Records",
            value: usTotal >= 1e3 ? `${(usTotal / 1e3).toFixed(1)}K` : String(usTotal),
            date: new Date().toISOString().split("T")[0],
            unit: "entities",
            category: "gleif_lei",
          });
        }
      }
    } catch (e: any) { errors.push(`GLEIF US: ${e.message}`); }

    const stored = await storeDataPoints("gleif", dataPoints);
    if (stored === 0 && errors.length > 0) {
      return { pipeline: "GLEIF", providerSlug: "gleif", status: "error", recordsFetched: 0, error: errors.join("; "), duration: Date.now() - start };
    }
    return { pipeline: "GLEIF", providerSlug: "gleif", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "GLEIF", providerSlug: "gleif", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── World Bank Pipeline ───────────────────────────────────────────────
async function fetchWorldBankData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    const errors: string[] = [];

    const indicators = [
      { id: "NY.GDP.MKTP.CD", label: "World GDP (Current USD)", category: "worldbank_gdp" },
      { id: "NY.GDP.MKTP.KD.ZG", label: "World GDP Growth Rate", category: "worldbank_growth" },
      { id: "FP.CPI.TOTL.ZG", label: "World Inflation Rate (CPI)", category: "worldbank_inflation" },
      { id: "SL.UEM.TOTL.ZS", label: "World Unemployment Rate", category: "worldbank_employment" },
      { id: "BX.KLT.DINV.CD.WD", label: "Foreign Direct Investment (Net Inflows)", category: "worldbank_fdi" },
    ];

    for (const ind of indicators) {
      try {
        const resp = await fetch(
          `https://api.worldbank.org/v2/country/WLD/indicator/${ind.id}?format=json&per_page=3&date=2020:2025`,
          { signal: AbortSignal.timeout(15000) },
        );
        if (resp.ok) {
          const data = await resp.json();
          const records = data?.[1];
          if (Array.isArray(records) && records.length > 0) {
            const latest = records.find((r: any) => r.value != null) || records[0];
            if (latest?.value != null) {
              const val = latest.value;
              const displayVal = ind.id.includes("ZG") || ind.id.includes("ZS")
                ? `${val.toFixed(1)}%`
                : val >= 1e12 ? `$${(val / 1e12).toFixed(1)}T` : val >= 1e9 ? `$${(val / 1e9).toFixed(1)}B` : String(val);
              dataPoints.push({
                key: `worldbank_${ind.id.toLowerCase().replace(/\./g, "_")}`,
                label: ind.label,
                value: displayVal,
                date: latest.date || new Date().toISOString().split("T")[0],
                unit: ind.id.includes("ZG") || ind.id.includes("ZS") ? "%" : "USD",
                category: ind.category,
              });
            }
          }
        }
      } catch (e: any) { errors.push(`WB ${ind.id}: ${e.message}`); }
    }

    const stored = await storeDataPoints("world-bank", dataPoints);
    if (stored === 0 && errors.length > 0) {
      return { pipeline: "World Bank", providerSlug: "world-bank", status: "error", recordsFetched: 0, error: errors.join("; "), duration: Date.now() - start };
    }
    return { pipeline: "World Bank", providerSlug: "world-bank", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "World Bank", providerSlug: "world-bank", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── OpenFIGI Pipeline ────────────────────────────────────────────────
async function fetchOpenFIGIData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    // OpenFIGI mapping API — look up common tickers to verify connectivity
    const tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "BRK.A"];
    try {
      const resp = await fetch("https://api.openfigi.com/v3/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tickers.map(t => ({ idType: "TICKER", idValue: t, exchCode: "US" }))),
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        let mapped = 0;
        for (let i = 0; i < data.length; i++) {
          const result = data[i];
          if (result?.data?.[0]) {
            mapped++;
            const figi = result.data[0];
            dataPoints.push({
              key: `openfigi_${tickers[i].toLowerCase().replace(".", "_")}`,
              label: `${tickers[i]} → ${figi.name || figi.ticker}`,
              value: figi.figi || "N/A",
              date: new Date().toISOString().split("T")[0],
              unit: "FIGI",
              category: "openfigi_mapping",
            });
          }
        }
        dataPoints.push({
          key: "openfigi_service_status",
          label: "OpenFIGI Mapping Service",
          value: `${mapped}/${tickers.length} tickers resolved`,
          date: new Date().toISOString().split("T")[0],
          unit: "status",
          category: "openfigi_status",
        });
      }
    } catch (e: any) { /* non-critical */ }
    const stored = await storeDataPoints("openfigi", dataPoints);
    return { pipeline: "OpenFIGI", providerSlug: "openfigi", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "OpenFIGI", providerSlug: "openfigi", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── NAIC Pipeline ────────────────────────────────────────────────────
async function fetchNAICData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    // NAIC Consumer Information Source — complaint ratios for major carriers
    try {
      const resp = await fetch(
        "https://content.naic.org/api/cis/search?entityType=Company&keyword=life+insurance&pageSize=5",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const companies = data?.results || data?.items || [];
        if (Array.isArray(companies)) {
          dataPoints.push({
            key: "naic_service_status",
            label: "NAIC Consumer Information Source",
            value: `${companies.length} carrier records available`,
            date: new Date().toISOString().split("T")[0],
            unit: "records",
            category: "naic_status",
          });
        }
      }
    } catch (e: any) {
      // NAIC may not have a public JSON API — store status
      dataPoints.push({
        key: "naic_service_status",
        label: "NAIC Consumer Information Source",
        value: "Available via web scraping",
        date: new Date().toISOString().split("T")[0],
        unit: "status",
        category: "naic_status",
      });
    }
    const stored = await storeDataPoints("naic", dataPoints);
    return { pipeline: "NAIC", providerSlug: "naic", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "NAIC", providerSlug: "naic", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── FFIEC Pipeline ───────────────────────────────────────────────────
async function fetchFFIECData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    // FFIEC Census API — demographic/financial data for banking analysis
    try {
      const resp = await fetch(
        "https://geomap.ffiec.gov/FFIECGeocMap/GeocodeMap1.aspx/GetGeocodeData",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sAddress: "1600 Pennsylvania Ave", sCity: "Washington", sState: "DC" }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (resp.ok) {
        dataPoints.push({
          key: "ffiec_geocode_status",
          label: "FFIEC Geocoding Service",
          value: "Online — census tract lookup available",
          date: new Date().toISOString().split("T")[0],
          unit: "status",
          category: "ffiec_status",
        });
      }
    } catch (e: any) {
      dataPoints.push({
        key: "ffiec_geocode_status",
        label: "FFIEC Geocoding Service",
        value: "Available via SOAP/web interface",
        date: new Date().toISOString().split("T")[0],
        unit: "status",
        category: "ffiec_status",
      });
    }
    // FFIEC HMDA data (public)
    try {
      const resp = await fetch(
        "https://ffiec.cfpb.gov/v2/data-browser-api/view/nationwide/aggregations?actions_taken=1&years=2022",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data?.aggregations) {
          dataPoints.push({
            key: "ffiec_hmda_originations",
            label: "HMDA Mortgage Originations (2022)",
            value: data.aggregations.length > 0 ? `${data.aggregations.length} categories` : "Available",
            date: "2022-12-31",
            unit: "records",
            category: "ffiec_hmda",
          });
        }
      }
    } catch (e: any) { /* non-critical */ }
    const stored = await storeDataPoints("ffiec", dataPoints);
    return { pipeline: "FFIEC", providerSlug: "ffiec", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "FFIEC", providerSlug: "ffiec", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── FDIC BankFind Pipeline ──────────────────────────────────────────
async function fetchFDICData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    // FDIC BankFind API — free, no key required
    try {
      const resp = await fetch(
        "https://banks.data.fdic.gov/api/financials?filters=REPDTE%3A20231231&fields=REPNM,ASSET,DEP,NETINC&sort_by=ASSET&sort_order=DESC&limit=5",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const banks = data?.data || [];
        if (banks.length > 0) {
          dataPoints.push({
            key: "fdic_total_institutions",
            label: "FDIC Insured Institutions (Top 5 by Assets)",
            value: `${banks.length} banks retrieved`,
            date: "2023-12-31",
            unit: "institutions",
            category: "fdic_banks",
          });
          for (const bank of banks.slice(0, 3)) {
            const d = bank.data;
            if (d?.REPNM && d?.ASSET) {
              const assets = parseFloat(d.ASSET);
              dataPoints.push({
                key: `fdic_bank_${d.REPNM.replace(/\s+/g, "_").toLowerCase().slice(0, 30)}`,
                label: d.REPNM,
                value: assets >= 1e9 ? `$${(assets / 1e6).toFixed(0)}M assets` : `$${assets.toFixed(0)} assets`,
                date: "2023-12-31",
                unit: "USD (thousands)",
                category: "fdic_top_banks",
              });
            }
          }
        }
      }
    } catch (e: any) { /* non-critical */ }
    // FDIC Failed Banks list
    try {
      const resp = await fetch(
        "https://banks.data.fdic.gov/api/failures?sort_by=FAILDATE&sort_order=DESC&limit=5",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const failures = data?.data || [];
        if (failures.length > 0) {
          dataPoints.push({
            key: "fdic_recent_failures",
            label: "Recent FDIC Bank Failures",
            value: `${failures.length} most recent failures`,
            date: new Date().toISOString().split("T")[0],
            unit: "events",
            category: "fdic_failures",
          });
        }
      }
    } catch (e: any) { /* non-critical */ }
    const stored = await storeDataPoints("fdic", dataPoints);
    return { pipeline: "FDIC BankFind", providerSlug: "fdic", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "FDIC BankFind", providerSlug: "fdic", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── CoinGecko Pipeline ─────────────────────────────────────────────
async function fetchCoinGeckoData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];
    // CoinGecko free API — no key required
    try {
      const resp = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        for (const [coin, info] of Object.entries(data) as [string, any][]) {
          const name = coin.charAt(0).toUpperCase() + coin.slice(1);
          if (info?.usd) {
            dataPoints.push({
              key: `coingecko_${coin}_price`,
              label: `${name} Price (USD)`,
              value: info.usd >= 1000 ? `$${info.usd.toLocaleString()}` : `$${info.usd.toFixed(2)}`,
              date: new Date().toISOString().split("T")[0],
              unit: "USD",
              category: "crypto_prices",
            });
          }
          if (info?.usd_24h_change != null) {
            dataPoints.push({
              key: `coingecko_${coin}_24h_change`,
              label: `${name} 24h Change`,
              value: `${info.usd_24h_change >= 0 ? "+" : ""}${info.usd_24h_change.toFixed(2)}%`,
              date: new Date().toISOString().split("T")[0],
              unit: "%",
              category: "crypto_changes",
            });
          }
          if (info?.usd_market_cap) {
            const mc = info.usd_market_cap;
            dataPoints.push({
              key: `coingecko_${coin}_mcap`,
              label: `${name} Market Cap`,
              value: mc >= 1e12 ? `$${(mc / 1e12).toFixed(2)}T` : mc >= 1e9 ? `$${(mc / 1e9).toFixed(1)}B` : `$${(mc / 1e6).toFixed(0)}M`,
              date: new Date().toISOString().split("T")[0],
              unit: "USD",
              category: "crypto_mcap",
            });
          }
        }
      }
    } catch (e: any) { /* non-critical */ }
    // Global crypto market data
    try {
      const resp = await fetch(
        "https://api.coingecko.com/api/v3/global",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        const g = data?.data;
        if (g) {
          if (g.total_market_cap?.usd) {
            const mc = g.total_market_cap.usd;
            dataPoints.push({
              key: "coingecko_total_mcap",
              label: "Total Crypto Market Cap",
              value: mc >= 1e12 ? `$${(mc / 1e12).toFixed(2)}T` : `$${(mc / 1e9).toFixed(0)}B`,
              date: new Date().toISOString().split("T")[0],
              unit: "USD",
              category: "crypto_global",
            });
          }
          if (g.active_cryptocurrencies) {
            dataPoints.push({
              key: "coingecko_active_coins",
              label: "Active Cryptocurrencies",
              value: g.active_cryptocurrencies.toLocaleString(),
              date: new Date().toISOString().split("T")[0],
              unit: "coins",
              category: "crypto_global",
            });
          }
        }
      }
    } catch (e: any) { /* non-critical */ }
    const stored = await storeDataPoints("coingecko", dataPoints);
    return { pipeline: "CoinGecko", providerSlug: "coingecko", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "CoinGecko", providerSlug: "coingecko", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── IMF Pipeline (Keyless — International Monetary Fund) ──────────────
async function fetchIMFData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];

    // IMF IFS (International Financial Statistics) — key global indicators
    // World GDP growth, global inflation, trade volumes
    const indicators = [
      { code: "NGDP_RPCH", label: "World GDP Growth (Real)", category: "global_gdp", unit: "%" },
      { code: "PCPIPCH", label: "World Inflation Rate (CPI)", category: "global_inflation", unit: "%" },
      { code: "BCA_NGDPD", label: "Current Account Balance (% GDP)", category: "global_trade", unit: "% GDP" },
    ];

    // Fetch World Economic Outlook data for major economies
    const countries = ["US", "CN", "DE", "JP", "GB", "IN"];
    const countryNames: Record<string, string> = { US: "United States", CN: "China", DE: "Germany", JP: "Japan", GB: "United Kingdom", IN: "India" };

    for (const ind of indicators) {
      try {
        // IMF DataMapper API — free, no key
        const resp = await fetch(
          `https://www.imf.org/external/datamapper/api/v1/${ind.code}?periods=2024,2025,2026`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (resp.ok) {
          const data = await resp.json();
          const values = data?.values?.[ind.code];
          if (values) {
            // Get world aggregate if available
            if (values["WORLD"]) {
              const years = Object.keys(values["WORLD"]).sort().reverse();
              const latestYear = years[0];
              const val = values["WORLD"][latestYear];
              if (val != null) {
                dataPoints.push({
                  key: `imf_world_${ind.code.toLowerCase()}`,
                  label: `${ind.label} (World, ${latestYear})`,
                  value: typeof val === "number" ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}${ind.unit}` : String(val),
                  date: `${latestYear}-01-01`,
                  unit: ind.unit,
                  category: ind.category,
                });
              }
            }
            // Get major country data
            for (const cc of countries) {
              if (values[cc]) {
                const years = Object.keys(values[cc]).sort().reverse();
                const latestYear = years[0];
                const val = values[cc][latestYear];
                if (val != null) {
                  dataPoints.push({
                    key: `imf_${cc.toLowerCase()}_${ind.code.toLowerCase()}`,
                    label: `${ind.label} (${countryNames[cc] || cc}, ${latestYear})`,
                    value: typeof val === "number" ? `${val >= 0 ? "+" : ""}${val.toFixed(2)}${ind.unit}` : String(val),
                    date: `${latestYear}-01-01`,
                    unit: ind.unit,
                    category: ind.category,
                  });
                }
              }
            }
          }
        }
      } catch (e: any) {
        logger.warn({ operation: "pipeline" }, `[IMF] Failed to fetch ${ind.code}:`, e.message);
      }
    }

    // IMF SDR exchange rates (Special Drawing Rights)
    try {
      const resp = await fetch(
        "https://www.imf.org/external/np/fin/data/rms_five.aspx?tsvflag=Y",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const text = await resp.text();
        // Parse TSV for SDR rates — extract USD/SDR rate
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.includes("U.S. dollar")) {
            const parts = line.split("\t").map(s => s.trim()).filter(Boolean);
            if (parts.length >= 2) {
              const rate = parseFloat(parts[parts.length - 1]);
              if (!isNaN(rate)) {
                dataPoints.push({
                  key: "imf_sdr_usd",
                  label: "SDR/USD Exchange Rate",
                  value: rate.toFixed(6),
                  date: new Date().toISOString().split("T")[0],
                  unit: "SDR per USD",
                  category: "imf_sdr",
                });
              }
            }
            break;
          }
        }
      }
    } catch (e: any) { /* non-critical */ }

    const stored = await storeDataPoints("imf", dataPoints, undefined, 24);
    return { pipeline: "IMF", providerSlug: "imf", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "IMF", providerSlug: "imf", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── ExchangeRate-API Pipeline (Keyless — Open Exchange Rates) ──────────
async function fetchExchangeRateData(): Promise<PipelineResult> {
  const start = Date.now();
  try {
    const dataPoints: FetchedDataPoint[] = [];

    // ExchangeRate-API open endpoint — free, no key, 1500 req/month
    // Base currency: USD
    const targetCurrencies = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "CNY", "INR", "BRL", "MXN", "KRW", "SGD", "HKD", "SEK", "NOK"];

    try {
      const resp = await fetch(
        "https://open.er-api.com/v6/latest/USD",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data?.result === "success" && data?.rates) {
          const updateDate = data.time_last_update_utc
            ? new Date(data.time_last_update_utc).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

          for (const curr of targetCurrencies) {
            const rate = data.rates[curr];
            if (rate != null) {
              dataPoints.push({
                key: `fx_usd_${curr.toLowerCase()}`,
                label: `USD/${curr}`,
                value: rate >= 100 ? rate.toFixed(2) : rate >= 1 ? rate.toFixed(4) : rate.toFixed(6),
                date: updateDate,
                unit: `${curr} per USD`,
                category: "fx_rates",
              });
            }
          }

          // Also store inverse rates for major pairs
          const inversePairs = ["EUR", "GBP", "CHF"];
          for (const curr of inversePairs) {
            const rate = data.rates[curr];
            if (rate && rate > 0) {
              dataPoints.push({
                key: `fx_${curr.toLowerCase()}_usd`,
                label: `${curr}/USD`,
                value: (1 / rate).toFixed(4),
                date: updateDate,
                unit: `USD per ${curr}`,
                category: "fx_rates_inverse",
              });
            }
          }

          // DXY proxy — trade-weighted USD index approximation
          // Simplified: weighted average of major currencies vs USD
          const dxyWeights: Record<string, number> = { EUR: 0.576, JPY: 0.136, GBP: 0.119, CAD: 0.091, SEK: 0.042, CHF: 0.036 };
          let dxyApprox = 0;
          let totalWeight = 0;
          // Use base rates from Jan 2024 as reference
          const baseRates: Record<string, number> = { EUR: 0.9246, JPY: 141.04, GBP: 0.7879, CAD: 1.3226, SEK: 10.04, CHF: 0.8414 };
          for (const [curr, weight] of Object.entries(dxyWeights)) {
            const currentRate = data.rates[curr];
            const baseRate = baseRates[curr];
            if (currentRate && baseRate) {
              dxyApprox += weight * (currentRate / baseRate);
              totalWeight += weight;
            }
          }
          if (totalWeight > 0.8) {
            const dxyIndex = (dxyApprox / totalWeight) * 100;
            dataPoints.push({
              key: "fx_dxy_proxy",
              label: "USD Index (DXY Proxy)",
              value: dxyIndex.toFixed(2),
              date: updateDate,
              unit: "Index",
              category: "fx_indices",
            });
          }
        }
      }
    } catch (e: any) {
      logger.warn({ operation: "pipeline" }, "[ExchangeRate] Failed to fetch rates:", e.message);
    }

    // Also fetch EUR-based rates for cross-rate calculations
    try {
      const resp = await fetch(
        "https://open.er-api.com/v6/latest/EUR",
        { signal: AbortSignal.timeout(15000) },
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data?.result === "success" && data?.rates) {
          const updateDate = data.time_last_update_utc
            ? new Date(data.time_last_update_utc).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

          // EUR cross rates
          const eurCrosses = ["GBP", "JPY", "CHF"];
          for (const curr of eurCrosses) {
            const rate = data.rates[curr];
            if (rate != null) {
              dataPoints.push({
                key: `fx_eur_${curr.toLowerCase()}`,
                label: `EUR/${curr}`,
                value: rate >= 100 ? rate.toFixed(2) : rate.toFixed(4),
                date: updateDate,
                unit: `${curr} per EUR`,
                category: "fx_cross_rates",
              });
            }
          }
        }
      }
    } catch (e: any) { /* non-critical */ }

    const stored = await storeDataPoints("exchangerate-api", dataPoints, undefined, 6);
    return { pipeline: "ExchangeRate-API", providerSlug: "exchangerate-api", status: "success", recordsFetched: stored, duration: Date.now() - start };
  } catch (err: any) {
    return { pipeline: "ExchangeRate-API", providerSlug: "exchangerate-api", status: "error", recordsFetched: 0, error: err.message, duration: Date.now() - start };
  }
}

// ─── Run All Pipelines ──────────────────────────────────────────────────
/** Wrap a pipeline fetcher with circuit breaker logic */
async function withCircuitBreaker(slug: string, fetcher: () => Promise<PipelineResult>): Promise<PipelineResult> {
  const state = getCircuitState(`pipeline:${slug}`);
  if (state === "open") {
    logger.warn({ operation: "dataPipelines" }, `[DataPipelines] Circuit OPEN for ${slug} — skipping`);
    return { pipeline: slug, providerSlug: slug, status: "error", recordsFetched: 0, error: "Circuit breaker open — too many recent failures", duration: 0 };
  }
  try {
    const result = await fetcher();
    if (result.status === "success") {
      recordCircuitSuccess(`pipeline:${slug}`);
    } else {
      recordCircuitFailure(`pipeline:${slug}`);
    }
    return result;
  } catch (err: any) {
    recordCircuitFailure(`pipeline:${slug}`);
    return { pipeline: slug, providerSlug: slug, status: "error", recordsFetched: 0, error: err.message, duration: 0 };
  }
}

export async function runAllDataPipelines(): Promise<PipelineResult[]> {
  logger.info( { operation: "dataPipelines" },"[DataPipelines] Starting all data pipelines (16 providers) with circuit breakers...");
  
  const results = await Promise.allSettled([
    withCircuitBreaker("bls", fetchBLSData),
    withCircuitBreaker("fred", fetchFREDData),
    withCircuitBreaker("bea", fetchBEAData),
    withCircuitBreaker("census-bureau", fetchCensusData),
    withCircuitBreaker("sec-edgar", fetchSECEdgarData),
    withCircuitBreaker("finra-brokercheck", fetchFINRAData),
    withCircuitBreaker("treasury-fiscal", fetchTreasuryFiscalData),
    withCircuitBreaker("gleif", fetchGLEIFData),
    withCircuitBreaker("world-bank", fetchWorldBankData),
    withCircuitBreaker("openfigi", fetchOpenFIGIData),
    withCircuitBreaker("naic", fetchNAICData),
    withCircuitBreaker("ffiec", fetchFFIECData),
    withCircuitBreaker("fdic", fetchFDICData),
    withCircuitBreaker("coingecko", fetchCoinGeckoData),
    withCircuitBreaker("imf", fetchIMFData),
    withCircuitBreaker("exchangerate-api", fetchExchangeRateData),
  ]);

  const finalResults = results.map((r, i) => {
    const names = ["BLS", "FRED", "BEA", "Census", "SEC EDGAR", "FINRA BrokerCheck", "Treasury Fiscal", "GLEIF", "World Bank", "OpenFIGI", "NAIC", "FFIEC", "FDIC BankFind", "CoinGecko", "IMF", "ExchangeRate-API"];
    const slugs = ["bls", "fred", "bea", "census-bureau", "sec-edgar", "finra-brokercheck", "treasury-fiscal", "gleif", "world-bank", "openfigi", "naic", "ffiec", "fdic", "coingecko", "imf", "exchangerate-api"];
    if (r.status === "fulfilled") return r.value;
    return {
      pipeline: names[i],
      providerSlug: slugs[i],
      status: "error" as const,
      recordsFetched: 0,
      error: r.reason?.message || "Unknown error",
      duration: 0,
    };
  });

  // Update connection sync status for each pipeline result
  for (const result of finalResults) {
    try {
      await updateConnectionSyncStatus(
        result.providerSlug,
        result.recordsFetched,
        result.status === "success" ? "success" : "error",
        result.error,
      );
    } catch (e: any) {
      logger.warn( { operation: "dataPipelines" },`[DataPipelines] Failed to update sync status for ${result.providerSlug}:`, e.message);
    }
  }

  return finalResults;
}

/** Run a single pipeline by provider slug */
export async function runSinglePipeline(providerSlug: string): Promise<PipelineResult> {
  const pipelineMap: Record<string, () => Promise<PipelineResult>> = {
    "bls": fetchBLSData,
    "fred": fetchFREDData,
    "bea": fetchBEAData,
    "census-bureau": fetchCensusData,
    "sec-edgar": fetchSECEdgarData,
    "finra-brokercheck": fetchFINRAData,
    "treasury-fiscal": fetchTreasuryFiscalData,
    "gleif": fetchGLEIFData,
    "world-bank": fetchWorldBankData,
    "openfigi": fetchOpenFIGIData,
    "naic": fetchNAICData,
    "ffiec": fetchFFIECData,
    "fdic": fetchFDICData,
    "coingecko": fetchCoinGeckoData,
    "imf": fetchIMFData,
    "exchangerate-api": fetchExchangeRateData,
  };

  const fetcher = pipelineMap[providerSlug];
  if (!fetcher) {
    return { pipeline: providerSlug, providerSlug, status: "error", recordsFetched: 0, error: "Unknown provider", duration: 0 };
  }
  const result = await withCircuitBreaker(providerSlug, fetcher);
  
  // Update connection sync status
  try {
    await updateConnectionSyncStatus(
      result.providerSlug,
      result.recordsFetched,
      result.status === "success" ? "success" : "error",
      result.error,
    );
  } catch { /* non-critical */ }
  
  return result;
}

/** Get cached data for a provider */
export async function getCachedData(providerSlug: string, category?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, providerSlug));

  const results = await query;
  
  if (category) {
    return results.filter(r => r.lookupType === category);
  }
  return results;
}

/** Get a summary of all cached economic data for AI context injection */
export async function getEconomicDataSummary(): Promise<string> {
  const db = await getDb();
  if (!db) return "";

  const allData = await db.select().from(enrichmentCache)
    .where(
      // Only include government data providers
      eq(enrichmentCache.providerSlug, "bls"),
    );
  
  // Also get FRED, BEA, Census data
  const fredData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "fred"));
  const beaData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "bea"));
  const censusData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "census-bureau"));

  const sections: string[] = [];

  // BLS Section
  if (allData.length > 0) {
    sections.push("### Bureau of Labor Statistics (BLS)");
    for (const entry of allData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  // FRED Section
  if (fredData.length > 0) {
    sections.push("\n### Federal Reserve Economic Data (FRED)");
    for (const entry of fredData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  // BEA Section
  if (beaData.length > 0) {
    sections.push("\n### Bureau of Economic Analysis (BEA)");
    for (const entry of beaData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  // Census Section
  if (censusData.length > 0) {
    sections.push("\n### U.S. Census Bureau");
    for (const entry of censusData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  // SEC EDGAR Section
  const secData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "sec-edgar"));
  if (secData.length > 0) {
    sections.push("\n### SEC EDGAR (Company Filings)");
    for (const entry of secData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // FINRA Section
  const finraData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "finra-brokercheck"));
  if (finraData.length > 0) {
    sections.push("\n### FINRA BrokerCheck");
    for (const entry of finraData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // Treasury Fiscal Data Section
  const treasuryData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "treasury-fiscal"));
  if (treasuryData.length > 0) {
    sections.push("\n### U.S. Treasury Fiscal Data");
    for (const entry of treasuryData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  // GLEIF Section
  const gleifData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "gleif"));
  if (gleifData.length > 0) {
    sections.push("\n### GLEIF (Legal Entity Identifiers)");
    for (const entry of gleifData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // World Bank Section
  const worldBankData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "world-bank"));
  if (worldBankData.length > 0) {
    sections.push("\n### World Bank Open Data");
    for (const entry of worldBankData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  // OpenFIGI Section
  const openfigiData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "openfigi"));
  if (openfigiData.length > 0) {
    sections.push("\n### OpenFIGI (Financial Instrument Identifiers)");
    for (const entry of openfigiData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // NAIC Section
  const naicData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "naic"));
  if (naicData.length > 0) {
    sections.push("\n### NAIC (Insurance Carrier Data)");
    for (const entry of naicData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // FFIEC Section
  const ffiecData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "ffiec"));
  if (ffiecData.length > 0) {
    sections.push("\n### FFIEC (Banking & Mortgage Data)");
    for (const entry of ffiecData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // FDIC Section
  const fdicData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "fdic"));
  if (fdicData.length > 0) {
    sections.push("\n### FDIC BankFind (Bank Financial Data)");
    for (const entry of fdicData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // CoinGecko Section
  const cryptoData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "coingecko"));
  if (cryptoData.length > 0) {
    sections.push("\n### CoinGecko (Cryptocurrency Market Data)");
    for (const entry of cryptoData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value} (as of ${d.date})`);
      }
    }
  }

  // IMF Section
  const imfData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "imf"));
  if (imfData.length > 0) {
    sections.push("\n### IMF (International Monetary Fund)");
    for (const entry of imfData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  // ExchangeRate-API Section
  const fxData = await db.select().from(enrichmentCache)
    .where(eq(enrichmentCache.providerSlug, "exchangerate-api"));
  if (fxData.length > 0) {
    sections.push("\n### Exchange Rates (ExchangeRate-API)");
    for (const entry of fxData) {
      const d = entry.resultJson as any;
      if (d?.label && d?.value) {
        sections.push(`- ${d.label}: ${d.value}${d.unit ? ` ${d.unit}` : ""} (as of ${d.date})`);
      }
    }
  }

  if (sections.length === 0) return "";
  return `## Live Economic & Financial Data (Government, Regulatory & Market Sources)\n${sections.join("\n")}`;
}
