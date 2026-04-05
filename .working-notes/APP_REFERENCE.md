# Stewardly (WealthBridge AI) — Full Application Reference

**Purpose:** Complete reference for any task that needs to test, debug, extend, or audit the running application. Contains production URLs, architecture, all routes, all tRPC endpoints, database schema summary, scheduled jobs, data pipelines, service inventory, and testing infrastructure.

---

## Production URLs

| Environment | URL |
|---|---|
| **Primary domain** | https://stewardly.manus.space |
| **Alternate domain** | https://wealthai-gakeferp.manus.space |
| **Dev server** | https://3000-i56xrkwo5g5ia35ca7ba6-5f602a9e.us1.manus.computer |

All three serve the same application. The dev server URL changes per sandbox session.

---

## Architecture Overview

| Layer | Technology |
|---|---|
| Frontend | React 19 + Tailwind CSS 4 + shadcn/ui + wouter (routing) |
| State/API | tRPC 11 + Superjson (end-to-end typed) |
| Backend | Express 4 + Node.js 22 |
| Database | MySQL/TiDB (via Drizzle ORM) |
| Auth | Manus OAuth + Google OAuth + LinkedIn OAuth + Email/Password |
| Storage | S3 (via `storagePut`/`storageGet` helpers) |
| AI | Built-in LLM (via `invokeLLM`), Edge TTS, Whisper transcription, Image generation |
| Scheduled Jobs | Custom scheduler (server/services/scheduler.ts + scheduledTasks.ts) |

---

## Environment Variables (25 total)

### Required (System-injected)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `VITE_APP_ID` | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend) |
| `OWNER_OPEN_ID` | Owner's Manus Open ID |
| `OWNER_NAME` | Owner's display name |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API base URL (server) |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for built-in APIs (server) |
| `VITE_FRONTEND_FORGE_API_URL` | Built-in API URL (frontend) |
| `VITE_FRONTEND_FORGE_API_KEY` | Bearer token for built-in APIs (frontend) |
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint URL |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID |
| `INTEGRATION_ENCRYPTION_KEY` | Encryption key for integration credentials |

### Optional (User-configured)

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth client secret |
| `PLAID_CLIENT_ID` | Plaid financial data API |
| `PLAID_SECRET` | Plaid API secret |
| `SNAPTRADE_CLIENT_ID` | SnapTrade brokerage connection |
| `SNAPTRADE_CONSUMER_KEY` | SnapTrade consumer key |
| `DAILY_API_KEY` | Daily.co video meetings |
| `DEEPGRAM_API_KEY` | Deepgram speech-to-text |
| `VITE_APP_TITLE` | App display title |
| `VITE_APP_LOGO` | App logo URL |

---

## User Roles & Access Hierarchy

| Role | Access Level | Visible Modes |
|---|---|---|
| `guest` | Anonymous browsing, chat (limited) | General only |
| `user` | Full personal features, documents, settings | General + Financial |
| `advisor` | + Client book, professional tools | + Client Advisor, Professional Coach |
| `manager` | + Team analytics, product shelf | + Manager Dashboard |
| `admin` | + Platform-wide settings, all data | All modes, Global Admin |

The `users` table has a `role` enum column. Promote via direct DB update or admin panel.

---

## Client Routes (50 total)

### Primary Pages (30)

| Route | Component | Auth Required |
|---|---|---|
| `/` | Landing | No |
| `/signin` | SignIn | No |
| `/welcome` | Welcome | No |
| `/terms` | Terms | No |
| `/privacy` | Privacy | No |
| `/chat` | Chat | No (guest mode) |
| `/chat/:id` | Chat (specific conversation) | No |
| `/calculators` | Calculators | No |
| `/products` | Products | No |
| `/settings` | SettingsHub (redirects to /settings/profile) | Yes |
| `/settings/:tab` | SettingsHub (12 tabs) | Yes |
| `/documents` | Documents (redirects to /settings/knowledge-base) | Yes |
| `/suitability` | Suitability (redirects to /settings/suitability) | Yes |
| `/ai-settings` | AI Settings (redirects to /settings/ai-tuning) | Yes |
| `/market-data` | MarketData | No |
| `/operations` | OperationsHub | Yes |
| `/intelligence-hub` | IntelligenceHub | Yes |
| `/advisory` | AdvisoryHub | Yes |
| `/relationships` | RelationshipsHub | Yes |
| `/integrations` | Integrations | Yes |
| `/integration-health` | IntegrationHealth | Yes |
| `/manager` | ManagerDashboard | Yes (manager+) |
| `/admin` | GlobalAdmin | Yes (admin) |
| `/portal` | Portal | Yes |
| `/organizations` | Organizations | Yes |
| `/org/:slug` | OrgLanding | No |
| `/org-branding` | OrgBrandingEditor | Yes |
| `/help` | Help | No |
| `/changelog` | Changelog | No |
| `/improvement` | ImprovementEngine | Yes |

