# Stewardly AI — Architecture Reference

**Last updated**: April 14, 2026

---

## System Overview

Stewardly is a full-stack TypeScript application built on React 19 + Express 4 + tRPC 11 with Manus OAuth, TiDB (MySQL-compatible) database, and S3 file storage. The platform serves as an AI-powered digital financial twin for financial advisors and their clients.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui | UI framework and component library |
| Routing | wouter | Client-side routing (144 routes) |
| State | tRPC React Query | Server state management with type safety |
| Backend | Express 4, tRPC 11 | API server with end-to-end type safety |
| Database | TiDB (MySQL) via Drizzle ORM | Relational data storage |
| Auth | Manus OAuth | Authentication and session management |
| AI | Built-in LLM helpers (invokeLLM) | Multi-model AI with structured responses |
| Storage | S3 (storagePut/storageGet) | File and document storage |
| Voice | Deepgram + Edge TTS | Speech-to-text and text-to-speech |
| Unit Testing | Vitest | 7,716 tests across 320 files |
| E2E Testing | Playwright | 68 tests across 22 suites |

---

## Directory Structure

```
client/
  src/
    _core/            ← Auth hooks, providers
    components/       ← 50+ reusable components
      ui/             ← shadcn/ui primitives
      codeChat/       ← Code Chat sub-components
      learning/       ← Learning module components
      wealth-engine/  ← Calculator helpers and components
    contexts/         ← Theme, auth, preferences
    hooks/            ← 20+ custom hooks
    lib/              ← tRPC client, navigation config, utilities
    pages/            ← 100+ page components
      calculators/    ← PanelsA-F (28 calculator panels)
      learning/       ← Learning module pages
      settings/       ← Settings tab pages
      wealth-engine/  ← Wealth Engine hub and sub-pages
    App.tsx           ← Route definitions (144 routes)
    index.css         ← Global theme (Stewardship Gold)
    main.tsx          ← Providers and entry point

server/
  _core/              ← Framework plumbing (OAuth, context, LLM, maps)
  engines/            ← Pure computation engines (UWE, BIE, HE)
  routers/            ← Feature-specific tRPC routers
  services/           ← Business logic services
    learning/         ← Learning module services
  shared/             ← Shared streaming utilities
  db.ts               ← Database query helpers
  routers.ts          ← Main tRPC router (merges all sub-routers)
  prompts.ts          ← AI system prompt builder
  multiModel.ts       ← Multi-model synthesis engine

drizzle/
  schema.ts           ← Database schema (40+ tables)
  migrations/         ← SQL migration files

docs/                 ← Documentation (this directory)
shared/               ← Shared constants and types
```

---

## Key Architectural Patterns

### 1. Deep Context RAG

Every AI response passes through the `contextualLLM` wrapper, which assembles context from 15 data sources in parallel:

1. User documents (with TF-IDF relevance scoring)
2. Knowledge base entries
3. Financial profile and suitability data
4. AI memories (long-term user context)
5. Knowledge graph relationships
6. Pipeline data (active workflows)
7. Conversation history
8. Connected integrations (Plaid, SnapTrade, etc.)
9. Calculator results and scenarios
10. AI-generated insights
11. Client data (for advisors)
12. Activity log
13. Tags and categories
14. Gap feedback (areas needing improvement)
15. Regulatory sources (FINRA, NASAA, CFP Board, IRS)

### 2. Multi-Model Synthesis

The `multiModel.ts` engine supports querying multiple AI perspectives simultaneously:

- **queryMultiPerspective** — Sends the same query to 4 built-in perspectives (Conservative, Growth, Balanced, Tax-Optimized)
- **synthesizeResponses** — Merges multiple model responses into a unified answer with confidence scoring
- **crossModelVerify** — Validates claims across models to flag disagreements

### 3. Calculator Engine Architecture

The Wealth Engine uses a three-layer architecture:

| Layer | Files | Responsibility |
|-------|-------|---------------|
| Engine Core | `server/engines/*.ts` | Pure TypeScript computation (no I/O) |
| tRPC Router | `server/routers/calculatorEngine.ts` | 25 endpoints with Zod validation |
| React UI | `client/src/pages/calculators/PanelsA-F.tsx` | 28 calculator panels with visualization |

Calculators are organized into 7 navigation groups:

| Group | Panels | Calculators |
|-------|--------|-------------|
| Core Financial | PanelsA | Retirement, Cash Flow, Protection Scorecard |
| Tax & Estate | PanelsB | Tax Projection, Estate Planning, Education Funding |
| Advanced | PanelsC | Risk Assessment, Strategy Comparison, Insurance Needs, Scenario Comparison, Social Security |
| Premium | PanelsD | IUL Projection, Premium Finance, Monte Carlo, Financial Twin |
| Business | PanelsE | Engine Dashboard, Owner Compensation, Business Planning, Implementation Timeline, Partner Earnings, Practice Tracker |
| Income | PanelsF | Income Streams, Cross-Calculator Recommendations |
| Holistic | Shared | Holistic Scorecard (aggregates all calculator results) |

### 4. Persona-Based Navigation

The sidebar uses a 5-layer persona model defined in `PersonaSidebar5.tsx`:

