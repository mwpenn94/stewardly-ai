# Stewardly PARITY — Build Loop Work Queue

**Purpose.** Bidirectional work ledger for the continuous build loop. Two
kinds of rows live here:

1. **External recommendations** fed in by parallel assessment processes
   or prior build-loop passes. The build loop reads these, prioritizes
   open ones, and marks them done with a commit SHA.
2. **Build-loop findings** — gaps the build loop's own assessment stage
   noticed. The assessment loop then decides whether to re-verify, and
   future passes can pick them up.

**Scope for this file.** Learning experience optimization against the
`mwpenn94/emba_modules` repo content — SRS flow, cross-track study,
quiz and flashcard runners, importer resilience, agent tool coverage,
accessibility, cost, observability.

## Protected improvements (do not weaken)

These landed in prior passes and must not be regressed. Referenced by
`hybrid: pass N — …` commit prefixes in git log.

| # | Improvement | Landed | Protects |
|---|---|---|---|
| P-1 | `embaImport.ts` handles OBJECT-keyed `disciplines` map + `key`/`correct`/`correct_index` aliases (pass 76) | pass 76 | Import from GitHub does not crash on real emba_modules JSON shape. |
| P-2 | `LearningFlashcardStudy` / `LearningQuizRunner` wire answers into `mastery.recordReview` with 0-5 ladder (pass 58) | pass 58 | Every review advances confidence; `masterySummary.dueNow` counter moves. |
| P-3 | `LearningTrackDetail` lazy-loads subsections via `content.listSubsections` | pass 58 | Large tracks render without N+1 subsection fetches. |
| P-4 | Seed is idempotent (dedup by slug) and distinguishes inserted vs skipped (pass 76) | pass 76 | Re-running Seed does not double-insert disciplines/tracks. |
| P-5 | `CelebrationEngine` heavy/medium wired into quiz + flashcard completion | pass 155 | 100% / 80%+ completions trigger the particle effect. |
| P-6 | Quiz/flashcard `CompletionCard` uses a11y-friendly message tiers (100%/80%/60%) | pass 58 | No exclamation-only messaging; always a substantive wrap-up sentence. |
| P-7 | Cross-track due-review deck — `getDueReviewDeck()` + `LearningDueReview.tsx` + `learning.mastery.dueReview` tRPC query | pass 1 (build loop) | Learners can run a single mixed session over everything SRS-due across every track. |
| P-8 | `assessTrackReadiness` resolves track→content→mastery (NOT prefix match) — readiness=mastered/totalItems | pass 2 (build loop) | Agent's `assess_readiness` and `check_exam_readiness` tools return correct numbers. |
| P-9 | `start_review_session` agent tool exposes `learning.mastery.dueReview` to ReAct loop | pass 2 (build loop) | Agent can answer "what's due today" with real data. |
| P-10 | Pure `deckBuilder.ts` (mulberry32 + Fisher-Yates + 3 modes) drives flashcard + quiz runners with pre-session config | pass 3 (build loop) | Shuffle is seeded + reproducible, session caps work, weakest-first mode prioritizes weak material. |
| P-11 | `embaImport` persists every run to `.stewardly/learning_import_history.json` via `recordImportRun()` — best-effort, never throws | pass 4 (build loop) | Admins can audit "when did we last pull" + per-run inserts/skips/errors without log scraping. |
| P-12 | `LearningTrackDetail` shows per-chapter mastery progress via pure `buildTrackProgress` rollup | pass 5 (build loop) | Learners see exactly how much of each chapter they've covered + mastered. |
| P-13 | Flashcard flip surface in both `LearningDueReview` + `LearningFlashcardStudy` is a real semantic button (role/tabIndex/aria-pressed/keyboard) | pass 6 (build loop) | Keyboard + screen reader users can flip cards. |
| P-14 | Quiz components support digit-key (1..N) selection + Enter to submit/advance | pass 6 (build loop) | Power-user + keyboard-first study sessions. |
| P-15 | Pure `studyStreak.ts` engine + `<StreakCard>` on LearningHome + `recordStudyNow()` in every review handler | pass 7 (build loop) | Habit formation feedback loop — learners see consecutive days + get an amber "save your streak" nudge when yesterday's session is the most recent. |
| P-16 | `searchContent` matches body text + practice questions; pure `searchRank.ts` 5-tier scorer + highlighter; `LearningSearch` page at /learning/search | pass 8 (build loop) | All 366+ imported definitions / flashcards / questions / tracks are discoverable by keyword, not just drill-down. |

## Gap matrix

Status: `open` · `in-progress` · `done`
Source: `assessment` (parallel audit process) · `build` (this loop's own
assessment step) · `external` (user or upstream process)

