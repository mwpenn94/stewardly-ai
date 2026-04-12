# Dynamic Integrations

Pure-function stack for onboarding, running, and continuously improving any
third-party integration — even ones with limited or nonexistent docs — as long
as you can get sample data out of them.

Built across build-loop passes 1–19 (see `docs/PARITY.md`).

## Why this exists

Traditional integrations each need hand-written adapter code. That's fine for
10 sources, painful at 100, and impossible at 1000. This module inverts the
problem: give it sample records and connection hints, and it produces a
complete runnable adapter with schema, auth, pagination, field mappings, CRM
canonical mapping, and personalization hints — all from pure functions, no
LLM required.

## High-level flow

```
sample records  ──┐
connection hints ─┼──► runOnboardingWizard()  ──► { schema, spec, crmMapping,
prompt (optional) ┘                                 hints, serialized, ready,
                                                    nextSteps, summary }
                                                         │
                                                         ▼
                                                    runPipeline()
                                                    ├─ fetch (adapterRuntime)
                                                    ├─ infer + drift (schemaDrift)
                                                    ├─ upsert (idempotent)
                                                    ├─ hints (personalization)
                                                    └─ telemetry (pipelineTelemetry)
```

## Modules

### Core inference + adapter generation (Passes 1–2)

| File | Exports | Purpose |
|---|---|---|
| `schemaInference.ts` | `inferSchema`, `suggestCrudMapping`, `mergeSchemas`, `summarizeSchema`, `normalizeFieldName` | Infer types, semantic hints, PK candidates, CRUD field roles from sample records. |
| `adapterGenerator.ts` | `generateAdapter`, `probeAuth`, `probePagination`, `detectCollectionPath`, `buildCurlExamples`, `summarizeAdapter`, `generateFieldMappings` | Turn an `InferredSchema` + connection hints into a full `AdapterSpec` with endpoints, auth, pagination, rate limits, readiness report. |

### Runtime execution (Pass 3)

