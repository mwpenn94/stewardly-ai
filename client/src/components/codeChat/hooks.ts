/**
 * User-defined hooks for Code Chat — Pass 249.
 *
 * Claude Code supports hooks: user-configured rules that fire on
 * specific events (PreToolUse, PostToolUse, SessionStart,
 * UserPromptSubmit) and can block, warn, or inject context. This
 * module is the client-side equivalent — a localStorage-backed
 * registry of hook rules that the Code Chat UI applies around every
 * tool call and prompt submit.
 *
 * Design constraints (why it's a client-side pure module, not a
 * shell-exec framework like Claude Code's hooks):
 *   - Running arbitrary shell commands from user config in a hosted
 *     app is a security hazard. Stewardly runs on a shared server,
 *     so user-defined hooks can't just spawn bash.
 *   - The useful 80% of Claude Code hook usage is declarative: "warn
 *     me when the agent is about to touch auth.ts", "block writes to
 *     .env files", "inject a reminder into the prompt when I start a
 *     new session". Those don't need shell exec — they need a pattern
 *     matcher + an action enum.
 *
 * Action set:
 *   - `block`         — cancel the tool call entirely, return a
 *                       synthetic error message to the agent
 *   - `warn`          — emit a toast + log but let the call proceed
 *   - `inject_prompt` — prepend a text note to the user message
 *                       before sending (PreToolUse / UserPromptSubmit)
 *   - `inject_system` — append a system-prompt snippet for the run
 *                       (SessionStart / UserPromptSubmit)
 *
 * Pattern language (deliberately small and safe):
 *   - `*`              → match everything
 *   - `read_file`      → exact tool-name match (case-insensitive)
 *   - `write_*`        → glob prefix match (case-insensitive)
 *   - `*:path/to.ts`   → optional argument filter on a `path` arg
 *   - `*:*.env`        → glob argument filter (any file ending .env)
 *   - `[a|b]`          → OR list of alternatives
 *
 * All pure. UI lives in HooksPopover.tsx. The stream hook
 * (useCodeChatStream.ts) applies the rules at send time (prompt
 * injection) and the client interceptor evaluates them at tool_start
 * time (block/warn/inject).
 */

export type HookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "SessionStart"
  | "UserPromptSubmit";

export type HookAction =
  | "block"
  | "warn"
  | "inject_prompt"
  | "inject_system";

export interface HookRule {
  id: string;
  event: HookEvent;
  /** Pattern string — see module header for grammar */
  pattern: string;
  action: HookAction;
  /** Optional message used by block/warn/inject_* actions */
  message: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export const STORAGE_KEY = "stewardly-codechat-hooks";
export const MAX_HOOKS = 50;
export const MAX_MESSAGE_LENGTH = 2000;

export const EVENT_LABELS: Record<HookEvent, string> = {
  PreToolUse: "Before tool call",
  PostToolUse: "After tool call",
  SessionStart: "When session starts",
  UserPromptSubmit: "When you send a message",
};

export const ACTION_LABELS: Record<HookAction, string> = {
  block: "Block the operation",
  warn: "Warn but allow",
  inject_prompt: "Add note to user prompt",
  inject_system: "Add note to system prompt",
};

// ─── Pattern matching ────────────────────────────────────────────────────

/**
 * A compiled hook pattern.
 *
 *   toolPart  — glob matched against the raw tool name
 *                (for *ToolUse events) or "*" for non-tool events
 *   argPart   — optional glob matched against any string arg value
 *                (typically `path`); null when no arg filter was
 *                specified
 *
 * Patterns are split on the first unescaped ':'. The left side is
 * the tool glob, the right side is the optional arg glob.
 */
export interface CompiledPattern {
  toolPart: string;
  argPart: string | null;
}

/**
 * Parse a pattern string into its two halves. Returns null if the
 * pattern is empty or malformed. The split is done on the first
 * unescaped `:`, which lets users write `foo:bar` to filter on both
 * tool and arg. Escape with `\:` to include a literal colon.
 */
export function compilePattern(pattern: string): CompiledPattern | null {
  if (typeof pattern !== "string") return null;
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  // Walk the string looking for the first unescaped colon
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
    return { toolPart: trimmed, argPart: null };
  }
  const tool = trimmed.slice(0, colonAt).replace(/\\:/g, ":").trim();
  const arg = trimmed.slice(colonAt + 1).replace(/\\:/g, ":").trim();
  return {
    toolPart: tool || "*",
    argPart: arg ? arg : null,
  };
}

/**
 * Convert a glob-ish string to a case-insensitive RegExp. Supports:
 *   *            → .*
 *   [a|b|c]      → (a|b|c) alternation
 *   literal text → escaped regex
 */
export function globToRegex(glob: string): RegExp {
  if (!glob || glob === "*") return /^.*$/i;
  // First pass: extract OR groups so their contents escape correctly
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
          .map(escapeRegex);
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
    out += escapeRegex(ch);
    i++;
  }
  return new RegExp(`^${out}$`, "i");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match a compiled hook pattern against a tool call. Returns true when
 * the tool name matches the tool part AND (if specified) any string
 * arg matches the arg part.
 */
