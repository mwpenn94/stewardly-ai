/**
 * Integration Health Service
 * 
 * Provides:
 * 1. Health check runner — tests each connection's connectivity, auth, and data freshness
 * 2. Health summary aggregation — computes uptime, avg latency, consecutive failures
 * 3. Improvement agent — detects degradation, logs actions, suggests fixes
 * 4. AI context assembly — builds a prompt fragment describing live data source status
 */

import { getDb } from "../db";
import {
  integrationConnections,
  integrationProviders,
  integrationHealthChecks,
  integrationHealthSummary,
  integrationImprovementLog,
} from "../../drizzle/schema";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { decryptCredentials } from "./encryption";
import { notifyOwner } from "../_core/notification";
import { safeDbOperation, firstOrNull, withRetry } from "./dbResilience";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

// ─── Provider Test Configurations ─────────────────────────────────────────
interface ProviderTestConfig {
  buildTestRequest: (apiKey: string) => { url: string; opts: RequestInit };
  validateResponse: (text: string, status: number) => { healthy: boolean; message: string };
  dataDescription: string;
}

const PROVIDER_TEST_CONFIGS: Record<string, ProviderTestConfig> = {
  "census-bureau": {
    buildTestRequest: (apiKey) => ({
      url: `https://api.census.gov/data/2021/acs/acs5?get=NAME&for=state:01&key=${apiKey}`,
      opts: { signal: AbortSignal.timeout(15000) },
    }),
    validateResponse: (text, status) => {
      if (status !== 200) return { healthy: false, message: `HTTP ${status}` };
      const hasError = text.toLowerCase().includes('"error"') && text.toLowerCase().includes('invalid');
      return { healthy: !hasError, message: hasError ? "Invalid API key" : "Census API responding" };
    },
    dataDescription: "U.S. demographic data (population, housing, economic characteristics)",
  },
  "bls": {
    buildTestRequest: (apiKey) => ({
      url: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      opts: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesid: ["CUUR0000SA0"], startyear: "2024", endyear: "2024", registrationkey: apiKey }),
        signal: AbortSignal.timeout(15000),
      },
    }),
    validateResponse: (text, status) => {
      if (status !== 200) return { healthy: false, message: `HTTP ${status}` };
      try {
        const data = JSON.parse(text);
        if (data.status === "REQUEST_SUCCEEDED") return { healthy: true, message: "BLS API responding — CPI data available" };
        return { healthy: false, message: data.message?.[0] || "BLS returned non-success status" };
      } catch {
        return { healthy: false, message: "Invalid BLS response format" };
      }
    },
    dataDescription: "Labor statistics (CPI, unemployment, wages, employment data)",
  },
  "fred": {
    buildTestRequest: (apiKey) => ({
      url: `https://api.stlouisfed.org/fred/series?series_id=GDP&api_key=${apiKey}&file_type=json`,
      opts: { signal: AbortSignal.timeout(15000) },
    }),
    validateResponse: (text, status) => {
      if (status !== 200) return { healthy: false, message: `HTTP ${status}` };
      const hasError = text.toLowerCase().includes('"error"') && text.toLowerCase().includes('invalid');
      return { healthy: !hasError, message: hasError ? "Invalid API key" : "FRED API responding — GDP data available" };
    },
    dataDescription: "Federal Reserve economic data (GDP, interest rates, monetary indicators)",
  },
  "bea": {
    buildTestRequest: (apiKey) => ({
      url: `https://apps.bea.gov/api/data?&UserID=${apiKey}&method=GETDATASETLIST&ResultFormat=JSON`,
      opts: { signal: AbortSignal.timeout(15000) },
    }),
    validateResponse: (text, status) => {
      if (status !== 200) return { healthy: false, message: `HTTP ${status}` };
      const hasError = text.toLowerCase().includes('"error"') && text.toLowerCase().includes('invalid');
      return { healthy: !hasError, message: hasError ? "Invalid API key" : "BEA API responding — economic analysis data available" };
    },
    dataDescription: "Bureau of Economic Analysis data (GDP components, trade, industry accounts)",
  },
  "sec-edgar": {
    buildTestRequest: () => ({
      url: "https://efts.sec.gov/LATEST/search-index?q=test&dateRange=custom&startdt=2024-01-01&enddt=2024-01-02",
      opts: { signal: AbortSignal.timeout(15000) },
    }),
    validateResponse: (_text, status) => ({
      healthy: status === 200,
      message: status === 200 ? "SEC EDGAR responding — filing search available" : `HTTP ${status}`,
    }),
    dataDescription: "SEC filings, company disclosures, and regulatory documents",
  },
  "finra-brokercheck": {
    buildTestRequest: () => ({
      url: "https://api.brokercheck.finra.org/search/individual?query=test&start=0&rows=1",
      opts: { signal: AbortSignal.timeout(15000) },
    }),
    validateResponse: (_text, status) => ({
      healthy: status === 200,
      message: status === 200 ? "FINRA BrokerCheck responding" : `HTTP ${status}`,
    }),
    dataDescription: "Broker/advisor background checks and disciplinary history",
  },
};

