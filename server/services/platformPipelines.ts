/**
 * Platform-Tier Data Pipelines
 * 
 * These pipelines fetch data from free government/public APIs at the platform level.
 * They run on a schedule (cron) and cache results for use across all users.
 * 
 * Supported sources:
 * - FRED (Federal Reserve Economic Data): interest rates, inflation, GDP
 * - BLS (Bureau of Labor Statistics): CPI, unemployment, wages
 * - Census Bureau: demographics, income, housing
 * - SEC EDGAR: company filings, Form ADV
 * - BEA (Bureau of Economic Analysis): GDP, personal income
 * - FINRA BrokerCheck: advisor verification
 */

import { getDb } from "../db";
import { integrationSyncLogs, integrationConnections, enrichmentCache } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

// ─── FRED Pipeline ─────────────────────────────────────────────────────
// 800,000+ economic time series. Free API key required.
const FRED_SERIES = {
  "FEDFUNDS": "Federal Funds Rate",
  "DGS10": "10-Year Treasury Yield",
  "DGS30": "30-Year Treasury Yield",
  "MORTGAGE30US": "30-Year Fixed Mortgage Rate",
  "CPIAUCSL": "Consumer Price Index (All Urban)",
  "UNRATE": "Unemployment Rate",
  "GDP": "Gross Domestic Product",
  "DEXUSEU": "USD/EUR Exchange Rate",
  "SP500": "S&P 500 Index",
  "VIXCLS": "CBOE Volatility Index (VIX)",
  "T10Y2Y": "10Y-2Y Treasury Spread",
  "PSAVERT": "Personal Savings Rate",
  "TOTALSA": "Total Vehicle Sales",
  "HOUST": "Housing Starts",
  "UMCSENT": "Consumer Sentiment",
};

export async function fetchFREDData(apiKey?: string): Promise<{
  success: boolean;
  seriesFetched: number;
  errors: string[];
}> {
  const db = (await getDb())!;
  const errors: string[] = [];
  let seriesFetched = 0;

  if (!apiKey) {
    return { success: false, seriesFetched: 0, errors: ["FRED API key not configured. Get one free at https://fred.stlouisfed.org/docs/api/api_key.html"] };
  }

  for (const [seriesId, label] of Object.entries(FRED_SERIES)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=12`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
      
      if (!resp.ok) {
        errors.push(`FRED ${seriesId}: HTTP ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const observations = data.observations || [];
      
      // Cache the latest 12 observations
      const cacheData = {
        seriesId,
        label,
        latestValue: observations[0]?.value,
        latestDate: observations[0]?.date,
        observations: observations.slice(0, 12).map((o: any) => ({
          date: o.date,
          value: o.value,
        })),
        fetchedAt: new Date().toISOString(),
      };

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 6); // 6-hour cache

      await db.insert(enrichmentCache).values({
        id: uuid(),
        providerSlug: "fred",
        lookupKey: seriesId,
        lookupType: "time_series",
        resultJson: cacheData,
        fetchedAt: new Date(),
        expiresAt,
      }).onDuplicateKeyUpdate({
        set: { resultJson: cacheData, fetchedAt: new Date(), expiresAt, hitCount: 0 },
      });

      seriesFetched++;
    } catch (e: any) {
      errors.push(`FRED ${seriesId}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, seriesFetched, errors };
}

// ─── BLS Pipeline ──────────────────────────────────────────────────────
// CPI, unemployment, wages. Free key: 500 queries/day.
const BLS_SERIES = {
  "CUUR0000SA0": "CPI - All Items",
  "CUUR0000SAF1": "CPI - Food",
  "CUUR0000SAH1": "CPI - Housing",
  "CUUR0000SAM": "CPI - Medical Care",
  "CUUR0000SAE": "CPI - Education",
  "LNS14000000": "Unemployment Rate",
  "CES0000000001": "Total Nonfarm Employment",
  "CES0500000003": "Average Hourly Earnings",
};

export async function fetchBLSData(apiKey?: string): Promise<{
  success: boolean;
  seriesFetched: number;
  errors: string[];
}> {
  const db = (await getDb())!;
  const errors: string[] = [];
  let seriesFetched = 0;

  const seriesIds = Object.keys(BLS_SERIES);
  const currentYear = new Date().getFullYear();

  try {
    const url = apiKey
      ? `https://api.bls.gov/publicAPI/v2/timeseries/data/`
      : `https://api.bls.gov/publicAPI/v1/timeseries/data/`;

    const body: Record<string, unknown> = {
      seriesid: seriesIds,
      startyear: String(currentYear - 1),
      endyear: String(currentYear),
    };
    if (apiKey) body.registrationkey = apiKey;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      return { success: false, seriesFetched: 0, errors: [`BLS API: HTTP ${resp.status}`] };
    }

    const data = await resp.json();
    
    for (const series of (data.Results?.series || [])) {
      const seriesId = series.seriesID;
      const label = BLS_SERIES[seriesId as keyof typeof BLS_SERIES] || seriesId;
      const latestData = series.data?.[0];

      const cacheData = {
        seriesId,
        label,
        latestValue: latestData?.value,
        latestPeriod: latestData?.periodName,
        latestYear: latestData?.year,
        recentData: (series.data || []).slice(0, 12).map((d: any) => ({
          year: d.year,
          period: d.periodName,
          value: d.value,
        })),
        fetchedAt: new Date().toISOString(),
      };

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 12); // 12-hour cache (BLS updates monthly)

      await db.insert(enrichmentCache).values({
        id: uuid(),
        providerSlug: "bls",
        lookupKey: seriesId,
        lookupType: "time_series",
        resultJson: cacheData,
        fetchedAt: new Date(),
        expiresAt,
      }).onDuplicateKeyUpdate({
        set: { resultJson: cacheData, fetchedAt: new Date(), expiresAt, hitCount: 0 },
      });

      seriesFetched++;
    }
  } catch (e: any) {
    errors.push(`BLS batch: ${e.message}`);
  }

  return { success: errors.length === 0, seriesFetched, errors };
}

