/**
 * Shared AI Middleware — Intelligence Engine v4.0+
 * 
 * Provides unified middleware for all AI-related tRPC procedures:
 * - Rate limiting per user (configurable burst/sustained)
 * - Cost tracking with per-model token accounting
 * - Unified error handling with retry logic
 * - Request/response logging for audit trail
 * - Model selection validation
 */

import { TRPCError } from "@trpc/server";

/* ─── Rate Limiting ─── */

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  requestCount: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_CONFIG = {
  /** Max tokens per minute (token bucket) */
  tokensPerMinute: 60,
  /** Burst capacity */
  burstCapacity: 20,
  /** Refill rate per second */
  refillRate: 1,
  /** Hard limit: max requests per 15-minute window */
  maxRequestsPer15Min: 200,
  /** Cleanup interval (ms) */
  cleanupIntervalMs: 5 * 60 * 1000,
};

let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT_CONFIG.cleanupIntervalMs) return;
  lastCleanup = now;
  const staleThreshold = now - 20 * 60 * 1000;
  for (const [key, entry] of rateLimitStore) {
    if (entry.lastRefill < staleThreshold) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(userId: string, operation: string = "ai"): { allowed: boolean; retryAfterMs?: number } {
  cleanupStaleEntries();
  const key = `${userId}:${operation}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = {
      tokens: RATE_LIMIT_CONFIG.burstCapacity,
      lastRefill: now,
      requestCount: 0,
      windowStart: now,
    };
    rateLimitStore.set(key, entry);
  }

  // Refill tokens
  const elapsed = (now - entry.lastRefill) / 1000;
  entry.tokens = Math.min(
    RATE_LIMIT_CONFIG.burstCapacity,
    entry.tokens + elapsed * RATE_LIMIT_CONFIG.refillRate
  );
  entry.lastRefill = now;

  // Check 15-minute window
  if (now - entry.windowStart > 15 * 60 * 1000) {
    entry.requestCount = 0;
    entry.windowStart = now;
  }

  if (entry.requestCount >= RATE_LIMIT_CONFIG.maxRequestsPer15Min) {
    const retryAfterMs = entry.windowStart + 15 * 60 * 1000 - now;
    return { allowed: false, retryAfterMs };
  }

  // Token bucket check
  if (entry.tokens < 1) {
    const retryAfterMs = Math.ceil((1 - entry.tokens) / RATE_LIMIT_CONFIG.refillRate * 1000);
    return { allowed: false, retryAfterMs };
  }

  entry.tokens -= 1;
  entry.requestCount += 1;
  return { allowed: true };
}

/* ─── Cost Tracking ─── */

export interface AICostEntry {
  userId: string;
  operation: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  timestamp: number;
  durationMs: number;
  success: boolean;
}

const costLog: AICostEntry[] = [];
const MAX_COST_LOG_SIZE = 10000;

/** Approximate cost per 1K tokens by model family */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "claude-3.5-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
  default: { input: 0.003, output: 0.015 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_COSTS[model] || MODEL_COSTS.default;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

export function trackAICost(entry: AICostEntry): void {
  costLog.push(entry);
  if (costLog.length > MAX_COST_LOG_SIZE) {
    costLog.splice(0, costLog.length - MAX_COST_LOG_SIZE);
  }
}

export function getAICostSummary(userId?: string, sinceDaysAgo: number = 30): {
  totalCostUsd: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgDurationMs: number;
  successRate: number;
  byModel: Record<string, { requests: number; costUsd: number; tokens: number }>;
  byOperation: Record<string, { requests: number; costUsd: number }>;
  dailyCosts: Array<{ date: string; costUsd: number; requests: number }>;
} {
  const cutoff = Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000;
  const entries = costLog.filter(e => 
    e.timestamp >= cutoff && (!userId || e.userId === userId)
  );

  const byModel: Record<string, { requests: number; costUsd: number; tokens: number }> = {};
  const byOperation: Record<string, { requests: number; costUsd: number }> = {};
  const dailyMap: Record<string, { costUsd: number; requests: number }> = {};

  let totalCostUsd = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalDurationMs = 0;
  let successCount = 0;

  for (const e of entries) {
    totalCostUsd += e.estimatedCostUsd;
    totalInputTokens += e.inputTokens;
    totalOutputTokens += e.outputTokens;
    totalDurationMs += e.durationMs;
    if (e.success) successCount++;

    // By model
    if (!byModel[e.model]) byModel[e.model] = { requests: 0, costUsd: 0, tokens: 0 };
    byModel[e.model].requests++;
    byModel[e.model].costUsd += e.estimatedCostUsd;
    byModel[e.model].tokens += e.inputTokens + e.outputTokens;

    // By operation
    if (!byOperation[e.operation]) byOperation[e.operation] = { requests: 0, costUsd: 0 };
    byOperation[e.operation].requests++;
    byOperation[e.operation].costUsd += e.estimatedCostUsd;

    // Daily
    const day = new Date(e.timestamp).toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { costUsd: 0, requests: 0 };
    dailyMap[day].costUsd += e.estimatedCostUsd;
    dailyMap[day].requests++;
  }

  const dailyCosts = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  return {
    totalCostUsd,
    totalRequests: entries.length,
    totalInputTokens,
    totalOutputTokens,
    avgDurationMs: entries.length > 0 ? totalDurationMs / entries.length : 0,
    successRate: entries.length > 0 ? successCount / entries.length : 1,
    byModel,
    byOperation,
    dailyCosts,
  };
}

/* ─── Unified Error Handling ─── */

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

export function handleAIError(error: unknown, operation: string): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof AIServiceError) {
    throw new TRPCError({
      code: error.retryable ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR",
      message: `AI ${operation} failed: ${error.message}`,
      cause: error,
    });
  }

  const msg = error instanceof Error ? error.message : String(error);

  // Classify common AI errors
  if (msg.includes("rate_limit") || msg.includes("429")) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `AI rate limit reached for ${operation}. Please try again shortly.`,
    });
  }
  if (msg.includes("context_length") || msg.includes("max_tokens")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Input too long for ${operation}. Please reduce the content size.`,
    });
  }
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    throw new TRPCError({
      code: "TIMEOUT",
      message: `AI ${operation} timed out. Please try again.`,
    });
  }

  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `AI ${operation} encountered an unexpected error.`,
  });
}

