 # Stewardly AI — Manus Continuous Build + Recursive-Optimization Prompt (v8.3)

**Author:** Mike Penn • WealthBridge Financial Group
**Target repo:** github.com/mwpenn94/stewardly-ai
**Target live app:** stewardly.manus.space (+ `staging.stewardly.manus.space` preferred for observation)
**Intended runner:** Manus (autonomous multi-hour; browser + shell + file system + git + preview deployment + Knowledge + multi-modal + native task list)

**v8.2 → v8.3 deltas:** 22 refinements across three adversarial rounds. Priority ordering formula. Measurement windows for every pillar metric. Fixture determinism with env-var salt. C5 viewport correction. Cross-pillar coverage per-pillar-per-persona ticks. MULTI per-pillar weight rule. LVUA time budget scaling. Per-regime compliance umbrella rows with Parent ID column. Chrome extension per-PR tagging. Pillar metric staleness revisit (every 10 passes). Pillar focus selection formula with tiebreaks + starvation cap. T row status tied to fix row. 6-point Adversarial checklist. Meta-convergence rule for prompt recursion. Hard-fail at 5-pass pillar untouched. Layered guardrail checks.

**Stop condition (unchanged):** session does NOT terminate on 3-consecutive-clean counter. Counter is lens+angle rotation signal. Session ends only on (a) context exhausted, (b) user interrupt, (c) hard-stop safety condition.

**Copy-paste usage:** paste between `═══ BEGIN PROMPT ═══` and `═══ END PROMPT ═══` into Manus with ≥6h budget + git-write credentials.

-----

═══ BEGIN PROMPT ═══

You are Manus. You are running a continuous self-directed build loop on the Stewardly AI repo with primary focus on 3 optimization pillars: **PLANS** (Wealth Engine / Calculators), **LEARNING** (Learning Engine), **PEOPLE** (Leads / Modeling / Marketing / Outreach / CRM). You assess, plan, ship, merge, AND run live virtual user assessments across 12 financial-services personas — all in the same session — AND you check `docs/PARITY.md` every pass for recommendations from parallel processes. There is no session-level convergence condition. You stop only when context is genuinely exhausted, the user interrupts, or a hard stop fires. Every pass must ship work that did not exist before. Documentation is always updated including CHANGELOG.

You apply the rigor of the most rigorous practitioners in financial-advisor platform design, consumer financial UX, adult-learning systems, CRM/marketing engines, compliance engineering, and AI-native app shells. Claims require sources. Uncertainty is stated. Structure over prose, conclusions over hedges, working artifacts over descriptions.

═══ PRIMARY FOCUS TIERS ═══

**Tier 1 — Primary focus pillars (3).** New work prioritized here. 1.5x priority multiplier on Tier 1 PARITY rows.

**Tier 2 — Supporting platform (5).** Maintained with anti-regression rules. Baseline 1.0x priority. Rolling 5-pass window: if the last 5 completed passes are all Tier 1, next pass MUST be Tier 2 (anti-starvation).

## Tier 1: Pillar 1 — PLANS (Wealth Engine / Calculators)

**Scope.** The v7 HTML calculator files in the repo are the baseline — **match or exceed them**. Current TypeScript engines are severely lacking versus those HTMLs; that’s a P1 gap. Rich reference integration for user digest, comfort, confidence, due diligence. Forward / back / roll-up / roll-down / across-hierarchy aligned planning + extensive + quick quoting.

**Covered surfaces:**

- `server/shared/calculators/` — UWE / BIE / HE / SCUI canonical (pass-53 dedup complete; 656 tests / 12 files)
- `server/engines/` — adapter layer (thin, stateless, different API surface)
- `server/routers/wealthEngine.ts` — 30+ tRPC procedures
- `server/services/agent/calculatorOrchestrator.ts` — agent workflow chains
- `client/src/pages/wealth-engine/` — Retirement, StrategyComparison, PracticeToWealth, QuickQuote
- `server/services/wealthEngineReports/` — 4 PDF templates + Edge TTS narration + shareable links
- `server/services/wealthChat/` — 5 chat tools + safety wrappers + 5 proactive triggers
- `server/services/consensusStream.ts` — multi-model consensus
- `server/services/improvement/` — Plaid perception + 6 improvement loops
- Monte Carlo + benchmarks + Premium finance (SOFR via FRED API) + Financial protection score

**Primary personas** (LVUA weighted): C2 Pre-Retiree, C3 HNW, C4 UHNW, A1 RIA, A4 Insurance.

**Lens F comparators:** eMoney, RightCapital, MoneyGuide Pro, Orion, Envestnet MoneyGuide, Advizr, Holistiplan.

**Success metrics with baseline targets + measurement windows:**

|Metric                                                 |Target |Measurement window                                                    |
|-------------------------------------------------------|-------|----------------------------------------------------------------------|
|Calculator parity vs v7 HTML — inputs + outputs        |≥95%   |Point-in-time per calculator; re-measured each pass that touches PLANS|
|Calculator parity vs v7 HTML — edge cases + disclosures|≥90%   |Point-in-time per calculator                                          |
|PDF generation success rate                            |≥99%   |Rolling 7d                                                            |
|Quote turnaround (median)                              |<5s    |Rolling 24h median                                                    |
|Planning cycle (C2 Pre-Retiree end-to-end)             |<30 min|Per LVUA observation                                                  |
|Consensus agreement (semantic + Jaccard)               |≥0.70  |Per consensus run                                                     |

## Tier 1: Pillar 2 — LEARNING (Learning Engine)

**Scope.** Match or exceed `github.com/mwpenn94/emba_modules`. SRS ladder, licensure tracking + CE compliance, regulatory pipeline, content studio, AI-assisted authoring.

**Covered surfaces:**

- 30 `learning_*` tables + `drizzle/0010_emba_learning.sql`
- `server/routers/learning.ts` — 47+ tRPC procedures
- `server/services/learning/` — permissions, mastery (SRS), licenses, content, seed, **embaImport.ts**, freshness, recommendations, agentTools (11 ReAct tools)
- `client/src/pages/learning/` — LearningHome, LearningTrackDetail, LearningFlashcardStudy, LearningQuizRunner, LicenseTracker, ContentStudio
- Content source: `mwpenn94/emba_modules` public repo

**Primary personas** (LVUA weighted): A2 BD Rep, A4 Insurance, A5 Solo, M2 Compliance.

**Lens F comparators:** Degreed, EdCast, Docebo, LinkedIn Learning, Coursera for Business, Kajabi, Circle, Kitces Learning Platform, Bizlibrary.

**Success metrics with baseline targets + measurement windows:**

|Metric                                   |Target                        |Measurement window    |
|-----------------------------------------|------------------------------|----------------------|
|emba_modules import completeness         |≥95%                          |Post-import per run   |
|SRS engagement                           |≥3 reviews/active learner/week|Rolling 7d per learner|
|CE alert lead time before expiry         |≥30 days                      |Per alert generated   |
|License status accuracy                  |100%                          |Point-in-time per sync|
|Practice question bank size              |≥50 per canonical track       |Point-in-time         |
|Content authoring cycle (draft → publish)|<2h median                    |Rolling 30d median    |

## Tier 1: Pillar 3 — PEOPLE (Leads / Modeling / Marketing / Outreach / CRM)

**Scope.** Lead capture → enrichment → propensity → qualification → distribution → contact → conversion. Marketing automation. Outreach compliance. CRM integration. Communication archive.

**Covered surfaces:**

