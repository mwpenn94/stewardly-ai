/**
 * notebookTools — Jupyter notebook (.ipynb) editing (Pass 252).
 *
 * Claude Code has a dedicated NotebookEdit tool because editing
 * `.ipynb` files with generic find/replace is a minefield: they're
 * JSON documents with arrays of cells, each cell has source arrays
 * + outputs + execution_count + metadata, and any whitespace drift
 * corrupts the document so Jupyter refuses to open it. Generic
 * `edit_file` would happily cut a cell in half.
 *
 * This module adds a narrow, structured editor that understands
 * the nbformat 4 schema:
 *   - insert a cell at a position (code/markdown/raw)
 *   - replace a cell's source by index
 *   - delete a cell by index
 *   - replace a substring inside a specific cell (safer than global
 *     find/replace because the search stays scoped)
 *
 * Outputs + execution_count are deliberately left untouched — we
 * don't re-run the notebook, we just edit source.
 *
 * Design:
 *   - Pure functions operating on a parsed `Notebook` object so
 *     the logic is unit-testable without disk
 *   - `readNotebook` / `writeNotebook` wrap the sandbox fileTools
 *     so the whole thing inherits the existing workspace guard
 *   - Strict JSON round-trip: we parse, mutate, serialize with 1
 *     indent (matches Jupyter's default save format), preserve
 *     unknown top-level fields so we never lose metadata
 *   - Byte-level diff snapshots (before/after) captured so the
 *     edit history UI can render them like any other edit
 */

import path from "path";
import { resolveInside, SandboxError, type SandboxOptions } from "./fileTools";
import fs from "fs/promises";
import { existsSync } from "fs";

// ─── nbformat 4 types (minimal shape) ────────────────────────────────────

export type NotebookCellType = "code" | "markdown" | "raw";

export interface NotebookCell {
  cell_type: NotebookCellType;
  /**
   * Jupyter stores source as either a single string OR an array of
   * strings (one per line, with trailing newlines). We normalize to
   * string on the way in and serialize whatever shape the caller
   * wants on the way out.
   */
  source: string | string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
  id?: string;
  [key: string]: unknown;
}

export interface Notebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
  [key: string]: unknown;
}

export class NotebookError extends Error {
  constructor(
    message: string,
    public code:
      | "BAD_JSON"
      | "BAD_SCHEMA"
      | "OUT_OF_RANGE"
      | "NO_MATCH"
      | "AMBIGUOUS"
      | "NOT_NOTEBOOK",
  ) {
    super(message);
    this.name = "NotebookError";
  }
}

// ─── Parsing / serialization ─────────────────────────────────────────────

/**
 * Parse a raw .ipynb string into a Notebook. Validates the top-level
 * shape (must be an object with nbformat + cells[]) and rejects
 * anything that doesn't look like nbformat 4+.
 */
export function parseNotebook(raw: string): Notebook {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    throw new NotebookError(
      `notebook is not valid JSON: ${
        err instanceof Error ? err.message : "parse error"
      }`,
      "BAD_JSON",
    );
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw new NotebookError("notebook must be a JSON object", "BAD_SCHEMA");
  }
  const obj = doc as Record<string, unknown>;
  if (typeof obj.nbformat !== "number") {
    throw new NotebookError(
      "notebook missing `nbformat` field — not a Jupyter notebook",
      "NOT_NOTEBOOK",
    );
  }
  if (obj.nbformat < 4) {
    throw new NotebookError(
      `notebook nbformat ${obj.nbformat} is unsupported (need 4+)`,
      "BAD_SCHEMA",
    );
  }
  if (!Array.isArray(obj.cells)) {
    throw new NotebookError("notebook `cells` must be an array", "BAD_SCHEMA");
  }
  // Validate each cell minimally — drop malformed cells up front
  // so later mutations never touch garbage.
  for (const cell of obj.cells) {
    if (!cell || typeof cell !== "object") {
      throw new NotebookError("cell is not an object", "BAD_SCHEMA");
    }
    const c = cell as Record<string, unknown>;
    if (typeof c.cell_type !== "string") {
      throw new NotebookError("cell missing cell_type", "BAD_SCHEMA");
    }
    if (typeof c.source !== "string" && !Array.isArray(c.source)) {
      throw new NotebookError(
        `cell source must be string or string[]`,
        "BAD_SCHEMA",
      );
    }
  }
  return {
    nbformat: obj.nbformat,
    nbformat_minor: typeof obj.nbformat_minor === "number" ? obj.nbformat_minor : 0,
    metadata:
      obj.metadata && typeof obj.metadata === "object"
        ? (obj.metadata as Record<string, unknown>)
        : {},
    cells: obj.cells as NotebookCell[],
    // Preserve any other top-level fields we don't explicitly know
    // about so we don't accidentally drop metadata on save.
    ...Object.fromEntries(
      Object.entries(obj).filter(
        ([k]) =>
          !["nbformat", "nbformat_minor", "metadata", "cells"].includes(k),
      ),
    ),
  };
}