export function matchToolCall(
  compiled: CompiledPattern,
  toolName: string,
  args: Record<string, unknown> = {},
): boolean {
  const toolRegex = globToRegex(compiled.toolPart);
  if (!toolRegex.test(toolName)) return false;
  if (!compiled.argPart) return true;
  const argRegex = globToRegex(compiled.argPart);
  for (const value of Object.values(args)) {
    if (typeof value === "string" && argRegex.test(value)) {
      return true;
    }
  }
  return false;
}

// ─── CRUD ────────────────────────────────────────────────────────────────

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `hook-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build a new hook rule. Pure — does NOT persist. The caller composes
 * the new hook with an existing list via `upsertHook`.
 */
export function makeHook(
  input: Partial<HookRule> & { event: HookEvent; pattern: string; action: HookAction },
): HookRule {
  const now = Date.now();
  const message =
    typeof input.message === "string"
      ? input.message.slice(0, MAX_MESSAGE_LENGTH)
      : "";
  return {
    id: input.id ?? genId(),
    event: input.event,
    pattern: input.pattern.trim(),
    action: input.action,
    message,
    enabled: input.enabled ?? true,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

/**
 * Insert or replace a hook by id. Newest entries sort to the front
 * so the UI shows recent edits at the top. Caps at MAX_HOOKS by
 * dropping the oldest on overflow.
 */
export function upsertHook(hooks: HookRule[], next: HookRule): HookRule[] {
  const existingIdx = hooks.findIndex((h) => h.id === next.id);
  let out: HookRule[];
  if (existingIdx >= 0) {
    out = hooks.slice();
    out[existingIdx] = { ...next, updatedAt: Date.now() };
  } else {
    out = [next, ...hooks];
  }
  // Sort newest-updated first
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  if (out.length > MAX_HOOKS) {
    out = out.slice(0, MAX_HOOKS);
  }
  return out;
}

export function removeHook(hooks: HookRule[], id: string): HookRule[] {
  return hooks.filter((h) => h.id !== id);
}

export function toggleHook(hooks: HookRule[], id: string): HookRule[] {
  return hooks.map((h) =>
    h.id === id ? { ...h, enabled: !h.enabled, updatedAt: Date.now() } : h,
  );
}

export function filterByEvent(hooks: HookRule[], event: HookEvent): HookRule[] {
  return hooks.filter((h) => h.event === event);
}

export function enabledHooks(hooks: HookRule[]): HookRule[] {
  return hooks.filter((h) => h.enabled);
}

// ─── Evaluation ──────────────────────────────────────────────────────────

export interface ToolHookOutcome {
  /** Should the tool call be blocked? */
  blocked: boolean;
  /** Reason shown to the user + agent when blocked or warned */
  blockReason?: string;
  /** Any `warn` rules that fired (block rules are NOT included here — they go on blockReason) */
  warnings: string[];
  /** Text snippets to inject into the next user prompt */
  promptInjections: string[];
  /** Text snippets to inject into the system prompt */
  systemInjections: string[];
  /** IDs of rules that matched (for logging / UI highlight) */
  matchedIds: string[];
}

export function emptyOutcome(): ToolHookOutcome {
  return {
    blocked: false,
    warnings: [],
    promptInjections: [],
    systemInjections: [],
    matchedIds: [],
  };
}

/**
 * Evaluate all matching hooks for a tool call event. Used by the
 * client interceptor to decide whether to block, warn, or inject
 * context before each tool_start fires in the stream loop.
 *
 * Multiple rules can match — the first `block` action wins (early
 * return isn't used so all matched ids accumulate for UI).
 */
export function evaluateToolCall(
  hooks: HookRule[],
  event: "PreToolUse" | "PostToolUse",
  toolName: string,
  args: Record<string, unknown>,
): ToolHookOutcome {
  const outcome = emptyOutcome();
  for (const hook of hooks) {
    if (!hook.enabled) continue;
    if (hook.event !== event) continue;
    const compiled = compilePattern(hook.pattern);
    if (!compiled) continue;
    if (!matchToolCall(compiled, toolName, args)) continue;
    outcome.matchedIds.push(hook.id);
    switch (hook.action) {
      case "block":
        if (!outcome.blocked) {
          outcome.blocked = true;
          outcome.blockReason =
            hook.message ||
            `Blocked by user hook: ${hook.pattern}`;
        }
        break;
      case "warn":
        outcome.warnings.push(
          hook.message || `Hook '${hook.pattern}' matched`,
        );
        break;
      case "inject_prompt":
        if (hook.message) outcome.promptInjections.push(hook.message);
        break;
      case "inject_system":
        if (hook.message) outcome.systemInjections.push(hook.message);
        break;
    }
  }
  return outcome;
}

/**
 * Evaluate all prompt-level hooks (UserPromptSubmit / SessionStart).
 * These run once per send (or once per session-start), never per
 * tool call. Only `inject_prompt`, `inject_system`, and `block`
 * actions are meaningful — `warn` is treated the same as inject.
 */
export function evaluatePrompt(
  hooks: HookRule[],
  event: "UserPromptSubmit" | "SessionStart",
  prompt: string,
): ToolHookOutcome {
  const outcome = emptyOutcome();
  for (const hook of hooks) {
    if (!hook.enabled) continue;
    if (hook.event !== event) continue;
    const compiled = compilePattern(hook.pattern);
    if (!compiled) continue;
    // For prompt events, the tool glob matches against the prompt text.
    // If pattern is `*` it matches every prompt; otherwise it's a
    // substring-style filter where `*keyword*` matches prompts containing
    // the keyword (case-insensitive).
    const promptRegex = globToRegex(compiled.toolPart);
    const hit =
      compiled.toolPart === "*" ||
      promptRegex.test(prompt) ||
      // Also match substring for convenience
      prompt.toLowerCase().includes(compiled.toolPart.replace(/\*/g, "").toLowerCase());
    if (!hit) continue;
    outcome.matchedIds.push(hook.id);
    switch (hook.action) {
      case "block":
        if (!outcome.blocked) {
          outcome.blocked = true;
          outcome.blockReason =
            hook.message || `Blocked by hook: ${hook.pattern}`;
        }
        break;
      case "warn":
        outcome.warnings.push(hook.message || `Hook '${hook.pattern}' matched`);
        break;
      case "inject_prompt":
        if (hook.message) outcome.promptInjections.push(hook.message);
        break;
      case "inject_system":
        if (hook.message) outcome.systemInjections.push(hook.message);
        break;
    }
  }
  return outcome;
}

/**
 * Combine a list of prompt injections into a single `[hooks]` block
 * prepended to the user message. Returns the original prompt when no
 * injections were requested.
 */
export function applyPromptInjections(
  prompt: string,
  injections: string[],
): string {
  if (!injections || injections.length === 0) return prompt;
  const notes = injections.map((s) => `- ${s}`).join("\n");
  return `[Hook context — user-defined notes]\n${notes}\n\n${prompt}`;
}

/**
 * Combine a list of system injections into a system-prompt overlay
 * fragment. The server appends this to its base system prompt.
 */
export function buildHookSystemOverlay(injections: string[]): string {
  if (!injections || injections.length === 0) return "";
  const notes = injections.map((s) => `- ${s}`).join("\n");
  return `\n# User-defined hook rules\n${notes}\n`;
}

