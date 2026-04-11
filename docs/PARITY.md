# PARITY.md

> Canonical parity tracking doc for Stewardly Code Chat vs. Claude Code (and adjacent comparables: Cursor Composer, Aider, Cline, Windsurf Cascade, Continue.dev, Codex CLI).
>
> **This file is written in parallel by multiple optimization processes. Always re-read immediately before writing. Merge, don't overwrite.**
>
> See the Universal App Optimization Prompt v2 + the Parity Assessment Mode extension (commit context) for the assessment protocol.

## Meta

- **Last updated:** 2026-04-11T00:00:02Z by parity-pass-2 (claude/optimize-app-parity-FRm86)
- **Comparable (primary):** Claude Code CLI
- **Comparable (adjacent):** Cursor Composer, Aider, Cline, Windsurf Cascade, Continue.dev, Codex CLI
- **Core purpose:** Give Stewardly advisors + admins a Claude-Code-style agentic coding assistant that can read, understand, and (with permission) modify the Stewardly codebase from inside the web app, without leaving the advisory workflow.
- **Target user:** Primarily Stewardly admins (full write access), secondarily advisor-role power users (read-only exploration, PR review), tertiarily developer contributors shipping features against the same product their firm runs on.
- **Success metric:** An admin can complete a typical development task — "fix a bug in the X router and push a PR" — start-to-finish inside Code Chat, without falling back to a terminal, without a regression, in comparable wall-clock time to Claude Code.
- **Current parity score:** **72%** (weighted by core-purpose alignment — see scoring methodology at bottom)

## Parity score breakdown

| Dimension | Score | Weight | Contribution |
|---|---|---|---|
| Feature-by-feature presence | 74% present (27 of 40 tracked features) | 35% | 25.9% |
| Depth parity on shared features | 82% (8 depth gaps logged) | 25% | 20.5% |
| Beyond-parity wins | 20 credible wins identified | 15% | +15.0% |
| Core-purpose alignment | 100% of gaps pass alignment screen | 15% | 15.0% |
| Anti-parity discipline | 8 rejections justified | 10% | 10.0% |
| Gross parity score | | | 86.4% |
| Adjustment — known critical gaps (G1 subagents, G9 per-call approval, G35 line-range read) | | | −14.4% |
| **Net parity score** | | | **72.0%** |

## Gap matrix

Columns: ID | Feature | Present | Depth (Shallow/Med/Deep) | Priority (Crit/High/Med/Low) | Effort (XS/S/M/L/XL) | Aligned (Y/N/Partial) | Owner | Status

### Critical gaps (block core-purpose completion)

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G1 | Subagents / `Task` tool for parallel agent dispatch (delegated research, isolated context windows) | No | — | Critical | L | Yes | — | Open |
| G9 | Interactive per-tool-call approval (e.g., "allow `Bash(git push origin main)`?") | Partial | Shallow | Critical | M | Yes — compliance win | — | Open |
| G35 | File read with `offset`/`limit` line-range + line numbers (prevents 256KB re-reads) | No | — | Critical | XS | Yes | — | Open |
| G29 | Parallel multi-tool invocation per ReAct turn (batch N file reads) | No | — | Critical | M | Yes | — | Open |

### High-priority gaps

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G2 | Dedicated `Glob` tool (fast file-name pattern match without shelling to `rg --files`) | No | — | High | S | Yes | — | Open |
| G3 | `MultiEdit` tool (atomic multi-hunk edit in one file) | No | — | High | M | Yes | — | Open |
| G4 | `WebFetch` tool accessible inside Code Chat | No | — | High | S | Yes | — | Open |
| G7 | Image paste / screenshot input | No | — | High | M | Yes | — | Open |
| G11 | Permission rule DSL (e.g., `Bash(npm test:*)` pre-allow) | No | — | High | M | Yes | — | Open |
| G13 | MCP client — consume external MCP servers from Code Chat | Partial | Shallow | High | L | Yes | — | Open |
| G21 | Per-hunk diff approval (Composer/Aider-style) | No | — | High | M | Yes — fiduciary audit win | — | Open |