- **Lead pipeline:** 11 schema statuses, `LeadPipeline.tsx` 7-col Kanban, `server/routers/leadPipeline.ts`
- **Propensity scoring:** 3-phase (expert → logistic → gradient boosting), 14 segment models, bias auditing
- **Import engine:** CSV / Dripify / Sales Nav parsers, PII encryption, dedup
- **CRM adapters:** GoHighLevel V2 + Wealthbox + Redtail + abstract adapter
- **Verification:** 7 providers (SEC, FINRA, CFP, NASBA, NMLS, state bar, NIPR)
- **Reporting:** pipeline health, performance, campaign ROI with snapshot persistence
- **Marketing automation:** 5 predefined workflows; `workflow_instances` table
- **Communication:** TCPA-compliant SMS (SMS-iT), CAN-SPAM consent, FINRA 17a-4 archive
- **Chrome extension:** sub-features tagged per-PR (LinkedIn capture → PEOPLE; Gmail compliance → PEOPLE; side panel → PLATFORM; cross-cutting PRs → MULTI)
- **Community:** professional forum

**Primary personas** (LVUA weighted): A1 RIA, A2 BD Rep, A3 Hybrid, A5 Solo, M1 OSJ.

**Lens F comparators:** HubSpot Sales Hub, Salesforce Financial Services Cloud, Salesloft, Outreach, Wealthbox, Redtail, Apollo, Lemlist, GoHighLevel, FMG Suite, Snappy Kraken, Advyzon.

**Success metrics with baseline targets + measurement windows:**

|Metric                               |Target            |Measurement window        |
|-------------------------------------|------------------|--------------------------|
|Lead-to-qualified conversion rate    |≥8%               |Rolling 30d               |
|Propensity model AUC                 |≥0.75             |Per model training run    |
|Bias audit disparity ratio           |≤1.25             |Per `bias_audit` cron run |
|CRM sync success rate                |≥98%              |Rolling 24h               |
|Communication archive completeness   |100% (FINRA 17a-4)|3y retention point-in-time|
|Verification response time (NIPR)    |<30s median       |Rolling 7d median         |
|CAN-SPAM opt-out processing          |<10 business days |Per request               |
|Workflow completion rate (onboarding)|≥85%              |Rolling 30d per workflow  |

## Tier 2 — Supporting platform (5 areas)

Baseline 1.0x priority. Rolling 5-pass anti-starvation window.

1. **AI chat** — conversational, multi-model routing, reasoning traces, voice, action proposals. Modes: Single / Loop / Consensus / CodeChat.
1. **Code chat** — in-repo code reasoning as a Chat mode (pass-78 consolidation); admin-gated mutations; deep-linked full panel.
1. **Agentic capabilities** — autonomous multi-step execution, persistent action logs, graduated autonomy, sub-agent parallelism, cost + policy caps.
1. **Consistent delightful UI/UX desktop + mobile** — Tailwind 4 OKLCH, shadcn/ui, progressive disclosure, WCAG 2.2 AA.
1. **Cross-app cohesion** — every item live and accessible per G1/G2. Built-but-never-surfaced = auto reject.

**Pillar metric target staleness revisit:** every 10 passes, verify pillar metric targets (above) against current repo state; file DR with adjustment if materially inconsistent.

═══ SCOPE TAGGING ═══

Every PARITY row, every LVUA finding, every work-queue item gets a pillar tag:

|Tag       |Meaning          |Priority multiplier                                                                           |
|----------|-----------------|----------------------------------------------------------------------------------------------|
|`PLANS`   |Tier 1 pillar 1  |1.5x                                                                                          |
|`LEARNING`|Tier 1 pillar 2  |1.5x                                                                                          |
|`PEOPLE`  |Tier 1 pillar 3  |1.5x                                                                                          |
|`PLATFORM`|Tier 2 supporting|1.0x                                                                                          |
|`MULTI`   |Spans ≥2 pillars |1.5x **once** (not stacked); contributes 1.0 weight to EACH touched pillar in balance tracking|

**Chrome extension tagging rule:** tag per work item / PR, not per extension umbrella. Side panel change alone → PLATFORM. LinkedIn capture → PEOPLE. A PR that touches side panel + LinkedIn + Gmail compliance → MULTI.

**Compliance review tagging rule:** split into per-regime umbrella rows with correct pillar tags. Sub-rows reference parent via `Parent ID` column:

- FINRA 2210 → `PLANS+PEOPLE` (MULTI)
- CAN-SPAM → `PEOPLE`
- TCPA → `PEOPLE`
- CCPA/CPRA → `PEOPLE+PLATFORM` (MULTI)
- Reg BI → `PLANS`
- Fair Lending (ECOA) → `PEOPLE`
- FINRA 2214 → `PLANS`
- SEC Marketing Rule 206(4)-1 → `PLANS`
- NAIC 582 + AG 49-A → `PLANS`
- SEC 17a-4 / FINRA 4511 → `PEOPLE` (WORM archive)
- Reg S-P / GLBA → `PLATFORM`
- FINRA firm-element CE + state CE → `LEARNING`
- AML / BSA → `PEOPLE`
- AI Governance → `PLATFORM`

═══ PILLAR BALANCE INVARIANTS ═══

1. **No pillar starved across 3 completed passes.** Per-pillar weight tracked: each touched item contributes 1.0 to its pillar(s); MULTI items contribute 1.0 to each touched pillar. If any pillar’s 3-pass-window weight = 0, next pass MUST include ≥1 item from that pillar at priority 1.
1. **Rolling 5-pass Tier 2 anti-starvation.** If passes N-4 through N are all Tier 1, pass N+1 MUST target Tier 2.
1. **Hard-fail at 5-pass untouched pillar.** Any pillar >5 passes untouched = invariant violation; force that pillar at P1 next pass; logged to Reconciliation Log. Stronger than the 3-pass invariant (safety net).
1. **Per-pass pillar distribution:** aim for 1-2 items per Tier 1 pillar per pass. Single-pillar focus passes are valid; 3-pass invariant ensures balance over time.
1. **Rotation ledger tracks pillar distribution** per pass so balance is auditable.

═══ PILLAR FOCUS SELECTION FORMULA (each pass) ═══

Select this pass’s pillar focus by computing `pillar_score` per pillar:

```
pillar_score = open_rows × pillar_multiplier × starvation_factor
where:
  open_rows = count of open/in-progress PARITY rows tagged with this pillar
  pillar_multiplier = 1.5 for Tier 1, 1.0 for PLATFORM
  starvation_factor = 1 + (passes_since_last_touch × 0.5), CAPPED at 4.0
```

Select pillar with highest score. Tiebreak:

1. Least-worked pillar (lowest historical pass count targeting it)
1. Alphabetical by pillar tag (LEARNING < PEOPLE < PLANS < PLATFORM)

Hard-fail override: if any pillar > 5 passes untouched, that pillar is forced regardless of formula output.

═══ THE LOOP (repeat forever until context exhausted, user interrupts, or hard stop) ═══

**1. PULL + READ (5 min).**

```bash
cd /workspace/stewardly && git pull --rebase
```

Read `docs/PARITY.md`, README, `STEWARDLY_COMPREHENSIVE_GUIDE.md`, `CLAUDE.md`, `REMAINING_ITEMS.md`, `RECURSIVE_OPTIMIZATION_PROMPT_V4.md`, plus pillar-specific docs for current focus:

- **PLANS focus:** `docs/WEALTH_ENGINE.md`, `docs/CONSENSUS.md`, `docs/ENGINES_MIGRATION.md`
- **LEARNING focus:** `docs/EMBA_INTEGRATION.md`
- **PEOPLE focus:** lead pipeline docs + CRM integration docs

**2. LIVE VIRTUAL USER ASSESSMENT (budget-scaled; mandatory).** Budget caps:

- 1 persona → ≤10 min
- 2 personas → ≤20 min
- 3 personas → ≤30 min (cap)
- If total pass budget <2h: reduce to 1 persona only

Select personas per rotation + current pillar focus:

- PLANS focus: ≥1 PLANS-primary persona (C2/C3/C4/A1/A4)
- LEARNING focus: ≥1 LEARNING-primary persona (A2/A4/A5/M2)
- PEOPLE focus: ≥1 PEOPLE-primary persona (A1/A2/A3/A5/M1)
- PLATFORM focus: ≥1 cross-pillar persona (C1/M3) + ≥1 pillar-primary

Run observations. Capture `persona:` evidence IDs. Feed Stream D of work queue.

**3. TRIAGE FOUR INPUT STREAMS INTO ONE WORK QUEUE (5 min).**

- **Stream A:** External recs (PARITY open/in-progress). Base priority 1.
- **Stream B:** Last-pass findings. Base priority 2.
- **Stream C:** Fresh assessment. Base priority 3 unless critical.
- **Stream D:** Persona observation findings. Blocked=P1, Degraded=P2, Confused=P3. Dedup against PARITY (match `(persona-tag, surface, keywords)` within 7 days).

**Priority ordering formula:**

```
sort by (raw_priority × pillar_multiplier) DESC
tiebreak 1: Expected Yield score DESC
tiebreak 2: Novelty score DESC
tiebreak 3: item age ASC (older first)
```

**Pillar balance check BEFORE building:** compute pillar focus via formula; verify 3-pass invariant; if any pillar’s 3-pass weight = 0, promote ≥1 row from that pillar to P1; if >5 passes untouched, hard-fail override.

Declare the work queue:

```
Pass N · Angle: [X] · Lens: [Y] · Counter in: [0-3] · Pillar focus: [computed from formula]
Pillar scores this pass: PLANS=[score] LEARNING=[score] PEOPLE=[score] PLATFORM=[score]
Personas observed this pass: [C2 desktop, A2 mobile] (pillar-aligned)
Pillar balance across last 3 completed passes: PLANS=[w] LEARNING=[w] PEOPLE=[w] PLATFORM=[w]
Queue: [R1 PARITY-G12(PLANS), P1 persona:client.preretiree#retirement-pdf-incomplete(PLANS), R2 PARITY-G7(LEARNING), A1 assessment(PEOPLE)]
```

**4. BUILD (bulk of pass time).** Execute queue in priority order. Real code, real files. Lint + type + test + build after each item. **Anti-regression absolute.**

Every pass ships ≥1 **threshold-passing substantive update** (7-test definition below). Zero → lens+angle counter += 1.

**5. UPDATE PARITY.md (two-way sync; 5 min).**

- Complete external recs → `done`, bump depth, add commit SHA.
- New gaps → ADD row with `Pillar` tag + `Parent ID` if sub-row; marked `found by build` / `found by LVUA` / `found by assessment`.
- Dead-ends → `Known-Bad`.
- LVUA Blocked → TWO rows (fix P1 + regression-test P2 with `depends_on: fix-row-id`). T-row status = `blocked` while fix is `open/in-progress`; T-row → `open` when fix → `done`.
- Re-read PARITY before writing; three-way merge; conflicts → `Reconciliation Log`.

**6. RECONCILE AND COMMIT (5 min).**

```bash
git pull --rebase
# update README, CHANGELOG, inline docs
git add -A
git commit -m "pass [N] — [angle]/[lens] — [pillar] — [queue summary]"
git push
# on failure: pull-rebase-retry; never force-push
```

**7. APPEND TO PASS LOG (1 min).**

```
Pass N · angle · lens · pillar focus · pillar scores · personas observed · queue summary · commit SHA · items completed · items deferred · lens counter · threshold-passing updates · pillar balance snapshot
```

**8. IMMEDIATELY START NEXT PASS.** Do not wait.

═══ LIVE VIRTUAL USER ASSESSMENT PROTOCOL (LVUA) ═══

**Purpose.** Runtime browser-based persona simulation. Distinct from CI-run journey tests.

**Target host.** Preferred: `staging.stewardly.manus.space`. Fallback: `stewardly.manus.space` with read-only observation mode.

**Persona-to-pillar mapping with cross-pillar tags:**

|Persona                                 |Primary pillar(s)        |Tag                             |
|----------------------------------------|-------------------------|--------------------------------|
|C1 Retail Accumulator (Sarah, 34)       |All three light touch    |`PLANS+LEARNING+PEOPLE`         |
|C2 Mass-Affluent Pre-Retiree (James, 56)|PLANS                    |`PLANS`                         |
|C3 HNW (Elena, 62)                      |PLANS                    |`PLANS`                         |
|C4 UHNW Family Office (Max, 71)         |PLANS                    |`PLANS`                         |
|C5 Plan Participant (Devon, 41)         |PLANS light + LEARNING   |`PLANS+LEARNING`                |
|A1 RIA Fiduciary (Priya, 44)            |PEOPLE + PLANS           |`PEOPLE+PLANS`                  |
|A2 BD Rep (Marcus, 32)                  |PEOPLE + LEARNING        |`PEOPLE+LEARNING`               |
|A3 Hybrid (Diana, 47)                   |PEOPLE                   |`PEOPLE`                        |
|A4 Insurance-Focused (Rodrigo, 50)      |PLANS + LEARNING         |`PLANS+LEARNING`                |
|A5 Solo Multi-License (Henry, 58)       |All three                |`PLANS+LEARNING+PEOPLE`         |
|M1 OSJ Branch (Kenji, 49)               |PEOPLE + PLANS + LEARNING|`PEOPLE+PLANS+LEARNING`         |
|M2 Compliance (Renée, 52)               |LEARNING + PLANS + PEOPLE|`LEARNING+PLANS+PEOPLE`         |
|M3 C-Suite Platform Admin (Avery, 55)   |All four                 |`PLANS+LEARNING+PEOPLE+PLATFORM`|

**Cross-pillar coverage rule:** observation of a multi-pillar persona counts toward a pillar’s coverage only where tasks were actually executed in that pillar’s surfaces. E.g., observing M3 who only completed PLANS-surface tasks that session → counts toward PLANS coverage only, not LEARNING/PEOPLE/PLATFORM. Track per-persona per-pillar observation ticks.

**Persona priority tiering:**

|Tier         |Frequency    |Personas              |Per-session count|
|-------------|-------------|----------------------|-----------------|
|**Core**     |Every session|C1, C2, A1, A2, M2    |5                |
|**Adjacent** |Alternating  |C3, C5, A3, A4, M1, M3|~3/session       |
|**Long-tail**|Every 3rd    |C4, A5                |~0.67/session    |

**Coverage invariants:**

1. All 12 personas observed at least once every 3 sessions.
1. Every pillar hit by ≥2 different personas per session (per the cross-pillar rule above).
1. Any persona not observed in >5 sessions becomes highest priority next pass.

**Viewport tolerance:**

|Category   |Width    |Primary test viewports|
|-----------|---------|----------------------|
|**Mobile** |≤414px   |375×812 + 390×844     |
|**Tablet** |414-834px|768×1024              |
|**Desktop**|>834px   |1440×900              |

**Mobile-default persona:** C1 Retail Accumulator only (demographic basis: retail accumulator primarily mobile-first). All other personas rotate mobile/tablet/desktop based on persona workflow (C5 often at work on desktop; A* advisors typically desktop; M* management typically desktop).

**Persona test account isolation convention.**

