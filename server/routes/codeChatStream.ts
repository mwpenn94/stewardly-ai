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
  "find_symbol", // Pass 242: workspace symbol index lookup
  "web_fetch", // Pass 250: URL retrieval (sandbox enforced inside webFetch.ts)
  "web_search", // Pass 251: cascading search (Tavily → Brave → Google → LLM)
]);

function writeSse(res: any, data: Record<string, unknown>): void {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// ─── Pass 249: server-side hook matcher ──────────────────────────────────
// Mirrors the client-side pure matcher in
// client/src/components/codeChat/hooks.ts. Kept deliberately small —
// glob + OR groups + optional `tool:arg` split. Any change here must
// also land on the client.

function escapeRegexServer(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegexServer(glob: string): RegExp {
  if (!glob || glob === "*") return /^.*$/i;
  let out = "";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "[") {
      const closeAt = glob.indexOf("]", i);
      if (closeAt > i) {
        const inside = glob.slice(i + 1, closeAt);
        const parts = inside
          .split("|")
          .map((p) => p.trim())
          .filter(Boolean)
          .map(escapeRegexServer);
        out += parts.length > 0 ? `(${parts.join("|")})` : "";
        i = closeAt + 1;
        continue;
      }
    }
    if (ch === "*") {
      out += ".*";
      i++;
      continue;
    }
    if (ch === "?") {
      out += ".";
      i++;
      continue;
    }
    out += escapeRegexServer(ch);
    i++;
  }
  return new RegExp(`^${out}$`, "i");
}

function compilePatternServer(pattern: string): { tool: string; arg: string | null } | null {
  if (typeof pattern !== "string") return null;
  const trimmed = pattern.trim();
  if (!trimmed) return null;
  let colonAt = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === ":") {
      i++;
      continue;
    }
    if (trimmed[i] === ":") {
      colonAt = i;
      break;
    }
  }
  if (colonAt === -1) {
    return { tool: trimmed, arg: null };
  }
  const tool = trimmed.slice(0, colonAt).replace(/\\:/g, ":").trim();
  const arg = trimmed.slice(colonAt + 1).replace(/\\:/g, ":").trim();
  return { tool: tool || "*", arg: arg || null };
}

function matchHookServer(
  pattern: string,
  toolName: string,
  args: Record<string, unknown>,
): boolean {
  const compiled = compilePatternServer(pattern);
  if (!compiled) return false;
  if (!globToRegexServer(compiled.tool).test(toolName)) return false;
  if (!compiled.arg) return true;
  const argRegex = globToRegexServer(compiled.arg);
  for (const v of Object.values(args)) {
    if (typeof v === "string" && argRegex.test(v)) return true;
  }
  return false;
}

export interface ServerToolHookOutcome {
  blocked: boolean;
  blockMessage?: string;
  warnings: Array<{ pattern: string; message: string }>;
}

export function evaluateToolHooks(
  rules: Array<{
    event: "PreToolUse" | "PostToolUse";
    pattern: string;
    action: "block" | "warn" | "inject_prompt" | "inject_system";
    message?: string;
  }>,
  event: "PreToolUse" | "PostToolUse",
  toolName: string,
  args: Record<string, unknown>,
): ServerToolHookOutcome {
  const outcome: ServerToolHookOutcome = { blocked: false, warnings: [] };
  for (const rule of rules) {
    if (rule.event !== event) continue;
    if (!matchHookServer(rule.pattern, toolName, args)) continue;
    if (rule.action === "block" && !outcome.blocked) {
      outcome.blocked = true;
      outcome.blockMessage =
        rule.message || `Blocked by user hook: ${rule.pattern}`;
    } else if (rule.action === "warn") {
      outcome.warnings.push({
        pattern: rule.pattern,
        message: rule.message || `Hook '${rule.pattern}' matched`,
      });
    }
    // inject_* actions are evaluated at prompt-build time on the client
    // and surfaced via hookSystemOverlay / prompt text. The server
    // never needs to touch them again inside the loop.
  }
  return outcome;
}

