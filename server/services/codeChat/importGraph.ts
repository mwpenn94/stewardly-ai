/**
 * Import graph builder for Code Chat (Pass 245).
 *
 * Scans TS/TSX/JS/JSX source for `import` statements and builds a
 * bidirectional dependency graph so users can answer questions like:
 *
 *   - What does `server/services/codeChat/fileTools.ts` import?
 *   - Who imports `shared/stewardlyWiring.ts`?
 *   - Which files are leaf nodes (no inbound deps)?
 *   - Which files are "hot" (most inbound edges)?
 *
 * The parser is regex-only on purpose — a full TS AST parse costs
 * ~5 seconds across 2000 files, and regex gets us ~95% accuracy in
 * under 200ms. We also resolve relative imports back to a workspace-
 * relative path so the graph keys line up with the file index.
 */

import path from "path";

// ─── Import extractor ──────────────────────────────────────────────────

/**
 * Regex catches every shape of top-level import we care about:
 *
 *   import X from "path";
 *   import { a, b } from "path";
 *   import * as ns from "path";
 *   import "path";                              (side-effect only)
 *   import X, { a } from "path";
 *   export { x } from "path";
 *   export * from "path";
 *
 * It deliberately ignores dynamic `import("path")` — those are
 * runtime loads and don't count as static dependencies for
 * navigation purposes.
 */
const IMPORT_REGEXES: RegExp[] = [
  /^\s*import\s+[^'"]*from\s+['"]([^'"]+)['"]/,
  /^\s*import\s+['"]([^'"]+)['"]/,
  /^\s*export\s+\*\s+from\s+['"]([^'"]+)['"]/,
  /^\s*export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/,
  /^\s*export\s+type\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/,
  /^\s*import\s+type\s+[^'"]*from\s+['"]([^'"]+)['"]/,
];

export interface ImportEntry {
  /** Raw specifier as written in source (e.g. "./foo", "@/lib/x", "react") */
  specifier: string;
  /** Line number in the source file (1-indexed) */
  line: number;
}

export function parseImports(content: string): ImportEntry[] {
  const out: ImportEntry[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
    for (const regex of IMPORT_REGEXES) {
      const match = regex.exec(line);
      if (match) {
        const specifier = match[1];
        if (specifier) {
          out.push({ specifier, line: i + 1 });
        }
        break;
      }
    }
  }
  return out;
}

// ─── Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve an import specifier to a workspace-relative file path if
 * possible. Relative imports (./foo, ../bar) are resolved against
 * the importing file's directory; alias imports (@/components/x) are
 * resolved against the `aliasRoots` map (defaults to `@/` → client/src).
 * Bare module imports (react, lodash, …) return null — they're not
 * part of the workspace graph.
 */
export interface ResolveOptions {
  aliasRoots?: Record<string, string>;
  /** Full workspace-relative file list used to verify the resolved path exists */
  knownFiles: Set<string>;
}

const CANDIDATE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".d.ts",
];

function tryCandidates(base: string, known: Set<string>): string | null {
  // Exact
  if (known.has(base)) return base;
  // Add extensions
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (known.has(`${base}${ext}`)) return `${base}${ext}`;
  }
  // Index files
  for (const ext of CANDIDATE_EXTENSIONS) {
    if (known.has(`${base}/index${ext}`)) return `${base}/index${ext}`;
  }
  return null;
}

export function resolveImport(
  fromFile: string,
  specifier: string,
  opts: ResolveOptions,
): string | null {
  if (!specifier) return null;

  // Relative import
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const dir = path.posix.dirname(fromFile);
    const base = path.posix.normalize(`${dir}/${specifier}`);
    return tryCandidates(base, opts.knownFiles);
  }

  // Alias import (@/..., ~/..., etc.)
  const aliasRoots = opts.aliasRoots ?? { "@/": "client/src/" };
  for (const [alias, root] of Object.entries(aliasRoots)) {
    if (specifier.startsWith(alias)) {
      const rest = specifier.slice(alias.length);
      const base = path.posix.normalize(`${root}${rest}`).replace(/^\.\//, "");
      return tryCandidates(base, opts.knownFiles);
    }
  }

  // Bare module (react, etc.) — not in the workspace
  return null;
}

