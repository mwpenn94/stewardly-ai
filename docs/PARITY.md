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

## Gap matrix

Status: `open` · `in-progress` · `done`
Source: `assessment` (parallel audit process) · `build` (this loop's own
assessment step) · `external` (user or upstream process)

| ID | Title | Scope | Source | Status | Depth | Owner | Notes |
|---|---|---|---|---|---|---|---|
| G-1 | No cross-track due-review deck — learners can see `dueNow` count but have no UI to actually review mixed SRS items across tracks | learning | build | done | 6 | pass 1 | Landed pass 1; see `LearningDueReview.tsx` + `server/services/learning/dueReview.ts` |
| G-2 | `assessTrackReadiness` looks for itemKey prefix `track:${slug}:` but flashcard/quiz runners store keys as `flashcard:${id}` / `question:${id}` — readiness always returns 0 tracked | learning | build | done | 6 | pass 2 | Resolver now loads track→flashcards+questions, builds expected-key set, and matches mastery rows. Pure `computeReadiness` with 10 new tests. Legacy prefix still accepted so prior data isn't dropped. Shape also gained `totalItems` + `coverage`. |
| G-3 | Flashcard / quiz runners iterate entire deck — no session-size control (e.g. "review 10 cards") + no shuffle | learning | build | open | 0 | — | Position bias + no pedagogical caps. |
| G-4 | LearningHome "Start review →" links to `tracks[0].slug/study` (first track alphabetically) — not to actual due items | learning | build | done | 6 | pass 1 | Now links to `/learning/review` |
| G-5 | Due-items hydrator has no agent-tool exposure — ReAct agent cannot start or describe a review session for the current user | learning | build | done | 4 | pass 2 | `start_review_session` tool added to `LEARNING_AGENT_TOOLS`, routed to `learning.mastery.dueReview`. Wiring test updated to 12-tool minimum. |
| G-6 | `embaImport` does not capture last-import-run metadata — admins cannot see when content was last pulled or what changed | learning | build | open | 0 | — | A `learning_import_runs` table + `learning.importFromGitHub` returning summary. |
| G-7 | Track detail shows flashcard / question counts but not **chapter completion %** — no sense of where the learner is in the material | learning | build | open | 0 | — | Compute via mastery join grouped by chapter. |

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