// ─── Health Check Runner ──────────────────────────────────────────────────

export interface HealthCheckResult {
  connectionId: string;
  providerSlug: string;
  providerName: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latencyMs: number;
  message: string;
  responseCode?: number;
}

/**
 * Run a health check on a single connection.
 */
export async function runHealthCheck(connectionId: string): Promise<HealthCheckResult> {
  const unknownResult = (msg: string): HealthCheckResult => ({ connectionId, providerSlug: "", providerName: "", status: "unknown", latencyMs: 0, message: msg });

  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch (e: any) {
    return unknownResult(`Database error: ${e.message}`);
  }
  if (!db) return unknownResult("Database unavailable");

  let conn: any;
  let provider: any;
  try {
    const conns = await db.select().from(integrationConnections).where(eq(integrationConnections.id, connectionId));
    conn = firstOrNull(conns);
    if (!conn) return unknownResult("Connection not found");

    const providers = await db.select().from(integrationProviders).where(eq(integrationProviders.id, conn.providerId));
    provider = firstOrNull(providers);
    if (!provider) return unknownResult("Provider not found");
  } catch (e: any) {
    console.warn(`[HealthCheck] DB query failed for connection ${connectionId}:`, e.message);
    return unknownResult(`Database query failed: ${e.message}`);
  }

  const config = PROVIDER_TEST_CONFIGS[provider.slug];
  if (!config) {
    // No test config — mark as unknown but not unhealthy
    return { connectionId, providerSlug: provider.slug, providerName: provider.name, status: "unknown", latencyMs: 0, message: "No health check configured for this provider" };
  }

  let apiKey = "";
  if (conn.credentialsEncrypted) {
    try {
      const creds = decryptCredentials(conn.credentialsEncrypted);
      apiKey = (creds.api_key || creds.apiKey || creds.access_token || "") as string;
    } catch {
      return { connectionId, providerSlug: provider.slug, providerName: provider.name, status: "unhealthy", latencyMs: 0, message: "Failed to decrypt credentials" };
    }
  }

  const start = Date.now();
  try {
    const { url, opts } = config.buildTestRequest(apiKey);
    const resp = await fetch(url, opts);
    const latencyMs = Date.now() - start;
    const text = await resp.text();
    const { healthy, message } = config.validateResponse(text, resp.status);

    const status: HealthCheckResult["status"] = healthy
      ? (latencyMs > 5000 ? "degraded" : "healthy")
      : "unhealthy";

    // Record the health check (non-critical — don't fail if this write fails)
    try {
      await db.insert(integrationHealthChecks).values({
        id: uuid(),
        connectionId,
        providerId: provider.id,
        checkType: "connectivity",
        status,
        latencyMs,
        responseCode: resp.status,
        errorMessage: healthy ? null : message,
        metadata: { apiResponsePreview: text.substring(0, 200) },
      });
    } catch (e: any) {
      console.warn(`[HealthCheck] Failed to record check for ${provider.slug}:`, e.message);
    }

    // Update connection status (non-critical)
    try {
      if (healthy && conn.status !== "connected") {
        await db.update(integrationConnections)
          .set({ status: "connected", lastSyncError: null })
          .where(eq(integrationConnections.id, connectionId));
      } else if (!healthy && conn.status === "connected") {
        await db.update(integrationConnections)
          .set({ status: "error", lastSyncError: message })
          .where(eq(integrationConnections.id, connectionId));
      }
    } catch (e: any) {
      console.warn(`[HealthCheck] Failed to update connection status for ${provider.slug}:`, e.message);
    }

    return { connectionId, providerSlug: provider.slug, providerName: provider.name, status, latencyMs, message, responseCode: resp.status };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    try {
      await db!.insert(integrationHealthChecks).values({
        id: uuid(),
        connectionId,
        providerId: provider.id,
        checkType: "connectivity",
        status: "unhealthy",
        latencyMs,
        errorMessage: err.message,
      });
    } catch { /* non-critical write failure */ }
    return { connectionId, providerSlug: provider.slug, providerName: provider.name, status: "unhealthy", latencyMs, message: err.message };
  }
}

