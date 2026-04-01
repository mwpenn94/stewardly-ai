/**
 * ReAct Multi-Turn Tool Calling Loop
 *
 * Implements the Reasoning + Acting (ReAct) pattern:
 *   Think → Act → Observe → Think → Act → Observe → ... → Final Answer
 *
 * Features:
 * - Multi-turn tool execution (up to maxIterations)
 * - Reasoning trace logging to DB
 * - Escape hatch for duplicate no-tool responses
 * - Structured trace output for debugging
 */
import { reasoningTraces } from "../../../drizzle/schema";
import { logger } from "../../_core/logger";

// ── Types ────────────────────────────────────────────────────────────────────

/** OpenAI-compatible message shape used throughout the ReAct loop. */
export interface ReActMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

/** LLM response shape expected by the ReAct loop (OpenAI-compatible subset). */
export interface ReActLLMResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
  }>;
}

export interface ReActConfig {
  messages: ReActMessage[];
  userId: number;
  sessionId?: number;
  tools?: Array<Record<string, unknown>>;
  maxIterations?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts legacy ContextualLLMParams & InvokeResult
  contextualLLM: (params: any) => Promise<any>;
  executeTool: (toolName: string, args: Record<string, unknown>) => Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts Drizzle DB instance
  db?: any;
}

export interface ReActTrace {
  stepNumber: number;
  thought: string;
  action?: string;
  observation?: string;
  toolName?: string;
  durationMs: number;
}

export interface ReActResult {
  response: string;
  traces: ReActTrace[];
  iterations: number;
  toolCallCount: number;
  model?: string;
}

// ── Similarity check for escape hatch ────────────────────────────────────────

function contentSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const wordsAArr = Array.from(wordsA);
  const wordsBArr = Array.from(wordsB);
  const intersection = wordsAArr.filter((w) => wordsB.has(w));
  const unionSet = new Set([...wordsAArr, ...wordsBArr]);
  return unionSet.size > 0 ? intersection.length / unionSet.size : 0;
}

// ── Main ReAct Loop ──────────────────────────────────────────────────────────