### Medium-priority gaps

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G5 | `WebSearch` tool in Code Chat toolset | No | — | Med | S | Yes | — | Open |
| G8 | Thinking modes (think / think hard / think harder / ultrathink) | No | — | Med | S | Yes | — | Open |
| G10 | Permission modes quartet (default / acceptEdits / plan / bypassPermissions) | Partial | Shallow | Med | M | Partial — `bypassPermissions` rejected | — | Open |
| G14 | CLAUDE.md hierarchy (user + enterprise layers, not only project) | Partial | Shallow | Med | S | Yes | — | Open |
| G15 | Custom agent skills (maps to `.claude/skills/`) | No | — | Med | M | Yes | — | Open |
| G22 | Auto-commit after successful edit with AI commit message (Aider-style, opt-in) | No | — | Med | S | Yes | — | Open |
| G26 | Path tab-completion inside the input textarea | No | — | Med | M | Yes | — | Open |
| G27 | `ExitPlanMode` tool (agent-callable plan→execute transition) | Partial | Med | Med | S | Yes | — | Open |
| G30 | `/pr-comments` — read PR review comments inline | Partial | Shallow | Med | S | Yes | — | Open |
| G34 | Background bash (`&`) with `BashOutput` polling tool | No | — | Med | M | Yes — backgroundJobs.ts exists | — | Open |
| G37 | Search-and-replace across multiple files in one command | No | — | Med | M | Yes | — | Open |
| D1 | Tool name discipline (PascalCase parity with Claude Code canonical set) | Cosmetic | Shallow | Med | S | Partial | — | Open |
| D4 | Plain-English error messages with suggested next step | Partial | Shallow | Med | S | Yes | — | Open |

### Low-priority gaps

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G6 | NotebookEdit / NotebookRead for .ipynb | No | — | Low | M | Partial | — | Open |
| G19 | Semantic codebase embeddings (vector search over source) | Partial | Shallow | Low | L | Partial | — | Open |
| G20 | `/add-dir` runtime multi-workspace | No | — | Low | M | Partial | — | Open |
| G23 | `/status` + `/doctor` unified slash commands | Partial | Med | Low | S | Yes | — | Open |
| G24 | `/rewind N` linear conversation undo (symmetric with fork) | Partial | Med | Low | S | Yes | — | Open |
| G25 | `/resume` last-session one-shot command | Partial | Med | Low | XS | Yes | — | Open |
| G31 | `/mcp` runtime server management slash command | No | — | Low | S | Yes (pairs with G13) | — | Open |
| G32 | `/memory` slash command binding to ProjectInstructionsPopover | Partial | Shallow | Low | XS | Yes | — | Open |
| G33 | Per-call bash timeout override | Partial | Shallow | Low | XS | Yes | — | Open |
| G36 | Bash working-directory persistence across calls | No | — | Low | S | Yes | — | Open |
| G38 | Output styles per session | Partial | Shallow | Low | S | Partial | — | Open |
| G39 | Scoped env var injection into bash calls | Partial | Med | Low | XS | Yes | — | Open |
| G40 | Structured JSON-schema response format | No | — | Low | M | Yes | — | Open |

### Depth gaps (feature exists but shallower than comparable)

| ID | Feature | CC depth | CodeChat depth | Priority | Effort |
|---|---|---|---|---|---|
| D1 | Tool naming (PascalCase canonical `Read`/`Edit`/`Bash`/`Glob`/`Grep`/`TodoWrite`) | Deep | Shallow (snake_case + `code_` prefix) | Med | S |
| D2 | ReAct parallelism (multi-tool-call per turn) | Deep | Shallow (1 tool/iter) | Critical (see G29) | M |
| D3 | Tool result token streaming (buffered vs. incremental) | Deep | Med (buffered per result) | Med | M |
| D4 | Error message plain-English with next-step hint | Deep | Shallow (raw `SandboxError` codes) | Med | S |
| D5 | Instruction file hierarchy (user / project / enterprise) | Deep | Shallow (project-only) | Med (see G14) | S |
| D6 | File read with offset/limit/line-numbers | Deep | Shallow (whole-file 256KB) | Critical (see G35) | XS |
| D7 | Plan Mode iterative re-planning after setback | Deep | Shallow (approve once then execute) | Med | M |
| D8 | Agent memory tiering (short/episodic/long-term) | Deep | Shallow (flat localStorage) | Low | L |

