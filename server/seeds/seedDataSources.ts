/**
 * seedDataSources.ts — CBL19 data pipeline activation
 *
 * Seeds the data_sources table with the 5 government API data sources
 * plus 2 market data sources that the platform's cron jobs fetch from.
 * Idempotent: skips rows where the name already exists.
 */
import { getDb } from "../db";
import { dataSources } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

interface DataSourceSeed {
  name: string;
  sourceType: "api_feed" | "market_data" | "regulatory";
  url: string;
  authType: "none" | "api_key";
  scheduleCron: string;
  priority: number;
  configJson: Record<string, unknown>;
}

const SOURCES: DataSourceSeed[] = [
  {
    name: "FRED Economic Data",
    sourceType: "market_data",
    url: "https://api.stlouisfed.org/fred/series/observations",
    authType: "api_key",
    scheduleCron: "0 */6 * * *", // every 6 hours
    priority: 1,
    configJson: {
      provider: "fred",
      envKey: "FRED_API_KEY",
      series: ["FEDFUNDS", "DGS10", "DGS2", "GDP", "CPIAUCSL", "UNRATE", "SOFR", "MORTGAGE30US", "VIXCLS", "SP500", "DJIA", "NASDAQCOM", "BAMLH0A0HYM2", "T10Y2Y", "M2SL"],
      description: "Federal Reserve Economic Data — interest rates, GDP, CPI, unemployment, market indices",
    },
  },
  {
    name: "BLS Labor Statistics",
    sourceType: "api_feed",
    url: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
    authType: "api_key",
    scheduleCron: "0 0 * * *", // daily
    priority: 2,
    configJson: {
      provider: "bls",
      envKey: "BLS_API_KEY",
      series: ["CUSR0000SA0", "CUSR0000SAM", "CUSR0000SAH1", "LNS14000000", "CES0000000001", "CUUR0000SAE1", "CEU0500000003", "LNS12300000"],
      description: "Bureau of Labor Statistics — CPI, unemployment, employment, wages",
    },
  },
  {
    name: "Census Bureau Demographics",
    sourceType: "api_feed",
    url: "https://api.census.gov/data",
    authType: "api_key",
    scheduleCron: "0 0 1 * *", // monthly
    priority: 3,
    configJson: {
      provider: "census",
      envKey: "CENSUS_API_KEY",
      datasets: ["acs/acs5", "pep/population"],
      description: "Census Bureau — demographics, income, population by zip code",
    },
  },
  {
    name: "SEC EDGAR Filings",
    sourceType: "regulatory",
    url: "https://efts.sec.gov/LATEST/search-index",
    authType: "none",
    scheduleCron: "0 */12 * * *", // every 12 hours
    priority: 2,
    configJson: {
      provider: "sec",
      description: "SEC EDGAR — company filings, 10-K, 10-Q, 8-K, proxy statements",
      noKeyRequired: true,
    },
  },
  {
    name: "BEA Economic Analysis",
    sourceType: "api_feed",
    url: "https://apps.bea.gov/api/data",
    authType: "api_key",
    scheduleCron: "0 0 * * 0", // weekly
    priority: 3,
    configJson: {
      provider: "bea",
      envKey: "BEA_API_KEY",
      datasets: ["NIPA", "Regional"],
      description: "Bureau of Economic Analysis — GDP, personal income, regional economics",
    },
  },
  {
    name: "S&P 500 Historical Returns",
    sourceType: "market_data",
    url: "https://datahub.io/core/s-and-p-500",
    authType: "none",
    scheduleCron: "0 18 * * 1-5", // weekday market close
    priority: 2,
    configJson: {
      provider: "sp500_history",
      description: "S&P 500 historical annual returns — used by SCUI stress testing and Monte Carlo",
      builtIn: true,
    },
  },
  {
    name: "SOFR Rate Feed",
    sourceType: "market_data",
    url: "https://api.stlouisfed.org/fred/series/observations?series_id=SOFR",
    authType: "api_key",
    scheduleCron: "0 0 * * *", // daily
    priority: 1,
    configJson: {
      provider: "sofr",
      envKey: "FRED_API_KEY",
      description: "Secured Overnight Financing Rate — used by premium financing calculators",
    },
  },
];

export async function seedDataSources(): Promise<number> {
  const db = await getDb();
  if (!db) {
    logger.warn({ operation: "seedDataSources" }, "DB unavailable, skipping data sources seed");
    return 0;
  }

  const now = Date.now();
  let inserted = 0;

  for (const src of SOURCES) {
    try {
      // Check if already exists by name
      const [existing] = await db
        .select({ id: dataSources.id })
        .from(dataSources)
        .where(eq(dataSources.name, src.name))
        .limit(1);

      if (existing) continue; // idempotent skip

      await db.insert(dataSources).values({
        name: src.name,
        sourceType: src.sourceType,
        url: src.url,
        authType: src.authType,
        scheduleCron: src.scheduleCron,
        priority: src.priority,
        isActive: true,
        totalRecordsIngested: 0,
        configJson: src.configJson,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    } catch (e: any) {
      logger.warn({ operation: "seedDataSources", source: src.name, err: e.message }, "Failed to seed data source");
    }
  }

  if (inserted > 0) {
    logger.info({ operation: "seedDataSources", inserted }, `Seeded ${inserted} data sources`);
  }
  return inserted;
}
