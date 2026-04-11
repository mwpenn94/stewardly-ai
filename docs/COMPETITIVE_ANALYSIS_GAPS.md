# Stewardly Competitive Parity Analysis & Gap Register

**Date:** 2026-04-11
**Branch:** `claude/competitive-analysis-gaps-3rGYY`
**Method:** 10 recursive analysis passes — each a fresh angle — culminating in a pasteable implementation prompt.
**Posture:** Assessment & planning only. No code changes in this doc.

---

## Executive Summary

Stewardly has beyond-parity scope on paper (128 pages / 356 tables / 447+ codeChat tests) but is **uneven at the interface boundaries**: the inward-facing primitives (schema, context assembler, SRS, graduated autonomy, webhook receiver, file parser) are genuinely production-grade, while the outward-facing ones (generic REST ingestion, outbound messaging, workflow runtime, agent execution runtime, per-user personalization loop) are scaffolded or stubbed.

The biggest force-multiplier gap is **not any individual feature** — it is the **absence of a universal connector + schema-discovery layer** that would let any of the other verticals (learning, financial twin, CRM, workflow, agentic) consume data that Stewardly doesn't have a pre-written adapter for. Fixing that one layer promotes every other vertical from "demo" to "compounds on live data."

Competitive posture by vertical:

| Vertical | Stewardly today | Best-in-class | Verdict |
|---|---|---|---|
| AI Chat (Single/Loop/Consensus) | Multi-mode + consensus + SSE + voice | Claude, ChatGPT, Perplexity, Gemini | **At parity on primitives**; behind on artifacts/canvas, memory UX, vision, tool transparency |
| Code Chat | 447+ tests, symbol index, plan mode, agent memory, edit history, scratchpad | Cursor, Claude Code, Aider, Devin, v0 | **At parity with Claude Code terminal**; behind on composer/MCP/desktop sandbox/remote exec |
| Learning | SRS + imported EMBA content + 128 pages + exam sim | Duolingo, Brilliant, Khan, Anki, Kaplan | **Behind on adaptive path**; missing teacher model, audio/video, generative lessons |
| Financial Services | 30+ tRPC procs, calculators, PDF reports, consensus | Bloomberg Terminal, Wealthfront, Morningstar, YCharts | **Behind on live data** — no Plaid/market tick ingestion, static plans |
| Integration/Ingestion | 20 seeded providers, 2-5 real clients, generic webhook receiver | Fivetran, Airbyte, Hightouch, Zapier | **Behind on generic** — no arbitrary REST, no schema discovery, no RSS/scrape/OCR |
| CRM/Marketing | GHL real + Wealthbox/Redtail env-gated + in-app-only delivery | HubSpot, Salesforce, Attio, Apollo | **Behind on outbound** — no SendGrid/Twilio/SMTP, no drip scheduler |
| Workflow engine | 5 templates + DB persistence + checklist | LangGraph, Temporal, n8n, Zapier | **Behind on runtime** — no DAG editor, no step executor, no HITL gates |
| Agentic AI | Agent CRUD + graduated autonomy + background jobs in-memory | LangGraph agents, Devin, Cognition, AutoGen | **Behind on orchestration** — no inter-agent comms, no durable queue, no user-authored agents |
| Personalization | User memories + context assembler + SRS + A/B | Netflix/Spotify/Duolingo | **Behind on loop** — feedback collected but not fed back |

**Priority recursive implementation sequence (derived in Pass 10):**

1. **Universal Connector v1** (generic REST + schema discovery + RSS/HTML/OCR)
2. **Durable Job Runtime** (BullMQ or equivalent) — unblocks workflow executor + agent runtime + ingestion retries
3. **Workflow Executor** (run DAG steps against the tool registry) — unblocks every template
4. **Outbound Messaging Gateway** (SendGrid/Twilio abstraction) — unblocks drip + notifications + compliance logging
5. **Personalization Feedback Loop** (wire ratings → context assembler → model routing) — unblocks every "continuous improvement" claim
6. **Live Data Pipes** (Plaid + FRED + market ticks) — unblocks financial twin + proactive insights
7. **Generative Teacher Model for Learning** — unblocks adaptive exercises + audio/video content
8. **Agent Marketplace Primitive** — unblocks user-authored agents + inter-agent comms
9. **Composer/Multi-file Edit Mode for Code Chat** — unblocks true Cursor parity
10. **Artifacts/Canvas for AI Chat** — unblocks true Claude parity

---

---

## Pass 1 — Landscape & Reality Check (Novel Angle: "What the CLAUDE.md file ACTUALLY proves")

### Pass framing

Before comparing to competitors, establish the ground truth. CLAUDE.md says 128 pages, 356 tables, 447+ Code Chat tests. But claims ≠ capability. This pass maps every claim in CLAUDE.md onto **one of four buckets**: (a) production-wired, (b) env-gated (real client, waits for credentials), (c) scaffolded (UI + schema + router but no runtime), (d) seeded (metadata only, no code behind it).

### Bucket A — Production-wired (works now, no env needed)

- **File import engine** (`server/services/import/fileRouter.ts:53-129`, `importOrchestrator.ts:19-91`, `fieldMapper.ts:35-60`) — CSV/XLSX/JSON/XML/PDF/DOCX/VCF/ZIP, auto field detection, dedup by email/phone hash, CSV injection sanitizer.
- **Generic webhook receiver** (`server/services/webhookIngestion.ts:129-250`) — HMAC verification, rate-limit tracking, event log persistence, manual retry.
- **Scheduler cron registry** (`server/services/scheduler.ts:35-71`) — 15m health checks, 6h pipelines, cleanup jobs. Real `cron.schedule()` wiring.
- **SRS engine** (`server/services/learning/mastery.ts:18-100`) — SM-2 with [0, 1, 3, 7, 14, 30] day intervals, pure-function unit-tested `scheduleNextReview()`.
- **Graduated autonomy DB** (`server/services/graduatedAutonomy.ts:52-87`) — `agent_autonomy_levels` table, 4 trust tiers with real `minTrustScore | minInteractions | maxEscalationRate` enforcement.
- **Context assembler** (`deepContextAssembler.ts:86-150`) — 14 parallel sources with per-type token budgets.
- **Consensus streaming** (`consensusStream.ts:19-*`, `server/routers/wealthEngine.ts` consensus subtree) — real parallel LLM calls, semantic agreement scorer, synthesis prompt.
- **Code Chat symbol/import/git/TODO/circular-deps panels** — all backed by real cached services in `server/services/codeChat/*.ts`, all unit-tested.
- **Voice I/O** (`useVoiceRecognition`, `useTTS`) — Web Speech + Edge TTS server at `/api/tts`.
- **Wealth Engine calculators** — UWE 944 LOC, BIE, HE, MC all server-side, pure, 583+ tests.

### Bucket B — Env-gated (code exists, waits for credentials)

- **GoHighLevel** (`ghl/ghlClient.ts:1-326`) — v1 + v2 OAuth with refresh, HMAC webhooks.
- **Wealthbox** (`wealthboxClient.ts:1-80`) — REST client, pagination, retry-after.
- **Redtail** (`redtailClient.ts:1-62`) — dual-key auth.
- **SnapTrade** (`snapTrade.ts:34-50+`) — per-user brokerage linking.
- **Enrichment waterfall** (`enrichment/enrichmentOrchestrator.ts:18-58`) — PDL → Clearbit → Apollo → AI fallback, fair-lending sanitizer.
- **Plaid** — health check only; production client file exists but not traced end-to-end.
- **FRED / Census / BLS / BEA / SEC-Edgar / FINRA / ATTOM / Canopy / Compulife / People Data Labs / CoreLogic** — all seeded in `seedIntegrations.ts` with only metadata rows; no real client code behind them.
- **Edge TTS** — real library (`msedge-tts`) wired, produces real audio bytes at `/api/tts`.

### Bucket C — Scaffolded (UI + schema + router but no runtime)

