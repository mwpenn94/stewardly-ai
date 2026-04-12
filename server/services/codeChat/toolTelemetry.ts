/**
 * toolTelemetry.ts — structured audit events for the tool dispatcher (Parity Pass 7).
 *
 * Prior state: every tool call the Code Chat ReAct loop executed
 * landed in the SSE stream to the client but nowhere else. Admins
 * auditing "what did the agent do in session X" had to tail the
 * process logger and piece together events from unstructured log
 * lines. There was no stable, queryable record of tool activity
 * per user per session.
 *
 * This module provides:
 *   1. `buildToolCallAuditEvent` — a pure function that takes the
 *      raw dispatch result + metadata and produces a stable JSON
 *      shape suitable for logger.info, a DB row, a Slack webhook,
 *      or whatever the caller wants. Shape is versioned so future
 *      consumers can evolve safely.
 *   2. `redactToolArgs` — pure redactor that strips sensitive fields
 *      (long content strings, plausible secrets, absolute paths) so
 *      a careless prompt doesn't end up in audit logs verbatim.
 *   3. `classifyToolKind` — pure classifier labeling each tool as
 *      read / write / shell / network / meta for budget + display
 *      aggregation.
 *
 * Everything is side-effect-free so it's unit-testable and the SSE
 * route can call it synchronously from the inline onTool callback
 * without awaiting I/O.
 */

export const TOOL_AUDIT_EVENT_VERSION = 1;

// ─── Types ─────────────────────────────────────────────────────────────

export type ToolKindLabel =
  | "read"
  | "write"
  | "shell"
  | "network"
  | "meta"
  | "unknown";

export interface ToolCallAuditEvent {
  /** Schema version — bump when fields are added/changed so consumers can evolve */
  v: number;
  /** Stable identifier so duplicates can be deduped downstream */
  eventId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  userId: number | string;
  /** Optional tenant/session id for multi-tenant filtering */
  sessionId?: string | null;
  toolName: string;
  /** High-level bucket — write/shell/network need tighter audit rules */
  kind: ToolKindLabel;
  /** True if the tool mutates filesystem / state */
  mutation: boolean;
  /** Dispatcher result kind ("read"/"write"/"edit"/"error"/...) */
  resultKind: string;
  /** True on dispatcher error */
  error: boolean;
  /** Short error message — never the full stack */
  errorMessage?: string;
  /** Error code from SandboxError / WebFetchError / etc */
  errorCode?: string;
  durationMs: number;
  /** Redacted args — paths normalized, long values truncated, secrets masked */
  args: Record<string, unknown>;
  /** Byte size of the serialized raw result (for size budgeting) */
  resultBytes: number;
  /** User role at call time — useful for "non-admin tried write tool" detection */
  role?: string;
  /** Optional free-form tag (e.g. "autonomous" / "user" / "plan") */
  source?: string;
}

export interface BuildAuditEventInput {
  userId: number | string;
  role?: string;
  sessionId?: string | null;
  toolName: string;
  args: Record<string, unknown> | undefined;
  resultKind: string;
  error: boolean;
  errorMessage?: string;
  errorCode?: string;
  durationMs: number;
  resultBytes: number;
  source?: string;
  timestamp?: Date;
  eventId?: string;
}

// ─── Classification ────────────────────────────────────────────────────

const READ_TOOLS = new Set([
  "read_file",
  "list_directory",
  "grep_search",
  "find_symbol",
]);

const WRITE_TOOLS = new Set(["write_file", "edit_file", "multi_edit"]);

const SHELL_TOOLS = new Set(["run_bash"]);

const NETWORK_TOOLS = new Set(["web_fetch"]);

const META_TOOLS = new Set(["update_todos", "finish"]);

export function classifyToolKind(toolName: string): ToolKindLabel {
  if (READ_TOOLS.has(toolName)) return "read";
  if (WRITE_TOOLS.has(toolName)) return "write";
  if (SHELL_TOOLS.has(toolName)) return "shell";
  if (NETWORK_TOOLS.has(toolName)) return "network";
  if (META_TOOLS.has(toolName)) return "meta";
  return "unknown";
}

export function isMutation(kind: ToolKindLabel): boolean {
  return kind === "write" || kind === "shell";
}

// ─── Redaction ─────────────────────────────────────────────────────────

const SECRET_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
  /authorization/i,
  /bearer/i,
  /private[_-]?key/i,
];

const MAX_STRING_ARG_BYTES = 512;
const TRUNCATION_MARKER = "[…truncated]";

/**
 * Normalize an absolute filesystem path to a workspace-relative
 * string so logs don't leak the deployment's disk layout. If
 * `workspaceRoot` is supplied and `p` starts with it, the leading
 * root is stripped. Paths that live outside the workspace are
 * replaced with a placeholder so the audit log never contains a
 * raw `/etc/...` or `/root/...` reference.
 */
