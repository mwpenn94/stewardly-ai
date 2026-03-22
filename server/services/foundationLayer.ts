/**
 * Foundation Layer — Scraping Ethics, Rate Management, Freshness Registry, Data Maintenance
 * 
 * Core infrastructure for responsible, sustainable data acquisition across all tiers.
 * Every external request flows through this layer for auditing, rate limiting, and caching.
 */

import { getDb } from "../db";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import {
  scrapingAudit, scrapingCache, dataFreshnessRegistry,
  rateProfiles, rateSignalLog, probeResults,
  integrationAnalysisLog, extractionPlans, extractionPlanJobs,
  rateRecommendations, dataValueScores,
} from "../../drizzle/schema";
import type {
  InsertScrapingAudit, InsertRateSignalLog, InsertProbeResult,
  InsertIntegrationAnalysisLog, InsertExtractionPlan,
  InsertRateRecommendation, InsertDataValueScore,
} from "../../drizzle/schema";
import crypto from "crypto";

// ─── DB HELPER ──────────────────────────────────────────────────────────

async function db() {
  const instance = await getDb();
  if (!instance) throw new Error("Database not available");
  return instance;
}

// ─── USER AGENT ROTATION ────────────────────────────────────────────────

const USER_AGENTS = [
  "Stewardly/1.0 (Financial Data Platform; +https://stewardly.manus.space/robots)",
  "Stewardly-DataBot/1.0 (Compliant Financial Data Aggregator)",
  "Stewardly/1.0 (Government Data Consumer; research@stewardly.com)",
];

export function getRotatingUserAgent(isGovernment: boolean = false): string {
  if (isGovernment) return USER_AGENTS[2]; // Government sources get the research UA
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── ROBOTS.TXT CHECKER ────────────────────────────────────────────────

const robotsTxtCache = new Map<string, { rules: string; fetchedAt: number }>();
const ROBOTS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function checkRobotsTxt(domain: string, path: string): Promise<{
  allowed: boolean;
  robotsTxt: string | null;
  cached: boolean;
}> {
  const cacheEntry = robotsTxtCache.get(domain);
  if (cacheEntry && Date.now() - cacheEntry.fetchedAt < ROBOTS_CACHE_TTL) {
    return { allowed: isPathAllowed(cacheEntry.rules, path), robotsTxt: cacheEntry.rules, cached: true };
  }

  try {
    const url = `https://${domain}/robots.txt`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": getRotatingUserAgent() },
    });
    clearTimeout(timeout);

    if (response.ok) {
      const rules = await response.text();
      robotsTxtCache.set(domain, { rules, fetchedAt: Date.now() });
      return { allowed: isPathAllowed(rules, path), robotsTxt: rules, cached: false };
    }
    // If robots.txt doesn't exist (404), everything is allowed
    return { allowed: true, robotsTxt: null, cached: false };
  } catch {
    // On error, assume allowed but flag it
    return { allowed: true, robotsTxt: null, cached: false };
  }
}

function isPathAllowed(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split("\n");
  let inOurSection = false;
  let disallowed: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith("user-agent:")) {
      const agent = trimmed.replace("user-agent:", "").trim();
      inOurSection = agent === "*" || agent.includes("stewardly");
    } else if (inOurSection && trimmed.startsWith("disallow:")) {
      const disPath = trimmed.replace("disallow:", "").trim();
      if (disPath) disallowed.push(disPath);
    }
  }

  return !disallowed.some(d => path.startsWith(d));
}

// ─── REQUEST HASH ───────────────────────────────────────────────────────

export function computeRequestHash(provider: string, endpoint: string, params?: Record<string, any>): string {
  const payload = JSON.stringify({ provider, endpoint, params: params || {} });
  return crypto.createHash("sha256").update(payload).digest("hex").substring(0, 64);
}

// ─── SCRAPING AUDIT ─────────────────────────────────────────────────────

export async function logScrapingRequest(entry: InsertScrapingAudit): Promise<void> {
  try {
    await (await db()).insert(scrapingAudit).values(entry);
  } catch (e) {
    console.error("[ScrapingAudit] Failed to log:", e);
  }
}