- **Workflow engine** — `workflow_instances` table persists state, 5 templates defined with `step.type: llm_call | tool_call | human_review | wait | branch`, but the **execution runtime that reads a step and performs the action is not present** in `workflowAutomation.ts`. The router is CRUD-only.
- **Agent marketplace** — `agent_instances` + `agent_actions` tables exist, `openClawManager.ts` has CRUD, graduated autonomy enforces trust — but the **agent runtime that takes an instance and runs a turn is not a durable job**, it's in-memory with no queue (`backgroundJobs.ts` from Pass 201 is a Map + concurrency cap).
- **Financial twin auto-recompute** — `MyFinancialTwin.tsx` renders, `proactiveInsights` table exists, but **no trigger fires recalculation on account balance change, market event, or life event**. Static scenarios only.
- **Tax optimization** — `FinancialPlanning.tsx` Roth conversion tab runs client-side Monte Carlo with **zero tax bracket logic**, no state rules, `uwe.ts taxRate` is a flat parameter.
- **A/B testing framework** — `promptVariants` + `promptExperiments` + chi-squared significance exist, but `templateOptimizer.ts:29` simulates scores — **the eval harness is stubbed**.
- **Template scoring / prompt optimization** — `templateOptimizer.ts:18-68` ranks models per domain but feedback is not rewired back into contextualLLM routing per-user.
- **Custom instructions per conversation** — not implemented in `Chat.tsx`.
- **Canvas/Artifacts** — not implemented.
- **Sharing AI chat conversations** — not implemented (wealthEngine has `createShareLink()` but Chat.tsx doesn't call it).
- **Auto-CE ingestion** — Learning/Licenses manual only; no connector to NIPR CE Broker or CFP Board.
- **Lead capture forms** — `leadCaptureConfig` schema exists, but no public form builder UI.
- **Drip/email campaigns outbound** — `emailCampaign.ts` stores campaigns to DB; delivery is in-app only.
- **Reg BI enforcement** — `regBIDocumentation.ts` generates documentation JSON; **nothing blocks or flags a suitability-violating recommendation at runtime**.

### Bucket D — Seeded (metadata only, no code)

- **Redtail / eProsperity / Helix** adapters (metadata rows only).
- **Stripe / SendGrid / Twilio** webhook handlers (none).
- **Tavily / Brave** web search fallback (referenced, not actually called from contextualLLM).
- **OCR / image text extraction** (not present anywhere).
- **RSS / XML feed ingester** (not present).
- **HTML scraping infra** (referenced in comments only).
- **MCP server for Code Chat tools** (referenced in CLAUDE.md for "6 financial tools at /mcp/sse" — server exists but Code Chat tool registry does not consume MCP tools, only its hardcoded 6).
- **FSRS** (only SM-2 is implemented).
- **Multi-repo workspaces for Code Chat** (only `WORKSPACE_ROOT` single path).
- **Debugger / test-runner attachment** (only bash tool).

### Pass 1 verdict

The CLAUDE.md narrative is 60% Bucket A + B, 30% Bucket C, 10% Bucket D. The scaffolded-but-not-runtime items (Bucket C) are the highest-leverage next investments because schema + UI already exist; all that's missing is the execution layer. The metadata-only items (Bucket D) are the most dangerous because they appear in nav, docs, and prompts and mislead users into thinking they can act on them.

**Pass 1 priorities:**

1. Build a single **Execution Runtime** that can run workflow steps AND agent turns AND ingestion retries — one durable-job system unblocks three verticals.
2. Kill or clearly label every Bucket D item (seeded metadata with no code).
3. Wire the template-optimizer eval harness so "continuous improvement" is not a stub.

---

## Pass 2 — AI Chat Parity (Novel Angle: "The 4 chat modes vs the 4 best chat apps — feature-by-feature")

### Pass framing

Stewardly's `/chat` has 4 modes: Single, Loop, Consensus, CodeChat. Competitors: **Claude.ai**, **ChatGPT**, **Perplexity**, **Gemini**. This pass is a matrix — not a scorecard. For each of 24 dimensions, I note who leads and where Stewardly sits on a 5-point scale (absent / scaffolded / basic / at-parity / beyond-parity).

### The 24-dimension matrix

| # | Dimension | Claude.ai | ChatGPT | Perplexity | Gemini | Stewardly | Gap |
|---|---|---|---|---|---|---|---|
| 1 | Text streaming SSE | ✓ | ✓ | ✓ | ✓ | **at-parity** | — |
| 2 | Multi-turn context window | 1M | 128K-200K | 200K | 1M-2M | **at-parity** (model-limited) | match model caps |
| 3 | Citations with inline anchors | partial | partial | **strong** | partial | **scaffolded** (memory retrieval without anchors) | inline footnote UI |
| 4 | Real-time web search with provider | — (Claude tool) | ✓ SearchGPT | ✓ core product | ✓ core product | **absent** (no live provider wired; Tavily/Brave listed but unused) | wire one provider |
| 5 | Vision (image understanding) | ✓ | ✓ | ✓ | ✓ | **absent** (upload accepted, no vision pipeline) | add multimodal route |
| 6 | PDF understanding | ✓ | ✓ | ✓ | ✓ | **basic** (import engine parses; Chat doesn't call it) | wire to chat context |
| 7 | Voice input | ✓ | ✓ | ✓ | ✓ | **at-parity** (Web Speech) | — |
| 8 | Voice output | ✓ | ✓ | ✓ | ✓ | **beyond-parity** (25+ Edge TTS voices, persistent Audio Companion) | — |
| 9 | File-based retrieval on uploaded docs | ✓ (Projects) | ✓ (Projects / GPTs) | ✓ (Spaces) | ✓ (Gems) | **basic** (settings/knowledge page) | integrate with live chat context |
| 10 | Artifacts / Canvas / Live editor | ✓ (Artifacts) | ✓ (Canvas) | ✓ (Pages) | ✓ (Canvas) | **absent** | build side-panel artifact renderer |
| 11 | Code execution sandbox in chat | ✓ (limited) | ✓ (full Python + data science) | ✓ | ✓ | **absent** (Code Chat is separate page) | unify via tool |
| 12 | Custom system prompt / persona | ✓ (Projects) | ✓ (Custom GPTs) | ✓ (Collections) | ✓ (Gems) | **scaffolded** (agent_templates exist, not conversation-scoped) | per-conversation override UI |
| 13 | Conversation branching | — | **basic** (regenerate) | — | — | **at-parity** (BranchComparison.tsx wired) | — |
| 14 | Conversation sharing public link | ✓ | ✓ | ✓ | ✓ | **absent** | add `createShareLink()` for chat |
| 15 | Conversation search full-text | ✓ | ✓ | ✓ | ✓ | **basic** (sidebar list, no FTS) | add FTS index |
| 16 | Conversation bookmarking / pinning | — | — | — | — | **beyond-parity** (pinned folders exist) | — |
| 17 | Memory that survives across conversations | ✓ (OpenAI/Anthropic memory) | ✓ | — | ✓ | **at-parity** (user_memories table + ragTrainer) | expose memory UX for user review |
| 18 | Memory that the user can see/edit | ✓ | ✓ | — | ✓ | **absent** (stored silently) | build memory manager UI |
| 19 | Tool-use transparency (trace viewer) | partial | partial | — | partial | **beyond-parity** (Code Chat TraceView) | port TraceView into main chat |
| 20 | Web search result caching | — | — | ✓ | — | **absent** | add cache layer if wired |
| 21 | Agentic multi-step (computer use / Operator) | ✓ Computer Use | ✓ Operator | — | ✓ | **scaffolded** (background_jobs, in-memory only) | durable runtime |
| 22 | Multi-model consensus mode | — | — | — | — | **beyond-parity** (Consensus mode with 3-model synth + semantic agreement) | — |
| 23 | Autonomous loop mode (self-driven) | — | — | — | — | **beyond-parity** (Loop mode with 5 foci + budget cap) | — |
| 24 | Intent-based auto-routing (classify query → route to specialist model) | — (Claude auto-selects) | partial | — | partial | **basic** (regex keyword match in `capabilityModes.ts:74-101`) | LLM-based router + feedback loop |

### Where Stewardly leads the field

- **Consensus mode**, **Loop mode**, **multi-voice Audio Companion**, **conversation bookmarking with folder grouping**, and **BranchComparison** are all beyond-parity. None of the big four chat apps ship these.

### Where Stewardly is meaningfully behind

1. **No vision pipeline.** File upload accepts images but never sends them to a multimodal model. `sseStreamHandler` has no image-message branch.
2. **No live web search.** `FOCUS_OPTIONS` lists "research" but `contextualLLM` never calls Tavily/Brave. Users expecting Perplexity-level grounding will notice immediately.
3. **No artifacts/canvas.** The #1 usability innovation of Claude.ai in the last year. For a financial advisory tool, "open a live spreadsheet next to the chat" is an obvious win.
4. **No user-visible memory.** Users can't see, edit, or delete the facts ragTrainer stores about them. This is a compliance risk (CCPA right-to-delete).
5. **No conversation sharing.** You cannot hand a consensus analysis to a colleague for review.
6. **No PDF-into-chat-context wiring.** The import engine parses PDFs perfectly but Chat never receives those chunks.
7. **No LLM-based intent router.** Keyword regex picks the capability mode; a mis-classified query routes to the wrong specialist.

### Pass 2 recommendations

**P0 (blocks parity):**
- (i) Add vision branch to `sseStreamHandler.ts` — route image attachments through a multimodal model (GPT-4V / Claude Sonnet vision).
- (ii) Wire Tavily OR Brave into `contextualLLM` behind the `research` focus with result caching + citation anchors.
- (iii) Build `ArtifactsPanel.tsx` alongside the chat; render markdown / react / svg / chart artifacts inline; persist to `conversation_artifacts` table.
- (iv) Build `MemoryManagerPopover.tsx` in the chat sidebar showing every fact ragTrainer stored about the user, with delete & edit.
- (v) Add `createChatShareLink()` tRPC mutation that exports a chat subtree to a public read-only URL.

**P1 (force multipliers):**
- (vi) Rewrite `capabilityModes.ts:74-101` as a small LLM classifier that reads the last user turn + conversation summary and picks a capability mode, logged into a feedback loop.
- (vii) When a user uploads a PDF in chat, automatically run it through `importOrchestrator` + chunk + embed into `conversationUploadedDocs` and inject into the context assembler for the next N turns.
- (viii) Port `TraceView` from `codeChat/` into `Chat.tsx` so every tool call in Single mode is visible as it streams.

---

## Pass 3 — Code Chat Parity (Novel Angle: "Feature debt to Cursor/Claude Code is only 8 things, but every one is load-bearing")

### Pass framing

Stewardly's `/code-chat` has 447+ tests, covering slash commands, plan mode, agent memory, scratchpad, session library, symbol index, import graph, git status, todo markers, edit history, action palette, circular deps, and more — this is beyond what ships in most hosted IDEs. But a deep gap analysis against **Cursor**, **Claude Code CLI**, **Aider**, **Devin**, **Replit Agent**, and **v0** reveals exactly 8 load-bearing features that Stewardly is missing, and fixing any one compounds the rest.

### Feature parity matrix — 40 dimensions

Legend: ✓ = ships, ~ = partial, ✗ = absent

| # | Feature | Cursor | Claude Code | Aider | Devin | Replit | v0 | Stewardly |
|---|---|---|---|---|---|---|---|---|
| 1 | Inline single-file edit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 | Multi-file composer (one prompt → many edits) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ (tool loop, no batch UI) |
| 3 | Diff-before-apply preview | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (DiffView) |
| 4 | Per-file accept / reject | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| 5 | Session persistence | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (sessionLibrary) |
| 6 | Conversation fork | — | — | — | — | — | — | ✓ |
| 7 | Plan mode (propose → review → execute) | ~ | ✓ | ~ | ✓ | ~ | — | ✓ |
| 8 | Long-term memory across sessions | — | ✓ | — | ✓ | — | — | ✓ (agentMemory) |
| 9 | Scratchpad (free-form notes drawer) | — | — | — | — | — | — | ✓ |
| 10 | Command palette (Cmd+K) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ (actionPalette) |
| 11 | Slash commands | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| 12 | Auto CLAUDE.md / AGENTS.md project rules loader | — | ✓ | — | ~ | — | — | ✓ |
| 13 | File mention `@path` autocomplete | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 14 | Symbol navigator (Go to Symbol, Ctrl+T) | ✓ | ~ | — | ✓ | ✓ | — | ✓ |
| 15 | Import graph inspector | — | — | — | — | — | — | ✓ |
| 16 | Circular dependency detector | — | — | — | — | — | — | ✓ |
| 17 | TODO marker inventory | — | — | — | — | — | — | ✓ |
| 18 | Git status panel | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 19 | GitHub PR create + push + merge | ~ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ |
| 20 | Multi-repo / workspace folders | ✓ | ~ | ~ | ✓ | ✓ | — | ✗ (single WORKSPACE_ROOT) |
| 21 | SSH / remote dev container | ✓ | — | ✓ | ✓ | ✓ | — | ✗ |
| 22 | Terminal integration (live shell) | ✓ | ✓ (tmux) | ✓ | ✓ | ✓ | — | ~ (one-shot bash only) |
| 23 | Test runner detection + streaming | ✓ | ~ | ✓ | ✓ | ✓ | — | ✗ |
| 24 | Debugger attach | ✓ | — | — | ✓ | ✓ | — | ✗ |
| 25 | Type-check / linter integration | ✓ | ~ | ~ | ✓ | ✓ | — | ✗ |
| 26 | Build detection (watch + streaming logs) | ✓ | ~ | — | ✓ | ✓ | — | ✗ |
| 27 | Framework-aware project templates | ~ | — | — | ~ | ✓ | ✓ | ✗ |
| 28 | Preview/runtime pane (auto) | ~ | — | — | — | ✓ | ✓ | ✗ |
| 29 | MCP server consumption (tool plugins) | ✓ | ✓ | — | — | ~ | — | ✗ |
| 30 | Background agents (run while closed) | ✓ | — | — | ✓ | ✓ | — | ~ (in-memory, not durable) |
| 31 | Cost/budget meter per session | — | — | ~ | ~ | — | — | ✓ |
| 32 | Per-tool permission toggles | ~ | ✓ | ~ | ~ | ~ | — | ✓ |
| 33 | Keyboard chord shortcuts (Vim-style) | ~ | — | — | — | — | — | ✓ |
| 34 | Reverse-i-search (Ctrl+R history) | — | — | — | — | ~ | — | ✓ |
| 35 | Prompt template library | ✓ | — | — | — | ~ | — | ✓ |
| 36 | Session import/export JSON | ~ | — | — | — | ~ | — | ✓ |
| 37 | Undo/redo edit ring | — | — | ✓ | — | ~ | — | ✓ |
| 38 | Inline Shiki syntax highlighting | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| 39 | GitHub Gist export | — | — | — | — | — | — | ✓ |
| 40 | Agentic todo list tracker | — | ✓ | — | ✓ | — | — | ✓ |

### The 8 load-bearing gaps

Stewardly is at-or-beyond parity on 32 of 40 dimensions. But these 8 are blockers for "Cursor-class" positioning:

1. **#4 Per-file accept/reject for composer batches.** When a plan touches 12 files, users need to tick which 8 to keep. Stewardly only has single-file DiffView.
2. **#20 Multi-repo workspace.** Current `WORKSPACE_ROOT` is a single path env var. Cursor users flip between 5+ repos constantly.
3. **#21 SSH / remote dev container.** Financial advisors working on shared compliance repos need encrypted remote execution.
4. **#22 Real terminal.** `run_bash` is one-shot (spawn → output → end). No tmux, no persistent shells, no xterm.js in the UI. Aider's long-running dev shell is a big productivity leap.
5. **#23 Test runner detection.** The agent should auto-detect `package.json` test scripts and stream `vitest`/`pytest` output inline. This is how Devin verifies its own edits.
6. **#25 Type-check / linter.** The agent should be able to run `tsc --noEmit` and act on errors before returning control.
7. **#29 MCP server consumption.** Stewardly hosts an MCP server with 6 financial tools but Code Chat's tool registry does not *consume* MCP tools. Connecting to Anthropic's / community MCP catalog would 10x the tool surface.
8. **#30 Durable background agents.** `backgroundJobs.ts` is a Map that dies on server restart. Devin's killer feature is "assign a task and come back tomorrow."

### Novel observation — the under-appreciated strength

Features 15, 16, 17, 31, 33, 34, 39, 40 are capabilities **no competitor ships**. Stewardly could market itself as "the Code Chat with repository intelligence Cursor doesn't have." The circular dependency detector alone (Tarjan SCC over the full import graph) is something Cursor users beg for.

### Pass 3 recommendations

**P0:**
- (i) Multi-file composer batch UI: when plan mode executes, accumulate all `edit_file`/`write_file` calls into a single reviewable batch at the end. Add per-file checkbox to accept/reject.
- (ii) Promote `WORKSPACE_ROOT` env var into a `WorkspaceRegistry` table — users can add/remove root paths at runtime; sidebar becomes workspace-switcher.
- (iii) Add `xterm.js` terminal pane with a persistent shell backed by `node-pty`. Keep the one-shot `run_bash` tool alongside as a structured-output option.
- (iv) Auto-detect `package.json` / `pyproject.toml` / `Cargo.toml` → expose `run_tests` + `run_typecheck` + `run_lint` tools. Stream output into the TraceView.
- (v) Build `McpClientRegistry` that can point the Code Chat executor at any MCP server URL (Stewardly's own + community). When enabled, MCP tools appear in `CODE_CHAT_TOOL_DEFINITIONS`.

**P1:**
- (vi) Move `backgroundJobs.ts` from an in-memory Map to a BullMQ queue (or equivalent) with a Redis/SQLite durable store. Add a "Jobs" tab in the Chat UI that shows cross-session job state.
- (vii) SSH/remote container support: add `WorkspaceEndpoint` interface with implementations `LocalPath` and `SshPath`. Route all `fileTools` through the endpoint.
- (viii) Framework-aware project templates: when user starts a new project via Code Chat, offer React/Next/FastAPI/Cargo skeletons that pre-populate `.stewardly/instructions.md`.

---

## Pass 4 — Integration / CRUD / Ingestion Parity (Novel Angle: "The Universal Connector is the platform, everything else is a consumer")

### Pass framing

This is the pass with the highest leverage across the entire platform. Every other vertical — financial twin, learning, CRM, workflow, proactive insights — depends on data that Stewardly does not itself own. Today, Stewardly can only ingest data through pre-written adapters (GHL, Wealthbox, Redtail, SnapTrade, Dripify) + file uploads. Airbyte has 350+ connectors. Fivetran has 700+. Zapier has 7000+. **Stewardly is not going to out-adapter these competitors**; it needs to out-*generic* them by building **one universal connector** that works against any REST API even with poor documentation.

### Competitor landscape

| Category | Leader | Core primitive |
|---|---|---|
| ELT data warehouse | **Fivetran** | Pre-built connectors + dbt transforms + incremental sync |
| Open-source ELT | **Airbyte** | Connector SDK (Python/Java) + Airbyte CDK builder (no-code) |
| Reverse ETL | **Hightouch** / **Census** | Warehouse → SaaS destination sync |
| Workflow automation | **Zapier** / **n8n** / **Make** | Trigger → transform → action on thousands of apps |
| Enterprise API mgmt | **Boomi** / **Workato** | Policy-driven pipelines + drag-drop mapping |
| Web scraping | **Bright Data** / **Apify** | Proxy rotation + CAPTCHA + headless browser |
| Document ingestion | **Unstructured.io** / **LlamaParse** | OCR + PDF/docx/ppt + table extraction |
| Entity resolution | **Tonic** / **Senzing** | Cross-source identity matching |

### The 12 primitives of a universal connector

A production-grade universal connector needs these 12 capabilities. Stewardly has 3 today.

| # | Primitive | Stewardly | Best tool |
|---|---|---|---|
| 1 | **Auth pluggability** (api_key, bearer, OAuth2, OAuth1, basic, custom header, signed request) | ✓ (5 methods in integration_connections) | Airbyte CDK |
| 2 | **Request templating** (URL pattern with `{id}`, query params, body templates) | ✗ | Airbyte |
| 3 | **Pagination strategies** (offset, cursor, link-header, page-number, since-timestamp) | ~ (hardcoded per adapter) | Airbyte |
| 4 | **Rate limit policies** (fixed delay, token bucket, retry-after, exponential backoff) | ~ (GHL only) | Fivetran |
| 5 | **Schema discovery from sample** (fetch 1 page → infer JSON schema → propose Postgres columns) | ✗ | Airbyte CDK builder, dlt.hub |
| 6 | **Incremental sync cursor** (last_updated, since_id, sequence) | ✗ | Fivetran (core primitive) |
| 7 | **Transform layer** (JSONPath + JavaScript expression) | ✗ | Make.com, Zapier Code |
| 8 | **Dead-letter queue with replay** | ~ (GHL ghlCalculatorSync has DLQ array) | Temporal |
| 9 | **Connector lifecycle UI** (enable/disable, force-sync, view logs) | ~ (admin dataFreshness page) | Fivetran Dashboard |
| 10 | **Field mapping UI** (source column ↔ target column + transforms) | ~ (auto-detect regex only) | Fivetran, Hightouch |
| 11 | **Webhook receiver with signature verification** | ✓ (server/services/webhookIngestion.ts) | Pipedream |
| 12 | **Record-level sync audit** (what row changed when, source hash) | ✗ | Fivetran |

### Missing category: non-REST ingestion

Stewardly has zero wiring for these categories that competitors treat as baseline:

- **RSS/Atom feeds** — every regulatory source, news feed, compliance update, SEC filing is available as RSS. There's no ingester.
- **HTML scraping** — for sources like state DOI license rosters, FINRA BrokerCheck (no public API), compliance bulletins. No scraper.
- **OCR** — for PDF statements and scanned forms. No provider wired.
- **Email inbox ingestion** (IMAP/Gmail/MS Graph) — would unlock "forward any email to your advisor AI to create a lead or task" like Superhuman / HeyDonna.
- **Google Sheets / Airtable** bidirectional sync — the #1 pattern for small advisor shops that keep data in sheets.
- **S3 / GCS / Dropbox / Drive** document drop inbox — auto-ingest every PDF that lands in a configured folder.
- **Twitter/X, LinkedIn, Reddit via RSS bridges** — for relationship signal tracking on leads.

### Novel proposal — the "Ingest Anything" architecture

Instead of building 50 more adapters, build **one connector builder** that the LLM can author at runtime:

```
┌─────────────────────────────────────────────────────────────┐
│  IngestAnything Flow                                         │
│                                                              │
│  User: "Pull my commission report from carrier XYZ.com"      │
│     ↓                                                        │
│  1. Agent browses the portal, observes auth + URL patterns   │
│  2. LLM writes a Connector Spec (YAML)                       │
│     - auth_kind: oauth2 | basic | api_key | session_cookie   │
│     - endpoints: list, detail                                │
│     - pagination: cursor|offset|link|page                    │
│     - schema: inferred from 1-page sample                    │
│     - sync_key: last_modified | sequence                     │
│  3. User reviews the spec in UI (green check / edit)         │
│  4. Spec persists to connector_specs table                   │
│  5. Runtime reads spec on cron + hydrates schema + sync      │
│  6. DLQ catches errors; next run resumes from cursor         │
└─────────────────────────────────────────────────────────────┘
```

Core tables:
- `connector_specs` — persisted YAML/JSON spec, author_user_id, schema_version
- `connector_runs` — per-execution log (run_id, spec_id, records_in, records_out, errors)
- `connector_schemas` — discovered/mapped column schema per spec
- `connector_records` — raw records keyed by spec_id + source_pk for full audit
- `connector_transforms` — per-field JS expressions (sandbox)
- `connector_dead_letters` — failed rows for replay

Service layer:
- `connectorBuilder.generateSpec(baseUrl, authDetails, samplePage)` — LLM-authored spec
- `connectorRuntime.run(specId, mode: "initial" | "incremental")` — fetch + transform + upsert
- `connectorRuntime.retryDeadLetters(specId)` — replay failed rows
- `schemaInference.fromSample(jsonArray)` — discover shape → propose Postgres types
- `paginationDetector.fromResponse(response)` — detect offset/cursor/link patterns

Client layer:
- `ConnectorBuilderWizard.tsx` — 3-step: (1) URL + auth, (2) LLM generates spec, (3) review + save
- `ConnectorSpecEditor.tsx` — YAML editor with live test run
- `ConnectorRunDashboard.tsx` — runs table + DLQ replay
- `FieldMapperPanel.tsx` — drag-drop source → target with transforms

### Non-REST additions (one sprint per category)

- **RssIngester** (`server/services/ingestion/rss.ts`) — standard `feed-parser` lib, reuses cron + DLQ.
- **HtmlScraper** (`server/services/ingestion/scraper.ts`) — Playwright headless + selector spec + anti-bot options (user agent rotation, retry).
- **OcrProvider** (`server/services/ingestion/ocr.ts`) — wrap `tesseract.js` first (zero-cost), then graduate to AWS Textract / Google Vision when credentialed.
- **InboxIngester** (`server/services/ingestion/imap.ts`) — IMAP or Gmail API; classify incoming message into lead/task/doc/note via LLM.
- **SheetsBridge** (`server/services/ingestion/sheets.ts`) — Google Sheets API two-way sync; user picks target table.
- **DropInbox** (`server/services/ingestion/dropInbox.ts`) — S3/GCS/Dropbox/Drive webhook or poll → fileRouter pipeline.

### Pass 4 recommendations

**P0 (platform unlocks):**
- (i) Build `UniversalConnector` service + connector_specs schema + 4 pagination strategies + rate-limit policy engine.
- (ii) Build `schemaInference.ts` and `paginationDetector.ts` pure functions with unit tests.
- (iii) Build `ConnectorBuilderWizard.tsx` that uses the Code Chat executor to author a spec.
- (iv) Add `RssIngester` + wire 5 regulatory feeds (FINRA, SEC, CFP Board, NASAA, IRS) into `freshness.ts`.
- (v) Add `OcrProvider` (tesseract baseline) and plug into `fileRouter` for PDFs with no text layer.

**P1 (high-leverage next):**
- (vi) `HtmlScraper` with Playwright for state DOI license rosters + BrokerCheck mirrors.
- (vii) `InboxIngester` to ingest forwarded emails as leads/tasks.
- (viii) `SheetsBridge` for advisor shops on Google Sheets.
- (ix) `DropInbox` for document automation.

**P2 (completes story):**
- (x) Record-level sync audit (per-row hash + last_seen) — unlocks Fivetran-level data warehousing stories.
- (xi) Transform layer with sandboxed JS expressions per field.
- (xii) Field mapper drag-drop UI.

---

## Pass 5 — Learning Platform Parity (Novel Angle: "SRS + static content ≠ learning product; what Duolingo/Brilliant actually do that Stewardly doesn't")

### Pass framing

Stewardly imported 366+ definitions from `mwpenn94/emba_modules`, built a real SM-2 SRS in `mastery.ts`, ships an exam simulator, flashcards, quiz runner, connection map, case study simulator, discipline deep-dive, and achievement system. By page count and table count, this looks competitive. But Duolingo, Brilliant, Khan Academy, and Anki do **one thing** Stewardly fundamentally does not: they **generate, adapt, and evaluate content at the level of individual learners on individual attempts**. Stewardly ships a static curriculum; Duolingo ships a learner-shaped curriculum.

### What each competitor actually does

- **Duolingo** — A/B tests every exercise type per learner. Uses FSRS (not SM-2). A "teacher model" picks the next exercise type based on the learner's current confidence-per-skill vector. Uses gamification (XP, streaks, leagues) that is tuned per-cohort. Real-time speech recognition for pronunciation. Dynamic exercise generation (translate this → given the learner's current vocabulary).
- **Brilliant.org** — Interactive simulations in every lesson (physics, probability, circuit design). No flashcards. Every concept is a clickable thing the learner manipulates. Adaptive difficulty via confidence-interval bands.
- **Khan Academy** — Mastery-based path with millions of generated exercises per skill. Every problem is parametric (`x + 4 = 12` → generated from template `{a} + {b} = {c}`). Hint system with 4 tiers. Video explanations for every concept. Knowledge Map shows prerequisites.
- **Anki** — FSRS (Free Spaced Repetition Scheduler), user-authored decks, media attachments, plugins. This is the gold standard for SRS.
- **Kaplan / Wiley / STC** — Professional exam prep with 10k+ question banks, category-weighted practice, Pareto analysis of wrong categories, exam-day confidence prediction, live instructor video review.

### 18-dimension scorecard

| # | Dimension | Duolingo | Brilliant | Khan | Anki | Kaplan | Stewardly |
|---|---|---|---|---|---|---|---|
| 1 | Adaptive SRS | **FSRS** | — | — | SM-2 / FSRS | — | SM-2 |
| 2 | Teacher model (gap → exercise) | ✓ | ✓ | ✓ | — | ✓ | ✗ |
| 3 | Generative exercise creation | ✓ | ~ | ✓ (parametric) | — | ~ | ✗ (LLM can generate but not wired to gap detection) |
| 4 | Interactive simulations (draggable/clickable physics-style) | ~ | ✓ | ~ | — | — | ✗ |
| 5 | Video explanations per concept | — | — | ✓ | — | ✓ | ✗ |
| 6 | Audio/pronunciation with STT feedback | ✓ | — | — | — | — | ~ (ExamSimulator has audio mode, no feedback) |
| 7 | Mastery visualization per concept | ✓ | ✓ | ✓ (Knowledge Map) | — | ~ | ~ (ConnectionMap, no mastery overlay) |
| 8 | Prerequisite graph with unlock gating | ~ | ~ | ✓ | — | ~ | ✗ |
| 9 | Cohort A/B testing of exercise types | ✓ | ~ | ~ | — | ~ | ✗ (A/B infra exists for prompts, not lessons) |
| 10 | Gamification (XP/streaks/leagues) | ✓ | ✓ | ~ | — | — | ~ (AchievementSystem) |
| 11 | Auto-CE credit ingestion (for pro exams) | — | — | — | — | ✓ | ✗ |
| 12 | Exam day confidence predictor | — | — | — | — | ✓ | ~ (check_exam_readiness tool) |
| 13 | Wrong-answer categorization / weakness analysis | ~ | ✓ | ✓ | — | ✓ | ✗ |
| 14 | Live tutor / AI tutor chat tied to lesson | ~ | ~ | ✓ (Khanmigo) | — | ✓ | ~ (AI chat exists, not tied to lesson) |
| 15 | User-authored decks / lessons | — | — | — | ✓ | — | ~ (Content Studio, admin-only) |
| 16 | Spaced interleaving across tracks | ✓ | ~ | ✓ | ✓ | ~ | ~ (SRS is per-item, not cross-track) |
| 17 | Free-response LLM grading | — | ~ | ✓ (Khanmigo) | — | ~ | ✗ |
| 18 | Offline mode / mobile PWA | ✓ | ✓ | ✓ | ✓ | ~ | ✗ |

### The 6 killer missing features

1. **Teacher Model Loop.** When a user gets 3 questions wrong on "Roth conversion basis calculation," the system should detect the concept gap and generate 5 new targeted practice questions using the LLM. Today, `learningAiQuizQuestions` table exists but nothing triggers generation on mastery signals.

2. **Parametric question templates.** Khan Academy's secret: every question is a template like `{name} has {a} shares of {ticker} at ${price}. What is the cost basis if they sell {q} shares?`. Infinite practice from a finite question bank. Stewardly has fixed EMBA imports only.

3. **FSRS instead of SM-2.** FSRS outperforms SM-2 by 15-30% in published studies. Anki switched in 2024. Implementing FSRS in `mastery.ts` is a ~200 LOC change that materially improves retention.

4. **Wrong-answer diagnostics.** Today the quiz runner shows correct/incorrect + explanation. It does not identify *which concept* the miss belongs to or aggregate across sessions into a "your weakest 5 concepts" dashboard. This is Kaplan's killer feature for exam prep.

5. **Khanmigo-style lesson-tied AI tutor.** When a user is mid-lesson and confused, they should be able to hit a "Tutor" button that opens a scoped chat with full lesson context. The chat exists, but the button doesn't pre-populate the context from the current chapter/subsection.

6. **Auto-CE ingestion.** Kaplan auto-reports CE credits to state DOIs through NIPR CE Broker. Stewardly requires manual entry. The universal connector from Pass 4 unblocks this.

### Bonus gap — no real content generation pipeline

Even the imported EMBA content is static. A professional exam platform must be able to:
- Pull the latest regulatory updates from FINRA/SEC RSS (see Pass 4)
- Detect when a definition, formula, or case study is materially impacted
- Auto-draft an update for human review
- Run a regression: "does this change invalidate any questions already in mastery?"

None of this is wired. `freshness.ts` has the table + admin review workflow but no trigger.

### Pass 5 recommendations

**P0 (turn learning from static to adaptive):**
- (i) Replace SM-2 with FSRS in `mastery.ts`. Keep the signature pure; migrate the interval table to `fsrsScheduleNextReview()`.
- (ii) Build `TeacherModel.detectGaps(userId)` that queries mastery rows with low confidence and generates targeted questions via the LLM, using `learningAiQuizQuestions` as the output store.
- (iii) Add `parametric_question_templates` table + `generateFromTemplate()` service. Seed 50 templates for the SIE/Series 7/66/CFP high-yield concepts.
- (iv) Wire `LessonTutorButton.tsx` in `LearningTrackDetail` + `LearningQuizRunner` that opens a Chat conversation pre-seeded with the current lesson context.
- (v) Build `WeaknessDashboard.tsx` that aggregates per-concept error rates across all sessions and surfaces the weakest 5 concepts with a "practice this" CTA.

**P1:**
- (vi) Build `RegulatoryUpdateDetector` that reads FINRA/SEC RSS (via Pass 4 RssIngester), diffs content against knowledge base, flags impacted questions for admin review.
- (vii) Auto-CE ingestion via NIPR CE Broker connector (universal connector Pass 4 spec-builder handles this).
- (viii) FSRS hyperparameter optimizer — train per-user FSRS params on their own review history for 20%+ improvement.

**P2:**
- (ix) Interactive simulations — add `SimulationRunner.tsx` that can render draggable chart simulations for concepts like amortization, tax bracket phase-out, Social Security timing.
- (x) Video explanations via Edge TTS + generated slide stacks (LLM creates a 5-slide deck per concept; TTS narrates each slide). Zero external video hosting cost.

---

## Pass 6 — Financial Services Parity (Novel Angle: "The calculators are real — the market data, holdings, and compliance teeth are not")

### Pass framing

Stewardly's wealth engine has real, unit-tested calculators (UWE 944 LOC, BIE, HE, Monte Carlo, 583+ tests) and generates real PDF reports via a real contextualLLM. This is beyond what most advisor-focused tools ship. But a fiduciary-grade financial platform needs three things Stewardly mostly does not have: **(1) live market and account data, (2) tax optimization with bracket logic, (3) compliance enforcement that actually blocks actions**. Without these, Stewardly's calculators operate on static inputs, its proactive insights can never fire, and its Reg BI documentation is paperwork theater.

### Competitor landscape

| Category | Leader | Core strength |
|---|---|---|
| Advisor planning tools | **eMoney** / **MoneyGuide** / **RightCapital** | Goal-based planning with live account aggregation + tax layer |
| Account aggregation | **Plaid** / **Yodlee** / **MX** / **Finicity** | 12k+ institutions, real-time holdings, transactions |
| Market data | **Bloomberg Terminal** / **Refinitiv** / **YCharts** / **Morningstar** | Real-time quotes, fundamentals, ratings, benchmarks |
| Tax optimization | **Holistiplan** / **tax.ai** / **FP Alpha** | Tax return scanning + bracket optimization + Roth conversion modeling |
| Portfolio analytics | **Kwanti** / **Morningstar Direct** / **Riskalyze** | Risk scoring, stress tests, factor exposures |
| Robo / direct-to-consumer | **Wealthfront** / **Betterment** / **Schwab Intelligent Portfolios** | Auto-rebalance, tax-loss harvesting, goal dashboards |
| Compliance | **RIA in a Box** / **ComplySci** / **MyComplianceOffice** | Policy enforcement, code of ethics, trade surveillance |
| Research terminal | **Bloomberg** / **FactSet** / **S&P Capital IQ** | Deep fundamentals + news + model workbench |

### 22-dimension scorecard

| # | Dimension | Industry leader | Stewardly |
|---|---|---|---|
| 1 | Goal-based planning engine | eMoney / RightCapital | ✓ (HE calculator) |
| 2 | Monte Carlo simulation | eMoney / MoneyGuide | ✓ (MC calculator) |
| 3 | Account aggregation via Plaid | Plaid core | ✗ (SnapTrade env-gated only) |
| 4 | Real-time holdings display | Wealthfront / Schwab | ✗ (no holdings table) |
| 5 | Transaction ingestion | Plaid / Yodlee | ✗ |
| 6 | Live market quotes | YCharts / Morningstar | ✗ (FRED fetchSOFRFromFRED is only SOFR, and hardcoded comment shows it's incomplete) |
| 7 | Tax bracket optimization (fed + state) | Holistiplan | ✗ (flat taxRate param only) |
| 8 | Roth conversion analyzer | FP Alpha / Holistiplan | ~ (client-side MC, no bracket logic) |
| 9 | Tax return scanning (OCR 1040) | Holistiplan | ✗ (no OCR) |
| 10 | Estate planning (trust structures, gift/GST tax) | eMoney / FP Alpha | ~ (EstatePlanning page, no compute) |
| 11 | Insurance needs analysis (DIME, income replacement) | MoneyGuide | ~ (UWE has insurance comparison, no needs calculator) |
| 12 | Social Security optimization | Social Security Analyzer | ✗ |
| 13 | Medicare / LTC modeling | — | ✗ |
| 14 | Risk tolerance questionnaire + scoring | Riskalyze | ✓ (12-dim Financial Protection Score) |
| 15 | Portfolio stress testing | Kwanti | ✗ |
| 16 | Benchmark comparison (S&P / NASDAQ / peer) | Morningstar | ✗ |
| 17 | Fee analysis / expense ratio audit | Kwanti | ✗ |
| 18 | Trade / rebalance recommendations | Betterment | ✗ |
| 19 | Tax-loss harvesting | Wealthfront / Betterment | ✗ |
| 20 | Document vault (client uploads statements / tax returns / wills) | Box / Vanta docs | ~ (settings/knowledge exists, not doc vault) |
| 21 | Compliance enforcement (pre-trade rule checks) | ComplySci | ✗ (regBIDocumentation generates doc only) |
| 22 | Multi-model consensus for high-stakes recommendations | — | **beyond-parity** (unique to Stewardly) |

### The 4 load-bearing gaps

Stewardly has most of the "paperwork" dimensions but is missing the 4 things a real advisor actually needs:

1. **Live data into the twin.** `MyFinancialTwin.tsx` renders but does not continuously recompute from live account balances. The moment a client's portfolio moves 5% on the S&P, every scenario in the twin is stale. Fix: Plaid aggregation + FRED rates + daily recompute cron.

2. **Real tax layer.** Flat `taxRate` parameter in `uwe.ts:99` is inadequate for any client with bracket-sensitive decisions. A Roth conversion decision is entirely a tax-bracket optimization problem. Fix: Build `TaxEngine` with federal + state brackets, phase-outs, IRMAA thresholds, QBI, NIIT.

3. **OCR + document intelligence.** Clients have 1040s, K-1s, statements, wills, beneficiary forms. Holistiplan's entire moat is "scan the 1040, extract the tax picture, run 20 planning scenarios." Stewardly has file import but no OCR and no structured extraction.

4. **Compliance teeth.** `regBIDocumentation.ts` produces documentation JSON after the fact. There is nothing that prevents the LLM from recommending an unsuitable product for the client's risk profile. A fiduciary platform MUST have a pre-recommendation gate that checks risk/suitability/cost/alternatives and refuses to output a recommendation that fails. The graduated autonomy system has the primitive (confirmationRequired flag) — it's not wired to the wealth recommendation flow.

### Novel proposal — the "Financial Reality Layer"

A single service (`server/services/financialReality/`) that every other wealth engine operation consumes:

```
┌───────────────────────────────────────────────────────────────┐
│  financialReality.getClientState(clientId)                    │
│                                                                │
│  Sources (all via universal connector from Pass 4):           │
│   - Plaid accounts + balances + holdings + transactions       │
│   - FRED (real rates: SOFR, CPI, fed funds, 10y)              │
│   - Alpha Vantage / Yahoo / Polygon (real quotes)             │
│   - Client uploaded 1040 + K-1 + statement (OCR)              │
│   - Client-entered goals + life events                        │
│                                                                │
│  Output: ClientReality = {                                     │
│    networth, cashflow, holdings, taxPicture (fed+state),      │
│    riskProfile, goals, lifeEvents, lastSync, staleness        │
│  }                                                             │
│                                                                │
│  Every calculator reads from this; nothing reads env hardcodes│
└───────────────────────────────────────────────────────────────┘
```

And a matching trigger:

```
┌─────────────────────────────────────────────────────────────┐
│  financialReality.onChange(clientId, delta) → emit events   │
│  - balance.delta > 10% → regenerate proactive insight       │
│  - position.concentration > 20% → compliance flag          │
│  - rate.change > 25bps → refresh UWE scenarios             │
│  - tax.bracket_crossed → Roth conversion opportunity       │
│  - life.event (marriage/birth/job) → full plan refresh     │
└─────────────────────────────────────────────────────────────┘
```

### Tax engine scope (minimum viable)

- `server/services/tax/federalBrackets.ts` — 2024/2025/2026 brackets, single/MFJ/HoH
- `server/services/tax/stateBrackets.ts` — all 50 states, handling NIL (no income tax) and flat-rate cases
- `server/services/tax/ordinaryVsCapital.ts` — short/long capital gains treatment
- `server/services/tax/phaseOuts.ts` — QBI, child tax credit, PEP/Pease (if reinstated), IRMAA
- `server/services/tax/rothConversionAnalyzer.ts` — given bracket headroom + asset location, optimize conversion amount
- `server/services/tax/taxLossHarvest.ts` — scan holdings for wash-sale-safe losses
- `server/services/tax/rmdCalculator.ts` — RMD for trad IRA / 401(k) / inherited accounts

### Compliance enforcement layer

- `server/services/compliance/suitabilityGate.ts` — pre-recommendation check: given `ClientReality` + proposed product → returns `{allow: boolean, reasons: string[]}`
- `server/services/compliance/regBiGate.ts` — for Reg BI scope: ensures cost comparison + conflict disclosure + alternative analysis have been generated before recommendation can be rendered
- `server/services/compliance/tradeSurveillance.ts` — flags trades that violate concentration/wash-sale/pattern-day-trader rules
- `server/middleware/recommendationGate.ts` — tRPC middleware that wraps any mutation with `isRecommendation: true` and blocks the response if gates fail

### Pass 6 recommendations

**P0 (table stakes for fiduciary positioning):**
- (i) `financialReality.ts` service as single source of truth; refactor `MyFinancialTwin.tsx` + wealth engine pages to consume it.
- (ii) Wire Plaid (or complete SnapTrade integration) for holdings + balances + transactions.
- (iii) Build `TaxEngine` with federal brackets at minimum; use in Roth conversion analyzer + UWE.
- (iv) Wire FRED (real call, not SOFR-only hardcode) for rate inputs to UWE + PF calculators.
- (v) Implement `suitabilityGate` middleware and apply to every `recommendAdvisor*` mutation.

**P1:**
- (vi) OCR pipeline for client-uploaded 1040/statements via Pass 4 OCR provider.
- (vii) `TaxEngine` state brackets + phase-outs + IRMAA.
- (viii) `financialReality.onChange` event bus + proactive insight trigger wiring.
- (ix) Social Security optimization module.
- (x) Document vault UI + encrypted at-rest storage.

**P2:**
- (xi) Trade surveillance + concentration alerts.
- (xii) Benchmark comparison panels (S&P, bond index, advisor peer group).
- (xiii) Fee audit (compare client expense ratios to category median).
- (xiv) Medicare / LTC modeling.

---

## Pass 7 — CRM / Marketing Parity (Novel Angle: "The CRM schema is better than the CRM behaviors")

### Pass framing

Stewardly's CRM and marketing layer has a paradoxical strength: the **schema is genuinely competitive** (17 lead statuses, propensity scores, consent flags, PII deletion tracking, enrichment waterfall, fair-lending sanitizer) but the **behaviors on top of that schema are mostly stubs**. Email campaigns "deliver" as in-app notifications. Drip campaigns are inbound webhook receivers, not outbound schedulers. Lead capture forms have no public builder. The leader CRMs don't have better schemas — they have better **outbound channels, automation engines, and deliverability**.

### Competitor landscape

| Category | Leader | Core strength |
|---|---|---|
| SMB CRM | **HubSpot** | Free tier + marketing hub + automation + 1400+ integrations |
| Enterprise CRM | **Salesforce** | Flows + Einstein + AppExchange + unlimited customization |
| Modern / relationship-first | **Attio** | Notion-style tables, triggers, data from public web |
| Sales engagement | **Outreach** / **Salesloft** / **Apollo** | Sequences, dialer, conversation intel |
| Email mktg | **Mailchimp** / **Customer.io** / **Iterable** | Drip, segmentation, transactional, deliverability |
| SMS / WhatsApp | **Twilio** / **Attentive** | Messaging infra + compliance |
| Web forms / landing | **Typeform** / **Unbounce** / **Landbot** | Form → CRM webhook |
| Conversation intel | **Gong** / **Chorus** | Call recording + LLM coaching |
| ABM | **6sense** / **Demandbase** | Intent data + account scoring |
| Consent/TCPA | **Compliance.AI** / **ActiveProspect** | Lead consent capture + audit trail |

### 24-dimension scorecard

| # | Dimension | Industry leader | Stewardly |
|---|---|---|---|
| 1 | Contact / lead schema | HubSpot | ✓ beyond-parity (17 statuses, propensity, consent, PII hashing) |
| 2 | Kanban pipeline UI | HubSpot | ✓ (7-col from 11 statuses) |
| 3 | Lead enrichment | Apollo / Clay | ✓ env-gated waterfall |
| 4 | Fair-lending sanitization | Compliance.AI | **beyond-parity** |
| 5 | CRM adapter — GHL | — | ✓ (v1+v2 OAuth, webhooks) |
| 6 | CRM adapter — Wealthbox | — | ~ env-gated |
| 7 | CRM adapter — Redtail | — | ~ env-gated |
| 8 | CRM adapter — HubSpot | native | ✗ |
| 9 | CRM adapter — Salesforce | native | ✗ |
| 10 | CRM adapter — Attio | native | ✗ |
| 11 | Outbound email via SendGrid/SES/Postmark | Customer.io | ✗ (in-app only delivery) |
| 12 | Outbound SMS via Twilio | Twilio native | ✗ |
| 13 | Outbound LinkedIn automation | Dripify / La Growth Machine | ~ (inbound webhook only) |
| 14 | Email templates with variables | Mailchimp | ✓ ({{recipientName}} substitution) |
| 15 | Drip campaign scheduling | Customer.io / Iterable | ✗ (no scheduler) |
| 16 | Segmentation (dynamic audiences) | HubSpot / Iterable | ~ (propensity filters exist) |
| 17 | A/B testing of email subject lines | Mailchimp | ✗ |
| 18 | Deliverability monitoring | SendGrid / Postmark | ✗ |
| 19 | Landing page / form builder | Unbounce | ✗ |
| 20 | UTM tracking + attribution | HubSpot | ✗ |
| 21 | Consent capture w/ audit (TCPA, CAN-SPAM, GDPR) | ActiveProspect | ~ (schema has consent_flags, no capture UI) |
| 22 | Call recording / conversation intel | Gong | ✗ |
| 23 | Unified inbox (email + SMS + chat + social) | Front / HubSpot Inbox | ✗ |
| 24 | Automation / workflow builder | HubSpot / Zapier | ~ (5 predefined templates, no visual DAG) |

### The 5 load-bearing gaps

1. **No outbound messaging gateway.** Without SendGrid/Twilio/SMTP wiring, Stewardly cannot complete a drip campaign, send an appointment reminder, or deliver a statement. The codebase has the schema (`emailCampaigns`, `emailSends`) and the in-app delivery path — it needs one adapter behind a `MessageGateway` interface.

2. **No drip scheduler.** Customer.io and Iterable run on the same pattern: `Trigger (event) → Delay (T) → Condition (branch) → Send (message)`. Stewardly has no such loop. Without this, marketing automation is absent.

3. **No landing / lead capture forms.** `leadCaptureConfig` table exists. There is no `<LeadCaptureForm>` component that a user can embed on a WordPress site or Stewardly page that POSTs to the lead pipeline.

4. **No unified inbox.** Advisors want every email/SMS/chat with a client to land in one thread view with AI-drafted replies. This requires IMAP/Twilio ingestion (Pass 4) + a new `communications_thread` table + a dedicated UI.

5. **No conversation intelligence.** Zoom/Meet recording → transcription → LLM coaching is the highest-ROI compliance tool in the advisor stack. Stewardly has `/api/tts` but no STT pipeline for recordings.

### Novel proposal — the `MessageGateway` abstraction

```
interface MessageGateway {
  sendEmail(to, subject, body, options): Promise<SendResult>
  sendSms(to, body, options): Promise<SendResult>
  sendWhatsapp(to, body, options): Promise<SendResult>
  sendInApp(userId, body, options): Promise<SendResult>  // current path
}

// Env-gated implementations:
class SendGridGateway implements MessageGateway { ... }
class TwilioGateway implements MessageGateway { ... }
class PostmarkGateway implements MessageGateway { ... }
class SesGateway implements MessageGateway { ... }
class InAppGateway implements MessageGateway { ... }  // current default

// Routing layer:
class CompositeGateway implements MessageGateway {
  // Each method falls back: email → SendGrid > Postmark > SES > in-app
  //                         sms   → Twilio > in-app
}

// Compliance wrapper:
class ComplianceMessageGateway implements MessageGateway {
  // Every send is logged to compliance_communications_archive (FINRA 17a-4)
  // PII scrubbed in logs
  // Consent checked per channel via lead.consent_flags
  // Unsubscribe token appended
  // Quiet-hours enforcement
  // CAN-SPAM sender address requirement
}
```

And a matching `DripEngine`:

```
interface DripStep {
  delay?: { ms?: number; cron?: string }
  condition?: { field: string; op: "eq"|"neq"|"gt"|"contains"; value: any }
  branch?: { yes: DripStep[]; no: DripStep[] }
  action: { type: "email" | "sms" | "tag" | "webhook" | "task" | "llm"; config: any }
}

dripEngine.enroll(leadId, campaignId)
dripEngine.tick()  // runs on cron, advances every active enrollment by one step
dripEngine.unenroll(leadId, campaignId, reason)
```

Persisted via:
- `drip_campaigns` (definition)
- `drip_enrollments` (lead + campaign + current_step + next_run_at)
- `drip_step_logs` (audit + deliverability)

### Pass 7 recommendations

**P0:**
- (i) Build `MessageGateway` interface + SendGridGateway + TwilioGateway (behind env gates) + ComplianceMessageGateway wrapper. Every existing `sendNotification` call routes through it.
- (ii) Build `DripEngine` on top of the durable-job runtime from Pass 1. Wire to 5 starter campaigns (new lead nurture, onboarding reminders, annual review trigger, stale lead reanimation, quote follow-up).
- (iii) Build `LeadCaptureForm.tsx` component + `/public/forms/:formId` route that POSTs to lead pipeline + writes consent capture audit row.
- (iv) Build `HubSpot` and `Salesforce` adapters on top of existing `CRMAdapter` interface.

**P1:**
- (v) Unified inbox: `communications_thread` table + `UnifiedInbox.tsx` rolling up email/SMS/chat per lead with AI-drafted reply UI.
- (vi) Attribution tracking: UTM capture on lead capture + `lead_attribution` table.
- (vii) Deliverability dashboard: bounce / complaint / open / click aggregates from the message gateway.
- (viii) A/B subject line testing within `DripEngine`.

**P2:**
- (ix) Call recording + STT pipeline (complement Edge TTS output): transcribe meeting audio → persist → LLM coaching summary.
- (x) WhatsApp channel via Twilio.
- (xi) Segmentation dynamic audiences: a SQL-like query builder that evaluates on lead row changes.

---

## Pass 8 — Workflow & Agentic Parity (Novel Angle: "You have agents without a runtime and workflows without an executor")

### Pass framing

The single most diagnostic observation across the whole codebase is: **the agentic AI and workflow layers both have complete schemas, complete templates, complete UIs, and complete tRPC routers — but neither has a runtime that executes them.** The agent CRUD stores agent instances. The workflow CRUD stores workflow instances. The graduated autonomy system gates action execution. But when a user clicks "run" on a workflow, there is no code path that walks the step array and actually performs each action. When a user creates an agent, there is no scheduled job that executes its turn on its schedule. The primitives exist. The loop that iterates them does not.

This is the single highest-leverage investment: one **ExecutionRuntime** service unblocks three verticals simultaneously.

### Competitor landscape

| Category | Leader | Core primitive |
|---|---|---|
| Durable workflows | **Temporal** / **Inngest** / **Hatchet** | Code-first workflows with built-in retry + state persistence |
| Visual workflows | **n8n** / **Zapier** / **Make** | Drag-drop DAG + trigger + action |
| Enterprise BPMN | **Camunda** / **Kogito** | BPMN 2.0 + decision modeling |
| AI agent orchestration | **LangGraph** / **LangChain** / **CrewAI** / **AutoGen** | State machines + multi-agent + tool calling |
| Autonomous coding | **Devin** / **Cognition** / **SWE-agent** | Long-running agent with browser + terminal + memory |
| Autonomous ops | **Dust** / **Lindy** / **Rabbit** | Operator-style agents for SaaS apps |
| Job queues | **BullMQ** / **Celery** / **Sidekiq** | Fundamental durable job primitive |
| Event streaming | **Kafka** / **NATS** / **Redpanda** | Pub/sub for event-driven workflows |

### 26-dimension scorecard

| # | Dimension | Industry leader | Stewardly |
|---|---|---|---|
| 1 | Workflow definition format | Temporal TS SDK / n8n JSON | ✓ (step array JSON) |
| 2 | Workflow instances persistence | Temporal | ✓ (workflow_instances table) |
| 3 | Workflow visual DAG editor | n8n / Zapier | ✗ |
| 4 | Step executor | Temporal worker | ✗ |
| 5 | HITL approval steps | Camunda / Temporal | ~ (schema only) |
| 6 | Time-based triggers | Zapier Schedule | ~ (scheduler cron) |
| 7 | Event-based triggers | n8n webhook / EventBridge | ~ (generic webhook → lead only) |
| 8 | Retry + backoff per step | Temporal | ✗ |
| 9 | Compensation / saga patterns | Temporal | ✗ |
| 10 | Parallel branch execution | Temporal | ✗ |
| 11 | Sub-workflow composition | Temporal | ✗ |
| 12 | Variable passing step → step | n8n | ~ (stateJson blob) |
| 13 | Debugging / replay | Temporal UI | ✗ |
| 14 | Observability / run logs | n8n UI | ~ (checklist only) |
| 15 | Agent definition format | LangGraph | ✓ (agent_templates) |
| 16 | Agent instances persistence | — | ✓ |
| 17 | Agent runtime (executes turns on schedule) | LangGraph / AutoGen | ✗ (only one-shot CRUD) |
| 18 | Agent tool registry | LangChain Tools | ✓ (aiTools table) |
| 19 | User-added tools via UI | — | ✗ |
| 20 | Inter-agent messaging | AutoGen / CrewAI | ✗ |
| 21 | Agent memory (cross-session) | Devin / LangGraph | ✓ (agentMemory in Code Chat only; not general) |
| 22 | Graduated autonomy trust | — | **beyond-parity** |
| 23 | Durable background jobs | BullMQ / Temporal | ✗ (in-memory Map) |
| 24 | Cost/budget per agent run | — | ~ (agent_instances.budgetLimitUsd schema, no enforcement) |
| 25 | Event bus / pub-sub | Kafka / NATS | ~ (event bus module but limited events emitted) |
| 26 | Saga across multiple services | Temporal | ✗ |

### The core architectural move

Build **one** service: `server/services/executionRuntime/`. This service:

1. Provides a `DurableJob` abstraction with retries, state persistence, idempotency keys.
2. Has a single `tick()` loop that polls pending jobs and dispatches handlers.
3. Is backed by a Postgres table `durable_jobs` (so no new infra dependency) with row-level locking.
4. Can be fronted later by BullMQ/Temporal if scale demands.
5. Exposes `enqueue(handlerKey, payload, options)` and `runOnce(handlerKey, payload)` primitives.

Every long-running operation in the codebase routes through this:
- Workflow step execution → `durable_jobs(handlerKey="workflow.runStep", payload={instanceId, stepIdx})`
- Agent turn execution → `durable_jobs(handlerKey="agent.runTurn", payload={instanceId})`
- Integration sync → `durable_jobs(handlerKey="integration.sync", payload={connectionId})`
- Drip campaign tick → `durable_jobs(handlerKey="drip.tick", payload={enrollmentId})`
- Proactive insight generation → `durable_jobs(handlerKey="insights.generate", payload={userId, trigger})`
- Autonomous training → `durable_jobs(handlerKey="autonomy.train", payload={domain})`
- Background coding job → `durable_jobs(handlerKey="codechat.autonomous", payload={jobId})`

Plus the observable layer:
- `durable_job_runs` — every invocation with duration, result, error
- `durable_job_locks` — row-level locks for work-stealing workers
- `durable_job_schedules` — cron-style repeat configs

### Workflow visual DAG editor

n8n-style: react-flow + draggable nodes + typed ports. Start with a **read-only renderer** first (huge UX win for observability of the existing 5 templates). Upgrade to editable after runtime is proven.

Node types:
- **Trigger**: cron, webhook, manual, event (from event bus)
- **LLM call**: prompt template + model + context
- **Tool call**: any registered `aiTools` entry
- **HTTP request**: arbitrary outbound (uses Universal Connector from Pass 4)
- **Condition**: branch on variable expression
- **Delay**: wait for time or event
- **HITL approval**: block on admin approval
- **Parallel / Join**: fanout / fan-in
- **Sub-workflow**: call another workflow
- **Send**: email/sms/in-app via MessageGateway from Pass 7

### Multi-agent orchestration

Once the runtime exists, inter-agent messaging is a single table:

```
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY,
  from_agent_id UUID,
  to_agent_id UUID,
  kind ENUM('request','response','broadcast'),
  payload JSONB,
  status ENUM('queued','delivered','processed'),
  correlation_id UUID,
  created_at TIMESTAMP,
  processed_at TIMESTAMP
);
```

An agent turn can `emit` a message. The runtime dispatches it. The target agent processes it on its own turn. This gives LangGraph-style agent graphs without the complexity.

### Pass 8 recommendations

**P0 (unblocks three verticals):**
- (i) Build `server/services/executionRuntime/` with `DurableJob`, Postgres-backed store, retry/backoff, idempotency keys, row-level locks, worker loop.
- (ii) Implement `workflow.runStep` handler — walks the step array, dispatches by step.type to LLM/tool/HITL/delay/branch.
- (iii) Implement `agent.runTurn` handler — loads agent instance + context + tools, executes one turn, persists action, respects graduated autonomy gates.
- (iv) Migrate `backgroundJobs.ts` from in-memory Map → durable runtime.
- (v) Build `WorkflowGraphView.tsx` (read-only) — render existing 5 templates as DAGs with live instance progress overlay.

**P1:**
- (vi) User-authored agent UI: form for system prompt + tool selection + schedule + budget + autonomy level + knowledge sources.
- (vii) Agent marketplace: publish/subscribe templates across organizations with ratings.
- (viii) Inter-agent messaging via `agent_messages` table.
- (ix) Editable DAG builder for workflows.
- (x) HITL approval UI: `/approvals` inbox with one-click approve/reject on pending workflow steps.

**P2:**
- (xi) Temporal or Inngest adapter (optional scale-out if durable runtime hits limits).
- (xii) Saga compensation steps.
- (xiii) Workflow replay / debugger.

---

## Pass 9 — Personalization & Continuous Improvement (Novel Angle: "The platform is wired for telemetry, not for learning")

### Pass framing

This pass is different from the others. It is not about what features Stewardly ships — it is about what the platform *knows about its users* and whether that knowledge causes the platform to behave differently for different users over time. This is the difference between a "product" and a "compounding product." Netflix, Spotify, Duolingo, Shopify, Notion, and Linear all separate themselves from their competitors not on features but on **continuous improvement loops** that make the product better for each specific user every week they use it.

The reality-check agents surfaced a devastating observation: **Stewardly collects telemetry but does not close the loop.** Every primitive exists:

- `user_memories` stores facts about users
- `responseRatings` stores thumbs up/down per message
- `promptVariants` + `promptExperiments` defines A/B framework
- `userActivity` segments users (explorer/confirmer/delegator)
- `learningMasteryProgress` tracks per-concept SRS state
- `feedback_collector` aggregates per-model approval rates
- `templateOptimizer` ranks models per domain
- `aggregateEpisodicSummaries` consolidates memories into semantic summaries
- `graduatedAutonomy` adjusts agent trust based on acceptance rates
- `improvementLoops.ts` has 6 improvement loops defined

But these all write *into* the system. **Almost nothing reads from them at inference time.** The context assembler pulls from 14 sources but none of those sources are "this user's preferred answer style" or "this user's rejected model list" or "this user's weakest concepts that should be surfaced first."

### The 5-loop taxonomy

Every product with real personalization has some mix of these 5 loops:

| Loop | Input | Output | Example competitor |
|---|---|---|---|
| **Implicit preference** | Click / dwell / skip | Item ranking for future sessions | Netflix, Spotify, TikTok |
| **Explicit preference** | Thumbs / star / save | Same | YouTube, Reddit |
| **Completion signal** | Task completed / abandoned | Difficulty / pacing adjust | Duolingo, Khan, Peloton |
| **Error correction** | Wrong answer / bug report | Model correction / content fix | Brilliant, GitHub Copilot |
| **Longitudinal identity** | All of the above over time | A persistent "model of the user" | Replika, ChatGPT memory |

### Stewardly per-loop status

| Loop | Data collected | Feedback wired back | Verdict |
|---|---|---|---|
| Implicit preference | message opens, model clicks | No routing adjustment | **dark telemetry** |
| Explicit preference | thumbs up/down via `rateResponse` | Aggregate approval but not per-user routing | **dark telemetry** |
| Completion signal | SRS reviews in learning | Per-item confidence update (real) | ✓ only loop that fully closes |
| Error correction | chat errors, failed tools | Nothing wired back | **dark telemetry** |
| Longitudinal identity | `user_memories` + `episodic_memories` | Consolidation runs nightly; inference path doesn't use aggregation | **partial** |

Only the SRS loop fully closes. All other loops are "dark telemetry" — data is captured but never consumed by the inference pipeline.

### The 8 critical personalization gaps

1. **The context assembler ignores user feedback history.** `deepContextAssembler` pulls from memory/profile/docs/history/etc. It does not pull from `responseRatings` ("this user hated verbose answers") or from per-user acceptance rate on recommendations ("this user rejects conservative recommendations").

2. **The model router is not per-user.** `templateOptimizer.ts` picks a best model per domain platform-wide. Different users have different preferences (cost-sensitive vs quality-sensitive vs speed-sensitive). A per-user contextual bandit is straightforward: `UCB(model | user, task_class)`.

3. **The prompt templates are not personalized.** `promptVariants` run 50/50 for all users. A winning variant for Expert users may be a losing variant for Novice users. Per-user variant assignment conditioned on user cluster.

4. **No drift detection.** `improvementLoops.ts` clusters users into explorer/confirmer/delegator but doesn't detect when a user *changes cluster*. A novice becoming an expert should see different tooling.

5. **No financial drift detection.** The financial twin doesn't notice when a portfolio drifts off allocation, a goal timeline slips, a life event appears. These are exactly the moments when proactive insights matter most.

6. **Memory is stored, not retrieved, in a personalized way.** `user_memories` has a confidence score. The context assembler does not use it as a retrieval weight. High-confidence memories should rank higher.

7. **The learning teacher model is not personalized.** Per-user weakness dashboards and targeted exercise generation do not exist (see Pass 5).

8. **Code Chat does not learn from user edits.** When a user accepts or rejects an edit, nothing changes. Cursor and Copilot use edit acceptance as a reinforcement signal on their suggestion ranker. Stewardly logs nothing.

### The 3 cross-cutting improvements

**A. Build a `UserModel` service** — a single per-user JSON blob (persisted + cached) representing everything the platform has learned about the user:

```
type UserModel = {
  preferences: {
    verbosity: "terse" | "normal" | "verbose"
    tone: "formal" | "friendly" | "enthusiastic"
    costSensitivity: "high" | "medium" | "low"
    riskTolerance: 0..10
    preferredModels: Record<TaskClass, string>  // learned via bandit
    rejectedModels: string[]
  }
  cluster: "explorer" | "confirmer" | "delegator"
  clusterConfidence: number
  mastery: { [concept: string]: { confidence, lastReview, interval } }
  weaknesses: string[]  // top 5 concepts below threshold
  strengths: string[]
  lifeEvents: { type, when, relevance }[]
  financialDrift: { assetAllocation, lastCheck, alerts[] }
  communicationHistory: { lastTurn, channel, sentiment }
  engagementRhythm: { bestTimeOfDay, preferredDayOfWeek }
  rejectedRecommendations: { type, reason, when }[]
  acceptedRecommendations: { type, when, outcome }[]
}
```

Every inference path reads from this. Every telemetry path writes to this. Every improvement loop updates this.

**B. Build a `PersonalizationGateway`** — a tRPC middleware that wraps every LLM call with:
1. Load UserModel for current user
2. Inject relevant UserModel fields into the system prompt
3. Route to the user's best model for this task class (bandit)
4. Assign A/B variants conditioned on user cluster
5. After the call, write telemetry back to UserModel

**C. Build a `ContinuousImprovementEngine`** — a durable-runtime job (from Pass 8) that runs nightly and updates UserModel fields from collected telemetry:
- Bandit update: for each (user, task_class), update model weights from last N ratings
- Cluster re-assessment: for each user, recompute cluster from last N interactions
- Weakness detection: for each user, recompute top-5 weakest concepts from mastery rows
- Drift detection: for each user with financial data, recompute portfolio drift from holdings
- Memory consolidation: aggregate + pin + decay old memories
- Prompt variant promotion: per cluster, promote winning variants

### Specific code-level unlocks

- `deepContextAssembler.ts:86-150` — add `"user_model"` as a 15th context source with highest base priority.
- `contextualLLM.ts:59-114` — every system prompt gets a `<user_preferences>` block appended from UserModel.
- `templateOptimizer.ts:18-68` — replace domain-only model picker with `(domain, userCluster, userId)` lookup via bandit.
- `capabilityModes.ts:74-101` — replace regex keyword classifier with LLM classifier whose routing is refined by user acceptance history.
- `feedbackCollector.ts:9-53` — on rating, also update the UserModel bandit weights.
- `ragTrainer.ts:26-39` — on memory save, update UserModel.memories index with confidence score.
- `improvementLoops.ts:96-142` — when recomputing acceptance rate, compute per-user not just aggregate.

### Pass 9 recommendations

**P0 (closes the loop):**
- (i) Build `user_models` table + `UserModel` service + read/write APIs.
- (ii) Extend `deepContextAssembler` with a `user_model` source.
- (iii) Build `PersonalizationGateway` middleware; route every LLM call through it.
- (iv) Build `ContinuousImprovementEngine` as a durable-runtime nightly job.
- (v) Wire `feedbackCollector` to update UserModel bandit weights.

**P1:**
- (vi) Build `UserModelViewerPopover.tsx` — let users see + edit what the platform knows about them (CCPA compliance win).
- (vii) Per-user prompt variant assignment (with cluster conditioning).
- (viii) Financial drift detection → proactive insight trigger.
- (ix) Cross-loop weakness detection for learning.
- (x) Edit acceptance learning signal for Code Chat.

**P2:**
- (xi) Cohort analysis UI for admins — see how different clusters engage.
- (xii) Drift detection across all verticals (learning, financial, relationships).
- (xiii) A/B result dashboard with per-cluster breakdown.

---

## Pass 10 — Synthesis & Implementation Prompt

### Pass framing

Passes 1–9 produced 60+ distinct gap observations across 9 verticals. This synthesis pass does two things: (a) collapses them into a single **layered architecture** where the lower layers unblock the higher ones, and (b) emits a **self-contained pasteable prompt** for a follow-on implementation chat.

### The layered architecture (what unblocks what)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Layer 5 — Product verticals (chat/code/learn/finance/CRM/marketing) │
│  - Artifacts/canvas, vision, PDF-to-chat, user-visible memory        │
│  - Composer batches, multi-repo, real terminal, test runner, MCP     │
│  - FSRS, teacher model, parametric templates, lesson tutor          │
│  - Live Plaid, tax engine, Reg BI gate, OCR tax returns              │
│  - HubSpot/Salesforce adapters, unified inbox, conversation intel   │
└───────────────────────────────────────────────────────────────────────┘
                                   ↑
┌───────────────────────────────────────────────────────────────────────┐
│  Layer 4 — Personalization loop (UserModel + PersonalizationGateway) │
│  - Closes every dark telemetry path                                   │
│  - Per-user bandit routing                                            │
│  - Drift detection across all verticals                               │
└───────────────────────────────────────────────────────────────────────┘
                                   ↑
┌───────────────────────────────────────────────────────────────────────┐
│  Layer 3 — Workflow & Agent Runtime                                   │
│  - Workflow step executor                                             │
│  - Agent turn executor                                                │
│  - Inter-agent messaging                                              │
│  - Visual DAG editor                                                  │
└───────────────────────────────────────────────────────────────────────┘
                                   ↑
┌───────────────────────────────────────────────────────────────────────┐
│  Layer 2 — Outbound Gateways                                          │
│  - MessageGateway (email/sms/in-app/whatsapp with compliance)        │
│  - DripEngine (on top of durable runtime)                            │
│  - TaxEngine, SuitabilityGate, RegBiGate                             │
└───────────────────────────────────────────────────────────────────────┘
                                   ↑
┌───────────────────────────────────────────────────────────────────────┐
│  Layer 1 — Ingestion                                                  │
│  - Universal Connector (REST + schema discovery)                     │
│  - RSS, HTML scraper, OCR, IMAP, Sheets, Drop Inbox                  │
│  - Unlocks: live market data, CE ingestion, tax doc OCR,             │
│    regulatory feeds, compliance scanning                              │
└───────────────────────────────────────────────────────────────────────┘
                                   ↑
┌───────────────────────────────────────────────────────────────────────┐
│  Layer 0 — Execution Runtime (DurableJobs)                            │
│  - Single service that ALL layers above depend on for reliability    │
│  - Postgres-backed durable queue + worker loop                       │
│  - Replaces in-memory Maps everywhere                                 │
└───────────────────────────────────────────────────────────────────────┘
```

### The critical sequencing insight

**Build Layer 0 first.** Every upper layer needs it for reliability. Build it as a tiny service (200 LOC + schema) before touching anything else.

**Then build Layer 1's Universal Connector.** This single service is how every future integration gets written. It also unblocks Pass 4 (RSS, OCR, scraping), Pass 5 (CE ingestion, regulatory updates), Pass 6 (market data, Plaid), Pass 7 (unified inbox IMAP ingestion), Pass 9 (drift detection on ingested data).

**Then build Layer 2's gateways + engines.** These are stateless services that wrap external systems (messaging, tax).

**Then build Layer 3's runtime.** Workflow executor + agent turn executor + durable background jobs.

**Then build Layer 4's UserModel.** Closes every feedback loop.

**Then pick-and-pack Layer 5's product features** as time allows.

Every feature described in passes 2–9 compiles down to "add another consumer of Layers 0–4." Once the lower layers are in place, a week of feature work at Layer 5 adds what would take a month today.

### Cross-pass gap register — top 50

Each line is `[Pass N] gap description → unlock layer`.

1. [1] Seeded providers with no code → Layer 1
2. [1] Workflow runtime missing → Layer 3
3. [1] Agent runtime in-memory → Layer 0 + 3
4. [1] Financial twin static → Layer 1 + 4
5. [1] Tax layer flat-rate → Layer 2 (TaxEngine)
6. [1] A/B eval stubbed → Layer 4
7. [1] Reg BI is documentation, not gate → Layer 2 (SuitabilityGate)
8. [1] Lead capture no public form → Layer 5 CRM
9. [1] Outbound messaging in-app only → Layer 2 (MessageGateway)
10. [2] No vision pipeline → Layer 5 chat
11. [2] No live web search → Layer 1 (RSS/scraper) + Layer 5
12. [2] No artifacts/canvas → Layer 5 chat
13. [2] No user-visible memory → Layer 4 + 5
14. [2] No conversation sharing → Layer 5 chat
15. [2] No PDF-to-chat wiring → Layer 1 + 5 chat
16. [2] Keyword intent routing → Layer 4
17. [3] No multi-file composer batch review → Layer 5 code
18. [3] Single workspace root → Layer 5 code
19. [3] No real terminal (tmux/xterm) → Layer 5 code
20. [3] No test runner tool → Layer 5 code
21. [3] No typecheck/lint tool → Layer 5 code
22. [3] No MCP consumption → Layer 5 code
23. [3] Background agents not durable → Layer 0 + 3
24. [3] No SSH/remote container → Layer 5 code
25. [4] No generic REST connector → Layer 1
26. [4] No schema discovery from sample → Layer 1
27. [4] No pagination auto-detect → Layer 1
28. [4] No OCR → Layer 1
29. [4] No RSS ingester → Layer 1
30. [4] No HTML scraper → Layer 1
31. [4] No IMAP/inbox ingestion → Layer 1
32. [4] No Sheets bidi → Layer 1
33. [4] No drop inbox → Layer 1
34. [5] Only SM-2 (no FSRS) → Layer 5 learn
35. [5] No teacher model / gap generation → Layer 4 + 5 learn
36. [5] No parametric question templates → Layer 5 learn
37. [5] No wrong-answer weakness dashboard → Layer 4 + 5 learn
38. [5] No lesson-tied tutor → Layer 5 learn
39. [5] No auto-CE ingestion → Layer 1
40. [5] No regulatory update detector → Layer 1
41. [6] No live market data → Layer 1
42. [6] No Plaid holdings → Layer 1
43. [6] No federal/state tax brackets → Layer 2
44. [6] No OCR 1040 → Layer 1
45. [6] No suitability gate → Layer 2
46. [6] No financial drift detection → Layer 4 (+ Layer 1 data)
47. [7] No SendGrid/Twilio gateways → Layer 2
48. [7] No drip scheduler → Layer 3
49. [7] No public lead capture form → Layer 5 CRM
50. [7] No unified inbox → Layer 1 + 5 CRM
51. [7] No conversation intel STT → Layer 1 + 5
52. [8] No durable job runtime → Layer 0
53. [8] No workflow step executor → Layer 3
54. [8] No agent turn executor → Layer 3
55. [8] No visual DAG → Layer 5
56. [8] No inter-agent messaging → Layer 3
57. [8] No user-authored agents UI → Layer 5
58. [9] Dark telemetry — ratings not in inference → Layer 4
59. [9] No per-user bandit routing → Layer 4
60. [9] No drift detection across loops → Layer 4

**Count of gaps per layer:**
- Layer 0: 3 (the blocking one)
- Layer 1: 17 (the biggest unlock)
- Layer 2: 6 (outbound gateways + tax)
- Layer 3: 8 (runtime + multi-agent)
- Layer 4: 10 (personalization loop)
- Layer 5: 16 (product verticals)

Total: 60 distinct gaps. **Layers 0+1 together unlock 20 of them — one third of the gap register.**

### The recursive plan

Six recursive implementation phases, each a self-contained PR series that leaves the platform in a shippable state:

**Phase A — Layer 0 (Execution Runtime).** Durable jobs + worker loop. Migration for `durable_jobs` + `durable_job_runs`. Retrofit `backgroundJobs.ts` + scheduler jobs onto it. ~600 LOC service + 30 tests.

**Phase B — Layer 1 (Universal Connector + non-REST ingestion).** `UniversalConnector`, `schemaInference`, `paginationDetector`, `connectorBuilderWizard`, plus `RssIngester`, `HtmlScraper` (Playwright), `OcrProvider` (tesseract baseline), `InboxIngester` (IMAP), `SheetsBridge`, `DropInbox`. Wire 5 RSS regulatory feeds as first consumers. ~2500 LOC + 80 tests.

**Phase C — Layer 2 (Gateways + Engines).** `MessageGateway` abstraction + SendGrid + Twilio + Compliance wrapper. `TaxEngine` federal brackets (state stubbed). `SuitabilityGate` pre-recommendation middleware. Retrofit every existing `sendNotification` and every `recommendAdvisor*` call. ~1800 LOC + 60 tests.

**Phase D — Layer 3 (Workflow + Agent Runtime).** `workflow.runStep` + `agent.runTurn` handlers on top of Layer 0. Agent marketplace CRUD UI. Inter-agent messaging table. Read-only workflow graph view. Migrate the 5 existing workflow templates to actually execute. ~1500 LOC + 50 tests.

**Phase E — Layer 4 (Personalization Loop).** `user_models` table + `UserModel` service + `PersonalizationGateway` middleware. Wire feedback collector → bandit weights. Add `user_model` source to context assembler. Nightly `ContinuousImprovementEngine` durable job. `UserModelViewerPopover` UI. ~1200 LOC + 40 tests.

**Phase F — Layer 5 (Product features).** Pick high-leverage wins from Passes 2–8:
- Vision + artifacts + PDF-to-chat + shareable links + memory viewer (chat)
- Composer batch + xterm terminal + test runner + typecheck tool + MCP client (code chat)
- FSRS + teacher model + parametric templates + lesson tutor + weakness dashboard (learn)
- Plaid holdings + tax engine wired into calculators + OCR 1040 + compliance gate (finance)
- HubSpot + Salesforce adapters + drip engine + lead capture form + unified inbox (CRM)

### Success metrics per phase

- **Phase A:** Every background operation survives a server restart. Durable jobs dashboard renders. 0 in-memory-only job references.
- **Phase B:** Admin can point at an arbitrary REST API + generate a working spec via LLM in < 5 minutes. 5 regulatory RSS feeds ingesting. OCR passes on 3 sample 1040s.
- **Phase C:** SendGrid email sends a real message. Twilio SMS sends a real message. A Roth conversion analysis respects the user's marginal bracket. A suitability-violating recommendation is blocked.
- **Phase D:** A workflow run actually walks its step list and terminates. An agent runs a scheduled turn. Two agents communicate via messages. Workflow graph view shows live run progress.
- **Phase E:** The context assembler injects `<user_preferences>`. Per-user model routing delivers cheaper responses to cost-sensitive users. User can see + edit what the platform remembers.
- **Phase F:** Feature-specific (see each pass).

### Guardrails for the implementation chat

- No feature in Phase F ships until the layer it depends on is wired.
- No in-memory Map allowed for anything that must survive a restart.
- Every new service is behind a feature flag until 2 consecutive convergence passes are clean.
- Every new integration gets its own unit tests + mocked fetch.
- Every new LLM call goes through `PersonalizationGateway` (once Phase E is done).
- Every new mutation that produces a recommendation goes through `SuitabilityGate` (once Phase C is done).
- Every new table has a drizzle migration + idempotent seed.
- Every new UI has a "Design preview" banner until live data is actually flowing.

---

## Pasteable Implementation Prompt (for follow-on chat)

> Copy everything between the horizontal rules into a fresh Claude Code session.

---

You are resuming work on the **Stewardly financial-advisor AI platform** (TypeScript monorepo, tRPC + Drizzle + TiDB + React 19). A prior session ran a 10-pass competitive analysis against Claude/ChatGPT/Perplexity/Gemini, Cursor/Claude Code/Aider/Devin, Duolingo/Brilliant/Khan/Anki, Bloomberg/Wealthfront/Morningstar/Holistiplan, HubSpot/Salesforce/Attio, Fivetran/Airbyte/Zapier/n8n, LangGraph/Temporal/AutoGen. The full analysis lives at `docs/COMPETITIVE_ANALYSIS_GAPS.md`. **READ THAT FILE FIRST.**

### Ground truth (verified against the codebase)

The platform has: (a) production-wired primitives — file import, webhook receiver, SRS engine, graduated autonomy, context assembler, consensus streaming, Wealth Engine calculators, Edge TTS, Voice I/O, Code Chat with 690+ tests; (b) env-gated real clients — GHL (v1+v2 OAuth), Wealthbox, Redtail, SnapTrade, enrichment waterfall; (c) scaffolded-but-not-runtime — workflow engine, agent runtime, financial twin auto-recompute, tax optimization, A/B eval harness, custom per-conversation system prompts, canvas/artifacts; (d) metadata-only stubs — 17 seeded integration providers with no code, Stripe/SendGrid/Twilio webhooks, MCP tool consumption, FSRS, multi-repo code workspaces, OCR.

### The core architectural insight

Stewardly is wired for telemetry, not for learning. Six layers stack:
- **Layer 0** Execution Runtime (durable jobs) — blocks everything above
- **Layer 1** Ingestion (Universal Connector + RSS + OCR + scraper + inbox + sheets + drop inbox)
- **Layer 2** Gateways (MessageGateway + TaxEngine + SuitabilityGate)
- **Layer 3** Workflow + Agent runtime (on Layer 0)
- **Layer 4** Personalization (UserModel + PersonalizationGateway)
- **Layer 5** Product features (chat/code/learn/finance/CRM vertical wins)

**Layers 0 + 1 alone unblock one third of the 60-gap register.** Build them first.

### Your objective

Implement **Phase A (Layer 0 — Execution Runtime)** end-to-end, on branch `claude/phase-a-execution-runtime` (create it if it doesn't exist). The phase is complete when every success metric below is met and `npm test` plus `npm run typecheck` and `npm run build` are all clean.

### Phase A — Deliverables

Build `server/services/executionRuntime/` as a Postgres-backed durable job queue with a worker loop. No new infra (no Redis, no BullMQ yet — just Drizzle + Postgres row locking).

#### Tables (drizzle migration 0013)

```sql
CREATE TABLE durable_jobs (
  id UUID PRIMARY KEY,
  handler_key VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key VARCHAR(256) UNIQUE,
  status ENUM('pending','running','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
  attempt INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  run_after TIMESTAMP NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMP,
  locked_by VARCHAR(64),
  priority INT NOT NULL DEFAULT 100,
  tenant_id VARCHAR(64),
  user_id VARCHAR(64),
  parent_job_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error TEXT
);
CREATE INDEX idx_durable_jobs_poll ON durable_jobs (status, run_after, priority);
CREATE INDEX idx_durable_jobs_handler ON durable_jobs (handler_key, status);
CREATE INDEX idx_durable_jobs_user ON durable_jobs (user_id, created_at DESC);

CREATE TABLE durable_job_runs (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL,
  attempt INT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  status ENUM('running','succeeded','failed','timeout') NOT NULL,
  worker_id VARCHAR(64),
  result JSONB,
  error TEXT
);
CREATE INDEX idx_durable_job_runs_job ON durable_job_runs (job_id, started_at DESC);

CREATE TABLE durable_job_schedules (
  id UUID PRIMARY KEY,
  handler_key VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  cron VARCHAR(64) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Service API (`server/services/executionRuntime/index.ts`)

```ts
interface DurableJobHandler<TPayload, TResult> {
  key: string              // unique handler key (e.g., "workflow.runStep")
  maxAttempts?: number     // default 3
  timeoutMs?: number       // default 60000
  run(payload: TPayload, ctx: JobContext): Promise<TResult>
}

interface JobContext {
  jobId: string
  attempt: number
  userId?: string
  tenantId?: string
  logger: Logger
  enqueueChild(handlerKey: string, payload: any, options?: EnqueueOptions): Promise<string>
  checkCancellation(): void
}

interface EnqueueOptions {
  runAt?: Date
  delayMs?: number
  idempotencyKey?: string
  priority?: number
  maxAttempts?: number
  userId?: string
  tenantId?: string
  parentJobId?: string
}

class ExecutionRuntime {
  registerHandler<T, R>(handler: DurableJobHandler<T, R>): void
  enqueue<T>(handlerKey: string, payload: T, options?: EnqueueOptions): Promise<string>
  cancel(jobId: string, reason?: string): Promise<void>
  getJob(jobId: string): Promise<DurableJobRow | null>
  listJobs(filter: JobFilter): Promise<DurableJobRow[]>
  start(workerId: string): void   // begins polling loop
  stop(): Promise<void>           // graceful shutdown
}

// Scheduling
interface ScheduleSpec {
  handlerKey: string
  payload: any
  cron: string
}
schedule(spec: ScheduleSpec): Promise<string>  // persists to durable_job_schedules
```

#### Worker loop semantics

- Poll `SELECT ... WHERE status='pending' AND run_after <= NOW() ORDER BY priority, run_after LIMIT N FOR UPDATE SKIP LOCKED` every 1s.
- Lock by updating `status='running', locked_until=NOW()+timeout, locked_by=workerId`.
- Invoke handler with timeout.
- On success: `status='succeeded', completed_at=NOW()`, write durable_job_runs row.
- On failure: if attempt < max_attempts, set `status='pending', attempt+=1, run_after=NOW()+exponentialBackoff(attempt)`. Else `status='failed'`.
- On timeout: treat as failure.
- Heartbeat: running jobs extend `locked_until` every 10s.
- Reclaimer: stale locks (`locked_until < NOW()`) go back to pending.

#### Retrofits

Migrate these existing in-memory references onto the runtime:

1. `server/services/codeChat/backgroundJobs.ts` — replace the Map + concurrency counter with `executionRuntime.enqueue("codechat.autonomous", ...)` + a `codechat.autonomous` handler.
2. `server/services/scheduler.ts` — replace `cron.schedule()` calls with `runtime.schedule({handlerKey, payload, cron})` so every cron job becomes a durable job.
3. `server/services/autonomousTraining.ts` — wrap its 4h tick as a scheduled durable job.
4. `server/services/improvement/improvementLoops.ts` — wrap its 6h tick as a scheduled durable job.

#### tRPC router (`server/routers/executionRuntime.ts`)

Admin-gated procedures:
- `listJobs({status?, handlerKey?, userId?, limit, offset})` → paginated durable jobs
- `getJob({jobId})` → job + runs
- `cancelJob({jobId, reason?})`
- `retryJob({jobId})` — re-enqueue a failed job
- `listSchedules()` / `toggleSchedule({scheduleId, enabled})`
- `runtimeStats()` → `{pending, running, succeeded24h, failed24h, perHandler}`

#### Admin UI (`client/src/pages/admin/ExecutionRuntime.tsx`)

- Table of recent jobs (status filter, handler filter, search)
- Click row → drawer showing full payload, runs history, error stack, retry/cancel buttons
- Schedules tab: table of recurring jobs with enable/disable toggle and "run now"
- Stats tab: 24h throughput, failure rate per handler, heatmap of run volume
- Mount at `/admin/runtime` behind adminProcedure guard, add to admin nav

#### Tests (`server/services/executionRuntime/__tests__/`)

- `runtime.test.ts` — enqueue, dequeue, success path, retry path, max-attempts failure
- `runtime.locking.test.ts` — two workers don't pick the same job (simulate via two runtime instances sharing a Drizzle connection)
- `runtime.idempotency.test.ts` — same idempotency key twice produces one job
- `runtime.timeout.test.ts` — a handler that sleeps past timeoutMs gets killed + retried
- `runtime.schedule.test.ts` — a cron schedule enqueues expected jobs at expected times
- `runtime.cancel.test.ts` — cancelled job stops within 1s
- Unit tests for `backoff()`, `exponentialBackoff()`, `reclaimStaleLocks()`
- 30+ tests total

#### Phase A success metrics

1. `npm test` passes with 30+ new tests in `executionRuntime/__tests__/`
2. `npm run typecheck` clean
3. `npm run build` clean
4. Zero references to the word "Map" for background state in `server/services/codeChat/backgroundJobs.ts`
5. Server restart test: enqueue 5 jobs → kill server → restart → jobs still run to completion
6. Admin UI `/admin/runtime` renders live job list and can cancel/retry a job
7. `node toolkit.js verify` still passes
8. `docs/COMPETITIVE_ANALYSIS_GAPS.md` Phase A checklist is ticked off

### Working protocol

- Branch: `claude/phase-a-execution-runtime`
- Commit often; every commit passes typecheck
- Do not start Phase B in this session
- If you hit an architectural fork, document both options in `docs/EXECUTION_RUNTIME.md` and pick the simpler one
- If a retrofit reveals a hidden dependency, leave the old code path alongside the new one behind a feature flag — never break main
- After Phase A merges, open a follow-on chat for Phase B (Universal Connector)

### Non-goals for this session

- Do NOT build the Universal Connector
- Do NOT touch MessageGateway / TaxEngine / SuitabilityGate
- Do NOT build the workflow executor or agent turn executor (that's Phase D)
- Do NOT touch personalization or the UserModel
- Do NOT touch Chat, CodeChat, Learning, Finance product features
- Do NOT add any Layer 5 feature

### When you finish Phase A

Reply with:
1. PR URL
2. The 30+ test file list
3. The diff of `scheduler.ts` and `backgroundJobs.ts` showing the retrofit
4. A screenshot or description of `/admin/runtime` rendering
5. The suggested follow-on prompt for Phase B (Universal Connector) written in the same format as this prompt

Work autonomously. Ask only if you hit a genuine architectural fork that needs human judgment. Otherwise, ship Phase A.

---

---

## Pass 11 — Security, Compliance & Audit Parity (Novel Angle: "Fiduciary-grade security is a product feature, not a checkbox")

### Pass framing

Financial advisory platforms are subject to FINRA 17a-4 (6-year retention of every communication), SEC Rule 204-2 (books & records), Reg BI (best interest documentation), CAN-SPAM, TCPA, CCPA, GDPR, SOC 2 Type II, and in many states DFS 23 NYCRR 500. Most AI coding platforms have none of these. **Stewardly lives at the intersection** — this is simultaneously the platform's biggest moat AND its biggest liability. Miss a requirement and a single customer audit can kill a deal.

### Competitor landscape

| Regime | Who cares | Leader |
|---|---|---|
| FINRA 17a-4 | Broker-dealers, RIAs | Global Relay, Smarsh, Proofpoint Archive |
| SEC 204-2 | RIAs | Orion, Eton, ComplySci |
| Reg BI best-interest doc | BDs | SEI, Envestnet, FeeX |
| SOC 2 Type II | Every enterprise buyer | Vanta, Drata, Secureframe |
| CCPA/GDPR data subject rights | All consumer platforms | OneTrust, TrustArc, DataGrail |
| DFS 23 NYCRR 500 | NY-regulated | Cybersecurity firms |

### 18-dimension scorecard

| # | Dimension | Best practice | Stewardly |
|---|---|---|---|
| 1 | Encryption at rest (AES-256 or equiv) | required | ~ (INTEGRATION_ENCRYPTION_KEY exists, not all PII fields are encrypted) |
| 2 | Encryption in transit (TLS 1.2+) | required | ✓ (assumed via hosting) |
| 3 | Secrets management (vault, rotation) | HashiCorp Vault / AWS SM | ~ (env vars only) |
| 4 | Role-based access control | required | ✓ (5-layer: platform/org/mgr/advisor/user) |
| 5 | Audit log — every mutation | required | ~ (agent_actions + content_history, NOT every mutation) |
| 6 | Immutable archive for communications (FINRA 17a-4) | WORM storage | ~ (compliance_archive exists, not WORM-enforced) |
| 7 | Consent capture + audit (TCPA, CAN-SPAM) | required | ~ (schema has flags, no capture UI or unsubscribe token) |
| 8 | Right to delete (CCPA/GDPR Art 17) | required | ~ (lead_pipeline has pii_deleted flag, no user-facing self-service) |
| 9 | Right to portability (GDPR Art 20) | required | ✗ (no data export endpoint for a user) |
| 10 | Right to access | required | ✗ (no "download everything we have about me") |
| 11 | PII field-level encryption | best practice | ~ (some fields encrypted, inconsistent) |
| 12 | PII redaction in logs | required | ~ (some paths sanitize, inconsistent) |
| 13 | MFA for advisors | required | ✗ (not visible) |
| 14 | SSO / SAML / OIDC | enterprise req | ✗ |
| 15 | Session management (idle timeout, concurrent limit) | best practice | ~ |
| 16 | Anomaly detection / credential stuffing protection | best practice | ✗ |
| 17 | Vulnerability scanning / SAST / dependency alerts | SOC 2 requirement | ~ (GitHub dependabot presumed) |
| 18 | Tabletop incident response + breach notification plan | SOC 2 requirement | ✗ (no runbook) |

### The 7 critical gaps

1. **No universal audit log.** Every mutation in a fiduciary platform must produce an immutable audit entry (actor, target, before, after, timestamp, justification). Stewardly has partial coverage via `agent_actions` and `content_history` but not every mutation passes through a single audit chokepoint.

2. **No user-facing data rights self-service.** CCPA/GDPR require "download everything we have" and "delete everything we have" endpoints. Neither exists as a user-visible flow.

3. **No unsubscribe tokens.** CAN-SPAM requires every commercial email to include a working unsubscribe link. Stewardly doesn't send email today — but when Pass 7's MessageGateway lands, this becomes immediately required.

4. **No MFA / SSO.** Enterprise sales will stall on this.

5. **Communications archive is not WORM.** FINRA 17a-4 requires Write-Once-Read-Many storage with retention locks. `compliance_archive` is a regular Postgres table that can be deleted.

6. **Secrets are env vars.** No rotation, no vault, no per-tenant isolation. Enterprise tenants will want their own KMS key.

7. **No incident response runbook.** A SOC 2 audit will ask "what is your breach notification timeline?" and "show me the last tabletop exercise." Neither exists.

### Pass 11 recommendations

**P0 (SOC 2 blockers):**
- (i) `auditLog` middleware on EVERY tRPC mutation writing to an `audit_log` table with `(actor_id, tenant_id, action, target_type, target_id, before_hash, after_hash, request_id, ip, user_agent, ts)`.
- (ii) `dataRights` router: `requestExport` + `requestDeletion` tRPC procedures that enqueue durable jobs (Layer 0) to compile and deliver.
- (iii) MFA via TOTP for advisor+ roles.
- (iv) WORM wrapper on `compliance_archive` — soft-delete rejected, delete privilege revoked at DB level for app user, retention lock column.

**P1:**
- (v) SSO via SAML 2.0 + OIDC (use Auth0 / WorkOS adapter).
- (vi) Secrets vault abstraction; support env var fallback for dev.
- (vii) Unsubscribe token generation + public `/unsubscribe?token=...` endpoint; required by MessageGateway.
- (viii) Per-tenant KMS key for enterprise tier.

**P2:**
- (ix) Tabletop incident response runbook.
- (x) SAST + dependency scanning CI action.
- (xi) Anomaly detection for auth flows.
- (xii) Session management with idle timeout + concurrent session limit.

---

## Pass 12 — Observability, Reliability & Cost Economics (Novel Angle: "You cannot improve what you cannot see, and you cannot scale what you cannot bill")

### Pass framing

This pass is about the layer below every other layer: **does the platform know what it is doing, what it costs, and whether it is working?** CLAUDE.md mentions OpenTelemetry GenAI spans and per-call cost estimation — but no SLO, no error budget, no cost dashboard per user/per tenant/per model/per task, no alerting, no reliability targets, no incident history, no capacity planning model. Hyperscaler competitors (OpenAI, Anthropic, Google) live and die by these. Stewardly's fast convergence to 9.7/10 masked the fact that the platform has no production truth surface.

### Competitor landscape

| Category | Leader | Core strength |
|---|---|---|
| APM | Datadog / New Relic / Honeycomb | Traces + metrics + logs unified |
| LLM observability | LangSmith / Langfuse / Helicone / Arize Phoenix | Per-call token/cost/latency + eval |
| Prompt eval | Braintrust / Langfuse / Lilypad | Golden set + regression alerts |
| Cost management | CloudZero / Vantage / FOCUS standard | Per-unit cost attribution |
| Incident mgmt | PagerDuty / Incident.io | On-call + runbook + postmortem |
| Feature flags | LaunchDarkly / Unleash / Flagsmith | Gradual rollout + targeted release |
| Error tracking | Sentry / Rollbar | Error fingerprinting + alerting |

### 16-dimension scorecard

| # | Dimension | Leader | Stewardly |
|---|---|---|---|
| 1 | Distributed tracing | OTel / Honeycomb | ~ (GenAI spans on contextualLLM, not all services) |
| 2 | LLM span enrichment (tokens, cost, latency, model) | Langfuse | ~ (fields exist, no dashboard) |
| 3 | Per-user cost tracking | CloudZero | ~ (ai_usage table) |
| 4 | Per-tenant cost tracking | CloudZero | ✗ |
| 5 | Per-model cost attribution | Helicone | ~ (via template_optimization_results) |
| 6 | Per-task-class cost | — | ✗ |
| 7 | Cost dashboard UI | Langfuse / Helicone | ✗ (no admin page) |
| 8 | Prompt regression tests (golden set) | Braintrust | ✗ |
| 9 | Eval harness (accuracy / quality scoring) | Braintrust / Langfuse | ~ (templateOptimizer stubbed per Pass 1) |
| 10 | Error rate dashboards per service | Sentry / Datadog | ✗ |
| 11 | SLO / error budget tracking | Datadog / SLOconf | ✗ |
| 12 | Alerting on anomaly | PagerDuty / Grafana | ✗ |
| 13 | Feature flags with gradual rollout | LaunchDarkly | ~ (some flags, no UI) |
| 14 | Incident response runbook | Incident.io | ✗ |
| 15 | Capacity planning model | — | ✗ |
| 16 | Latency histograms (p50/p95/p99) | Datadog | ✗ |

### The 5 load-bearing gaps

1. **No cost observability.** Stewardly tracks token counts per call but has no "how much did each user cost this month" or "how much did the loop mode cost this session" or "which model domain is bleeding money" surface. Without this, the autonomous training + consensus mode + background jobs can silently run up huge bills.

2. **No eval harness.** `templateOptimizer.ts:29` "simulates" scores until an eval framework is wired. A fiduciary-grade AI platform MUST have a golden set of prompts with expected answers and regression alerts when model changes shift scores. Braintrust or Langfuse is ~a weekend to integrate.

3. **No SLO / error budget.** Without explicit availability targets, the team cannot decide when to slow down for reliability vs speed up for features. SLOs turn qualitative debates into quantitative ones.

4. **No alerting.** When the scheduler silently stops running a cron job (say, because a durable job fails hard), no one knows. Needs Prometheus + Grafana or Datadog + alerting rules.

5. **No per-tenant cost attribution.** When Stewardly goes multi-tenant (enterprise sales), billing ACROSS tenants requires per-tenant cost. Build it into the AsyncLocalStorage tenant context from day one.

### Proposal — "CostLens" dashboard

A single admin page that answers:
- **Total $ last 24h / 7d / 30d**
- **Per user top 20** (identify the one user running up 80% of cost)
- **Per model** (which of 23 models is bleeding, which is idle)
- **Per task class** (chat vs code chat vs loop vs consensus vs learning vs finance)
- **Per feature** (which capability mode produces the best $/value ratio)
- **Forecast** (linear fit + burn rate alert if > budget)
- **Anomaly** (spike detection: any user/model/task class +50% vs baseline)

Backed by `ai_usage` + new `cost_attributions` rollup table refreshed by a durable job every 15 minutes.

### Proposal — "EvalGate"

Every prompt change runs against a golden set before merge:
- `evals/golden_set/` — YAML files with `{prompt, context, expected_contains, not_expected, max_cost, max_latency}`
- `evals/runner.ts` — executes every prompt template against every golden set row
- CI action runs on PR; fails if regression > 10% or new P0 violations
- Results persist to `eval_runs` table with per-variant breakdown
- Admin dashboard shows trend

### Pass 12 recommendations

**P0:**
- (i) Build `CostLens` admin page + `cost_attributions` rollup job (runs on Layer 0).
- (ii) Build `EvalGate` with a 50-prompt golden set across 8 domains; wire CI action.
- (iii) Instrument every LLM call with full OTel span (tokens_in, tokens_out, cost_usd, latency_ms, model, task_class, user_id, tenant_id).
- (iv) Wire Sentry (or equivalent) for error tracking; stop relying on server logs.

**P1:**
- (v) Define 3 SLOs: chat p95 latency < 3s, loop mode completion rate > 95%, background job success > 99%.
- (vi) Alert rules on SLO breach.
- (vii) Feature flag service with admin UI for gradual rollout.
- (viii) Per-tenant cost attribution schema.

**P2:**
- (ix) Latency histograms per endpoint with p50/p95/p99.
- (x) Incident response runbook + on-call rotation.
- (xi) Capacity planning model.

---

## Pass 13 — Multi-tenancy, White-label & Enterprise Readiness (Novel Angle: "Stewardly is a reference architecture — so make it one")

### Pass framing

CLAUDE.md explicitly states Stewardly is "Reference architecture from which shared packages (@platform/intelligence, @platform/config) are extracted for Atlas, AEGIS, and Sovereign." This is the clearest statement of intent in the entire codebase. But the reference extraction has not been done. The platform is not yet a shareable set of packages. There is also no white-label story for selling Stewardly to third-party advisor firms, no per-tenant customization, no org-level theming beyond a stub. Enterprise customers (IBDs, wealth managers, insurance carriers) will not buy a platform that can't be skinned with their logo, hosted on their domain, and governed by their policies.

### Competitor landscape

| Category | Leader | Core strength |
|---|---|---|
| White-label SaaS | HubSpot Partner / Zendesk Enterprise | Per-tenant theming + domain + RBAC |
| Multi-tenant B2B AI | Forethought / Klarna AI / Intercom Fin | Per-tenant model configs + knowledge base |
| Advisor white-label | RightCapital / Advyzon | Firm-branded planning workspace |
| Platform as a product | Shopify / Notion / Airtable | API + apps + marketplace + theming |

### 14-dimension scorecard

| # | Dimension | Leader | Stewardly |
|---|---|---|---|
| 1 | Multi-tenant DB isolation | Row-level via tenant_id | ~ (AsyncLocalStorage + tenantId ctx, inconsistent enforcement) |
| 2 | Per-tenant config overrides | Notion / Linear | ~ (5-layer config exists, limited surface) |
| 3 | Per-tenant theming (colors, fonts, logo) | every B2B leader | ~ (OrgBrandingEditor exists, Stewardship Gold is platform default) |
| 4 | Custom domain per tenant | Shopify | ✗ |
| 5 | Per-tenant AI knowledge base | Forethought | ~ (knowledgeDocuments exists) |
| 6 | Per-tenant prompt customization | — | ~ (org prompts scaffolded, not surfaced) |
| 7 | Per-tenant rate limits + cost caps | Every hosting leader | ✗ |
| 8 | Per-tenant data residency | Enterprise req | ✗ |
| 9 | Shareable extractable packages | Shopify (polaris) / Notion | ✗ (CLAUDE.md stated intent, not done) |
| 10 | Partner portal for white-label resellers | HubSpot | ✗ |
| 11 | Public API for third-party integrators | Every platform | ~ (tRPC is not public API-friendly) |
| 12 | SDK / client libraries | Stripe / Twilio | ✗ |
| 13 | Developer docs / API reference | Stripe | ✗ |
| 14 | Marketplace for apps / extensions | Salesforce / Shopify | ✗ |

### The 6 extraction tasks

1. **Extract `@platform/intelligence`.** The contextualLLM, context assembler, model registry, and event bus are pure-enough to live in a workspace package. Use pnpm workspaces or turborepo. This is the enabler for Atlas/AEGIS/Sovereign.

2. **Extract `@platform/config`.** The 5-layer config resolver (platform → organization → manager → professional → user) is a general-purpose hierarchical config library. Every tenant-aware service consumes it.

3. **Extract `@platform/ingestion`.** The Universal Connector from Pass 4 + ingestion primitives live here.

4. **Extract `@platform/runtime`.** The Layer 0 execution runtime from Pass 10 lives here.

5. **Extract `@platform/ui`.** Design system tokens + 142 components. Stewardship Gold theme + a theme interface so tenants can override.

6. **Extract `@platform/compliance`.** SuitabilityGate + RegBiGate + audit log middleware + fair-lending sanitizer + PII redactor.

### Per-tenant customization surface

- `tenant_themes` table: per-tenant CSS variables, logo URL, favicon, font family
- `tenant_prompts` table: per-tenant system prompt overrides per task class (already scaffolded, expose via UI)
- `tenant_knowledge` already in `knowledgeDocuments` (extend with tenant_id indexing)
- `tenant_rate_limits` table: per-tenant + per-user LLM spend caps
- `tenant_webhooks` table: per-tenant outbound webhooks on significant events
- `tenant_custom_fields` table: per-tenant extension fields on lead/client/etc.
- `tenant_domains` table: mapping of custom CNAME → tenant_id for routing

### Public API story

- A subset of tRPC procedures exposed as REST via a generator (trpc-openapi or similar)
- API keys per tenant with scoped permissions
- Rate limiting per key
- OpenAPI spec generated automatically
- Public docs site (Mintlify / Docusaurus)

### Partner marketplace

- `extensions` table: custom tools a tenant admin can install (using universal connector + custom workflow templates)
- Install flow: partner publishes an `ExtensionManifest.yaml` (tools, UI components, prompts, seed data), tenants install, platform loads at runtime

### Pass 13 recommendations

**P0:**
- (i) Finish `tenantId` enforcement in every tRPC middleware — audit every procedure for AsyncLocalStorage read.
- (ii) Extract `@platform/intelligence` into a workspace package; update imports.
- (iii) Build `tenant_themes` + enable Org Branding editor end-to-end (currently scaffolded).

**P1:**
- (iv) Extract remaining 5 packages.
- (v) Public REST API layer via trpc-openapi.
- (vi) Per-tenant rate limits + cost caps enforced in middleware.
- (vii) Custom domain routing via tenant_domains.

**P2:**
- (viii) Partner marketplace + extensions.
- (ix) SDK + developer docs site.
- (x) Per-tenant data residency (at least US/EU split).

---

## Pass 14 — Mobile, Offline, Accessibility & Privacy UX (Novel Angle: "Every advisor works from a phone, every prospect reads email, every regulator audits UX")

### Pass framing

Four usability dimensions that most B2B platforms ignore and pay for later. Stewardly shipped a mobile bottom tab bar in pass 92 (AppShell), a "skip to main content" link in pass 91, a reduced-motion CSS rule in pass 98, and aria-labels in passes 137-142. This is real WCAG 2.1 AA-ish work. But the platform is still desktop-shaped. Advisors are mobile-first. Prospects are email-first. Regulators are audit-first. Consumers are privacy-first. And the WCAG bar is actually 2.2 now. Each of these deserves a targeted sweep that current optimization passes have not yet run.

### The 4 sub-verticals

**14a. Mobile depth** — Competitors: Superhuman, Cash App, Apollo Mobile, HubSpot Mobile, Attio Mobile.

Stewardly mobile today:
- Bottom tab bar on `<lg` breakpoints (Pass 92)
- `hidden lg:block` on page headers (Pass 145) to avoid double-header
- `hidden md:flex` on Chat advanced controls (Pass 145)
- No PWA manifest
- No offline mode
- No push notifications
- No mobile-specific gestures (swipe-to-archive, pull-to-refresh)
- No installable app icon
- No deep links to specific chat/learning/finance pages via URL schemes

Gap: Stewardly is responsive but not mobile-native. Add PWA manifest, service worker, offline read-only mode (cached Chat history + learning content + financial twin snapshots), push notifications for insights + CE reminders, swipe gestures in Kanban + message lists.

**14b. Offline-first** — Competitors: Linear, Notion, Anki, Obsidian.

Linear's magic trick is that everything works offline and syncs when you come back. For Stewardly:
- Learning flashcards MUST work offline — this is where users are on commutes/airplanes.
- Chat history MUST be readable offline.
- A user should be able to DRAFT a chat message offline and it sends when connectivity returns.
- A financial plan snapshot MUST be viewable offline.

Implementation: IndexedDB cache layer + service worker + sync queue. Use Dexie or similar.

**14c. Accessibility beyond WCAG AA** — Competitors: Apple, Government, every enterprise procurement.

Stewardly has aria-labels, skip-to-content, reduced-motion support. But WCAG 2.2 (updated Oct 2023) added 9 new success criteria including Focus Not Obscured (2.4.11), Dragging Movements (2.5.7), Target Size Minimum (2.5.8 — 24x24px), Consistent Help (3.2.6), Redundant Entry (3.3.7), Accessible Authentication (3.3.8, 3.3.9). Most of these have not been swept.

Pass 14c actions:
- Full WCAG 2.2 audit with axe-core + Playwright
- Ensure every interactive element is ≥24×24 px
- Ensure focus ring is never obscured by overlays
- Add screen reader regression tests (aria-live for streaming responses is in Pass 99; expand)
- i18n: externalize all strings to a resource bundle; support at least en-US, es-MX for US Latino market
- RTL support baseline for Arabic/Hebrew future

**14d. Privacy UX** — Competitors: Apple (Privacy Dashboard), DuckDuckGo, Proton.

Privacy UX is not compliance — it is a PRODUCT feature. Apple's "App Privacy Report" is a product surface, not a legal disclosure. Stewardly users should see:
- A "Privacy Dashboard" page that shows every piece of data the platform has stored
- "What we know about you" — Memory Manager (Pass 2 proposes this, expand)
- "Who has seen your data" — access log per record
- "Where your data flows" — integrations using it
- "Export everything" / "Delete everything" buttons (Pass 11 requires these)
- Per-feature data-use toggles ("Allow AI training on my chats" / "Allow analytics")

### Pass 14 recommendations

**P0:**
- (i) PWA manifest + service worker + offline cache layer (starts with learning + chat read-only).
- (ii) Full WCAG 2.2 axe-core sweep + fix queue.
- (iii) Privacy Dashboard page at `/settings/privacy` with the full lifecycle surface (visible, editable, exportable, deletable).
- (iv) i18n externalization of strings (baseline en-US + es-MX).

**P1:**
- (v) Push notifications for insights / CE reminders via Web Push.
- (vi) Mobile gestures (swipe in Kanban + message lists).
- (vii) Deep link scheme `stewardly://chat/:id`, `stewardly://learning/track/:id`, etc.
- (viii) Offline chat draft queue.

**P2:**
- (ix) RTL support for Arabic/Hebrew.
- (x) Native iOS/Android via Capacitor wrap (optional).
- (xi) Offline write for forms + sync queue.

---

## Pass 15 — Meta-Analysis: The 10 Highest-ROI Concrete Wins Across All Passes

### Pass framing

The 14 preceding passes produced 150+ distinct gap observations. Most of them are net-positive but not urgent. This meta-pass collapses the analysis into the **10 highest-ROI concrete wins** — the ones where marginal effort produces disproportionate outcome across multiple verticals. Each is scored on (impact, leverage, effort, risk) and mapped to the layered architecture.

### The 10 wins

#### Win #1 — Durable Execution Runtime (Layer 0)

- **Impact:** Unblocks workflow engine, agent runtime, background jobs, scheduled ingestion, drip engine, personalization engine — 6 verticals.
- **Leverage:** Every other win depends on this.
- **Effort:** ~600 LOC + schema + 30 tests. Two days of focused work.
- **Risk:** Low. Postgres-backed, no new infra. Old scheduler stays alongside until migrated.
- **Priority:** **P0** (do first).

#### Win #2 — Universal Connector (Layer 1, core)

- **Impact:** Unblocks live market data, CE ingestion, tax doc OCR, regulatory feeds, unified inbox, any third-party API without a pre-written adapter. 17 gaps across Passes 4/5/6/7.
- **Leverage:** Every vertical that needs external data. This is the force multiplier.
- **Effort:** ~1200 LOC for REST connector + schema inference + pagination detector + spec builder + ~1000 LOC for RSS/OCR/scraper/IMAP/sheets/drop inbox. One week focused.
- **Risk:** Medium. Schema discovery is heuristic; sandboxing of arbitrary fetches needs careful design.
- **Priority:** **P0** (do second).

#### Win #3 — MessageGateway + SuitabilityGate (Layer 2)

- **Impact:** Unblocks all outbound messaging (drip, transactional, notifications) + enforces fiduciary safety. 8 gaps across Passes 6/7/11.
- **Leverage:** Every user-facing message and every recommendation.
- **Effort:** ~800 LOC for gateway abstraction + 2 real adapters (SendGrid + Twilio) + compliance wrapper. ~400 LOC for SuitabilityGate middleware.
- **Risk:** Low-medium. Deliverability + consent handling must be right on first send.
- **Priority:** **P0** (third).

#### Win #4 — UserModel + PersonalizationGateway (Layer 4)

- **Impact:** Closes every dark telemetry loop. 10 gaps in Pass 9 + meaningful improvements across every product vertical.
- **Leverage:** Every LLM call in the system benefits. Per-user model routing alone can cut costs 30% for cost-sensitive users.
- **Effort:** ~1000 LOC for UserModel service + gateway middleware + continuous improvement engine. Not huge because the primitives (user_memories, responseRatings, promptVariants) exist.
- **Risk:** Low. Additive layer; does not break anything.
- **Priority:** **P0** (fourth).

#### Win #5 — Workflow + Agent Runtime on Layer 0

- **Impact:** Makes the existing workflow templates and agent scaffolding actually runnable. 8 gaps in Pass 8.
- **Leverage:** Unblocks every predefined workflow (onboarding, annual review, compliance, lead nurture) — none of which execute today.
- **Effort:** ~800 LOC for two handlers (workflow.runStep, agent.runTurn) on top of Layer 0.
- **Risk:** Medium. Must respect graduated autonomy; must be idempotent.
- **Priority:** **P0** (fifth).

#### Win #6 — FSRS + Teacher Model + Parametric Templates for Learning

- **Impact:** Turns Learning from static content consumption into adaptive exam prep. 6 gaps in Pass 5.
- **Leverage:** The learning vertical is the product's highest-frequency user surface (daily SRS reviews). Small quality improvements compound hard.
- **Effort:** ~500 LOC (FSRS replacement + gap detector + template engine) + 50 parametric templates seeded.
- **Risk:** Low. Additive to existing SRS; no data migration required (confidence ladder maps to FSRS rating).
- **Priority:** **P1**.

#### Win #7 — Financial Reality Layer (Plaid + FRED + Tax Engine)

- **Impact:** Turns the financial twin from static scenario simulator into a live advisory tool. 12 gaps in Pass 6.
- **Leverage:** Every calculator, every insight, every recommendation gets live data inputs.
- **Effort:** ~1500 LOC. Plaid integration alone is several days; tax engine federal brackets minimum ~600 LOC. Depends on Layer 1 Universal Connector for efficient onboarding.
- **Risk:** Medium-high. Plaid credential handling is regulated; tax engine must be tested against published examples.
- **Priority:** **P1**.

#### Win #8 — CostLens + EvalGate (Observability)

- **Impact:** Makes every subsequent decision data-driven. 5 gaps in Pass 12.
- **Leverage:** The best time to instrument is before growth, not after.
- **Effort:** ~500 LOC for CostLens dashboard + rollup job. ~500 LOC for EvalGate + 50 golden prompts.
- **Risk:** Low. Read-only instrumentation.
- **Priority:** **P1**.

#### Win #9 — Vision + Artifacts + Memory Manager for AI Chat

- **Impact:** Closes 6 AI Chat parity gaps in Pass 2. Makes chat competitive with Claude/ChatGPT.
- **Leverage:** The AI Chat is the most visible surface. Perception gains matter.
- **Effort:** Vision pipeline is a model routing change (~200 LOC). Artifacts panel is ~600 LOC component + `conversation_artifacts` table. Memory manager popover is ~300 LOC.
- **Risk:** Low. Additive.
- **Priority:** **P1**.

#### Win #10 — Audit Log + Data Rights Self-Service (Compliance)

- **Impact:** Unblocks SOC 2, CCPA/GDPR, enterprise sales. 7 gaps in Pass 11.
- **Leverage:** Every enterprise deal will require these.
- **Effort:** ~600 LOC for audit middleware + new `audit_log` table. ~400 LOC for data rights router + durable jobs for export/delete.
- **Risk:** Low. Middleware is additive; no business logic change.
- **Priority:** **P1**.

### Sequencing

**Week 1:** Win #1 (Durable Runtime) → Win #2 start (Universal Connector REST core)
**Week 2:** Win #2 finish (RSS + OCR + scraper) → Win #3 (MessageGateway + Suitability)
**Week 3:** Win #5 (Workflow + Agent runtime) → Win #4 start (UserModel)
**Week 4:** Win #4 finish → Win #10 (Audit log + Data rights)
**Week 5:** Win #6 (Learning FSRS + teacher model) → Win #9 start (Vision + Artifacts)
**Week 6:** Win #7 (Financial Reality — Plaid + Tax Engine) → Win #8 (CostLens + EvalGate)

Each week ends in a shippable, tested, convergence-clean state. The platform is never broken.

### Not on the top 10 list (but still net-positive)

- Code Chat composer batch / multi-repo / MCP / real terminal — valuable but does not compound across verticals.
- Mobile PWA — high user delight, not urgent for B2B sales.
- WCAG 2.2 audit — required for government procurement, not urgent for retail.
- White-label packages extraction — valuable for Atlas/AEGIS/Sovereign once they're real, not urgent now.
- Conversation intel / call recording — valuable but depends on Win #3 outputs.

These belong in subsequent phases after the top 10 ship.

---

## Pass 16 — Final Consolidated Master Prompt

### Why a second prompt

Pass 10 produced a focused Phase A prompt (Layer 0 Execution Runtime only). This Pass 16 prompt is the **alternative** — the full recursive plan as one pasteable directive — for the case where the follow-on session wants to attempt Phases A-E in sequence within a single long-running chat.

### Which prompt to use

- **Use the Pass 10 prompt** if the follow-on chat has a bounded context budget and needs to ship Phase A to main before any other work.
- **Use this Pass 16 prompt** if the follow-on chat is a long-running autonomous session with checkpoint commits at each phase and time to run all 5 foundational phases.

---

### Master Implementation Prompt — Stewardly Five-Layer Foundation Build

Copy everything below this line into a fresh Claude Code session.

---

You are resuming work on **Stewardly**, a TypeScript + tRPC + Drizzle + TiDB + React 19 financial advisory AI platform on branch `claude/foundation-build`. Create the branch off main if it doesn't exist. The full competitive analysis and architectural plan lives at `docs/COMPETITIVE_ANALYSIS_GAPS.md` — **READ IT FIRST**.

**Your mandate:** Build Layers 0–4 of the foundational architecture in five sequential phases. Each phase must leave the platform in a shippable, convergence-clean state (0 TS errors, 0 test regressions, build clean). Commit often. After each phase, write a phase-summary file to `docs/PHASE_<LETTER>_SUMMARY.md` and run `node toolkit.js verify` before moving on. Each phase should take one or more commits; do NOT skip ahead.

### Guardrails

1. **No feature in Phase F (product verticals) until Layers 0–4 are all done.**
2. **No in-memory Map** for anything that must survive a restart.
3. **Every new service has unit tests** (target 80%+ coverage on new code).
4. **Every new table has a drizzle migration + idempotent seed.**
5. **Every new integration has a mocked-fetch unit test.**
6. **Every new UI shows a "Design preview" banner until live data flows.**
7. **Never break main.** Additive feature flags; old code paths stay alongside new ones until proven.
8. **Respect the Stewardship Gold design system** — no hardcoded sky/slate; use semantic tokens.
9. **Route every new LLM call through `PersonalizationGateway` once Phase E lands** — retrofit older calls too.
10. **Route every new mutation that emits a recommendation through `SuitabilityGate` once Phase C lands.**

### Phase A — Execution Runtime (Layer 0)

Build `server/services/executionRuntime/` as a Postgres-backed durable job queue with a worker loop. Schema: `durable_jobs`, `durable_job_runs`, `durable_job_schedules`. Service: `DurableJobHandler` interface, `ExecutionRuntime` class, worker loop with row-level locking via `FOR UPDATE SKIP LOCKED`. Retrofit `backgroundJobs.ts`, `scheduler.ts`, `autonomousTraining.ts`, `improvementLoops.ts`. Admin UI at `/admin/runtime`. 30+ tests. See the Pass 10 prompt for the full schema and API contract.

**Success:** server restart test passes (enqueue 5 jobs → kill server → restart → all complete), admin UI renders, retrofits merge cleanly.

### Phase B — Universal Connector + Non-REST Ingestion (Layer 1)

Build `server/services/universalConnector/` with:
- `ConnectorSpec` YAML schema (auth, endpoints, pagination, schema, sync_key)
- `schemaInference.ts` — infer JSON schema from a sample
- `paginationDetector.ts` — detect offset/cursor/link/page patterns
- `connectorBuilder.ts` — LLM-authored spec generation
- `connectorRuntime.ts` — fetch + transform + upsert on top of Phase A
- Tables: `connector_specs`, `connector_runs`, `connector_schemas`, `connector_records`, `connector_dead_letters`

Plus non-REST ingesters:
- `ingestion/rss.ts` — `feed-parser` based, wire 5 regulatory RSS feeds
- `ingestion/scraper.ts` — Playwright headless + selector spec
- `ingestion/ocr.ts` — tesseract baseline, hook into fileRouter for PDFs with no text layer
- `ingestion/imap.ts` — IMAP inbox ingestion with LLM classifier
- `ingestion/sheets.ts` — Google Sheets bidirectional sync
- `ingestion/dropInbox.ts` — S3/GCS/Dropbox/Drive webhook + file ingestion

Client:
- `ConnectorBuilderWizard.tsx` — 3-step: URL+auth, LLM generates spec, review+save
- `ConnectorRunDashboard.tsx` — runs table + DLQ replay UI
- `FieldMapperPanel.tsx` — drag-drop source → target with JS transforms

**Success:** Admin can point at an arbitrary REST API + generate a working spec via LLM in < 5 minutes. 5 regulatory RSS feeds ingesting on cron. OCR passes on 3 sample 1040s. 80+ tests.

### Phase C — Outbound Gateways + TaxEngine + SuitabilityGate (Layer 2)

Build:
- `server/services/messageGateway/` — `MessageGateway` interface + `SendGridGateway` + `TwilioGateway` + `PostmarkGateway` (stub) + `SesGateway` (stub) + `InAppGateway` (current) + `CompositeGateway` (routing) + `ComplianceMessageGateway` (wrapper: archive + consent + unsubscribe + quiet hours + CAN-SPAM sender requirement)
- `server/services/dripEngine/` — `DripStep` interface + `DripEngine` class on top of Phase A runtime with tables `drip_campaigns`, `drip_enrollments`, `drip_step_logs`
- `server/services/tax/` — `federalBrackets.ts` (2024-2026 single/MFJ/HoH), `ordinaryVsCapital.ts`, `phaseOuts.ts`, `rothConversionAnalyzer.ts`, `rmdCalculator.ts`
- `server/services/compliance/` — `suitabilityGate.ts` + `regBiGate.ts` + `tradeSurveillance.ts` + `recommendationGate.ts` tRPC middleware

Retrofit:
- Every existing `sendNotification` call routes through `MessageGateway`
- Every existing `uwe.ts taxRate` parameter sources from `TaxEngine.currentMarginalBracket(clientState)`
- Every existing `recommendAdvisor*` mutation passes through `recommendationGate.ts`

**Success:** SendGrid test email sends successfully (env-gated), Twilio test SMS sends successfully, Roth conversion analyzer respects user's actual federal marginal bracket in test, a suitability-violating recommendation is blocked with a clear reason in test. 60+ tests.

### Phase D — Workflow + Agent Runtime (Layer 3)

Build:
- `server/services/workflow/runStep.ts` — `workflow.runStep` handler on Phase A runtime that walks step array, dispatches by `step.type` to llm_call | tool_call | http_request (via universal connector) | human_review | delay | branch | parallel | join | subworkflow | send (via MessageGateway)
- `server/services/agent/runTurn.ts` — `agent.runTurn` handler that loads agent instance + context + tools, executes one turn through contextualLLM, persists action row, respects graduated autonomy gates
- `server/services/agent/messaging.ts` — `agent_messages` table for inter-agent communication
- `client/src/pages/WorkflowGraphView.tsx` — read-only react-flow DAG renderer showing live instance progress overlay
- `client/src/pages/admin/AgentMarketplace.tsx` — agent CRUD + publish/subscribe UI
- `client/src/pages/approvals/Inbox.tsx` — HITL approval queue for blocked workflow steps

Retrofit:
- All 5 existing workflow templates actually execute end-to-end
- `backgroundJobs.ts` Code Chat autonomous jobs run on Phase A runtime
- Existing agent CRUD surfaces the new runtime status

**Success:** Onboarding workflow runs to completion via template execution. Two agents exchange a message via `agent_messages`. Graph view shows live run progress. HITL approval blocks + resumes workflow. 50+ tests.

### Phase E — Personalization Loop (Layer 4)

Build:
- `server/services/userModel/` — `UserModel` type + `user_models` table + `load/save/update` APIs with cache + event-driven dirty flag
- `server/services/personalizationGateway/` — tRPC middleware that wraps every LLM call: load UserModel → inject preferences into system prompt → route to per-user best model via contextual bandit → assign A/B variants conditioned on cluster → after call, write telemetry back
- `server/services/continuousImprovement/` — nightly durable job that updates bandit weights + recomputes user cluster + recomputes top-5 weaknesses + detects financial drift + consolidates memories + promotes A/B winners
- `client/src/components/UserModelViewerPopover.tsx` — "what the platform knows about me" editor

Retrofit:
- `deepContextAssembler.ts` adds `user_model` as 15th source (highest priority)
- `contextualLLM.ts` appends `<user_preferences>` to every system prompt
- `templateOptimizer.ts` replaces domain-only picker with `(domain, userCluster, userId)` bandit lookup
- `feedbackCollector.ts` writes to UserModel bandit on every rating
- `ragTrainer.ts` writes to UserModel.memories index on every store

**Success:** Two users with different verbosity preferences receive differently-shaped answers for the same prompt. Cost-sensitive user is routed to cheaper models. User can see + edit their UserModel. Per-user prompt variant assignment verified by test. 40+ tests.

### After Phase E — Open a new chat

When Phases A–E are complete:
1. Open a Phase F follow-on prompt for product verticals.
2. Do NOT continue building into Phase F in the same session — context will be stale.
3. In the Phase F prompt, specify priorities from Pass 15's top-10 list: Learning FSRS + teacher model, Financial Reality (Plaid + TaxEngine live), Vision + Artifacts for Chat, Audit Log + Data Rights for compliance.

### Reporting

At the end of each phase, report:
1. Phase letter
2. Commit SHAs for this phase
3. Tests added (count + file list)
4. Retrofits completed
5. Success metric verification (test output or screenshot description)
6. Known carry-over items for the next phase
7. `node toolkit.js verify` result

Work autonomously. Ask for human input only when a genuine architectural fork requires judgment. Ship one phase at a time, cleanly.

---

### End of pasteable master prompt

---

## Pass 17 — Go-to-Market, Monetization & Unit Economics (Novel Angle: "Feature parity doesn't matter if the cost-to-serve exceeds the revenue-per-user")

### Pass framing

CLAUDE.md has zero mention of pricing tiers, free-tier limits, trial mechanics, referral programs, virality mechanics, or unit economics. Stewardly has a 5-layer RBAC (platform/org/mgr/advisor/user) but no pricing layer. The 23-model registry ships but does not map to tier entitlements. Background jobs, loop mode, consensus, and Code Chat can all consume unbounded spend from a single user with no cap. This is a pre-revenue feature-complete platform that cannot yet charge anyone without risk.

### Competitor landscape

| Category | Leader | Monetization pattern |
|---|---|---|
| Consumer AI | ChatGPT ($20/mo Plus, $200/mo Pro), Claude ($20/$200), Perplexity ($20/$200) | Subscription tiers with usage caps |
| Coding AI | Cursor ($20/$40), Copilot ($10/$19), Replit ($25/$50), Tabnine | Subscription + token grants |
| Advisor tech | eMoney ($2000/yr/advisor), RightCapital ($1099/yr), MoneyGuide | Per-seat per-year enterprise |
| Learning | Duolingo ($6.99/mo), Brilliant ($13.49/mo), Khan (free) | Freemium + subscription |
| CRM | HubSpot (free → $45 → $450 → $1200), Salesforce ($25 → $150+) | Seat + contact-count tiers |
| Hosting | Vercel, Netlify | Usage-based + team tiers |

### The 10 unit economics dimensions

| # | Dimension | Stewardly state | Gap |
|---|---|---|---|
| 1 | Pricing tier schema | ✗ | No `tiers` table |
| 2 | Feature entitlement map | ✗ | No `tier_entitlements` |
| 3 | Per-tier usage caps | ~ (cost caps exist, not per-feature) | Incomplete |
| 4 | Free tier definition | ✗ | No explicit free tier |
| 5 | Trial mechanics | ✗ | No trial state |
| 6 | Stripe billing integration | ✗ | No billing adapter |
| 7 | Seat / license management | ~ (org structure exists) | Partial |
| 8 | Usage metering dashboard for user | ✗ | Admin sees, user doesn't |
| 9 | Referral program | ✗ | None |
| 10 | Virality surfaces (share, invite, collab) | ~ (BranchComparison fork, not public) | Weak |

### The pricing model proposal

```
Free (forever, gated by daily $ cap on inference):
  - 50 chat messages / day
  - 10 loop iterations / day (1 focus each)
  - No consensus mode
  - 3 learning decks + full SRS
  - 1 Plaid-linked account
  - Read-only workflow templates (cannot execute)
  - No integrations beyond file import

Advisor ($49/mo or $490/yr per seat):
  - Unlimited chat
  - Loop mode with all 5 foci
  - Consensus mode (3 models)
  - All learning decks
  - Unlimited Plaid accounts
  - Workflow templates execute
  - 3 CRM integrations (GHL, Wealthbox, Redtail)
  - 100 leads in pipeline
  - File import unlimited
  - Code Chat read-only

Professional ($149/mo or $1490/yr per seat):
  - Everything in Advisor
  - Code Chat write mode + autonomous jobs
  - Universal Connector for arbitrary integrations
  - Custom agents
  - Unlimited leads
  - Email/SMS outbound (carrier-passthrough rates)
  - TaxEngine + SuitabilityGate
  - Audit log + data rights export

Enterprise (contact):
  - White-label (custom domain + theming)
  - SSO SAML/OIDC
  - Per-tenant data residency
  - Unlimited seats
  - Custom model routing
  - Dedicated support + SLA
  - SOC 2 + compliance artifacts
  - MFA enforcement + per-tenant KMS
```

### The 5 implementation gaps

1. **No `tiers` schema.** Build `subscription_tiers` + `tier_entitlements` tables keying off of a feature flag registry.
2. **No entitlement middleware.** Build `requireEntitlement(featureKey)` tRPC middleware that checks the user's current tier against the feature. Every gated procedure chains it.
3. **No Stripe adapter.** Build `billingGateway.ts` with Stripe primitives: create customer, subscription, webhook handler, invoice list, payment methods. Use Phase A runtime for webhook processing.
4. **No usage dashboard for end users.** Build `/settings/usage` page showing daily/monthly usage per feature with visual progress bars and "upgrade" CTAs when approaching cap.
5. **No referral program.** Build `referral_links` table + `/r/:code` redirect with signup attribution. Credit both sides with X days of next-tier access.

### Virality surfaces

- **Public shared chat** from Pass 2 (already proposed) — every share is a marketing touchpoint.
- **Public shared learning deck** — any user can publish a deck to a public URL; search-indexed.
- **Public shared financial plan screenshot** (opt-in) — watermarked with Stewardly brand.
- **Lead capture form widget** from Pass 7 — every embedded form advertises "Powered by Stewardly."
- **Signup via GitHub OAuth** — uses existing github_token flow to auto-sync repos and feel developer-native.
- **Referral program** — both-sided credit.

### Pass 17 recommendations

**P0:**
- (i) Build `subscription_tiers` schema + 4 seed rows (Free/Advisor/Professional/Enterprise).
- (ii) Build `requireEntitlement` middleware + wire on 20+ highest-cost procedures.
- (iii) Build Stripe adapter + webhook handler on Phase A runtime.
- (iv) Build `/settings/usage` page.

**P1:**
- (v) Seat + license management UI for org admins.
- (vi) Referral program (codes, attribution, both-sided credit).
- (vii) Public shared chat + public shared learning deck.
- (viii) Trial mechanics (14-day free Advisor trial).

**P2:**
- (ix) Annual prepaid discount + lifetime deals for early adopters.
- (x) Usage forecasting for users ("at this rate, you'll hit your cap in 5 days").
- (xi) Enterprise self-service upgrade path.

---

## Pass 18 — Developer Experience & Platform API (Novel Angle: "Every successful platform becomes an API")

### Pass framing

Every platform that compounds becomes an API: Stripe for payments, Twilio for messaging, Plaid for banking, Clerk for auth, Supabase for DB, Vercel for hosting. The pattern is consistent — ship a beautiful UI for end users, then expose the primitives as a developer-facing API with SDKs, docs, webhooks, and a sandbox. Stewardly has 78 tRPC routers and 30+ financial tools; none of them are addressable from outside the app. This is the difference between a product and a platform.

### Competitor landscape

| Category | Leader | API shape |
|---|---|---|
| Payments | Stripe | REST + webhooks + SDKs in 12 languages + idempotency keys + test mode + sandbox |
| Banking | Plaid | REST + webhooks + Link SDK + sandbox with 100+ test institutions |
| Messaging | Twilio | REST + webhooks + SDKs + sandbox numbers |
| Auth | Clerk, Auth0, WorkOS | Embedded components + REST + webhooks + SAML + OIDC |
| LLM gateway | Portkey, OpenRouter | REST (OpenAI-compatible) + multi-provider fallback |
| Advisor APIs | — | None exist — vacant market |

### 12-dimension API scorecard

| # | Dimension | Best | Stewardly |
|---|---|---|---|
| 1 | Public REST endpoints | Stripe | ✗ (only tRPC internal) |
| 2 | OpenAPI spec auto-generated | most platforms | ✗ |
| 3 | Language SDKs | Stripe (12 langs) | ✗ |
| 4 | Webhooks for outbound events | Stripe | ~ (inbound only) |
| 5 | API keys with scoped permissions | Stripe | ✗ |
| 6 | Test mode + sandbox | Stripe | ✗ |
| 7 | Idempotency keys | Stripe | ✗ (only on jobs) |
| 8 | Rate limiting with 429 + retry-after | best practices | ~ |
| 9 | Deprecation policy + version headers | Stripe | ✗ |
| 10 | Developer dashboard | Stripe | ✗ |
| 11 | Logs + replay | Stripe | ~ (webhook replay only) |
| 12 | CLI for local dev | Stripe, Vercel | ✗ |

### The 5 highest-ROI dev primitives

1. **Public tRPC → REST translation via `trpc-openapi`.** Every `createOpenApiRouter`-annotated procedure becomes a REST endpoint. Auto-generates OpenAPI 3.1 spec. Zero additional code per procedure if annotated properly.

2. **API keys table + middleware.** `api_keys` with `(id, tenant_id, user_id, scopes[], last_used_at, rate_limit_tier, revoked_at)`. Middleware checks key → sets ctx.user from key owner → enforces scopes. Existing tRPC procedures work unchanged.

3. **Outbound webhooks.** `webhook_subscriptions` table + `webhook_deliveries` log + durable job on Phase A runtime for retry/backoff. Emit on significant events: `lead.created`, `insight.generated`, `workflow.completed`, `agent.action`, `recommendation.issued`, etc. Same shape as Stripe's webhook model.

4. **Developer dashboard page at `/settings/developers`.** API keys CRUD, event log, webhook endpoints, OpenAPI spec download, test mode toggle.

5. **Sandbox / test mode.** Every tenant has a `test_mode` flag. When true, no real outbound messages sent, no real Stripe charges, no real Plaid calls (use Plaid's sandbox). Test data isolated via `environment='test'` column on every mutation target.

### Internal DX improvements

- **Storybook for the 142 components** — no one knows what's available.
- **Component library reference site.**
- **tRPC procedure reference auto-generated.**
- **A fresh-contributor onboarding quickstart.**
- **Mock data seeders** beyond the current 17 seed files — every developer should be able to `pnpm seed` into a believable demo state.
- **Local LLM mode** — when `OLLAMA_URL` is set, route contextualLLM to a local model for cost-free dev.
- **Replay mode** — replay a recorded session's LLM calls from fixtures; deterministic tests.

### Pass 18 recommendations

**P0:**
- (i) Build API keys + entitlement middleware.
- (ii) Add `trpc-openapi` annotation + auto-generated OpenAPI 3.1 spec; serve at `/api/openapi.json`.
- (iii) Build outbound webhooks registry + delivery system on Phase A runtime.
- (iv) Build `/settings/developers` dashboard.

**P1:**
- (v) Sandbox / test mode flag + environment column on mutation targets.
- (vi) Publish first official SDK (TypeScript + Python).
- (vii) Documentation site using Mintlify or Docusaurus.
- (viii) Storybook for components.

**P2:**
- (ix) CLI (`stewardly`) for local dev.
- (x) OLLAMA local LLM dev mode.
- (xi) Session recording + replay for deterministic tests.

---

## Pass 19 — The Unique Moat: What Stewardly Should Double Down On

### Pass framing

Every preceding pass has been "what is Stewardly missing?" This final pre-synthesis pass inverts the question: **what does Stewardly have that no competitor has?** Because the winning strategy is never "catch up on features competitors built" — it is "double down on the features only you have and make them impossible to replicate."

### The 7 genuine moats

1. **Consensus mode with semantic agreement scoring.** No chat app ships real-time multi-model consensus with LLM-as-judge agreement. This is beyond what Claude, ChatGPT, Gemini, and Perplexity have individually. The feature itself is unique; the implementation quality is production-grade.

2. **Loop mode with 5 foci.** Autonomous diverge/converge loops with user-controlled foci (discovery/apply/connect/critique/general) is a unique interaction primitive. Users control the shape of the reasoning, not just the question.

3. **Graduated autonomy with trust scoring.** `agent_autonomy_levels` with 4 tiers and per-action trust thresholds is exactly the primitive every AI agent platform will end up needing for regulated industries. Stewardly has it; LangGraph doesn't.

4. **Code Chat repository intelligence.** Circular deps detector, import graph, symbol index, TODO markers, edit history ring buffer, action palette, chord keybindings — the inspection surface exceeds Cursor on these specific dimensions.

5. **5-layer config resolver.** Platform → organization → manager → professional → user is the right shape for regulated B2B2C advisory products. HubSpot and Salesforce each have weaker versions.

6. **Fair-lending sanitizer in enrichment.** Proactively stripping race/ethnicity/health/political from enrichment output is a compliance primitive that most enrichment products do not offer.

7. **Stewardship Gold design language.** DM Serif Display + Plus Jakarta Sans + warm gold + deep navy + reduced-motion discipline is a coherent, trustworthy visual identity that the advisor vertical genuinely lacks. Most advisor tech looks like 2014 bootstrap.

### The 3 strategic plays

**Play A — Become the Consensus Layer for AI.**
Package the consensus + weight presets + semantic agreement scorer as a standalone npm package `@stewardly/consensus`. Every LangChain / LlamaIndex / LangGraph / CrewAI user who needs "ask multiple models and synthesize" imports it. Leads to branded awareness in the broader AI ecosystem + contributions back + talent pipeline.

**Play B — Become the Compliance Layer for Regulated AI.**
Package SuitabilityGate + audit log + graduated autonomy + fair-lending sanitizer + Reg BI documentation as `@stewardly/compliance`. Target: every AI coding/chat/agent platform that wants to sell to a regulated buyer but doesn't know how. RIAs, BDs, insurance, healthcare, legal. This is a $B opportunity if positioned right.

**Play C — Become the Repository Intelligence Layer for Code AI.**
Package the import graph + circular deps + symbol index + TODO markers + edit history as `@stewardly/repo-intelligence`. Target: Cursor, Continue, Aider, Zed, v0, every AI IDE that would benefit. Free tier with attribution, paid tier with commercial license.

### Why these three

They share three properties:
1. **The implementation already exists and is well-tested.** (Consensus is ~500 LOC + 19 semantic agreement tests; Compliance is 4 services + middleware; Repo Intelligence is 8 cached services + hundreds of tests.)
2. **The integration surface is narrow and stable.** (Each is a pure function or small service with clear I/O.)
3. **The audience is adjacent to Stewardly's core.** (AI developers, regulated platforms, AI IDEs — all can trial Stewardly itself as a reference customer.)

### What NOT to double down on

- **Raw calculator parity with eMoney/MoneyGuide.** That vertical is a 15-year engineering arms race. Better to out-differentiate (consensus, AI) than out-calculate (eMoney has a head start).
- **Raw chat UI polish vs Claude.** Claude's UX team is 50x bigger. Better to ship the differentiators (consensus, loop, voice companion) and let users who want pure chat use Claude.
- **Raw CRM features vs HubSpot.** HubSpot has 1400 integrations. Better to be the AI layer that sits on top of existing CRMs (GHL + Wealthbox + Redtail adapters) than to compete head-on.
- **Raw code editing features vs Cursor.** Cursor has the VSCode fork advantage. Better to be the repository-intelligence augment that works alongside Cursor.

### Pass 19 recommendations

**P0:**
- (i) Announce and execute `@stewardly/consensus` as first open-source extraction. Public repo, npm publish, README with quickstart, demo site.
- (ii) Write a "Multi-Model Consensus for Fiduciary AI" positioning paper / blog post — establish category.
- (iii) Ensure the consensus mode in-product is the flagship feature surface in all marketing.

**P1:**
- (iv) Extract `@stewardly/compliance` after Phase C lands (since SuitabilityGate needs to be real first).
- (v) Position graduated autonomy as a public API + thought leadership piece.
- (vi) Write "Repository Intelligence: What Cursor Gets Wrong" blog + extract `@stewardly/repo-intelligence`.

**P2:**
- (vii) Conference talks at AI engineering events — differentiation via consensus + compliance + repo intel.
- (viii) Developer partnership program for AI IDEs.

---

## Closing Note

This analysis covers 19 passes + 2 pasteable prompts across 2000+ lines. The recursive loop can continue indefinitely but the marginal return per pass drops sharply after Pass 15 (meta-analysis). The real work is in the follow-on chat that implements Layer 0–4 using the Pass 10 prompt (focused Phase A) or the Pass 16 master prompt (all 5 layers).

The single most important observation: **Stewardly's unique advantages (consensus, graduated autonomy, repo intelligence) are already built; its competitive disadvantages (generic ingestion, personalization loop, workflow runtime, live data) share a single architectural root — the absence of durable execution + universal ingestion.** Fix those two things first. Every other gap becomes an additive weekend sprint after Layer 0 + Layer 1 land.

