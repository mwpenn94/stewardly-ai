# EMBA Knowledge Integration — Stewardly Platform

**WealthBridge Financial Group · Mike Penn · April 2026**

This document describes how the EMBA Knowledge Explorer (licensure
training, SRS, knowledge graph) was merged into Stewardly's agentic
wealth platform. It is the authoritative reference for the
`learning.*` namespace, the dynamic content system, the licensure
lifecycle, and the content freshness pipeline.

## Overview

Stewardly already shipped a 5-layer agentic wealth platform (318
tables, 74 tRPC routers, ReAct agent, calculator engines). The EMBA
integration layers on:

1. **Training & licensure** — 12 exam tracks, SRS mastery, license
   lifecycle management, CE credits tracking.
2. **Dynamic content authoring** — users, advisors, and admins can
   CRUD definitions, tracks, chapters, questions, flashcards. All
   writes are versioned and audited.
3. **Regulatory pipeline** — feeds from FINRA, NASAA, CFP Board, IRS,
   NAIC trigger admin review before content updates propagate.
4. **Cross-system intelligence** — the ReAct agent now recommends
   study content based on calculator usage, licensure state, and SRS
   patterns.

Everything lives inside a single new namespace, `learning.*`, so the
existing 318-table / 74-router surface is untouched.

## File map

```
drizzle/schema.ts                           # 30 new learning_* tables
drizzle/0010_emba_learning.sql              # SQL migration
server/services/learning/
├── permissions.ts          Task 7B        # pure RBAC helpers (+ tests)
├── mastery.ts              Task 5C        # SRS + scheduleNextReview (+ tests)
├── licenses.ts             Task 1/5A      # licensure + CE + alert derivation (+ tests)
├── content.ts              Task 7A/7F     # content CRUD + search + audit
├── seed.ts                 Task 7E        # idempotent skeleton seed (disciplines + tracks)
├── embaImport.ts           Task 8 pass 54 # pulls full content from github.com/mwpenn94/emba_modules (+ tests)
├── freshness.ts            Task 3A-C      # regulatory pipeline (+ tests)
├── recommendations.ts      Task 5B/5C     # fused study recommendations (+ tests)
├── agentTools.ts           Task 2B/5D/7D  # ReAct tool registration
└── bootstrap.ts                           # server startup hook (seed + optional github import + tools)
server/routers/learning.ts   Task 2A/7C/8  # tRPC router (mastery, licenses, content, freshness, recs, seed, importFromGitHub)
client/src/pages/learning/
├── LearningHome.tsx             Task 4B/6D     # unified dashboard (role-aware)
├── LicenseTracker.tsx           Task 6D        # license grid + alerts + CE progress
├── ContentStudio.tsx            Task 6D-E/7    # advisor+ authoring hub + Import from GitHub
├── LearningTrackDetail.tsx      Task 9 pass 58 # track reader: chapters + subsections + counts
├── LearningFlashcardStudy.tsx   Task 9 pass 58 # flip-card study UI with SRS wiring
└── LearningQuizRunner.tsx       Task 9 pass 58 # multi-choice quiz with explanations + SRS
client/src/lib/navigation.ts                # 3 new nav entries (Learning/Licenses/Studio)
client/src/App.tsx                          # 7 new routes under /learning/*
```

## Task coverage