export async function getScrapingAuditLog(provider?: string, limit: number = 100): Promise<any[]> {
  const conditions = provider ? [eq(scrapingAudit.provider, provider)] : [];
  return (await db()).select().from(scrapingAudit)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(scrapingAudit.createdAt))
    .limit(limit);
}

export async function getScrapingStats(provider: string): Promise<{
  totalRequests: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  errorRate: number;
  last24hRequests: number;
}> {
  const [stats] = await (await db()).select({
    totalRequests: sql<number>`COUNT(*)`,
    cacheHits: sql<number>`SUM(CASE WHEN cache_hit = true THEN 1 ELSE 0 END)`,
    avgLatency: sql<number>`AVG(response_time_ms)`,
    errors: sql<number>`SUM(CASE WHEN status_code >= 400 OR error_message IS NOT NULL THEN 1 ELSE 0 END)`,
    last24h: sql<number>`SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END)`,
  }).from(scrapingAudit).where(eq(scrapingAudit.provider, provider));

  const total = Number(stats?.totalRequests || 0);
  return {
    totalRequests: total,
    cacheHitRate: total > 0 ? (Number(stats?.cacheHits || 0) / total) * 100 : 0,
    avgLatencyMs: Number(stats?.avgLatency || 0),
    errorRate: total > 0 ? (Number(stats?.errors || 0) / total) * 100 : 0,
    last24hRequests: Number(stats?.last24h || 0),
  };
}

// ─── SCRAPING CACHE ─────────────────────────────────────────────────────

export async function getCachedResponse(cacheKey: string): Promise<{
  hit: boolean;
  data: any | null;
  headers: any | null;
}> {
  const [entry] = await (await db()).select().from(scrapingCache)
    .where(and(
      eq(scrapingCache.cacheKey, cacheKey),
      sql`expires_at > NOW()`
    ))
    .limit(1);

  if (entry) {
    // Increment hit count
    await (await db()).update(scrapingCache)
      .set({ hitCount: sql`hit_count + 1` })
      .where(eq(scrapingCache.id, entry.id));

    return {
      hit: true,
      data: entry.responseBody ? JSON.parse(entry.responseBody) : null,
      headers: entry.responseHeaders,
    };
  }

  return { hit: false, data: null, headers: null };
}

export async function setCachedResponse(
  cacheKey: string,
  provider: string,
  endpoint: string,
  responseBody: any,
  responseHeaders: any,
  statusCode: number,
  ttlSeconds: number = 86400
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const body = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);

  // Upsert: insert or update on duplicate key
  await (await db()).insert(scrapingCache).values({
    cacheKey,
    provider,
    endpoint,
    responseBody: body,
    responseHeaders,
    statusCode,
    ttlSeconds,
    expiresAt,
  }).onDuplicateKeyUpdate({
    set: {
      responseBody: body,
      responseHeaders,
      statusCode,
      ttlSeconds,
      hitCount: 0,
      expiresAt,
    },
  });
}

export async function invalidateCache(provider?: string): Promise<number> {
  if (provider) {
    const result = await (await db()).delete(scrapingCache).where(eq(scrapingCache.provider, provider));
    return result[0]?.affectedRows || 0;
  }
  const result = await (await db()).delete(scrapingCache).where(sql`expires_at < NOW()`);
  return result[0]?.affectedRows || 0;
}

// ─── RATE MANAGEMENT ────────────────────────────────────────────────────

export async function getRateProfile(provider: string): Promise<any | null> {
  const [profile] = await (await db()).select().from(rateProfiles)
    .where(eq(rateProfiles.provider, provider)).limit(1);
  return profile || null;
}

export async function getAllRateProfiles(): Promise<any[]> {
  return (await db()).select().from(rateProfiles).orderBy(asc(rateProfiles.provider));
}

