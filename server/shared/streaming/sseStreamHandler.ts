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
 * Wire this into an Express POST endpoint; the handler manages the full SSE
 * lifecycle including headers, heartbeat, disconnect cleanup, and error framing.
 *
 * IMPORTANT: extractQuery and injectContext are imported from the canonical
 * services/contextualLLM.ts (via stewardlyWiring) to prevent behavioral drift
 * between streaming and non-streaming paths. Do NOT duplicate these functions.
 */

import type { Request, Response } from "express";
import { logger } from "../../_core/logger";
import { getQuickContext, extractQuery, injectContext } from "../stewardlyWiring";
import type { ContextType } from "../stewardlyWiring";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SSEStreamConfig {
  /** The contextualLLM function from stewardlyWiring */
  contextualLLM: (params: any) => Promise<any>;
  /** Raw invokeLLM for streaming (fetch-based, supports stream: true) */
  invokeLLMStream?: (params: any) => Promise<ReadableStream<Uint8Array> | AsyncIterable<any>>;
  /** User ID for context injection */
  userId: number;
  /** Conversation/session ID */
  sessionId?: number;
  /** Context type for the intelligence layer */
  contextType?: string;
  /** Messages array (OpenAI-compatible format) */
  messages: Array<{ role: string; content: string }>;
  /** Optional tools for tool calling */
  tools?: any[];
  /** Optional tool_choice */
  tool_choice?: any;
}

export interface SSEEvent {
  type: "token" | "done" | "error" | "heartbeat" | "tool_status";
  content?: string;
  sessionId?: number;
  totalTokens?: number;
  message?: string;
  toolName?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FALLBACK_CHUNK_SIZE = 5; // words per simulated chunk
const FALLBACK_DELAY_MS = 20; // ms between simulated chunks
const HEARTBEAT_INTERVAL_MS = 15_000; // keep-alive every 15s

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
  const { contextualLLM, userId, sessionId, contextType = "chat", messages, tools, tool_choice } = config;

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
          writeSSE(res, {
            type: "done",
            sessionId,
            totalTokens: estimateTokens(totalContent),
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

    // ── Fallback: call contextualLLM normally, simulate streaming ──
    // Note: contextualLLM will inject context again, but since the
    // enrichedMessages already have context, contextualLLM's injection
    // is additive. For the fallback path, we pass the ORIGINAL messages
    // to avoid double injection (contextualLLM handles its own context).
    if (!streamed && !disconnected) {
      const result = await contextualLLM({
        userId,
        contextType,
        messages,
        ...(tools && tools.length > 0 ? { tools, tool_choice: tool_choice || "auto" } : {}),
      });

      const content = result.choices?.[0]?.message?.content || "";
      const chunks = chunkByWords(content, FALLBACK_CHUNK_SIZE);

      for (const chunk of chunks) {
        if (disconnected) break;
        writeSSE(res, { type: "token", content: chunk });
        await sleep(FALLBACK_DELAY_MS);
      }

      if (!disconnected) {
        writeSSE(res, {
          type: "done",
          sessionId,
          totalTokens: result.usage?.total_tokens || estimateTokens(content),
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

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    messages: enrichedMessages, // Uses context-enriched messages, not raw
    stream: true,
    max_tokens: 32768,
  };
  if (config.tools && config.tools.length > 0) {
    payload.tools = config.tools;
    payload.tool_choice = config.tool_choice || "auto";
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

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
