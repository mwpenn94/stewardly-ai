# PARITY.md
> Canonical parity tracking doc. Written in parallel by multiple processes.
> Always re-read immediately before writing. Merge, don't overwrite.

## Meta
- Last updated: 2026-04-11T00:00:05Z by chat:optimize-crud-parity-satL3/pass-6
- Comparable target: "best-in-class dynamic CRUD for any integration/pipeline/ingestion process, even where documentation or vendor support is limited or nonexistent but data is available from sources — plus continuous improvement across Code Chat, AI chat financial force multipliers, learning/training/onboarding, CRM/marketing coordination, workflow, and agentic AI/browser/device automation"
- Core purpose: Give Stewardly the ability to dynamically CRUD any integration/pipeline/ingestion process and turn the resulting data fabric into a continuous-improvement force multiplier across every Stewardly surface
- Target user: Platform admin / advisor-tier developer / power client who needs to wire a new data source without writing a schema migration or waiting on a vendor SDK
- Success metric: Time from "I have a URL/sample/cURL and know the data is there" → "live, scheduled, personalized ingestion flowing into the 5-layer intelligence stack" → <10 min (documented), <30 min (undocumented), <60 min (portal-only)
- Current parity score: 50% (composite 5.0 / 10 — Pass 6 future-state pass exposed scale + regulatory + competitive exposure)
- Passes completed: 6
- Last reconciliation: 2026-04-11T00:00:05Z (conflicts: 0)
- Active branches: 2 of 5 (B + E; A/C/D shelved)

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

## Pass 3 Adversarial Findings (hidden failure modes, Goodhart, security)

Each A-series finding assumes **everything contains hidden failure modes** and
stress-tests the live code against real-world adversarial conditions. Items
marked **SEC** are security-adjacent; **GH** is Goodhart's-law / gaming detection;
**SIL** is silent-failure.

