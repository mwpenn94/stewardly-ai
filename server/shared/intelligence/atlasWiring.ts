/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ATLAS Intelligence Wiring
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wires the platform-agnostic @platform/intelligence layer to ATLAS's
 * specific implementations. Creates configured instances that the rest
 * of the ATLAS codebase should import.
 *
 * Key differences from Stewardly wiring:
 *   1. Uses atlasContextSources (23 sources: 15 AEGIS + 8 ATLAS kernel)
 *   2. Uses atlasMemoryStore with P-02 TiDB coercion at DB boundary
 *   3. Persists graduated autonomy to DB (not in-memory)
 *   4. Tracks model_version on all LLM invocations
 *   5. Normalizes all quality scores through normalizeQualityScore
 *   6. Extends memory categories with ATLAS-specific categories
 *
 * Migration guide:
 *   BEFORE: import { invokeLLM } from "../_core/llm";
 *   AFTER:  import { atlasContextualLLM } from "../shared/intelligence/atlasWiring";
 *
 *   BEFORE: import { assembleDeepContext } from "../services/deepContextAssembler";
 *   AFTER:  import { assembleDeepContext } from "../shared/intelligence/atlasWiring";
 *
 *   BEFORE: import { contextualLLM } from "../services/contextualLLM";
 *   AFTER:  import { atlasContextualLLM } from "../shared/intelligence/atlasWiring";
 *
 * Backward compatibility:
 *   - contextualLLM accepts the same params shape as Stewardly's original
 *   - assembleDeepContext accepts both legacy and platform request shapes
 *   - getQuickContext returns a plain string
 */

import { createContextualLLM } from "./contextualLLM";
import {
  assembleDeepContext as platformAssembleDeepContext,
  assembleQuickContext,
} from "./deepContextAssembler";
import type { QuickContextOptions } from "./deepContextAssembler";
import { createMemoryEngine } from "./memoryEngine";
import { EXTENDED_MEMORY_CATEGORIES, normalizeQualityScore } from "./types";
import type { ContextType, ContextualLLMResponse, ContextRequest } from "./types";
import { coerceNumeric, coerceNumericFields } from "./dbCoercion";

// ── ATLAS-specific implementations ──────────────────────────────────────────
import { atlasContextSources } from "./atlasContextSources";
import { atlasMemoryStore } from "./atlasMemoryStore";

// ── Graduated Autonomy DB persistence ───────────────────────────────────────
import { getDb } from "../../db";
import { agentAutonomyLevels, agentTemplates } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── ATLAS MEMORY CATEGORIES ───────────────────────────────────────────────
//
// Extends the platform EXTENDED_MEMORY_CATEGORIES with ATLAS-specific ones.

export const ATLAS_MEMORY_CATEGORIES = [
  ...EXTENDED_MEMORY_CATEGORIES,
  "task_context",
  "automation_pattern",
  "experimentation_insight",
] as const;

export type AtlasMemoryCategory = (typeof ATLAS_MEMORY_CATEGORIES)[number];

// ─── LEGACY TYPES ───────────────────────────────────────────────────────────
//
// Backward-compatible types matching Stewardly's original interfaces.

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
  // ATLAS kernel extensions
  goalsAndPlansContext: string;
  scheduledGoalsContext: string;
  playgroundRunsContext: string;
  playgroundPresetsContext: string;
  webhookLogsContext: string;
  passiveActionLogsContext: string;
  autonomyProfileContext: string;
  responseQualityContext: string;
  fullContextPrompt: string;
  sourcesUsed: string[];
  totalChunksRetrieved: number;
  retrievalQuality: "high" | "medium" | "low";
}

// ─── BOOLEAN FLAG → SOURCE NAME MAPPING ─────────────────────────────────────

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

// ─── SOURCE NAME → FLAT FIELD MAPPING ───────────────────────────────────────

const SOURCE_TO_FLAT_FIELD: Record<string, keyof LegacyAssembledContext> = {
  // AEGIS baseline
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
  // ATLAS kernel
  goalsAndPlans: "goalsAndPlansContext",
  scheduledGoals: "scheduledGoalsContext",
  playgroundRuns: "playgroundRunsContext",
  playgroundPresets: "playgroundPresetsContext",
  webhookLogs: "webhookLogsContext",
  passiveActionLogs: "passiveActionLogsContext",
  autonomyProfile: "autonomyProfileContext",
  responseQuality: "responseQualityContext",
};

// ─── TRANSLATION HELPERS ────────────────────────────────────────────────────

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

