/**
 * codeChatStream.ts — SSE streaming endpoint for Code Chat
 *
 * POST /api/codechat/stream
 *
 * Streams real-time tool execution events as the ReAct loop runs,
 * giving users live visibility into file reads, grep searches,
 * edits, and bash commands as they happen.
 */

import { Router } from "express";
import path from "path";
import { contextualLLM, executeReActLoop } from "../shared/stewardlyWiring";
import {
  dispatchCodeTool,
  CODE_CHAT_TOOL_DEFINITIONS,
  type CodeToolCall,
} from "../services/codeChat/codeChatExecutor";
import { logger } from "../_core/logger";

const codeChatStreamRouter = Router();

const WORKSPACE_ROOT =
  process.env.CODE_CHAT_WORKSPACE_ROOT ?? path.resolve(process.cwd());

const READ_ONLY_TOOLS = new Set(["read_file", "list_directory", "grep_search"]);

function writeSse(res: any, data: Record<string, unknown>): void {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

codeChatStreamRouter.post("/api/codechat/stream", async (req, res) => {
  // Auth is handled by the caller (index.ts passes authenticated user)
  const user = (req as any).__user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { message, model, allowMutations = false, maxIterations = 5 } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const isAdmin = user.role === "admin";
  const canMutate = isAdmin && allowMutations;

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => writeSse(res, { type: "heartbeat" }), 15000);

  // Abort on client disconnect
  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
    clearInterval(heartbeat);
  });

  const overallStart = Date.now();
  let stepIndex = 0;

  try {
    // Build tool definitions
    const toolDefs = CODE_CHAT_TOOL_DEFINITIONS
      .filter((t) => canMutate || READ_ONLY_TOOLS.has(t.name))
      .map((t) => ({
        type: "function" as const,
        function: {
          name: `code_${t.name}`,
          description: t.description,
          parameters: t.parameters,
        },
      }));

    const systemPrompt = [
      "You are a Claude-Code-style coding assistant inside Stewardly.",
      "Work step-by-step. Use `code_list_directory` and `code_read_file` to explore.",
      "Use `code_grep_search` to find symbols or strings.",
      canMutate
        ? "You have `code_write_file`, `code_edit_file`, `code_run_bash` — use sparingly, explain every change."
        : "Write/edit/bash disabled. Return diffs as code blocks.",
      "Keep responses concise. Surface reasoning + tool calls.",
    ].join("\n");

    writeSse(res, { type: "thinking", content: "Starting analysis..." });

    const result = await executeReActLoop({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ] as any,
      userId: user.id,
      tools: toolDefs.length > 0 ? (toolDefs as any) : undefined,
      maxIterations,
      model,
      contextualLLM,
      executeTool: async (toolName: string, args: Record<string, unknown>) => {
        stepIndex++;
        const rawName = toolName.replace(/^code_/, "");

        // Emit tool_start
        writeSse(res, {
          type: "tool_start",
          stepIndex,
          toolName: rawName,
          args: Object.fromEntries(
            Object.entries(args).map(([k, v]) => [k, typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "..." : v])
          ),
        });

        const mutation = ["write_file", "edit_file", "run_bash"].includes(rawName);
        if (mutation && !canMutate) {
          const errResult = JSON.stringify({ error: `${rawName} requires admin + write mode` });
          writeSse(res, { type: "tool_result", stepIndex, toolName: rawName, kind: "error", truncated: false, durationMs: 0 });
          return errResult;
        }

        const toolStart = Date.now();
        const dispatchResult = await dispatchCodeTool(
          { name: rawName as any, args } as CodeToolCall,
          { workspaceRoot: WORKSPACE_ROOT, allowMutations: canMutate },
        );
        const durationMs = Date.now() - toolStart;

        // Truncate large results for SSE (client can fetch full via dispatch)
        const resultStr = JSON.stringify(dispatchResult);
        const truncated = resultStr.length > 10000;

        writeSse(res, {
          type: "tool_result",
          stepIndex,
          toolName: rawName,
          kind: (dispatchResult as any).kind || "unknown",
          preview: truncated ? resultStr.slice(0, 10000) : resultStr,
          truncated,
          durationMs,
        });

        return resultStr;
      },
    });

    // Emit final response
    writeSse(res, {
      type: "done",
      response: result.response,
      traces: result.traces.map((t) => ({
        step: t.stepNumber,
        thought: t.thought,
        toolName: t.toolName?.replace(/^code_/, ""),
        observation: t.observation?.slice(0, 5000),
        durationMs: t.durationMs,
      })),
      iterations: result.iterations,
      toolCallCount: result.toolCallCount,
      model: result.model,
      totalDurationMs: Date.now() - overallStart,
    });
  } catch (err: any) {
    logger.error({ userId: user.id, error: err.message }, "codeChatStream failed");
    writeSse(res, { type: "error", message: err.message || "Code Chat stream failed" });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});

export default codeChatStreamRouter;
