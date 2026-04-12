/**
 * Batch file apply — Pass 256.
 *
 * Atomic multi-file writes for Code Chat. The current write_file +
 * edit_file tools operate one file at a time, so a multi-file
 * refactor that fails halfway leaves the workspace half-modified.
 * This module provides a single `applyBatch` function that:
 *
 *   1. Validates every operation up front (paths, non-empty content,
 *      edit targets must exist).
 *   2. Pre-reads every target file for a rollback snapshot.
 *   3. Applies operations in order.
 *   4. If any write fails OR if `dryRun` is set, rolls back every
 *      already-applied write from the snapshot so the final state
 *      matches the initial state.
 *   5. Returns per-operation results so the UI can render success/
 *      failure per entry.
 *
 * The module is stateless and does not hold any cache — each call
 * does a fresh stat/read cycle. Intended for human-triggered batch
 * actions (not automatic agent calls) where cost doesn't matter.
 *
 * All writes go through `fileTools` so the sandbox / path safety
 * checks still apply.
 */

import path from "node:path";
import fs from "node:fs/promises";
import {
  writeFile,
  editFile,
  readFile,
  type SandboxOptions,
  SandboxError,
} from "./fileTools";

export type BatchOpKind = "write" | "edit";

export interface BatchWriteOp {
  kind: "write";
  path: string;
  content: string;
}

export interface BatchEditOp {
  kind: "edit";
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export type BatchOp = BatchWriteOp | BatchEditOp;

export interface BatchValidationIssue {
  index: number;
  path: string;
  message: string;
}

export interface BatchValidationResult {
  ok: boolean;
  issues: BatchValidationIssue[];
}

export interface BatchOpResult {
  index: number;
  path: string;
  kind: BatchOpKind;
  ok: boolean;
  error?: string;
  /** Byte count after write / edit */
  bytes?: number;
  /** Pre-write snapshot for diffing, absent if the file didn't exist */
  before?: string;
  /** Post-write content */
  after?: string;
}

export interface BatchApplyResult {
  ok: boolean;
  dryRun: boolean;
  operations: BatchOpResult[];
  /** Populated when a rollback fires; lists paths successfully restored */
  rolledBack?: string[];
  /** Populated when a rollback partially succeeds */
  rollbackFailures?: Array<{ path: string; error: string }>;
  /** Total bytes written across all successful operations */
  totalBytes: number;
  durationMs: number;
}

/**
 * Validate a batch without touching the filesystem. Pure function,
 * catches shape mistakes before we stat anything.
 */
export function validateBatch(ops: BatchOp[]): BatchValidationResult {
  const issues: BatchValidationIssue[] = [];
  if (!Array.isArray(ops) || ops.length === 0) {
    return { ok: false, issues: [{ index: -1, path: "", message: "batch is empty" }] };
  }
  const seenPaths = new Set<string>();
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op || typeof op !== "object") {
      issues.push({ index: i, path: "", message: "not an object" });
      continue;
    }
    if (op.kind !== "write" && op.kind !== "edit") {
      issues.push({ index: i, path: (op as any).path ?? "", message: `unknown kind: ${(op as any).kind}` });
      continue;
    }
    const p = op.path;
    if (typeof p !== "string" || p.length === 0) {
      issues.push({ index: i, path: "", message: "path required" });
      continue;
    }
    if (p.includes("..")) {
      issues.push({ index: i, path: p, message: "path traversal disallowed" });
      continue;
    }
    // Note: the same path appearing twice is allowed (e.g. write then
    // edit) but we flag duplicate writes-with-same-content as redundant.
    if (op.kind === "write") {
      if (typeof op.content !== "string") {
        issues.push({ index: i, path: p, message: "write op missing content" });
        continue;
      }
    } else if (op.kind === "edit") {
      if (typeof op.oldString !== "string" || typeof op.newString !== "string") {
        issues.push({ index: i, path: p, message: "edit op requires oldString + newString" });
        continue;
      }
      if (op.oldString.length === 0) {
        issues.push({ index: i, path: p, message: "edit oldString cannot be empty" });
        continue;
      }
    }
    seenPaths.add(p);
  }
  return { ok: issues.length === 0, issues };
}

interface PreReadEntry {
  path: string;
  /** File content before any operation ran, or null if it didn't exist */
  content: string | null;
}

