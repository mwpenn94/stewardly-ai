/**
 * Pure-function glob matcher for Code Chat `glob_files` tool (Build-loop Pass 1).
 *
 * Implements a small subset of shell glob syntax — enough to match
 * Claude Code's `Glob` tool behavior without pulling in a dependency:
 *
 *   *        — match any sequence of chars except `/`
 *   **       — match any sequence of chars including `/`
 *   ?        — match a single char except `/`
 *   [...]    — char class (POSIX classes `[:alnum:]` etc are NOT supported,
 *              but literal classes like `[abc]` and ranges `[a-z]` are)
 *   {a,b,c}  — brace alternation, one level deep (nested braces are treated
 *              as literals to keep the parser simple)
 *   !prefix  — negation (only at the start of a pattern)
 *
 * The matcher is compiled once per pattern into a RegExp, so evaluating
 * the pattern against thousands of files is cheap. Patterns are
 * case-sensitive by default; pass `caseInsensitive` to flip the `i` flag.
 *
 * The module is intentionally pure — it takes a string[] of file paths
 * (POSIX-style, workspace-relative) and returns a filtered string[].
 * The actual filesystem walk lives in fileIndex.ts (reused via the
 * existing cache).
 */

export interface GlobOptions {
  caseInsensitive?: boolean;
  /** If true, dot-prefixed path segments match `*` and `**`. */
  dot?: boolean;
}

/**
 * Escape a literal regex character so it can be embedded safely in a
 * compiled pattern.
 */
function escapeRegexChar(ch: string): string {
  return ch.replace(/[.+^$|()]/g, "\\$&");
}

/**
 * Expand a single-level brace alternation `foo/{a,b,c}.ts` into
 * `["foo/a.ts", "foo/b.ts", "foo/c.ts"]`. Nested braces are left
 * alone — the parser only peels the outermost pair for simplicity.
 * Unbalanced braces fall through as literal characters.
 */
export function expandBraces(pattern: string): string[] {
  const open = pattern.indexOf("{");
  if (open === -1) return [pattern];
  let depth = 0;
  let close = -1;
  for (let i = open; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return [pattern]; // unbalanced — treat as literal
  const prefix = pattern.slice(0, open);
  const suffix = pattern.slice(close + 1);
  const inner = pattern.slice(open + 1, close);
  // Split on top-level commas only (ignore commas inside nested braces)
  const parts: string[] = [];
  let buf = "";
  let innerDepth = 0;
  for (const ch of inner) {
    if (ch === "{") innerDepth++;
    else if (ch === "}") innerDepth--;
    if (ch === "," && innerDepth === 0) {
      parts.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  parts.push(buf);
  // Recurse into each expanded variant so nested braces work at one
  // level of depth.
  const expanded = parts.flatMap((p) => expandBraces(prefix + p + suffix));
  return expanded;
}

/**
 * Compile a single glob pattern (no brace alternation — call
 * expandBraces first if the caller wants brace support) into a RegExp
 * that matches against POSIX-style paths.
 */
export function compileGlobPattern(
  pattern: string,
  opts: GlobOptions = {},
): RegExp {
  let regex = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // `**` matches any number of directories (including zero).
        // Handle common wrappings: `/**/`, `**/`, `/**`, bare `**`.
        const before = pattern[i - 1];
        const after = pattern[i + 2];
        if (before === "/" && after === "/") {
          // `/**/` → zero or more path segments (or nothing)
          regex = regex.slice(0, -1); // drop the preceding `/`
          regex += "(?:/.*/|/)";
          i += 3; // consume `**/`
          continue;
        }
        if (after === "/") {
          // `**/` at the start of a segment → match zero or more
          // directories followed by whatever
          regex += "(?:.*/)?";
          i += 3; // consume `**/`
          continue;
        }
        if (before === "/") {
          // `/**` at the end — match anything under this dir
          regex = regex.slice(0, -1);
          regex += "(?:/.*)?";
          i += 2;
          continue;
        }
        // Bare `**` — equivalent to `.*`
        regex += ".*";
        i += 2;
        continue;
      }
      // Single `*` — any chars except `/`. If `dot` is off, a leading
      // `*` in a segment does NOT match a dot (so `*.ts` skips `.eslintrc`).
      const atSegmentStart = i === 0 || pattern[i - 1] === "/";
      if (atSegmentStart && !opts.dot) {
        regex += "(?!\\.)[^/]*";
      } else {
        regex += "[^/]*";
      }
      i++;
      continue;
    }
    if (ch === "?") {
      regex += "[^/]";
      i++;
      continue;
    }
    if (ch === "[") {
      // Character class — copy chars through until the closing `]`,
      // escaping backslashes but preserving range syntax. Treat `!`
      // immediately after `[` as the POSIX negation char.
      let j = i + 1;
      let cls = "[";
      if (pattern[j] === "!") {
        cls += "^";
        j++;
      }
      while (j < pattern.length && pattern[j] !== "]") {
        // Escape metacharacters except `-` inside the class
        if (/[\\^]/.test(pattern[j])) cls += "\\";
        cls += pattern[j];
        j++;
      }
      if (j === pattern.length) {
        // Unbalanced — treat as literal
        regex += escapeRegexChar("[");
        i++;
        continue;
      }
      cls += "]";
      regex += cls;
      i = j + 1;
      continue;
    }
    // Literal char — escape any regex metachars
    regex += escapeRegexChar(ch);
    i++;
  }
  regex += "$";
  return new RegExp(regex, opts.caseInsensitive ? "i" : "");
}

/**
 * Top-level glob matcher. Handles brace expansion + negation + multiple
 * include patterns.
 *
 * Rules:
 *   - Multiple patterns are OR'd together (any match includes the file).
 *   - Patterns starting with `!` are negations and are AND'd as a
 *     post-filter (any negation excluding the file wins).
 *   - Empty pattern array returns an empty result.
 */
export function matchGlob(
  files: string[],
  patterns: string | string[],
  opts: GlobOptions = {},
): string[] {
  const patList = typeof patterns === "string" ? [patterns] : patterns;
  if (patList.length === 0) return [];

  const includes: RegExp[] = [];
  const excludes: RegExp[] = [];
  for (const raw of patList) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const isNeg = trimmed.startsWith("!");
    const body = isNeg ? trimmed.slice(1) : trimmed;
    for (const expanded of expandBraces(body)) {
      const rx = compileGlobPattern(expanded, opts);
      if (isNeg) excludes.push(rx);
      else includes.push(rx);
    }
  }
  // If the caller supplied only negations, include everything and
  // subtract — that matches GitIgnore semantics and is usually what
  // you want.
  const includeAll = includes.length === 0;
  const matched: string[] = [];
  for (const file of files) {
    const inc = includeAll || includes.some((r) => r.test(file));
    if (!inc) continue;
    const exc = excludes.some((r) => r.test(file));
    if (exc) continue;
    matched.push(file);
  }
  return matched;
}

/**
 * Rank glob matches so the most relevant files bubble to the top:
 *   - Shorter relative paths first (closer to the workspace root)
 *   - Then alphabetical
 *
 * This gives deterministic ordering without needing mtimes (which
 * would require extra fs calls for every match).
 */
export function rankGlobMatches(matches: string[]): string[] {
  return [...matches].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.localeCompare(b);
  });
}
