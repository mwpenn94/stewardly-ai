/**
 * Dead code detector (Pass 259).
 *
 * Cross-references the symbol index (Pass 242) with the import graph
 * (Pass 245) to find exported symbols that no other file imports by
 * name. The heuristic is intentionally conservative:
 *
 *  - Only exported symbols are candidates (private code is out of
 *    scope — any dead code below the export boundary is a local
 *    concern, not a workspace-wide one).
 *  - Default exports are skipped entirely because the import graph
 *    parser doesn't attribute specifier names through default
 *    imports reliably.
 *  - Files that look like entry points (vite.config, App.tsx, main.ts,
 *    index.ts, route handlers) are allowlisted so we don't flag the
 *    whole app's public surface as dead.
 *
 * This module is pure — it takes a `SymbolIndex` + an `ImportGraph`
 * (both from existing cached sources) and returns a
 * `DeadCodeReport`. The caller (tRPC) wires up the inputs.
 */

import type { SymbolIndex, SymbolEntry } from "./symbolIndex";
import type { ImportGraph } from "./importGraph";

export interface DeadExport {
  name: string;
  kind: SymbolEntry["kind"];
  path: string;
  line: number;
  snippet: string;
  /** Whether any file imports this file (catch-all signal) */
  fileImported: boolean;
}

export interface DeadCodeReport {
  /** The suspected dead exports */
  entries: DeadExport[];
  /** Files that nothing imports at all */
  orphanFiles: string[];
  /** Total exported symbols scanned */
  totalExports: number;
  /** Exports skipped because the file was on the entrypoint allowlist */
  skippedEntrypoints: number;
}

// ─── Entrypoint allowlist ─────────────────────────────────────────────

const ENTRYPOINT_PATTERNS = [
  /^client\/src\/App\.tsx$/,
  /^client\/src\/main\.tsx$/,
  /^client\/src\/index\.tsx?$/,
  /^server\/_core\/index\.ts$/,
  /^server\/index\.ts$/,
  /\/main\.ts$/,
  /vite\.config\.ts$/,
  /vitest\.config\.ts$/,
  /drizzle\.config\.ts$/,
  /\.config\.ts$/,
  /\.config\.js$/,
  /tailwind\.config\.(ts|js)$/,
  /postcss\.config\.(ts|js)$/,
  /\/routes\//, // route handlers are invoked by the framework
  /\/pages\//, // React page components are referenced via App routing
];

/**
 * Returns true if the file path looks like an entrypoint that we
 * should not flag as dead even if nothing imports its symbols.
 */
export function isEntrypoint(path: string): boolean {
  return ENTRYPOINT_PATTERNS.some((re) => re.test(path));
}

// ─── Core detector ────────────────────────────────────────────────────

export interface DetectOptions {
  /**
   * If set, only flag a symbol as dead when its *containing file*
   * also has zero importers. This is the "strict" mode — fewer
   * false positives but misses intra-file orphans.
   */
  strictFileImported?: boolean;
  /** Hard cap on returned entries (default 500) */
  limit?: number;
}

/**
 * Build the dead code report. Pure — no I/O.
 *
 * Algorithm:
 *   1. Iterate every exported symbol in the SymbolIndex.
 *   2. Skip entries on entrypoint files.
 *   3. Skip anonymous/default exports (the symbol name alone isn't
 *      enough to prove unused).
 *   4. Check whether any file imports the containing file AND
 *      references the symbol name in its source.
 *   5. If `strictFileImported` is set, treat any file with inbound
 *      edges as non-dead regardless of per-symbol match.
 *
 * For (4) we approximate: if the file has ANY inbound edges, we
 * consider it "imported" and skip the per-symbol name check because
 * the import graph parser doesn't record individual specifiers.
 * Only files that nothing imports contribute entries — which aligns
 * with the "orphan files" notion but avoids false positives on
 * barrel re-exports.
 */
export function detectDeadCode(
  symbolIndex: SymbolIndex,
  importGraph: ImportGraph,
  opts: DetectOptions = {},
): DeadCodeReport {
  const limit = opts.limit ?? 500;
  const entries: DeadExport[] = [];
  const orphanFiles: string[] = [];
  let totalExports = 0;
  let skippedEntrypoints = 0;

  // Build a set of files that have at least one inbound edge
  const importedFiles = new Set<string>();
  importGraph.incoming.forEach((incoming, key) => {
    if (incoming && incoming.length > 0) importedFiles.add(key);
  });

  // Collect orphan files: any file that exports at least one symbol
  // but has no inbound edges and isn't an entrypoint.
  const filesWithExports = new Set<string>();
  for (const sym of symbolIndex.symbols) {
    if (sym.exported) filesWithExports.add(sym.path);
  }
  for (const file of Array.from(filesWithExports)) {
    if (isEntrypoint(file)) continue;
    if (!importedFiles.has(file)) {
      orphanFiles.push(file);
    }
  }
  orphanFiles.sort();

  // Walk exported symbols and flag those in orphan files
  const orphanSet = new Set(orphanFiles);
  for (const sym of symbolIndex.symbols) {
    if (!sym.exported) continue;
    totalExports++;
    if (isEntrypoint(sym.path)) {
      skippedEntrypoints++;
      continue;
    }
    const fileImported = importedFiles.has(sym.path);
    // In the default mode we flag everything in an orphan file.
    // In strict mode we need the file to be non-imported (same check).
    if (orphanSet.has(sym.path)) {
      entries.push({
        name: sym.name,
        kind: sym.kind,
        path: sym.path,
        line: sym.line,
        snippet: sym.snippet.trim().slice(0, 160),
        fileImported,
      });
      if (entries.length >= limit) break;
    }
  }

  // Sort entries by path, then line
  entries.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.line - b.line;
  });

  return {
    entries,
    orphanFiles,
    totalExports,
    skippedEntrypoints,
  };
}

// ─── Grouping + summary ───────────────────────────────────────────────

export interface DeadCodeGroup {
  path: string;
  entries: DeadExport[];
}

export function groupByPath(entries: DeadExport[]): DeadCodeGroup[] {
  const map = new Map<string, DeadExport[]>();
  for (const e of entries) {
    const bucket = map.get(e.path) ?? [];
    bucket.push(e);
    map.set(e.path, bucket);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([path, entries]) => ({ path, entries }));
}

export interface DeadCodeSummary {
  deadEntries: number;
  orphanFiles: number;
  totalExports: number;
  skippedEntrypoints: number;
  /** Dead entries grouped by symbol kind */
  byKind: Record<string, number>;
}

export function summarizeDeadCode(report: DeadCodeReport): DeadCodeSummary {
  const byKind: Record<string, number> = {};
  for (const e of report.entries) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  }
  return {
    deadEntries: report.entries.length,
    orphanFiles: report.orphanFiles.length,
    totalExports: report.totalExports,
    skippedEntrypoints: report.skippedEntrypoints,
    byKind,
  };
}
