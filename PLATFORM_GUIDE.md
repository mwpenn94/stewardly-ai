# Stewardry — Comprehensive Platform Documentation

**Version:** 2.0 | **Last Updated:** March 20, 2026 | **Author:** Manus AI

---

## 1. Executive Summary

Stewardry is an AI-powered digital financial twin platform that combines conversational AI, multi-modal data processing, financial planning tools, and regulatory compliance into a unified advisory ecosystem. The platform serves individual users, financial professionals, managers, and administrators through a role-based architecture with 89 database tables, 67 tRPC routers, 236 source files totaling 57,000+ lines of code, and 370 automated tests across 15 test suites.

The platform is built on a React 19 + Tailwind CSS 4 + Express 4 + tRPC 11 stack with Manus OAuth, TiDB (MySQL-compatible) database, S3 file storage, and integrated LLM services. It supports real-time chat streaming, voice interaction, screen/video capture, document processing, market data feeds, and a comprehensive data ingestion pipeline.

---

## 2. Architecture Overview

### 2.1 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui | Responsive UI with dark luxury theme |
| State Management | tRPC React Query hooks | Type-safe server state |
| Backend | Express 4, tRPC 11 | API layer with end-to-end type safety |
| Database | TiDB (MySQL-compatible) via Drizzle ORM | 89 tables with full relational model |
| Authentication | Manus OAuth + Email Auth + Anonymous | Progressive auth tiers |
| File Storage | S3 via storagePut/storageGet helpers | Document and media storage |
| AI Services | Built-in LLM (invokeLLM), Edge TTS, Whisper | Chat, voice, transcription |
| Image Generation | Built-in generateImage service | Visual content creation |
| Real-time | tRPC streaming subscriptions | Chat streaming, live updates |

### 2.2 Database Schema

The platform uses 89 MySQL tables organized into the following domains:

**Core User & Auth (8 tables):** users, sessions, email_verifications, user_profiles, user_settings, tos_consents, style_profiles, professional_contexts

**Organizations & Roles (5 tables):** organizations, user_organization_roles, organization_relationships, org_branding, org_products

**Conversations & AI (12 tables):** conversations, messages, memories, feedback, review_queue, ai_layers, constitutional_rules, prompt_variants, ab_test_assignments, ab_test_results, memory_episodes, ambient_contexts

**Documents & Knowledge (6 tables):** documents, document_chunks, knowledge_graph_nodes, knowledge_graph_edges, search_cache, annotations

**Financial Planning (14 tables):** suitability_assessments, products, product_features, financial_health_scores, plan_adherence_records, tax_projections, ss_optimization_plans, hsa_plans, medicare_plans, charitable_giving_plans, education_plans, student_loan_strategies, equity_comp_plans, digital_asset_portfolios

**Insurance & Advisory (10 tables):** licensed_reviews, agent_operations, carrier_connections, insurance_quotes, insurance_applications, advisory_actions, estate_documents, premium_finance_cases, coi_records, fee_billing_records

**Data Ingestion (10 tables):** data_sources, ingested_records, ingestion_jobs, data_quality_scores, scrape_schedules, ingestion_insights, bulk_import_batches, insight_actions, enrichment_datasets, enrichment_cohorts

**Platform Operations (14 tables):** feature_flags, workflow_checklists, task_engine_tasks, comms_messages, meetings, client_segmentation_profiles, practice_intelligence_reports, annual_review_sessions, portal_optimizer_configs, business_exit_plans, divorce_financial_analyses, ltc_plans, multi_model_configs, workflow_orchestrator_flows

---

## 3. Feature Catalog

### 3.1 AI Chat Engine

The core of the platform is a conversational AI engine that serves as a digital financial twin. It supports:

**Multi-Mode Operation:** Users can switch between General, Financial, or Both focus modes. The system prompt dynamically adjusts based on the selected focus, incorporating relevant context layers, compliance guardrails, and domain-specific knowledge.

**Streaming Responses:** Chat uses tRPC streaming to deliver tokens in real-time with auto-scroll and typing indicators. Responses include inline disclaimers for financial topics and support markdown rendering via the Streamdown component.

**Context Layers:** The AI assembles a 5-layer prompt from platform defaults, organization rules, professional context, client data, and enrichment datasets. Each layer is auditable and respects role-based visibility.

**Memory System:** The AI extracts and stores memories from conversations, categorized by type (preference, fact, goal, concern). Memories are injected into future conversations for personalization.