export async function upsertRateProfile(provider: string, data: {
  domain: string;
  currentRpm?: number;
  staticMaximum?: number;
  safetyFactor?: string;
  dailyBudget?: number;
  isGovernment?: boolean;
  probeEnabled?: boolean;
  notes?: string;
}): Promise<void> {
  await (await db()).insert(rateProfiles).values({
    provider,
    domain: data.domain,
    currentRpm: data.currentRpm || 10,
    staticMaximum: data.staticMaximum || 60,
    safetyFactor: data.safetyFactor || "0.70",
    dailyBudget: data.dailyBudget || 1000,
    isGovernment: data.isGovernment || false,
    probeEnabled: data.probeEnabled || false,
    notes: data.notes,
  }).onDuplicateKeyUpdate({
    set: {
      domain: data.domain,
      currentRpm: data.currentRpm,
      staticMaximum: data.staticMaximum,
      safetyFactor: data.safetyFactor,
      dailyBudget: data.dailyBudget,
      isGovernment: data.isGovernment,
      probeEnabled: data.probeEnabled,
      notes: data.notes,
    },
  });
}

export async function checkRateLimit(provider: string): Promise<{
  allowed: boolean;
  currentRpm: number;
  dailyRemaining: number;
  waitMs: number;
}> {
  const profile = await getRateProfile(provider);
  if (!profile || !profile.enabled) {
    return { allowed: false, currentRpm: 0, dailyRemaining: 0, waitMs: 60000 };
  }

  const dailyRemaining = profile.dailyBudget - (profile.dailyUsed || 0);
  if (dailyRemaining <= 0) {
    return { allowed: false, currentRpm: profile.currentRpm, dailyRemaining: 0, waitMs: 60000 };
  }

  // Increment daily usage
  await (await db()).update(rateProfiles)
    .set({ dailyUsed: sql`daily_used + 1` })
    .where(eq(rateProfiles.provider, provider));

  return {
    allowed: true,
    currentRpm: profile.currentRpm,
    dailyRemaining: dailyRemaining - 1,
    waitMs: Math.ceil(60000 / profile.currentRpm),
  };
}

export async function resetDailyUsage(): Promise<void> {
  await (await db()).update(rateProfiles).set({
    dailyUsed: 0,
    dailyResetAt: new Date(),
  });
}

// ─── RATE SIGNAL DETECTION ──────────────────────────────────────────────

export async function logRateSignal(signal: InsertRateSignalLog): Promise<void> {
  await (await db()).insert(rateSignalLog).values(signal);
}

export async function detectAndAdjustRate(
  provider: string,
  httpStatus: number,
  responseHeaders: Record<string, string>,
  latencyMs: number
): Promise<{
  signalDetected: boolean;
  signalType: string | null;
  adjustment: { previousRpm: number; newRpm: number } | null;
}> {
  const profile = await getRateProfile(provider);
  if (!profile) return { signalDetected: false, signalType: null, adjustment: null };

  let signalType: string | null = null;
  let newRpm = profile.currentRpm;

  // Check for HTTP 429 (Too Many Requests)
  if (httpStatus === 429) {
    signalType = "http_429";
    newRpm = Math.max(1, Math.floor(profile.currentRpm * 0.5)); // Halve the rate
  }
  // Check for HTTP 403 (Forbidden — possible block)
  else if (httpStatus === 403) {
    signalType = "http_403";
    newRpm = Math.max(1, Math.floor(profile.currentRpm * 0.25)); // Quarter the rate
  }
  // Check for Retry-After header
  else if (responseHeaders["retry-after"]) {
    signalType = "retry_after";
    const retryAfter = parseInt(responseHeaders["retry-after"]);
    if (!isNaN(retryAfter)) {
      newRpm = Math.max(1, Math.floor(60 / retryAfter)); // Convert retry-after to RPM
    }
  }
  // Check for rate limit headers
  else if (responseHeaders["x-ratelimit-remaining"] || responseHeaders["x-rate-limit-remaining"]) {
    const remaining = parseInt(responseHeaders["x-ratelimit-remaining"] || responseHeaders["x-rate-limit-remaining"]);
    if (!isNaN(remaining) && remaining < 10) {
      signalType = "rate_limit_header";
      newRpm = Math.max(1, Math.floor(profile.currentRpm * 0.7));
    }
  }
  // Check for latency spike (> 3x average)
  else if (profile.avgLatencyMs && latencyMs > profile.avgLatencyMs * 3) {
    signalType = "latency_spike";
    newRpm = Math.max(1, Math.floor(profile.currentRpm * 0.8));
  }

  if (signalType) {
    // Log the signal
    await logRateSignal({
      provider,
      signalType: signalType as any,
      httpStatus,
      rateHeaders: responseHeaders,
      previousRpm: profile.currentRpm,
      adjustedRpm: newRpm,
      autoApplied: newRpm !== profile.currentRpm,
    });

    // Auto-apply the adjustment
    if (newRpm !== profile.currentRpm) {
      await (await db()).update(rateProfiles).set({
        currentRpm: newRpm,
        lastThrottledAt: new Date(),
      }).where(eq(rateProfiles.provider, provider));
    }

    return {
      signalDetected: true,
      signalType,
      adjustment: { previousRpm: profile.currentRpm, newRpm },
    };
  }

  // Update average latency (exponential moving average)
  const newAvg = profile.avgLatencyMs
    ? Math.floor(profile.avgLatencyMs * 0.9 + latencyMs * 0.1)
    : latencyMs;
  await (await db()).update(rateProfiles).set({ avgLatencyMs: newAvg })
    .where(eq(rateProfiles.provider, provider));

  return { signalDetected: false, signalType: null, adjustment: null };
}

