/**
 * traceDiffExtractor.ts — pure extractors for tool result previews (Parity Pass 5).
 *
 * Background: the Code Chat UI has two places that pick before/after
 * snapshots out of serialized tool-result JSON:
 *
 *   1. `TraceView` renders an inline `<DiffView>` underneath every
 *      edit/write/multi_edit step so the user sees the exact change
 *      as the agent made it.
 *   2. The edit-history capture `useEffect` replays every assistant
 *      message's tool events into the `editHistory` ring buffer so
 *      Ctrl+Z can undo.
 *
 * Both paths used to duplicate the same inline JSON parsing + shape
 * validation inside `CodeChat.tsx`, which made them impossible to
 * unit-test without spinning up React and mocking `useCodeChatStream`.
 * This module consolidates the logic into three pure functions whose
 * contract is locked down by a single test suite.
 */

// ─── Types ─────────────────────────────────────────────────────────────

export type EditToolName = "edit_file" | "write_file" | "multi_edit";

export interface DiffSnapshot {
  path: string;
  before: string;
  after: string;
  /** Which tool produced this snapshot. multi_edit is folded to "edit". */
  kind: "edit" | "write";
}

/**
 * Minimal view of a tool event for the extractors. Matches the
 * `ToolEvent` from `useCodeChatStream` but kept structural so the
 * tests don't need to import React/RTL.
 */
export interface ToolEventLike {
  toolName: string;
  preview?: string;
  args?: Record<string, unknown>;
  status?: string;
}

// ─── Single snapshot extraction ───────────────────────────────────────

/**
 * Parse a tool-result preview string and pull out the before/after
 * snapshot if present. Returns `null` when:
 *   - The tool isn't one of the mutation tools we capture
 *   - The preview isn't parseable JSON
 *   - The parsed shape doesn't include both `before` and `after` strings
 *
 * The function is intentionally forgiving — a missing snapshot should
 * never throw, just return null so the UI falls through to the raw
 * preview.
 */
export function extractDiffFromTrace(
  toolName: string | undefined,
  rawPreview: string | undefined,
): DiffSnapshot | null {
  if (!rawPreview) return null;
  if (!isEditToolName(toolName)) return null;
  try {
    const parsed = JSON.parse(rawPreview);
    // Expected shape: { kind: "edit"|"write"|"multi_edit", result: { before, after, path } }
    const inner = parsed?.result;
    if (!inner || typeof inner !== "object") return null;
    if (typeof inner.before !== "string" || typeof inner.after !== "string") {
      return null;
    }
    const path = typeof inner.path === "string" ? inner.path : "";
    return {
      path,
      before: inner.before,
      after: inner.after,
      // multi_edit collapses to "edit" because the history stores a
      // net before/after snapshot — the user never needs to reason
      // about whether a change was batched or sequential.
      kind: toolName === "write_file" ? "write" : "edit",
    };
  } catch {
    return null;
  }
}

// ─── Batch extraction from a full message ─────────────────────────────

/**
 * Walk a message's tool events and return every usable snapshot.
 * Used by the edit-history capture effect to populate the Ctrl+Z
 * ring buffer in one pass per assistant message.
 *
 * Notes:
 *   - Dedupes nothing — callers may record the same path twice if
 *     the agent edited it in multiple steps, which is the correct
 *     behavior (each edit is a separate history entry).
 *   - Skips running/error statuses so in-flight events and failures
 *     don't end up in the undo stack.
 *   - Drops events whose path ends up empty after fallback.
 */
export function extractEditSnapshotsFromToolEvents(
  events: ToolEventLike[] | undefined,
): DiffSnapshot[] {
  if (!events || events.length === 0) return [];
  const out: DiffSnapshot[] = [];
  for (const ev of events) {
    if (ev.status && ev.status !== "complete") continue;
    const snap = extractDiffFromTrace(ev.toolName, ev.preview);
    if (!snap) continue;
    // If the preview shape didn't carry a path, try the args fallback
    if (!snap.path) {
      const argPath = ev.args?.path;
      if (typeof argPath === "string" && argPath.length > 0) {
        snap.path = argPath;
      } else {
        // Drop the snapshot rather than record a pathless history
        // entry — the UI needs the path for the history list label.
        continue;
      }
    }
    out.push(snap);
  }
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function isEditToolName(name: string | undefined): name is EditToolName {
  return name === "edit_file" || name === "write_file" || name === "multi_edit";
}

/**
 * Coarse kind classification used by the summary chips in TraceView.
 * Not in the critical path; exposed mostly for test locking.
 */
export function diffKindLabel(kind: DiffSnapshot["kind"]): string {
  return kind === "write" ? "wrote" : "edited";
}
