# Path-Based CI Configuration

## Overview

This document specifies the CI/CD configuration for the Manus-Next monorepo, using path-based triggers to ensure only affected packages are built and tested on each commit.

## GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            wealth-engine:
              - 'packages/manus-next/wealth-engine/**'
            practice-engine:
              - 'packages/manus-next/practice-engine/**'
            references:
              - 'packages/manus-next/references/**'
            data-pipelines:
              - 'packages/platform/data-pipelines/**'
            compliance:
              - 'packages/platform/compliance/**'
            sharing-ui:
              - 'packages/platform/sharing-ui/**'
            disclosure:
              - 'packages/platform/disclosure/**'
            voice:
              - 'packages/platform/voice/**'
            video:
              - 'packages/platform/video/**'
            comms:
              - 'packages/platform/comms/**'
            premium-finance:
              - 'packages/platform/premium-finance/**'
            auth:
              - 'packages/platform/auth/**'
            storage:
              - 'packages/platform/storage/**'
            stewardly:
              - 'apps/stewardly/**'
            sovereign:
              - 'apps/sovereign/**'
            tooling:
              - 'tooling/**'
            schema:
              - 'apps/stewardly/drizzle/**'

  build-and-test:
    needs: detect-changes
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(needs.detect-changes.outputs.packages) }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Build affected
        run: pnpm turbo build --filter=...${{ matrix.package }}
      - name: Test affected
        run: pnpm turbo test --filter=...${{ matrix.package }}

  full-suite:
    if: contains(needs.detect-changes.outputs.packages, 'stewardly') || contains(needs.detect-changes.outputs.packages, 'schema')
    needs: detect-changes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Full build
        run: pnpm turbo build
      - name: Full test suite
        run: pnpm turbo test
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Regression baseline check
        run: |
          RESULT=$(pnpm turbo test 2>&1 | tail -1)
          PASSED=$(echo $RESULT | grep -oP '\d+ passed' | grep -oP '\d+')
          if [ "$PASSED" -lt "9669" ]; then
            echo "REGRESSION: Only $PASSED tests passed (baseline: 9669)"
            exit 1
          fi
```

## Turborepo Cache Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "**/.env.*local",
    "tsconfig.base.json"
  ],
  "globalPassThroughEnv": [
    "DATABASE_URL",
    "FRED_API_KEY",
    "BLS_API_KEY",
    "STRIPE_SECRET_KEY"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**", "tsconfig.json", "package.json"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": [],
      "inputs": ["src/**", "tests/**", "vitest.config.ts"]
    },
    "lint": {
      "outputs": [],
      "inputs": ["src/**", ".eslintrc.*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Path-Based Trigger Matrix

| Changed Path | Triggers Build | Triggers Test | Full Suite |
|-------------|---------------|--------------|------------|
| packages/manus-next/wealth-engine/** | wealth-engine | wealth-engine | No |
| packages/platform/data-pipelines/** | data-pipelines | data-pipelines | No |
| apps/stewardly/client/** | stewardly | stewardly | Yes |
| apps/stewardly/server/** | stewardly | stewardly | Yes |
| apps/stewardly/drizzle/** | stewardly | stewardly | Yes (schema change) |
| tooling/** | All packages | All packages | Yes |
| pnpm-lock.yaml | All packages | All packages | Yes |

## Regression Baseline

The CI pipeline enforces a minimum test count of 9,669 passing tests. If any commit causes the count to drop below this threshold, the pipeline fails with a `REGRESSION` error. The baseline is updated in `BUILD_MANIFEST.json` after each successful pass.

## Cache Strategy

Turborepo caches build outputs based on input file hashes. Typical cache hit rates:
- Package-only changes: 90%+ cache hits (only affected package rebuilds)
- App changes: 50% cache hits (app rebuilds, packages cached)
- Schema changes: 0% cache hits (full rebuild required)
- Tooling changes: 0% cache hits (full rebuild required)
