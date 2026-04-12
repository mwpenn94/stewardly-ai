/**
 * Slash-command registry for Code Chat (Pass 203).
 *
 * Claude Code's terminal has muscle-memory commands (`/clear`, `/help`,
 * etc.). This registry gives the same affordance inside the Stewardly
 * Code Chat — type `/` at the start of the input to see a fuzzy-filtered
 * popover of available commands, pick one with Tab/Enter, and the
 * command handler runs immediately without sending a chat message.
 *
 * Commands can either:
 *   - Execute synchronously (clear chat, toggle write mode) via
 *     `handler(ctx, args)`, OR
 *   - Rewrite the input (expand `/diff path.ts` into a longer prompt)
 *     by returning `{ rewrite: "new input" }` so the user can review
 *     and press Enter
 *
 * The registry is pure data + pure functions so it's unit-testable.
 */

export interface SlashCommand {
  /** Primary name, without the leading slash */
  name: string;
  /** Optional aliases (`/h` for `/help`, etc.) */
  aliases?: string[];
  /** One-line description shown in the popover */
  description: string;
  /** Argument schema for syntax hints (e.g. "<path>") */
  args?: string;
  /** Execute the command; returns either void or a rewrite instruction */
  handler: (
    ctx: SlashCommandContext,
    args: string,
  ) =>
    | void
    | { rewrite: string }
    | { compact: true; keepRecent?: number }
    | Promise<void | { rewrite: string } | { compact: true; keepRecent?: number }>;
}

export interface SlashCommandContext {
  clear: () => void;
  cancel: () => void;
  setInput: (value: string) => void;
  setAllowMutations: (v: boolean) => void;
  setMaxIterations: (n: number) => void;
  setModel: (id: string | undefined) => void;
  toast: (kind: "success" | "error" | "info", message: string) => void;
  isAdmin: boolean;
  /** Pass 4 (build-loop): undo the most-recent edit via the history ring buffer. */
  undoEdit?: () => void | Promise<void>;
  /** Pass 4 (build-loop): redo the most-recently undone edit. */
  redoEdit?: () => void | Promise<void>;
}

// ─── Built-in commands ───────────────────────────────────────────────────

