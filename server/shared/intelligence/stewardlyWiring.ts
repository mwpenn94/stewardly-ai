/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stewardly Intelligence Wiring
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file wires the platform-agnostic @platform/intelligence layer
 * to Stewardly's specific implementations. It creates the configured
 * instances that the rest of the Stewardly codebase should import.
 *
 * Migration guide:
 *   BEFORE: import { contextualLLM } from "../services/contextualLLM";
 *   AFTER:  import { contextualLLM } from "../shared/intelligence/stewardlyWiring";
 *
 *   BEFORE: import { assembleDeepContext, getQuickContext } from "../services/deepContextAssembler";
 *   AFTER:  import { assembleDeepContext, getQuickContext } from "../shared/intelligence/stewardlyWiring";
 *
 *   BEFORE: import { extractMemoriesFromMessage } from "../memoryEngine";
 *   AFTER:  import { memoryEngine } from "../shared/intelligence/stewardlyWiring";
 *           memoryEngine.extractMemoriesFromMessage(...)
 *
 * Backward compatibility:
 *   - contextualLLM accepts the same params shape as the original
 *     (userId, contextType, query, messages, ...rest)
 *   - assembleDeepContext accepts the original ContextRequest shape
 *     (with boolean include flags) and returns the original flat-field
 *     AssembledContext shape (documentContext, knowledgeBaseContext, etc.)
 *   - getQuickContext returns a plain string (matching the original API)
 *   - getQuickContext accepts optional 4th param: overrides
 *   - messages support both string and array content blocks
 */

import { createContextualLLM } from "./contextualLLM";
import {
  assembleDeepContext as platformAssembleDeepContext,
  assembleQuickContext,
} from "./deepContextAssembler";
import { createMemoryEngine } from "./memoryEngine";
import { EXTENDED_MEMORY_CATEGORIES } from "./types";
import type { ContextType, ContextualLLMResponse, ContextRequest } from "./types";

// ── Stewardly-specific implementations ───────────────────────────────────────
import { stewardlyContextSources } from "./stewardlyContextSources";
import { stewardlyMemoryStore } from "./stewardlyMemoryStore";

// ─── LEGACY TYPES ───────────────────────────────────────────────────────────
//
// These types match the original deepContextAssembler.ts interfaces exactly,
// ensuring that production code accessing flat fields continues to work.

/**
 * Legacy ContextRequest with boolean include flags.
 * Maps to the original server/services/deepContextAssembler.ts interface.
 */
export interface LegacyContextRequest {
  userId: number;
  query: string;
  contextType: ContextType;
  maxTokenBudget?: number;
  includeFinancialData?: boolean;
  includeConversationHistory?: boolean;
  includePipelineData?: boolean;
  includeDocuments?: boolean;
  includeKnowledgeBase?: boolean;
  includeMemories?: boolean;
  includeIntegrations?: boolean;
  includeCalculators?: boolean;
  includeInsights?: boolean;
  includeClientData?: boolean;
  includeActivityLog?: boolean;
  conversationId?: number;
  specificDocIds?: number[];
  category?: string;
}

/**
 * Legacy AssembledContext with flat per-source fields.
 * Maps to the original server/services/deepContextAssembler.ts interface.
 */
export interface LegacyAssembledContext {
  documentContext: string;
  knowledgeBaseContext: string;
  userProfileContext: string;
  suitabilityContext: string;
  memoryContext: string;
  graphContext: string;
  pipelineDataContext: string;
  conversationContext: string;
  integrationContext: string;
  calculatorContext: string;
  insightContext: string;
  clientContext: string;
  activityContext: string;
  tagContext: string;
  gapFeedbackContext: string;
  fullContextPrompt: string;
  sourcesUsed: string[];
  totalChunksRetrieved: number;
  retrievalQuality: "high" | "medium" | "low";
}

// ─── BOOLEAN FLAG → SOURCE NAME MAPPING ─────────────────────────────────────
//
// The original ContextRequest uses boolean flags like `includeDocuments: false`
// to exclude specific sources. This map translates those flags to source names
// in the registry so the platform assembler can use `excludeSources`.

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
  includeFinancialData: "integrations", // financial data comes from integrations source
};

// ─── SOURCE NAME → FLAT FIELD MAPPING ───────────────────────────────────────
//
// Maps registry source names to the legacy flat field names on AssembledContext.

const SOURCE_TO_FLAT_FIELD: Record<string, keyof LegacyAssembledContext> = {
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
};

/**
 * Translate a legacy ContextRequest (with boolean include flags)
 * into the platform-agnostic ContextRequest (with excludeSources).
 */
