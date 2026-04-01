/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sovereign Intelligence Wiring
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file wires the platform-agnostic @platform/intelligence layer
 * to the Sovereign AI implementation. It creates configured instances
 * that the Sovereign layer imports.
 *
 * Architecture:
 *   Sovereign Wiring → @platform/intelligence (generic) → Sovereign Sources (21 total)
 *                    → @platform/config (generic) → Sovereign Config Store
 *                    → Sovereign Memory Store (enriched)
 *                    → Sovereign LLM Router (cost-aware, quality-tracked)
 *
 * Migration guide (from Stewardly wiring):
 *   BEFORE: import { contextualLLM } from "../shared/intelligence/stewardlyWiring";
 *   AFTER:  import { contextualLLM } from "../shared/intelligence/sovereignWiring";
 *
 *   BEFORE: import { assembleDeepContext } from "../shared/intelligence/stewardlyWiring";
 *   AFTER:  import { assembleDeepContext } from "../shared/intelligence/sovereignWiring";
 *
 * Backward compatibility:
 *   - All Stewardly wiring exports are re-exported for backward compat
 *   - contextualLLM accepts the same params shape
 *   - assembleDeepContext accepts both legacy and platform request shapes
 *   - getQuickContext returns a plain string (matching original API)
 *   - NEW: All LLM calls are tracked with provider usage logging
 *   - NEW: Quality scores are normalized to [0, 1] on all responses
 *   - NEW: Model version is attached to all responses
 */

import { createContextualLLM } from "./contextualLLM";
import {
  assembleDeepContext as platformAssembleDeepContext,
  assembleQuickContext,
} from "./deepContextAssembler";
import type { QuickContextOptions } from "./deepContextAssembler";
import { createMemoryEngine } from "./memoryEngine";
import { normalizeQualityScore } from "./types";
import type { ContextType, ContextualLLMResponse, ContextRequest } from "./types";

// ── Sovereign-specific implementations ──────────────────────────────────────
import { sovereignContextSources } from "./sovereignContextSources";
import { sovereignMemoryStore, SOVEREIGN_MEMORY_CATEGORIES } from "./sovereignMemoryStore";
import {
  sovereignConfigStore,
  DEFAULT_SOVEREIGN_CONFIG,
} from "../config/sovereignConfigStore";
import type { SovereignProviderConfig } from "../config/sovereignConfigStore";

// ── Re-export legacy types for backward compatibility ───────────────────────
export type {
  LegacyContextRequest,
  LegacyAssembledContext,
} from "./stewardlyWiring";

// Import the legacy translation utilities from stewardlyWiring
import {
  assembleDeepContext as stewardlyAssembleDeepContext,
} from "./stewardlyWiring";

// ─── SOVEREIGN LLM ROUTER ──────────────────────────────────────────────────
//
// Wraps the base invokeLLM with:
//   1. Provider usage logging (cost + latency)
//   2. Quality score normalization
//   3. Model version tracking
//   4. Canary route detection
//   5. Failover logic

/** Provider usage log entry */
interface ProviderUsageEntry {
  userId: number | null;
  provider: string;
  modelVersion: string;
  taskType: string;
  latencyMs: number;
  costUsd: number;
  qualityScore: number | null;
  success: boolean;
  timestamp: string;
}

/** In-memory usage log buffer (flushed to DB periodically) */
let usageLogBuffer: ProviderUsageEntry[] = [];
const USAGE_LOG_FLUSH_INTERVAL = 30_000; // 30 seconds
const USAGE_LOG_MAX_BUFFER = 100;
let _flushInProgress = false; // Guard against concurrent flushes

/** Canary route tracking */
interface CanaryState {
  provider: string;
  lastCheck: number;
  isHealthy: boolean;
  consecutiveFailures: number;
}

const canaryStates = new Map<string, CanaryState>();
const CANARY_CHECK_INTERVAL = 60_000; // 1 minute
const CANARY_FAILURE_THRESHOLD = 3;

/** Circuit breaker: if ALL providers fail within this window, fast-fail */
const CIRCUIT_BREAKER_WINDOW_MS = 30_000; // 30 seconds
const CIRCUIT_BREAKER_THRESHOLD = 5; // 5 total failures across all providers
let circuitBreakerFailures: number[] = []; // timestamps of recent failures
let circuitBreakerOpen = false;
let circuitBreakerOpenedAt = 0;
const CIRCUIT_BREAKER_RECOVERY_MS = 15_000; // 15s before half-open

