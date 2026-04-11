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
| PARITY-SEED-0001      | Bootstrap comparables subsystem          | n/a                  | done         | P1       | build      | 3     | (Pass 1)    | Catalog, scoring, tests, router, page, nav, route — all shipped Pass 1.                    |
| PARITY-REBAL-0001     | Portfolio rebalancing / drift alerts     | rebalancing          | open         | P1       | build      | 0     |             | Orion/Altruist/Wealthfront/Betterment ship this; Stewardly has 0. Largest gap on rubric.  |
| PARITY-MEET-0001      | Automated meeting transcription + notes  | meeting_transcription | open         | P1       | build      | 1     |             | Jump/Zocks/Zeplyn/FinMate. Meetings router exists but no auto-transcribe + CRM push.       |
| PARITY-PORT-0001      | Portfolio accounting ledger              | portfolio_mgmt       | open         | P2       | build      | 1     |             | Orion/Envestnet/Altruist/eMoney first-class. Stewardly only has Plaid perception snippets. |
| PARITY-MOBILE-0001    | Native mobile app shell                  | mobile_app           | open         | P2       | build      | 0     |             | Wealthfront/Betterment/Farther all ship native. No Capacitor/RN shell in repo yet.         |
| PARITY-API-0001       | Versioned public REST API                | api_first            | open         | P3       | build      | 2     |             | tRPC internally + webhook routers. No versioned external REST surface for third parties.  |
| PARITY-TAX-0001       | Multi-year tax projection + basis track  | tax_planning         | open         | P2       | build      | 2     |             | Holistiplan/FP Alpha/RightCapital deeper. Stewardly has calc but not multi-year ladder.   |
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
| 1    | fresh-assessment | Bootstrap comparables subsystem — catalog, scoring, router, page, nav   | (pending)  | data.ts (18 apps × 18 axes), scoring.ts (pure helpers), 46 unit tests, comparables tRPC router, `/comparables` page, AppShell + PersonaSidebar5 nav entry, PARITY.md scaffold | PARITY-REBAL/MEET/PORT/MOBILE/API/TAX/ESTATE/CATALOG rows added as OPEN gap items for future passes and assessment. |

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
