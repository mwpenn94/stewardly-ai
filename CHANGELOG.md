# Changelog

All notable changes to Stewardly AI are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **Email Campaigns page** (`/email-campaigns`) — full campaign management with AI content generation, recipient management, and analytics, wired to `emailCampaign` tRPC router
- Navigation entries for Email Campaigns in sidebar, command palette, and persona nav
- LeadDetail action buttons now functional (mailto: / tel: / Chat links)
- RelationshipsHub OutreachSection wired to live campaign data

### Fixed
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