codeChatStreamRouter.post("/api/codechat/stream", async (req, res) => {
  // Auth is handled by the caller (index.ts passes authenticated user)
  const user = (req as any).__user;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { message, model, allowMutations = false, maxIterations = 5, enabledTools, includeProjectInstructions = true, memoryOverlay, toolHookRules, hookSystemOverlay } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // Pass 249: parse + sanitize client-supplied tool hook rules.
  // The server owns the eval loop (Pre/Post ToolUse) because the
  // client has no way to interrupt the ReAct loop mid-stream.
  type ToolHookRule = {
    event: "PreToolUse" | "PostToolUse";
    pattern: string;
    action: "block" | "warn" | "inject_prompt" | "inject_system";
    message?: string;
  };
  const sanitizedHookRules: ToolHookRule[] = Array.isArray(toolHookRules)
    ? toolHookRules
        .filter((r: any) => r && typeof r === "object")
        .filter(
          (r: any) =>
            (r.event === "PreToolUse" || r.event === "PostToolUse") &&
            typeof r.pattern === "string" &&
            r.pattern.trim().length > 0 &&
            ["block", "warn", "inject_prompt", "inject_system"].includes(
              r.action,
            ),
        )
        .slice(0, 100) // hard cap
        .map((r: any) => ({
          event: r.event,
          pattern: String(r.pattern).trim().slice(0, 500),
          action: r.action,
          message:
            typeof r.message === "string"
              ? r.message.slice(0, 2000)
              : "",
        }))
    : [];

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

    // Pass 249: client-built overlay from UserPromptSubmit/SessionStart
    // inject_system hooks. Hard-capped at 8KB.
    const hookSnippet =
      typeof hookSystemOverlay === "string" &&
      hookSystemOverlay.trim().length > 0
        ? hookSystemOverlay.trim().slice(0, 8192)
        : "";

    const systemPrompt = [
      "You are a Claude-Code-style coding assistant inside Stewardly.",
      "Work step-by-step. Use `code_list_directory` and `code_read_file` to explore.",
      "Use `code_grep_search` to find occurrences of text across the codebase.",
      "Use `code_find_symbol` when you know the name of a function/class/interface/type/const and want to jump to its DEFINITION (faster than grep, and returns only definition sites).",
      "Use `code_web_fetch` to pull a public URL (http/https only) when the user asks about external docs, API references, release notes, or any other content the workspace doesn't have. HTML is converted to markdown automatically.",
      "Use `code_web_search` when you need to find URLs first — it runs a cascading search (Tavily → Brave → Google → LLM fallback) and returns ranked {title, url, snippet} hits you can chain into `code_web_fetch` for the full content.",
      canMutate
        ? "You have `code_write_file`, `code_edit_file`, `code_run_bash` — use sparingly, explain every change."
        : "Write/edit/bash disabled. Return diffs as code blocks.",
      // Pass 237: expose the live todo tracker tool
      "For any task with 3+ steps, call `code_update_todos` early with a pending list, then call it again after each step to flip status to in_progress/completed. Each item needs {id, content (imperative), activeForm (present-continuous), status}. This drives the live progress UI the user sees.",
      "Keep responses concise. Surface reasoning + tool calls.",
      layerOverlay ? `\n${layerOverlay}` : "",
      projectInstructionsOverlay ? `\n${projectInstructionsOverlay}` : "",
      memorySnippet ? `\n${memorySnippet}` : "",
      hookSnippet ? `\n${hookSnippet}` : "",
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

        // Pass 249: PreToolUse hook evaluation. Runs before the
        // mutation check so a "block" hook can short-circuit even
        // read-only calls the user wants to audit.
        if (sanitizedHookRules.length > 0) {
          const pre = evaluateToolHooks(
            sanitizedHookRules,
            "PreToolUse",
            rawName,
            args,
          );
          for (const warn of pre.warnings) {
            writeSse(res, {
              type: "hook_fired",
              stepIndex,
              toolName: rawName,
              action: "warn",
              message: warn.message,
              pattern: warn.pattern,
            });
          }
          if (pre.blocked) {
            const blockMsg =
              pre.blockMessage || `Tool '${rawName}' blocked by user hook.`;
            writeSse(res, {
              type: "hook_fired",
              stepIndex,
              toolName: rawName,
              action: "block",
              message: blockMsg,
            });
            writeSse(res, {
              type: "tool_result",
              stepIndex,
              toolName: rawName,
              kind: "error",
              preview: JSON.stringify({ error: blockMsg, blockedBy: "user_hook" }),
              truncated: false,
              durationMs: 0,
            });
            // Return a synthetic observation so the ReAct loop sees
            // the refusal and can choose a different next step.
            return JSON.stringify({
              kind: "error",
              error: blockMsg,
              code: "USER_HOOK_BLOCKED",
            });
          }
        }

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

        // Pass 249: PostToolUse hook evaluation. Warnings are the
        // main use case — "remind me to run tests after edit_file",
        // "note when grep returns 0 results", etc. Block actions on
        // PostToolUse abort the rest of the turn by throwing a
        // synthetic error back into the loop.
        if (sanitizedHookRules.length > 0) {
          const post = evaluateToolHooks(
            sanitizedHookRules,
            "PostToolUse",
            rawName,
            args,
          );
          for (const warn of post.warnings) {
            writeSse(res, {
              type: "hook_fired",
              stepIndex,
              toolName: rawName,
              action: "warn",
              message: warn.message,
              pattern: warn.pattern,
            });
          }
          if (post.blocked) {
            const blockMsg =
              post.blockMessage ||
              `Tool '${rawName}' flagged by post-use hook.`;
            writeSse(res, {
              type: "hook_fired",
              stepIndex,
              toolName: rawName,
              action: "block",
              message: blockMsg,
            });
            return JSON.stringify({
              kind: "error",
              error: blockMsg,
              code: "USER_HOOK_POST_BLOCKED",
            });
          }
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
