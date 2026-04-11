/**
 * Rename symbol refactor — Pass 257.
 *
 * Pure module that takes a list of "hits" from the Pass 252 find-
 * references scan plus an old/new name pair, and produces a list
 * of batch-apply operations that rename the symbol across the
 * workspace.
 *
 * The module does not do its own file I/O — callers are expected to
 * feed it the current content per hit, then pipe the resulting ops
 * through `batchApply.applyBatch` for the atomic + rollback guarantees
 * from Pass 256.
 *
 * Design notes:
 *   - We rename by replacing whole-word occurrences with `\bname\b`
 *     regex semantics, same as find-references. This avoids
 *     accidentally renaming substrings (e.g. "foo" inside "foobar").
 *   - Import statements and string literals containing the name are
 *     replaced too — the user can preview the batch and flip the
 *     per-hit "keep" toggle to suppress specific sites.
 *   - Comment hits are opt-in via `includeComments`.
 *
 * Validation:
 *   - New name must match a JavaScript identifier regex, same as
 *     Pass 242 extractSymbols.
 *   - Old and new must differ.
 *   - Both names must be ≥2 chars to match the find-references
 *     minimum.
 */

import { findInFile, type ReferenceHit, escapeRegex } from "./findReferences";

export interface RenamePlan {
  oldName: string;
  newName: string;
  entries: RenamePlanEntry[];
  skipped: Array<{ path: string; reason: string }>;
  summary: {
    fileCount: number;
    totalHits: number;
    totalReplacements: number;
  };
}

export interface RenamePlanEntry {
  path: string;
  /** Original content */
  before: string;
  /** Content with the rename applied */
  after: string;
  /** Number of replacements actually made in this file */
  replacements: number;
  /** Individual hits with line + column, sourced from findInFile */
  hits: ReferenceHit[];
}

export interface RenameInput {
  oldName: string;
  newName: string;
  includeComments?: boolean;
  /**
   * Map of path → current file content. Normally populated by the
   * caller via the file index; this module is pure so it takes
   * content as input.
   */
  files: Array<{ path: string; content: string }>;
}

// Reserved JS keywords the user cannot rename to
const RESERVED = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

const IDENTIFIER_REGEX = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export interface RenameValidationResult {
  ok: boolean;
  issues: string[];
}

export function validateRename(
  oldName: string,
  newName: string,
): RenameValidationResult {
  const issues: string[] = [];
  if (!oldName || oldName.length < 2) {
    issues.push("old name must be at least 2 characters");
  }
  if (!newName || newName.length < 2) {
    issues.push("new name must be at least 2 characters");
  }
  if (oldName === newName) {
    issues.push("old and new names are identical");
  }
  if (oldName && !IDENTIFIER_REGEX.test(oldName)) {
    issues.push("old name is not a valid identifier");
  }
  if (newName && !IDENTIFIER_REGEX.test(newName)) {
    issues.push("new name is not a valid identifier");
  }
  if (newName && RESERVED.has(newName)) {
    issues.push(`"${newName}" is a reserved JavaScript keyword`);
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Replace every whole-word occurrence of `oldName` in `source` with
 * `newName`. Returns the new content plus the number of replacements.
 *
 * The regex is global + case-sensitive (symbol names are). Unlike
 * findInFile this function operates on the full source string (not
 * line-by-line) so multi-line structures are preserved.
 */
export function replaceAllOccurrences(
  source: string,
  oldName: string,
  newName: string,
): { content: string; replacements: number } {
  if (!source || !oldName) return { content: source, replacements: 0 };
  const pattern = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "g");
  let replacements = 0;
  const content = source.replace(pattern, () => {
    replacements++;
    return newName;
  });
  return { content, replacements };
}

/**
 * Build a rename plan from a list of file-content pairs. Returns
 * one entry per file that had at least one replacement, plus a
 * `skipped` list for any file that had zero hits. The caller is
 * expected to feed the plan through the batchApply runner.
 */
export function buildRenamePlan(input: RenameInput): RenamePlan {
  const validation = validateRename(input.oldName, input.newName);
  if (!validation.ok) {
    return {
      oldName: input.oldName,
      newName: input.newName,
      entries: [],
      skipped: input.files.map((f) => ({
        path: f.path,
        reason: "validation failed",
      })),
      summary: { fileCount: 0, totalHits: 0, totalReplacements: 0 },
    };
  }
  const entries: RenamePlanEntry[] = [];
  const skipped: RenamePlan["skipped"] = [];
  let totalHits = 0;
  let totalReplacements = 0;

  for (const file of input.files) {
    const hits = findInFile(file.path, file.content, input.oldName, {
      includeComments: input.includeComments ?? true,
    });
    if (hits.length === 0) {
      skipped.push({ path: file.path, reason: "no hits" });
      continue;
    }
    const { content, replacements } = replaceAllOccurrences(
      file.content,
      input.oldName,
      input.newName,
    );
    if (replacements === 0) {
      skipped.push({ path: file.path, reason: "regex had no matches" });
      continue;
    }
    entries.push({
      path: file.path,
      before: file.content,
      after: content,
      replacements,
      hits,
    });
    totalHits += hits.length;
    totalReplacements += replacements;
  }

  return {
    oldName: input.oldName,
    newName: input.newName,
    entries,
    skipped,
    summary: {
      fileCount: entries.length,
      totalHits,
      totalReplacements,
    },
  };
}

/**
 * Convert a rename plan into the BatchOp format consumed by
 * applyBatch. Each entry becomes a single write operation with the
 * new content.
 */
export function planToBatchOps(
  plan: RenamePlan,
): Array<{ kind: "write"; path: string; content: string }> {
  return plan.entries.map((e) => ({
    kind: "write",
    path: e.path,
    content: e.after,
  }));
}
