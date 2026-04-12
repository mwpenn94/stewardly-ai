/**
 * Contextual LLM Wrapper — Multi-Model + Web Search
 * 
 * Drop-in replacement for invokeLLM that automatically:
 * 1. Resolves the optimal model via the 5-layer config system
 * 2. Injects deep platform context (RAG) into every LLM call
 * 3. Attaches google_search tool for real-time web grounding
 * 4. Supports multi-model ensemble when crossModelVerify is enabled
 * 5. Handles fallback chain if primary model fails
 * 
 * Usage: Replace `import { invokeLLM } from "../_core/llm"`
 * with `import { contextualLLM } from "./shared/stewardlyWiring"`
 */

import { invokeLLM } from "../_core/llm";
import type { Tool } from "../_core/llm";
import { getQuickContext, type ContextType } from "./deepContextAssembler";
import { logger } from "../_core/logger";
import { screenInput, screenOutput } from "../shared/guardrails";
import { createLLMSpan } from "../shared/telemetry/otel";
import { eventBus } from "../shared/events/eventBus";
import {
  routeModel,
  GOOGLE_SEARCH_TOOL,
  getModel,
  getDefaultModelId,
  type TaskType,
  type ModelRoutingResult,
} from "../shared/config/modelRegistry";

/**
 * Maximum character length for injected platform context.
 * ~12,000 chars ≈ ~3,000 tokens, leaving ample room for the user's
 * messages and the model's response within typical context windows.
 * Adjust upward if using models with 128k+ context windows.
 */
export const MAX_CONTEXT_CHARS = 12_000;

interface ContextualLLMParams {
  userId?: number | null;
  contextType?: ContextType;
  query?: string;
  messages: Array<{ role: string; content: any }>;
  /** Explicit model override — bypasses 5-layer config routing */
  model?: string;
  /** Task type for intelligent model routing */
  taskType?: TaskType;
  /** Whether to include google_search tool for web grounding (default: true) */
  enableWebSearch?: boolean;
  /** 5-layer resolved model preferences (from resolveAIConfig) */
  modelPreferences?: Record<string, string>;
  /** 5-layer resolved ensemble weights */
  ensembleWeights?: Record<string, number>;
  /** Whether to run cross-model verification */
  crossModelVerify?: boolean;
  [key: string]: any;
}

/**
 * Invoke LLM with automatic deep context injection, model routing,
 * and web search grounding.
 * 
 * @param params - Standard invokeLLM params plus userId, contextType, model routing
 * @returns Same response as invokeLLM, with __modelVersion and __routingInfo metadata
 */