/**
 * Run health checks on ALL active connections.
 */
export async function runAllHealthChecks(): Promise<HealthCheckResult[]> {
  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch (e: any) {
    console.warn("[HealthCheck] runAllHealthChecks: DB unavailable:", e.message);
    return [];
  }
  if (!db) return [];

  let connections: any[];
  try {
    connections = await db.select().from(integrationConnections)
      .where(sql`${integrationConnections.status} != 'disconnected'`);
  } catch (e: any) {
    console.warn("[HealthCheck] runAllHealthChecks: Failed to query connections:", e.message);
    return [];
  }

  const results: HealthCheckResult[] = [];
  for (const conn of connections) {
    const result = await runHealthCheck(conn.id);
    results.push(result);
  }

  // Update health summaries
  await updateHealthSummaries(results);

  // Run improvement agent
  await runImprovementAgent(results);

  return results;
}

// ─── Health Summary Aggregation ───────────────────────────────────────────

async function updateHealthSummaries(results: HealthCheckResult[]) {
  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch { return; }
  if (!db) return;

  for (const result of results) {
    try {
    const rows = await db.select().from(integrationHealthSummary)
      .where(eq(integrationHealthSummary.connectionId, result.connectionId));
    const existing = firstOrNull(rows);

    if (existing) {
      const newTotal = (existing.checksTotal || 0) + 1;
      const newHealthy = (existing.checksHealthy || 0) + (result.status === "healthy" ? 1 : 0);
      const newFailed = (existing.checksFailed || 0) + (result.status === "unhealthy" ? 1 : 0);
      const uptimePercent = newTotal > 0 ? ((newHealthy / newTotal) * 100).toFixed(2) : "0";
      const consecutiveFailures = result.status === "unhealthy"
        ? (existing.consecutiveFailures || 0) + 1
        : 0;

      // Compute rolling avg latency
      const prevAvg = existing.avgLatencyMs || 0;
      const avgLatencyMs = Math.round((prevAvg * (newTotal - 1) + result.latencyMs) / newTotal);

      await db.update(integrationHealthSummary)
        .set({
          overallStatus: result.status === "healthy" ? "healthy" : result.status === "degraded" ? "degraded" : "unhealthy",
          uptimePercent: uptimePercent,
          avgLatencyMs,
          checksTotal: newTotal,
          checksHealthy: newHealthy,
          checksFailed: newFailed,
          consecutiveFailures,
          lastHealthyAt: result.status === "healthy" ? new Date() : existing.lastHealthyAt,
          lastUnhealthyAt: result.status === "unhealthy" ? new Date() : existing.lastUnhealthyAt,
        })
        .where(eq(integrationHealthSummary.id, existing.id));
    } else {
      await db.insert(integrationHealthSummary).values({
        id: uuid(),
        connectionId: result.connectionId,
        overallStatus: result.status === "healthy" ? "healthy" : result.status === "degraded" ? "degraded" : result.status === "unhealthy" ? "unhealthy" : "unknown",
        uptimePercent: result.status === "healthy" ? "100" : "0",
        avgLatencyMs: result.latencyMs,
        checksTotal: 1,
        checksHealthy: result.status === "healthy" ? 1 : 0,
        checksFailed: result.status === "unhealthy" ? 1 : 0,
        consecutiveFailures: result.status === "unhealthy" ? 1 : 0,
        lastHealthyAt: result.status === "healthy" ? new Date() : null,
        lastUnhealthyAt: result.status === "unhealthy" ? new Date() : null,
      });
    }
    } catch (e: any) {
      console.warn(`[HealthCheck] Failed to update summary for ${result.connectionId}:`, e.message);
    }
  }
}

