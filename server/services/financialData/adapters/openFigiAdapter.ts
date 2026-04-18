/**
 * OpenFIGI Adapter — Keyless
 *
 * Pass 121: Financial instrument identifier mapping.
 * Maps tickers, ISINs, CUSIPs to FIGI identifiers.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, FigiResult } from "../types";

const BASE_URL = "https://api.openfigi.com/v3";

async function fetchFigi(endpoint: string, body: unknown): Promise<any> {
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`OpenFIGI API error: ${res.status}`);
  return res.json();
}

export const openFigiAdapter: FinancialDataAdapter = {
  id: "openfigi",
  name: "OpenFIGI",
  description: "Financial instrument identifier mapping (FIGI, ISIN, CUSIP)",
  tier: "free_keyless",
  requiresKey: false,
  supportedActions: ["map", "search"],

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const start = Date.now();
      await fetchFigi("mapping", [{ idType: "TICKER", idValue: "AAPL" }]);
      return {
        adapterId: "openfigi", name: "OpenFIGI", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "free_keyless", requiresKey: false, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "openfigi", name: "OpenFIGI", status: "degraded",
        lastChecked: Date.now(), tier: "free_keyless", requiresKey: false, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "map": {
        const idType = String(params.idType || "TICKER");
        const idValue = String(params.idValue || "");
        const exchCode = params.exchCode ? String(params.exchCode) : undefined;
        const body: any[] = [{ idType, idValue }];
        if (exchCode) body[0].exchCode = exchCode;
        const data = await fetchFigi("mapping", body);
        const results: FigiResult[] = (data[0]?.data || []).map((d: any) => ({
          figi: d.figi,
          name: d.name,
          ticker: d.ticker,
          exchCode: d.exchCode,
          compositeFIGI: d.compositeFIGI,
          securityType: d.securityType,
          marketSector: d.marketSector,
        }));
        return { data: results, source: "OpenFIGI", adapterId: "openfigi" };
      }
      case "search": {
        const query = String(params.query || "");
        const data = await fetchFigi("search", { query });
        return {
          data: (data.data || []).map((d: any) => ({
            figi: d.figi, name: d.name, ticker: d.ticker,
            exchCode: d.exchCode, securityType: d.securityType,
          })),
          source: "OpenFIGI", adapterId: "openfigi",
        };
      }
      default:
        throw new Error(`OpenFIGI adapter: unsupported action '${action}'`);
    }
  },
};