function checkCircuitBreaker(): boolean {
  if (!circuitBreakerOpen) return false;
  // Half-open: allow one probe after recovery period
  if (Date.now() - circuitBreakerOpenedAt > CIRCUIT_BREAKER_RECOVERY_MS) {
    circuitBreakerOpen = false;
    circuitBreakerFailures = [];
    return false;
  }
  return true;
}

function recordCircuitBreakerFailure(): void {
  const now = Date.now();
  circuitBreakerFailures.push(now);
  // Trim old failures outside the window
  circuitBreakerFailures = circuitBreakerFailures.filter(t => now - t < CIRCUIT_BREAKER_WINDOW_MS);
  if (circuitBreakerFailures.length >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreakerOpen = true;
    circuitBreakerOpenedAt = now;
  }
}

function recordCircuitBreakerSuccess(): void {
  circuitBreakerOpen = false;
  circuitBreakerFailures = [];
}

let _baseInvokeLLMFn: ((params: any) => Promise<any>) | null = null;

async function getBaseInvokeLLM(): Promise<(params: any) => Promise<any>> {
  if (_baseInvokeLLMFn) return _baseInvokeLLMFn;

  try {
    const llmModule = await import("../../_core/llm");
    _baseInvokeLLMFn = llmModule.invokeLLM;
    return _baseInvokeLLMFn!;
  } catch {
    // Fallback: direct OpenAI call
    try {
      const openaiModule = await import("openai");
      const OpenAI = openaiModule.default;
      const client = new OpenAI();
      _baseInvokeLLMFn = async (params: any): Promise<ContextualLLMResponse> => {
        const response = await client.chat.completions.create({
          model: params.model || DEFAULT_SOVEREIGN_CONFIG.provider.primaryModel,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 4096,
        });

        return {
          choices: response.choices.map((c: any) => ({
            message: {
              content: c.message.content,
              role: c.message.role,
            },
            finish_reason: c.finish_reason || "stop",
          })),
          model: response.model,
          usage: response.usage
            ? {
                prompt_tokens: response.usage.prompt_tokens,
                completion_tokens: response.usage.completion_tokens,
                total_tokens: response.usage.total_tokens,
              }
            : undefined,
        };
      };
    } catch {
      _baseInvokeLLMFn = async () => {
        throw new Error("No LLM provider available — install openai or ensure _core/llm is accessible");
      };
    }
    return _baseInvokeLLMFn!;
  }
}

/**
 * Sovereign-aware LLM invocation wrapper.
 * Adds provider usage logging, quality normalization, model version tracking,
 * canary detection, and failover.
 */
