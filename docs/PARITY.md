# PARITY.md — Build Loop Synchronization Doc

This doc is the two-way sync point between the self-directed build loop
(the agent producing shipped code pass by pass) and any parallel processes
(assessment agents, review agents, or future-you). It is intentionally
simple: a gap matrix, a protected-improvements list, a known-bad list, a
reconciliation log, and a build-loop pass log.

## Scope

**Feature area:** Dynamic CRUD for any integration, pipeline, or ingestion
process, including cases where integration docs/support are limited or
nonexistent but sample data is available from sources. Force multipliers
across code chat, AI chat financial capabilities, learning/training/
onboarding, CRM/marketing, workflow automation, agentic AI/browser/device
automation, and continuous model training.

## Gap Matrix

Columns: ID · Priority · Area · Description · Status · Source · Depth · Commit

| ID  | Prio | Area            | Description                                                                 | Status      | Source           | Depth | Commit  |
|-----|------|-----------------|-----------------------------------------------------------------------------|-------------|------------------|-------|---------|
| G1  | P0   | dynamic-crud    | Schema inference from arbitrary sample records (docless integrations)      | done        | build-loop-p1    | 5/10  | 00ab579 |
| G2  | P0   | dynamic-crud    | Adapter generator — turn inferred schema into a read/write CRUD adapter    | done        | build-loop-p1    | 4/10  | pending |
| G3  | P1   | dynamic-crud    | Field mapping overrides UI (accept or edit inferred semantic hints)        | done        | build-loop-p1    | 6/10  | pending |
| G4  | P1   | dynamic-crud    | Auth-shape probe — detect api-key/oauth/basic/bearer from a sample request | done        | build-loop-p1    | 4/10  | pending |
| G5  | P1   | pipelines       | Idempotent upsert with drift detection (schema changed since last run)     | open        | build-loop-p1    | 0/10  | —       |
| G6  | P1   | pipelines       | Rate limiting + exponential backoff honored per-source                     | done        | build-loop-p1    | 6/10  | pending |
| G7  | P2   | code-chat       | Schema inference exposed as a Code Chat tool                               | done        | build-loop-p1    | 5/10  | pending |
| G8  | P2   | learning        | Continuous training — fold sample data into learning recommendations       | open        | build-loop-p1    | 0/10  | —       |
| G9  | P2   | crm             | CRM field auto-map from inferred schema → canonical CRM shape              | done        | build-loop-p1    | 6/10  | pending |
| G10 | P1   | continuous      | Schema drift detector — re-infer, diff, flag for review                    | done        | build-loop-p1    | 6/10  | pending |
| G11 | P2   | model-training  | Cross-model distillation loop (learn from other models' outputs)           | done        | build-loop-p1    | 5/10  | pending |
| G12 | P2   | agentic-ai      | Universal adapter DSL — declarative integration spec the agent can emit    | open        | build-loop-p1    | 0/10  | —       |

| G13 | P1   | dynamic-crud    | Pagination probe — cursor/offset/page/link_header detection                | done        | build-loop-p2    | 5/10  | pending |
| G14 | P1   | dynamic-crud    | Collection-path probe — detect where records live in response body        | done        | build-loop-p2    | 5/10  | pending |
| G15 | P2   | dynamic-crud    | Curl example generator for human verification                              | done        | build-loop-p2    | 4/10  | pending |
| G16 | P2   | dynamic-crud    | Schema fingerprint-based version derivation                                | done        | build-loop-p2    | 4/10  | pending |
| G17 | P0   | dynamic-crud    | Adapter runtime — execute a spec against real HTTP (mockable)              | done        | build-loop-p3    | 6/10  | pending |
| G18 | P0   | dynamic-crud    | Idempotent upsert — GET/404→POST / GET/200→PATCH semantics                  | done        | build-loop-p3    | 5/10  | pending |
| G19 | P1   | pipelines       | 429/5xx retry with Retry-After header honoring + exponential backoff       | done        | build-loop-p3    | 5/10  | pending |
| G20 | P1   | pipelines       | Field transforms at runtime (parse_currency/parse_date/parse_percent)      | done        | build-loop-p3    | 4/10  | pending |
| G21 | P1   | continuous      | Field rename detection (heuristic: type + hint + sample-count match)       | done        | build-loop-p4    | 5/10  | pending |
| G22 | P1   | continuous      | Drift severity classification (breaking/warning/info)                      | done        | build-loop-p4    | 5/10  | pending |
| G23 | P1   | dynamic-crud    | Pinned overrides survive re-inference (rehydratePinnedOverrides)           | done        | build-loop-p5    | 5/10  | pending |
| G24 | P2   | dynamic-crud    | Override diff + audit trail (diffOverrideSets)                             | done        | build-loop-p5    | 4/10  | pending |

## Protected Improvements

These are anti-regression invariants. No pass should weaken or undo these
without explicit user instruction. Every protected improvement cites the
commit that first shipped it.

- **P1 → schema inference engine** (server/services/dynamicIntegrations/
  schemaInference.ts) — pure-function schema inference with 30 unit tests.
  Must stay pure (no I/O), must keep `inferSchema`, `suggestCrudMapping`,
  `mergeSchemas`, `summarizeSchema`, and `normalizeFieldName` as exported
  surfaces. Must keep primary-key detection only for bare `id`/`uuid`/`guid`
  (never `foo_id`). Must keep mixed-type fields classified as `mixed`.

- **P2 → adapter generator** (server/services/dynamicIntegrations/
  adapterGenerator.ts) — pure-function adapter DSL generator with 32 unit
  tests. Must stay pure (no I/O, no network). Must keep `generateAdapter`,
  `probeAuth`, `probePagination`, `detectCollectionPath`, `buildCurlExamples`,
  `summarizeAdapter` as exported surfaces. Must keep the ReadinessReport
  semantics: `baseUrl` and `auth.type` are both required for `ready=true`.
  Must keep get/update/delete endpoints conditional on primary-key presence.

- **P3 → adapter runtime** (server/services/dynamicIntegrations/
  adapterRuntime.ts) — executes an AdapterSpec against live HTTP with 37
  unit tests (mock fetchImpl injected). Must keep `listRecords`, `getRecord`,
  `createRecord`, `updateRecord`, `deleteRecord`, `upsertRecord` as exported
  surfaces. Must NOT depend on global fetch singleton — every call must
  accept a fetchImpl so tests stay offline. Must keep 429/5xx retry honoring
  Retry-After header. Must keep upsertRecord 404-fallback-to-create semantics.

## Known-Bad (dead ends — do NOT retry)

*(none yet)*

## Reconciliation Log

Conflicts found when merging parallel updates to PARITY.md go here with
a date stamp + evidence-recency resolution.

*(none yet)*

## Build Loop Pass Log

One line per pass. Format: `Pass N · angle · queue · commit · done · deferred`

- Pass 1 · dynamic schema inference · [A1: schemaInference.ts, A2: tests, A3: PARITY.md] · 00ab579 · A1+A2+A3 done · G2-G12 deferred
- Pass 2 · adapter generation · [R1: G2 adapter generator, G13 pagination probe, G14 collection path, G15 curl, G16 fingerprint] · 46c89ad · G2+G4+G13+G14+G15+G16 done · G3/G5-G12 deferred
- Pass 3 · runtime executor · [F1 Pass 2 deferred exec, A1 listRecords/CRUD, A2 upsert] · 87ad53e · G17+G18+G19+G20 done · G3/G5-G12 deferred
- Pass 4 · schema drift · [R1: G10 drift detector, R2: G5 drift-aware upsert, A1: rename heuristic] · 3dc33cc · G10+G21+G22 done · G3/G5-G12 deferred
- Pass 5 · field overrides · [R1: G3 override layer, A1: pinned rehydrate, A2: diffOverrideSets] · b8d9b04 · G3+G23+G24 done · G5-G9/G11/G12 deferred
- Pass 6 · CRM canonical map · [R1: G9 CRM auto-map, A1: synonym tables, A2: value-pattern + semantic-hint scoring] · 8a6656f · G9 done · G5-G8/G11/G12 deferred
- Pass 7 · code chat agent tools · [R1: G7 schema inference tool, A1: 4 new read-only Code Chat tools, A2: dispatcher tests] · 2e93967 · G7 done · G5/G6/G8/G11/G12 deferred
- Pass 8 · cross-model distillation · [R1: G11, A1: claim extraction + clustering + training examples] · f6677d4 · G11 done · G5/G6/G8/G12 deferred
- Pass 9 · rate limiter · [R1: G6, A1: token bucket + per-source registry, A2: virtual-clock tests] · pending · G6 done · G5/G8/G12 deferred
