# PARITY.md
> Canonical parity tracking doc. Written in parallel by multiple processes.
> Always re-read immediately before writing. Merge, don't overwrite.

## Meta
- Last updated: 2026-04-11T00:00:01Z by chat:optimize-crud-parity-satL3/pass-2
- Comparable target: "best-in-class dynamic CRUD for any integration/pipeline/ingestion process, even where documentation or vendor support is limited or nonexistent but data is available from sources — plus continuous improvement across Code Chat, AI chat financial force multipliers, learning/training/onboarding, CRM/marketing coordination, workflow, and agentic AI/browser/device automation"
- Core purpose: Give Stewardly the ability to dynamically CRUD any integration/pipeline/ingestion process and turn the resulting data fabric into a continuous-improvement force multiplier across every Stewardly surface
- Target user: Platform admin / advisor-tier developer / power client who needs to wire a new data source without writing a schema migration or waiting on a vendor SDK
- Success metric: Time from "I have a URL/sample/cURL and know the data is there" → "live, scheduled, personalized ingestion flowing into the 5-layer intelligence stack" → <10 min (documented), <30 min (undocumented), <60 min (portal-only)
- Current parity score: 58% (composite 5.8 / 10 — revised DOWN after Pass 2 depth findings exposed deeper blockers)
- Passes completed: 2
- Last reconciliation: 2026-04-11T00:00:01Z (conflicts: 0)

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

## Pass 2 Depth Findings (novel blockers below the Pass 1 gap matrix)

These are **deeper** blockers discovered in Pass 2 after reading the actual
code paths behind the Pass 1 gaps. Each depth finding (D-series) annotates
or expands a G-series gap, raising its true effort or revealing a hidden
dependency. Priority re-weights apply.

