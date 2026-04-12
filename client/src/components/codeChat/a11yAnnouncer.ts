/**
 * a11yAnnouncer.ts — screen-reader announcement helpers (Parity Pass 3).
 *
 * Code Chat streams tool events in real time but screen-reader users
 * currently have no way to perceive what the agent is doing — the
 * trace view is purely visual. This module produces readable string
 * announcements for each SSE event shape so the parent component can
 * feed them into a `role="status" aria-live="polite"` live region.
 *
 * Design notes:
 *   - Every helper is a pure function so they're trivially unit-testable
 *     without spinning up a live region / JSDOM.
 *   - Announcements are short and deliberate — WCAG 4.1.3 discourages
 *     firing announcements for rapid churn because assistive tech will
 *     either drop them, queue them, or talk over the user. `throttleAnnouncements`
 *     coalesces a rapid burst into a single final string.
 *   - Tool-specific language matches the SSE event kinds we already emit
 *     (read, write, edit, multi_edit, grep, bash, list, symbols, web, todos).
 */

// ─── Pure announcement builders ───────────────────────────────────────────

export interface ToolEventSummary {
  toolName: string;
  args?: Record<string, unknown>;
  kind?: string;
  durationMs?: number;
  errorMessage?: string;
}

/**
 * Build an announcement for a tool CALL START event. Phrased in the
 * present continuous so it's clear the action is currently happening.
 */
export function buildToolStartAnnouncement(
  toolName: string,
  args: Record<string, unknown> | undefined,
): string {
  const path = pickString(args, "path");
  const pattern = pickString(args, "pattern");
  const command = pickString(args, "command");
  const url = pickString(args, "url");
  const name = pickString(args, "name");
  const query = pickString(args, "query");

  switch (toolName) {
    case "read_file":
      return path ? `Reading ${path}` : "Reading file";
    case "list_directory":
      return path ? `Listing ${path}` : "Listing directory";
    case "grep_search":
      return pattern ? `Searching for "${pattern}"` : "Running grep search";
    case "write_file":
      return path ? `Writing ${path}` : "Writing file";
    case "edit_file":
      return path ? `Editing ${path}` : "Editing file";
    case "multi_edit":
      return path ? `Applying batch edits to ${path}` : "Applying batch edits";
    case "run_bash":
      return command ? `Running command: ${trimPreview(command, 60)}` : "Running shell command";
    case "web_fetch":
      return url ? `Fetching ${url}` : "Fetching external URL";
    case "find_symbol":
      return name || query
        ? `Finding symbol ${name ?? query}`
        : "Finding symbol";
    case "update_todos":
      return "Updating progress list";
    case "finish":
      return "Finishing up";
    default:
      return `Running ${toolName}`;
  }
}

/**
 * Build an announcement for a tool RESULT event. Past-tense confirmation
 * so the user knows the call completed.
 */
export function buildToolFinishAnnouncement(
  toolName: string,
  args: Record<string, unknown> | undefined,
  kind: string | undefined,
  errorMessage: string | undefined,
): string {
  if (kind === "error" || errorMessage) {
    const label = toolName.replace(/_/g, " ");
    return errorMessage
      ? `${label} failed: ${trimPreview(errorMessage, 100)}`
      : `${label} failed`;
  }

  const path = pickString(args, "path");
  const pattern = pickString(args, "pattern");
  const url = pickString(args, "url");
  const name = pickString(args, "name");
  const query = pickString(args, "query");

  switch (toolName) {
    case "read_file":
      return path ? `Read ${path}` : "Read complete";
    case "list_directory":
      return path ? `Listed ${path}` : "List complete";
    case "grep_search":
      return pattern ? `Grep complete for "${pattern}"` : "Grep complete";
    case "write_file":
      return path ? `Wrote ${path}` : "Write complete";
    case "edit_file":
      return path ? `Edited ${path}` : "Edit complete";
    case "multi_edit":
      return path ? `Applied batch edits to ${path}` : "Batch edits complete";
    case "run_bash":
      return "Command finished";
    case "web_fetch":
      return url ? `Fetched ${url}` : "Web fetch complete";
    case "find_symbol":
      return name || query ? `Found symbol ${name ?? query}` : "Symbol lookup complete";
    case "update_todos":
      return "Progress list updated";
    case "finish":
      return "Done";
    default:
      return `${toolName.replace(/_/g, " ")} complete`;
  }
}

