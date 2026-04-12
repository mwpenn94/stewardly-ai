/**
 * Tool argument templates — Pass 270.
 *
 * Pre-canned tool-call specs for common operations so the agent can
 * invoke them cheaply and users can trigger them via the action
 * palette. Each template has a stable name, a target tool, and an
 * argument map. Templates can include placeholder variables like
 * `{{path}}` that the UI prompts for before dispatch.
 *
 * Pure store + localStorage. Distinct from Pass 214 prompt templates
 * (which are free-form prompts sent to the LLM) and Pass 254 code
 * snippets (which are code bodies). Tool argument templates are
 * pre-filled invocations of code_read_file / code_grep_search /
 * code_run_bash / etc.
 */

export type ToolTemplateTarget =
  | "read_file"
  | "list_directory"
  | "grep_search"
  | "run_bash"
  | "write_file"
  | "edit_file"
  | "find_symbol";

export interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  tool: ToolTemplateTarget;
  /** Argument template with {{placeholder}} variables */
  args: Record<string, string>;
  /** Variables declared in the template (auto-extracted from args) */
  variables: string[];
  /** Built-in templates ship read-only */
  builtin?: boolean;
}

export const MAX_TOOL_TEMPLATES = 100;
const STORAGE_KEY = "stewardly-codechat-tool-templates";

// ─── Built-in starter set ────────────────────────────────────────────

export const BUILT_IN_TOOL_TEMPLATES: Readonly<ToolTemplate[]> = [
  {
    id: "builtin-ts-lint",
    name: "Run TypeScript check",
    description: "Run tsc --noEmit across the workspace",
    tool: "run_bash",
    args: { command: "npx tsc --noEmit --pretty false" },
    variables: [],
    builtin: true,
  },
  {
    id: "builtin-find-todo",
    name: "Find all TODO/FIXME markers",
    description: "Grep for TODO / FIXME / XXX across src",
    tool: "grep_search",
    args: { pattern: "TODO|FIXME|XXX", path: "." },
    variables: [],
    builtin: true,
  },
  {
    id: "builtin-read-readme",
    name: "Read the project README",
    description: "Read README.md at the workspace root",
    tool: "read_file",
    args: { path: "README.md" },
    variables: [],
    builtin: true,
  },
  {
    id: "builtin-list-src",
    name: "List source directory",
    description: "List the files under src/",
    tool: "list_directory",
    args: { path: "src" },
    variables: [],
    builtin: true,
  },
  {
    id: "builtin-run-tests",
    name: "Run vitest suite",
    description: "Run the full vitest suite",
    tool: "run_bash",
    args: { command: "npx vitest run --reporter=default" },
    variables: [],
    builtin: true,
  },
  {
    id: "builtin-find-symbol",
    name: "Find symbol by name",
    description: "Locate a symbol's definition",
    tool: "find_symbol",
    args: { name: "{{symbol}}" },
    variables: ["symbol"],
    builtin: true,
  },
  {
    id: "builtin-read-file-var",
    name: "Read a specific file",
    description: "Read the file at {{path}}",
    tool: "read_file",
    args: { path: "{{path}}" },
    variables: ["path"],
    builtin: true,
  },
  {
    id: "builtin-grep-scope",
    name: "Grep in a directory",
    description: "Search for {{pattern}} inside {{directory}}",
    tool: "grep_search",
    args: { pattern: "{{pattern}}", path: "{{directory}}" },
    variables: ["pattern", "directory"],
    builtin: true,
  },
];

// ─── Variable extraction ─────────────────────────────────────────────

/**
 * Extract `{{name}}` variables from an argument map. Returns the
 * distinct names in the order they first appear across the values.
 */
export function extractVariables(args: Record<string, string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of Object.values(args)) {
    const matches = String(v).match(/\{\{\s*(\w+)\s*\}\}/g);
    if (!matches) continue;
    for (const match of matches) {
      const name = match.replace(/[{}]/g, "").trim();
      if (!seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

/**
 * Substitute `{{variable}}` placeholders with actual values. Unknown
 * variables are left in place. Pure, no side effects.
 */
export function applyVariables(
  args: Record<string, string>,
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, tmpl] of Object.entries(args)) {
    out[key] = String(tmpl).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
      const val = values[name];
      return typeof val === "string" ? val : `{{${name}}}`;
    });
  }
  return out;
}

