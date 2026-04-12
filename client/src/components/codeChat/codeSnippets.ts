/**
 * Code snippets library (Pass 254).
 *
 * A per-device library of reusable code snippets the user can paste
 * into the chat input (as a ``` code fence) or copy to clipboard for
 * use anywhere. Complements the prompt template library (Pass 214)
 * which stores prompt text, not code.
 *
 * All state lives in localStorage. Built-in snippets are read-only
 * templates bundled with the app; users can save as many custom
 * snippets as they want up to MAX_SNIPPETS.
 */

export type SnippetCategory =
  | "react"
  | "trpc"
  | "test"
  | "shell"
  | "sql"
  | "config"
  | "other";

export interface CodeSnippet {
  id: string;
  name: string;
  language: string;
  code: string;
  description?: string;
  category: SnippetCategory;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  builtin?: boolean;
}

export const MAX_SNIPPETS = 200;
export const MAX_CODE_LENGTH = 20_000;
export const MAX_NAME_LENGTH = 80;
export const MAX_TAGS = 10;

// ─── Built-ins ─────────────────────────────────────────────────────────

export const BUILTIN_SNIPPETS: CodeSnippet[] = [
  {
    id: "builtin:react-use-query",
    name: "tRPC useQuery",
    language: "typescript",
    category: "trpc",
    code: `const query = trpc.router.procedureName.useQuery(
  { input: "value" },
  { staleTime: 30_000 }
);`,
    description: "Standard tRPC query hook with stale time",
    tags: ["trpc", "react", "hook"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    builtin: true,
  },
  {
    id: "builtin:react-use-mutation",
    name: "tRPC useMutation",
    language: "typescript",
    category: "trpc",
    code: `const mutation = trpc.router.procedureName.useMutation({
  onSuccess: () => {
    toast.success("Saved");
    utils.router.list.invalidate();
  },
  onError: (err) => {
    toast.error(\`Failed: \${err.message}\`);
  },
});`,
    description: "tRPC mutation with toast + invalidate",
    tags: ["trpc", "react", "mutation"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    builtin: true,
  },
  {
    id: "builtin:react-use-effect",
    name: "useEffect with cleanup",
    language: "typescript",
    category: "react",
    code: `useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      // handle
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);`,
    description: "useEffect with event listener + cleanup",
    tags: ["react", "hook", "effect"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    builtin: true,
  },
  {
    id: "builtin:vitest-describe",
    name: "Vitest describe + it",
    language: "typescript",
    category: "test",
    code: `import { describe, it, expect } from "vitest";
import { fnUnderTest } from "./module";

describe("fnUnderTest", () => {
  it("returns the expected value", () => {
    expect(fnUnderTest("input")).toBe("output");
  });
});`,
    description: "Vitest test scaffold",
    tags: ["test", "vitest"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    builtin: true,
  },
  {
    id: "builtin:drizzle-query",
    name: "Drizzle select query",
    language: "typescript",
    category: "trpc",
    code: `const rows = await db
  .select()
  .from(tableName)
  .where(and(eq(tableName.userId, userId), isNull(tableName.deletedAt)))
  .orderBy(desc(tableName.createdAt))
  .limit(50);`,
    description: "Drizzle ORM select with filter + order",
    tags: ["drizzle", "sql", "orm"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    builtin: true,
  },
  {
    id: "builtin:shell-tsc-check",
    name: "Run typecheck + build",
    language: "bash",
    category: "shell",
    code: `npm run check && npm run build && npm test`,
    description: "Full verify before committing",
    tags: ["shell", "ci"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    builtin: true,
  },
];

// ─── Pure state helpers ────────────────────────────────────────────────

/**
 * Validate + normalize an incoming snippet. Returns a `CodeSnippet`
 * or throws `RangeError` on invalid input.
 */
export function validateSnippet(
  input: Partial<CodeSnippet> & {
    name: string;
    code: string;
  },
): CodeSnippet {
  const name = input.name.trim();
  if (!name) throw new RangeError("snippet name required");
  if (name.length > MAX_NAME_LENGTH) {
    throw new RangeError(`name must be ≤ ${MAX_NAME_LENGTH} chars`);
  }
  const code = input.code;
  if (!code || !code.trim()) throw new RangeError("snippet code required");
  if (code.length > MAX_CODE_LENGTH) {
    throw new RangeError(`code must be ≤ ${MAX_CODE_LENGTH} chars`);
  }

  const language = (input.language ?? "plaintext").trim().toLowerCase().slice(0, 40);
  const description = input.description?.trim().slice(0, 500);
  const category: SnippetCategory =
    (input.category as SnippetCategory) ?? inferCategory(language, code);
  const tags = normalizeTags(input.tags ?? []);
  const now = new Date().toISOString();

  return {
    id: input.id ?? `snip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    language,
    code,
    description,
    category,
    tags,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const tag = entry.trim().toLowerCase();
    if (!tag) continue;
    if (!/^[a-z0-9][a-z0-9_\-./]*$/.test(tag)) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Infer a category from the language or code shape */
export function inferCategory(language: string, code: string): SnippetCategory {
  const lang = language.toLowerCase();
  if (lang === "sql") return "sql";
  if (lang === "bash" || lang === "sh" || lang === "shell") return "shell";
  if (lang === "json" || lang === "yaml" || lang === "yml") return "config";
  if (/\buseEffect\b|\buseState\b|\buseMemo\b/.test(code)) return "react";
  if (/\btrpc\./.test(code)) return "trpc";
  if (/\bdescribe\(|\bexpect\(|\btest\(|\bit\(/.test(code)) return "test";
  return "other";
}

// ─── Persistence ──────────────────────────────────────────────────────

const STORAGE_KEY = "stewardly-codechat-snippets";

export function loadUserSnippets(): CodeSnippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CodeSnippet[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.name !== "string" || typeof e.code !== "string") {
        continue;
      }
      // Built-ins can't be shadowed via localStorage — filter them out
      if (typeof e.id === "string" && e.id.startsWith("builtin:")) continue;
      out.push({
        id: e.id,
        name: String(e.name).slice(0, MAX_NAME_LENGTH),
        language: String(e.language ?? "plaintext").slice(0, 40),
        code: String(e.code).slice(0, MAX_CODE_LENGTH),
        description: typeof e.description === "string" ? e.description : undefined,
        category: (e.category as SnippetCategory) ?? "other",
        tags: Array.isArray(e.tags)
          ? e.tags.filter((t): t is string => typeof t === "string").slice(0, MAX_TAGS)
          : [],
        createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
        updatedAt: typeof e.updatedAt === "string" ? e.updatedAt : new Date().toISOString(),
      });
      if (out.length >= MAX_SNIPPETS) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function saveUserSnippets(snippets: CodeSnippet[]): void {
  try {
    const serialized = snippets
      .filter((s) => !s.builtin)
      .slice(0, MAX_SNIPPETS)
      .map((s) => ({ ...s, builtin: undefined }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    /* quota exceeded — silent */
  }
}

// ─── List + mutate ────────────────────────────────────────────────────

/** Combine built-ins with user snippets, user-first */
export function allSnippets(userSnippets: CodeSnippet[]): CodeSnippet[] {
  return [...userSnippets, ...BUILTIN_SNIPPETS];
}

export function addSnippet(
  userSnippets: CodeSnippet[],
  snippet: CodeSnippet,
): CodeSnippet[] {
  if (snippet.builtin) return userSnippets;
  const filtered = userSnippets.filter((s) => s.id !== snippet.id);
  return [snippet, ...filtered].slice(0, MAX_SNIPPETS);
}

export function updateSnippet(
  userSnippets: CodeSnippet[],
  id: string,
  patch: Partial<CodeSnippet>,
): CodeSnippet[] {
  return userSnippets.map((s) => {
    if (s.id !== id || s.builtin) return s;
    const next: CodeSnippet = {
      ...s,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    return next;
  });
}

export function removeSnippet(
  userSnippets: CodeSnippet[],
  id: string,
): CodeSnippet[] {
  return userSnippets.filter((s) => s.id !== id || s.builtin);
}

// ─── Filter + search ──────────────────────────────────────────────────

export interface SnippetFilter {
  query?: string;
  language?: string;
  category?: SnippetCategory;
  tag?: string;
}

export function filterSnippets(
  snippets: CodeSnippet[],
  filter: SnippetFilter,
): CodeSnippet[] {
  const q = filter.query?.trim().toLowerCase() ?? "";
  return snippets.filter((s) => {
    if (filter.language && s.language !== filter.language) return false;
    if (filter.category && s.category !== filter.category) return false;
    if (filter.tag && !s.tags.includes(filter.tag.toLowerCase())) return false;
    if (q) {
      const haystack =
        `${s.name} ${s.description ?? ""} ${s.code} ${s.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/** Render a snippet as a markdown fenced code block for chat insertion */
export function toMarkdownFence(snippet: CodeSnippet): string {
  const lang = snippet.language || "";
  return `\`\`\`${lang}\n${snippet.code}\n\`\`\``;
}

/** Stats helper for the popover header */
export interface SnippetStats {
  total: number;
  userCount: number;
  builtinCount: number;
  categories: Record<SnippetCategory, number>;
  topTags: Array<{ tag: string; count: number }>;
}

export function computeSnippetStats(all: CodeSnippet[]): SnippetStats {
  const categories: Record<SnippetCategory, number> = {
    react: 0,
    trpc: 0,
    test: 0,
    shell: 0,
    sql: 0,
    config: 0,
    other: 0,
  };
  const tagCount = new Map<string, number>();
  let userCount = 0;
  let builtinCount = 0;
  for (const s of all) {
    categories[s.category] = (categories[s.category] ?? 0) + 1;
    if (s.builtin) builtinCount++;
    else userCount++;
    for (const t of s.tags) {
      tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  return {
    total: all.length,
    userCount,
    builtinCount,
    categories,
    topTags,
  };
}