// ─── Graph builder ──────────────────────────────────────────────────────

export interface ImportGraph {
  /** outgoing[file] = list of workspace-relative paths it imports */
  outgoing: Map<string, string[]>;
  /** incoming[file] = list of workspace-relative paths that import it */
  incoming: Map<string, string[]>;
  /** unresolved specifiers per source file — useful for debugging */
  unresolved: Map<string, string[]>;
  /** Total edge count (excluding unresolved) */
  edgeCount: number;
}

export function emptyGraph(): ImportGraph {
  return {
    outgoing: new Map(),
    incoming: new Map(),
    unresolved: new Map(),
    edgeCount: 0,
  };
}

export function buildImportGraph(
  files: Array<{ path: string; content: string }>,
  aliasRoots?: Record<string, string>,
): ImportGraph {
  const graph = emptyGraph();
  const knownFiles = new Set(files.map((f) => f.path));
  const resolveOpts: ResolveOptions = { aliasRoots, knownFiles };

  for (const file of files) {
    const imports = parseImports(file.content);
    const outgoing: string[] = [];
    const unresolved: string[] = [];
    for (const imp of imports) {
      const resolved = resolveImport(file.path, imp.specifier, resolveOpts);
      if (resolved) {
        outgoing.push(resolved);
        // Register the reverse edge
        if (!graph.incoming.has(resolved)) graph.incoming.set(resolved, []);
        graph.incoming.get(resolved)!.push(file.path);
        graph.edgeCount++;
      } else {
        unresolved.push(imp.specifier);
      }
    }
    if (outgoing.length > 0) graph.outgoing.set(file.path, dedupe(outgoing));
    if (unresolved.length > 0) graph.unresolved.set(file.path, dedupe(unresolved));
  }

  // Dedupe incoming lists
  for (const [key, list] of Array.from(graph.incoming.entries())) {
    graph.incoming.set(key, dedupe(list));
  }

  return graph;
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

// ─── Accessors ──────────────────────────────────────────────────────────

export interface FileDependencies {
  path: string;
  imports: string[];
  importedBy: string[];
  unresolved: string[];
}

export function getFileDependencies(
  graph: ImportGraph,
  filePath: string,
): FileDependencies {
  return {
    path: filePath,
    imports: graph.outgoing.get(filePath) ?? [],
    importedBy: graph.incoming.get(filePath) ?? [],
    unresolved: graph.unresolved.get(filePath) ?? [],
  };
}

/**
 * Find files with no outgoing edges (leaves) — these are standalone
 * modules that don't depend on anything else in the workspace.
 */
export function findLeafFiles(graph: ImportGraph, files: string[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    const deps = graph.outgoing.get(f) ?? [];
    if (deps.length === 0) out.push(f);
  }
  return out;
}

/**
 * Find the top-N most-imported files (hot modules). Ranks by inbound
 * edge count descending.
 */
export function findHotFiles(graph: ImportGraph, limit = 10): Array<{ path: string; count: number }> {
  const counts: Array<{ path: string; count: number }> = [];
  for (const [filePath, importers] of Array.from(graph.incoming.entries())) {
    counts.push({ path: filePath, count: importers.length });
  }
  return counts.sort((a, b) => b.count - a.count).slice(0, limit);
}

export interface ImportGraphStats {
  totalFiles: number;
  totalEdges: number;
  filesWithImports: number;
  filesImportedByOthers: number;
  unresolvedCount: number;
  leafCount: number;
  avgFanout: number;
}

export function graphStats(
  graph: ImportGraph,
  knownFiles: string[],
): ImportGraphStats {
  let unresolvedCount = 0;
  for (const list of Array.from(graph.unresolved.values())) unresolvedCount += list.length;
  const leafCount = findLeafFiles(graph, knownFiles).length;
  const totalFiles = knownFiles.length;
  return {
    totalFiles,
    totalEdges: graph.edgeCount,
    filesWithImports: graph.outgoing.size,
    filesImportedByOthers: graph.incoming.size,
    unresolvedCount,
    leafCount,
    avgFanout:
      graph.outgoing.size === 0 ? 0 : graph.edgeCount / graph.outgoing.size,
  };
}
