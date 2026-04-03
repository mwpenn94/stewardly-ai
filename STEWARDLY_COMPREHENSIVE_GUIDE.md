# Stewardly AI — Comprehensive Platform Guide

**Version:** 3.0 | **Date:** April 3, 2026 | **Status:** Production  
**Domains:** stewardly.manus.space, wealthai-gakeferp.manus.space

---

## 1. Executive Summary

Stewardly AI is a **Digital Financial Twin** platform that provides AI-powered financial intelligence, advisory capabilities, and operational tools for financial professionals and their clients. The platform combines conversational AI, multi-model intelligence, real-time market data, compliance automation, and relationship management into a unified experience.

The system is built on a modern TypeScript full-stack architecture with 197,000+ lines of code across 893 source files, 270 database tables, 51 tRPC API routers (860 procedures), and 2,162 automated tests. It serves four distinct user roles (user, advisor, manager, admin) with role-based access control governing navigation, features, and data visibility.

---

## 2. Platform Architecture

### 2.1 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | React | 19.2 | Component-based UI with concurrent features |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS with OKLCH color system |
| **Component Library** | shadcn/ui + Radix UI | Latest | 53 accessible, composable UI primitives |
| **Routing** | Wouter | 3.3 | Lightweight client-side routing |
| **State/Data** | TanStack Query + tRPC | 5.90 / 11.6 | End-to-end type-safe data fetching |
| **Server** | Express | 4.21 | HTTP server with middleware pipeline |
| **API Layer** | tRPC | 11.6 | Type-safe RPC with Superjson serialization |
| **ORM** | Drizzle ORM | 0.44 | Type-safe SQL with schema-first migrations |
| **Database** | MySQL / TiDB | 8.x | Relational storage with JSON column support |
| **Auth** | Manus OAuth + JWT (jose) | 6.1 | Session-based auth with cookie persistence |
| **Build** | Vite | 6.x | Fast HMR development and optimized production builds |
| **Testing** | Vitest | 2.1 | Fast unit and integration testing |
| **File Storage** | AWS S3 | SDK v3 | CDN-backed file and asset storage |
| **Charts** | Recharts + Chart.js | 2.15 / 5.x | Data visualization and analytics charts |

### 2.2 Codebase Metrics

| Metric | Count |
|--------|-------|
| Total lines of code | 200,000+ |
| Source files (non-test) | 920+ |
| Test files | 85 |
| Total tests | 2,250 (2,142 passing) |
| Database tables | 270 |
| tRPC routers | 57 (880+ procedures) |
| Frontend pages | 76 |
| Custom components | 43 (+ AccessibleChart) |
| UI primitives (shadcn) | 53 |
| Custom hooks | 17 |
| Server services | 116 |
| Router modules | 57 (+ main routers.ts) |
| Shared modules | 12 (intelligence, config, streaming, engine, guardrails, telemetry, events, tenant, MCP) |
| NPM dependencies | 88 |
| Dev dependencies | 28 |

### 2.3 Directory Structure

```
wealthbridge-ai/
├── client/
│   ├── public/              # favicon.ico, robots.txt only
│   ├── index.html           # Entry HTML with Google Fonts CDN
│   └── src/
│       ├── App.tsx           # Route definitions (221 lines)
│       ├── main.tsx          # Provider wiring
│       ├── index.css         # Design tokens (OKLCH)
│       ├── pages/            # 76 page components
│       │   ├── Chat.tsx      # Main chat interface (2,143 lines)
│       │   ├── Landing.tsx   # Public landing page
│       │   ├── Settings.tsx  # Settings hub
│       │   └── settings/     # 12 settings sub-tabs
│       ├── components/       # 42 custom + 53 shadcn/ui
│       │   ├── AppShell.tsx  # Sidebar layout wrapper
│       │   ├── AIChatBox.tsx # Chat message interface
│       │   └── ui/           # shadcn/ui primitives
│       ├── hooks/            # 16 custom hooks
│       ├── contexts/         # Theme + Notification contexts
│       └── lib/              # tRPC client, utils
├── server/
│   ├── _core/               # Framework plumbing (DO NOT EDIT)
│   │   ├── index.ts          # Express + CSP + middleware
│   │   ├── context.ts        # tRPC context builder
│   │   ├── trpc.ts           # Procedure definitions
│   │   ├── llm.ts            # LLM invocation helper
│   │   ├── notification.ts   # Owner notification
│   │   └── schemaValidation.ts # Startup schema validator
│   ├── routers.ts            # Main appRouter (1,875 lines)
│   ├── routers/              # 53 feature router modules
│   ├── services/             # 112 business logic services
│   ├── shared/               # Cross-cutting concerns
│   │   ├── engine/           # Improvement engine
│   │   ├── intelligence/     # Memory, context, LLM, ReAct
│   │   ├── streaming/        # SSE stream handler
│   │   ├── config/           # 5-layer AI config resolver
│   │   ├── guardrails/       # PII + injection screening
│   │   ├── telemetry/        # OpenTelemetry GenAI spans
│   │   ├── events/           # Typed event bus
│   │   └── tenantContext.ts  # Multi-tenant isolation
│   ├── db.ts                 # Query helpers (896 lines)
│   └── storage.ts            # S3 file storage
├── drizzle/
│   └── schema.ts             # 270 tables (5,206 lines)
├── shared/                   # Client-server shared types
└── migrations/               # SQL migration history
```

