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
- **P-F3 (pass 4):** `shared/financialProfile.ts` is the
  authoritative source for FinancialProfile sanitization, merge,
  and completeness. Both `client/src/stores/financialProfile.ts`
  (re-export only) and `server/services/financialProfile/store.ts`
  import from there. Do NOT add a duplicate sanitizer in
  client-only or server-only code.

## Gap matrix

| id  | title                                                      | scope        | priority | status     | found_by   | shipped_in | depth | notes                                                                       |
| --- | ---------------------------------------------------------- | ------------ | -------- | ---------- | ---------- | ---------- | ----- | --------------------------------------------------------------------------- |
| G1  | Shared client financial profile store                      | planning     | P0       | done       | build      | pass 1     | 0.6   | Pure store + hook + banner + 36 tests. Two consumers wired in pass 1.       |
| G2  | Wire profile store into remaining calculators (PF, HSA, Charitable, Divorce, Education) | planning | P1 | in_progress | build | pass 2 (IUL), pass 8 (TaxProjector+SocialSecurity) | 0.4 | Retirement + QuickQuote + IUL + TaxProjector + SocialSecurity done. 5 more calculators need the banner + prefill handler. |
| G7  | Public quick-quote landing (no auth) that writes to guest profile and invites sign-up | quick_quote | P1 | done | build | pass 8 | 0.7 | PublicCalculators.tsx now reads/writes the shared profile through the same hook. RetirementCalculator seeds age/retireAge/savings/monthly from the profile, persists on calculate. TaxBracketCalculator seeds income, derives + persists marginalRate from the computed bracket, persists filingStatus. Guest mode works because server sync is gated on isAuthenticated inside the hook. |
| G3  | Wire profile store into FinancialPlanning page tabs (Roth, Goals, Social Security) | planning | P1 | in_progress | build | pass 6 (RetirementProjection) | 0.25 | Pass 6 wired the Monte Carlo retirement tab. 3 tabs to go. |
| G4  | Wire profile store into EstatePlanning / TaxPlanning / RiskAssessment stubs | planning | P1 | done | build | pass 7 | 0.7 | All 3 pages now read useFinancialProfile + FinancialProfileBanner. TaxPlanning derives effectiveRate + bracketHint + Roth/bracket headroom from income + marginalRate + filingStatus. EstatePlanning derives taxable estate from netWorth + filingStatus + sunset-risk flag. RiskAssessment overrides Time Horizon factor from age+retirementAge and Loss Tolerance from dependents. All 3 persist relevant fields back to the profile. |
| G17 | Bundle size: main chunk is 1.6MB — add manualChunks splits for radix/trpc/icons/forms/date | performance | P2 | done | build | pass 7 | 0.5 | vite.config.ts now splits 5 new vendor chunks (vendor-radix 152kB, vendor-trpc, vendor-icons, vendor-forms, vendor-date). Main bundle 1631kB → 1407kB (-13.7%, -224kB). Still over the 500kB default threshold but significantly improved. |
| G5  | Wire profile store into Wealth-Engine pages (Retirement, StrategyComparison, PracticeToWealth) | engines | P1 | in_progress | build | pass 9 (Retirement), pass 10 (PracticeToWealth) | 0.5 | Retirement + PracticeToWealth done. StrategyComparison pending. |
| G6  | Unified Quick-Quote hub that routes to per-service quick quotes (Life, DI, LTC, Annuity, AUM, 529, Premium Finance, Business Income, Estate, Tax, Charitable) | quick_quote | P0 | done | build | pass 5 | 0.85 | New `/wealth-engine/hub` (alias `/quick-quotes`) page with the QUICK_QUOTE_REGISTRY (15 entries: wealth/holistic/biz/retirement/IUL/PF/tax/SS/estate/risk/protection/LTC/annuity/529/charitable). Profile-driven recommendations via per-entry fitness functions, scope filter (user/advisor/manager/steward), category-tabbed grid, coming-soon badges for non-shipped flows. 30 unit tests on registry + ranking + recommendations + field impact. |
| G7  | Public quick-quote landing (no auth) that writes to guest profile and invites sign-up | quick_quote | P1 | open | build | — | — | PublicCalculators.tsx is available but not using the shared profile yet. |
| G8  | Cross-layer profile scoping (Person → Client → Advisor → Manager → Steward) | layers | P1 | done | build | pass 10 | 0.75 | New `client/src/stores/profileLibrary.ts` pure helper with saveEntry/deleteEntry/renameEntry/filterEntries/libraryStats + defensive parser + 100-entry cap + 30 unit tests. ProfileLibraryPanel React modal with save/rename/delete/switch UI, search, stats strip, aria-modal, Esc-to-close, cross-tab sync via storage event. Wired into QuickQuoteHub header — Library button appears when scope !== "user". Switching an entry calls replaceProfile + closes the modal. |
| G9  | Server-side persistence of financial profile (tRPC `financialProfile.get/set`) + DB migration | planning | P1 | done | build | pass 4 | 0.8 | New `financial_profiles` table (drizzle migration 0013), shared `shared/financialProfile.ts` so client + server use one sanitizer, `financialProfile` tRPC router with get/set/replace/delete, client hook gained opt-in server mirror with last-write-wins via `updatedAt` timestamp, 7 server-side store tests covering graceful no-DB degradation. Client store now thin re-export of shared module. |
| G10 | Completeness gate on wealth engine calls (auto-prompt missing fields before running projection) | planning | P2 | done | build | pass 9 | 0.8 | New `client/src/stores/completenessGate.ts` pure helper (evaluateGate with blended required/optional weighting 3:1, ConfidenceTier tiers, rankMissingByImpact, FIELD_LABELS map, labelFor fallback). CompletenessGate React component with render-prop API, aria-live banner with tone-aware colors, missing-field list with friendly labels. 18 unit tests. First consumer: Wealth-Engine Retirement page Goal tab. |
| G11 | Calculator result breadcrumb: each run persists to a shared timeline across calculators | observability | P2 | open | build | — | — | `calculatorPersistence` exists but isn't surfaced to the user as a timeline. |
| G12 | BIE (business income) quick-quote for advisors: preset roles → 30-year income projection | engines | P1 | done | build | pass 2 | 0.7 | New page at `/wealth-engine/business-income-quote`. 3-step wizard (role/context → streams → projection). Reads businessRole/businessRevenue/businessEmployees from shared profile; writes back on advance so other calcs reuse. 12 unit tests on pure helpers. |
| G13 | Holistic (HE) "do-nothing vs strategy" side-by-side comparison from saved profile | engines | P1 | done | build | pass 3 | 0.7 | New page at `/wealth-engine/holistic-comparison`. Reads engineProfile from shared store, fans out to two `wealthEngine.runPreset` calls in parallel (defaults: doNothing vs wealthbridgeClient), shows side-by-side bar charts + delta + % improvement + confidence score derived from profileCompleteness and horizon. 23 unit tests on pure helpers. |
| G14 | Proactive calc suggestions based on profile deltas (life event → run Monte Carlo) | planning | P2 | open | build | — | — | Needs the profile-change bus from G9. |
| G15 | Docs: one-pager on the financial profile API for future contributors | docs | P2 | done | build | pass 3 | 0.8 | docs/FINANCIAL_PROFILE_API.md — full contract: shape, reading, writing, banner pattern, late hydration, engine integration, adding new fields, anti-patterns. |
| G16 | Server-side quick-quote suggestion engine — chat agent picks the right quick quote for a topic + profile | quick_quote | P1 | done | build | pass 6 | 0.7 | New `server/services/quickQuoteSuggestions` with topic detection + combined topic+fitness scoring (60/40 blend) + 13-entry registry mirroring shipped client flows + scope filtering + reasoning string. Exposed via `financialProfile.suggest` publicProcedure with optional ctx-driven profile fallback. 20 unit tests covering topic detection, ranking, scope filtering, threshold, empty-message fallback to fitness-only, reasoning generation. |