| File | Exports | Purpose |
|---|---|---|
| `adapterRuntime.ts` | `listRecords`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`, `upsertRecord`, `buildAuthHeaders`, `applyReadTransform`, `applyWriteTransform`, `parseLinkHeader`, `AdapterError` | Execute an `AdapterSpec` against live HTTP. Cursor/offset/page/link-header pagination. 429/5xx retry with Retry-After. Idempotent upsert with 404 → POST fallback. Injectable `fetchImpl` for offline tests. |

### Drift detection + overrides (Passes 4–5)

| File | Exports | Purpose |
|---|---|---|
| `schemaDrift.ts` | `diffSchemas`, `summarizeDrift`, `filterChanges` | Compare baseline + current schema. Report breaking/warning/info changes. Rename detection heuristic. |
| `fieldOverrides.ts` | `applyOverrides`, `rehydratePinnedOverrides`, `diffOverrideSets`, `validateOverrides`, `serializeOverrideSet`, `parseOverrideSet` | Human corrections on top of inferred field mappings. Pinned overrides survive re-inference. |

### CRM canonical + personalization (Passes 6, 10)

| File | Exports | Purpose |
|---|---|---|
| `crmCanonicalMap.ts` | `mapToCanonicalContact`, `mapToCanonical`, `summarizeMapping`, `CANONICAL_CONTACT_FIELDS` | Map any source to Stewardly's canonical CRM contact shape (19 fields with synonyms, value patterns, semantic hints). |
| `personalizationHints.ts` | `extractPersonalizationHints`, `augmentWithCrmHints`, `summarizeHints` | Extract learning-track / calculator-focus / risk-indicator / retention-signal / CRM-segment hints from ingested records. |

### Security + secrets (Pass 15)

| File | Exports | Purpose |
|---|---|---|
| `sensitiveRedaction.ts` | `redactRecord`, `redactRecords`, `summarizeRedaction` | Strip SSN / CC / API key / JWT / PEM / bearer / password from sample records before they reach LLMs or logs. Three strategies: mask / tokenize / nullify. |

### Rate limiting + runtime (Pass 9)

| File | Exports | Purpose |
|---|---|---|
| `rateLimiter.ts` | `TokenBucketRateLimiter`, `RateLimiterRegistry`, `getLimiterForSpec`, `RateLimitedError`, `globalRateLimiterRegistry` | Per-source token bucket with burst budget, FIFO queue, deadline cancellation. Injectable clock for tests. |

### Auth probing (Pass 13)

| File | Exports | Purpose |
|---|---|---|
| `authProbe.ts` | `probeAuthDeep`, `summarizeAuthProbe` | Forensic auth-type detection from 401/403 error bodies + WWW-Authenticate + header conventions + OAuth discovery endpoints. |

### DSL serialization (Pass 12)

| File | Exports | Purpose |
|---|---|---|
| `adapterDSL.ts` | `canonicalJson`, `fingerprintSpec`, `shortFingerprint`, `serializeSpec`, `parseSpec`, `parseSerialized`, `bumpVersion` | Portable storage format for `AdapterSpec`. Deterministic JSON, SHA256 fingerprint, defensive parser with errors/warnings split, semver bumper. |

### Pipeline orchestration + telemetry (Passes 11, 14)

| File | Exports | Purpose |
|---|---|---|
| `pipelineOrchestrator.ts` | `runPipeline`, `summarizePipelineResult` | 6-phase runner: fetch → infer → drift → upsert → hints → complete. Abort signal, progress callback, error threshold, optional phases. |
| `pipelineTelemetry.ts` | `PipelineTelemetryStore`, `globalPipelineTelemetry` | Ring-buffer run history with per-source health summaries, global rollup, recently-flaky detection (>25% failure rate over last 10 runs). |

### Continuous training (Pass 8)

| File | Exports | Purpose |
|---|---|---|
| `crossModelDistillation.ts` | `distillConsensus`, `buildTrainingExamples`, `splitIntoSentences`, `clusterClaims`, `jaccardSimilarity`, `summarizeDistillation` | Extract high-agreement claims from multi-model outputs. Lightweight stemmer for paraphrase detection. Feeds training-example pipeline without paying for human labels. |

### Natural-language entry + one-shot onboarding (Passes 16–17)

| File | Exports | Purpose |
|---|---|---|
| `onboardingWizard.ts` | `runOnboardingWizard` | Single-call entrypoint that chains redact → infer → auth probe → adapter gen → overrides → CRM map → hints → serialize → next steps. |
| `naturalLanguageParser.ts` | `parsePrompt`, `parsedToOnboardingInput`, `summarizeParsedPrompt` | Regex-based prompt parser. Extract name / baseUrl / authHint / listEndpoint / rateLimitHint from English prose. |

## tRPC procedures

All exposed via `server/routers/integrations.ts` (Passes 1, 2, 18):

| Procedure | Purpose |
|---|---|
| `inferSchema` (mutation) | Schema inference only |
| `mergeInferredSchemas` (mutation) | Combine two already-inferred schemas |
| `generateAdapter` (mutation) | Full adapter generation with curl examples |
| `onboardSource` (mutation) | One-shot wizard (redact + infer + adapter + CRM + hints + DSL) |
| `parseOnboardPrompt` (query) | Extract hints from NL prompt |
| `detectDrift` (mutation) | Compare baseline + current sample |
| `extractHints` (mutation) | Personalization hint extraction |
| `probeAuth` (mutation) | Deep auth probe from collected error samples |

All are `protectedProcedure` (authenticated).

## Code Chat agent tools (Pass 7)

Available to the ReAct loop as read-only tools:

- `infer_schema` — typed schema from records
- `generate_adapter` — full adapter spec
- `detect_schema_drift` — diff two batches
- `map_to_crm_contact` — canonical CRM contact shape

See `server/services/codeChat/codeChatExecutor.ts` for the dispatch table.

## Test coverage

339 unit + integration tests across 17 files. All tests are offline — no
real network, no database, no LLM calls. See each module's `*.test.ts`.

Run: `pnpm exec vitest run server/services/dynamicIntegrations/`

## Design principles

1. **Pure functions by default.** Every module except `adapterRuntime` and
   `pipelineOrchestrator` is pure — no I/O, no global state, trivially testable.
2. **Dependency injection over singletons.** `adapterRuntime.listRecords`
   takes a `fetchImpl`; `TokenBucketRateLimiter` takes a `now + sleep`; tests
   never touch the real clock or network.
3. **Sample data first, docs second.** Every public surface assumes you have
   sample records and optional hints — NOT a vendor SDK.
4. **Redact before inference.** Sensitive data is stripped before the schema
   inference step so PII/secrets never reach LLMs or training examples.
5. **Confidence scores everywhere.** Every module that derives structure
   returns a 0..1 confidence score so operators can gate actions on uncertainty.
6. **Human overrides are always possible.** Every auto-derived thing has a
   human-override surface (fieldOverrides, userHint, validateOverrides).
7. **Drift-aware by default.** `runPipeline` compares fresh schema to baseline
   and aborts on breaking drift so stale adapters don't corrupt downstream
   systems.

## Related

- `server/routers/integrations.ts` — tRPC surface
- `server/services/codeChat/codeChatExecutor.ts` — agent tool dispatch
- `docs/PARITY.md` — build-loop sync doc + pass log