### 2.4 Request Flow

```
Browser → Vite Dev Server (HMR) → React App
    ↓
tRPC Client (Superjson) → /api/trpc/* → Express Middleware
    ↓
tRPC Context (JWT → user) → publicProcedure | protectedProcedure | adminProcedure
    ↓
Router Handler → Service Layer → Drizzle ORM → MySQL/TiDB
    ↓
Response (typed, serialized via Superjson) → React Query Cache → UI
```

---

## 3. Design System

### 3.1 Color Palette

The platform uses a **deep navy + sky blue** professional aesthetic with OKLCH color values for perceptual uniformity.

| Token | OKLCH Value | Hex Equivalent | Usage |
|-------|-------------|----------------|-------|
| `--background` | `oklch(0.13 0.025 255)` | ~#0F172A | Page background |
| `--foreground` | `oklch(0.93 0.008 255)` | ~#E8ECF4 | Primary text |
| `--card` | `oklch(0.17 0.028 255)` | ~#1A2340 | Card surfaces |
| `--primary` | `oklch(0.68 0.16 230)` | ~#0EA5E9 | Sky blue accent |
| `--secondary` | `oklch(0.21 0.028 255)` | ~#1E293B | Muted navy |
| `--muted` | `oklch(0.21 0.022 255)` | ~#1E2A3E | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.6 0.015 255)` | ~#8B9AB8 | Secondary text |
| `--destructive` | `oklch(0.62 0.22 15)` | ~#F43F5E | Error/danger (rose) |
| `--border` | `oklch(0.26 0.028 255)` | ~#2D3A52 | Borders |
| `--sidebar` | `oklch(0.11 0.022 255)` | ~#0B1120 | Deepest navy sidebar |
| `--chart-1` | `oklch(0.68 0.16 230)` | ~#0EA5E9 | Chart: sky blue |
| `--chart-2` | `oklch(0.65 0.17 160)` | ~#10B981 | Chart: emerald |
| `--chart-3` | `oklch(0.72 0.15 85)` | ~#F59E0B | Chart: amber |
| `--chart-4` | `oklch(0.62 0.22 15)` | ~#F43F5E | Chart: rose |
| `--chart-5` | `oklch(0.6 0.15 300)` | ~#8B5CF6 | Chart: purple |

### 3.2 Typography

| Element | Font Family | Weight | Size |
|---------|------------|--------|------|
| Headings (h1-h6) | Satoshi (via Fontshare CDN) | 700 | Responsive |
| Body text | DM Sans (Google Fonts) | 400/500 | 14-16px |
| Monospace/code | JetBrains Mono | 400 | 13px |

The font stack is defined in CSS custom properties:

```css
--font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
--font-heading: "Satoshi", "DM Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, monospace;
```

### 3.3 Spacing and Radius

The base border radius is `0.625rem` (10px), with derived values:

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small buttons, badges |
| `--radius-md` | 8px | Input fields, small cards |
| `--radius-lg` | 10px | Cards, dialogs |
| `--radius-xl` | 14px | Large containers |

### 3.4 Theme Configuration

The platform defaults to **dark mode** (deep navy). The `.dark` class is applied at the root level, and all semantic color tokens resolve to the dark palette. The `ThemeProvider` in `App.tsx` uses `defaultTheme="dark"`.

### 3.5 Component Design Patterns

All interactive components follow these conventions:

- **Cursor:** All clickable elements (buttons, links, checkboxes, selects) use `cursor-pointer` via the global CSS layer
- **Focus:** Visible focus rings using `outline-ring/50` for keyboard accessibility
- **Borders:** All elements use `border-border` for consistent edge treatment
- **Shadows:** Soft shadows preferred over hard borders for depth hierarchy
- **Motion:** Subtle transitions via `tw-animate-css` for micro-interactions

---

## 4. Navigation Architecture

### 4.1 Layout System

