/**
 * Financial Data Adapter Registry
 *
 * Pass 121: Central registry for all financial data adapters.
 * Adapters are lazily loaded to avoid importing unused dependencies.
 * The registry provides health checks, adapter discovery, and
 * unified query routing.
 */

import type { FinancialDataAdapter, AdapterHealth, AdapterQueryResult } from "./types";
import { getDb } from "../../db";
import { dataAccessAudit } from "../../../drizzle/schema";
import { getCached, setCached, invalidateAdapter, invalidateAll, getCacheStats } from "./responseCache";
import { checkRateLimit, recordApiCall, getAllUsageStats } from "./apiRateLimiter";

// ─── ADAPTER MANIFEST ─────────────────────────────────────────────

interface AdapterManifest {
  id: string;
  name: string;
  loader: () => Promise<FinancialDataAdapter>;
}

const ADAPTER_MANIFEST: AdapterManifest[] = [
  // Free keyless adapters
  { id: "edgar", name: "SEC EDGAR", loader: async () => (await import("./adapters/edgarAdapter")).edgarAdapter },
  { id: "treasury", name: "US Treasury", loader: async () => (await import("./adapters/treasuryAdapter")).treasuryAdapter },
  { id: "bea", name: "BEA", loader: async () => (await import("./adapters/beaAdapter")).beaAdapter },
  { id: "bls", name: "BLS", loader: async () => (await import("./adapters/blsAdapter")).blsAdapter },
  { id: "openfigi", name: "OpenFIGI", loader: async () => (await import("./adapters/openFigiAdapter")).openFigiAdapter },
  { id: "gleif", name: "GLEIF", loader: async () => (await import("./adapters/gleifAdapter")).gleifAdapter },
  // Free with key
  { id: "fred", name: "FRED", loader: async () => (await import("./adapters/fredAdapter")).fredAdapter },
  // Freemium
  { id: "fmp", name: "FMP", loader: async () => (await import("./adapters/fmpAdapter")).fmpAdapter },
  { id: "polygon", name: "Polygon", loader: async () => (await import("./adapters/polygonAdapter")).polygonAdapter },
  { id: "tiingo", name: "Tiingo", loader: async () => (await import("./adapters/tiingoAdapter")).tiingoAdapter },
  // Paid (stub)
  { id: "plaid", name: "Plaid", loader: async () => (await import("./adapters/plaidAdapter")).plaidAdapter },
];

// ─── ADAPTER CACHE ────────────────────────────────────────────────

const adapterCache = new Map<string, FinancialDataAdapter>();

