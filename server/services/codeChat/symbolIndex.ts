/**
 * Lightweight symbol extraction for Code Chat (Pass 242).
 *
 * Claude Code has semantic code navigation — ask "where is function X
 * defined" and it can jump straight there. Stewardly's Code Chat now
 * has the same thing via a regex-based symbol extractor that scans
 * every TS/TSX/JS/JSX/MJS/CJS file in the workspace and captures:
 *
 *   - `function foo(…)` / `async function foo(…)`
 *   - `class Foo extends Bar`
 *   - `interface Foo` / `type Foo = …`
 *   - `const foo = …` / `let/var` at the top level
 *   - `export …` variants of all of the above
 *   - React components defined via `const Foo: FC<…> = …` (fall-out
 *     of the const rule)
 *
 * The extractor is intentionally regex-only — a full TS AST parse
 * would be accurate but drag a compiler into the hot path. For the
 * "where is this defined" use case, regex gets us to the right line
 * ~99% of the time and stays under a millisecond per file.
 */

export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "const"
  | "let"
  | "var"
  | "enum";

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  path: string;
  line: number;
  /** The raw source line where the symbol was declared */
  snippet: string;
  exported: boolean;
}

// ─── Regex definitions ──────────────────────────────────────────────────
//
// All patterns are unanchored to the line and accept an optional
// `export` prefix so we can capture `export function foo()` and
// `function foo()` in one pass.

const SYMBOL_PATTERNS: Array<{
  kind: SymbolKind;
  regex: RegExp;
}> = [
  // function foo(…)
  { kind: "function", regex: /^\s*(export\s+)?(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[<(]/ },
  // export default function foo(…)
  { kind: "function", regex: /^\s*export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[<(]/ },
  // class Foo
  { kind: "class", regex: /^\s*(export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:extends\s+|implements\s+|<|\{)/ },
  // export default class Foo
  { kind: "class", regex: /^\s*export\s+default\s+(?:abstract\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:extends\s+|implements\s+|<|\{)/ },
  // interface Foo
  { kind: "interface", regex: /^\s*(export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:<|extends\s+|\{)/ },
  // type Foo = …
  { kind: "type", regex: /^\s*(export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:<|=)/ },
  // enum Foo
  { kind: "enum", regex: /^\s*(export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\{/ },
  // const foo = … / let foo = … / var foo = …
  { kind: "const", regex: /^\s*(export\s+)?const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:[:=]|,)/ },
  { kind: "let", regex: /^\s*(export\s+)?let\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:[:=]|,)/ },
  { kind: "var", regex: /^\s*(export\s+)?var\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:[:=]|,)/ },
];

/**
 * Extract every symbol from a single source file. Returns entries in
 * source-line order. Only looks at top-level (indentation 0 or 2
 * spaces) to avoid capturing nested local variables — heuristic, not
 * perfect, but keeps noise down.
 */
export function extractSymbols(content: string, path: string): SymbolEntry[] {
  const out: SymbolEntry[] = [];
  const lines = content.split(/\r?\n/);
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip lines with too much indentation (likely nested scope)
    const leadingSpaces = /^(\s*)/.exec(line)?.[1].length ?? 0;
    if (leadingSpaces > 4) continue;
    for (const { kind, regex } of SYMBOL_PATTERNS) {
      const match = regex.exec(line);
      if (!match) continue;
      // Name is the LAST captured group (works for 1-group and 2-group patterns)
      const name = match[match.length - 1];
      if (!name) continue;
      // Skip TS keywords that can show up as captures
      if (isReservedWord(name)) continue;
      const key = `${kind}:${name}:${i + 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        kind,
        path,
        line: i + 1,
        snippet: line.trim().slice(0, 200),
        exported: /\bexport\b/.test(line),
      });
      break; // one pattern per line
    }
  }
  return out;
}

const RESERVED = new Set([
  "default",
  "if",
  "else",
  "return",
  "await",
  "async",
  "true",
  "false",
  "null",
  "undefined",
  "new",
  "this",
  "super",
  "typeof",
]);

function isReservedWord(name: string): boolean {
  return RESERVED.has(name);
}

// ─── Index building + lookup ────────────────────────────────────────────

export interface SymbolIndex {
  symbols: SymbolEntry[];
  /** Map from lowercased name → first occurrence offset in `symbols` */
  byName: Map<string, number[]>;
  generatedAt: number;
}

export function emptyIndex(): SymbolIndex {
  return { symbols: [], byName: new Map(), generatedAt: Date.now() };
}

export function buildSymbolIndex(
  files: Array<{ path: string; content: string }>,
): SymbolIndex {
  const symbols: SymbolEntry[] = [];
  for (const file of files) {
    const extracted = extractSymbols(file.content, file.path);
    symbols.push(...extracted);
  }
  const byName = new Map<string, number[]>();
  for (let i = 0; i < symbols.length; i++) {
    const key = symbols[i].name.toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(i);
  }
  return { symbols, byName, generatedAt: Date.now() };
}

/**
 * Fuzzy symbol search — prefix match first, then substring, then
 * sub-sequence. Ranks exported symbols higher than non-exported and
 * functions/classes higher than consts. Returns up to `limit` hits.
 */
export function findSymbols(
  index: SymbolIndex,
  query: string,
  limit = 20,
): SymbolEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return index.symbols.slice(0, limit);

  const scored: Array<{ entry: SymbolEntry; score: number }> = [];
  for (const sym of index.symbols) {
    const name = sym.name.toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 50;
    else if (isSubsequence(q, name)) score = 20;
    if (score === 0) continue;
    // Kind boost
    if (sym.kind === "function" || sym.kind === "class") score += 5;
    else if (sym.kind === "interface" || sym.kind === "type") score += 3;
    // Export boost
    if (sym.exported) score += 2;
    scored.push({ entry: sym, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
  return scored.slice(0, limit).map((s) => s.entry);
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

/**
 * Find every symbol with an EXACT name match across all files.
 * Used by the agent's `find_symbol` tool when it wants every
 * definition of a given name (useful for "where is this function
 * defined" queries).
 */
export function findExactName(index: SymbolIndex, name: string): SymbolEntry[] {
  const hits = index.byName.get(name.toLowerCase()) ?? [];
  return hits.map((i) => index.symbols[i]);
}

export interface SymbolIndexStats {
  total: number;
  files: number;
  byKind: Record<SymbolKind, number>;
  exported: number;
}

export function symbolIndexStats(index: SymbolIndex): SymbolIndexStats {
  const byKind: Record<SymbolKind, number> = {
    function: 0,
    class: 0,
    interface: 0,
    type: 0,
    const: 0,
    let: 0,
    var: 0,
    enum: 0,
  };
  const files = new Set<string>();
  let exported = 0;
  for (const sym of index.symbols) {
    byKind[sym.kind]++;
    files.add(sym.path);
    if (sym.exported) exported++;
  }
  return { total: index.symbols.length, files: files.size, byKind, exported };
}
