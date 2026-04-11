/**
 * agentTodos — client-side helpers for the live agent todo tracker
 * (Pass 237).
 *
 * The server exposes an `update_todos` tool the agent calls mid-
 * execution to publish its current todo list. The SSE stream emits a
 * `todos_updated` event with the parsed payload; this module provides
 * the pure logic the client uses to:
 *
 *   1. Validate and normalize incoming payloads (defensive — the LLM
 *      can send malformed JSON, typo'd statuses, etc.)
 *   2. Merge updates into existing state (match by id, preserving
 *      insertion order of the new list)
 *   3. Derive progress counts for the summary strip
 *   4. Persist the last list per-message to localStorage
 *
 * Mirrors the shape of the server-side AgentTodoItem so the same
 * interface is usable on both sides.
 */

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface AgentTodoItem {
  id: string;
  content: string;
  activeForm: string;
  status: TodoStatus;
}

// ─── Validation ─────────────────────────────────────────────────────────

const VALID_STATUSES: TodoStatus[] = ["pending", "in_progress", "completed"];

/**
 * Parse an incoming `todos_updated` SSE payload into a normalized
 * AgentTodoItem[]. Drops malformed entries, caps at 50, auto-generates
 * missing ids, backfills activeForm from content when absent.
 */
export function parseTodosPayload(raw: unknown): AgentTodoItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentTodoItem[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const content = typeof rec.content === "string" ? rec.content.trim() : "";
    if (!content) continue;
    const activeForm =
      typeof rec.activeForm === "string" && rec.activeForm.trim()
        ? rec.activeForm.trim()
        : content;
    const statusRaw = typeof rec.status === "string" ? rec.status : "pending";
    const status = VALID_STATUSES.includes(statusRaw as TodoStatus)
      ? (statusRaw as TodoStatus)
      : "pending";
    let id = typeof rec.id === "string" && rec.id ? rec.id : `t-${i + 1}`;
    while (seen.has(id)) id = `${id}-${Math.random().toString(36).slice(2, 5)}`;
    seen.add(id);
    out.push({ id, content, activeForm, status });
    if (out.length >= 50) break;
  }
  return out;
}

// ─── Merging ────────────────────────────────────────────────────────────

/**
 * Merge an incoming todo list with existing state. The new list is the
 * authoritative order — items not in the new list are dropped. Items
 * that share an id with the existing list inherit status transitions
 * but the new payload wins for content/activeForm (so an edit to the
 * description is honored).
 *
 * This matches Claude Code's TodoWrite semantics: agents send the full
 * list every update, not partial diffs.
 */
export function mergeTodoList(
  existing: AgentTodoItem[],
  next: AgentTodoItem[],
): AgentTodoItem[] {
  const existingById = new Map<string, AgentTodoItem>();
  for (const e of existing) existingById.set(e.id, e);
  return next.map((n) => {
    const prev = existingById.get(n.id);
    if (!prev) return n;
    // New list always wins on content/activeForm/status (it's the
    // authoritative view as of the latest tool call)
    return { ...prev, ...n };
  });
}

// ─── Progress ───────────────────────────────────────────────────────────

export interface TodoProgress {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  pct: number;
  allDone: boolean;
}

export function todoProgress(todos: AgentTodoItem[]): TodoProgress {
  let pending = 0;
  let inProgress = 0;
  let completed = 0;
  for (const t of todos) {
    switch (t.status) {
      case "pending":
        pending++;
        break;
      case "in_progress":
        inProgress++;
        break;
      case "completed":
        completed++;
        break;
    }
  }
  const total = todos.length;
  const pct = total === 0 ? 0 : completed / total;
  return {
    total,
    pending,
    inProgress,
    completed,
    pct,
    allDone: total > 0 && completed === total,
  };
}

/**
 * Return the first in-progress item, or the first pending item if
 * nothing is running. Used by the header strip to show what the
 * agent is currently doing.
 */
export function currentTodo(todos: AgentTodoItem[]): AgentTodoItem | null {
  for (const t of todos) if (t.status === "in_progress") return t;
  for (const t of todos) if (t.status === "pending") return t;
  return null;
}

// ─── Persistence ────────────────────────────────────────────────────────

export const TODOS_STORAGE_KEY = "stewardly-codechat-agent-todos";

export function saveTodosForMessage(
  messageId: string,
  todos: AgentTodoItem[],
): void {
  try {
    const raw = localStorage.getItem(TODOS_STORAGE_KEY);
    const map: Record<string, AgentTodoItem[]> = raw ? JSON.parse(raw) : {};
    map[messageId] = todos;
    // Cap to 100 messages worth of todos
    const keys = Object.keys(map);
    if (keys.length > 100) {
      delete map[keys[0]];
    }
    localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function loadAllTodos(): Record<string, AgentTodoItem[]> {
  try {
    const raw = localStorage.getItem(TODOS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, AgentTodoItem[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const normalized = parseTodosPayload(v);
      if (normalized.length > 0) out[k] = normalized;
    }
    return out;
  } catch {
    return {};
  }
}
