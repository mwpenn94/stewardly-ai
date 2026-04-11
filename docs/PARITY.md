# PARITY.md

> Canonical parity tracking doc for the Stewardly recursive build/optimize loop.
> Written in parallel by multiple processes. Always re-read immediately before
> writing. Merge, don't overwrite.

## Meta
- Last updated: 2026-04-11 (Pass 2) by `claude-code @ claude/dynamic-crud-integrations-3hNOR`
- Comparable: "best existing and planned comparables overall to Stewardly repo"
  (informal — Stewardly sits at the intersection of advisor CRM/pipeline tools
  like Wealthbox/Redtail, planning engines like eMoney/MoneyGuide, ingestion
  pipelines like n8n/Airbyte, and code-assistant surfaces like Claude Code.)
- Core purpose (from v2 scope lock): 5-layer financial advisory AI platform
  that makes every layer — consumer → advisor → firm → compliance → data —
  smarter and faster through shared, governed, grounded intelligence.
- Current parity score: 83% (up from 74% after Pass 2)

## Gap Matrix

| ID  | Feature                                           | Present | Depth | Priority | Effort | Aligned | Owner       | Status     |
|-----|---------------------------------------------------|:-------:|:-----:|:--------:|:------:|:-------:|-------------|------------|
| D01 | User/AI-defined dynamic integration CRUD          |   ✅    |  8/10 |  P0      |  L     |   ✅    | claude-code | **landed** |
| D02 | Schema inference from raw samples                 |   ✅    |  8/10 |  P0      |  M     |   ✅    | claude-code | **landed** |
| D03 | Declarative transform DSL (17 step kinds)         |   ✅    |  8/10 |  P0      |  M     |   ✅    | claude-code | **landed** |
| D04 | Source prober (JSON, NDJSON, CSV, TSV, RSS, Atom, HTML JSON-LD, HTML tables) | ✅ | 8/10 | P0 | M | ✅ | claude-code | **landed** |
| D05 | Blueprint versioning + rollback                   |   ✅    |  7/10 |  P0      |  M     |   ✅    | claude-code | **landed** |
| D06 | Blueprint dry-run (no DB write)                   |   ✅    |  8/10 |  P0      |  S     |   ✅    | claude-code | **landed** |
| D07 | Sink dispatcher (ingested_records, learning defs, lead_pipeline, user_memories, proactive_insights) | ✅ | 8/10 | P1 | M | ✅ | claude-code | **landed** (Pass 2) |
| D08 | AI blueprint drafter (URL + description → draft)  |   ✅    |  7/10 |  P0      |  M     |   ✅    | claude-code | **landed** |
| D09 | Scheduled blueprint runs (cron)                   |   ✅    |  8/10 |  P1      |  M     |   ✅    | claude-code | **landed** (Pass 2 — minimal 5-field parser + 60s tick) |
| D10 | Lead capture sink                                 |   ✅    |  7/10 |  P1      |  M     |   ✅    | claude-code | **landed** (Pass 2) |
| D11 | User-memory sink for chat personalization          |  ✅    |  7/10 |  P1      |  S     |   ✅    | claude-code | **landed** (Pass 2) |
| D12 | Proactive-insights sink                            |  ✅    |  7/10 |  P2      |  S     |   ✅    | claude-code | **landed** (Pass 2) |
| D13 | Webhook-triggered blueprint run                   |   ❌    |  0/10 |  P1      |  S     |   ✅    | —           | todo       |
| D14 | HMAC signature verification for webhook sources   |   ❌    |  0/10 |  P1      |  S     |   ✅    | —           | todo       |
| D15 | Public blueprint gallery (shareable templates)    |   ✅    |  5/10 |  P2      |  M     |   ✅    | claude-code | stub (listPublic exposed, no curation UI) |
| D16 | Agent ReAct tool: `blueprint_draft`               |   ✅    |  8/10 |  P1      |  S     |   ✅    | claude-code | **landed** (Pass 2) |
| D17 | Agent ReAct tool: `blueprint_run`                 |   ✅    |  8/10 |  P1      |  S     |   ✅    | claude-code | **landed** (Pass 2) |
| D18 | Pagination support (cursor / page / offset)       |   ✅    |  7/10 |  P1      |  M     |   ✅    | claude-code | **landed** (Pass 2) |
| D19 | Rate-limited run scheduler (per-blueprint rpm)    |   ⚠️    |  3/10 |  P1      |  S     |   ✅    | —           | rateLimitPerMin stored, not enforced |
| D20 | Code Chat integration: inspect/edit blueprint JSON |  ⚠️    |  4/10 |  P2      |  S     |   ✅    | —           | readable via file browser, no dedicated tool |
| D21 | CRM/marketing auto-connect from blueprint         |   ❌    |  0/10 |  P1      |  L     |   ✅    | —           | todo       |

