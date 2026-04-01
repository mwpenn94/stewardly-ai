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

// ─── Run All Pipelines ──────────────────────────────────────────────────
export async function runAllDataPipelines(): Promise<PipelineResult[]> {
  logger.info( { operation: "dataPipelines" },"[DataPipelines] Starting all data pipelines (6 providers)...");
  
  const results = await Promise.allSettled([
    fetchBLSData(),
    fetchFREDData(),
    fetchBEAData(),
    fetchCensusData(),
    fetchSECEdgarData(),
    fetchFINRAData(),
  ]);

  const finalResults = results.map((r, i) => {
    const names = ["BLS", "FRED", "BEA", "Census", "SEC EDGAR", "FINRA BrokerCheck"];
    const slugs = ["bls", "fred", "bea", "census-bureau", "sec-edgar", "finra-brokercheck"];
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
  };

  const fetcher = pipelineMap[providerSlug];
  if (!fetcher) {
    return { pipeline: providerSlug, providerSlug, status: "error", recordsFetched: 0, error: "Unknown provider", duration: 0 };
  }
  const result = await fetcher();
  
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

  if (sections.length === 0) return "";
  return `## Live Economic & Financial Data (Government Sources)\n${sections.join("\n")}`;
}