| ID | Title | Scope | Source | Status | Depth | Owner | Notes |
|---|---|---|---|---|---|---|---|
| G-1 | No cross-track due-review deck — learners can see `dueNow` count but have no UI to actually review mixed SRS items across tracks | learning | build | done | 6 | pass 1 | Landed pass 1; see `LearningDueReview.tsx` + `server/services/learning/dueReview.ts` |
| G-2 | `assessTrackReadiness` looks for itemKey prefix `track:${slug}:` but flashcard/quiz runners store keys as `flashcard:${id}` / `question:${id}` — readiness always returns 0 tracked | learning | build | done | 6 | pass 2 | Resolver now loads track→flashcards+questions, builds expected-key set, and matches mastery rows. Pure `computeReadiness` with 10 new tests. Legacy prefix still accepted so prior data isn't dropped. Shape also gained `totalItems` + `coverage`. |
| G-3 | Flashcard / quiz runners iterate entire deck — no session-size control (e.g. "review 10 cards") + no shuffle | learning | build | done | 6 | pass 3 | New pure `client/src/pages/learning/lib/deckBuilder.ts` (mulberry32 PRNG, Fisher-Yates shuffle, 3 modes: sequential / shuffle / weakest-first) + 32 unit tests. Wired into both `LearningFlashcardStudy` and `LearningQuizRunner` with a pre-session configure card (size 10/20/50/All, mode picker, mastery-aware "Weakest" mode disabled until user has prior history). |
| G-4 | LearningHome "Start review →" links to `tracks[0].slug/study` (first track alphabetically) — not to actual due items | learning | build | done | 6 | pass 1 | Now links to `/learning/review` |
| G-5 | Due-items hydrator has no agent-tool exposure — ReAct agent cannot start or describe a review session for the current user | learning | build | done | 4 | pass 2 | `start_review_session` tool added to `LEARNING_AGENT_TOOLS`, routed to `learning.mastery.dueReview`. Wiring test updated to 12-tool minimum. |
| G-6 | `embaImport` does not capture last-import-run metadata — admins cannot see when content was last pulled or what changed | learning | build | done | 6 | pass 4 | New `server/services/learning/importHistory.ts` persists every run to `.stewardly/learning_import_history.json` (50-entry ring buffer, defensive parser, pure summarizer). 19 unit tests + tmpdir round-trip. New `learning.importHistory` admin tRPC query. New `ImportHistoryPanel` in Content Studio with last-run / last-success / per-run delta + error samples. No schema migration. |
| G-7 | Track detail shows flashcard / question counts but not **chapter completion %** — no sense of where the learner is in the material | learning | build | done | 6 | pass 5 | New pure `client/src/pages/learning/lib/trackProgress.ts` (chapter bucketing, mastered/inProgress/unseen classification, completion + attempted percentages, completionStatus tier function). 21 unit tests covering empty inputs, bucketing edge cases, classification rules, totals integrity, percent rounding, status tiers, format helpers. New `<TrackProgressCard>` in `LearningTrackDetail` with track-level progress bar + per-chapter rows + unchaptered fallback. |
| G-8 | Pass 1-5 shipped components had no keyboard accessibility on the flashcard flip surface (clickable div, no role/tabIndex/keyboard handler) and no aria-labels on Progress bars / quiz answer feedback buttons | learning | build | done | 5 | pass 6 | Both `LearningDueReview` and `LearningFlashcardStudy` `FlashcardCard` components now use `role="button" tabIndex={0} aria-pressed aria-label` with Space/Enter handlers and visible focus ring; correct/incorrect buttons gained aria-labels; track + chapter Progress bars in `TrackProgressCard` carry aria-label with mastered/total counts; quiz components added digit-key (1..N) + Enter shortcuts with hint text. |
| G-9 | `LearningHome` docstring has promised "Mastery snapshot (overall pct, due now, streak)" since pass 58, but the streak half was never shipped. Zero habit-formation feedback loop for daily learners. | learning | build | done | 6 | pass 7 | New pure `client/src/pages/learning/lib/studyStreak.ts` (UTC-anchored day keys, 90-day ring buffer, markStudyDay idempotence, currentStreak with today-or-yesterday window, streakStatus 4-tier classification, defensive parser, localStorage I/O). 36 unit tests. `recordStudyNow()` called from every review handler in all 3 runners. New `<StreakCard>` in LearningHome with tone shifts (accent-active, amber-at-risk, muted-broken) + "Save your streak →" CTA. Grid goes from 3 → 4 columns. |
| G-10 | 366+ definitions imported from emba_modules have no search UI. The `learning.content.search` tRPC proc exists but nothing in the client calls it. Learners who know a term but not the track can't look it up. | learning | build | done | 6 | pass 8 | Extended `searchContent` server-side to match body text (definition body, flashcard body, track subtitle/description, question prompt/explanation) and include practice questions — previously only matched term/name. New pure `client/src/pages/learning/lib/searchRank.ts` with 5-tier relevance scoring (exact title → prefix → word prefix → title substring → snippet substring), type bias, grouping helper, pure highlighter. 23 unit tests. New `LearningSearch` page at `/learning/search` with 200ms-debounced query, grouped results (Definitions/Flashcards/Tracks/Questions), `<mark>`-highlighted matches, track-row deep-link to detail page. Search button added to LearningHome header. |

## Reconciliation log

_Conflicts resolved during merge of parallel process edits._

_(empty — first pass)_

## Known-Bad

