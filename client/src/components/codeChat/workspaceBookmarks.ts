/**
 * Workspace file bookmarks — Pass 259.
 *
 * A persistent list of user-favorited workspace files. Distinct
 * from the Pass 224 "pinned files" system — pinned files are an
 * ephemeral working set that gets auto-injected into every prompt
 * via @-mentions, while bookmarks are a longer-lived "my favorite
 * places in the codebase" list organized by folder.
 *
 * Each bookmark carries:
 *   - path (workspace-relative)
 *   - optional label
 *   - optional folder (for grouping)
 *   - optional line number (open at that location)
 *   - optional color tag
 *   - createdAt
 *
 * Pure store + localStorage persistence. Integration lives in
 * BookmarksPanel.tsx.
 */

export type BookmarkColor =
  | "default"
  | "red"
  | "amber"
  | "green"
  | "blue"
  | "purple";

export interface WorkspaceBookmark {
  id: string;
  path: string;
  label?: string;
  folder?: string;
  line?: number;
  color: BookmarkColor;
  createdAt: number;
}

export const MAX_BOOKMARKS = 200;
const STORAGE_KEY = "stewardly-codechat-workspace-bookmarks";

function generateId(): string {
  return `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createBookmark(
  path: string,
  opts: {
    label?: string;
    folder?: string;
    line?: number;
    color?: BookmarkColor;
  } = {},
): WorkspaceBookmark {
  return {
    id: generateId(),
    path: path.trim(),
    label: opts.label?.trim() || undefined,
    folder: opts.folder?.trim() || undefined,
    line: typeof opts.line === "number" && opts.line > 0 ? opts.line : undefined,
    color: opts.color ?? "default",
    createdAt: Date.now(),
  };
}

export function addBookmark(
  list: WorkspaceBookmark[],
  bookmark: WorkspaceBookmark,
): WorkspaceBookmark[] {
  // Dedupe by path (+ line if set). Replace with the new entry so
  // edits to label/color/folder take effect.
  const filtered = list.filter(
    (b) => !(b.path === bookmark.path && b.line === bookmark.line),
  );
  const merged = [bookmark, ...filtered];
  return merged.slice(0, MAX_BOOKMARKS);
}

export function removeBookmark(
  list: WorkspaceBookmark[],
  id: string,
): WorkspaceBookmark[] {
  return list.filter((b) => b.id !== id);
}

export function updateBookmark(
  list: WorkspaceBookmark[],
  id: string,
  patch: Partial<Omit<WorkspaceBookmark, "id" | "createdAt">>,
): WorkspaceBookmark[] {
  return list.map((b) =>
    b.id === id
      ? {
          ...b,
          ...patch,
          label: patch.label?.trim() || b.label,
          folder: patch.folder?.trim() || b.folder,
          color: patch.color ?? b.color,
        }
      : b,
  );
}

/**
 * Group bookmarks by folder. Bookmarks without a folder go into an
 * "unsorted" bucket at the end. Within each folder, bookmarks are
 * sorted by creation time descending.
 */
export function groupByFolder(
  list: WorkspaceBookmark[],
): Array<{ folder: string; bookmarks: WorkspaceBookmark[] }> {
  const map = new Map<string, WorkspaceBookmark[]>();
  const order: string[] = [];
  for (const b of list) {
    const key = b.folder ?? "";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(b);
  }
  // Within each folder, newest-first
  map.forEach((entries) => {
    entries.sort((a, b) => b.createdAt - a.createdAt);
  });
  // Sorted folders, then unsorted ("") last
  const sortedKeys = order
    .filter((k) => k !== "")
    .sort((a, b) => a.localeCompare(b));
  if (order.includes("")) sortedKeys.push("");
  return sortedKeys.map((folder) => ({
    folder: folder || "Unsorted",
    bookmarks: map.get(folder) ?? [],
  }));
}

export function filterBookmarks(
  list: WorkspaceBookmark[],
  query: string,
): WorkspaceBookmark[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (b) =>
      b.path.toLowerCase().includes(q) ||
      (b.label?.toLowerCase().includes(q) ?? false) ||
      (b.folder?.toLowerCase().includes(q) ?? false),
  );
}

export function allFolders(list: WorkspaceBookmark[]): string[] {
  const set = new Set<string>();
  for (const b of list) {
    if (b.folder) set.add(b.folder);
  }
  return Array.from(set).sort();
}

// ─── Persistence ─────────────────────────────────────────────────────

export function parseBookmarks(raw: string | null): WorkspaceBookmark[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: WorkspaceBookmark[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const bb = e as Record<string, unknown>;
      if (typeof bb.id !== "string" || typeof bb.path !== "string") continue;
      const color = bb.color;
      out.push({
        id: bb.id,
        path: bb.path,
        label: typeof bb.label === "string" ? bb.label : undefined,
        folder: typeof bb.folder === "string" ? bb.folder : undefined,
        line:
          typeof bb.line === "number" && bb.line > 0 ? bb.line : undefined,
        color:
          color === "red" ||
          color === "amber" ||
          color === "green" ||
          color === "blue" ||
          color === "purple"
            ? color
            : "default",
        createdAt: typeof bb.createdAt === "number" ? bb.createdAt : 0,
      });
      if (out.length >= MAX_BOOKMARKS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeBookmarks(list: WorkspaceBookmark[]): string {
  return JSON.stringify(list);
}

export function loadBookmarks(): WorkspaceBookmark[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return parseBookmarks(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveBookmarks(list: WorkspaceBookmark[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeBookmarks(list));
  } catch {
    /* quota */
  }
}
