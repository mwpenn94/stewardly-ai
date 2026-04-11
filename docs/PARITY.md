# Code Chat — Claude Code Parity Tracker

> Living document tracking feature parity between Stewardly's Code Chat and
> Claude Code (plus Cursor / Aider / other top comparables). Updated after
> every recursive build-and-optimize pass. Parallel assessment processes may
> also write to this file — always re-read before editing and use the
> Reconciliation Log to resolve conflicts.

**Last updated:** 2026-04-11 (Pass 250 — WebFetch tool)
**Current composite score:** 9.4 / 10 (self-assessed, conservative)
**Passes completed:** 250+ cumulative across all platforms
**Test surface:** codeChat **810 passing across 34 files** (+37 new this pass)
**Full suite:** 3,840+ passing (baseline 3,103/109 — 14 pre-existing env-dependent failing files unchanged)

---

## Feature matrix

Legend: ✅ complete • 🔶 partial / design-preview • ❌ missing • ⭐ beyond Claude Code

| Area | Feature | Claude Code | Code Chat | Depth (1–10) | Notes |
|---|---|---|---|---|---|
| **Agent loop** | ReAct multi-turn tool calling | ✅ | ✅ | 9 | `executeReActLoop` with 5 default iterations, configurable |
|  | Plan mode | ✅ | ✅ | 9 | Pass 236 — parsePlanFromText + PlanReviewPanel |
|  | Live agent todos | ✅ TodoWrite | ✅ | 9 | Pass 237 — `update_todos` + AgentTodoPanel |
|  | Subagents / Task tool | ✅ | 🔶 | 6 | Background jobs framework exists (Pass 201), but no inline sub-agent spawning |
|  | Thinking / extended reasoning display | ✅ | 🔶 | 5 | `thinking` SSE event fires but no dedicated UI panel |
| **Tools** | read_file | ✅ | ✅ | 9 | 256KB cap, sandbox-guarded |
|  | write_file | ✅ | ✅ | 9 | Admin + writeMode gated, before/after snapshots |
|  | edit_file (find/replace) | ✅ | ✅ | 9 | Unique-match enforcement + replaceAll escape hatch |
|  | list_directory | ✅ | ✅ | 9 | Sorted dirs-first |
|  | grep_search | ✅ | ✅ | 9 | ripgrep JSON backend + in-UI quick jump |
|  | run_bash | ✅ | ✅ | 8 | 30s timeout, denylist, but no interactive prompts |
|  | find_symbol (Go to Symbol) | ✅ | ✅ | 9 | Pass 242 — regex index, 8 kinds, 4-tier ranking |
|  | update_todos | ✅ | ✅ | 9 | Pass 237 |
|  | WebSearch | ✅ | 🔶 | 4 | Available at platform level (tavily/brave) but not in Code Chat tool definitions |
|  | WebFetch | ✅ | ✅ | 9 | Pass 250 — URL fetch + HTML→markdown, SSRF-guarded (loopback/RFC-1918/IMDS blocked), 2MB/32KB caps |
|  | NotebookEdit (.ipynb) | ✅ | ❌ | 0 | Not implemented |
|  | @file mention expansion | ✅ | ✅ | 9 | Pass 206 — auto-inlines file contents |
|  | MCP server tool provider | ✅ | 🔶 | 4 | Stewardly has MCP server at platform level but Code Chat doesn't consume external MCP servers as tools |
| **Session** | Save/load conversation | ✅ | ✅ | 9 | Pass 212 — SessionsLibraryPopover + 50-entry cap |
|  | Auto-checkpoint | ❌ | ⭐ | 9 | Pass 223 — silent every-4-msgs checkpoint |
|  | Import/export library | ❌ | ⭐ | 9 | Pass 228 — JSON file import with merge/replace |
|  | Session tags | ❌ | ⭐ | 9 | Pass 229 — AND-combined filter chips |
|  | Fork from message | 🔶 | ⭐ | 9 | Pass 220 — GitFork button on every assistant turn |
|  | Cross-session full-text search | ❌ | ⭐ | 9 | Pass 221 — highlighted snippets, click-to-load |
|  | Cost budget guardrail | ❌ | ⭐ | 9 | Pass 222 — warn/block thresholds, per-user USD |
|  | /compact command | ✅ | ✅ | 9 | Pass 232 — pure-fn collapser, no LLM round-trip |
|  | /clear command | ✅ | ✅ | 9 | Registered in slashCommands.ts |
|  | Resume previous session | ✅ | ✅ | 9 | Via SessionsLibraryPopover |
| **Input** | Slash commands | ✅ | ✅ | 9 | Pass 203 + 218 + 232 + 236 — 12 built-ins |
|  | Command history (up-arrow) | ✅ | ✅ | 9 | Stored in localStorage, key-up recall |
|  | Reverse-i-search (Ctrl+R) | ✅ | ✅ | 9 | Pass 216 — fuzzy match modal |
|  | Prompt templates | ✅ | ✅ | 9 | Pass 214 + 218 — 5 built-ins, {{vars}} substitution |
|  | Template import/export | ❌ | ⭐ | 9 | Pass 231 |
|  | Image paste in prompt | ✅ | ❌ | 0 | Not implemented |
|  | Voice input | 🔶 | 🔶 | 5 | Stewardly audio layer exists but Code Chat input doesn't wire voice dictation |
| **Output** | Markdown rendering | ✅ | ✅ | 9 | Pass 204 — react-markdown + remark-gfm |
|  | Syntax highlighting in code blocks | ✅ | ✅ | 9 | Pass 207 — Shiki lazy-loaded |
|  | Copy code block button | ✅ | ✅ | 9 | Per-block, live in MarkdownMessage |
|  | Copy/export/regenerate message bar | ✅ | ✅ | 9 | Pass 208 |
|  | Export conversation to markdown | ✅ | ✅ | 9 | Pass 208 |
|  | Export to GitHub Gist | ❌ | ⭐ | 9 | Pass 219 |
|  | Per-message diff view | 🔶 | ⭐ | 9 | Pass 205 — unified diff inline under write_file/edit_file events |
|  | Tool call summary chips | 🔶 | ⭐ | 9 | Pass 217 — `read 4 · grep 2 · edit 1` under every reply |
| **Project awareness** | CLAUDE.md auto-load | ✅ | ✅ | 9 | Pass 238 — also honors .stewardly/instructions.md + AGENTS.md |
|  | Workspace symbol index | ✅ | ✅ | 9 | Pass 242 — Ctrl+T navigator |
|  | Import/dependency graph | 🔶 | ⭐ | 9 | Pass 245 — ImportGraphPanel |
|  | Circular dependency detector | ❌ | ⭐ | 9 | Pass 247 — Tarjan's SCC |
|  | TODO/FIXME marker scanner | 🔶 | ⭐ | 9 | Pass 246 — 8 marker kinds + filters |
|  | Git status panel | 🔶 | ⭐ | 9 | Pass 244 — porcelain-v1 parser + diff viewer |
|  | Git worktree isolation | ✅ | ❌ | 0 | Can't spin up isolated worktree per task |
| **Memory** | Agent memory / persistent facts | ✅ | ✅ | 9 | Pass 241 — /remember command, category tags |
|  | Project instructions | ✅ | ✅ | 9 | Pass 238 |
|  | Scratchpad / notes drawer | ❌ | ⭐ | 9 | Pass 240 |
| **Permissions** | Per-tool allowlist | ✅ | ✅ | 9 | Pass 213 — role-gated intersection |
|  | Role-based write mode | 🔶 | ✅ | 9 | admin + allowMutations |
|  | Pre-tool approval prompt | ✅ | ❌ | 0 | No interactive approval dialog |
| **Productivity** | Edit undo/redo | 🔶 | ✅ | 9 | Pass 239 — ring buffer + Ctrl+Z |
|  | Pinned files | ❌ | ⭐ | 9 | Pass 224 — auto-expand into every prompt |
|  | Bookmarks / reactions / outline | ❌ | ⭐ | 9 | Pass 233–235 |
|  | Action palette (⌘K) | ❌ | ⭐ | 9 | Pass 248 |
|  | Vim-style key chords (g+c, g+f…) | ❌ | ⭐ | 9 | Pass 227 |
|  | Keyboard shortcuts overlay | ✅ | ✅ | 9 | Pass 209 |
| **Extensibility** | User-defined hooks (pre/post tool) | ✅ | ✅ | 8 | Pass 249 — PreToolUse/PostToolUse/SessionStart/UserPromptSubmit with matchers |
|  | Custom slash commands (user files) | ✅ | 🔶 | 4 | Built-ins only; no custom slash file loading yet |
|  | Custom subagent definitions | ✅ | ❌ | 0 | No ~/.claude/agents/*.md equivalent |
|  | Output style override | ✅ | ❌ | 0 | No output style switcher |
| **Analytics** | Session analytics dashboard | ❌ | ⭐ | 9 | Pass 243 — cost + tools + bytes + duration |
|  | Token/cost telemetry per message | ✅ | ✅ | 9 | Pass 210 |
|  | Context window usage meter | ✅ | ✅ | 9 | Pass 230 |

---

## Current focus areas (Pass 250+)

1. ~~**Hooks system**~~ — ✅ Pass 249
2. ~~**WebFetch tool**~~ — ✅ Pass 250
3. **WebSearch tool** — Add to Code Chat tool definitions (platform infra already exists)
4. **Custom subagents** — Agent definition files + inline spawn
5. **MCP tool provider** — Consume external MCP servers as additional tools
6. **NotebookEdit** — Jupyter notebook editing tool

---

## Changelog

| Pass | Date | Feature | Tests |
|---|---|---|---|
| 250 | 2026-04-11 | WebFetch tool (URL → markdown, SSRF-guarded) | +37 |
| 249 | 2026-04-11 | Hooks system (PreToolUse/PostToolUse/SessionStart/UserPromptSubmit) | +62 |
| 248 | 2026-04-11 | Action palette (⌘K unified launcher) | +21 |
| 247 | 2026-04-11 | Circular dependency detector (Tarjan's SCC) | +12 |
| 246 | 2026-04-11 | TODO/FIXME marker scanner tab | +26 |
| 245 | 2026-04-11 | Import/dependency graph panel | +32 |
| 244 | 2026-04-11 | Git status panel | +20 |
| 243 | 2026-04-11 | Session analytics dashboard | +20 |
| 242 | 2026-04-11 | Semantic symbol navigation (Go to Symbol) | +27 |
| 241 | 2026-04-11 | Agent memory — persistent facts | +33 |
| 240 | 2026-04-11 | Scratchpad side drawer | +27 |

---

## Reconciliation log

_Append an entry any time a parallel process's write to this file conflicted
with an in-flight build pass. Format: `YYYY-MM-DD — pass N — conflict desc — resolution`._

- 2026-04-11 — pass 249 — initial creation of PARITY.md — no conflict
