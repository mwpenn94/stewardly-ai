/**
 * Workspace checkpoints (Pass 251).
 *
 * Claude Code has a "stash" concept — save the current state of a set
 * of files, experiment, and roll back to the snapshot if things go
 * sideways. Stewardly's Code Chat already has the per-message edit
 * history ring buffer (Pass 239) which handles individual undo/redo,
 * but it doesn't survive a session reset and doesn't let you tag a
 * known-good state with a name.
 *
 * This module is the pure side: `Checkpoint` objects are plain data,
 * the helpers validate / serialize / size them, and the tRPC layer
 * does the filesystem I/O.
 *
 * Storage lives at `.stewardly/checkpoints/<id>.json` via the
 * filesystem helpers below — one file per checkpoint so deleting
 * stays cheap and atomic write-rename semantics work per platform.
 *
 * Safety model:
 *   - Every file entry carries its original byte length so a restore
 *     can warn if the live file has drifted significantly.
 *   - The total checkpoint size is capped at 8MB to prevent runaway
 *     checkpoints eating disk.
 *   - Paths are normalized to POSIX separators at save time so
 *     checkpoints are portable across OS boundaries.
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

// ─── Shape ─────────────────────────────────────────────────────────────

export interface CheckpointFile {
  /** Path relative to the workspace root, always POSIX-separated */
  path: string;
  /** Full file content captured at snapshot time */
  content: string;
  /** Byte length of `content` — stored so callers don't have to re-measure */
  byteLength: number;
}

export interface Checkpoint {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  /** The files included in the snapshot */
  files: CheckpointFile[];
  /** Sum of `file.byteLength` for quick UI display */
  totalBytes: number;
  /** Optional tag list (e.g. "before-refactor", "safe") for filtering */
  tags?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────

export const MAX_CHECKPOINT_BYTES = 8 * 1024 * 1024; // 8MB total
export const MAX_FILES_PER_CHECKPOINT = 500;
export const MAX_NAME_LENGTH = 120;

// ─── Pure helpers ─────────────────────────────────────────────────────

/**
 * Normalize any incoming path to a POSIX-style workspace-relative
 * string. Strips leading `./` and rejects absolute or escaping paths.
 * Returns null for invalid inputs (caller should drop the entry).
 */
export function normalizeCheckpointPath(raw: string): string | null {
  if (!raw) return null;
  // Convert Windows separators to POSIX
  let p = raw.replace(/\\/g, "/");
  // Strip leading ./
  while (p.startsWith("./")) p = p.slice(2);
  // Reject absolute paths and escapes
  if (p.startsWith("/") || p.startsWith("../") || p.includes("/../")) {
    return null;
  }
  // Empty after normalization
  if (!p) return null;
  return p;
}

/**
 * Build a `Checkpoint` from already-read file contents. Pure: the
 * caller reads files from disk, this function packages them.
 *
 * Applies the size + file-count + name-length caps. Returns a tuple
 * of `{checkpoint, skipped}` where `skipped` lists any files that
 * couldn't be included (due to caps or invalid paths).
 */
export function buildCheckpoint(opts: {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  tags?: string[];
  files: Array<{ path: string; content: string }>;
}): { checkpoint: Checkpoint; skipped: Array<{ path: string; reason: string }> } {
  if (!opts.name || !opts.name.trim()) {
    throw new RangeError("checkpoint name required");
  }
  const name = opts.name.trim().slice(0, MAX_NAME_LENGTH);
  const description = opts.description?.trim().slice(0, 500);
  const tags = (opts.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => /^[a-z0-9][a-z0-9_\-./]*$/.test(t))
    .slice(0, 16);

  const files: CheckpointFile[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  let totalBytes = 0;

  for (const f of opts.files) {
    if (files.length >= MAX_FILES_PER_CHECKPOINT) {
      skipped.push({ path: f.path, reason: "file_cap_reached" });
      continue;
    }
    const normalized = normalizeCheckpointPath(f.path);
    if (!normalized) {
      skipped.push({ path: f.path, reason: "invalid_path" });
      continue;
    }
    const byteLength = Buffer.byteLength(f.content, "utf-8");
    if (totalBytes + byteLength > MAX_CHECKPOINT_BYTES) {
      skipped.push({ path: normalized, reason: "size_cap_reached" });
      continue;
    }
    files.push({
      path: normalized,
      content: f.content,
      byteLength,
    });
    totalBytes += byteLength;
  }

  return {
    checkpoint: {
      id: opts.id,
      name,
      description,
      createdAt: opts.createdAt ?? new Date().toISOString(),
      files,
      totalBytes,
      tags: tags.length > 0 ? tags : undefined,
    },
    skipped,
  };
}

/**
 * Parse raw JSON into a `Checkpoint`, defensively validating every
 * field. Returns null on corruption so the caller can decide to drop
 * the file.
 */
export function parseCheckpoint(raw: unknown): Checkpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.name !== "string" || !r.name) return null;
  if (typeof r.createdAt !== "string" || !r.createdAt) return null;
  if (!Array.isArray(r.files)) return null;

