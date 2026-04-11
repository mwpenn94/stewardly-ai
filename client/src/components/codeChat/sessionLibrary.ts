/**
 * Saved Code Chat sessions (Pass 212).
 *
 * Pure functions + a thin localStorage adapter for managing named
 * conversation snapshots. Lets users save the current chat state,
 * switch between past sessions, rename/delete them, and export the
 * whole library — bringing the Code Chat experience closer to
 * Claude Code's terminal-native session management.
 *
 * Why not a DB table? The Code Chat is an admin-adjacent developer
 * tool; per-user session state doesn't benefit from cross-device
 * sync or auditability the way compliance-relevant tables do. A
 * localStorage-backed store keeps the surface dependency-free and
 * ready to migrate to a real table (`code_chat_sessions`) behind
 * the same API shape if that need arises later.
 *
 * Storage shape:
 *   localStorage["stewardly-codechat-sessions"] = JSON.stringify({
 *     version: 1,
 *     sessions: SessionSnapshot[],
 *   })
 *
 * The version field lets future formats migrate without clobbering
 * existing saved state.
 */

import type { CodeChatMessage } from "@/hooks/useCodeChatStream";

export interface SessionSnapshot {
  id: string;
  name: string;
  createdAt: number; // epoch ms
  updatedAt: number;
  messages: CodeChatMessage[];
}

export interface SessionLibrary {
  version: 1;
  sessions: SessionSnapshot[];
}

export const SESSIONS_STORAGE_KEY = "stewardly-codechat-sessions";
const MAX_SESSIONS = 50;

// ─── Pure helpers (unit-tested) ──────────────────────────────────────────

export function emptyLibrary(): SessionLibrary {
  return { version: 1, sessions: [] };
}

/**
 * Parse a raw JSON string as a SessionLibrary. Returns an empty
 * library on any parse/shape failure so callers can safely pass the
 * localStorage output through without defensive wrapping.
 */
export function parseLibrary(raw: string | null): SessionLibrary {
  if (!raw) return emptyLibrary();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyLibrary();
    const lib = parsed as Partial<SessionLibrary>;
    if (lib.version !== 1) return emptyLibrary();
    if (!Array.isArray(lib.sessions)) return emptyLibrary();
    const cleaned: SessionSnapshot[] = [];
    for (const s of lib.sessions) {
      if (!s || typeof s !== "object") continue;
      const snap = s as Partial<SessionSnapshot>;
      if (typeof snap.id !== "string" || !snap.id) continue;
      if (typeof snap.name !== "string") continue;
      if (typeof snap.createdAt !== "number") continue;
      if (typeof snap.updatedAt !== "number") continue;
      if (!Array.isArray(snap.messages)) continue;
      cleaned.push({
        id: snap.id,
        name: snap.name,
        createdAt: snap.createdAt,
        updatedAt: snap.updatedAt,
        messages: snap.messages as CodeChatMessage[],
      });
    }
    return { version: 1, sessions: cleaned };
  } catch {
    return emptyLibrary();
  }
}

/**
 * Save or replace a session in the library. Sessions are identified
 * by id; a matching id replaces the existing entry, otherwise the
 * session is prepended. Oldest sessions are trimmed when we exceed
 * MAX_SESSIONS.
 */
export function upsertSession(
  library: SessionLibrary,
  session: SessionSnapshot,
): SessionLibrary {
  const existing = library.sessions.findIndex((s) => s.id === session.id);
  let next: SessionSnapshot[];
  if (existing >= 0) {
    next = [...library.sessions];
    next[existing] = session;
  } else {
    next = [session, ...library.sessions];
  }
  // Sort newest-first by updatedAt
  next.sort((a, b) => b.updatedAt - a.updatedAt);
  if (next.length > MAX_SESSIONS) {
    next = next.slice(0, MAX_SESSIONS);
  }
  return { ...library, sessions: next };
}

export function deleteSession(
  library: SessionLibrary,
  id: string,
): SessionLibrary {
  return {
    ...library,
    sessions: library.sessions.filter((s) => s.id !== id),
  };
}

export function renameSession(
  library: SessionLibrary,
  id: string,
  newName: string,
): SessionLibrary {
  const trimmed = newName.trim();
  if (!trimmed) return library;
  return {
    ...library,
    sessions: library.sessions.map((s) =>
      s.id === id ? { ...s, name: trimmed, updatedAt: Date.now() } : s,
    ),
  };
}

