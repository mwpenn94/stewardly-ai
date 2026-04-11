/**
 * Code Chat cache invalidation registry — Build-loop Pass 9 (G10).
 *
 * Problem: every cache in the codeChat services layer (symbol index,
 * import graph, TODO markers, file index) uses a 60s TTL. When the
 * agent edits a file, those caches are stale until the TTL expires —
 * which means the next `find_symbol` / `glob_files` / `scanTodoMarkers`
 * call returns the OLD shape until a minute passes.
 *
 * Fix: a tiny in-process pub/sub. Cache modules subscribe with a
 * predicate `(relPath) => boolean` and a `clear` callback. The
 * file-tools layer calls `notifyFileChanged(workspaceRoot, relPath,
 * kind)` after every successful write/edit. Subscribers whose
 * predicate matches get cleared eagerly. The TTL still fires as a
 * safety net for changes the agent didn't make (e.g. someone runs
 * `git pull` in the workspace from outside the app).
 *
 * Pure-data registry — no chokidar dependency, no native fs.watch.
 * The trade-off is that out-of-band file changes won't trigger
 * invalidation, but those still get caught by the TTL within 60s.
 * For agent-driven workflows (which are 95% of Code Chat usage)
 * this is exact.
 */

export type FileChangeKind = "write" | "edit" | "delete";

export interface CacheSubscriber {
  /** Stable identifier for logging + dedup. */
  name: string;
  /**
   * Return true if this subscriber's cache should be invalidated by
   * the given relative path. Common patterns:
   *   - Always (`() => true`) — cache is global and small enough
   *     that any change should drop it.
   *   - Extension filter (`p => p.endsWith(".ts")`) — symbol index
   *     only cares about TS/JS files.
   *   - Path scoping — cache is per-subtree; only invalidate when
   *     the changed file is under that subtree.
   */
  predicate: (relativePath: string, kind: FileChangeKind) => boolean;
  /** Drop the cache. Called synchronously inside `notifyFileChanged`. */
  clear: () => void;
}

const subscribers = new Map<string, CacheSubscriber>();

/**
 * Register a cache to be invalidated when matching files change.
 * Re-registering with the same name replaces the prior entry so
 * hot reloads don't double-clear.
 */
export function registerCacheSubscriber(sub: CacheSubscriber): void {
  subscribers.set(sub.name, sub);
}

/** Remove a subscriber by name (mostly used in tests). */
export function unregisterCacheSubscriber(name: string): void {
  subscribers.delete(name);
}

/** Clear every subscriber. Used in test setup/teardown. */
export function clearAllSubscribers(): void {
  subscribers.clear();
}

/** Read-only view for tests + introspection. */
export function listSubscribers(): string[] {
  return Array.from(subscribers.keys()).sort();
}

/**
 * Fire the change notification through every subscriber. Called by
 * `writeFile` / `editFile` immediately after the underlying fs.write
 * succeeds.
 *
 * Errors thrown by a subscriber's `clear` are swallowed so a buggy
 * cache never breaks the file write — invalidation is best-effort
 * by design.
 *
 * Returns the list of subscriber names that were invalidated, for
 * logging / observability.
 */
export function notifyFileChanged(
  relativePath: string,
  kind: FileChangeKind,
): string[] {
  if (subscribers.size === 0) return [];
  const cleared: string[] = [];
  // Use Array.from to avoid `--downlevelIteration` requirement on
  // older TS targets — the registry stays small (< 10 entries) so
  // the snapshot copy is essentially free.
  for (const sub of Array.from(subscribers.values())) {
    let match: boolean;
    try {
      match = sub.predicate(relativePath, kind);
    } catch {
      // A buggy predicate shouldn't break the entire chain.
      match = false;
    }
    if (!match) continue;
    try {
      sub.clear();
      cleared.push(sub.name);
    } catch {
      /* swallow — invalidation is best-effort */
    }
  }
  return cleared;
}

// ─── Predicates (reusable) ─────────────────────────────────────────────

/** Always-match predicate. Use for global caches that drop wholesale. */
export const allChanges = (): true => true;

/**
 * Match by file extension. Returns true if `relPath`'s extension
 * (case-insensitive) is in the supplied set. Pass extensions WITH the
 * leading dot (e.g. `[".ts", ".tsx"]`).
 */
export function byExtension(
  exts: Iterable<string>,
): (relPath: string) => boolean {
  const set = new Set(Array.from(exts, (e) => e.toLowerCase()));
  return (relPath: string) => {
    const idx = relPath.lastIndexOf(".");
    if (idx === -1) return false;
    return set.has(relPath.slice(idx).toLowerCase());
  };
}

/** Match if the changed file lives under any of the given POSIX prefixes. */
export function bySubtree(
  prefixes: Iterable<string>,
): (relPath: string) => boolean {
  const list = Array.from(prefixes, (p) =>
    p.endsWith("/") ? p : p + "/",
  );
  return (relPath: string) => {
    for (const prefix of list) {
      if (relPath === prefix.slice(0, -1) || relPath.startsWith(prefix)) {
        return true;
      }
    }
    return false;
  };
}
