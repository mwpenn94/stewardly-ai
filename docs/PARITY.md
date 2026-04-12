# PARITY.md — Hybrid Build Loop Sync Doc

> **Purpose.** Bidirectional sync surface between the hybrid build loop
> (`claude/hybrid-build-loop-A29RE`) and any parallel assessment processes
> that want to suggest work or verify progress. The build loop reads this
> doc every pass and writes back what it shipped, what it deferred, and
> what new gaps it found.
>
> **Scope for this branch.** Best existing and planned comparables overall
> to Stewardly as an app — per `STEWARDLY_COMPREHENSIVE_GUIDE.md`.
>
> **How to interact.**
> - Add rows to the gap matrix if you want the build loop to work on
>   something new. Use status `open` and priority `P1|P2|P3`.
> - Flip rows to `done` once shipped — the build loop will bump depth
>   score and attach a commit SHA.
> - Append to **Known-Bad** if a dead-end was tried — stops retries.
> - Append to **Reconciliation Log** on any write conflict.

---

## 1. Protected improvements (do not weaken)

| #   | Improvement                                                                                 | Locked in commit |
| --- | ------------------------------------------------------------------------------------------- | ---------------- |
| P1  | Comparables scoring helpers are PURE (no DB/fetch) — unit-testable offline                  | Pass 1           |
| P2  | Comparables catalog is DATA-ONLY in `data.ts`; scoring logic lives in `scoring.ts`          | Pass 1           |
| P3  | Every comparable feature score is clamped to 0..3 rubric                                    | Pass 1           |
| P4  | `/comparables` is `protectedProcedure` gated (not public) — strategy-sensitive notes        | Pass 1           |
| P5  | Portfolio rebalancing math is PURE (no DB/fetch); tests run offline                          | Pass 2           |
| P6  | Rebalance proposals are CASH-NEUTRAL (sum of buys = sum of sells)                            | Pass 2           |
| P7  | Meeting note extractor is PURE and deterministic — no LLM cost, offline tests                 | Pass 3           |
| P8  | `extractNotesOffline` gives the meetings router a zero-cost fallback path                      | Pass 3           |
| P9  | Tax projector math is PURE, offline, year-rangeclamped (2024+)                                 | Pass 4           |
| P10 | Tax projector sanitizes negative/NaN income to 0 with warnings instead of throwing            | Pass 4           |
| P11 | Ledger preserves the cost-basis invariant: realized cost + remaining cost = original cost     | Pass 5           |
| P12 | Ledger emits SHORT_POSITION warnings instead of throwing on oversell (graceful degradation)    | Pass 5           |
| P13 | /api/v1 bearer tokens must match `stwly_(live\|test)_<24-128>` format before any DB lookup      | Pass 6           |
| P14 | /api/v1 endpoints are rate-limited via token bucket before any handler work                    | Pass 6           |
| P15 | /api/v1 handlers delegate to the pure services (no DB access in route layer)                   | Pass 6           |
| P16 | Estate document parser is PURE and OCR-free — caller supplies text                             | Pass 7           |
| P17 | Catalog catalog entries are immutable data (no runtime mutation) and invariant-checked in tests  | Pass 8           |
| P18 | Wash sale detector handles both pre-sale and post-sale 30-day windows                            | Pass 9           |
| P19 | Wash sale detector computes partial disallowance when replacement shares < sold shares           | Pass 9           |
| P20 | State tax module is a PURE additive extension — federal projector is untouched                  | Pass 10          |
| P21 | Webhook signer uses constant-time comparison to resist timing attacks                           | Pass 12          |
| P22 | Dispatch state machine is a PURE reducer — HTTP fetch is injected by the caller                 | Pass 12          |
| P23 | Short-position tracker is a PURE additive extension — ledger.ts is untouched                    | Pass 13          |
| P24 | Fiduciary report generator is PURE and handles partial input (every section optional)           | Pass 14          |

---

## 2. Gap matrix — comparable features vs Stewardly

Columns:

- `id` — short stable id (PARITY-<area>-<n>)
- `scope` — which comparable app/feature family
- `axis` — FeatureAxisId used in `server/services/comparables/data.ts`
- `status` — `open` | `in_progress` | `done` | `wontfix`
- `priority` — `P1` (blocker) | `P2` (should) | `P3` (nice)
- `added_by` — `assessment` | `build` (so assessment loop knows whether
  to re-verify). `build` means "I the build loop found this while
  shipping something else".
- `depth` — 0..3, same rubric as the catalog. 0 = nothing, 3 = first
  class. Mirrors the catalog's Stewardly score on this axis.
- `last_commit` — SHA when last touched (empty until shipped)
- `notes` — one-line evidence

| id                    | scope                                    | axis                 | status       | priority | added_by   | depth | last_commit | notes                                                                                     |
| --------------------- | ---------------------------------------- | -------------------- | ------------ | -------- | ---------- | ----- | ----------- | ----------------------------------------------------------------------------------------- |
| PARITY-SEED-0001      | Bootstrap comparables subsystem          | n/a                  | done         | P1       | build      | 3     | 19a7b05     | Catalog, scoring, tests, router, page, nav, route — all shipped Pass 1.                    |
| PARITY-REPORT-0001    | Fiduciary compliance report composer     | n/a                  | done         | P2       | build      | 3     | (Pass 14)   | Pass 14: cross-module composer that combines Pass 2 (rebalancing) + Pass 4 (federal tax) + Pass 5 (ledger) + Pass 9 (wash sale) + Pass 10 (state tax) + Pass 13 (shorts) + comparables into a single markdown fiduciary report, 14 tests, reportsFiduciary.build tRPC procedure. |
| PARITY-REBAL-0001     | Portfolio rebalancing / drift alerts     | rebalancing          | in_progress  | P1       | build      | 1     | (Pass 2)    | Pass 2: pure drift engine + cash-neutral proposals + tax-aware sells + 35 tests. Live portfolio ingestion still pending — see PARITY-REBAL-0002. |
| PARITY-REBAL-0002     | Live portfolio ingestion for rebalancer  | rebalancing          | open         | P1       | build      | 0     |             | Follow-up to PARITY-REBAL-0001. Wire Plaid/custodian feed → stored positions → cron that calls `computeDrift` and creates proactive_insights.    |
| PARITY-REBAL-0003     | Rebalancer UI page                       | rebalancing          | done         | P2       | build      | 2     | (Pass 3)    | Pass 3: `/rebalancing` page with holdings + targets editor, options (drift threshold / cash buffer / tax-aware / new cash), results split (drift table + trade proposals) + aria-live status region + skip link. |
| PARITY-MEET-0001      | Automated meeting transcription + notes  | meeting_transcription | in_progress  | P1       | build      | 2     | (Pass 3)    | Pass 3: pure offline note extractor (action items / decisions / concerns / dates / participants / compliance flags), 45 tests, meetings.extractNotesOffline tRPC procedure. Live audio capture + CRM push still open — see PARITY-MEET-0002. |
| PARITY-MEET-0002      | Live audio capture + CRM push            | meeting_transcription | open         | P2       | build      | 0     |             | Follow-up to PARITY-MEET-0001. Browser mic → streamed transcript → extractor → optional LLM synth → CRM write.            |
| PARITY-PORT-0001      | Portfolio accounting ledger              | portfolio_mgmt       | in_progress  | P2       | build      | 2     | (Pass 5)    | Pass 5: pure cost-basis ledger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot methods, lot tracking, realized/unrealized P&L, splits + dividends, loss harvest picker + 49 tests. Live multi-custodian aggregation open — see PARITY-PORT-0002. |
| PARITY-PORT-0002      | Live custodian aggregation into ledger   | portfolio_mgmt       | open         | P2       | build      | 0     |             | Follow-up to PARITY-PORT-0001. Wire Plaid / Addepar / BlackDiamond transaction feeds into the ledger via a nightly cron.                                                                                                                   |
| PARITY-MOBILE-0001    | Native mobile app shell                  | mobile_app           | open         | P2       | build      | 0     |             | Wealthfront/Betterment/Farther all ship native. No Capacitor/RN shell in repo yet.         |
| PARITY-API-0001       | Versioned public REST API                | api_first            | done         | P3       | build      | 3     | (Pass 6)    | Pass 6: /api/v1 mounted on Express with bearer auth (stwly_ prefix), token-bucket rate limiter (60 burst / 60 rpm), OpenAPI 3.1 spec, 6 endpoints (health, openapi.json, comparables/summary, comparables/gaps, rebalancing/simulate, tax/project-year, portfolio-ledger/run), 41 new unit tests (auth + rate-limit + openapi). |
| PARITY-TAX-0001       | Multi-year tax projection + basis track  | tax_planning         | in_progress  | P2       | build      | 3     | (Pass 4)    | Pass 4: pure projector (multi-year, Roth ladder, RMD, IRMAA, LTCG 0/15/20 stack), 46 tests, `tax.*` tRPC router. Basis tracking per-lot still open — see PARITY-TAX-0002. |
| PARITY-TAX-0002       | Per-lot basis tracking                   | tax_planning         | done         | P3       | build      | 3     | (Pass 5)    | Closed by Pass 5 — ledger.ts provides per-lot basis via `runLedger` with 6 cost-basis methods + holding period computation + lossHarvestCandidates picker. Shared primitive with PARITY-PORT-0001. |
| PARITY-ESTATE-0001    | Estate doc OCR + flow-chart              | estate_planning      | in_progress  | P3       | build      | 3     | (Pass 7)    | Pass 7: pure offline text parser (estate/documentParser.ts) — extracts testators, executors, trustees, beneficiaries (w/ per-stirpes + %/amount), specific bequests, guardians, governing state, trust kind. 32 tests. OCR pipeline still external — caller supplies text. |
| PARITY-ESTATE-0002    | OCR pipeline + visual flowchart          | estate_planning      | open         | P3       | build      | 0     |             | Follow-up to PARITY-ESTATE-0001. Add OCR adapter (Textract / doctr) + d3 flowchart component that renders the parsed structure.                                                                                                                                                              |
| PARITY-CATALOG-0001   | Catalog freshness — quarterly refresh    | n/a                  | in_progress  | P3       | build      | n/a   | (Pass 8)    | Pass 8: catalog grew from 18 → 24 apps (Addepar, Tamarac, Black Diamond, Morningstar Office, AdvicePay, Catchlight). Quarterly sourceNotes refresh cadence still open. |
| PARITY-CATALOG-0002   | Non-US comparables                       | n/a                  | done         | P3       | build      | n/a   | (Pass 11)   | Pass 11: added 6 non-US comparables — SJP (UK), Schroders (UK), AJ Bell (UK), Nomura Wealth (JP), Netwealth (AU), Scalable Capital (DE). Catalog now 30 apps across 3 continents. |
| PARITY-TAX-0003       | State tax tables (NY/CA/IL/TX)           | tax_planning         | done         | P2       | build      | 3     | (Pass 10)   | Pass 10: pure state tax projector (CA progressive with MH surcharge, NY progressive with optional NYC surcharge, IL 4.95% flat, TX zero), 15 tests, tax.projectStateTax tRPC proc, combinedEffectiveRate helper, SUPPORTED_STATES constant. Pure additive extension — federal projector untouched. |
| PARITY-REBAL-0004     | Wash sale detector                       | rebalancing          | done         | P2       | build      | 3     | (Pass 9)    | Pass 9: pure wash sale detector (washSale.ts), 17 tests, detectWashSales + canHarvestWithoutWashSale + earliestSafeRepurchase helpers. Wired into portfolioLedger router. |
| PARITY-PORT-0003      | Short-position ledger tracking           | portfolio_mgmt       | done         | P3       | build      | 3     | (Pass 13)   | Pass 13: server/services/portfolio/shortPositions.ts — pure additive extension that tracks short lots opened by over-sells, covers them FIFO on subsequent buys, records cover gains (long-term + short-term), handles splits, multi-symbol isolation, valueShortPositions helper. 19 tests. portfolioLedger.trackShorts/valueShorts tRPC procs. |
| PARITY-API-0002       | Webhook delivery (outbound events)       | api_first            | in_progress  | P3       | build      | 2     | (Pass 12)   | Pass 12: server/api/v1/webhooks.ts — HMAC-SHA256 signer (Stripe-compatible `t=<ts>,v1=<hex>` header), constant-time verifier, exponential backoff with jitter (5s → 5min), retry/abandon policy (5xx + transport = retry, 4xx = abandon, max 5 attempts), pure reducer-style state machine (pending/in_flight/delivered/failed_retry/abandoned) with injected fetch — 33 tests. Delivery cron + persistence still open. |