// ─── Serialization ───────────────────────────────────────────────────────

export function serializeHooks(hooks: HookRule[]): string {
  return JSON.stringify(hooks);
}

/**
 * Parse + validate a stored hooks blob. Defensive: drops malformed
 * entries, clamps overflow, ignores unknown fields. Returns [] on
 * totally invalid input.
 */
export function parseHooks(raw: string | null): HookRule[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const validEvents: HookEvent[] = [
      "PreToolUse",
      "PostToolUse",
      "SessionStart",
      "UserPromptSubmit",
    ];
    const validActions: HookAction[] = [
      "block",
      "warn",
      "inject_prompt",
      "inject_system",
    ];
    const out: HookRule[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      if (typeof entry.pattern !== "string" || !entry.pattern.trim()) continue;
      if (typeof entry.event !== "string" || !validEvents.includes(entry.event as HookEvent)) continue;
      if (typeof entry.action !== "string" || !validActions.includes(entry.action as HookAction)) continue;
      const now = Date.now();
      const hook: HookRule = {
        id:
          typeof entry.id === "string" && entry.id
            ? entry.id
            : genId(),
        event: entry.event as HookEvent,
        pattern: entry.pattern.trim(),
        action: entry.action as HookAction,
        message:
          typeof entry.message === "string"
            ? entry.message.slice(0, MAX_MESSAGE_LENGTH)
            : "",
        enabled: entry.enabled !== false, // default true
        createdAt:
          typeof entry.createdAt === "number" ? entry.createdAt : now,
        updatedAt:
          typeof entry.updatedAt === "number" ? entry.updatedAt : now,
      };
      out.push(hook);
      if (out.length >= MAX_HOOKS) break;
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  } catch {
    return [];
  }
}

export function loadHooks(): HookRule[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return parseHooks(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveHooks(hooks: HookRule[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeHooks(hooks));
  } catch {
    /* storage full or disabled — best-effort */
  }
}

// ─── Summary (for UI badges) ─────────────────────────────────────────────

export interface HookSummary {
  total: number;
  enabled: number;
  byEvent: Record<HookEvent, number>;
  byAction: Record<HookAction, number>;
}

export function summarizeHooks(hooks: HookRule[]): HookSummary {
  const summary: HookSummary = {
    total: hooks.length,
    enabled: 0,
    byEvent: {
      PreToolUse: 0,
      PostToolUse: 0,
      SessionStart: 0,
      UserPromptSubmit: 0,
    },
    byAction: {
      block: 0,
      warn: 0,
      inject_prompt: 0,
      inject_system: 0,
    },
  };
  for (const h of hooks) {
    if (h.enabled) summary.enabled++;
    summary.byEvent[h.event]++;
    summary.byAction[h.action]++;
  }
  return summary;
}
