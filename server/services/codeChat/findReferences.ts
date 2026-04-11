/**
 * Workspace-wide symbol reference finder — Pass 252.
 *
 * Given a symbol name, walk every source file in the workspace and
 * return every line that mentions it as a whole-word identifier.
 * Complements the Pass 242 symbol index (which finds *definitions*)
 * by surfacing *usage sites* — the "Find All References" of IDE
 * land.
 *
 * The matcher is pure regex against the text (no AST) so it's fast
 * and language-agnostic, with a couple of simple filters to reduce
 * false positives:
 *
 *   1. Whole-word boundaries (`\b`) so "foo" doesn't match "foobar".
 *   2. A kind classifier that distinguishes `import`, `definition`,
 *      `call`, `property`, and `reference` for the UI to badge.
 *   3. An optional `includeComments` flag that strips `// ...` and
 *      `/* ... *\u002f` comments before scanning when disabled
 *      (default: true, let the user see everything).
 *
 * Pure — no file system calls. The walker lives in findReferencesCache.ts
 * which reuses the symbolIndex 256KB-per-file + extension allowlist.
 */

export type ReferenceKind =
  | "import"
  | "definition"
  | "call"
  | "property"
  | "reference";

export interface ReferenceHit {
  path: string;
  line: number;
  column: number;
  text: string;
  kind: ReferenceKind;
}

export interface ReferenceResult {
  query: string;
  hits: ReferenceHit[];
  filesScanned: number;
  truncated: boolean;
}

/** Regex-escape a symbol name for safe inclusion in a pattern. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip // line comments and /* block *\u002f comments from a source
 * string. Preserves newlines so line numbers stay accurate.
 *
 * Note: this is a naive string scan, not a full tokenizer. It doesn't
 * handle comments inside string literals — but for Find References
 * purposes "the word appears inside a string" is a valid-enough hit
 * to show the user, so this is the desired behavior.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      // Line comment — skip to end of line, preserve the newline
      while (i < source.length && source[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      // Block comment — skip until closing */ but keep newlines so
      // line numbers stay correct
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Classify a single match by looking at the surrounding characters
 * on the line. The classifier is heuristic — it trades perfect
 * accuracy for speed.
 */
export function classifyReference(line: string, matchStart: number, name: string): ReferenceKind {
  const before = line.slice(0, matchStart);
  const afterStart = matchStart + name.length;
  const after = line.slice(afterStart);

  // Preceded by a dot → property access: `foo.bar`
  if (/\.\s*$/.test(before)) return "property";

  // Import statements: `import ... from`, `import { foo }`
  if (/\bimport\b/.test(before) || /^\s*import\b/.test(line)) return "import";
  // Require: `require("foo")` — rare but handled
  if (/\brequire\s*\(\s*["'][^"']*$/.test(before)) return "import";

  // Definition if the keyword precedes: `function foo`, `class foo`,
  // `interface foo`, `type foo`, `const foo`, `let foo`, `var foo`,
  // `enum foo`
  if (/\b(function|class|interface|type|const|let|var|enum)\s+$/.test(before)) {
    return "definition";
  }

  // Followed by `(` → call site (with or without whitespace / generic)
  if (/^\s*[<(]/.test(after)) return "call";

  return "reference";
}

/**
 * Scan a single file for references to `name`. `content` is the raw
 * UTF-8 source. Returns hits in order of appearance.
 */
export function findInFile(
  path: string,
  content: string,
  name: string,
  opts: { includeComments?: boolean } = {},
): ReferenceHit[] {
  if (!name || name.length < 2) return [];
  const source = opts.includeComments === false ? stripComments(content) : content;
  const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`, "g");
  const hits: ReferenceHit[] = [];
  const lines = source.split(/\r?\n/);
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(line)) !== null) {
      const kind = classifyReference(line, m.index, name);
      hits.push({
        path,
        line: lineIdx + 1,
        column: m.index + 1,
        text: line.length > 240 ? line.slice(0, 240) + "…" : line,
        kind,
      });
    }
  }
  return hits;
}

/** Group hits by file, preserving line order. */
export function groupReferences(
  hits: ReferenceHit[],
): Array<{ path: string; hits: ReferenceHit[] }> {
  const map = new Map<string, ReferenceHit[]>();
  for (const h of hits) {
    const list = map.get(h.path);
    if (list) list.push(h);
    else map.set(h.path, [h]);
  }
  return Array.from(map.entries())
    .map(([path, list]) => ({ path, hits: list }))
    .sort((a, b) => b.hits.length - a.hits.length || a.path.localeCompare(b.path));
}

/**
 * Derive per-kind counts for the UI summary strip.
 */
export interface ReferenceSummary {
  total: number;
  fileCount: number;
  byKind: Record<ReferenceKind, number>;
}

export function summarizeReferences(hits: ReferenceHit[]): ReferenceSummary {
  const byKind: Record<ReferenceKind, number> = {
    import: 0,
    definition: 0,
    call: 0,
    property: 0,
    reference: 0,
  };
  const files = new Set<string>();
  for (const h of hits) {
    byKind[h.kind]++;
    files.add(h.path);
  }
  return { total: hits.length, fileCount: files.size, byKind };
}

/**
 * Filter hits by kind (or "all") and by a path prefix. Used by the
 * DiagnosticsPanel filter UI.
 */
export function filterReferences(
  hits: ReferenceHit[],
  opts: {
    kinds?: ReferenceKind[] | "all";
    pathPrefix?: string;
  } = {},
): ReferenceHit[] {
  let out = hits;
  if (opts.kinds && opts.kinds !== "all") {
    const set = new Set(opts.kinds);
    out = out.filter((h) => set.has(h.kind));
  }
  if (opts.pathPrefix && opts.pathPrefix.length > 0) {
    out = out.filter((h) => h.path.startsWith(opts.pathPrefix!));
  }
  return out;
}
