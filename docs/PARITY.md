# PARITY.md
> Canonical parity tracking doc. Written in parallel by multiple processes.
> Always re-read immediately before writing. Merge, don't overwrite.

## Meta
- Last updated: 2026-04-11T00:00:00Z by chat:optimize-crud-parity-satL3/pass-1
- Comparable target: "best-in-class dynamic CRUD for any integration/pipeline/ingestion process, even where documentation or vendor support is limited or nonexistent but data is available from sources — plus continuous improvement across Code Chat, AI chat financial force multipliers, learning/training/onboarding, CRM/marketing coordination, workflow, and agentic AI/browser/device automation"
- Core purpose: Give Stewardly the ability to dynamically CRUD any integration/pipeline/ingestion process and turn the resulting data fabric into a continuous-improvement force multiplier across every Stewardly surface
- Target user: Platform admin / advisor-tier developer / power client who needs to wire a new data source without writing a schema migration or waiting on a vendor SDK
- Success metric: Time from "I have a URL/sample/cURL and know the data is there" → "live, scheduled, personalized ingestion flowing into the 5-layer intelligence stack" → <10 min (documented), <30 min (undocumented), <60 min (portal-only)
- Current parity score: 62% (composite 6.25 / 10)
- Passes completed: 1
- Last reconciliation: 2026-04-11T00:00:00Z (conflicts: 0 — first write)

## Pillars (comparable target decomposition)
1. **Dynamic CRUD for integrations / pipelines / ingestion** (documented, undocumented, portal-only)
2. **Personalization + max value-add** across all 5 layers (Person / Client / Advisor / Manager / Steward)
3. **Continuous improvement** across Code Chat, AI chat financial force multipliers, learning / training / onboarding, CRM / marketing coordination, workflow, agentic AI / browser / device automation
4. **Force multipliers** — every improvement should compound (new source → better personalization → better insights → better learning → better workflows → better agents)

## Gap Matrix

Legend: Priority = P0 (must-have) / P1 (high) / P2 (medium) / P3 (nice-to-have).
Depth = 0–10 score against comparable target (0 = missing, 10 = best-in-class).
Effort = S/M/L/XL (1d / 1w / 1mo / 1q).
Aligned = core-purpose alignment (yes / no / partial).

### Pillar 1 — Dynamic CRUD for Integrations / Pipelines / Ingestion

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G1 | LLM-powered schema inference from sample JSON/CSV/XML payload | NO | 0 | P0 | M | yes | — | open |
| G2 | "Integration-from-URL" agentic flow: paste URL → probe → sample → infer → map → register → schedule | NO | 0 | P0 | L | yes | — | open |
| G3 | OpenAPI / Swagger 3.x spec → auto-generate provider + connection template | NO | 0 | P0 | M | yes | — | open |
| G4 | Postman / Insomnia collection importer | NO | 0 | P0 | S | yes | — | open |
| G5 | Dynamic provider registration without schema migration (write to `integration_providers` at runtime) | PARTIAL (seed only) | 3 | P0 | M | yes | — | open |
| G6 | Raw payload storage + idempotent replay (re-run extraction against stored bytes) | NO | 0 | P0 | M | yes | — | open |
| G7 | Versioned field mappings (append-only history, rollback, diff) | NO | 0 | P0 | S | yes | — | open |
| G8 | Semantic LLM-assisted field-mapping suggestions (look at sample values → suggest target) | NO (regex patterns only in `fieldMapper.autoDetectMapping`) | 2 | P0 | S | yes | — | open |
| G9 | cURL-paste credential discovery (paste `curl -H "Auth: ..."` → extract auth mode + headers + params) | NO | 0 | P0 | S | yes | — | open |
| G10 | Schema drift detection + alerting (current response shape vs last-seen) | NO | 0 | P1 | M | yes | — | open |
| G11 | Per-field record lineage (each output field tracks source field + transform + confidence) | NO | 0 | P1 | M | yes | — | open |
| G12 | Multi-source entity reconciliation with merge policy + conflict log | PARTIAL (`normalizeAndStore` overwrites on higher confidence; no conflict record) | 3 | P1 | M | yes | — | open |
| G13 | Pipeline DAG execution (declare "after source A completes, refresh derived B") | NO (each job is independent) | 0 | P1 | L | yes | — | open |
| G17 | Browser automation for portal-only sources (Playwright/Puppeteer flow: login → navigate → export) | NO | 0 | P1 | L | yes | — | open |
| G18 | GraphQL introspection → provider importer | NO | 0 | P2 | M | yes | — | open |
| G19 | Webhook-to-ingestion auto-wire (provision inbound URL + binding to normalizer) | PARTIAL (hardcoded receivers for ghl / dripify / smsit) | 3 | P2 | M | yes | — | open |
| G20 | Data-contract tests (golden fixtures; alert on shape change) | NO | 0 | P2 | S | yes | — | open |
| G21 | Field-mapping time travel (rollback to T-N) | NO | 0 | P2 | S | yes | — | open |
| G31 | Auto-register webhooks on provider connect (e.g., create a webhook endpoint + share URL with provider) | NO | 0 | P2 | S | yes | — | open |
| G32 | Per-source dedup policy config (email hash / URL / custom key) | NO (hardcoded by `record.entityId`) | 3 | P2 | S | yes | — | open |
| G33 | Field-level PII classification + auto-hashing on import (for all record types) | PARTIAL (`hashEmail` / `hashPhone` in lead imports only) | 4 | P1 | M | yes | — | open |
| G34 | Replay pipeline on stored raw payloads with new extraction logic | NO | 0 | P1 | M | yes | — | open |
| G35 | Per-connection retry / backoff / rate-limit policy config | NO (global default) | 3 | P2 | S | yes | — | open |
| G36 | Connection health sparkline + SLO alerts | PARTIAL (`integrationHealth.ts` dashboard exists, no SLO config / sparkline UI) | 5 | P2 | S | yes | — | open |
| G37 | Integration "recipe" library (export / import integration-as-JSON with provider + mapping + schedule) | NO | 0 | P2 | S | yes | — | open |

