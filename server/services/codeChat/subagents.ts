/**
 * subagents — user-defined specialized agent definitions (Pass 253).
 *
 * Claude Code lets users drop agent definitions into
 * `~/.claude/agents/<name>.md` so they can spawn specialized
 * assistants (code-reviewer, test-runner, database-migrator, etc.)
 * from inside any session. Each agent has its own system prompt,
 * its own tool allowlist, and an invocation description.
 *
 * This module is the server-side equivalent for Code Chat:
 *   - Agents live in `.stewardly/agents/<slug>.md` at the workspace
 *     root (overridable via STEWARDLY_AGENTS_DIR env var)
 *   - Each file uses the same frontmatter + body convention as
 *     Claude Code: YAML-ish `---` header with name, description,
 *     optional model, optional tools[], then the system prompt as
 *     markdown body
 *   - The loader is forgiving: missing frontmatter → empty defaults;
 *     malformed frontmatter → error with the line number; unknown
 *     fields ignored
 *   - In-process cache invalidates on mtime change (mirrors the
 *     project instructions cache pattern from Pass 238)
 *   - Pure-function `parseAgentFile` / `buildManifest` so the logic
 *     is unit-testable without disk
 */

import path from "path";
import fs from "fs/promises";
import { existsSync, statSync } from "fs";

export const DEFAULT_AGENTS_DIR = ".stewardly/agents";
export const MAX_AGENTS = 50;
export const MAX_FILE_BYTES = 32 * 1024; // 32KB per agent file
export const CACHE_TTL_MS = 60 * 1000;

export interface SubagentSpec {
  /** Machine-friendly id derived from the filename (lowercased, no ext) */
  slug: string;
  /** Human name from frontmatter, defaults to slug */
  name: string;
  /** One-sentence description shown in the picker UI */
  description: string;
  /** Full system prompt body (markdown allowed) */
  systemPrompt: string;
  /** Optional model override (e.g. claude-opus-4-6) */
  model?: string;
  /** Optional tool allowlist; if empty/missing, inherits the parent's allowlist */
  tools: string[];
  /** Source path relative to the workspace root */
  path: string;
  /** Byte length of the source file */
  byteLength: number;
  /** mtimeMs of the source file (for cache invalidation) */
  mtimeMs: number;
}

export interface SubagentLoadError {
  path: string;
  message: string;
}

export interface SubagentManifest {
  agents: SubagentSpec[];
  errors: SubagentLoadError[];
  dir: string;
  scanned: boolean;
}

// ─── Frontmatter parsing ─────────────────────────────────────────────────

export interface AgentFrontmatter {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
}

/**
 * Parse the YAML-ish frontmatter block at the top of an agent file.
 * We deliberately do NOT pull in js-yaml — the grammar we need is
 * much smaller than full YAML:
 *
 *   - Lines of the form `key: value`
 *   - Quoted strings (") unwrapped
 *   - `tools: [a, b, c]` inline array
 *   - `tools:` followed by `  - a` / `  - b` block array
 *   - # comments
 *   - Trailing whitespace / blank lines stripped
 *
 * Returns `null` if the document doesn't start with a frontmatter
 * fence, a partial `AgentFrontmatter` otherwise.
 */
