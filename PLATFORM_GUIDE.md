# Stewardry — Comprehensive Platform Guide

**Version:** 4.0 | **Updated:** March 20, 2026 | **Author:** Manus AI

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Design System and Visual Identity](#design-system-and-visual-identity)
4. [Authentication and Access Model](#authentication-and-access-model)
5. [Core AI Engine](#core-ai-engine)
6. [Chat Interface and Interaction Modes](#chat-interface-and-interaction-modes)
7. [Data Intelligence Hub](#data-intelligence-hub)
8. [Financial Tools and Calculators](#financial-tools-and-calculators)
9. [Product Marketplace](#product-marketplace)
10. [Compliance and Regulatory Framework](#compliance-and-regulatory-framework)
11. [Communication and Campaigns](#communication-and-campaigns)
12. [Part G — Licensed Operations](#part-g--licensed-operations)
13. [Multi-Modal Capabilities](#multi-modal-capabilities)
14. [Search and Recommendations](#search-and-recommendations)
15. [Organization and Team Management](#organization-and-team-management)
16. [Workflow and Task Engine](#workflow-and-task-engine)
17. [Analytics and Reporting](#analytics-and-reporting)
18. [User Experience and Help System](#user-experience-and-help-system)
19. [Accessibility and Mobile Responsiveness](#accessibility-and-mobile-responsiveness)
20. [Navigation and Page Map](#navigation-and-page-map)
21. [API Reference](#api-reference)
22. [Database Schema](#database-schema)
23. [Test Coverage](#test-coverage)
24. [Feature Matrix](#feature-matrix)
25. [Deployment and Infrastructure](#deployment-and-infrastructure)

---

## Executive Summary

Stewardry is an AI-powered digital financial twin platform designed for financial advisors, insurance professionals, and wealth management firms. The platform combines conversational AI with real-time market data, comprehensive financial calculators, compliance automation, data intelligence pipelines, email campaign management, and multi-modal interaction into a unified experience. It is built to function as an always-available co-pilot for financial professionals — handling everything from client suitability assessments to estate document drafting, from premium finance modeling to autonomous agent orchestration.

The platform comprises **90 database tables** defined in the Drizzle ORM schema (with 40 currently migrated to production), **72 tRPC routers** exposing **368 procedures**, **45 page-level components**, **74 reusable UI components** (including 50+ shadcn/ui primitives), and **249 source files** totaling approximately **60,865 lines of TypeScript/TSX**. The automated test suite contains **410 tests** across **16 test files**, all passing.

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
| **Authentication** | Manus OAuth + Guest Sessions | Dual-mode auth with automatic session migration |
| **Voice** | Deepgram STT + Edge TTS (25+ voices) | Speech-to-text transcription and natural text-to-speech |
| **Maps** | Google Maps Proxy | Geocoding, directions, places, and visualization |
| **Charts** | Chart.js + react-chartjs-2 | Analytics and financial data visualizations |
| **UI Components** | shadcn/ui (50+ components) | Consistent, accessible component library |
| **Routing** | Wouter | Lightweight client-side routing |
| **Serialization** | SuperJSON | Preserves Date, BigInt, and other types across tRPC boundary |

### Codebase Metrics

| Metric | Value |
|--------|-------|
| Total source files | 249 |
| Total lines of code | 60,865 |
| Page components | 45 |
| Reusable components | 74 |
| tRPC routers | 72 |
| tRPC procedures | 368 |
| Database tables (schema) | 90 |
| Database tables (migrated) | 40 |
| Router files (server/routers/) | 27 |
| Main router file (server/routers.ts) | 1,099 lines |
| Database helpers (server/db.ts) | 413 lines |
| CSS theme file (index.css) | 248 lines |
| Test files | 16 |
| Automated tests | 410 |

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

A persistent **GuestBanner** appears at the top of the interface, encouraging sign-in to save data permanently. When a guest signs in via Manus OAuth, the `/api/auth/migrate-guest` endpoint transfers all guest data (conversations, documents, calculations) to the authenticated account.

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

**Admin Section** (role-gated):

| Label | Route | Minimum Role |
|-------|-------|-------------|
| Portal | `/portal` | Advisor |
| Organizations | `/organizations` | Advisor |
| Manager Dashboard | `/manager` | Manager |
| Global Admin | `/admin` | Admin |

### Additional Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Public landing page with hero and features |
| `/signin` | SignIn | Authentication entry point |
| `/welcome` | Welcome | Post-auth welcome with feature highlights |
| `/terms` | Terms | Terms of service |
| `/org/:slug` | OrgLanding | Organization-specific landing page |
| `/settings` | SettingsHub | User settings (6 tabs) |
| `/settings/:tab` | SettingsHub | Direct tab access |
| `/documents` | Documents | Document management |
| `/suitability` | Suitability | Suitability assessment |
| `/ai-settings` | AISettings | AI model configuration |
| `/org-branding` | OrgBrandingEditor | Organization branding |
| `/carrier-connector` | CarrierConnector | Carrier API connections |
| `/market` | MarketData | Real-time market data |
| `/404` | NotFound | 404 error page |

---

## API Reference

### tRPC Routers (72 total)

The platform exposes 72 tRPC routers organized by domain:

| Category | Routers |
|----------|---------|
| **Core** | auth, system, settings, conversations, chat, memories, memoryEpisodes |
| **AI** | aiLayers, ambient, constitutionalAI, multiModel, complianceCopilot, visual |
| **Financial** | calculators, taxProjector, equityComp, digitalAssets, divorceAnalysis, charitableGiving, businessExit, feeBilling, financialHealth, ssOptimizer, hsaOptimizer, ltcPlanner, medicareNav, educationPlanner, annualReview, planAdherence |
| **Products** | products, matching, recommendation, suitability |
| **Data** | dataIngestion, dataIngestionEnhanced, scheduledIngestion, webhookIngestion, analytics, searchEnhanced |
| **Compliance** | compliance, review, knowledgeGraph |
| **Communication** | comms, emailCampaign, voice, meetings, feedback |
| **Organization** | organizations, orgBranding, portal, portalOptimizer, practiceIntelligence, clientSegmentation, relationships, coi |
| **Operations** | workflowOrchestrator, workflow, taskEngine, featureFlags, anonymousChat, multiModalProcessing |
| **Part G** | agentic (sub-routers: gate, agent, quote, application, advisory, estate, premiumFinance, carrier) |
| **Education** | education, studentLoans, studyBuddy, medicare |
| **Market** | market |

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

The platform defines **90 MySQL/TiDB tables** in the Drizzle ORM schema, with **40 currently migrated** to production. Tables are organized by domain:

| Domain | Count | Key Tables |
|--------|-------|------------|
| **Users and Auth** | 8 | users, user_profiles, user_preferences, user_relationships, professional_context, view_as_audit_log, privacy_audit |
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

---

## Test Coverage

The platform maintains **410 automated tests** across **16 test suites**, all passing:

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

---

## Feature Matrix

| Feature | Guest | User | Manager | Admin |
|---------|-------|------|---------|-------|
| AI Chat (all modes) | Yes | Yes | Yes | Yes |
| Voice Mode | Yes | Yes | Yes | Yes |
| Financial Calculators | Yes | Yes | Yes | Yes |
| Product Marketplace | Yes | Yes | Yes | Yes |
| Document Upload/Analysis | Yes | Yes | Yes | Yes |
| Market Data | Yes | Yes | Yes | Yes |
| Education Hub | Yes | Yes | Yes | Yes |
| Data Intelligence Hub | No | Yes | Yes | Yes |
| Email Campaigns | No | Yes | Yes | Yes |
| Insights Dashboard | No | Yes | Yes | Yes |
| Workflow Management | No | Yes | Yes | Yes |
| Settings (Appearance) | Yes | Yes | Yes | Yes |
| Settings (Full) | No | Yes | Yes | Yes |
| Client Portal | No | No | Yes | Yes |
| Practice Intelligence | No | No | Yes | Yes |
| Team Management | No | No | Yes | Yes |
| Organization Admin | No | No | No | Yes |
| Global Admin | No | No | No | Yes |
| Compliance Review | No | No | No | Yes |

---

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

*This guide reflects the current state of the Stewardry platform as of March 20, 2026. Version 4.0.*
