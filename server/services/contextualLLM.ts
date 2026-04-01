/**
 * Contextual LLM Wrapper
 * 
 * Drop-in replacement for invokeLLM that automatically injects
 * deep platform context (RAG) into every LLM call.
 * 
 * Usage: Replace `import { invokeLLM } from "../_core/llm"`
 * with `import { contextualLLM } from "../services/contextualLLM"`
 * 
 * The wrapper:
 * 1. Assembles deep context for the given userId + query
 * 2. Prepends a <platform_context> block to the system message
 * 3. Falls back to plain invokeLLM if context assembly fails
 */

import { invokeLLM } from "../_core/llm";
import { getQuickContext, type ContextType } from "./deepContextAssembler";
import { logger } from "../_core/logger";

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
  
  // Assemble platform context if userId is available
  let platformContext = "";
  if (userId) {
    try {
      // Extract query from the last user message if not provided
      const effectiveQuery = query || extractQuery(messages);
      platformContext = await getQuickContext(userId, effectiveQuery, contextType);
    } catch (e) {
      // Best-effort — don't block the LLM call
      logger.warn( { operation: "contextualLLM" },"[contextualLLM] Context assembly failed:", (e as Error).message);
    }
  }
  
  // Inject context into the system message
  const enhancedMessages = injectContext(messages, platformContext);
  
  const result = await invokeLLM({ messages: enhancedMessages as any, ...rest });

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
function extractQuery(messages: Array<{ role: string; content: any }>): string {
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
 */
function injectContext(
  messages: Array<{ role: string; content: any }>,
  platformContext: string
): Array<{ role: string; content: any }> {
  if (!platformContext) return messages;
  
  const contextBlock = `
<platform_context>
${platformContext}
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
