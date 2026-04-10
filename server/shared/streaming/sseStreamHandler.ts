/**
 * SSE Stream Handler — Server-Sent Events for real-time LLM token streaming.
 *
 * Supports two modes:
 * 1. Native streaming: If the LLM provider supports `stream: true`, tokens are
 *    forwarded in real-time as SSE `data:` frames. Context is injected BEFORE
 *    the streaming call via getQuickContext, ensuring RAG parity with the
 *    non-streaming contextualLLM path.
 * 2. Fallback simulation: If streaming is not supported, the full response is
 *    chunked into ~5-token segments emitted with 20ms delays to simulate a
 *    streaming UX. Uses contextualLLM which handles its own context injection.
 *
 * Tool Calling:
 * When tools are provided, the fallback path implements a multi-turn ReAct loop:
 * the LLM can call tools (web search, stock lookup, etc.), receive results, and
 * continue reasoning before producing a final text response. Tool status events
 * are sent to the client so the UI can show "Searching the web..." indicators.
 *
 * IMPORTANT: extractQuery and injectContext are imported from the canonical
 * shared/intelligence/contextualLLM.ts to prevent behavioral drift between
 * streaming and non-streaming paths. getQuickContext is imported from
 * services/deepContextAssembler.ts. Do NOT duplicate these functions.
 */

import type { Request, Response } from "express";
import { logger } from "../../_core/logger";
// Re-use the legacy wiring's getQuickContext (which delegates to services/deepContextAssembler)
// and the shared intelligence layer's extractQuery/injectContext helpers.
import { getQuickContext } from "../../services/deepContextAssembler";
import type { ContextType } from "../../services/deepContextAssembler";
import { extractQuery, injectContext } from "../intelligence/contextualLLM";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SSEStreamConfig {
  /** The contextualLLM function from stewardlyWiring */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts legacy ContextualLLMParams & InvokeResult
  contextualLLM: (params: any) => Promise<any>;
  /** User ID for context injection */
  userId: number;
  /** Conversation/session ID */
  sessionId?: number;
  /** Context type for the intelligence layer */
  contextType?: string;
  /** Messages array (OpenAI-compatible format) */
  messages: Array<{ role: string; content: string }>;
  /** Optional model override (user-selected from Chat UI) */
  model?: string;
  /** Optional tools for tool calling */
  tools?: Array<Record<string, unknown>>;
  /** Optional tool_choice */
  tool_choice?: string | Record<string, unknown>;
  /** Optional function to execute search tools during streaming */
  executeSearchTool?: (toolName: string, args: Record<string, any>) => Promise<string>;
}

