# Learning Experience — PARITY Tracker

**Feature:** optimal learning experience
**Branch:** `claude/optimize-learning-experience-C7c8V`
**Started:** 2026-04-11

This doc tracks the recursive optimization of Stewardly's learning surface area.
It is the single source of truth for PASS_COUNT, dimension scores, completed
work, open gaps, and known-bad approaches — shared between every pass that
touches learning.

Read before every pass. Write after every pass. Three-way merge if a parallel
process has updated it.

## North Star

- **CORE_PURPOSE:** Give a financial-services learner the fastest, most
  durable path from "I opened Stewardly" to "I can pass my exam, keep my
  license current, and apply what I learned in real client work."
- **TARGET_USER:** Advisor / paraplanner / licensing candidate who studies in
  short bursts (5–20 min) on desktop AND mobile, needs SRS-level retention,
  and wants the system to tell them exactly what to do next — not a blank
  textbook.
- **SUCCESS_METRIC:** User returns daily, reviews all due SRS items within a
  session, and sees visible mastery-pct progress without having to plan the
  session themselves.

## Platform State (entry to Pass 1)

- 128 pages, 11 learning-specific pages (Home, TrackDetail, Flashcard, Quiz,
  Exam, DisciplineDeepDive, CaseStudy, Connections, Achievements, Licenses,
  ContentStudio)
- 47+ tRPC procedures under `learning.*` (mastery, licenses, content,
  freshness, recommendations)
- Full schema: 30 `learning_*` tables
- Seed + GitHub import from `mwpenn94/emba_modules` wired end-to-end
- Prior work (passes 58 / 155): TrackDetail reader, Flashcard SRS flow, Quiz
  SRS flow, CaseStudy added to Learning Tools grid. Celebration engine wired
  on ≥80% sessions.

## Dimension Scorecard (entry to Pass 1 — conservative baseline)

| Dimension | Score | Notes |
|---|---|---|
| Core Function | 6 | Real content + real SRS wired, but several entry points render empty ("No questions available") — Practice Exam, DisciplineDeepDive doesn't filter by slug |
| UI / Visual | 7 | Stewardship Gold applied, Progress bars + Trophy celebrations present |
| UX / Interaction | 5 | No keyboard shortcuts anywhere (flashcard flip, quiz A/B/C/D, exam Next); "Start review" button targets an arbitrary track's flashcards, not due items |
| Usability | 6 | Buttons lack keyboard shortcuts, mobile works but the flashcard flip is click-only, no Esc handlers |
| Digestibility | 6 | TrackDetail shows chapters → subsections well; no "you are here" indicator in long chapters |
| Delightfulness | 6 | Celebrations on completion exist but ONLY fire from full deck; no streaks-per-session |
| Flexibility | 7 | Recommendations algorithm is pure + testable; subrouters clean |
| Performance | 7 | Lazy-loaded pages, tRPC queries gated properly |
| Robustness | 6 | `recordReview` fire-and-forget — if DB is cold the UI happily marks correct/incorrect but nothing persists; errors toasted but UI still advances (acceptable) |
| Code Quality | 7 | Pure helpers (scheduleNextReview, fuseRecommendations) unit-tested |

**Composite:** 6.3 / 10 (conservative — 0.7 bias shave applied)

## Critical Gaps (Pass 1 Landscape findings)

| ID | Gap | Dimension | Severity |
|---|---|---|---|
| G1 | `/learning/exam/:moduleSlug` mounts `<ExamSimulator />` with NO props — empty question pool, always shows "No questions available" | Core Function | P0 |
| G2 | "Start review →" button in LearningHome links to `/learning/tracks/{firstTrack.slug}/study` — ignores the SRS due queue entirely | UX / Core Function | P0 |
| G3 | No keyboard navigation in Flashcard / Quiz / Exam runners. Space to flip, 1-9 to select, Enter to submit, → to advance are all missing | Usability / UX | P1 |
| G4 | DisciplineDeepDive uses `slug` param but fetches ALL definitions regardless of discipline — so the same content renders for every track | Core Function | P1 |
| G5 | Recommendations don't know which calculators the user has touched — `recentCalculators` param is always `[]` from the UI | Flexibility | P1 |
| G6 | `mastery.getDueItems` sorts `desc(nextDue)` so the FURTHEST-PAST due item comes last — should be `asc` (soonest first → oldest first) | Core Function | P2 |
| G7 | No "Resume where you left off" state in TrackDetail — each visit starts from chapter 1 | UX | P2 |
| G8 | No per-session streak indicator (consecutive correct) during a quiz or flashcard run — only final-screen celebration | Delightfulness | P2 |
| G9 | No audio content narration wired in the TrackDetail subsection reader even though AudioCompanion is available | Delightfulness | P3 |
| G10 | DisciplineDeepDive cases + FSApps are hardcoded mock data — not populated from DB | Core Function | P3 |

## Pass Log

### Pass 1 — Landscape + targeted Depth fixes (2026-04-11, Claude Code)
**Pass type:** Landscape
**Temperature in:** 0.5 (mid-stage, broad surface)
**Temperature out:** 0.40