/**
 * Serialize a Notebook back to the canonical Jupyter format. Uses
 * 1-space indent to match Jupyter's default save format; any other
 * whitespace produces a document Jupyter will still open but that
 * churns diffs unnecessarily.
 */
export function serializeNotebook(nb: Notebook): string {
  // Re-order keys to match Jupyter's canonical layout: nbformat +
  // nbformat_minor last, metadata+cells first. This keeps diffs
  // stable across round-trips.
  const { nbformat, nbformat_minor, metadata, cells, ...rest } = nb;
  const ordered = {
    cells,
    metadata,
    nbformat,
    nbformat_minor,
    ...rest,
  };
  return JSON.stringify(ordered, null, 1) + "\n";
}

/**
 * Normalize a cell source to a flat string. Jupyter stores source
 * as either a single string or an array of strings — this helper
 * makes both cases easy to reason about.
 */
export function cellSourceToString(source: string | string[]): string {
  if (typeof source === "string") return source;
  return source.join("");
}

// ─── Mutation helpers (pure) ─────────────────────────────────────────────

export interface InsertCellArgs {
  position: number | "end" | "start";
  cellType: NotebookCellType;
  source: string;
  id?: string;
}

export function insertCell(nb: Notebook, args: InsertCellArgs): Notebook {
  const cells = nb.cells.slice();
  let pos: number;
  if (args.position === "start") pos = 0;
  else if (args.position === "end") pos = cells.length;
  else pos = args.position;
  if (pos < 0 || pos > cells.length) {
    throw new NotebookError(
      `insert position ${pos} out of range (0..${cells.length})`,
      "OUT_OF_RANGE",
    );
  }
  const newCell: NotebookCell = {
    cell_type: args.cellType,
    source: args.source,
    metadata: {},
    id: args.id,
  };
  if (args.cellType === "code") {
    newCell.execution_count = null;
    newCell.outputs = [];
  }
  cells.splice(pos, 0, newCell);
  return { ...nb, cells };
}

export function replaceCellSource(
  nb: Notebook,
  index: number,
  newSource: string,
): Notebook {
  if (index < 0 || index >= nb.cells.length) {
    throw new NotebookError(
      `cell index ${index} out of range (0..${nb.cells.length - 1})`,
      "OUT_OF_RANGE",
    );
  }
  const cells = nb.cells.slice();
  const old = cells[index];
  cells[index] = {
    ...old,
    source: newSource,
    // Replacing source invalidates any stale execution output — null
    // them out so the notebook doesn't show stale results pointing
    // at code that no longer exists.
    execution_count: old.cell_type === "code" ? null : old.execution_count,
    outputs: old.cell_type === "code" ? [] : old.outputs,
  };
  return { ...nb, cells };
}

export function deleteCell(nb: Notebook, index: number): Notebook {
  if (index < 0 || index >= nb.cells.length) {
    throw new NotebookError(
      `cell index ${index} out of range (0..${nb.cells.length - 1})`,
      "OUT_OF_RANGE",
    );
  }
  const cells = nb.cells.slice();
  cells.splice(index, 1);
  return { ...nb, cells };
}

/**
 * Replace a substring inside a specific cell. Unique-match
 * enforcement matches `edit_file` semantics: if `oldString` appears
 * more than once, the caller must pass `replaceAll: true`.
 */
