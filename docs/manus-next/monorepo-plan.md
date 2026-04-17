# Monorepo Structure Plan

## Overview

This document specifies the target monorepo structure for Manus-Next, using pnpm workspaces with Turborepo for build orchestration. The goal is to extract reusable packages from the Stewardly monolith while maintaining backward compatibility.

## Target Directory Layout

```
manus-next/
├── turbo.json                    ← Turborepo pipeline config
├── pnpm-workspace.yaml           ← Workspace definitions
├── package.json                  ← Root scripts + shared devDependencies
├── tsconfig.base.json            ← Shared TypeScript config
│
├── apps/
│   ├── stewardly/                ← Current Stewardly AI app (migrated in-place)
│   │   ├── client/               ← React 19 frontend
│   │   ├── server/               ← Express + tRPC backend
│   │   ├── drizzle/              ← Schema + migrations
│   │   └── package.json
│   │
│   └── sovereign/                ← Sovereign study mode app (Phase 3)
│       ├── client/
│       ├── server/
│       └── package.json
│
├── packages/
│   ├── platform/                 ← @platform/* reusable infrastructure
│   │   ├── data-pipelines/       ← Government data fetchers + circuit breakers
│   │   ├── compliance/           ← Audit trail, PII stripping, disclaimers
│   │   ├── sharing-ui/           ← ShareButton, RecipientPicker, etc.
│   │   ├── disclosure/           ← Progressive disclosure framework
│   │   ├── voice/                ← Edge TTS + Deepgram STT
│   │   ├── video/                ← Daily.co room management
│   │   ├── comms/                ← Email templates + campaign engine
│   │   ├── premium-finance/      ← SOFR rates + loan modeling
│   │   ├── auth/                 ← OAuth + JWT session management
│   │   └── storage/              ← S3 helpers
│   │
│   └── manus-next/               ← @manus-next/* domain-specific packages
│       ├── wealth-engine/        ← Calculator engine (pure math)
│       ├── practice-engine/      ← Practice management (pure math)
│       ├── references/           ← Citation library + RefTips
│       ├── suitability/          ← Conversational suitability engine
│       ├── enrichment/           ← Data enrichment + cohort matching
│       ├── products/             ← Product catalog + comparator
│       ├── crm/                  ← CRM sync + contact management
│       ├── campaigns/            ← Campaign lifecycle management
│       ├── analytics/            ← Platform analytics + reporting
│       ├── ai-studio/            ← Unified AI surface (Chat/Dev/Auto)
│       ├── command-center/       ← Command center hub
│       ├── calculators-ui/       ← Calculator panel components
│       ├── market-data/          ← Market data dashboard + ticker
│       ├── documents/            ← Document management + RAG
│       ├── settings/             ← User settings + preferences
│       ├── billing/              ← Stripe integration
│       └── onboarding/           ← Tour + consent flows
│
└── tooling/
    ├── eslint-config/            ← Shared ESLint rules
    ├── tsconfig/                 ← Shared TypeScript configs
    └── vitest-config/            ← Shared Vitest setup
```

## pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/platform/*"
  - "packages/manus-next/*"
  - "tooling/*"
```

## turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Migration Strategy

### Step 1: Scaffold (no code changes)
Create the monorepo structure with empty package shells. Stewardly continues to work as-is in `apps/stewardly/`.

### Step 2: Extract Pure Libraries First
Start with zero-dependency packages: `@manus-next/wealth-engine`, `@manus-next/practice-engine`, `@manus-next/references`. These are pure TypeScript with no server/UI dependencies.

### Step 3: Extract Platform Infrastructure
Move `@platform/data-pipelines`, `@platform/compliance`, `@platform/voice` — these have server dependencies but no UI coupling.

### Step 4: Extract UI Packages
Move `@platform/sharing-ui`, `@platform/disclosure` — these have React dependencies but no server coupling.

### Step 5: Wire Imports
Update Stewardly imports from relative paths to package imports. Run full test suite after each package extraction.

### Step 6: Sovereign App
Create `apps/sovereign/` that imports from `@manus-next/*` and `@platform/*` packages with `SOVEREIGN_PORT_MODE=study`.

## Dependency Graph

```
@manus-next/wealth-engine     → (none)
@manus-next/practice-engine   → (none)
@manus-next/references        → (none)
@platform/data-pipelines      → (none)
@platform/compliance          → (none)
@platform/voice               → (none)
@platform/video               → (none)
@platform/comms               → (none)
@platform/sharing-ui          → react
@platform/disclosure          → react
@platform/auth                → express, jsonwebtoken
@platform/storage             → @aws-sdk/client-s3
apps/stewardly                → all @platform/* + @manus-next/*
apps/sovereign                → @manus-next/* + @platform/auth + @platform/disclosure
```

## Build Time Budget

| Package | Target Build Time |
|---------|------------------|
| Each @manus-next/* | < 3s |
| Each @platform/* | < 5s |
| apps/stewardly | < 35s |
| apps/sovereign | < 20s |
| Total (with Turborepo cache) | < 45s |
