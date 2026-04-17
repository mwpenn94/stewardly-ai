# Stewardly AI — Refactor Log

## Purpose

This document tracks refactoring decisions and structural changes that inform the Manus-Next extraction plan. Each entry identifies code that should be extracted into @platform/* or @manus-next/* packages.

## Refactor Entries

### R-001: Calculator Engine Extraction
**Current location**: `client/src/pages/calculators/engine.ts` (2,400+ lines)
**Target package**: `@manus-next/wealth-engine`
**Rationale**: The calculator engine contains pure financial math (IUL projections, tax calculations, estate planning, retirement income) with zero UI dependencies. It can be extracted as a standalone TypeScript library.
**Dependencies**: Only `CONFIGURABLE_DEFAULTS` and `getConfig()` — both pure data.

### R-002: Practice Management Engine Extraction
**Current location**: `client/src/pages/calculators/practiceEngine.ts` (1,800+ lines)
**Target package**: `@manus-next/practice-engine`
**Rationale**: Practice valuation, staffing models, succession planning, and roll-up calculations are domain-pure. 38 exported functions with no UI coupling.

### R-003: Government Data Pipelines
**Current location**: `server/services/governmentDataPipelines.ts` (1,950+ lines)
**Target package**: `@platform/data-pipelines`
**Rationale**: 16 pipeline fetchers with circuit breakers, cron scheduling, and freshness tracking. Reusable across any financial data product.

### R-004: Premium Finance Service
**Current location**: `server/services/premiumFinance/` (multiple files)
**Target package**: `@platform/premium-finance`
**Rationale**: SOFR rates, loan modeling, carrier data — all domain-specific but platform-reusable.

### R-005: Sharing UI Kit
**Current location**: `client/src/components/sharing/ShareKit.tsx` (516 lines)
**Target package**: `@platform/sharing-ui`
**Rationale**: ShareButton, RecipientPicker, PermissionSelector, OmissionToggle, SharingStatusIndicator — all generic sharing primitives.

### R-006: Disclosure Framework
**Current location**: `client/src/contexts/DisclosureContext.tsx` + `client/src/components/DisclosureSection.tsx`
**Target package**: `@platform/disclosure`
**Rationale**: 4-level progressive disclosure with context provider and section wrapper. Reusable in any multi-tier SaaS product.

### R-007: Compliance Engine
**Current location**: `server/services/compliance/` (multiple files)
**Target package**: `@platform/compliance`
**Rationale**: Audit trail, PII stripping, disclaimer injection, human review queue — all regulatory infrastructure.

### R-008: Voice Pipeline
**Current location**: `server/services/edgeTTS.ts` + `server/services/deepgramService.ts`
**Target package**: `@platform/voice`
**Rationale**: Edge TTS synthesis + Deepgram transcription with fallback handling. Generic voice I/O.

### R-009: Video Conferencing
**Current location**: `server/services/dailyService.ts` + `server/routers/videoConferencing.ts`
**Target package**: `@platform/video`
**Rationale**: Daily.co room management, token generation, recording retrieval. Generic video infrastructure.

### R-010: Email/Comms Engine
**Current location**: `server/commsEngine.ts` + `server/routers/emailCampaign.ts`
**Target package**: `@platform/comms`
**Rationale**: Template library, campaign lifecycle, drip sequences. Generic marketing automation.

## Extraction Priority

| Priority | Package | Effort | Impact |
|----------|---------|--------|--------|
| P0 | @manus-next/wealth-engine | Medium | Core IP, enables standalone calculator product |
| P0 | @manus-next/practice-engine | Medium | Core IP, enables practice management product |
| P1 | @platform/data-pipelines | High | Reusable across all financial products |
| P1 | @platform/compliance | Medium | Required for any regulated product |
| P2 | @platform/sharing-ui | Low | Generic UI kit |
| P2 | @platform/disclosure | Low | Generic framework |
| P2 | @platform/voice | Medium | Reusable voice I/O |
| P3 | @platform/video | Low | Thin wrapper around Daily.co |
| P3 | @platform/comms | Medium | Marketing automation |
| P3 | @platform/premium-finance | Low | Domain-specific |

## Pass 108 Additions

### R-011: Business Exit Analysis
**Current location**: `client/src/pages/BusinessExit.tsx` + `server/routers/v4Features.ts` (businessExit router)
**Target package**: `@manus-next/business-exit`
**Rationale**: LLM-powered business valuation with multiple methodologies (DCF, EBITDA multiples, asset-based, comparable transactions). Frontend now wired to tRPC with full CRUD.

### R-012: Annual Review Generator
**Current location**: `client/src/pages/AnnualReview.tsx` + `server/routers/v4Features.ts` (annualReview router)
**Target package**: `@manus-next/annual-review`
**Rationale**: AI-generated comprehensive annual client reviews with portfolio performance, goal tracking, and recommendation engine. Frontend wired to tRPC.

### R-013: Tax Projection Engine
**Current location**: `client/src/pages/TaxProjector.tsx` + `server/routers/v4Features.ts` (tax router)
**Target package**: `@manus-next/tax-engine`
**Rationale**: Multi-year tax projection with scenario comparison (current vs. proposed). Wired to backend tax router with full projection capabilities.

### R-014: Command Center Hub
**Current location**: `client/src/pages/CommandCenter.tsx` (rewritten Pass 108)
**Status**: Now wired to live tRPC (leadPipeline, emailCampaign, clientSegmentation). Previously used SAMPLE_ arrays.
**Target package**: `@manus-next/command-center`
**Rationale**: Unified operations hub with 7 tabs — all now backed by real database persistence.

### R-015: Manus-Next Dashboard
**Current location**: `client/src/pages/ManusNextDashboard.tsx`
**Target package**: `@manus-next/dashboard`
**Rationale**: Capability validation surface that mirrors Manus UI/UX patterns. Users can validate all 17 planned @manus-next/* packages, view extraction status, and run endpoint health checks.
