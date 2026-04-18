/**
 * FRED Adapter — Federal Reserve Economic Data
 *
 * Pass 121: Free with key (api.stlouisfed.org/fred).
 * Provides economic time series data (GDP, CPI, unemployment, interest rates, etc.)
 * Gracefully degrades when FRED_API_KEY is not set.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, EconomicSeries } from "../types";

const BASE_URL = "https://api.stlouisfed.org/fred";

function getApiKey(): string | undefined {
  return process.env.FRED_API_KEY || undefined;
}

async function fetchFred(endpoint: string, params: Record<string, string>): Promise<any> {
  const key = getApiKey();
  if (!key) throw new Error("FRED_API_KEY not configured");
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`FRED API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export const fredAdapter: FinancialDataAdapter = {
  id: "fred",
  name: "FRED (Federal Reserve Economic Data)",
  description: "Economic time series from the Federal Reserve Bank of St. Louis",
  tier: "free_with_key",
  requiresKey: true,
  supportedActions: ["series", "search", "categories", "releases"],

  async healthCheck(): Promise<AdapterHealth> {
    const key = getApiKey();
    if (!key) {
      return {
        adapterId: "fred", name: "FRED", status: "not_configured",
        lastChecked: Date.now(), tier: "free_with_key", requiresKey: true, keyConfigured: false,
        message: "FRED_API_KEY not set. Free signup at api.stlouisfed.org/fred",
      };
    }
    try {
      const start = Date.now();
      await fetchFred("series", { series_id: "GDP" });
      return {
        adapterId: "fred", name: "FRED", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "free_with_key", requiresKey: true, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "fred", name: "FRED", status: "degraded",
        lastChecked: Date.now(), tier: "free_with_key", requiresKey: true, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "series": {
        const seriesId = String(params.seriesId || params.series_id || "GDP");
        const limit = String(params.limit || "100");
        const [info, obs] = await Promise.all([
          fetchFred("series", { series_id: seriesId }),
          fetchFred("series/observations", { series_id: seriesId, sort_order: "desc", limit }),
        ]);
        const series: EconomicSeries = {
          seriesId,
          title: info.seriess?.[0]?.title || seriesId,
          frequency: info.seriess?.[0]?.frequency || "Unknown",
          units: info.seriess?.[0]?.units || "Unknown",
          lastUpdated: info.seriess?.[0]?.last_updated || "",
          source: "FRED",
          observations: (obs.observations || []).map((o: any) => ({
            date: o.date,
            value: o.value === "." ? null : parseFloat(o.value),
          })),
        };
        return { data: series, source: "FRED", adapterId: "fred" };
      }
      case "search": {
        const q = String(params.query || params.q || "");
        const data = await fetchFred("series/search", { search_text: q, limit: String(params.limit || "25") });
        return {
          data: (data.seriess || []).map((s: any) => ({
            seriesId: s.id, title: s.title, frequency: s.frequency,
            units: s.units, popularity: s.popularity, lastUpdated: s.last_updated,
          })),
          source: "FRED", adapterId: "fred",
        };
      }
      default:
        throw new Error(`FRED adapter: unsupported action '${action}'`);
    }
  },
};
