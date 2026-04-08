# WealthBridge Engines — Migration & Dedup Path

## Context

Stewardly currently has **two parallel WealthBridge engine stacks** that
were built independently on two parallel branches and merged into the
same tree. Both work, both are tested, both have live tRPC + UI
surfaces. This doc maps them side-by-side and lays out the dedup path
for a future round.

**This round does NOT remove either stack** — the analysis is the
deliverable. Removing one would break its consumers; any refactor
should happen as a deliberate follow-up PR with a real migration
script, not a speculative rewrite.

## The two stacks at a glance

| Concern | This branch (`shared/calculators`) | Main's parallel (`server/engines`) |
|---|---|---|
| Engine files | `server/shared/calculators/{uwe,bie,he,monteCarlo,benchmarks}.ts` | `server/engines/{uwe,bie,he,scui}.ts` |
| Type file | `server/shared/calculators/types.ts` (40 interfaces) | `server/engines/types.ts` |
| Barrel | `server/shared/calculators/index.ts` | `server/engines/index.ts` |
| tRPC router | `wealthEngine` (30+ procedures) at `server/routers/wealthEngine.ts` | `calculatorEngine` (25 procedures) at `server/routers/calculatorEngine.ts` |
| React pages | `client/src/pages/wealth-engine/{StrategyComparison,Retirement,PracticeToWealth,QuickQuoteFlow}.tsx` | `client/src/pages/EngineDashboard.tsx` |
| Chart components | `client/src/components/wealth-engine/{ProjectionChart,GuardrailsGauge,StrategyCard,DownloadReportButton,ChatMessageActions}.tsx` | `client/src/components/{BackPlanFunnel,IncomeStreamBreakdown,MonteCarloFan,ProductReferencePanel,StrategyComparisonTable,StressTestPanel,WealthProjectionChart}.tsx` |
| PDF service | `server/services/wealthEngineReports/` (4 templates) | `server/services/pdfReportGenerator.ts` |
| GHL sync | `server/services/ghl/` (5 modules) | `server/services/crm/ghlCalculatorSync.ts` |
| Plaid perception | `server/services/improvement/plaidPerception.ts` | `server/services/plaidPerception.ts` |
| Improvement loops | `server/services/improvement/improvementLoops.ts` | `server/services/improvementEngine.ts` |
| Test file(s) | 10 files (583 tests) | `server/engines/engines.test.ts` (54 tests) |
| Extras exclusive to this branch | GHL field provisioning, completion webhooks, automation triggers, DLQ/monitoring, Edge TTS narration, shareable links, wealth chat tools, code chat foundation, consensus stream + weight presets | SCUI module (stress tests, historical backtesting, S&P 500 history), compliance verification, HTML maintenance |

## Why both survived

Neither stack is a strict superset of the other:

- **This branch** has a much deeper service layer (GHL CRM integration
  with 5 modules, PDF + audio narration + shareable links, wealth chat
  with safety wrappers + proactive triggers, Plaid perception + 6
  improvement loops, code chat foundation, consensus stream with
  weight presets, synthesizer pulls, chat→engine NL dispatcher).
- **Main's parallel** has a full **SCUI module** with stress scenarios,
  historical S&P 500 backtesting, and compliance-grade product
  references that this branch's `benchmarks.ts` doesn't replicate, plus
  a production-wired `EngineDashboard` page with 7 visualization
  components (BackPlanFunnel, IncomeStreamBreakdown, MonteCarloFan,
  ProductReferencePanel, StrategyComparisonTable, StressTestPanel,
  WealthProjectionChart) that complement this branch's sparser page
  set.

Both tRPC routers serve distinct consumers (wealthEngine router drives
this branch's React pages + the code chat + the consensus stream;
calculatorEngine router drives the EngineDashboard), so there's no
collision at the network boundary.

## Recommended dedup path (a future PR, not this one)

### Step 1 — Pick the canonical engine location

Ship a single `server/shared/calculators/` barrel that re-exports
from the winning implementation. Recommendation: **this branch's
`server/shared/calculators/`** is canonical because:

1. It's the namespace used by 583 tests + the code chat + the
   consensus stream + the chat dispatcher + the orchestrator. Moving
   those would require rewriting hundreds of imports.
2. Its types are already the de facto shared contract (40 interfaces
   covering every engine input/output, including the wealth-engine
   reports templates, the GHL field payloads, the chat engine
   dispatcher extractions, and the improvement loop perception
   triggers).
3. Main's `server/engines/` only exports to the calculatorEngine
   router + EngineDashboard. Swinging those two to the canonical
   namespace is a small diff.

### Step 2 — Pull the unique features from `server/engines/` into the canonical stack

1. Port `server/engines/scui.ts` (SCUI module — stress tests, S&P 500
   history, backtesting) into `server/shared/calculators/scui.ts`
   using the canonical `ClientProfile` / `SimulationSnapshot` shapes.
   Rewrite the tests in `server/engines/engines.test.ts` (54 cases)
   against the new location. Expect 0-10 cases to need assertion
   updates for type differences.