### Settings Tabs (12)

| Tab Route | Component |
|---|---|
| `/settings/profile` | ProfileTab |
| `/settings/appearance` | AppearanceTab |
| `/settings/voice` | VoiceTab |
| `/settings/ai-tuning` | AITuningTab |
| `/settings/knowledge-base` | KnowledgeBaseTab |
| `/settings/suitability` | SuitabilityTab |
| `/settings/privacy-data` | PrivacyDataTab |
| `/settings/data-sharing` | DataSharingTab |
| `/settings/connected-accounts` | ConnectedAccountsTab |
| `/settings/notifications` | NotificationsTab |
| `/settings/shortcuts` | ShortcutsTab |
| `/settings/guest` | GuestPreferencesTab |

### Redirect Routes (20)

| From | To |
|---|---|
| `/study`, `/education`, `/coach`, `/planning`, `/insights`, `/student-loans`, `/equity-comp`, `/digital-assets` | `/chat` |
| `/agentic`, `/agent-operations`, `/licensed-review`, `/workflows`, `/compliance` | `/operations` |
| `/data-intelligence`, `/analytics-hub`, `/model-results`, `/intelligence` | `/intelligence-hub` |
| `/insurance-quotes`, `/estate-planning`, `/premium-finance`, `/marketplace` | `/advisory` |
| `/coi-network`, `/email-campaigns`, `/professionals`, `/meetings` | `/relationships` |

---

## tRPC Routers (50 routers, 169 procedures)

### Core Routers (in server/routers.ts)

| Router Key | Purpose | Procedure Count |
|---|---|---|
| `auth` | Login/logout/me | 3 |
| `system` | Notify owner, health | 2 |
| `chat` | AI chat with streaming | ~8 |
| `conversations` | CRUD conversations, search | ~6 |
| `documents` | Upload, list, delete, visibility | ~8 |
| `products` | Product catalog, comparison | ~5 |
| `suitability` | Assessment, profiles | ~5 |
| `review` | Human review queue | ~3 |
| `memories` | Memory extraction, management | ~4 |
| `feedback` | Thumbs up/down, quality | ~3 |
| `voice` | Edge TTS, transcription | ~3 |
| `settings` | Preferences, shortcuts, getShortcuts/saveShortcuts | ~8 |
| `calculators` | IUL, retirement, premium finance, comparator | ~6 |
| `market` | Market data, quotes, charts | ~5 |
| `visual` | AI image generation | ~2 |

### Extended Routers (in server/routers/*.ts)

| Router Key | Purpose |
|---|---|
| `organizations` | Multi-tenant org management |
| `emailAuth` | Email/password auth |
| `relationships` | Client-professional associations |
| `orgBranding` | Organization branding/theming |
| `aiLayers` | AI tuning, model weighting |
| `anonymousChat` | Guest chat without auth |
| `meetings` | Video meetings (Daily.co) |
| `insights` | Proactive AI insights |
| `compliance` | Compliance monitoring |
| `portal` | Professional portal |
| `featureFlags` | Feature flag management |
| `workflow` | Workflow engine |
| `matching` | Enrichment matching |
| `knowledgeGraph` | Knowledge graph queries |
| `education` | Financial literacy |
| `studentLoans` | Student loan analysis |
| `suitabilityEngine` | Advanced suitability |
| `modelEngine` | Statistical models |
| `propagation` | Event propagation |
| `fileProcessing` | File ingestion pipeline |
| `authEnrichment` | Auth provider enrichment |
| `notifications` | Push notifications |
| `reports` | Report generation |
| `exports` | Data export |
| `knowledgeBase` | Knowledge base management |
| `aiPlatform` | AI platform config |
| `operations` | Operations hub data |
| `addendum` | Addendum features (15+ sub-routers) |
| `maxScores` | Max scoring engine |
| `exponentialEngine` | Exponential onboarding |
| `selfDiscovery` | Self-discovery AI |
| `verification` | Professional verification |
| `dataSeed` | Data seeding |
| `productIntelligence` | Product intelligence |
| `adminIntelligence` | Admin intelligence dashboard |
| `passiveActions` | Passive action engine |

---

## Database (264 exports from schema, ~131 tables)

### Core Tables