Legend: ✅ present  ⚠️ partial  ❌ missing

## Beyond-Parity Opportunities

- **AI-drafted blueprints** with inferred-schema round-tripping are a direct
  force multiplier on top of Airbyte/n8n. Stewardly's advantage: the drafter
  has compliance + 5-layer context wired in via `contextualLLM`, which means
  the proposed transforms can be role/tier-aware ("advisor-tier sink" vs
  "platform-tier sink") — something neither Airbyte nor n8n can do without
  an external policy engine.
- **Declarative transform DSL** is testable end-to-end (87 unit tests already
  lock behavior). No code execution in the transform step means blueprints
  are safe to edit in-chat, safe to share in the gallery, and safe to run
  under any role without sandbox overhead.
- **Unified sink to learning_definitions**: blueprint that reads a regulatory
  glossary → inline flashcards + tracks in the Learning layer. That's a
  differentiating loop vs. competitors who silo ingestion and learning.

## Anti-Parity Rejections (with rationale)

- **Full visual drag-and-drop pipeline canvas (à la n8n)**: rejected for the
  MVP. Stewardly's chat-first UX means the "authoring surface" is the drafter
  form + JSON preview + code chat inspection. A full canvas is out of
  proportion with the 5-layer core purpose and would dilute focus. Re-open
  if 3+ customers explicitly request it.
- **Arbitrary JavaScript in transform steps**: rejected. Declarative DSL only.
  Code execution breaks the safety model — compliance can't review a JS blob
  the same way it can review a declarative step.
- **Running blueprints directly against production transactional tables**:
  rejected. All writes go to sink tables (`ingested_records`, `learning_*`,
  future `lead_captures`), never core financial state.

## Reconciliation Log

(append-only, one line per merge event)

- 2026-04-11 — initial file creation; no prior version on disk.

## Changelog

(append-only, one line per pass, most recent first)

- 2026-04-11 — Pass 2 (Depth, claude-code, branch
  `claude/dynamic-crud-integrations-3hNOR`): closed D07/D09/D10/D11/D12/D16/D17/D18.
  Added 3 new sinks (lead_pipeline dedup by emailHash, user_memories tagged
  by category, proactive_insights with priority + category); added pagination
  support to the executor (cursor/page/offset with 50-page ceiling + multi-page
  record concatenation capped at maxRecordsPerRun); added blueprintScheduler
  with a minimal 5-field cron parser (literal/range/step/list, POSIX
  DOM/DOW OR semantics, 7→0 Sunday normalization) and a 60s tick wired into
  server boot; added 4 ReAct agent tools (blueprint_probe, blueprint_draft,
  blueprint_list, blueprint_run) routed through a new executeBlueprintTool
  dispatcher and wired into the chat ReAct loop's executeTool callback
  with per-caller userId+role context. 25 new unit tests (18 scheduler + 7
  agentTools) pushing the dynamicIntegrations surface to 112 passing. TS clean,
  build clean in 44.32s, full suite 3,890 passing / 112 pre-existing failures
  (0 regressions).
- 2026-04-11 — Pass 1 (Landscape/Depth, claude-code, branch
  `claude/dynamic-crud-integrations-3hNOR`): landed D01–D08 end-to-end: schema
  + migration 0013, schemaInference + transformEngine + sourceProber (87
  unit tests), blueprintRegistry (CRUD + versioning + rollback), sinkDispatcher
  (ingested_records + learning_definitions), blueprintExecutor (fetch → parse
  → transform → validate → sink with dry-run + run-row audit trail),
  aiBlueprintDrafter (LLM + fallback), tRPC router with 15 procedures,
  `DynamicIntegrations.tsx` page + route + nav entry. TS clean, build 18.26s,
  no regressions (112 pre-existing env-dependent failures match baseline).

## Known-Bad Approaches

(carries v2 KNOWN_BAD_APPROACHES)

- **Arbitrary JS transform steps**: considered and explicitly rejected —
  breaks compliance review path. Do not re-attempt.
- **Writing blueprints directly to hand-coded provider slots in
  `providers.ts`**: considered and rejected — destroys the dynamic-CRUD
  property. Blueprints live in their own tables.
- **Hand-rolled XML DOM parser for RSS**: attempted briefly, dropped in
  favor of regex-based extraction because the project has no XML parser
  dependency and adding one conflicts with the "no new deps" budget. The
  regex parser handles RSS + Atom + CDATA correctly per the 3 sourceProber
  tests.