| Layer | Section | Target User |
|-------|---------|-------------|
| 1 | People | All users — core communication tools |
| 2 | Clients | Advisors — client management and analysis |
| 3 | Tools | Power users — calculators, products, integrations |
| 4 | Learning | Continuous education — tracks, exams, flashcards |
| 5 | System | Settings and help |

### 5. Onboarding Flow

New users experience a three-stage onboarding:

1. **Spotlight Tour** (OnboardingTour.tsx) — 14-step guided walkthrough of key features
2. **Voice Onboarding Coach** (VoiceOnboardingCoach.tsx) — Audio-guided introduction (after tour completion)
3. **Suitability Assessment** — Financial profile questionnaire for personalization

---

## Database Schema Highlights

The database contains 40+ tables. Key entities:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with role (admin/user) |
| `conversations` | Chat conversation threads |
| `messages` | Individual chat messages with metadata |
| `documents` | Uploaded documents with S3 references |
| `document_chunks` | Chunked document content for RAG |
| `calculator_scenarios` | Saved calculator sessions |
| `suitability_profiles` | Financial profile assessments |
| `ai_memories` | Long-term AI memory entries |
| `knowledge_graph_nodes` | Knowledge graph entities |
| `knowledge_graph_edges` | Knowledge graph relationships |
| `model_presets` | Custom AI model configurations |
| `learning_tracks` | Educational content tracks |
| `onboarding_progress` | User onboarding completion state |
| `organization_landing_page_config` | White-label branding configuration |

---

## Organization Branding (White-Label)

The platform supports full white-label branding per organization:

| Component | File | Purpose |
|-----------|------|---------|
| Branding Editor | `OrgBrandingEditor.tsx` | 5-tab editor (Content, Colors, Fonts, Media, Advanced) with live preview |
| Landing Page | `OrgLanding.tsx` | Public branded page at `/org/:slug` with dynamic theming |
| Router | `orgBranding.ts` | tRPC CRUD for landing config + AI settings |
| Schema | `organization_landing_page_config` | 20+ fields: logo, 3-color palette, 12 fonts, hero image, 5 patterns, custom CSS, favicon |

CSS injection is sanitized to prevent XSS (strips HTML tags, `expression()`, `javascript:`, `data:` URIs, `@import`).

---

## Security and Compliance

- All API calls use tRPC with `protectedProcedure` for authenticated endpoints
- Zod validation on all inputs (2,562 validation rules)
- JWT session cookies with secure flags
- S3 storage with non-enumerable file keys
- Dynamic compliance disclaimers on all AI responses
- Reg BI documentation support
- Data encryption in transit and at rest
- CSS sanitization on user-provided custom styles (XSS prevention)

---

## Performance Characteristics

- **Lazy loading**: 106 components loaded on demand
- **Suspense boundaries**: 4 wrapper points in App.tsx
- **Error boundaries**: ErrorBoundary + SectionErrorBoundary on key routes
- **Optimistic updates**: Used for list operations, toggles, and profile edits
- **Memory management**: 31 interval/listener setups balanced by 35 cleanup handlers
- **SEO**: 214 meta tag patterns across pages

---

## Testing Architecture

### Unit Tests (Vitest)

The project maintains 7,716 unit tests across 320 test files covering server routers, database helpers, UI components, utility functions, and business logic. Tests run in under 60 seconds with Vitest's parallel execution.

### End-to-End Tests (Playwright)

68 Playwright E2E tests across 22 suites provide regression protection for all critical user journeys. Tests run against the live dev server using Chromium in headless mode.

| Suite | Coverage Area | Tests |
|-------|--------------|-------|
| Onboarding Tour | Tour display, step navigation, skip, consent | 3 |
| Sidebar Navigation | All 5 guest-visible nav items + Settings + Help | 7 |
| AI Chat | Greeting, action cards, input area, mode selector, new conversation | 5 |
| Code Chat | Page render, code input area | 2 |
| Wealth Engine | Hub sections, Quick Bundle, calculator panels, toolbar, navigation | 8 |
| Settings | Tab navigation, profile form, theme toggle | 3 |
| Learning | KPI cards, exam tracks, progress tracking | 3 |
| Help | Guide tab, FAQ search, architecture tab | 3 |
| Documents | Page render, upload area | 2 |
| Command Palette | Search trigger, result display | 2 |
| Financial Twin | Dashboard render, data sections | 2 |
| Products | Marketplace render, category filters | 2 |
| Workflows | Page render, workflow cards | 2 |
| Client Onboarding | Flow render, step navigation | 2 |
| Operations | Hub render, section cards | 2 |
| Mobile Responsive | Sidebar collapse, touch targets, viewport adaptation | 3 |
| Dark Theme | Color consistency, contrast ratios | 2 |
| Compliance | Footer disclosures, consent banner, detailed disclaimers | 4 |
| Accessibility | Heading hierarchy, ARIA labels, focus management | 3 |
| Landing/Public | Root page, terms, privacy, 404 handling | 4 |
| Integrations/Community/Changelog | Page renders without errors | 3 |
| Wealth Engine Sub-pages | Passive Actions, Insights, Suitability | 3 |

### Test Infrastructure

The E2E test framework uses a `setupPage` helper that pre-sets `localStorage` to bypass the onboarding tour overlay (z-index 10000), preventing it from blocking test interactions. Console error tracking filters known transient errors (HMR, WebSocket, rate limits). Rate limits are set to 100,000 requests per window in development mode to accommodate test parallelism.