The application uses a two-layer layout system:

1. **AppShell** (`components/AppShell.tsx`): Wraps all authenticated pages with a collapsible sidebar, providing consistent navigation across the platform. Handles role-based menu filtering.

2. **Page Content**: Each page renders its own content area within the AppShell container.

### 4.2 Role-Based Navigation

The sidebar navigation adapts based on the user's role using a hierarchy system:

| Role | Level | Visible Navigation Items |
|------|-------|--------------------------|
| **user** | 0 | Chat, Operations, Intelligence, Advisory, Relationships, Market Data, Documents, Integrations, Passive Actions, My Progress, Settings, Help |
| **advisor** | 1 | All user items + Portal, Organizations, Integration Health, Improvement Engine |
| **manager** | 2 | All advisor items + Manager Dashboard |
| **admin** | 3 | All manager items + Global Admin |

### 4.3 Route Map

The application defines 45+ active routes and 20+ redirect routes for backward compatibility:

**Public Routes (no auth required):**

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Public marketing/landing page |
| `/signin` | SignIn | Authentication entry point |
| `/org/:slug` | OrgLanding | Organization-branded landing |
| `/welcome` | Welcome | Post-signup onboarding |
| `/terms` | Terms | Terms of service |
| `/privacy` | Privacy | Privacy policy |

**Authenticated Routes (require login):**

| Route | Page | Min Role | Description |
|-------|------|----------|-------------|
| `/chat` | Chat | user | Main AI conversation interface |
| `/chat/:id` | Chat | user | Specific conversation |
| `/operations` | OperationsHub | user | Workflow and task management |
| `/intelligence-hub` | IntelligenceHub | user | AI models, data sources, analytics |
| `/advisory` | AdvisoryHub | user | Product catalog, cases, recommendations |
| `/relationships` | RelationshipsHub | user | Client/professional network |
| `/market-data` | MarketData | user | Real-time market intelligence |
| `/integrations` | Integrations | user | Connected services management |
| `/settings/*` | SettingsHub | user | 12 settings sub-tabs |
| `/help` | Help | user | Documentation and support |
| `/portal` | Portal | advisor | Client management portal |
| `/organizations` | Organizations | advisor | Org management |
| `/manager` | ManagerDashboard | manager | Team performance dashboard |
| `/admin` | GlobalAdmin | admin | Platform administration |
| `/admin/intelligence` | AdminIntelligenceDashboard | admin | AI system monitoring |
| `/admin/fairness` | FairnessTestDashboard | admin | Bias testing dashboard |
| `/admin/knowledge` | KnowledgeAdmin | admin | Knowledge base management |

**Settings Sub-Routes:**

| Route | Tab | Description |
|-------|-----|-------------|
| `/settings/profile` | ProfileTab | Personal information |
| `/settings/appearance` | AppearanceTab | Theme and display |
| `/settings/ai-tuning` | AITuningTab | AI behavior preferences |
| `/settings/voice` | VoiceTab | Voice and TTS settings |
| `/settings/knowledge` | KnowledgeBaseTab | Personal knowledge base |
| `/settings/connected` | ConnectedAccountsTab | Linked accounts |
| `/settings/data-sharing` | DataSharingTab | Data sharing preferences |
| `/settings/privacy` | PrivacyDataTab | Privacy controls |
| `/settings/notifications` | NotificationsTab | Notification preferences |
| `/settings/shortcuts` | ShortcutsTab | Keyboard shortcuts |
| `/settings/suitability` | SuitabilityTab | Risk profile |
| `/settings/guest` | GuestPreferencesTab | Guest mode settings |

---

## 5. Core Features

### 5.1 AI Chat Engine

The chat system is the primary interface, implemented in `Chat.tsx` (2,143 lines). It provides:

- **Multi-model AI responses** with streaming via SSE (Server-Sent Events)
- **Conversation management** with folders, pinning, archiving, date-grouped sidebar, and search/filter
- **Date-grouped conversation sidebar** with Today, Yesterday, Previous 7 Days, Previous 30 Days, and Older categories
- **Empty conversation filtering** that hides zero-message conversations from the sidebar
- **Focus modes**: General, Financial, Insurance, Estate Planning, Premium Finance, and more
- **Voice input/output** via Web Speech API and TTS integration
- **Screen capture** for visual context sharing
- **Inline charts and visualizations** rendered within chat messages
- **Reasoning chains** showing the AI's thought process
- **Progressive message rendering** with markdown support via Streamdown
- **Keyboard shortcuts** for power users (customizable)

### 5.2 Intelligence Hub

Centralized AI and data management:

