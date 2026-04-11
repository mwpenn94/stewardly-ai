/**
 * Prompt template library (Pass 214).
 *
 * Saved prompt macros the user can insert into the Code Chat input
 * with a single click. Stored in localStorage alongside sessions.
 *
 * Ships with a set of built-in templates (review, refactor, explain,
 * test, debug) so new users have useful entry points immediately.
 * User-created templates live alongside built-ins; built-ins are
 * read-only (can't be deleted or renamed — only cloned).
 *
 * This module is pure functions + a localStorage adapter so the
 * logic is unit-testable without mocking storage.
 */

export interface PromptTemplate {
  id: string;
  name: string;
  body: string;
  /** True for the shipped defaults; read-only in the UI */
  builtin?: boolean;
  createdAt?: number;
}

export const PROMPT_TEMPLATES_STORAGE_KEY = "stewardly-codechat-templates";
const MAX_TEMPLATES = 100;

export const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: "builtin-review",
    name: "Review recent changes",
    body: "Run `code_run_bash` with `git diff --stat HEAD~1` and then read the top 3 modified files. Give me a bullet-list review: what changed, what might be risky, what I'd want to test.",
    builtin: true,
  },
  {
    id: "builtin-refactor",
    name: "Refactor a file",
    body: "Read @{path/to/file.ts}, identify the 3 highest-ROI refactors (readability, duplication, testability), and show me the before/after diffs for each without applying them.",
    builtin: true,
  },
  {
    id: "builtin-explain",
    name: "Explain a module",
    body: "Read @{path/to/file.ts} and explain: (1) what it does in one sentence, (2) who calls it (use grep_search), (3) any non-obvious design decisions, (4) risks or TODOs.",
    builtin: true,
  },
  {
    id: "builtin-test",
    name: "Write tests",
    body: "Read @{path/to/file.ts} and draft vitest unit tests covering the main function, edge cases, and at least one failure mode. Show the test file as a code block — don't write it yet.",
    builtin: true,
  },
  {
    id: "builtin-debug",
    name: "Debug an error",
    body: "Here's the error I'm seeing:\n\n```\n<paste stack trace>\n```\n\nSearch the codebase for the relevant code paths, identify likely causes, and propose a minimal fix.",
    builtin: true,
  },
];

// ─── Pure helpers ────────────────────────────────────────────────────────

export function emptyTemplateLibrary(): PromptTemplate[] {
  return [...BUILTIN_TEMPLATES];
}

/**
 * Parse a JSON string containing a user-template array. Built-in
 * templates are always prepended so they never disappear from the
 * UI regardless of storage state. User templates are cleaned of
 * unexpected fields.
 */
export function parseTemplates(raw: string | null): PromptTemplate[] {
  const builtins = [...BUILTIN_TEMPLATES];
  if (!raw) return builtins;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return builtins;
    const userTemplates: PromptTemplate[] = [];
    for (const t of parsed) {
      if (!t || typeof t !== "object") continue;
      const tpl = t as Partial<PromptTemplate>;
      if (tpl.builtin) continue; // don't let storage override built-ins
      if (typeof tpl.id !== "string" || !tpl.id) continue;
      if (typeof tpl.name !== "string") continue;
      if (typeof tpl.body !== "string") continue;
      userTemplates.push({
        id: tpl.id,
        name: tpl.name,
        body: tpl.body,
        createdAt: typeof tpl.createdAt === "number" ? tpl.createdAt : Date.now(),
      });
    }
    return [...builtins, ...userTemplates];
  } catch {
    return builtins;
  }
}

/**
 * Serialize only user templates (built-ins are always re-hydrated).
 */
export function serializeTemplates(templates: PromptTemplate[]): string {
  const userOnly = templates.filter((t) => !t.builtin);
  return JSON.stringify(userOnly);
}

export function addTemplate(
  templates: PromptTemplate[],
  input: { name: string; body: string },
): PromptTemplate[] {
  const name = input.name.trim();
  const body = input.body.trim();
  if (!name || !body) return templates;
  const next: PromptTemplate = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.slice(0, 80),
    body,
    createdAt: Date.now(),
  };
  const out = [...templates, next];
  // Enforce cap; drop oldest USER entries first, never built-ins
  if (out.length > MAX_TEMPLATES) {
    const overflow = out.length - MAX_TEMPLATES;
    let removed = 0;
    for (let i = 0; i < out.length && removed < overflow; i++) {
      if (!out[i].builtin) {
        out.splice(i, 1);
        i--;
        removed++;
      }
    }
  }
  return out;
}

export function deleteTemplate(
  templates: PromptTemplate[],
  id: string,
): PromptTemplate[] {
  return templates.filter((t) => !(t.id === id && !t.builtin));
}

export function filterTemplates(
  templates: PromptTemplate[],
  query: string,
): PromptTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.body.toLowerCase().includes(q),
  );
}