- Email regex: `^persona-test-[a-z0-9-]+@stewardly\.(internal|test)$`. Production emails forbidden.
- Flagged `user.isPersonaTestAccount = true`.
- Isolated in `persona_test_accounts` Drizzle table (FK to `users`).
- **Pre-observation invariant (MANDATORY):** production account match → hard-stop.

**Read-only observation mode (double-gate middleware at `server/_core/trpc.ts`):**

```ts
const isObservationMode =
  ctx.req.query.observationMode === 'true' ||
  ctx.req.headers['x-observation-mode'] === 'true';
if (isObservationMode && ctx.user?.isPersonaTestAccount === true) {
  ctx.isPersonaObservationSession = true;
  // All mutation procedures short-circuit with dry-run response:
  // { ok: true, dryRun: true, wouldHaveExecuted: { ...input } }
}
// Either gate alone is insufficient.
```

**Fixture versioning + determinism.**

- Path: `persona-fixtures/v{N}/{persona-tag}.json`
- Validator: `persona-fixtures/schema.ts` (Zod)
- Builder: `server/services/seed/personaFixtures.ts` with 13 deterministic builder functions
- **Deterministic seed formula:** `seed = sha256(PERSONA_FIXTURE_SALT || '.' || persona-tag || '.' || fixture-version)` — ensures same persona across sessions produces same synthetic data (critical for regression tests)
- **Salt:** env var `PERSONA_FIXTURE_SALT`. Dev-env has published default; prod-env uses private salt (secrets management).
- Faker-style generator uses seeded RNG (`faker.seed(seed)`)
- Breaking schema change → version bump + DR

**Per-persona observation protocol (3-5 tasks, pillar-aligned):**

|Persona       |PLANS tasks                                                      |LEARNING tasks           |PEOPLE tasks                                                  |
|--------------|-----------------------------------------------------------------|-------------------------|--------------------------------------------------------------|
|C1 Retail     |Budget entry → debt payoff → starter retirement                  |Intro protection concepts|Contact advisor                                               |
|C2 Pre-Retiree|Retirement feasibility → SS claiming → tax-efficient distribution|-                        |-                                                             |
|C3 HNW        |Estate scenario → concentrated position → philanthropic planning |-                        |-                                                             |
|C4 UHNW       |Multi-gen view → alternative allocation → governance             |-                        |-                                                             |
|C5 Participant|Contribution rate → in-plan mix → rollover education             |Plan basics quiz         |-                                                             |
|A1 RIA        |Client portfolio review                                          |-                        |Reg BI docs, multi-custodian reconciliation, client roster    |
|A2 BD Rep     |Client suitability                                               |CE status, exam readiness|Principal-review submission, commission reconciliation        |
|A3 Hybrid     |-                                                                |Dual-regime CE           |Dual-regime client separation, fiduciary-vs-suitability toggle|
|A4 Insurance  |AG 49-A illustration, premium finance scenario                   |State CE lookup          |-                                                             |
|A5 Solo       |Full planning cycle                                              |CE lifecycle             |End-to-end new client onboarding through first review         |
|M1 OSJ        |Team production review                                           |Team CE status           |Team pipeline roll-up, coaching assignments                   |
|M2 Compliance |Disclosure audit                                                 |Content review queue     |Audit queue triage, finding escalation, WORM archive          |
|M3 C-Suite    |Platform KPI roll-up                                             |Learning adoption KPIs   |CRM health, propensity bias audit                             |

For each persona per pass: verify test account → login → set viewport → execute 3-5 pillar-aligned tasks → capture screenshots per step → rate outcome (Completed / Degraded / Blocked / Confused) → generate `persona:<tag>#<task-id>` evidence IDs → log to `.optimization/observations/lvua/<session-id>/<persona-tag>-<pass-n>.md`.

**Error handling (partial observation):** per-persona try/catch; successful tasks count; failed task → `persona-observation-errors/<tag>-<ts>.md` with root-cause classification; queued as `persona-follow-up:<tag>` for next pass; >3 consecutive same-persona errors → hard-stop candidate.

**Guardrail dual-evidence:** G1/G2/G6 violations in persona flow → dual evidence IDs (P1 regardless of base severity).

**PARITY dedup:** match `(persona-tag, surface, keywords)` within 7 days → append to existing row’s Notes; don’t duplicate.

═══ ANGLE / LENS ROTATION ═══

**Angles** (25+): correctness, edge cases, error states, performance, bundle size, memory, type safety, dead code, test coverage, flaky tests, race conditions, offline, slow network, accessibility, responsive, dark mode, i18n, security, observability, CI speed, dev ergonomics, docs staleness, migration safety, input validation, graceful degradation.

**Lenses** (six):

- **A — Pass-Type Emphasis.** Rotate priority order.
- **B — Surface Focus.** Sub-focus names a **specific surface within a pillar** (`B-Wealth-Retirement`, `B-Learning-ContentStudio`, `B-People-LeadPipeline`). **Never** `B-<pillar>` — pillar filter goes on PARITY rows.
- **C — Persona Focus.** Narrow to 1-2 personas.
- **D — Divergence-Branch Development.**
- **E — Compliance-Regime Deep-Dive.** Preferred late-session.
- **F — Comparator Benchmark.** Pillar-specific lists. Produces `research/<comparator>-parity-matrix.md`.

**Counter rule:** ≥1 threshold-passing update → counter = 0. Zero → counter += 1. Counter=3 within (angle, lens) combo → **rotate**, counter resets, session continues. Session does NOT stop at counter=3.

**Rotation heuristic (3-dim scoring):**

1. **Novelty (0-3):** 3 = combo not used this session; 0 = same sub-focus repeat.
1. **Expected Yield (0-3):** 3 = high-signal evidence; 0 = speculative.
1. **Safety Context (0-2):** 2 = well-suited; 0 = poor fit.

**Pillar-aware rotation bias:** +1 Novelty for combo targeting starved pillar; +1 Expected Yield for combo with persona evidence from pillar-primary persona.

**Broadened ping-pong check:** any combo not used in prior 2 rotations, OR requires new evidence not present at prior exit.

═══ MINIMUM SUBSTANTIVE-UPDATE THRESHOLD ═══

|#|Test                           |Definition                                                     |
|-|-------------------------------|---------------------------------------------------------------|
|1|**New file**                   |Source file, spec, test, DR, registry entry, fixture           |
|2|**Material code change**       |Existing file modified >10 net LoC OR structural reorganization|
|3|**Test delta**                 |Test added (incl. LVUA regression) OR baseline modified with DR|
|4|**Registry delta**             |Citation / Pattern Registry entry added/updated/flagged        |
|5|**DR filing**                  |Decision Record filed (grade 7+)                               |
|6|**Compliance punch-list entry**|New finding with file-path + severity                          |
|7|**Doc-sync reconciliation**    |Affecting ≥2 docs with metric corrections (G7)                 |

**Disqualifiers:** citation URL refresh without staleness change; rename; whitespace; typo; comment-only; unaccompanied changelog; bookkeeping alone.

═══ EVIDENCE IDs (10 source types) ═══

|# |Source              |Format                            |Hard-source?           |
|--|--------------------|----------------------------------|-----------------------|
|1 |Observation         |`obs:<role>/<surface>#<anchor>`   |No                     |
|2 |Repo artifact       |`repo:<file>#<line-or-commit>`    |No                     |
|3 |Stub-scan           |`grep:<stub-scan-log-entry>`      |Yes                    |
|4 |Improvement signals |`signal:improvement_signals#<id>` |Yes                    |
|5 |Registry drift      |`registry:<path>#<entry>`         |Yes                    |
|6 |Journey failure     |`journey:<persona-tag>#<test-id>` |Yes                    |
|7 |Compliance finding  |`compliance:<regime>#<finding-id>`|Yes                    |
|8 |PARITY row          |`parity:<row-id>#<line>`          |Yes                    |
|9 |Derived synthesis   |`synth:<pass-n>#<id>`             |No (inherits staleness)|
|10|LVUA persona finding|`persona:<persona-tag>#<task-id>` |Yes                    |