- **8 AI Models** configured with ensemble weighting
- **5+ Data Sources** including government pipelines (BLS, FRED, BEA, Census, SEC EDGAR)
- **Intelligence Feed** with automated insights (Portfolio Risk, Retirement Gap, Product Match)
- **Quick Actions**: Run Full Analysis, Morning Brief, Compare Products, Market Insights
- **Analytics** tab with model performance metrics

### 5.3 Advisory Hub

Product and case management for financial professionals:

- **Product Catalog** with categories: Life Insurance, Annuities, Estate Planning, Premium Finance, Investment Products, Marketplace
- **Case Management** for tracking client advisory workflows
- **Recommendation Engine** powered by suitability analysis
- **Carrier connections** for real-time product data

### 5.4 Operations Hub

Workflow and compliance automation:

- **Task Engine** with automated workflow orchestration
- **Compliance monitoring** with Reg BI documentation
- **Gate reviews** for premium finance approval workflows
- **Passive actions** for automated background processing

### 5.5 Relationships Hub

Client and professional network management:

- **Client profiles** with financial twin data
- **Professional directory** with COI (Center of Influence) network
- **Meeting intelligence** with transcription and analysis
- **Email campaigns** for client outreach

### 5.6 Market Data

Real-time financial intelligence:

- **Government data pipelines**: BLS (labor), FRED (economic), BEA (GDP), Census, SEC EDGAR
- **Premium finance rates** with SOFR-based calculations
- **IUL market data** and index performance
- **Investment intelligence** with risk analytics

### 5.7 Comprehensive Data Export

Full user data portability via the Settings page:

- **5 Selectable Sections**: Conversations, Profile, Documents, Settings, Audit Trail
- **ZIP Archive Generation** using the `archiver` library with maximum compression
- **S3 Upload** with presigned download URL for secure retrieval
- **Manifest File** included in every export with metadata (date, platform version, sections, file count)
- **Markdown-formatted conversations** with role labels (You / Steward) and message separators
- **Automatic download** triggered after successful export generation
- **Router**: `server/routers/exports.ts` — `exportsRouter.fullExport` procedure

### 5.8 UX Resilience Features

Platform-wide quality-of-life improvements:

- **Command Palette** (Ctrl+K / Cmd+K) with 25+ pages, 5 actions, and conversation search
- **Customizable Keyboard Shortcuts** with G-then-X navigation (10 routes), server-persisted via `user_preferences.customShortcuts`
- **What's New Changelog Modal** with version tracking via localStorage, delayed display (1.2s)
- **Route Prefetch on Hover** for 18 sidebar routes with deduplication
- **Section Error Boundaries** with retry counting, query invalidation, and "Refresh page" fallback
- **Offline/Reconnection Banner** with auto-dismiss on reconnect
- **Toast Notifications on Retry Exhaustion** with deduplication and manual retry button
- **Code Splitting** with React.lazy for 50+ pages (critical pages eagerly loaded)
- **Recently Visited Pages** tracked in command palette via `useSyncExternalStore`
- **Dedicated Changelog Page** at `/changelog` with timeline layout and category badges

---

## 6. Database Schema Architecture

### 6.1 Schema Organization

The 270 tables are organized into functional groups:

| Group | Tables | Description |
|-------|--------|-------------|
| **Core Identity** | users, user_profiles, user_organization_roles | User accounts and roles |
| **Organizations** | organizations, organization_relationships, org_landing_page_config | Multi-tenant org structure |
| **Conversations** | conversations, messages, conversation_folders | Chat history and organization |
| **AI Configuration** | platform_ai_settings, org_ai_settings, user_ai_preferences | 3-layer AI config |
| **Memory & Context** | memory_episodes, context_snapshots, reasoning_traces | AI memory system |
| **Advisory** | insurance_quotes, insurance_applications, estate_documents | Financial products |
| **Premium Finance** | premium_finance_cases, gate_reviews, premium_finance_rates | PF workflow |
| **Compliance** | compliance_events, reg_bi_documentation, fairness_test_results | Regulatory compliance |
| **Market Data** | market_data_cache, data_freshness_registry, rate_profiles | Financial data |
| **Integrations** | carrier_connections, data_sources, ingestion_jobs | External service connections |
| **Analytics** | user_platform_events, feature_usage_events, analytics_events | Usage tracking |
| **Self-Improvement** | improvement_signals, improvement_hypotheses, hypothesis_test_results | AI self-improvement |

### 6.2 Column Naming Convention

The database uses **camelCase** column names (e.g., `createdAt`, `userId`, `conversationId`). The Drizzle schema definitions must match this convention exactly. A startup schema validator runs on every server boot to detect mismatches.

