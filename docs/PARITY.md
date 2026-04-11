# PARITY.md — Code Chat vs. Claude Code / top comparables

This document is **bidirectional**: it is the shared work queue for the
self-directed build loop. Parallel processes and prior passes write
recommendations into the gap matrix; the build loop reads them, ships
code, and marks them done with a commit SHA.

> Scope: bring Stewardly's in-app **Code Chat** to parity with
> **Claude Code** (the CLI), **Cursor**, **Aider**, **Continue.dev**,
> and **VS Code Copilot Chat** — then push beyond.

## How to use this file

1. **Build loop** reads §Gap Matrix rows, executes in priority order,
   ticks the Status column with a commit SHA, bumps the Depth score.
2. **Assessment process** (or future-you) adds new rows to the matrix
   when it finds a gap. Mark `Found` = `build` or `assess`.
3. On conflict, **prefer recency** and drop the losing edit in §Reconciliation Log.
4. Never weaken a row marked in §Protected Improvements.
5. Append one line to §Build Loop Pass Log every pass.

## Protected Improvements (anti-regression)

The following capabilities must never be removed or weakened without
explicit user approval. Listed with the pass that shipped them.

- Pass 228–241: session library, tags, context meter, templates, compact,
  bookmarks, outline, reactions, pinned files, grep quick-jump, chord
  shortcuts, fork, cross-session search, budget, auto-checkpoint,
  command history search, tool-call summary, template variables, gist
  publishing, session analytics, symbol navigation, CLAUDE.md auto-load,
  edit history ring buffer, scratchpad, agent memory.
- Pass 242–248: symbol index, session analytics, git status panel,
  import/dependency graph, TODO marker scanner, circular dependency
  detector, action palette (⌘K).
- Build loop Pass 1: `glob_files` tool (Claude Code `Glob` parity).

## Gap Matrix

Columns:
- **Id** — short stable id (e.g. `G1`). Never renumber.
- **Area** — surface: tool, server, client, docs, tests, infra.
- **Gap** — one-line description.
- **Comparable** — which product has this; why it matters.
- **Priority** — P0 (critical) / P1 (high) / P2 (nice).
- **Status** — open / in_progress / done (SHA) / known-bad.
- **Depth** — 1–5 score of how thoroughly this is built out.
- **Found** — `assess` (assessment process) or `build` (build loop).
- **Notes** — scratchpad.