/* ─── Model Validation ─── */

const SUPPORTED_MODELS = new Set([
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "claude-3.5-sonnet",
  "claude-3-haiku",
  "auto",
]);

export function validateModel(model: string): string {
  if (model === "auto" || !model) return "gpt-4o";
  if (!SUPPORTED_MODELS.has(model)) {
    // Fall back gracefully rather than error
    return "gpt-4o";
  }
  return model;
}

/* ─── Request Logging ─── */

export interface AIRequestLog {
  id: string;
  userId: string;
  operation: string;
  model: string;
  startTime: number;
  endTime?: number;
  status: "pending" | "success" | "error";
  errorMessage?: string;
  inputPreview?: string;
  outputPreview?: string;
}

const requestLogs: AIRequestLog[] = [];
const MAX_REQUEST_LOGS = 5000;

export function logAIRequest(log: AIRequestLog): void {
  requestLogs.push(log);
  if (requestLogs.length > MAX_REQUEST_LOGS) {
    requestLogs.splice(0, requestLogs.length - MAX_REQUEST_LOGS);
  }
}

export function getRecentAIRequests(userId?: string, limit: number = 50): AIRequestLog[] {
  const filtered = userId
    ? requestLogs.filter(l => l.userId === userId)
    : requestLogs;
  return filtered.slice(-limit).reverse();
}

/* ─── Prompt Versioning ─── */

interface PromptVersion {
  id: string;
  name: string;
  version: number;
  template: string;
  variables: string[];
  createdAt: number;
  active: boolean;
}

const promptRegistry = new Map<string, PromptVersion[]>();

export function registerPrompt(name: string, template: string, variables: string[] = []): PromptVersion {
  const versions = promptRegistry.get(name) || [];
  const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) + 1 : 1;
  
  // Deactivate previous versions
  for (const v of versions) v.active = false;

  const newVersion: PromptVersion = {
    id: `${name}_v${nextVersion}`,
    name,
    version: nextVersion,
    template,
    variables,
    createdAt: Date.now(),
    active: true,
  };

  versions.push(newVersion);
  promptRegistry.set(name, versions);
  return newVersion;
}

export function getActivePrompt(name: string): PromptVersion | undefined {
  const versions = promptRegistry.get(name) || [];
  return versions.find(v => v.active);
}

export function resolvePrompt(name: string, vars: Record<string, string>): string {
  const prompt = getActivePrompt(name);
  if (!prompt) return "";
  let result = prompt.template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export function listPrompts(): Array<{ name: string; activeVersion: number; totalVersions: number }> {
  const result: Array<{ name: string; activeVersion: number; totalVersions: number }> = [];
  for (const [name, versions] of promptRegistry) {
    const active = versions.find(v => v.active);
    result.push({
      name,
      activeVersion: active?.version || 0,
      totalVersions: versions.length,
    });
  }
  return result;
}
