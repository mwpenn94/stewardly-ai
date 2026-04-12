/**
 * File freshness checker — Pass 255.
 *
 * Pure + stat-powered helper for detecting when a file has been
 * modified outside of Code Chat since the agent last touched it.
 * The client keeps a local map of {path → lastKnownMtime} (updated
 * via the codeChat.fileMtime query whenever the agent reads/writes
 * a file) and polls the server periodically to see if the mtime
 * has drifted.
 *
 * The server never stores this state — it's stateless and just
 * compares what the client sends vs the current fs state. That keeps
 * memory bounded and multi-tab behavior sane.
 */

import path from "node:path";
import fs from "node:fs/promises";

export interface FileMtimeEntry {
  path: string;
  /** Millisecond Unix timestamp; undefined means "unknown" */
  mtime: number | null;
  /** True when we couldn't stat the file (missing, permission denied, etc.) */
  missing: boolean;
}

export interface FreshnessCheck {
  path: string;
  /** Mtime the client thought was current */
  expectedMtime: number | null;
}

export interface FreshnessResult {
  entries: FreshnessDelta[];
  checkedAt: number;
}

export interface FreshnessDelta {
  path: string;
  expectedMtime: number | null;
  currentMtime: number | null;
  missing: boolean;
  stale: boolean;
}

/**
 * Safely stat a workspace-relative path. Returns an entry with
 * `missing: true` on any failure rather than throwing.
 */
export async function statFile(
  workspaceRoot: string,
  relPath: string,
): Promise<FileMtimeEntry> {
  try {
    const abs = resolveSafe(workspaceRoot, relPath);
    if (!abs) {
      return { path: relPath, mtime: null, missing: true };
    }
    const stat = await fs.stat(abs);
    if (!stat.isFile()) {
      return { path: relPath, mtime: null, missing: true };
    }
    return {
      path: relPath,
      mtime: Math.floor(stat.mtimeMs),
      missing: false,
    };
  } catch {
    return { path: relPath, mtime: null, missing: true };
  }
}

/**
 * Resolve a workspace-relative path to an absolute path, refusing
 * any attempt to escape the workspace root via `..`.
 */
export function resolveSafe(workspaceRoot: string, relPath: string): string | null {
  const abs = path.resolve(workspaceRoot, relPath);
  const root = path.resolve(workspaceRoot);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

/**
 * For each client-provided entry, stat the file and return a delta
 * indicating whether the mtime changed. Malformed entries (empty
 * path, absolute path, traversal attempts) are skipped.
 *
 * Parallel statting, capped at 500 entries per call to prevent
 * pathological requests.
 */
export async function checkFreshness(
  workspaceRoot: string,
  checks: FreshnessCheck[],
): Promise<FreshnessResult> {
  const now = Date.now();
  const safeChecks = (checks ?? [])
    .filter((c) => c && typeof c.path === "string" && c.path.length > 0)
    .slice(0, 500);
  const stats = await Promise.all(
    safeChecks.map((c) => statFile(workspaceRoot, c.path)),
  );
  const entries: FreshnessDelta[] = safeChecks.map((c, i) => {
    const stat = stats[i];
    const currentMtime = stat.mtime;
    const expected = typeof c.expectedMtime === "number" ? c.expectedMtime : null;
    let stale = false;
    if (stat.missing && expected != null) {
      stale = true;
    } else if (!stat.missing && expected == null) {
      // We've never seen the file — don't flag as stale, just record
      stale = false;
    } else if (currentMtime != null && expected != null) {
      // Allow a 2s slop for clock drift / file-system precision
      stale = Math.abs(currentMtime - expected) > 2000;
    }
    return {
      path: c.path,
      expectedMtime: expected,
      currentMtime,
      missing: stat.missing,
      stale,
    };
  });
  return { entries, checkedAt: now };
}

/**
 * Summarize a FreshnessResult for the client: how many are stale,
 * how many are missing, and the top-N stale paths for quick display.
 */
export interface FreshnessSummary {
  total: number;
  staleCount: number;
  missingCount: number;
  stalePaths: string[];
}

export function summarizeFreshness(
  result: FreshnessResult,
  limit = 10,
): FreshnessSummary {
  let staleCount = 0;
  let missingCount = 0;
  const stalePaths: string[] = [];
  for (const e of result.entries) {
    if (e.missing) missingCount++;
    if (e.stale) {
      staleCount++;
      if (stalePaths.length < limit) stalePaths.push(e.path);
    }
  }
  return {
    total: result.entries.length,
    staleCount,
    missingCount,
    stalePaths,
  };
}
