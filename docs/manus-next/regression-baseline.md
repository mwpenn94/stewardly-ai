# Stewardly Regression Baseline

## Captured At

**Date**: 2026-04-17
**Pass**: 107b
**Version**: d9b93ecf (pre-107b checkpoint)

## Test Suite Summary

| Metric | Value |
|--------|-------|
| Test files | 393 |
| Tests passing | 9,669 |
| Tests failing | 2 |
| Total tests | 9,671 |
| Build time | 32.17s |
| Test suite time | 83.61s |
| Transform time | 8.93s |
| Collect time | 74.57s |
| Test execution time | 214.78s |

## Failing Tests (Known, Non-Regression)

| Test File | Test Name | Reason | Severity |
|-----------|-----------|--------|----------|
| server/pass103-*.test.ts | Census API pipeline | ECONNRESET from api.census.gov | Transient network |
| server/pass103-*.test.ts | Census data validation | ECONNRESET from api.census.gov | Transient network |

Both failures are caused by the Census Bureau API being temporarily unreachable during the test run. These are not code bugs and pass when the API is available.

## Test File Distribution

| Category | Files | Tests |
|----------|-------|-------|
| Domain A (Calculators) | 45 | 1,200+ |
| Domain B (Practice Engine) | 30 | 800+ |
| Domain C (Advanced Strategies) | 15 | 400+ |
| Domain D (References/Due Diligence) | 10 | 300+ |
| Data Integrations | 25 | 700+ |
| Stripe/Billing | 8 | 200+ |
| Auth/Compliance | 12 | 350+ |
| UI Components | 20 | 500+ |
| Infrastructure | 15 | 400+ |
| Pass-specific (101-107) | 10 | 300+ |
| Other | 203 | 4,419+ |

## Build Verification

```
vite build output:
  ✓ built in 32.17s
  No TypeScript errors
  No build warnings (excluding expected OOM in tsc during dev server)
```

## Minimum Thresholds for CI

| Metric | Minimum | Current | Buffer |
|--------|---------|---------|--------|
| Tests passing | 9,669 | 9,669 | 0 (exact) |
| Test files passing | 391 | 392 | +1 |
| Build time | < 60s | 32s | 28s |
| Test suite time | < 180s | 84s | 96s |

## How to Update This Baseline

After each successful pass:
1. Run `npx vitest run 2>&1 | tail -5` to capture new counts
2. Update `BUILD_MANIFEST.json` with new metrics
3. Update this file with new passing/failing counts
4. If test count increased, update the CI minimum threshold
5. If test count decreased, investigate before committing