| Task | Deliverable | Location |
|---|---|---|
| 1A | 30 learning_* tables | `drizzle/schema.ts` end, `drizzle/0010_emba_learning.sql` |
| 1B | Auth mapping (FK to stewardly.users.id) | All learning_* tables use `user_id` column |
| 1C | JSON content layer | `services/learning/content.ts` + `freshness.ts` version tracking |
| 2A | Learning tRPC router | `server/routers/learning.ts` |
| 2B | ReAct agent tools registered | `services/learning/agentTools.ts` + startup bootstrap |
| 3A | Regulatory source catalog + ingestion | `services/learning/freshness.ts` (REGULATORY_SOURCES, recordRegulatoryUpdate) |
| 3B | Content source update pipeline | `onContentSourceUpdated` + checksum diff |
| 3C | EMBA knowledge data updates | same pipeline, parameterized by `contentSource` |
| 3D | Continuous improvement hooks | Quality scores on `learningAiQuizQuestions`, agent suggestion tools |
| 4A | Unified navigation | 3 new entries in `TOOLS_NAV` (Learning, Licenses, Content Studio advisor-only) |
| 4B | Unified home dashboard | `LearningHome.tsx` — role-aware snapshot + recommendations |
| 4C | Contextual cross-linking | `CALCULATOR_TRACK_MAP` in `recommendations.ts` |
| 4D | Component reuse | Tracks use shared shadcn components (Card, Progress, Badge) |
| 5A | Licensure lifecycle | `deriveLicenseAlerts` + weekly-ready logic |
| 5B | Calculator-informed recs | `fuseRecommendations` + CALCULATOR_TRACK_MAP |
| 5C | Adaptive study intelligence | `recommendStudyContent` fuses SRS + licenses + calc usage |
| 5D | AI chat extension (explain_concept / quiz_me / check_exam_readiness) | `agentTools.ts` registers these tools |
| 6A | Pages that move as-is | Routes reserved: `/learning/tracks/:slug`, `/learning/study`, `/learning/quiz` |
| 6B | Pages that merge | Dashboard + bookmarks + search consolidated |
| 6C | Pages that become sections | FS Toolkit → advisor widget (future) |
| 6D | New pages | `LearningHome.tsx`, `LicenseTracker.tsx`, `ContentStudio.tsx` |
| 6E | Content authoring components | Draft definition form + track browser in ContentStudio |
| 7A | Content schema (tracks/chapters/...) | 12 dynamic content tables in schema.ts |
| 7B | Permission model | `services/learning/permissions.ts` — canEditContent / canPublish / canSeedContent / canSeeContent |
| 7C | Content CRUD procedures | `learning.content.*` subrouter (list/get/create/update/archive/history) |
| 7D | AI authoring tools | `draft_definition`, `generate_flashcards`, `generate_practice_questions`, `suggest_content_improvements` |
| 7E | Initial skeleton seed | `services/learning/seed.ts` + `learning.seed` admin mutation — inserts 8 disciplines + 12 tracks (no definitions/chapters/questions; see Task 8) |
| 7F | DB-backed content service | `services/learning/content.ts` — search + history + explain |
| 8 (pass 54) | EMBA content import | `services/learning/embaImport.ts` — fetches `emba_data.json` + `tracks_data.json` from the public `mwpenn94/emba_modules` repo and hydrates definitions (366+), chapters, subsections, practice questions, and flashcards. Exposed as `learning.importFromGitHub` admin mutation + an "Import from GitHub" button in Content Studio. Optional `EMBA_IMPORT_ON_BOOT=true` pulls content on every server boot. Idempotent via slug/term/title dedup. 5 unit tests in `embaImport.test.ts`. |
| 9 (pass 58) | Learning consumer UIs | Three new pages under `client/src/pages/learning/` that finally give imported content a user-reachable home: **LearningTrackDetail** (chapter + subsection reader with lazy-loaded `content.listSubsections`), **LearningFlashcardStudy** (flip-card deck that wires correct/incorrect into `learning.mastery.recordReview` so the SRS 0-5 confidence ladder actually advances), and **LearningQuizRunner** (multiple-choice runner with answer highlight + explanation panel, same SRS wiring for `itemType: "question"`). Routes updated in `App.tsx`: `/learning/tracks/:slug`, `/learning/tracks/:slug/study`, `/learning/tracks/:slug/quiz`. |

## Database schema — new tables

All tables use the `learning_` prefix to avoid collision with the 318
existing Stewardly tables. User FKs reference `stewardly.users.id`.

**SRS / study** (5 tables)
- `learning_mastery_progress` — per-user per-item: confidence 0-5, nextDue, reviewCount
- `learning_study_sessions` — per-session analytics
- `learning_achievements` — unlocked achievements
- `learning_settings` — per-user key-value preferences
- `learning_ai_quiz_questions` — LLM-generated questions cached with qualityScore

**Groups & collaboration** (5 tables)
- `learning_study_groups`, `learning_group_members`, `learning_shared_quizzes`,
  `learning_quiz_challenges`, `learning_challenge_results`

**Bookmarks & playlists** (5 tables)
- `learning_bookmarks`, `learning_playlists`, `learning_playlist_items`,
  `learning_playlist_shares`, `learning_pending_invites`, `learning_discovery_history`

**Licensure & CE** (2 tables)
- `learning_licenses` — licenseType, state, expirationDate, ceCreditsRequired/Completed, ceDeadline, status
- `learning_ce_credits` — creditType, creditHours, providerName, courseTitle, verified

**Content freshness** (2 tables)
- `learning_content_versions` — contentSource, contentKey, version, checksum, changelog
- `learning_regulatory_updates` — source, category, affectedLicenses, status (new/reviewed/applied/dismissed)

**Dynamic content** (11 tables)
- `learning_disciplines`, `learning_definitions`, `learning_formulas`,
  `learning_cases`, `learning_fs_applications`, `learning_connections`,
  `learning_tracks`, `learning_chapters`, `learning_subsections`,
  `learning_practice_questions`, `learning_flashcards`
- `learning_content_history` — full audit trail (action, previousData, newData, changedBy)

**Total: 30 new tables** (Stewardly now ships 352 tables total — 351 schema definitions + `workflow_instances` added in pass 61.)

## Permission matrix (Task 7B)

| Role | Own | Team | Public / Platform |
|---|---|---|---|
| user | Full CRUD on rows they created | Read team-visible | Read published only |
| advisor | Full CRUD | Full CRUD + can publish | Read; suggest edits |
| manager | Full CRUD | Full CRUD + can publish | Read; suggest edits |
| admin | Full CRUD on anything | Full CRUD | Full CRUD including publish/archive/restore; admin-only: seed, bulk import, regulatory review |

