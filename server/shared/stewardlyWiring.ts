/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Stewardly Intelligence Wiring
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Wires the platform-agnostic @platform/intelligence layer to Stewardly's
 * specific implementations. Stewardly already has rich services (contextualLLM,
 * deepContextAssembler, memoryEngine) — this wiring bridges them to the
 * shared interface for cross-project consistency.
 *
 * Migration guide:
 *   BEFORE: import { contextualLLM } from "./services/contextualLLM";
 *   AFTER:  import { contextualLLM } from "./shared/stewardlyWiring";
 *
 * Both paths work — the wiring delegates to the existing services.
 *
 * @shared-source: stewardly-ai
 * @shared-hash: auto
 */

import { createContextualLLM } from "./intelligence/contextualLLM";
import {
  assembleDeepContext as platformAssembleDeepContext,
  assembleQuickContext,
} from "./intelligence/deepContextAssembler";
import type { QuickContextOptions } from "./intelligence/deepContextAssembler";
import { createMemoryEngine } from "./intelligence/memoryEngine";
import { EXTENDED_MEMORY_CATEGORIES } from "./intelligence/types";
import type {
  ContextType,
  ContextualLLMResponse,
  ContextRequest,
  AssembledContext,
  ContextSourceRegistry,
} from "./intelligence/types";
import { resolveAIConfig } from "./config/aiConfigResolver";
import type { ResolvedAIConfig } from "./config/types";

// ── LLM invocation (delegates to Stewardly's existing _core/llm) ────────────

let _invokeLLMFn: ((params: any) => Promise<any>) | null = null;

async function getInvokeLLM(): Promise<(params: any) => Promise<any>> {
  if (_invokeLLMFn) return _invokeLLMFn;
  try {
    const llmModule = await import("../_core/llm");
    _invokeLLMFn = llmModule.invokeLLM;
    return _invokeLLMFn!;
  } catch {
    try {
      const openaiModule = await import("openai");
      const OpenAI = openaiModule.default;
      const client = new OpenAI();
      _invokeLLMFn = async (params: any): Promise<ContextualLLMResponse> => {
        const response = await client.chat.completions.create({
          model: params.model || "gemini-2.5-flash",
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 4096,
        });
        return {
          choices: response.choices.map((c: any) => ({
            message: { content: c.message.content, role: c.message.role },
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
        throw new Error("No LLM provider available");
      };
    }
    return _invokeLLMFn!;
  }
}

// ── Stewardly Context Sources (bridges existing deepContextAssembler) ───────
// Stewardly has 14+ data sources in its existing deepContextAssembler.
// We create a lightweight registry that delegates to the existing service.

let _stewardlyRegistry: ContextSourceRegistry | null = null;

async function getStewardlyRegistry(): Promise<ContextSourceRegistry> {
  if (_stewardlyRegistry) return _stewardlyRegistry;
  try {
    // Import the existing deepContextAssembler's getQuickContext
    const assembler = await import("../services/deepContextAssembler");
    _stewardlyRegistry = {
      // Single source that delegates to the full existing assembler
      fullContext: async (userId: number, query: string) => {
        try {
          return await assembler.getQuickContext(userId, query, "chat" as any);
        } catch {
          return "";
        }
      },
    };
  } catch {
    _stewardlyRegistry = {};
  }
  return _stewardlyRegistry!;
}

// ── Cached contextualLLM instance ───────────────────────────────────────────

let _contextualLLMFn: ((params: any) => Promise<any>) | null = null;

export async function contextualLLM(params: {
  userId?: number | null;
  contextType?: ContextType;
  query?: string;
  messages: Array<{ role: string; content: any }>;
  skipContext?: boolean;
  [key: string]: any;
}): Promise<ContextualLLMResponse> {
  // Delegate to existing Stewardly contextualLLM if available
  try {
    const existing = await import("../services/contextualLLM");
    return existing.contextualLLM(params);
  } catch {
    // Fall back to platform-agnostic version
    if (!_contextualLLMFn) {
      const invokeLLM = await getInvokeLLM();
      const registry = await getStewardlyRegistry();
      _contextualLLMFn = createContextualLLM({ registry, invokeLLM });
    }
    return _contextualLLMFn(params);
  }
}

export async function rawInvokeLLM(params: any): Promise<any> {
  const invokeLLM = await getInvokeLLM();
  return invokeLLM(params);
}

// ── Memory Engine ───────────────────────────────────────────────────────────

export async function getMemoryEngine() {
  // Delegate to existing Stewardly memoryEngine
  try {
    const existing = await import("../memoryEngine");
    return existing;
  } catch {
    const invokeLLM = await getInvokeLLM();
    return createMemoryEngine({
      store: {
        async getMemories() { return []; },
        async storeMemory() {},
        async getEpisodes() { return []; },
        async storeEpisode() {},
      },
      llm: async (params) => invokeLLM({ messages: params.messages }),
      categories: EXTENDED_MEMORY_CATEGORIES,
    });
  }
}

// ── AI Config Resolver ──────────────────────────────────────────────────────

const stewardlyConfigStore = {
  async getLayerSettings(): Promise<null> {
    // Stewardly doesn't have config layers yet — returns null
    return null;
  },
};

export async function resolveUserAIConfig(userId: number): Promise<ResolvedAIConfig> {
  return resolveAIConfig(stewardlyConfigStore, userId);
}

// ── Deep Context Assembly ───────────────────────────────────────────────────

export async function assembleDeepContext(request: ContextRequest): Promise<AssembledContext> {
  const registry = await getStewardlyRegistry();
  return platformAssembleDeepContext(registry, request);
}

export async function getQuickContext(
  userId: number,
  query: string,
  contextType: ContextType,
  maxTokenBudget?: number,
  options?: QuickContextOptions,
): Promise<string> {
  // Delegate to existing Stewardly assembler
  try {
    const assembler = await import("../services/deepContextAssembler");
    return assembler.getQuickContext(userId, query, contextType as any);
  } catch {
    const registry = await getStewardlyRegistry();
    const { contextPrompt } = await assembleQuickContext(
      registry, userId, query, contextType, maxTokenBudget, options,
    );
    return contextPrompt;
  }
}

// ── Re-exports ──────────────────────────────────────────────────────────────
export { normalizeQualityScore } from "./intelligence/types";
export type { ContextType, ContextualLLMResponse, ContextRequest, AssembledContext };
export type { ResolvedAIConfig };