export function parseFrontmatter(
  raw: string,
): { data: AgentFrontmatter; body: string } | null {
  if (!raw.startsWith("---")) return null;
  const lines = raw.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  const block = lines.slice(1, end);
  const body = lines.slice(end + 1).join("\n");
  const data: AgentFrontmatter = {};
  let i = 0;
  while (i < block.length) {
    const line = block[i];
    const trimmed = line.replace(/#.*$/, "").trimEnd();
    if (!trimmed.trim()) {
      i++;
      continue;
    }
    const keyMatch = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(trimmed);
    if (!keyMatch) {
      i++;
      continue;
    }
    const key = keyMatch[1];
    let value = keyMatch[2].trim();

    // Block array: `tools:` followed by lines starting with `  -`
    if (!value) {
      const items: string[] = [];
      let j = i + 1;
      while (j < block.length) {
        const next = block[j];
        const m = /^\s+-\s+(.*)$/.exec(next.replace(/#.*$/, "").trimEnd());
        if (!m) break;
        items.push(unwrapString(m[1].trim()));
        j++;
      }
      if (items.length > 0 && key === "tools") {
        data.tools = items;
      }
      i = j;
      continue;
    }

    // Inline array: `tools: [a, b, c]`
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1);
      const items = inner
        .split(",")
        .map((s) => unwrapString(s.trim()))
        .filter(Boolean);
      if (key === "tools") data.tools = items;
      i++;
      continue;
    }

    value = unwrapString(value);
    switch (key) {
      case "name":
        data.name = value;
        break;
      case "description":
        data.description = value;
        break;
      case "model":
        data.model = value;
        break;
      case "tools":
        // Single-value fallback: treat as a one-element array
        if (value) data.tools = [value];
        break;
      // Ignore unknown keys deliberately
    }
    i++;
  }
  return { data, body: body.trim() };
}

function unwrapString(s: string): string {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

// ─── Per-file parsing ────────────────────────────────────────────────────

export interface ParseAgentFileInput {
  filename: string;
  content: string;
  byteLength: number;
  mtimeMs: number;
  relativePath: string;
}

export function parseAgentFile(input: ParseAgentFileInput): SubagentSpec {
  const slug = input.filename.replace(/\.md$/i, "").toLowerCase();
  const fm = parseFrontmatter(input.content);
  if (fm) {
    const data = fm.data;
    const body = fm.body;
    return {
      slug,
      name: data.name?.trim() || slug,
      description: data.description?.trim() || "",
      systemPrompt: body,
      model: data.model?.trim() || undefined,
      tools: Array.isArray(data.tools)
        ? data.tools.map((t) => String(t).trim()).filter(Boolean)
        : [],
      path: input.relativePath,
      byteLength: input.byteLength,
      mtimeMs: input.mtimeMs,
    };
  }
  // No frontmatter — treat the whole file as the system prompt
  return {
    slug,
    name: slug,
    description: "",
    systemPrompt: input.content.trim(),
    model: undefined,
    tools: [],
    path: input.relativePath,
    byteLength: input.byteLength,
    mtimeMs: input.mtimeMs,
  };
}

// ─── Manifest (UI shape, strips system prompts) ──────────────────────────

export interface SubagentManifestEntry {
  slug: string;
  name: string;
  description: string;
  model?: string;
  tools: string[];
  path: string;
  byteLength: number;
  promptPreview: string;
}

export function buildManifest(
  agents: SubagentSpec[],
): SubagentManifestEntry[] {
  return agents.map((a) => ({
    slug: a.slug,
    name: a.name,
    description: a.description,
    model: a.model,
    tools: a.tools,
    path: a.path,
    byteLength: a.byteLength,
    promptPreview: previewPrompt(a.systemPrompt),
  }));
}

function previewPrompt(s: string): string {
  const collapsed = s.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 160) return collapsed;
  return `${collapsed.slice(0, 159)}…`;
}

// ─── Disk loading + cache ────────────────────────────────────────────────

interface CacheEntry {
  value: SubagentManifest;
  storedAt: number;
  dirMtimeMs: number;
}

const cache = new Map<string, CacheEntry>();

export function resolveAgentsDir(workspaceRoot: string): string {
  const override = process.env.STEWARDLY_AGENTS_DIR;
  if (override && path.isAbsolute(override)) return override;
  if (override) return path.resolve(workspaceRoot, override);
  return path.resolve(workspaceRoot, DEFAULT_AGENTS_DIR);
}

/**
 * Scan the agents directory and return the loaded spec list. The
 * manifest is cached by workspace root + dir mtime so repeated
 * calls within CACHE_TTL_MS never hit disk.
 */
export async function loadSubagents(
  workspaceRoot: string,
): Promise<SubagentManifest> {
  const dir = resolveAgentsDir(workspaceRoot);
  const cacheKey = `${workspaceRoot}::${dir}`;
  const existing = cache.get(cacheKey);
  if (existing) {
    const age = Date.now() - existing.storedAt;
    if (age < CACHE_TTL_MS) {
      // Also check dir mtime to catch mid-TTL changes
      try {
        const stat = statSync(dir);
        if (stat.mtimeMs === existing.dirMtimeMs) {
          return existing.value;
        }
      } catch {
        /* dir was deleted — fall through to fresh scan */
      }
    }
  }
  if (!existsSync(dir)) {
    const manifest: SubagentManifest = {
      agents: [],
      errors: [],
      dir,
      scanned: false,
    };
    cache.set(cacheKey, {
      value: manifest,
      storedAt: Date.now(),
      dirMtimeMs: 0,
    });
    return manifest;
  }
  const agents: SubagentSpec[] = [];
  const errors: SubagentLoadError[] = [];
  let dirMtimeMs = 0;
  try {
    const stat = await fs.stat(dir);
    dirMtimeMs = stat.mtimeMs;
  } catch {
    /* ignore */
  }
  let dirents: string[] = [];
  try {
    dirents = await fs.readdir(dir);
  } catch (err) {
    const manifest: SubagentManifest = {
      agents: [],
      errors: [
        {
          path: dir,
          message: err instanceof Error ? err.message : "readdir failed",
        },
      ],
      dir,
      scanned: true,
    };
    cache.set(cacheKey, {
      value: manifest,
      storedAt: Date.now(),
      dirMtimeMs,
    });
    return manifest;
  }
  const mdFiles = dirents.filter((n) => n.toLowerCase().endsWith(".md"));
  for (const filename of mdFiles) {
    if (agents.length >= MAX_AGENTS) break;
    const abs = path.join(dir, filename);
    try {
      const stat = await fs.stat(abs);
      if (!stat.isFile()) continue;
      if (stat.size > MAX_FILE_BYTES) {
        errors.push({
          path: filename,
          message: `file exceeds ${MAX_FILE_BYTES} bytes`,
        });
        continue;
      }
      const content = await fs.readFile(abs, "utf8");
      const spec = parseAgentFile({
        filename,
        content,
        byteLength: stat.size,
        mtimeMs: stat.mtimeMs,
        relativePath: path.relative(workspaceRoot, abs),
      });
      agents.push(spec);
    } catch (err) {
      errors.push({
        path: filename,
        message: err instanceof Error ? err.message : "read failed",
      });
    }
  }
  // Sort by name for deterministic UI ordering
  agents.sort((a, b) => a.name.localeCompare(b.name));
  const manifest: SubagentManifest = {
    agents,
    errors,
    dir,
    scanned: true,
  };
  cache.set(cacheKey, {
    value: manifest,
    storedAt: Date.now(),
    dirMtimeMs,
  });
  return manifest;
}

export function clearSubagentsCache(): void {
  cache.clear();
}

/**
 * Build the system-prompt overlay that gets injected when a user
 * picks a specific subagent. This is the subagent's own system
 * prompt, wrapped with a clear header so the LLM knows it's
 * operating in a specialized mode.
 */
export function buildSubagentOverlay(agent: SubagentSpec): string {
  const header = `# Subagent mode: ${agent.name}`;
  const desc = agent.description
    ? `\n${agent.description}\n`
    : "";
  return `\n${header}${desc}\n${agent.systemPrompt}\n`;
}

/**
 * Intersect the subagent's tool allowlist with the session's
 * allowlist so the subagent can't re-enable a tool the user has
 * disabled for the session. Empty subagent tools array means
 * "inherit" (return the session allowlist untouched).
 */
export function intersectTools(
  sessionAllowed: string[],
  subagentTools: string[],
): string[] {
  if (!subagentTools || subagentTools.length === 0) return sessionAllowed;
  const set = new Set(sessionAllowed);
  return subagentTools.filter((t) => set.has(t));
}
