# Stewardly — Project Knowledge Base

**Purpose:** Cross-task reference for project-level context, preferences, and design decisions accumulated across all conversations. This is the single source of truth for project context that persists across tasks.

---

## Owner Preferences & Design Decisions

### UI/UX Principles
- **Default landing page** is a conversation interface (chat-first design)
- **Welcome prompt** similar to Claude at launch
- **Streamlined and intuitive** — minimize user overwhelm, maximize intuitiveness without degrading simplicity, functionality, or performance
- Address crowding and overlapping elements, especially on mobile views
- Organize and potentially hide elements on the query page to make the query box and buttons more prominent
- **Hands-free mode** defaults to audio playback for responses, with user toggle
- **Audible cues** for processing status before response is read back
- **Query history** must be fully viewable, expandable, and collapsible
- **Seamless transition** from query to conversation/chat with follow-up support
- Replace all instances of "clone" with "personal" or "personalized" for AI features
- **Sidebar organization** — organize and condense sidebar items where it makes sense

### Authentication & Access
- Users should be able to **immediately access and use the application without a gate**
- **Default users to guest exploration** until they sign in
- Support **persistent sign-in** for authenticated users
- Implement CRUD functionality for non-Google accounts
- **Administrative user level** with global access and permissions, with a specific email address designated
- "Client Advisor" mode hidden from general users — only displayed based on access level
- Advisors see "Client Advisor", managers/admins see all options

### Role-Based & Multi-Tenant Architecture
- Multi-tenant hierarchy: Organizations > Firms > Users
- **Firm-to-firm relationships** — account for many users, professionals, managers, and administrators associated with multiple firms
- Users can **reconnect with previously associated professionals or organizations**
- Professionals and organizations from online sources should be accessible with CRUD capabilities
- **Hierarchical data connections by permission** — only admins affect platform-level data connections; guests restricted to own level
- **Document access management** — users can manage insights and view access for uploaded documents, including granting access to financial professionals, management, and administrators with toggleable visibility

### AI Behavior
- **Exponential onboarding engine** — AI continuously improves awareness and ability to onboard/train users, personalized based on previous commands
- **Collaborative feedback loop** — users provide feedback that improves AI analysis
- **Customizable model weighting** — users weight impact of different models on unified responses with CRUD presets
- **Adjustable depth/speed** of response generation in AI fine-tuning
- **Passive actions** — users can activate passive actions and improvements with any providers and data sources
- **AI audit/improvement layer** at each tier — AI skill/feature to audit, recommend, and implement or direct improvements with infrastructure for continuous improvement
- Users can provide documents, artifacts, skills, and other files to train their personal AI

### Knowledge Base & Files
- **File management** — CRUD sources as quickly, simply, and effectively as possible
- **Bulk actions** for knowledge base management
- **File splitting** — output files split into parts not exceeding 31MB, CSV format preferred

### Products & Calculators
- Products and calculators should **roll up to the platform level**
- Organizations have CRUD capabilities for their own instances
- Suitability, knowledge base, and AI tuning should be collected within settings

### Integrations
- **Prioritize integrations with perpetual free options**
- Agent should perform integrations it is capable of doing autonomously
- For user-required integrations, provide categorized list by layer with setup info and guiding links
- **Ensure all integrations work reliably and consistently** — solutions generalized across all relevant integrations

### Collaboration & Monetization
- **Collaborative options** for users, including pricing options to pay, market, and sell their own solutions
- Appropriate privacy and terms to support without liability

### Quality Assurance
- Thorough validation cases to verify features built to specification
- Stress test and optimize based on best practices
- **AI-guided tour** for user orientation and training
- **Repeatable refinement process** — checks on UI/UX, tour/help, code efficiency, testing suite, guide updates
- Application configured to allow auditing by external AI models (not blocked by robots.txt)

### Settings
- **All user settings should be cached** for subsequent use

### Recursive Optimization
- Apply recursive optimization prompt to context until convergence
- Each iteration uses previous output as new context
- **All prompts aligned to latest Unified Master Plan**

---

## Four-Project Ecosystem

