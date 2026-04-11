/**
 * In-process cache for the workspace TODO marker scan (Pass 246).
 */

import path from "path";
import fs from "fs/promises";
import { getWorkspaceFileIndex } from "./fileIndex";
import { extractMarkers, type TodoMarker } from "./todoMarkers";
import {
  registerCacheSubscriber,
  byExtension,
} from "./cacheInvalidation";

const CACHE_TTL_MS = 60_000;
const SUPPORTED_EXTS_LIST = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".c",
  ".cc",
  ".cpp",
  ".h",
  ".hpp",
  ".css",
  ".scss",
  ".md",
  ".yaml",
  ".yml",
  ".sh",
  ".sql",
];
const SUPPORTED_EXTS = new Set(SUPPORTED_EXTS_LIST);
const MAX_FILE_SIZE = 256 * 1024;

let cached: { markers: TodoMarker[]; builtAt: number } | null = null;
let buildInFlight: Promise<TodoMarker[]> | null = null;

export function clearTodoMarkersCache(): void {
  cached = null;
  buildInFlight = null;
}

// Build-loop Pass 9 (G10): eager invalidation on file change.
registerCacheSubscriber({
  name: "todoMarkers",
  predicate: byExtension(SUPPORTED_EXTS_LIST),
  clear: clearTodoMarkersCache,
});

async function rebuildMarkers(workspaceRoot: string): Promise<TodoMarker[]> {
  const files = await getWorkspaceFileIndex(workspaceRoot);
  const out: TodoMarker[] = [];
  for (const rel of files) {
    const ext = path.extname(rel).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;
    try {
      const abs = path.resolve(workspaceRoot, rel);
      const stat = await fs.stat(abs);
      if (stat.size > MAX_FILE_SIZE) continue;
      const content = await fs.readFile(abs, "utf8");
      const markers = extractMarkers(content, rel);
      out.push(...markers);
      if (out.length >= 10_000) break; // hard global cap
    } catch {
      /* skip unreadable */
    }
  }
  cached = { markers: out, builtAt: Date.now() };
  return out;
}

export async function getTodoMarkers(workspaceRoot: string): Promise<TodoMarker[]> {
  if (cached && Date.now() - cached.builtAt < CACHE_TTL_MS) {
    return cached.markers;
  }
  if (buildInFlight) return buildInFlight;
  buildInFlight = rebuildMarkers(workspaceRoot).finally(() => {
    buildInFlight = null;
  });
  return buildInFlight;
}
