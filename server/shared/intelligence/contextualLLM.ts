/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @platform/intelligence — Contextual LLM Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Platform-agnostic LLM invocation with automatic deep-context injection.
 *
 * Key design decisions:
 *   - Accepts a ContextSourceRegistry rather than importing data sources
 *     directly, enabling any project to plug in its own context providers.
 *   - Delegates to an injected `invokeLLM` function so the caller controls
 *     model routing, API keys, and failover.
 *   - Tracks contextSourceHitRate and normalizes quality scores on every call.
 *   - Preserves backward compatibility with the original contextualLLM API:
 *     handles both string and array content blocks in messages.
 */

import type {
  ContextSourceRegistry,
  ContextType,
  ContextualLLMRequest,
  ContextualLLMResponse,
} from "./types";
import { normalizeQualityScore } from "./types";
import { assembleQuickContext } from "./deepContextAssembler";

// ─── FACTORY ─────────────────────────────────────────────────────────────────

export interface ContextualLLMDependencies {
  /** The project's registered context sources. */
  registry: ContextSourceRegistry;
  /** Underlying LLM invocation function (wraps OpenAI, Anthropic, etc.). */
  invokeLLM: (params: {
    messages: Array<{ role: string; content: any }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
  }) => Promise<ContextualLLMResponse>;
  /** Optional logger. Falls back to console. */
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

/**
 * Create a project-specific `contextualLLM` function by injecting dependencies.
 *
 * ```ts
 * const contextualLLM = createContextualLLM({
 *   registry: stewardlyContextSources,
 *   invokeLLM: myLLMWrapper,
 * });
 * const response = await contextualLLM({ userId: 1, contextType: "chat", messages });
 * ```
 */
export function createContextualLLM(deps: ContextualLLMDependencies) {
  const log = deps.logger ?? console;

  return async function contextualLLM(
    request: ContextualLLMRequest & { query?: string; [key: string]: any },
  ): Promise<ContextualLLMResponse> {
    const { userId, contextType = "analysis", query, messages, model, temperature, maxTokens, skipContext, ...rest } = request;

    let enrichedMessages = [...messages];
    let hitRate = 0;

    // ── Context injection ────────────────────────────────────────────────
    if (!skipContext && userId > 0) {
      try {
        const effectiveQuery = query || extractQuery(messages);
        const { contextPrompt, metadata } = await assembleQuickContext(
          deps.registry,
          userId,
          effectiveQuery,
          contextType,
        );

        hitRate = metadata.contextSourceHitRate;

        if (contextPrompt.length > 0) {
          enrichedMessages = injectContext(enrichedMessages, contextPrompt);
        }
      } catch (err) {
        log.warn("[contextualLLM] Context assembly failed, proceeding without context:", err);
      }
    }

    // ── LLM call ─────────────────────────────────────────────────────────
    const response = await deps.invokeLLM({
      messages: enrichedMessages,
      model,
      temperature,
      maxTokens,
      ...rest,
    });

    // ── Attach metadata ──────────────────────────────────────────────────
    if (!response.metadata) response.metadata = {};
    response.metadata.contextSourceHitRate = hitRate;

    if (typeof response.metadata.qualityScore === "number") {
      response.metadata.qualityScore = normalizeQualityScore(
        response.metadata.qualityScore,
      );
    }

    return response;
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Extract the most recent user message as the search query for context retrieval.
 * Handles both string content and OpenAI-style array content blocks.
 */
export function extractQuery(messages: Array<{ role: string; content: any }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      const content = messages[i].content;
      if (typeof content === "string") {
        return content.substring(0, 500);
      }
      // Handle OpenAI array content blocks: [{ type: "text", text: "..." }]
      if (Array.isArray(content)) {
        const textPart = content.find((p: any) => p.type === "text");
        if (textPart?.text) return textPart.text.substring(0, 500);
      }
    }
  }
  return "";
}

/**
 * Inject assembled context into the message array.
 *
 * Strategy: if a system message exists, append context to it.
 * Otherwise, prepend a new system message containing the context.
 * Uses <platform_context> XML tags for structured injection,
 * matching the original Stewardly format.
 */
export function injectContext(
  messages: Array<{ role: string; content: any }>,
  contextPrompt: string,
): Array<{ role: string; content: any }> {
  if (!contextPrompt) return messages;

  const contextBlock = `\n<platform_context>\n${contextPrompt}\n</platform_context>\nUse the above platform context to provide more personalized, data-rich responses. Reference specific details from the user's profile, documents, financial data, and history when relevant.`;

  const result = [...messages];
  const systemIdx = result.findIndex((m) => m.role === "system");

  if (systemIdx >= 0) {
    const existing = result[systemIdx].content;
    if (typeof existing === "string") {
      result[systemIdx] = {
        ...result[systemIdx],
        content: existing + "\n" + contextBlock,
      };
    }
    // If content is not a string (array blocks), skip injection
    // to avoid breaking structured content
  } else {
    result.unshift({
      role: "system",
      content: `You are an intelligent AI assistant with deep knowledge of the user's context.${contextBlock}`,
    });
  }

  return result;
}