**Important for developers:** When writing raw SQL queries, always use camelCase column names with backtick escaping:

```sql
-- Correct
SELECT `createdAt`, `userId` FROM `messages` WHERE `conversationId` = ?

-- Incorrect (will fail)
SELECT created_at, user_id FROM messages WHERE conversation_id = ?
```

### 6.3 AI Configuration Layers

The platform implements a 3-layer AI configuration system:

| Layer | Table | Scope | Managed By |
|-------|-------|-------|------------|
| Layer 1 | `platform_ai_settings` | Global platform defaults | Global Admin |
| Layer 2 | `org_ai_settings` | Organization overrides | Org Admin |
| Layer 3 | `user_ai_preferences` | Individual user preferences | End User |

Configuration resolves bottom-up: user preferences override org settings, which override platform defaults.

---

## 7. API Surface

### 7.1 tRPC Router Catalog

The `appRouter` exposes 95 sub-routers. Key routers include:

| Router | Procedures | Auth | Description |
|--------|-----------|------|-------------|
| `auth` | me, logout | public | Authentication state |
| `chat` | send, stream, history | protected | AI chat operations |
| `conversations` | list, create, update, delete, archive | protected | Conversation CRUD |
| `documents` | list, upload, extract, delete | protected | Document management |
| `products` | list, search, details, compare | protected | Product catalog |
| `suitability` | assess, update, results | protected | Risk profiling |
| `market` | quotes, rates, indices, economic | protected | Market data |
| `settings` | get, update, preferences | protected | User settings |
| `organizations` | list, create, members, invite | protected | Org management |
| `portal` | clients, cases, analytics | advisor+ | Professional portal |
| `compliance` | events, documentation, review | advisor+ | Compliance tools |
| `aiLayers` | platform, org, user configs | admin | AI configuration |
| `improvementEngine` | signals, hypotheses, tests | advisor+ | Self-improvement |
| `modelEngine` | run, results, compare | protected | Multi-model inference |
| `dataIngestion` | sources, jobs, records | protected | Data pipeline management |
| `verification` | badges, checks, status | protected | Data verification |

### 7.2 Procedure Types

| Type | Middleware | Use Case |
|------|-----------|----------|
| `publicProcedure` | None | Public endpoints (auth.me, landing data) |
| `protectedProcedure` | JWT validation, user injection | All authenticated operations |
| `adminProcedure` | JWT + role check (admin only) | Platform administration |

### 7.3 Streaming Pattern

AI responses use Server-Sent Events (SSE) via the shared `createSSEStreamHandler`:

```typescript
// Server: SSE stream handler
const stream = createSSEStreamHandler(res);
const llmResponse = await invokeLLM({ messages, stream: true });
for await (const chunk of llmResponse) {
  stream.write(chunk);
}
stream.end();

// Client: tRPC subscription or EventSource
const eventSource = new EventSource(`/api/trpc/chat.stream?input=...`);
eventSource.onmessage = (event) => {
  // Progressive rendering via Streamdown
};
```

---

## 8. Key Components Reference

### 8.1 Layout Components

| Component | File | Description |
|-----------|------|-------------|
| `AppShell` | `components/AppShell.tsx` | Sidebar navigation wrapper with role-based filtering |
| `DashboardLayout` | `components/DashboardLayout.tsx` | Alternative dashboard layout (not used in current nav) |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | React error boundary with fallback UI |
| `SectionErrorBoundary` | `components/SectionErrorBoundary.tsx` | Granular error isolation |
| `PageSuspenseFallback` | `components/PageSuspenseFallback.tsx` | Lazy-load skeleton |

### 8.2 Chat Components

| Component | File | Description |
|-----------|------|-------------|
| `AIChatBox` | `components/AIChatBox.tsx` | Full chat interface with streaming |
| `ChatInputBar` | `components/chat/ChatInputBar.tsx` | Message input with attachments |
| `ChatSidebar` | `components/chat/ChatSidebar.tsx` | Conversation list sidebar |
| `ConvItem` | `components/chat/ConvItem.tsx` | Individual conversation item |
| `MessageList` | `components/chat/MessageList.tsx` | Message thread renderer |
| `ProgressiveMessage` | `components/ProgressiveMessage.tsx` | Streaming message display |
| `ReasoningChain` | `components/ReasoningChain.tsx` | AI reasoning visualization |
| `RichResponses` | `components/RichResponses.tsx` | Structured response cards |

### 8.3 Feature Components