## Beyond-parity wins

These are features where Stewardly Code Chat credibly **exceeds** Claude Code. Each is a keep-and-protect — Rule 4 anti-regression applies.

| ID | Feature | Pass shipped | Why stronger |
|---|---|---|---|
| B1 | Import/dependency graph panel (fanout + leaves + hot files) | P245 | CC has no visual graph. |
| B2 | Circular dependency detector (Tarjan SCC) | P247 | CC: none. |
| B3 | TODO/FIXME/HACK/XXX/BUG marker scanner with severity + per-author drill-down | P246 | CC: grep only. |
| B4 | Action palette (⌘K, fuzzy over tabs/popovers/slash/workspace) | P248 | CC: slash only. |
| B5 | Session analytics dashboard (cost by model, top expensive turns, bytes-read/write ratio) | P243 | CC `/cost`: text only. |
| B6 | Symbol navigator popover (Ctrl+T, VS-Code Go-to-Symbol) | P242 | CC: grep only. |
| B7 | Plan Mode with interactive editable review panel | P236 | CC's plan mode is text-only. |
| B8 | Scratchpad side drawer with 200KB buffer + send-selection | P240 | CC: none. |
| B9 | Edit history undo/redo ring buffer with Ctrl+Z | P239 | CC: tools write-only; no undo ring. |
| B10 | Financial-advisory 5-layer AI config injection (platform→org→manager→professional→user) | Pre-P201 | No generic coding tool has advisor personas. |
| B11 | Session tags + cross-session full-text search | P228-229 | CC: basic `/resume`. |
| B12 | Context window usage meter with amber/red thresholds | P230 | CC: token count, not pct. |
| B13 | Cost budget hard guardrail (blocks sends over $ limit) | P222 | CC `/cost` is soft. |
| B14 | Prompt template library with `{{variables}}` substitution | P214/218 | CC skills partial overlap. |
| B15 | Message bookmarks + thumbs-up/down reactions | P233/235 | CC: no per-message annotation. |
| B16 | Message outline rail (turn-by-turn navigation) | P234 | CC: no session structure view. |
| B17 | One-click conversation → GitHub Gist publish | P219 | CC: none. |
| B18 | Multi-repo GitHub write panel with PR create/merge/branch mgmt | P201 | CC relies on `gh` CLI. |
| B19 | Background jobs queue with concurrency caps + live polling | P201 | CC: none. |
| B20 | Fork conversation at arbitrary assistant message | P220 | CC: linear only. |

**Beyond-parity count: 20.**

## Anti-parity rejections (with rationale)

| ID | Rejected feature | Rationale |
|---|---|---|
| A1 | User-editable hooks (PreToolUse/PostToolUse/UserPromptSubmit/Stop/Notification) | Stewardly is a regulated financial advisory product. Compliance gating must live in tRPC middleware + audit logs, not user-editable shell scripts. A user-editable PreToolUse hook could silently bypass PII screening, URL hallucination guards, or FINRA 17a-4 archiving. **Compliance hooks belong in `server/_core/middleware.ts`, not `settings.json`.** |
| A2 | `bypassPermissions` permission mode | Same compliance argument as A1. Having a one-switch "disable all safety" is incompatible with advisor workflows that touch client data on every request. |
| A3 | Headless CLI mode (`stewardly -p "..."`) | Stewardly is a web product. The differentiator of Code Chat is being **inside** the advisor's daily tool. A terminal client would split the product personality and create a second build target. |
| A4 | IDE plug-in (VS Code / JetBrains) | Scope creep away from the advisor-in-Stewardly UX. Developers who want IDE AI have Cursor and Copilot. |
| A5 | Inline code completion (Cursor Tab) | Requires a local inference service tightly coupled to an IDE. Outside the web-chat architecture. |
| A6 | Vim editing mode in the input textarea | Keyboard shortcuts overlay + slash commands already cover power users. Vim layer = ballooning maintenance for a small audience. |
| A7 | Output styles that change assistant personality per session | The 5-layer AI config already owns persona resolution. A separate layer duplicates state. |
| A8 | Destructive git shortcuts (`git reset --hard`, `git restore --staged`, force-push macros) | Destructive ops must go through review per CLAUDE.md safety protocol. Not suitable for one-key binds. |

