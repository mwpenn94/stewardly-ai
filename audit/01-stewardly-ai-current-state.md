# audit/01 — Stewardly AI Current State

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit | **Repo:** stewardly-ai (wealthbridge-ai)

---

## 1. Repository Metrics

| Metric | Value |
|--------|-------|
| Total server router files | 50+ tRPC routers |
| Total client pages | 222 |
| Total client components | 194 |
| Total test files | 527 |
| Total passes completed | 190 (Pass 1–162, with convergence sub-passes) |
| todo.md lines | 9,479 |
| Schema tables (drizzle) | 180+ |
| App routes (App.tsx) | 200+ |
| Package dependencies | 120+ |

---

## 2. Architecture Overview

### 2.1 Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Tailwind 4 + Vite + wouter |
| Backend | Express 4 + tRPC 11 + Drizzle ORM |
| Database | TiDB (MySQL-compatible) |
| Auth | Manus OAuth + JWT sessions |
| AI | Forge API (LLM) + Edge TTS + Whisper + Image Gen |
| Payments | Stripe (3-tier: Starter $49, Professional $149, Enterprise $499) |
| Storage | S3 via platform helpers |
| CRM | GoHighLevel (GHL) bidirectional sync |
| Data | FRED, BLS, BEA, Census, EDGAR, Polygon, Tiingo, FMP, GLEIF, OpenFIGI, Treasury |
| Integrations | Plaid, SnapTrade, Deepgram, Daily.co (video), LinkedIn, Google OAuth |

### 2.2 Five Engines (per Architecture Reference)

| Engine | Status | Key Surfaces |
|--------|--------|-------------|
| **Wealth Engine (PLANS)** | Mature — UWE/BIE/HE/SCUI calculators, 30+ tRPC procedures, Monte Carlo, PDF reports, Edge TTS narration, shareable links, WealthChat with 5 tools | `/wealth-engine`, `/calculators`, `/financial-twin`, `/tax-planning`, `/estate`, `/products` |
| **Learning Engine (LEARNING)** | Mature — FSRS-5 SRS, assessment sessions, CE credits, licensure, content CMS, freshness, recommendations, audio study with spaced repetition, social/collaborative features | `/learning/*` (20+ sub-routes) |
| **People Engine (PEOPLE)** | Mature — Lead pipeline, CRM sync (GHL), cadence engine (7 cadences), compliance (FINRA 2210/SEC), COI network, email campaigns, marketing assets, outreach automation | `/people/*`, `/leads`, `/crm-sync`, `/compliance-audit` |
| **Intelligence Engine** | Operational — Deep context assembler, contextual LLM, ReAct loop, web search, multi-modal processing (OCR, video transcription), knowledge base with ingestion pipeline | `/intelligence-hub`, `/data-pipelines` |
| **Continuous Improvement** | Operational — Improvement engine (signal detection, hypothesis generation, convergence checks, anti-regression), auto quality rater, platform self-assessment, improvement cycle runner | `/admin/improvement`, `/admin/improvement-engine` |

### 2.3 Substrate Primitives (per Architecture Reference §4)

| Primitive | Current Implementation Status |
|-----------|------------------------------|
| **chat-surface** | ✅ Implemented — Streaming chat with tier indicator, voice I/O, mobile-responsive, PersonaSidebar5 |
| **agentic-runtime** | ✅ Implemented — ReAct loop, agent instances, agent actions, checkpointing, OpenClaw orchestrator |
| **rag** | ⚠️ Partial — Knowledge base with search, but no vector embeddings; keyword-based retrieval only |
| **embeddings** | ❌ Not implemented — No embedding generation service in stewardly-ai (exists in manus-next-app) |
| **voice** | ✅ Implemented — Edge TTS (free neural voices), Whisper transcription, Deepgram integration, audio study |
| **document-intelligence** | ✅ Implemented — OCR, document extraction, multi-modal processing, file processing pipeline |
| **classifier** | ⚠️ Partial — PII/injection guardrails exist; no sensitivity classification (NPI/ePHI/Privileged/Operational); no tier routing gating |
| **proposal-generator** | ✅ Implemented — Improvement proposals, hypothesis generation, structured artifact output |

### 2.4 Shared Intelligence Layer

```
server/shared/
├── intelligence/
│   ├── contextualLLM.ts      — Platform-agnostic LLM with context injection
│   ├── deepContextAssembler.ts — Token-budgeted context assembly from registry
│   ├── reactLoop.ts          — ReAct multi-turn tool calling
│   ├── memoryEngine.ts       — Memory persistence layer
│   └── types.ts              — Shared types + normalizeQualityScore
├── engine/
│   └── improvementEngine.ts  — Signal detection, convergence, anti-regression
├── config/
│   ├── aiConfigResolver.ts   — 5-layer AI config resolution
│   ├── modelRegistry.ts      — Model catalog
│   └── types.ts              — Config types
├── guardrails/
│   ├── index.ts              — PII detection, injection screening
│   └── urlHallucination.ts   — URL hallucination detection
├── streaming/
│   └── sseStreamHandler.ts   — SSE streaming for chat
├── automation/
│   ├── webExtractor.ts       — Web content extraction
│   ├── webNavigator.ts       — Browser navigation
│   └── parallelFetch.ts      — Parallel HTTP fetching
├── calculators/              — UWE/BIE/HE/SCUI (656 tests)
└── stewardlyWiring.ts        — Re-exports for unified import
```

