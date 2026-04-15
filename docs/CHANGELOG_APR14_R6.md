# Changelog — April 14, 2026 (Round 6)

**Build**: Convergence Round 6 with 40 passes (20 consecutive clean from passes 21–40)
**Unit Tests**: 7,716 passed across 320 test files
**E2E Tests**: 100 Playwright tests (3 flaky, 0 failed)
**TypeScript**: 0 errors

---

## New Features

### v2.6.1 Cost-Tier Sourcing Policy

Implemented a four-tier financial data sourcing hierarchy that governs how external data providers are selected and displayed throughout the platform. The policy prioritizes free and open-source data (Tier 1) before escalating to freemium (Tier 2), bundled (Tier 3), or premium (Tier 4) sources.

Reference documents created:
- `docs/reference/FINANCIAL_DATA_TOOLS_TIERED.md` — Complete provider inventory with 40+ tools across all four tiers
- `docs/reference/v2.6.1-cost-tier-sourcing-policy.md` — Policy specification with decision flowchart

### Cost-Tier Transparency Badges (Integrations Page)

Each integration provider card now displays a **CostTierBadge** showing its cost classification (Free, Freemium, Bundled, or Premium) with color-coded indicators. A summary banner at the top of the Integrations page shows the distribution of connected integrations across all four tiers.

### New Integration Providers

Added four new Tier 1 (free) integration providers to the seed data:
- **GLEIF** — Global Legal Entity Identifier Foundation (LEI lookups)
- **OpenFIGI** — Financial Instrument Global Identifier mapping
- **NAIC** — National Association of Insurance Commissioners (insurance data)
- **FFIEC** — Federal Financial Institutions Examination Council (banking data)

---

## Bug Fixes

### React Hooks Violation in LearningHome.tsx

Fixed a React Rules of Hooks violation where conditional early returns (`if (authLoading)`, `if (!isAuthenticated)`) were placed before hook calls. All hooks are now called unconditionally at the top of the component, with conditional returns placed after.

### Broken If-Block Nesting in LearningTrackDetail.tsx

Fixed a syntax error where `if (trackQ.isLoading)` was missing its closing brace, causing auth checks to be incorrectly nested inside it. Restructured to place auth checks first, then the loading check.

### tRPC Query Returning `undefined` in suitability.get

Changed `getUserSuitability()` in `server/db.ts` to return `null` instead of `undefined` when no assessment exists. tRPC queries require non-undefined return values; the `?? null` pattern ensures compliance.

### Graceful Error Handling for lead_pipeline Table

Added try-catch wrapper to `leadPipeline.getPipeline` query that returns an empty array instead of throwing a raw SQL error when the `lead_pipeline` table hasn't been migrated yet.

### Reverted 6 Incorrectly Modified Files

Restored `ConnectionMap.tsx`, `DisciplineDeepDive.tsx`, `ExamSimulator.tsx`, `LearningQuizRunner.tsx`, `LearningReview.tsx`, and `LearningSearch.tsx` from git HEAD after an automated auth-gating script incorrectly modified them (these files did not have auth gating to begin with).

---

## Documentation Updates

- Updated `docs/ARCHITECTURE.md` with v2.6.1 sourcing policy section, updated test counts, and new integration providers
- Created `docs/convergence-pass-r6.md` with full 40-pass convergence log
- Created `docs/CHANGELOG_APR14_R6.md` (this file)
- Updated `todo.md` with all completed items marked

---

## Convergence Summary

| Metric | Value |
|--------|-------|
| Total passes | 40 |
| Fixes applied | 5 |
| Counter resets | 2 |
| Consecutive clean passes | 20 (passes 21–40) |
| TypeScript errors | 0 |
| Vitest tests | 7,716 / 7,716 |
| Playwright E2E | 100 passed, 3 flaky, 0 failed |
| Zod validation rules | 2,618 |
| Database indexes | 442 |
| Error boundaries | 21 |
