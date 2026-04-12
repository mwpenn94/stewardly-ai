/**
 * Code snippet library — Pass 254.
 *
 * A user-owned collection of reusable code snippets. Distinct from
 * the Pass 214 prompt template library: snippets are *code blocks*
 * (a React component stub, a zod schema, a tRPC procedure skeleton)
 * while templates are *prompts* (a review request, a refactor ask).
 *
 * Snippets carry:
 *   - name + body + language
 *   - free-form tags for organization
 *   - created/updated timestamps for sorting
 *
 * The library ships with a set of built-in snippets covering common
 * TypeScript / React / tRPC patterns so new users have something to
 * start from. Built-ins can be overridden (the user saves a new one
 * with the same name) but can't be deleted.
 *
 * Pure store. localStorage persistence. Import/export compatible
 * with the prompt template library JSON format (wrapped + versioned).
 */

export interface CodeSnippet {
  id: string;
  name: string;
  language: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  /** Built-ins are read-only; user can shadow but not delete */
  builtin?: boolean;
}

export interface SnippetExport {
  version: 1;
  snippets: CodeSnippet[];
}

export const MAX_SNIPPETS = 200;
export const MAX_BODY_BYTES = 32 * 1024;
const STORAGE_KEY = "stewardly-codechat-snippets";

// ─── Built-in starter set ────────────────────────────────────────────

export const BUILT_IN_SNIPPETS: Readonly<CodeSnippet[]> = [
  {
    id: "builtin-react-component",
    name: "React component stub",
    language: "tsx",
    tags: ["react", "component", "starter"],
    body: `import { useState } from "react";\n\ninterface FooProps {\n  // add props here\n}\n\nexport default function Foo({}: FooProps) {\n  const [state, setState] = useState<string>("");\n  return (\n    <div className="p-4">\n      <h2>Foo</h2>\n    </div>\n  );\n}\n`,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-zod-schema",
    name: "Zod schema + inferred type",
    language: "ts",
    tags: ["zod", "schema", "validation"],
    body: `import { z } from "zod";\n\nexport const fooSchema = z.object({\n  id: z.string().uuid(),\n  name: z.string().min(1).max(120),\n  createdAt: z.number().int(),\n});\n\nexport type Foo = z.infer<typeof fooSchema>;\n`,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-trpc-procedure",
    name: "tRPC protected procedure",
    language: "ts",
    tags: ["trpc", "api", "procedure"],
    body: `import { z } from "zod";\nimport { protectedProcedure, router } from "../_core/trpc";\n\nexport const fooRouter = router({\n  list: protectedProcedure\n    .input(\n      z.object({\n        limit: z.number().min(1).max(100).optional(),\n      }).optional(),\n    )\n    .query(async ({ ctx, input }) => {\n      return { items: [] as unknown[] };\n    }),\n});\n`,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-vitest-test",
    name: "Vitest test file",
    language: "ts",
    tags: ["test", "vitest", "starter"],
    body: `import { describe, it, expect } from "vitest";\nimport { fooBar } from "./fooBar";\n\ndescribe("fooBar", () => {\n  it("returns baseline", () => {\n    expect(fooBar("x")).toBe("x");\n  });\n});\n`,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-drizzle-table",
    name: "Drizzle table definition",
    language: "ts",
    tags: ["drizzle", "database", "schema"],
    body: `import { mysqlTable, serial, varchar, timestamp } from "drizzle-orm/mysql-core";\n\nexport const fooTable = mysqlTable("foo", {\n  id: serial("id").primaryKey(),\n  name: varchar("name", { length: 255 }).notNull(),\n  createdAt: timestamp("created_at").defaultNow().notNull(),\n  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),\n});\n`,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-try-catch",
    name: "Error-handled async helper",
    language: "ts",
    tags: ["error", "async", "helper"],
    body: `export async function safeCall<T>(\n  fn: () => Promise<T>,\n): Promise<{ ok: true; value: T } | { ok: false; error: string }> {\n  try {\n    return { ok: true, value: await fn() };\n  } catch (err) {\n    return {\n      ok: false,\n      error: err instanceof Error ? err.message : String(err),\n    };\n  }\n}\n`,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
];

// ─── Normalization helpers ───────────────────────────────────────────

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
}