### Pillar 2 — Personalization + Max Value-Add Across 5 Layers

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G14 | Per-user personalization relevance scoring on ingested records (not just global confidence) | PARTIAL (`getContextEnrichment` filters by isVerified, not per-user) | 3 | P1 | M | yes | — | open |
| G30 | Ingestion-triggered personalization insights per user (new data → insight card for each affected user) | NO | 0 | P1 | M | yes | — | open |
| G42 | Multi-tenant isolation of connections across orgs (hard boundary, not just tier gate) | PARTIAL (tier-gated at RBAC layer; no FK enforcement on org_id) | 5 | P1 | M | yes | — | open |
| G43 | "Data value score" drives what to ingest next (reco engine already has `dataValueScorer.ts`, not surfaced) | PARTIAL | 4 | P2 | S | yes | — | open |

### Pillar 3 — Continuous Improvement (Code Chat, Chat, Learning, CRM/Marketing, Workflow, Agentic)

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G15 | Cost-aware model routing for extraction (cheap model for small payload, expensive for nested JSON) | NO (hardcoded `contextualLLM` in every extractor) | 2 | P1 | S | yes | — | open |
| G16 | Chat "add integration" agentic wizard (conversational: tell me what you want to connect) | NO | 0 | P1 | M | yes | — | open |
| G22 | CRM two-way sync + merge strategy + conflict resolution UI | PARTIAL (GHL/Wealthbox/Redtail adapters exist, mostly inbound) | 4 | P1 | L | yes | — | open |
| G23 | Code Chat tools: `register_integration`, `probe_api`, `infer_schema`, `map_fields`, `replay_ingestion`, `diff_schema` | NO | 0 | P0 | M | yes | — | open |
| G24 | `/add-integration` slash command in Code Chat | NO | 0 | P1 | S | yes | — | open |
| G26 | Integration health → learning feedback loop (failed integrations become training content) | PARTIAL (`integrationImprovementLog` exists, not wired to learning) | 5 | P1 | M | yes | — | open |
| G27 | Learning content auto-discovery + version tracking (new chapters from GitHub auto-pulled) | NO (manual "Import from GitHub" button only) | 3 | P2 | M | yes | — | open |
| G38 | Event-bus-driven continuous improvement (ingestion events → Chat insights → learning updates → workflow suggestions) | PARTIAL (event bus exists; ingestion events not emitted) | 3 | P1 | M | yes | — | open |
| G39 | Marketing campaign auto-wire from ingested lead signals (new provider pulls trigger segment rules) | PARTIAL (leadPipeline exists, no auto-wire) | 4 | P1 | M | yes | — | open |
| G40 | Workflow template library for ingestion → personalization flows | PARTIAL (5 templates exist, none ingestion-centric) | 3 | P2 | S | yes | — | open |
| G41 | Agent autonomy graduation on ingestion ops (suggest → draft → apply) | PARTIAL (graduated autonomy exists in agent layer, not wired to ingestion) | 3 | P1 | M | yes | — | open |

### Pillar 4 — Force Multipliers (Agentic, Cross-Cutting)

| ID | Feature | Present | Depth | Priority | Effort | Aligned | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| G25 | Auto-generated TypeScript adapter from provider metadata (Code Chat writes the adapter file) | NO | 0 | P2 | L | yes | — | open |
| G28 | Agentic browser task runner (generic "do this thing in a browser" agent, Playwright-backed) | NO (chrome-extension is LinkedIn capture + Gmail compliance only) | 2 | P1 | L | yes | — | open |
| G29 | Device automation (iOS / Android / desktop) | NO | 0 | P3 | XL | partial (beyond-parity) | — | open |
| G44 | Auto-pause providers on cost / error threshold (circuit breaker) | NO | 0 | P1 | S | yes | — | open |

## Beyond-Parity Opportunities

Where we can credibly **exceed** the comparable target:

