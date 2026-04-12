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
import { validateStreamRequest } from "../services/codeChat/requestValidation";
import { buildToolCallAuditEvent } from "../services/codeChat/toolTelemetry";
import { logger } from "../_core/logger";

const codeChatStreamRouter = Router();

const WORKSPACE_ROOT =
  process.env.CODE_CHAT_WORKSPACE_ROOT ?? path.resolve(process.cwd());

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "list_directory",
  "grep_search",
  "update_todos", // Pass 237: no-op progress reporter, safe for all roles
  "find_symbol", // Pass 242: workspace symbol index lookup
  "web_fetch", // Parity Pass 1: SSRF-guarded external URL fetch
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

  // Parity Pass 4: centralized input validation. Every field that
  // used to have ad-hoc checks is now enforced here with specific
  // error codes. The pure validator is unit-tested separately.
  const validation = validateStreamRequest(req.body);
  if (!validation.ok) {
    logger.warn(
      { userId: user.id, field: validation.field, code: validation.code },
      "codeChatStream request rejected",
    );
    res.status(400).json({
      error: validation.message,
      code: validation.code,
      field: validation.field,
    });
    return;
  }
  const {
    message,
    model,
    allowMutations,
    maxIterations,
    enabledTools,
    includeProjectInstructions,
    memoryOverlay,
  } = validation.value;

  const isAdmin = user.role === "admin";
  const canMutate = isAdmin && allowMutations;

  // Pass 213: per-tool allowlist. `enabledTools` is an optional array
  // of raw tool names (read_file, grep_search, write_file, ...). If
  // omitted, every tool the caller's role allows stays available.
  // If provided, we intersect it with the role-based allowlist so a
  // non-admin can never enable write tools by passing `enabledTools`.
  const userAllowed: Set<string> | null =
    enabledTools !== null ? new Set(enabledTools) : null;

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
    // a system-prompt block per request). Pass 4 validator already
    // trimmed + byte-capped this field, but keep a belt-and-braces
    // slice() here in case limits diverge later.
    const memorySnippet =
      memoryOverlay.length > 0 ? memoryOverlay.slice(0, 8192) : "";

    const systemPrompt = [
      "You are a Claude-Code-style coding assistant inside Stewardly.",
      "Work step-by-step. Use `code_list_directory` and `code_read_file` to explore.",
      "Use `code_grep_search` to find occurrences of text across the codebase.",
      "Use `code_find_symbol` when you know the name of a function/class/interface/type/const and want to jump to its DEFINITION (faster than grep, and returns only definition sites).",
      "Use `code_web_fetch` to pull external documentation, API references, or reference material at runtime. Pass a full http(s) URL. The tool strips HTML to plain text, caps the body at 512KB, and blocks local/private hosts for SSRF safety. Prefer this over guessing when you need authoritative docs.",
      canMutate
        ? "You have `code_write_file`, `code_edit_file`, `code_multi_edit`, `code_run_bash` — use sparingly, explain every change. Prefer `code_multi_edit` when you need 2+ coordinated changes to the same file: it's atomic (either all edits apply or none do), so a file can never be left half-edited."
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

        const mutation = ["write_file", "edit_file", "multi_edit", "run_bash"].includes(rawName);
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

        // Parity Pass 7: emit a structured audit event for every
        // tool dispatch — writable to logs/DB/webhooks by the
        // logger transport. Args are redacted in place via the
        // pure toolTelemetry module so secrets never hit the log.
        const resultKind = (dispatchResult as any).kind || "unknown";
        const isError = resultKind === "error";
        const auditEvent = buildToolCallAuditEvent(
          {
            userId: user.id,
            role: user.role,
            toolName: rawName,
            args,
            resultKind,
            error: isError,
            errorMessage: isError ? (dispatchResult as any).error : undefined,
            errorCode: isError ? (dispatchResult as any).code : undefined,
            durationMs,
            resultBytes: resultStr.length,
            source: "react-loop",
          },
          { workspaceRoot: WORKSPACE_ROOT },
        );
        logger.info({ audit: auditEvent }, "codechat.tool_call");

        writeSse(res, {
          type: "tool_result",
          stepIndex,
          toolName: rawName,
          kind: resultKind,
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