| Table | Purpose |
|---|---|
| `users` | User accounts (role, email, name, avatarUrl) |
| `userPreferences` | Settings, customShortcuts (JSON), theme, voice |
| `userProfiles` | Extended profile (age, income, goals, life stage) |
| `conversations` | Chat conversations |
| `messages` | Chat messages (with streaming) |
| `documents` | Uploaded files (with visibility) |
| `documentChunks` | RAG chunks for retrieval |
| `products` | Financial products catalog |
| `suitabilityProfiles` | User suitability assessments |
| `calculatorScenarios` | Saved calculator scenarios |
| `auditTrail` | Full audit log |
| `consentTracking` | ToS/privacy consent records |

### Integration Tables

| Table | Purpose |
|---|---|
| `snapTradeUsers` | SnapTrade brokerage users |
| `snapTradeAccounts` | Connected brokerage accounts |
| `snapTradePositions` | Portfolio positions |
| `snapTradeBrokerageConnections` | Brokerage connection status |
| `dataSources` | External data source registry |
| `authProviderTokens` | OAuth tokens for Google/LinkedIn |

### Intelligence Tables

| Table | Purpose |
|---|---|
| `proactiveInsights` | AI-generated insights |
| `analyticalModels` | Statistical model definitions |
| `recommendationsLog` | AI recommendation history |
| `qualityRatings` | AI response quality scores |
| `promptVariants` | A/B test prompt variants |
| `contextAssemblyLog` | Deep context assembly audit |

### Compliance Tables

| Table | Purpose |
|---|---|
| `complianceAudit` | Compliance check results |
| `complianceReviews` | Human review queue |
| `compliancePredictions` | Predictive compliance |
| `regulatoryAlerts` | Regulatory update alerts |
| `disclaimerVersions` | Dynamic disclaimer versions |

---

## Scheduled Jobs

### Scheduler (server/services/scheduler.ts)

| Job Name | Interval | Purpose |
|---|---|---|
| `health_checks` | 15 min | Integration health monitoring |
| `data_pipelines` | 6 hours | Government data pipeline fetches |
| `stale_cleanup` | 24 hours | Stale data cleanup |
| `role_elevation_revoke` | 5 min | Auto-revoke expired role elevations |

### Scheduled Tasks (server/services/scheduledTasks.ts)

| Task Name | Interval | Purpose |
|---|---|---|
| `suitability-decay` | 24 hours | Suitability score decay |
| `propagation-delivery` | 5 min | Event propagation delivery |
| `propagation-cleanup` | 1 hour | Propagation cleanup |
| `model-schedules` | 15 min | Model schedule execution |
| `coaching-generation` | 6 hours | AI coaching message generation |
| `platform-data-pipelines` | 24 hours | Platform-level data pipelines |
| `token-refresh` | 24 hours | OAuth token refresh |

---

## Data Pipelines (6 active)

| Pipeline | Source | Records/Run | Typical Duration |
|---|---|---|---|
| BLS | Bureau of Labor Statistics | 16 | ~4s |
| FRED | Federal Reserve Economic Data | 15 | ~9s |
| BEA | Bureau of Economic Analysis | 8 | ~24s |
| Census | US Census Bureau | 14 | ~4s |
| SEC EDGAR | SEC Electronic Data | 25 | ~18s |
| FINRA BrokerCheck | FINRA Broker Data | 6 | ~8s |

Total: ~84 records per run, ~25s total duration. Runs every 6 hours.

---

## Service Inventory (107 service files)

### AI Services
`contextualLLM.ts`, `adaptivePrompts.ts`, `adaptiveContext.ts`, `deepContextAssembler.ts`, `exponentialEngine.ts`, `selfDiscovery.ts`, `predictiveInsights.ts`, `recommendation.ts`, `compliancePrediction.ts`, `meetingIntelligence.ts`, `multiModal.ts`, `knowledgeBase.ts`, `knowledgeGraphDynamic.ts`, `knowledgeIngestion.ts`, `productSuitability.ts`, `investmentIntelligence.ts`, `fairnessTesting.ts`

### Financial Services
`calculatorPersistence.ts`, `creditBureau.ts`, `iulMarketData.ts`, `nitrogenRisk.ts`, `ssaParameters.ts`, `taxParameters.ts`, `insuranceData.ts`, `adaptiveRateManagement.ts`, `estatePlanningKnowledge.ts`, `financialLiteracy.ts`

### Integration Services
`snapTrade.ts`, `plaidProduction.ts`, `crmSync.ts`, `crmAdapter.ts`, `socialOAuth.ts`, `providers.ts`, `integrationHealth.ts`, `integrationHooks.ts`, `webhookIngestion.ts`, `webhookReceiver.ts`, `seedIntegrations.ts`

### Compliance & Security
`compliancePrescreening.ts`, `regBIDocumentation.ts`, `regulatoryMonitor.ts`, `regulatoryImpact.ts`, `dynamicDisclaimers.ts`, `encryption.ts`, `keyRotation.ts`, `mfaService.ts`, `aiBoundaries.ts`