2. Port the 7 visualization components from
   `client/src/components/{BackPlanFunnel,...}.tsx` into
   `client/src/components/wealth-engine/`. Each is small (~200 LOC)
   and has no cross-dependencies except on chart tokens, which this
   branch already provides via `client/src/lib/wealth-engine/tokens.ts`.
3. Port `server/services/complianceVerification.ts` +
   `server/services/htmlMaintenance.ts` as-is — they're
   self-contained and don't overlap with any existing service.
4. Port `server/services/crm/ghlCalculatorSync.ts` into
   `server/services/ghl/calculatorCompletionWebhook.ts` as an
   alternate adapter. The existing webhook is event-driven; ghlCalculatorSync
   is pull-based. They can coexist or the pull-based one can be
   deleted after confirming the event-driven webhook catches every
   trigger.
5. Rewrite the calculatorEngine router's imports to pull from
   `server/shared/calculators/` instead of `server/engines/`. The
   function names + signatures mostly match; the few that don't can
   be adapted via a small shim module.
6. Lift the EngineDashboard page to consume the `wealthEngine`
   router (which has a richer feature set) OR keep it against
   `calculatorEngine` and rename that router to stay backwards
   compatible.

### Step 3 — Delete `server/engines/`

Only after:
- All imports updated
- All 637 tests (583 + 54) passing against the canonical location
- Convergence toolkit shows 2 consecutive delta=0 passes
- Manual spot check of `/engine-dashboard` + the 4 `/wealth-engine/*`
  pages

### Step 4 — Consolidate Plaid perception + improvement

The two branches have **different takes** on plaid perception + the
improvement loop:

- **This branch's** `server/services/improvement/plaidPerception.ts`
  is pure-function evaluators (`evaluateBalanceDivergence`,
  `evaluateCommissionPatternChange`, etc.) with no DB dependency.
- **Main's** `server/services/plaidPerception.ts` is a DB-backed
  event writer with a cron trigger.

These are complementary: the pure evaluators from this branch can be
**inputs** to main's DB-backed writer. Consolidation = refactor main's
writer to call this branch's evaluators as its decision functions,
then delete the duplicate heuristics.

Same for `improvementEngine.ts` vs `improvement/improvementLoops.ts`.
This branch's is a pure-function 6-loop analyzer; main's is more
DB-wired. Same pattern: this branch's 6 loops become the decision
layer, main's writer wires them into scheduled execution.

### Step 5 — Unify the PDF generators

Two code paths generate PDFs:
- `server/services/wealthEngineReports/` (this branch — 4 templates)
- `server/services/pdfReportGenerator.ts` (main — template-agnostic)

The main one is more generic and already wired into the
calculatorEngine router. The wealth-engine one has richer templates.
Merge path: move the 4 templates into pdfReportGenerator.ts as named
exports, delete `wealthEngineReports/generator.ts`, keep
`wealthEngineReports/templates.ts` (pure data), keep audio narration
+ shareable links as separate modules.

## What this round chose NOT to do

1. **Actually running the refactor** above. It touches 100+ files and
   would risk breaking two currently-working UIs. It needs its own PR
   with a dedicated test plan, an up-front schema agreement between
   the authors, and a rollback plan.
2. **Deleting either stack.** Until step 2 is complete, both stacks
   have unique value.
3. **Renaming the tRPC routers.** `wealthEngine` and `calculatorEngine`
   are both stable public identifiers — renaming either would break
   existing frontend callers and possibly GHL webhook payloads.

## Estimated effort for the full refactor

| Step | Files touched | Test work | Complexity |
|---|---|---|---|
| 1 — Pick canonical location | 0 | 0 | Decision only |
| 2a — Port SCUI | 4 | 54 cases adapted | Medium |
| 2b — Port 7 visualization components | 7 | Manual smoke | Small |
| 2c — Port compliance + HTML + GHL sync | 4 | Manual smoke | Small |
| 2d — Repoint calculatorEngine router | 1 | 25 procedures verified | Small |
| 2e — Repoint EngineDashboard | 1 | Manual smoke | Small |
| 3 — Delete `server/engines/` | ~10 (deletions) | Full suite | Trivial once 2 done |
| 4 — Consolidate plaid + improvement | 4 | 29 + N cases | Medium |
| 5 — Unify PDF generators | 3 | 32 cases | Medium |
| **Total** | ~30 edits + 10 deletions | ~110 test cases touched | ~1 focused round |

## Tracking

- Current state: **637 tests** (583 this branch + 54 main) across 11 files
- Target after dedup: **~620 tests** (some consolidation, no net loss)
- Risk: Medium — the refactor is well-understood but touches two live
  UI surfaces. Mitigation: feature-flag the new canonical path behind
  an env var until manual QA passes on both `/engine-dashboard` and
  `/wealth-engine/*`.
