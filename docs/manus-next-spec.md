# Manus-Next Execution Spec — WealthBridge AI / Stewardly

> This document captures the remaining execution roadmap for future passes.
> Each section is a self-contained work unit that can be picked up by any agent.

---

## Current State Summary (Post Pass 107)

### Completed Infrastructure
- **Wealth Engine**: 28 panel functions across PanelsA-D, 46 CALC_METHODS, configurable data layer via getConfig()
- **Practice Engine**: 38 exported functions, calcRollUp, calcUnifiedIncomePlan (5-channel roll-up)
- **Advanced Strategies (Domain C)**: PremiumFinancing, ILIT/Trust, ExecComp, CharitablePlanning, DueDiligence
- **References**: 17 categories, 101 entries, 17 REF_CATEGORY_TIPS, 49 RefTip usages
- **Command Center**: 7-tab hub (Overview, CRM, Campaigns, ATS, LinkedIn, Segments, Assets)
- **Data Integrations**: FRED, EDGAR, GLEIF, OpenFIGI, NAIC, FFIEC, BLS, BEA, Census, Plaid, SnapTrade
- **AI Surface**: UnifiedAI with Chat/Dev/Auto modes, real LLM streaming
- **Progressive Disclosure**: 4-level system (Essential/Standard/Professional/Expert), 53 nav items tagged
- **Sharing Kit**: ShareButton, RecipientPicker, PermissionSelector, OmissionToggle, SharingStatusIndicator
- **Save System**: 10-slot server-enforced calculator session persistence
- **Tests**: 29 (Pass 106) + 42 (Pass 107) = 71 tests, all passing

### Architecture
- React 19 + Tailwind 4 + Express 4 + tRPC 11
- Drizzle ORM with TiDB/MySQL
- Manus OAuth + JWT sessions
- S3 storage via storagePut/storageGet
- LLM via invokeLLM (server-side)
- Stripe sandbox provisioned

---

## Future Work Units

### Unit 1: Wire Command Center Tabs to Live Data
**Priority**: High
**Effort**: 4-6 hours

Connect CRM, Campaigns, ATS, LinkedIn, and Segments tabs to actual tRPC procedures with database persistence. Currently using local state.

- Create `drizzle/schema.ts` tables: `contacts`, `campaigns`, `campaign_steps`, `job_postings`, `candidates`, `segments`
- Add CRUD procedures in `server/routers.ts` or split into `server/routers/commandCenter.ts`
- Wire UI mutations with optimistic updates
- Add segment rule evaluation engine (server-side)

### Unit 2: Real-Time Pipeline Status
**Priority**: Medium
**Effort**: 2-3 hours

Replace static pipeline entries in DataPipelines with live status from governmentDataPipelines service.

- Add `pipeline_runs` table to track execution history
- Create tRPC procedure to fetch last-run timestamps and record counts
- Show live status badges (Running/Success/Failed/Stale) in DataPipelines UI
- Add manual trigger button for each pipeline

### Unit 3: Stripe Payment Integration
**Priority**: High
**Effort**: 3-4 hours

Implement subscription tiers and checkout flow using pre-configured Stripe sandbox.

- Define products/prices in `server/stripe/products.ts`
- Create checkout session procedure
- Implement webhook handler at `/api/stripe/webhook`
- Add subscription status to user profile
- Gate features by subscription tier

### Unit 4: Multi-Firm / Multi-User Architecture
**Priority**: Medium
**Effort**: 6-8 hours

Support firm-to-firm relationships and multi-user access per the project knowledge base.

- Add `firms`, `firm_members`, `firm_relationships` tables
- Implement role-based access (admin/manager/advisor/associate)
- Add firm-level settings and branding
- Support cross-firm data sharing with permission controls

### Unit 5: Enhanced AI Features
**Priority**: Medium
**Effort**: 4-5 hours

- Multi-model selection (premium models default, allow switching)
- Adjustable focus (general/financial/both)
- Document analysis via LLM (upload + analyze)
- Conversation-aware context (reference previous chats)
- Edge TTS optional voice selection

### Unit 6: Guest Exploration Mode
**Priority**: Low
**Effort**: 2-3 hours

Allow immediate access without authentication gate.

- Default to guest mode with limited feature set
- Show sign-in prompt for protected features
- Persist guest data in localStorage, migrate on sign-in

### Unit 7: Comprehensive Platform Guide
**Priority**: Low
**Effort**: 2-3 hours

- In-app guided tour (react-joyride or custom)
- Help center with searchable FAQ
- Beginner-optimized step-by-step guide
- Video walkthrough placeholders

---

## Recursive Convergence Protocol

For each work unit:
1. Implement the feature
2. Write vitest tests
3. Run `npx vitest run` — must pass
4. Run `npx vite build` — must succeed
5. Repeat steps 1-4 until no regressions
6. Run 3 consecutive clean passes (vitest + build)
7. Update todo.md
8. Save checkpoint

Convergence is achieved when 3 consecutive passes produce identical results with 0 failures.