### Data & Processing
`dataIngestion.ts`, `dataIngestionEnhanced.ts`, `governmentDataPipelines.ts`, `platformPipelines.ts`, `fileProcessor.ts`, `documentExtractor.ts`, `documentTemplates.ts`, `searchEnhanced.ts`, `dataSeedOrchestrator.ts`

### Infrastructure
`scheduler.ts`, `scheduledTasks.ts`, `cronManager.ts`, `dbResilience.ts`, `infrastructureResilience.ts`, `llmFailover.ts`, `errorHandling.ts`, `loadTesting.ts`, `pipelineSelfTest.ts`, `canaryDeployment.ts`

---

## Test Infrastructure

### Test Files (70 files, 1,987 tests)

Run all tests:
```bash
cd /home/ubuntu/wealthbridge-ai && pnpm test
```

Run specific test:
```bash
pnpm test -- --run server/chat.test.ts
```

### TypeScript Check

```bash
cd /home/ubuntu/wealthbridge-ai && NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit
```

**Important:** The `--max-old-space-size=4096` flag is required due to the 131-table schema. Without it, tsc crashes with SIGABRT (exit code 134).

### Key Test Files by Feature Area

| Test File | Coverage Area |
|---|---|
| `chat.test.ts` | Core AI chat, streaming, modes |
| `comprehensive.test.ts` | End-to-end integration |
| `security.test.ts` | Auth, encryption, access control |
| `snapTrade.test.ts` | Brokerage integration |
| `data-pipelines.test.ts` | Government data pipelines |
| `integration-health.test.ts` | Integration monitoring |
| `suitabilityEngine.test.ts` | Suitability assessment |
| `exponentialEngine.test.ts` | Onboarding engine |
| `selfDiscovery.test.ts` | Self-discovery AI |
| `commandPaletteShortcutsChangelog.test.ts` | Command palette, shortcuts, changelog |
| `serverShortcutsRecentToast.test.ts` | Server-side shortcuts, recent pages |

---

## Key Components

| Component | Purpose |
|---|---|
| `AppShell.tsx` | Main layout with sidebar, G-then-X navigation, page tracking |
| `AIChatBox.tsx` | Full chat interface with streaming, markdown, voice |
| `CommandPalette.tsx` | Global Ctrl+K search (pages, actions, conversations, recent) |
| `KeyboardShortcuts.tsx` | "?" overlay with 18 shortcuts across 3 categories |
| `WhatsNewModal.tsx` | Changelog modal with localStorage version tracking |
| `DashboardLayout.tsx` | Dashboard layout with sidebar (for internal tools) |
| `SectionErrorBoundary.tsx` | Error boundary with query invalidation on retry |
| `GuidedTour.tsx` | AI-guided onboarding tour |
| `VoiceOrb.tsx` | Voice mode indicator/control |
| `ConsentGate.tsx` | ToS/Privacy consent flow |
| `NotificationBell.tsx` | In-app notifications |
| `AnalyticsDashboard.tsx` | Analytics visualization |

---

## Hooks

| Hook | Purpose |
|---|---|
| `useCustomShortcuts` | G-then-X shortcuts with server sync + localStorage fallback |
| `useRecentPages` | Track last 5 visited pages (useSyncExternalStore) |
| `useDebounce` | Debounce values for search |
| `useAuth` | Authentication state (from contexts/AuthContext) |

---

## Log Files

| File | Content |
|---|---|
| `.manus-logs/devserver.log` | Server startup, Vite HMR, Express warnings |
| `.manus-logs/browserConsole.log` | Client-side console.log/warn/error |
| `.manus-logs/networkRequests.log` | HTTP requests (fetch/XHR) |
| `.manus-logs/sessionReplay.log` | User interaction events |

Use `grep`/`tail` to read logs — do not use file read tool (files can be large).

---

## Quick Testing Checklist

1. **App loads:** Visit https://stewardly.manus.space — landing page renders
2. **Guest chat:** Navigate to /chat — can send messages without auth
3. **Auth flow:** Click sign in — Manus OAuth redirects and returns
4. **Command palette:** Press Ctrl+K — search across pages/actions
5. **Keyboard shortcuts:** Press ? — overlay shows 18 shortcuts
6. **Settings:** Navigate to /settings — 12 tabs render
7. **Market data:** Navigate to /market-data — data pipelines populate
8. **Operations:** Navigate to /operations — hub page renders
9. **Intelligence:** Navigate to /intelligence-hub — hub page renders
10. **All tests pass:** `pnpm test` — 1,987 tests across 70 files
11. **TypeScript clean:** `NODE_OPTIONS="--max-old-space-size=4096" npx tsc --noEmit` — exit code 0