// ─── Improvement Agent ────────────────────────────────────────────────────

async function runImprovementAgent(results: HealthCheckResult[]) {
  let db: Awaited<ReturnType<typeof getDb>>;
  try {
    db = await getDb();
  } catch { return; }
  if (!db) return;

  for (const result of results) {
    try {
    // Check for degradation
    if (result.status === "unhealthy") {
      const summaryRows = await db.select().from(integrationHealthSummary)
        .where(eq(integrationHealthSummary.connectionId, result.connectionId));
      const summary = firstOrNull(summaryRows);

      const consecutiveFailures = summary?.consecutiveFailures || 1;

      if (consecutiveFailures === 1) {
        // First failure — log degradation detected
        await db.insert(integrationImprovementLog).values({
          id: uuid(),
          connectionId: result.connectionId,
          actionType: "degradation_detected",
          severity: "warning",
          title: `${result.providerName} connection degraded`,
          description: `Health check failed: ${result.message}. Latency: ${result.latencyMs}ms.`,
          suggestedAction: "Verify API key is still valid. Check provider status page for outages.",
        });
      } else if (consecutiveFailures >= 3) {
        // Persistent failure — escalate + notify owner
        await db.insert(integrationImprovementLog).values({
          id: uuid(),
          connectionId: result.connectionId,
          actionType: "degradation_detected",
          severity: "critical",
          title: `${result.providerName} connection persistently failing (${consecutiveFailures} consecutive failures)`,
          description: `The ${result.providerName} API has failed ${consecutiveFailures} consecutive health checks. Last error: ${result.message}`,
          suggestedAction: "Consider rotating the API key, checking rate limits, or contacting the provider.",
        });
        // Send critical alert notification to owner
        try {
          await notifyOwner({
            title: `\u26a0\ufe0f Critical: ${result.providerName} data source down (${consecutiveFailures} failures)`,
            content: `The ${result.providerName} integration has failed ${consecutiveFailures} consecutive health checks.\n\nLast error: ${result.message}\nLatency: ${result.latencyMs}ms\n\nSuggested action: Verify API key validity, check provider status page, or rotate credentials.\n\nVisit the Integration Health Dashboard to investigate.`,
          });
        } catch (e) {
          console.warn(`[ImprovementAgent] Failed to send critical alert for ${result.providerName}:`, e);
        }
      }
    }

    // Check for recovery
    if (result.status === "healthy") {
      const recoverySummaryRows = await db.select().from(integrationHealthSummary)
        .where(eq(integrationHealthSummary.connectionId, result.connectionId));
      const summary = firstOrNull(recoverySummaryRows);

      if (summary && summary.consecutiveFailures && summary.consecutiveFailures > 0) {
        await db.insert(integrationImprovementLog).values({
          id: uuid(),
          connectionId: result.connectionId,
          actionType: "recovery_confirmed",
          severity: "info",
          title: `${result.providerName} connection recovered`,
          description: `Connection recovered after ${summary.consecutiveFailures} consecutive failures. Current latency: ${result.latencyMs}ms.`,
          resolvedAt: new Date(),
        });
      }
    }

    // Check for high latency (degraded performance)
    if (result.status === "degraded") {
      await db.insert(integrationImprovementLog).values({
        id: uuid(),
        connectionId: result.connectionId,
        actionType: "performance_optimization",
        severity: "info",
        title: `${result.providerName} high latency detected`,
        description: `Response time: ${result.latencyMs}ms (threshold: 5000ms). Consider caching responses or adjusting request frequency.`,
        suggestedAction: "Enable response caching for this provider to reduce latency impact.",
      });
    }
    } catch (e: any) {
      console.warn(`[ImprovementAgent] Error processing ${result.providerSlug}:`, e.message);
    }
  }
}

