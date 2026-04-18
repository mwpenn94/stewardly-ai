/**
 * BEA Adapter — Bureau of Economic Analysis
 *
 * Pass 121: GDP, personal income, regional data.
 * Uses BEA_API_KEY if available, falls back to keyless endpoints.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult } from "../types";

const BASE_URL = "https://apps.bea.gov/api/data";

function getApiKey(): string | undefined {
  return process.env.BEA_API_KEY || undefined;
}

async function fetchBea(params: Record<string, string>): Promise<any> {
  const key = getApiKey();
  const url = new URL(BASE_URL);
  if (key) url.searchParams.set("UserID", key);
  url.searchParams.set("ResultFormat", "JSON");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`BEA API error: ${res.status}`);
  return res.json();
}

export const beaAdapter: FinancialDataAdapter = {
  id: "bea",
  name: "BEA (Bureau of Economic Analysis)",
  description: "GDP, personal income, and regional economic data",
  tier: "free_keyless",
  requiresKey: false,
  supportedActions: ["gdp", "personal_income", "regional", "datasets"],

  async healthCheck(): Promise<AdapterHealth> {
    const key = getApiKey();
    if (!key) {
      return {
        adapterId: "bea", name: "BEA", status: "not_configured",
        lastChecked: Date.now(), tier: "free_keyless", requiresKey: false, keyConfigured: false,
        message: "BEA_API_KEY not set. Free signup at apps.bea.gov/API/signup",
      };
    }
    try {
      const start = Date.now();
      await fetchBea({ method: "GetDataSetList" });
      return {
        adapterId: "bea", name: "BEA", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "free_keyless", requiresKey: false, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "bea", name: "BEA", status: "degraded",
        lastChecked: Date.now(), tier: "free_keyless", requiresKey: false, keyConfigured: !!key,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "gdp": {
        const year = String(params.year || "LAST5");
        const data = await fetchBea({
          method: "GetData", DataSetName: "NIPA",
          TableName: "T10101", Frequency: "Q", Year: year,
        });
        const results = data?.BEAAPI?.Results?.Data || [];
        return {
          data: results.map((r: any) => ({
            period: r.TimePeriod, lineDescription: r.LineDescription,
            value: parseFloat(r.DataValue?.replace(/,/g, "") || "0"),
            noteRef: r.NoteRef,
          })),
          source: "BEA", adapterId: "bea",
        };
      }
      case "personal_income": {
        const year = String(params.year || "LAST5");
        const state = String(params.state || "US");
        const data = await fetchBea({
          method: "GetData", DataSetName: "Regional",
          TableName: "CAINC1", LineCode: "1", GeoFips: state, Year: year,
        });
        return { data: data?.BEAAPI?.Results?.Data || [], source: "BEA", adapterId: "bea" };
      }
      case "datasets": {
        const data = await fetchBea({ method: "GetDataSetList" });
        return { data: data?.BEAAPI?.Results?.Dataset || [], source: "BEA", adapterId: "bea" };
      }
      default:
        throw new Error(`BEA adapter: unsupported action '${action}'`);
    }
  },
};