See `server/services/learning/permissions.ts` for the canonical
implementation and `permissions.test.ts` for 14 unit tests covering
every matrix cell.

## ReAct agent tools (Task 2B + 5D + 7D)

Registered at server startup via `bootstrapLearning()`:

| Tool | Purpose | Maps to |
|---|---|---|
| `check_license_status` | License + CE alerts | `learning.licenses.alerts` |
| `recommend_study_content` | Prioritized study plan | `learning.recommendations.forMe` |
| `assess_readiness` | Track-level readiness score | `learning.mastery.assessReadiness` |
| `generate_study_plan` | Personalized plan for exam/CE | `learning.recommendations.forMe` |
| `explain_concept` | KB search + explanation | `learning.content.explain` |
| `quiz_me` | Interactive quiz generation | `learning.content.listQuestions` |
| `check_exam_readiness` | Alias for assess_readiness | `learning.mastery.assessReadiness` |
| `generate_flashcards` | Auto-draft flashcards (LLM) | `learning.content.createFlashcard` |
| `generate_practice_questions` | Auto-draft questions (LLM) | `learning.content.createQuestion` |
| `suggest_content_improvements` | Analyze quiz failures + outdated refs | `learning.freshness.pendingUpdates` |
| `draft_definition` | Draft a term + definition (LLM) | `learning.content.createDefinition` |

Registration is idempotent — existing tool rows (matched by
`toolName`) are skipped, so re-running bootstrap is safe.

## Regulatory pipeline (Task 3)

Sources monitored (see `REGULATORY_SOURCES` in `freshness.ts`):

- **FINRA** — affects SIE, Series 7, Series 66
- **NASAA** — affects Series 66
- **CFP Board** — affects CFP
- **IRS** — affects CFP, Financial Planning, Estate Planning
- **NAIC** — affects Life & Health, General Insurance, P&C, Surplus Lines
- **State DOI** — per-state insurance departments

Flow:

1. External fetcher (cron, not wired in this pass) ingests notices.
2. `recordRegulatoryUpdate()` writes to `learning_regulatory_updates` with `status='new'`.
3. Admin reviews via `learning.freshness.pendingUpdates` in the Content Studio.
4. Admin calls `learning.freshness.review` with decision `reviewed|applied|dismissed`.
5. If applied → content author edits source, runs `onContentSourceUpdated(source, key, rawContent)`.
6. Checksum diff detects change, bumps `learning_content_versions.version`, records changelog.
7. SRS items matching changed content keys are flagged for re-review (future wiring).

## Recommendations algorithm (Task 5C)

`fuseRecommendations` is pure; DB layer wraps it in
`recommendStudyContent`. Priority order:

1. **SRS items due** — highest (memory decay)
2. **CE credits needed** (<90 days to deadline)
3. **License expiration** (<90 days out)
4. **Calculator-informed** — `CALCULATOR_TRACK_MAP` cross-links
   recent calculator usage to weak tracks
5. **General broadening** — only if overall mastery < 40% and list
   is sparse

Caps at 6 recommendations per call so the Learning Home dashboard
stays scannable. See `recommendations.test.ts` (8 tests).

## Graceful degradation

Every learning service follows the same pattern as `weightPresets.ts`:
if `getDb()` returns null (test env, cold start, DB outage), reads
return empty arrays and writes become no-ops. The Learning Home
dashboard still renders with zero data, and the ReAct agent tools
return empty results rather than throwing.

## Testing

**44 new unit tests across 5 files** — all pass.

```
server/services/learning/permissions.test.ts      14 tests
server/services/learning/licenses.test.ts          8 tests
server/services/learning/mastery.test.ts           6 tests
server/services/learning/freshness.test.ts         8 tests
server/services/learning/recommendations.test.ts   8 tests
```

Full suite after integration: **118 test files, 3,066 / 3,180 tests passing (96.4%)**.
The 16 failing files are all pre-existing (DB-unavailable, wiring-verification on
pdfReportGenerator.ts) and unchanged by this work.

## Migration

Apply `drizzle/0010_emba_learning.sql` via `pnpm db:push` or the
admin migration script. All tables use `CREATE TABLE IF NOT EXISTS`,
so the migration is idempotent and safe to re-apply.

## Next steps (explicit non-goals for this integration)

The following items are intentionally deferred to a follow-up round:

- Track/chapter/subsection richtext editor UI (the database schema
  and tRPC CRUD are ready; the editor surface would need a
  dedicated WYSIWYG round).
- External regulatory fetcher cron job (storage + review workflow
  are wired; fetching requires per-source credentials and rate
  limits).
- Bulk CSV/JSON/DOCX import wizard (the `learning.content.*`
  procedures are sufficient for programmatic import).
- Full 27 EMBA React page migration (the 3 most critical
  consolidation pages ship in this round; the other 24 pages are
  simple to migrate once the data layer is proven).
- SRS flag-for-re-review on content change (hook is declared in
  freshness.ts but not yet wired to mastery table updates).

These are small incremental passes on top of the solid foundation
this integration establishes.