// ─── FRESHNESS REGISTRY ─────────────────────────────────────────────────

export async function registerDataSource(
  provider: string,
  dataCategory: string,
  refreshIntervalHours: number = 24
): Promise<void> {
  const nextRefresh = new Date(Date.now() + refreshIntervalHours * 3600000);
  await (await db()).insert(dataFreshnessRegistry).values({
    provider,
    dataCategory,
    refreshIntervalHours,
    nextRefreshAt: nextRefresh,
    status: "stale",
  }).onDuplicateKeyUpdate({
    set: { refreshIntervalHours, nextRefreshAt: nextRefresh },
  });
}

export async function markRefreshComplete(
  provider: string,
  dataCategory: string,
  recordCount: number
): Promise<void> {
  const [entry] = await (await db()).select().from(dataFreshnessRegistry)
    .where(and(
      eq(dataFreshnessRegistry.provider, provider),
      eq(dataFreshnessRegistry.dataCategory, dataCategory)
    )).limit(1);

  if (entry) {
    const nextRefresh = new Date(Date.now() + (entry.refreshIntervalHours || 24) * 3600000);
    await (await db()).update(dataFreshnessRegistry).set({
      lastRefreshedAt: new Date(),
      nextRefreshAt: nextRefresh,
      recordCount,
      status: "fresh",
      consecutiveFailures: 0,
    }).where(eq(dataFreshnessRegistry.id, entry.id));
  }
}

export async function markRefreshFailed(
  provider: string,
  dataCategory: string,
  errorMessage: string
): Promise<void> {
  const [entry] = await (await db()).select().from(dataFreshnessRegistry)
    .where(and(
      eq(dataFreshnessRegistry.provider, provider),
      eq(dataFreshnessRegistry.dataCategory, dataCategory)
    )).limit(1);

  if (entry) {
    const newFailures = (entry.consecutiveFailures || 0) + 1;
    const shouldPause = newFailures >= (entry.maxConsecutiveFailures || 3);
    await (await db()).update(dataFreshnessRegistry).set({
      status: shouldPause ? "paused" : "error",
      consecutiveFailures: newFailures,
      lastErrorMessage: errorMessage,
      autoPaused: shouldPause,
    }).where(eq(dataFreshnessRegistry.id, entry.id));
  }
}

export async function getStaleDataSources(): Promise<any[]> {
  return (await db()).select().from(dataFreshnessRegistry)
    .where(and(
      sql`next_refresh_at < NOW()`,
      sql`status != 'paused'`,
      sql`auto_paused = false`
    ))
    .orderBy(asc(dataFreshnessRegistry.nextRefreshAt));
}