---

## 3. Known-Bad (dead-ends — do not retry)

_Empty — nothing has been tried and failed yet on this branch._

---

## 4. Reconciliation Log

_Empty — no three-way merge conflicts yet._

Log format when first conflict occurs:

```
YYYY-MM-DD · Pass N · file · cause · resolution
```

---

## 5. Build Loop Pass Log

One-line summary per pass. Next-pass-you reads this to find out what
prior-pass-you did and didn't finish.

| Pass | Angle            | Queue summary                                                            | Commit SHA | Items completed                                                                                                                                                            | Items deferred                                                                                                     |
| ---- | ---------------- | ------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | fresh-assessment | Bootstrap comparables subsystem — catalog, scoring, router, page, nav   | 19a7b05    | data.ts (18 apps × 18 axes), scoring.ts (pure helpers), 46 unit tests, comparables tRPC router, `/comparables` page, AppShell + PersonaSidebar5 nav entry, PARITY.md scaffold | PARITY-REBAL/MEET/PORT/MOBILE/API/TAX/ESTATE/CATALOG rows added as OPEN gap items for future passes and assessment. |
| 2    | correctness      | Portfolio rebalancing drift engine — pure math + tRPC simulate endpoint | d5cf2dd    | rebalancing.ts (computeDrift + simulateWithNewCash + validateTargetAllocation + tax-aware sell ordering + cash buffer rule), 35 unit tests, rebalancing tRPC router, catalog bump from 0→1, PARITY-REBAL-0002 + PARITY-REBAL-0003 follow-up rows                   | Live portfolio ingestion (PARITY-REBAL-0002) and UI page (PARITY-REBAL-0003) deferred to later passes.                                                                                                                    |
| 3    | integration      | /rebalancing UI page + meetings.extractNotesOffline (2 gap closures)    | c0db55d    | noteExtractor.ts (pure regex/heuristic extractor) + 45 tests, meetings.extractNotesOffline tRPC procedure, Rebalancing.tsx page (holdings + targets editor + drift table + proposals + aria-live status + skip link), PARITY-REBAL-0003 done, PARITY-MEET-0001 bumped 1→2 + PARITY-MEET-0002 follow-up row, Scale icon added to AppShell + PersonaSidebar5 advisor layer | PARITY-MEET-0002 (live audio), PARITY-REBAL-0002 (live ingestion) still open — both require external infra. |
| 4    | type-safety + input-validation | Multi-year tax projector pure module + tRPC router | c373379    | projector.ts (projectYear/projectYears/projectRothLadder/computeRMD/irmaaTier/summarizeYears/inflationFactor) with full MFJ/MFS/HOH/single bracket tables for 2024 current-law + post-TCJA-sunset model, 46 unit tests, server/routers/tax.ts mounted as appRouter.tax, tax_planning catalog score bumped 2→3, PARITY-TAX-0002 follow-up row for basis tracking | PARITY-TAX-0002 (per-lot basis) deferred. |
| 5    | test coverage + graceful degradation | Cost-basis ledger + per-lot basis + loss harvest (2 gap closures) | 5407792    | ledger.ts (runLedger with 6 methods, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router, portfolio_mgmt catalog bump 1→2, PARITY-TAX-0002 closed via shared primitive, PARITY-PORT-0002 follow-up row | PARITY-PORT-0002 (live feed) deferred. |
| 6    | security + dev ergonomics | Public versioned REST /api/v1 surface with bearer auth + rate limit + OpenAPI spec | 875ea7f    | api/v1/* (auth, rateLimit, openapi, router), 41 unit tests, mounted on /api/v1 ahead of /api/trpc, api_first catalog bump 2→3, PARITY-API-0001 closed | none — closed in full this pass. |
| 7    | offline (zero external deps) | Estate document pure text parser | 2a4d6f4    | estate/documentParser.ts + 32 tests, estate.parseDocumentOffline tRPC proc, estate_planning catalog bump 2→3, PARITY-ESTATE-0001 in_progress depth 3, PARITY-ESTATE-0002 follow-up row for OCR + flowchart | PARITY-ESTATE-0002 deferred. |
| 8    | accessibility + docs-staleness | Catalog expansion + Comparables a11y audit | bbf249e    | 6 new comparables, Comparables.tsx skip-link + aria-live + aria-labels, P17 added | Quarterly sourceNotes refresh cadence still open. |
| 9    | edge cases | Wash sale detector + 5 new PARITY rows found during builds | 2f5277e    | washSale.ts + 17 tests + 2 tRPC procs, 5 new PARITY rows | CATALOG-0002/TAX-0003/PORT-0003/API-0002 queued. |
| 10   | migration safety | State tax tables (CA/NY/IL/TX) as additive extension | 05ea24a    | stateTax.ts (projectStateTax + combinedEffectiveRate + SUPPORTED_STATES) + 15 tests, tax.projectStateTax + tax.supportedStates tRPC procs, PARITY-TAX-0003 closed done depth 3, P20 added (pure additive extension) | 3 remaining P3 rows (CATALOG-0002, PORT-0003, API-0002) queued. |
| 11   | i18n | Non-US comparables added to catalog | bb74643    | 6 new comparables (SJP/Schroders/AJ Bell/Nomura/Netwealth/Scalable), invariants still pass, PARITY-CATALOG-0002 closed done | — |
| 12   | observability | Outbound webhook signer + dispatch state machine | 19d15ef    | api/v1/webhooks.ts (HMAC-SHA256 Stripe-compat signer, constant-time verifier, backoff, reducer state machine with injected fetch) + 33 tests, P21 + P22 added, PARITY-API-0002 in_progress depth 2 | Delivery cron + persistence still open. |
| 13   | dead-code + race-conditions | Short-position ledger pure extension | 923198b    | shortPositions.ts + 19 tests + trackShorts/valueShorts tRPC procs, P23, PARITY-PORT-0003 closed done depth 3 | — |
| 14   | error states | Cross-module fiduciary compliance report composer | 6dba344    | reports/fiduciaryReport.ts + 14 tests + reportsFiduciary.build tRPC proc, P24, PARITY-REPORT-0001 closed done depth 3. Capstone combining Passes 2/4/5/9/10/13 | — |
| 15   | integration (Pass 6 × Pass 14) | Expose fiduciary report through public /api/v1 | 6833d51    | /api/v1/reports/fiduciary POST endpoint wiring buildFiduciaryReport behind the Pass 6 bearer auth + rate limit. OpenAPI spec updated. 1 new test covering the endpoint in the spec. | — || reports/fiduciaryReport.ts (buildFiduciaryReport) + 14 tests, reportsFiduciary.build tRPC proc, P24, PARITY-REPORT-0001 closed done depth 3. Capstone module combining Passes 2/4/5/9/10/13 + comparables into a single markdown report. | — || shortPositions.ts (trackShortPositions + valueShortPositions + ShortLot tracking w/ FIFO cover + splits + multi-symbol isolation + over-cover warning), 19 tests, portfolioLedger.trackShorts + valueShorts tRPC procs, P23 (pure additive — ledger.ts untouched), PARITY-PORT-0003 closed done depth 3 | — || api/v1/webhooks.ts (signWebhookBody, verifyWebhookSignature, parseSignatureHeader, buildSignatureHeader, backoffMs, shouldRetry, initDispatchState, stepDispatchState, isTerminal, isReadyNow), 33 tests, PARITY-API-0002 in_progress depth 2, P21 + P22 added | Delivery cron + persistence layer still open. || 6 new apps — SJP + Schroders + AJ Bell (UK), Nomura Wealth (JP), Netwealth (AU), Scalable Capital (DE). Catalog now 30 apps across 3 continents. PARITY-CATALOG-0002 closed done. 46 scoring tests still pass (invariants hold). | PARITY-PORT-0003 and PARITY-API-0002 still queued. || washSale.ts (detectWashSales + canHarvestWithoutWashSale + earliestSafeRepurchase) + 17 unit tests, portfolioLedger.detectWashSales/canHarvest tRPC procs, new PARITY rows for CATALOG-0002/TAX-0003/REBAL-0004/PORT-0003/API-0002, PARITY-REBAL-0004 closed same pass | CATALOG-0002/TAX-0003/PORT-0003/API-0002 queued for future passes. || Catalog grew 18→24 apps (Addepar / Tamarac / Black Diamond / Morningstar Office / AdvicePay / Catchlight), Comparables.tsx got skip-link + aria-live status + aria-label on every axis leader + catalog card + exemplar button, PARITY-CATALOG-0001 in_progress | Quarterly sourceNotes refresh cadence still open. || estate/documentParser.ts (parseEstateDocument + renderEstateMarkdown), 32 unit tests covering document kind detection, trust kind, governing state, testators, executors (incl successor), trustees, guardians, beneficiaries (dollar + percentage + per stirpes), specific bequests, residuary reference, defensive handling, end-to-end realistic will. estate.parseDocumentOffline tRPC procedure. estate_planning catalog bump 2→3. PARITY-ESTATE-0002 follow-up row for OCR + flowchart | PARITY-ESTATE-0002 (OCR + flowchart) deferred. || api/v1/auth.ts (bearer token format check + resolver + middleware), api/v1/rateLimit.ts (token bucket), api/v1/openapi.ts (3.1 spec builder), api/v1/router.ts (Express sub-router wiring 7 endpoints), 41 unit tests across auth + rateLimit + openapi, mounted on /api/v1 in server/_core/index.ts ahead of /api/trpc, api_first catalog bump 2→3, PARITY-API-0001 closed done | none — PARITY-API-0001 closed in full this pass. || ledger.ts (runLedger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router (run / valueWithPrices / lossHarvest), portfolio_mgmt catalog bump 1→2, PARITY-PORT-0001 in_progress depth 2, PARITY-TAX-0002 closed as done (depth 3 via shared primitive), PARITY-PORT-0002 follow-up row for live custodian aggregation | PARITY-PORT-0002 (live feed) deferred. |

---

## 6. How the build loop reads this doc

On each pass, the loop:

1. **Reads** sections 2 and 3 for its work queue.
2. **Priority rules**:
   - Rows with `status=open` + `added_by=assessment` get priority 1.
   - Rows with `status=open` + `added_by=build` get priority 2.
   - Fresh-assessment items found this pass get priority 3.
3. **Writes** back at end of pass:
   - `done` + bumped depth + commit SHA for shipped rows
   - New `open` rows for gaps discovered mid-build
   - New Known-Bad entries on dead-ends
   - New Pass Log line

When the assessment loop is running in parallel, it can ADD new rows
with `added_by=assessment` — the build loop will pick them up on its
next pass. When two processes edit the same row concurrently, resolve
by **evidence recency** (latest sourceNotes or commit SHA wins), and
log the conflict in section 4.