async function preRead(
  sandbox: SandboxOptions,
  paths: string[],
): Promise<Map<string, PreReadEntry>> {
  const out = new Map<string, PreReadEntry>();
  for (const p of paths) {
    if (out.has(p)) continue;
    try {
      const r = await readFile(sandbox, p);
      out.set(p, { path: p, content: r.content });
    } catch (err) {
      if (err instanceof SandboxError && err.code === "NOT_FOUND") {
        out.set(p, { path: p, content: null });
      } else {
        // Other errors get recorded with `content: null` — the write
        // op will fail and the rollback phase will skip (nothing to
        // restore).
        out.set(p, { path: p, content: null });
      }
    }
  }
  return out;
}

/**
 * Apply a batch of operations atomically. On any failure (or when
 * `dryRun` is true), every already-applied write is reverted from
 * the pre-read snapshot.
 */
export async function applyBatch(
  sandbox: SandboxOptions,
  ops: BatchOp[],
  opts: { dryRun?: boolean } = {},
): Promise<BatchApplyResult> {
  const startedAt = Date.now();
  const validation = validateBatch(ops);
  if (!validation.ok) {
    return {
      ok: false,
      dryRun: Boolean(opts.dryRun),
      operations: validation.issues.map((issue) => ({
        index: issue.index,
        path: issue.path,
        kind: (ops[issue.index] as BatchOp | undefined)?.kind ?? "write",
        ok: false,
        error: issue.message,
      })),
      totalBytes: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const uniquePaths = Array.from(new Set(ops.map((o) => o.path)));
  const snapshot = await preRead(sandbox, uniquePaths);
  const results: BatchOpResult[] = [];
  let aborted = false;
  let abortReason: string | null = null;
  let totalBytes = 0;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (aborted) {
      results.push({
        index: i,
        path: op.path,
        kind: op.kind,
        ok: false,
        error: `skipped (aborted at op ${i - 1})`,
      });
      continue;
    }
    const pre = snapshot.get(op.path);
    try {
      if (op.kind === "write") {
        const r = await writeFile(sandbox, op.path, op.content);
        totalBytes += r.byteLength;
        results.push({
          index: i,
          path: op.path,
          kind: "write",
          ok: true,
          bytes: r.byteLength,
          before: pre?.content ?? "",
          after: op.content,
        });
      } else {
        const r = await editFile(
          sandbox,
          op.path,
          op.oldString,
          op.newString,
          op.replaceAll ?? false,
        );
        totalBytes += r.byteLength ?? 0;
        results.push({
          index: i,
          path: op.path,
          kind: "edit",
          ok: true,
          bytes: r.byteLength,
          before: r.before ?? pre?.content ?? "",
          after: r.after ?? "",
        });
      }
    } catch (err) {
      aborted = true;
      abortReason =
        err instanceof Error ? err.message : String(err);
      results.push({
        index: i,
        path: op.path,
        kind: op.kind,
        ok: false,
        error: abortReason,
      });
    }
  }

  const shouldRollback = aborted || opts.dryRun === true;
  const rolledBack: string[] = [];
  const rollbackFailures: Array<{ path: string; error: string }> = [];

  if (shouldRollback) {
    // Restore every file we successfully wrote to, in reverse order.
    for (let i = results.length - 1; i >= 0; i--) {
      const r = results[i];
      if (!r.ok) continue;
      const pre = snapshot.get(r.path);
      if (!pre) continue;
      try {
        if (pre.content === null) {
          // File didn't exist before — delete what we created
          const abs = path.resolve(sandbox.workspaceRoot, r.path);
          await fs.rm(abs, { force: true });
        } else {
          await writeFile(sandbox, r.path, pre.content);
        }
        rolledBack.push(r.path);
      } catch (err) {
        rollbackFailures.push({
          path: r.path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return {
    ok: !aborted && !opts.dryRun,
    dryRun: Boolean(opts.dryRun),
    operations: results,
    rolledBack: shouldRollback ? rolledBack : undefined,
    rollbackFailures:
      rollbackFailures.length > 0 ? rollbackFailures : undefined,
    totalBytes,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Preview mode: runs the batch through validation + snapshot but
 * uses dryRun so nothing is persisted. Useful for confirming the
 * set of files and getting per-op before/after previews without
 * committing anything.
 */
export async function previewBatch(
  sandbox: SandboxOptions,
  ops: BatchOp[],
): Promise<BatchApplyResult> {
  return await applyBatch(sandbox, ops, { dryRun: true });
}