export async function getFreshnessOverview(): Promise<{
  total: number;
  fresh: number;
  stale: number;
  error: number;
  paused: number;
  sources: any[];
}> {
  const sources = await (await db()).select().from(dataFreshnessRegistry)
    .orderBy(asc(dataFreshnessRegistry.provider));

  return {
    total: sources.length,
    fresh: sources.filter((s: any) => s.status === "fresh").length,
    stale: sources.filter((s: any) => s.status === "stale").length,
    error: sources.filter((s: any) => s.status === "error").length,
    paused: sources.filter((s: any) => s.status === "paused").length,
    sources,
  };
}

// ─── DATA MAINTENANCE ENGINE ────────────────────────────────────────────

export async function runDataMaintenance(): Promise<{
  expiredCacheEntries: number;
  staleSourcesFound: number;
  dailyUsageReset: boolean;
}> {
  // 1. Clean expired cache entries
  const expiredResult = await (await db()).delete(scrapingCache).where(sql`expires_at < NOW()`);
  const expiredCacheEntries = expiredResult[0]?.affectedRows || 0;

  // 2. Find stale data sources
  const staleSources = await getStaleDataSources();

  // 3. Mark stale sources
  for (const source of staleSources) {
    if (source.status === "fresh") {
      await (await db()).update(dataFreshnessRegistry).set({ status: "stale" })
        .where(eq(dataFreshnessRegistry.id, source.id));
    }
  }

  // 4. Reset daily usage if needed
  const [anyProfile] = await (await db()).select().from(rateProfiles)
    .where(sql`daily_reset_at IS NULL OR daily_reset_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)`)
    .limit(1);

  let dailyUsageReset = false;
  if (anyProfile) {
    await resetDailyUsage();
    dailyUsageReset = true;
  }

  return { expiredCacheEntries, staleSourcesFound: staleSources.length, dailyUsageReset };
}

// ─── SEED RATE PROFILES ─────────────────────────────────────────────────

export async function seedRateProfiles(): Promise<number> {
  const profiles = [
    { provider: "census", domain: "api.census.gov", currentRpm: 30, staticMaximum: 500, dailyBudget: 500, isGovernment: true, notes: "Unlimited with free key" },
    { provider: "bls", domain: "api.bls.gov", currentRpm: 20, staticMaximum: 500, dailyBudget: 500, isGovernment: true, notes: "V2 key: 500 queries/day" },
    { provider: "fred", domain: "api.stlouisfed.org", currentRpm: 30, staticMaximum: 120, dailyBudget: 5000, isGovernment: true, notes: "Unlimited with free key" },
    { provider: "bea", domain: "apps.bea.gov", currentRpm: 10, staticMaximum: 60, dailyBudget: 200, isGovernment: true, notes: "Unlimited with free key" },
    { provider: "sec-edgar", domain: "data.sec.gov", currentRpm: 8, staticMaximum: 10, dailyBudget: 2000, isGovernment: true, notes: "10 req/sec fair use policy" },
    { provider: "finra-brokercheck", domain: "api.brokercheck.finra.org", currentRpm: 10, staticMaximum: 30, dailyBudget: 500, isGovernment: false, notes: "Free public access" },
    { provider: "plaid", domain: "production.plaid.com", currentRpm: 20, staticMaximum: 60, dailyBudget: 5000, isGovernment: false, notes: "Production rate limits apply" },
    { provider: "peopledatalabs", domain: "api.peopledatalabs.com", currentRpm: 5, staticMaximum: 10, dailyBudget: 100, isGovernment: false, notes: "100 records/month free tier" },
    { provider: "snaptrade", domain: "api.snaptrade.com", currentRpm: 10, staticMaximum: 30, dailyBudget: 500, isGovernment: false, notes: "5 free connections" },
    { provider: "compulife", domain: "api.compulife.com", currentRpm: 5, staticMaximum: 20, dailyBudget: 200, isGovernment: false, notes: "Volume-based pricing" },
    { provider: "attom", domain: "api.gateway.attomdata.com", currentRpm: 5, staticMaximum: 20, dailyBudget: 100, isGovernment: false, notes: "PAYG or annual" },
    { provider: "gohighlevel", domain: "services.leadconnectorhq.com", currentRpm: 10, staticMaximum: 60, dailyBudget: 5000, isGovernment: false, notes: "API included on all paid plans" },
    { provider: "smsit", domain: "tool-it.smsit.ai", currentRpm: 10, staticMaximum: 30, dailyBudget: 1000, isGovernment: false, notes: "RAAS plans from $9/mo" },
    { provider: "bridgeft", domain: "api.bridgeft.com", currentRpm: 10, staticMaximum: 60, dailyBudget: 5000, isGovernment: false, notes: "Partnership required" },
    { provider: "canopy-connect", domain: "api.usecanopy.com", currentRpm: 5, staticMaximum: 20, dailyBudget: 200, isGovernment: false, notes: "Free sandbox; paid production" },
  ];

  let seeded = 0;
  for (const p of profiles) {
    await upsertRateProfile(p.provider, {
      domain: p.domain,
      currentRpm: p.currentRpm,
      staticMaximum: p.staticMaximum,
      dailyBudget: p.dailyBudget,
      isGovernment: p.isGovernment,
      notes: p.notes,
    });
    seeded++;
  }
  return seeded;
}

