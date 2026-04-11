/**
 * Workspace diagnostics (Pass 252).
 *
 * Claude Code has a "problems" panel that shows TypeScript compile
 * errors + lint warnings inline with clickable jump-to-line navigation.
 * Stewardly's Code Chat had no way to see compilation state without
 * leaving the UI for a terminal.
 *
 * This module is the pure parser side. It takes the raw output of
 * `tsc --noEmit` (or an eslint JSON stream) and converts it into a
 * structured `Diagnostic[]` array the UI can render.
 *
 * TypeScript compiler output format:
 *
 *   path/to/file.ts(123,45): error TS2345: Message text.
 *   path/to/file.ts(7,1): warning TS2551: Maybe this.
 *
 * Multi-line errors (with related info beneath) are treated as one
 * primary diagnostic with the secondary lines dropped — we keep the
 * parser simple and the UI clean.
 */

export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticSource = "tsc" | "eslint" | "manual";

export interface Diagnostic {
  source: DiagnosticSource;
  severity: DiagnosticSeverity;
  path: string;
  line: number;
  column: number;
  /** Compiler/lint rule code (e.g. TS2345 or @typescript-eslint/no-unused-vars) */
  code: string;
  message: string;
}

// ─── Parsers ───────────────────────────────────────────────────────────

// Matches `client/src/foo.ts(12,34): error TS2345: Message text.`
// Path capture is non-greedy so it handles parens inside messages safely.
const TSC_LINE_REGEX =
  /^(.+?)\((\d+),(\d+)\):\s*(error|warning|info)\s+(TS\d+):\s*(.+)$/;

/**
 * Parse raw TypeScript compiler output into a `Diagnostic[]`. Handles
 * both `tsc --noEmit` and `tsc --pretty false` output. Drops lines
 * that don't match (compiler banner, "Watching for file changes", etc).
 */
export function parseTscOutput(raw: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = TSC_LINE_REGEX.exec(line.trim());
    if (!m) continue;
    const [, rawPath, lineStr, colStr, sev, code, message] = m;
    const parsedLine = Number.parseInt(lineStr!, 10);
    const parsedCol = Number.parseInt(colStr!, 10);
    if (
      !rawPath ||
      !Number.isFinite(parsedLine) ||
      !Number.isFinite(parsedCol) ||
      !sev ||
      !code ||
      !message
    ) {
      continue;
    }
    out.push({
      source: "tsc",
      severity: sev as DiagnosticSeverity,
      path: normalizePath(rawPath),
      line: parsedLine,
      column: parsedCol,
      code: code,
      message: message.trim(),
    });
  }
  return out;
}

// ESLint --format json output is an array of `{filePath, messages[]}`
// so we walk each one and flatten to Diagnostic[]. The shape:
//
//   [
//     {
//       filePath: '/abs/path/to/file.ts',
//       messages: [
//         { ruleId, severity, message, line, column, ... }
//       ]
//     }
//   ]

export function parseEslintJson(raw: string, workspaceRoot?: string): Diagnostic[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: Diagnostic[] = [];
  for (const file of parsed) {
    if (!file || typeof file !== "object") continue;
    const f = file as Record<string, unknown>;
    const filePath = typeof f.filePath === "string" ? f.filePath : null;
    const messages = Array.isArray(f.messages) ? f.messages : [];
    if (!filePath || messages.length === 0) continue;
    const relPath = workspaceRoot && filePath.startsWith(workspaceRoot)
      ? filePath.slice(workspaceRoot.length).replace(/^[/\\]/, "")
      : filePath;
    for (const m of messages) {
      if (!m || typeof m !== "object") continue;
      const msg = m as Record<string, unknown>;
      const severity =
        msg.severity === 2 ? "error" : msg.severity === 1 ? "warning" : "info";
      const line = typeof msg.line === "number" ? msg.line : 1;
      const column = typeof msg.column === "number" ? msg.column : 1;
      const code = typeof msg.ruleId === "string" ? msg.ruleId : "eslint";
      const message = typeof msg.message === "string" ? msg.message : "";
      if (!message) continue;
      out.push({
        source: "eslint",
        severity: severity as DiagnosticSeverity,
        path: normalizePath(relPath),
        line,
        column,
        code,
        message,
      });
    }
  }
  return out;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

// ─── Grouping + stats ──────────────────────────────────────────────────

export interface DiagnosticGroup {
  path: string;
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
}

export function groupByFile(diagnostics: Diagnostic[]): DiagnosticGroup[] {
  const map = new Map<string, DiagnosticGroup>();
  for (const d of diagnostics) {
    let bucket = map.get(d.path);
    if (!bucket) {
      bucket = {
        path: d.path,
        diagnostics: [],
        errorCount: 0,
        warningCount: 0,
      };
      map.set(d.path, bucket);
    }
    bucket.diagnostics.push(d);
    if (d.severity === "error") bucket.errorCount++;
    else if (d.severity === "warning") bucket.warningCount++;
  }
  const groups = Array.from(map.values());
  // Sort buckets: errors first (more errors = higher), then alphabetic path
  groups.sort((a, b) => {
    if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
    if (b.warningCount !== a.warningCount) return b.warningCount - a.warningCount;
    return a.path.localeCompare(b.path);
  });
  // Sort each bucket's diagnostics by line, then column
  for (const g of groups) {
    g.diagnostics.sort((a, b) => {
      if (a.line !== b.line) return a.line - b.line;
      return a.column - b.column;
    });
  }
  return groups;
}

export interface DiagnosticSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  filesAffected: number;
  topRules: Array<{ code: string; count: number }>;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  const byFile = new Set<string>();
  const byRule = new Map<string, number>();
  for (const d of diagnostics) {
    byFile.add(d.path);
    if (d.severity === "error") errors++;
    else if (d.severity === "warning") warnings++;
    else infos++;
    byRule.set(d.code, (byRule.get(d.code) ?? 0) + 1);
  }
  const topRules = Array.from(byRule.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => ({ code, count }));
  return {
    total: diagnostics.length,
    errors,
    warnings,
    infos,
    filesAffected: byFile.size,
    topRules,
  };
}

// ─── Filters ──────────────────────────────────────────────────────────

export interface DiagnosticFilter {
  severity?: DiagnosticSeverity[];
  source?: DiagnosticSource[];
  pathPrefix?: string;
  code?: string;
  search?: string;
}

export function filterDiagnostics(
  diagnostics: Diagnostic[],
  filter: DiagnosticFilter,
): Diagnostic[] {
  return diagnostics.filter((d) => {
    if (filter.severity && filter.severity.length > 0) {
      if (!filter.severity.includes(d.severity)) return false;
    }
    if (filter.source && filter.source.length > 0) {
      if (!filter.source.includes(d.source)) return false;
    }
    if (filter.pathPrefix && !d.path.startsWith(filter.pathPrefix)) {
      return false;
    }
    if (filter.code && d.code !== filter.code) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      if (
        !d.message.toLowerCase().includes(s) &&
        !d.code.toLowerCase().includes(s) &&
        !d.path.toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    return true;
  });
}