export function getSession(
  library: SessionLibrary,
  id: string,
): SessionSnapshot | null {
  return library.sessions.find((s) => s.id === id) ?? null;
}

/**
 * Generate a readable default name from the first user message in a
 * conversation. Falls back to a timestamp if the conversation is
 * empty or only has assistant turns.
 */
export function autoName(messages: CodeChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) {
    return new Date().toLocaleString();
  }
  const text = firstUser.content.trim();
  const firstLine = text.split("\n")[0];
  if (firstLine.length <= 60) return firstLine;
  return firstLine.slice(0, 57) + "…";
}

// ─── Auto-checkpoint (Pass 223) ──────────────────────────────────────────

export interface AutoCheckpointState {
  /** Last message count we saved at (so we don't re-save mid-turn) */
  lastSavedCount: number;
  /** Id of the auto-generated session, stable across saves */
  sessionId: string;
}

/**
 * Decide whether the current message list should trigger an
 * auto-checkpoint. We save when:
 *   1. We have at least one assistant message (avoid saving the
 *      single-turn "user typed then nothing happened" case)
 *   2. The message count has grown by at least `everyN` since the
 *      last save
 *   3. OR the message count is a round multiple of `everyN` (belt-
 *      and-braces for users who prefer a predictable cadence)
 *
 * Returns `true` when the caller should persist a checkpoint. The
 * caller is responsible for updating `lastSavedCount` after saving.
 */
export function shouldCheckpoint(
  messages: CodeChatMessage[],
  state: AutoCheckpointState,
  everyN: number = 4,
): boolean {
  if (everyN <= 0) return false;
  if (messages.length === 0) return false;
  // Never save before we have at least one assistant reply
  const hasAssistant = messages.some((m) => m.role === "assistant");
  if (!hasAssistant) return false;
  const delta = messages.length - state.lastSavedCount;
  if (delta <= 0) return false;
  return delta >= everyN;
}

// ─── Fork + search (Pass 220-221) ────────────────────────────────────────

/**
 * Fork a conversation at a given message — returns the messages up to
 * and including the forked message. Callers typically save the result
 * as a new SessionSnapshot so the original conversation is untouched.
 *
 * `forkAtMessageId` is inclusive: the forked message itself is kept.
 * If the id isn't found, returns the entire list unchanged.
 */
export function forkMessagesAt(
  messages: CodeChatMessage[],
  forkAtMessageId: string,
): CodeChatMessage[] {
  const idx = messages.findIndex((m) => m.id === forkAtMessageId);
  if (idx < 0) return messages;
  return messages.slice(0, idx + 1);
}

export interface SessionSearchHit {
  sessionId: string;
  sessionName: string;
  messageIndex: number;
  messageRole: CodeChatMessage["role"];
  snippet: string; // excerpt with the match surrounded
  matchAt: number; // index of the match inside the snippet
  matchLen: number;
}

/**
 * Full-text search across every saved session. Returns hits ordered
 * by session updated-time (newest first), capped at `limit`. Case-
 * insensitive substring match on message content.
 *
 * `snippet` is a ~120-char window around the match for display.
 */
export function searchSessions(
  library: SessionLibrary,
  query: string,
  limit = 30,
): SessionSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SessionSearchHit[] = [];
  const sorted = [...library.sessions].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  for (const session of sorted) {
    for (let i = 0; i < session.messages.length; i++) {
      if (hits.length >= limit) break;
      const msg = session.messages[i];
      const lower = msg.content.toLowerCase();
      const matchAt = lower.indexOf(q);
      if (matchAt < 0) continue;
      const start = Math.max(0, matchAt - 40);
      const end = Math.min(msg.content.length, matchAt + q.length + 80);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < msg.content.length ? "…" : "";
      const snippet = prefix + msg.content.slice(start, end) + suffix;
      hits.push({
        sessionId: session.id,
        sessionName: session.name,
        messageIndex: i,
        messageRole: msg.role,
        snippet,
        matchAt: matchAt - start + prefix.length,
        matchLen: q.length,
      });
    }
    if (hits.length >= limit) break;
  }
  return hits;
}

// ─── localStorage adapter (thin — not unit tested, manually verified) ───

export function loadLibrary(): SessionLibrary {
  try {
    return parseLibrary(localStorage.getItem(SESSIONS_STORAGE_KEY));
  } catch {
    return emptyLibrary();
  }
}

export function saveLibrary(library: SessionLibrary): void {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(library));
  } catch {
    /* quota exceeded — silently drop, the UI is still consistent in-memory */
  }
}
