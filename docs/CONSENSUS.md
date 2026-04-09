# Multi-Model Consensus — Architecture & Usage Guide

The Consensus stack lets users (and the agent) ask multiple AI models the
same question in parallel, then receive a synthesized unified answer with
explicit "Key Agreements" + "Notable Differences" sections, per-model
timing, cost-aware model selection, and named weight presets.

It is the Round C deliverable — additive to the existing
`advancedIntelligence.consensusQuery` mutation, not a replacement.

---

## 1. Layered architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React UI (client/src/pages/Consensus.tsx + components)      │
│  - StreamingResults (per-model card grid)                    │
│  - TimingBreakdown (SVG bar chart)                           │
│  - ComparisonView (split / unified / synthesis tabs)         │
│  - Preset picker, time-budget slider, model selector         │
└─────────────────┬────────────────────────────────────────────┘
                  │ tRPC
┌─────────────────▼────────────────────────────────────────────┐
│  wealthEngine router (server/routers/wealthEngine.ts)        │
│  - consensusStream (mutation)                                │
│  - listWeightPresets / createWeightPreset / update / delete  │
└─────────────────┬────────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────┐
│  Services layer                                              │
│  ├─ consensusStream.ts (Round C2)                            │
│  │    runConsensus / streamConsensus / pure helpers          │
│  └─ weightPresets.ts (Round C4)                              │
│       listPresets / createPreset / update / delete           │
│       BUILT_IN_PRESETS + normalizeWeights + merge helpers    │
└─────────────────┬────────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────┐
│  Model registry (server/shared/config/modelRegistry.ts)      │
│  - estimatedResponseMs / speedRating / costPer1M (Round C1) │
│  - selectModelsWithinTimeBudget                              │
│  - SYNTHESIS_OVERHEAD_MS (4000ms baseline)                   │
└──────────────────────────────────────────────────────────────┘
```

## 2. Calling from server code

```typescript
import { runConsensus } from "@/server/services/consensusStream";

const result = await runConsensus({
  question: "Compare Roth conversion vs traditional contributions for a 45yo in the 24% bracket.",
  selectedModels: ["claude-sonnet-4-20250514", "gpt-4o", "gemini-2.5-pro"],
  modelWeights: {
    "claude-sonnet-4-20250514": 90,
    "gpt-4o": 60,
  },
  timeBudgetMs: 20_000,
  domain: "tax planning",
  userId: 42,
});

console.log(result.unifiedAnswer);
console.log(result.keyAgreements);
console.log(result.notableDifferences);
console.log("Confidence:", result.confidenceScore);
console.log("Agreement:", result.agreementScore);
console.log("Wall clock:", result.totalDurationMs, "ms");
```

`runConsensus` returns the full event log alongside the synthesized result so the UI can replay it identically to a live stream. A future Express SSE endpoint can drive `streamConsensus(input, emit)` directly to push events as they happen.

## 3. tRPC procedures

| Procedure | Type | Purpose |
|---|---|---|
| `wealthEngine.consensusStream` | mutation | Run the consensus stream and return the full result + event log |
| `wealthEngine.listWeightPresets` | query | List user presets + platform built-ins |
| `wealthEngine.createWeightPreset` | mutation | Create a new user-owned preset |
| `wealthEngine.updateWeightPreset` | mutation | Update an existing user preset |
| `wealthEngine.deleteWeightPreset` | mutation | Delete a user preset (built-ins protected) |

## 4. Event types

| Event | Fields | When |
|---|---|---|
| `model_start` | modelId, ts | Each model call begins |
| `model_complete` | modelId, ts, durationMs, content, tokenCount | Model returns successfully |
| `model_error` | modelId, ts, error | Model errored or timed out |
| `synthesis_start` | ts, modelsCompleted | Parallel fan-out done; merge call begins |
| `synthesis_complete` | ts, durationMs, content, agreementScore, keyAgreements, notableDifferences | Synthesis merge returned |
| `done` | ts, totalDurationMs, modelQueryTimeMs, synthesisTimeMs, modelsUsed | Whole run finished |
| `error` | ts, error | Top-level failure |

The encoder helper `encodeSseEvent(event)` produces the SSE wire format
`data: ${JSON.stringify(event)}\n\n` so a future Express handler can
write events with one call.

## 5. Synthesis prompt template

`buildSynthesisPrompt({ question, responses, domain })` produces a
deterministic markdown prompt that asks the synthesis model for exactly:

```
## Unified Answer
## Key Agreements
## Notable Differences