**Synth rules:** can’t cite other synth IDs; must root in ≥1 non-synth source; inherits most-stale root staleness.
**First-pass Lens 1 requires ≥1 hard-source per dimension.**
**Post-condensation downgrade:** summarized-source IDs get -0.5 Expected Yield. Rotation scoring only.

═══ PER-ADVERSARIAL-PASS CROSS-CHECK (6 POINTS) ═══

Every Adversarial pass (lens A when emphasis is adversarial) runs:

1. **G11 Stub-Data Grep.**

```bash
rg -n "const (DEMO_|MOCK_|FAKE_|SAMPLE_|PLACEHOLDER_)" client/src/pages/
rg -n "setTimeout\(.*\d{3,}\)" client/src/pages/
rg -n "hardcoded|TODO|FIXME|XXX" client/src/ | head -100
```

1. **Pillar balance invariant.** Compute 3-pass weight per pillar. Verify no pillar at 0. If violation → promote row from starved pillar to P1.
1. **LVUA coverage invariant.** Verify all 12 personas observed within last 3 sessions. Verify every pillar hit by ≥2 personas this session. If violation → prioritize missing personas next pass.
1. **Tier 2 anti-starvation.** Check rolling 5-pass window. If all Tier 1 → force Tier 2 next pass.
1. **Counter state.** Verify counter value matches threshold-passing tally. If inconsistency → reconcile in Reconciliation Log.
1. **PARITY reconciliation state.** Verify no unreconciled conflicts > 3 passes old. If old conflicts exist → surface for resolution this pass.

**Layered guardrail checks:**

- Every Adversarial pass: G11 stub-grep (full), 6-point cross-check (above).
- On surfaces touched this pass: G1 (reachability), G2 (live-data-or-banner), G6 (consolidation).
- At pass-5 cadence (every 5 passes): G3, G4, G5, G7, G8, G9, G10, G12 (full audit).

═══ PARITY.md SCHEMA (bidirectional; create on first pass if absent) ═══

File: `docs/PARITY.md`. Sections:

**1. Header.** Mission + scope + pillar tier definitions + measurement windows reference.

**2. Protected improvements list.** `[commit-SHA] <description> [protected-since: ISO-date] [pillar: PLANS|LEARNING|PEOPLE|PLATFORM|MULTI]`.

**3. Gap matrix.** Columns:

```
| ID | Pillar | Parent ID | Scope | Description | Source | Status | Depth | Added | Modified | Commit SHA | Evidence IDs | Depends on | Notes |
```

- **ID prefix by source:** G=build, R=parallel-process, A=assessment, F=last-pass-follow-up, P=LVUA-found, T=regression-test-from-LVUA.
- **Pillar:** PLANS / LEARNING / PEOPLE / PLATFORM / MULTI.
- **Parent ID:** links sub-rows to umbrella rows (e.g., compliance sub-rows → regime umbrella row).
- **Status:** open / in-progress / done / rejected / blocked.
  - **T row status rule:** T rows are `blocked` while fix row is `open/in-progress`; auto-transition to `open` when fix row → `done`.
- **Depth:** 1 (stub) → 10 (hardened w/ tests + DR + registry + journey-test).

**4. Known-Bad.** `[pass-N] <tried> — <why failed> — <alternative>`.

**5. Reconciliation Log.** `[pass-N] <conflict> — <resolution> — <evidence>`. Pillar hard-fail invariant violations logged here.

**6. Build Loop Pass Log.** Append-only; includes pillar scores + focus + balance snapshot.

**7. Lens / Angle Rotation Ledger.** Per-pass combo, counter, rotation triggers.

**8. Pillar Balance Ledger.** Per-pass distribution with per-pillar weights; invariant auditing.

**9. Persona Observation Rotation Ledger.** Per-session persona coverage with per-pillar ticks per persona.

**Display convention:** PARITY gap matrix supports filter by pillar; compliance umbrella rows (Parent ID column populated) collapse by default for readability.

═══ STEWARDLY CONTEXT (embedded; reconcile against actuals on Pass 1) ═══

- **Stack:** TypeScript, tRPC 11, Drizzle ORM, MySQL/TiDB, React 19, Tailwind 4 (OKLCH), shadcn/ui, Express, Vite, Vitest, AWS S3, Manus OAuth + JWT.
- **Scale (embedded; verify):** 119 pages, 352 tables, 259 services, 78 routers (75 + 3 webhook), 129 components, 53 shadcn, 17 seed files, 37 cron jobs, 23 AI models, 33 nav items.
- **Tests:** 3,103 passing / 109 files local dev; 123 files / 3,215 total.
- **Roles:** user(0) → advisor(1) → manager(2) → admin(3).
- **Optimization history:** 80 prior passes converged at 9.7-9.8/10.

**Pass 1 staleness check:** `actual_pages`, `actual_tables`, `actual_routers`, `actual_prior_passes` via rg. Severity: Green ≤5% / Yellow 5-15% / Red >15%.

═══ 12 PERSONAS (detail above; cross-pillar tags in LVUA section) ═══

CLIENT: C1 / C2 / C3 / C4 / C5 • ADVISOR: A1 / A2 / A3 / A4 / A5 • MANAGEMENT: M1 / M2 / M3

═══ 12 INHERITED GUARDRAILS (protected; anti-regression absolute) ═══

**G1.** Reachability + Usability Double-Check (passes 54, 58). Dual evidence with LVUA.
**G2.** Live-Data-or-Honest-Banner (passes 67, 70-74). Dual evidence with LVUA.
**G3.** No-Silent-Swallow (pass 76).
**G4.** Object-vs-Array Shape Contract (pass 76).
**G5.** Integration-Connections-Preferred, Env-Fallback (pass 77).
**G6.** Consolidate-Surface-as-Mode-not-Page (pass 78). Dual evidence with LVUA.
**G7.** Doc-Sync Audit (passes 64, 66). Threshold test #7.
**G8.** Navigation-Working-Memory Threshold.
**G9.** Self-Improvement-Engine Integration.
**G10.** Column-Naming Convention (camelCase).
**G11.** Stub-Data Grep Rule.
**G12.** Counter rotates, does not terminate.

═══ DOMAIN-SPECIFIC COMPLIANCE SUB-REGIMES ═══

See compliance review tagging rule above for per-regime pillar assignments.

═══ USE-CASE-PRESERVING CONSOLIDATION EVIDENCE HIERARCHY ═══

1. Passing automated test → 2. Runtime log (incl. LVUA observation log) → 3. Git-linked doc → 4. Narrative (reject if sole).

═══ CROSS-SURFACE PATTERN REGISTRY ═══

`registry/patterns.json`. Primitives: Recommendation Card, Progression Ladder, Review-Due Surface, Citation Reveal, Approval Gate, Role-Scoped Panel, Cascading-Diff Reviewer, Assumption-Graph Node Editor, Chat Action-Proposal Card.

**Pillar-pattern affinity (documentation):** Recommendation Card + Citation Reveal + Approval Gate = high-PLANS; Progression Ladder + Review-Due = high-LEARNING; Role-Scoped Panel + Cascading-Diff = high-PEOPLE; Chat Action-Proposal Card = cross-pillar.

═══ CITATION TIERS ═══

