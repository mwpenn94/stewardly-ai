/**
 * TypeScript diagnostics — Pass 251.
 *
 * Pure parser for `tsc --noEmit --pretty false` output + a cached
 * runner that invokes the compiler against the workspace and returns
 * structured diagnostic rows.
 *
 * The parser handles the canonical `path(line,col): severity TSxxxx:
 * message` format plus the multi-line continuation that tsc emits
 * for complex error messages (e.g. a type mismatch with "Type 'X' is
 * not assignable..." followed by "Property 'y'..." on subsequent
 * lines).
 *
 * Output mode is fixed to --pretty false so we don't have to strip
 * ANSI escapes or deal with tsc's new formatted layout.
 */

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface TsDiagnostic {
  path: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  /** Additional lines that followed the primary message */
  details: string[];
}

export interface DiagnosticSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  fileCount: number;
  topFiles: Array<{ path: string; count: number }>;
}

// tsc header format: `path(line,col): severity TScode: message`
const DIAG_HEADER_REGEX =
  /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS(\d+):\s+(.*)$/;

/**
 * Parse raw tsc --noEmit --pretty false output into a structured
 * diagnostic list. Subsequent indented or bare lines after a header
 * are captured as `details` on the most recent diagnostic (tsc
 * sometimes emits multi-line type mismatches this way).
 *
 * Empty-line separators reset the details-collection window so a
 * new diagnostic header doesn't accidentally inherit orphan detail
 * lines from the previous one.
 */
export function parseTscOutput(raw: string): TsDiagnostic[] {
  if (!raw) return [];
  const out: TsDiagnostic[] = [];
  const lines = raw.split(/\r?\n/);
  let current: TsDiagnostic | null = null;

  for (const line of lines) {
    if (line.trim().length === 0) {
      current = null;
      continue;
    }
    const m = line.match(DIAG_HEADER_REGEX);
    if (m) {
      current = {
        path: m[1].trim(),
        line: Number(m[2]),
        column: Number(m[3]),
        severity: m[4] as DiagnosticSeverity,
        code: `TS${m[5]}`,
        message: m[6].trim(),
        details: [],
      };
      out.push(current);
    } else if (current) {
      // Continuation line — attach as detail on the current diagnostic
      const trimmed = line.replace(/^\s+/, "");
      if (trimmed) current.details.push(trimmed);
    }
  }
  return out;
}

export function summarizeDiagnostics(
  diagnostics: TsDiagnostic[],
): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let info = 0;
  const byFile = new Map<string, number>();
  for (const d of diagnostics) {
    if (d.severity === "error") errors++;
    else if (d.severity === "warning") warnings++;
    else info++;
    byFile.set(d.path, (byFile.get(d.path) ?? 0) + 1);
  }
  const topFiles = Array.from(byFile.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([path, count]) => ({ path, count }));
  return {
    total: diagnostics.length,
    errors,
    warnings,
    info,
    fileCount: byFile.size,
    topFiles,
  };
}

export function filterDiagnostics(
  diagnostics: TsDiagnostic[],
  opts: {
    severity?: DiagnosticSeverity | "all";
    pathPrefix?: string;
    search?: string;
  } = {},
): TsDiagnostic[] {
  let out = diagnostics;
  if (opts.severity && opts.severity !== "all") {
    out = out.filter((d) => d.severity === opts.severity);
  }
  if (opts.pathPrefix && opts.pathPrefix.length > 0) {
    const prefix = opts.pathPrefix;
    out = out.filter((d) => d.path.startsWith(prefix));
  }
  if (opts.search && opts.search.trim().length > 0) {
    const q = opts.search.toLowerCase();
    out = out.filter(
      (d) =>
        d.message.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.path.toLowerCase().includes(q) ||
        d.details.some((line) => line.toLowerCase().includes(q)),
    );
  }
  return out;
}

/**
 * Group diagnostics by file so the UI can render a per-file tree.
 * Returns entries sorted by error-then-warning-then-info count
 * descending, so the most-broken files bubble up.
 */
export function groupByFile(
  diagnostics: TsDiagnostic[],
): Array<{ path: string; diagnostics: TsDiagnostic[] }> {
  const map = new Map<string, TsDiagnostic[]>();
  for (const d of diagnostics) {
    const list = map.get(d.path);
    if (list) list.push(d);
    else map.set(d.path, [d]);
  }
  return Array.from(map.entries())
    .map(([path, list]) => ({
      path,
      diagnostics: list.sort((a, b) => a.line - b.line || a.column - b.column),
    }))
    .sort((a, b) => {
      const errsA = a.diagnostics.filter((d) => d.severity === "error").length;
      const errsB = b.diagnostics.filter((d) => d.severity === "error").length;
      if (errsA !== errsB) return errsB - errsA;
      return b.diagnostics.length - a.diagnostics.length;
    });
}
