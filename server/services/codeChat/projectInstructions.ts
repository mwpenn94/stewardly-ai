/**
 * Project Instructions loader (Pass 238).
 *
 * Claude Code auto-loads `CLAUDE.md` from the project root and walks
 * up parent directories to surface persistent project guidance to the
 * agent on every invocation. This module ports that idea into the
 * Stewardly Code Chat sandbox.
 *
 * Discovery order (first hit wins per file name):
 *   1. .stewardly/instructions.md  (Stewardly-specific override)
 *   2. CLAUDE.md                    (Claude Code convention)
 *   3. AGENTS.md                    (alternative agent convention)
 *
 * We don't walk up past the workspace root — the sandbox boundary is
 * the hard limit for everything else in the Code Chat, and project
 * instructions are no exception.
 *
 * Content is cached in-process keyed by absolute path + mtime so edit
 * + re-invoke picks up the change without a cold restart.
 */

import path from "path";
import fs from "fs/promises";
import { readFile as sandboxReadFile } from "./fileTools";

export interface ProjectInstructionEntry {
  /** Workspace-relative path (forward slashes) */
  path: string;
  /** Raw content, truncated if over MAX_BYTES */
  content: string;
  /** Byte length of the loaded (possibly truncated) content */
  byteLength: number;
  /** True when the file was over MAX_BYTES and got cut */
  truncated: boolean;
  /** Convention label for the UI */
  kind: "stewardly" | "claude" | "agents";
}

export interface ProjectInstructionsResult {
  entries: ProjectInstructionEntry[];
  totalBytes: number;
}

/** Max bytes per file — keeps the context budget sane even with a 32KB CLAUDE.md */
export const MAX_BYTES = 32 * 1024;

const INSTRUCTION_SOURCES: Array<{
  relative: string;
  kind: ProjectInstructionEntry["kind"];
}> = [
  { relative: ".stewardly/instructions.md", kind: "stewardly" },
  { relative: "CLAUDE.md", kind: "claude" },
  { relative: "AGENTS.md", kind: "agents" },
];

interface CacheEntry {
  mtimeMs: number;
  entry: ProjectInstructionEntry;
}

const cache = new Map<string, CacheEntry>();

/**
 * Reset the in-process cache. Exposed primarily for tests — production
 * cache invalidation is mtime-based so you don't normally need this.
 */
export function clearProjectInstructionsCache(): void {
  cache.clear();
}

async function tryLoadFile(
  workspaceRoot: string,
  relative: string,
  kind: ProjectInstructionEntry["kind"],
): Promise<ProjectInstructionEntry | null> {
  const abs = path.resolve(workspaceRoot, relative);
  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;

  const cached = cache.get(abs);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.entry;
  }

  try {
    const result = await sandboxReadFile(
      { workspaceRoot, allowMutations: false, maxReadBytes: MAX_BYTES },
      relative,
    );
    // sandboxReadFile reports the raw file size as byteLength and may
    // append a truncation marker. We hard-cap the content at MAX_BYTES
    // so the UI meter and system prompt budget see a real in-context
    // size regardless of underlying readFile behavior.
    let content = result.content;
    let truncated = result.truncated;
    if (Buffer.byteLength(content, "utf8") > MAX_BYTES) {
      content = content.slice(0, MAX_BYTES);
      truncated = true;
    }
    const entry: ProjectInstructionEntry = {
      path: relative.replace(/\\/g, "/"),
      content,
      byteLength: Buffer.byteLength(content, "utf8"),
      truncated,
      kind,
    };
    cache.set(abs, { mtimeMs: stat.mtimeMs, entry });
    return entry;
  } catch {
    return null;
  }
}

/**
 * Load all known instruction files from the workspace root. Results
 * come back in priority order so the caller can simply concatenate
 * them into the system prompt.
 */
export async function loadProjectInstructions(
  workspaceRoot: string,
): Promise<ProjectInstructionsResult> {
  const entries: ProjectInstructionEntry[] = [];
  let totalBytes = 0;
  for (const { relative, kind } of INSTRUCTION_SOURCES) {
    const entry = await tryLoadFile(workspaceRoot, relative, kind);
    if (!entry) continue;
    entries.push(entry);
    totalBytes += entry.byteLength;
  }
  return { entries, totalBytes };
}

/**
 * Build the system-prompt overlay string for a loaded instructions
 * set. Returns an empty string when no entries were found so the
 * caller can safely concat.
 */
export function buildInstructionsPromptOverlay(
  result: ProjectInstructionsResult,
): string {
  if (result.entries.length === 0) return "";
  const blocks = result.entries.map((e) => {
    const header = `# Project instructions — ${e.path}${e.truncated ? " (truncated)" : ""}`;
    return `${header}\n${e.content.trim()}`;
  });
  return [
    "The following project instruction files were auto-loaded from the workspace. Treat them as the authoritative house rules and follow them on every task in this session.",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}

/**
 * Build a compact manifest for the UI panel. Strips the content so
 * large files don't blow the tRPC payload.
 */
export function manifestForUI(result: ProjectInstructionsResult): {
  entries: Array<
    Omit<ProjectInstructionEntry, "content"> & { preview: string }
  >;
  totalBytes: number;
} {
  return {
    entries: result.entries.map((e) => ({
      path: e.path,
      byteLength: e.byteLength,
      truncated: e.truncated,
      kind: e.kind,
      preview: e.content.slice(0, 512),
    })),
    totalBytes: result.totalBytes,
  };
}
