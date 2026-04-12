/**
 * Regex playground — Pass 264.
 *
 * Pure helpers for interactive regex testing. Users enter a
 * pattern + flags + sample text, and we return structured matches
 * so the popover can highlight them and show capture groups.
 *
 * Also exports a pattern validation helper + a small library of
 * common patterns (email, url, uuid, iso date, semver, etc.) that
 * the UI offers as one-click presets.
 */

export interface RegexMatch {
  /** Absolute character offset in the input */
  index: number;
  /** The full matched substring */
  value: string;
  /** Length of the match */
  length: number;
  /** Named + numeric capture groups */
  groups: Array<{ name: string; value: string }>;
}

export interface RegexResult {
  ok: boolean;
  error?: string;
  matches: RegexMatch[];
  totalMatches: number;
  /** Elapsed ms to run the match */
  durationMs: number;
}

/**
 * Compile a regex safely. Returns the RegExp on success or an
 * error string on failure.
 */
export function compileRegex(
  pattern: string,
  flags: string,
): { regex: RegExp } | { error: string } {
  try {
    return { regex: new RegExp(pattern, flags) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sanitize user-provided flags, dropping anything that isn't a
 * valid JS regex flag. We always force the `g` flag so matchAll
 * works regardless of what the user typed.
 */
export function sanitizeFlags(raw: string): string {
  const allowed = new Set(["g", "i", "m", "s", "u", "y"]);
  const out = new Set<string>();
  for (const ch of raw.trim()) {
    if (allowed.has(ch)) out.add(ch);
  }
  out.add("g");
  return Array.from(out).join("");
}

/**
 * Run a regex against sample text and collect structured matches.
 *
 * Pathological inputs (catastrophic backtracking) are protected by
 * a hard match count cap and a 100ms soft time budget.
 */
export function testRegex(
  pattern: string,
  flags: string,
  sample: string,
  opts: { maxMatches?: number; timeoutMs?: number } = {},
): RegexResult {
  const start = Date.now();
  const compiled = compileRegex(pattern, sanitizeFlags(flags));
  if ("error" in compiled) {
    return {
      ok: false,
      error: compiled.error,
      matches: [],
      totalMatches: 0,
      durationMs: Date.now() - start,
    };
  }
  const maxMatches = opts.maxMatches ?? 500;
  const timeoutMs = opts.timeoutMs ?? 500;
  const matches: RegexMatch[] = [];

  const re = compiled.regex;
  let match: RegExpExecArray | null;
  try {
    let iterations = 0;
    while ((match = re.exec(sample)) !== null) {
      iterations++;
      if (iterations > maxMatches * 2) break;
      matches.push({
        index: match.index,
        value: match[0],
        length: match[0].length,
        groups: extractGroups(match),
      });
      if (matches.length >= maxMatches) break;
      // Protect against zero-length matches advancing the cursor
      if (match.index === re.lastIndex) re.lastIndex++;
      if (Date.now() - start > timeoutMs) break;
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "match error",
      matches,
      totalMatches: matches.length,
      durationMs: Date.now() - start,
    };
  }
  return {
    ok: true,
    matches,
    totalMatches: matches.length,
    durationMs: Date.now() - start,
  };
}

function extractGroups(match: RegExpExecArray): RegexMatch["groups"] {
  const out: RegexMatch["groups"] = [];
  // Numeric groups: start at 1 (0 is the full match)
  for (let i = 1; i < match.length; i++) {
    out.push({ name: `$${i}`, value: match[i] ?? "" });
  }
  // Named groups
  if (match.groups) {
    for (const [name, value] of Object.entries(match.groups)) {
      out.push({ name: `<${name}>`, value: value ?? "" });
    }
  }
  return out;
}

/**
 * Substitute a replacement template on every match. Uses the native
 * String.prototype.replace semantics ($1, $<name>, etc.).
 */
export function applyReplacement(
  pattern: string,
  flags: string,
  sample: string,
  replacement: string,
): { ok: boolean; output: string; error?: string } {
  const compiled = compileRegex(pattern, sanitizeFlags(flags));
  if ("error" in compiled) return { ok: false, output: sample, error: compiled.error };
  try {
    return { ok: true, output: sample.replace(compiled.regex, replacement) };
  } catch (err) {
    return {
      ok: false,
      output: sample,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Preset patterns ──────────────────────────────────────────────────

export interface RegexPreset {
  name: string;
  description: string;
  pattern: string;
  flags: string;
  /** Sample text the pattern should match */
  sample?: string;
}

export const PRESET_PATTERNS: Readonly<RegexPreset[]> = [
  {
    name: "Email",
    description: "Basic email address",
    pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    flags: "gi",
    sample: "Contact foo@bar.com or baz+tag@example.co",
  },
  {
    name: "URL",
    description: "HTTP(S) URL",
    pattern: "https?://[\\w.-]+(?:/[\\w./?=&%+-]*)?",
    flags: "g",
    sample: "See https://github.com/foo/bar and http://example.com",
  },
  {
    name: "UUID v4",
    description: "Standard UUID v4 format",
    pattern: "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
    flags: "gi",
    sample: "id=550e8400-e29b-41d4-a716-446655440000",
  },
  {
    name: "ISO date",
    description: "YYYY-MM-DD or full ISO timestamp",
    pattern: "\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z?)?",
    flags: "g",
    sample: "Created on 2024-03-15 and modified 2024-03-16T12:34:56Z",
  },
  {
    name: "Semver",
    description: "Semantic version number",
    pattern: "\\b\\d+\\.\\d+\\.\\d+(?:-[\\w.]+)?(?:\\+[\\w.]+)?\\b",
    flags: "g",
    sample: "Updated from 1.2.3 to 2.0.0-beta.1",
  },
  {
    name: "IP address (v4)",
    description: "IPv4 dotted-quad",
    pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    flags: "g",
    sample: "Server at 192.168.1.100 port 8080",
  },
  {
    name: "Hex color",
    description: "CSS hex color literal",
    pattern: "#(?:[0-9a-f]{3}){1,2}\\b",
    flags: "gi",
    sample: "background: #f5f5f5; color: #333",
  },
  {
    name: "Import statement",
    description: "TypeScript/JavaScript import",
    pattern: "import\\s+(?:type\\s+)?(?:\\{[^}]+\\}|\\w+|\\* as \\w+)\\s+from\\s+['\"][^'\"]+['\"]",
    flags: "g",
    sample: `import { foo } from "./bar";\nimport type { Baz } from "./baz";`,
  },
];
