/**
 * In-process cache for the workspace import graph (Pass 245).
 *
 * Same TTL + in-flight dedup pattern as symbolIndexCache.
 */

import path from "path";
import fs from "fs/promises";
import { getWorkspaceFileIndex } from "./fileIndex";
import { buildImportGraph, type ImportGraph } from "./importGraph";
import {
  registerCacheSubscriber,
  byExtension,
} from "./cacheInvalidation";

const CACHE_TTL_MS = 60_000;
const SUPPORTED_EXTS_LIST = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SUPPORTED_EXTS = new Set(SUPPORTED_EXTS_LIST);
const MAX_FILE_SIZE = 256 * 1024;

let cached: { graph: ImportGraph; knownFiles: string[]; builtAt: number } | null = null;
let buildInFlight: Promise<{ graph: ImportGraph; knownFiles: string[] }> | null = null;

export function clearImportGraphCache(): void {
  cached = null;
  buildInFlight = null;
}

// Build-loop Pass 9 (G10): eager invalidation on file change.
registerCacheSubscriber({
  name: "importGraph",
  predicate: byExtension(SUPPORTED_EXTS_LIST),
  clear: clearImportGraphCache,
});

async function rebuildGraph(
  workspaceRoot: string,
): Promise<{ graph: ImportGraph; knownFiles: string[] }> {
  const files = await getWorkspaceFileIndex(workspaceRoot);
  const sources: Array<{ path: string; content: string }> = [];
  const knownFiles: string[] = [];
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;
    knownFiles.push(rel);
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
  const graph = buildImportGraph(sources);
  cached = { graph, knownFiles, builtAt: Date.now() };
  return { graph, knownFiles };
}

export async function getImportGraph(
  workspaceRoot: string,
): Promise<{ graph: ImportGraph; knownFiles: string[] }> {
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
    return { graph: cached.graph, knownFiles: cached.knownFiles };
  }
  if (buildInFlight) return buildInFlight;
  buildInFlight = rebuildGraph(workspaceRoot).finally(() => {
    buildInFlight = null;
  });
  return buildInFlight;
}
