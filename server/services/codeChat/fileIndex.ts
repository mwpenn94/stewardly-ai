/**
 * Workspace file index for Code Chat @-mentions (Pass 206).
 *
 * Walks the workspace once and caches a flat list of files so the
 * @-mention autocomplete can filter locally without hitting the
 * filesystem on every keystroke. The cache is invalidated after
 * CACHE_TTL_MS so newly-added files show up without a restart.
 *
 * Respects a denylist of paths the mention UI should never surface
 * (node_modules, dist, .git, lockfiles, binaries, etc) so the fuzzy
 * search stays fast and results stay relevant.
 */

import path from "path";
import fs from "fs/promises";
import { logger } from "../../_core/logger";

const CACHE_TTL_MS = 60_000;
const MAX_FILES = 5_000;

const DENY_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  ".stewardly",
  ".pnpm-store",
]);

const DENY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".wav",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".lock",
]);

const DENY_FILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
]);

interface CacheEntry {
  files: string[];
  builtAt: number;
  root: string;
}

let _cache: CacheEntry | null = null;

export async function buildWorkspaceFileIndex(
  workspaceRoot: string,
): Promise<string[]> {
  const root = path.resolve(workspaceRoot);
  const result: string[] = [];
  const stack: string[] = [root];

  while (stack.length > 0 && result.length < MAX_FILES) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (result.length >= MAX_FILES) break;
      if (entry.name.startsWith(".") && entry.name !== ".stewardly") {
        // .env, .git, .vscode — hide by default
        if (entry.name === ".claude") continue;
        if (entry.isDirectory() && DENY_DIRS.has(entry.name)) continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (DENY_DIRS.has(entry.name)) continue;
        stack.push(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (DENY_EXTS.has(ext)) continue;
        if (DENY_FILES.has(entry.name)) continue;
        // Store the path relative to the workspace root, POSIX style
        const rel = path.relative(root, fullPath).split(path.sep).join("/");
        result.push(rel);
      }
    }
  }
  return result.sort();
}

export async function getWorkspaceFileIndex(
  workspaceRoot: string,
  opts: { force?: boolean } = {},
): Promise<string[]> {
  const root = path.resolve(workspaceRoot);
  const now = Date.now();
  if (
    !opts.force &&
    _cache &&
    _cache.root === root &&
    now - _cache.builtAt < CACHE_TTL_MS
  ) {
    return _cache.files;
  }
  try {
    const files = await buildWorkspaceFileIndex(root);
    _cache = { files, builtAt: now, root };
    return files;
  } catch (err) {
    logger.error({ err, root }, "buildWorkspaceFileIndex failed");
    if (_cache && _cache.root === root) return _cache.files;
    return [];
  }
}

/**
 * Fuzzy-filter a file index against a query. Ranks matches by:
 *   1. Exact filename match
 *   2. Filename starts with query
 *   3. Filename contains query
 *   4. Full path contains query
 *
 * Filenames (basename) are weighted higher than path components
 * because users typing `@Chat` expect to see `Chat.tsx` first, not
 * every file in a folder that happens to have "chat" in its path.
 */
export function fuzzyFilterFiles(
  files: string[],
  query: string,
  limit = 20,
): string[] {
  if (!query) return files.slice(0, limit);
  const q = query.toLowerCase();
  const scored: Array<{ file: string; score: number }> = [];
  for (const file of files) {
    const base = file.split("/").pop()!.toLowerCase();
    const lower = file.toLowerCase();
    let score = 0;
    if (base === q) score = 200;
    else if (base.startsWith(q)) score = 150;
    else if (base.includes(q)) score = 100;
    else if (lower.includes(q)) score = 50;
    if (score > 0) {
      // Shorter files rank higher at equal relevance
      score -= file.length * 0.01;
      scored.push({ file, score });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.file);
}

/**
 * Extract @file references from a chat message. Supports two
 * shapes:
 *   @server/routers/codeChat.ts       (unbracketed, terminates at whitespace)
 *   @{server/routers/codeChat.ts}     (bracketed, allows spaces/punctuation)
 *
 * Returns unique paths in order of first appearance, capped at
 * `maxRefs` to prevent runaway context injection.
 */
export function extractFileMentions(
  message: string,
  maxRefs = 5,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const bracketRx = /@\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = bracketRx.exec(message)) && out.length < maxRefs) {
    const p = match[1].trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }

  // Plain @path — path characters only (no spaces/quotes/braces)
  const plainRx = /@([\w./-]+)/g;
  while ((match = plainRx.exec(message)) && out.length < maxRefs) {
    const p = match[1];
    const hasSlash = p.includes("/");
    const hasExt = /\.[a-zA-Z0-9]+$/.test(p);
    // Bare @usernames (no slash, no extension) aren't file refs
    if (!hasSlash && !hasExt) continue;
    // @foo.name with a dot but no slash: require it to actually end
    // in a recognizable extension (`foo.ts`, not `user.name`)
    if (!hasSlash && p.includes(".") && !hasExt) continue;
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }

  return out;
}

/** Test-only helper to clear the cache. */
export function __resetFileIndexCache(): void {
  _cache = null;
}