// ─── AI Context Assembly ──────────────────────────────────────────────────

export interface IntegrationHealthContext {
  totalConnections: number;
  activeConnections: number;
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  dataSources: {
    slug: string;
    name: string;
    status: "healthy" | "degraded" | "unhealthy" | "pending" | "disconnected";
    dataDescription: string;
    latencyMs?: number;
    uptimePercent?: string;
  }[];
  recentImprovements: {
    title: string;
    severity: string;
    createdAt: Date;
  }[];
  promptFragment: string;
}

/**
 * Assemble integration health context for AI system prompt injection.
 * This makes the AI aware of which data sources are live, degraded, or offline.
 */
export async function assembleIntegrationHealthContext(): Promise<IntegrationHealthContext> {
  const db = await getDb();
  const empty: IntegrationHealthContext = {
    totalConnections: 0,
    activeConnections: 0,
    healthyCount: 0,
    degradedCount: 0,
    unhealthyCount: 0,
    dataSources: [],
    recentImprovements: [],
    promptFragment: "",
  };
  if (!db) return empty;

  try {
    // Get all non-disconnected connections with provider info
    const connections = await db.select().from(integrationConnections)
      .where(sql`${integrationConnections.status} != 'disconnected'`);
    const providers = await db.select().from(integrationProviders);
    const providerMap = new Map(providers.map(p => [p.id, p]));

    // Get health summaries
    const summaries = await db.select().from(integrationHealthSummary);
    const summaryMap = new Map(summaries.map(s => [s.connectionId, s]));

    // Get recent improvement actions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentImprovements = await db.select().from(integrationImprovementLog)
      .where(gte(integrationImprovementLog.createdAt, oneDayAgo))
      .orderBy(desc(integrationImprovementLog.createdAt))
      .limit(10);

    const dataSources: IntegrationHealthContext["dataSources"] = [];
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const conn of connections) {
      const provider = providerMap.get(conn.providerId);
      if (!provider) continue;

      const summary = summaryMap.get(conn.id);
      const config = PROVIDER_TEST_CONFIGS[provider.slug];

      let status: IntegrationHealthContext["dataSources"][0]["status"] = "pending";
      if (conn.status === "connected") {
        status = summary?.overallStatus === "degraded" ? "degraded" : "healthy";
      } else if (conn.status === "error") {
        status = "unhealthy";
      } else if (conn.status === "disconnected") {
        status = "disconnected";
      }

      if (status === "healthy") healthyCount++;
      else if (status === "degraded") degradedCount++;
      else if (status === "unhealthy") unhealthyCount++;

      dataSources.push({
        slug: provider.slug,
        name: provider.name,
        status,
        dataDescription: config?.dataDescription || provider.description || "External data source",
        latencyMs: summary?.avgLatencyMs || undefined,
        uptimePercent: summary?.uptimePercent?.toString() || undefined,
      });
    }

    const totalConnections = connections.length;
    const activeConnections = connections.filter(c => c.status === "connected").length;

    // Build prompt fragment
    const promptFragment = buildIntegrationHealthPrompt({
      dataSources,
      healthyCount,
      degradedCount,
      unhealthyCount,
      recentImprovements: recentImprovements.map(i => ({
        title: i.title,
        severity: i.severity || "info",
        createdAt: i.createdAt,
      })),
    });

    return {
      totalConnections,
      activeConnections,
      healthyCount,
      degradedCount,
      unhealthyCount,
      dataSources,
      recentImprovements: recentImprovements.map(i => ({
        title: i.title,
        severity: i.severity || "info",
        createdAt: i.createdAt,
      })),
      promptFragment,
    };
  } catch (e) {
    console.error("[IntegrationHealth] assembleContext error:", e);
    return empty;
  }
}

// ─── Prompt Builder ───────────────────────────────────────────────────────