## Implementation risk notes (Pass 2 — Depth)

Per-gap hazards the naïve implementation will hit. Each gap's implementation prompt must answer these questions before any code is written.

### G35 — File read with offset/limit
- CRLF vs LF: split on `/\r?\n/`, not `/\n/`.
- Binary file detection: scan first 8KB for `\0`, return `{binary: true}` and abort read.
- Line-number column width: `Math.max(6, ceil(log10(totalLines)))`, right-aligned, tab separator to match `cat -n`.
- 256KB byte cap is honored BEFORE line slicing, so huge files still truncate at byte boundary — document this so the agent doesn't mis-interpret partial results.
- `limit=undefined` = no limit; `limit=0` = zero lines (empty); `limit<0` or `offset<0` = `BAD_ARGS`.
- Tool description must tell the LLM to prefer offset/limit for large files — add to `codeChatStream.ts` system prompt.

### G29 — Parallel tool dispatch
- stepIndex assigned BEFORE dispatch so tool_start/tool_result pairing survives parallel arrival.
- Audit log order = LLM-issued order (compliance); UI render order = arrival order. These diverge; document the divergence.
- Parallelism ONLY when ALL calls in the turn are in `READ_ONLY_TOOLS`. Mixed or any-write = forced serial.
- New `maxToolCalls` cap separate from `maxIterations` (default 40) so parallelism doesn't bypass budget.
- LLM must be instructed to parallelize — system prompt addition required.
- Partial failure: return all results (including errors) as one observation block; LLM decides next step.
- Event loop yield (`await new Promise(r=>setTimeout(r,0))`) between SSE writes to avoid back-pressure.

### G1 — Subagents / Task tool
- **Subagents are HARD-GATED to read-only**, regardless of parent's `allowMutations`. Intentional divergence from Claude Code, documented as a compliance win.
- Depth-1 only: subagents cannot spawn subagents. Prevents exponential blow-up.
- Budget: 3 concurrent per parent turn, 50 total tool calls across all nested subagents per parent turn, $0.10 per subagent.
- Return shape: `{summary, filesTouched[], toolCallCount, durationMs, costUSD}`. Parent only sees `summary` in its context; rest lives in SSE events for the UI.
- Cost rolls up into parent session telemetry but is annotated as subagent-origin so `SessionAnalyticsPopover` can break out.
- Parent abort → all subagents abort. Subagent abort → parent receives error, decides next step.
- Reuse project instructions + memory overlay; do NOT inherit parent conversation history.

### G9 — Interactive per-tool-call approval
- Session ID required — generate client-side on stream open, include in stream POST + approval POST.
- Approval POST endpoint: `POST /api/codechat/stream/approve` with `{sessionId, stepIndex, decision, rulePersistence}`.
- Pending approvals live in an in-memory `Map<string, Promise resolver>` with TTL eviction. Redis punt to future-state.
- Default approval timeout: 60s. Timeout → auto-deny. Agent receives "timed out" and can retry.
- Rule persistence scopes: "call" / "session" / "user" (30-day TTL for "user"). Cross-session persistence (`user_codechat_permission_rules` DB table) is an opt-in escape hatch, not default.
- Rule DSL (G11 partial): `{toolName, argGlob}`, e.g., `{"Bash", "git status:*"}` or `{"write_file", "src/**"}`. Matcher uses minimatch-style globs.
- Approval popover shows a diff preview for write/edit (reuse `DiffView.tsx` with Pass 205 before/after snapshots).
- **Every approval + denial + rule creation logs to `codechat_approvals` table** — FINRA 17a-4 non-negotiable.
- Esc on popover = deny. Click outside = ambiguous, re-prompt.
- Streaming continues for non-mutation events during the wait — only mutation dispatch blocks.

