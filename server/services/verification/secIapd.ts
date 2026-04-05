/**
 * SEC IAPD Verification — Investment Adviser Public Disclosure lookup
 * Uses SEC EDGAR API (public, rate-limited 10 req/s)
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "secIapd" });

export interface IapdResult {
  found: boolean;
  crdNumber?: string;
  firmName?: string;
  registrationStatus?: string;
  disclosures?: number;
  lastUpdated?: string;
  error?: string;
}

const SEC_IAPD_BASE = "https://efts.sec.gov/LATEST";
const RATE_LIMIT_MS = 100; // 10 req/s
let lastRequestTime = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();
  return fetch(url, { headers: { "User-Agent": "Stewardly/1.0 (compliance@stewardly.com)" } });
}

export async function lookupByName(name: string): Promise<IapdResult> {
  try {
    const url = `${SEC_IAPD_BASE}/search-index?q=${encodeURIComponent(name)}&dateRange=custom&startdt=2020-01-01&forms=ADV`;
    const res = await rateLimitedFetch(url);

    if (!res.ok) {
      log.warn({ status: res.status }, "SEC IAPD lookup failed");
      return { found: false, error: `SEC API returned ${res.status}` };
    }

    const data = await res.json() as any;
    if (data?.hits?.hits?.length > 0) {
      const hit = data.hits.hits[0]._source || {};
      return {
        found: true,
        firmName: hit.display_names?.[0] || name,
        registrationStatus: "registered",
        lastUpdated: hit.file_date,
      };
    }

    return { found: false };
  } catch (e: any) {
    log.error({ error: e.message }, "SEC IAPD lookup error");
    return { found: false, error: e.message };
  }
}

export async function lookupByCrd(crdNumber: string): Promise<IapdResult> {
  try {
    const url = `${SEC_IAPD_BASE}/search-index?q=%22${encodeURIComponent(crdNumber)}%22&forms=ADV`;
    const res = await rateLimitedFetch(url);

    if (!res.ok) return { found: false, error: `SEC API returned ${res.status}` };

    const data = await res.json() as any;
    if (data?.hits?.hits?.length > 0) {
      return { found: true, crdNumber, registrationStatus: "registered" };
    }

    return { found: false, crdNumber };
  } catch (e: any) {
    log.error({ error: e.message }, "SEC IAPD CRD lookup error");
    return { found: false, crdNumber, error: e.message };
  }
}