// ─── Pass 218: template variables ────────────────────────────────────

/**
 * Extract unique `{{name}}` placeholders from a template body in the
 * order they first appear. Placeholder names are alphanumeric +
 * underscore; anything else is treated as plain text. Whitespace
 * inside the braces is stripped so `{{ file }}` and `{{file}}` match.
 */
export function extractTemplateVariables(body: string): string[] {
  const rx = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = rx.exec(body)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/**
 * Substitute `{{name}}` placeholders in `body` with the matching
 * values from the `values` map. Missing values are left as the
 * original `{{name}}` so the user sees what they forgot to fill in.
 * Whitespace inside the braces is tolerated.
 */
export function applyTemplateVariables(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,
    (full, name: string) => {
      const value = values[name];
      return typeof value === "string" ? value : full;
    },
  );
}

// ─── Import / export (Pass 231) ─────────────────────────────────────────

export type TemplateImportMode = "merge" | "replace";

export interface TemplateImportResult {
  ok: boolean;
  error?: string;
  imported: number;
  skipped: number;
  templates: PromptTemplate[];
}

/**
 * Serialize the user templates as a portable JSON payload.
 * Built-ins are omitted because they're re-hydrated on load from
 * BUILTIN_TEMPLATES and will vary between app versions.
 */
export function exportTemplates(templates: PromptTemplate[]): string {
  const userOnly = templates.filter((t) => !t.builtin);
  return JSON.stringify(
    { version: 1, templates: userOnly },
    null,
    2,
  );
}

/**
 * Parse an exported template JSON payload. Tolerates both the
 * `{version, templates}` wrapper and a raw `PromptTemplate[]` array
 * (which is what `serializeTemplates` produces for localStorage).
 * Returns a cleaned `PromptTemplate[]` with all `builtin: true`
 * overrides stripped out.
 */
export function parseTemplateExport(raw: string): PromptTemplate[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    let arr: unknown[];
    if (Array.isArray(parsed)) {
      arr = parsed;
    } else if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { templates?: unknown }).templates)
    ) {
      arr = (parsed as { templates: unknown[] }).templates;
    } else {
      return [];
    }
    const out: PromptTemplate[] = [];
    for (const t of arr) {
      if (!t || typeof t !== "object") continue;
      const tpl = t as Partial<PromptTemplate>;
      if (typeof tpl.name !== "string" || !tpl.name.trim()) continue;
      if (typeof tpl.body !== "string" || !tpl.body.trim()) continue;
      const id =
        typeof tpl.id === "string" && tpl.id ? tpl.id : `user-imported-${Math.random().toString(36).slice(2, 10)}`;
      out.push({
        id,
        name: tpl.name.slice(0, 80),
        body: tpl.body,
        createdAt:
          typeof tpl.createdAt === "number" ? tpl.createdAt : Date.now(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function importTemplates(
  existing: PromptTemplate[],
  raw: string,
  mode: TemplateImportMode = "merge",
): TemplateImportResult {
  const incoming = parseTemplateExport(raw);
  if (incoming.length === 0) {
    return {
      ok: false,
      error: "No valid templates found in import payload",
      imported: 0,
      skipped: 0,
      templates: existing,
    };
  }
  if (mode === "replace") {
    // Keep built-ins, replace user templates
    const builtins = existing.filter((t) => t.builtin);
    return {
      ok: true,
      imported: incoming.length,
      skipped: 0,
      templates: [...builtins, ...incoming],
    };
  }
  // Merge: dedupe by (name, body) pair so re-importing the same file
  // twice doesn't produce duplicates
  const existingKeys = new Set(
    existing.filter((t) => !t.builtin).map((t) => `${t.name}::${t.body}`),
  );
  const nextUserTemplates: PromptTemplate[] = existing.filter(
    (t) => !t.builtin,
  );
  let imported = 0;
  let skipped = 0;
  for (const tpl of incoming) {
    const key = `${tpl.name}::${tpl.body}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }
    existingKeys.add(key);
    nextUserTemplates.push(tpl);
    imported++;
  }
  const builtins = existing.filter((t) => t.builtin);
  return {
    ok: true,
    imported,
    skipped,
    templates: [...builtins, ...nextUserTemplates],
  };
}

// ─── localStorage adapter ────────────────────────────────────────────────

export function loadTemplates(): PromptTemplate[] {
  try {
    return parseTemplates(localStorage.getItem(PROMPT_TEMPLATES_STORAGE_KEY));
  } catch {
    return emptyTemplateLibrary();
  }
}

export function saveTemplates(templates: PromptTemplate[]): void {
  try {
    localStorage.setItem(
      PROMPT_TEMPLATES_STORAGE_KEY,
      serializeTemplates(templates),
    );
  } catch {
    /* quota — drop silently */
  }
}