**Constitutional AI:** A guardrail system ensures responses comply with regulatory requirements, ethical standards, and organizational policies. Rules are configurable per organization.

### 3.2 Voice & Multi-Modal Interaction

**Hands-Free Voice Mode:** Continuous speech recognition via Web Speech API with automatic silence detection. The AI responds with natural speech via Edge TTS (25+ voices, 6 locales). A state machine manages the listen → process → speak → listen cycle with audible cues.

**Screen Capture:** Real-time screen sharing via the Screen Capture API. Supports pause/resume, frame capture for AI analysis, and region preview before sending.

**Video Capture:** Live camera feed via getUserMedia. Periodic frame capture sends visual context to the LLM for analysis. Supports hands-free visual + verbal conversation.

**LiveChat Mode:** A combined mode that streams camera/screen video while maintaining continuous speech recognition. The AI sees what you see and hears what you say, responding with voice in real-time.

**Document Processing:** Upload PDFs, images, and documents for OCR text extraction, table parsing, form recognition, and content summarization. Processed content is indexed for RAG retrieval.

### 3.3 Financial Planning Tools

| Calculator | Description |
|-----------|-------------|
| IUL Projection | Indexed Universal Life insurance projections with illustrated rates |
| Premium Finance ROI | Loan-based premium financing with stress testing (+400bps) |
| Retirement Aggregator | Multi-source retirement planning with inflation adjustment |
| Product Comparator | Side-by-side comparison of insurance and investment products |
| Tax Projector | Federal and state tax estimation with optimization strategies |
| Social Security Optimizer | Claiming strategy analysis for maximum lifetime benefits |
| HSA Optimizer | Health Savings Account contribution and investment planning |
| Medicare Navigator | Medicare plan comparison and enrollment guidance |
| Charitable Giving | Tax-efficient charitable giving strategies |
| Education Planner | 529 and education funding projections |
| Student Loan Analyzer | Repayment strategy comparison and forgiveness analysis |
| Equity Comp Planner | Stock option and RSU vesting/exercise optimization |
| Digital Asset Manager | Cryptocurrency and digital asset portfolio tracking |
| LTC Planner | Long-term care insurance needs analysis |
| Business Exit Planner | Business valuation and succession planning |
| Divorce Financial Analyst | Asset division and financial impact modeling |

### 3.4 Data Intelligence Hub

The Data Intelligence Hub provides comprehensive data ingestion, processing, and insight generation:

**Data Sources:** Register and manage data sources with configurable scrape schedules (hourly to monthly). Supports web URLs, RSS/Atom feeds, sitemaps, API endpoints, and manual uploads.

**Bulk Ingestion:** Scrape up to 100 URLs simultaneously with concurrent processing. Sitemap crawling automatically discovers and ingests all pages from a domain.

**RSS Feed Monitoring:** Subscribe to RSS/Atom feeds for continuous content ingestion. Auto-detects feed format and extracts structured content.

**Competitor Intelligence:** AI-powered analysis of competitor websites, extracting product offerings, pricing signals, market positioning, and strategic insights.

**Product Catalog Parsing:** Automated extraction of product details, features, and pricing from web pages and documents.

**CSV/Excel Upload:** Paste or upload tabular data with automatic column mapping, header detection, and batch tracking.

**Data Quality Scoring:** Automated quality assessment of ingested data across completeness, accuracy, freshness, and consistency dimensions.

**AI Insight Generation:** LLM-powered analysis of ingested data to surface trends, anomalies, opportunities, and risks with severity-based prioritization.

**Insight-to-Action Workflow:** Critical and high-severity insights automatically generate action items, trigger advisor notifications, and integrate with the task engine.

**Scheduled Automation:** Cron-based scheduling with 7 frequency presets. Enable/pause/run-now controls for each schedule.

### 3.5 Insurance & Advisory Operations (Part G)

**Licensed Review Queue:** Tier-4 actions (insurance applications, trade execution) require licensed professional approval. Pending items are queued with full context, and approvals are audited.

**Agent Operations Dashboard:** Monitor agent activity, carrier connections, state appointments, and compliance metrics. Register and manage carrier integrations.

**Insurance Quotes:** Multi-carrier quote generation with side-by-side comparison. Quotes include mandatory disclaimers and are linked to client suitability profiles.

**Insurance Applications:** End-to-end application workflow from quote selection through submission, underwriting, and policy issuance. Every step requires licensed approval.

**Advisory Execution:** Investment and advisory action execution with RIA approval gates. Tracks pending, approved, and executed actions with full audit trail.

