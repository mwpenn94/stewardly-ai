/**
 * Client-side file freshness store — Pass 255.
 *
 * Tracks the mtimes of files the agent has recently read or written
 * so the client can periodically ask the server whether any of those
 * files were changed outside Code Chat. When a drift is detected we
 * surface a banner so the user can decide to re-read or ignore.
 *
 * Pure store. Parent (CodeChat.tsx) owns the state and polls via the
 * `codeChat.checkFileFreshness` tRPC query.
 */

export interface TrackedFile {
  path: string;
  /** Mtime we saw when the agent last touched the file */
  lastKnownMtime: number | null;
  /** First time we saw this file in the current session */
  firstSeenAt: number;
  /** Last agent interaction (read or write) */
  lastSeenAt: number;
  /** "read" | "edit" | "write" — purely informational */
  origin: "read" | "edit" | "write";
}

export interface TrackedFileSet {
  entries: TrackedFile[];
}

export const MAX_TRACKED_FILES = 200;

export function emptyTrackedSet(): TrackedFileSet {
  return { entries: [] };
}

/**
 * Record an agent interaction with a file. If we've seen it before,
 * update the mtime + lastSeenAt. If not, prepend a new entry and
 * enforce the MAX_TRACKED_FILES cap (dropping the oldest).
 */
export function recordFile(
  set: TrackedFileSet,
  path: string,
  mtime: number | null,
  origin: TrackedFile["origin"],
): TrackedFileSet {
  if (!path) return set;
  const now = Date.now();
  const existing = set.entries.find((e) => e.path === path);
  if (existing) {
    return {
      entries: set.entries.map((e) =>
        e.path === path
          ? {
              ...e,
              lastKnownMtime: mtime ?? e.lastKnownMtime,
              lastSeenAt: now,
              origin,
            }
          : e,
      ),
    };
  }
  const next: TrackedFile = {
    path,
    lastKnownMtime: mtime,
    firstSeenAt: now,
    lastSeenAt: now,
    origin,
  };
  const merged = [next, ...set.entries];
  if (merged.length > MAX_TRACKED_FILES) {
    // Drop the entries with the oldest lastSeenAt. Sorting by recency
    // and slicing is O(n log n) but n is capped at 200+1 so it's fine.
    const sorted = [...merged].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    return { entries: sorted.slice(0, MAX_TRACKED_FILES) };
  }
  return { entries: merged };
}

export function clearTrackedFiles(): TrackedFileSet {
  return emptyTrackedSet();
}

export function removeTrackedFile(
  set: TrackedFileSet,
  path: string,
): TrackedFileSet {
  return { entries: set.entries.filter((e) => e.path !== path) };
}

/**
 * Apply a freshness-check result back into the set, updating the
 * recorded mtime for every entry the server confirmed as current.
 * Stale files are left alone so the UI can highlight them until
 * the user acknowledges.
 */
export function applyFreshnessResult(
  set: TrackedFileSet,
  result: {
    entries: Array<{
      path: string;
      currentMtime: number | null;
      missing: boolean;
      stale: boolean;
    }>;
  },
): TrackedFileSet {
  const map = new Map(result.entries.map((e) => [e.path, e]));
  return {
    entries: set.entries.map((e) => {
      const delta = map.get(e.path);
      if (!delta) return e;
      // Update mtime ONLY when the server reports the file is fresh —
      // otherwise we'd clobber the baseline we want to compare against.
      if (!delta.stale && !delta.missing) {
        return { ...e, lastKnownMtime: delta.currentMtime };
      }
      return e;
    }),
  };
}

/**
 * Build the `checks` array to send to the server. Returns an empty
 * array when there's nothing tracked yet.
 */
export function buildChecks(
  set: TrackedFileSet,
): Array<{ path: string; expectedMtime: number | null }> {
  return set.entries.map((e) => ({
    path: e.path,
    expectedMtime: e.lastKnownMtime,
  }));
}

/**
 * Parse tool events from a completed message and return the set of
 * distinct {path, origin} tuples that should be tracked. Mirrors the
 * pattern used by the edit-history recorder.
 */
export interface ToolEventLite {
  toolName: string;
  preview?: string;
}

export function extractTrackedFromTools(
  events: ToolEventLite[] | undefined,
): Array<{ path: string; origin: TrackedFile["origin"] }> {
  if (!events || events.length === 0) return [];
  const out: Array<{ path: string; origin: TrackedFile["origin"] }> = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (!ev.toolName) continue;
    if (
      ev.toolName !== "read_file" &&
      ev.toolName !== "edit_file" &&
      ev.toolName !== "write_file"
    ) {
      continue;
    }
    if (typeof ev.preview !== "string") continue;
    try {
      const parsed = JSON.parse(ev.preview);
      const inner = parsed?.result;
      if (!inner) continue;
      const p = typeof inner.path === "string" ? inner.path : null;
      if (!p) continue;
      const origin: TrackedFile["origin"] =
        ev.toolName === "read_file"
          ? "read"
          : ev.toolName === "edit_file"
            ? "edit"
            : "write";
      const key = `${p}:${origin}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ path: p, origin });
    } catch {
      /* skip */
    }
  }
  return out;
}

// ─── Persistence ──────────────────────────────────────────────────────

const STORAGE_KEY = "stewardly-codechat-tracked-files";

export function parseTrackedSet(raw: string | null): TrackedFileSet {
  if (!raw) return emptyTrackedSet();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return emptyTrackedSet();
    const entries: TrackedFile[] = [];
    for (const e of parsed.entries) {
      if (!e || typeof e !== "object") continue;
      const ee = e as Record<string, unknown>;
      if (typeof ee.path !== "string") continue;
      const origin = ee.origin;
      if (origin !== "read" && origin !== "edit" && origin !== "write") continue;
      entries.push({
        path: ee.path,
        lastKnownMtime: typeof ee.lastKnownMtime === "number" ? ee.lastKnownMtime : null,
        firstSeenAt: typeof ee.firstSeenAt === "number" ? ee.firstSeenAt : 0,
        lastSeenAt: typeof ee.lastSeenAt === "number" ? ee.lastSeenAt : 0,
        origin,
      });
      if (entries.length >= MAX_TRACKED_FILES) break;
    }
    return { entries };
  } catch {
    return emptyTrackedSet();
  }
}

export function serializeTrackedSet(set: TrackedFileSet): string {
  return JSON.stringify(set);
}

export function loadTrackedSet(): TrackedFileSet {
  if (typeof localStorage === "undefined") return emptyTrackedSet();
  try {
    return parseTrackedSet(localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyTrackedSet();
  }
}

export function saveTrackedSet(set: TrackedFileSet): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeTrackedSet(set));
  } catch {
    /* quota */
  }
}