_summary: <0-100 confidence>
```

When per-model `weight: 1-100` values are present, the prompt instructs the
synthesis model to bias the unified answer accordingly:
> a model with weight 100 should dominate the synthesis, while a model with
> weight 10 should only contribute minor details.

`parseSynthesisOutput(text)` walks the markdown and extracts the three
sections + confidence score, degrading gracefully when the synthesis
model doesn't follow the template exactly.

## 6. Time-budget model selection

```typescript
import {
  selectModelsWithinTimeBudget,
  SYNTHESIS_OVERHEAD_MS,
} from "@/server/shared/config/modelRegistry";

const result = selectModelsWithinTimeBudget(
  ["claude-sonnet-4-20250514", "gpt-4o", "gemini-2.5-pro"],
  6000, // 6 second budget
  { maxModels: 3, minModels: 1 },
);
```

`SYNTHESIS_OVERHEAD_MS` (4000ms) is automatically reserved from the
budget so the merge call's wall-clock fits inside the user-facing SLA.
Models are selected greedily fastest-first; ties go to higher cost tier
to preserve quality diversity.

The `ModelEntry` interface adds three optional fields used by the
selector:
- `estimatedResponseMs` — explicit per-model latency estimate
- `speedRating` — `"fast" | "moderate" | "slow"` for UI color coding
- `costPer1M` — `{ input, output }` cost per 1M tokens for the cost estimator

When a model entry doesn't ship explicit telemetry, the helpers
`defaultEstimatedResponseMs(tier)` and `defaultSpeedRating(tier)` derive
sensible fallbacks from the cost tier.

## 7. Weight presets

Built-in presets ship out of the box (`server/services/weightPresets.ts:BUILT_IN_PRESETS`):

| Preset | Bias |
|---|---|
| Balanced | Equal weight across the default trio |
| Conservative Suitability | Claude 90, GPT 60 (compliance + risk wording) |
| Tax Research | GPT 80, Gemini 70, Claude 40 (IRS code citation) |
| Estate Planning | Claude 80, GPT 70, Gemini 50 |
| Speed-First | Gemini Flash 100 (sub-2s latency) |

User presets are stored in the `weight_presets` Drizzle table:

```sql
weight_presets (
  id INT PRIMARY KEY,
  user_id INT NULL,         -- NULL = built-in
  name VARCHAR(100),
  description VARCHAR(500),
  weights JSON,             -- { [modelId]: 1-100 }
  optimized_for JSON,       -- string[]
  is_built_in BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

The DB layer degrades gracefully — if `getDb()` returns null (cold start
or test environment), `listPresets` returns the built-in seed presets so
the UI never shows a blank picker.

`mergePresetWithSelection(preset, selectedModels)` resolves a preset
against the actual model selection for a run, falling back to
`DEFAULT_WEIGHT = 50` for any model the preset doesn't explicitly list.

## 8. UI components

| Component | Path | Purpose |
|---|---|---|
| `<StreamingResults />` | `client/src/components/consensus/StreamingResults.tsx` | Per-model card grid with status / timing / token count / expand-to-view / copy |
| `<TimingBreakdown />` | `client/src/components/consensus/TimingBreakdown.tsx` | SVG bar chart with fastest-green / slowest-red, average + spread stats |
| `<ComparisonView />` | `client/src/components/consensus/ComparisonView.tsx` | Side-by-side panel with Split / Unified / Synthesis tabs; unified mode uses the Round A7 word-diff helper |
| `Consensus` page | `client/src/pages/Consensus.tsx` | Standalone demo page wiring the trio together with model selector + preset picker + budget slider |

The route is registered at `/consensus`. Chat.tsx is intentionally NOT
modified in Round C — the new components live on a dedicated page first;
a future round will lift them into Chat's `chatMode === "consensus"` branch
once the streaming SSE endpoint is in place.

## 9. Tests

48 new tests in `server/services/consensusStream.test.ts`:
- 17 for `consensusStream` pure helpers (encoder, prompt builder, picker, agreement, output parser)
- 16 for `weightPresets` pure helpers (normalize, validate, merge, built-ins)
- 15 for `modelRegistry` C1 additions (defaults, getModel*, selectModelsWithinTimeBudget)

Run the suite with:
```
pnpm vitest run server/services/consensusStream.test.ts
```

Total wealth-engine + consensus + code chat test count: **656** across 12 files (583 wealth-engine + 54 parallel main-branch engines + 19 semantic agreement — unchanged since Round E). Site-wide test totals (see `CLAUDE.md`) reach **3,215 tests across 123 files** after passes 54-80 added EMBA importer + navReachability + codeChat-roadmap-persist + workflow-instances + embaImport shape-regression suites.

## 10. Round D — shipped follow-ups (passes 36-38)

The first three Round C deferred items shipped in Round D:

1. **Express SSE endpoint** ✅ — `POST /api/consensus/stream` in
   `server/_core/index.ts:248`. Same auth + rate limiter as the chat
   stream endpoint. Drives `streamConsensus(input, emit)` and writes
   each `ConsensusEvent` to the response with `encodeSseEvent`.
   Includes 15s heartbeat to keep proxies alive. The React UI can
   either consume this directly with `EventSource` or keep using the
   tRPC mutation that returns the full event log — both code paths
   share the exact same event shape.
2. **Pre-flight cost + latency badge** ✅ — New tRPC query
   `wealthEngine.estimateConsensusCost`. Combines the synthesizer's
   `costEstimator.ts` task multipliers with `getModelEstimatedResponseMs`
   from the model registry. Surfaces "~$0.0042 · ~6.4s · chat · 320→320 tok"
   on the Consensus page next to the Run button.
3. **Chat → Consensus deep link** ✅ — `chatMode === "consensus"` in
   `Chat.tsx` exposes an "Open panel →" pill that opens
   `/consensus?q=<encoded draft>` in a new tab.

## 11. Round E — final deferred items shipped (passes 39-41)

1. **Inline trio in Chat.tsx consensus mode** ✅ — `Chat.tsx` now
   calls `wealthEngine.consensusStream` in consensus mode and stores
   the full consensus result under `msg.metadata.wealthConsensus`.
   When rendering the message, the existing consensus badge is
   followed by the full Round C3 trio (`<StreamingResults />`,
   `<TimingBreakdown />`, `<ComparisonView />`) plus the key
   agreements + notable differences callout panels. The deep-link
   pill from Round D still works for users who want the dedicated
   `/consensus` page with the full preset picker and cost estimator.
   Graceful fallback: if the new procedure fails, we fall through
   to the legacy `advancedIntelligence.consensusQuery` mutation so
   the feature never breaks during partial deploys.
2. **LLM-as-judge semantic agreement** ✅ —
   `server/services/semanticAgreement.ts` with `buildAgreementJudgePrompt`,
   `parseJudgeScore`, `semanticAgreement`, and `combinedAgreement`.
   The judge prompt asks a fast model (defaults to `gemini-2.5-flash`)
   to score substantive alignment 0-100 on a `SCORE: N` line. 8-second
   timeout race; on any failure returns `null` so `runConsensus` falls
   back to the existing word-overlap Jaccard score. `RunConsensusResult`
   now carries both `agreementScore` (best-of) + `semanticAgreementScore`
   (the raw LLM score) + `agreementScorerSource` (`"jaccard"` or
   `"semantic"`). 19 new tests cover the pure helpers.
3. **`weight_presets` migration file** ✅ —
   `drizzle/0009_weight_presets.sql` is committed. Production picks it
   up on the next `pnpm db:push` run; the service layer still
   degrades to in-memory seed presets until then, so the migration
   is strictly non-blocking.
4. **Engine dedup analysis doc** ✅ — `docs/ENGINES_MIGRATION.md` maps
   the two parallel WealthBridge engine stacks side-by-side and
   lays out a 5-step dedup path. Not executed in this round — the
   refactor needs its own dedicated PR with an agreed canonical
   namespace + rollback plan.

## 12. Still deferred

The only remaining item is the **full two-stack engine dedup** from
`docs/ENGINES_MIGRATION.md`. It's a focused ~30-file refactor that
touches two live UI surfaces (`/engine-dashboard` + `/wealth-engine/*`)
and should land as a deliberate follow-up PR rather than being
squeezed into a convergence pass.