**Estate Planning:** State-specific document generation for wills, trusts, powers of attorney, and healthcare directives. All documents include attorney review disclaimers.

**Premium Finance:** Case management for premium-financed life insurance with stress testing, collateral tracking, and ROI analysis.

### 3.6 Organization & Role Management

**Multi-Tenant Architecture:** Organizations have independent branding, product shelves, compliance rules, and AI layer configurations. Users can belong to multiple organizations with different roles.

**Role Hierarchy:** Four-tier role system (user → advisor → manager → admin) with granular permissions. Global admins see all organizations; firm admins see only their firm; managers see their team; professionals see their clients.

**Organization Branding:** Custom color schemes, logos, and descriptions per organization. AI-powered color scheme detection from uploaded logos.

**Matching & Recommendations:** Best-fit algorithms match users with professionals and organizations based on expertise, location, specialization, and client needs.

**Invitation System:** Email-based invitations for on-platform and off-platform users. Invitations track status (pending, accepted, declined, expired).

### 3.7 Compliance & Governance

**Suitability Assessment:** Conversational AI-driven suitability questionnaire that adapts questions based on previous answers. Results are stored and accessible across the advisory chain.

**Audit Trail:** Every action — chat messages, document uploads, review decisions, settings changes — is logged with timestamps, user IDs, and context. Audit logs are append-only.

**Terms of Service:** First-time consent flow with versioned ToS and Privacy Policy. Consent is stored with timestamps and is required before platform access.

**Data Governance:** Tiered visibility (private → professional → management → admin) for documents and data. Users control visibility per upload.

**Compliance Copilot:** AI-assisted compliance monitoring that detects regulated conversations, flags potential issues, and suggests corrective actions.

---

## 4. API Reference

### 4.1 Router Catalog

The platform exposes 67 tRPC routers organized into functional domains:

**Core:** auth, chat, conversations, documents, settings, voice, feedback, memories, visual

**Financial:** calculators, market, products, suitability, financialHealth, taxProjector, ssOptimizer, hsaOptimizer, medicareNav, charitableGiving, educationPlanner, studentLoans, equityComp, digitalAssets, ltcPlanner, businessExit, divorce

**Insurance (Agentic):** agentic.licensedReview, agentic.agentOperations, agentic.insuranceQuotes, agentic.insuranceApplications, agentic.advisoryExecution, agentic.estatePlanning, agentic.premiumFinance

**Organizations:** organizations, orgBranding, relationships, matching, recommendation, portal, portalOptimizer

**AI & Intelligence:** aiLayers, constitutional, complianceCopilot, multiModel, ambient, knowledgeGraph, memoryEpisodes, searchEnhanced, multiModalProcessing

**Data:** dataIngestion, dataIngestionEnhanced, scheduledIngestion

**Operations:** workflow, workflowOrchestrator, taskEngine, comms, feeBilling, featureFlags, annualReview, clientSegmentation, practiceIntelligence, planAdherence

**Auth:** emailAuth, anonymousChat

### 4.2 Authentication

All procedures use one of three access levels:

| Level | Description | Use Case |
|-------|-------------|----------|
| `publicProcedure` | No auth required | auth.me, anonymousChat |
| `protectedProcedure` | Requires valid session | Most features |
| `adminProcedure` | Requires admin role | Organization management, feature flags |

---

## 5. Frontend Architecture

### 5.1 Page Structure

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Chat.tsx | Main conversational interface (landing page) |
| `/about` | About.tsx | Platform information and features |
| `/market` | MarketData.tsx | Real-time market data dashboard |
| `/tools` | FinancialTools.tsx | Financial calculators suite |
| `/documents` | Documents.tsx | Document management and upload |
| `/products` | Products.tsx | Product catalog and comparison |
| `/settings` | Settings.tsx | User preferences and profile |
| `/data-intelligence` | DataIntelligence.tsx | Data ingestion hub (13 tabs) |
| `/licensed-review` | PartGPages.tsx | Licensed review queue |
| `/agent-operations` | PartGPages.tsx | Agent operations dashboard |
| `/insurance-quotes` | PartGPages.tsx | Insurance quote management |
| `/insurance-applications` | PartGPages.tsx | Application workflow |
| `/advisory-execution` | PartGPages.tsx | Advisory action execution |
| `/estate-planning` | PartGPages.tsx | Estate document management |
| `/premium-finance` | PartGPages.tsx | Premium finance cases |
| `/terms` | Terms.tsx | Terms of Service |
| `/privacy` | Privacy.tsx | Privacy Policy |