export async function sovereignInvokeLLM(params: any): Promise<any> {
  const startTime = Date.now();
  const provider = params.model || DEFAULT_SOVEREIGN_CONFIG.provider.primaryModel;
  const modelVersion = DEFAULT_SOVEREIGN_CONFIG.provider.modelVersion;

  // Circuit breaker: fast-fail if all providers are down
  if (checkCircuitBreaker()) {
    throw new Error(
      `[Sovereign] Circuit breaker OPEN: all LLM providers failed within ${CIRCUIT_BREAKER_WINDOW_MS / 1000}s window. ` +
      `Recovery probe in ${Math.max(0, CIRCUIT_BREAKER_RECOVERY_MS - (Date.now() - circuitBreakerOpenedAt))}ms.`
    );
  }

  // Check canary health — but allow recovery probes after cooldown
  const canary = canaryStates.get(provider);
  if (canary && !canary.isHealthy && canary.consecutiveFailures >= CANARY_FAILURE_THRESHOLD) {
    const timeSinceLastCheck = Date.now() - canary.lastCheck;
    // Allow a recovery probe every CANARY_CHECK_INTERVAL
    if (timeSinceLastCheck < CANARY_CHECK_INTERVAL) {
      // Primary is down and cooldown not elapsed — attempt failover
      const fallbackResult = await attemptFailover(params, provider);
      if (fallbackResult) return fallbackResult;
    }
    // If cooldown elapsed or all fallbacks fail, try primary (recovery probe)
  }

  // Budget enforcement: check if hard-stop is active and limit reached
  if (params.userId) {
    try {
      const config = await sovereignConfigStore.getLayerSettings(params.userId);
      const l1 = config.find((l: any) => l.layer === 1);
      const budgetConfig = l1?.settings?.sovereignBudget as any;
      if (budgetConfig?.hardStop && budgetConfig.currentSpendUsd >= budgetConfig.monthlyLimitUsd) {
        throw new Error(
          `[Sovereign] Budget hard-stop: monthly limit of $${budgetConfig.monthlyLimitUsd} reached ` +
          `(current spend: $${budgetConfig.currentSpendUsd}). LLM call blocked.`
        );
      }
    } catch (budgetErr: any) {
      // Only re-throw if it's our budget error; ignore config loading failures
      if (budgetErr?.message?.includes("Budget hard-stop")) throw budgetErr;
    }
  }

  const baseInvoke = await getBaseInvokeLLM();

  try {
    const result = await baseInvoke(params);
    const latencyMs = Date.now() - startTime;

    // Normalize quality score if present
    if (result.metadata?.qualityScore != null) {
      result.metadata.qualityScore = normalizeQualityScore(result.metadata.qualityScore);
    }

    // Attach model version
    if (!result.metadata) result.metadata = {};
    result.metadata.modelVersion = modelVersion;
    result.metadata.provider = provider;
    result.metadata.latencyMs = latencyMs;

    // Log usage
    logProviderUsage({
      userId: params.userId || null,
      provider,
      modelVersion,
      taskType: params.contextType || "unknown",
      latencyMs,
      costUsd: estimateCost(result.usage, provider),
      qualityScore: result.metadata?.qualityScore ?? null,
      success: true,
      timestamp: new Date().toISOString(),
    });

    // Update canary state — healthy
    updateCanaryState(provider, true);
    recordCircuitBreakerSuccess();

    return result;
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    // Log failure
    logProviderUsage({
      userId: params.userId || null,
      provider,
      modelVersion,
      taskType: params.contextType || "unknown",
      latencyMs,
      costUsd: 0,
      qualityScore: null,
      success: false,
      timestamp: new Date().toISOString(),
    });

    // Update canary state — unhealthy
    updateCanaryState(provider, false);
    recordCircuitBreakerFailure();

    // Attempt failover
    const fallbackResult = await attemptFailover(params, provider);
    if (fallbackResult) {
      recordCircuitBreakerSuccess();
      return fallbackResult;
    }

    throw error;
  }
}

/**
 * Attempt failover to alternative providers.
 */