**Addressed:** G1 (ExamSimulator DB wiring), G2 (due-review targeted session),
G3 (keyboard shortcuts on Flashcard + Quiz + Exam), G4 (DisciplineDeepDive
filtered by track slug → discipline), G5 (recent-calculators parameter threaded
from localStorage), G6 (getDueItems asc fix), G8 (streak indicator during
session).

Not yet addressed: G7, G9, G10 (deferred to future passes).

**Files changed:**
- `server/services/learning/mastery.ts` — `getDueItems` order fix + new
  `getDueItemsWithMeta` helper splitting flashcard vs question keys
- `server/routers/learning.ts` — new `learning.mastery.dueReview` procedure
  that returns a hydrated mix of flashcards + questions ready for a session
- `server/services/learning/recommendations.ts` — no logic change, but the
  procedure now reads from a new client-side localStorage key
- `client/src/pages/learning/LearningHome.tsx` — "Start review" now routes to
  `/learning/review` when `dueNow > 0`, falls back to first track otherwise;
  reads `stewardly.learning.recentCalculators` from localStorage and passes
  into `recommendations.forMe`; adds a subtle "review now" CTA pill
- `client/src/pages/learning/LearningReview.tsx` — NEW. Mixed SRS session
  page that pulls due items, interleaves flashcards + questions, tracks
  session streak, wires to `recordReview`, celebrates on completion
- `client/src/pages/learning/LearningFlashcardStudy.tsx` — keyboard
  shortcuts: Space to flip, 1/w to mark wrong, 2/r to mark right, Esc to exit,
  live streak indicator
- `client/src/pages/learning/LearningQuizRunner.tsx` — keyboard shortcuts:
  1–6 to select, Enter to submit, → to advance, Esc to exit, live streak
  indicator
- `client/src/pages/learning/ExamSimulator.tsx` — keyboard shortcuts A–F /
  1–6 to select options, Enter to submit/advance, Esc/End to finish, N/P for
  navigation
- `client/src/pages/learning/ExamSimulatorRoute.tsx` — NEW. Wrapper that
  reads `:moduleSlug` param, fetches track + questions from
  `learning.content.*`, converts them to the `Question` shape expected by
  `ExamSimulator`, renders mode picker, then mounts the component
- `client/src/pages/learning/DisciplineDeepDive.tsx` — resolves
  `slug` → `trackId` via `getTrackBySlug` and passes `trackId` into
  `listDefinitions` via a new `trackId` filter; definitions now scoped to the
  selected track
- `client/src/App.tsx` — new `/learning/review` route + `/learning/exam/:slug`
  uses `ExamSimulatorRoute` wrapper
- `shared/lib/recentCalculators.ts` — NEW. Pure helper reading/writing the
  `stewardly.learning.recentCalculators` localStorage ring buffer so multiple
  calculator pages can push without repeating code
- `server/services/learning/mastery.test.ts` — new tests for asc ordering
- `shared/lib/recentCalculators.test.ts` — pure-function tests for the ring
  buffer

**Dimension deltas (self-rated, conservative):**
- Core Function: 6 → 7.5 (ExamSimulator now actually works, DisciplineDeepDive
  filters correctly, due-review session exists)
- UX / Interaction: 5 → 7 (keyboard shortcuts + Start-Review routes to the
  right place + live streak)
- Usability: 6 → 7 (keyboard-first flows)
- Delightfulness: 6 → 6.5 (in-session streak indicator)
- Code Quality: 7 → 7 (new pure helpers with tests)

**Composite:** 6.3 → 7.0

**Build + test state (end of Pass 1):**
- TS check: 0 errors
- Build: clean in 19.31s
- Full suite: 3,798 passing / 113 env-dependent failing (unchanged baseline)
- New tests: +16 `recentCalculators` + 5 `parseItemKey` = 21 additional tests
- Learning services: 70 passing / 7 files (was 65 / 7)

