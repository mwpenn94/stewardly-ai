/**
 * sseEventParser.ts — defensive parser for Code Chat SSE events (Parity Pass 8).
 *
 * The SSE stream from `/api/codechat/stream` delivers newline-delimited
 * `data: {json}` events. The hook in `useCodeChatStream` used to parse
 * each one inline with a naked `JSON.parse` + `switch` which silently
 * dropped malformed events and had no validation on per-event field
 * shapes. An event with a non-number stepIndex, a non-string toolName,
 * or a misspelled type would:
 *   - Crash state updates mid-stream (undefined array access)
 *   - OR silently disappear with no logged reason
 *
 * This module centralizes event parsing into a pure, unit-testable
 * module with strict runtime validation for every known event shape
 * and a discriminated union return type the host switch can narrow on.
 * Unknown event types flow through as `{kind: "unknown", raw}` so
 * future server additions don't crash older clients.
 */

// ─── Discriminated union ──────────────────────────────────────────────

export type ParsedSseEvent =
  | { kind: "tool_start"; stepIndex: number; toolName: string; args: Record<string, unknown> }
  | {
      kind: "tool_result";
      stepIndex: number;
      toolName: string;
      resultKind: string;
      preview?: string;
      truncated: boolean;
      durationMs: number;
    }
  | { kind: "todos_updated"; todos: unknown }
  | { kind: "instructions_loaded"; files: string[] }
  | { kind: "mentions_resolved"; mentions: Array<{ path: string; bytes: number; error?: string }> }
  | {
      kind: "done";
      response: string;
      model?: string;
      iterations?: number;
      toolCallCount?: number;
      totalDurationMs?: number;
      traces?: unknown;
    }
  | { kind: "error"; message: string }
  | { kind: "thinking"; content?: string }
  | { kind: "heartbeat" }
  | { kind: "unknown"; rawType: string }
  | { kind: "invalid"; reason: "not_data_line" | "bad_json" | "bad_shape" | "missing_type" | "validation_failed"; detail?: string };

// ─── Entry point ───────────────────────────────────────────────────────

/**
 * Parse a single line from the SSE stream. Returns null when the
 * line is an empty line between events, or a `{kind: "invalid"}`
 * shape when parsing fails so the caller can distinguish "no event
 * here" from "bad event we should log".
 */
export function parseSseLine(line: string): ParsedSseEvent | null {
  if (line === undefined || line === null) return null;
  // DO NOT trimEnd here — that would let us mis-interpret "data: "
  // (with only a trailing space) as a valid prefix. Trim trailing
  // CR only for compatibility with servers that send \r\n framing.
  const normalized = line.endsWith("\r") ? line.slice(0, -1) : line;
  if (normalized.length === 0) return null; // Empty lines are valid SSE separators
  // Tolerate whitespace-only lines
  if (/^\s*$/.test(normalized)) return null;
  // Accept both "data: payload" (with space) and "data:payload" per
  // the SSE spec — the space is conventional but optional.
  let payload: string;
  if (normalized.startsWith("data: ")) {
    payload = normalized.slice(6);
  } else if (normalized.startsWith("data:")) {
    payload = normalized.slice(5);
  } else {
    return { kind: "invalid", reason: "not_data_line" };
  }
  if (!payload) {
    return { kind: "invalid", reason: "bad_json", detail: "empty payload" };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch (err) {
    return { kind: "invalid", reason: "bad_json", detail: (err as Error).message };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "invalid", reason: "bad_shape" };
  }
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== "string") {
    return { kind: "invalid", reason: "missing_type" };
  }
  return validateByType(type, obj);
}

// ─── Per-type validation ───────────────────────────────────────────────

function validateByType(type: string, obj: Record<string, unknown>): ParsedSseEvent {
  switch (type) {
    case "tool_start":
      return validateToolStart(obj);
    case "tool_result":
      return validateToolResult(obj);
    case "todos_updated":
      // The downstream parseTodosPayload is already defensive, so we
      // just forward the raw `todos` field.
      return { kind: "todos_updated", todos: obj.todos };
    case "instructions_loaded":
      return validateInstructionsLoaded(obj);
    case "mentions_resolved":
      return validateMentionsResolved(obj);
    case "done":
      return validateDone(obj);
    case "error":
      return {
        kind: "error",
        message: typeof obj.message === "string" ? obj.message : "Unknown error",
      };
    case "thinking":
      return {
        kind: "thinking",
        content: typeof obj.content === "string" ? obj.content : undefined,
      };
    case "heartbeat":
      return { kind: "heartbeat" };
    default:
      return { kind: "unknown", rawType: type };
  }
}