| Id  | Area        | Gap                                                                                               | Comparable                       | Priority | Status     | Depth | Found  | Notes |
|-----|-------------|---------------------------------------------------------------------------------------------------|----------------------------------|----------|------------|-------|--------|-------|
| G1  | tool        | `glob_files` — find files by glob pattern (e.g. `src/**/*.tsx`). No dep on grep.                   | Claude Code `Glob`, Aider        | P0       | done (pass 1) | 4     | build  | Shipped pass 1. `globMatcher.ts` pure `*`/`**`/`?`/`[]`/`{}`/`!`; `globFiles.ts` binds to cached `fileIndex`; wired into `dispatchCodeTool` + stream route + router `READ_ONLY_TOOLS` + `DEFAULT_ENABLED_TOOLS`. 32 matcher tests + 4 dispatcher tests. |
| G2  | tool        | `multi_read` — atomically read up to 10 files in one tool call. Saves round-trips.                 | Cursor, Continue                 | P1       | done (pass 2) | 4     | build  | Shipped pass 2. Per-file errors captured inline. `MultiReadEntry` result shape, cap at 10, filters non-string entries. 6 dispatcher tests. |
| G3  | tool        | `web_fetch` — fetch a URL's content (HTML→markdown) and pass to the model as context.              | Claude Code `WebFetch`           | P1       | done (pass 3) | 4     | build  | Shipped pass 3. Allowlist-gated (MDN, React, Node, GitHub, SEC/FINRA/IRS, AWS/GCP/Azure docs, Anthropic/OpenAI). SSRF-safe (blocks localhost, private IPs, 169.254.169.254 AWS metadata). HTML-to-text extractor preserves links as `text (href)`. 64KB cap. 29 webFetch tests + 3 dispatcher tests. |
| G4  | tool        | `web_search` — SERP search for recent docs/answers.                                                | Claude Code `WebSearch`, Cursor  | P1       | done (pass 5) | 4     | build  | Shipped pass 5. Reuses existing Tavily/Brave/Google/LLM cascade in `webSearchTool.ts`. New `executeWebSearchStructured` returns raw `SearchResult[]` + provider tag. Wired into dispatcher + read-only allowlist. 7 unit tests + 2 dispatcher tests. |
| G5  | tool        | `run_bash_background` — long-running shell process with output streaming.                          | Claude Code `run_in_background`  | P2       | open       | 0     | build  | Child process mgmt. |
| G6  | tool        | `monitor_process` — subscribe to a background process's output stream.                             | Claude Code `Monitor`            | P2       | open       | 0     | build  | Pairs with G5. |
| G7  | tool        | `task` / subagent — spawn an isolated agent for a focused sub-task.                                | Claude Code `Task`               | P2       | open       | 0     | build  | ReAct-in-ReAct. |
| G8  | tool        | `notebook_edit` — Jupyter notebook cell editing.                                                   | Claude Code `NotebookEdit`       | P3       | open       | 0     | build  | Low demand for this codebase. |
| G9  | server      | Streaming tool-result diffs — stream hunks mid-execution rather than waiting for full after-buffer. | Cursor Composer                  | P2       | open       | 0     | build  |       |
| G10 | server      | File-change watcher — invalidate symbol + import graph caches on mtime change, not 60s TTL.        | JetBrains Fleet                  | P2       | open       | 0     | build  | chokidar. |
| G11 | client      | Diff 3-way merge UI when two tools touch the same file in one session.                             | JetBrains, VS Code               | P2       | open       | 0     | build  |       |
| G12 | client      | Model comparison mode — run the same prompt against 2+ models side-by-side, pick winner.           | Cursor Composer, LMSYS           | P2       | open       | 0     | build  | Uses existing consensus. |
| G13 | client      | Voice input for the prompt bar — browser SpeechRecognition.                                        | Cursor Composer voice            | P2       | open       | 0     | build  |       |
| G14 | observability | Per-turn latency histogram in session analytics (p50/p95/p99).                                   | LangSmith                        | P2       | done (pass 6) | 4     | build  | Shipped pass 6. Pure `percentile` (linear interpolation) + `latencyHistogram` (9 fixed buckets, p50/p95/p99/min/max/mean), drops corrupt samples (NaN/negative/Infinity), wired into `analyzeSession` and rendered as a sortable strip + colored bar chart in `SessionAnalyticsPopover`. 15 new tests. |
| G15 | a11y        | High-contrast + focus-visible rings on every code-chat button. Verified w/ axe.                    | WCAG 2.4.7                       | P1       | open       | 0     | build  | Audit pass needed. |
| G16 | perf        | Virtualize message list when >100 messages.                                                        | Cursor, VS Code                  | P2       | open       | 0     | build  | react-window. |
| G17 | perf        | Lazy-load codeChat popovers (currently all import eagerly into CodeChat.tsx).                      | —                                | P1       | open       | 0     | build  | Code-split. |
| G18 | tests       | End-to-end Playwright test for the full Code Chat flow (send → stream → tool → done).              | —                                | P1       | open       | 0     | build  |       |
| G19 | docs        | CODE_CHAT.md user guide: slash commands, chords, shortcuts, workflows.                             | Claude Code `README`             | P2       | open       | 0     | build  |       |
| G20 | security    | CSP / XSS audit of MarkdownMessage rendering for user-supplied tool output.                        | —                                | P1       | open       | 0     | build  |       |
| G21 | ergonomics  | `/undo` slash command wired to edit-history ring buffer.                                           | Claude Code                      | P2       | done (pass 4) | 4     | build  | Shipped pass 4 with `/redo` for symmetry. Both reuse the existing `handleUndoEdit`/`handleRedoEdit` callbacks added in Pass 239 so the chord shortcut and the slash command operate on the same ring buffer. Action palette entries added. 6 new slash tests. |
| G22 | ergonomics  | Quick-switch prior conversation w/ Ctrl+P (palette-style).                                         | VS Code, Cursor                  | P2       | open       | 0     | build  | Partially covered by ⌘K. |
| G23 | client      | Inline `@symbol` mention (jump to definition popup, not just files).                               | Cursor                           | P2       | open       | 0     | build  | Reuses symbolIndex. |
| G24 | client      | Paste image to include as model input (multimodal).                                                | Cursor, Claude Code              | P2       | open       | 0     | build  | Needs model routing. |

## Reconciliation Log

No conflicts yet. Append entries as `YYYY-MM-DD — row Id — edits reconciled because X`.

## Known-Bad (dead ends)

Append findings that were tried and abandoned. Do not re-attempt without
reading this section first.

_(empty)_

## Build Loop Pass Log

Append one line per pass: `Pass N · angle · queue · commit SHA · shipped · deferred`.

Pass 1 · angle: correctness + tool parity · queue: G1 (glob_files) · 8bae6a0 · shipped: globMatcher.ts + globFiles.ts + executor dispatch + stream/router wiring + 36 new tests · deferred: G2–G24

Pass 2 · angle: performance / round-trip reduction · queue: G2 (multi_read) · 37976cd · shipped: multi_read tool + dispatcher + stream/router wiring + 6 new tests · deferred: G3–G24
Pass 3 · angle: feature completeness · queue: G3 (web_fetch) · 06961b5 · shipped: webFetch.ts (SSRF-safe allowlist, HTML-to-text, size cap, timeout) + dispatcher + 32 new tests · deferred: G4–G24
Pass 4 · angle: ergonomics / discoverability · queue: G21 (/undo /redo slash) · 814745a · shipped: /undo + /redo slash commands wired to edit-history ring buffer + action palette entries + 6 new tests · deferred: G4–G20, G22–G24
Pass 5 · angle: feature completeness · queue: G4 (web_search) · f3392aa · shipped: executeWebSearchStructured wrapper + dispatcher case + read-only allowlist wiring + 9 new tests · deferred: G5–G20, G22–G24
Pass 6 · angle: observability · queue: G14 (latency histogram) · shipped: percentile + latencyHistogram pure functions + analyzeSession integration + SessionAnalyticsPopover Latency section with bar chart + 15 new tests · deferred: G5–G13, G15–G20, G22–G24

<!-- PASS_LOG_APPEND_HERE -->