### 5.2 Key Components

**DashboardLayout:** Sidebar navigation with collapsible sections, user profile, and role-based menu filtering. Used for all authenticated pages.

**AIChatBox:** Full-featured chat interface with message history, streaming support, markdown rendering, and context sharing buttons.

**OnboardingTour:** AI-guided walkthrough with spotlight highlighting and contextual tooltips. Auto-starts for first-time users.

**LiveChatMode:** Combined video/screen capture with continuous speech recognition for hands-free visual + verbal AI conversation.

**CaptureModal:** Screen and video capture interface with preview, pause/resume, and frame extraction.

### 5.3 Design System

The platform uses a dark luxury financial theme with the following design tokens:

- **Primary:** Navy (#1B2A4A) with gold accents (#D4A843)
- **Typography:** Inter for body text, system fonts for UI elements
- **Shadows:** Soft elevation system with 3 levels
- **Radius:** Consistent 8px border radius
- **Spacing:** 4px grid system

---

## 6. Testing & Quality

### 6.1 Test Coverage

| Suite | Tests | Coverage Area |
|-------|-------|--------------|
| functional.test.ts | 36 | Chat, CRUD, auth, documents, market, calculators, suitability, memory, settings |
| security.test.ts | 19 | JWT, XSS, SQL injection, CSRF, file upload, session, audit, access control |
| roleHierarchy.test.ts | 9 | Admin, firm admin, manager, professional, unaffiliated, transitions, audit, layers |
| platform.test.ts | 47 | Performance, responsive, accessibility, compliance, integration, Part G (14 sub-suites) |
| comprehensive.test.ts | 61 | End-to-end feature verification |
| portal.test.ts | 20 | Portal and organization features |
| chat.test.ts | 21 | Chat streaming and message handling |
| dataIngestion.test.ts | 42 | Data source management and ingestion |
| dataIngestionEnhanced.test.ts | 30 | Bulk scraping, RSS, competitor intel |
| v4features.test.ts | 24 | V4 feature set verification |
| aiTuning.test.ts | 19 | AI layer and tuning configuration |
| edgeTTS.test.ts | 16 | Voice synthesis and TTS |
| products-ai.test.ts | 8 | Product AI recommendations |
| routers.audit.test.ts | 17 | Router audit trail completeness |
| auth.logout.test.ts | 1 | Session cleanup verification |
| **Total** | **370** | **Full platform coverage** |

### 6.2 Test Categories

**Functional (TEST-FUNC):** Verifies core user workflows — chat streaming, conversation CRUD, hand-off flow, progressive auth, document management, market data, calculators, suitability, memory, and settings.

**Security (TEST-SEC):** Validates JWT authentication, XSS prevention, SQL injection protection, CSRF defense, file upload validation, session management, prompt isolation, and data access control.

**Role Hierarchy (TEST-ROLE):** Confirms role-based access at all levels — global admin, firm admin, manager, professional, unaffiliated user — plus affiliation transitions and 5-layer prompt inheritance.

**Performance (TEST-PERF):** Measures router initialization speed, auth check latency, batch access patterns, memory efficiency, and concurrent operation handling.

**Compliance (TEST-COMP):** Verifies AI disclaimer presence, regulated conversation detection, retention lock enforcement, GDPR data export, human escalation paths, and audit trail completeness.

**Integration (TEST-INT):** Tests Plaid account linking, Daily.co video calls, and LLM streaming error recovery with rate limit handling.

**Part G (TEST-GATE/QUOTE/APP/INVEST/ESTATE/FINANCE/AGENT-SEC):** Validates license gates, multi-carrier quotes, application approval flows, trade execution controls, state-specific documents, premium finance stress tests, and agent tenant isolation.

---

## 7. Data Ingestion Pipeline

### 7.1 Pipeline Architecture

The data ingestion pipeline follows a 5-stage process:

1. **Source Registration:** Define data sources with type (web, RSS, API, file), URL, and scrape configuration.
2. **Ingestion:** Execute scraping, parsing, or API calls to extract raw content. Supports concurrent batch processing.
3. **Processing:** Clean, normalize, and structure extracted data. Apply OCR for images, transcription for audio/video.
4. **Quality Scoring:** Assess data quality across 4 dimensions (completeness, accuracy, freshness, consistency) with weighted scoring.
5. **Insight Generation:** AI analyzes processed data to surface actionable insights with severity-based prioritization.

### 7.2 Supported Ingestion Methods

| Method | Capacity | Description |
|--------|----------|-------------|
| Single URL Scrape | 1 URL | Extract content from a single web page |
| Bulk URL Scrape | Up to 100 URLs | Concurrent scraping with progress tracking |
| Sitemap Crawl | Unlimited | Discover and ingest all pages from a sitemap |
| RSS/Atom Feed | Continuous | Subscribe to feeds for ongoing content ingestion |
| API Feed | Configurable | Pull data from REST APIs with custom headers |
| CSV/TSV Upload | Unlimited rows | Paste or upload tabular data with column mapping |
| Document Upload | Per file | Process PDFs, images, and documents for content extraction |

### 7.3 Scheduled Automation

Schedules support 7 frequency presets: every 15 minutes, hourly, every 6 hours, daily, weekly, biweekly, and monthly. Each schedule can be enabled, paused, or triggered manually. The cron runner processes due schedules and creates ingestion jobs automatically.

---

## 8. Deployment & Operations

### 8.1 Environment Variables

The platform uses the following environment variables (automatically injected by the Manus platform):

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | TiDB/MySQL connection string |
| JWT_SECRET | Session cookie signing |
| VITE_APP_ID | Manus OAuth application ID |
| OAUTH_SERVER_URL | OAuth backend URL |
| BUILT_IN_FORGE_API_URL | LLM and service API endpoint |
| BUILT_IN_FORGE_API_KEY | Server-side API authentication |
| VITE_FRONTEND_FORGE_API_KEY | Client-side API authentication |
| PLAID_CLIENT_ID | Plaid financial data integration |
| PLAID_SECRET | Plaid API secret |
| DAILY_API_KEY | Daily.co video conferencing |
| DEEPGRAM_API_KEY | Speech transcription |

### 8.2 Custom Domains

The platform is accessible at:
- **wealthai-gakeferp.manus.space**
- **stewardry.manus.space**

Custom domains can be configured through the Manus Management UI under Settings → Domains.

---

## 9. Security Model

### 9.1 Authentication Flow

The platform implements progressive authentication with 4 tiers:

1. **Anonymous:** Basic chat access via anonymousChat router. No data persistence.
2. **Email Verified:** Email-based authentication for basic features. Limited data storage.
3. **Full OAuth:** Manus OAuth with session cookies. Full platform access based on role.
4. **Advisor-Connected:** Full access plus professional advisory features and compliance tracking.

### 9.2 Data Protection

All data is protected through multiple layers:

- **Transport:** HTTPS with TLS 1.3
- **Authentication:** JWT-based session cookies with httpOnly, Secure, and SameSite attributes
- **Authorization:** Role-based access control with per-procedure enforcement
- **Data Isolation:** All queries filter by userId to prevent cross-user data access
- **Audit Logging:** Append-only audit trail for all state-changing operations
- **PII Protection:** Automated PII detection and masking in chat responses

---

## 10. Appendix

### 10.1 File Structure Summary

```
wealthbridge-ai/
├── client/                    # Frontend (React 19 + Tailwind 4)
│   ├── src/
│   │   ├── pages/             # 15+ page components
│   │   ├── components/        # 20+ reusable components
│   │   ├── hooks/             # Custom hooks (capture, auth, tour)
│   │   ├── contexts/          # React contexts
│   │   └── lib/               # tRPC client, utilities
│   └── index.html
├── server/                    # Backend (Express + tRPC)
│   ├── routers/               # 30+ feature routers
│   ├── services/              # Business logic services
│   ├── _core/                 # Framework plumbing
│   ├── *.test.ts              # 15 test files (370 tests)
│   ├── db.ts                  # Database helpers
│   ├── routers.ts             # Router registration (67 routers)
│   └── storage.ts             # S3 helpers
├── drizzle/                   # Database schema (89 tables)
│   └── schema.ts
├── shared/                    # Shared types and constants
├── todo.md                    # Feature tracking (1200+ items)
└── PLATFORM_GUIDE.md          # This document
```

### 10.2 Key Metrics

| Metric | Value |
|--------|-------|
| Source Files | 236 |
| Lines of Code | 57,454 |
| Database Tables | 89 |
| tRPC Routers | 67 |
| Test Files | 15 |
| Test Cases | 370 |
| Todo Items Completed | 1,200+ |
| Frontend Pages | 15+ |
| Reusable Components | 20+ |
| Financial Calculators | 16 |
| Data Ingestion Methods | 7 |