| Component | File | Description |
|-----------|------|-------------|
| `VoiceOrb` | `components/VoiceOrb.tsx` | Voice input visualization |
| `LiveChatMode` | `components/LiveChatMode.tsx` | Real-time voice conversation |
| `LiveSession` | `components/LiveSession.tsx` | Video/audio session management |
| `InlineChart` | `components/InlineChart.tsx` | In-message chart rendering |
| `PremiumFinanceRates` | `components/PremiumFinanceRates.tsx` | Rate display component |
| `VerificationBadges` | `components/VerificationBadges.tsx` | Data verification indicators |
| `CommandPalette` | `components/CommandPalette.tsx` | Cmd+K command palette |
| `AnalyticsDashboard` | `components/AnalyticsDashboard.tsx` | Usage analytics display |

### 8.4 Onboarding Components

| Component | File | Description |
|-----------|------|-------------|
| `AIOnboardingWidget` | `components/AIOnboardingWidget.tsx` | AI-guided onboarding |
| `OnboardingTour` | `components/OnboardingTour.tsx` | Step-by-step platform tour |
| `OnboardingChecklist` | `components/OnboardingChecklist.tsx` | Progress checklist |
| `GuidedTour` | `components/GuidedTour.tsx` | Interactive feature tour |
| `WhatsNewModal` | `components/WhatsNewModal.tsx` | Changelog/updates modal |
| `SelfDiscoveryBubble` | `components/SelfDiscoveryBubble.tsx` | AI self-discovery prompts |

### 8.5 Custom Hooks

| Hook | File | Description |
|------|------|-------------|
| `useVoiceRecognition` | `hooks/useVoiceRecognition.ts` | Web Speech API wrapper |
| `useTTS` | `hooks/useTTS.ts` | Text-to-speech playback |
| `useAnonymousChat` | `hooks/useAnonymousChat.ts` | Guest chat session |
| `useGuestPreferences` | `hooks/useGuestPreferences.ts` | Guest mode settings |
| `useCustomShortcuts` | `hooks/useCustomShortcuts.ts` | Keyboard shortcut manager |
| `useExponentialTracking` | `hooks/useExponentialTracking.ts` | Usage analytics tracking |
| `useSelfDiscovery` | `hooks/useSelfDiscovery.ts` | AI self-discovery state |
| `useWebSocket` | `hooks/useWebSocket.ts` | WebSocket connection |
| `useScreenCapture` | `hooks/useScreenCapture.ts` | Screen capture API |
| `useVideoCapture` | `hooks/useVideoCapture.ts` | Video recording |
| `useRecentPages` | `hooks/useRecentPages.ts` | Navigation history |
| `useDebounce` | `hooks/useDebounce.ts` | Input debouncing |
| `usePersistFn` | `hooks/usePersistFn.ts` | Stable function reference |
| `useComposition` | `hooks/useComposition.ts` | IME composition handling |
| `useMobile` | `hooks/useMobile.tsx` | Responsive breakpoint detection |
| `useGuestSession` | `hooks/useGuestSession.ts` | Guest session management |

---

## 9. Server Services Architecture

### 9.1 Service Categories

The 112 server services are organized into functional domains:

**AI & Intelligence (18 services):**
`contextualLLM`, `deepContextAssembler`, `memoryEngine`, `reactLoop`, `adaptiveContext`, `adaptivePrompts`, `modelEngine`, `multiModal`, `promptABTesting`, `capabilityModes`, `llmFailover`, `aiToolsRegistry`, `aiBoundaries`, `aiBadge`, `orgAiConfig`, `propagationEngine`, `statisticalModels`, `predictiveInsights`

**Data & Integration (16 services):**
`dataIngestion`, `dataIngestionEnhanced`, `scheduledIngestion`, `foundationLayer`, `governmentDataPipelines`, `platformPipelines`, `searchEnhanced`, `marketStreaming`, `investmentIntelligence`, `iulMarketData`, `creditBureau`, `snapTrade`, `plaidProduction`, `webhookIngestion`, `webhookReceiver`, `crmSync`

**Financial Domain (14 services):**
`insuranceData`, `productSuitability`, `suitabilityEngine`, `adaptiveRateManagement`, `calculatorPersistence`, `estatePlanningKnowledge`, `financialLiteracy`, `whatIfScenarios`, `medicareParameters`, `ssaParameters`, `taxParameters`, `nitrogenRisk`, `accountReconciliation`, `recommendation`

**Compliance & Security (10 services):**
`compliancePrediction`, `compliancePrescreening`, `regBIDocumentation`, `regulatoryImpact`, `regulatoryMonitor`, `dynamicDisclaimers`, `dynamicPermissions`, `fairnessTesting`, `encryption`, `keyRotation`, `mfaService`

