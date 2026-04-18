/**
 * US Treasury Adapter — Keyless
 *
 * Pass 121: Treasury yield curve data from api.fiscaldata.treasury.gov.
 * No API key required.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, TreasuryYield } from "../types";

const BASE_URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";

async function fetchTreasury(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Treasury API error: ${res.status}`);
  return res.json();
}

export const treasuryAdapter: FinancialDataAdapter = {
  id: "treasury",
  name: "US Treasury",
  description: "Treasury yield curves, debt data, and fiscal information (keyless)",
  tier: "free_keyless",
  requiresKey: false,
  supportedActions: ["yields", "debt", "rates"],

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const start = Date.now();
      await fetchTreasury("v2/accounting/od/avg_interest_rates", {
        "page[size]": "1", sort: "-record_date",
      });
      return {
        adapterId: "treasury", name: "US Treasury", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "free_keyless", requiresKey: false, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "treasury", name: "US Treasury", status: "degraded",
        lastChecked: Date.now(), tier: "free_keyless", requiresKey: false, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "yields": {
        const limit = String(params.limit || "30");
        const data = await fetchTreasury("v2/accounting/od/avg_interest_rates", {
          "page[size]": limit,
          sort: "-record_date",
          "fields": "record_date,security_desc,avg_interest_rate_amt",
        });
        // Group by date
        const byDate = new Map<string, TreasuryYield>();
        for (const row of data.data || []) {
          const date = row.record_date;
          if (!byDate.has(date)) byDate.set(date, { date });
          const y = byDate.get(date)!;
          const desc = (row.security_desc || "").toLowerCase();
          const rate = parseFloat(row.avg_interest_rate_amt);
          if (desc.includes("1-year")) y["1yr"] = rate;
          else if (desc.includes("2-year")) y["2yr"] = rate;
          else if (desc.includes("3-year")) y["3yr"] = rate;
          else if (desc.includes("5-year")) y["5yr"] = rate;
          else if (desc.includes("7-year")) y["7yr"] = rate;
          else if (desc.includes("10-year")) y["10yr"] = rate;
          else if (desc.includes("20-year")) y["20yr"] = rate;
          else if (desc.includes("30-year")) y["30yr"] = rate;
        }
        return { data: Array.from(byDate.values()), source: "US Treasury", adapterId: "treasury" };
      }
      case "debt": {
        const data = await fetchTreasury("v2/accounting/od/debt_to_penny", {
          "page[size]": String(params.limit || "30"),
          sort: "-record_date",
        });
        return {
          data: (data.data || []).map((r: any) => ({
            date: r.record_date,
            totalDebt: parseFloat(r.tot_pub_debt_out_amt || "0"),
            debtHeldByPublic: parseFloat(r.debt_held_public_amt || "0"),
            intragovernmental: parseFloat(r.intragov_hold_amt || "0"),
          })),
          source: "US Treasury", adapterId: "treasury",
        };
      }
      case "rates": {
        const data = await fetchTreasury("v2/accounting/od/avg_interest_rates", {
          "page[size]": String(params.limit || "50"),
          sort: "-record_date",
        });
        return { data: data.data || [], source: "US Treasury", adapterId: "treasury" };
      }
      default:
        throw new Error(`Treasury adapter: unsupported action '${action}'`);
    }
  },
};