## Known-Bad (dead ends — don't re-attempt)

_(empty — first pass)_

## Reconciliation Log

_(empty — first pass)_

## Build Loop Pass Log

Append-only. One line per pass. Format:
`Pass N · angle · queue summary · commit SHA · completed · deferred`

- Pass 1 · angle: correctness + type safety · queue: [G1 bootstrap profile store + banner, docs bootstrap, QuickQuoteFlow + Calculators retirement wiring] · commit: 8f8e0f7 · completed: G1 (shared profile store + hook + banner + 36 unit tests + 2 consumers wired), PARITY.md bootstrap · deferred: G2-G15 (tracked as open gaps in matrix)
- Pass 2 · angle: edge cases + surface coverage (expose existing BIE engine that had no UI) · queue: [G12 BusinessIncomeQuickQuote page, G2-partial IUL banner wire, helpers extraction for testability] · commit: f50eebd · completed: G12 (new /wealth-engine/business-income-quote 3-step wizard + ROLE_OPTIONS registry + profileToBizQuickQuote + summarizeBizProjection + 12 pure helper tests + route + Calculators tile), G2-IUL (banner + prefill + age persistence) · deferred: G2-other (7 calcs), G3-G11, G13-G15
- Pass 3 · angle: dead-code + accessibility + docs (rotate from edge cases) · queue: [G13 HolisticComparison page exposing the HE submodule, G15 financial profile API one-pager docs, helpers-first pattern enforcement] · commit: dd5e1b0
- Pass 4 · angle: server-side persistence + race conditions (rotate from dead code) · queue: [G9 financial_profiles table + tRPC router + client opt-in server mirror, shared sanitizer extraction] · commit: 94c7bcc · completed: G9 (financial_profiles table + drizzle 0013 + shared/financialProfile.ts + server store with no-DB graceful degradation + 7 store tests + financialProfileRouter + client hook L1/L2 cache with last-write-wins + P-F3 protected improvement) · deferred: G2-other, G3-G11, G14
- Pass 5 · angle: unified hub + cross-product breadth (rotate from persistence to product-line surface) · queue: [G6 QuickQuoteHub + 15-entry registry + profile-driven recommendation engine] · commit: b2b928c
- Pass 6 · angle: AI/agent integration + observability (rotate to bridge existing systems) · queue: [G16 server-side quickQuoteSuggestions for chat agent, G3-partial RetirementProjection wiring] · commit: b5fcb1e
- Pass 7 · angle: bundle size + lazy loading + thin-page wiring (rotate from AI integration to perf+coverage) · queue: [G4 TaxPlanning/EstatePlanning/RiskAssessment wiring, G17 vite manualChunks for 1.6MB main bundle] · commit: 19d7934
- Pass 8 · angle: guest/unauth flows + input validation (rotate to coverage+guest UX) · queue: [G7 PublicCalculators wiring for guest mode, G2-partial TaxProjector+SocialSecurity Part-F panels] · commit: e073546
- Pass 9 · angle: migration safety + graceful degradation (rotate to smart gating) · queue: [G10 completeness gate helper + component, G5-partial Wealth-Engine Retirement wiring] · commit: fd4cafa
- Pass 10 · angle: cross-layer scoping + multi-tenant visibility (rotate to advisor-facing breadth) · queue: [G8 profileLibrary for advisor multi-client switching, G5-partial PracticeToWealth wiring] · commit: pending · completed: G8 (profileLibrary.ts pure helper with parse/save/rename/delete/filter/libraryStats + 30 tests + 100-entry cap + tolerant parser + cross-tab sync, ProfileLibraryPanel modal with search/save-current/stats/switch/rename/delete/Esc-close/aria-modal, wired into QuickQuoteHub scope≥advisor header as "Library" button), G5-partial (PracticeToWealth.tsx reads useFinancialProfile + seeds age+businessRole from profile + late hydration via useRef + banner with handlePrefill + persists age+businessRole+isBizOwner back on run) · deferred: G2-other (5 calcs), G3-other (3 tabs), G5-other (StrategyComparison), G11, G14 · completed: G10 (client/src/stores/completenessGate.ts pure helper with evaluateGate + rankMissingByImpact + FIELD_LABELS + labelFor + 18 tests covering required-field detection + zero-is-present + false-is-present + dedup + tier thresholds + summary text + edge cases, CompletenessGate React component with render-prop API + aria-live banner + tone-aware colors + missing-field list), G5-partial (Wealth-Engine Retirement.tsx reads useFinancialProfile, seeds age/retirementAge/income/savings from profile, late hydration via useRef, banner above inputs, CompletenessGate around Goal run button, persistToProfile on run) · deferred: G2-other (5 calcs), G3-other (3 tabs), G5-other (2 wealth-engine pages), G8, G11, G14 · completed: G7 (PublicCalculators RetirementCalculator + TaxBracketCalculator now read/write the shared profile, guest-safe since server sync is gated on isAuthenticated inside the hook, TaxBracketCalculator derives + persists marginalRate from the computed federal bracket + persists filingStatus), G2-partial (TaxProjectorPanel seeds wages from profile.income + state from profile.stateOfResidence + persists both back; SSOptimizerPanel derives birthYear from profile.age, persists derived age back on calculate) · deferred: G2-other (5 calcs remain: PF, HSA, Charitable, Divorce, Education), G3-other (3 tabs), G5, G8, G10-G11, G14 · completed: G4 (all 3 thin planning pages read useFinancialProfile via banner + compute profile-driven stats: TaxPlanning derives effectiveRate + bracketHint + Roth headroom from income+marginalRate+filingStatus, EstatePlanning derives taxableEstate from netWorth+filingStatus with sunset-risk flag, RiskAssessment overrides time-horizon factor from age+retirementAge and loss-tolerance from dependents; all persist relevant fields back), G17 (vite.config.ts added 5 new manualChunks for radix/trpc/icons/forms/date, main bundle 1631→1407kB = -224kB -13.7%) · deferred: G2-other (6 calcs remain), G3-other (3 FinancialPlanning tabs), G5, G7-G8, G10-G11, G14 · completed: G16 (server quickQuoteSuggestions service with 13-entry registry + topicScore substring matcher + combinedScore 60/40 blend + suggestQuickQuotes top-N + scope filter + reasoning string + 20 unit tests, financialProfile.suggest publicProcedure with ctx-aware profile fallback for authed users), G3-partial (FinancialPlanning RetirementProjection now reads/writes the shared profile via banner + prefill + persist on run) · deferred: G3-other (3 tabs), G2-other, G4-G5, G7-G8, G10-G11, G14 · completed: G6 (quickQuoteRegistry pure module with 15 entries covering all 6 categories + per-entry fitness scoring + visibility filtering + recommendQuotes top-N ranking + fieldImpactScore + 30 unit tests, QuickQuoteHub page with recommended row + category tabs + scope picker + coming-soon badges + accessible radiogroup, route registered at /wealth-engine/hub and /quick-quotes alias, Calculators tile added) · deferred: G2-other (7 calcs), G3-G5, G7-G8, G10-G11, G14 · completed: G9 (drizzle 0013 migration + financial_profiles table + shared/financialProfile.ts extraction + server/services/financialProfile/store.ts with graceful no-DB degradation + 7 store tests + financialProfileRouter with get/set/replace/delete + router registration + client hook server mirror with last-write-wins via updatedAt + protected-improvement P-F3 added) · deferred: G2-other (7 calcs), G3-G11, G14 · completed: G13 (new /wealth-engine/holistic-comparison side-by-side projection page + HE_PRESET_REGISTRY of 8 presets + computeComparisonDelta + comparisonConfidence + formatDeltaHeadline + profileToHolisticInput + 23 pure helper tests + route + Calculators tile + parallel runPreset fan-out + auto-run on hasProfile + confidence scoring tied to profile completeness + horizon length), G15 (docs/FINANCIAL_PROFILE_API.md full contract for adding new consumers/fields) · deferred: G2-other (7 calcs), G3-G11, G14