export async function executeReActLoop(config: ReActConfig): Promise<ReActResult> {
  const {
    messages,
    userId,
    sessionId,
    tools,
    maxIterations = 5,
    contextualLLM,
    executeTool,
    db,
  } = config;

  const traces: ReActTrace[] = [];
  let totalToolCalls = 0;
  let iteration = 0;
  let lastNoToolContent = "";
  let consecutiveNoToolRounds = 0;

  // Working copy of messages that accumulates tool results
  const workingMessages = [...messages];

  // Guard: prevent unbounded message growth (max ~500KB of accumulated messages)
  const MAX_WORKING_MESSAGES_SIZE = 500_000;

  while (iteration < maxIterations) {
    iteration++;

    // Check accumulated message size to prevent memory exhaustion
    const estimatedSize = JSON.stringify(workingMessages).length;
    if (estimatedSize > MAX_WORKING_MESSAGES_SIZE) {
      logger.warn(
        { iteration, estimatedSize, maxSize: MAX_WORKING_MESSAGES_SIZE },
        "[ReActLoop] Working messages exceeded size limit — forcing final answer",
      );
      break;
    }
    const stepStart = Date.now();

    // ── Think: call the LLM ──────────────────────────────────────────
    const response = await contextualLLM({
      userId,
      contextType: "chat",
      messages: workingMessages,
      ...(tools && tools.length > 0 ? { tools, tool_choice: "auto" as const } : {}),
    });

    const choice = response.choices?.[0]?.message;
    const thought = typeof choice?.content === "string" ? choice.content : "";
    const toolCalls = choice?.tool_calls ?? [];

    // ── No tool calls → check escape hatch ───────────────────────────
    if (toolCalls.length === 0) {
      const stepDuration = Date.now() - stepStart;

      const trace: ReActTrace = {
        stepNumber: iteration,
        thought,
        durationMs: stepDuration,
      };
      traces.push(trace);

      // Log to DB
      await logTrace(db, sessionId, trace);

      // Escape hatch: 2 consecutive no-tool rounds with similar content
      if (consecutiveNoToolRounds >= 1 && contentSimilarity(thought, lastNoToolContent) > 0.7) {
        logger.debug(
          { iteration, similarity: contentSimilarity(thought, lastNoToolContent) },
          "[ReActLoop] Escape hatch triggered — duplicate no-tool response",
        );
        return {
          response: thought,
          traces,
          iterations: iteration,
          toolCallCount: totalToolCalls,
          model: response.model,
        };
      }

      consecutiveNoToolRounds++;
      lastNoToolContent = thought;

      // If this is the final answer (no tools), return
      return {
        response: thought,
        traces,
        iterations: iteration,
        toolCallCount: totalToolCalls,
        model: response.model,
      };
    }

    // ── Act: execute tool calls ──────────────────────────────────────
    consecutiveNoToolRounds = 0;
    lastNoToolContent = "";

    // Add assistant message with tool_calls to working messages
    workingMessages.push({
      role: "assistant",
      content: thought || "",
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const toolStart = Date.now();
      let observation: string;

      try {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          // Malformed JSON from LLM — log and skip this tool call
          logger.warn(
            { toolName: toolCall.function.name, rawArgs: toolCall.function.arguments.substring(0, 200) },
            "[ReActLoop] Malformed tool call arguments — skipping",
          );
          workingMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({ error: "Malformed arguments — could not parse JSON" }),
          });
          totalToolCalls++;
          continue;
        }
        // Timeout guard: prevent tool calls from hanging indefinitely (30s default)
        const TOOL_TIMEOUT_MS = 30_000;
        observation = await Promise.race([
          executeTool(toolCall.function.name, args),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error(`Tool '${toolCall.function.name}' timed out after ${TOOL_TIMEOUT_MS}ms`)), TOOL_TIMEOUT_MS),
          ),
        ]);
      } catch (err: any) {
        observation = JSON.stringify({ error: err.message });
        logger.warn(
          { toolName: toolCall.function.name, error: err.message },
          "[ReActLoop] Tool execution failed",
        );
      }

      const toolDuration = Date.now() - toolStart;
      totalToolCalls++;

      // Add tool result to working messages
      workingMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: observation,
      });

      const trace: ReActTrace = {
        stepNumber: iteration,
        thought,
        action: toolCall.function.arguments,
        observation: observation.substring(0, 2000), // Truncate for DB storage
        toolName: toolCall.function.name,
        durationMs: toolDuration,
      };
      traces.push(trace);

      // Log to DB
      await logTrace(db, sessionId, trace);
    }

    const stepDuration = Date.now() - stepStart;
    logger.debug(
      { iteration, toolCalls: toolCalls.length, durationMs: stepDuration },
      "[ReActLoop] Completed iteration",
    );
  }

  // ── Max iterations reached — extract final content ─────────────────
  logger.debug(
    { maxIterations, totalToolCalls },
    "[ReActLoop] Max iterations reached, returning last response",
  );

  // Make one final call without tools to get a summary
  const finalResponse = await contextualLLM({
    userId,
    contextType: "chat",
    messages: [
      ...workingMessages,
      { role: "user" as const, content: "Please provide your final response based on all the information gathered above." },
    ],
  });

  const finalContent = typeof finalResponse.choices?.[0]?.message?.content === "string"
    ? finalResponse.choices[0].message.content
    : "";

  return {
    response: finalContent,
    traces,
    iterations: maxIterations,
    toolCallCount: totalToolCalls,
    model: finalResponse.model,
  };
}

// ── DB Logging Helper ────────────────────────────────────────────────────────

async function logTrace(db: any, sessionId: number | undefined, trace: ReActTrace): Promise<void> {
  if (!db || !sessionId) return;

  try {
    await db.insert(reasoningTraces).values({
      sessionId,
      stepNumber: trace.stepNumber,
      thought: trace.thought,
      action: trace.action ?? null,
      observation: trace.observation ?? null,
      toolName: trace.toolName ?? null,
      durationMs: trace.durationMs,
    });
  } catch (err) {
    logger.debug({ err }, "[ReActLoop] Failed to log reasoning trace");
  }
}