// ─── Census Bureau Pipeline ────────────────────────────────────────────
// Demographics, income, housing. Free API key.
export async function fetchCensusData(apiKey?: string, zipCode?: string): Promise<{
  success: boolean;
  recordsFetched: number;
  errors: string[];
}> {
  const db = (await getDb())!;
  const errors: string[] = [];
  let recordsFetched = 0;

  if (!apiKey) {
    return { success: false, recordsFetched: 0, errors: ["Census API key not configured. Get one free at https://api.census.gov/data/key_signup.html"] };
  }

  // ACS 5-Year estimates: income, education, housing
  const variables = [
    "B19013_001E", // Median household income
    "B15003_022E", // Bachelor's degree
    "B25077_001E", // Median home value
    "B01003_001E", // Total population
    "B01002_001E", // Median age
    "B25064_001E", // Median gross rent
  ];

  const variableLabels: Record<string, string> = {
    "B19013_001E": "Median Household Income",
    "B15003_022E": "Bachelor's Degree Holders",
    "B25077_001E": "Median Home Value",
    "B01003_001E": "Total Population",
    "B01002_001E": "Median Age",
    "B25064_001E": "Median Gross Rent",
  };

  // Fetch national-level data
  try {
    const varStr = variables.join(",");
    const url = `https://api.census.gov/data/2022/acs/acs5?get=NAME,${varStr}&for=us:*&key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (resp.ok) {
      const data = await resp.json();
      if (data.length >= 2) {
        const headers = data[0];
        const values = data[1];
        const record: Record<string, unknown> = {};
        
        headers.forEach((h: string, i: number) => {
          record[h] = values[i];
          if (variableLabels[h]) {
            record[variableLabels[h]] = values[i];
          }
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30-day cache (Census updates annually)

        await db.insert(enrichmentCache).values({
          id: uuid(),
          providerSlug: "census-bureau",
          lookupKey: "national",
          lookupType: "demographics",
          resultJson: record,
          fetchedAt: new Date(),
          expiresAt,
        }).onDuplicateKeyUpdate({
          set: { resultJson: record, fetchedAt: new Date(), expiresAt, hitCount: 0 },
        });

        recordsFetched++;
      }
    } else {
      errors.push(`Census national: HTTP ${resp.status}`);
    }
  } catch (e: any) {
    errors.push(`Census national: ${e.message}`);
  }

  // Fetch zip-code level if provided
  if (zipCode) {
    try {
      const varStr = variables.join(",");
      const url = `https://api.census.gov/data/2022/acs/acs5?get=NAME,${varStr}&for=zip%20code%20tabulation%20area:${zipCode}&key=${apiKey}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });

      if (resp.ok) {
        const data = await resp.json();
        if (data.length >= 2) {
          const headers = data[0];
          const values = data[1];
          const record: Record<string, unknown> = {};
          
          headers.forEach((h: string, i: number) => {
            record[h] = values[i];
            if (variableLabels[h]) {
              record[variableLabels[h]] = values[i];
            }
          });

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await db.insert(enrichmentCache).values({
            id: uuid(),
            providerSlug: "census-bureau",
            lookupKey: `zip:${zipCode}`,
            lookupType: "demographics",
            resultJson: record,
            fetchedAt: new Date(),
            expiresAt,
          }).onDuplicateKeyUpdate({
            set: { resultJson: record, fetchedAt: new Date(), expiresAt, hitCount: 0 },
          });

          recordsFetched++;
        }
      }
    } catch (e: any) {
      errors.push(`Census zip ${zipCode}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, recordsFetched, errors };
}

// ─── SEC EDGAR Pipeline ────────────────────────────────────────────────
// Company filings. No API key required. 10 req/sec fair use.
export async function fetchSECFilings(ticker?: string): Promise<{
  success: boolean;
  filingsFetched: number;
  errors: string[];
}> {
  const db = (await getDb())!;
  const errors: string[] = [];
  let filingsFetched = 0;

  const headers = {
    "User-Agent": "StewardlyAI/1.0 (contact@stewardly.ai)",
    "Accept": "application/json",
  };

  if (ticker) {
    // Fetch specific company filings
    try {
      // First, resolve ticker to CIK
      const tickerUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${ticker}%22&dateRange=custom&startdt=2024-01-01&enddt=2026-12-31&forms=10-K,10-Q,8-K`;
      // Use the company tickers endpoint instead
      const cikUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${ticker}&type=10-K&dateb=&owner=include&count=5&search_text=&action=getcompany&output=atom`;
      
      // Simpler: use the full-text search
      const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${ticker}%22&forms=10-K,10-Q&dateRange=custom&startdt=2024-01-01`;
      
      // For now, use the EDGAR full-text search API
      const resp = await fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(ticker)}&forms=10-K,10-Q,8-K`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const filings = (data.hits?.hits || []).slice(0, 10);

        const cacheData = {
          ticker,
          filings: filings.map((f: any) => ({
            form: f._source?.form_type,
            date: f._source?.file_date,
            company: f._source?.display_names?.[0],
            url: f._source?.file_url,
          })),
          fetchedAt: new Date().toISOString(),
        };

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        await db.insert(enrichmentCache).values({
          id: uuid(),
          providerSlug: "sec-edgar",
          lookupKey: `ticker:${ticker}`,
          lookupType: "filings",
          resultJson: cacheData,
          fetchedAt: new Date(),
          expiresAt,
        }).onDuplicateKeyUpdate({
          set: { resultJson: cacheData, fetchedAt: new Date(), expiresAt, hitCount: 0 },
        });

        filingsFetched = filings.length;
      }
    } catch (e: any) {
      errors.push(`SEC ${ticker}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, filingsFetched, errors };
}

