/**
 * In-process cache for the workspace symbol index (Pass 242).
 *
 * Building the index is cheap (~200-500ms for ~2000 source files at
 * regex speed) but we don't want to rebuild on every tRPC call. This
 * module keeps a single process-global cached index that auto-expires
 * after 60s so edits propagate without a server restart.
 */

import path from "path";
import fs from "fs/promises";
import { getWorkspaceFileIndex } from "./fileIndex";
import { buildSymbolIndex, type SymbolIndex } from "./symbolIndex";

const CACHE_TTL_MS = 60_000;
const SUPPORTED_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const MAX_FILE_SIZE = 256 * 1024;

let cached: { index: SymbolIndex; builtAt: number } | null = null;
let buildInFlight: Promise<SymbolIndex> | null = null;

export function clearSymbolIndexCache(): void {
  cached = null;
  buildInFlight = null;
}

async function rebuildIndex(workspaceRoot: string): Promise<SymbolIndex> {
  const files = await getWorkspaceFileIndex(workspaceRoot);
  const sources: Array<{ path: string; content: string }> = [];
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;
    try {
      const abs = path.resolve(workspaceRoot, rel);
      const stat = await fs.stat(abs);
      if (stat.size > MAX_FILE_SIZE) continue;
      const content = await fs.readFile(abs, "utf8");
      sources.push({ path: rel, content });
    } catch {
      /* skip unreadable */
    }
  }
  const index = buildSymbolIndex(sources);
  cached = { index, builtAt: Date.now() };
  return index;
}

/**
 * Return the current symbol index, rebuilding if stale. Multiple
 * concurrent callers will share a single in-flight rebuild instead
 * of thundering the filesystem.
 */
export async function getSymbolIndex(workspaceRoot: string): Promise<SymbolIndex> {
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
    return cached.index;
  }
  if (buildInFlight) return buildInFlight;
  buildInFlight = rebuildIndex(workspaceRoot).finally(() => {
    buildInFlight = null;
  });
  return buildInFlight;
}
