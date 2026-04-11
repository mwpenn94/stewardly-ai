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
