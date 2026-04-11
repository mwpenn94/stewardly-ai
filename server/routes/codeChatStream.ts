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
import { extractFileMentions } from "../services/codeChat/fileIndex";
import { readFile as sandboxReadFile } from "../services/codeChat/fileTools";
import {
  loadProjectInstructions,
  buildInstructionsPromptOverlay,
} from "../services/codeChat/projectInstructions";
import { logger } from "../_core/logger";

const codeChatStreamRouter = Router();

const WORKSPACE_ROOT =
  process.env.CODE_CHAT_WORKSPACE_ROOT ?? path.resolve(process.cwd());

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "list_directory",
  "grep_search",
  "update_todos", // Pass 237: no-op progress reporter, safe for all roles
]);

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

  const { message, model, allowMutations = false, maxIterations = 5, enabledTools, includeProjectInstructions = true, memoryOverlay } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const isAdmin = user.role === "admin";
  const canMutate = isAdmin && allowMutations;

  // Pass 213: per-tool allowlist. `enabledTools` is an optional array
  // of raw tool names (read_file, grep_search, write_file, ...). If
  // omitted, every tool the caller's role allows stays available.
  // If provided, we intersect it with the role-based allowlist so a
  // non-admin can never enable write tools by passing `enabledTools`.
  const userAllowed: Set<string> | null = Array.isArray(enabledTools)
    ? new Set(
        enabledTools.filter((t: unknown): t is string => typeof t === "string"),
      )
    : null;

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
      .filter((t) => (userAllowed ? userAllowed.has(t.name) : true))
      .map((t) => ({
        type: "function" as const,
        function: {
          name: `code_${t.name}`,
          description: t.description,
          parameters: t.parameters,
        },
      }));

    // Resolve 5-layer AI config for personalized behavior
    let layerOverlay = "";
    try {
      const { resolveAIConfig, buildLayerOverlayPrompt } = await import("../aiConfigResolver");
      const resolved = await resolveAIConfig({ userId: user.id, organizationId: user.affiliateOrgId ?? undefined });
      if (resolved) layerOverlay = buildLayerOverlayPrompt(resolved);
    } catch { /* config resolution is optional */ }

    // Pass 238: auto-load CLAUDE.md / .stewardly/instructions.md /
    // AGENTS.md from the workspace root and inject into the system
    // prompt so the agent always sees the project's house rules.
    let projectInstructionsOverlay = "";
    let loadedInstructionFiles: string[] = [];
    if (includeProjectInstructions) {
      try {
        const instructions = await loadProjectInstructions(WORKSPACE_ROOT);
        projectInstructionsOverlay = buildInstructionsPromptOverlay(instructions);
        loadedInstructionFiles = instructions.entries.map((e) => e.path);
      } catch { /* instructions are best-effort */ }
    }

    // Pass 241: agent memory overlay from the client (the client
    // owns the memory store in localStorage and serializes it into
    // a system-prompt block per request)
    const memorySnippet =
      typeof memoryOverlay === "string" && memoryOverlay.trim().length > 0
        ? memoryOverlay.trim().slice(0, 8192) // hard cap for safety
        : "";

    const systemPrompt = [
      "You are a Claude-Code-style coding assistant inside Stewardly.",
      "Work step-by-step. Use `code_list_directory` and `code_read_file` to explore.",
      "Use `code_grep_search` to find symbols or strings.",
      canMutate
        ? "You have `code_write_file`, `code_edit_file`, `code_run_bash` — use sparingly, explain every change."
        : "Write/edit/bash disabled. Return diffs as code blocks.",
      // Pass 237: expose the live todo tracker tool
      "For any task with 3+ steps, call `code_update_todos` early with a pending list, then call it again after each step to flip status to in_progress/completed. Each item needs {id, content (imperative), activeForm (present-continuous), status}. This drives the live progress UI the user sees.",
      "Keep responses concise. Surface reasoning + tool calls.",
      layerOverlay ? `\n${layerOverlay}` : "",
      projectInstructionsOverlay ? `\n${projectInstructionsOverlay}` : "",
      memorySnippet ? `\n${memorySnippet}` : "",
    ].filter(Boolean).join("\n");

    // Pass 238: tell the client which instruction files landed in the
    // prompt so the UI can show a badge / hover preview
    if (loadedInstructionFiles.length > 0) {
      writeSse(res, {
        type: "instructions_loaded",
        files: loadedInstructionFiles,
      });
    }

    // ─── Pass 206: @file mention expansion ────────────────────────
    //
    // Pre-read any @path references in the user message and inline
    // the content as context. The LLM can still use `code_read_file`
    // for deeper exploration — this just saves a round-trip for the
    // files the user explicitly pointed at.
    const mentions = extractFileMentions(message, 5);
    const contextChunks: string[] = [];
    const resolvedMentions: Array<{ path: string; bytes: number; error?: string }> = [];
    for (const rel of mentions) {
      try {
        const fileResult = await sandboxReadFile(
          { workspaceRoot: WORKSPACE_ROOT, allowMutations: false, maxReadBytes: 32 * 1024 },
          rel,
        );
        contextChunks.push(
          `\n\n--- Mentioned file: ${rel} (${fileResult.byteLength}B${fileResult.truncated ? ", truncated" : ""}) ---\n${fileResult.content}`,
        );
        resolvedMentions.push({ path: rel, bytes: fileResult.byteLength });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        contextChunks.push(`\n\n--- Mentioned file: ${rel} (error: ${msg}) ---`);
        resolvedMentions.push({ path: rel, bytes: 0, error: msg });
      }
    }
    const userMessage = contextChunks.length > 0
      ? `${message}${contextChunks.join("")}`
      : message;
    if (resolvedMentions.length > 0) {
      writeSse(res, {
        type: "mentions_resolved",
        mentions: resolvedMentions,
      });
    }

    writeSse(res, { type: "thinking", content: "Starting analysis..." });

    const result = await executeReActLoop({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
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

        // Pass 237: for update_todos, also emit a dedicated SSE event
        // with the parsed todos payload so the client can render a
        // live todo panel without waiting for the final response.
        if (rawName === "update_todos" && (dispatchResult as any).kind === "todos") {
          writeSse(res, {
            type: "todos_updated",
            todos: (dispatchResult as any).result.todos,
          });
        }

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