// ─── BEA Pipeline ──────────────────────────────────────────────────────
// GDP, personal income, consumer spending. Free API key.
export async function fetchBEAData(apiKey?: string): Promise<{
  success: boolean;
  datasetsFetched: number;
  errors: string[];
}> {
  const db = (await getDb())!;
  const errors: string[] = [];
  let datasetsFetched = 0;

  if (!apiKey) {
    return { success: false, datasetsFetched: 0, errors: ["BEA API key not configured. Get one free at https://apps.bea.gov/API/signup/"] };
  }

  // Fetch GDP data
  const datasets = [
    { name: "GDP", params: `&DataSetName=NIPA&TableName=T10101&Frequency=Q&Year=ALL` },
    { name: "PersonalIncome", params: `&DataSetName=Regional&TableName=CAINC1&LineCode=1&GeoFips=STATE&Year=ALL` },
  ];

  for (const ds of datasets) {
    try {
      // BEA API is case-sensitive: UserID must be lowercase
      const url = `https://apps.bea.gov/api/data?UserID=${apiKey.toLowerCase()}&method=GetData${ds.params}&ResultFormat=JSON`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });

      if (resp.ok) {
        const data = await resp.json();
        const results = data.BEAAPI?.Results?.Data || [];

        const cacheData = {
          dataset: ds.name,
          recordCount: results.length,
          latestRecords: results.slice(0, 20),
          fetchedAt: new Date().toISOString(),
        };

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Weekly cache

        await db.insert(enrichmentCache).values({
          id: uuid(),
          providerSlug: "bea",
          lookupKey: ds.name,
          lookupType: "economic",
          resultJson: cacheData,
          fetchedAt: new Date(),
          expiresAt,
        }).onDuplicateKeyUpdate({
          set: { resultJson: cacheData, fetchedAt: new Date(), expiresAt, hitCount: 0 },
        });

        datasetsFetched++;
      } else {
        errors.push(`BEA ${ds.name}: HTTP ${resp.status}`);
      }
    } catch (e: any) {
      errors.push(`BEA ${ds.name}: ${e.message}`);
    }
  }

  return { success: errors.length === 0, datasetsFetched, errors };
}

