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
| PARITY-REBAL-0001     | Portfolio rebalancing / drift alerts     | rebalancing          | in_progress  | P1       | build      | 1     | (Pass 2)    | Pass 2: pure drift engine + cash-neutral proposals + tax-aware sells + 35 tests. Live portfolio ingestion still pending — see PARITY-REBAL-0002. |
| PARITY-REBAL-0002     | Live portfolio ingestion for rebalancer  | rebalancing          | open         | P1       | build      | 0     |             | Follow-up to PARITY-REBAL-0001. Wire Plaid/custodian feed → stored positions → cron that calls `computeDrift` and creates proactive_insights.    |
| PARITY-REBAL-0003     | Rebalancer UI page                       | rebalancing          | done         | P2       | build      | 2     | (Pass 3)    | Pass 3: `/rebalancing` page with holdings + targets editor, options (drift threshold / cash buffer / tax-aware / new cash), results split (drift table + trade proposals) + aria-live status region + skip link. |
| PARITY-MEET-0001      | Automated meeting transcription + notes  | meeting_transcription | in_progress  | P1       | build      | 2     | (Pass 3)    | Pass 3: pure offline note extractor (action items / decisions / concerns / dates / participants / compliance flags), 45 tests, meetings.extractNotesOffline tRPC procedure. Live audio capture + CRM push still open — see PARITY-MEET-0002. |
| PARITY-MEET-0002      | Live audio capture + CRM push            | meeting_transcription | open         | P2       | build      | 0     |             | Follow-up to PARITY-MEET-0001. Browser mic → streamed transcript → extractor → optional LLM synth → CRM write.            |
| PARITY-PORT-0001      | Portfolio accounting ledger              | portfolio_mgmt       | in_progress  | P2       | build      | 2     | (Pass 5)    | Pass 5: pure cost-basis ledger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot methods, lot tracking, realized/unrealized P&L, splits + dividends, loss harvest picker + 49 tests. Live multi-custodian aggregation open — see PARITY-PORT-0002. |
| PARITY-PORT-0002      | Live custodian aggregation into ledger   | portfolio_mgmt       | open         | P2       | build      | 0     |             | Follow-up to PARITY-PORT-0001. Wire Plaid / Addepar / BlackDiamond transaction feeds into the ledger via a nightly cron.                                                                                                                   |
| PARITY-MOBILE-0001    | Native mobile app shell                  | mobile_app           | open         | P2       | build      | 0     |             | Wealthfront/Betterment/Farther all ship native. No Capacitor/RN shell in repo yet.         |
| PARITY-API-0001       | Versioned public REST API                | api_first            | open         | P3       | build      | 2     |             | tRPC internally + webhook routers. No versioned external REST surface for third parties.  |
| PARITY-TAX-0001       | Multi-year tax projection + basis track  | tax_planning         | in_progress  | P2       | build      | 3     | (Pass 4)    | Pass 4: pure projector (multi-year, Roth ladder, RMD, IRMAA, LTCG 0/15/20 stack), 46 tests, `tax.*` tRPC router. Basis tracking per-lot still open — see PARITY-TAX-0002. |
| PARITY-TAX-0002       | Per-lot basis tracking                   | tax_planning         | done         | P3       | build      | 3     | (Pass 5)    | Closed by Pass 5 — ledger.ts provides per-lot basis via `runLedger` with 6 cost-basis methods + holding period computation + lossHarvestCandidates picker. Shared primitive with PARITY-PORT-0001. |
| PARITY-ESTATE-0001    | Estate doc OCR + flow-chart              | estate_planning      | open         | P3       | build      | 2     |             | Vanilla/FP Alpha. Stewardly has calc but no doc ingestion.                                 |
| PARITY-CATALOG-0001   | Catalog freshness — quarterly refresh    | n/a                  | open         | P3       | build      | n/a   |             | 18 comparables as of April 2026. Re-verify each sourceNotes line every 90 days.            |

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
| 5    | test coverage + graceful degradation | Cost-basis ledger + per-lot basis + loss harvest (2 gap closures) | (pending)  | ledger.ts (runLedger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router (run / valueWithPrices / lossHarvest), portfolio_mgmt catalog bump 1→2, PARITY-PORT-0001 in_progress depth 2, PARITY-TAX-0002 closed as done (depth 3 via shared primitive), PARITY-PORT-0002 follow-up row for live custodian aggregation | PARITY-PORT-0002 (live feed) deferred. |

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
