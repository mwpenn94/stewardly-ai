# Wealth Engine — Architecture & Usage Guide

The Wealth Engine is the TypeScript port of the WealthBridge v7 HTML
calculator stack, plus everything Stewardly added on top to make it
agentic, observable, and shareable.

This doc covers everything you need to know to:
1. Call the engines from server code
2. Run them through the tRPC `wealthEngine` router
3. Trigger them from the AI chat with natural language
4. Export results as PDF / audio / shareable links
5. Extend the system with new strategies or product models

---

## 1. Layered architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React UI (client/src/pages/wealth-engine/)                  │
│  - StrategyComparison, Retirement, PracticeToWealth, Quote   │
│  - DownloadReportButton, ChatMessageActions                  │
└─────────────────┬────────────────────────────────────────────┘
                  │ tRPC
┌─────────────────▼────────────────────────────────────────────┐
│  wealthEngine router (server/routers/wealthEngine.ts)        │
│  - simulate, holisticSimulate, holisticCompare, ...          │
│  - generateReport, generateAudioNarration                    │
│  - chatExtractIntent, chatDispatch                           │
└─────────────────┬────────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────┐
│  Services layer (server/services/)                            │
│  ├─ agent/calculatorOrchestrator.ts                           │
│  │    Chains UWE → BIE → HE for full plans                    │
│  ├─ agent/calculatorPersistence.ts                            │
│  │    Persists every run via model_runs                       │
│  ├─ agent/calculatorScenariosMirror.ts                        │
│  │    Mirrors headline runs into calculatorScenarios          │
│  ├─ ghl/                                                       │
│  │    GoHighLevel CRM integration (5 modules)                 │
│  ├─ wealthEngineReports/                                       │
│  │    PDF templates, audio narration, shareable links         │
│  ├─ wealthChat/                                                │
│  │    Chat tools, safety wrappers, proactive triggers,        │
│  │    natural-language → engine dispatcher                    │
│  └─ improvement/                                               │
│       Plaid perception + 6 continuous improvement loops       │
└─────────────────┬────────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────────┐
│  Engines (server/shared/calculators/)                         │
│  ├─ uwe.ts            14 product models + simulate           │
│  ├─ bie.ts            Business income engine                  │
│  ├─ he.ts             Holistic engine (UWE + BIE)             │
│  ├─ monteCarlo.ts     Box-Muller + percentile bands           │
│  ├─ benchmarks.ts     Guardrails + INDUSTRY_BENCHMARKS        │
│  └─ types.ts          40+ shared interfaces                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Calling the engines from server code

```typescript
import {
  uweBuildStrategy,
  uweSimulate,
  HE_PRESETS,
  heSimulate,
  monteCarloSimulate,
  bieCreateStrategy,
  bieSimulate,
  backPlan,
} from "@/server/shared/calculators";

// UWE — single-strategy year-by-year wealth simulation
const strat = uweBuildStrategy("wealthbridge", {
  age: 40, income: 120_000, netWorth: 350_000, savings: 180_000,
  dependents: 2, mortgage: 250_000, debts: 30_000, marginalRate: 0.25,
});
const yearlyResults = uweSimulate(strat, 30);

// HE — holistic via preset
const hs = HE_PRESETS.wealthbridgeClient(profile);
const snapshots = heSimulate(hs, 30);

// Monte Carlo — 1000 trials, percentile bands by year
const bands = monteCarloSimulate({ investReturn: 0.07, volatility: 0.15 }, 30);

// BIE — business income forward + back plan
const bizStrat = bieCreateStrategy("Director plan", {
  role: "dir", streams: { personal: true, override: true },
});
const bizYears = bieSimulate(bizStrat, 10);
const plan = backPlan(250_000, bizStrat);
```

---

## 3. tRPC procedures (`wealthEngine.*`)

