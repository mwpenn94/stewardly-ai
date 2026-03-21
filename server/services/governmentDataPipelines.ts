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

// ─── Helper: get API key for a provider slug ────────────────────────────
async function getApiKeyForProvider(slug: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [provider] = await db.select().from(integrationProviders)
    .where(eq(integrationProviders.slug, slug));
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
      console.warn(`[Pipeline] Failed to store ${dp.key}:`, e.message);
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
const BEA_DATASETS = [
  {
    name: "GDP by Industry",
    method: "GetData",
    params: { DatasetName: "GDPbyIndustry", Frequency: "A", Industry: "ALL", TableID: "1", Year: "LAST5" },
    category: "gdp_industry",
  },
  {
    name: "Personal Income",
    method: "GetData",
    params: { DatasetName: "NIPA", Frequency: "M", TableName: "T20100", Year: "X" },
    category: "personal_income",
  },
];

async function fetchBEAData(): Promise<PipelineResult> {
  const start = Date.now();
  const apiKey = await getApiKeyForProvider("bea");
  if (!apiKey) return { pipeline: "BEA", providerSlug: "bea", status: "skipped", recordsFetched: 0, error: "No API key", duration: 0 };

  try {
    const dataPoints: FetchedDataPoint[] = [];

    // Fetch GDP summary data
    try {
      const gdpResp = await fetch(
        `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GetData&DatasetName=NIPA&Frequency=Q&TableName=T10101&Year=LAST5&ResultFormat=JSON`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (gdpResp.ok) {
        const gdpData = await gdpResp.json();
        const results = gdpData?.BEAAPI?.Results?.Data;
        if (Array.isArray(results)) {
          // Get the most recent quarter's key GDP metrics
          const gdpLines: Record<string, string> = {
            "1": "GDP",
            "2": "Personal Consumption Expenditures",
            "7": "Gross Private Domestic Investment",
            "13": "Net Exports",
            "22": "Government Consumption & Investment",
          };
          
          // Group by time period, get latest
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
    } catch { /* skip GDP fetch failure */ }

    // Fetch Personal Income data
    try {
      const piResp = await fetch(
        `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GetData&DatasetName=NIPA&Frequency=M&TableName=T20100&Year=X&ResultFormat=JSON`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (piResp.ok) {
        const piData = await piResp.json();
        const results = piData?.BEAAPI?.Results?.Data;
        if (Array.isArray(results)) {
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
    } catch { /* skip PI fetch failure */ }

    // Fetch International Trade data
    try {
      const tradeResp = await fetch(
        `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GetData&DatasetName=ITA&Indicator=BalGds&AreaOrCountry=AllCountries&Frequency=QSA&Year=LAST5&ResultFormat=JSON`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (tradeResp.ok) {
        const tradeData = await tradeResp.json();
        const results = tradeData?.BEAAPI?.Results?.Data;
        if (Array.isArray(results) && results.length > 0) {
          // Get latest trade balance
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
    } catch { /* skip trade fetch failure */ }

    const stored = await storeDataPoints("bea", dataPoints);
    return { pipeline: "BEA", providerSlug: "bea", status: "success", recordsFetched: stored, duration: Date.now() - start };
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
  const db = await getDb();
  if (!db) return;

  const [provider] = await db.select().from(integrationProviders)
    .where(eq(integrationProviders.slug, providerSlug));
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
}

// ─── Run All Pipelines ──────────────────────────────────────────────────
export async function runAllDataPipelines(): Promise<PipelineResult[]> {
  console.log("[DataPipelines] Starting all government data pipelines...");
  
  const results = await Promise.allSettled([
    fetchBLSData(),
    fetchFREDData(),
    fetchBEAData(),
    fetchCensusData(),
  ]);

  const finalResults = results.map((r, i) => {
    const names = ["BLS", "FRED", "BEA", "Census"];
    const slugs = ["bls", "fred", "bea", "census-bureau"];
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
      console.warn(`[DataPipelines] Failed to update sync status for ${result.providerSlug}:`, e.message);
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

  if (sections.length === 0) return "";
  return `## Live Economic Data (Government Sources)\n${sections.join("\n")}`;
}