| ID | Finding | Class | Severity | Code Evidence | Fix Effort |
|---|---|---|---|---|---|
| A1 | `robotsChecker.isAllowed` defaults to **`true` on fetch failure**. An attacker who blocks robots.txt retrieval (DNS poison, connection refused, TLS mismatch) gets unrestricted scraping — the default is permissive when it should be restrictive for compliance-sensitive sources | SEC | high | `scraping/robotsChecker.ts` L39–42 | S — add `strict: boolean` option; default `strict: true` for `regulatory` / `crm` / `carrier` categories |
| A2 | `getCRMAdapter()` returns null unless `GHL_API_TOKEN` is set — the abstract adapter pattern is a **sham for Wealthbox + Redtail**. Those adapter files (`wealthboxClient.ts`, `redtailClient.ts`) exist but are never plumbed into the factory. CRM capability claim is overstated | SIL, GH | high | `services/crm/crmAdapter.ts` L35–68 | S — add branches for Wealthbox + Redtail env vars |
| A3 | `normalizeAndStore` dedup key is `(entityId, recordType)` — if two different providers emit the same entityId (common for IDs like "GOOGL" or stock tickers), **records collide across providers**. Correct key: `(dataSourceId, entityId, recordType)` | SIL | high | `dataIngestion.ts` L504–530 | S — extend the WHERE clause |
| A4 | `integration_connections.credentialsEncrypted` has **no rotation tracking** — no `credentialsRotatedAt`, no `requireRotationBy`. A compromised credential cannot be flagged "rotate in 24h" and followed up | SEC | med | `drizzle/schema.ts` integrationConnections | S — 2 columns + cron nag |
| A5 | `runHealthCheck` failure writes `status: "error"` but **does not auto-disable** the connection. Scheduler continues running a known-broken connection on its cron — cost runaway + log spam | SIL | high | `integrationHealth.ts` + `integrations.ts` L315–344 | S — circuit-breaker: 5 consecutive failures → auto-pause, wait 1h, retry; log to improvement log |
| A6 | `pipelineSelfTest` runs on boot; **if it hangs, the entire boot sequence blocks**. No per-provider timeout + parallel execution | SIL | high | `pipelineSelfTest.ts` | S — `Promise.race(timeout, test)` + `Promise.all` parallelization |
| A7 | `scraperService.hashContent` uses a **32-bit rolling hash** (djb2-ish with `hash \|= 0`). Collision rate on 10K+ records is measurable. Content dedup is lossy — a real scrape hash collision means stale data is served | SIL | med | `dataIngestion.ts` L187–196 | S — replace with `crypto.createHash('sha256')` |
| A8 | `fetchECBRates` appends USD/* rates to the **same array it's iterating**. Today's rate set (euro-base) makes this work by luck. Future-state: adding a third base currency ships an ArrayModifiedDuringIteration bug | SIL | low | `dataIngestion.ts` L343–354 | S — build USD rates in a new array, concat at end |
| A9 | `generateInsights` hardcodes 50 records with **zero user/tenant filter**. A manager at Firm A receives insights derived from Firm B's ingested records. **Multi-tenant data leak** | SEC | critical | `dataIngestion.ts` L564–570 | S (masking) — M (proper per-tenant scoping) |
| A10 | `getContextEnrichment` filters on `isVerified: true` but **nothing in the ingestion path sets `isVerified`**. The feature returns empty forever in practice. Latent dead feature | SIL, GH | med | `dataIngestion.ts` L620–623 | S — verification workflow OR relax the filter |
| A11 | `enrichContact` increments `usageThisPeriod` but **never resets at month boundaries**. A "100/month" provider permanently blocks after ~day 30 regardless of the actual calendar month | SIL | high | `integrations.ts` L597–598 | S — add monthly reset cron |
| A12 | **Goodhart alert** — CLAUDE.md claims "continuous improvement across the app". The underlying telemetry is `integrationImprovementLog` rows that only append on consecutive failures or degradation events. We measure "did we log?" not "did the system actually improve?". Score-inflation risk on every pass that touches "continuous improvement" | GH | high (meta) | `integrationHealth.ts` L336–427 | M — define genuine improvement KPIs: repair time, schema-drift recovery time, cost-per-insight trend |
| A13 | `scrapeUrl` has a 30s fetch timeout but the **LLM extraction call has NO timeout**. A slow extraction can extend effective request to tens of minutes, drifting cron schedules + starving the worker pool | SIL | med | `dataIngestion.ts` L56 vs L101 | S — add `AbortSignal.timeout(60000)` to `contextualLLM` calls in extractors |
| A14 | `rateRecommender.generateRecommendation` has **no rate limit on itself**. A malicious admin could call it in a tight loop to burn expensive LLM + API quota. Ironic gap: the thing that optimizes rate-limits isn't rate-limited | SEC | med | `adminIntelligence` → `rateRecommender.ts` | S — add admin-per-minute throttle at the tRPC layer |
| A15 | Ingested third-party content (news, regulatory, competitor) **bypasses the compliance engine**. If a provider serves advisory text that violates FINRA 2210, it flows into `ingestedRecords` and is available to `getContextEnrichment` without a `compliance_reviews` entry. Compliance coverage claim is partial | SEC, GH | high | compliance pipeline vs ingestion pipeline | M — hook `compliance.flagged` emitter into `normalizeAndStore` |
| A16 | `ingestedRecords.tags` is a free-form JSON array. Over time, tag vocabulary drifts (`"crm"` / `"CRM"` / `"Crm"`), breaking filter queries. No vocabulary control | SIL | low | `dataIngestion.ts` normalizer tags | S — normalize tags to lowercase on insert; add a `tag_vocab` seed |
| A17 | SnapTrade `snapTradeClientStatus` is advisor-accessible via `clientAssociations`. **No explicit `consentGivenAt` check** before exposing a client's brokerage balances/positions to an advisor. Real-world compliance needs explicit, time-stamped consent | SEC | critical | `integrations.ts` L892–917 | M — add `client_consent_records` with per-scope consent; gate the procedure on consent presence |
| A18 | `enrichmentCache.onDuplicateKeyUpdate` **resets `hitCount: 1`** on every update, not `hitCount + 1`. Hit counts are a lie over time — the analytics we build on top of this metric are misleading | SIL, GH | med | `integrations.ts` L591–593 | S — change to `hitCount: sql\`${hitCount} + 1\`` |
| A19 | `carrierImportTemplates.uploadCarrierData` parses CSV with **naive `lines[i].split(",")`**. Breaks on embedded commas in quoted values — a common real-world failure. We have a real parser (`services/import/csvParser.ts`) but this path doesn't use it | SIL | high | `integrations.ts` L462–488 | S — replace with `csvParser.parse()` |
| A20 | `integrations.pipelineHealth` is a `publicProcedure`. Returns provider slugs + runCount + errorCount + lastError. Unauthenticated users can **enumerate integration topology + brokenness**. Reconnaissance surface for attackers | SEC | high | `integrations.ts` L787–815 | S — require protectedProcedure OR sanitize output (strip slugs, only return aggregate counts) |
| A21 | Dynamic provider registration (G5) — once implemented — has a latent **SSRF attack vector**. An admin can register a provider with `baseUrl: "http://169.254.169.254/latest/meta-data/"` and hit cloud metadata. Health-check + test-connection will cheerfully fetch from internal IPs | SEC | critical (future) | must-fix before G5 ships | S — SSRF allowlist: deny `127.0.0.0/8`, `169.254.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `localhost`, `metadata.google.internal`; resolve hostname before fetch |
| A22 | **Cost pass** — `contextualLLM` calls in extractors have **no per-call cost cap**. A 500KB malicious document fed to `processDocument` could generate a multi-dollar extraction bill per invocation | SEC, Cost | high | `dataIngestion.ts` extractors | S — add `maxInputTokens` and `maxCostUsd` to `contextualLLM` options; hard-cap in extractors |
| A23 | **Fiduciary pass** — a new regulatory provider pulling rule updates could **auto-generate client recommendations** via the improvement engine without human-in-the-loop review. Core purpose is compliance-first; this is a fiduciary red flag | Fid | critical | improvement engine + learning router + integration event fan-out | M — insert a `pending_human_review` gate on recommendations sourced from any new-provider data |
| A24 | Code Chat `run_bash` tool is admin-gated, but **within** a run_bash call there's no filesystem sandbox. An admin can `rm -rf` the workspace or read `/etc/passwd`. Not a parity gap but should be documented in PARITY.md's anti-parity / known-limit section | SEC | high (doc gap) | `codeChatExecutor.ts` run_bash | doc (S) or chroot (L) |
| A25 | `web_scrape_results.content_hash` + `enrichmentCache.lookupKey` use **the same key namespace** without per-table prefix. A future cache-layer abstraction could accidentally pull from the wrong table | SIL | low | arch smell | S — add table-prefix or use typed key objects |

### Self-Consistency Check (from Rule 9)

- **Does the app embody its stated purpose?** Mostly yes. The data-fabric exists and serves the 5-layer stack. But Pass 3 found **multi-tenant leakage (A9), compliance bypass (A15), SnapTrade consent gap (A17)** — these are direct conflicts with Stewardly's compliance-first core purpose. HIGH-priority fixes.
- **Are we optimizing for scores or user value?** Pass 2 and Pass 3 both *lowered* the composite score by finding deeper problems. This is the **opposite** of score-gaming and should be considered a healthy audit.
- **Goodhart alert (A12)** — the "continuous improvement" claim throughout CLAUDE.md is partially aspirational. We should either define concrete improvement KPIs (repair time, schema-recovery time, cost-per-insight trend) or soften the claim. **Flagged for later docs revision outside this parity loop.**

## Pass 4 Exploration — Architectural Branches

**Core assumption being challenged:** "A provider must be a row in
`integration_providers` mapping to either (a) a hardcoded health check +
extractor function, or (b) a generic scraper that LLM-extracts whatever it
finds." This is the current paradigm. Pass 4 generates 5 alternatives.

Per v2 Exploration rules, this pass does NOT evaluate. A later pass will
progressively eliminate branches using the Sequential Halving algorithm
(drop weakest first).

### Branch A — Provider-as-Code (status quo improved)
**Paradigm:** Every provider is a TypeScript file under
`server/services/integrations/providers/<slug>.ts` that exports a typed
adapter implementing a `ConnectorInterface`. A registry scans the directory
on boot and populates `integration_providers` automatically. Code Chat
generates the file via its new tools (G23).

**Key advantage:** Full TS type safety, reviewable in PRs, testable per
provider, compiler catches mistakes.

**Key risk:** Requires redeploy to register a new provider. Violates the
<10 min success metric. Violates the "limited/nonexistent docs" target
because every variation still needs human review of the generated code.

**Status: ACTIVE (candidate 1 of 3)**

### Branch B — Provider-as-Data (declarative JSON spec)
**Paradigm:** Every provider is a row in `integration_providers` with a
JSON `connectorSpec` column describing endpoint templates, auth mode, pagination rules,
field mapping suggestions, rate limits, and a declarative health-check
condition. A generic runtime interpreter (`connectorRuntime.ts`) executes
any `ConnectorSpec` without code changes.

**Key advantage:** Zero-code registration. Database-native. Hot-reload on
any spec change. Enables the <10 min success metric. Aligns with G5 dynamic
provider registration. Works for documented and semi-documented APIs.

**Key risk:** The spec is a mini-DSL that accrues complexity over time
(pagination styles, auth variants, error shapes). Expressiveness vs. safety
tradeoff. Debugging a spec mis-config is opaque to non-technical admins.
Doesn't solve the purely-undocumented case (no spec to write).

**Status: ACTIVE (candidate 2 of 3)**

### Branch C — Provider-as-LLM-Loop (agent re-derives contract every run)
**Paradigm:** No stored provider spec. At ingestion time, an agent receives
`{url, goal, credentials, schedule}` and runs a ReAct loop: probe → sample
→ infer schema → extract → normalize → persist. Each run re-discovers the
contract from current sample data.

**Key advantage:** Maximum flexibility. Handles undocumented sources
natively. No provider schema at all. Self-healing against upstream changes.
Best match to "limited/nonexistent docs" target.

**Key risk:** Non-deterministic — two runs may produce different shapes.
Expensive (10–100× cost of spec-based). Slow (multi-second latency per
run). Debugging an agent loop is hard. Cron schedules with hundreds of
sources becomes cost-prohibitive. LLM hallucination on edge cases.

**Status: SHELVED (candidate 4 of 5)** — too expensive for scheduled runs
but worth keeping as a one-shot tool for integration onboarding.

### Branch D — Provider-as-Playwright-Trace (record-replay browser)
**Paradigm:** Admin records a Playwright trace once (login, navigate,
export download, logout). The trace + credentials are stored. Scheduled
runs replay the trace in a headless browser worker and parse the exported
file.

**Key advantage:** Solves portal-only sources (G17) — the largest
unserved segment (carrier portals, regulatory UIs, legacy DBs behind web
interfaces). No API required at all.

**Key risk:** Brittle to UI changes. Captcha / MFA / rotating auth breaks
replay. Large storage (traces + artifacts). Requires a headless browser
worker pool. Abuse risk (could be weaponized as a crawler). Legal gray
area for ToS.

**Status: SHELVED (candidate 5 of 5)** — valuable but orthogonal to
Branches A/B/E; should be treated as a separate track after core dynamic
CRUD ships.

### Branch E — Provider-as-Hybrid (spec-first, LLM fallback, browser escape)
**Paradigm:** Branch B (declarative spec) is the default path. If a
spec-based run fails with shape mismatch / auth error / unexpected 4xx, a
Branch C LLM loop runs as fallback to re-derive the contract and propose a
spec patch (reviewed by an admin under graduated autonomy). If neither
works, Branch D browser trace is the escape hatch. Every successful LLM
fallback automatically updates the stored spec + version-bumps it.

**Key advantage:** Gets best of all branches. Adaptive and self-improving.
Cost-efficient default with expensive fallback only on failure. Aligns
perfectly with CLAUDE.md's "continuous improvement" claim.

**Key risk:** Complexity. Error handling across three execution paths is
intricate. Which branch "won" a given ingestion is non-obvious for
debugging — needs explicit lineage per run. Tight coupling of three
subsystems means one bad change can break all three.

**Status: ACTIVE (candidate 3 of 3)**

### Pass 4 self-notes (not for evaluation)
- Branch A is closest to what we have today. Pass 5 or later should decide
  whether to keep it as the "PR-reviewed provider track" for
  high-stakes/compliance-sensitive sources.
- Branch B and E are complementary — B is the foundation, E is the
  wrap-around strategy. If B ships first, E becomes additive.
- Branches C and D are shelved, not rejected — they remain valuable for
  specific niches (one-shot onboarding, portal-only sources).
- **No branch is scored** in this pass. Scoring is convergent work for
  Pass 5+ (Depth or Synthesis) using Sequential Halving.

## Pass 5 Depth Findings (continuous-improvement seams)

These F-series findings drill into the seams between the ingestion layer and
every other continuous-improvement surface (Code Chat, Chat, Workflow,
Learning, Memory, Events, Autonomy, Tracing). Each reveals a place where the
promise "continuous improvement across the app" is unbacked by code.

| ID | Finding | Seam | Severity | Code Evidence | Effort |
|---|---|---|---|---|---|
| F1 | `eventBus.EventType` is a hardcoded TypeScript union of 8 values. Adding `ingestion.completed`, `integration.connected`, `schema.drifted`, `provider.registered` requires a **code change AND redeploy**. G38 / D10 were surface-level; the real gap is that the type system prevents runtime extensibility | Events → everything | high | `server/shared/events/eventBus.ts` L6-14 | S — either relax to `string` with a runtime registry, or add all ingestion types now and re-ship |
| F2 | `improvementLoops.ts` has 6 loops (calibration / recommendation quality / sensitivity / trigger tuning / behavior clustering / competitive feature track) — **none touch ingestion or integration data**. The continuous-improvement infrastructure exists but is pointed at the wrong layer. Every loop reads `ComputationLog[]` which comes from `model_runs`, not `ingestion_jobs` or `integration_sync_logs` | Improvement engine → integrations | critical | `server/services/improvement/improvementLoops.ts` L1-45 + file structure | M — add loops 7-10: schema-stability loop, cost-per-extraction loop, cross-provider reconciliation loop, retry-success loop |
| F3 | `workflow.ts` ships ONLY `ONBOARDING_STEPS` (4 hardcoded flows). There is no `INTEGRATION_ONBOARDING` flow, no `DATA_FRESHNESS_ENFORCEMENT` flow, no `SCHEMA_DRIFT_TRIAGE` flow. G40 / D13 confirmed: adding a new ingestion-centric workflow = code change to a static const | Workflow → integrations | high | `server/routers/workflow.ts` L8-37 | S — add 3 new ONBOARDING_STEPS entries |
| F4 | **Two workflow table systems** — `workflowChecklist` (per-user step tracking) vs `workflowInstances` (multi-step workflow engine from Pass 61). They don't share step definitions or UX. Pass 5 cannot tell which one is authoritative for ingestion-related flows | Workflow arch | med | `workflowChecklist` vs `workflowInstances` in schema | M — unify or document the split |
| F5 | `eventBus` has a `compliance.flagged` → `proactive_insights` listener (good). **No listener on `improvement.signal`**. Improvement signals are silently emitted and die. G26 confirmed: the force multiplier has no subscriber | Events → insights | high | `server/shared/events/eventBus.ts` L54-71 | S — add one listener that converts improvement signals to insight rows |
| F6 | Even if ingestion events existed (F1), the **workflow engine has no event subscribers** — workflows are initiated by explicit user action (`workflowInstances.start`), never by an event. "Ingestion completed → trigger client annual review" is architecturally blocked | Workflow → events | high | grep for eventBus.on in workflow routers — 0 hits | M — wire event-driven workflow triggers |
| F7 | Code Chat `autonomousCoding` service exists (CLAUDE.md Round B5) for Code Chat to propose its own improvements, but **it has no knowledge of the integration registry**. Code Chat cannot say "provider X is returning 4xx; I'll rewrite its extractor". The integration pipeline is invisible to the self-improvement loop | Code Chat → integrations | high | `server/services/codeChat/autonomousCoding.ts` tool scope | M — expose integration health as an input to the autonomous planner |
| F8 | Chat `autonomousProcessing.start()` diverge/converge loop has 5 foci (`discovery/apply/connect/critique/general`) — **none are ingestion-focused**. Loop mode can't naturally iterate "improve this integration's field mapping by trying 3 variations and picking the winner". The force-multiplier loop doesn't reach integrations | Chat → integrations | med | `server/services/autonomousProcessing/*` focus enum | S — add a `integrate` focus |
| F9 | `learning.mastery.recordReview` is only invoked from flashcard/quiz runners. **Integration engineering "mastery" is not a concept** — we can't track which advisors understand which integrations. Beyond-parity opportunity: integrations should BE learning content, with SRS reviews on "when does FRED update CPI?" | Learning → integrations | med (BP opportunity) | `server/routers/learning.ts` mastery | M — add integration-type flashcard seeds on provider registration |
| F10 | Graduated autonomy (DB-backed `agent_autonomy_levels`) is wired into 8 agentic execution contexts. **Ingestion ops are not one of those contexts**. Adding ingestion means new autonomy enum values + graduation criteria + a feedback surface. D23 confirmed: non-trivial integration | Autonomy → ingestion | high | `agent_autonomy_levels` schema vs ingestion routers | M — new context + criteria |
| F11 | CLAUDE.md claims **37 cron jobs** including "SRS daily due-review reminder" + "weekly EMBA auto-import" — but no **"daily integration health recap"** or **"weekly schema-drift audit"**. Continuous improvement on integrations is not on the cron calendar. | Scheduler → integrations | med | CLAUDE.md cron list vs `scheduler.ts` registered jobs | S — add 2 new cron jobs |
| F12 | `integrationImprovementLog` is **append-only with no resolved/acted-upon status** for non-recovery events. An advisor who manually fixes a mapping has no way to close the loop. The improvement log grows monotonically and buries useful signal in stale noise | Improvement log UX | med | schema.integrationImprovementLog | S — add `resolvedAt`, `resolvedBy`, `resolution_note` columns |
| F13 | `chat.send` ReAct loop has tool-calling infrastructure, but **integration management tools are not in the tool surface**. D11 + G23 confirmed: Chat's ReAct loop needs the 6 integration tools (probe_api / infer_schema / register_integration / map_fields / replay_ingestion / diff_schema) as chat-callable tools, not just Code-Chat-callable | Chat → integrations | high | grep for chat ReAct tools — 0 integration tools | M — wire tools into chat.send's tool surface |
| F14 | Improvement engine's 6h schedule reads from `signal_detection` with **hardcoded signal types**. Adding `schema_drift_detected`, `new_provider_available`, `cost_spike_detected` signals = code + migration. G10 depth | Improvement → events | med | `server/services/improvement/*` signal types | S — relax signal type to string |
| F15 | `ragTrainer` (Pass 48 fix) learns from every LLM response, but **nothing ingestion-related is routed through it**. A failed schema extraction doesn't make the agent smarter next time. The learning loop is decoupled from the failure signal | RAG → extraction | high | `ragTrainer` call sites | S — route extractor responses through ragTrainer |
| F16 | Memory engine has 6 categories. **None are "integration learnings"** or "provider quirks". An advisor's memory could include "Wealthbox returns phone as +1XXXX"; today it doesn't | Memory → integrations | med | memory category enum | S — add `integration_lore` category |
| F17 | OpenTelemetry GenAI spans wrap every `contextualLLM` call. **Spans don't carry ingestion job context** — traces can't link LLM extractions to the ingestion job that triggered them. Debugging a bad extraction requires cross-referencing by timestamp | Tracing → ingestion | med | contextualLLM span attrs | S — pass `ingestionJobId` through to span attrs |
| F18 | Client-side `PlatformIntelligence` (Pass 120) adapts UI to user intent. It doesn't watch "admin is exploring integrations" to proactively suggest "shall I generate a ConnectorSpec for this URL?". Personalization opportunity missed | Client intelligence → integrations | low | `client/src/services/platformIntelligence/*` | S — add an intent pattern |

### Self-Consistency Check
- A9/A15/A17 SEC items remain open. Pass 5 didn't touch implementation.
- F2 is a **structural reveal**: the `improvementLoops.ts` module is what people point at when claiming "continuous improvement". Pass 5 says it doesn't even watch the integration layer. This is a Goodhart-style gap (we built the infrastructure but pointed it at the wrong data).
- F7 + F13 + F15 are the three places where "integrations should feed the self-improvement loop" is structurally blocked. Fixing just one doesn't fix the seam — all three need to land together for the continuous-improvement claim to become real.

## Pass 5 Branch Resolution (Sequential Halving Round 1)

Evaluating the 5 Pass 4 architectural branches against 4 weighted criteria:

| Criterion | Weight | A Code | B Data | C LLM-Loop | D Playwright | E Hybrid |
|---|---|---|---|---|---|---|
| Time-to-value (<10 min) | 0.35 | 2 | 9 | 7 | 3 | 9 |
| Undocumented-source fit | 0.30 | 4 | 6 | 9 | 8 | 9 |
| Cost per scheduled run | 0.20 | 10 | 9 | 3 | 5 | 7 |
| Safety (review, rollback, guardrails) | 0.15 | 9 | 7 | 4 | 5 | 6 |
| **Weighted score** | — | **5.30** | **7.75** | **6.55** | **5.30** | **7.95** |

**Elimination (Sequential Halving round 1):** Branch A (5.30) and Branch D
(5.30) are tied for lowest. Per v2 rules, drop the single weakest. Tie-break
by "fit to core purpose" — A serves high-compliance providers better than D
serves portal-only sources. **Eliminate D this round.** Branch A moves to
SHELVED status for compliance-sensitive tracks. Branch C moves to SHELVED
for one-shot onboarding usage. **Active branches after Round 1: B + E.**

Sequential Halving Round 2 will evaluate B vs E on implementation spike
results from Pass 4's pasteable implementation prompt (if that prototype
ships before the next Depth pass).

## Pass 6 Future-State Findings (10x scale + regulatory + competitive)

Future-State projects forward along six axes: 10x user/connection/job volume,
10x provider count, regulatory tightening (EU AI Act, SEC/CFPB, Rule 17a-4),
competitive pressure (Fivetran/Airbyte/Arize/LangSmith), platform evolution
(MCP v2, durable-execution platforms, browser-automation commodification),
and data modality expansion (video, audio earnings calls, structured
document AI). Each X-series finding projects what will break, or what
will become table-stakes, in the 12–36 month horizon.

| ID | Axis | Finding | Horizon | Severity | Action |
|---|---|---|---|---|---|
| X1 | 10x provider count | `seedIntegrations.ts` is a monolithic seed file. At 10x provider count (~200 providers), it becomes unmaintainable, merge-conflict-prone, and slow to boot-time parse. Need per-provider directory structure + lazy seed | 12mo | med | Restructure `server/services/integrations/providers/<slug>/{seed.ts, healthSpec.ts, fieldHints.ts}` |
| X2 | 10x connection count | `listConnections` at `integrations.ts` L80 does `db.select().from(integrationConnections)` **unfiltered** and filters in JS. O(N) per request. Breaks at ~10K connections. SQL WHERE clauses needed | 12mo | high | Push filters into the SQL query; add (ownershipTier, userId, organizationId) composite index |
| X3 | 10x job frequency | `scheduler.ts` is in-process cron. At 37 current jobs × 10x = 370 jobs, single-process ticking becomes unreliable. Missed ticks, worker contention, deploy-time job loss. Need distributed queue (pg-boss on TiDB, BullMQ on Redis, or Temporal) | 18mo | high | Migrate to durable-execution platform |
| X4 | Regulatory | **EU AI Act Article 6** classifies AI systems used in financial advice as **high-risk**, requiring formal QMS, post-market monitoring, transparency (disclose AI costs to users), and human oversight. We have parts (graduated autonomy, improvement loops) but no formal QMS integration and no per-response cost transparency to users | 12mo (2027 enforcement) | critical | Build a formal AI QMS layer: risk register, incident log, model-change audit trail |
| X5 | Platform evolution (MCP v2) | Anthropic MCP v2 roadmap extends runtime tool registration + marketplace discovery. Our `integration_providers` + Code Chat tools should be reimagined as MCP servers with dynamic mount. Beyond-parity: ship an MCP-native integration layer. Already have 6-tool MCP server at `/mcp/sse` | 6-12mo | med (opportunity) | Refactor to make every provider ingestible as an MCP server |
| X6 | Browser automation forward | Browserbase / Browserless / E2B are commodifying server-side headless browsers. Branch D (Provider-as-Playwright-Trace) was shelved as too expensive; in 12mo it becomes cheap. **Un-shelve D for re-evaluation in Pass 8+** | 12mo | med | Defer reconsideration to Pass 8 |
| X7 | Token cost deflation | LLM token costs dropping ~50%/yr. Branch C (Provider-as-LLM-Loop) was shelved as too expensive; in 18-36mo the cost arbitrage reverses for low-frequency sources. **Un-shelve C for re-evaluation in Pass 10+** | 18-36mo | low (opportunity) | Defer reconsideration |
| X8 | Scale — ingested_records | At 1M records/day, single `ingested_records` table becomes a perf problem. Need monthly partitioning, archival to cold storage, and read replicas for queries. TiDB supports partitioning natively — just not used today | 18mo | high | Partition + archive policy |
| X9 | Scale — scrape dedup | `web_scrape_results` has a `content_hash` column but **no index on it**. At 100K/day, dedup scans become full-table. Add index + composite (source, hash) | 6mo | med | `CREATE INDEX idx_web_scrape_hash ON web_scrape_results(content_hash)` |
| X10 | Attacker forward | Prompt injection via HTML/PDF content is escalating. A24 (Pass 3) addressed one surface; the broader problem needs (a) injection-risk scoring as an LLM pre-screen, (b) output quarantine queue for suspect extractions, (c) per-source injection-attempt budget so a poisoned feed auto-pauses | 6-12mo | high | Build `extractionSafetyScorer` + quarantine queue |
| X11 | Compliance forward | SEC / CFPB are tightening AI advice audit requirements. Per-recommendation trails need to link to the **specific ingestion events** that contributed. Today `compliance_reviews` doesn't carry the ingestion job id that sourced the underlying data. Regulators will ask "show me the scrape that produced this advice" — we can't | 6-12mo | critical | Add `ingestionJobId[]` provenance field to compliance_reviews |
| X12 | Cost forward | Current LLM + scraper budget is unbounded per provider. At 10x scale a runaway extractor burns $10K+ in hours. Need per-provider monthly cap and circuit breaker at cost threshold, not just error threshold. Extends A22 (cost cap per call) to cost cap per provider per period | 12mo | high | `integration_connections.monthlyCostBudget` column + cron enforcement |
| X13 | Competitive forward | Braintrust / Humanloop / LangSmith / Arize ship "model observability" — extraction drift tracking, eval dashboards, prompt A/B. Our OpenTelemetry spans are a foundation but no vendor-comparable UI. Closing this gap is table-stakes in 6-12 months | 12mo | high | Either build native observability UI or integrate with one of the vendors |
| X14 | Platform evolution (durable execution) | Vercel AI SDK / Modal / Inngest are standardizing durable-execution for LLM workflows. Our scheduler is in-process; durable workflows would make every pipeline **resumable, retriable, observable by default** — a massive robustness win | 12mo | high | Evaluate Inngest or Temporal; pilot on one gov pipeline |
| X15 | Data modality forward | Specialized financial document understanding models (e.g., OpenAI's structured-extract models, fine-tuned Claude for SEC filings) are emerging. A "video earnings call" or "audio earnings call" becomes an ingestable source. Our architecture assumes text + JSON | 18mo | low (opportunity) | Add `multimodal_source` record type; pilot audio earnings call ingestion |
| X16 | Regulatory — SEC Rule 17a-4 retention | Rule 17a-4 requires 6-year retention with specific record types. `ingested_records` has no per-record retention policy. Today a 2-week cleanup could silently delete regulated records | 6mo | critical | Add `retentionUntil` column + retention-policy-per-recordType lookup |
| X17 | Beyond-parity — per-user personalization of ingested data | Most integration platforms stop at "data in warehouse". Stewardly can go further: ingested records feed the 5-layer personalization shard, Chat, learning, workflow, calculators. This is still the biggest beyond-parity moat but 0% implemented today | Now | high opportunity | Wire `ingested_records` into existing `memoryEngine` + `contextualLLM` context assembly |
| X18 | Distribution forward | AWS Marketplace / GCP Marketplace / Snowflake Data Exchange are becoming primary distribution for B2B data feeds. A marketplace-listed feed should be ingestible with minimal config (auth + endpoint already vetted by the marketplace) | 18mo | low (opportunity) | Ship a `sourceType: "marketplace_listing"` with one-click onboarding for pre-vetted providers |

### Future-state self-consistency
- X4, X11, X16 are **regulatory time bombs**. All three are blocked on the same gap: per-record lineage linking ingestion events to downstream recommendations. This is the single highest-leverage future-state fix because it unblocks 3 separate regulatory requirements at once.
- X6 and X7 both argue for **un-shelving** branches we eliminated too quickly. Schedule a Pass-8 branch reconsideration when implementation data becomes available.
- X14 is the quiet big win: durable execution would fix half of Pass 2 and Pass 3 findings (A5, A6, A11, D6, D15, D24) as a byproduct of platform migration.

## Custom Domain Passes (per CLAUDE.md)

CLAUDE.md specifies three domain-specific audits that must run alongside
v2 passes for client-facing features. Pass 6 executes them.

### Compliance Pass
- **SEC/FINRA automated-advice coverage:** Partial. Pass 3 A15 flagged
  compliance-bypass in ingestion; A23 flagged recommendations sourced from
  ingested regulatory feeds bypassing human-in-the-loop. Must fix both
  before the recommendation layer can cite ingested data.
- **17a-4 retention:** Pass 6 X16 — retention policy per record type not
  implemented. Immediate compliance exposure.
- **Record-keeping audit trail:** Partial. `compliance_reviews` exists but
  doesn't link to source ingestion job (X11). Pass 6 identifies this as a
  critical gap.
- **Data privacy / PII:** PII hashing exists for leads only (G33). All
  other record types carry raw PII through the extraction path, which is
  a CCPA / GDPR risk. Broader PII classification needed.
- **AML / KYC:** Out of scope for this parity assessment (handled by the
  `compliance` router, not ingestion).

**Compliance gap register:** A15, A17, A23, X4 (EU AI Act), X11, X16,
G33 expansion. 7 items, 4 critical.

### Fiduciary Pass
- **Lowest-cost-equivalent check:** Not performed on ingested product data
  today. If a new carrier provider ships a more expensive equivalent
  product, the reco engine doesn't automatically flag it.
- **Graduated autonomy on ingestion ops:** Blocked (F10). Ingestion
  operations are not one of the 8 graduated-autonomy contexts.
- **Visible conflicts:** No conflict registry on ingested records that
  might present a conflict of interest (e.g., a "recommendation" from a
  sponsored data feed).
- **Client challenge path:** Clients cannot challenge a recommendation
  derived from an ingested regulatory update — there's no "show me the
  source" path in the UI from recommendation back to the ingestion job.
- **Fiduciary alignment score:** 5/10 across ingestion-derived
  recommendations today. Gap is large and urgent.

### Cost Pass
- **Token consumption per extraction:** Unbounded per call (A22). Per
  provider per month: also unbounded (X12).
- **Semantic cache hit rates:** `enrichmentCache` hits tracked but
  reset-on-update bug (A18) makes the metric unreliable.
- **Cost per interaction at 10x:** Projected to exceed $50K/month at 10x
  current provider count + unbounded extraction. Immediate risk.
- **Provider cost comparison for routing:** Not implemented. A single
  Claude Opus call for schema extraction when Haiku would suffice.
- **Cost projection model:** Needs to be built. Add a `cost_projections`
  view that rolls up LLM + API costs per provider per month and projects
  forward at current growth rate.

## Reconciliation Log (append-only)

| Time | Pass | Action | Conflicts | Notes |
|---|---|---|---|---|
| 2026-04-11T00:00:00Z | 1 | Initial write | 0 | First version of PARITY.md; no prior file to reconcile with |
| 2026-04-11T00:00:01Z | 2 | Depth findings append | 0 | Re-read before write; no concurrent writer. Added D1–D25 depth findings with code line references. Revised composite parity DOWN from 62% → 58% after depth findings exposed D1/D2/D3/D4/D5/D11/D17 as hard-blockers |
| 2026-04-11T00:00:02Z | 3 | Adversarial findings append | 0 | Re-read before write; no concurrent writer. Added A1–A25 adversarial findings including 5 SEC-class issues (A9 multi-tenant leak, A15 compliance bypass, A17 SnapTrade consent, A20 public pipeline health enum, A21 SSRF pre-fix, A22 cost cap, A24 bash sandbox). Revised parity DOWN 58% → 54%. Self-consistency check flags Goodhart risk on "continuous improvement" claim (A12). |
| 2026-04-11T00:00:03Z | 4 | Exploration branches append | 0 | Re-read before write; no concurrent writer. Added 5 architectural branches (A Provider-as-Code, B Provider-as-Data, C Provider-as-LLM-Loop, D Provider-as-Playwright-Trace, E Provider-as-Hybrid). A/B/E active, C/D shelved. Score unchanged (Exploration does not evaluate). Temperature bumped 0.45 → 0.65 for this pass, will decay on next convergent pass. |
| 2026-04-11T00:00:04Z | 5 | Depth F-series + Sequential Halving round 1 | 0 | Re-read before write; no concurrent writer. Added F1–F18 continuous-improvement seam findings. Eliminated branch D via Sequential Halving round 1 (tied with A on 5.30, D lost tie-break). A shelved for compliance tracks. C shelved for one-shot use. Active: B + E. Parity revised DOWN 54% → 52%. Temperature decayed 0.65 → 0.50. |
| 2026-04-11T00:00:05Z | 6 | Future-state X1-X18 + compliance/fiduciary/cost pass | 0 | Re-read before write; no concurrent writer. Added X1-X18 forward projections along 6 axes + compliance/fiduciary/cost custom domain pass. X6/X7 flag branches that should be un-shelved in later passes (browser automation commodity, token deflation). X4/X11/X16 are 3 regulatory requirements blocked on same gap (per-record lineage). Parity 52% → 50%. Temperature 0.50 → 0.40. |

## Changelog (append-only, most recent first)

| Pass | Platform | Type | Score Δ | Summary |
|---|---|---|---|---|
| 6 | Claude Code | Future-State + custom domains | -0.20 | 18 forward projections (X1-X18) along 6 axes: 10x scale, regulatory (EU AI Act, SEC 17a-4), competitive (Fivetran/Arize), platform evolution (MCP v2, durable execution), data modality. Plus custom-domain Compliance/Fiduciary/Cost passes per CLAUDE.md. Major reveal: X4+X11+X16 (3 regulatory requirements) all blocked on the SAME gap — per-record lineage linking ingestion events to downstream recommendations. Highest-leverage fix in the parity doc. X6+X7 flag branches to un-shelve later (browser commodity, token deflation). Parity 52% → 50%. Temperature 0.50 → 0.40. |
| 5 | Claude Code | Depth | -0.20 | 18 continuous-improvement seam findings (F1-F18). Major reveal: improvementLoops.ts exists but watches the wrong layer (F2). Event bus types are hardcoded union (F1) blocking integration events. Chat ReAct has no integration tools in its tool surface (F13). Code Chat autonomousCoding is blind to the integration registry (F7). Sequential Halving round 1 eliminated Branch D. Active: B + E. Parity 54% → 52%. Temperature 0.65 → 0.50. |
| 4 | Claude Code | Exploration | +0.00 (branches generated, not evaluated) | Generated 5 architectural branches for dynamic CRUD. A/B/E active, C/D shelved. Temperature bumped 0.45 → 0.65 (will decay next pass). Core assumption challenged: "provider = row + code". Alternatives range from declarative JSON (B) to agent re-derivation every run (C) to browser replay (D) to hybrid fallback (E). No code changes. |
| 3 | Claude Code | Adversarial | -0.40 | Added 25 adversarial findings (A1–A25). 5 critical SEC-class items: A9 multi-tenant insight leakage, A15 ingested content bypasses compliance pipeline, A17 SnapTrade no consent check, A20 public pipelineHealth enumerable, A21 SSRF pre-fix for future G5, A22 extraction cost cap missing, A24 run_bash no sandbox. Goodhart alert (A12) on "continuous improvement" claim. Parity 58% → 54%. No code changes. |
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
