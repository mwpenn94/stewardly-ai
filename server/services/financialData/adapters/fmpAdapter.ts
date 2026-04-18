/**
 * FMP Adapter — Financial Modeling Prep (Freemium)
 *
 * Pass 121: Stock quotes, financial statements, company profiles.
 * Requires FMP_API_KEY (free tier available at financialmodelingprep.com).
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, StockQuote } from "../types";

const BASE_URL = "https://financialmodelingprep.com/api/v3";

function getApiKey(): string | undefined {
  return process.env.FMP_API_KEY || undefined;
}

async function fetchFmp(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const key = getApiKey();
  if (!key) throw new Error("FMP_API_KEY not configured");
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("apikey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`FMP API error: ${res.status}`);
  return res.json();
}

export const fmpAdapter: FinancialDataAdapter = {
  id: "fmp",
  name: "FMP (Financial Modeling Prep)",
  description: "Stock quotes, financial statements, company profiles",
  tier: "freemium",
  requiresKey: true,
  supportedActions: ["quote", "profile", "income_statement", "balance_sheet", "search", "historical"],

  async healthCheck(): Promise<AdapterHealth> {
    const key = getApiKey();
    if (!key) {
      return {
        adapterId: "fmp", name: "FMP", status: "not_configured",
        lastChecked: Date.now(), tier: "freemium", requiresKey: true, keyConfigured: false,
        message: "FMP_API_KEY not set. Free tier at financialmodelingprep.com",
      };
    }
    try {
      const start = Date.now();
      await fetchFmp("quote/AAPL");
      return {
        adapterId: "fmp", name: "FMP", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "freemium", requiresKey: true, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "fmp", name: "FMP", status: "degraded",
        lastChecked: Date.now(), tier: "freemium", requiresKey: true, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "quote": {
        const symbol = String(params.symbol || "AAPL").toUpperCase();
        const data = await fetchFmp(`quote/${symbol}`);
        const q = data[0];
        if (!q) throw new Error(`No quote data for ${symbol}`);
        const quote: StockQuote = {
          symbol: q.symbol, price: q.price, change: q.change,
          changePercent: q.changesPercentage, volume: q.volume,
          marketCap: q.marketCap, name: q.name, exchange: q.exchange,
          timestamp: q.timestamp ? q.timestamp * 1000 : Date.now(),
        };
        return { data: quote, source: "FMP", adapterId: "fmp" };
      }
      case "profile": {
        const symbol = String(params.symbol || "").toUpperCase();
        const data = await fetchFmp(`profile/${symbol}`);
        return { data: data[0] || null, source: "FMP", adapterId: "fmp" };
      }
      case "income_statement": {
        const symbol = String(params.symbol || "").toUpperCase();
        const period = String(params.period || "annual");
        const data = await fetchFmp(`income-statement/${symbol}`, { period });
        return { data, source: "FMP", adapterId: "fmp" };
      }
      case "balance_sheet": {
        const symbol = String(params.symbol || "").toUpperCase();
        const period = String(params.period || "annual");
        const data = await fetchFmp(`balance-sheet-statement/${symbol}`, { period });
        return { data, source: "FMP", adapterId: "fmp" };
      }
      case "search": {
        const q = String(params.query || "");
        const data = await fetchFmp("search", { query: q, limit: String(params.limit || "10") });
        return { data, source: "FMP", adapterId: "fmp" };
      }
      case "historical": {
        const symbol = String(params.symbol || "").toUpperCase();
        const data = await fetchFmp(`historical-price-full/${symbol}`, {
          from: String(params.from || ""), to: String(params.to || ""),
        });
        return {
          data: (data.historical || []).map((h: any) => ({
            date: h.date, open: h.open, high: h.high, low: h.low,
            close: h.close, volume: h.volume, adjustedClose: h.adjClose,
          })),
          source: "FMP", adapterId: "fmp",
        };
      }
      default:
        throw new Error(`FMP adapter: unsupported action '${action}'`);
    }
  },
};
