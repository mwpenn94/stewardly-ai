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
| G7  | tool        | `task` / subagent — spawn an isolated agent for a focused sub-task.                                | Claude Code `Task`               | P2       | done (pass 11) | 4     | build  | Shipped pass 11. New `TaskRunner` injection point on `dispatchCodeTool` (kept executor LLM-agnostic). Stream route builds the runner from `executeReActLoop` with: read-only tool subset (no writes/bash), max 10 iterations, fresh focused system prompt, recursion guard (subagents can't spawn sub-subagents), SSE events `subagent_start` / `subagent_tool_call` / `subagent_done` for live UI. 5 dispatcher tests (TASK_UNAVAILABLE, BAD_ARGS missing description, BAD_ARGS missing prompt, happy path with normalized args, TASK_FAILED on runner throw). |
| G8  | tool        | `notebook_edit` — Jupyter notebook cell editing.                                                   | Claude Code `NotebookEdit`       | P3       | open       | 0     | build  | Low demand for this codebase. |
| G9  | server      | Streaming tool-result diffs — stream hunks mid-execution rather than waiting for full after-buffer. | Cursor Composer                  | P2       | open       | 0     | build  |       |
| G10 | server      | File-change watcher — invalidate symbol + import graph caches on mtime change, not 60s TTL.        | JetBrains Fleet                  | P2       | done (pass 9) | 4     | build  | Shipped pass 9. Pure pub/sub registry `cacheInvalidation.ts` instead of chokidar (no native dep, no out-of-band false positives). 4 caches subscribed: symbolIndex (.ts/.tsx/.js), importGraph (.ts/.tsx/.js), todoMarkers (24 langs), workspaceFileIndex (allChanges). `notifyFileChanged` called from `writeFile`/`editFile`. TTL still fires for out-of-band changes. Reusable predicates: `allChanges`, `byExtension`, `bySubtree`. 19 new tests. |
| G11 | client      | Diff 3-way merge UI when two tools touch the same file in one session.                             | JetBrains, VS Code               | P2       | open       | 0     | build  |       |
| G12 | client      | Model comparison mode — run the same prompt against 2+ models side-by-side, pick winner.           | Cursor Composer, LMSYS           | P2       | done (pass 15) | 3     | build  | Shipped pass 15 (state machine + reducers). `modelComparison.ts` exposes `startComparisonRun`/`updateSlot`/`setWinner`/`summarizeRun`/`isComparisonComplete` — pure-function core for the side-by-side runner. Up to 4 slots per run, case-insensitive dedup, immutable updates, fastest/cheapest detection, unpriced-flag handling, terminal-state tracking. 21 new tests. **UI wiring deferred to a follow-on pass** — the runner is plumbed but the popover/render layer ships separately. |
| G13 | client      | Voice input for the prompt bar — browser SpeechRecognition.                                        | Cursor Composer voice            | P2       | done (pass 16+17) | 5     | build  | Shipped pass 16 (adapter) + pass 17 (UI). Adapter: `voiceInput.ts` (`isVoiceInputSupported`, `createVoiceRecognizer` state machine, `spliceTranscript` smart-merge). UI: lazy-created recognizer on first mic press (so the browser permission prompt only fires on demand), pulsing chart-3 ring while listening, hidden in browsers without SpeechRecognition support, error handling for not-allowed/no-speech/aborted. Documented in CODE_CHAT.md. 14 tests. |
| G14 | observability | Per-turn latency histogram in session analytics (p50/p95/p99).                                   | LangSmith                        | P2       | done (pass 6) | 4     | build  | Shipped pass 6. Pure `percentile` (linear interpolation) + `latencyHistogram` (9 fixed buckets, p50/p95/p99/min/max/mean), drops corrupt samples (NaN/negative/Infinity), wired into `analyzeSession` and rendered as a sortable strip + colored bar chart in `SessionAnalyticsPopover`. 15 new tests. |
| G15 | a11y        | High-contrast + focus-visible rings on every code-chat button. Verified w/ axe.                    | WCAG 2.4.7                       | P1       | done (pass 10) | 4     | build  | Shipped pass 10. Added aria-label to 4 unlabeled buttons (TraceView toggle, GrepResultView, MessageOutline, suggestion chips, file-explorer close, SessionAnalytics jump). Added focus-visible:ring-2 utility classes to 6 interactive surfaces. Added role=log + aria-live=polite + aria-busy on the messages container. New `a11yLint.test.ts` static-lint regression test that scans 12 Code Chat source files for unlabeled buttons (with smart visible-text detection). |
| G16 | perf        | Virtualize message list when >100 messages.                                                        | Cursor, VS Code                  | P2       | done (pass 18+19) | 5     | build  | Shipped pass 18 (windowing core) + pass 19 (renderer wiring). Core: `messageVirtualization.ts` (`computeWindow` + `segmentWindow` + `countRendered`, head/anchor/tail/pinned union, dedup, gap collapse). UI: `useMemo(virtWindow + virtVisibleSet)` + skip messages outside the visible set in the existing `messages.map` + a single placeholder card surfacing the total hidden count + bookmark/outline hint. Bookmarks become pinned anchors so starring an old message keeps it visible. 19 tests. |
| G17 | perf        | Lazy-load codeChat popovers (currently all import eagerly into CodeChat.tsx).                      | —                                | P1       | done (pass 12) | 5     | build  | Shipped pass 12. **Bundle dropped 318KB → 148KB (gzip 67KB → 37KB, -53%).** 17 popovers/panels converted from `import` to `lazy()` + `<Suspense>`. Each lazy component is gated on its open-state flag so the chunk download fires on first interaction and Suspense never blocks the critical path. Critical-path components (DiffView, MarkdownMessage, SlashCommandPopover, FileMentionPopover, PlanReviewPanel, AgentTodoPanel) stay eager. Split `DEFAULT_ENABLED_TOOLS` constant into its own `toolPermissionsDefaults.ts` module so the eager import doesn't drag the popover code back in. |
| G18 | tests       | End-to-end Playwright test for the full Code Chat flow (send → stream → tool → done).              | —                                | P1       | open       | 0     | build  |       |
| G19 | docs        | CODE_CHAT.md user guide: slash commands, chords, shortcuts, workflows.                             | Claude Code `README`             | P2       | done (pass 8) | 4     | build  | Shipped pass 8. `docs/CODE_CHAT.md` covers all 12 tools, all 16+ slash commands, 7 vim chords + global shortcuts, @file mentions, plan mode, agent memory, CLAUDE.md auto-loading, sessions library, scratchpad, every tab (Files/Diff/Git Status/Git Write/GitHub/Imports/TODOs/Roadmap/Jobs), cost+budget controls, streaming + tool visibility, privacy/safety. ~270 lines. |
| G20 | security    | CSP / XSS audit of MarkdownMessage rendering for user-supplied tool output.                        | —                                | P1       | done (pass 7) | 5     | build  | Shipped pass 7. New `markdownSafety.ts` module: `safeMarkdownUrl` (whitelist http/https/mailto/tel/anchor/relative; rejects javascript:, vbscript:, blob:, file:, data:, with control-char obfuscation defense), `safeImageSrc` (allows base64 PNG/JPG/GIF/WEBP; explicitly rejects SVG to block script-in-svg), `safeLinkProps` (drops unknown spread props so future remark plugins can't smuggle onclick/onerror), `trustedShikiHtml` (shape check on dangerouslySetInnerHTML payload). Wired into MarkdownMessage's `urlTransform`, custom `<a>`, `<img>`, and Shiki HTML branch. 37 new tests covering all XSS vectors. |
| G21 | ergonomics  | `/undo` slash command wired to edit-history ring buffer.                                           | Claude Code                      | P2       | done (pass 4) | 4     | build  | Shipped pass 4 with `/redo` for symmetry. Both reuse the existing `handleUndoEdit`/`handleRedoEdit` callbacks added in Pass 239 so the chord shortcut and the slash command operate on the same ring buffer. Action palette entries added. 6 new slash tests. |
| G22 | ergonomics  | Quick-switch prior conversation w/ Ctrl+P (palette-style).                                         | VS Code, Cursor                  | P2       | open       | 0     | build  | Partially covered by ⌘K. |
| G23 | client      | Inline `@symbol` mention (jump to definition popup, not just files).                               | Cursor                           | P2       | done (pass 13) | 4     | build  | Shipped pass 13. Type `#useAuth` in the chat input → SymbolMentionPopover opens with ranked workspace symbols. Pick one → input is rewritten as `[useAuth at client/src/hooks/useAuth.ts:42]` citation. New `symbolMentions.ts` parser (`extractActiveSymbolMention`, `replaceMentionWithCitation`, `extractSymbolCitations`) + `SymbolMentionPopover.tsx` (kind-colored badges, exported chip, file:line). Reuses existing `codeChat.findSymbols` tRPC query + symbol index from Pass 242. 22 new tests. |
| G24 | client      | Paste image to include as model input (multimodal).                                                | Cursor, Claude Code              | P2       | open       | 0     | build  | Needs model routing. |
| G25 | server      | Dispatcher input validation hardening — every required-string arg goes through `requireStringArg`. | —                                | P1       | done (pass 20) | 5     | build  | Found by build, not assessment. Pass 20 added `requireStringArg` + `badArgs` helpers; converted `String(call.args.x)` coercions to explicit validation across read_file/write_file/edit_file/list_directory/grep_search/run_bash/find_symbol. Empty strings still allowed where semantically valid (write_file content, edit_file newString deletion). 13 new tests covering null/undefined/whitespace/non-string rejection + empty-content acceptance + missing-arg edge cases. |

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
Pass 6 · angle: observability · queue: G14 (latency histogram) · 9ed8cf8 · shipped: percentile + latencyHistogram pure functions + analyzeSession integration + SessionAnalyticsPopover Latency section with bar chart + 15 new tests · deferred: G5–G13, G15–G20, G22–G24
Pass 7 · angle: security · queue: G20 (XSS audit) · 39e6536 · shipped: markdownSafety.ts (safeMarkdownUrl, safeImageSrc, safeLinkProps, trustedShikiHtml) wired into MarkdownMessage + 37 new tests · deferred: G5–G13, G15–G19, G22–G24
Pass 8 · angle: docs / discoverability · queue: G19 (CODE_CHAT.md user guide) · bdf9351 · shipped: docs/CODE_CHAT.md (12 tools, 16 slash commands, 7 chords, all features) · deferred: G5–G13, G15–G18, G22–G24
Pass 9 · angle: performance / freshness · queue: G10 (cache invalidation) · 61b632a · shipped: cacheInvalidation.ts pub/sub registry + 4 caches subscribed + fileTools notifyFileChanged hooks + 19 new tests · deferred: G5–G9, G11–G13, G15–G18, G22–G24
Pass 10 · angle: accessibility · queue: G15 (a11y audit) · cc43769 · shipped: aria-labels on 6 unlabeled buttons + focus-visible rings + role=log/aria-live/aria-busy on messages container + a11yLint.test.ts regression lint · deferred: G5–G9, G11–G13, G16–G18, G22–G24
Pass 11 · angle: feature completeness · queue: G7 (task subagent) · 7129ab0 · shipped: TaskRunner injection point + dispatcher case + recursion-guarded sub-ReAct-loop in stream route + SSE subagent_* events + 5 dispatcher tests · deferred: G5, G6, G8, G9, G11–G13, G16–G18, G22–G24
Pass 12 · angle: bundle size · queue: G17 (lazy popovers) · 6edc955 · shipped: 17 lazy popovers + Suspense gating + DEFAULT_ENABLED_TOOLS split — CodeChat chunk 318KB → 148KB (-53%) · deferred: G5, G6, G8, G9, G11–G13, G16, G18, G22–G24
Pass 13 · angle: ergonomics · queue: G23 (symbol mention) · 4242fbb · shipped: symbolMentions.ts parser + SymbolMentionPopover + chat input wiring + keyboard nav + 22 new tests · deferred: G5, G6, G8, G9, G11, G12, G16, G18, G22, G24
Pass 14 · angle: feature completeness (G23 follow-on) · queue: server-side citation auto-resolver · f70bf69 · shipped: server symbolCitations.ts (extractSymbolCitations + buildCitationContext + formatCitationOverlay) + stream-route resolution loop with line-window read + SSE citations_resolved event + 17 new tests · deferred: G5, G6, G8, G9, G11, G12, G16, G18, G22, G24
Pass 15 · angle: feature completeness · queue: G12 (model comparison runner) · 316059f · shipped: modelComparison.ts pure state machine (up to 4 slots, case-insensitive dedup, immutable updates, summarize fastest/cheapest, terminal detection) + 21 new tests · deferred: G5, G6, G8, G9, G11, G12-UI, G16, G18, G22, G24
Pass 16 · angle: ergonomics / mobile · queue: G13 (voice input adapter) · a1059a6 · shipped: voiceInput.ts SpeechRecognition wrapper (createVoiceRecognizer state machine + isVoiceInputSupported feature detect + spliceTranscript smart-merge) + 14 new tests with node-env window shim · deferred: G5, G6, G8, G9, G11, G12-UI, G13-UI, G16, G18, G22, G24
Pass 17 · angle: ergonomics / mobile · queue: G13-UI follow-on · 8da633a · shipped: lazy-created VoiceRecognizer in CodeChat.tsx + pulsing mic button next to Send + onTranscript merge with spliceTranscript + permission/error handling + CODE_CHAT.md doc + a11y lint passes · deferred: G5, G6, G8, G9, G11, G12-UI, G16, G18, G22, G24
Pass 18 · angle: performance · queue: G16 (message list virtualization core) · b169033 · shipped: messageVirtualization.ts (computeWindow head/anchor/tail/pinned union + segmentWindow run-collapse + countRendered) + 19 new tests · deferred: G5, G6, G8, G9, G11, G12-UI, G16-UI, G18, G22, G24
Pass 19 · angle: performance · queue: G16-UI follow-on · 1af5d88 · shipped: useMemo virtWindow + virtVisibleSet + messages.map skip-on-out-of-window + placeholder card with bookmark/outline hint + bookmarks act as pinned anchors · deferred: G5, G6, G8, G9, G11, G12-UI, G18, G22, G24
Pass 20 · angle: input validation / defensive · queue: G25 (NEW row from build assessment) · shipped: requireStringArg + badArgs helpers + dispatcher boundary hardening across 7 tools + 13 new tests · deferred: G5, G6, G8, G9, G11, G12-UI, G18, G22, G24

<!-- PASS_LOG_APPEND_HERE -->
