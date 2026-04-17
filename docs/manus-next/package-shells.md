# @manus-next/* Package Shells

## Overview

This document specifies the 17 @manus-next/* domain-specific packages to be extracted from Stewardly. Each shell defines the package name, source location, public exports, and test requirements.

## Package Registry

| # | Package | Source | Lines | Type | Dependencies |
|---|---------|--------|-------|------|-------------|
| 1 | @manus-next/wealth-engine | client/src/pages/calculators/engine.ts | 2,400 | Pure TS | None |
| 2 | @manus-next/practice-engine | client/src/pages/calculators/practiceEngine.ts | 1,800 | Pure TS | None |
| 3 | @manus-next/references | client/src/pages/calculators/references.ts | 800 | Pure TS | None |
| 4 | @manus-next/suitability | server/services/suitability/ | 600 | Server | @platform/compliance |
| 5 | @manus-next/enrichment | server/services/enrichment/ | 900 | Server | @platform/data-pipelines |
| 6 | @manus-next/products | server/services/products/ | 500 | Server | None |
| 7 | @manus-next/crm | server/services/crm/ | 700 | Server | @platform/comms |
| 8 | @manus-next/campaigns | server/routers/emailCampaign.ts | 400 | Server | @platform/comms |
| 9 | @manus-next/analytics | server/services/analytics/ | 500 | Server | None |
| 10 | @manus-next/ai-studio | client/src/pages/UnifiedAI.tsx | 1,011 | React | @platform/voice |
| 11 | @manus-next/command-center | client/src/pages/CommandCenter.tsx | 850 | React | @manus-next/crm, campaigns |
| 12 | @manus-next/calculators-ui | client/src/pages/calculators/Panels*.tsx | 8,000 | React | @manus-next/wealth-engine |
| 13 | @manus-next/market-data | client/src/pages/MarketData*.tsx | 1,200 | React | @platform/data-pipelines |
| 14 | @manus-next/documents | server/services/documents/ | 600 | Server | @platform/storage |
| 15 | @manus-next/settings | client/src/pages/Settings*.tsx | 800 | React | @platform/auth |
| 16 | @manus-next/billing | server/stripe/ | 500 | Server | Stripe SDK |
| 17 | @manus-next/onboarding | client/src/components/Tour*.tsx | 400 | React | @platform/disclosure |

## Shell Template

Each package follows this structure:

```
packages/manus-next/{name}/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          ← Public API barrel export
│   └── {modules}.ts      ← Extracted source
├── tests/
│   └── {name}.test.ts    ← Migrated tests
└── README.md
```

### package.json Template

```json
{
  "name": "@manus-next/{name}",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "dependencies": {},
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^2.0.0",
    "typescript": "^5.5.0"
  }
}
```

## Detailed Shells

### 1. @manus-next/wealth-engine

**Exports**:
- `CALC_METHODS` — 46 calculation method definitions
- `CONFIGURABLE_DEFAULTS` — Tax rates, thresholds, estate limits
- `getConfig(key)` — Configuration accessor
- `calcIULProjection(params)` — IUL cash value projection
- `calcPremiumFinanceROI(params)` — Premium finance return analysis
- `calcRetirementIncome(params)` — Retirement income aggregation
- `calcTaxEfficiency(params)` — Tax optimization analysis
- `calcEstateTransfer(params)` — Estate transfer modeling
- All 46 CALC_METHODS as individual functions

**Test requirements**: 46 method-level tests + 10 integration tests

### 2. @manus-next/practice-engine

**Exports**:
- `ROLE_DEFAULTS` — 5 role configurations
- `EngineConfig` — Practice engine configuration type
- `calcRollUp(config)` — Revenue roll-up across channels
- `calcUnifiedIncomePlan(config)` — 5-channel income unification
- `calcStaffingModel(config)` — Staffing optimization
- `calcSuccessionPlan(config)` — Succession planning
- `calcCascadeAudit(config)` — Cross-cascade audit
- All 38 exported functions

**Test requirements**: 38 function-level tests + 5 role-based integration tests

### 3. @manus-next/references

**Exports**:
- `REFERENCE_CATEGORIES` — 17 category definitions with 101 entries
- `REF_CATEGORY_TIPS` — 17 tooltip descriptions
- `searchReferences(query)` — Full-text search across references
- `filterByCategory(categoryId)` — Category filter
- `filterByAuthorityTier(tier)` — Authority tier filter

**Test requirements**: Category count, entry count, search accuracy, tip coverage

### 4-17: Remaining packages follow the same pattern — source extraction, barrel exports, migrated tests.

## Migration Checklist Per Package

- [ ] Create package directory with shell template
- [ ] Copy source files from Stewardly monolith
- [ ] Replace relative imports with package imports
- [ ] Create barrel export in src/index.ts
- [ ] Migrate relevant tests from server/*.test.ts
- [ ] Run `pnpm build` in package — must succeed
- [ ] Run `pnpm test` in package — must pass
- [ ] Update Stewardly imports to use package
- [ ] Run full Stewardly test suite — must maintain baseline
- [ ] Document in refactor-log.md