1. **Financial-domain awareness in schema inference** — comparable tools infer generic schemas. Stewardly can infer with financial priors (e.g., "this looks like a 401(k) statement, map to investment_statement.holdings[]") thanks to 260+ domain services.
2. **5-layer tier-aware data routing** — every ingested record can be auto-scoped to platform/org/mgr/pro/user layer based on content classification, something horizontal ETL tools can't do without a separate taxonomy layer.
3. **Compliance-gated extraction** — PII + injection screening on every LLM extraction I/O is already wired via `contextualLLM` guardrails. Generic ETL tools ship this as an afterthought; we ship it as default.
4. **Chat-native "add integration" via natural language** — "Connect me to the FINRA BrokerCheck API for my list of advisors" → agent does the full flow conversationally. Competitors require forms.
5. **Continuous-improvement loop from every failed extraction** — every parse failure becomes a training signal for the learning layer, the agent's RAG trainer, and the Code Chat improvement queue. Horizontal tools log errors; we learn from them.
6. **Recursive optimization passes on integrations themselves** — the same toolkit that optimizes the app can optimize each integration, discovering new fields, better mappings, cheaper models.
7. **Integration Recipe as first-class learning content** — a well-tested recipe becomes a chapter in the EMBA Learning layer, teaching advisors how the source works.
8. **Wealth Engine auto-hydration** — ingested portfolio data flows directly into the 30+ tRPC Wealth Engine procedures for retirement / strategy-comparison / Monte Carlo without a manual step.
9. **Consensus-LLM validation on high-stakes extraction** — use the consensus stream (Round C/D/E) to cross-check extractions on regulatory or compliance documents, exceeding single-model reliability.
10. **Agentic personalization** — each user's ingested-data profile becomes part of their personalization shard, consumed by chat, learning, workflow, and calculators. Generic tools stop at "data in warehouse".

## Anti-Parity Rejections

Where the comparable target implies features we should **NOT** copy because they conflict with core purpose:

1. **Arbitrary-code-execution-as-a-service** — some ETL tools let you write raw JS transforms inline. Core purpose is financial-advisory and compliance-gated; arbitrary code = compliance nightmare. REJECT. Use LLM-generated transforms reviewed by Code Chat + autonomy gating instead.
2. **Unbounded credential storage** — don't accept every conceivable auth scheme. Limit to well-tested (none, api_key, oauth, basic, bearer) and graduate new auth types through explicit review. REJECT "universal auth".
3. **Generic SQL execution on source DBs** — core purpose is not database federation. Limit to read-only HTTP APIs, files, webhooks, and structured exports. REJECT direct DB connections unless explicitly whitelisted.
4. **Manual field-drag-to-map UI** — comparable tools ship drag-and-drop mapping grids. Ours should be LLM-assisted and conversational. REJECT full-drag UI in favor of an LLM-first wizard with drag as a fallback.
5. **Unauthenticated public provider catalog** — some tools expose a public directory. We keep it gated behind `publicProcedure` but never expose credential fields. Already done. PRESERVE, don't relax.
6. **Unlimited retry storms on failing integrations** — don't ship without circuit breakers (G44). Comparable tools default to aggressive retry; we default to conservative with auto-pause. PRESERVE.
7. **CSV-only parser defaults** — comparable tools often ship CSV-first. We already ship 14 parsers including XLSX, PDF, DOCX, VCF, XML, JSON, archive. Do NOT regress to CSV-first.

## Reconciliation Log (append-only)

| Time | Pass | Action | Conflicts | Notes |
|---|---|---|---|---|
| 2026-04-11T00:00:00Z | 1 | Initial write | 0 | First version of PARITY.md; no prior file to reconcile with |

## Changelog (append-only, most recent first)

| Pass | Platform | Type | Score Δ | Summary |
|---|---|---|---|---|
| 1 | Claude Code | Landscape | +0.00 (baseline) | Created docs/PARITY.md with 44-row gap matrix across 4 pillars, 10 beyond-parity opportunities, 7 anti-parity rejections. Scoped integration/ingestion surface to 14 parsers, 11 scraping primitives, 30+ learning tables, 4 gov pipelines, SnapTrade, CRM adapters (GHL/Wealthbox/Redtail), EMBA GitHub importer, chrome-extension (LinkedIn/Gmail only). Composite parity score 62%. No code changes. |

## Known-Bad Approaches (do not re-attempt)

_(none logged on Pass 1 — this list grows as passes discover failed approaches)_

## Open Issues (severity-tagged, parity-relevant)

- CRITICAL: G1–G9 (P0 dynamic-CRUD core) — zero coverage on schema inference, integration-from-URL, spec importers, raw-payload replay, versioned mappings, semantic mapping, cURL-paste.
- HIGH: G10–G17, G22–G24, G28, G44 — schema drift, lineage, reconciliation, DAG, per-user personalization, Code Chat tooling, browser agent, circuit breakers.
- MEDIUM: G18–G21, G25, G27, G31, G32, G34–G37, G39, G40, G43 — GraphQL, webhook auto-wire, contract tests, rollback, recipe library, marketing auto-wire, workflow templates.
- LOW: G29, G33 expansions — device automation (beyond-parity), broader PII classification.

## Implementation Prompt Archive

Each pass produces a copy-pasteable implementation prompt. Archived below for traceability.

_(Pass 1 prompt appears below in the chat output and is not inlined here to keep this doc focused on parity state.)_
