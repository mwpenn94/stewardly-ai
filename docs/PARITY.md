# PARITY — Financial Planning Engine Build Loop

This document is the two-way sync point between the continuous build
loop (`Pass N` entries, code-shipping passes) and any parallel
processes (assessment agents, review agents, human reviewers) that
want to feed recommendations into the work queue without a direct
chat message.

**Scope (Pass 1):** optimal comprehensive financial planning + other
services force multipliers for users, unified wealth engines including
business income and all calculators, quick-quoting for all financial
services across industry, users across layers.

## How this file is read and written

### For the build loop
1. Every pass reads the **Gap matrix** below to pick work.
2. Rows tagged `open` or `in_progress` with a scope tag matching the
   current focus become candidate tasks.
3. On completion, flip the row to `done`, drop the commit SHA into
   `shipped_in`, and bump `depth` to match the work that landed.
4. Append a one-line entry to the **Build Loop Pass Log** at the
   bottom with `angle`, `queue`, `commit`, `items completed`,
   `items deferred`.
5. Append new gaps found during work to the matrix with
   `found_by: build` so the assessment loop knows whether to
   re-verify.

### For parallel processes
1. Add a row to the **Gap matrix** with a short `id` (G1, G2, …),
   a terse `title`, the `scope` (planning / engines / quick_quote /
   layers / observability / docs / etc), `priority` (P0 / P1 / P2),
   `status: open`, and `found_by: assessment`.
2. If the row is reviewable, leave `shipped_in` and `depth` blank.
3. The build loop will consume it on the next pass.

### Three-way merge rule
When both the build loop and an external process touch this file
simultaneously:
- **Gap matrix**: last-write-wins per row id; for conflicting edits
  on the same row, prefer the row with the more recent commit SHA
  under `shipped_in` since that's evidence of actual work.
- **Protected improvements**: never remove or downgrade a protected
  row. If you need to, log the rationale in the
  **Reconciliation Log** first.
- **Pass log**: append-only. Merge conflicts here resolve by
  concatenating both branches' entries in chronological order.

## Protected improvements (anti-regression ratchet)

These are improvements that passed through the build loop. Any
future pass that removes or weakens them MUST log the rationale in
the Reconciliation Log and flag the change in its pass log entry.

- **P-F1 (pass 1):** Shared financial profile store at
  `client/src/stores/financialProfile.ts` + `useFinancialProfile`
  hook. Every calculator and quick-quote flow is supposed to
  consume this — do NOT fork the shape inline.
- **P-F2 (pass 1):** `FinancialProfileBanner` is the canonical
  cross-page "resume / prefill" chip. Prefer drop-in use over
  rebuilding the prefill UI inside individual pages.

## Gap matrix

| id  | title                                                      | scope        | priority | status     | found_by   | shipped_in | depth | notes                                                                       |
| --- | ---------------------------------------------------------- | ------------ | -------- | ---------- | ---------- | ---------- | ----- | --------------------------------------------------------------------------- |
| G1  | Shared client financial profile store                      | planning     | P0       | done       | build      | pass 1     | 0.6   | Pure store + hook + banner + 36 tests. Two consumers wired in pass 1.       |
| G2  | Wire profile store into remaining calculators (IUL, PF, TaxProjector, SocialSecurity, HSA, Charitable, Divorce, Education) | planning | P1 | open | build | — | — | Retirement + QuickQuote done in pass 1. 8 more calculators need the banner + prefill handler. |
| G3  | Wire profile store into FinancialPlanning page tabs (Monte Carlo, Roth, Goals, Social Security) | planning | P1 | open | build | — | — | Every tab has local state that duplicates the shared profile. |
| G4  | Wire profile store into EstatePlanning / TaxPlanning / RiskAssessment stubs | planning | P1 | open | build | — | — | These three pages are thin and good candidates for profile-driven recommendations. |
| G5  | Wire profile store into Wealth-Engine pages (Retirement, StrategyComparison, PracticeToWealth) | engines | P1 | open | build | — | — | Currently each wealth-engine page re-enters the full ClientProfile. |
| G6  | Unified Quick-Quote hub that routes to per-service quick quotes (Life, DI, LTC, Annuity, AUM, 529, Premium Finance, Business Income, Estate, Tax, Charitable) | quick_quote | P0 | open | build | — | — | Today only one Quick Quote exists (WealthBridge projection). Each product line needs a 3-step quick quote. |
| G7  | Public quick-quote landing (no auth) that writes to guest profile and invites sign-up | quick_quote | P1 | open | build | — | — | PublicCalculators.tsx is available but not using the shared profile yet. |
| G8  | Cross-layer profile scoping (Person → Client → Advisor → Manager → Steward) | layers | P1 | open | build | — | — | Advisors need to view and switch profiles across their book; the store is per-device today. |
| G9  | Server-side persistence of financial profile (tRPC `financialProfile.get/set`) + DB migration | planning | P1 | open | build | — | — | localStorage-only means cross-device users lose their profile. |
| G10 | Completeness gate on wealth engine calls (auto-prompt missing fields before running projection) | planning | P2 | open | build | — | — | Today we fall back to defaults silently; better UX is a "fill in 3 more fields for higher-confidence results" prompt. |
| G11 | Calculator result breadcrumb: each run persists to a shared timeline across calculators | observability | P2 | open | build | — | — | `calculatorPersistence` exists but isn't surfaced to the user as a timeline. |
| G12 | BIE (business income) quick-quote for advisors: preset roles → 30-year income projection | engines | P1 | open | build | — | — | BIE is fully engined but has no UI beyond the strategy-comparison page. |
| G13 | Holistic (HE) "do-nothing vs strategy" side-by-side comparison from saved profile | engines | P1 | open | build | — | — | HE is wired in wealthEngine router but no standalone UI. |
| G14 | Proactive calc suggestions based on profile deltas (life event → run Monte Carlo) | planning | P2 | open | build | — | — | Needs the profile-change bus from G9. |
| G15 | Docs: one-pager on the financial profile API for future contributors | docs | P2 | open | build | — | — | Short guide describing where to import, how to register a new field. |

## Known-Bad (dead ends — don't re-attempt)

_(empty — first pass)_

## Reconciliation Log

_(empty — first pass)_

## Build Loop Pass Log

Append-only. One line per pass. Format:
`Pass N · angle · queue summary · commit SHA · completed · deferred`

- Pass 1 · angle: correctness + type safety · queue: [G1 bootstrap profile store + banner, docs bootstrap, QuickQuoteFlow + Calculators retirement wiring] · commit: pending · completed: G1 (shared profile store + hook + banner + 36 unit tests + 2 consumers wired), PARITY.md bootstrap · deferred: G2-G15 (tracked as open gaps in matrix)