_Dead ends. Do not re-attempt without new information._

_(empty — first pass)_

## Build Loop Pass Log

_One line per build-loop pass, newest at bottom. `angle · queue summary ·
commit SHA · items completed · items deferred`._

Pass 1 · angle: correctness + study pedagogy · queue: [G-1 cross-track due-review deck, G-4 Home "Start review" link target] · completed: G-1 G-4 (new `dueReview.ts` pure parser+selector, `LearningDueReview.tsx` mixed-deck session UI, `learning.mastery.dueReview` tRPC query, `/learning/review` route, LearningHome button now deep-links) · deferred: G-2 G-3 G-5 G-6 G-7 · tests: +23 dueReview → 88 learning tests green · build: ✓
Pass 2 · angle: correctness — agent readiness scoring & tool coverage · queue: [G-2 readiness resolver P0 bug, G-5 `start_review_session` agent tool] · completed: G-2 G-5 (rewrote `assessTrackReadiness` to resolve track→content→mastery, added pure `computeReadiness`, added `totalItems`+`coverage` to return shape, new `start_review_session` agent tool) · deferred: G-3 G-6 G-7 · tests: +10 computeReadiness → 98 learning tests green · build: ✓
Pass 3 · angle: study pedagogy — deck ordering + session size · queue: [G-3 no shuffle/no session size in flashcard+quiz runners] · completed: G-3 (new pure `client/src/pages/learning/lib/deckBuilder.ts` with mulberry32 PRNG + Fisher-Yates + 3 modes [sequential/shuffle/weakest], 32 unit tests, wired into both `LearningFlashcardStudy` + `LearningQuizRunner` with pre-session configure card; vitest config extended to include `client/src/pages/learning/lib/`) · deferred: G-6 G-7 · tests: +32 deckBuilder → 130 tests green across 9 files · build: ✓
Pass 4 · angle: observability + import resilience · queue: [G-6 import-run history persistence] · completed: G-6 (new `importHistory.ts` with 50-entry ring buffer, defensive parser, pure summarizer + tmpdir round-trip tests; `embaImport` calls `recordImportRun()` after every run; new admin `learning.importHistory` tRPC query; new `ImportHistoryPanel` in Content Studio with last-run / last-success / per-run inserts / error samples) · deferred: G-7 · tests: +19 importHistory → 149 tests green across 10 files · build: ✓
Pass 5 · angle: visibility — track + chapter progress · queue: [G-7 track detail no completion %] · completed: G-7 (new pure `client/src/pages/learning/lib/trackProgress.ts` with `buildTrackProgress` chapter bucketing + classification + percent rounding + completionStatus tiers; 21 unit tests; new `<TrackProgressCard>` in LearningTrackDetail showing track-level mastered/inProgress/unseen rollup + per-chapter rows with completion bars + unchaptered fallback bucket) · deferred: — (initial gap matrix complete; future passes will rotate to fresh angles) · tests: +21 trackProgress → 170 tests green across 11 files · build: ✓
Pass 6 · angle: accessibility (FRESH) · queue: [A1 flashcard flip surface is clickable div not button — fails WCAG 2.1.1; A2 Progress bars + quiz feedback buttons missing aria-labels] · completed: G-8 (FlashcardCard in `LearningDueReview` + `LearningFlashcardStudy` now `role="button" tabIndex={0} aria-pressed` with Space/Enter handlers + focus ring; correct/incorrect buttons + chapter/track Progress bars gained descriptive aria-labels; both quiz components added digit-key + Enter shortcuts with on-screen hint) · deferred: — · tests: 170 green (no test changes; pure UI a11y) · build: ✓
Pass 7 · angle: motivation + habit formation (FRESH) · queue: [A1 `LearningHome` docstring has promised streak since pass 58 but never shipped the UI half; A2 zero habit-formation signal for daily learners] · completed: G-9 (new `studyStreak.ts` with UTC-anchored day keys, 90-day ring cap, idempotent same-day markStudyDay, today-or-yesterday window on currentStreak, 4-tier streakStatus, defensive parser, localStorage I/O; 36 unit tests; `recordStudyNow()` wired into every review handler across `LearningDueReview`, `LearningFlashcardStudy`, `LearningQuizRunner`; new `<StreakCard>` on LearningHome with tone-aware paint + "Save your streak →" CTA) · deferred: — · tests: +36 studyStreak → 206 tests green across 12 files · build: ✓ (22.57s)
Pass 8 · angle: content discovery (FRESH) · queue: [A1 `learning.content.search` tRPC proc exists but has zero consumers in the client; A2 366+ emba_modules definitions unreachable by keyword] · completed: G-10 (extended `searchContent` server-side to match body text + practice questions; new pure `searchRank.ts` with 5-tier scoring + grouping + pure `highlightMatches`; 23 unit tests; new `LearningSearch` page at `/learning/search` with 200ms debounced query, grouped results sections, `<mark>` highlighted matches, tracks click-through to detail; Search button added to LearningHome header) · deferred: — · tests: +23 searchRank → 229 tests green across 13 files · build: ✓ (19.98s)
