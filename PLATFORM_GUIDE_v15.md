# Stewardly Platform Guide v15.0

**Intelligence-First Financial Advisory Platform**
*Last Updated: March 21, 2026*

---

## Executive Summary

Stewardly is an enterprise-grade, intelligence-first financial advisory platform that consolidates wealth management, insurance advisory, compliance, and client relationship management into a unified AI-powered experience. The platform serves financial professionals (advisors, agents, planners), their organizations, and end clients through a conversational AI interface augmented by 8 financial models, 7 capability modes, a dynamic knowledge base, and 36 specialized backend services.

### Platform at a Glance

| Metric | Count |
|---|---|
| **Source Files** | 384 TypeScript/TSX files |
| **Lines of Code** | 99,203 |
| **Backend Services** | 65 |
| **tRPC Router Files** | 45 |
| **Frontend Pages** | 55 |
| **UI Components** | 29 |
| **Database Tables** | 199 (Drizzle ORM + TiDB) |
| **Test Files** | 36 |
| **Tests Passing** | 1,032 |
| **Financial Models** | 8 |
| **Capability Modes** | 7 |
| **AI Tools (callable from chat)** | 12+ |

---

## Architecture Overview

### Intelligence-First Design

The platform follows an intelligence-first architecture where the AI chat interface is the primary interaction surface. Rather than navigating through dozens of separate pages, users interact conversationally and the AI invokes tools, runs models, searches the knowledge base, and renders rich responses inline.

**Four Hub Pages** consolidate operational workflows:

1. **Operations Hub** (`/operations`) — Active work, agent management, compliance monitoring, workflow history
2. **Intelligence Hub** (`/intelligence`) — Financial models, data sources, analytics dashboards
3. **Advisory Hub** (`/advisory`) — Products, cases, recommendations, marketplace
4. **Relationships Hub** (`/relationships`) — Professional network, meetings, outreach, COI management

### Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Tailwind CSS 4, shadcn/ui, Wouter routing |
| **Backend** | Express 4, tRPC 11, Node.js 22 |
| **Database** | TiDB (MySQL-compatible), Drizzle ORM |
| **AI** | Multi-model LLM integration via Forge API |
| **Auth** | Manus OAuth, JWT sessions, role-based access |
| **Storage** | S3-compatible object storage |
| **Real-time** | WebSocket for streaming, market data, notifications |

### Data Flow

```
User Message → Context Assembly → Knowledge Base Injection → LLM Processing
    ↓                                                              ↓
Tool Detection ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← Tool Calls
    ↓                                                              ↓
Calculator/Model Execution → Result Formatting → Rich Response Rendering
    ↓
Compliance Pre-Screening → Disclaimer Injection → Audit Logging → Delivery
```

---

## Core Features

### 1. Conversational AI Interface

The chat interface serves as the primary interaction point, supporting:

- **Multi-model synthesis** with configurable model weighting
- **Voice input/output** via Deepgram transcription and TTS
- **File attachments** with intelligent routing (documents, images, audio)
- **Streaming responses** with markdown rendering
- **Conversation history** with full-text search and export
- **AI badge** on every AI message (model version indicator)
- **Dynamic disclaimers** injected based on conversation topic

### 2. AI Tool Calling (12+ Tools)

The AI can invoke calculators and models directly from conversation:

| Tool | Category | Description |
|---|---|---|
| IUL Calculator | Calculator | Indexed Universal Life projections |
| Retirement Calculator | Calculator | Retirement savings projections |
| Mortgage Calculator | Calculator | Mortgage payment analysis |
| Education Calculator | Calculator | Education funding projections |
| Monte Carlo Simulation | Model | 1,000-trial retirement probability |
| Debt Optimization | Model | Avalanche/snowball/hybrid strategies |
| Tax Optimization | Model | Multi-strategy tax analysis |
| Portfolio Risk | Model | VaR, Sharpe ratio, stress testing |
| Insurance Needs | Model | Coverage gap analysis |
| Estate Planning | Model | Estate tax and trust analysis |
| Education Funding | Model | 529 vs alternatives comparison |
| Cash Flow | Model | Income/expense forecasting |

