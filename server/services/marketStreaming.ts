/**
 * Task #54 — Market Data Streaming Service
 * Real-time market data via Yahoo Finance API (callDataApi).
 * Falls back to cached data when API is unavailable.
 */
import { callDataApi } from "../_core/dataApi";
import { logger } from "../_core/logger";
const log = logger.child({ module: "marketStreaming" });

export interface MarketDataPoint {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
  source: string;
}

export interface MarketAlert {
  id: string;
  userId: number;
  symbol: string;
  condition: "above" | "below" | "change_percent";
  threshold: number;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface PortfolioImpact {
  symbol: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  portfolioWeight: number;
  portfolioImpact: number; // dollar impact
  portfolioImpactPercent: number;
}

// In-memory cache for fast reads (populated from real API calls)
const marketCache = new Map<string, MarketDataPoint>();
const alerts: MarketAlert[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 60_000; // 1-minute cache

const MARKET_SYMBOLS = [
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq 100 ETF" },
  { symbol: "DIA", name: "Dow Jones ETF" },
  { symbol: "IWM", name: "Russell 2000 ETF" },
  { symbol: "AGG", name: "US Aggregate Bond ETF" },
  { symbol: "GLD", name: "Gold ETF" },
  { symbol: "VNQ", name: "Real Estate ETF" },
  { symbol: "TLT", name: "20+ Year Treasury ETF" },
];

/** Fetch a single symbol quote from Yahoo Finance via built-in data API. */
async function fetchQuote(symbol: string): Promise<MarketDataPoint | null> {
  try {
    const data: any = await callDataApi("YahooFinance/get_stock_chart", {
      query: { symbol, region: "US", interval: "1d", range: "5d", includeAdjustedClose: true },
    });
    const result = data?.chart?.result?.[0];
    if (!result?.meta) return null;
    const meta = result.meta;
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = Math.round((price - prevClose) * 100) / 100;
    const changePercent = prevClose > 0 ? Math.round(((price - prevClose) / prevClose) * 10000) / 100 : 0;
    return {
      symbol: meta.symbol || symbol,
      price,
      change,
      changePercent,
      volume: meta.regularMarketVolume ?? 0,
      timestamp: new Date().toISOString(),
      source: "yahoo_finance",
    };
  } catch (err: any) {
    log.warn({ symbol, err: err.message }, "Failed to fetch quote from Yahoo Finance");
    return null;
  }
}

/** Get market snapshot — fetches real data from Yahoo Finance API with 1-min cache. */
export async function getMarketSnapshot(): Promise<MarketDataPoint[]> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS && marketCache.size >= MARKET_SYMBOLS.length) {
    return Array.from(marketCache.values());
  }
  const results: MarketDataPoint[] = [];
  for (const { symbol } of MARKET_SYMBOLS) {
    const quote = await fetchQuote(symbol);
    if (quote) {
      marketCache.set(symbol, quote);
      results.push(quote);
    } else {
      const cached = marketCache.get(symbol);
      if (cached) results.push(cached);
    }
  }
  if (results.length > 0) lastFetchTime = now;
  return results;
}

/** Get data for a specific symbol — fetches from cache or API. */
export async function getSymbolData(symbol: string): Promise<MarketDataPoint | null> {
  const cached = marketCache.get(symbol);
  const now = Date.now();
  if (cached && now - lastFetchTime < CACHE_TTL_MS) return cached;
  const quote = await fetchQuote(symbol);
  if (quote) { marketCache.set(symbol, quote); return quote; }
  return cached ?? null;
}

export function createAlert(userId: number, symbol: string, condition: MarketAlert["condition"], threshold: number): MarketAlert {
  const alert: MarketAlert = {
    id: `alert_${Date.now()}`,
    userId,
    symbol,
    condition,
    threshold,
    triggered: false,
    createdAt: new Date().toISOString(),
  };
  alerts.push(alert);
  return alert;
}

export function getUserAlerts(userId: number): MarketAlert[] {
  return alerts.filter(a => a.userId === userId);
}

export function deleteAlert(alertId: string): boolean {
  const idx = alerts.findIndex(a => a.id === alertId);
  if (idx === -1) return false;
  alerts.splice(idx, 1);
  return true;
}

export function checkAlerts(): MarketAlert[] {
  const triggered: MarketAlert[] = [];
  for (const alert of alerts) {
    if (alert.triggered) continue;
    const data = marketCache.get(alert.symbol);
    if (!data) continue;

    let shouldTrigger = false;
    if (alert.condition === "above" && data.price > alert.threshold) shouldTrigger = true;
    if (alert.condition === "below" && data.price < alert.threshold) shouldTrigger = true;
    if (alert.condition === "change_percent" && Math.abs(data.changePercent) > alert.threshold) shouldTrigger = true;

    if (shouldTrigger) {
      alert.triggered = true;
      alert.triggeredAt = new Date().toISOString();
      triggered.push(alert);
    }
  }
  return triggered;
}

export function calculatePortfolioImpact(holdings: Array<{ symbol: string; shares: number; costBasis: number }>): {
  impacts: PortfolioImpact[];
  totalValue: number;
  totalChange: number;
  totalChangePercent: number;
} {
  const impacts: PortfolioImpact[] = [];
  let totalValue = 0;
  let totalPreviousValue = 0;

  for (const holding of holdings) {
    const data = marketCache.get(holding.symbol);
    if (!data) continue;

    const currentValue = data.price * holding.shares;
    const previousClose = data.price - data.change;
    const previousValue = previousClose * holding.shares;
    totalValue += currentValue;
    totalPreviousValue += previousValue;

    impacts.push({
      symbol: holding.symbol,
      currentPrice: data.price,
      previousClose,
      change: data.change,
      changePercent: data.changePercent,
      portfolioWeight: 0, // Calculated after totals
      portfolioImpact: currentValue - previousValue,
      portfolioImpactPercent: 0,
    });
  }

  // Calculate weights and impact percentages
  for (const impact of impacts) {
    const currentValue = impact.currentPrice * (holdings.find(h => h.symbol === impact.symbol)?.shares ?? 0);
    impact.portfolioWeight = totalValue > 0 ? Math.round((currentValue / totalValue) * 10000) / 100 : 0;
    impact.portfolioImpactPercent = totalPreviousValue > 0 ? Math.round((impact.portfolioImpact / totalPreviousValue) * 10000) / 100 : 0;
  }

  return {
    impacts,
    totalValue: Math.round(totalValue * 100) / 100,
    totalChange: Math.round((totalValue - totalPreviousValue) * 100) / 100,
    totalChangePercent: totalPreviousValue > 0 ? Math.round(((totalValue - totalPreviousValue) / totalPreviousValue) * 10000) / 100 : 0,
  };
}