// ─── Mutations ───────────────────────────────────────────────────────

function generateId(): string {
  return `tt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTemplate(
  partial: Omit<ToolTemplate, "id" | "variables" | "builtin"> & { id?: string },
): ToolTemplate {
  const args = { ...partial.args };
  const variables = extractVariables(args);
  return {
    id: partial.id ?? generateId(),
    name: partial.name.trim(),
    description: partial.description.trim(),
    tool: partial.tool,
    args,
    variables,
  };
}

export function addTemplate(
  list: ToolTemplate[],
  next: ToolTemplate,
): ToolTemplate[] {
  // Dedupe by name for user templates only
  const filtered = list.filter((t) => !(t.name === next.name && !t.builtin));
  const merged = [next, ...filtered];
  return merged.slice(0, MAX_TOOL_TEMPLATES);
}

export function removeTemplate(
  list: ToolTemplate[],
  id: string,
): ToolTemplate[] {
  return list.filter((t) => !(t.id === id && !t.builtin));
}

export function updateTemplate(
  list: ToolTemplate[],
  id: string,
  patch: Partial<Omit<ToolTemplate, "id" | "builtin">>,
): ToolTemplate[] {
  return list.map((t) => {
    if (t.id !== id || t.builtin) return t;
    const nextArgs = patch.args ?? t.args;
    return {
      ...t,
      ...patch,
      args: nextArgs,
      variables: extractVariables(nextArgs),
      name: patch.name?.trim() || t.name,
      description: patch.description?.trim() || t.description,
    };
  });
}

export function seedBuiltins(list: ToolTemplate[]): ToolTemplate[] {
  const seen = new Set(list.filter((t) => t.builtin).map((t) => t.name));
  const out = [...list];
  for (const b of BUILT_IN_TOOL_TEMPLATES) {
    if (!seen.has(b.name)) out.push({ ...b });
  }
  return out;
}

export function filterTemplates(
  list: ToolTemplate[],
  opts: { search?: string; tool?: ToolTemplateTarget | "all" } = {},
): ToolTemplate[] {
  let out = list;
  if (opts.tool && opts.tool !== "all") {
    out = out.filter((t) => t.tool === opts.tool);
  }
  const q = opts.search?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }
  return out;
}

// ─── Persistence ─────────────────────────────────────────────────────

const VALID_TOOLS: ToolTemplateTarget[] = [
  "read_file",
  "list_directory",
  "grep_search",
  "run_bash",
  "write_file",
  "edit_file",
  "find_symbol",
];

export function parseTemplates(raw: string | null): ToolTemplate[] {
  if (!raw) return seedBuiltins([]);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedBuiltins([]);
    const out: ToolTemplate[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const tt = e as Record<string, unknown>;
      if (typeof tt.id !== "string" || typeof tt.name !== "string") continue;
      if (typeof tt.description !== "string") continue;
      if (!VALID_TOOLS.includes(tt.tool as ToolTemplateTarget)) continue;
      if (!tt.args || typeof tt.args !== "object") continue;
      const args: Record<string, string> = {};
      for (const [k, v] of Object.entries(tt.args as Record<string, unknown>)) {
        if (typeof v === "string") args[k] = v;
      }
      out.push({
        id: tt.id,
        name: tt.name,
        description: tt.description,
        tool: tt.tool as ToolTemplateTarget,
        args,
        variables: extractVariables(args),
        builtin: Boolean(tt.builtin),
      });
      if (out.length >= MAX_TOOL_TEMPLATES) break;
    }
    return seedBuiltins(out);
  } catch {
    return seedBuiltins([]);
  }
}

export function serializeTemplates(list: ToolTemplate[]): string {
  return JSON.stringify(list.filter((t) => !t.builtin));
}

export function loadToolTemplates(): ToolTemplate[] {
  if (typeof localStorage === "undefined") return seedBuiltins([]);
  try {
    return parseTemplates(localStorage.getItem(STORAGE_KEY));
  } catch {
    return seedBuiltins([]);
  }
}

export function saveToolTemplates(list: ToolTemplate[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeTemplates(list));
  } catch {
    /* quota */
  }
}
