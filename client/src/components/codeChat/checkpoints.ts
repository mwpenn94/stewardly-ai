/**
 * Workspace checkpoints — Pass 253.
 *
 * A checkpoint captures a named snapshot of the full Code Chat
 * client state — messages + edit history + run config — so the
 * user can roll back to a known-good moment after an agent run
 * goes sideways.
 *
 * Different from the Pass 212 session library (which only captures
 * the message log) and Pass 239 edit history (which tracks individual
 * file edits). A checkpoint is the closest analog to `git stash` or
 * Claude Code's cloud session "save state" — one click → restore
 * everything.
 *
 * Pure store + localStorage persistence.
 */

export interface CheckpointMeta {
  id: string;
  name: string;
  /** Unix ms */
  createdAt: number;
  /** Short user-provided or auto-generated note */
  note?: string;
  /** Stats captured at checkpoint time for list-view badges */
  stats: {
    messageCount: number;
    editCount: number;
    toolCallCount: number;
    hasUnappliedEdits: boolean;
  };
}

/**
 * The full payload stored in localStorage. All fields are opaque
 * JSON blobs — the module doesn't know the shape of messages /
 * edit history / run config, it just round-trips them.
 */
export interface CheckpointPayload {
  messages: unknown[];
  editHistory: unknown;
  runConfig: {
    allowMutations?: boolean;
    maxIterations?: number;
    modelOverride?: string;
    enabledTools?: string[];
    currentSessionId?: string | null;
  };
}

export interface Checkpoint {
  meta: CheckpointMeta;
  payload: CheckpointPayload;
}

export const MAX_CHECKPOINTS = 30;
const STORAGE_KEY = "stewardly-codechat-checkpoints";

// ─── Creation + mutation ─────────────────────────────────────────────

function generateId(): string {
  return `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Derive a human-readable name from the first user message. Falls
 * back to a timestamp-based label if no user message is present.
 */
export function autoCheckpointName(
  messages: Array<{ role?: string; content?: string }>,
): string {
  for (const msg of messages) {
    if (msg.role === "user" && typeof msg.content === "string") {
      const line = msg.content.trim().split("\n")[0];
      if (line) return line.slice(0, 80);
    }
  }
  return `Checkpoint ${new Date().toLocaleTimeString()}`;
}

/**
 * Build the lightweight stats object shown on every checkpoint card.
 */
export function deriveStats(
  messages: Array<{
    role?: string;
    toolEvents?: Array<unknown>;
  }>,
  editHistory: { entries?: unknown[]; cursor?: number } | undefined,
): CheckpointMeta["stats"] {
  let toolCalls = 0;
  for (const m of messages) {
    if (Array.isArray(m.toolEvents)) toolCalls += m.toolEvents.length;
  }
  const editCount = Array.isArray(editHistory?.entries)
    ? editHistory!.entries!.length
    : 0;
  const cursor = editHistory?.cursor ?? 0;
  return {
    messageCount: messages.length,
    editCount,
    toolCallCount: toolCalls,
    hasUnappliedEdits: cursor < editCount,
  };
}

export function createCheckpoint(
  name: string | null,
  payload: CheckpointPayload,
  note?: string,
): Checkpoint {
  const trimmedName = (name ?? "").trim();
  const resolved = trimmedName || autoCheckpointName(payload.messages as any);
  return {
    meta: {
      id: generateId(),
      name: resolved,
      createdAt: Date.now(),
      note: note?.trim() || undefined,
      stats: deriveStats(payload.messages as any, payload.editHistory as any),
    },
    payload,
  };
}

export function addCheckpoint(
  existing: Checkpoint[],
  next: Checkpoint,
): Checkpoint[] {
  const merged = [next, ...existing];
  if (merged.length > MAX_CHECKPOINTS) {
    return merged.slice(0, MAX_CHECKPOINTS);
  }
  return merged;
}

export function removeCheckpoint(
  existing: Checkpoint[],
  id: string,
): Checkpoint[] {
  return existing.filter((c) => c.meta.id !== id);
}

export function renameCheckpoint(
  existing: Checkpoint[],
  id: string,
  name: string,
  note?: string,
): Checkpoint[] {
  const trimmed = name.trim();
  if (!trimmed) return existing;
  return existing.map((c) =>
    c.meta.id === id
      ? {
          ...c,
          meta: { ...c.meta, name: trimmed, note: note?.trim() || undefined },
        }
      : c,
  );
}

export function findCheckpoint(
  checkpoints: Checkpoint[],
  id: string,
): Checkpoint | null {
  return checkpoints.find((c) => c.meta.id === id) ?? null;
}

// ─── Persistence ──────────────────────────────────────────────────────

export function parseCheckpoints(raw: string | null): Checkpoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Checkpoint[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const meta = e.meta as Record<string, unknown> | undefined;
      if (!meta || typeof meta !== "object") continue;
      if (typeof meta.id !== "string") continue;
      if (typeof meta.name !== "string") continue;
      if (typeof meta.createdAt !== "number") continue;
      const stats = meta.stats as Record<string, unknown> | undefined;
      out.push({
        meta: {
          id: meta.id,
          name: meta.name,
          createdAt: meta.createdAt,
          note: typeof meta.note === "string" ? meta.note : undefined,
          stats: {
            messageCount: Number(stats?.messageCount ?? 0),
            editCount: Number(stats?.editCount ?? 0),
            toolCallCount: Number(stats?.toolCallCount ?? 0),
            hasUnappliedEdits: Boolean(stats?.hasUnappliedEdits),
          },
        },
        payload: (e.payload as CheckpointPayload) ?? {
          messages: [],
          editHistory: { entries: [], cursor: 0 },
          runConfig: {},
        },
      });
      if (out.length >= MAX_CHECKPOINTS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeCheckpoints(checkpoints: Checkpoint[]): string {
  return JSON.stringify(checkpoints);
}

export function loadCheckpoints(): Checkpoint[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return parseCheckpoints(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveCheckpoints(checkpoints: Checkpoint[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeCheckpoints(checkpoints));
  } catch {
    /* quota exceeded — caller is responsible for pruning */
  }
}

// ─── Diff helpers ─────────────────────────────────────────────────────

export interface CheckpointDiff {
  messagesAdded: number;
  messagesRemoved: number;
  toolCallsDelta: number;
  editsDelta: number;
}

/**
 * Compare two sets of stats to produce a diff shown when restoring.
 * Negative values mean "fewer now than at checkpoint time" — the
 * checkpoint has extra history that restoring would rewind.
 */
export function diffStats(
  current: CheckpointMeta["stats"],
  saved: CheckpointMeta["stats"],
): CheckpointDiff {
  return {
    messagesAdded: Math.max(0, current.messageCount - saved.messageCount),
    messagesRemoved: Math.max(0, saved.messageCount - current.messageCount),
    toolCallsDelta: current.toolCallCount - saved.toolCallCount,
    editsDelta: current.editCount - saved.editCount,
  };
}

/**
 * Format a unix ms timestamp into a relative "Xm ago" string, with
 * an absolute fallback after 7 days.
 */
export function formatAge(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}
