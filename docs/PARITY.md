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
| G1  | P0   | dynamic-crud    | Schema inference from arbitrary sample records (docless integrations)      | done        | build-loop-p1    | 5/10  | pending |
| G2  | P0   | dynamic-crud    | Adapter generator — turn inferred schema into a read/write CRUD adapter    | open        | build-loop-p1    | 0/10  | —       |
| G3  | P1   | dynamic-crud    | Field mapping overrides UI (accept or edit inferred semantic hints)        | open        | build-loop-p1    | 0/10  | —       |
| G4  | P1   | dynamic-crud    | Auth-shape probe — detect api-key/oauth/basic/bearer from a sample request | open        | build-loop-p1    | 0/10  | —       |
| G5  | P1   | pipelines       | Idempotent upsert with drift detection (schema changed since last run)     | open        | build-loop-p1    | 0/10  | —       |
| G6  | P1   | pipelines       | Rate limiting + exponential backoff honored per-source                     | open        | build-loop-p1    | 0/10  | —       |
| G7  | P2   | code-chat       | Schema inference exposed as a Code Chat tool                               | open        | build-loop-p1    | 0/10  | —       |
| G8  | P2   | learning        | Continuous training — fold sample data into learning recommendations       | open        | build-loop-p1    | 0/10  | —       |
| G9  | P2   | crm             | CRM field auto-map from inferred schema → canonical CRM shape              | open        | build-loop-p1    | 0/10  | —       |
| G10 | P1   | continuous      | Schema drift detector — re-infer, diff, flag for review                    | open        | build-loop-p1    | 0/10  | —       |
| G11 | P2   | model-training  | Cross-model distillation loop (learn from other models' outputs)           | open        | build-loop-p1    | 0/10  | —       |
| G12 | P2   | agentic-ai      | Universal adapter DSL — declarative integration spec the agent can emit    | open        | build-loop-p1    | 0/10  | —       |

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

## Known-Bad (dead ends — do NOT retry)

*(none yet)*

## Reconciliation Log

Conflicts found when merging parallel updates to PARITY.md go here with
a date stamp + evidence-recency resolution.

*(none yet)*

## Build Loop Pass Log

One line per pass. Format: `Pass N · angle · queue · commit · done · deferred`

- Pass 1 · dynamic schema inference · [A1: schemaInference.ts, A2: tests, A3: PARITY.md] · pending · A1+A2+A3 done · G2-G12 deferred
