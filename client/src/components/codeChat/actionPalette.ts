/**
 * Action palette registry for Code Chat (Pass 248).
 *
 * A unified `⌘K` launcher that exposes every UI action across the
 * Code Chat — opening tabs, popovers, running slash commands, and
 * jumping to keyboard shortcuts — through a single fuzzy-search
 * palette.
 *
 * This module is the pure data + filtering side. The popover UI
 * lives in ActionPalettePopover.tsx.
 */

export type PaletteCategory =
  | "tab"
  | "popover"
  | "slash"
  | "shortcut"
  | "workspace";

export interface PaletteAction {
  id: string;
  label: string;
  category: PaletteCategory;
  hint?: string;
  keywords?: string[];
}

/** Score how well an action matches a query. Higher = better match. */
export function scoreAction(action: PaletteAction, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const label = action.label.toLowerCase();
  const keywords = (action.keywords ?? []).map((k) => k.toLowerCase());

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  for (const kw of keywords) {
    if (kw === q) return 70;
    if (kw.startsWith(q)) return 60;
  }
  if (label.includes(q)) return 40;
  for (const kw of keywords) {
    if (kw.includes(q)) return 30;
  }
  // Subsequence fallback
  if (isSubsequence(q, label)) return 10;
  return 0;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

export function filterActions(
  actions: PaletteAction[],
  query: string,
  limit = 20,
): PaletteAction[] {
  if (!query.trim()) return actions.slice(0, limit);
  const scored = actions
    .map((a) => ({ action: a, score: scoreAction(a, query) }))
    .filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score || a.action.label.localeCompare(b.action.label));
  return scored.slice(0, limit).map((s) => s.action);
}

export function groupByCategory(
  actions: PaletteAction[],
): Array<{ category: PaletteCategory; items: PaletteAction[] }> {
  const order: PaletteCategory[] = ["tab", "popover", "workspace", "slash", "shortcut"];
  const buckets = new Map<PaletteCategory, PaletteAction[]>();
  for (const action of actions) {
    if (!buckets.has(action.category)) buckets.set(action.category, []);
    buckets.get(action.category)!.push(action);
  }
  return order
    .filter((cat) => buckets.has(cat))
    .map((cat) => ({ category: cat, items: buckets.get(cat)! }));
}

// ─── Default action set for Code Chat ─────────────────────────────────

export const DEFAULT_ACTIONS: PaletteAction[] = [
  // Tabs
  { id: "tab:chat", label: "Go to Chat", category: "tab", keywords: ["conversation", "chat"] },
  { id: "tab:files", label: "Go to Files", category: "tab", keywords: ["file", "browser", "explorer"] },
  { id: "tab:roadmap", label: "Go to Roadmap", category: "tab", keywords: ["plan", "todo"] },
  { id: "tab:diff", label: "Go to Diff", category: "tab", keywords: ["changes"] },
  { id: "tab:github", label: "Go to GitHub", category: "tab", keywords: ["remote", "pr"] },
  { id: "tab:write", label: "Go to Git Write", category: "tab", keywords: ["commit", "push"] },
  { id: "tab:jobs", label: "Go to Jobs", category: "tab", keywords: ["background"] },
  { id: "tab:gitstatus", label: "Go to Git Status", category: "tab", keywords: ["status", "dirty"] },
  { id: "tab:search", label: "Find anywhere", category: "tab", hint: "g s", keywords: ["search", "grep", "symbol", "todo", "find"] },
  { id: "tab:replace", label: "Find & replace across files", category: "tab", hint: "g p", keywords: ["replace", "refactor", "rename", "apply"] },
  { id: "tab:checkpoints", label: "Workspace checkpoints", category: "tab", hint: "g k", keywords: ["stash", "snapshot", "restore", "rollback"] },
  { id: "tab:diagnostics", label: "Problems / diagnostics", category: "tab", hint: "g x", keywords: ["errors", "tsc", "typescript", "lint", "problems"] },
  { id: "tab:prdraft", label: "Draft a pull request", category: "tab", hint: "g u", keywords: ["pr", "pull request", "draft", "summary"] },
  { id: "tab:tests", label: "Run tests (vitest)", category: "tab", hint: "g t", keywords: ["test", "vitest", "spec", "run"] },
  { id: "tab:env", label: "Env variables inspector", category: "tab", hint: "g e", keywords: ["env", "secrets", "variables", "config"] },
  { id: "tab:log", label: "Commit history timeline", category: "tab", hint: "g l", keywords: ["git log", "history", "commits", "timeline"] },
  { id: "tab:licenses", label: "Dependency licenses", category: "tab", hint: "g n", keywords: ["license", "legal", "npm", "packages", "spdx"] },
  { id: "tab:imports", label: "Go to Imports", category: "tab", keywords: ["dependencies", "graph"] },
  { id: "tab:todos", label: "Go to TODOs", category: "tab", keywords: ["fixme", "markers"] },
  // Popovers
  { id: "open:symbols", label: "Open symbol navigator", category: "popover", hint: "⌘T", keywords: ["goto", "definition"] },
  { id: "open:sessions", label: "Open sessions library", category: "popover", keywords: ["save", "load"] },
  { id: "open:bookmarks", label: "Open bookmarks", category: "popover", keywords: ["starred"] },
  { id: "open:tools", label: "Open tool permissions", category: "popover", keywords: ["shield", "allow"] },
  { id: "open:templates", label: "Open prompt templates", category: "popover", keywords: ["library", "snippets"] },
  { id: "open:snippets", label: "Open code snippets library", category: "popover", keywords: ["code", "library", "paste", "fence"] },
  { id: "open:memory", label: "Open agent memory", category: "popover", keywords: ["brain", "facts"] },
  { id: "open:instructions", label: "Open project instructions", category: "popover", keywords: ["claude", "rules"] },
  { id: "open:history", label: "Open edit history", category: "popover", hint: "⌃Z / ⌃⇧Z", keywords: ["undo", "redo"] },
  { id: "open:scratchpad", label: "Toggle scratchpad", category: "popover", keywords: ["notes"] },
  { id: "open:analytics", label: "Open session analytics", category: "popover", keywords: ["cost", "stats"] },
  { id: "open:shortcuts", label: "Open keyboard shortcuts", category: "popover", hint: "?", keywords: ["help"] },
  { id: "open:search", label: "Search command history", category: "popover", hint: "⌃R", keywords: ["reverse"] },
  // Workspace actions
  { id: "workspace:clear", label: "Clear chat history", category: "workspace", hint: "/clear", keywords: ["reset"] },
  { id: "workspace:abort", label: "Abort running loop", category: "workspace", hint: "Esc", keywords: ["cancel", "stop"] },
  // Slash commands (expanded by parent)
  { id: "slash:plan", label: "/plan — generate plan first", category: "slash", keywords: ["plan", "task"] },
  { id: "slash:compact", label: "/compact — summarize older turns", category: "slash", keywords: ["shrink"] },
  { id: "slash:remember", label: "/remember — save a fact to memory", category: "slash", keywords: ["mem"] },
  { id: "slash:explain", label: "/explain — explain a file", category: "slash", keywords: ["describe"] },
  { id: "slash:find", label: "/find — grep across codebase", category: "slash", keywords: ["search"] },
  { id: "slash:diff", label: "/diff — show file diff", category: "slash", keywords: ["changes"] },
];