// ─── SEED FRESHNESS REGISTRY ────────────────────────────────────────────

export async function seedFreshnessRegistry(): Promise<number> {
  const sources = [
    { provider: "census", dataCategory: "demographics", refreshIntervalHours: 720 }, // Monthly
    { provider: "census", dataCategory: "income_data", refreshIntervalHours: 720 },
    { provider: "bls", dataCategory: "cpi", refreshIntervalHours: 168 }, // Weekly
    { provider: "bls", dataCategory: "employment", refreshIntervalHours: 720 }, // Monthly
    { provider: "bls", dataCategory: "wages", refreshIntervalHours: 720 },
    { provider: "fred", dataCategory: "interest_rates", refreshIntervalHours: 24 }, // Daily
    { provider: "fred", dataCategory: "economic_indicators", refreshIntervalHours: 168 }, // Weekly
    { provider: "fred", dataCategory: "market_indices", refreshIntervalHours: 24 },
    { provider: "bea", dataCategory: "gdp", refreshIntervalHours: 2160 }, // Quarterly
    { provider: "bea", dataCategory: "personal_income", refreshIntervalHours: 2160 },
    { provider: "sec-edgar", dataCategory: "filings", refreshIntervalHours: 24 },
    { provider: "sec-edgar", dataCategory: "form_adv", refreshIntervalHours: 24 },
    { provider: "finra-brokercheck", dataCategory: "advisor_registrations", refreshIntervalHours: 24 },
  ];

  let seeded = 0;
  for (const s of sources) {
    await registerDataSource(s.provider, s.dataCategory, s.refreshIntervalHours);
    seeded++;
  }
  return seeded;
}

// ─── PROBING (Phase J) ──────────────────────────────────────────────────

export async function createProbeResult(data: InsertProbeResult): Promise<number> {
  const result = await (await db()).insert(probeResults).values(data);
  return result[0]?.insertId || 0;
}

export async function getProbeResults(domain?: string): Promise<any[]> {
  const conditions = domain ? [eq(probeResults.domain, domain)] : [];
  return (await db()).select().from(probeResults)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(probeResults.createdAt))
    .limit(50);
}

// ─── INTEGRATION ANALYSIS (Phase J) ────────────────────────────────────

export async function logIntegrationAnalysis(data: InsertIntegrationAnalysisLog): Promise<number> {
  const result = await (await db()).insert(integrationAnalysisLog).values(data);
  return result[0]?.insertId || 0;
}

// ─── EXTRACTION PLANS (Phase J) ────────────────────────────────────────

export async function createExtractionPlan(data: InsertExtractionPlan): Promise<number> {
  const result = await (await db()).insert(extractionPlans).values(data);
  return result[0]?.insertId || 0;
}

export async function getExtractionPlans(status?: string): Promise<any[]> {
  const conditions = status ? [eq(extractionPlans.status, status as any)] : [];
  return (await db()).select().from(extractionPlans)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(extractionPlans.createdAt));
}