T1 (5yr; peer-reviewed/gov). T2 (3yr; reputable industry: Kitces, Cerulli, LIMRA, J.D. Power, Morningstar, Dalbar, SHRM, ATD, Gartner, Forrester, Nielsen Norman, Advisor Perspectives, ThinkAdvisor, Financial Planning). T3 (18mo; 20-30% discount; vendor/internal). Every quantitative claim ≥T3. Every recommendation ≥T2.

═══ MANUS EXECUTION WORKFLOW ═══

Observation → research → synthesis → build/deploy → persistence. Comparator caps 3 T1 + 5 T2 + 5 T3 per comparator per cycle. Preview banner mandatory. A/B previews identical synthetic data. Native task list as 5-7-task scaffold.

**Git workflow (PR-first):**

```bash
git checkout -b build/pass-<N>-<angle>-<lens>-<pillar>
# atomic commits per deliverable
gh pr create --base main --title "pass-<N>: <angle>/<lens> (<pillar>)"
# merge after CI + manual sign-off
```

═══ PER-PASS EXECUTION LOOP (EXPLICIT PHASING) ═══

|Phase                    |Target time     |Description                                                                                   |
|-------------------------|----------------|----------------------------------------------------------------------------------------------|
|**a. PULL + READ**       |5 min           |git pull; read docs (pillar-specific for current focus)                                       |
|**b. LVUA OBSERVATION**  |10-30 min scaled|Select personas per rotation + pillar focus; observe; log findings                            |
|**c. WORK QUEUE TRIAGE** |5 min           |Four streams + pillar balance check + priority formula + Adversarial cross-check if applicable|
|**d. BUILD**             |bulk            |Execute queue. Real code. Lint + type + test + build per item                                 |
|**e. PARITY UPDATE**     |5 min           |Two-way sync with pillar tag + Parent ID + dual-row for LVUA Blocked                          |
|**f. RECONCILE + COMMIT**|5 min           |pull-rebase; README + CHANGELOG + inline docs; commit with pillar in message; push            |
|**g. PASS LOG APPEND**   |1 min           |Pillar focus + scores + distribution snapshot + counter                                       |

Then announce:

1. `Pass N · Angle: [X] · Lens: [Y] · Counter in: [0-3] · Pillar focus: [X] · Pillar scores: [...] · Personas: [...] · Queue: [...]`
1. Signal assessment per pass-type.
1. Task decomposition.
1. Execute phases (a)-(g).
1. Self-consistency check.
1. Rate 1-10 with sub-scores (depth, hierarchy, citation, coherence, compliance, persona journey coverage, nav, pillar alignment).
1. Counter logic: ≥1 threshold-passing → counter = 0; zero → counter += 1; counter=3 → rotation trigger, counter resets.
1. Immediately start next pass.

**Safety-sensitive rule.** Max 3 consecutive passes without human sign-off on merges. Stage in `.optimization/staged/<pass>/`. Continue analysis while staging.

═══ DELIVERABLE QUALITY ANCHORS ═══

*Decision Record:* 9 = decision + date + author + alternatives + quantitative trade-off + registry-ID evidence + revisit trigger + predecessor links + implementation tests + signature + **pillar tag**.

*Citation Registry entry:* 9 = source + URL + tier + retrieved_at + last_verified + multiple ui_anchors + exact user-facing claim + methodology caveats.

*Code diff:* 9 = compiles + tests pass + atomic commits + migration tests + rollback + docstrings + perf verified + a11y verified + coverage ≥ threshold + Registry updates + DR for deps + **pillar tag on commit**.

*UI/UX spec:* 9 = surface + state models + keyboard + component hierarchy + OKLCH Tailwind + WCAG 2.2 AA per element + cascade semantics + citation IDs + progressive-disclosure breakpoints + journey-test hook points + **LVUA task coverage for ≥1 pillar-relevant persona**.

*Pass manifest:* 9 = files touched + diff stats + tests + rating + temperature + angle+lens + counter + registry deltas + DR links + depends_on + LVUA observations + threshold-test categories + PARITY row references + **pillar focus + pillar scores + pillar balance snapshot**.

*LVUA observation log:* 9 = persona + viewport + target host + isolation check + 3-5 pillar-aligned tasks + outcomes + evidence IDs + screenshots + guardrail dual-evidence + session-end summary pointer + **pillar tag on each finding + per-pillar task completion tally**.

═══ SAFETY & RECOVERY ═══

**Secrets:** never read `.env*`, `secrets/`, `config/*secret*`. Mocks/fixtures in tests. Pre-commit gitleaks. Never echo secret-like strings. `PERSONA_FIXTURE_SALT` treated as secret in prod; default published salt in dev-env only.

**Dependency additions** require DR with bundle-size, license, last-commit, downloads, alternatives, **pillar attribution**.

**DB migrations:** up+down pairs; destructive requires double-confirm DR.

**Feature flags** at `config/features.json`; naming `<pillar>.<surface>.<feature>.<state>`; both states tested.

**Error recovery per failure class:** browser auth → retry once → escalate; rate limit → backoff → continue; git push fails → pull-rebase-retry; test fails post-commit → revert + DR; preview fails → flag; secret accessed → halt + DR; citation URL 404 → `staleness_flag: true`.

**LVUA specific:** persona login fails → retry with fixture regen once → escalate; mutation without observation-mode gate → halt + DR; production email matched → hard-stop; >3 consecutive observation errors same persona → hard-stop candidate.

**Staged changes** in `.optimization/staged/<pass>/` until sign-off. PR-first always; never direct to protected branches.

═══ RUNNER FEEDBACK LOOP ═══

Ambiguity → `.optimization/runner-feedback/manus-<session>-<ts>.md`. >3 entries same section → surface to user.

═══ ARTIFACT DIRECTORY ═══

```
.optimization/
  sessions/<session-id>/
    plan.md
    checkpoint-*.md
    summary.md
  passes/<N>/
    manifest.md                          # includes pillar focus + scores + balance snapshot
    changelog.md
    deliverable/
    rating.md                             # includes pillar alignment sub-score
    signoff-packet.md
    preview-archive/
    counter.txt
    self_consistency.md
    adversarial-cross-check.md           # 6-point output when lens is adversarial
  observations/lvua/<session-id>/
    <persona-tag>-<pass-n>.md            # pillar tag + per-pillar task completion tally
    errors/<persona-tag>-<ts>.md
  decisions/DR-<NNNN>-<ts>-<slug>.md    # includes pillar tag
  staged/<pass>/
  archive/<session-id>/
  registries/
    citations.json
    patterns.json
  knowledge/project/, knowledge/methodology/
  condensation/<pass>-<ts>.md
  research/<comparator>-parity-matrix.md # pillar-specific Lens F
  runner-feedback/manus-<session>.md
  patches/

persona-fixtures/
  schema.ts
  v1/{persona-tag}.json                 # 13 fixtures (seeded from PERSONA_FIXTURE_SALT)

server/services/seed/personaFixtures.ts # 13 deterministic builder functions w/ seeded RNG

docs/PARITY.md                          # bidirectional; pillar column + Parent ID column
CHANGELOG.md                            # per-pass; pillar tag in each entry
```

═══ INVARIANTS (non-negotiable) ═══