**Known-bad approaches tried + discarded:**
- Tried `listDefinitions({ limit: 200 })` filter-by-disciplineId alone —
  insufficient because tracks are not a 1:1 map to disciplines. Resolved by
  adding a `trackId` filter that joins via the `flashcards`/`questions` table
  to derive which definitions are implicated (or, when track has no explicit
  link table, falls back to disciplineId via the track's declared discipline).
  Settled on: the track-slug resolves to the track row; the deep-dive shows
  definitions from the discipline implied by the track category OR, as a
  simpler and more correct implementation, shows definitions whose
  `disciplineId` matches the `disciplineId` of the track. This required a
  join through `discipline_id` on `learning_tracks`.

**Remaining / OPEN_ISSUES:**
- G7 Resume-where-you-left-off state (localStorage chapter cursor)
- G9 Audio narration of subsections in TrackDetail
- G10 Replace DisciplineDeepDive mock cases + FSApps with DB-backed data
- No progress indicator on the TrackDetail page showing which chapters are
  "read" vs "unread"

### Pass 2 — Depth (2026-04-11, Claude Code)
**Pass type:** Depth
**Temperature in:** 0.40
**Temperature out:** 0.32

**Addressed:** G7 (Resume-where-you-left-off in TrackDetail), G9 (Audio
narration of subsections in TrackDetail), NEW — per-track read progress
indicator on LearningHome track cards + per-chapter checkmark in
TrackDetail chapter list + read-progress bar on the track header.

Not yet addressed: G10 (dynamic cases/FSApps).

**Files changed:**
- `client/src/lib/trackReadState.ts` — NEW. Pure-function state machine
  + localStorage wrapper for per-track chapter read history. Exports
  `getTrackReadState` / `recordChapterRead` / `isChapterRead` /
  `chaptersReadCount` / `lastReadChapter` / `trackProgressPct` /
  `clearTrack`. Handles stringified track keys for numeric ids, deep
  validation of localStorage payloads, 200-chapter sanity cap, pure
  helpers fully unit-tested.
- `client/src/lib/trackReadState.test.ts` — NEW. 25 tests covering
  every pure helper + malformed-payload handling.
- `client/src/pages/learning/LearningTrackDetail.tsx` — reads read-state
  on mount, auto-expands the most-recently-read chapter as a "Resume"
  affordance, records every chapter click into localStorage via
  write-through, shows a progress bar once at least one chapter has
  been read, per-chapter green check icon + emerald border for read
  chapters. Subsections now include a Listen / Stop button per section
  powered by `useAudioCompanion` — tapping plays the full subsection
  narration through the existing AudioCompanion (Edge TTS with Web
  Speech fallback). Extracted a `SubsectionView` helper component so
  the narration state stays scoped per subsection.
- `client/src/pages/learning/LearningHome.tsx` — new `TrackCard` sub-
  component that fetches chapter count via `listChapters` (only when
  the track has at least one read chapter, gated on `enabled`) and
  renders a progress bar + "N of M chapters read" subtitle + a green
  `N%` badge on the card corner. Unread tracks render unchanged.
- `vitest.config.ts` — added `client/src/lib/trackReadState.test.ts` to
  the include list.

**Dimension deltas (self-rated, conservative):**
- Core Function: 7.5 → 7.5 (no change — Pass 2 is additive delight work)
- UI / Visual: 7 → 7.5 (progress bars + checkmarks make state visible)
- UX / Interaction: 7 → 8 (Resume where you left off — no more restarting
  from chapter 1 every session)
- Usability: 7 → 7.5 (audio narration opens the content to auditory
  learners + commuters)
- Digestibility: 6 → 7 (read-state badges let you see where you are at
  a glance across tracks)
- Delightfulness: 6.5 → 7.5 (audio narration + progress bars + check
  marks are pure delight adds)
- Flexibility: 7 → 7.5 (trackReadState is a reusable pure store)
- Code Quality: 7 → 7.5 (+25 unit tests, 0 regressions, clean TS)

**Composite:** 7.0 → 7.4

**Build + test state (end of Pass 2):**
- TS check: 0 errors
- Build: clean in 18.84s
- Full suite: 3,823 passing / 113 env-dependent failing (+25 new vs Pass 1)
- New tests: +25 `trackReadState` (total 46 new across both passes)

**Remaining / OPEN_ISSUES:**
- G10 Replace DisciplineDeepDive mock cases + FSApps with DB-backed data
  (deferred — the learning_cases / learning_fs_applications tables exist
  but no CRUD procedures are wired into the router and no content has
  been imported)
- No streak persistence across sessions (each new session's streak
  resets — intentional for now, tracked as a possible future-state
  feature)
- Adaptive review sessions have no "can I study ahead?" mode — today
  if nothing is due the Review page shows "all caught up" but doesn't
  let the user manually queue up tomorrow's items

## Reconciliation Log

(parallel passes write here if they conflict with a landing commit)

## Known-Bad Approaches (do not re-attempt)

- Passing `disciplineId` alone to filter definitions on DisciplineDeepDive —
  tracks are not strictly 1:1 with disciplines. Use `getTrackBySlug` →
  `track.category` → discipline mapping OR explicitly reference the track's
  `disciplineId` column if present.
- `<ExamSimulator />` with no props — pass a `config` + `questionPool` or
  wrap in a route component that does.
- Sorting `getDueItems` by `desc(nextDue)` — surfaces FUTURE items first.
- Fire-and-forget `recordReview` without a visible retry affordance — users
  lose progress on network hiccups. (Current: toast error, UI advances. Open
  question for a future pass: local queue + retry.)

## Re-entry Triggers

The optimization loop should re-open if any of these become true:

- User feedback says "I can't find the due items" or "the exam doesn't work"
- Success metric drops: mastery-pct progression stalls across a user cohort
- A new EMBA content release adds new content kinds (e.g., video) that need
  a viewer
- A new exam type (Series 63, Series 65, etc.) is requested
- Accessibility audit finds a WCAG 2.1 AA regression