  const files: CheckpointFile[] = [];
  let totalBytes = 0;
  for (const entry of r.files) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.path !== "string" || typeof e.content !== "string") continue;
    const normalized = normalizeCheckpointPath(e.path);
    if (!normalized) continue;
    const byteLength =
      typeof e.byteLength === "number" && e.byteLength >= 0
        ? e.byteLength
        : Buffer.byteLength(e.content, "utf-8");
    files.push({ path: normalized, content: e.content, byteLength });
    totalBytes += byteLength;
    if (totalBytes > MAX_CHECKPOINT_BYTES) break;
    if (files.length >= MAX_FILES_PER_CHECKPOINT) break;
  }

  const tags = Array.isArray(r.tags)
    ? r.tags.filter((t): t is string => typeof t === "string")
    : undefined;

  return {
    id: r.id,
    name: r.name.slice(0, MAX_NAME_LENGTH),
    description: typeof r.description === "string" ? r.description : undefined,
    createdAt: r.createdAt,
    files,
    totalBytes,
    tags,
  };
}

// ─── Restore plan ──────────────────────────────────────────────────────

export interface RestoreEntry {
  path: string;
  content: string;
  /** Whether the live file exists and matches the snapshot's byte length */
  liveMatches?: boolean;
}

export interface RestorePlan {
  checkpoint: Checkpoint;
  entries: RestoreEntry[];
  /** Paths that exist in the checkpoint but were filtered out by `paths` */
  filtered: string[];
}

/**
 * Build a restore plan from a checkpoint and an optional subset of
 * paths. Pure: the caller dispatches each entry through write_file.
 */
export function buildRestorePlan(
  checkpoint: Checkpoint,
  opts: {
    /** Only restore these paths (filename match). Default: all. */
    paths?: string[];
    /** Live byte-length lookup so restore can flag drift */
    liveBytes?: Map<string, number>;
  } = {},
): RestorePlan {
  const allowed = opts.paths ? new Set(opts.paths) : null;
  const entries: RestoreEntry[] = [];
  const filtered: string[] = [];
  for (const f of checkpoint.files) {
    if (allowed && !allowed.has(f.path)) {
      filtered.push(f.path);
      continue;
    }
    const live = opts.liveBytes?.get(f.path);
    entries.push({
      path: f.path,
      content: f.content,
      liveMatches: live !== undefined && live === f.byteLength,
    });
  }
  return { checkpoint, entries, filtered };
}

/** Return a UI-friendly summary without the full content payload. */
export function summarizeCheckpoint(
  c: Checkpoint,
): {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  fileCount: number;
  totalBytes: number;
  tags: string[];
  paths: string[];
} {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    createdAt: c.createdAt,
    fileCount: c.files.length,
    totalBytes: c.totalBytes,
    tags: c.tags ?? [],
    paths: c.files.map((f) => f.path),
  };
}

// ─── Filesystem helpers ──────────────────────────────────────────────

export function checkpointsDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, ".stewardly", "checkpoints");
}

export async function ensureCheckpointsDir(
  workspaceRoot: string,
): Promise<string> {
  const dir = checkpointsDir(workspaceRoot);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function saveCheckpointToDisk(
  workspaceRoot: string,
  checkpoint: Checkpoint,
): Promise<string> {
  const dir = await ensureCheckpointsDir(workspaceRoot);
  const safeId = checkpoint.id.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  const filename = `${safeId}.json`;
  const target = path.join(dir, filename);
  await fs.writeFile(target, JSON.stringify(checkpoint, null, 2), "utf-8");
  return target;
}

export async function loadCheckpointsFromDisk(
  workspaceRoot: string,
): Promise<Checkpoint[]> {
  const dir = checkpointsDir(workspaceRoot);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: Checkpoint[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(dir, name), "utf-8");
      const parsed = parseCheckpoint(JSON.parse(raw));
      if (parsed) out.push(parsed);
    } catch {
      /* skip corrupt entries */
    }
  }
  // Newest first
  out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return out;
}

export async function deleteCheckpointFromDisk(
  workspaceRoot: string,
  id: string,
): Promise<boolean> {
  const dir = checkpointsDir(workspaceRoot);
  const safeId = id.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
  const target = path.join(dir, `${safeId}.json`);
  try {
    await fs.unlink(target);
    return true;
  } catch {
    return false;
  }
}