export async function contextualLLM(params: ContextualLLMParams) {
  const {
    userId,
    contextType = "analysis",
    query,
    messages,
    model: explicitModel,
    taskType = "chat",
    enableWebSearch = true,
    modelPreferences,
    ensembleWeights,
    crossModelVerify,
    ...rest
  } = params;

  // ── Guardrail: screen ALL user messages, not just the last one ─────
  const allUserContent = messages
    .filter(m => m.role === "user")
    .map(m => typeof m.content === "string" ? m.content : JSON.stringify(m.content))
    .join(" ");
  const userInput = allUserContent || extractQuery(messages);
  if (userInput) {
    const inputScreen = screenInput(userInput);
    if (!inputScreen.passed) {
      const flagged = inputScreen.checks.filter(c => c.matched).map(c => c.name);
      logger.warn({ operation: "contextualLLM.guardrail", userId, flagged }, "Input screening failed");
      eventBus.emit("compliance.flagged", { userId, type: "input", flagged });
      if (inputScreen.checks.some(c => c.matched && c.severity === "high")) {
        const refusal = "I can't process that request. It appears to contain sensitive personal information or an unsupported instruction pattern. Please rephrase without including SSNs, credit card numbers, or similar data.";
        return {
          id: "guardrail-block",
          created: Math.floor(Date.now() / 1000),
          model: "guardrail",
          content: refusal,
          choices: [{ index: 0, message: { role: "assistant" as const, content: refusal }, finish_reason: "stop" }],
          usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        } as any;
      }
    }
  }

  // ── Model Routing ─────────────────────────────────────────────────
  let routing: ModelRoutingResult;
  let selectedModel: string;

  if (explicitModel) {
    // Explicit model override — skip routing
    selectedModel = explicitModel;
    routing = {
      primary: explicitModel,
      fallback: getDefaultModelId(),
      synthesis: "claude-sonnet-4-20250514",
      useEnsemble: false,
      ensembleModels: [],
      source: "config",
    };
  } else {
    // Route via 5-layer config + task type
    routing = routeModel(taskType, modelPreferences, ensembleWeights, crossModelVerify);
    selectedModel = routing.primary;
  }

  logger.debug(
    { operation: "contextualLLM.routing", userId, selectedModel, source: routing.source, taskType },
    `Model routed: ${selectedModel} (source: ${routing.source})`,
  );

  // ── OTel span ─────────────────────────────────────────────────────
  const { end: endSpan } = createLLMSpan("contextualLLM", { operation: contextType, model: selectedModel });

  // Assemble platform context if userId is available
  let platformContext = "";
  if (userId) {
    try {
      const effectiveQuery = query || userInput;
      platformContext = await getQuickContext(userId, effectiveQuery, contextType);
    } catch (e) {
      logger.warn({ operation: "contextualLLM", userId, error: String(e) }, "[contextualLLM] Context assembly failed");
    }
  }
  
  // Inject context into the system message
  const enhancedMessages = injectContext(messages, platformContext);

  // ── Web Search Tool Injection ─────────────────────────────────────
  // All 16 Forge models support google_search grounding.
  // Always include it so the model can search when needed.
  const existingTools: Tool[] = (rest.tools as Tool[]) || [];
  let tools: Tool[] = existingTools;
  if (enableWebSearch) {
    const hasGoogleSearch = existingTools.some(
      t => t.function?.name === "google_search"
    );
    if (!hasGoogleSearch) {
      tools = [GOOGLE_SEARCH_TOOL, ...existingTools];
    }
  }

  // ── Primary Model Call ────────────────────────────────────────────
  let result: any;
  const startMs = Date.now();
  try {
    result = await invokeLLM({
      messages: enhancedMessages as any,
      model: selectedModel,
      tools: tools.length > 0 ? tools : undefined,
      ...rest,
    });
  } catch (primaryError) {
    // ── Fallback Chain ──────────────────────────────────────────────
    logger.warn(
      { operation: "contextualLLM.fallback", userId, primaryModel: selectedModel, fallbackModel: routing.fallback, error: String(primaryError) },
      `Primary model ${selectedModel} failed, falling back to ${routing.fallback}`,
    );

    try {
      result = await invokeLLM({
        messages: enhancedMessages as any,
        model: routing.fallback,
        tools: tools.length > 0 ? tools : undefined,
        ...rest,
      });
    } catch (fallbackError) {
      // Last resort — use the hardcoded default
      logger.error(
        { operation: "contextualLLM.lastResort", userId, error: String(fallbackError) },
        `Fallback model ${routing.fallback} also failed, using default`,
      );
      result = await invokeLLM({
        messages: enhancedMessages as any,
        // No model specified — invokeLLM defaults to registry default (getDefaultModelId())
        tools: tools.length > 0 ? tools : undefined,
        ...rest,
      });
    }
  }

  // ── Duration tracking ─────────────────────────────────────────────
  const durationMs = Date.now() - startMs;

  // ── OTel: end span with token usage ───────────────────────────────
  endSpan({
    model: result.model,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
  });

  // ── Guardrail: screen output for PII leakage ─────────────────────
  const outputContent = result.choices?.[0]?.message?.content;
  if (outputContent && typeof outputContent === "string") {
    const outputScreen = screenOutput(outputContent);
    if (!outputScreen.passed) {
      const { maskPII } = await import("../shared/guardrails");
      logger.warn({ operation: "contextualLLM.guardrail.output", userId }, "Output PII detected, masking");
      eventBus.emit("compliance.flagged", { userId, type: "output_pii" });
      result.choices[0].message.content = maskPII(outputContent);
    }
  }

  // ── Emit quality event ────────────────────────────────────────────
  eventBus.emit("prompt.scored", {
    userId,
    model: result.model,
    inputTokens: result.usage?.prompt_tokens,
    outputTokens: result.usage?.completion_tokens,
    durationMs,
  });

  // ── Usage Tracking ───────────────────────────────────────────────
  if (userId) {
    try {
      const { trackUsage } = await import("./usageTracker");
      const inputTokens = result.usage?.prompt_tokens || 0;
      const outputTokens = result.usage?.completion_tokens || 0;
      const estimatedCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
      trackUsage({ userId, operationType: contextType || "chat", model: result.model || selectedModel, inputTokens, outputTokens, estimatedCost }).catch(() => {});
    } catch { /* non-critical */ }
  }

  // Track model version and routing info for observability
  if (result.model) {
    (result as any).__modelVersion = result.model;
    (result as any).__routingInfo = {
      requestedModel: selectedModel,
      actualModel: result.model,
      source: routing.source,
      taskType,
      webSearchEnabled: enableWebSearch,
      ensembleUsed: routing.useEnsemble,
      durationMs,
    };
    logger.debug(
      { operation: "contextualLLM", userId, model: result.model, requested: selectedModel },
      `LLM call completed — model: ${result.model} (requested: ${selectedModel})`,
    );
  }

  // ── RAG Training — fire-and-forget learning from response ─────────
  if (userId) {
    const responseContent = result.choices?.[0]?.message?.content || "";
    if (responseContent.length > 50) {
      import("./ragTrainer").then(({ learn }) => {
        learn({ userId, query: userInput, response: responseContent, model: result.model }).catch(() => {});
      }).catch(() => {});
    }
  }

  return result;
}