async function attemptFailover(params: any, failedProvider: string): Promise<any | null> {
  const fallbacks = DEFAULT_SOVEREIGN_CONFIG.provider.fallbackModels.filter(
    (m) => m !== failedProvider,
  );

  const baseInvoke = await getBaseInvokeLLM();

  for (const fallback of fallbacks) {
    try {
      const startTime = Date.now();
      const result = await baseInvoke({ ...params, model: fallback });
      const latencyMs = Date.now() - startTime;

      // Normalize and annotate
      if (result.metadata?.qualityScore != null) {
        result.metadata.qualityScore = normalizeQualityScore(result.metadata.qualityScore);
      }
      if (!result.metadata) result.metadata = {};
      result.metadata.modelVersion = DEFAULT_SOVEREIGN_CONFIG.provider.modelVersion;
      result.metadata.provider = fallback;
      result.metadata.latencyMs = latencyMs;
      result.metadata.failoverFrom = failedProvider;

      logProviderUsage({
        userId: params.userId || null,
        provider: fallback,
        modelVersion: DEFAULT_SOVEREIGN_CONFIG.provider.modelVersion,
        taskType: params.contextType || "unknown",
        latencyMs,
        costUsd: estimateCost(result.usage, fallback),
        qualityScore: result.metadata?.qualityScore ?? null,
        success: true,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch {
      // Try next fallback
      continue;
    }
  }

  return null;
}

/**
 * Update canary state for a provider.
 */
function updateCanaryState(provider: string, healthy: boolean): void {
  const existing = canaryStates.get(provider) || {
    provider,
    lastCheck: 0,
    isHealthy: true,
    consecutiveFailures: 0,
  };

  if (healthy) {
    existing.isHealthy = true;
    existing.consecutiveFailures = 0;
  } else {
    existing.consecutiveFailures++;
    if (existing.consecutiveFailures >= CANARY_FAILURE_THRESHOLD) {
      existing.isHealthy = false;
    }
  }

  existing.lastCheck = Date.now();
  canaryStates.set(provider, existing);
}

/**
 * Estimate cost for a provider call based on token usage.
 */
function estimateCost(
  usage: { prompt_tokens: number; completion_tokens: number } | undefined,
  provider: string,
): number {
  if (!usage) return 0;

  // Cost per 1K tokens (approximate)
  const costTable: Record<string, { input: number; output: number }> = {
    "gemini-2.5-flash": { input: 0.00015, output: 0.0006 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
    "gpt-4.1-nano": { input: 0.0001, output: 0.0004 },
    "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
  };

  const rates = costTable[provider] || { input: 0.0002, output: 0.0008 };
  return (
    (usage.prompt_tokens / 1000) * rates.input +
    (usage.completion_tokens / 1000) * rates.output
  );
}

/**
 * Log provider usage to the buffer.
 */
function logProviderUsage(entry: ProviderUsageEntry): void {
  usageLogBuffer.push(entry);

  if (usageLogBuffer.length >= USAGE_LOG_MAX_BUFFER) {
    flushUsageLogs().catch(() => {});
  }
}

/**
 * Flush usage logs to the database.
 * Uses a lock to prevent concurrent flushes (race condition fix).
 */
async function flushUsageLogs(): Promise<void> {
  if (usageLogBuffer.length === 0) return;
  if (_flushInProgress) return; // Prevent concurrent flushes
  _flushInProgress = true;

  // Atomic swap: take current buffer, replace with empty
  const entries = usageLogBuffer;
  usageLogBuffer = [];

  try {
    const db = await (await import("../../db")).getDb();
    if (!db) {
      // DB unavailable — re-buffer but cap to prevent unbounded growth
      if (usageLogBuffer.length < USAGE_LOG_MAX_BUFFER * 3) {
        usageLogBuffer.unshift(...entries);
      }
      // else: drop oldest entries silently to prevent memory leak
      return;
    }

    const schema = await import("../../../drizzle/schema").catch(() => null);
    if (!schema?.sovereignProviderUsageLogs) return;

    await db.insert(schema.sovereignProviderUsageLogs).values(
      entries.map((e) => ({
        userId: e.userId,
        provider: e.provider,
        modelVersion: e.modelVersion,
        taskType: e.taskType,
        latencyMs: e.latencyMs,
        costUsd: e.costUsd,
        qualityScore: e.qualityScore,
        success: e.success,
      })),
    );
  } catch {
    // Re-add entries to buffer if flush fails, but cap to prevent memory leak
    if (usageLogBuffer.length < USAGE_LOG_MAX_BUFFER * 3) {
      usageLogBuffer.unshift(...entries);
    }
  } finally {
    _flushInProgress = false;
  }
}

// Start periodic flush
setInterval(() => {
  flushUsageLogs().catch(() => {});
}, USAGE_LOG_FLUSH_INTERVAL);

// ── Cached contextualLLM instance ───────────────────────────────────────────

let _contextualLLMFn: ((params: any) => Promise<any>) | null = null;

/**
 * Sovereign-aware contextualLLM.
 * Uses the Sovereign context sources (21 total) and the Sovereign LLM router.
 */
export async function contextualLLM(params: {
  userId?: number | null;
  contextType?: ContextType;
  query?: string;
  messages: Array<{ role: string; content: any }>;
  [key: string]: any;
}) {
  if (!_contextualLLMFn) {
    _contextualLLMFn = createContextualLLM({
      registry: sovereignContextSources,
      invokeLLM: sovereignInvokeLLM,
    });
  }
  return _contextualLLMFn(params);
}

// ── Cached memory engine instance ───────────────────────────────────────────

let _memoryEngine: ReturnType<typeof createMemoryEngine> | null = null;

/**
 * Get the Sovereign memory engine with enriched categories.
 */
export async function getMemoryEngine() {
  if (_memoryEngine) return _memoryEngine;

  _memoryEngine = createMemoryEngine({
    store: sovereignMemoryStore,
    llm: async (params) => sovereignInvokeLLM({ messages: params.messages }),
    categories: SOVEREIGN_MEMORY_CATEGORIES,
  });
  return _memoryEngine;
}

// ─── BACKWARD-COMPATIBLE assembleDeepContext ────────────────────────────────

// Import legacy types and translation from stewardlyWiring
import type { LegacyContextRequest, LegacyAssembledContext } from "./stewardlyWiring";

// Source-to-flat-field mapping (extended for Sovereign sources)
const SOURCE_TO_FLAT_FIELD: Record<string, string> = {
  documents: "documentContext",
  knowledgeBase: "knowledgeBaseContext",
  userProfile: "userProfileContext",
  suitability: "suitabilityContext",
  memory: "memoryContext",
  graph: "graphContext",
  pipelineData: "pipelineDataContext",
  conversationHistory: "conversationContext",
  integrations: "integrationContext",
  calculators: "calculatorContext",
  insights: "insightContext",
  clientRelationships: "clientContext",
  activityLog: "activityContext",
  tags: "tagContext",
  gapFeedback: "gapFeedbackContext",
  // Sovereign-specific flat fields
  routingDecisions: "routingDecisionContext",
  goalsPlansAndTasks: "goalsPlansTasksContext",
  reflections: "reflectionContext",
  providerUsageLogs: "providerUsageContext",
  budgets: "budgetContext",
  autonomyState: "autonomyContext",
};

const BOOLEAN_FLAG_TO_SOURCE: Record<string, string> = {
  includeDocuments: "documents",
  includeKnowledgeBase: "knowledgeBase",
  includeMemories: "memory",
  includeConversationHistory: "conversationHistory",
  includePipelineData: "pipelineData",
  includeIntegrations: "integrations",
  includeCalculators: "calculators",
  includeInsights: "insights",
  includeClientData: "clientRelationships",
  includeActivityLog: "activityLog",
  includeFinancialData: "integrations",
};

function translateLegacyRequest(legacy: LegacyContextRequest): ContextRequest {
  const excludeSources: string[] = [];
  for (const [flag, sourceName] of Object.entries(BOOLEAN_FLAG_TO_SOURCE)) {
    const value = (legacy as Record<string, unknown>)[flag];
    if (value === false) {
      excludeSources.push(sourceName);
    }
  }
  return {
    userId: legacy.userId,
    query: legacy.query,
    contextType: legacy.contextType,
    maxTokenBudget: legacy.maxTokenBudget,
    excludeSources: excludeSources.length > 0 ? excludeSources : undefined,
    conversationId: legacy.conversationId,
    specificDocIds: legacy.specificDocIds,
    category: legacy.category,
  };
}

/**
 * Sovereign assembleDeepContext.
 * Accepts legacy or platform request shapes.
 * Returns extended flat-field context including Sovereign sources.
 */
export async function assembleDeepContext(
  request: LegacyContextRequest | ContextRequest,
): Promise<LegacyAssembledContext & Record<string, string>> {
  const isLegacy = "includeDocuments" in request ||
    "includeKnowledgeBase" in request ||
    "includeMemories" in request;

  const platformRequest = isLegacy
    ? translateLegacyRequest(request as LegacyContextRequest)
    : request as ContextRequest;

  const platformResult = await platformAssembleDeepContext(
    sovereignContextSources,
    platformRequest,
  );

  // Build extended flat-field result
  const flat: Record<string, string> = {};
  for (const fieldName of Object.values(SOURCE_TO_FLAT_FIELD)) {
    flat[fieldName] = "";
  }
  for (const [sourceName, content] of Object.entries(platformResult.sourceContexts)) {
    const flatField = SOURCE_TO_FLAT_FIELD[sourceName];
    if (flatField) {
      flat[flatField] = content;
    }
  }

  return {
    documentContext: flat.documentContext || "",
    knowledgeBaseContext: flat.knowledgeBaseContext || "",
    userProfileContext: flat.userProfileContext || "",
    suitabilityContext: flat.suitabilityContext || "",
    memoryContext: flat.memoryContext || "",
    graphContext: flat.graphContext || "",
    pipelineDataContext: flat.pipelineDataContext || "",
    conversationContext: flat.conversationContext || "",
    integrationContext: flat.integrationContext || "",
    calculatorContext: flat.calculatorContext || "",
    insightContext: flat.insightContext || "",
    clientContext: flat.clientContext || "",
    activityContext: flat.activityContext || "",
    tagContext: flat.tagContext || "",
    gapFeedbackContext: flat.gapFeedbackContext || "",
    fullContextPrompt: platformResult.fullContextPrompt,
    sourcesUsed: platformResult.metadata.sourcesHit,
    totalChunksRetrieved: estimateChunkCount(platformResult.sourceContexts),
    retrievalQuality: platformResult.metadata.retrievalQuality,
    // Sovereign-specific flat fields
    routingDecisionContext: flat.routingDecisionContext || "",
    goalsPlansTasksContext: flat.goalsPlansTasksContext || "",
    reflectionContext: flat.reflectionContext || "",
    providerUsageContext: flat.providerUsageContext || "",
    budgetContext: flat.budgetContext || "",
    autonomyContext: flat.autonomyContext || "",
  } as LegacyAssembledContext & Record<string, string>;
}

function estimateChunkCount(sourceContexts: Record<string, string>): number {
  const docContent = sourceContexts.documents || "";
  if (!docContent) return 0;
  const matches = docContent.match(/\[Source:/g);
  return matches ? matches.length : 0;
}

/**
 * Platform-native assembleContext (returns the new API shape).
 */
export async function assembleContext(request: ContextRequest) {
  return platformAssembleDeepContext(sovereignContextSources, request);
}

// ─── BACKWARD-COMPATIBLE getQuickContext ────────────────────────────────────

function translateOverrides(
  overrides?: Record<string, unknown>,
): { maxTokenBudget: number | undefined; options: QuickContextOptions } {
  if (!overrides) return { maxTokenBudget: undefined, options: {} };

  const excludeList: string[] = [];
  for (const [flag, sourceName] of Object.entries(BOOLEAN_FLAG_TO_SOURCE)) {
    if (overrides[flag] === false) excludeList.push(sourceName);
  }

  return {
    maxTokenBudget: overrides.maxTokenBudget as number | undefined,
    options: {
      conversationId: overrides.conversationId as number | undefined,
      specificDocIds: overrides.specificDocIds as number[] | undefined,
      category: overrides.category as string | undefined,
      excludeSources: excludeList.length > 0 ? excludeList : undefined,
      includeSources: overrides.includeSources as string[] | undefined,
    },
  };
}

/**
 * Backward-compatible getQuickContext.
 */
export async function getQuickContext(
  userId: number,
  query: string,
  contextType: ContextType,
  overrides?: Record<string, unknown>,
): Promise<string> {
  const { maxTokenBudget, options } = translateOverrides(overrides);
  const { contextPrompt } = await assembleQuickContext(
    sovereignContextSources,
    userId,
    query,
    contextType,
    maxTokenBudget,
    options,
  );
  return contextPrompt;
}

/**
 * Extended getQuickContext with metadata.
 */
export async function getQuickContextWithMetadata(
  userId: number,
  query: string,
  contextType: ContextType,
  overrides?: Record<string, unknown>,
) {
  const { maxTokenBudget, options } = translateOverrides(overrides);
  return assembleQuickContext(
    sovereignContextSources,
    userId,
    query,
    contextType,
    maxTokenBudget,
    options,
  );
}

// ── Sovereign-specific exports ──────────────────────────────────────────────
export { sovereignContextSources } from "./sovereignContextSources";
export { sovereignMemoryStore, SOVEREIGN_MEMORY_CATEGORIES } from "./sovereignMemoryStore";
export { sovereignConfigStore } from "../config/sovereignConfigStore";
export { sovereignInvokeLLM as invokeLLM };
export type { ContextType } from "./types";

// ── Canary and health check exports ─────────────────────────────────────────
export function getCanaryStates(): Map<string, CanaryState> {
  return new Map(canaryStates);
}

export function getUsageLogBuffer(): ProviderUsageEntry[] {
  return [...usageLogBuffer];
}

export function isProviderHealthy(provider: string): boolean {
  const state = canaryStates.get(provider);
  if (!state) return true; // Unknown providers assumed healthy
  return state.isHealthy;
}
