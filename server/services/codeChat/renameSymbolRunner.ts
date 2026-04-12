/**
 * Workspace rename-symbol runner — Pass 257.
 *
 * Thin wrapper that walks the workspace file index, reads every
 * TS/JS source file under a size cap, and feeds the {path, content}
 * tuples into `buildRenamePlan` for planning. The caller decides
 * whether to preview or commit via the Pass 256 batch apply runner.
 */

import path from "node:path";
import fs from "node:fs/promises";
import { getWorkspaceFileIndex } from "./fileIndex";
import {
  buildRenamePlan,
  type RenameInput,
  type RenamePlan,
} from "./renameSymbol";

const SUPPORTED_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);
const MAX_FILE_SIZE = 256 * 1024;
const MAX_FILES_SCANNED = 3000;

export async function buildWorkspaceRenamePlan(
  workspaceRoot: string,
  oldName: string,
  newName: string,
  opts: { includeComments?: boolean; pathPrefix?: string } = {},
): Promise<RenamePlan & { filesScanned: number }> {
  const files = await getWorkspaceFileIndex(workspaceRoot);
  const tuples: RenameInput["files"] = [];
  let scanned = 0;

  for (const rel of files) {
    if (scanned >= MAX_FILES_SCANNED) break;
    if (opts.pathPrefix && !rel.startsWith(opts.pathPrefix)) continue;
    const ext = path.extname(rel).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;
    try {
      const abs = path.resolve(workspaceRoot, rel);
      const stat = await fs.stat(abs);
      if (stat.size > MAX_FILE_SIZE) continue;
      const content = await fs.readFile(abs, "utf8");
      scanned++;
      // Cheap pre-filter: include only files that mention the old name
      if (!content.includes(oldName)) continue;
      tuples.push({ path: rel, content });
    } catch {
      /* unreadable */
    }
  }

  const plan = buildRenamePlan({
    oldName,
    newName,
    includeComments: opts.includeComments,
    files: tuples,
  });

  return { ...plan, filesScanned: scanned };
}