export function normalizePathForAudit(
  p: string,
  workspaceRoot?: string,
): string {
  if (typeof p !== "string" || !p) return p;
  if (!workspaceRoot) return p;
  const root = workspaceRoot.replace(/\/+$/, "");
  if (p === root) return ".";
  if (p.startsWith(root + "/")) return p.slice(root.length + 1);
  // Outside the workspace — signal it rather than log the literal path
  return "[outside-workspace]";
}

/**
 * Return a cleaned copy of an args object safe to log:
 *   - Strings longer than MAX_STRING_ARG_BYTES are truncated.
 *   - Keys that look like credentials are masked to `[redacted]`.
 *   - Paths are normalized through `normalizePathForAudit`.
 *   - Nested objects get one level of recursive handling.
 *   - Arrays are shallow-cloned with truncated entries.
 *
 * Never mutates the input.
 */
export function redactToolArgs(
  args: Record<string, unknown> | undefined,
  opts: { workspaceRoot?: string; maxStringBytes?: number } = {},
): Record<string, unknown> {
  if (!args || typeof args !== "object") return {};
  const maxBytes = opts.maxStringBytes ?? MAX_STRING_ARG_BYTES;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    if (looksLikeSecretKey(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (value === null || value === undefined) {
      out[key] = value;
      continue;
    }
    if (typeof value === "string") {
      out[key] = redactStringValue(key, value, maxBytes, opts.workspaceRoot);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 50).map((entry) => {
        if (typeof entry === "string")
          return redactStringValue(key, entry, maxBytes, opts.workspaceRoot);
        if (typeof entry === "object" && entry !== null)
          return redactToolArgs(entry as Record<string, unknown>, opts);
        return entry;
      });
      continue;
    }
    if (typeof value === "object") {
      out[key] = redactToolArgs(value as Record<string, unknown>, opts);
      continue;
    }
    out[key] = "[unserializable]";
  }

  return out;
}

function looksLikeSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pat) => pat.test(key));
}

function redactStringValue(
  key: string,
  value: string,
  maxBytes: number,
  workspaceRoot?: string,
): string {
  // Path-ish keys get the workspace normalization treatment
  if (key === "path" || key === "file" || key === "cwd") {
    const normalized = normalizePathForAudit(value, workspaceRoot);
    return truncate(normalized, maxBytes);
  }
  return truncate(value, maxBytes);
}

function truncate(s: string, maxBytes: number): string {
  if (s.length <= maxBytes) return s;
  return s.slice(0, maxBytes) + TRUNCATION_MARKER;
}

// ─── Main builder ──────────────────────────────────────────────────────

/**
 * Produce a structured audit event ready for a logger, DB write,
 * or webhook. Pure — no I/O, no side effects.
 */
export function buildToolCallAuditEvent(
  input: BuildAuditEventInput,
  opts: { workspaceRoot?: string; maxStringBytes?: number } = {},
): ToolCallAuditEvent {
  const kind = classifyToolKind(input.toolName);
  const ts = input.timestamp ?? new Date();
  return {
    v: TOOL_AUDIT_EVENT_VERSION,
    eventId: input.eventId ?? generateEventId(ts),
    timestamp: ts.toISOString(),
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    toolName: input.toolName,
    kind,
    mutation: isMutation(kind),
    resultKind: input.resultKind,
    error: input.error,
    errorMessage: input.errorMessage
      ? truncate(input.errorMessage, 500)
      : undefined,
    errorCode: input.errorCode,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    args: redactToolArgs(input.args, opts),
    resultBytes: Math.max(0, input.resultBytes),
    role: input.role,
    source: input.source,
  };
}

// ─── Aggregation ───────────────────────────────────────────────────────

export interface AuditSummary {
  total: number;
  byKind: Record<ToolKindLabel, number>;
  errors: number;
  mutations: number;
  totalDurationMs: number;
  distinctTools: string[];
}

/**
 * Roll up a list of events into a quick summary for dashboards.
 * Pure; callers can pass arbitrary slices of their log.
 */
export function summarizeAuditEvents(
  events: ToolCallAuditEvent[],
): AuditSummary {
  const byKind: Record<ToolKindLabel, number> = {
    read: 0,
    write: 0,
    shell: 0,
    network: 0,
    meta: 0,
    unknown: 0,
  };
  let errors = 0;
  let mutations = 0;
  let totalDurationMs = 0;
  const distinct = new Set<string>();
  for (const ev of events) {
    byKind[ev.kind] = (byKind[ev.kind] ?? 0) + 1;
    if (ev.error) errors++;
    if (ev.mutation) mutations++;
    totalDurationMs += ev.durationMs;
    distinct.add(ev.toolName);
  }
  return {
    total: events.length,
    byKind,
    errors,
    mutations,
    totalDurationMs,
    distinctTools: Array.from(distinct).sort(),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

function generateEventId(ts: Date): string {
  // Collision-resistant enough for logs without crypto.randomUUID
  // (not guaranteed in all Node runtimes this module will execute in).
  const rand = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `t-${ts.getTime().toString(36)}-${rand}`;
}
