/**
 * Workspace-wide Find References runner — Pass 252.
 *
 * Walks the workspace file index (same pattern as symbolIndexCache),
 * reads each supported source file under the 256KB cap, and invokes
 * `findInFile` from `findReferences.ts` for the given query name.
 *
 * Returns hits capped at a hard MAX_HITS limit so a lookup of a
 * super-common token like "i" or "state" can't grind the server.
 *
 * No caching — usages are scan-per-request since the parameter is
 * user-supplied. The cost is bounded by the scan cap.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { getWorkspaceFileIndex } from "./fileIndex";
import {
  findInFile,
  summarizeReferences,
  type ReferenceHit,
  type ReferenceResult,
} from "./findReferences";

const SUPPORTED_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
]);
const MAX_FILE_SIZE = 256 * 1024;
const MAX_HITS = 2000;

export async function findReferencesInWorkspace(
  workspaceRoot: string,
  name: string,
  opts: { includeComments?: boolean; pathPrefix?: string } = {},
): Promise<ReferenceResult> {
  if (!name || name.length < 2) {
    return { query: name, hits: [], filesScanned: 0, truncated: false };
  }
  const files = await getWorkspaceFileIndex(workspaceRoot);
  const hits: ReferenceHit[] = [];
  let scanned = 0;
  let truncated = false;
  for (const rel of files) {
    if (hits.length >= MAX_HITS) {
      truncated = true;
      break;
    }
    if (opts.pathPrefix && !rel.startsWith(opts.pathPrefix)) continue;
    const ext = path.extname(rel).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;
    try {
      const abs = path.resolve(workspaceRoot, rel);
      const stat = await fs.stat(abs);
      if (stat.size > MAX_FILE_SIZE) continue;
      const content = await fs.readFile(abs, "utf8");
      scanned++;
      // Cheap pre-filter: if the token doesn't appear at all, skip
      // the full regex pass. Saves a few ms per mostly-irrelevant file.
      if (!content.includes(name)) continue;
      const fileHits = findInFile(rel, content, name, {
        includeComments: opts.includeComments ?? true,
      });
      for (const h of fileHits) {
        if (hits.length >= MAX_HITS) {
          truncated = true;
          break;
        }
        hits.push(h);
      }
    } catch {
      /* unreadable file — skip */
    }
  }
  return { query: name, hits, filesScanned: scanned, truncated };
}

export function summarize(result: ReferenceResult) {
  return summarizeReferences(result.hits);
}
