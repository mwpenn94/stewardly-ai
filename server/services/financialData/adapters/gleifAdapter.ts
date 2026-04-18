/**
 * GLEIF Adapter — Global Legal Entity Identifier Foundation (Keyless)
 *
 * Pass 121: LEI lookup, entity search, relationship data.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, LeiResult } from "../types";

const BASE_URL = "https://api.gleif.org/api/v1";

async function fetchGleif(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/vnd.api+json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GLEIF API error: ${res.status}`);
  return res.json();
}

export const gleifAdapter: FinancialDataAdapter = {
  id: "gleif",
  name: "GLEIF",
  description: "Legal Entity Identifier (LEI) lookup and entity search",
  tier: "free_keyless",
  requiresKey: false,
  supportedActions: ["lookup", "search"],

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const start = Date.now();
      await fetchGleif("lei-records", { "page[size]": "1" });
      return {
        adapterId: "gleif", name: "GLEIF", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "free_keyless", requiresKey: false, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "gleif", name: "GLEIF", status: "degraded",
        lastChecked: Date.now(), tier: "free_keyless", requiresKey: false, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "lookup": {
        const lei = String(params.lei || "");
        const data = await fetchGleif(`lei-records/${lei}`);
        const attr = data.data?.attributes;
        const entity = attr?.entity;
        const result: LeiResult = {
          lei: data.data?.id || lei,
          legalName: entity?.legalName?.name || "",
          jurisdiction: entity?.jurisdiction || "",
          status: attr?.registration?.status || "",
          registrationDate: attr?.registration?.initialRegistrationDate || "",
          lastUpdate: attr?.registration?.lastUpdateDate || "",
          headquarters: entity?.headquartersAddress ? {
            city: entity.headquartersAddress.city || "",
            country: entity.headquartersAddress.country || "",
            postalCode: entity.headquartersAddress.postalCode || "",
          } : undefined,
        };
        return { data: result, source: "GLEIF", adapterId: "gleif" };
      }
      case "search": {
        const q = String(params.query || params.q || "");
        const limit = String(params.limit || "10");
        const data = await fetchGleif("lei-records", {
          "filter[entity.legalName]": q,
          "page[size]": limit,
        });
        const results: LeiResult[] = (data.data || []).map((d: any) => {
          const entity = d.attributes?.entity;
          return {
            lei: d.id,
            legalName: entity?.legalName?.name || "",
            jurisdiction: entity?.jurisdiction || "",
            status: d.attributes?.registration?.status || "",
            registrationDate: d.attributes?.registration?.initialRegistrationDate || "",
            lastUpdate: d.attributes?.registration?.lastUpdateDate || "",
          };
        });
        return { data: results, source: "GLEIF", adapterId: "gleif" };
      }
      default:
        throw new Error(`GLEIF adapter: unsupported action '${action}'`);
    }
  },
};
