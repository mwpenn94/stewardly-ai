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
  extractSymbolCitations,
  buildCitationContext,
  formatCitationOverlay,
  type ResolvedSymbolCitation,
} from "../services/codeChat/symbolCitations";
import {
  loadProjectInstructions,
  buildInstructionsPromptOverlay,
} from "../services/codeChat/projectInstructions";
import { logger } from "../_core/logger";
import { sseConnectionLimiter } from "../shared/sseConnectionLimiter";

const codeChatStreamRouter = Router();

const WORKSPACE_ROOT =
  process.env.CODE_CHAT_WORKSPACE_ROOT ?? path.resolve(process.cwd());

const READ_ONLY_TOOLS = new Set([
  "read_file",
  "multi_read", // Build-loop Pass 2: batch read
  "list_directory",
  "grep_search",
  "glob_files", // Build-loop Pass 1: Claude-Code Glob parity
  "web_fetch", // Build-loop Pass 3: Claude-Code WebFetch parity
  "web_search", // Build-loop Pass 5: Claude-Code WebSearch parity
  "task", // Build-loop Pass 11: subagent (read-only by construction)
  "update_todos", // Pass 237: no-op progress reporter, safe for all roles
  "find_symbol", // Pass 242: workspace symbol index lookup
  "web_read", // Pass 1 (automation): read-only public web fetch
  "web_extract", // Pass 2 (automation): schema-guided structured extraction
  "web_crawl", // Pass 4 (automation): bounded BFS crawl
  "web_search", // Pass 5 (automation): cascading web search provider
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

  // CBL17: per-user SSE connection limit
  const connId = sseConnectionLimiter.acquire(user.id, "codechat");
  if (!connId) {
    res.status(429).json({ error: "Too many concurrent Code Chat streams" });
    return;
  }
  req.on("close", () => sseConnectionLimiter.release(connId));

  const { message, model, allowMutations = false, maxIterations: rawMaxIter = 5, enabledTools, includeProjectInstructions = true, memoryOverlay } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // Cap maxIterations to prevent DoS — client can request up to 25
  const maxIterations = Math.min(Math.max(1, Number(rawMaxIter) || 5), 25);

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
      "Use `code_grep_search` to find occurrences of text across the codebase.",
      "Use `code_multi_read` to read up to 10 files in ONE call whenever you already know 2+ files you need to inspect — it saves round-trips (the slowest part of a session).",
      "Use `code_glob_files` to find files by pattern (e.g. `src/**/*.tsx`, `server/services/**/*.test.ts`). Prefer this over `code_list_directory` when you know the filename shape, and over shell `find` for speed.",
      "Use `code_web_search` when you need fresh information beyond your training cutoff (recent library releases, current events, vendor pricing changes). Pair with `code_web_fetch` to read the most promising result in full.",
      "Use `code_task` to delegate large-scale exploratory work (find every consumer of X, audit every test that touches Y) to a focused subagent. The subagent runs its own ReAct loop with read-only tools and returns a single summary so your main reasoning trace stays clean.",
      "Use `code_web_fetch` to pull external docs (MDN, React, Node, GitHub READMEs, SEC/FINRA/IRS regulatory pages) into context when the user's question depends on up-to-date vendor documentation. Host allowlist is enforced.",
      "Use `code_find_symbol` when you know the name of a function/class/interface/type/const and want to jump to its DEFINITION (faster than grep, and returns only definition sites).",
      "Use `code_web_read` to fetch a public URL and read it as structured content (title, headings, text, links, forms). Prefer this over quoting from memory when the user asks about current docs, regulation, news, or an external site. It is rate-limited per domain and will not navigate private/internal hosts.",
      "Use `code_web_extract` when you already know what structured fields you need from a URL. Pass a `schema` mapping each field to a selector ('title', 'h2', 'regex:PATTERN', 'css:TAG', 'link', 'table', etc.) and optionally a `type` ('number', 'number[]', 'date', 'url[]', 'table[]', ...). This returns typed data without forcing you to reread the raw page and is the right tool for pulling prices, limits, tables, or specific fields from a regulatory doc or data page.",
      "Use `code_web_crawl` when the user wants a multi-page scan of a site (e.g. 'read every page under /docs/2026'). Returns a per-page summary — not full content — so budget remains bounded. Default limits are 10 pages / depth 2, cap 100 pages / depth 5. Stay same-origin unless the user explicitly says to cross.",
      "Use `code_web_search` when you need to FIND URLs (you don't know the exact address). It runs through Stewardly's cascading provider chain (Tavily → Brave → Manus → LLM fallback) and returns titles, URLs, and snippets. Chain with code_web_read or code_web_extract to actually read the hits.",
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
    // ─── Build-loop Pass 14: symbol citation expansion ───────────
    //
    // Closes the loop on G23 (Pass 13). The client rewrites
    // `#useAuth` mentions into `[useAuth at hooks/useAuth.ts:42]`
    // citations; here on the server we read each cited file at
    // the cited line ±5/+25 lines and inline the slice as
    // additional context the LLM sees alongside the prompt.
    const citations = extractSymbolCitations(message);
    const resolvedCitations: ResolvedSymbolCitation[] = [];
    for (const citation of citations) {
      try {
        const fileResult = await sandboxReadFile(
          { workspaceRoot: WORKSPACE_ROOT, allowMutations: false, maxReadBytes: 256 * 1024 },
          citation.path,
        );
        const lines = fileResult.content.split("\n");
        const ctx = buildCitationContext(lines, citation, 5, 25);
        if (ctx) {
          const r: ResolvedSymbolCitation = {
            ...citation,
            resolved: true,
            context: ctx.context,
            startLine: ctx.startLine,
          };
          resolvedCitations.push(r);
          contextChunks.push(formatCitationOverlay(r));
        } else {
          const r: ResolvedSymbolCitation = {
            ...citation,
            resolved: false,
            error: "empty file",
          };
          resolvedCitations.push(r);
          contextChunks.push(formatCitationOverlay(r));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const r: ResolvedSymbolCitation = {
          ...citation,
          resolved: false,
          error: msg,
        };
        resolvedCitations.push(r);
        contextChunks.push(formatCitationOverlay(r));
      }
    }
    if (resolvedCitations.length > 0) {
      writeSse(res, {
        type: "citations_resolved",
        citations: resolvedCitations.map((c) => ({
          name: c.name,
          path: c.path,
          line: c.line,
          resolved: c.resolved,
          error: c.error,
        })),
      });
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

    // Build-loop Pass 11 (G7): subagent runner for the `task` tool.
    // The subagent always gets a read-only tool set (no writes,
    // no bash) so a parent agent can't smuggle mutations through
    // a delegated task. Iterations are capped at 10 regardless of
    // what the parent requests.
    const taskRunner = async (input: {
      description: string;
      prompt: string;
      maxIterations?: number;
      model?: string;
    }) => {
      const subStart = Date.now();
      const subMaxIter = Math.min(Math.max(1, input.maxIterations ?? 5), 10);
      // Subagent always gets the read-only set, never write tools.
      const subToolDefs = CODE_CHAT_TOOL_DEFINITIONS
        .filter((t) => READ_ONLY_TOOLS.has(t.name))
        .filter((t) => (userAllowed ? userAllowed.has(t.name) : true))
        .map((t) => ({
          type: "function" as const,
          function: {
            name: `code_${t.name}`,
            description: t.description,
            parameters: t.parameters,
          },
        }));
      const subSystemPrompt = [
        "You are a focused subagent inside Stewardly Code Chat.",
        `Your task: ${input.description}`,
        "Use the read tools (read_file, multi_read, list_directory, grep_search, glob_files, find_symbol, web_fetch, web_search) to investigate.",
        "When you have enough information, return ONLY the answer — no preamble, no meta-commentary about tool calls.",
        "Be concise. The parent agent will read your reply and decide what to do.",
      ].join("\n");
      let subToolCallCount = 0;
      // Emit a subagent_start event so the UI can render a panel.
      writeSse(res, {
        type: "subagent_start",
        description: input.description,
        maxIterations: subMaxIter,
      });
      const subResult = await executeReActLoop({
        messages: [
          { role: "system", content: subSystemPrompt },
          { role: "user", content: input.prompt },
        ] as any,
        userId: user.id,
        tools: subToolDefs.length > 0 ? (subToolDefs as any) : undefined,
        maxIterations: subMaxIter,
        model: input.model ?? model,
        contextualLLM,
        executeTool: async (toolName: string, args: Record<string, unknown>) => {
          subToolCallCount++;
          const rawName = toolName.replace(/^code_/, "");
          // Subagent gets workspace + read-only — no canMutate even
          // if the parent has it on.
          const dispatchResult = await dispatchCodeTool(
            { name: rawName as any, args } as CodeToolCall,
            { workspaceRoot: WORKSPACE_ROOT, allowMutations: false },
          );
          // Stream a subagent_tool_call event so the UI can show
          // what the subagent is doing without polluting the parent
          // trace.
          writeSse(res, {
            type: "subagent_tool_call",
            toolName: rawName,
            kind: (dispatchResult as any).kind || "unknown",
          });
          return JSON.stringify(dispatchResult);
        },
      });
      const truncated = subResult.iterations >= subMaxIter;
      writeSse(res, {
        type: "subagent_done",
        description: input.description,
        iterations: subResult.iterations,
        toolCallCount: subToolCallCount,
        truncated,
      });
      return {
        description: input.description,
        summary: subResult.response,
        iterations: subResult.iterations,
        toolCallCount: subToolCallCount,
        durationMs: Date.now() - subStart,
        truncated,
      };
    };

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

// ─── Hook evaluator (exported for tests) ─────────────────────────────────

interface ToolHookRule {
  event: "PreToolUse" | "PostToolUse";
  pattern: string;
  action: "block" | "warn";
  message: string;
}

interface ToolHookOutcome {
  blocked: boolean;
  blockMessage?: string;
  warnings: Array<{ message: string }>;
}

function matchPattern(
  pattern: string,
  toolName: string,
  args: Record<string, unknown>,
): boolean {
  // Split pattern into tool part and optional arg part (separated by ':')
  const colonIdx = pattern.indexOf(":");
  const toolPattern = colonIdx >= 0 ? pattern.slice(0, colonIdx) : pattern;
  const argPattern = colonIdx >= 0 ? pattern.slice(colonIdx + 1) : null;

  // Match tool name
  if (!matchGlob(toolPattern, toolName)) return false;

  // If there's an arg pattern, check string arg values
  if (argPattern !== null) {
    const stringArgValues = Object.values(args).filter(
      (v): v is string => typeof v === "string",
    );
    if (stringArgValues.length === 0) return false;
    return stringArgValues.some((v) => matchGlob(argPattern, v));
  }

  return true;
}

function matchGlob(pattern: string, value: string): boolean {
  // Handle OR groups: [a|b|c]
  if (pattern.startsWith("[") && pattern.endsWith("]")) {
    const alternatives = pattern.slice(1, -1).split("|");
    return alternatives.some((alt) => matchGlob(alt, value));
  }
  // Convert glob pattern to regex
  const escaped = pattern.replace(/[.+^${}()|\\]/g, "\\$&");
  const regex = new RegExp(
    "^" + escaped.replace(/\*/g, ".*") + "$",
  );
  return regex.test(value);
}

export function evaluateToolHooks(
  rules: ToolHookRule[],
  event: "PreToolUse" | "PostToolUse",
  toolName: string,
  args: Record<string, unknown>,
): ToolHookOutcome {
  const outcome: ToolHookOutcome = { blocked: false, warnings: [] };

  for (const rule of rules) {
    if (rule.event !== event) continue;
    if (!matchPattern(rule.pattern, toolName, args)) continue;

    if (rule.action === "block") {
      if (!outcome.blocked) {
        outcome.blocked = true;
        outcome.blockMessage =
          rule.message || `Blocked tool call: ${toolName}`;
      }
    } else if (rule.action === "warn") {
      outcome.warnings.push({ message: rule.message });
    }
  }

  return outcome;
}

export default codeChatStreamRouter;
