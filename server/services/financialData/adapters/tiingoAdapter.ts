/**
 * Tiingo Adapter — Freemium
 *
 * Pass 121: End-of-day stock prices, news, fundamentals.
 * Requires TIINGO_API_KEY (free tier at tiingo.com).
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, StockQuote, HistoricalPrice } from "../types";

const BASE_URL = "https://api.tiingo.com";

function getApiKey(): string | undefined {
  return process.env.TIINGO_API_KEY || undefined;
}

async function fetchTiingo(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const key = getApiKey();
  if (!key) throw new Error("TIINGO_API_KEY not configured");
  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Tiingo API error: ${res.status}`);
  return res.json();
}

export const tiingoAdapter: FinancialDataAdapter = {
  id: "tiingo",
  name: "Tiingo",
  description: "End-of-day stock prices, news, and fundamentals",
  tier: "freemium",
  requiresKey: true,
  supportedActions: ["quote", "historical", "meta", "news"],

  async healthCheck(): Promise<AdapterHealth> {
    const key = getApiKey();
    if (!key) {
      return {
        adapterId: "tiingo", name: "Tiingo", status: "not_configured",
        lastChecked: Date.now(), tier: "freemium", requiresKey: true, keyConfigured: false,
        message: "TIINGO_API_KEY not set. Free tier at tiingo.com",
      };
    }
    try {
      const start = Date.now();
      await fetchTiingo("iex/?tickers=AAPL");
      return {
        adapterId: "tiingo", name: "Tiingo", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "freemium", requiresKey: true, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "tiingo", name: "Tiingo", status: "degraded",
        lastChecked: Date.now(), tier: "freemium", requiresKey: true, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "quote": {
        const symbol = String(params.symbol || "AAPL").toUpperCase();
        const data = await fetchTiingo(`iex/?tickers=${symbol}`);
        const q = data[0];
        if (!q) throw new Error(`No quote data for ${symbol}`);
        const quote: StockQuote = {
          symbol, price: q.last || q.tngoLast, change: (q.last || q.tngoLast) - q.prevClose,
          changePercent: (((q.last || q.tngoLast) - q.prevClose) / q.prevClose) * 100,
          volume: q.volume, timestamp: q.timestamp ? new Date(q.timestamp).getTime() : Date.now(),
        };
        return { data: quote, source: "Tiingo", adapterId: "tiingo" };
      }
      case "historical": {
        const symbol = String(params.symbol || "").toUpperCase();
        const startDate = String(params.from || "2024-01-01");
        const endDate = String(params.to || new Date().toISOString().split("T")[0]);
        const data = await fetchTiingo(`tiingo/daily/${symbol.toLowerCase()}/prices`, {
          startDate, endDate,
        });
        const prices: HistoricalPrice[] = (data || []).map((r: any) => ({
          date: r.date?.split("T")[0] || "", open: r.open, high: r.high,
          low: r.low, close: r.close, volume: r.volume, adjustedClose: r.adjClose,
        }));
        return { data: prices, source: "Tiingo", adapterId: "tiingo" };
      }
      case "meta": {
        const symbol = String(params.symbol || "").toUpperCase();
        const data = await fetchTiingo(`tiingo/daily/${symbol.toLowerCase()}`);
        return { data, source: "Tiingo", adapterId: "tiingo" };
      }
      case "news": {
        const tickers = String(params.tickers || params.symbol || "");
        const data = await fetchTiingo("tiingo/news", {
          tickers: tickers.toLowerCase(),
          limit: String(params.limit || "10"),
        });
        return { data, source: "Tiingo", adapterId: "tiingo" };
      }
      default:
        throw new Error(`Tiingo adapter: unsupported action '${action}'`);
    }
  },
};