// ─── FINRA BrokerCheck Pipeline ────────────────────────────────────────
// Advisor verification. No API key for public lookups.
export async function lookupFINRAAdvisor(name: string): Promise<{
  success: boolean;
  results: Array<Record<string, unknown>>;
  errors: string[];
}> {
  const db = (await getDb())!;
  const errors: string[] = [];

  try {
    // BrokerCheck public API
    const url = `https://api.brokercheck.finra.org/search/individual?query=${encodeURIComponent(name)}&hl=true&nrows=10&start=0&r=25&sort=score+desc&wt=json`;
    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      return { success: false, results: [], errors: [`FINRA: HTTP ${resp.status}`] };
    }

    const data = await resp.json();
    const hits = data.hits?.hits || [];

    const results = hits.map((h: any) => ({
      name: h._source?.ind_firstname + " " + h._source?.ind_lastname,
      crd: h._source?.ind_source_id,
      firm: h._source?.ind_current_employments?.[0]?.firm_name,
      city: h._source?.ind_current_employments?.[0]?.branch_city,
      state: h._source?.ind_current_employments?.[0]?.branch_state,
      registrations: h._source?.ind_industry_qualifications_count,
      disclosures: h._source?.ind_disclosure_fl === "Y",
    }));

    // Cache results
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.insert(enrichmentCache).values({
      id: uuid(),
      providerSlug: "finra-brokercheck",
      lookupKey: `name:${name.toLowerCase()}`,
      lookupType: "advisor_search",
      resultJson: { query: name, results, count: results.length },
      fetchedAt: new Date(),
      expiresAt,
    }).onDuplicateKeyUpdate({
      set: { resultJson: { query: name, results, count: results.length }, fetchedAt: new Date(), expiresAt, hitCount: 0 },
    });

    return { success: true, results, errors: [] };
  } catch (e: any) {
    return { success: false, results: [], errors: [e.message] };
  }
}

// ─── Master Pipeline Runner ────────────────────────────────────────────
// Runs all platform-tier pipelines with available API keys
export async function runAllPlatformPipelines(apiKeys: {
  fred?: string;
  bls?: string;
  census?: string;
  bea?: string;
}): Promise<{
  results: Record<string, { success: boolean; count: number; errors: string[] }>;
  totalSuccess: number;
  totalErrors: number;
}> {
  const results: Record<string, { success: boolean; count: number; errors: string[] }> = {};
  let totalSuccess = 0;
  let totalErrors = 0;

  // FRED
  const fred = await fetchFREDData(apiKeys.fred);
  results.fred = { success: fred.success, count: fred.seriesFetched, errors: fred.errors };
  totalSuccess += fred.seriesFetched;
  totalErrors += fred.errors.length;

  // BLS
  const bls = await fetchBLSData(apiKeys.bls);
  results.bls = { success: bls.success, count: bls.seriesFetched, errors: bls.errors };
  totalSuccess += bls.seriesFetched;
  totalErrors += bls.errors.length;

  // Census
  const census = await fetchCensusData(apiKeys.census);
  results.census = { success: census.success, count: census.recordsFetched, errors: census.errors };
  totalSuccess += census.recordsFetched;
  totalErrors += census.errors.length;

  // SEC EDGAR (no key needed)
  const sec = await fetchSECFilings();
  results.sec = { success: sec.success, count: sec.filingsFetched, errors: sec.errors };
  totalSuccess += sec.filingsFetched;
  totalErrors += sec.errors.length;

  // BEA
  const bea = await fetchBEAData(apiKeys.bea);
  results.bea = { success: bea.success, count: bea.datasetsFetched, errors: bea.errors };
  totalSuccess += bea.datasetsFetched;
  totalErrors += bea.errors.length;

  return { results, totalSuccess, totalErrors };
}