export function editCellSource(
  nb: Notebook,
  index: number,
  oldString: string,
  newString: string,
  replaceAll = false,
): { notebook: Notebook; replacements: number } {
  if (index < 0 || index >= nb.cells.length) {
    throw new NotebookError(
      `cell index ${index} out of range (0..${nb.cells.length - 1})`,
      "OUT_OF_RANGE",
    );
  }
  const cell = nb.cells[index];
  const before = cellSourceToString(cell.source);
  if (!before.includes(oldString)) {
    throw new NotebookError(
      `oldString not found in cell ${index}`,
      "NO_MATCH",
    );
  }
  const occurrences = countOccurrences(before, oldString);
  if (occurrences > 1 && !replaceAll) {
    throw new NotebookError(
      `oldString matches ${occurrences} times in cell ${index} (use replaceAll)`,
      "AMBIGUOUS",
    );
  }
  const after = replaceAll
    ? before.split(oldString).join(newString)
    : before.replace(oldString, newString);
  const cells = nb.cells.slice();
  cells[index] = {
    ...cell,
    source: after,
    execution_count: cell.cell_type === "code" ? null : cell.execution_count,
    outputs: cell.cell_type === "code" ? [] : cell.outputs,
  };
  return {
    notebook: { ...nb, cells },
    replacements: replaceAll ? occurrences : 1,
  };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

// ─── Disk I/O ────────────────────────────────────────────────────────────

const DIFF_SNAPSHOT_BYTES = 64 * 1024;

function snapshot(s: string): string {
  if (s.length <= DIFF_SNAPSHOT_BYTES) return s;
  return s.slice(0, DIFF_SNAPSHOT_BYTES) + "\n[…truncated]";
}

export interface NotebookEditResult {
  path: string;
  operation: "insert" | "replace" | "delete" | "edit_source";
  cellCount: number;
  byteLength: number;
  before: string;
  after: string;
  diffTruncated: boolean;
  /** Present on edit_source ops */
  replacements?: number;
}

export type NotebookOperation =
  | {
      kind: "insert";
      position: number | "end" | "start";
      cellType: NotebookCellType;
      source: string;
      id?: string;
    }
  | { kind: "replace"; index: number; source: string }
  | { kind: "delete"; index: number }
  | {
      kind: "edit_source";
      index: number;
      oldString: string;
      newString: string;
      replaceAll?: boolean;
    };

/**
 * Load a notebook from disk, apply the mutation, and write it
 * back. Returns structured metadata the dispatcher surfaces to the
 * client.
 *
 * Throws SandboxError if the path escapes the workspace or
 * mutations aren't allowed; NotebookError on schema / range /
 * match failures.
 */
export async function editNotebook(
  opts: SandboxOptions,
  relativePath: string,
  operation: NotebookOperation,
): Promise<NotebookEditResult> {
  if (!opts.allowMutations) {
    throw new SandboxError(
      "notebook_edit requires allowMutations: true",
      "MUTATIONS_DISABLED",
    );
  }
  if (!relativePath.endsWith(".ipynb")) {
    throw new NotebookError(
      `notebook_edit only operates on .ipynb files (got ${relativePath})`,
      "NOT_NOTEBOOK",
    );
  }
  const abs = resolveInside(opts.workspaceRoot, relativePath);
  if (!existsSync(abs)) {
    throw new SandboxError(
      `notebook not found: ${relativePath}`,
      "NOT_FOUND",
    );
  }
  const before = await fs.readFile(abs, "utf8");
  const nb = parseNotebook(before);
  let next: Notebook;
  let replacements: number | undefined;
  switch (operation.kind) {
    case "insert":
      next = insertCell(nb, {
        position: operation.position,
        cellType: operation.cellType,
        source: operation.source,
        id: operation.id,
      });
      break;
    case "replace":
      next = replaceCellSource(nb, operation.index, operation.source);
      break;
    case "delete":
      next = deleteCell(nb, operation.index);
      break;
    case "edit_source": {
      const res = editCellSource(
        nb,
        operation.index,
        operation.oldString,
        operation.newString,
        operation.replaceAll,
      );
      next = res.notebook;
      replacements = res.replacements;
      break;
    }
  }
  const after = serializeNotebook(next);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, after, "utf8");
  const beforeSnap = snapshot(before);
  const afterSnap = snapshot(after);
  return {
    path: relativePath,
    operation:
      operation.kind === "edit_source" ? "edit_source" : operation.kind,
    cellCount: next.cells.length,
    byteLength: Buffer.byteLength(after, "utf8"),
    before: beforeSnap,
    after: afterSnap,
    diffTruncated:
      beforeSnap.length !== before.length || afterSnap.length !== after.length,
    replacements,
  };
}