// ─── RATE RECOMMENDATIONS (Phase J) ────────────────────────────────────

export async function createRateRecommendation(data: InsertRateRecommendation): Promise<number> {
  const result = await (await db()).insert(rateRecommendations).values(data);
  return result[0]?.insertId || 0;
}

export async function getPendingRecommendations(): Promise<any[]> {
  return (await db()).select().from(rateRecommendations)
    .where(eq(rateRecommendations.status, "pending_review"))
    .orderBy(desc(rateRecommendations.createdAt));
}

// ─── DATA VALUE SCORING (Phase J) ──────────────────────────────────────

export async function upsertDataValueScore(data: InsertDataValueScore): Promise<void> {
  await (await db()).insert(dataValueScores).values(data).onDuplicateKeyUpdate({
    set: {
      currentScore: data.currentScore,
      lastScoredAt: new Date(),
      refreshPriority: data.refreshPriority,
    },
  });
}

export async function getHighValueRecords(limit: number = 50): Promise<any[]> {
  return (await db()).select().from(dataValueScores)
    .where(sql`refresh_priority IN ('critical', 'high')`)
    .orderBy(desc(dataValueScores.currentScore))
    .limit(limit);
}

// ─── AUDITED FETCH ──────────────────────────────────────────────────────
// The main entry point: every external request should go through this function

export async function auditedFetch(
  provider: string,
  url: string,
  options: RequestInit = {},
  ttlSeconds: number = 86400
): Promise<{
  data: any;
  fromCache: boolean;
  statusCode: number;
  latencyMs: number;
}> {
  const domain = new URL(url).hostname;
  const path = new URL(url).pathname;
  const cacheKey = computeRequestHash(provider, url, options.body ? { body: options.body } : undefined);

  // 1. Check cache first
  const cached = await getCachedResponse(cacheKey);
  if (cached.hit) {
    await logScrapingRequest({
      provider,
      domain,
      endpoint: path,
      method: (options.method || "GET") as any,
      statusCode: 200,
      responseTimeMs: 0,
      cacheHit: true,
      robotsTxtChecked: false,
      robotsTxtAllowed: true,
    });
    return { data: cached.data, fromCache: true, statusCode: 200, latencyMs: 0 };
  }

  // 2. Check rate limit
  const rateCheck = await checkRateLimit(provider);
  if (!rateCheck.allowed) {
    throw new Error(`Rate limit exceeded for ${provider}. Wait ${rateCheck.waitMs}ms.`);
  }

  // 3. Check robots.txt
  const robotsCheck = await checkRobotsTxt(domain, path);

  // 4. Make the request
  const startTime = Date.now();
  const userAgent = getRotatingUserAgent(
    (await getRateProfile(provider))?.isGovernment || false
  );

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": userAgent,
        ...options.headers,
      },
    });

    const latencyMs = Date.now() - startTime;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    // 5. Detect rate signals
    await detectAndAdjustRate(provider, response.status, responseHeaders, latencyMs);

    // 6. Log the request
    await logScrapingRequest({
      provider,
      domain,
      endpoint: path,
      method: (options.method || "GET") as any,
      statusCode: response.status,
      responseTimeMs: latencyMs,
      rateLimitRemaining: responseHeaders["x-ratelimit-remaining"]
        ? parseInt(responseHeaders["x-ratelimit-remaining"]) : undefined,
      userAgent,
      robotsTxtChecked: true,
      robotsTxtAllowed: robotsCheck.allowed,
      cacheHit: false,
      requestHash: cacheKey,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // 7. Cache the response
    await setCachedResponse(cacheKey, provider, path, data, responseHeaders, response.status, ttlSeconds);

    return { data, fromCache: false, statusCode: response.status, latencyMs };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    await logScrapingRequest({
      provider,
      domain,
      endpoint: path,
      method: (options.method || "GET") as any,
      responseTimeMs: latencyMs,
      userAgent,
      robotsTxtChecked: true,
      robotsTxtAllowed: robotsCheck.allowed,
      cacheHit: false,
      errorMessage: error.message,
      requestHash: cacheKey,
    });
    throw error;
  }
}
