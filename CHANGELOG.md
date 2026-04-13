# Changelog

All notable changes to Stewardly AI are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **Email Campaigns page** (`/email-campaigns`) — full campaign management with AI content generation, recipient management, and analytics, wired to `emailCampaign` tRPC router
- Navigation entries for Email Campaigns in sidebar, command palette, and persona nav
- LeadDetail action buttons now functional (mailto: / tel: / Chat links)
- RelationshipsHub OutreachSection wired to live campaign data

### Fixed
- **Mobile responsive (learning mode selectors)**: LearningQuizRunner + LearningFlashcardStudy 3-col mode selector grids now 2-col on mobile (grid-cols-2 sm:grid-cols-3) to prevent button squeeze on 375px
- **UI honesty — 10 "coming soon" toast lies replaced with disabled buttons**:
  - WebhookManager: added HonestPlaceholder banner, disabled Add Endpoint + Retry buttons
  - AdvisorProfile: replaced 4 "coming soon" toast buttons/links with disabled + title attributes
  - LeadDetail: replaced 4 "coming soon" toast buttons with disabled + explanatory title
  - ImportData: replaced template download toast with disabled button
  - IncomeProjection: removed dead _totalMonthlyAtRetirement useMemo (wasted computation)
- **Server dead code removal (102 unused imports across 7 server files)**:
  - server/services/scheduler.ts: 10 dead imports cleaned (cron job stubs prefixed, result/duration vars removed)
  - server/services/cronManager.ts: 9 dead imports (integrationConnections/Providers, eq/and/sql/isNull/or, 2 duration vars)
  - server/routers/integrations.ts: 6 dead (webhookEvents, healthChecks, healthSummary, lte, encrypt, decrypt)
  - server/services/dataIngestionEnhanced.ts: 6 dead (sql, and, dataSources, ingestionJobs, webScrapeResults, scrapeSchedules)
  - server/services/platformPipelines.ts: 7+4 dead (syncLogs, connections, eq/and/sql, 3 dead SEC URL strings, errors array)
- **Server dead code removal (33 unused imports in 2 critical files)**:
  - server/routers.ts: removed 21 dead imports (db functions, prompts helpers, memoryEngine, knowledgeGraph, complianceCopilot, exponentialEngine, drizzle-orm) + 5 dead variables
  - server/routers/v4Features.ts: removed 12 dead imports (memoryEngine, knowledgeGraph, complianceCopilot, studentLoanOptimizer)
- **Navigate earcon on route change (G23 completion)**:
  - `useFocusOnRouteChange` now fires `playEarconById("navigate")` on every page transition
  - Skip on initial mount to avoid earcon on page load
  - Completes the full earcon suite: send + receive + error + navigate
- **Dead code removal (~120 unused imports across 50 files)**:
  - Chat.tsx: removed 14 dead imports (ScrollArea, Briefcase, Users, Fingerprint, Shield, Scale, OnboardingChecklist, Link, parseFocusModes, chatContainerRef, proficiencyQuery, toolsExpanded/adminExpanded state, focusLabel)
  - Removed unused proficiencyQuery that was hitting exponentialEngine.getProficiency on every empty chat render (wasted network call)
  - AppShell.tsx: removed dead navExpanded/adminExpanded sidebar state (vestigial from pre-PersonaSidebar5 era)
  - 15 page files: Help (13), Portal (10), Integrations (10), IncomeProjection (10), PlatformGuide (8), Community (8), Calculators (8), Workflows (7), ProductIntelligence (7), Organizations (7), ImprovementEngine (7), ImportData (7), ExamSimulator (6), TaxPlanning (6), RiskAssessment (6)
  - EmailCampaigns.tsx: removed 4 dead lucide imports
  - 28 component files cleaned (WealthProjectionChart, MessageList, StressTestPanel, ContextualHelp, ReasoningChain, LiveSession, CommandPalette, etc.)
- **Mobile responsive (ProfileTab.tsx)**: fixed min-w-[200px] → min-w-0 on memory input to prevent 375px overflow
- **PARITY.md accuracy**: marked 4 gap items as done that were implemented but never tracked (G16 voice palette command, G21 haptic feedback, G23 audio earcons, G48 selection styling)
- **Test accuracy**: updated popupQueueAndSidebar test to match PersonaSidebar5 reality (navExpanded state was correctly removed as dead code)
- **Accessibility (WCAG 2.1 Level A — icon-only button labels)**:
  - ChatInputBar.tsx: hands-free voice toggle gained aria-label
  - LiveSession.tsx: 3 icon buttons (mic/TTS/camera) replaced `title` with proper `aria-label`