/** Deduped, normalized, non-empty tag array (max 20 per snippet). */
export function sanitizeTags(input: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const t = normalizeTag(raw);
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

/** Clamp the body at MAX_BODY_BYTES with a truncation marker. */
export function clampBody(body: string): string {
  if (body.length <= MAX_BODY_BYTES) return body;
  return body.slice(0, MAX_BODY_BYTES) + "\n// … (truncated)";
}

// ─── Mutations ───────────────────────────────────────────────────────

function generateId(): string {
  return `snip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSnippet(
  input: Omit<CodeSnippet, "id" | "createdAt" | "updatedAt" | "builtin"> & {
    id?: string;
  },
): CodeSnippet {
  const now = Date.now();
  return {
    id: input.id ?? generateId(),
    name: input.name.trim(),
    language: input.language.trim() || "text",
    body: clampBody(input.body),
    tags: sanitizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
  };
}

export function addSnippet(
  list: CodeSnippet[],
  next: CodeSnippet,
): CodeSnippet[] {
  const out: CodeSnippet[] = [];
  // If the new snippet shares a name with a built-in, shadow it by
  // replacing the built-in entry with the user version at the same
  // position so the list order stays stable.
  let replaced = false;
  for (const existing of list) {
    if (existing.builtin && existing.name === next.name) {
      out.push(next);
      replaced = true;
    } else {
      out.push(existing);
    }
  }
  if (!replaced) out.push(next);
  // Enforce cap — but never drop built-ins.
  if (out.length > MAX_SNIPPETS) {
    const builtinOnly = out.filter((s) => s.builtin);
    const userOnly = out.filter((s) => !s.builtin);
    const room = MAX_SNIPPETS - builtinOnly.length;
    return [...builtinOnly, ...userOnly.slice(-Math.max(0, room))];
  }
  return out;
}

export function removeSnippet(
  list: CodeSnippet[],
  id: string,
): CodeSnippet[] {
  return list.filter((s) => {
    if (s.id !== id) return true;
    // Never delete built-ins — they auto-reseed anyway, but we refuse
    // the operation to keep the list stable.
    return Boolean(s.builtin);
  });
}

export function updateSnippet(
  list: CodeSnippet[],
  id: string,
  patch: Partial<
    Omit<CodeSnippet, "id" | "createdAt" | "builtin">
  >,
): CodeSnippet[] {
  return list.map((s) => {
    if (s.id !== id) return s;
    if (s.builtin) return s; // read-only
    return {
      ...s,
      ...patch,
      body: patch.body !== undefined ? clampBody(patch.body) : s.body,
      tags: patch.tags ? sanitizeTags(patch.tags) : s.tags,
      language: patch.language?.trim() || s.language,
      updatedAt: Date.now(),
    };
  });
}

export function seedBuiltins(list: CodeSnippet[]): CodeSnippet[] {
  const out = [...list];
  const existingNames = new Set(
    out.filter((s) => s.builtin).map((s) => s.name),
  );
  for (const builtin of BUILT_IN_SNIPPETS) {
    if (!existingNames.has(builtin.name)) {
      out.push({ ...builtin });
    }
  }
  return out;
}

// ─── Filtering + grouping ────────────────────────────────────────────

export function filterSnippets(
  snippets: CodeSnippet[],
  opts: {
    search?: string;
    language?: string;
    tags?: string[];
  } = {},
): CodeSnippet[] {
  let out = snippets;
  if (opts.language && opts.language.length > 0) {
    out = out.filter((s) => s.language === opts.language);
  }
  if (opts.tags && opts.tags.length > 0) {
    const needed = opts.tags.map(normalizeTag);
    out = out.filter((s) => {
      for (const t of needed) {
        if (!s.tags.includes(t)) return false;
      }
      return true;
    });
  }
  if (opts.search && opts.search.trim().length > 0) {
    const q = opts.search.toLowerCase();
    out = out.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q)) ||
        s.language.toLowerCase().includes(q),
    );
  }
  return out;
}

/** Sort snippets: built-ins last, user snippets by recency. */
export function sortForDisplay(list: CodeSnippet[]): CodeSnippet[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.builtin) !== Boolean(b.builtin)) {
      return a.builtin ? 1 : -1;
    }
    return b.updatedAt - a.updatedAt;
  });
}

export function allLanguages(snippets: CodeSnippet[]): string[] {
  const set = new Set<string>();
  for (const s of snippets) set.add(s.language);
  return Array.from(set).sort();
}

export function allTags(snippets: CodeSnippet[]): string[] {
  const set = new Set<string>();
  for (const s of snippets) {
    for (const t of s.tags) set.add(t);
  }
  return Array.from(set).sort();
}

// ─── Persistence ─────────────────────────────────────────────────────

export function parseSnippets(raw: string | null): CodeSnippet[] {
  if (!raw) return seedBuiltins([]);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedBuiltins([]);
    const out: CodeSnippet[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.name !== "string") continue;
      if (typeof e.body !== "string") continue;
      out.push({
        id: e.id,
        name: e.name,
        language: typeof e.language === "string" ? e.language : "text",
        body: clampBody(e.body),
        tags: Array.isArray(e.tags)
          ? sanitizeTags(e.tags.filter((t): t is string => typeof t === "string"))
          : [],
        createdAt: typeof e.createdAt === "number" ? e.createdAt : 0,
        updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : 0,
        builtin: Boolean(e.builtin),
      });
      if (out.length >= MAX_SNIPPETS) break;
    }
    return seedBuiltins(out);
  } catch {
    return seedBuiltins([]);
  }
}

export function serializeSnippets(list: CodeSnippet[]): string {
  // Only persist user snippets — built-ins auto-reseed on load.
  return JSON.stringify(list.filter((s) => !s.builtin));
}

export function loadSnippets(): CodeSnippet[] {
  if (typeof localStorage === "undefined") return seedBuiltins([]);
  try {
    return parseSnippets(localStorage.getItem(STORAGE_KEY));
  } catch {
    return seedBuiltins([]);
  }
}

export function saveSnippets(list: CodeSnippet[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeSnippets(list));
  } catch {
    /* quota */
  }
}

// ─── Import / export JSON ────────────────────────────────────────────

export function exportSnippets(list: CodeSnippet[]): string {
  const payload: SnippetExport = {
    version: 1,
    snippets: list.filter((s) => !s.builtin),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseSnippetExport(raw: string): CodeSnippet[] {
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.snippets)
        ? parsed.snippets
        : null;
    if (!list) return [];
    const out: CodeSnippet[] = [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.name !== "string" || typeof e.body !== "string") continue;
      out.push(
        createSnippet({
          name: e.name,
          body: e.body,
          language: typeof e.language === "string" ? e.language : "text",
          tags: Array.isArray(e.tags)
            ? e.tags.filter((t): t is string => typeof t === "string")
            : [],
        }),
      );
    }
    return out;
  } catch {
    return [];
  }
}