export interface SSEMediaEmbed {
  type: "video" | "audio" | "image" | "document" | "shopping" | "chart" | "link_preview";
  source: string;
  title: string;
  thumbnailUrl?: string;
  startTime?: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

export interface SSEEvent {
  type: "token" | "done" | "error" | "heartbeat" | "tool_status";
  content?: string;
  sessionId?: number;
  totalTokens?: number;
  message?: string;
  toolName?: string;
  mediaEmbeds?: SSEMediaEmbed[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FALLBACK_CHUNK_SIZE = 5; // words per simulated chunk
const FALLBACK_DELAY_MS = 20; // ms between simulated chunks
const HEARTBEAT_INTERVAL_MS = 15_000; // keep-alive every 15s
const MAX_TOOL_ITERATIONS = 5; // max tool-calling rounds before forcing final answer

// ── Helpers ───────────────────────────────────────────────────────────────────

function writeSSE(res: Response, event: SSEEvent): void {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function setSSEHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

/**
 * Split text into chunks of approximately `size` words each.
 */
function chunkByWords(text: string, size: number): string[] {
  const words = text.split(/(\s+)/); // preserve whitespace
  const chunks: string[] = [];
  let current = "";
  let wordCount = 0;

  for (const token of words) {
    current += token;
    if (token.trim()) wordCount++;
    if (wordCount >= size) {
      chunks.push(current);
      current = "";
      wordCount = 0;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

/**
 * Creates an SSE stream handler that manages the full lifecycle of a streaming
 * LLM response over Server-Sent Events.
 *
 * Usage:
 * ```ts
 * app.post("/api/chat/stream", async (req, res) => {
 *   await createSSEStreamHandler(req, res, config);
 * });
 * ```
 */
export async function createSSEStreamHandler(
  req: Request,
  res: Response,
  config: SSEStreamConfig,
): Promise<void> {
  const { contextualLLM, userId, sessionId, contextType = "chat", messages, tools, tool_choice, executeSearchTool } = config;

  // ── Set SSE headers ─────────────────────────────────────────────
  setSSEHeaders(res);

  // ── Abort controller for cleanup on disconnect ──────────────────
  const abortController = new AbortController();
  let disconnected = false;

  req.on("close", () => {
    disconnected = true;
    abortController.abort();
    logger.debug({ operation: "sseStream.disconnect", userId, sessionId }, "[SSE] Client disconnected");
  });

  // ── Heartbeat to prevent proxy/load-balancer timeouts ───────────
  const heartbeat = setInterval(() => {
    if (!disconnected && !res.writableEnded) {
      writeSSE(res, { type: "heartbeat" });
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // ── Assemble platform context ONCE for both paths ─────────────
    // This ensures RAG parity: native streaming gets the same context
    // injection as the fallback contextualLLM path.
    let enrichedMessages = messages;
    if (userId) {
      try {
        const query = extractQuery(messages);
        const platformContext = await getQuickContext(userId, query, contextType as ContextType);
        // Use the canonical injectContext from services/contextualLLM.ts
        // which handles MAX_CONTEXT_CHARS truncation, array content blocks,
        // and the "You are an intelligent AI assistant..." preamble.
        enrichedMessages = injectContext(messages, platformContext);
        logger.debug(
          { operation: "sseStream.contextInjected", userId, contextLength: platformContext.length },
          "[SSE] Platform context injected into streaming messages",
        );
      } catch (ctxErr: any) {
        // Best-effort — don't block the stream for context assembly failure
        logger.warn(
          { operation: "sseStream.contextFailed", userId, error: ctxErr.message },
          "[SSE] Context assembly failed, proceeding without context",
        );
      }
    }

    // ── Attempt native streaming via fetch with stream: true ──────
    let streamed = false;

    try {
      const streamResponse = await attemptNativeStream(enrichedMessages, config, abortController.signal);
      if (streamResponse) {
        streamed = true;
        let totalContent = "";
        for await (const chunk of streamResponse) {
          if (disconnected) break;
          const content = extractStreamContent(chunk);
          if (content) {
            totalContent += content;
            writeSSE(res, { type: "token", content });
          }
        }
        if (!disconnected) {
          const { extractMediaFromResponse } = await import("../../services/richMediaService");
          const mediaEmbeds = extractMediaFromResponse(totalContent).slice(0, 5);
          writeSSE(res, {
            type: "done",
            sessionId,
            totalTokens: estimateTokens(totalContent),
            mediaEmbeds: mediaEmbeds.length > 0 ? mediaEmbeds : undefined,
          });
        }
      }
    } catch (streamErr: any) {
      // Native streaming failed — fall through to fallback
      if (!abortController.signal.aborted) {
        logger.debug(
          { operation: "sseStream.nativeStreamFailed", error: streamErr.message },
          "[SSE] Native streaming unavailable, falling back to simulation",
        );
      }
    }

    // ── Fallback: call contextualLLM with tool-calling loop ──────
    // Implements a multi-turn ReAct loop: the LLM can call tools,
    // receive results, and continue reasoning before producing a
    // final text response. For the fallback path, we pass the ORIGINAL
    // messages to avoid double injection (contextualLLM handles its own context).
    if (!streamed && !disconnected) {
      let content = "";

      if (tools && tools.length > 0 && executeSearchTool) {
        // ── Tool-calling ReAct loop ──────────────────────────────
        const workingMessages: Array<{ role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string }> = [...messages];
        let iteration = 0;

        while (iteration < MAX_TOOL_ITERATIONS && !disconnected) {
          iteration++;

          const result = await contextualLLM({
            userId,
            contextType,
            model: config.model,
            messages: workingMessages,
            tools,
            tool_choice: iteration === 1 ? (tool_choice || "auto") : "auto",
          });

          const choice = result.choices?.[0]?.message;
          const toolCalls = choice?.tool_calls ?? [];

          if (toolCalls.length === 0) {
            // No tool calls — this is the final text response
            content = typeof choice?.content === "string" ? choice.content : "";
            break;
          }

          // Add assistant message with tool_calls to working messages
          workingMessages.push({
            role: "assistant",
            content: typeof choice?.content === "string" ? choice.content : "",
            tool_calls: toolCalls,
          });

          // Execute each tool call and send status updates to client
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name || "unknown";
            let observation: string;

            // Send tool status to client
            writeSSE(res, {
              type: "tool_status",
              toolName,
              content: getToolStatusMessage(toolName),
            });

            try {
              const args = JSON.parse(toolCall.function.arguments);
              observation = await Promise.race([
                executeSearchTool(toolName, args),
                new Promise<string>((_, reject) =>
                  setTimeout(() => reject(new Error(`Tool '${toolName}' timed out`)), 30_000),
                ),
              ]);
            } catch (err: any) {
              observation = JSON.stringify({ error: err.message });
              logger.warn(
                { toolName, error: err.message },
                "[SSE] Tool execution failed",
              );
            }

            // Add tool result to working messages
            workingMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolName,
              content: observation,
            });
          }
        }

        // If we exhausted iterations without a final answer, make one more call without tools
        if (!content && !disconnected) {
          const finalResult = await contextualLLM({
            userId,
            contextType,
            model: config.model,
            messages: [
              ...workingMessages,
              { role: "user", content: "Please provide your final response based on all the information gathered above." },
            ],
          });
          content = typeof finalResult.choices?.[0]?.message?.content === "string"
            ? finalResult.choices[0].message.content
            : "";
        }
      } else {
        // ── Simple path (no tools) ───────────────────────────────
        const result = await contextualLLM({
          userId,
          contextType,
          model: config.model,
          messages,
          ...(tools && tools.length > 0 ? { tools, tool_choice: tool_choice || "auto" } : {}),
        });
        content = result.choices?.[0]?.message?.content || "";
      }

      // Simulate streaming by chunking the response
      const chunks = chunkByWords(content, FALLBACK_CHUNK_SIZE);

      for (const chunk of chunks) {
        if (disconnected) break;
        writeSSE(res, { type: "token", content: chunk });
        await sleep(FALLBACK_DELAY_MS);
      }

      if (!disconnected) {
        const { extractMediaFromResponse } = await import("../../services/richMediaService");
        const mediaEmbeds = extractMediaFromResponse(content).slice(0, 5);
        writeSSE(res, {
          type: "done",
          sessionId,
          totalTokens: estimateTokens(content),
          mediaEmbeds: mediaEmbeds.length > 0 ? mediaEmbeds : undefined,
        });
      }
    }
  } catch (err: any) {
    logger.error(
      { operation: "sseStream.error", userId, sessionId, error: err.message },
      "[SSE] Stream error",
    );
    if (!disconnected && !res.writableEnded) {
      writeSSE(res, { type: "error", message: err.message || "Internal streaming error" });
    }
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) {
      res.end();
    }
  }
}

// ── Tool Status Messages ────────────────────────────────────────────────────

function getToolStatusMessage(toolName: string): string {
  switch (toolName) {
    case "google_search":
    case "web_search":
      return "Searching the web for current information...";
    case "lookup_stock_data":
      return "Looking up market data...";
    case "research_financial_product":
      return "Researching financial product details...";
    case "compare_products":
      return "Comparing products side by side...";
    case "check_license_status":
      return "Checking license status...";
    case "recommend_study_content":
      return "Finding study recommendations...";
    case "explain_concept":
      return "Preparing explanation...";
    case "quiz_me":
      return "Generating practice questions...";
    default:
      if (toolName.startsWith("calc_")) return "Running financial calculations...";
      if (toolName.startsWith("model_")) return "Building financial model...";
      return `Using ${toolName.replace(/_/g, " ")}...`;
  }
}

// ── Native Streaming Helpers ──────────────────────────────────────────────────

/**
 * Attempt to call the LLM API with `stream: true` using fetch.
 * Uses the context-enriched messages to ensure RAG parity with non-streaming.
 * Returns an async iterable of SSE chunks, or null if not supported.
 */
async function attemptNativeStream(
  enrichedMessages: Array<{ role: string; content: any }>,
  config: SSEStreamConfig,
  signal: AbortSignal,
): Promise<AsyncIterable<string> | null> {
  // We need access to the raw API URL and key to do native streaming.
  // Import them from the environment — same as _core/llm.ts uses.
  const apiUrl = process.env.FORGE_API_URL
    ? `${process.env.FORGE_API_URL.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";
  const apiKey = process.env.FORGE_API_KEY;

  if (!apiKey) return null;

  // Use the model registry's default, overridable via env
  const { getDefaultModelId } = await import("../config/modelRegistry");
  const model = process.env.DEFAULT_LLM_MODEL || getDefaultModelId();
  const payload: Record<string, unknown> = {
    model,
    messages: enrichedMessages, // Uses context-enriched messages, not raw
    stream: true,
    max_tokens: 32768,
  };
  if (config.tools && config.tools.length > 0) {
    payload.tools = config.tools;
    payload.tool_choice = config.tool_choice || "auto";
  }

  // Streaming connection timeout: abort if no response in 30s
  const STREAM_CONNECT_TIMEOUT_MS = 30_000;
  const timeoutId = setTimeout(() => {
    if (!signal.aborted) {
      logger.warn({ operation: "sseStream.connectTimeout" }, "[SSE] Native stream connection timed out");
    }
  }, STREAM_CONNECT_TIMEOUT_MS);

  let response: globalThis.Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Streaming API returned ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") && !contentType.includes("text/plain")) {
    // Provider returned a non-streaming response — return null to trigger fallback
    return null;
  }

  if (!response.body) return null;

  // Return an async iterable that yields SSE data lines
  return parseSSEStream(response.body as any);
}

async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function extractStreamContent(chunk: string): string {
  try {
    const parsed = JSON.parse(chunk);
    return parsed.choices?.[0]?.delta?.content || "";
  } catch {
    return "";
  }
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