- **Performance (staleTime on 10 queries across 6 pages)**:
  - Consensus weight presets (5min), PassiveActions 4 queries (30s-5min), AdvisorIntegrations providers (5min) + connections (1min), SuitabilityPanel (1-5min), ProductIntelligence strategies/avg (5min), Community posts (30s)
  - Prevents unnecessary refetch-on-mount for stable reference data
- **SEO metadata (7 pages gained SEOHead)**:
  - Welcome, OrgLanding (dynamic org name), NotFound, Unsubscribe, PlatformGuide
  - Learning: CaseStudySimulator, ConnectionMap
- **Dead code removal (6 unused imports across 4 files)**:
  - Chat.tsx: removed entire unused dropdown-menu import (8 components)
  - SettingsHub.tsx: removed unused Camera + Brain icons
  - Integrations.tsx: removed unused FileUp + ArrowUpDown + Minus icons
  - LearningHome.tsx: removed unused Briefcase icon
- **Error handling (9 mutations gained onError toast handlers)**:
  - DynamicIntegrations archive mutation
  - ImprovementEngine updateAction mutation
  - PrivacyDataTab consent grant + revoke mutations (2)
  - TeamBuilder rollUp/rollDown/economics/bieBackPlan mutations (4)
  - ReferenceHub backtest mutation
- **Mobile UX (10 fixes)**:
  - Chat popup menus (Add context + Focus) overflow on narrow viewports — added `max-w-[calc(100vw-2rem)]`
  - Chat voice interim text overflow on mobile — changed from fixed `max-w-[250px]` to responsive `max-w-[60vw] sm:max-w-[250px]`
  - Retirement calculator chart container missing `overflow-x-auto` for mobile scroll
  - StrategyComparison trajectory chart container missing `overflow-x-auto` for mobile scroll
- **Accessibility (WCAG 2.4.1 skip-to-content on ALL pages)**:
  - Added skip-to-content links to Welcome, SignIn, NewLanding, Terms, Privacy, OrgLanding
  - All 6 non-AppShell pages now have consistent sr-only → focus:visible skip links
- **Mobile UX (prior fixes)**:
  - ManusDialog overflow on mobile (400px hardcoded -> responsive)
  - VideoStreamingLayout sidebars overflow on mobile (now stack vertically)
  - CodeChat outline rail + file panel accessible on mobile (full-screen overlay)
  - AppShell bottom tab bar: Voice tab replaced with Menu tab for sidebar access
- **Cross-browser STT (G59 CRITICAL resolved)**:
  - PlatformIntelligence.tsx, LiveChatMode.tsx, LiveSession.tsx now use centralized `detectStt()` capability probe
  - Firefox users see clear "not supported" message instead of silent failure
  - Safari iOS respects `supportsContinuous` flag
- **Cross-app cohesion**:
  - CaseStudySimulator + ConnectionMap wrapped in AppShell (were dead-end pages)
  - FairnessTestDashboard 3x unprotected JSON.parse guarded with try-catch
  - CommandPalette missing Mail/Plug/Link icons added

## Prior History

The project has undergone 260+ recursive optimization passes. Key milestones:

### Visual Identity (Passes 96-102)
- Stewardship Gold design system: deep navy + warm gold (#D4A843)
- DM Serif Display + Plus Jakarta Sans typography
- Focus ring glow, card-lift hover effects, reduced-motion support

### Code Chat (Passes 201-261)
- Claude Code-style interface with ReAct loop, SSE streaming, inline editing
- 44 inspector tabs (diagnostics, tests, security, imports, TODOs, git, NPM, etc.)
- Plan mode, agent todos, workspace checkpoints, session management
- 1008 passing tests across 44 files

### Learning System (EMBA Integration)
- 30 learning tables, SRS scheduling, exam simulator, flashcard study
- Content imported from mwpenn94/emba_modules (366+ definitions)
- Case study simulator, achievement system, connection map

### Wealth Engine (Phases 1-7)
- UWE/BIE/HE/Monte Carlo calculators
- PDF reports, Edge TTS audio narration
- Multi-model consensus streaming
- 656 tests across 12 files

### Dynamic Integrations
- Blueprint-driven CRUD for any data source
- AI-assisted blueprint drafting
- 17-step declarative transform DSL
- SSRF guard, rate limiter, cron scheduler
- 149 tests

### Platform Intelligence Layer
- 5-layer config: platform -> organization -> manager -> professional -> user
- 23-model registry with task routing
- Autonomous processing with 5 foci
- Voice/TTS with Edge TTS, 25+ neural voices
- Memory engine with 6 categories
- URL hallucination guardrail

For detailed pass-by-pass history, see `docs/PARITY.md` Build Loop Pass Log sections.