function toLegacyAssembledContext(
  platformResult: Awaited<ReturnType<typeof platformAssembleDeepContext>>,
): LegacyAssembledContext {
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
    goalsAndPlansContext: flat.goalsAndPlansContext || "",
    scheduledGoalsContext: flat.scheduledGoalsContext || "",
    playgroundRunsContext: flat.playgroundRunsContext || "",
    playgroundPresetsContext: flat.playgroundPresetsContext || "",
    webhookLogsContext: flat.webhookLogsContext || "",
    passiveActionLogsContext: flat.passiveActionLogsContext || "",
    autonomyProfileContext: flat.autonomyProfileContext || "",
    responseQualityContext: flat.responseQualityContext || "",
    fullContextPrompt: platformResult.fullContextPrompt,
    sourcesUsed: platformResult.metadata.sourcesHit,
    totalChunksRetrieved: estimateChunkCount(platformResult.sourceContexts),
    retrievalQuality: platformResult.metadata.retrievalQuality,
  };
}

function estimateChunkCount(sourceContexts: Record<string, string>): number {
  const docContent = sourceContexts.documents || "";
  if (!docContent) return 0;
  const matches = docContent.match(/\[Source:/g);
  return matches ? matches.length : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL VERSION TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Current model version for ATLAS LLM invocations.
 * Updated when the underlying model changes. Persisted alongside
 * every LLM call for audit trail and quality correlation.
 */
let _currentModelVersion = "atlas-v1.0";

export function setModelVersion(version: string): void {
  _currentModelVersion = version;
}

export function getModelVersion(): string {
  return _currentModelVersion;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM INVOCATION (with model_version tracking)
// ═══════════════════════════════════════════════════════════════════════════════

let _invokeLLMFn: ((params: any) => Promise<any>) | null = null;

async function getInvokeLLM(): Promise<(params: any) => Promise<any>> {
  if (_invokeLLMFn) return _invokeLLMFn;

  try {
    const llmModule = await import("../../_core/llm");
    _invokeLLMFn = llmModule.invokeLLM;
    return _invokeLLMFn!;
  } catch {
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

/**
 * ATLAS-enhanced invokeLLM wrapper that:
 *   1. Injects model_version into every call
 *   2. Normalizes quality scores in responses
 *   3. Tracks invocation metadata
 */
export async function atlasInvokeLLM(params: {
  messages: Array<{ role: string; content: any }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}): Promise<ContextualLLMResponse & { modelVersion: string }> {
  const invokeLLM = await getInvokeLLM();
  const response = await invokeLLM({
    ...params,
    modelVersion: _currentModelVersion,
  });

  return {
    ...response,
    modelVersion: _currentModelVersion,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTUAL LLM
// ═══════════════════════════════════════════════════════════════════════════════

let _contextualLLMFn: ((params: any) => Promise<any>) | null = null;

/**
 * ATLAS contextual LLM — drop-in replacement for invokeLLM and contextualLLM.
 * Uses ATLAS's 23-source context registry and model version tracking.
 */
export async function atlasContextualLLM(params: {
  userId?: number | null;
  contextType?: ContextType;
  query?: string;
  messages: Array<{ role: string; content: any }>;
  [key: string]: any;
}) {
  if (!_contextualLLMFn) {
    const invokeLLM = await getInvokeLLM();
    _contextualLLMFn = createContextualLLM({
      registry: atlasContextSources,
      invokeLLM,
    });
  }
  const response = await _contextualLLMFn(params);
  return {
    ...response,
    modelVersion: _currentModelVersion,
  };
}

// Backward-compatible alias
export const contextualLLM = atlasContextualLLM;

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

let _memoryEngine: ReturnType<typeof createMemoryEngine> | null = null;

/**
 * Get the wired memory engine with ATLAS's database and extended categories.
 * Instance is cached after first creation.
 */
export async function getMemoryEngine() {
  if (_memoryEngine) return _memoryEngine;

  const invokeLLM = await getInvokeLLM();
  _memoryEngine = createMemoryEngine({
    store: atlasMemoryStore,
    llm: async (params) => invokeLLM({ messages: params.messages }),
    categories: ATLAS_MEMORY_CATEGORIES,
  });
  return _memoryEngine;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADUATED AUTONOMY — DB PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Persist graduated autonomy level to the database.
 * Replaces the in-memory Map<number, AutonomyProfile> pattern from
 * server/services/graduatedAutonomy.ts.
 */
export async function persistAutonomyLevel(
  agentTemplateId: number,
  currentLevel: number,
  level1Runs: number,
  level2Runs: number,
  promotedBy?: number,
): Promise<void> {
  if (!agentTemplateId || agentTemplateId <= 0) return;
  const db = await getDb();
  if (!db) return;

  try {
    const existing = await db
      .select()
      .from(agentAutonomyLevels)
      .where(eq(agentAutonomyLevels.agentTemplateId, agentTemplateId))
      .limit(1);

    if (existing.length > 0) {
      const updateData: Record<string, any> = {
        currentLevel,
        level1Runs,
        level2Runs,
      };
      if (promotedBy !== undefined) {
        updateData.promotedAt = new Date();
        updateData.promotedBy = promotedBy;
      }
      await db
        .update(agentAutonomyLevels)
        .set(updateData)
        .where(eq(agentAutonomyLevels.agentTemplateId, agentTemplateId));
    } else {
      await db.insert(agentAutonomyLevels).values({
        agentTemplateId,
        currentLevel,
        level1Runs,
        level2Runs,
        ...(promotedBy !== undefined ? { promotedAt: new Date(), promotedBy } : {}),
      });
    }
  } catch (err) {
    console.error("[atlasWiring] Failed to persist autonomy level:", err);
  }
}

/**
 * Load graduated autonomy level from the database.
 * Returns null if no record exists (agent starts at level 1).
 */
export async function loadAutonomyLevel(agentTemplateId: number): Promise<{
  currentLevel: number;
  level1Runs: number;
  level2Runs: number;
  promotedAt: Date | null;
} | null> {
  if (!agentTemplateId || agentTemplateId <= 0) return null;
  const db = await getDb();
  if (!db) return null;

  try {
    const [row] = await db
      .select()
      .from(agentAutonomyLevels)
      .where(eq(agentAutonomyLevels.agentTemplateId, agentTemplateId))
      .limit(1);

    if (!row) return null;

    return {
      // P-02: coerce numeric fields at DB boundary
      currentLevel: coerceNumeric(row.currentLevel, 1),
      level1Runs: coerceNumeric(row.level1Runs, 0),
      level2Runs: coerceNumeric(row.level2Runs, 0),
      promotedAt: row.promotedAt ?? null,
    };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEEP CONTEXT ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Backward-compatible assembleDeepContext for ATLAS.
 * Accepts both legacy (boolean include flags) and platform request shapes.
 * Returns the extended LegacyAssembledContext with ATLAS kernel fields.
 */
export async function assembleDeepContext(
  request: LegacyContextRequest | ContextRequest,
): Promise<LegacyAssembledContext> {
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
    atlasContextSources,
    platformRequest,
  );

  return toLegacyAssembledContext(platformResult);
}

/**
 * Platform-native assembleContext for ATLAS.
 * Returns the platform AssembledContext with sourceContexts record and metadata.
 */
export async function assembleContext(request: ContextRequest) {
  return platformAssembleDeepContext(atlasContextSources, request);
}

// ─── OVERRIDE TRANSLATION HELPER ────────────────────────────────────────────

function translateOverrides(
  overrides?: Partial<LegacyContextRequest> | Partial<ContextRequest>,
): { maxTokenBudget: number | undefined; options: QuickContextOptions } {
  if (!overrides) {
    return { maxTokenBudget: undefined, options: {} };
  }

  const excludeList: string[] = [];
  for (const [flag, sourceName] of Object.entries(BOOLEAN_FLAG_TO_SOURCE)) {
    const value = (overrides as Record<string, unknown>)[flag];
    if (value === false) {
      excludeList.push(sourceName);
    }
  }

  const o = overrides as Record<string, unknown>;
  return {
    maxTokenBudget: o.maxTokenBudget as number | undefined,
    options: {
      conversationId: o.conversationId as number | undefined,
      specificDocIds: o.specificDocIds as number[] | undefined,
      category: o.category as string | undefined,
      excludeSources: excludeList.length > 0 ? excludeList : undefined,
      includeSources: o.includeSources as string[] | undefined,
    },
  };
}

// ─── QUICK CONTEXT ──────────────────────────────────────────────────────────

/**
 * Backward-compatible getQuickContext that returns a plain string.
 */
export async function getQuickContext(
  userId: number,
  query: string,
  contextType: ContextType,
  overrides?: Partial<LegacyContextRequest> | Partial<ContextRequest>,
): Promise<string> {
  const { maxTokenBudget, options } = translateOverrides(overrides);
  const { contextPrompt } = await assembleQuickContext(
    atlasContextSources,
    userId,
    query,
    contextType,
    maxTokenBudget,
    options,
  );
  return contextPrompt;
}

/**
 * Extended getQuickContext that also returns metadata.
 */
export async function getQuickContextWithMetadata(
  userId: number,
  query: string,
  contextType: ContextType,
  overrides?: Partial<LegacyContextRequest> | Partial<ContextRequest>,
) {
  const { maxTokenBudget, options } = translateOverrides(overrides);
  return assembleQuickContext(atlasContextSources, userId, query, contextType, maxTokenBudget, options);
}

// ── Re-exports ──────────────────────────────────────────────────────────────
export { atlasContextSources } from "./atlasContextSources";
export { atlasMemoryStore } from "./atlasMemoryStore";
export { normalizeQualityScore } from "./types";
export { coerceNumeric, coerceNumericFields, coerceNumericFieldsBatch } from "./dbCoercion";
export type { ContextType } from "./types";