| ID | Finding | Blocks | True Severity | Effort Δ | Code Evidence |
|---|---|---|---|---|---|
| D1 | `integration_providers.category` is a hardcoded `mysqlEnum(["crm","messaging","carrier","investments","insurance","demographics","economic","enrichment","regulatory","property","middleware"])` — dynamic provider registration CANNOT introduce a new category (e.g., HR-tech, payroll, tax, accounting, e-commerce) without a schema migration | G5 | P0 hard-blocker | +M (need enum-to-varchar migration or category table) | drizzle/schema.ts L2449 |
| D2 | `integration_providers.authMethod` is a hardcoded `mysqlEnum` — dynamic providers CANNOT declare new auth schemes (HMAC, AWS SigV4, Azure AD, OAuth2 client_credentials, JWT, mTLS) without a schema migration | G5, G9 | P0 hard-blocker | +M (same migration path as D1) | drizzle/schema.ts L2454 |
| D3 | `integration_field_mappings.transform` is a closed `mysqlEnum(["direct","lowercase","uppercase","date_parse","phone_e164","currency_cents","boolean_parse","custom"])`. `custom` accepts a string `customTransform` but there is **no runtime registry** that resolves the string → function. Adding a new transform requires BOTH a schema migration AND a runtime registry addition | G7, G8, G11 | P0 hard-blocker | +S (transform registry) + M (enum loosening) | integrations.ts L407 |
| D4 | `DataIngestionOrchestrator.normalizeAndStore` synthesizes `entityId` as `${source.sourceType}-${e.name}-${Date.now()}` — **`Date.now()` defeats cross-run dedup**. Every run creates new entityIds, so the same entity from the same source is duplicated on every ingestion. This is a latent bug that makes G12 (reconciliation) impossible because there's nothing to reconcile against — every record is unique by construction | G12, G32 | P0 latent bug | +S (fix + backfill decision) | dataIngestion.ts L727–737 |
| D5 | `integrationHealth.PROVIDER_TEST_CONFIGS` is a hardcoded Record keyed on 7 known slugs (census, bls, fred, bea, sec-edgar, finra-brokercheck, smsit). Any dynamically-registered provider has **no health check at all** — it falls through to an untested branch. The continuous-improvement loop for dynamic providers is dead on arrival | G5, G26, G44 | P0 hard-blocker on G5's value-add | +M (move test config from code to DB row on provider, or declarative test spec) | integrationHealth.ts L35 |
| D6 | `integration_jobs.errorLog` is a single `text` column, not a structured error object. Replay tooling (G6, G34) requires structured per-record error history with retry counts, stack traces, and raw payload offsets. Today the error trail is a flat string | G6, G34 | P1 | +S (schema + writer update) | drizzle/schema.ts L(ingestionJobs) |
| D7 | `scraperService.scrapeUrl` **never calls** `scraping/robotsChecker.ts` in the live ingestion path. Ethical scraping is enforced by a module that's not wired in. This is a compliance and reputation risk on any new undocumented-source integration | G1, G17 | P1 ethical gap | +S (one-line wiring) | dataIngestion.ts L52–96 vs scraping/robotsChecker.ts |
| D8 | `integrationAnalyzer.analyzeHealth` is a pure function with **zero call sites** in the live code (only potentially in tests). Either wire it in or remove it — it's either dead code or a phantom feature | G10, G26 | P1 latent | +S (decide: wire or delete) | scraping/integrationAnalyzer.ts L19 |
| D9 | `dataValueScorer.ts` accepts a `DataSource` struct that is **not populated anywhere** in the live database schema (`uniqueness`, `costPerQuery`, `queryVolume` have no persistence). G43 is more broken than Pass 1 said — the scorer exists but the upstream data pipeline that would feed it doesn't | G43 | P2 | +M (persist scoring inputs) | scraping/dataValueScorer.ts L8–17 |
| D10 | Event bus emits `prompt.scored` / `compliance.flagged` / `goal.completed` / `memory.stored` but **not** `integration.connected` / `integration.failed` / `ingestion.completed` / `schema.drifted`. G38's continuous-improvement loop needs these events to exist before Chat / Learning / Workflows can subscribe to them | G38, G26, G27 | P1 | +S (emit events from existing code paths) | grep for event.emit — ingestion events absent |
| D11 | Code Chat has 8 tools (`read_file`, `list_directory`, `grep_search`, `write_file`, `edit_file`, `run_bash`, `update_todos`, `find_symbol`). **Zero integration-aware tools** — G23 is deeper than Pass 1 said because there's no abstraction layer; each new tool is a full registry entry + SSE handler + dispatcher branch + system-prompt update + test | G23, G24 | P0 — highest force-multiplier gap | M (6 tools) | codeChatExecutor.ts CODE_CHAT_TOOL_DEFINITIONS |
| D12 | Chat modes are `Single / Loop / Consensus / CodeChat`. There is **no Integration mode** in `Chat.tsx`. The mode-switching UI is already hoisted, so adding a 5th mode is ~1 day but gated on tRPC backend for the integration agent flow (G2) | G2, G16 | P1 | +S (UI) but M (backend integration agent loop) | Chat.tsx mode toggle |
| D13 | Workflow templates (`onboarding`, `annualReview`, `compliance`, `leadNurture`, `reports`) do not include **"new integration onboarding"** or **"data freshness enforcement"**. G40 needs two new templates, not just one | G40 | P2 | +S | server/services/workflow/templates.* |
| D14 | `credentialsEncrypted` key normalization is ad-hoc: every test endpoint calls `creds.api_key \|\| creds.apiKey \|\| creds.access_token`. There is **no credential schema enforcement** — a dynamic provider cannot declare its required credential keys and fail validation on creation. This blocks G5+G9 from producing strongly-typed credentials | G5, G9 | P1 | +S (per-provider credential_schema JSON column + Zod parse at creation time) | integrations.ts L246–248 |
| D15 | `ingestion_jobs` has no `dependsOn` / `triggeredBy` graph. Each job is isolated. DAG execution (G13) has **zero foundation** in the schema — requires a new join table or dependency array column | G13 | P1 | +M | drizzle/schema.ts ingestionJobs |
| D16 | `enrichmentCache` dedup key is `(providerSlug, lookupKey, lookupType)` but has **no schemaVersion column**. If the same provider changes response shape, stale cache entries with an old shape are still served — a silent correctness bug. G10 (schema drift) must include a cache-bust on drift | G10, G20 | P1 | +S (add column + cache-bust on drift) | integrations.ts L530–545 |
| D17 | `extractWithLLM` (web scraper) and `processDocument` (document extractor) are **prompt-injection vectors**. Adversarial HTML/PDF content can instruct the LLM to exfiltrate or mis-extract. Guardrails exist at `contextualLLM` boundary but extraction from untrusted content needs specialized injection-resistant prompting (e.g., sandwiched delimiters, output schema enforcement — which we have — and untrusted-content markers) | G1, G3, compliance | P0 security | +S (prompt hardening) | dataIngestion.ts L101–160, 204–303 |
| D18 | `rateRecommender.ts` + `rateProfiles` table exists but the loop is **open**: recommendations are generated but there's no closed-loop "the recommender changed rates because usage spiked → wait 24h → measure → adjust again". Adminlntelligence router has a recommendations UI (Pass 70) but no automatic apply. Continuous-improvement claim is aspirational | G26 | P2 | +M (closed-loop runner) | server/services/scraping/rateRecommender.ts |
| D19 | `pipelineSelfTest.ts` runs on boot and on-demand but only checks **connectivity + decrypt**, not response shape. The closest thing to data-contract tests (G20) is one layer too shallow | G20 | P2 | +S (add golden-fixture layer) | pipelineSelfTest.ts |
| D20 | Chrome extension has no server counterpart for browser task execution. `linkedin-capture.ts` + `gmail-compliance.ts` are user-initiated client-side. G28 (agentic browser task runner) needs a **server-side** Playwright worker, not just a Chrome extension expansion | G17, G28 | P1 | +L | chrome-extension/content-scripts/* |
| D21 | `normalizeAndStore` confidence-score tie-break is **skip-on-equal**. For equal-confidence conflicting data, no conflict record exists and the newer value is silently discarded. G12 must include a "conflict with equal confidence" branch that stores both + flags for human review | G12 | P1 | +S | dataIngestion.ts L516–530 |
| D22 | Learning EMBA import (`embaImport.ts`) from `mwpenn94/emba_modules` is **one-way, manual-trigger, full-refresh**. No version tracking, no diff, no incremental pull. G27 is deeper than Pass 1 said — needs ETag/If-None-Match + per-file mtime tracking + diff UI | G27 | P2 | +M | server/services/learning/embaImport.ts |
| D23 | Graduated autonomy (DB-backed `agent_autonomy_levels`) is wired into the 8 agentic execution contexts (quotes, applications, etc.) but **not wired to ingestion operations**. G41 needs explicit ingestion-op autonomy levels: "suggest mapping" → "draft mapping" → "apply mapping". There's no current surface for ingestion ops to go through | G41 | P1 | +M | agentic execution paths vs ingestion paths |
| D24 | No **idempotency keys** on ingestion runs. Running the same job twice in parallel (e.g., cron fires while manual trigger is in-flight) doubles records. G44 (circuit breaker) + G6 (replay) both depend on this | G6, G44, G13 | P1 | +S (single idempotency column) | dataIngestion.ts runIngestion |
| D25 | **`normalizeAndStore` swallows errors in a blanket catch** — every record-level error increments `skipped`, losing the distinction between "dedup skip" and "error skip". G11 lineage + G34 replay both need structured error categorization | G11, G34 | P1 | +S (error shape + category) | dataIngestion.ts L547–550 |

## Reconciliation Log (append-only)

| Time | Pass | Action | Conflicts | Notes |
|---|---|---|---|---|
| 2026-04-11T00:00:00Z | 1 | Initial write | 0 | First version of PARITY.md; no prior file to reconcile with |
| 2026-04-11T00:00:01Z | 2 | Depth findings append | 0 | Re-read before write; no concurrent writer. Added D1–D25 depth findings with code line references. Revised composite parity DOWN from 62% → 58% after depth findings exposed D1/D2/D3/D4/D5/D11/D17 as hard-blockers |

## Changelog (append-only, most recent first)

| Pass | Platform | Type | Score Δ | Summary |
|---|---|---|---|---|
| 2 | Claude Code | Depth | -0.45 | Added 25 depth findings (D1–D25) with code line references. Revised parity DOWN to 58%. Exposed hard blockers: enum-closed category (D1), enum-closed authMethod (D2), enum-closed transform (D3), Date.now() defeating dedup (D4), hardcoded PROVIDER_TEST_CONFIGS (D5), 0 integration-aware Code Chat tools (D11), prompt-injection exposure in extractors (D17). Score down is GOOD — we found deeper problems. No code changes. |
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
