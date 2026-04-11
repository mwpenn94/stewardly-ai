/**
 * Multi-file find & replace (Pass 250).
 *
 * Claude Code has an "apply across workspace" refactor that lets users
 * preview every replacement before committing. Stewardly's Code Chat
 * had grep_search (read-only) and edit_file (single-file), so a
 * refactor like "rename `foo` to `bar` in 40 files" meant 40 manual
 * round-trips.
 *
 * This module is pure — no I/O. It takes a file's current text + a
 * find pattern + a replacement string and returns a `FilePreview`
 * describing every match as a diffed line pair. The tRPC layer walks
 * the workspace file index, reads each file, feeds it through this
 * module, and aggregates the previews into a `WorkspacePreview`.
 *
 * Safety model:
 *  - Preview is always free (read-only). Apply requires admin role.
 *  - Either literal or regex mode; regex compiled with /g + optional /i.
 *  - Per-file match cap (200) and per-workspace match cap (5000).
 *  - Whole-word and case-sensitive flags exposed independently.
 *  - Replacement supports $1..$9 capture group expansion in regex mode
 *    (JavaScript String.replace semantics).
 */

export interface FindReplaceOptions {
  /** Search pattern — literal string or regex body (no slashes) */
  find: string;
  /** Replacement string — supports $1..$9 in regex mode */
  replace: string;
  /** Treat `find` as a regular expression */
  regex?: boolean;
  /** Case-sensitive match (default false) */
  caseSensitive?: boolean;
  /** Match only on whole word boundaries (default false) */
  wholeWord?: boolean;
  /** Max matches per file (default 200) */
  perFileLimit?: number;
}

export interface MatchEntry {
  /** 1-indexed line number where the match appears */
  line: number;
  /** Character offset inside the line */
  column: number;
  /** The exact matched text */
  match: string;
  /** The line as it appears before the replacement */
  before: string;
  /** The line as it would appear after the replacement */
  after: string;
}

export interface FilePreview {
  path: string;
  matches: MatchEntry[];
  /** Whether the file hit the per-file limit */
  truncated: boolean;
  /** The full proposed new content (for apply) */
  newContent: string;
  /** Bytes added/removed */
  delta: { removed: number; added: number };
}

// ─── Pattern compilation ──────────────────────────────────────────────

/**
 * Build a RegExp from the find options. Throws RangeError on bad regex
 * (caller should catch and turn into a BAD_ARGS result).
 */
export function compilePattern(opts: FindReplaceOptions): RegExp {
  let body = opts.find;
  if (!body) {
    throw new RangeError("find pattern is empty");
  }
  if (!opts.regex) {
    body = escapeRegExp(body);
  }
  if (opts.wholeWord) {
    // Use \b boundaries; when the pattern starts or ends with a
    // non-word char, \b becomes a no-op which is still safe.
    body = `\\b(?:${body})\\b`;
  }
  const flags = `g${opts.caseSensitive ? "" : "i"}`;
  return new RegExp(body, flags);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Per-file preview ─────────────────────────────────────────────────

const DEFAULT_PER_FILE_LIMIT = 200;

/**
 * Run find/replace against a single file's content. Returns the matches
 * with diffed before/after lines and the full proposed new content.
 * If the file has no matches, returns null so the caller can skip it
 * without allocating an empty FilePreview.
 */
export function previewFile(
  path: string,
  content: string,
  opts: FindReplaceOptions,
): FilePreview | null {
  const pattern = compilePattern(opts);
  const perFileLimit = Math.max(1, opts.perFileLimit ?? DEFAULT_PER_FILE_LIMIT);

  // Split into lines but remember the newline style so we can reassemble.
  // We support both \n and \r\n; mixed files are rare so we detect the
  // first occurrence and use that. Fallback to \n.
  const crlf = content.includes("\r\n");
  const lineSep = crlf ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);

  const matches: MatchEntry[] = [];
  const newLines: string[] = [];
  let totalMatches = 0;
  let truncated = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    pattern.lastIndex = 0;
    // Collect all matches on this line first so we can cap
    const lineMatches: Array<{ column: number; match: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(line)) !== null) {
      lineMatches.push({ column: m.index, match: m[0] });
      // Guard against zero-width matches that would infinite-loop
      if (m[0] === "") {
        pattern.lastIndex++;
      }
    }

    if (lineMatches.length === 0) {
      newLines.push(line);
      continue;
    }

    // Build the replaced line via String.replace (this handles $1..$9
    // capture group expansion correctly for regex mode)
    pattern.lastIndex = 0;
    const newLine = line.replace(pattern, opts.replace);
    newLines.push(newLine);

    for (const lm of lineMatches) {
      if (totalMatches >= perFileLimit) {
        truncated = true;
        break;
      }
      matches.push({
        line: i + 1,
        column: lm.column,
        match: lm.match,
        before: line,
        after: newLine,
      });
      totalMatches++;
    }
    if (totalMatches >= perFileLimit) {
      // If there is any remaining content to scan, flag truncated.
      // The remaining lines are still copied verbatim to newContent
      // below so the proposed file stays consistent.
      if (i < lines.length - 1) {
        truncated = true;
        // Copy the rest of the lines unchanged and exit
        for (let j = i + 1; j < lines.length; j++) newLines.push(lines[j]!);
      }
      break;
    }
  }

  if (matches.length === 0) return null;

  const newContent = newLines.join(lineSep);
  const delta = {
    removed: Math.max(0, content.length - newContent.length),
    added: Math.max(0, newContent.length - content.length),
  };

  return { path, matches, truncated, newContent, delta };
}

