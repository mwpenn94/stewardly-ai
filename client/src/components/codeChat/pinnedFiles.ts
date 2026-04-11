/**
 * Pinned files working set (Pass 224).
 *
 * A persistent list of workspace file paths the user wants to keep
 * in context across every prompt. Before a message is sent, the
 * pinned paths are auto-prepended as `@path` references so the
 * existing server-side `@`-mention expander (Pass 206) reads them
 * and inlines the file contents as context.
 *
 * Matches VS Code's "keep open" / Cursor's "@Codebase" pinning
 * patterns — a small working set you reference implicitly instead
 * of having to `@` them on every turn.
 *
 * Pure functions + a thin localStorage adapter for easy testing.
 */

export const PINNED_FILES_STORAGE_KEY = "stewardly-codechat-pinned-files";
const MAX_PINNED_FILES = 10;

// ─── Pure helpers ────────────────────────────────────────────────────────

export function parsePinned(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry !== "string" || !entry.trim()) continue;
      if (seen.has(entry)) continue;
      seen.add(entry);
      out.push(entry);
      if (out.length >= MAX_PINNED_FILES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function addPinned(pinned: string[], path: string): string[] {
  const trimmed = path.trim();
  if (!trimmed) return pinned;
  if (pinned.includes(trimmed)) return pinned;
  const next = [...pinned, trimmed];
  if (next.length > MAX_PINNED_FILES) {
    // Drop the oldest entry to make room
    return next.slice(next.length - MAX_PINNED_FILES);
  }
  return next;
}

export function removePinned(pinned: string[], path: string): string[] {
  return pinned.filter((p) => p !== path);
}

export function togglePinned(pinned: string[], path: string): string[] {
  return pinned.includes(path)
    ? removePinned(pinned, path)
    : addPinned(pinned, path);
}

/**
 * Prepend pinned-file `@` references to a user message so the
 * server-side `extractFileMentions` picks them up and inlines the
 * file contents as context. References are only added when not
 * already present in the message so the user can override by
 * including their own `@`-mention.
 *
 * Paths with spaces are wrapped in `@{...}` brackets; simple paths
 * use plain `@path` form.
 */
export function buildMentionsPrefix(pinned: string[], message: string): string {
  if (pinned.length === 0) return "";
  const alreadyMentioned = new Set<string>();
  // Match bracketed + plain mentions
  const bracketRx = /@\{([^}]+)\}/g;
  const plainRx = /@([\w./-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRx.exec(message)) !== null) {
    alreadyMentioned.add(m[1].trim());
  }
  while ((m = plainRx.exec(message)) !== null) {
    alreadyMentioned.add(m[1]);
  }
  const refs: string[] = [];
  for (const path of pinned) {
    if (alreadyMentioned.has(path)) continue;
    if (/\s/.test(path) || /[{}]/.test(path)) {
      refs.push(`@{${path}}`);
    } else {
      refs.push(`@${path}`);
    }
  }
  if (refs.length === 0) return "";
  return refs.join(" ") + " ";
}

/**
 * Apply pinned-file injection to a message. Returns the message
 * unchanged if there's nothing to inject.
 */
export function applyPinnedToMessage(
  pinned: string[],
  message: string,
): string {
  const prefix = buildMentionsPrefix(pinned, message);
  if (!prefix) return message;
  return prefix + message;
}

// ─── localStorage adapter ────────────────────────────────────────────────

export function loadPinned(): string[] {
  try {
    return parsePinned(localStorage.getItem(PINNED_FILES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function savePinned(pinned: string[]): void {
  try {
    localStorage.setItem(PINNED_FILES_STORAGE_KEY, JSON.stringify(pinned));
  } catch {
    /* quota */
  }
}
