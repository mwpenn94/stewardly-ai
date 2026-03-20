# Stewardry — Comprehensive Platform Guide

**Version:** 3.0 | **Updated:** March 20, 2026 | **Author:** Manus AI

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Authentication and Access Model](#authentication-and-access-model)
4. [Core AI Engine](#core-ai-engine)
5. [Data Intelligence Hub](#data-intelligence-hub)
6. [Financial Tools and Calculators](#financial-tools-and-calculators)
7. [Product Marketplace](#product-marketplace)
8. [Compliance and Regulatory Framework](#compliance-and-regulatory-framework)
9. [Communication and Campaigns](#communication-and-campaigns)
10. [Part G — Licensed Operations](#part-g--licensed-operations)
11. [Multi-Modal Capabilities](#multi-modal-capabilities)
12. [Search and Recommendations](#search-and-recommendations)
13. [Organization and Team Management](#organization-and-team-management)
14. [Workflow and Task Engine](#workflow-and-task-engine)
15. [Analytics and Reporting](#analytics-and-reporting)
16. [User Experience and Help System](#user-experience-and-help-system)
17. [API Reference](#api-reference)
18. [Database Schema](#database-schema)
19. [Test Coverage](#test-coverage)
20. [Feature Matrix](#feature-matrix)

---

## Executive Summary

Stewardry is an AI-powered digital financial twin platform designed for financial advisors, insurance professionals, and wealth management firms. The platform combines conversational AI, real-time market data, comprehensive financial calculators, compliance automation, and data intelligence into a unified experience. It supports 91 database tables, 71 tRPC routers, 251 source files, and 410 automated tests across 16 test suites.

The platform operates on a tiered access model: anonymous guests receive full feature access with session-scoped data persistence, authenticated users get permanent data storage and cross-device sync, and administrators gain access to organization management and compliance oversight tools.

---

## Architecture Overview

Stewardry is built on a modern full-stack architecture optimized for real-time AI interactions and financial data processing.

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + Tailwind 4 | UI framework with utility-first styling |
| State Management | tRPC 11 + React Query | End-to-end type-safe API calls with caching |
| Backend | Express 4 + tRPC | HTTP server with RPC-style procedures |
| Database | MySQL/TiDB via Drizzle ORM | Relational storage with 91 tables |
| AI Engine | LLM via Forge API | Multi-model AI with constitutional guardrails |
| File Storage | S3 | Document, image, and media storage |
| Authentication | Manus OAuth + Guest Sessions | Dual-mode auth with session migration |
| Voice | Deepgram + Edge TTS | Speech-to-text and text-to-speech |
| Maps | Google Maps Proxy | Geocoding, directions, and places |
| Charts | Chart.js + react-chartjs-2 | Analytics visualizations |

### Data Flow

The platform follows a request-response pattern through tRPC procedures. Frontend components call typed hooks (`trpc.*.useQuery` / `trpc.*.useMutation`), which route through the Express server to tRPC context. Protected procedures validate the session JWT, inject `ctx.user`, and execute business logic against the database and external services. AI-powered features route through the Forge API with constitutional compliance checks applied at the procedure level.

For data ingestion, the flow is: External Source -> Webhook/Scraper/RSS/API -> Data Ingestion Service -> Quality Scoring -> Ingested Records -> AI Insight Generation -> Insight-to-Action Workflow -> Advisor Notifications.

For email campaigns, the flow is: Campaign Creation -> AI Content Generation -> Recipient Management -> Template Personalization -> Batch Sending -> Status Tracking -> Analytics.

---

## Authentication and Access Model

### Guest Session System

Anonymous visitors automatically receive a guest session when they first interact with the platform. The `/api/auth/guest-session` endpoint creates a temporary user record with `authTier: "anonymous"` and signs a 24-hour session JWT. This allows guests to use all features — chat, calculators, document uploads, market data — with data persisted in the database for the duration of their session.

A persistent GuestBanner appears at the top of the interface, encouraging sign-in to save data permanently. When a guest signs in via Manus OAuth, the `/api/auth/migrate-guest` endpoint transfers all guest data (conversations, documents, calculations) to the authenticated account.

### Access Tiers

| Tier | Capabilities | Data Retention |
|------|-------------|----------------|
| Guest (Anonymous) | All features, session-scoped data | 24 hours |
| Authenticated User | All features, permanent data, cross-device sync | Permanent |
| Manager | Team oversight, client portal, practice intelligence | Permanent |
| Administrator | Organization management, compliance review, global admin | Permanent |

### Page Access Rules

User-facing pages (Chat, Calculators, Products, Education, Insights, Meetings, Workflows, Documents, Settings/Appearance) are accessible to all users including guests. Admin-only pages (Global Admin, Manager Dashboard, Portal, Organizations) display an AuthGate component with a sign-in button and navigation links rather than performing a hard redirect.

---

## Core AI Engine

### Conversational AI

The Chat interface is the primary entry point. It supports three focus modes: **General** (broad topics), **Financial** (advisory-specific), and **Both** (hybrid). The AI processes text, voice, images, documents, and screen captures as input context.

Key capabilities include multi-turn conversations with full history retention, constitutional compliance checking on every response, automatic disclaimer insertion for financial advice, focus mode switching mid-conversation, voice mode with Deepgram STT and Edge TTS, document and image analysis via multi-modal processing, and real-time market data integration into responses.

### AI Tuning

Users can personalize their AI experience through Settings, including communication style adjustment (formality, detail level, tone), knowledge base uploads to train the AI on specific topics, memory episodes where the AI remembers key facts across conversations, and style personalization where the AI adapts to preferred communication patterns.

### Constitutional AI Framework

Every AI response passes through a constitutional compliance layer that flags potential financial advice for review, inserts appropriate disclaimers, maintains audit trails for regulatory compliance, enforces organization-level compliance policies, and supports custom compliance rules per organization.

### Context Layers

The AI assembles a 5-layer prompt from platform defaults, organization rules, professional context, client data, and enrichment datasets. Each layer is auditable and respects role-based visibility.

### Memory System

The AI extracts and stores memories from conversations, categorized by type (preference, fact, goal, concern). Memories are injected into future conversations for personalization and continuity.

---

## Data Intelligence Hub

The Data Intelligence Hub is the platform's central data ingestion and analysis engine, accessible at `/data-intelligence`. It provides 14 tabs for managing data sources, processing pipelines, and AI-generated insights.

### Data Sources and Ingestion

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

### AI Insight Generation

The AI continuously analyzes ingested data to generate actionable insights categorized by severity (Critical, High, Medium, Low, Info), type (market trends, competitor moves, regulatory changes, client opportunities), and confidence score.

### Insight-to-Action Workflow

Critical and high-severity insights automatically generate action items. The AI generates an insight from ingested data, the system creates an action item with a recommended response, critical/high insights trigger owner notifications, advisors review and complete or dismiss actions, and action completion feeds back into the AI for continuous improvement.

---

## Financial Tools and Calculators

The platform provides 20+ financial calculators accessible at `/calculators`:

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
| Divorce Planning | Asset division and financial impact modeling |
| Fee Billing | Advisory fee structure comparison |
| Financial Health Score | Comprehensive financial wellness assessment |
| Client Segmentation | Client base analysis and targeting |
| Annual Review | Year-over-year financial review |
| Plan Adherence | Financial plan tracking and compliance |
| Product Comparator | Side-by-side comparison of insurance and investment products |
| Education Planner | 529 and education funding projections |

All calculators work for guest users with session-scoped data. Results can be discussed with the AI for deeper analysis.

---

## Product Marketplace

The Products section (`/products`) provides a searchable catalog of financial products with AI-powered suitability scoring. Features include product search and filtering by category, carrier, and features; AI suitability scoring based on client profiles; side-by-side product comparison; carrier connection management; and product research mode via enhanced search.

---

## Compliance and Regulatory Framework

### Compliance Copilot

The Compliance Copilot monitors all AI interactions for regulatory compliance with real-time flagging of potential compliance issues, automatic disclaimer insertion, audit trail generation for every conversation, organization-level compliance policy enforcement, and a licensed review queue for flagged interactions.

### Suitability Assessment

A conversational AI-driven suitability questionnaire adapts questions based on previous answers. Results are stored and accessible across the advisory chain, supporting input at varying levels of detail from abstract to highly specific.

### Audit System

Every significant action is logged to the audit trail including user actions (queries, document uploads, calculations), AI responses with compliance flags, administrative actions (role changes, policy updates), and data access events for privacy compliance. Audit logs are append-only.

---

## Communication and Campaigns

### Email Campaign Manager

The Email Campaign Manager (`/email-campaigns`) provides full campaign lifecycle management:

**Campaign Creation** allows setting name, subject, and body with a rich text editor. **AI Content Generation** generates professional email content from prompts with tone selection across professional, friendly, urgent, and educational styles. **Recipient Management** supports bulk adding recipients and filtering by type (all clients, prospects, partners, custom list). **Template Personalization** uses `{{recipientName}}` and `{{recipientEmail}}` tokens that are auto-replaced per recipient. **Batch Sending** delivers to all recipients with per-recipient status tracking. **Campaign Analytics** tracks sent, delivered, opened, and failed counts.

### Notification System

The platform includes a built-in notification system for insight-triggered advisor alerts, campaign completion notifications, compliance review notifications, and task assignment notifications.

---

## Part G — Licensed Operations

Part G provides specialized tools for licensed insurance and advisory operations, accessible through 7 dedicated pages:

| Page | Route | Purpose |
|------|-------|---------|
| Licensed Review | `/licensed-review` | Pending compliance review queue with audit log |
| Agent Operations | `/agent-operations` | Agent monitoring dashboard with performance metrics |
| Insurance Quotes | `/insurance-quotes` | Multi-carrier quote generation and comparison |
| Insurance Applications | `/insurance-applications` | Application status tracking and management |
| Advisory Execution | `/advisory-execution` | Advisory workflow execution dashboard |
| Estate Planning | `/estate-planning` | Estate document drafting wizard with state-specific templates |
| Premium Finance | `/premium-finance` | Premium finance case management with stress testing |

Each page integrates with the corresponding backend router for real-time data and AI-assisted operations. All Part G actions require licensed professional approval and generate complete audit trails.

---

## Multi-Modal Capabilities

### Document Processing

The platform supports OCR text extraction from images and scanned documents via LLM vision, PDF table and form parsing, AI-generated document summaries and key information extraction, and automatic document chunking for knowledge base indexing.

### Visual Analysis

Screen Capture shares screen content with AI for real-time analysis with pause/resume support. Video Capture uses the camera feed with periodic frame capture for visual context. Image Analysis accepts uploaded images for AI interpretation. The Annotation System supports highlighting, circling, and annotating visual content with persistent context storage.

### Voice and Audio

Speech-to-Text uses Deepgram-powered real-time transcription. Text-to-Speech uses Edge TTS with 25+ natural voices across 6 locales. Voice Mode provides hands-free conversational interaction with continuous listening and audible processing cues. Audio Transcription transcribes uploaded audio and video files.

### LiveChat Mode

LiveChat Mode combines continuous visual and verbal AI interaction with simultaneous screen sharing and voice conversation, real-time frame analysis with spoken responses, and pause/resume controls for both video and audio streams.

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

---

## Workflow and Task Engine

### Workflow Orchestrator

The Workflow Orchestrator manages multi-step business processes with configurable workflow templates, automatic task assignment based on roles, progress tracking with status updates, and integration with the AI for automated decision points.

### Task Engine

The Task Engine handles individual task management with task creation from insights, workflows, or manual entry; priority levels and due date tracking; assignment to team members; and status tracking (pending, in-progress, completed, dismissed).

---

## Analytics and Reporting

### Dashboard Analytics

The Analytics Dashboard (Data Intelligence Hub, Analytics tab) provides 7 Chart.js visualizations:

| Chart | Type | Data |
|-------|------|------|
| Ingestion Volume | Line | Records ingested over time (7d/30d/90d) |
| Data Quality Trends | Line | Average quality scores over time |
| Insight Severity | Doughnut | Distribution by critical/high/medium/low/info |
| Insight Types | Bar | Count by insight category |
| Job Status | Doughnut | Completed/running/failed/pending jobs |
| Action Status | Bar | Pending/completed/dismissed actions |
| Source Breakdown | Pie | Records by data source type |

The dashboard also includes 6 summary stat cards: Total Records, Active Sources, Average Quality, Total Insights, Pending Actions, and Active Jobs.

### Insights Dashboard

The Insights page (`/insights`) provides AI-generated financial insights based on user data, market trend analysis, portfolio performance summaries, and actionable recommendations.

---

## User Experience and Help System

### Onboarding Tour

New users are greeted with a 15-step guided tour covering: welcome and platform overview, AI Chat and focus modes, voice mode, context sharing (documents, screen, camera), sidebar navigation, market data, financial planning tools, compliance features, Data Intelligence Hub, settings and personalization, email campaigns, product marketplace, guest access explanation, help system introduction, and completion with next steps.

### Contextual Help

A floating help button (bottom-right, or `Ctrl+/`) provides page-specific assistance across three categories: Tips (contextual guidance for the current page), Shortcuts (keyboard shortcuts relevant to the current context), and FAQ (frequently asked questions about the current feature). Help content adapts automatically based on the current route.

### GuestBanner

Guest users see a persistent banner encouraging sign-in, with a clear explanation that their session data will be preserved upon authentication.

### AuthGate

Admin-only pages display a friendly AuthGate component with a clear explanation of why sign-in is required, a sign-in button linking to Manus OAuth, and navigation links back to Chat and Home.

---

## API Reference

### tRPC Routers (71 total)

The platform exposes 71 tRPC routers organized by domain:

| Category | Routers |
|----------|---------|
| Core | auth, system, settings, conversations, chat, memories, memoryEpisodes |
| AI | aiLayers, ambient, constitutionalAI, multiModel, complianceCopilot, visual |
| Financial | calculators, taxProjector, equityComp, digitalAssets, divorceAnalysis, charitableGiving, businessExit, feeBilling, financialHealth, ssOptimizer, hsaOptimizer, ltcPlanner, medicareNav, educationPlanner, annualReview, planAdherence |
| Products | products, matching, recommendation, suitability |
| Data | dataIngestion, dataIngestionEnhanced, scheduledIngestion, webhookIngestion, analytics, searchEnhanced |
| Compliance | compliance, review, knowledgeGraph |
| Communication | comms, emailCampaign, voice, meetings, feedback |
| Organization | organizations, orgBranding, portal, portalOptimizer, practiceIntelligence, clientSegmentation, relationships, coi |
| Operations | workflowOrchestrator, workflow, taskEngine, featureFlags, anonymousChat, multiModalProcessing |
| Part G | agentic (sub-routers for licensed review, agent ops, quotes, applications, advisory, estate, premium finance) |
| Education | education, studentLoans, studyBuddy, medicare |
| Market | market |

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

The platform uses 91 MySQL/TiDB tables organized by domain:

| Domain | Count | Key Tables |
|--------|-------|------------|
| Users and Auth | 8 | users, sessions, email_verifications, user_profiles, user_settings, tos_consents, style_profiles, professional_contexts |
| Organizations | 5 | organizations, user_organization_roles, organization_relationships, org_branding, org_products |
| Conversations and AI | 12 | conversations, messages, memories, feedback, review_queue, ai_layers, constitutional_rules, prompt_variants, ab_test_assignments, ab_test_results, memory_episodes, ambient_contexts |
| Documents and Knowledge | 6 | documents, document_chunks, knowledge_graph_nodes, knowledge_graph_edges, search_cache, annotations |
| Financial Planning | 14 | suitability_assessments, products, product_features, financial_health_scores, plan_adherence_records, tax_projections, ss_optimization_plans, hsa_plans, medicare_plans, charitable_giving_plans, education_plans, student_loan_strategies, equity_comp_plans, digital_asset_portfolios |
| Insurance and Advisory | 10 | licensed_reviews, agent_operations, carrier_connections, insurance_quotes, insurance_applications, advisory_actions, estate_documents, premium_finance_cases, coi_records, fee_billing_records |
| Data Ingestion | 10 | data_sources, ingested_records, ingestion_jobs, data_quality_scores, scrape_schedules, ingestion_insights, bulk_import_batches, insight_actions, enrichment_datasets, enrichment_cohorts |
| Communication | 3 | email_campaigns, email_sends, comms_messages |
| Platform Operations | 14 | feature_flags, workflow_checklists, task_engine_tasks, meetings, client_segmentation_profiles, practice_intelligence_reports, annual_review_sessions, portal_optimizer_configs, business_exit_plans, divorce_financial_analyses, ltc_plans, multi_model_configs, workflow_orchestrator_flows |

---

## Test Coverage

The platform maintains 410 automated tests across 16 test suites:

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

## Deployment

The platform is hosted on Manus infrastructure with built-in custom domain support (stewardry.manus.space), SSL/TLS encryption, database backups, S3 file storage, and CDN for static assets. To publish updates, create a checkpoint via the development workflow and click the Publish button in the Management UI.

---

*This guide is auto-generated and reflects the current state of the Stewardry platform as of March 20, 2026.*
