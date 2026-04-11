/**
 * Edit history ring buffer for Code Chat (Pass 239).
 *
 * Every file write/edit (from the agent ReAct loop or an admin inline
 * edit in the FileBrowser) is captured as a `{ before, after }` pair.
 * This module implements the pure state machine for:
 *
 *   - Recording edits (ring buffer capped at 50 entries)
 *   - Undo: move cursor back, return the entry so the caller can
 *     restore the file to `entry.before`
 *   - Redo: move cursor forward, return the entry so the caller can
 *     restore the file to `entry.after`
 *   - canUndo / canRedo derivation
 *   - Branching: recording a new edit after undoing discards the
 *     "forward" history (matches how most editors handle this)
 *   - localStorage persistence with safe parsing
 *
 * The module is intentionally UI-free; `EditHistoryPanel.tsx` renders
 * the state this module produces.
 */

export type EditOrigin = "agent" | "manual";
export type EditKind = "write" | "edit";

export interface EditHistoryEntry {
  id: string;
  path: string;
  before: string;
  after: string;
  origin: EditOrigin;
  kind: EditKind;
  timestamp: number;
}

export interface EditHistoryState {
  entries: EditHistoryEntry[];
  /** Cursor points to the next entry that would be undone. -1 = none. */
  cursor: number;
}

export const MAX_ENTRIES = 50;

export function emptyHistory(): EditHistoryState {
  return { entries: [], cursor: -1 };
}

/**
 * Record a new edit. Dropping forward history is the standard editor
 * convention — once you make a new change after an undo, you lose the
 * ability to redo back.
 */
export function recordEdit(
  state: EditHistoryState,
  entry: Omit<EditHistoryEntry, "id" | "timestamp"> &
    Partial<Pick<EditHistoryEntry, "id" | "timestamp">>,
): EditHistoryState {
  // Guard: identical before/after is a no-op
  if (entry.before === entry.after) return state;

  const id = entry.id ?? `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = entry.timestamp ?? Date.now();
  const fullEntry: EditHistoryEntry = {
    id,
    path: entry.path,
    before: entry.before,
    after: entry.after,
    origin: entry.origin,
    kind: entry.kind,
    timestamp,
  };

  // Drop forward entries (everything after the current cursor)
  const kept = state.cursor >= 0 ? state.entries.slice(0, state.cursor + 1) : [];
  const next = [...kept, fullEntry];

  // Cap ring buffer
  const trimmed = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;

  return {
    entries: trimmed,
    cursor: trimmed.length - 1,
  };
}

export function canUndo(state: EditHistoryState): boolean {
  return state.cursor >= 0;
}

export function canRedo(state: EditHistoryState): boolean {
  return state.cursor < state.entries.length - 1;
}

export interface UndoResult {
  state: EditHistoryState;
  /** The entry that was undone — caller should restore `entry.before` */
  entry: EditHistoryEntry;
}

export function undo(state: EditHistoryState): UndoResult | null {
  if (!canUndo(state)) return null;
  const entry = state.entries[state.cursor];
  return {
    state: { ...state, cursor: state.cursor - 1 },
    entry,
  };
}

export function redo(state: EditHistoryState): UndoResult | null {
  if (!canRedo(state)) return null;
  const nextCursor = state.cursor + 1;
  const entry = state.entries[nextCursor];
  return {
    state: { ...state, cursor: nextCursor },
    entry,
  };
}

/**
 * Drop the entry at the given id. Keeps the cursor on the most recent
 * surviving entry (or -1 if the list becomes empty). Used by the UI
 * "× clear entry" button for edits the user no longer wants to
 * re-visit.
 */
export function dropEntry(
  state: EditHistoryState,
  id: string,
): EditHistoryState {
  const idx = state.entries.findIndex((e) => e.id === id);
  if (idx === -1) return state;
  const next = state.entries.filter((_, i) => i !== idx);
  // Adjust cursor if we removed something at or before it
  let cursor = state.cursor;
  if (idx <= state.cursor) cursor = Math.max(-1, state.cursor - 1);
  if (next.length === 0) cursor = -1;
  return { entries: next, cursor };
}

export function clearHistory(): EditHistoryState {
  return emptyHistory();
}

// ─── Persistence ────────────────────────────────────────────────────────

export const STORAGE_KEY = "stewardly-codechat-edit-history";

export function serializeHistory(state: EditHistoryState): string {
  return JSON.stringify({
    entries: state.entries,
    cursor: state.cursor,
    version: 1,
  });
}

export function parseHistory(raw: string | null): EditHistoryState {
  if (!raw) return emptyHistory();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyHistory();
    const rec = parsed as Record<string, unknown>;
    if (!Array.isArray(rec.entries)) return emptyHistory();
    const entries: EditHistoryEntry[] = [];
    for (const e of rec.entries) {
      if (!e || typeof e !== "object") continue;
      const er = e as Record<string, unknown>;
      if (
        typeof er.id === "string" &&
        typeof er.path === "string" &&
        typeof er.before === "string" &&
        typeof er.after === "string" &&
        typeof er.timestamp === "number" &&
        (er.origin === "agent" || er.origin === "manual") &&
        (er.kind === "write" || er.kind === "edit")
      ) {
        entries.push({
          id: er.id,
          path: er.path,
          before: er.before,
          after: er.after,
          origin: er.origin,
          kind: er.kind,
          timestamp: er.timestamp,
        });
      }
      if (entries.length >= MAX_ENTRIES) break;
    }
    const cursor = typeof rec.cursor === "number" ? rec.cursor : entries.length - 1;
    const clampedCursor = Math.max(-1, Math.min(cursor, entries.length - 1));
    return { entries, cursor: clampedCursor };
  } catch {
    return emptyHistory();
  }
}

export function loadHistory(): EditHistoryState {
  try {
    return parseHistory(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyHistory();
  }
}

export function saveHistory(state: EditHistoryState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeHistory(state));
  } catch {
    /* quota */
  }
}

// ─── Derivation helpers for the UI ──────────────────────────────────────

export interface EditHistorySummary {
  total: number;
  undoCount: number;
  redoCount: number;
  byPath: Map<string, number>;
  canUndo: boolean;
  canRedo: boolean;
}

export function summarizeHistory(state: EditHistoryState): EditHistorySummary {
  const byPath = new Map<string, number>();
  for (const e of state.entries) {
    byPath.set(e.path, (byPath.get(e.path) ?? 0) + 1);
  }
  return {
    total: state.entries.length,
    undoCount: state.cursor + 1,
    redoCount: state.entries.length - state.cursor - 1,
    byPath,
    canUndo: canUndo(state),
    canRedo: canRedo(state),
  };
}