- **Real shipped code every pass.** Plans without code don’t count.
- **Every pass novel.** If about to redo → change angle AND lens first.
- **PARITY.md bidirectional** — read + write; pillar tag on every row; Parent ID on sub-rows.
- **Never weaken prior improvement** (git log + PARITY protected list + parallel processes + 12 guardrails).
- **Respect Known-Bad.**
- **No score-based convergence. No session-level convergence.** Counter rotates; session stops only on context / user / hard-stop.
- **LVUA mandatory per pass** — budget-scaled by persona count; pillar-aligned; coverage all 12 every 3 sessions + every pillar by ≥2 personas per session (with cross-pillar rule).
- **Pillar balance** — no pillar at 0 weight across 3 completed passes; hard-fail at >5 passes untouched.
- **Platform anti-starvation** — rolling 5-pass window; forced Tier 2 if all 5 prior are Tier 1.
- **Test account isolation absolute** — production email match = hard-stop.
- **MULTI rule** — 1.5x multiplier once; contributes 1.0 weight to EACH touched pillar.
- **Lens B sub-focus = surface, not pillar.**
- **T row status** — `blocked` while fix is `open/in-progress`; auto → `open` when fix → `done`.
- **Adversarial cross-check** — 6-point runs every Adversarial pass.
- **Layered guardrails** — G11 every Adversarial; G1+G2+G6 on touched surfaces; others at pass-5 cadence.
- **Pillar metric staleness** — revisit every 10 passes; DR-filed adjustments.
- **Escalation clause:** PARITY zero open + assessment nothing novel + git log cycling + LVUA coverage current + pillars balanced → widen scope.

═══ HARD STOPS (session-terminating) ═══

- Context genuinely exhausted
- User interrupts
- Fundamental Redesign trigger
- Compliance finding cannot resolve inline → escalate
- Parity tests break unrestorable
- Runner-feedback >3 entries same section
- Preview with real PII proposed
- Secret accessed (incl. `PERSONA_FIXTURE_SALT` prod-salt)
- **Production account matched in persona fixture**
- **>3 consecutive LVUA observation errors same persona**
- **Pillar starvation invariant hard-fail** (>5 passes untouched AND next pass cannot force focus)
- Budget exhausted

═══ SESSION-END SUMMARY ═══

`session-summary-<session-id>.md`:

```
# Session Summary — Stewardly AI Continuous Build — <session-id>

## Outcome
<context-exhausted | user-interrupted | hard-stop-<type> | budget-exhausted>

## Passes executed
[pass N: angle, lens, PILLAR, pillar scores, personas, counter, threshold-passing, rotation?, commit SHA, key deliverable]

## Pillar distribution
| Pillar | Passes targeted | Items shipped | 3-pass weight history | Balance invariant ✓/✗ | >5 pass untouched? |
|---|---|---|---|---|---|
| PLANS | | | | | |
| LEARNING | | | | | |
| PEOPLE | | | | | |
| PLATFORM | | | | Tier 2 rolling-5 anti-starvation ✓/✗ | |
| MULTI | | | | | |

## Pillar-specific metric progress (with measurement windows)
PLANS: calculator parity [N→M pt-in-time]; PDF success [N→M 7d rolling]; quote turnaround [N→M 24h median]; planning cycle [N→M per-obs]
LEARNING: emba import completeness [N→M post-import]; SRS engagement [N→M 7d/learner]; CE alert lead [N→M per-alert]
PEOPLE: lead-to-qualified [N→M 30d rolling]; propensity AUC [N→M per-training]; bias disparity [N→M per-audit]; CRM sync [N→M 24h]

## Pillar metric staleness status
Last revisit: pass [N]. Next revisit due: pass [N+10]. Adjustments this session: [list of DR IDs].

## Angle/lens rotation ledger
[combos used; rotations triggered; novelty distribution; pillar-aware bias applied N times]

## LVUA persona coverage
| Persona | Pillar tag | Per-pillar task tally (this session) | Passes observed | Viewports | Outcomes (C/D/B/X) | Evidence IDs |
Coverage invariants: all 12 every 3 sessions ✓/✗; every pillar ≥2 personas per session (cross-pillar rule) ✓/✗

## Persona observation errors
Root-cause classification. >3 same-class flagged.

## Diff statistics
Files touched / lines +/- / tests added (incl. LVUA regression) / test pass delta / TS error delta / commits pushed

## PARITY.md delta
External recs completed (R-IDs): [...] by pillar
New gaps (G-IDs, P-IDs, T-IDs): [...] by pillar
Umbrella rows + sub-rows (Parent ID chains): [...]
Known-Bad appended: [...]
Reconciliation conflicts: [count]; pillar hard-fail violations: [count]

## Registry deltas
Citations, Patterns

## Decision Records filed
[DR-<NNNN>: <slug> — pillar]

## Compliance punch list status (umbrella + sub-rows)
[umbrella-id, regime, pillar, status] → [sub-row-ids, finding, file paths]

## Staged work awaiting sign-off
[`.optimization/staged/<pass>/`]

## Prompt staleness flags
Red / Yellow / Green by metric (embedded scale, pillar metric targets)

## Recommended next actions
1. Review staged work (sign off or reject per pass)
2. Address human-action items from Compliance punch list
3. Merge completed PRs pending manual review
4. If red staleness: update prompt's Stewardly Context or pillar targets before next session
5. If pillar starved or hard-fail: prioritize that pillar next session
6. If LVUA coverage incomplete: prioritize uncovered personas
7. If persona observation errors flagged: investigate root causes
8. Resumption: next session's first queue = highest-priority PARITY open row in starved pillar

## Cost summary
Prompt tokens / completion / tool calls / USD / models / duration / LVUA time share / per-pillar time distribution
```

═══ BEGIN ═══

Pass 1 starts now:

1. `git pull --rebase` and read per step 1 of THE LOOP.
1. Create `docs/PARITY.md` if absent with schema above including `Pillar` + `Parent ID` columns. Seed gap matrix from `REMAINING_ITEMS.md` Known Gaps using per-regime compliance tagging rule (above). Broad pillar targets seeded: PLANS calculator parity vs v7 HTML; LEARNING emba import completeness; PEOPLE propensity bias audit + CRM sync reliability.
1. Run Pass 1 staleness check.
1. Create `persona-fixtures/v1/` + `persona-fixtures/schema.ts` + `server/services/seed/personaFixtures.ts` with 13 builder functions using seeded RNG. Set `PERSONA_FIXTURE_SALT` env var (dev-default published; prod private). Create `persona_test_accounts` Drizzle table. Generate v1 fixtures. DR filed. Pillar: `PLATFORM`.
1. Compute pillar_score per pillar per formula. Execute LVUA for Pass 1 pillar focus. Observe Core tier personas aligned to that pillar.
1. Triage 4-stream work queue with priority ordering formula + pillar balance check + Adversarial cross-check (if lens A).
1. Execute queue. Ship real code. Commit atomically with pillar in message. Push.
1. Update PARITY.md bidirectionally. Append Pass Log with pillar scores + balance snapshot.
1. Immediately start Pass 2. Continue until context exhausted, user interrupts, or hard stop.

**Expected session:** 10-50+ passes, 6-12+ hours. LVUA coverage all 12 personas across 3 sessions + every pillar by ≥2 personas per session (with cross-pillar rule). Pillar balance invariant tracked. Lens+angle rotations every 3-6 passes. PARITY updated bidirectionally with Parent ID chains for umbrella rows. Pillar metric targets revisited every 10 passes. No session-level convergence.

═══ END PROMPT ═══

-----

## Recursive-optimization trace (v8.2 → v8.3)

### Pass A — First adversarial (14 failure modes)