**Infrastructure (12 services):**
`scheduler`, `cronManager`, `scheduledTasks`, `errorHandling`, `dbResilience`, `infrastructureResilience`, `loadTesting`, `pipelineSelfTest`, `canaryDeployment`, `retentionEnforcement`, `qualityNormalization`, `infrastructureDocs`

**User Experience (10 services):**
`exponentialEngine`, `selfDiscovery`, `roleOnboarding`, `commandPalette`, `passiveActions`, `accessibilityEngine`, `pwaOffline`, `websocketNotifications`, `fieldSharing`, `proactiveEscalation`

**Content & Communication (8 services):**
`knowledgeBase`, `knowledgeIngestion`, `knowledgeGraphDynamic`, `documentExtractor`, `documentTemplates`, `pdfGenerator`, `exportService`, `emailCampaign`

**Auth & Identity (7 services):**
`socialOAuth`, `googleAuth`, `linkedinAuth`, `emailAuth`, `postSignupEnrichment`, `profileMerger`, `apolloService`

### 9.2 Shared Intelligence Layer

The `server/shared/` directory contains cross-cutting AI capabilities:

| Module | Purpose |
|--------|---------|
| `intelligence/contextualLLM.ts` | Context-aware LLM invocation with memory |
| `intelligence/deepContextAssembler.ts` | Multi-source context assembly |
| `intelligence/memoryEngine.ts` | Episodic and semantic memory management |
| `intelligence/reactLoop.ts` | ReAct (Reasoning + Acting) loop for complex queries |
| `engine/improvementEngine.ts` | Self-improvement signal detection and hypothesis testing |
| `streaming/sseStreamHandler.ts` | Server-Sent Events streaming for real-time responses |
| `config/aiConfigResolver.ts` | 3-layer AI configuration resolution |

---

## 10. Authentication & Authorization

### 10.1 Auth Flow

1. User clicks "Sign In" → redirected to Manus OAuth portal
2. OAuth callback at `/api/oauth/callback` validates token
3. JWT session cookie set with user data
4. All subsequent requests include cookie → `ctx.user` populated
5. Role-based access enforced at procedure and UI levels

### 10.2 Social Auth Providers

| Provider | Status | Data Enrichment |
|----------|--------|-----------------|
| Manus OAuth | Active | Base identity |
| Google | Active | Phone, birthday, organizations |
| LinkedIn | Active | Headline, industry, profile URL |
| Email/Password | Active | Basic auth |

### 10.3 Role Hierarchy

```
admin (level 3) → Can access everything
  ↑
manager (level 2) → Team management + all advisor features
  ↑
advisor (level 1) → Professional tools + all user features
  ↑
user (level 0) → Consumer-facing features
```

---

## 11. Data Pipelines

### 11.1 Government Data Sources

| Pipeline | Source | Records | Frequency | Status |
|----------|--------|---------|-----------|--------|
| BLS | Bureau of Labor Statistics | ~16/run | Scheduled | Active |
| FRED | Federal Reserve Economic Data | ~15/run | Scheduled | Active |
| BEA | Bureau of Economic Analysis | ~8/run | Scheduled | Active |
| Census | US Census Bureau | ~14/run | Scheduled | Active |
| SEC EDGAR | Securities & Exchange Commission | ~20/run | Scheduled | Active |
| FINRA BrokerCheck | Financial Industry Regulatory Authority | Variable | Scheduled | Intermittent |

### 11.2 Scheduler Jobs

The platform runs automated background jobs via `server/services/scheduler.ts`:

- **Data pipeline execution** (government data refresh)
- **Empty conversation cleanup** (removes conversations with no messages older than 1 hour)
- **Stale session cleanup**
- **Data freshness monitoring**
- **Improvement signal detection**

---

## 12. Testing Strategy

### 12.1 Test Coverage

| Category | Files | Tests | Description |
|----------|-------|-------|-------------|
| Schema validation | 1 | 18 | Column alignment, missing tables, naming conventions |
| Platform integration | 1 | 50+ | Memory engine, AI config, context assembly |
| Consolidated Phase 3 | 1 | 30+ | SOFR rates, rate management, org providers |
| Data export & filtering | 1 | 23 | Export ZIP structure, sidebar date grouping, search |
| Feature routers | 77 | 2,000+ | Individual feature tests |
| **Total** | **81** | **2,162** | **All passing** |

### 12.2 Test Patterns

```typescript
// Standard test pattern
import { describe, it, expect } from "vitest";

describe("Feature Name", () => {
  it("should perform expected behavior", async () => {
    const result = await someFunction(input);
    expect(result).toMatchObject({ expected: "shape" });
  });

  // Network-dependent tests get extended timeouts
  it("should fetch external data", async () => {
    const data = await fetchExternalAPI();
    expect(data).toBeDefined();
  }, 15000); // 15s timeout for network calls
});
```

