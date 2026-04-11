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
import {
  registerCacheSubscriber,
  byExtension,
} from "./cacheInvalidation";

const CACHE_TTL_MS = 60_000;
const SUPPORTED_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SUPPORTED_EXTS_SET = new Set(SUPPORTED_EXTS);
const MAX_FILE_SIZE = 256 * 1024;

let cached: { index: SymbolIndex; builtAt: number } | null = null;
let buildInFlight: Promise<SymbolIndex> | null = null;

export function clearSymbolIndexCache(): void {
  cached = null;
  buildInFlight = null;
}

// Build-loop Pass 9 (G10): subscribe to file-change notifications so
// agent edits invalidate the symbol index immediately instead of
// waiting up to 60s for the TTL to fire.
registerCacheSubscriber({
  name: "symbolIndex",
  predicate: byExtension(SUPPORTED_EXTS),
  clear: clearSymbolIndexCache,
});

async function rebuildIndex(workspaceRoot: string): Promise<SymbolIndex> {
  const files = await getWorkspaceFileIndex(workspaceRoot);
  const sources: Array<{ path: string; content: string }> = [];
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!SUPPORTED_EXTS_SET.has(ext)) continue;
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
