/**
 * Market History Service — Historical market data for projections
 * Uses FRED API (env-gated) for economic indicators.
 * Provides historical returns for retirement projections and Monte Carlo simulations.
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";

const log = logger.child({ module: "marketHistory" });

const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

export interface MarketDataPoint {
  date: string;
  value: number;
}

export interface AssetClassReturns {
  assetClass: string;
  annualizedReturn: number;
  standardDeviation: number;
  historicalData: MarketDataPoint[];
}

// Historical averages (1926-2024, source: Ibbotson/Morningstar)
const HISTORICAL_AVERAGES: Record<string, { return: number; stdDev: number }> = {
  "us_large_cap": { return: 10.3, stdDev: 19.7 },
  "us_small_cap": { return: 11.8, stdDev: 31.3 },
  "international_developed": { return: 8.1, stdDev: 22.4 },
  "emerging_markets": { return: 9.5, stdDev: 33.1 },
  "us_bonds_aggregate": { return: 5.3, stdDev: 5.6 },
  "us_treasury_10yr": { return: 5.1, stdDev: 7.7 },
  "us_tips": { return: 4.2, stdDev: 6.8 },
  "us_high_yield": { return: 7.4, stdDev: 10.2 },
  "reits": { return: 9.7, stdDev: 23.1 },
  "commodities": { return: 3.8, stdDev: 18.4 },
  "cash": { return: 3.3, stdDev: 0.9 },
  "inflation": { return: 2.9, stdDev: 1.8 },
};

// FRED series IDs for key economic indicators
const FRED_SERIES: Record<string, string> = {
  "sofr": "SOFR",
  "fed_funds": "FEDFUNDS",
  "cpi": "CPIAUCSL",
  "unemployment": "UNRATE",
  "gdp": "GDP",
  "sp500": "SP500",
  "treasury_10yr": "GS10",
  "treasury_2yr": "GS2",
  "mortgage_30yr": "MORTGAGE30US",
  "inflation_expectation": "T5YIE",
};

function getFredApiKey(): string | null {
  return process.env.FRED_API_KEY || null;
}

export async function fetchFredSeries(seriesId: string, startDate?: string, endDate?: string): Promise<MarketDataPoint[]> {
  const apiKey = getFredApiKey();
  if (!apiKey) {
    log.warn("FRED_API_KEY not set — returning empty data");
    return [];
  }

  try {
    const params = new URLSearchParams({
      series_id: seriesId,
      api_key: apiKey,
      file_type: "json",
      sort_order: "desc",
      limit: "365",
    });
    if (startDate) params.set("observation_start", startDate);
    if (endDate) params.set("observation_end", endDate);

    const res = await fetch(`${FRED_BASE}?${params}`);
    if (!res.ok) {
      log.warn({ status: res.status, seriesId }, "FRED API request failed");
      return [];
    }

    const data = await res.json() as any;
    return (data.observations || [])
      .filter((o: any) => o.value !== ".")
      .map((o: any) => ({ date: o.date, value: parseFloat(o.value) }));
  } catch (e: any) {
    log.error({ error: e.message, seriesId }, "FRED API error");
    return [];
  }
}

export async function getLatestSofrRate(): Promise<number | null> {
  const data = await fetchFredSeries("SOFR");
  return data.length > 0 ? data[0].value : null;
}

export function getHistoricalAverages(): Record<string, { return: number; stdDev: number }> {
  return { ...HISTORICAL_AVERAGES };
}

export function getAssetClassReturns(assetClass: string): AssetClassReturns | null {
  const avg = HISTORICAL_AVERAGES[assetClass];
  if (!avg) return null;

  return {
    assetClass,
    annualizedReturn: avg.return,
    standardDeviation: avg.stdDev,
    historicalData: [],
  };
}

/**
 * Monte Carlo simulation using historical return distributions
 */
export function runMonteCarloSimulation(
  initialBalance: number,
  annualContribution: number,
  yearsToProject: number,
  assetAllocation: Record<string, number>, // e.g., { us_large_cap: 0.6, us_bonds_aggregate: 0.4 }
  simulations = 1000,
): { median: number; percentile10: number; percentile25: number; percentile75: number; percentile90: number; successRate: number; targetBalance?: number } {
  // Calculate blended return and risk
  let blendedReturn = 0;
  let blendedVariance = 0;

  for (const [asset, weight] of Object.entries(assetAllocation)) {
    const avg = HISTORICAL_AVERAGES[asset];
    if (!avg) continue;
    blendedReturn += (avg.return / 100) * weight;
    blendedVariance += Math.pow(avg.stdDev / 100, 2) * Math.pow(weight, 2);
  }
  const blendedStdDev = Math.sqrt(blendedVariance);

  // Run simulations
  const finalBalances: number[] = [];

  for (let sim = 0; sim < simulations; sim++) {
    let balance = initialBalance;
    for (let year = 0; year < yearsToProject; year++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const yearReturn = blendedReturn + blendedStdDev * z;

      balance = balance * (1 + yearReturn) + annualContribution;
      if (balance < 0) balance = 0;
    }
    finalBalances.push(balance);
  }

  finalBalances.sort((a, b) => a - b);

  const percentile = (p: number) => finalBalances[Math.floor(p * finalBalances.length / 100)] || 0;

  return {
    median: Math.round(percentile(50)),
    percentile10: Math.round(percentile(10)),
    percentile25: Math.round(percentile(25)),
    percentile75: Math.round(percentile(75)),
    percentile90: Math.round(percentile(90)),
    successRate: Math.round((finalBalances.filter((b) => b > 0).length / simulations) * 10000) / 100,
  };
}

export function getAvailableFredSeries(): Record<string, string> {
  return { ...FRED_SERIES };
}
