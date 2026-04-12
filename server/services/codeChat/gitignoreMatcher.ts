/**
 * .gitignore parser + matcher — Pass 268.
 *
 * Implements a faithful subset of the gitignore spec:
 *   - Blank lines and `#` comments are skipped
 *   - Negation via `!`
 *   - Directory-only via trailing `/`
 *   - Absolute patterns (starting with `/`)
 *   - Wildcards: `*` (single segment), `**` (any segments), `?`
 *   - Character classes `[abc]`
 *   - Trailing `/**` to match everything under a directory
 *
 * Enough to answer "is this file gitignored?" for every Code Chat
 * file walker. Not a 100% replacement for `git check-ignore` — that
 * would require spawning git — but good enough to keep the file
 * index clean without noise.
 *
 * Pure module; no I/O.
 */

export interface GitignoreRule {
  /** Original pattern text */
  raw: string;
  /** Compiled regex that matches workspace-relative paths */
  regex: RegExp;
  /** Negation (`!`) rules un-ignore earlier matches */
  negate: boolean;
  /** True when the pattern ends with `/` so it matches only directories */
  directoryOnly: boolean;
  /** True when the pattern begins with `/` so it's workspace-rooted */
  anchored: boolean;
}

/**
 * Parse a single .gitignore file body into a list of compiled rules.
 * Preserves ordering so negation semantics work correctly.
 */
export function parseGitignore(raw: string): GitignoreRule[] {
  const out: GitignoreRule[] = [];
  if (!raw) return out;
  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    let pattern = trimmed;
    let negate = false;
    if (pattern.startsWith("!")) {
      negate = true;
      pattern = pattern.slice(1);
    }
    let directoryOnly = false;
    if (pattern.endsWith("/")) {
      directoryOnly = true;
      pattern = pattern.slice(0, -1);
    }
    let anchored = false;
    if (pattern.startsWith("/")) {
      anchored = true;
      pattern = pattern.slice(1);
    }
    if (!pattern) continue;

    const regex = compilePattern(pattern, anchored);
    out.push({ raw: trimmed, regex, negate, directoryOnly, anchored });
  }
  return out;
}

/**
 * Convert a gitignore glob pattern into a JavaScript regex.
 *
 * Rules:
 *   - `**` matches any number of path segments (including none)
 *   - `*` matches any characters except `/`
 *   - `?` matches a single character except `/`
 *   - `[abc]` matches one character from the class
 *   - Other special regex chars are escaped
 *
 * Non-anchored patterns match anywhere in the path (preceded by `/`
 * or start-of-string); anchored patterns are pinned to the start.
 */
export function compilePattern(pattern: string, anchored: boolean): RegExp {
  let src = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      // Consume one or two slashes around the `**`
      if (pattern[i + 2] === "/") {
        // `**/`: match zero or more directories
        src += "(?:.*/)?";
        i += 3;
      } else if (i > 0 && pattern[i - 1] === "/" && i + 2 === pattern.length) {
        // Trailing `/**`: match anything under
        src += ".*";
        i += 2;
      } else {
        src += ".*";
        i += 2;
      }
    } else if (ch === "*") {
      src += "[^/]*";
      i++;
    } else if (ch === "?") {
      src += "[^/]";
      i++;
    } else if (ch === "[") {
      // Character class — pass through, escape ]
      const end = pattern.indexOf("]", i);
      if (end === -1) {
        src += "\\[";
        i++;
      } else {
        src += pattern.slice(i, end + 1);
        i = end + 1;
      }
    } else {
      src += escapeRegexChar(ch);
      i++;
    }
  }

  if (anchored) {
    return new RegExp(`^${src}(?:/|$)`);
  }
  // Match either at start of path or after any `/`
  return new RegExp(`(?:^|/)${src}(?:/|$)`);
}

function escapeRegexChar(ch: string): string {
  if (/[.+^${}()|\\]/.test(ch)) return `\\${ch}`;
  return ch;
}

/**
 * Check if a path (workspace-relative, forward-slash separated) is
 * ignored by the rules. Directory-only rules (`.env/`) only apply
 * when the path represents a directory — callers pass `isDirectory`.
 *
 * Returns the final effective state: true = ignored, false = kept.
 */
export function isIgnored(
  rules: GitignoreRule[],
  relPath: string,
  isDirectory = false,
): boolean {
  if (!relPath) return false;
  let ignored = false;
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  for (const rule of rules) {
    if (rule.directoryOnly && !isDirectory) continue;
    if (rule.regex.test(normalized)) {
      ignored = !rule.negate;
    }
  }
  return ignored;
}

/**
 * Filter a list of relative paths through the rules, returning
 * only those that are NOT ignored.
 */
export function filterIgnored(
  rules: GitignoreRule[],
  paths: string[],
): string[] {
  return paths.filter((p) => !isIgnored(rules, p));
}

/**
 * Quick stats for the UI summary panel.
 */
export function summarizeRules(rules: GitignoreRule[]): {
  total: number;
  negated: number;
  directoryOnly: number;
  anchored: number;
} {
  return {
    total: rules.length,
    negated: rules.filter((r) => r.negate).length,
    directoryOnly: rules.filter((r) => r.directoryOnly).length,
    anchored: rules.filter((r) => r.anchored).length,
  };
}