| Project | Role | Status |
|---|---|---|
| **Stewardly** | Reference architecture — financial advisory platform | Active (this project) |
| Sovereign Hybrid | 3-layer AI platform (AEGIS+ATLAS+Sovereign) | Separate Manus project |
| Atlas Hybrid | 2-layer AI platform (AEGIS+ATLAS) | Separate Manus project |
| AEGIS Hybrid | 1-layer AI platform (AEGIS only) | Separate Manus project |

**Strategy:** Extract intelligence from Stewardly, integrate into other 3 projects.

---

## Key Documents (Uploaded Context)

| Document | Version | Purpose |
|---|---|---|
| `UNIFIED_MASTER_PLAN_COMPLETE(2).docx` | v2 (latest, supersedes v1) | Governing reference for all Stewardly work — 38 pages, 15 sections, 9.5/10 rating |
| `recursive-optimization-converged-final(2).md` | v2 | Recursive optimization prompt for continuous improvement |
| `Stewardly(WealthBridgeAI)—FullSetupGuide.md` | Current | Deployment and setup documentation |
| `stewardlyenv-reference.txt` | Current | All 25 environment variables |
| `stewardly-full-export.zip` | Current | Full codebase export |

---

## Technical Debt Resolved

### TypeScript Crash Fix (Task 2026-03-29)

The `tsc --noEmit` command was crashing with SIGABRT (exit code 134) due to OOM in the type checker. Root causes and fixes:

| Category | Files Affected | Fix Applied |
|---|---|---|
| OOM crash | All (131-table schema) | `NODE_OPTIONS="--max-old-space-size=4096"` required for tsc |
| Corrupted variable names | AnalyticsDashboard.tsx | First characters stripped from `volume`, `quality`, `severity`, `categories`, `actions`, `observations` — restored all |
| `userId` not in scope | 13 service files (multiModal, complianceCopilot, memoryEngine, emailCampaign, meetingIntelligence, recommendation, regBIDocumentation, selfDiscovery, knowledgeBase, dataIngestionEnhanced, anonymousChat) | Used `0` for utility functions without user context, `params.userId` or `context.userId` where available |
| Property name mismatches | deepContextAssembler.ts | `securityName` → `name`, `brokerageName` → `institutionName`, `symbol` → `symbolTicker`, `price`/`averagePurchasePrice` → `averagePrice`, `inputs` → `inputsJson`, `results` → `resultsJson`, `urgency` → `priority`, `content` → `description`, `notes` → `userNote` |
| `db` possibly null | routers.ts (shortcuts procedures) | Added non-null assertion `(await getDb())!` |
| Content type mismatch | routers.ts (LLM responses) | Cast `response.choices[0].message.content as string` |
| Set iteration | deepContextAssembler.ts | `[...new Set()]` → `Array.from(new Set())` |
| Missing `ctx` | anonymousChat.ts | publicProcedure doesn't have ctx — used `0` for anonymous userId |

**Result:** 101 errors → 0 errors. `tsc --noEmit` completes cleanly with exit code 0. All 1,987 tests pass.

### Production Security Hardening (GitHub commit ecec117, 2026-03-29)

Pulled from GitHub `user_github` remote. Added helmet (CSP, HSTS, X-Frame-Options), express-rate-limit (3-tier: general 100/15min, sensitive 20/15min, auth 5/15min), pino structured logging, request ID middleware (UUID v4), and environment validation. 47 files changed, 1,755 insertions. New test file: `productionSecurity.test.ts` (14 tests). Total tests now 2,001 across 71 files.

---

## In-Project Context Files

| File | Content |
|---|---|
| `UNIFIED_MASTER_PLAN_CONTEXT.md` | Comprehensive summary of the 38-page master plan — architecture, gaps, priority stack, scorecard, ROI, deployment strategy |
| `RECURSIVE_OPTIMIZATION_PROMPT.md` | The recursive optimization prompt with pass types and rules |
| `SETUP_GUIDE.md` | Quick reference for deployment and self-hosting |
| `PROJECT_KNOWLEDGE_BASE.md` | This file — all project-level context and preferences |
| `APP_REFERENCE.md` | Full application reference — prod URLs, all routes, tRPC endpoints, DB tables, services, scheduled jobs, data pipelines, test infrastructure |
| `PRODUCTION_SECURITY_CHANGELOG.md` | Security hardening changelog (helmet, rate limiting, pino, request IDs) |
| `todo.md` | Feature tracking with checkbox status |
