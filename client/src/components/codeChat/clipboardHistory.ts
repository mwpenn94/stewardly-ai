/**
 * Clipboard history — Pass 265.
 *
 * Tracks every chunk the user explicitly copies from Code Chat
 * (message action-bar Copy button, code-block Copy button, diff
 * viewer Copy button) and stores the last N entries so the user
 * can re-paste any previous selection without having to dig
 * through the scroll buffer.
 *
 * Client-only pure store + localStorage. Integration lives in
 * ClipboardHistoryPopover.tsx which is a searchable list with
 * one-click re-copy.
 */

export type ClipboardSource =
  | "message"
  | "code-block"
  | "diff"
  | "file"
  | "grep"
  | "trace"
  | "export"
  | "other";

export interface ClipboardEntry {
  id: string;
  content: string;
  source: ClipboardSource;
  /** Optional preview label (e.g. message id, file path, language) */
  label?: string;
  timestamp: number;
  /** Byte length of the content */
  bytes: number;
}

export const MAX_ENTRIES = 100;
export const MAX_CONTENT_BYTES = 16 * 1024;
const STORAGE_KEY = "stewardly-codechat-clipboard-history";

// ─── Mutations ───────────────────────────────────────────────────────

function generateId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Record a new clipboard entry. Dedupes against the most-recent entry
 * to avoid spamming history when a user clicks Copy twice in a row
 * on the same thing.
 */
export function recordClip(
  list: ClipboardEntry[],
  content: string,
  source: ClipboardSource,
  label?: string,
): ClipboardEntry[] {
  if (!content) return list;
  const trimmed = content.length > MAX_CONTENT_BYTES
    ? content.slice(0, MAX_CONTENT_BYTES) + "\n… (truncated)"
    : content;
  // Dedupe against most recent
  if (list[0] && list[0].content === trimmed && list[0].source === source) {
    return list;
  }
  const entry: ClipboardEntry = {
    id: generateId(),
    content: trimmed,
    source,
    label: label?.trim() || undefined,
    timestamp: Date.now(),
    bytes: trimmed.length,
  };
  const merged = [entry, ...list];
  return merged.slice(0, MAX_ENTRIES);
}

export function removeClip(
  list: ClipboardEntry[],
  id: string,
): ClipboardEntry[] {
  return list.filter((e) => e.id !== id);
}

export function clearClipboardHistory(): ClipboardEntry[] {
  return [];
}

// ─── Filtering / searching ───────────────────────────────────────────

export function filterClips(
  list: ClipboardEntry[],
  query: string,
  source?: ClipboardSource | "all",
): ClipboardEntry[] {
  let out = list;
  if (source && source !== "all") {
    out = out.filter((e) => e.source === source);
  }
  const q = query.trim().toLowerCase();
  if (!q) return out;
  return out.filter(
    (e) =>
      e.content.toLowerCase().includes(q) ||
      (e.label?.toLowerCase().includes(q) ?? false),
  );
}

export interface ClipboardSummary {
  total: number;
  bySource: Record<ClipboardSource, number>;
  totalBytes: number;
}

export function summarizeClips(list: ClipboardEntry[]): ClipboardSummary {
  const bySource: Record<ClipboardSource, number> = {
    message: 0,
    "code-block": 0,
    diff: 0,
    file: 0,
    grep: 0,
    trace: 0,
    export: 0,
    other: 0,
  };
  let totalBytes = 0;
  for (const e of list) {
    bySource[e.source]++;
    totalBytes += e.bytes;
  }
  return { total: list.length, bySource, totalBytes };
}

/**
 * Format an entry as a short preview for the list. Single-line,
 * trimmed, with ellipsis.
 */
export function previewClip(entry: ClipboardEntry, maxLen = 80): string {
  const firstLine = entry.content.replace(/\r?\n/g, " ").trim();
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen) + "…";
}

// ─── Persistence ─────────────────────────────────────────────────────

const VALID_SOURCES: ClipboardSource[] = [
  "message",
  "code-block",
  "diff",
  "file",
  "grep",
  "trace",
  "export",
  "other",
];

function isValidSource(s: unknown): s is ClipboardSource {
  return typeof s === "string" && VALID_SOURCES.includes(s as ClipboardSource);
}

export function parseClips(raw: string | null): ClipboardEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ClipboardEntry[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const ee = e as Record<string, unknown>;
      if (typeof ee.id !== "string" || typeof ee.content !== "string") continue;
      if (!isValidSource(ee.source)) continue;
      out.push({
        id: ee.id,
        content: ee.content,
        source: ee.source,
        label: typeof ee.label === "string" ? ee.label : undefined,
        timestamp: typeof ee.timestamp === "number" ? ee.timestamp : 0,
        bytes:
          typeof ee.bytes === "number"
            ? ee.bytes
            : ee.content.length,
      });
      if (out.length >= MAX_ENTRIES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeClips(list: ClipboardEntry[]): string {
  return JSON.stringify(list);
}

export function loadClips(): ClipboardEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return parseClips(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveClips(list: ClipboardEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeClips(list));
  } catch {
    /* quota */
  }
}

/**
 * Copy to the actual system clipboard. Returns true on success.
 */
export async function writeToClipboard(content: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
}
