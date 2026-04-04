/**
 * Contextual LLM Wrapper
 * 
 * Drop-in replacement for invokeLLM that automatically injects
 * deep platform context (RAG) into every LLM call.
 * 
 * Usage: Replace `import { invokeLLM } from "../_core/llm"`
 * with `import { contextualLLM } from "./shared/stewardlyWiring"` (or `"../shared/stewardlyWiring"` from routers)
 * 
 * The wrapper:
 * 1. Assembles deep context for the given userId + query
 * 2. Prepends a <platform_context> block to the system message
 * 3. Falls back to plain invokeLLM if context assembly fails
 */

import { invokeLLM } from "../_core/llm";
import { getQuickContext, type ContextType } from "./deepContextAssembler";
import { logger } from "../_core/logger";
import { screenInput, screenOutput } from "../shared/guardrails";
import { createLLMSpan } from "../shared/telemetry/otel";
import { eventBus } from "../shared/events/eventBus";

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
  [key: string]: any;
}

/**
 * Invoke LLM with automatic deep context injection.
 * 
 * @param params - Standard invokeLLM params plus userId and contextType
 * @returns Same response as invokeLLM
 */
export async function contextualLLM(params: ContextualLLMParams) {
  const { userId, contextType = "analysis", query, messages, ...rest } = params;

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

  // ── OTel span ─────────────────────────────────────────────────────
  const { end: endSpan } = createLLMSpan("contextualLLM", { operation: contextType });

  // Assemble platform context if userId is available
  let platformContext = "";
  if (userId) {
    try {
      const effectiveQuery = query || userInput;
      platformContext = await getQuickContext(userId, effectiveQuery, contextType);
    } catch (e) {
      // Best-effort — don't block the LLM call
      logger.warn({ operation: "contextualLLM", userId, error: String(e) }, "[contextualLLM] Context assembly failed");
    }
  }
  
  // Inject context into the system message
  const enhancedMessages = injectContext(messages, platformContext);
  
  const result = await invokeLLM({ messages: enhancedMessages as any, ...rest });

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
  });

  // Track model version for observability
  if (result.model) {
    (result as any).__modelVersion = result.model;
    logger.debug(
      { operation: "contextualLLM", userId, model: result.model },
      `LLM call completed \u2014 model: ${result.model}`,
    );
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
      // System message has array content blocks (e.g., OpenAI vision format).
      // Context injection is skipped to avoid breaking structured content.
      logger.warn(
        "[injectContext] System message has non-string content — context injection skipped. "
        + "Consider converting to string content or using a separate system message.",
      );
    }
  } else {
    // Prepend a system message with context
    result.unshift({
      role: "system",
      content: `You are an intelligent AI assistant with deep knowledge of the user's context.${contextBlock}`,
    });
  }
  
  return result;
}