/**
 * Extract a query string from the messages array (last user message)
 */
export function extractQuery(messages: Array<{ role: string; content: any }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      const content = messages[i].content;
      if (typeof content === "string") return content.slice(0, 500);
      if (Array.isArray(content)) {
        const textPart = content.find((p: any) => p.type === "text");
        if (textPart) return textPart.text?.slice(0, 500) || "";
      }
    }
  }
  return "";
}

/**
 * Inject platform context into the system message.
 * If no system message exists, prepend one.
 * Truncates context to MAX_CONTEXT_CHARS to prevent token overflow.
 */
export function injectContext(
  messages: Array<{ role: string; content: any }>,
  platformContext: string
): Array<{ role: string; content: any }> {
  if (!platformContext) return messages;

  // Safety truncation to prevent token overflow with large user profiles
  let safeContext = platformContext;
  if (safeContext.length > MAX_CONTEXT_CHARS) {
    logger.warn(
      { originalLength: safeContext.length, truncatedTo: MAX_CONTEXT_CHARS },
      "[contextualLLM] Platform context exceeded size limit, truncating",
    );
    safeContext = safeContext.slice(0, MAX_CONTEXT_CHARS) + "\n[... context truncated for token safety ...]";
  }
  
  const contextBlock = `
<platform_context>
${safeContext}
</platform_context>
Use the above platform context to provide more personalized, data-rich responses. Reference specific details from the user's profile, documents, financial data, and history when relevant.`;
  
  const result = [...messages];
  const systemIdx = result.findIndex(m => m.role === "system");
  
  if (systemIdx >= 0) {
    const existing = result[systemIdx].content;
    if (typeof existing === "string") {
      result[systemIdx] = {
        ...result[systemIdx],
        content: existing + "\n" + contextBlock,
      };
    } else {
      logger.warn(
        "[injectContext] System message has non-string content — context injection skipped.",
      );
    }
  } else {
    result.unshift({
      role: "system",
      content: `You are an intelligent AI assistant with deep knowledge of the user's context.${contextBlock}`,
    });
  }
  
  return result;
}