async function getAdapter(id: string): Promise<FinancialDataAdapter | null> {
  if (adapterCache.has(id)) return adapterCache.get(id)!;
  const manifest = ADAPTER_MANIFEST.find(m => m.id === id);
  if (!manifest) return null;
  try {
    const adapter = await manifest.loader();
    adapterCache.set(id, adapter);
    return adapter;
  } catch (err) {
    console.error(`[FinancialData] Failed to load adapter ${id}:`, err);
    return null;
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────

/** List all registered adapter IDs and names */
export function listAdapters(): Array<{ id: string; name: string }> {
  return ADAPTER_MANIFEST.map(m => ({ id: m.id, name: m.name }));
}

/** Get health status for all adapters */
export async function getAllAdapterHealth(): Promise<AdapterHealth[]> {
  const results: AdapterHealth[] = [];
  for (const manifest of ADAPTER_MANIFEST) {
    try {
      const adapter = await getAdapter(manifest.id);
      if (adapter) {
        results.push(await adapter.healthCheck());
      } else {
        results.push({
          adapterId: manifest.id,
          name: manifest.name,
          status: "unavailable",
          lastChecked: Date.now(),
          message: "Failed to load adapter",
          tier: "free_keyless",
          requiresKey: false,
          keyConfigured: false,
        });
      }
    } catch (err) {
      results.push({
        adapterId: manifest.id,
        name: manifest.name,
        status: "unavailable",
        lastChecked: Date.now(),
        message: err instanceof Error ? err.message : "Unknown error",
        tier: "free_keyless",
        requiresKey: false,
        keyConfigured: false,
      });
    }
  }
  return results;
}

/** Get health for a single adapter */
export async function getAdapterHealth(adapterId: string): Promise<AdapterHealth | null> {
  const adapter = await getAdapter(adapterId);
  if (!adapter) return null;
  return adapter.healthCheck();
}

/** Query a specific adapter with audit trail and response caching */
export async function queryAdapter(
  adapterId: string,
  action: string,
  params: Record<string, unknown>,
  userId: number,
  clientId?: number,
): Promise<AdapterQueryResult> {
  const adapter = await getAdapter(adapterId);
  if (!adapter) {
    throw new Error(`Adapter '${adapterId}' not found`);
  }

  // Check response cache first
  const cachedResult = getCached(adapterId, action, params);
  if (cachedResult) {
    await writeAuditEntry(adapterId, action, userId, clientId, params, "success", 0);
    return cachedResult;
  }

  // Check rate limits before making the API call
  const rateLimitCheck = checkRateLimit(adapterId);
  if (!rateLimitCheck.allowed) {
    await writeAuditEntry(adapterId, action, userId, clientId, params, "rate_limited", 0);
    throw new Error(`Rate limit exceeded for ${adapterId}: ${rateLimitCheck.reason}. Retry after ${Math.ceil((rateLimitCheck.retryAfterMs || 60000) / 1000)}s`);
  }

  const start = Date.now();
  let result: AdapterQueryResult;
  let status: "success" | "error" = "success";

  try {
    result = await adapter.query(action, params);
    recordApiCall(adapterId);
  } catch (err) {
    status = "error";
    await writeAuditEntry(adapterId, action, userId, clientId, params, status, Date.now() - start);
    throw err;
  }

  // Cache the successful response
  setCached(adapterId, action, params, result);

  // Write audit entry on success
  await writeAuditEntry(adapterId, action, userId, clientId, params, status, Date.now() - start);
  return result;
}

/** Write an audit trail entry for every external data call */
async function writeAuditEntry(
  adapterId: string,
  action: string,
  userId: number,
  clientId: number | undefined,
  requestParams: Record<string, unknown>,
  responseStatus: "success" | "error" | "rate_limited",
  latencyMs: number,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(dataAccessAudit).values({
      adapterId,
      action,
      userId,
      clientId: clientId ?? null,
      requestParams: JSON.stringify(requestParams),
      responseStatus,
      latencyMs,
      timestamp: Date.now(),
    });
  } catch (err) {
    // Don't fail the main request if audit write fails
    console.error("[FinancialData] Audit write failed:", err);
  }
}

/** Get supported actions for an adapter */
export async function getAdapterActions(adapterId: string): Promise<string[]> {
  const adapter = await getAdapter(adapterId);
  if (!adapter) return [];
  return adapter.supportedActions;
}

/** Get the adapter registry facade (used by tRPC router) */
export function getAdapterRegistry() {
  return {
    getAdapter,
    listAdapters: () => ADAPTER_MANIFEST.map(m => {
      const cached = adapterCache.get(m.id);
      return {
        id: m.id,
        name: m.name,
        description: cached?.description || "",
        tier: cached?.tier || "free_keyless" as const,
        requiresKey: cached?.requiresKey || false,
        supportedActions: cached?.supportedActions || [],
      };
    }),
    healthCheckAll: getAllAdapterHealth,
  };
}

/** Quick query: get a stock quote from the best available adapter */
export async function getQuote(symbol: string, userId: number): Promise<AdapterQueryResult | null> {
  // Try adapters in priority order: FMP → Polygon → Tiingo
  for (const id of ["fmp", "polygon", "tiingo"]) {
    try {
      const adapter = await getAdapter(id);
      if (!adapter) continue;
      const health = await adapter.healthCheck();
      if (health.status === "not_configured" || health.status === "unavailable") continue;
      return await queryAdapter(id, "quote", { symbol }, userId);
    } catch {
      continue;
    }
  }
  return null;
}

/** Quick query: get a FRED economic series */
export async function getFredSeries(seriesId: string, userId: number): Promise<AdapterQueryResult | null> {
  try {
    return await queryAdapter("fred", "series", { seriesId }, userId);
  } catch {
    return null;
  }
}

// ─── CACHE MANAGEMENT (exported for tRPC router) ──────────────────
export { invalidateAdapter, invalidateAll, getCacheStats };