---

## 13. Deployment & Infrastructure

### 13.1 Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Server | MySQL/TiDB connection string |
| `JWT_SECRET` | Server | Session cookie signing |
| `VITE_APP_ID` | Client | Manus OAuth app ID |
| `OAUTH_SERVER_URL` | Server | OAuth backend URL |
| `BUILT_IN_FORGE_API_URL` | Server | Manus API hub URL |
| `BUILT_IN_FORGE_API_KEY` | Server | Manus API auth token |
| `PLAID_CLIENT_ID` | Server | Plaid financial data |
| `PLAID_SECRET` | Server | Plaid auth secret |
| `SNAPTRADE_CLIENT_ID` | Server | SnapTrade brokerage |
| `SNAPTRADE_CONSUMER_KEY` | Server | SnapTrade auth |
| `DEEPGRAM_API_KEY` | Server | Voice transcription |
| `DAILY_API_KEY` | Server | Video/audio sessions |
| `GOOGLE_CLIENT_ID` | Server | Google OAuth |
| `LINKEDIN_CLIENT_ID` | Server | LinkedIn OAuth |

### 13.2 Domains

| Domain | Type | Status |
|--------|------|--------|
| `stewardly.manus.space` | Custom subdomain | Active |
| `wealthai-gakeferp.manus.space` | Auto-generated | Active |

### 13.3 Schema Validation

On every server startup, the schema validator (`server/_core/schemaValidation.ts`) compares Drizzle schema definitions against the actual database, detecting:

- Missing tables
- Missing columns
- Column name mismatches (with camelCase awareness)

The validator reports issues in the server log and continues startup (non-blocking).

---

## 14. Known Limitations and Future Work

### 14.1 Current Limitations

- **FINRA BrokerCheck pipeline** intermittently fails due to external API rate limiting
- **TypeScript health check** occasionally reports false errors due to OOM kills during TSC compilation (the actual code compiles cleanly)
- **Consent banner** reappears on each page load (localStorage persistence not yet implemented)
- **Mobile sidebar** requires manual toggle; no swipe gesture support yet

### 14.2 Planned Improvements

- Implement consent banner persistence via localStorage
- Add swipe gesture for mobile sidebar toggle
- Implement WebSocket-based real-time notifications
- Add progressive web app (PWA) offline support
- Expand test coverage for UI components with React Testing Library
- Implement A/B testing framework for AI prompt optimization

---

## 15. Developer Quick Reference

### 15.1 Adding a New Feature

1. **Schema**: Add table to `drizzle/schema.ts` with camelCase column names
2. **Migration**: Run `pnpm drizzle-kit generate`, review SQL, apply via `webdev_execute_sql`
3. **DB Helper**: Add query function to `server/db.ts`
4. **Router**: Create procedure in `server/routers.ts` or `server/routers/<feature>.ts`
5. **UI**: Create page in `client/src/pages/<Feature>.tsx`
6. **Route**: Register in `client/src/App.tsx`
7. **Nav**: Add to `AppShell.tsx` navItems if sidebar entry needed
8. **Test**: Write Vitest specs in `server/<feature>.test.ts`

### 15.2 Common Patterns

```typescript
// Protected tRPC procedure
export const myFeatureRouter = router({
  getData: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return await getFeatureData(ctx.user.id, input.id);
    }),
  
  updateData: protectedProcedure
    .input(z.object({ id: z.number(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await updateFeatureData(ctx.user.id, input.id, input.value);
    }),
});

// Frontend consumption
function FeaturePage() {
  const { data, isLoading } = trpc.myFeature.getData.useQuery({ id: 1 });
  const updateMutation = trpc.myFeature.updateData.useMutation({
    onSuccess: () => {
      trpc.useUtils().myFeature.getData.invalidate();
    },
  });
  
  if (isLoading) return <Skeleton />;
  return <div>{data.value}</div>;
}
```

### 15.3 File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Pages | PascalCase | `AdvisoryHub.tsx` |
| Components | PascalCase | `VoiceOrb.tsx` |
| Hooks | camelCase with `use` prefix | `useVoiceRecognition.ts` |
| Services | camelCase | `adaptiveRateManagement.ts` |
| Routers | camelCase | `organizations.ts` |
| Tests | camelCase with `.test.ts` | `schemaMigration.test.ts` |
| DB columns | camelCase in SQL | `createdAt`, `userId` |
| DB tables | snake_case | `insurance_quotes` |

---

*This document is maintained as part of the Stewardly AI platform and should be updated whenever significant architectural changes are made.*