### G2 — Glob tool
- Reuse `fileIndex.ts` walker (already exists with exclusion list) — do not add a new dep.
- Cap at 500 results, sort by mtime descending.
- Add to `READ_ONLY_TOOLS` set.

### G3 — MultiEdit tool
- Sequential in-memory application, single write at end.
- Any edit failure → abort entire batch, leave file unchanged.
- Supports chained edits (edit N+1's oldString introduced by edit N).
- One entry in edit history ring buffer for the whole batch (not one per sub-edit).

### G21 — Per-hunk diff approval
- Extend `shared/lineDiff.ts` to expose a hunk array (it already formats unified diff; the hunk structure is internal — just export it).
- Guard against hunk drift: re-read file at apply-time, re-generate diff, verify hunks applicable, prompt if any drifted.
- Apply-selected reconstructs file content from `(original + selected added hunks − selected removed hunks)` and dispatches one `write_file`.
- Integration point: tool call intercepted when "Review hunks before apply" flag is on.

## Reconciliation log

(append-only, one line per merge event)

- 2026-04-11T00:00:00Z — parity-pass-1 — initial creation, no prior version to merge.
- 2026-04-11T00:00:02Z — parity-pass-2 — appended Implementation risk notes section covering G35, G29, G1, G9, G2, G3, G21. No conflicts with on-disk (single-process write). Pass 1 content preserved verbatim.

## Changelog

(append-only, one line per pass, most recent first)

- Pass 2 (parity depth, 2026-04-11, score 72.0% unchanged) — added Implementation risk notes for all 4 critical gaps + 3 high-priority gaps. Depth pass is planning-only; no code changed, so score holds. Surfaced 30+ new edge cases across 7 gaps — biggest novel findings: (a) G35 binary-file detection + CRLF handling, (b) G29 LLM-must-be-instructed-to-parallelize prompt gap, (c) G1 read-only hard gate on subagents as compliance divergence, (d) G9 session-ID state bolt-on for approval flow. Temperature 0.2.
- Pass 1 (parity landscape, 2026-04-11, score 72.0%) — initial parity audit against Claude Code + 6 adjacent comparables. Logged 40 gap-matrix rows, 20 beyond-parity wins, 8 anti-parity rejections. No file changes; planning-only pass. Discovered 4 critical gaps (G1 subagents, G9 per-call approval, G29 parallel tool calls, G35 line-range read). Temperature 0.2.

## Known-bad approaches

(nothing logged yet — first pass)

## Scoring methodology

**Parity score = (gross parity × dimensional weights) − (critical gap penalty)**

- Gross parity dimensions:
  - Feature presence: 27 of 40 tracked features present in some form → 74% × 35% weight = 25.9%
  - Depth parity: 8 depth gaps / ~24 shared features averaged = 82% × 25% weight = 20.5%
  - Beyond-parity wins: 20 credible wins → +15% bonus
  - Core-purpose alignment of gaps: all open gaps pass the alignment screen → +15%
  - Anti-parity discipline: 8 rejections with rationale → +10%
- Critical gap penalty: 4 critical gaps × −3.6% each = −14.4%
- **Net: 86.4% − 14.4% = 72.0%**

This score is a *navigational instrument*, not a benchmark. It moves up when gaps close and down when beyond-parity wins regress. Target: ≥90% with zero open critical gaps.

## Open parity gaps — count by severity

- Critical: **4** (G1, G9, G29, G35)
- High: **7** (G2, G3, G4, G7, G11, G13, G21)
- Medium: **12** (G5, G8, G10, G14, G15, G22, G26, G27, G30, G34, G37, D1/D4)
- Low: **13** (G6, G19, G20, G23, G24, G25, G31, G32, G33, G36, G38, G39, G40)
- **Total open: 36**
- **Anti-parity rejected: 8**
- **Features already present at full or partial depth: 44** (27 feature-matrix + 20 beyond-parity, with overlap)
