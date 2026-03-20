# Stewardry — Comprehensive Platform Guide

**Version:** 8.0 | **Updated:** March 20, 2026 | **Author:** Manus AI

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Design System and Visual Identity](#design-system-and-visual-identity)
4. [Authentication and Access Model](#authentication-and-access-model)
5. [Core AI Engine](#core-ai-engine)
6. [Chat Interface and Interaction Modes](#chat-interface-and-interaction-modes)
7. [Professional Directory and Referrals](#professional-directory-and-referrals)
8. [Data Sharing and Access Control](#data-sharing-and-access-control)
9. [Integration Pipeline](#integration-pipeline)
10. [AI Improvement Engine](#ai-improvement-engine)
11. [Contextual AI Insights](#contextual-ai-insights)
12. [Data Intelligence Hub](#data-intelligence-hub)
13. [Financial Tools and Calculators](#financial-tools-and-calculators)
14. [Product Marketplace](#product-marketplace)
15. [Compliance and Regulatory Framework](#compliance-and-regulatory-framework)
16. [Privacy and Data Governance](#privacy-and-data-governance)
17. [Communication and Campaigns](#communication-and-campaigns)
18. [Part G — Licensed Operations](#part-g--licensed-operations)
19. [Multi-Modal Capabilities](#multi-modal-capabilities)
20. [Search and Recommendations](#search-and-recommendations)
21. [Organization and Team Management](#organization-and-team-management)
22. [Workflow and Task Engine](#workflow-and-task-engine)
23. [Analytics and Reporting](#analytics-and-reporting)
24. [User Experience and Help System](#user-experience-and-help-system)
25. [Accessibility and Mobile Responsiveness](#accessibility-and-mobile-responsiveness)
26. [Navigation and Page Map](#navigation-and-page-map)
27. [API Reference](#api-reference)
28. [Database Schema](#database-schema)
29. [Test Coverage](#test-coverage)
30. [Feature Matrix](#feature-matrix)
31. [Deployment and Infrastructure](#deployment-and-infrastructure)
32. [Suitability Intelligence Engine](#suitability-intelligence-engine)
33. [Analytical Model Engine](#analytical-model-engine)
34. [Propagation and Coaching Engine](#propagation-and-coaching-engine)
35. [File Processing Pipeline](#file-processing-pipeline)
36. [Voice Settings Hierarchy](#voice-settings-hierarchy)
37. [Scheduled Tasks and Cron Jobs](#scheduled-tasks-and-cron-jobs)
38. [Known Limitations and Roadmap](#known-limitations-and-roadmap)
39. [Auth Enrichment and Multi-Provider Sign-In](#auth-enrichment-and-multi-provider-sign-in)
40. [Apollo.io Integration](#apolloio-integration)
41. [Post-Signup Enrichment Pipeline](#post-signup-enrichment-pipeline)
42. [Real-Time WebSocket Notifications](#real-time-websocket-notifications)

---

## Executive Summary

Stewardry is an AI-powered digital financial twin platform designed for financial advisors, insurance professionals, and wealth management firms. The platform combines conversational AI with real-time market data, comprehensive financial calculators, compliance automation, data intelligence pipelines, email campaign management, and multi-modal interaction into a unified experience. It is built to function as an always-available co-pilot for financial professionals — handling everything from client suitability assessments to estate document drafting, from premium finance modeling to autonomous agent orchestration.

The platform comprises **134 database tables** defined in the Drizzle ORM schema, **39 sub-routers** plus the main router exposing **430+ procedures**, **46 page-level components**, **25 reusable components** (plus 50+ shadcn/ui primitives), and **310+ source files** totaling approximately **82,000+ lines of TypeScript/TSX**. The automated test suite contains **671 tests** across **21 test files**, all passing. New in v8.0: Full statistical model implementations for all 8 analytical models (Monte Carlo retirement simulation, debt optimization with avalanche/snowball/hybrid strategies, tax optimization with bracket analysis, cash flow projection, insurance gap analysis, estate planning with trust strategies, education funding projection, and risk tolerance assessment), real-time WebSocket notifications via Socket.IO (notification bell with dropdown panel, toast alerts for high-priority events, per-user notification persistence, connection status indicators), server-side event emitters wired into the Propagation Engine and Model Engine for automatic notification delivery, and a comprehensive test suite covering all statistical models and notification infrastructure.

Stewardry operates on a tiered access model where anonymous guests receive full feature access with session-scoped data persistence, authenticated users get permanent data storage and cross-device sync, and administrators gain access to organization management and compliance oversight tools. The conversational AI interface serves as the primary entry point, following a design philosophy inspired by Claude, Copilot, and ChatGPT — prioritizing simplicity, intuitiveness, and streamlined interaction.

---

## Architecture Overview

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Tailwind CSS 4 | UI framework with utility-first styling and OKLCH color system |
| **State Management** | tRPC 11 + TanStack React Query | End-to-end type-safe API calls with automatic caching and optimistic updates |
| **Backend** | Express 4 + tRPC | HTTP server with RPC-style procedures and middleware pipeline |
| **Database** | MySQL/TiDB via Drizzle ORM | Relational storage with typed schema and migration management |
| **AI Engine** | LLM via Forge API | Multi-model AI with constitutional guardrails and structured output |
| **File Storage** | S3 (via `storagePut`/`storageGet`) | Document, image, and media storage with CDN delivery |
| **Authentication** | Manus OAuth + LinkedIn + Google + Email Magic Links + Guest Sessions | Multi-provider auth with profile enrichment and automatic session migration |
| **Real-time** | Socket.IO (WebSocket) | Bidirectional real-time notifications with automatic reconnection |
| **Voice** | Deepgram STT + Edge TTS (25+ voices) | Speech-to-text transcription and natural text-to-speech |
| **Maps** | Google Maps Proxy | Geocoding, directions, places, and visualization |
| **Charts** | Chart.js + react-chartjs-2 | Analytics and financial data visualizations |
| **UI Components** | shadcn/ui (50+ components) | Consistent, accessible component library |
| **Routing** | Wouter | Lightweight client-side routing |
| **Serialization** | SuperJSON | Preserves Date, BigInt, and other types across tRPC boundary |

### Codebase Metrics

| Metric | Value |
|--------|-------|
| Total source files | 302 |
| Total lines of code | 78,149 |
| Page components | 46 |
| Reusable components | 24 (+ 50+ shadcn/ui) |
| tRPC sub-routers | 38 |
| tRPC procedures | 420+ |
| Database tables (schema) | 134 |
| Router files (server/routers/) | 38 |
| Main router file (server/routers.ts) | 1,241 lines |
| Database helpers (server/db.ts) | 538 lines |
| Schema file (drizzle/schema.ts) | 2,497 lines |
| CSS theme file (index.css) | 248 lines |
| Test files | 20 |
| Automated tests | 614 |

### Data Flow

The platform follows a request-response pattern through tRPC procedures. Frontend components call typed hooks (`trpc.*.useQuery` / `trpc.*.useMutation`), which route through the Express server to tRPC context. Protected procedures validate the session JWT, inject `ctx.user`, and execute business logic against the database and external services. AI-powered features route through the Forge API with constitutional compliance checks applied at the procedure level.

For **data ingestion**, the flow is: External Source (web scrape, RSS, CSV, API, webhook) -> Data Ingestion Service -> Quality Scoring (0.0-1.0) -> Ingested Records -> AI Insight Generation -> Insight-to-Action Workflow -> Advisor Notifications.

For **email campaigns**, the flow is: Campaign Creation -> AI Content Generation -> Recipient Management -> Template Personalization -> Batch Sending -> Per-Recipient Status Tracking -> Campaign Analytics.

For **AI conversations**, the flow is: User Input (text/voice/image/document) -> 5-Layer Context Assembly (platform, org, professional, client, enrichment) -> Constitutional Compliance Check -> LLM Invocation -> Response Streaming -> Disclaimer Injection -> Memory Extraction -> Audit Logging.

---

## Design System and Visual Identity

### Theme and Color Palette

Stewardry uses a dark-first design system built on OKLCH color values in Tailwind CSS 4. The aesthetic is a deep navy base with sky blue accents, designed to convey professional financial intelligence.

| Token | OKLCH Value | Hex Equivalent | Usage |
|-------|------------|----------------|-------|
| `--background` | `oklch(0.13 0.025 255)` | ~#0F172A | Page background, deepest layer |
| `--foreground` | `oklch(0.93 0.008 255)` | ~#E8EDF5 | Primary text color |
| `--card` | `oklch(0.17 0.028 255)` | ~#1A2340 | Card surfaces, panels |
| `--primary` | `oklch(0.68 0.16 230)` | ~#0EA5E9 | Sky blue — primary actions, links, accents |
| `--secondary` | `oklch(0.21 0.028 255)` | ~#1E293B | Muted navy — secondary surfaces |
| `--destructive` | `oklch(0.62 0.22 15)` | ~#F43F5E | Rose — errors, destructive actions |
| `--sidebar` | `oklch(0.11 0.022 255)` | ~#0B1120 | Deepest navy — sidebar background |
| `--chart-1` | `oklch(0.68 0.16 230)` | ~#0EA5E9 | Sky blue chart series |
| `--chart-2` | `oklch(0.65 0.17 160)` | ~#10B981 | Emerald chart series |
| `--chart-3` | `oklch(0.72 0.15 85)` | ~#F59E0B | Amber chart series |
| `--chart-4` | `oklch(0.62 0.22 15)` | ~#F43F5E | Rose chart series |
| `--chart-5` | `oklch(0.6 0.15 300)` | ~#8B5CF6 | Purple chart series |

### Typography

The platform uses a three-font system loaded from Google Fonts CDN:

| Font | Variable | Usage |
|------|----------|-------|
| **Satoshi** | `--font-heading` | Headings (h1-h6), display text |
| **DM Sans** | `--font-sans` | Body text, UI labels, form inputs |
| **JetBrains Mono** | `--font-mono` | Code blocks, technical data |

### Button System

All interactive buttons follow WCAG 2.5.5 enhanced touch target guidelines (minimum 44x44 CSS pixels) [1], aligned with Apple Human Interface Guidelines [2] and Google Material Design [3] recommendations. The button component provides six size variants:

| Variant | CSS Size | Pixel Size | Use Case |
|---------|----------|------------|----------|
| `default` | `h-9 px-4 py-2` | 36px height | Standard text buttons |
| `sm` | `h-9 px-3` | 36px height | Compact text buttons |
| `lg` | `h-11 px-6` | 44px height | Large CTAs, primary actions |
| `icon` | `size-10` | 40x40px | Standard icon buttons (back, close, toggle) |
| `icon-sm` | `size-9` | 36x36px | Compact icon buttons (inline actions) |
| `icon-lg` | `size-11` | 44x44px | Large icon buttons (primary touch targets) |

Six visual variants are available: `default` (primary fill), `destructive` (rose fill), `outline` (transparent with border), `secondary` (muted fill), `ghost` (transparent, hover reveals), and `link` (underlined text).

### Border Radius

The platform uses a base radius of `0.625rem` (10px) with computed variants: `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (10px), and `--radius-xl` (14px).

---

## Authentication and Access Model

### Guest Session System

Anonymous visitors automatically receive a guest session when they first interact with the platform. The `/api/auth/guest-session` endpoint creates a temporary user record with `authTier: "anonymous"` and signs a 24-hour session JWT. This allows guests to use all features — chat, calculators, document uploads, market data — with data persisted in the database for the duration of their session.

A persistent **GuestBanner** appears at the top of the interface, encouraging sign-in to save data permanently. The banner highlights LinkedIn sign-in for professional profile enrichment. When a guest signs in via Manus OAuth, the `/api/auth/migrate-guest` endpoint transfers all guest data (conversations, documents, calculations) to the authenticated account.

### Multi-Provider Authentication (v7.0)

The platform supports four authentication providers, each contributing different profile data:

| Provider | Fields Provided | Confidence Level |
|----------|----------------|------------------|
| **LinkedIn** | Name, email, photo, employer, job title, industry, headline | Highest (95-100) |
| **Google** | Name, email, photo, phone, birthday, gender, address, organizations | High (85-95) |
| **Email (Magic Link)** | Email, employer inferred from domain | Medium (70-80) |
| **Manus OAuth** | Name, email, avatar | Base (60-70) |

The **Profile Merger** service resolves conflicts using a confidence hierarchy: LinkedIn data takes precedence over Google, which takes precedence over Email, which takes precedence over Manus OAuth. Each field is tracked with its source and confidence score, ensuring the most reliable data is always displayed.

The **Connected Accounts** settings tab displays all linked providers with a profile completeness meter, allowing users to connect additional providers to improve their profile quality.

### Access Tiers

| Tier | Capabilities | Data Retention |
|------|-------------|----------------|
| **Guest (Anonymous)** | All features, session-scoped data | 24 hours |
| **Authenticated User** | All features, permanent data, cross-device sync | Permanent |
| **Manager** | Team oversight, client portal, practice intelligence | Permanent |
| **Administrator** | Organization management, compliance review, global admin | Permanent |

### Page Access Rules

User-facing pages (Chat, Calculators, Products, Education, Insights, Meetings, Workflows, Documents, Settings/Appearance) are accessible to all users including guests. Admin-only pages (Global Admin, Manager Dashboard, Portal, Organizations) display an **AuthGate** component with a sign-in button and navigation links rather than performing a hard redirect. The AuthGate provides a clear explanation of why sign-in is required and offers navigation back to Chat and Home.

---

## Core AI Engine

### Conversational AI

The Chat interface is the primary entry point and default landing page for the platform. It supports three focus modes: **General** (broad topics), **Financial** (advisory-specific), and **Both** (hybrid). The AI processes text, voice, images, documents, and screen captures as input context.

The AI engine supports multi-turn conversations with full history retention, constitutional compliance checking on every response, automatic disclaimer insertion for financial advice, focus mode switching mid-conversation, voice mode with Deepgram STT and Edge TTS, document and image analysis via multi-modal processing, real-time market data integration into responses, and structured JSON output for calculators and data extraction.

### 5-Layer Context Assembly

Every AI response is assembled from a 5-layer prompt system, each layer auditable and respecting role-based visibility:

| Layer | Source | Content |
|-------|--------|---------|
| **Layer 1: Platform** | `platform_ai_settings` | Base personality, compliance rules, disclaimers |
| **Layer 2: Organization** | `organization_ai_settings` | Firm-specific policies, branding voice, custom rules |
| **Layer 3: Professional** | `professional_ai_settings` | Advisor specializations, certifications, preferences |
| **Layer 4: Client** | `manager_ai_settings` | Client-specific context, risk profiles, goals |
| **Layer 5: Enrichment** | `enrichment_datasets` | External data, market intelligence, research |

### AI Tuning and Personalization

Users can personalize their AI experience through the Settings page, which provides six tabs: **Avatar** (profile image upload), **Voice** (TTS voice selection from 25+ options across 6 locales), **Personalize** (communication style analysis and adaptation), **Memories** (AI-extracted facts, preferences, goals, and concerns), **Profile** (professional context and suitability status), and **AI Tuning** (formality, detail level, tone, and knowledge base management).

### Constitutional AI Framework

Every AI response passes through a constitutional compliance layer that flags potential financial advice for review, inserts appropriate disclaimers, maintains audit trails for regulatory compliance, enforces organization-level compliance policies, and supports custom compliance rules per organization. Constitutional violations are logged to the `constitutional_violations` table with severity, category, and remediation details.

### Memory System

The AI extracts and stores memories from conversations, categorized by type (preference, fact, goal, concern). Memory episodes group related memories with temporal context. Memories are injected into future conversations for personalization and continuity, and users can view, edit, and delete memories from the Settings page.

---

## Chat Interface and Interaction Modes

### Chat Layout

The chat interface follows a sidebar-plus-main-area layout inspired by Claude, Copilot, and ChatGPT. On desktop, a persistent sidebar displays conversation history, navigation tools, and admin links. On mobile, the sidebar collapses behind a hamburger menu button. The main area contains the message thread and input bar.

### Input Bar

The input bar is positioned at the bottom of the chat area and contains: a **plus button** for attachments and context sharing (documents, screen capture, camera), a **text input field** with auto-expanding height, an **audio toggle** for switching between text and voice input, a **mode selector pill** for switching between General/Financial/Both focus modes, and a **send button** that transforms into a stop button during streaming. All input bar buttons meet the 40-44px minimum touch target standard.

### Message Actions

Each AI response includes action buttons for: **copy** (copy response to clipboard), **thumbs up/down** (feedback logging), **read aloud** (TTS playback of the response), **regenerate** (request a new response), and **infographic** (generate a visual summary). All action buttons use 32px minimum touch targets with `p-2 w-4 h-4` icon sizing.

### Conversation Management

The sidebar provides: **New Conversation** button to start fresh, conversation history list with titles, conversation search, and role-based navigation sections (**Tools**, **Admin**). Conversations are persisted to the database with full message history, and guest conversations migrate to authenticated accounts upon sign-in.

### Voice Mode

Voice mode enables hands-free conversational interaction with continuous listening via Deepgram speech-to-text, natural speech responses via Edge TTS (25+ voices across 6 locales), automatic turn-taking with audible processing cues, and pause/resume controls. The **VoiceOrb** component provides visual feedback during listening and speaking states.

### LiveChat Mode

LiveChat Mode combines continuous visual and verbal AI interaction with simultaneous screen sharing and voice conversation, real-time frame analysis with spoken responses, and pause/resume controls for both video and audio streams.

---

## Professional Directory and Referrals

The Professional Directory (`/professionals`) enables users to find, connect with, and manage relationships with financial professionals across a **5-tier matching algorithm** that prioritizes the most relevant professionals for each user's needs.

### 5-Tier Matching Algorithm

| Tier | Priority | Description |
|------|----------|-------------|
| **Tier 1** | Highest | Existing relationships — professionals the user already works with |
| **Tier 2** | High | Organization-affiliated — professionals within the user's org |
| **Tier 3** | Medium | Specialty match — professionals whose specializations match the user's needs |
| **Tier 4** | Lower | Location match — professionals in the user's geographic area |
| **Tier 5** | General | Directory — all verified professionals in the system |

### Features

**Find a Professional.** Search by specialty, location, or name with tier-based results. The matching algorithm considers the user's financial profile, existing relationships, and organizational affiliations to rank results.

**My Professionals.** View and manage existing relationships with advisors, accountants, attorneys, insurance agents, tax preparers, estate planners, and mortgage brokers. Each relationship card shows the professional's credentials, specializations, and contact information.

**Reconnection.** If a user has previously worked with a professional, they can reconnect with one click. The system tracks historical relationships and surfaces them in Tier 1 results.

**Professional CRUD.** Online professionals can create and manage their profiles, including credentials, specializations, firm affiliation, location, bio, and contact information. Profiles can be marked as verified.

**Reviews.** Users can leave ratings and reviews for professionals they have worked with.

**Access Transitions.** When a user changes professionals (e.g., switches financial advisors), data access automatically transitions from the previous to the new professional, with full audit logging.

### Relationship Types

`advisor`, `accountant`, `attorney`, `insurance_agent`, `tax_preparer`, `estate_planner`, `mortgage_broker`, `other`

### Database Tables

`professionals`, `professionalRelationships`, `professionalReviews`, `professionalContext`, `professionalAISettings`

---

## Data Sharing and Access Control

The Data Sharing system (`Settings → Data Sharing`) provides fine-grained control over who can see what data. This ensures that a client's insurance professional cannot see what the client shared with their tax advisor, and vice versa.

### Topic Categories

`general`, `investments`, `insurance`, `tax`, `estate`, `retirement`, `banking`, `credit`, `real_estate`, `business`, `education`, `healthcare`

### Permission Levels

| Level | Description |
|-------|-------------|
| `none` | No access to data in this topic |
| `summary` | Can see aggregated summaries only |
| `read` | Can read full data |
| `full` | Can read and contribute data |

### Smart Defaults

When a user connects with a professional, the system automatically sets appropriate sharing defaults based on the professional's specialty:

| Professional Type | Full Access | Read Access | No Access |
|-------------------|-------------|-------------|-----------|
| **Financial Advisor** | investments, retirement, banking | tax, estate | insurance, healthcare |
| **Tax Preparer** | tax | investments, banking, business | insurance, estate |
| **Insurance Agent** | insurance | healthcare | investments, tax |
| **Estate Planner** | estate | investments, insurance | tax, banking |
| **Accountant** | tax, banking | investments, business | insurance, estate |

### Access Transitions

When a user changes professionals (e.g., switches financial advisors):

1. All permissions from the previous professional are revoked.
2. Smart defaults are applied for the new professional.
3. The transition is logged in `kb_access_transitions` for audit.
4. The user is notified of the change.

### Universal vs. Granular Sharing

Users can choose between **universal sharing** (one permission level for all topics with a professional) or **granular sharing** (per-topic permission levels for fine-tuned control). The default is granular with smart defaults applied.

### Database Tables

`kbSharingPermissions`, `kbSharingDefaults`, `kbAccessTransitions`

---

## Integration Pipeline

The Integration Pipeline (`/integrations`) connects Stewardry to **20+ external data sources** across 4 ownership tiers, with encrypted credential storage, field mapping, sync scheduling, and webhook event processing.

### Integration Providers

| Category | Providers | Default Tier |
|----------|-----------|-------------|
| **Account Aggregation** | Plaid, Yodlee, MX, Finicity | Client, Professional |
| **Government Data** | FRED, BLS, Census, SEC EDGAR, BEA | Platform |
| **Market Data** | Alpha Vantage, IEX Cloud, Polygon.io | Platform, Organization |
| **Insurance** | ACORD, Carrier APIs, Vertafore, Applied Epic | Professional, Organization |
| **CRM** | Salesforce, Wealthbox, Redtail, Orion | Professional, Organization |
| **Compliance** | FINRA BrokerCheck, SEC IAPD | Platform |
| **Tax** | Intuit ProConnect, Drake | Professional |

### Ownership Tiers

| Tier | Who Manages | Scope | Example |
|------|-------------|-------|---------|
| **Platform** | System admins | Global data available to all users | FRED interest rates, SEC filings |
| **Organization** | Org admins | Org-wide data | CRM, market data subscriptions |
| **Professional** | Individual professionals | Practice-level data | Client accounts, insurance carriers |
| **Client** | End users | Personal data | Bank accounts via Plaid, tax documents |

### Platform Pipelines

Automated data collection from government/public APIs runs on configurable schedules:

| Pipeline | Source | Data | Default Cadence |
|----------|--------|------|-----------------|
| **FRED** | Federal Reserve | Interest rates, inflation, GDP, unemployment | Daily |
| **BLS** | Bureau of Labor Statistics | Employment, CPI, wages, productivity | Daily |
| **Census** | US Census Bureau | Demographics, income, housing | Weekly |
| **SEC EDGAR** | Securities and Exchange Commission | Company filings, insider trading, financial statements | Daily |
| **BEA** | Bureau of Economic Analysis | GDP, personal income, trade balance | Daily |
| **FINRA** | Financial Industry Regulatory Authority | Broker/dealer compliance data | Weekly |

### Features

**Connection Management.** Connect, disconnect, and configure integrations per tier. Each connection stores encrypted credentials (AES-256-GCM), sync status, and error history.

**Sync Scheduling.** Automatic data sync with configurable cadence (hourly, daily, weekly). The cron manager tracks sync health and retries failed syncs.

**Field Mapping.** Map external data fields to internal schema with transforms (date parsing, currency conversion, phone E.164, percentage normalization, boolean coercion).

**Webhook Events.** Receive and process real-time webhook events from providers with HMAC-SHA256 signature verification.

**Data Enrichment.** Cross-reference and enrich data across multiple sources.

**Context Assembly.** Connected integration data is automatically assembled into the AI system prompt as an `<integration_data>` block, providing the AI with real-time financial context.

### Database Tables

`integrationProviders`, `integrationConnections`, `integrationSyncLogs`, `integrationFieldMappings`, `integrationWebhookEvents`, `enrichmentCache`, `enrichmentDatasets`

---

## AI Improvement Engine

The AI Improvement Engine (`/improvement`) continuously audits, recommends, and implements improvements across all 5 layers of the hierarchy in **3 audit directions**.

### 3 Audit Directions

| Direction | What It Measures | Example Finding |
|-----------|-----------------|----------------|
| **People Performance** | How well people at this layer serve users below | "Professional avg response time is 48hrs — recommend reducing to 24hrs" |
| **System/Infrastructure** | How well the system config supports users | "Organization has not configured compliance language — recommend setup" |
| **Usage Optimization** | How users can better leverage their tools | "You have not used the Financial Planning tool yet — it matches your retirement goal" |

### Per-Layer Audit Focus

| Layer | People Performance | System/Infrastructure | Usage Optimization |
|-------|-------------------|----------------------|-------------------|
| **Platform** | Cross-org service quality | Feature flags, global settings, uptime | Admin tool adoption |
| **Organization** | Team service metrics | Branding, compliance config, AI settings | Org tool utilization |
| **Manager** | Coaching effectiveness, review speed | Team config, escalation rules | Management dashboard usage |
| **Professional** | Client satisfaction, response times | Practice setup, carrier connections | Advisory tool adoption |
| **User** | N/A (bottom of hierarchy) | Profile completeness, preferences | Feature discovery, engagement |

### Action Types

| Type | Description | Auto-Implementable? |
|------|-------------|-------------------|
| `auto_config` | Configuration changes | Yes |
| `notification` | Alert/reminder to relevant party | Yes |
| `recommendation` | Suggested improvement | No — requires human review |
| `escalation` | Escalate to higher layer | No — requires human action |
| `training` | Training/education recommendation | No — requires human action |

### Improvement Workflow

1. **Audit.** The engine collects metrics and runs AI analysis per layer/direction.
2. **Recommend.** AI generates prioritized improvement actions with estimated impact scores.
3. **Implement or Direct.** Safe changes (config updates, notifications) are auto-implemented. Risky changes are surfaced for human review with clear instructions.
4. **Track.** All actions are logged with before/after metrics for impact measurement.
5. **Feedback.** Users can rate improvement actions (helpful/not helpful) to refine future recommendations.

### Database Tables

`layerAudits`, `layerMetrics`, `improvementActions`, `improvementFeedback`

---

## Contextual AI Insights

The Contextual AI Insights system ensures that audit-direction prompts in chat deliver **personalized, data-backed responses** rather than generic advice. When a user asks "What admin tools am I underutilizing?" the AI receives real-time data about that specific user's platform usage.

### How It Works

1. **Insight Collectors.** Per-layer collector functions in `server/insightCollectors.ts` gather real-time data:
   - **Platform layer:** Features available vs. used, config completeness percentage, active integrations count
   - **Organization layer:** Org membership, org tools enabled, compliance status, team size
   - **Manager layer:** Team activity, review queue depth, escalation count, coaching sessions
   - **Professional layer:** Client count, response times, feedback scores, tool adoption rate
   - **User layer:** Conversations count, features explored, profile completeness, documents uploaded, settings configured

2. **Caching.** Insights are cached in the `user_insights_cache` table with a **15-minute TTL** for active sessions. Cache is invalidated on significant user actions (new conversation, feature use, settings change).

3. **Injection.** The `buildInsightContext()` function assembles insights into a structured `<platform_insights>` block that is injected into the system prompt before the LLM call.

4. **Role-Aware Prompts.** The 4 suggested prompts on the chat WelcomeScreen are personalized by role:

| Role | Prompt 1 | Prompt 2 | Prompt 3 | Prompt 4 |
|------|----------|----------|----------|----------|
| **Admin** | People Performance audit | System/Infrastructure audit | Usage Optimization | General financial |
| **Manager** | Team performance review | Team config optimization | Management tool adoption | General financial |
| **Professional** | Client service quality | Practice setup optimization | Advisory tool adoption | General financial |
| **User/Client** | Usage optimization | General financial | General financial | General financial |

### Database Tables

`userInsightsCache`

---

## Data Intelligence Hub

The Data Intelligence Hub is the platform's central data ingestion and analysis engine, accessible at `/data-intelligence`. It provides **14 tabs** for managing data sources, processing pipelines, and AI-generated insights.

### Tabs Overview

| Tab | Purpose |
|-----|---------|
| **Sources** | Manage and monitor data source connections |
| **Bulk Ingest** | Batch URL scraping (up to 100 URLs per batch) |
| **Scraper** | Single-page web scraping with content extraction |
| **RSS Feeds** | Subscribe to RSS/Atom feeds with configurable polling |
| **Competitor Intel** | Competitive intelligence monitoring and analysis |
| **Products** | Product data ingestion and catalog management |
| **AI Insights** | AI-generated actionable insights from ingested data |
| **Data Quality** | Quality scoring dashboard (completeness, freshness, accuracy, consistency) |
| **Jobs** | Ingestion job monitoring (running, completed, failed, pending) |
| **Records** | Browse and search all ingested records |
| **Schedules** | Automated refresh schedules (15min to monthly) |
| **CSV Upload** | Paste or upload tabular data with column mapping |
| **Actions** | Insight-to-action workflow management |
| **Analytics** | 7 Chart.js visualizations and 6 summary stat cards |

### Data Sources and Ingestion Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| Web Scraping | Bulk URL scraping with up to 100 URLs per batch | Competitor websites, market reports |
| Sitemap Crawling | Automatic discovery and crawling of site pages | Full-site content ingestion |
| RSS/Atom Feeds | Subscribe to feeds with configurable polling | News, blog posts, regulatory updates |
| CSV/Excel Upload | Paste or upload tabular data with column mapping | Customer lists, product catalogs |
| API Feeds | Connect to external APIs for structured data | CRM data, custodian feeds |
| Webhook Ingestion | Receive real-time pushes from external systems | Event-driven data updates |
| Document Upload | PDF, image, and document processing with OCR | Contracts, statements, forms |

### Webhook Ingestion Endpoint

External systems can push data to Stewardry via authenticated webhook endpoints. The endpoint is `POST /api/webhooks/ingest/:sourceId` with HMAC-SHA256 signature validation in the `X-Webhook-Signature` header. Rate limiting is enforced at 100 requests per minute per source. The service accepts JSON and form-encoded payloads, including nested structures, and routes records into the ingestion pipeline for quality scoring and insight generation.

### Scheduled Ingestion Automation

Data sources can be configured with automatic refresh schedules across 7 frequency presets: every 15 minutes (real-time market data), hourly (news feeds), every 6 hours (competitor monitoring), daily (regulatory updates), weekly (market reports), monthly (industry benchmarks), and custom user-defined schedules. Each schedule supports enable/pause/run-now controls.

### Data Quality Scoring

Every ingested record receives a quality score (0.0-1.0) based on completeness (percentage of expected fields populated), freshness (time since last update), accuracy (cross-validation against known data), and consistency (alignment with existing records).

### AI Insight Generation and Insight-to-Action Workflow

The AI continuously analyzes ingested data to generate actionable insights categorized by severity (Critical, High, Medium, Low, Info), type (market trends, competitor moves, regulatory changes, client opportunities), and confidence score. Critical and high-severity insights automatically generate action items with recommended responses and trigger owner notifications.

---

## Financial Tools and Calculators

The platform provides **20+ financial calculators** accessible at `/calculators`:

| Calculator | Description |
|-----------|-------------|
| IUL Projections | Indexed Universal Life policy modeling with illustrated rates |
| Premium Finance ROI | Premium financing return analysis with stress testing |
| Retirement Planning | Monte Carlo retirement projections with inflation adjustment |
| Tax Projections | Multi-year tax liability forecasting with optimization strategies |
| Estate Planning | Estate tax and transfer analysis |
| Social Security Optimizer | Benefit claiming strategy optimization for maximum lifetime benefits |
| HSA Optimizer | Health Savings Account contribution and investment planning |
| Medicare Navigator | Medicare plan comparison and enrollment guidance |
| LTC Planner | Long-term care insurance needs analysis |
| Student Loan Optimizer | Repayment strategy comparison and forgiveness analysis |
| Charitable Giving | Donor-advised fund and CRT modeling |
| Business Exit Planning | Business valuation and succession planning |
| Equity Compensation | Stock option and RSU vesting/exercise optimization |
| Digital Assets | Cryptocurrency and digital asset portfolio tracking |
| Divorce Financial Analysis | Asset division and financial impact modeling |
| Financial Health Score | Comprehensive financial wellness assessment |
| Client Segmentation | Client base analysis and targeting |
| Annual Review | Year-over-year financial review |
| Plan Adherence | Financial plan tracking and compliance |
| Product Comparator | Side-by-side comparison of insurance and investment products |
| Education Planner | 529 and education funding projections |
| Fee Billing | Advisory fee calculation and billing management |

All calculators work for guest users with session-scoped data. Results can be discussed with the AI for deeper analysis.

---

## Product Marketplace

The Products section (`/products`) provides a searchable catalog of financial products with AI-powered suitability scoring. Features include product search and filtering by category, carrier, and features; AI suitability scoring based on client profiles; side-by-side product comparison; carrier connection management; and product research mode via enhanced search. The Marketplace page (`/marketplace`) extends this with a broader discovery interface.

---

## Compliance and Regulatory Framework

### Compliance Copilot

The Compliance Copilot monitors all AI interactions for regulatory compliance with real-time flagging of potential compliance issues, automatic disclaimer insertion, audit trail generation for every conversation, organization-level compliance policy enforcement, and a licensed review queue for flagged interactions.

### Suitability Assessment

A conversational AI-driven suitability questionnaire (`/suitability`) adapts questions based on previous answers. Results are stored and accessible across the advisory chain, supporting input at varying levels of detail from abstract to highly specific.

### Audit System

Every significant action is logged to the audit trail including user actions (queries, document uploads, calculations), AI responses with compliance flags, administrative actions (role changes, policy updates), and data access events for privacy compliance. Audit logs are append-only and stored in the `audit_trail` and `privacy_audit` tables.

---

## Privacy and Data Governance

Stewardry implements comprehensive privacy and data governance controls aligned with financial industry regulations.

### Privacy Page

A dedicated `/privacy` page documents all data collection practices, processing purposes, retention policies, and user rights. Sections cover: data collection (what is collected and why), data processing (how data is used), data retention (how long data is kept), user rights (access, correction, deletion, portability), and contact information.

### PII Masking Pipeline

Before any user message reaches the LLM, the `maskPIIForLLM()` function in `server/prompts.ts` strips personally identifiable information:

| PII Type | Pattern | Replacement |
|----------|---------|-------------|
| Social Security Numbers | `XXX-XX-XXXX` | `[SSN REDACTED]` |
| Credit Card Numbers | `XXXX-XXXX-XXXX-XXXX` (with spaces/dashes) | `[CARD REDACTED]` |
| Account Numbers | 8-17 digit sequences | `[ACCOUNT REDACTED]` |
| Phone Numbers | Various US formats | `[PHONE REDACTED]` |
| Email Addresses | Standard email format | `[EMAIL REDACTED]` |
| Street Addresses | Number + street name patterns | `[ADDRESS REDACTED]` |

### Consent Tracking

Per-source consent is tracked in the `user_consents` table. Consent types include: `ai_chat`, `voice_recording`, `document_upload`, `data_sharing`, `marketing_email`, and `analytics`. Each consent record stores the version, grant timestamp, and optional revocation timestamp. The Settings > Privacy & Data tab allows users to view and revoke consents.

### Financial Disclaimer

A persistent financial disclaimer appears in the GlobalFooter on every page: "AI-generated content is for informational purposes only and does not constitute financial, legal, or tax advice. Consult a qualified professional before making financial decisions."

### Topic-Specific Disclaimers

The `getTopicDisclaimer()` function in `server/prompts.ts` detects investment, insurance, and tax topics in user messages and appends appropriate regulatory disclaimers to AI responses.

### AI Identity Disclosure

The system prompt includes an `<identity>` block that instructs the AI to always identify itself as an AI assistant, never claim to be human, and include appropriate disclaimers when discussing regulated financial topics.

### Database Tables

`userConsents`, `privacyAudit`, `auditTrail`

---

## Communication and Campaigns

### Email Campaign Manager

The Email Campaign Manager (`/email-campaigns`) provides full campaign lifecycle management. **Campaign Creation** allows setting name, subject, and body with a rich text editor. **AI Content Generation** generates professional email content from prompts with tone selection across professional, friendly, urgent, and educational styles. **Recipient Management** supports bulk adding recipients and filtering by type (all clients, prospects, partners, custom list). **Template Personalization** uses `{{recipientName}}` and `{{recipientEmail}}` tokens that are auto-replaced per recipient. **Batch Sending** delivers to all recipients with per-recipient status tracking. **Campaign Analytics** tracks sent, delivered, opened, and failed counts.

### Notification System

The platform includes a built-in notification system for insight-triggered advisor alerts, campaign completion notifications, compliance review notifications, and task assignment notifications. The `notifyOwner({ title, content })` helper sends operational updates to the platform owner.

---

## Part G — Licensed Operations

Part G provides specialized tools for licensed insurance and advisory operations, accessible through **8 dedicated pages**:

| Page | Route | Purpose |
|------|-------|---------|
| Agentic Hub | `/agentic` | Central hub for all licensed operation tools |
| Licensed Review | `/licensed-review` | Pending compliance review queue with audit log |
| Agent Operations | `/agent-operations` | Autonomous agent monitoring with spawn/terminate controls |
| Insurance Quotes | `/insurance-quotes` | Multi-carrier quote generation and comparison |
| Insurance Applications | `/insurance-applications` | Application status tracking with 7-step pipeline |
| Advisory Execution | `/advisory-execution` | Advisory workflow execution dashboard |
| Estate Planning | `/estate-planning` | Estate document drafting wizard with state-specific templates |
| Premium Finance | `/premium-finance` | Premium finance case management with stress testing |
| Carrier Connector | `/carrier-connector` | Carrier API connection management |

Each page integrates with the corresponding backend router for real-time data and AI-assisted operations. All Part G actions require licensed professional approval and generate complete audit trails.

### Agent Operations Center

The Agent Operations Center allows spawning autonomous agent instances that execute multi-step workflows. Agents support three deployment modes (local, cloud, hybrid), configurable budget limits, runtime limits, and real-time action logging. The 4-tier compliance gate system ensures that high-risk actions are routed for licensed review before execution.

---

## Multi-Modal Capabilities

### Document Processing

The platform supports OCR text extraction from images and scanned documents via LLM vision, PDF table and form parsing, AI-generated document summaries and key information extraction, automatic document chunking for knowledge base indexing, and annotation with persistent context storage.

### Visual Analysis

**Screen Capture** shares screen content with AI for real-time analysis with pause/resume support. **Video Capture** uses the camera feed with periodic frame capture for visual context. **Image Analysis** accepts uploaded images for AI interpretation. The **Annotation System** supports highlighting, circling, and annotating visual content with persistent context storage.

### Voice and Audio

**Speech-to-Text** uses Deepgram-powered real-time transcription. **Text-to-Speech** uses Edge TTS with 25+ natural voices across 6 locales. **Voice Mode** provides hands-free conversational interaction with continuous listening and audible processing cues. **Audio Transcription** transcribes uploaded audio and video files.

---

## Search and Recommendations

### Enhanced Search

The Enhanced Search system provides cached search with results stored in the `search_cache` table to avoid redundant lookups, cited sources with URLs for every search result, product research mode where AI proactively researches and compares financial products, and unified multi-modal search across documents, transcripts, images, and ingested data.

### Recommendation Engine

The Recommendation system provides client-product matching with AI-powered best-fit scoring, organization recommendations based on user needs, email invitations to recommended contacts, and continuous learning from user feedback and outcomes.

---

## Organization and Team Management

### Organization Structure

Organizations support hierarchical team management with organization creation including branding (logo, colors, domain), role-based access (Owner, Admin, Manager, Member), team member invitation and management, and organization-level settings and compliance policies.

### Org Branding Editor

The Org Branding Editor (`/org-branding`) allows organizations to customize their logo and color scheme, custom domain configuration, brand voice for AI communications, and organization-specific compliance disclaimers. AI-powered color scheme detection automatically extracts colors from uploaded logos.

### Practice Intelligence

The Practice Intelligence dashboard provides team performance metrics, client engagement analytics, revenue and AUM tracking, and compliance score monitoring.

### COI Network

The Centers of Influence Network (`/coi-network`) manages professional referral relationships with contact management, relationship tracking, and referral analytics.

---

## Workflow and Task Engine

### Workflow Orchestrator

The Workflow Orchestrator manages multi-step business processes with configurable workflow templates, automatic task assignment based on roles, progress tracking with status updates, and integration with the AI for automated decision points.

### Task Engine

The Task Engine handles individual task management with task creation from insights, workflows, or manual entry; priority levels and due date tracking; assignment to team members; and status tracking (pending, in-progress, completed, dismissed).

---

## Analytics and Reporting

### Dashboard Analytics

The Analytics Dashboard (Data Intelligence Hub, Analytics tab) provides **7 Chart.js visualizations**:

| Chart | Type | Data |
|-------|------|------|
| Ingestion Volume | Line | Records ingested over time (7d/30d/90d) |
| Data Quality Trends | Line | Average quality scores over time |
| Insight Severity | Doughnut | Distribution by critical/high/medium/low/info |
| Insight Types | Bar | Count by insight category |
| Job Status | Doughnut | Completed/running/failed/pending jobs |
| Action Status | Bar | Pending/completed/dismissed actions |
| Source Breakdown | Pie | Records by data source type |

The dashboard also includes **6 summary stat cards**: Total Records, Active Sources, Average Quality, Total Insights, Pending Actions, and Active Jobs.

### Insights Dashboard

The Insights page (`/insights`) provides AI-generated financial insights based on user data, market trend analysis, portfolio performance summaries, and actionable recommendations.

---

## User Experience and Help System

### Onboarding Tour

New users are greeted with a **15-step guided tour** covering:

| Step | Title | Description |
|------|-------|-------------|
| 1 | Welcome to Stewardry | Platform overview and purpose |
| 2 | AI Chat — Your Digital Twin | Conversation interface and focus modes |
| 3 | Hands-Free Voice Mode | Voice interaction capabilities |
| 4 | Share Context with AI | Document, screen, camera, and image sharing |
| 5 | Navigation Sidebar | Feature access and organization |
| 6 | Real-Time Market Data | Live quotes, charts, and financial news |
| 7 | Financial Planning Tools | Calculator suite overview |
| 8 | Built-In Compliance | Disclaimer and audit trail system |
| 9 | Data Intelligence Hub | Data ingestion and analysis engine |
| 10 | Personalize Your Experience | AI tuning and settings |
| 11 | Email Campaigns | Campaign creation and management |
| 12 | Product Marketplace | Product discovery and suitability scoring |
| 13 | Guest Access | Session persistence and sign-in migration |
| 14 | Help is Always Available | Contextual help system |
| 15 | You're All Set! | Next steps and encouragement |

### Contextual Help

A floating help button (bottom-right, or `Ctrl+/`) provides page-specific assistance across three categories: **Tips** (contextual guidance for the current page), **Shortcuts** (keyboard shortcuts relevant to the current context), and **FAQ** (frequently asked questions about the current feature). Help content adapts automatically based on the current route.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | Start a new conversation |
| `Ctrl + K` | Quick search across the platform |
| `Ctrl + /` | Toggle help panel |
| `Escape` | Close current dialog or panel |

### GuestBanner

Guest users see a persistent banner encouraging sign-in, with a clear explanation that their session data will be preserved upon authentication. The banner includes a sign-in button and a dismiss button.

### AuthGate

Admin-only pages display a friendly AuthGate component with a clear explanation of why sign-in is required, a sign-in button linking to Manus OAuth, and navigation links back to Chat and Home.

---

## Accessibility and Mobile Responsiveness

### Touch Target Standards

All interactive buttons across the platform meet the **40-44px minimum touch target** standard, aligned with WCAG 2.5.5 Enhanced (Level AAA) guidelines [1], Apple Human Interface Guidelines (44pt minimum) [2], and Google Material Design (48dp recommended) [3]. This was achieved through a comprehensive audit of 80+ button instances across 20+ files, updating the base Button component size variants and all individual button overrides.

Specific areas addressed include chat input bar buttons (plus, send, audio toggle, mode selector), message action buttons (copy, thumbs, regenerate, read aloud), sidebar controls (new conversation, collapse, hamburger menu), page header back buttons across all 12+ pages, dialog and modal close buttons, floating help button, onboarding tour navigation, and guest banner actions.

### Responsive Design

The platform is designed mobile-first with the following breakpoints:

| Breakpoint | Width | Layout Adaptation |
|-----------|-------|-------------------|
| Mobile | < 640px | Single column, collapsed sidebar, stacked navigation |
| Tablet | 640-1024px | Flexible grid, collapsible sidebar |
| Desktop | > 1024px | Full sidebar, multi-column layouts |

The chat interface adapts its sidebar to an overlay on mobile viewports, with a hamburger menu button in the mobile header bar (h-12 height to accommodate touch targets).

---

## Navigation and Page Map

### Sidebar Navigation Structure

The chat sidebar organizes navigation into three sections based on user role:

**Tools Section** (available to all authenticated users):

| Label | Route | Description |
|-------|-------|-------------|
| Calculators | `/calculators` | 20+ financial calculators |
| Products | `/products` | Product catalog and search |
| Meetings | `/meetings` | Meeting management and notes |
| Insights | `/insights` | AI-generated financial insights |
| Planning | `/planning` | Financial planning tools |
| Coach | `/coach` | Behavioral coaching AI |
| Compliance | `/compliance` | Compliance monitoring |
| Marketplace | `/marketplace` | Extended product marketplace |
| Workflows | `/workflows` | Workflow management |
| Study Buddy | `/study` | Educational study assistant |
| Education | `/education` | Education center and modules |
| Student Loans | `/student-loans` | Student loan optimization |
| Equity Comp | `/equity-comp` | Equity compensation planning |
| Digital Assets | `/digital-assets` | Cryptocurrency portfolio tracking |
| COI Network | `/coi-network` | Centers of influence management |
| Data Intelligence | `/data-intelligence` | Data ingestion and analysis hub |
| Agentic Hub | `/agentic` | Autonomous agent operations |
| Licensed Review | `/licensed-review` | Compliance review queue |
| Agent Ops | `/agent-operations` | Agent monitoring dashboard |
| Insurance | `/insurance-quotes` | Insurance quote generation |
| Estate Planning | `/estate-planning` | Estate document drafting |
| Premium Finance | `/premium-finance` | Premium finance cases |
| Email Campaigns | `/email-campaigns` | Email campaign management |
| Integrations | `/integrations` | Integration pipeline management |
| Professionals | `/professionals` | Professional directory and referrals |

**Admin Section** (role-gated):

| Label | Route | Minimum Role |
|-------|-------|-------------|
| Portal | `/portal` | Advisor |
| Organizations | `/organizations` | Advisor |
| Manager Dashboard | `/manager` | Manager |
| Global Admin | `/admin` | Admin |
| AI Improvement | `/improvement` | Admin |

### Additional Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Public landing page with hero and features |
| `/signin` | SignIn | Authentication entry point |
| `/welcome` | Welcome | Post-auth welcome with feature highlights |
| `/terms` | Terms | Terms of service |
| `/org/:slug` | OrgLanding | Organization-specific landing page |
| `/privacy` | Privacy | Privacy policy and data practices |
| `/settings` | SettingsHub | User settings (8 tabs) |
| `/settings/:tab` | SettingsHub | Direct tab access (incl. privacy-data, data-sharing) |
| `/documents` | Documents | Document management |
| `/suitability` | Suitability | Suitability assessment |
| `/ai-settings` | AISettings | AI model configuration |
| `/org-branding` | OrgBrandingEditor | Organization branding |
| `/carrier-connector` | CarrierConnector | Carrier API connections |
| `/market` | MarketData | Real-time market data |
| `/404` | NotFound | 404 error page |

---

## API Reference

### tRPC Routers (34 sub-routers + main)

The platform exposes 34 sub-routers plus the main router, organized by domain:

| Category | Routers |
|----------|---------|
| **Core** | auth, system, settings, conversations, chat, memories, memoryEpisodes |
| **AI** | aiLayers, ambient, constitutionalAI, multiModel, complianceCopilot, visual, improvementEngine |
| **Financial** | calculators, taxProjector, equityComp, digitalAssets, divorceAnalysis, charitableGiving, businessExit, feeBilling, financialHealth, ssOptimizer, hsaOptimizer, ltcPlanner, medicareNav, educationPlanner, annualReview, planAdherence |
| **Products** | products, matching, recommendation, suitability |
| **Data** | dataIngestion, dataIngestionEnhanced, scheduledIngestion, webhookIngestion, analytics, searchEnhanced, integrations |
| **Compliance** | compliance, review, knowledgeGraph |
| **Communication** | comms, emailCampaign, voice, meetings, feedback |
| **Organization** | organizations, orgBranding, portal, portalOptimizer, practiceIntelligence, clientSegmentation, relationships, coi |
| **Operations** | workflowOrchestrator, workflow, taskEngine, featureFlags, anonymousChat, multiModalProcessing |
| **Part G** | agentic (sub-routers: gate, agent, quote, application, advisory, estate, premiumFinance, carrier) |
| **Education** | education, studentLoans, studyBuddy, medicare |
| **Market** | market |
| **Privacy & Access** | consent, kbAccess, professionals, fairness |

### Express Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/webhooks/ingest/:sourceId` | HMAC-SHA256 | Receive external data pushes |
| POST | `/api/auth/guest-session` | None | Create anonymous guest session |
| POST | `/api/auth/migrate-guest` | Session JWT | Migrate guest data to authenticated account |
| GET | `/api/oauth/callback` | OAuth flow | Manus OAuth callback handler |
| POST | `/api/trpc/*` | Session JWT | All tRPC procedure calls |

---

## Database Schema

The platform defines **132 MySQL/TiDB tables** in the Drizzle ORM schema. Tables are organized by domain:

| Domain | Count | Key Tables |
|--------|-------|------------|
| **Users and Auth** | 10 | users, user_profiles, user_preferences, user_relationships, professional_context, view_as_audit_log, privacy_audit, user_consents, user_insights_cache |
| **Organizations** | 5 | organizations, user_organization_roles, organization_relationships, organization_ai_settings, organization_landing_page_config |
| **Conversations and AI** | 12 | conversations, messages, memories, memory_episodes, feedback, review_queue, platform_ai_settings, professional_ai_settings, manager_ai_settings, constitutional_violations, prompt_variants, prompt_experiments |
| **Documents and Knowledge** | 6 | documents, document_chunks, document_extractions, kg_nodes, kg_edges, search_cache |
| **Financial Planning** | 14 | suitability_assessments, products, health_scores, plan_adherence, saved_analyses, equity_grants, digital_asset_inventory, student_loans, ltc_analyses, business_exit_plans, annual_reviews |
| **Insurance and Advisory** | 10 | gate_reviews, agent_instances, agent_actions, carrier_connections, insurance_quotes, insurance_applications, advisory_executions, estate_documents, premium_finance_cases, coi_contacts |
| **Data Ingestion** | 10 | data_sources, ingested_records, ingestion_jobs, data_quality_scores, scrape_schedules, ingestion_insights, bulk_import_batches, insight_actions, enrichment_datasets, enrichment_cohorts |
| **Communication** | 4 | email_campaigns, email_sends, comms_log, notification_log |
| **Platform Operations** | 14 | feature_flags, workflow_checklist, workflow_event_chains, workflow_execution_log, tasks, meetings, meeting_action_items, client_segments, practice_metrics, engagement_scores, portal_engagement, market_data_cache, web_scrape_results, referrals |
| **Compliance** | 3 | audit_trail, compliance_audit, compliance_flags |
| **Multi-Model** | 2 | proactive_insights, affiliated_resources |
| **Professionals and Referrals** | 3 | professionals, professional_relationships, professional_reviews |
| **KB Access Control** | 3 | kb_sharing_permissions, kb_sharing_defaults, kb_access_transitions |
| **Integration Pipeline** | 8 | integration_providers, integration_connections, integration_sync_config, integration_sync_logs, integration_field_mappings, integration_webhook_events, enrichment_cache, carrier_import_templates |
| **AI Improvement Engine** | 4 | layer_audits, layer_metrics, improvement_actions, improvement_feedback |
| **Fairness Testing** | 2 | fairness_test_runs, fairness_test_prompts |
| **Suitability Intelligence** | 5 | suitability_profiles, suitability_dimensions, suitability_change_events, suitability_questions_queue, suitability_household_links |
| **Analytical Models** | 4 | analytical_models, model_runs, model_output_records, model_schedules |
| **Propagation & Coaching** | 5 | propagation_events, propagation_actions, coaching_messages, platform_learnings, education_triggers |
| **File Processing** | 4 | file_uploads, file_chunks, file_derived_enrichments, generated_documents |

---

## Test Coverage

The platform maintains **565 automated tests** across **19 test suites**, all passing:

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| comprehensive.test.ts | 61 | Cross-cutting platform features |
| dataIngestion.test.ts | 90 | Data ingestion pipeline |
| dataIngestionEnhanced.test.ts | 83 | Enhanced scraping, RSS, quality scoring |
| newFeatures.test.ts | 40 | Analytics, webhooks, email campaigns, guest sessions |
| platform.test.ts | 47 | Performance, accessibility, compliance |
| functional.test.ts | 36 | Core functional scenarios |
| chat.test.ts | 21 | Chat and conversation features |
| portal.test.ts | 20 | Client portal operations |
| aiTuning.test.ts | 19 | AI personalization |
| security.test.ts | 19 | Security and input validation |
| routers.audit.test.ts | 17 | Audit trail system |
| edgeTTS.test.ts | 16 | Text-to-speech |
| v4features.test.ts | 30 | V4 feature set |
| roleHierarchy.test.ts | 9 | Role-based access control |
| products-ai.test.ts | 8 | AI product analysis |
| auth.logout.test.ts | 1 | Authentication logout |
| auditRemediation.test.ts | 22 | PII masking, topic disclaimers, AI identity |
| auditV2Features.test.ts | 17 | Consent tracking, professionals, improvement engine |
| userTypes.test.ts | 39 | All 5 roles (guest, user, advisor, manager, admin) across all major features |

---

## Feature Matrix

| Feature | Guest | User | Professional | Manager | Admin |
|---------|-------|------|-------------|---------|-------|
| AI Chat (all modes) | Yes | Yes | Yes | Yes | Yes |
| Voice Mode | Yes | Yes | Yes | Yes | Yes |
| Financial Calculators | Yes | Yes | Yes | Yes | Yes |
| Product Marketplace | Yes | Yes | Yes | Yes | Yes |
| Document Upload/Analysis | Yes | Yes | Yes | Yes | Yes |
| Market Data | Yes | Yes | Yes | Yes | Yes |
| Education Hub | Yes | Yes | Yes | Yes | Yes |
| Professional Directory | Yes | Yes | Yes | Yes | Yes |
| Integration Pipeline | No | Yes | Yes | Yes | Yes |
| Data Intelligence Hub | No | Yes | Yes | Yes | Yes |
| Email Campaigns | No | Yes | Yes | Yes | Yes |
| Insights Dashboard | No | Yes | Yes | Yes | Yes |
| Workflow Management | No | Yes | Yes | Yes | Yes |
| Data Sharing Controls | No | Yes | Yes | Yes | Yes |
| Consent Management | No | Yes | Yes | Yes | Yes |
| Settings (Full) | No | Yes | Yes | Yes | Yes |
| Client Portal | No | No | Yes | Yes | Yes |
| Practice Intelligence | No | No | Yes | Yes | Yes |
| Team Management | No | No | No | Yes | Yes |
| AI Improvement Engine | No | No | No | No | Yes |
| Organization Admin | No | No | No | No | Yes |
| Global Admin | No | No | No | No | Yes |
| Compliance Review | No | No | No | No | Yes |
| **Fairness Testing** | No | No | No | No | Yes |
| **Suitability Engine** | No | Yes | Yes | Yes | Yes |
| **Analytical Models** | No | Yes | Yes | Yes | Yes |
| **Intelligence Feed** | No | Yes | Yes | Yes | Yes |
| **Analytics Hub** | No | Yes | Yes | Yes | Yes |
| **Model Seeding** | No | No | No | No | Yes |
| **Voice Settings** | Yes | Yes | Yes | Yes | Yes |-

## Deployment and Infrastructure

The platform is hosted on Manus infrastructure with the following capabilities:

| Capability | Details |
|-----------|---------|
| **Domains** | stewardry.manus.space, wealthai-gakeferp.manus.space |
| **SSL/TLS** | Automatic HTTPS encryption |
| **Database** | Managed MySQL/TiDB with connection pooling |
| **File Storage** | S3 with CDN delivery for static assets |
| **Authentication** | Manus OAuth with session JWT |
| **Custom Domains** | Supported via Management UI Settings |
| **Robots.txt** | Configured to allow ClaudeBot, GPTBot, Googlebot, Bingbot, PerplexityBot, and all major crawlers |

To publish updates, create a checkpoint via the development workflow and click the Publish button in the Management UI.

---

## References

[1]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html "WCAG 2.5.5: Target Size (Enhanced) — Level AAA"
[2]: https://developer.apple.com/design/human-interface-guidelines/accessibility#Buttons-and-controls "Apple Human Interface Guidelines — Buttons and Controls"
[3]: https://m3.material.io/foundations/designing/structure "Material Design 3 — Accessibility Designing"

---

*This guide reflects the current state of the Stewardry platform as of March 20, 2026. Version 5.0.*


---

## Suitability Intelligence Engine

The Suitability Intelligence Engine provides a 12-dimension financial profiling system that builds a comprehensive picture of each user's financial situation through progressive profiling rather than lengthy questionnaires.

### 12-Dimension Model

| Dimension | Description | Score Range | Decay Rate |
|-----------|-------------|-------------|------------|
| risk_tolerance | Willingness to accept investment risk | 0-100 | 0.95/month |
| investment_horizon | Time horizon for investments | 0-100 | 0.98/month |
| income_stability | Stability and predictability of income | 0-100 | 0.96/month |
| liquidity_needs | Short-term cash requirements | 0-100 | 0.94/month |
| tax_sensitivity | Impact of tax considerations | 0-100 | 0.97/month |
| estate_complexity | Complexity of estate planning needs | 0-100 | 0.99/month |
| insurance_adequacy | Current insurance coverage assessment | 0-100 | 0.95/month |
| debt_management | Debt-to-income and management quality | 0-100 | 0.96/month |
| retirement_readiness | Preparedness for retirement | 0-100 | 0.97/month |
| education_funding | Education savings and planning | 0-100 | 0.98/month |
| charitable_intent | Philanthropic goals and planning | 0-100 | 0.99/month |
| special_needs | Special circumstances (disability, dependents) | 0-100 | 0.99/month |

### Progressive Profiling Flow

The system avoids upfront questionnaires by extracting suitability signals from natural conversation:

1. **Signal Extraction**: AI analyzes chat messages for financial indicators
2. **Dimension Update**: Relevant dimension scores are updated with confidence levels
3. **Confidence Decay**: Scores decay over time based on per-dimension decay rates
4. **Question Generation**: Low-confidence dimensions trigger contextual follow-up questions queued in `suitability_questions_queue`
5. **Synthesis**: The `synthesize()` function combines all dimensions into a composite suitability profile

### Household Linking

The `suitability_household_links` table enables linking multiple user profiles into a household unit. This supports combined financial planning where spousal income, shared debts, and joint goals are factored into suitability assessments.

### Key Tables

- `suitabilityProfiles`: Per-user composite suitability profile with overall score and confidence
- `suitabilityDimensions`: Individual dimension scores with confidence, source, and timestamps
- `suitabilityChangeEvents`: Audit trail of all dimension changes with before/after values
- `suitabilityQuestionsQueue`: AI-generated follow-up questions for low-confidence dimensions
- `suitabilityHouseholdLinks`: Household relationship links between user profiles

### tRPC Router: `suitabilityEngine`

| Procedure | Auth | Description |
|-----------|------|-------------|
| getDimensions | Public | List all 12 dimension definitions |
| getProfile | Protected | Get user's full suitability profile with all dimensions |
| updateDimension | Protected | Update a specific dimension score with source and confidence |
| synthesize | Protected | Run full synthesis across all dimensions to compute composite score |
| getQuestions | Protected | Get pending questions for low-confidence dimensions |

---

## Analytical Model Engine

The Model Engine provides 8 built-in analytical models with full statistical implementations that can be executed on-demand or on a recurring schedule, with automatic dependency resolution. Each model now contains production-grade mathematical logic rather than execution stubs.

### Built-in Models

| Model ID | Type | Description | Implementation | Dependencies |
|----------|------|-------------|---------------|-------------|
| portfolio_risk | risk | Portfolio risk assessment using variance-covariance | Variance-covariance matrix, Sharpe ratio, max drawdown | None |
| retirement_readiness | projection | Monte Carlo retirement simulation | 10,000-iteration Monte Carlo with percentile breakdowns, Social Security integration, contribution growth, recommended additional savings | portfolio_risk |
| tax_optimization | optimization | Tax-loss harvesting and Roth conversion analysis | Full 2025/2026 bracket analysis, standard vs. itemized comparison, Roth conversion break-even, charitable bundling strategy | None |
| insurance_gap | gap_analysis | Insurance coverage gap identification | Life (10-12x income), disability (65% replacement), home, auto, umbrella, LTC analysis with priority scoring | None |
| estate_planning | planning | Estate tax and succession planning | Federal exemption ($13.61M), marital deduction, ILIT/GRAT/QPRT/CRT/FLP trust strategies, annual gifting analysis | None |
| debt_optimization | optimization | Debt payoff strategy optimization | Avalanche (highest rate first), snowball (lowest balance first), hybrid strategies with month-by-month schedules | None |
| education_funding | projection | 529 and education savings projections | Inflation-adjusted cost projection, 529 growth modeling, funding gap calculation, tax benefit analysis | None |
| cash_flow | analysis | Income/expense pattern analysis | Seasonal adjustment, one-time events, emergency fund ratio tracking, cumulative balance projection | None |

### Statistical Model Details

The **Monte Carlo Retirement Simulation** runs configurable iterations (default 10,000) using normally-distributed annual returns with the specified mean and standard deviation. Each simulation tracks portfolio balance through accumulation and decumulation phases, incorporating Social Security benefits at the specified start age. The output includes success rate (percentage of simulations where funds lasted through life expectancy), percentile breakdowns (10th, 25th, 50th, 75th, 90th), year-by-year median projections, and a recommended additional savings amount calculated via binary search to achieve a 90% success rate.

The **Debt Optimization** engine simulates three strategies in parallel: avalanche (highest interest rate first), snowball (lowest balance first), and hybrid (small debts under $1,000 first, then avalanche). Each strategy produces a complete month-by-month payment schedule showing per-debt payments, remaining balances, and interest paid. The recommendation engine considers the interest differential between strategies and the number of quick-win small debts to suggest the optimal approach.

The **Tax Optimization** model implements the full 2025/2026 federal tax bracket system for all four filing statuses, compares standard versus itemized deductions (with SALT cap at $10,000), calculates Roth conversion break-even years, evaluates charitable bundling with donor-advised fund strategies, and provides retirement contribution optimization analysis.

### Execution Pipeline

```
Model Selection → Dependency Resolution → Input Validation
    → Statistical Execution → Output Storage (model_output_records)
    → Suitability Update → Propagation Event → WebSocket Notification
    → Coaching Message Generation
```

When a model completes execution, the engine automatically sends a real-time WebSocket notification to the requesting user with the model name, execution time, and a summary of results. If the model produces actionable insights (e.g., a retirement funding gap), the Propagation Engine generates coaching messages that are also delivered via WebSocket.

When a model with dependencies is executed, the engine automatically runs prerequisite models first. For example, running `retirement_readiness` will first execute `portfolio_risk` if it hasn't been run recently.

### Model Scheduling

Models can be scheduled for recurring execution via `model_schedules`:
- **Frequencies**: daily, weekly, monthly, quarterly
- **Automatic execution**: The cron system checks for due schedules and executes them
- **Result history**: All runs stored in `model_runs` with full input/output records in `model_output_records`

### tRPC Router: `modelEngine`

| Procedure | Auth | Description |
|-----------|------|-------------|
| list | Protected | List all available analytical models |
| execute | Protected | Execute a model with optional parameters |
| history | Protected | Get execution history for a model |
| seed | Admin | Seed the 8 built-in model definitions |

---

## Propagation and Coaching Engine

The Propagation Engine implements cross-layer intelligence cascading. When significant events occur (suitability changes, model results, integration syncs), the engine generates role-appropriate actions and coaching messages that flow through the 5-layer hierarchy.

### Event Types

| Event Type | Trigger | Example |
|------------|---------|---------|
| suitability_change | Dimension score changes significantly | Risk tolerance dropped 20 points after market event |
| model_result | Analytical model produces actionable output | Retirement gap of $250K detected |
| integration_sync | New data arrives from integration | New brokerage account linked via Plaid |
| compliance_alert | Compliance rule triggered | Portfolio concentration exceeds 25% threshold |
| market_event | Market condition change detected | Fed rate decision impacts client portfolios |
| coaching_insight | AI identifies coaching opportunity | Client hasn't reviewed insurance in 18 months |

### Cascading Flow

```
Source Event → propagation_events table
    → Layer-appropriate action generation → propagation_actions table
    → Coaching message creation → coaching_messages table
    → Platform learning extraction → platform_learnings table
    → Education trigger evaluation → education_triggers table
```

### Coaching Messages

The system generates role-specific coaching messages:

| Target Role | Message Style | Example |
|-------------|--------------|---------|
| User | Actionable personal tip | "Your emergency fund covers only 2 months. Consider building to 6 months." |
| Advisor | Client engagement alert | "Client John's risk tolerance dropped significantly. Schedule a review." |
| Manager | Team performance insight | "3 advisors haven't run suitability reviews this quarter." |
| Admin | Platform optimization | "Insurance gap model has 40% lower engagement than retirement model." |

### tRPC Router: `propagation`

| Procedure | Auth | Description |
|-----------|------|-------------|
| getMyEvents | Protected | Get propagation events relevant to the current user |
| getCoachingMessages | Protected | Get coaching messages for the current user |
| cascadeEvent | Protected | Manually trigger a propagation cascade |
| dismissAction | Protected | Dismiss a propagation action |

---

## File Processing Pipeline

The File Processing service implements a 6-stage document ingestion pipeline that validates, parses, classifies, extracts, and enriches uploaded documents.

### Pipeline Stages

| Stage | Status | Description | Output |
|-------|--------|-------------|--------|
| 1 | uploaded | File received and stored in S3 | File metadata, S3 URL |
| 2 | validated | Format, size, and security checks | Validation result (pass/fail) |
| 3 | parsed | Content extraction (text, tables, images) | Raw content, page count |
| 4 | classified | Document type classification via AI | Category label + confidence |
| 5 | extracted | Structured data extraction | Key-value pairs, entities |
| 6 | enriched | Cross-reference with existing data | Enrichment records, links |

### Document Categories

- `statement`: Account statements, brokerage reports, bank statements
- `tax_document`: W-2, 1099, K-1, tax returns, estimated payments
- `insurance_policy`: Policy declarations, coverage summaries, riders
- `estate_document`: Wills, trusts, power of attorney, beneficiary designations
- `financial_plan`: Financial plans, projections, recommendations
- `other`: General documents, correspondence, notes

### Key Tables

- `fileUploads`: Upload metadata with pipeline status tracking
- `fileChunks`: Parsed content chunks for large documents
- `fileDerivedEnrichments`: Enrichment results linking documents to existing data

### tRPC Router: `fileProcessing`

| Procedure | Auth | Description |
|-----------|------|-------------|
| list | Protected | List uploaded files with pipeline status |
| create | Protected | Create a new file upload record |
| process | Protected | Advance a file through the next pipeline stage |

---

## Voice Settings Hierarchy

Voice settings cascade through the 5-layer hierarchy, with each layer able to set defaults that lower layers inherit unless overridden.

### Cascade Order

```
Layer 1: Platform defaults (defaultTtsVoice, defaultSpeechRate)
  └── Layer 2: Organization override (if set)
        └── Layer 3: Manager override (if set)
              └── Layer 4: Professional override (if set)
                    └── Layer 5: User preference (always wins if set)
```

### Per-Layer Fields

Each layer table (`platformAISettings`, `organizationAISettings`, `managerAISettings`, `professionalAISettings`) now includes:
- `defaultTtsVoice`: Edge TTS voice ID (e.g., "en-US-JennyNeural")
- `defaultSpeechRate`: Playback speed multiplier (0.5 to 2.0)

### Guest Voice Persistence

Guest users store voice settings in `localStorage`:
- `tts-voice`: Selected Edge TTS voice ID
- `tts-speech-rate`: Playback speed (0.5-2.0)
- `tts-auto-play`: Auto-play AI responses (boolean)
- `tts-hands-free`: Default hands-free mode (boolean)

### Voice Tab in Settings

The new Voice tab in SettingsHub (`/settings/voice`) is accessible to all users including guests. It provides:
- Voice selection with preview playback
- Speech rate adjustment with slider
- Auto-play toggle
- Hands-free mode default toggle
- For authenticated users: server-side persistence via `userPreferences` table

---

## Scheduled Tasks and Cron Jobs

The platform runs periodic background tasks via `node-cron` in `server/services/scheduledTasks.ts`.

### Task Schedule

| Task | Schedule | Description |
|------|----------|-------------|
| Suitability Decay | Daily at 2:00 AM | Apply confidence decay to stale dimension scores |
| Propagation Delivery | Every 5 minutes | Deliver pending propagation actions to target users |
| Propagation Expiry | Daily at 3:00 AM | Expire undelivered actions older than 30 days |
| Model Execution | Every 15 minutes | Check for and execute due model schedules |
| Coaching Digest | Daily at 7:00 AM | Generate daily coaching message summaries |
| Integration Health | Hourly | Check webhook health, token expiry, and cache freshness |
| Platform Pipelines | Varies | Census (monthly), BLS (weekly), FRED (daily), BEA (quarterly) |

### Error Handling

Each task runs in isolation — a failure in one task does not affect others. All executions are logged, and persistent failures trigger admin notifications via the `notifyOwner` helper.

---

## Known Limitations and Roadmap

### Current Limitations

1. **Integration API Keys**: Most integration providers are configured but require API key registration. Currently only Plaid has active credentials.
2. **Platform Pipeline Data**: Census, BLS, FRED, and BEA data pipelines are stubbed and need API key registration at each agency.
3. **Document Generation**: The `generated_documents` table exists but the PDF rendering pipeline is not yet implemented.
4. **Chat.tsx Size**: At 1,950+ lines, the main chat component would benefit from decomposition into smaller sub-components.

### Roadmap (Priority Order)

1. **Integration Activation**: Register API keys for GoHighLevel, BridgeFT, and Schwab to enable live data sync
2. **Document Generation**: Build PDF rendering pipeline for financial plans, reports, and compliance documents
3. **Mobile App**: React Native wrapper for native mobile experience
4. **Multi-language Support**: Internationalization for non-English markets
5. **Advanced Analytics Dashboards**: Charts, trends, and predictive analytics in the Analytics Hub
6. **Marketplace**: Third-party plugin and integration marketplace

---

*This guide reflects the current state of the Stewardry platform as of March 20, 2026. Version 8.0.*

---

## Auth Enrichment and Multi-Provider Sign-In

### Overview

Version 7.0 introduces a comprehensive authentication enrichment system that allows users to connect multiple identity providers (LinkedIn, Google, Email) in addition to the base Manus OAuth. Each provider contributes different profile fields with varying confidence levels, and the **Profile Merger** service automatically resolves conflicts using a deterministic confidence hierarchy.

### Architecture

The auth enrichment system consists of five services:

| Service | Location | Responsibility |
|---------|----------|---------------|
| **LinkedInAuthService** | `server/services/auth/linkedinAuth.ts` | OAuth 2.0 flow, profile fetch, token storage |
| **GoogleAuthService** | `server/services/auth/googleAuth.ts` | OAuth 2.0 flow, People API fetch, token storage |
| **EmailAuthService** | `server/services/auth/emailAuth.ts` | Magic link generation, verification, domain-based employer inference |
| **ProfileMerger** | `server/services/auth/profileMerger.ts` | Confidence-based field merging across providers |
| **PostSignupEnrichment** | `server/services/auth/postSignupEnrichment.ts` | Automated enrichment pipeline triggered after sign-up |

### Confidence Hierarchy

The profile merger uses a numeric confidence system where higher values take precedence:

| Source | Name | Email | Phone | Employer | Job Title | Industry | Birthday |
|--------|------|-------|-------|----------|-----------|----------|----------|
| **LinkedIn** | 95 | 95 | — | 100 | 100 | 95 | — |
| **Google** | 90 | 90 | 90 | 80 | 80 | — | 90 |
| **Email** | — | 85 | — | 70 | — | — | — |
| **Manus** | 60 | 60 | — | — | — | — | — |

When merging, the system compares confidence scores for each field. If the new data has a higher confidence than the existing value, it replaces it. All changes are logged in the `auth_enrichment_log` table with before/after values for audit purposes.

### Database Tables

| Table | Purpose |
|-------|---------|
| `auth_provider_tokens` | Stores OAuth tokens per user per provider (encrypted), with expiry tracking |
| `auth_enrichment_log` | Audit trail of all profile enrichment events with source, fields captured, and confidence |

### tRPC Router: `authEnrichment`

| Procedure | Type | Access | Description |
|-----------|------|--------|-------------|
| `getSignInMethods` | Query | Public | Lists all available sign-in methods with configuration status |
| `initiateLinkedIn` | Mutation | Public | Generates LinkedIn OAuth URL with state parameter |
| `initiateGoogle` | Mutation | Public | Generates Google OAuth URL with state parameter |
| `requestMagicLink` | Mutation | Public | Sends magic link email for passwordless sign-in |
| `linkProvider` | Mutation | Protected | Links a new provider to an existing account |
| `unlinkProvider` | Mutation | Protected | Disconnects a provider from the account |
| `getConnectedProviders` | Query | Protected | Lists all connected providers with token status |
| `getEnrichmentHistory` | Query | Protected | Returns the full enrichment audit log |
| `getProfileCompleteness` | Query | Protected | Calculates profile completeness percentage |
| `forceProfileRefresh` | Mutation | Protected | Triggers re-enrichment from all connected providers |

### Frontend: Connected Accounts Tab

The **Connected Accounts** tab in Settings (`/settings/connected-accounts`) provides:

1. A **profile completeness meter** showing the percentage of fields populated across all providers
2. **Provider cards** for LinkedIn, Google, and Email with connect/disconnect actions
3. **Enrichment history** showing all profile updates with timestamps and sources
4. A **force refresh** button to re-pull data from all connected providers

---

## Apollo.io Integration

### Overview

Apollo.io is integrated as a data enrichment provider for professional profile data. When configured with an API key, it provides company information, job titles, social profiles, and contact details for users based on their email address or employer domain.

### Service: `ApolloService`

Located at `server/services/auth/apolloService.ts`, the service provides three methods:

| Method | Input | Output |
|--------|-------|--------|
| `enrichPerson` | API key, email, first/last name | Full professional profile (title, company, phone, LinkedIn URL, industry, seniority) |
| `enrichCompany` | API key, domain | Company profile (name, industry, size, revenue, founded year, technologies) |
| `findEmail` | API key, first name, last name, domain | Professional email address |

The service includes automatic error handling, rate limiting awareness, and graceful degradation when the API is unavailable. Apollo is seeded as an integration provider in the `integration_providers` table with category `data_enrichment`.

---

## Post-Signup Enrichment Pipeline

### Overview

The post-signup enrichment pipeline (`PostSignupEnrichment` service) runs automatically after a user completes sign-up. It sequentially queries multiple data sources to build a comprehensive user profile.

### Pipeline Stages

| Stage | Source | Data Enriched | Requires API Key |
|-------|--------|--------------|-----------------|
| 1 | **Census Bureau** | Demographic context from ZIP code (median income, education, population) | Yes |
| 2 | **BLS (Bureau of Labor Statistics)** | Employment and wage data for user's occupation/industry | Yes |
| 3 | **FRED (Federal Reserve)** | Current economic indicators (interest rates, inflation, unemployment) | Yes |
| 4 | **Apollo.io** | Professional profile, company data, social profiles | Yes |
| 5 | **FINRA BrokerCheck** | Broker registration status, CRD number, firm history | No (public API) |

Each stage runs independently — if one fails (missing API key, network error), the pipeline continues to the next stage. Results are logged to the `auth_enrichment_log` table with the source, fields captured, and confidence scores.

### Token Refresh Cron

A daily cron job (`token-refresh`) runs at 2:00 AM to:

1. Check all `auth_provider_tokens` for tokens expiring within 7 days
2. Attempt to refresh tokens using stored refresh tokens
3. Re-fetch profile data from providers with refreshed tokens
4. Detect and log any profile changes (job change, company change, etc.)
5. Trigger suitability re-synthesis if significant changes are detected

---

*This guide reflects the current state of the Stewardry platform as of March 20, 2026. Version 8.0.*

---

## Real-Time WebSocket Notifications

### Overview

Version 8.0 introduces a full real-time notification system built on Socket.IO, enabling instant delivery of propagation events, coaching messages, model completion alerts, and system notifications without polling. The system supports per-user notification persistence, read/unread state management, and automatic reconnection with exponential backoff.

### Architecture

| Component | Location | Responsibility |
|-----------|----------|---------------|
| **WebSocket Server** | `server/services/websocketNotifications.ts` | Socket.IO server attached to Express, user authentication via JWT, room management by userId and role |
| **useWebSocket Hook** | `client/src/hooks/useWebSocket.ts` | Client-side Socket.IO connection with reconnection, notification state management, toast integration |
| **NotificationBell** | `client/src/components/NotificationBell.tsx` | Dropdown panel with type filters, read/unread state, priority badges, time-ago formatting |
| **NotificationProvider** | `client/src/contexts/NotificationContext.tsx` | React context providing notification state to all components |
| **Notifications Router** | `server/routers/notifications.ts` | tRPC procedures for REST-based notification access and admin broadcast |

### Notification Types

| Type | Icon | Color | Trigger |
|------|------|-------|---------|
| `coaching` | Brain | Violet | Behavioral coaching messages from the AI engine |
| `propagation` | Radio | Blue | Cross-layer intelligence cascade events |
| `alert` | Shield | Red | Compliance alerts, risk threshold breaches |
| `model_complete` | TrendingUp | Emerald | Analytical model execution completed |
| `enrichment` | Zap | Amber | Profile enrichment from external providers |
| `system` | Settings | Gray | Platform maintenance, admin broadcasts |

### Priority Levels

| Priority | Visual Treatment | Toast Behavior |
|----------|-----------------|----------------|
| `critical` | Red background, red border | Auto-displayed with `error` style, 8-second duration |
| `high` | Amber background, amber border | Auto-displayed with `warning` style, 6-second duration |
| `medium` | Blue background, blue border | Auto-displayed with `info` style, 4-second duration |
| `low` | Gray background, gray border | No toast, badge count only |

### Server-Side Integration

The WebSocket notification system is wired into two core engines:

The **Model Engine** (`server/services/modelEngine.ts`) sends a `model_complete` notification to the requesting user when any analytical model finishes execution. The notification includes the model name, execution time, and a summary of results.

The **Propagation Engine** (`server/services/propagationEngine.ts`) sends `propagation` notifications when cross-layer intelligence cascades are generated. Coaching messages are delivered as `coaching` type notifications with the message content and target role.

### Client-Side Features

The notification bell appears in two locations: the desktop sidebar (below Help and Settings) and the mobile header bar. It displays a real-time unread count badge with a green connection indicator dot. Clicking the bell opens a dropdown panel with:

1. **Type filter tabs** showing counts per notification type (All, Coaching, Intelligence, Alert, Model, etc.)
2. **Notification cards** with type icon, title, body (2-line clamp), priority badge, and time-ago timestamp
3. **Read/unread state** with blue dot indicator and click-to-mark-as-read
4. **Mark all as read** and **Clear all** actions in the header and footer
5. **Empty state** with connection status message

High-priority notifications (critical and high) automatically trigger toast notifications via Sonner, providing immediate visibility even when the notification panel is closed.

### Connection Management

The client-side hook implements automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s) and a maximum of 10 reconnection attempts. The connection status is visible via the green/gray dot on the bell icon. When the connection is lost, the system falls back to the tRPC `notifications.list` endpoint for REST-based polling.

### tRPC Router: `notifications`

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `list` | Query | Protected | Get all notifications for the current user with total and unread counts |
| `unreadCount` | Query | Protected | Get the unread notification count |
| `sendTest` | Mutation | Protected | Send a test notification (development/debugging) |
| `broadcast` | Mutation | Admin | Broadcast a notification to all connected users |
| `connectionStats` | Query | Admin | Get WebSocket connection statistics (total connections, users by role) |

### Per-User Storage

Notifications are stored in-memory on the server with a maximum of 100 notifications per user (oldest are evicted when the limit is reached). Each notification includes an `id`, `type`, `priority`, `title`, `body`, `createdAt` timestamp, `readAt` timestamp (null if unread), and optional `metadata` object for type-specific data.