/**
 * Build an announcement for the final `done` event (full message reply).
 * Prefers a short summary over the raw response so long replies don't
 * flood the screen reader queue.
 */
export function buildMessageAnnouncement(preview: string | undefined): string {
  if (!preview || !preview.trim()) return "Agent reply ready";
  const trimmed = preview.trim().replace(/\s+/g, " ");
  return `Agent reply ready: ${trimPreview(trimmed, 180)}`;
}

/**
 * Build an announcement when the ReAct loop has been aborted.
 */
export function buildAbortAnnouncement(): string {
  return "Agent run aborted";
}

/**
 * Build an announcement when an error is surfaced (distinct from a
 * single tool call failing — this is a top-level stream error).
 */
export function buildStreamErrorAnnouncement(message: string | undefined): string {
  if (!message) return "Agent stream error";
  return `Agent error: ${trimPreview(message, 140)}`;
}

// ─── Throttling primitive ─────────────────────────────────────────────────

/**
 * Pure throttling reducer — NOT time-based because JSDOM tests would
 * need fake timers. Instead, the caller passes the previous state, the
 * new event, and a window-ms, and this reducer decides whether to
 * emit, defer, or coalesce.
 *
 * The UI uses this at render-time via `useEffect` so rapid tool events
 * get coalesced into a single final announcement, reducing screen
 * reader noise during a busy ReAct loop.
 */
export interface ThrottleState {
  /** Last announcement text the UI emitted */
  lastEmitted: string;
  /** Pending announcement text queued to emit after the window closes */
  pending: string | null;
  /** Timestamp (ms) of the last emission */
  lastEmittedAt: number;
}

export const emptyThrottleState: ThrottleState = {
  lastEmitted: "",
  pending: null,
  lastEmittedAt: 0,
};

export interface ThrottleResult {
  /** Text the UI should write to the live region right now (or null for no change) */
  emit: string | null;
  next: ThrottleState;
}

/**
 * Try to emit `text` through the throttle state. If we emitted within
 * the last `windowMs`, the text is queued as pending instead. The
 * caller runs this every tick to flush pending.
 */
export function throttleAnnouncement(
  state: ThrottleState,
  text: string,
  now: number,
  windowMs = 300,
): ThrottleResult {
  if (!text || text === state.lastEmitted) {
    return { emit: null, next: state };
  }
  const delta = now - state.lastEmittedAt;
  if (delta >= windowMs) {
    return {
      emit: text,
      next: {
        lastEmitted: text,
        pending: null,
        lastEmittedAt: now,
      },
    };
  }
  return {
    emit: null,
    next: { ...state, pending: text },
  };
}

/**
 * Flush a pending announcement if enough time has passed. Called on
 * an interval / animation frame by the host.
 */
export function flushPending(
  state: ThrottleState,
  now: number,
  windowMs = 300,
): ThrottleResult {
  if (!state.pending) {
    return { emit: null, next: state };
  }
  if (now - state.lastEmittedAt < windowMs) {
    return { emit: null, next: state };
  }
  return {
    emit: state.pending,
    next: {
      lastEmitted: state.pending,
      pending: null,
      lastEmittedAt: now,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function pickString(
  args: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!args) return undefined;
  const v = args[key];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

/**
 * Clip a preview string to `max` characters, using a word boundary
 * when possible and appending a single-character ellipsis.
 */
export function trimPreview(s: string, max: number): string {
  if (s.length <= max) return s;
  const clipped = s.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  const cut = lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return cut + "…";
}