### 3. Capability Modes (7 Modes)

The AI adapts its behavior based on the active mode:

| Mode | System Prompt Focus | Available Tools |
|---|---|---|
| General Assistant | Broad financial guidance | All tools |
| Financial Advisor | Investment and planning | Retirement, portfolio, tax tools |
| Insurance Specialist | Insurance products | IUL, insurance needs, product suitability |
| Tax Strategist | Tax optimization | Tax optimization, estate planning |
| Estate Planner | Estate and legacy | Estate planning, trust analysis |
| Education Planner | Education funding | Education calculator, 529 analysis |
| Study Buddy | Exam preparation | Quiz generation, study tracking |

### 4. Knowledge Base

A dynamic, searchable knowledge base with:

- **Article management** with versioning, tagging, and categorization
- **Freshness scoring** (articles flagged for review after 90 days)
- **Gap detection** (identifies uncovered topics)
- **Automatic context injection** into AI conversations
- **Feedback loop** (helpful/not helpful ratings)
- **Ingestion pipeline** for bulk content import

### 5. Compliance Engine

Comprehensive compliance infrastructure:

- **Pre-screening gate** on every AI response (5 fast checks)
- **Compliance scoring** per conversation (auto-flag below 80%)
- **Regulatory change monitor** (SEC, FINRA, NAIC feeds)
- **Dynamic disclaimer versioning** with multi-language support
- **Audit trail** with tamper-evident logging
- **Reg BI documentation** generation
- **Conflict of interest disclosure** tracking

### 6. Suitability Intelligence

Multi-dimensional suitability analysis:

- **12-dimension suitability profiles** (risk tolerance, time horizon, income, etc.)
- **Product matching** with disqualification engine
- **Inverse suitability search** ("products that fit this profile")
- **Suitability matrix visualization** (dimensions x products)
- **Change propagation** (auto-update recommendations on profile changes)

### 7. Agentic Workflows

Autonomous agent capabilities:

- **4 pre-built agent templates** (Portfolio Review, Compliance Check, Client Onboarding, Market Analysis)
- **Custom agent builder** with drag-and-drop workflow design
- **Graduated autonomy** (3 levels based on successful runs)
- **Agent replay** with step-by-step action history
- **Kill switch** for emergency agent termination
- **Compliance prediction** (dry-run mode before execution)

### 8. Multi-Tenant Architecture

Enterprise-ready multi-tenancy:

- **Organization management** with role-based access (admin, advisor, client)
- **Per-org AI configuration** (model selection, temperature, token budgets)
- **Dynamic permissions** with attribute-based access control (ABAC)
- **Field-level data sharing** with time-limited access
- **Delegation workflows** (advisor delegates client access)
- **White-label support** (per-org branding)

---

## Backend Services (65 Services)

### Core Services