function buildIntegrationHealthPrompt(params: {
  dataSources: IntegrationHealthContext["dataSources"];
  healthyCount: number;
  degradedCount: number;
  unhealthyCount: number;
  recentImprovements: IntegrationHealthContext["recentImprovements"];
}): string {
  const { dataSources, healthyCount, degradedCount, unhealthyCount, recentImprovements } = params;

  if (dataSources.length === 0) {
    return `<integration_awareness>\n## Data Source Status\nNo external data integrations are currently configured. When users ask about economic data, demographics, or labor statistics, suggest they connect government APIs (BLS, FRED, Census, BEA) in the Integrations page for real-time data access.\n</integration_awareness>`;
  }

  const sections: string[] = [];
  sections.push(`<integration_awareness>`);
  sections.push(`## Live Data Source Awareness`);
  sections.push(`You have access to ${dataSources.length} external data integrations. ${healthyCount} healthy, ${degradedCount} degraded, ${unhealthyCount} unhealthy.`);

  // Group by status
  const healthy = dataSources.filter(d => d.status === "healthy");
  const degraded = dataSources.filter(d => d.status === "degraded");
  const unhealthy = dataSources.filter(d => d.status === "unhealthy" || d.status === "pending");

  if (healthy.length > 0) {
    sections.push(`\n### Active Data Sources (use these confidently)`);
    for (const ds of healthy) {
      sections.push(`- **${ds.name}** (${ds.slug}): ${ds.dataDescription}${ds.latencyMs ? ` | Avg response: ${ds.latencyMs}ms` : ""}${ds.uptimePercent ? ` | Uptime: ${ds.uptimePercent}%` : ""}`);
    }
    sections.push(`When users ask about topics covered by these sources, you can reference that you have live access to this data. Offer to pull specific data points when relevant.`);
  }

  if (degraded.length > 0) {
    sections.push(`\n### Degraded Data Sources (use with caution)`);
    for (const ds of degraded) {
      sections.push(`- **${ds.name}**: ${ds.dataDescription} — experiencing high latency`);
    }
    sections.push(`These sources are responding but slowly. Set expectations if users request data from them.`);
  }

  if (unhealthy.length > 0) {
    sections.push(`\n### Unavailable Data Sources`);
    for (const ds of unhealthy) {
      sections.push(`- **${ds.name}**: ${ds.dataDescription} — currently ${ds.status}`);
    }
    sections.push(`Do NOT promise data from these sources. If asked, explain the connection needs attention and suggest checking the Integration Health Dashboard.`);
  }

  // Recent improvement events
  if (recentImprovements.length > 0) {
    const critical = recentImprovements.filter(i => i.severity === "critical");
    if (critical.length > 0) {
      sections.push(`\n### Recent Issues (last 24h)`);
      for (const imp of critical) {
        sections.push(`- ⚠️ ${imp.title}`);
      }
    }
  }

  sections.push(`\n### Data Source Usage Guidelines`);
  sections.push(`- When discussing economic topics, proactively mention which live data sources are available`);
  sections.push(`- For financial planning conversations, reference relevant data (e.g., "Based on current BLS data, inflation is...")`);
  sections.push(`- If a user asks about data you don't have access to, suggest connecting the relevant integration`);
  sections.push(`- Never fabricate data — if a source is unavailable, say so transparently`);
  sections.push(`</integration_awareness>`);

  return sections.join("\n");
}

// ─── Get Health Dashboard Data ────────────────────────────────────────────

export interface HealthDashboardData {
  connections: {
    id: string;
    providerSlug: string;
    providerName: string;
    providerCategory: string;
    ownershipTier: string;
    status: string;
    lastSyncAt: Date | null;
    createdAt: Date;
    health: {
      overallStatus: string;
      uptimePercent: string;
      avgLatencyMs: number | null;
      checksTotal: number;
      checksHealthy: number;
      checksFailed: number;
      consecutiveFailures: number;
      lastHealthyAt: Date | null;
      lastUnhealthyAt: Date | null;
    } | null;
  }[];
  recentChecks: {
    id: string;
    connectionId: string;
    providerSlug: string;
    checkType: string;
    status: string;
    latencyMs: number | null;
    errorMessage: string | null;
    checkedAt: Date;
  }[];
  improvementLog: {
    id: string;
    connectionId: string | null;
    actionType: string;
    severity: string;
    title: string;
    description: string | null;
    suggestedAction: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
  }[];
  summary: {
    totalConnections: number;
    activeConnections: number;
    healthyPercent: number;
    avgLatencyMs: number;
    totalChecks: number;
  };
}

