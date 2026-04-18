/**
 * Polygon Adapter — Freemium
 *
 * Pass 121: Real-time and historical market data.
 * Requires POLYGON_API_KEY (free tier at polygon.io).
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, StockQuote, HistoricalPrice } from "../types";

const BASE_URL = "https://api.polygon.io";

function getApiKey(): string | undefined {
  return process.env.POLYGON_API_KEY || undefined;
}

async function fetchPolygon(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const key = getApiKey();
  if (!key) throw new Error("POLYGON_API_KEY not configured");
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Polygon API error: ${res.status}`);
  return res.json();
}

export const polygonAdapter: FinancialDataAdapter = {
  id: "polygon",
  name: "Polygon.io",
  description: "Real-time and historical stock, options, forex, and crypto data",
  tier: "freemium",
  requiresKey: true,
  supportedActions: ["quote", "historical", "ticker_details", "search"],

  async healthCheck(): Promise<AdapterHealth> {
    const key = getApiKey();
    if (!key) {
      return {
        adapterId: "polygon", name: "Polygon.io", status: "not_configured",
        lastChecked: Date.now(), tier: "freemium", requiresKey: true, keyConfigured: false,
        message: "POLYGON_API_KEY not set. Free tier at polygon.io",
      };
    }
    try {
      const start = Date.now();
      await fetchPolygon("v3/reference/tickers", { ticker: "AAPL", limit: "1" });
      return {
        adapterId: "polygon", name: "Polygon.io", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "freemium", requiresKey: true, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "polygon", name: "Polygon.io", status: "degraded",
        lastChecked: Date.now(), tier: "freemium", requiresKey: true, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "quote": {
        const symbol = String(params.symbol || "AAPL").toUpperCase();
        const data = await fetchPolygon(`v2/aggs/ticker/${symbol}/prev`);
        const r = data.results?.[0];
        if (!r) throw new Error(`No quote data for ${symbol}`);
        const quote: StockQuote = {
          symbol, price: r.c, change: r.c - r.o,
          changePercent: ((r.c - r.o) / r.o) * 100,
          volume: r.v, timestamp: r.t || Date.now(),
        };
        return { data: quote, source: "Polygon.io", adapterId: "polygon" };
      }
      case "historical": {
        const symbol = String(params.symbol || "").toUpperCase();
        const from = String(params.from || "2024-01-01");
        const to = String(params.to || new Date().toISOString().split("T")[0]);
        const data = await fetchPolygon(`v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}`, {
          adjusted: "true", sort: "desc", limit: String(params.limit || "100"),
        });
        const prices: HistoricalPrice[] = (data.results || []).map((r: any) => ({
          date: new Date(r.t).toISOString().split("T")[0],
          open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v,
        }));
        return { data: prices, source: "Polygon.io", adapterId: "polygon" };
      }
      case "ticker_details": {
        const symbol = String(params.symbol || "").toUpperCase();
        const data = await fetchPolygon(`v3/reference/tickers/${symbol}`);
        return { data: data.results || null, source: "Polygon.io", adapterId: "polygon" };
      }
      case "search": {
        const q = String(params.query || "");
        const data = await fetchPolygon("v3/reference/tickers", {
          search: q, limit: String(params.limit || "10"),
        });
        return { data: data.results || [], source: "Polygon.io", adapterId: "polygon" };
      }
      default:
        throw new Error(`Polygon adapter: unsupported action '${action}'`);
    }
  },
};
