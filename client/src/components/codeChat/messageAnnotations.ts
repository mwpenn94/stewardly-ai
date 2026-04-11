/**
 * Per-message annotations (Pass 233-235).
 *
 * Lightweight localStorage-backed stores for per-message metadata that
 * lives outside the message object itself so it doesn't affect the
 * serialization format or token count:
 *
 *   - Bookmarks (Pass 233) — Set of message ids the user starred
 *   - Reactions (Pass 235) — Map of message id → "up" | "down"
 *
 * Annotations are keyed by message id only (no session scoping) since
 * message ids are globally unique (`u-${timestamp}` / `a-${timestamp}`
 * / `compact-${timestamp}`). All helpers are pure functions so the
 * logic stays unit-testable without DOM or storage mocks.
 */

export const BOOKMARKS_STORAGE_KEY = "stewardly-codechat-bookmarks";
export const REACTIONS_STORAGE_KEY = "stewardly-codechat-reactions";

const MAX_BOOKMARKS = 500;

// ─── Bookmarks (Pass 233) ────────────────────────────────────────────────

export function parseBookmarks(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry !== "string" || !entry) continue;
      if (seen.has(entry)) continue;
      seen.add(entry);
      out.push(entry);
      if (out.length >= MAX_BOOKMARKS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function toggleBookmark(
  bookmarks: string[],
  messageId: string,
): string[] {
  if (bookmarks.includes(messageId)) {
    return bookmarks.filter((id) => id !== messageId);
  }
  const next = [...bookmarks, messageId];
  if (next.length > MAX_BOOKMARKS) return next.slice(next.length - MAX_BOOKMARKS);
  return next;
}

export function isBookmarked(bookmarks: string[], messageId: string): boolean {
  return bookmarks.includes(messageId);
}

export function loadBookmarks(): string[] {
  try {
    return parseBookmarks(localStorage.getItem(BOOKMARKS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: string[]): void {
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    /* quota */
  }
}

// ─── Reactions (Pass 235) ────────────────────────────────────────────────

export type Reaction = "up" | "down";
export type ReactionMap = Record<string, Reaction>;

export function parseReactions(raw: string | null): ReactionMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ReactionMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== "string" || !k) continue;
      if (v === "up" || v === "down") {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Toggle a reaction on a message. Clicking the same reaction twice
 * clears it; clicking the opposite reaction replaces the first.
 */
export function setReaction(
  reactions: ReactionMap,
  messageId: string,
  reaction: Reaction,
): ReactionMap {
  const current = reactions[messageId];
  if (current === reaction) {
    // Toggle off
    const next = { ...reactions };
    delete next[messageId];
    return next;
  }
  return { ...reactions, [messageId]: reaction };
}

export function getReaction(
  reactions: ReactionMap,
  messageId: string,
): Reaction | null {
  return reactions[messageId] ?? null;
}

export function loadReactions(): ReactionMap {
  try {
    return parseReactions(localStorage.getItem(REACTIONS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveReactions(reactions: ReactionMap): void {
  try {
    localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(reactions));
  } catch {
    /* quota */
  }
}

export function countReactions(reactions: ReactionMap): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const v of Object.values(reactions)) {
    if (v === "up") up++;
    else if (v === "down") down++;
  }
  return { up, down };
}