// ─── Workspace aggregation ────────────────────────────────────────────

export interface WorkspacePreview {
  options: FindReplaceOptions;
  files: FilePreview[];
  totals: {
    filesMatched: number;
    filesScanned: number;
    totalMatches: number;
    workspaceTruncated: boolean;
    filesTruncated: number;
  };
}

export const DEFAULT_WORKSPACE_LIMIT = 5000;
export const DEFAULT_MAX_FILES = 500;

/**
 * Aggregate per-file previews into a workspace preview. This is pure —
 * the caller provides an iterable of already-previewed files (from
 * `previewFile`).
 */
export function aggregateWorkspacePreview(
  options: FindReplaceOptions,
  previews: Array<FilePreview | null>,
  filesScanned: number,
  workspaceLimit: number = DEFAULT_WORKSPACE_LIMIT,
): WorkspacePreview {
  const files: FilePreview[] = [];
  let totalMatches = 0;
  let workspaceTruncated = false;
  let filesTruncated = 0;

  for (const p of previews) {
    if (!p) continue;
    if (totalMatches + p.matches.length > workspaceLimit) {
      // Take only as many matches as remain in the workspace budget
      const budget = workspaceLimit - totalMatches;
      if (budget <= 0) {
        workspaceTruncated = true;
        break;
      }
      files.push({
        ...p,
        matches: p.matches.slice(0, budget),
        truncated: true,
      });
      totalMatches += budget;
      workspaceTruncated = true;
      break;
    }
    files.push(p);
    totalMatches += p.matches.length;
    if (p.truncated) filesTruncated++;
  }

  return {
    options,
    files,
    totals: {
      filesMatched: files.length,
      filesScanned,
      totalMatches,
      workspaceTruncated,
      filesTruncated,
    },
  };
}

// ─── Apply plan ───────────────────────────────────────────────────────

export interface ApplyRequest {
  /** Explicit paths the user checked in the preview UI */
  acceptPaths: string[];
  preview: WorkspacePreview;
}

export interface ApplyPlan {
  /** { path → new file content } pairs ready to write */
  writes: Array<{ path: string; content: string }>;
  /** Paths that were in acceptPaths but not in the preview */
  skippedUnknown: string[];
}

/**
 * Build an apply plan from a preview + user-selected paths. Returns a
 * list of writes the caller can funnel into `write_file` calls. This
 * is pure so the caller (tRPC mutation) can validate + log the plan
 * before any filesystem side effects.
 */
export function buildApplyPlan(req: ApplyRequest): ApplyPlan {
  const acceptSet = new Set(req.acceptPaths);
  const byPath = new Map<string, FilePreview>();
  for (const f of req.preview.files) {
    byPath.set(f.path, f);
  }

  const writes: Array<{ path: string; content: string }> = [];
  const skippedUnknown: string[] = [];
  for (const path of req.acceptPaths) {
    const f = byPath.get(path);
    if (!f) {
      skippedUnknown.push(path);
      continue;
    }
    writes.push({ path: f.path, content: f.newContent });
  }
  // Ensure deterministic order regardless of caller input
  writes.sort((a, b) => a.path.localeCompare(b.path));
  return { writes, skippedUnknown };
}
