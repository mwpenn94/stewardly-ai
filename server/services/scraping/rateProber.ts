/**
 * Rate Prober — Probe provider endpoints for current rate data
 */
import { logger } from "../../_core/logger";
import { isAllowed } from "./robotsChecker";
import { checkTos } from "./tosChecker";

const log = logger.child({ module: "rateProber" });

export interface ProbeTarget {
  provider: string;
  url: string;
  selector?: string; // CSS selector for HTML extraction
  jsonPath?: string; // JSON path for API responses
  rateType: "fixed" | "variable" | "index" | "cap" | "spread";
}

export interface ProbeResult {
  provider: string;
  url: string;
  success: boolean;
  rawValue: string | null;
  responseTime: number;
  statusCode: number | null;
  error: string | null;
  probedAt: number;
}

export async function probe(target: ProbeTarget): Promise<ProbeResult> {
  const start = Date.now();

  // Pre-flight checks
  const tosResult = await checkTos(new URL(target.url).hostname);
  if (!tosResult.allowed) {
    return { provider: target.provider, url: target.url, success: false, rawValue: null, responseTime: Date.now() - start, statusCode: null, error: `ToS blocked: ${tosResult.reason}`, probedAt: Date.now() };
  }

  const robotsOk = await isAllowed(target.url, "StewardlyBot/1.0");
  if (!robotsOk) {
    return { provider: target.provider, url: target.url, success: false, rawValue: null, responseTime: Date.now() - start, statusCode: null, error: "Blocked by robots.txt", probedAt: Date.now() };
  }

  try {
    const res = await fetch(target.url, {
      headers: { "User-Agent": "StewardlyBot/1.0 (+https://stewardly.manus.space/bot)" },
      signal: AbortSignal.timeout(15000),
    });

    const responseTime = Date.now() - start;

    if (!res.ok) {
      return { provider: target.provider, url: target.url, success: false, rawValue: null, responseTime, statusCode: res.status, error: `HTTP ${res.status}`, probedAt: Date.now() };
    }

    const contentType = res.headers.get("content-type") || "";
    let rawValue: string | null = null;

    if (contentType.includes("json") && target.jsonPath) {
      const json = await res.json();
      rawValue = extractJsonPath(json, target.jsonPath);
    } else {
      const text = await res.text();
      rawValue = text.slice(0, 5000); // Limit raw capture
    }

    log.info({ provider: target.provider, responseTime }, "Rate probe successful");
    return { provider: target.provider, url: target.url, success: true, rawValue, responseTime, statusCode: res.status, error: null, probedAt: Date.now() };
  } catch (e: any) {
    return { provider: target.provider, url: target.url, success: false, rawValue: null, responseTime: Date.now() - start, statusCode: null, error: e.message, probedAt: Date.now() };
  }
}

export async function batchProbe(targets: ProbeTarget[], concurrency = 3): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(probe));
    for (const r of batchResults) {
      results.push(r.status === "fulfilled" ? r.value : { provider: "unknown", url: "", success: false, rawValue: null, responseTime: 0, statusCode: null, error: "Promise rejected", probedAt: Date.now() });
    }
  }
  return results;
}

function extractJsonPath(obj: unknown, path: string): string | null {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current != null ? String(current) : null;
}