| Service | File | Description |
|---|---|---|
| Prompt A/B Testing | `promptABTesting.ts` | Live A/B framework with auto-promotion |
| Compliance Pre-Screening | `compliancePrescreening.ts` | 5-point fast check on AI responses |
| Canary Deployment | `canaryDeployment.ts` | Feature flag percentage rollout |
| Knowledge Graph | `knowledgeGraphDynamic.ts` | Entity resolution, temporal tagging |
| What-If Scenarios | `whatIfScenarios.ts` | Fork/compare model results, backtesting |
| Adaptive Context | `adaptiveContext.ts` | Relevance scoring, dynamic context windows |
| Error Handling | `errorHandling.ts` | Structured error recovery with retry logic |
| Calculator Persistence | `calculatorPersistence.ts` | Save/load calculator scenarios |
| Predictive Insights | `predictiveInsights.ts` | Income milestones, peer benchmarking |
| Regulatory Monitor | `regulatoryMonitor.ts` | SEC/FINRA/NAIC feed monitoring |
| Role Onboarding | `roleOnboarding.ts` | Adaptive onboarding paths |
| Product Suitability | `productSuitability.ts` | Disqualification engine, matrix scoring |
| Dynamic Disclaimers | `dynamicDisclaimers.ts` | Topic-shift detection, multi-language |
| Proactive Escalation | `proactiveEscalation.ts` | Complexity/dissatisfaction triggers |
| Financial Literacy | `financialLiteracy.ts` | Level detection, adaptive explanations |
| Dynamic Permissions | `dynamicPermissions.ts` | ABAC, temporary elevation, delegation |
| Key Rotation | `keyRotation.ts` | 90-day encryption key rotation |
| Retention Enforcement | `retentionEnforcement.ts` | Auto-delete/archive by retention policy |
| AI Badge | `aiBadge.ts` | Model version tracking, watermarking |
| AI Boundaries | `aiBoundaries.ts` | User-configurable AI behavior limits |
| Command Palette | `commandPalette.ts` | Fuzzy search, recent items, actions |
| PWA/Offline | `pwaOffline.ts` | Service worker, offline capabilities |
| Accessibility Engine | `accessibilityEngine.ts` | WCAG 2.2 AAA audit, high contrast |
| Infrastructure Docs | `infrastructureDocs.ts` | CDN, DR, scaling documentation |
| Field Sharing | `fieldSharing.ts` | Granular data sharing controls |
| Org AI Config | `orgAiConfig.ts` | Per-org model and token management |
| Agent Templates | `agentTemplates.ts` | Pre-built and custom agent workflows |
| Compliance Prediction | `compliancePrediction.ts` | Predictive scoring, dry-run mode |
| Graduated Autonomy | `graduatedAutonomy.ts` | 3-level autonomy progression |
| Agent Replay | `agentReplay.ts` | Step-by-step action playback |
| Account Reconciliation | `accountReconciliation.ts` | Plaid webhooks, discrepancy detection |
| CRM Sync | `crmSync.ts` | Bidirectional sync with conflict resolution |
| Market Streaming | `marketStreaming.ts` | Real-time WebSocket market data |
| Regulatory Impact | `regulatoryImpact.ts` | AI-powered change impact analysis |
| Load Testing | `loadTesting.ts` | Performance metrics, capacity planning |
| Knowledge Base | `knowledgeBase.ts` | CRUD, search, freshness, gap detection |
| AI Tools Registry | `aiToolsRegistry.ts` | Tool registration, discovery, chaining |
| Capability Modes | `capabilityModes.ts` | Mode management and switching |
| Knowledge Ingestion | `knowledgeIngestion.ts` | Bulk content import pipeline |

---

## Frontend Pages (55 Pages)

### Hub Pages

| Page | Route | Description |
|---|---|---|
| Chat | `/chat` | Primary AI conversation interface |
| Operations Hub | `/operations` | Active work, agents, compliance, history |
| Intelligence Hub | `/intelligence` | Models, data sources, analytics |
| Advisory Hub | `/advisory` | Products, cases, recommendations |
| Relationships Hub | `/relationships` | Network, meetings, outreach |
| Knowledge Admin | `/admin/knowledge` | Knowledge base management |
| Settings | `/settings` | User preferences, privacy, AI config |

### Route Consolidation

17 former standalone pages now redirect to the chat interface with pre-filled prompts or to hub pages:

| Old Route | New Destination |
|---|---|
| `/study-buddy` | `/chat?prompt=study+buddy` |
| `/education` | `/chat?prompt=education` |
| `/coach` | `/chat?prompt=behavioral+coaching` |
| `/calculators` | `/chat?prompt=calculator` |
| `/planning` | `/chat?prompt=financial+planning` |
| `/insights` | `/chat?prompt=insights` |
| `/compliance` | `/operations` |
| `/analytics` | `/intelligence` |
| `/products` | `/advisory` |
| `/professionals` | `/relationships` |

---

## Database Schema (199 Tables)

The database uses TiDB (MySQL-compatible) with Drizzle ORM. Key table groups:

| Group | Tables | Description |
|---|---|---|
| **Core** | users, organizations, org_memberships | Identity and multi-tenancy |
| **Chat** | conversations, messages, message_feedback | Conversation management |
| **Suitability** | suitability_profiles, suitability_dimensions | Client profiling |
| **Products** | products, product_suitability_scores | Product catalog |
| **Compliance** | audit_logs, compliance_reviews, disclaimers | Regulatory compliance |
| **Models** | model_results, model_comparisons | Financial model outputs |
| **Knowledge** | knowledge_articles, knowledge_article_versions | Knowledge base |
| **AI Platform** | ai_tools, ai_tool_calls, capability_modes | AI infrastructure |
| **Agents** | agent_templates, agent_runs, agent_steps | Agentic workflows |
| **Operations** | deployments, feature_flags, canary_metrics | Platform operations |
| **Security** | encryption_keys, access_policies, field_shares | Security infrastructure |

---

## Test Suite (1,032 Tests)

| Test File | Tests | Coverage |
|---|---|---|
| `auth.logout.test.ts` | 1 | Authentication |
| `chat.test.ts` | 45 | Chat procedures |
| `suitability.test.ts` | 40 | Suitability engine |
| `products.test.ts` | 35 | Product management |
| `compliance.test.ts` | 30 | Compliance engine |
| `models.test.ts` | 25 | Financial models |
| `promptABTesting.test.ts` | 22 | A/B testing + pre-screening |
| `addendumPhase1-8.test.ts` | 200+ | Addendum features #21-56 |
| `consolidation.test.ts` | 70+ | Knowledge base, AI tools, modes |
| `hubPages.test.ts` | 55 | Hub pages + navigation |
| `routerIntegration.test.ts` | 15 | Router wiring verification |
| `knowledgeAdmin.test.ts` | 30 | Knowledge admin + optimization |
| `e2eIntegration.test.ts` | 40+ | Cross-cutting integration |
| *...and 22 more files* | 400+ | Various features |

---

## Security Architecture

### Authentication and Authorization

- **Manus OAuth** with JWT session cookies
- **Role-based access control** (admin, advisor, client)
- **Attribute-based access control** (ABAC) for fine-grained permissions
- **Temporary role elevation** with auto-revoke
- **Delegation workflows** for advisor-client relationships

### Data Protection

- **Field-level encryption** for PII (AES-256-GCM)
- **90-day encryption key rotation** cycle
- **Retention enforcement** with per-category policies
- **Data lifecycle visualization** in Settings
- **DSAR fulfillment** pipeline

### Compliance

- **Tamper-evident audit logging** with hash chains
- **Compliance pre-screening** on every AI response
- **Regulatory change monitoring** (SEC, FINRA, NAIC)
- **AI badge/watermark** on all AI-generated content
- **AI boundaries** configurable per user

---

## Deployment and Operations

### Infrastructure

- **Health check endpoint** at `GET /health`
- **Canary deployment** pattern (5% → 25% → 50% → 100%)
- **Feature flag** management with percentage rollout
- **Load testing** documentation with capacity planning
- **Auto-scaling** documentation for TiDB

### Monitoring

- **AI tool calling** precision/recall monitoring
- **Knowledge base** usage analytics
- **Capability mode** usage tracking
- **Compliance scoring** per conversation
- **Performance metrics** (p50/p95/p99 latency)

---

## Remaining Work Items

The following items are tracked but not yet implemented:

1. **MFA** (TOTP, backup codes) — Security enhancement
2. **CSP headers** and security hardening — Infrastructure
3. **Browser automation** foundation — Agentic capability
4. **Live carrier integration** — Insurance workflow
5. **Paper trading simulation** — Investment feature
6. **Multi-tenant white-label** — Enterprise feature
7. **Data ingestion activation** — Pipeline feature

These items represent future enhancement opportunities and do not affect the current platform's functionality or stability.

---

## Version History

| Version | Date | Key Changes |
|---|---|---|
| v1.0 | Feb 2026 | Initial platform with chat, suitability, products |
| v5.0 | Feb 2026 | 8 financial models, compliance engine, multi-tenant |
| v10.0 | Mar 2026 | Agentic workflows, integrations framework, 687 tests |
| v13.0 | Mar 2026 | Addendum tasks #21-56, 55+ new tables |
| v15.0 | Mar 2026 | Architectural consolidation, intelligence-first design, 1,032 tests |

---

*Stewardly Platform Guide v15.0 — Generated by Manus AI*
