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
 *   AFTER:  import { assembleContext, getQuickContext } from "../shared/intelligence/stewardlyWiring";
 *
 *   BEFORE: import { extractMemoriesFromMessage } from "../memoryEngine";
 *   AFTER:  import { memoryEngine } from "../shared/intelligence/stewardlyWiring";
 *           memoryEngine.extractMemoriesFromMessage(...)
 *
 * Backward compatibility:
 *   - contextualLLM accepts the same params shape as the original
 *     (userId, contextType, query, messages, ...rest)
 *   - getQuickContext returns a plain string (matching the original API)
 *   - getQuickContext accepts optional 4th param: overrides
 *   - messages support both string and array content blocks
 */

import { createContextualLLM } from "./contextualLLM";
import { assembleDeepContext, assembleQuickContext } from "./deepContextAssembler";
import { createMemoryEngine } from "./memoryEngine";
import { EXTENDED_MEMORY_CATEGORIES } from "./types";
import type { ContextType, ContextualLLMResponse, ContextRequest } from "./types";

// ── Stewardly-specific implementations ───────────────────────────────────────
import { stewardlyContextSources } from "./stewardlyContextSources";
import { stewardlyMemoryStore } from "./stewardlyMemoryStore";

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

/**
 * Convenience: assemble deep context using Stewardly's sources.
 * Returns the full AssembledContext object with metadata.
 */
export async function assembleContext(request: ContextRequest) {
  return assembleDeepContext(stewardlyContextSources, request);
}

/**
 * Backward-compatible getQuickContext that returns a plain string.
 * Matches the original API:
 *   getQuickContext(userId, query, contextType, overrides?) => string
 *
 * The optional 4th parameter `overrides` allows callers to customize
 * the context request (e.g., maxTokenBudget, includeSources, etc.).
 */
export async function getQuickContext(
  userId: number,
  query: string,
  contextType: ContextType,
  overrides?: Partial<ContextRequest>,
): Promise<string> {
  const result = await assembleQuickContext(
    stewardlyContextSources,
    userId,
    query,
    contextType,
    overrides?.maxTokenBudget,
  );
  return result.contextPrompt;
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