export const BUILT_IN_COMMANDS: SlashCommand[] = [
  {
    name: "clear",
    aliases: ["c"],
    description: "Clear the chat history (keeps command history)",
    handler: (ctx) => {
      ctx.clear();
      ctx.toast("success", "Chat cleared");
    },
  },
  {
    name: "cancel",
    aliases: ["stop", "abort"],
    description: "Abort the currently running ReAct loop",
    handler: (ctx) => {
      ctx.cancel();
      ctx.toast("info", "Abort requested");
    },
  },
  {
    name: "help",
    aliases: ["h", "?"],
    description: "Open the keyboard shortcuts + slash command help overlay",
    handler: (_ctx) => {
      // Pass v5 #80: dispatch a window event so CodeChatInterface can
      // open the KeyboardShortcutsOverlay instead of dumping a 12+ line
      // wall of text into a toast (which is the wrong UI surface).
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("codechat-show-shortcuts"));
      }
    },
  },
  {
    name: "write",
    aliases: ["w"],
    description: "Toggle write mode on/off (admin only)",
    args: "on|off",
    handler: (ctx, args) => {
      if (!ctx.isAdmin) {
        ctx.toast("error", "write mode requires admin role");
        return;
      }
      const value =
        args.toLowerCase() === "on" ||
        args.toLowerCase() === "true" ||
        args === "1";
      const off =
        args.toLowerCase() === "off" ||
        args.toLowerCase() === "false" ||
        args === "0";
      if (!value && !off) {
        ctx.toast("error", "usage: /write on|off");
        return;
      }
      ctx.setAllowMutations(value);
      ctx.toast("success", `Write mode ${value ? "enabled" : "disabled"}`);
    },
  },
  {
    name: "iterations",
    aliases: ["iter", "i"],
    description: "Set max ReAct iterations (1-10)",
    args: "<n>",
    handler: (ctx, args) => {
      const n = parseInt(args.trim(), 10);
      if (!Number.isFinite(n) || n < 1 || n > 10) {
        ctx.toast("error", "usage: /iterations 1-10");
        return;
      }
      ctx.setMaxIterations(n);
      ctx.toast("success", `Max iterations → ${n}`);
    },
  },
  {
    name: "model",
    aliases: ["m"],
    description: "Override the model for the next message (empty = default)",
    args: "<model-id>",
    handler: (ctx, args) => {
      const trimmed = args.trim();
      ctx.setModel(trimmed || undefined);
      ctx.toast(
        "success",
        trimmed ? `Model override: ${trimmed}` : "Model override cleared",
      );
    },
  },
  {
    name: "diff",
    description: "Ask the agent to diff a file against its last commit",
    args: "<path>",
    handler: (_ctx, args) => {
      const p = args.trim();
      if (!p) return;
      return {
        rewrite: `Show me a unified diff of ${p} against the last committed version. Use \`code_read_file\` first, then summarize the changes.`,
      };
    },
  },
  {
    name: "explain",
    aliases: ["e"],
    description: "Ask the agent to explain a file's purpose",
    args: "<path>",
    handler: (_ctx, args) => {
      const p = args.trim();
      if (!p) return;
      return {
        rewrite: `Read ${p} and explain what it does, who calls it, and any notable design decisions or risks. Use \`code_read_file\` and \`code_grep_search\`.`,
      };
    },
  },
  {
    name: "find",
    aliases: ["grep", "search"],
    description: "Find a pattern across the codebase",
    args: "<pattern>",
    handler: (_ctx, args) => {
      const pattern = args.trim();
      if (!pattern) return;
      return {
        rewrite: `Search the codebase for occurrences of "${pattern}" and summarize what each hit does. Use \`code_grep_search\`.`,
      };
    },
  },
  {
    name: "web",
    aliases: ["fetch", "url"],
    description: "Fetch an external URL and summarize the content (Parity P1)",
    args: "<url> [question]",
    handler: (_ctx, args) => {
      const trimmed = args.trim();
      if (!trimmed) return;
      // Split first token off as URL, rest is an optional follow-up question
      const firstSpace = trimmed.indexOf(" ");
      const rawUrl = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
      const question = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();
      // Lightweight client-side sanity check so the user gets a fast
      // failure for obviously-bad inputs; the server re-validates.
      if (!/^https?:\/\//i.test(rawUrl)) {
        return {
          rewrite: `Use \`code_web_fetch\` to fetch ${rawUrl} (ensure it's an http/https URL) and summarize the content.${question ? `\n\nThen answer: ${question}` : ""}`,
        };
      }
      return {
        rewrite: `Use \`code_web_fetch\` to pull the content at ${rawUrl}. After reading, summarize the key information and cite any specific sections that matter.${question ? `\n\nThen answer this question using the fetched content: ${question}` : ""}`,
      };
    },
  },
  {
    name: "compact",
    description: "Summarize older turns into a single message to free up context",
    args: "[keepRecent]",
    handler: (_ctx, args) => {
      const trimmed = args.trim();
      const keepRecent = trimmed ? parseInt(trimmed, 10) : 4;
      if (trimmed && (!Number.isFinite(keepRecent) || keepRecent < 0)) {
        return;
      }
      return { compact: true, keepRecent: Number.isFinite(keepRecent) ? keepRecent : 4 };
    },
  },
  {
    name: "plan",
    aliases: ["p"],
    description: "Generate a step-by-step plan before executing (Pass 236)",
    args: "<task>",
    handler: (_ctx, args) => {
      const task = args.trim();
      if (!task) return;
      // Instruct the model to output a structured numbered list with
      // no execution. The client-side plan parser reads the response
      // and renders it as an interactive PlanReviewPanel.
      return {
        rewrite: `Generate a step-by-step plan for the following task. Output ONLY a numbered list of concrete, actionable steps — do NOT execute any tools and do NOT write any files yet. Each step should be one line, starting with a number like "1.", "2.", etc. Keep steps small and testable.\n\nTask: ${task}`,
      };
    },
  },
  {
    name: "undo",
    aliases: ["u"],
    description: "Revert the most-recent edit from the history ring buffer",
    handler: async (ctx) => {
      if (!ctx.undoEdit) {
        ctx.toast("error", "Undo is only available when the edit history is loaded");
        return;
      }
      await ctx.undoEdit();
    },
  },
  {
    name: "redo",
    aliases: ["r"],
    description: "Re-apply the most-recently undone edit",
    handler: async (ctx) => {
      if (!ctx.redoEdit) {
        ctx.toast("error", "Redo is only available when the edit history is loaded");
        return;
      }
      await ctx.redoEdit();
    },
  },
  {
    name: "remember",
    aliases: ["mem"],
    description: "Save a fact to agent memory (Pass 241)",
    args: "<fact>",
    handler: (ctx, args) => {
      const fact = args.trim();
      if (!fact) {
        ctx.toast("error", "usage: /remember <fact>");
        return;
      }
      // Dispatch a window event so the parent CodeChat component can
      // add to its memory store. Slash commands don't have direct
      // access to the memory state.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("codechat-remember", {
            detail: { content: fact },
          }),
        );
      }
      ctx.toast("success", `Saved to memory: "${fact.slice(0, 60)}${fact.length > 60 ? "…" : ""}"`);
    },
  },
];

