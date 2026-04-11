# PARITY.md

> Canonical parity tracking doc for Stewardly Code Chat vs. Claude Code (and adjacent comparables: Cursor Composer, Aider, Cline, Windsurf Cascade, Continue.dev, Codex CLI).
>
> **This file is written in parallel by multiple optimization processes. Always re-read immediately before writing. Merge, don't overwrite.**
>
> See the Universal App Optimization Prompt v2 + the Parity Assessment Mode extension (commit context) for the assessment protocol.

## Meta

- **Last updated:** 2026-04-11T00:00:00Z by parity-pass-1 (claude/optimize-app-parity-FRm86)
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

## Reconciliation log

(append-only, one line per merge event)

- 2026-04-11T00:00:00Z — parity-pass-1 — initial creation, no prior version to merge.

## Changelog

(append-only, one line per pass, most recent first)

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