function translateLegacyRequest(legacy: LegacyContextRequest): ContextRequest {
  const excludeSources: string[] = [];

  for (const [flag, sourceName] of Object.entries(BOOLEAN_FLAG_TO_SOURCE)) {
    const value = (legacy as Record<string, unknown>)[flag];
    // Only exclude if explicitly set to false (undefined = include)
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
 * Map the platform AssembledContext (sourceContexts record) to the legacy
 * flat-field AssembledContext that production code expects.
 */
function toLegacyAssembledContext(
  platformResult: Awaited<ReturnType<typeof platformAssembleDeepContext>>,
): LegacyAssembledContext {
  const flat: Record<string, string> = {};

  // Initialize all flat fields to empty string
  for (const fieldName of Object.values(SOURCE_TO_FLAT_FIELD)) {
    flat[fieldName] = "";
  }

  // Map source results to flat fields
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
  };
}

/**
 * Estimate the number of document chunks retrieved by counting
 * [Source: ...] markers in the documents source result.
 * The stewardlyContextSources.documents function formats each chunk as:
 *   [Source: "filename" (category)]\ncontent\n\n---\n\n
 */
function estimateChunkCount(sourceContexts: Record<string, string>): number {
  const docContent = sourceContexts.documents || "";
  if (!docContent) return 0;
  // Count [Source: markers — each represents one retrieved chunk
  const matches = docContent.match(/\[Source:/g);
  return matches ? matches.length : 0;
}

// ── LLM invocation (delegates to Stewardly's existing _core/llm) ────────────
//
// We use dynamic import (ESM-compatible) to load Stewardly's existing invokeLLM
// rather than creating a new OpenAI client, so that model routing, API keys,
// failover, and logging all remain centralized in _core/llm.

let _invokeLLMFn: ((params: any) => Promise<any>) | null = null;

async function getInvokeLLM(): Promise<(params: any) => Promise<any>> {
  if (_invokeLLMFn) return _invokeLLMFn;

  try {
    const llmModule = await import("../../_core/llm");
    _invokeLLMFn = llmModule.invokeLLM;
    return _invokeLLMFn!;
  } catch {
    // Fallback: direct OpenAI call if _core/llm is not available
    // (e.g., when used outside the Stewardly monorepo for testing)
    try {
      const openaiModule = await import("openai");
      const OpenAI = openaiModule.default;
      const client = new OpenAI();
      _invokeLLMFn = async (params: any): Promise<ContextualLLMResponse> => {
        const response = await client.chat.completions.create({
          model: params.model || "gpt-4o-mini",
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
      _invokeLLMFn = async () => {
        throw new Error("No LLM provider available — install openai or ensure _core/llm is accessible");
      };
    }
    return _invokeLLMFn!;
  }
}

// ── Cached contextualLLM instance ───────────────────────────────────────────
//
// createContextualLLM is a pure factory — the returned function is stateless
// and safe to cache for the lifetime of the process.

let _contextualLLMFn: ((params: any) => Promise<any>) | null = null;

/**
 * Drop-in replacement for the original contextualLLM function.
 * Now uses the platform-agnostic layer with Stewardly's context sources.
 *
 * Accepts the same params shape as the original:
 *   contextualLLM({ userId, contextType, query, messages, ...rest })
 *
 * Note: Uses lazy-loaded invokeLLM to support ESM dynamic imports.
 * The factory result is cached after first call.
 */
export async function contextualLLM(params: {
  userId?: number | null;
  contextType?: ContextType;
  query?: string;
  messages: Array<{ role: string; content: any }>;
  [key: string]: any;
}) {
  if (!_contextualLLMFn) {
    const invokeLLM = await getInvokeLLM();
    _contextualLLMFn = createContextualLLM({
      registry: stewardlyContextSources,
      invokeLLM,
    });
  }
  return _contextualLLMFn(params);
}

// ── Cached memory engine instance ───────────────────────────────────────────

let _memoryEngine: ReturnType<typeof createMemoryEngine> | null = null;

/**
 * Get the wired memory engine with Stewardly's database and extended categories
 * (includes amp_engagement and ho_domain_trajectory).
 * Instance is cached after first creation.
 */
export async function getMemoryEngine() {
  if (_memoryEngine) return _memoryEngine;

  const invokeLLM = await getInvokeLLM();
  _memoryEngine = createMemoryEngine({
    store: stewardlyMemoryStore,
    llm: async (params) => invokeLLM({ messages: params.messages }),
    categories: EXTENDED_MEMORY_CATEGORIES,
  });
  return _memoryEngine;
}

// ─── BACKWARD-COMPATIBLE assembleDeepContext ────────────────────────────────
//
// This is the key backward-compat adapter. It accepts the original
// LegacyContextRequest (with boolean include flags) and returns the original
// flat-field LegacyAssembledContext shape that production code expects.
//
// Production code like routers.ts accesses:
//   deepContext?.documentContext
//   deepContext?.memoryContext
//   deepContext?.graphContext
//   deepContext?.insightContext
//   deepContext?.integrationContext
//   deepContext?.fullContextPrompt

/**
 * Backward-compatible assembleDeepContext.
 *
 * Accepts either:
 *   - LegacyContextRequest (with boolean include flags) — original API
 *   - ContextRequest (with includeSources/excludeSources) — new API
 *
 * Returns the legacy flat-field AssembledContext shape with individual
 * per-source context strings (documentContext, memoryContext, etc.).
 */
export async function assembleDeepContext(
  request: LegacyContextRequest | ContextRequest,
): Promise<LegacyAssembledContext> {
  // Detect whether this is a legacy request (has boolean include flags)
  // or a platform request (has includeSources/excludeSources)
  const isLegacy = "includeDocuments" in request ||
    "includeKnowledgeBase" in request ||
    "includeMemories" in request ||
    "includeConversationHistory" in request ||
    "includePipelineData" in request ||
    "includeIntegrations" in request ||
    "includeCalculators" in request ||
    "includeInsights" in request ||
    "includeClientData" in request ||
    "includeActivityLog" in request ||
    "includeFinancialData" in request;

  const platformRequest = isLegacy
    ? translateLegacyRequest(request as LegacyContextRequest)
    : request as ContextRequest;

  const platformResult = await platformAssembleDeepContext(
    stewardlyContextSources,
    platformRequest,
  );

  return toLegacyAssembledContext(platformResult);
}

/**
 * Convenience: assemble deep context using the platform API directly.
 * Returns the platform AssembledContext with sourceContexts record and metadata.
 * Use this when you want the new API shape.
 */
export async function assembleContext(request: ContextRequest) {
  return platformAssembleDeepContext(stewardlyContextSources, request);
}

// ─── BACKWARD-COMPATIBLE getQuickContext ────────────────────────────────────

/**
 * Backward-compatible getQuickContext that returns a plain string.
 * Matches the original API:
 *   getQuickContext(userId, query, contextType, overrides?) => string
 *
 * The optional 4th parameter `overrides` supports both:
 *   - Legacy boolean flags (includeDocuments: false, etc.)
 *   - Platform fields (maxTokenBudget, includeSources, etc.)
 */
export async function getQuickContext(
  userId: number,
  query: string,
  contextType: ContextType,
  overrides?: Partial<LegacyContextRequest> | Partial<ContextRequest>,
): Promise<string> {
  // Translate overrides (boolean flags + platform fields) into a
  // platform ContextRequest and delegate to assembleDeepContext.
  // This matches the original pattern: getQuickContext spread overrides
  // directly into assembleDeepContext({ userId, query, contextType, ...overrides }).
  let excludeSources: string[] | undefined;
  let maxTokenBudget: number | undefined;
  let includeSources: string[] | undefined;

  if (overrides) {
    // Translate boolean include flags to excludeSources
    const excludeList: string[] = [];
    for (const [flag, sourceName] of Object.entries(BOOLEAN_FLAG_TO_SOURCE)) {
      const value = (overrides as Record<string, unknown>)[flag];
      if (value === false) {
        excludeList.push(sourceName);
      }
    }
    if (excludeList.length > 0) {
      excludeSources = excludeList;
    }
    // Pass through platform fields
    maxTokenBudget = (overrides as any).maxTokenBudget;
    includeSources = (overrides as any).includeSources;
  }

  const platformResult = await platformAssembleDeepContext(
    stewardlyContextSources,
    {
      userId,
      query,
      contextType,
      maxTokenBudget,
      excludeSources,
      includeSources,
    },
  );
  return platformResult.fullContextPrompt;
}

/**
 * Extended getQuickContext that also returns metadata.
 * Use this when you need contextSourceHitRate or other assembly metadata.
 */
export async function getQuickContextWithMetadata(
  userId: number,
  query: string,
  contextType: ContextType,
) {
  return assembleQuickContext(stewardlyContextSources, userId, query, contextType);
}

// ── Re-exports for backward compatibility ────────────────────────────────────
export { stewardlyContextSources } from "./stewardlyContextSources";
export { stewardlyMemoryStore } from "./stewardlyMemoryStore";
export type { ContextType } from "./types";
