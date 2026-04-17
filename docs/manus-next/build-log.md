# Stewardly AI — Build Log

## Overview

This document traces the evolution of Stewardly AI (originally WealthBridge AI) from inception through Pass 107, documenting major architectural decisions, feature additions, and convergence milestones.

## Build Timeline

| Pass Range | Phase | Key Deliverables |
|-----------|-------|-----------------|
| 1-6 | Foundation | DB schema, AI chat with streaming, compliance engine, calculators, RAG, voice mode |
| 7-20 | Core Platform | Role system (user/advisor/manager/admin), suitability engine, document management, market data |
| 21-40 | Professional Portal | Client book, view-as, case design, focus modes, conversational suitability |
| 41-60 | Data Layer | FRED/BLS/BEA/Census integrations, premium finance rates, government data pipelines |
| 61-80 | Enterprise Features | Stripe billing, video conferencing (Daily.co), email campaigns, CRM sync, LinkedIn auth |
| 81-100 | Wealth Engine | 28 calculator panels, 46 CALC_METHODS, practice management engine, advanced strategies |
| 101-104 | Stability | Regression fixes, stability guards, nav reachability, MarketTicker lifecycle |
| 105-106 | Enrichment | 17 citation categories (101 refs), 10-slot save system, configurable data layer, roll-up unification |
| 107 | Command Center | Unified hub (7 tabs), sharing UI kit, progressive disclosure, Manus-Next foundation |
| 108 | Backend-Frontend Parity | CommandCenter wired to live tRPC, 6 new frontend pages (BusinessExit, AnnualReview, ComplianceCopilot, TaxProjector, PremiumFinanceRates, ManusNextDashboard), expanded ICON_MAP, documentation updates |

## Architecture Decisions

### ADR-001: tRPC-First API Design
All client-server communication uses tRPC procedures. No REST endpoints except OAuth callbacks, Stripe webhooks, and streaming chat endpoints. This ensures end-to-end type safety and eliminates API contract drift.

### ADR-002: Recursive Optimization Convergence
Each pass follows the recursive-optimization-converged methodology: implement features, run vitest + vite build, fix failures, repeat until 3 consecutive clean passes. This ensures no regressions accumulate.

### ADR-003: Configurable Data Layer
All tax rates, estate thresholds, and financial constants are stored in CONFIGURABLE_DEFAULTS with getConfig() accessor. No hardcoded financial values in calculation logic. This enables regulatory updates without code changes.

### ADR-004: Progressive Disclosure (4 Levels)
Navigation and content surfaces use Essential/Standard/Professional/Expert disclosure levels. 53 nav items have assigned levels. DisclosureContext + DisclosureSection components gate content visibility.

### ADR-005: Government Data Pipeline Architecture
16 data pipelines with circuit breakers, freshness tracking, and cron scheduling. Each pipeline returns a standardized PipelineResult. The enrichment cache stores data points with provider attribution.

## Current State

The platform is a production-grade financial advisory platform with 365 database tables, 148 page components, 363 server services, and 9,669 passing tests. The build completes in ~32 seconds and the full test suite runs in ~84 seconds.

## Known Technical Debt

1. Census API tests occasionally fail due to ECONNRESET (transient network issue, not code)
2. Some "future enhancement" items in todo.md represent deferred features, not bugs
3. MarketTicker component exists but is intentionally removed from AppShell per Phase 1 spec
4. Several API-dependent tests require live credentials (FRED_API_KEY, DEEPGRAM_API_KEY) and gracefully degrade