// ─── Parser + lookup ─────────────────────────────────────────────────────

export interface ParsedSlashCommand {
  name: string;
  args: string;
}

export function parseSlashInput(input: string): ParsedSlashCommand | null {
  if (!input.startsWith("/")) return null;
  const trimmed = input.slice(1).trimStart();
  if (!trimmed) return null;
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return { name: trimmed, args: "" };
  return {
    name: trimmed.slice(0, spaceIdx),
    args: trimmed.slice(spaceIdx + 1),
  };
}

export function resolveCommand(
  name: string,
  registry: SlashCommand[] = BUILT_IN_COMMANDS,
): SlashCommand | null {
  const lowered = name.toLowerCase();
  return (
    registry.find(
      (c) => c.name === lowered || (c.aliases ?? []).includes(lowered),
    ) ?? null
  );
}

/**
 * Fuzzy-filter commands for the slash popover. Matches prefix on name
 * OR alias, then sub-string match on name. Returns at most `limit`
 * results sorted by relevance.
 */
export function filterCommands(
  query: string,
  registry: SlashCommand[] = BUILT_IN_COMMANDS,
  limit = 8,
): SlashCommand[] {
  const q = query.toLowerCase();
  if (!q) return registry.slice(0, limit);
  const scored: Array<{ cmd: SlashCommand; score: number }> = [];
  for (const cmd of registry) {
    const names = [cmd.name, ...(cmd.aliases ?? [])];
    let score = 0;
    for (const n of names) {
      if (n === q) score = Math.max(score, 100);
      else if (n.startsWith(q)) score = Math.max(score, 80);
      else if (n.includes(q)) score = Math.max(score, 40);
    }
    if (cmd.description.toLowerCase().includes(q))
      score = Math.max(score, 20);
    if (score > 0) scored.push({ cmd, score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.cmd);
}

/**
 * Try to execute the input as a slash command. Returns:
 *   - null if the input isn't a slash command (caller should treat it as a chat message)
 *   - { handled: true } if the command ran without producing a rewrite
 *   - { handled: true, rewrite: "..." } if the command rewrote the input
 *   - { handled: true, compact: true, keepRecent } if the command requested compaction
 *   - { handled: false, error: "..." } if the command name was unknown
 */
export async function tryRunSlashCommand(
  input: string,
  ctx: SlashCommandContext,
  registry: SlashCommand[] = BUILT_IN_COMMANDS,
): Promise<
  | null
  | { handled: true; rewrite?: string; compact?: boolean; keepRecent?: number }
  | { handled: false; error: string }
> {
  const parsed = parseSlashInput(input);
  if (!parsed) return null;
  const cmd = resolveCommand(parsed.name, registry);
  if (!cmd) {
    return { handled: false, error: `Unknown slash command: /${parsed.name}` };
  }
  try {
    const result = await cmd.handler(ctx, parsed.args);
    if (result && typeof result === "object") {
      if ("rewrite" in result) {
        return { handled: true, rewrite: result.rewrite };
      }
      if ("compact" in result && result.compact) {
        return {
          handled: true,
          compact: true,
          keepRecent: result.keepRecent,
        };
      }
    }
    return { handled: true };
  } catch (err) {
    return {
      handled: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