| Procedure | Type | Purpose |
|---|---|---|
| `simulate` | mutation | UWE single-strategy year-by-year |
| `monteCarloSim` | mutation | Monte Carlo bands |
| `buildStrategy` | mutation | UWE strategy from profile |
| `autoSelectProducts` | mutation | Auto product selection |
| `generateBestOverall` | mutation | Cherry-pick best products |
| `projectBizIncome` | mutation | BIE forward projection |
| `backPlanBizIncome` | mutation | BIE target → required GDC |
| `rollUpTeam` | mutation | BIE team aggregation |
| `rollDownOrg` | mutation | BIE cascade target |
| `calcBizEconomics` | mutation | CAC / ROI / LTV |
| `holisticSimulate` | mutation | HE single strategy |
| `holisticCompare` | mutation | HE multi-strategy registry compare |
| `findWinners` | query | Best strategy per metric |
| `backPlanHolistic` | mutation | HE binary search for required income |
| `runPreset` | mutation | Quick HE preset run |
| `getGuardrails` | query | GUARDRAILS + INDUSTRY_BENCHMARKS + METHODOLOGY |
| `checkGuardrail` | query | Single guardrail validation |
| `estimatePremium` | query | Term/IUL/WL/DI/LTC/group quote |
| `getLatestRun` | query | Latest persisted run for user+tool |
| `diffAgainstLatest` | mutation | Diff candidate vs latest baseline |
| `generateReport` | mutation | PDF report (4 templates) |
| `generateAudioNarration` | mutation | Edge TTS narrated MP3 with chapter markers |
| `createShareLink` | mutation | HMAC-signed shareable token |
| `resolveShareLink` | query | Verify + load shared plan |
| `chatExtractIntent` | query | Parse natural-language chat for engine intent |
| `chatDispatch` | mutation | Single-shot extract + run |

---

## 4. Natural-language chat dispatch

The chat dispatcher (`server/services/wealthChat/chatEngineDispatcher.ts`)
parses user messages and routes them to the right engine call. Supported
intents:

| Intent | Trigger phrase | Engine called |
|---|---|---|
| `holistic_simulate` | "run a WealthBridge simulation for a 40-year-old earning $300K" | `he.simulate` |
| `compare_strategies` | "compare WealthBridge vs Do Nothing" | `he.compareAt` |
| `biz_project` | "project a director's income for 10 years" | `bie.simulate` |
| `monte_carlo` | "show me Monte Carlo bands" | `montecarlo.simulate` |
| `back_plan` | "what do I need to do to earn $250K" | `bie.backPlan` |

Slots extracted by regex:
- **age** — `40-year-old`, `age 35`
- **income** — `earning $300K`, `income $250,000`
- **savings** — `savings of $500K`
- **netWorth** — `net worth $2M`
- **dependents** — `3 dependents`
- **horizon** — `over 25 years`
- **preset** — `WealthBridge Pro`, `Do Nothing`, `DIY`, `Wirehouse`, `RIA`, `Captive Mutual`, `Community BD`, `Premium Finance`
- **role** — `new associate`, `experienced pro`, `senior associate`, `director`, `MD`, `RVP`
- **targetIncome** — `to earn $200K`

Each response includes:
- `narrative` — safety-wrapped text
- `data` — structured engine output
- `charts[]` — `ChatChartHint` objects the React UI renders inline
- `actions` — `{copy, tts, download, share}` per-message action toggles

---

## 5. PDF reports

Four templates in `server/services/wealthEngineReports/templates.ts`:

| Template | Pages | Use case |
|---|---|---|
| `executive_summary` | 1 | Headline metrics + top 3 strategies |
| `complete_plan` | 8-12 | Full HE projection + Monte Carlo + comparison |
| `practice_growth` | 4-6 | UNIQUE: BIE income trajectory + practice→wealth bridge |
| `prospect_preview` | 2 | Anonymized benchmarks + CTA |

The React `<DownloadReportButton>` component handles base64 → Blob →
download trigger. Use it on any wealth-engine page that has data ready:

```tsx
<DownloadReportButton
  template="complete_plan"
  clientName="Jane Doe"
  payload={{
    kind: "complete_plan",
    input: { clientName: "Jane Doe", horizon: 30, projection, comparison, winners },
  }}
/>
```

Currently mounted on:

