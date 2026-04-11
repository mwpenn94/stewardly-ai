/**
 * Agent memory — persistent facts injected into every Code Chat
 * system prompt (Pass 241).
 *
 * Claude Code has long-lived "memory" that the user can populate with
 * facts the agent should know across every session ("use pnpm not
 * npm", "this project uses Drizzle, not Prisma", etc.). This module
 * is the client-side equivalent: a localStorage-backed memory store
 * whose contents are forwarded to the server and injected into the
 * system prompt on every request.
 *
 * Design:
 *   - One store per device (not per-session) — users want memories
 *     to travel across every conversation
 *   - Category tags for organization (project/preference/fact/warning)
 *   - 200-entry cap with oldest-wins drop
 *   - Pure functions only — UI lives in AgentMemoryPopover.tsx
 */

export type MemoryCategory =
  | "project"
  | "preference"
  | "fact"
  | "warning";

export interface MemoryEntry {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: number;
  updatedAt: number;
}

export const STORAGE_KEY = "stewardly-codechat-agent-memory";
export const MAX_ENTRIES = 200;
export const MAX_CONTENT_LENGTH = 1000;

export const CATEGORIES: MemoryCategory[] = [
  "project",
  "preference",
  "fact",
  "warning",
];

export const CATEGORY_ICONS: Record<MemoryCategory, string> = {
  project: "📁",
  preference: "⚙️",
  fact: "ℹ️",
  warning: "⚠️",
};

// ─── Mutations ──────────────────────────────────────────────────────────

export function emptyMemory(): MemoryEntry[] {
  return [];
}

/**
 * Add a memory entry. Auto-generates id and timestamps. Dedupes on
 * exact-content-match within the same category (updates the existing
 * entry's updatedAt instead of creating a duplicate). Caps at
 * MAX_ENTRIES (drops the oldest).
 */
export function addMemory(
  entries: MemoryEntry[],
  content: string,
  category: MemoryCategory = "fact",
): MemoryEntry[] {
  const trimmed = content.trim();
  if (!trimmed) return entries;
  const clamped = trimmed.slice(0, MAX_CONTENT_LENGTH);

  // Dedupe: same content + category → update timestamp, move to front
  const existingIdx = entries.findIndex(
    (e) => e.content === clamped && e.category === category,
  );
  if (existingIdx !== -1) {
    const updated: MemoryEntry = {
      ...entries[existingIdx],
      updatedAt: Date.now(),
    };
    return [updated, ...entries.filter((_, i) => i !== existingIdx)];
  }

  const now = Date.now();
  const entry: MemoryEntry = {
    id: `mem-${now}-${Math.random().toString(36).slice(2, 8)}`,
    content: clamped,
    category,
    createdAt: now,
    updatedAt: now,
  };

  const next = [entry, ...entries];
  if (next.length > MAX_ENTRIES) {
    return next.slice(0, MAX_ENTRIES);
  }
  return next;
}

export function removeMemory(entries: MemoryEntry[], id: string): MemoryEntry[] {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return entries;
  return entries.filter((_, i) => i !== idx);
}

export function updateMemory(
  entries: MemoryEntry[],
  id: string,
  update: Partial<Pick<MemoryEntry, "content" | "category">>,
): MemoryEntry[] {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return entries;
  const current = entries[idx];
  const content =
    update.content !== undefined ? update.content.trim().slice(0, MAX_CONTENT_LENGTH) : current.content;
  if (!content) return entries;
  const category = update.category ?? current.category;
  const updated: MemoryEntry = {
    ...current,
    content,
    category,
    updatedAt: Date.now(),
  };
  const next = [...entries];
  next[idx] = updated;
  return next;
}

export function clearMemory(): MemoryEntry[] {
  return [];
}

export function filterByCategory(
  entries: MemoryEntry[],
  category: MemoryCategory | "all",
): MemoryEntry[] {
  if (category === "all") return entries;
  return entries.filter((e) => e.category === category);
}

// ─── System prompt overlay ─────────────────────────────────────────────

/**
 * Build the memory block that gets injected into the Code Chat system
 * prompt. Returns an empty string when there are no entries so the
 * caller can safely concat.
 */
export function buildMemoryOverlay(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const grouped = new Map<MemoryCategory, MemoryEntry[]>();
  for (const e of entries) {
    if (!grouped.has(e.category)) grouped.set(e.category, []);
    grouped.get(e.category)!.push(e);
  }

  const blocks: string[] = [];
  for (const cat of CATEGORIES) {
    const list = grouped.get(cat);
    if (!list || list.length === 0) continue;
    const items = list.map((e) => `- ${e.content}`).join("\n");
    blocks.push(`## ${cat.toUpperCase()}\n${items}`);
  }
  return [
    "# Agent memory",
    "The following facts were saved by the user across prior sessions. Treat them as persistent context — follow them unless the user explicitly overrides.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

// ─── Derivations ───────────────────────────────────────────────────────

export interface MemorySummary {
  total: number;
  byCategory: Record<MemoryCategory, number>;
  mostRecent: MemoryEntry | null;
}

export function summarizeMemory(entries: MemoryEntry[]): MemorySummary {
  const byCategory: Record<MemoryCategory, number> = {
    project: 0,
    preference: 0,
    fact: 0,
    warning: 0,
  };
  let mostRecent: MemoryEntry | null = null;
  for (const e of entries) {
    byCategory[e.category]++;
    if (!mostRecent || e.updatedAt > mostRecent.updatedAt) mostRecent = e;
  }
  return { total: entries.length, byCategory, mostRecent };
}

// ─── Persistence ───────────────────────────────────────────────────────

export function parseMemory(raw: string | null): MemoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: MemoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      if (
        typeof rec.id === "string" &&
        typeof rec.content === "string" &&
        typeof rec.createdAt === "number" &&
        typeof rec.updatedAt === "number" &&
        typeof rec.category === "string" &&
        CATEGORIES.includes(rec.category as MemoryCategory)
      ) {
        out.push({
          id: rec.id,
          content: rec.content.slice(0, MAX_CONTENT_LENGTH),
          category: rec.category as MemoryCategory,
          createdAt: rec.createdAt,
          updatedAt: rec.updatedAt,
        });
      }
      if (out.length >= MAX_ENTRIES) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function loadMemory(): MemoryEntry[] {
  try {
    return parseMemory(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveMemory(entries: MemoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota */
  }
}
