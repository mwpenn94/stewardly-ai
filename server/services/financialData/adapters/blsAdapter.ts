/**
 * BLS Adapter — Bureau of Labor Statistics
 *
 * Pass 121: CPI, unemployment, employment data.
 * Uses BLS_API_KEY for higher rate limits if available.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult } from "../types";

const BASE_URL = "https://api.bls.gov/publicAPI/v2";

function getApiKey(): string | undefined {
  return process.env.BLS_API_KEY || undefined;
}

async function fetchBls(endpoint: string, body?: Record<string, unknown>): Promise<any> {
  const key = getApiKey();
  const url = `${BASE_URL}/${endpoint}`;
  if (body) {
    if (key) body.registrationkey = key;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`BLS API error: ${res.status}`);
    return res.json();
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BLS API error: ${res.status}`);
  return res.json();
}

export const blsAdapter: FinancialDataAdapter = {
  id: "bls",
  name: "BLS (Bureau of Labor Statistics)",
  description: "CPI, unemployment, employment, and wage data",
  tier: "free_keyless",
  requiresKey: false,
  supportedActions: ["series", "cpi", "unemployment", "search"],

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const start = Date.now();
      // CPI-U series as health check
      await fetchBls("timeseries/data/", {
        seriesid: ["CUUR0000SA0"],
        startyear: String(new Date().getFullYear() - 1),
        endyear: String(new Date().getFullYear()),
      });
      return {
        adapterId: "bls", name: "BLS", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "free_keyless", requiresKey: false, keyConfigured: !!getApiKey(),
      };
    } catch (err) {
      return {
        adapterId: "bls", name: "BLS", status: "degraded",
        lastChecked: Date.now(), tier: "free_keyless", requiresKey: false, keyConfigured: !!getApiKey(),
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    const currentYear = new Date().getFullYear();
    switch (action) {
      case "series": {
        const seriesIds = Array.isArray(params.seriesIds) ? params.seriesIds.map(String) : [String(params.seriesId || "CUUR0000SA0")];
        const startYear = String(params.startYear || currentYear - 5);
        const endYear = String(params.endYear || currentYear);
        const data = await fetchBls("timeseries/data/", {
          seriesid: seriesIds, startyear: startYear, endyear: endYear,
        });
        return {
          data: (data.Results?.series || []).map((s: any) => ({
            seriesId: s.seriesID,
            data: (s.data || []).map((d: any) => ({
              year: d.year, period: d.period, periodName: d.periodName,
              value: parseFloat(d.value), footnotes: d.footnotes,
            })),
          })),
          source: "BLS", adapterId: "bls",
        };
      }
      case "cpi": {
        const years = Number(params.years) || 5;
        const data = await fetchBls("timeseries/data/", {
          seriesid: ["CUUR0000SA0"],
          startyear: String(currentYear - years),
          endyear: String(currentYear),
        });
        const series = data.Results?.series?.[0]?.data || [];
        return {
          data: series.map((d: any) => ({
            year: d.year, period: d.period, periodName: d.periodName,
            value: parseFloat(d.value),
          })),
          source: "BLS", adapterId: "bls",
        };
      }
      case "unemployment": {
        const data = await fetchBls("timeseries/data/", {
          seriesid: ["LNS14000000"],
          startyear: String(currentYear - 3),
          endyear: String(currentYear),
        });
        const series = data.Results?.series?.[0]?.data || [];
        return {
          data: series.map((d: any) => ({
            year: d.year, period: d.period, periodName: d.periodName,
            rate: parseFloat(d.value),
          })),
          source: "BLS", adapterId: "bls",
        };
      }
      default:
        throw new Error(`BLS adapter: unsupported action '${action}'`);
    }
  },
};