### 2.5 Navigation Architecture

PersonaSidebar5 implements role-based progressive disclosure:

| Layer | Min Role | Items |
|-------|----------|-------|
| Core | guest | Chat |
| Wealth | user | Wealth Engine (hub for all calculator/planning surfaces) |
| Professional | advisor | People (hub), Intelligence (hub) |
| Leadership | manager | Team, Organizations |
| Platform | admin | Admin (hub for all system surfaces) |
| Utility | all | Learn, Settings, Help |

### 2.6 Design System

- **Theme:** "Stewardship Gold" — deep navy base + warm gold accent (#D4A843 / oklch 0.76 0.14 80)
- **Fonts:** DM Serif Display (headings), Plus Jakarta Sans (body), JetBrains Mono (code)
- **Mode:** Dark by default, light mode available
- **Accessibility:** WCAG AA contrast verified (Pass 14 G46), keyboard shortcuts (g-chord navigation), aria-live announcements, skip links, focus management

### 2.7 Key Infrastructure

| Capability | Implementation |
|-----------|---------------|
| i18n | react-i18next + i18next-browser-languagedetector |
| Animation | framer-motion |
| Routing | wouter |
| State | React Query (via tRPC) + React contexts |
| Virtualization | @tanstack/react-virtual |
| Keyboard shortcuts | Custom useKeyboardShortcuts + useGChordNavigation |
| Notifications | NotificationContext + NotificationBell + ChangelogBell |
| Onboarding | OnboardingNotifications |
| Breadcrumbs | PageBreadcrumb component |
| Progressive disclosure | DisclosureContext (4 levels) |
| Pomodoro | PomodoroTimer component |
| MCP Server | Stewardly MCP Server (financial advisory tools) |

---

## 3. Test Coverage

- **527 test files** across server services, routers, and shared modules
- **Vitest** as test runner with node environment
- Key coverage areas: calculators (656 tests), learning services (15+ test files), improvement services, financial data, compliance, chat engine

---

## 4. External Integrations

| Integration | Type | Status |
|-------------|------|--------|
| GoHighLevel (GHL) | CRM webhook + outbound sync | ✅ Active |
| Plaid | Financial account linking | ✅ Active |
| SnapTrade | Brokerage connection | ✅ Active |
| Stripe | Payments (3 tiers) | ✅ Active |
| FRED API | Economic data (SOFR, rates) | ✅ Active |
| BLS API | Labor statistics | ✅ Active |
| BEA API | Economic analysis | ✅ Active |
| Census API | Demographic data | ✅ Active |
| EDGAR | SEC filings | ✅ Active |
| Daily.co | Video meetings | ✅ Active |
| Deepgram | Voice transcription | ✅ Active |
| LinkedIn OAuth | Social login | ✅ Active |
| Google OAuth | Social login | ✅ Active |
| Resend | Email delivery | ✅ Active |
| Edge TTS | Text-to-speech (free) | ✅ Active |

---

## 5. Deployment State

- **Live URL:** stewardly.manus.space (Manus hosting)
- **Dev server:** Port 3000 (Express + Vite bridge)
- **Database:** TiDB (MySQL-compatible, cloud-hosted)
- **Storage:** S3 (platform-provided)
- **Environment variables:** 35+ configured secrets

---

## 6. Known Gaps (vs. Architecture Reference)

1. **No vector embeddings** — RAG primitive relies on keyword search, not semantic similarity
2. **No sensitivity classifier** — Missing NPI/PII/ePHI/Privileged/Operational classification that gates tier routing
3. **No tier-aware routing** — No LOCAL/AUTO/CLOUD-ONLY routing based on classifier output
4. **No memory engine (M1-M8)** — The 8 personalization mechanisms from §10 are not implemented
5. **No cost-measurement criterion** — No M&V (measurement & verification) machinery for savings attribution
6. **No administrative spectrum** — No Phase 12 per-class automation positions (Manual → Supervised → Automatic)
7. **No BYO infrastructure** — No bring-your-own model setup flows, no single-button-press standard
8. **No conflict-of-interest architecture** — No principle test, no audit trail for recommendation logic
9. **manus-next-app capabilities not absorbed** — Search cascade, AEGIS, ATLAS, sovereign routing, client inference, connectors, data pipelines, memory with embeddings all remain in separate repo
10. **No tier indicators in UI** — Users cannot see which AI tier (LOCAL/AUTO/CLOUD) is handling their request