export async function getHealthDashboardData(): Promise<HealthDashboardData> {
  const db = await getDb();
  const empty: HealthDashboardData = {
    connections: [],
    recentChecks: [],
    improvementLog: [],
    summary: { totalConnections: 0, activeConnections: 0, healthyPercent: 0, avgLatencyMs: 0, totalChecks: 0 },
  };
  if (!db) return empty;

  // Get connections with provider info
  const conns = await db.select().from(integrationConnections)
    .where(sql`${integrationConnections.status} != 'disconnected'`);
  const providers = await db.select().from(integrationProviders);
  const providerMap = new Map(providers.map(p => [p.id, p]));

  // Get health summaries
  const summaries = await db.select().from(integrationHealthSummary);
  const summaryMap = new Map(summaries.map(s => [s.connectionId, s]));

  // Get recent health checks (last 50)
  const recentChecks = await db.select().from(integrationHealthChecks)
    .orderBy(desc(integrationHealthChecks.checkedAt))
    .limit(50);

  // Get improvement log (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const improvements = await db.select().from(integrationImprovementLog)
    .where(gte(integrationImprovementLog.createdAt, thirtyDaysAgo))
    .orderBy(desc(integrationImprovementLog.createdAt))
    .limit(50);

  const connections = conns.map(c => {
    const provider = providerMap.get(c.providerId);
    const summary = summaryMap.get(c.id);
    return {
      id: c.id,
      providerSlug: provider?.slug || "",
      providerName: provider?.name || "",
      providerCategory: provider?.category || "",
      ownershipTier: c.ownershipTier,
      status: c.status || "pending",
      lastSyncAt: c.lastSyncAt,
      createdAt: c.createdAt,
      health: summary ? {
        overallStatus: summary.overallStatus || "unknown",
        uptimePercent: summary.uptimePercent?.toString() || "0",
        avgLatencyMs: summary.avgLatencyMs,
        checksTotal: summary.checksTotal || 0,
        checksHealthy: summary.checksHealthy || 0,
        checksFailed: summary.checksFailed || 0,
        consecutiveFailures: summary.consecutiveFailures || 0,
        lastHealthyAt: summary.lastHealthyAt,
        lastUnhealthyAt: summary.lastUnhealthyAt,
      } : null,
    };
  });

  const activeCount = connections.filter(c => c.status === "connected").length;
  const healthyCount = connections.filter(c => c.health?.overallStatus === "healthy").length;
  const totalLatency = connections.reduce((sum, c) => sum + (c.health?.avgLatencyMs || 0), 0);
  const totalChecks = connections.reduce((sum, c) => sum + (c.health?.checksTotal || 0), 0);

  return {
    connections,
    recentChecks: recentChecks.map(ch => {
      const provider = providers.find(p => p.id === ch.providerId);
      return {
        id: ch.id,
        connectionId: ch.connectionId,
        providerSlug: provider?.slug || "",
        checkType: ch.checkType,
        status: ch.status,
        latencyMs: ch.latencyMs,
        errorMessage: ch.errorMessage,
        checkedAt: ch.checkedAt,
      };
    }),
    improvementLog: improvements.map(i => ({
      id: i.id,
      connectionId: i.connectionId,
      actionType: i.actionType,
      severity: i.severity || "info",
      title: i.title,
      description: i.description,
      suggestedAction: i.suggestedAction,
      resolvedAt: i.resolvedAt,
      createdAt: i.createdAt,
    })),
    summary: {
      totalConnections: connections.length,
      activeConnections: activeCount,
      healthyPercent: connections.length > 0 ? Math.round((healthyCount / connections.length) * 100) : 0,
      avgLatencyMs: connections.length > 0 ? Math.round(totalLatency / connections.length) : 0,
      totalChecks,
    },
  };
}