- `client/src/pages/wealth-engine/StrategyComparison.tsx` — comparison-first `complete_plan`
- `client/src/pages/wealth-engine/Retirement.tsx` — retirement lens
- `client/src/pages/EngineDashboard.tsx` (pass 49) — cross-stack wire from main's
  `calculatorEngine`-driven dashboard into this branch's 4-template PDF stack.
  The button sits next to "Run All Engines" in the header and is hidden
  until the first engine run populates `heResults`. Payload derivation
  lives in the page's `reportPayload` `useMemo` — it consumes the first
  strategy's HE snapshots as `projection`, the final-year Monte Carlo
  percentiles as `monteCarloFinal`, and the page's derived
  `comparisonData` as `comparison` + `winners`. `HolisticSnapshot` is
  field-compatible across both engine stacks, so no shim was required.

---

## 6. Audio narration

`generateAudioNarration` uses Edge TTS with 16 financial-pronunciation
rules from v7 (IUL → "I U L", AUM → "A U M", $X.XM → "$X.X million").
Returns base64-encoded MP3 + chapter markers for skip navigation.

`<ChatMessageActions>` exposes a "Play TTS" button on every chat message
that streams the audio inline.

---

## 7. Shareable links

`createShareLink` returns an HMAC-signed compact token (`payload.sig`)
with optional password + expiry. Default TTL 168h (7 days). Verify
via `resolveShareLink` which loads the snapshot from `modelOutputRecords`.

---

## 8. Chat tools (Phase 6A)

Five conversational tools registered in `aiToolCalling.ts` and wired
into the ReAct loop:

| Tool | Description |
|---|---|
| `chat_explain_number` | Trace assumption chain for a metric |
| `chat_modify_and_rerun` | Change one input, show delta |
| `chat_compare_scenarios` | Side-by-side scenario delta |
| `chat_show_visualization` | Return component descriptor for inline render |
| `chat_project_recruit_impact` | Heuristic 5%-per-recruit lift estimate |

All five are also registered in `aiToolsRegistry` (Round A1) for
discovery analytics.

---

## 9. Safety / compliance

Every chat output passes through `safetyWrap()` which:
- Rewrites directive phrasing ("you should" → "the projection shows")
- Appends the standard "this is a simulation, not financial advice" disclaimer
- Logs to `model_runs` for FINRA 17a-4 record keeping
- Auto-generates Reg BI rationale via `buildRegBIRationale`

`detectBannedTopic` refuses prompts that ask for:
- Specific security recommendations
- Guaranteed return claims
- Market-timing advice

---

## 10. Continuous improvement

`server/services/improvement/improvementLoops.ts` runs 6 loops:

1. **Default calibration** (quarterly) — projected vs actual savings rate
2. **Recommendation quality** (monthly) — accept/reject ratio
3. **Sensitivity ranking** (weekly) — which inputs swing outputs most
4. **Trigger tuning** (monthly) — alert acted-upon vs dismissed rates
5. **User clustering** (quarterly) — explorer / confirmer / delegator
6. **Feature gap tracking** (manual) — competitor feature delta

`runImprovementCycle()` is the composite entry point.

---

## 11. Tests

454 wealth-engine tests across 7 files:

| File | Cases |
|---|---|
| `server/shared/calculators/__tests__/engines.test.ts` | 277 |
| `server/services/agent/calculatorOrchestrator.test.ts` | 18 |
| `server/services/ghl/ghl.test.ts` | 48 |
| `server/services/wealthEngineReports/wealthReports.test.ts` | 32 |
| `server/services/wealthChat/wealthChat.test.ts` | 35 |
| `server/services/wealthChat/chatEngineDispatcher.test.ts` | 30 |
| `server/services/improvement/improvement.test.ts` | 29 |
| `client/src/lib/wealth-engine/animations.test.ts` | 15 |
| **Total** | **484** |

Run them with `pnpm vitest run server/services server/shared/calculators client/src/lib/wealth-engine`.

---

## 12. Adding a new strategy / product

1. Add a new entry to `COMPANIES` in `server/shared/calculators/uwe.ts`.
2. If you need a new product model, add it next to the existing 14 in
   `uwe.ts`, then add the dispatch entry to `PRODUCT_MODELS`.
3. If you want a new HE preset, add a function to `server/shared/calculators/he.ts`
   and export it via `HE_PRESETS`.
4. Add tests in `engines.test.ts` (Group A for product models, Group E
   for HE presets).
5. Run convergence pass: `pnpm tsc --noEmit && pnpm vitest run`.
