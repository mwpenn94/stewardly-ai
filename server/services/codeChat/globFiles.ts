/**
 * Glob tool runner — Build-loop Pass 1.
 *
 * Binds the pure `globMatcher` to the cached workspace file index so
 * `glob_files` is both fast (no re-walk) and deterministic.
 *
 * Shape matches Claude Code's `Glob` tool:
 *
 *   input  = { pattern: "src/** /*.tsx", path?: "src", limit?: 200 }
 *   output = { pattern, files: ["src/pages/Chat.tsx", ...], truncated: boolean }
 *
 * The `path` narrows the search to a subtree (matches are prefixed
 * with `path/` before being tested) so the agent can say
 * `glob_files({ path: "server", pattern: "** /*.ts" })` without having
 * to remember to prefix every pattern itself.
 */

import { getWorkspaceFileIndex } from "./fileIndex";
import { matchGlob, rankGlobMatches, type GlobOptions } from "./globMatcher";

export interface GlobFilesInput {
  pattern: string | string[];
  /**
   * Optional subtree to search. Must be a POSIX relative path
   * (e.g. "server", "client/src"). Ignored if empty/absent.
   */
  path?: string;
  /** Max results to return (default 200, hard cap 2000). */
  limit?: number;
  caseInsensitive?: boolean;
  dot?: boolean;
}

export interface GlobFilesResult {
  pattern: string | string[];
  path?: string;
  files: string[];
  truncated: boolean;
  searched: number;
}

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 2000;

function normalizeSubtreePath(p: string | undefined): string | null {
  if (!p) return null;
  const trimmed = p.trim().replace(/^\.\/+/, "").replace(/\/+$/, "");
  if (!trimmed || trimmed === ".") return null;
  // Reject absolute paths and parent-escaping
  if (trimmed.startsWith("/")) return null;
  if (trimmed.split("/").includes("..")) return null;
  return trimmed;
}

/**
 * Execute a glob query against the workspace.
 *
 * Throws only on catastrophic filesystem errors (the file index
 * builder already degrades to an empty array on read failures), so
 * callers don't need a try/catch for normal "no matches" cases.
 */
export async function globFiles(
  workspaceRoot: string,
  input: GlobFilesInput,
): Promise<GlobFilesResult> {
  const pattern = input.pattern;
  if (
    (typeof pattern !== "string" || !pattern.trim()) &&
    !(Array.isArray(pattern) && pattern.length > 0)
  ) {
    return {
      pattern,
      path: input.path,
      files: [],
      truncated: false,
      searched: 0,
    };
  }
  const limit = Math.min(
    Math.max(1, Math.floor(input.limit ?? DEFAULT_LIMIT)),
    MAX_LIMIT,
  );
  const subtree = normalizeSubtreePath(input.path);
  const allFiles = await getWorkspaceFileIndex(workspaceRoot);

  // If a subtree was specified, narrow to files under it and strip
  // the prefix so the user's pattern doesn't need to repeat it.
  let candidates: string[];
  if (subtree) {
    const prefix = subtree + "/";
    candidates = allFiles
      .filter((f) => f === subtree || f.startsWith(prefix))
      .map((f) => (f.startsWith(prefix) ? f.slice(prefix.length) : f));
  } else {
    candidates = allFiles;
  }

  const opts: GlobOptions = {
    caseInsensitive: input.caseInsensitive,
    dot: input.dot,
  };
  const raw = matchGlob(candidates, pattern, opts);
  const ranked = rankGlobMatches(raw);

  // Re-prefix the subtree so the agent gets workspace-relative paths
  // in the result (consistent with every other tool).
  const prefixed = subtree
    ? ranked.map((f) => `${subtree}/${f}`)
    : ranked;
  const truncated = prefixed.length > limit;
  return {
    pattern,
    path: subtree ?? undefined,
    files: prefixed.slice(0, limit),
    truncated,
    searched: candidates.length,
  };
}
