/**
 * SEC EDGAR Adapter — Truly Keyless
 *
 * Pass 121: Full-text search via efts.sec.gov (no API key needed).
 * Company filings, CIK lookup, and filing search.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult, EdgarFiling, EdgarCompanyInfo } from "../types";

const EFTS_BASE = "https://efts.sec.gov/LATEST";
const EDGAR_BASE = "https://data.sec.gov";
const USER_AGENT = "WealthBridge-AI/1.0 (support@wealthbridge.ai)";

async function fetchEdgar(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`EDGAR API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export const edgarAdapter: FinancialDataAdapter = {
  id: "edgar",
  name: "SEC EDGAR",
  description: "SEC filings, company data, and full-text search (keyless)",
  tier: "free_keyless",
  requiresKey: false,
  supportedActions: ["search", "company", "filings", "cik_lookup"],

  async healthCheck(): Promise<AdapterHealth> {
    try {
      const start = Date.now();
      await fetchEdgar(`${EFTS_BASE}/search-index?q=%22test%22&dateRange=custom&startdt=2024-01-01&enddt=2024-01-02&forms=10-K`);
      return {
        adapterId: "edgar", name: "SEC EDGAR", status: "healthy",
        lastChecked: Date.now(), latencyMs: Date.now() - start,
        tier: "free_keyless", requiresKey: false, keyConfigured: true,
      };
    } catch (err) {
      return {
        adapterId: "edgar", name: "SEC EDGAR", status: "degraded",
        lastChecked: Date.now(), tier: "free_keyless", requiresKey: false, keyConfigured: true,
        message: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async query(action: string, params: Record<string, unknown>): Promise<AdapterQueryResult> {
    switch (action) {
      case "search": {
        const q = String(params.query || params.q || "");
        const forms = params.forms ? String(params.forms) : undefined;
        const limit = Number(params.limit) || 20;
        let url = `${EFTS_BASE}/search-index?q=${encodeURIComponent(q)}&from=0&size=${limit}`;
        if (forms) url += `&forms=${encodeURIComponent(forms)}`;
        const data = await fetchEdgar(url);
        const filings: EdgarFiling[] = (data.hits?.hits || []).map((h: any) => ({
          accessionNumber: h._source?.file_num || h._id,
          filingDate: h._source?.file_date || "",
          form: h._source?.form_type || "",
          companyName: h._source?.display_names?.[0] || h._source?.entity_name || "",
          cik: h._source?.entity_id || "",
          fileUrl: h._source?.file_url ? `https://www.sec.gov${h._source.file_url}` : "",
          description: h._source?.display_description || "",
        }));
        return { data: filings, source: "SEC EDGAR", adapterId: "edgar" };
      }
      case "company": {
        const cik = String(params.cik || "").padStart(10, "0");
        const data = await fetchEdgar(`${EDGAR_BASE}/submissions/CIK${cik}.json`);
        const info: EdgarCompanyInfo = {
          cik: data.cik || cik,
          name: data.name || "",
          ticker: data.tickers?.[0] || undefined,
          sic: data.sic || undefined,
          sicDescription: data.sicDescription || undefined,
          stateOfIncorporation: data.stateOfIncorporation || undefined,
          filings: (data.filings?.recent?.accessionNumber || []).slice(0, 20).map((acc: string, i: number) => ({
            accessionNumber: acc,
            filingDate: data.filings.recent.filingDate?.[i] || "",
            form: data.filings.recent.form?.[i] || "",
            companyName: data.name || "",
            cik: data.cik || cik,
            fileUrl: `https://www.sec.gov/Archives/edgar/data/${data.cik}/${acc.replace(/-/g, "")}/${data.filings.recent.primaryDocument?.[i] || ""}`,
          })),
        };
        return { data: info, source: "SEC EDGAR", adapterId: "edgar" };
      }
      case "cik_lookup": {
        const ticker = String(params.ticker || "").toUpperCase();
        const data = await fetchEdgar(`${EDGAR_BASE}/submissions/CIK${ticker}.json`).catch(() => null);
        if (data) {
          return { data: { cik: data.cik, name: data.name, ticker }, source: "SEC EDGAR", adapterId: "edgar" };
        }
        // Fallback: search by company ticker
        const searchData = await fetchEdgar(`${EFTS_BASE}/search-index?q=${encodeURIComponent(ticker)}&forms=10-K&size=1`);
        const hit = searchData.hits?.hits?.[0];
        return {
          data: hit ? { cik: hit._source?.entity_id, name: hit._source?.entity_name, ticker } : null,
          source: "SEC EDGAR", adapterId: "edgar",
        };
      }
      default:
        throw new Error(`EDGAR adapter: unsupported action '${action}'`);
    }
  },
};