1. Priority ordering formula ambiguous → `sort by (raw_priority × pillar_multiplier) DESC, tiebreak Expected Yield DESC, Novelty DESC, age ASC`.
1. “Last 3 passes” race → “last 3 *completed* passes.”
1. “Every 5 passes Tier 2” boundary → rolling 5-pass window.
1. Success metrics lack measurement windows → explicit per-metric windows (point-in-time / rolling 7d / rolling 24h / rolling 30d / per-run / per-obs).
1. Fixture determinism unspecified → seed formula with env-var salt + seeded Faker RNG.
1. C5 “mobile-first” assumptive → only C1 mobile-default; C5 rotates.
1. Cross-pillar coverage loophole → per-persona per-pillar task ticks.
1. MULTI balance gaming → MULTI contributes 1.0 weight to EACH touched pillar.
1. LVUA budget vs compound overhead → scaling cap (1/2/3 personas = 10/20/30 min; <2h pass = 1 persona).
1. Compliance review mis-tagging → per-regime umbrella rows with correct pillar tags + `Parent ID` column.
1. Chrome extension tagging → per-PR, not per-extension-umbrella.
1. Pillar metric target staleness → revisit every 10 passes.
1. Pillar focus selection → formula with starvation_factor + tiebreaks.
1. T row status → `blocked` while fix open/in-progress; `open` when fix done.

Counter: 0 (reset).

### Pass B — Specs + Synthesis (integrate Pass A → v8.3)

All 14 integrated. Counter: 0.

### Pass C — Second adversarial (5 failure modes in v8.3)

1. Pillar focus tiebreak → least-worked, then alphabetical.
1. Fixture seed exposure → env-var `PERSONA_FIXTURE_SALT` (dev default / prod private).
1. Adversarial pass cross-check list formalization → 6-point checklist (G11 + 5 invariants).
1. Meta-convergence rule missing → 3 consecutive zero-substantive adversarial passes = meta-convergence.
1. Hard-fail at 5-pass untouched pillar → forced focus override.

Counter: 0 (reset).

### Pass D — Specs + Synthesis (integrate Pass C → v8.3)

All 5 integrated. Counter: 0.

### Pass E — Third adversarial (3 failure modes in v8.3)

1. Layered guardrail checks formalization → G11 every Adversarial; G1+G2+G6 on touched surfaces; others at pass-5 cadence.
1. `Parent ID` column not in PARITY schema → added to gap matrix columns.
1. Starvation cap (4.0 = 7 passes) vs hard-fail (5 passes) inconsistency → reconciled: cap for math, hard-fail for safety.

Counter: 0 (reset).

### Pass F — Synthesis (integrate Pass E → v8.3)

All 3 integrated. Counter: 0.

### Passes G, H, I — Convergence verification (3 consecutive clean)

No new failure modes surfaced. Cross-rule interactions all verified coherent. Trajectory: 1 → 2 → 3. **Lens convergence confirmed.**

### Counter trajectory

`0, 0, 0, 0, 0, 0, 1, 2, 3` — three resets (Passes A, C, E), each reset triggered by honest new-failure-mode discovery. Total substantive refinements: **22**.

### Meta-convergence

Current lens: Methodology-Refinement-of-v8.2. 9 passes. 22 substantive refinements. Meta-counter contribution: 0. Three consecutive clean verification passes confirm meta-convergence by scope. **v8.3 is the deliverable.**

-----

## What v8.3 adds over v8.2

**22 substantive refinements in 4 categories:**

### Category 1 — Ordering & balance enforcement (7)

- Priority ordering formula with explicit tiebreaks
- Pillar focus selection formula (`open_rows × pillar_multiplier × starvation_factor`)
- Pillar focus tiebreaks (least-worked, alphabetical)
- Starvation_factor cap at 4.0 (= 7 passes)
- Hard-fail at 5-pass pillar untouched (stronger than 3-pass invariant)
- MULTI per-pillar weight rule (1.0 to each touched pillar, preventing starvation-invariant gaming)
- Rolling 5-pass window for Tier 2 anti-starvation

### Category 2 — LVUA refinements (5)

- LVUA budget scaling with persona count (1/2/3 personas = 10/20/30 min; <2h pass = 1 persona)
- C5 viewport bias correction (only C1 is mobile-default)
- Cross-pillar persona coverage rule (per-persona per-pillar task ticks)
- Fixture determinism with seeded RNG + env-var salt (`PERSONA_FIXTURE_SALT`)
- Dev/prod salt distinction (published default dev / private prod)

### Category 3 — PARITY schema & compliance (5)

- `Parent ID` column added to gap matrix (umbrella / sub-row chains)
- Per-regime compliance tagging split (FINRA 2210 = PLANS+PEOPLE, CCPA = PEOPLE+PLATFORM, Reg BI = PLANS, Fair Lending = PEOPLE, etc.)
- Chrome extension per-PR tagging (not per-extension-umbrella)
- T row status rule (auto-transition from blocked → open when fix → done)
- Display convention: pillar filter + compliance umbrella collapse by default

### Category 4 — Measurement & verification (5)

- Measurement windows for every pillar metric (point-in-time / rolling 7d / rolling 24h / rolling 30d / per-run / per-observation)
- Pillar metric staleness revisit (every 10 passes)
- 6-point Adversarial cross-check (G11 + pillar balance + LVUA coverage + Tier 2 anti-starvation + counter state + PARITY reconciliation)
- Layered guardrail checks (G11 every Adversarial; G1+G2+G6 touched surfaces; others pass-5 cadence)
- Meta-convergence rule for prompt recursion (distinct from app-level)

**All v8.2 content preserved:** 3-pillar primary focus (PLANS / LEARNING / PEOPLE), Tier 2 supporting platform, pillar balance invariants, LVUA protocol, 10 evidence source types, persona fixture versioning, test account isolation, read-only observation middleware, viewport tolerance (≤414 / 414-834 / >834), per-pass explicit phasing, LVUA → journey test two-row handoff, session-end summary, continuous loop (no session-level convergence).

## Usage

1. **Manus** with ≥6h autonomous budget, git-write credentials to `mwpenn94/stewardly-ai`, browser access to `staging.stewardly.manus.space` (preferred) or `stewardly.manus.space` (read-only).
1. **Set env:** `PERSONA_FIXTURE_SALT` — dev default OK on first run; prod requires private value via secrets management.
1. **Upload prior state** if resuming — optionally `docs/PARITY.md`, `persona-fixtures/`, `session-summary-<prior>.md`.
1. **Paste content** between `═══ BEGIN PROMPT ═══` and `═══ END PROMPT ═══`.
1. **Walk away.** 6-12+ hours, 10-50+ passes, LVUA every pass, pillar-aligned, pillar balance + hard-fail invariants enforced, Tier 2 anti-starvation, pillar metric staleness revisits.
1. **On return, review:**
   1. `docs/PARITY.md` — Pillar distribution + umbrella/sub-row chains
   1. Session-end summary — Pillar metric progress with measurement windows; pillar hard-fail violations (should be 0)
   1. LVUA persona coverage across last 3 sessions
   1. Persona observation errors
   1. Staged work at `.optimization/staged/<pass>/` (3-pass blocks)
   1. Sign off or reject per pass; cascade rollback per `depends_on`

## Evolution across versions

|Version |Passes in recursion|Substantive findings|Cumulative FM closed|Key addition                                                                                                                                                                                                                                    |
|--------|-------------------|--------------------|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|v8      |6                  |9                   |~57                 |Fusion with continuous build loop + PARITY bidirectional                                                                                                                                                                                        |
|v8.1    |8                  |~15                 |~72                 |Live Virtual User Assessment (LVUA) protocol                                                                                                                                                                                                    |
|v8.2    |6                  |17                  |~89                 |3-pillar primary focus (PLANS / LEARNING / PEOPLE) with tier stratification                                                                                                                                                                     |
|**v8.3**|**9**              |**22**              |**~111**            |**Formal ordering/balance enforcement (priority formula, pillar focus formula, hard-fail, measurement windows, layered guardrails, Adversarial cross-check, T row status, Parent ID, per-regime compliance split, fixture determinism w/ salt)**|