// ─── Validators for shape-sensitive types ─────────────────────────────

function validateToolStart(obj: Record<string, unknown>): ParsedSseEvent {
  const stepIndex = toIntOrNaN(obj.stepIndex);
  if (!Number.isFinite(stepIndex)) {
    return { kind: "invalid", reason: "validation_failed", detail: "tool_start stepIndex not a finite number" };
  }
  if (typeof obj.toolName !== "string" || obj.toolName.length === 0) {
    return { kind: "invalid", reason: "validation_failed", detail: "tool_start toolName not a non-empty string" };
  }
  const args =
    obj.args && typeof obj.args === "object" && !Array.isArray(obj.args)
      ? (obj.args as Record<string, unknown>)
      : {};
  return {
    kind: "tool_start",
    stepIndex: stepIndex as number,
    toolName: obj.toolName,
    args,
  };
}

function validateToolResult(obj: Record<string, unknown>): ParsedSseEvent {
  const stepIndex = toIntOrNaN(obj.stepIndex);
  if (!Number.isFinite(stepIndex)) {
    return {
      kind: "invalid",
      reason: "validation_failed",
      detail: "tool_result stepIndex not a finite number",
    };
  }
  if (typeof obj.toolName !== "string" || obj.toolName.length === 0) {
    return { kind: "invalid", reason: "validation_failed", detail: "tool_result toolName not a non-empty string" };
  }
  const resultKind =
    typeof obj.kind === "string" && obj.kind.length > 0 ? obj.kind : "unknown";
  const preview = typeof obj.preview === "string" ? obj.preview : undefined;
  const truncated = Boolean(obj.truncated);
  const durationMsRaw = Number(obj.durationMs);
  const durationMs = Number.isFinite(durationMsRaw) && durationMsRaw >= 0 ? durationMsRaw : 0;
  return {
    kind: "tool_result",
    stepIndex: stepIndex as number,
    toolName: obj.toolName,
    resultKind,
    preview,
    truncated,
    durationMs,
  };
}

function validateInstructionsLoaded(obj: Record<string, unknown>): ParsedSseEvent {
  const raw = obj.files;
  if (!Array.isArray(raw)) {
    return { kind: "instructions_loaded", files: [] };
  }
  const files = raw.filter((f): f is string => typeof f === "string" && f.length > 0);
  return { kind: "instructions_loaded", files };
}

function validateMentionsResolved(obj: Record<string, unknown>): ParsedSseEvent {
  const raw = obj.mentions;
  if (!Array.isArray(raw)) {
    return { kind: "mentions_resolved", mentions: [] };
  }
  const mentions: Array<{ path: string; bytes: number; error?: string }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const path = typeof e.path === "string" ? e.path : "";
    if (!path) continue;
    const bytesRaw = Number(e.bytes);
    const bytes = Number.isFinite(bytesRaw) && bytesRaw >= 0 ? bytesRaw : 0;
    const error = typeof e.error === "string" ? e.error : undefined;
    mentions.push({ path, bytes, error });
  }
  return { kind: "mentions_resolved", mentions };
}

function validateDone(obj: Record<string, unknown>): ParsedSseEvent {
  return {
    kind: "done",
    response: typeof obj.response === "string" ? obj.response : "",
    model: typeof obj.model === "string" ? obj.model : undefined,
    iterations: Number.isFinite(Number(obj.iterations)) ? Number(obj.iterations) : undefined,
    toolCallCount: Number.isFinite(Number(obj.toolCallCount)) ? Number(obj.toolCallCount) : undefined,
    totalDurationMs: Number.isFinite(Number(obj.totalDurationMs))
      ? Number(obj.totalDurationMs)
      : undefined,
    traces: obj.traces,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function toIntOrNaN(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return NaN;
}

/**
 * Split a buffer of concatenated SSE text into complete lines,
 * returning `{lines, leftover}`. Used by the host hook to preserve
 * partial events across reader chunks.
 */
export function splitSseBuffer(buffer: string): { lines: string[]; leftover: string } {
  const parts = buffer.split("\n");
  const leftover = parts.pop() ?? "";
  return { lines: parts, leftover };
}
