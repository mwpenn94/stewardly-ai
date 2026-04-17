# @manus-next/wealth-engine

Calculator engine (pure math) — 46 methods

## Hub Architecture (v10)

The Wealth Engine is now a **hub page** (`/wealth-engine`) with an internal sidebar containing 30+ tools organized into 5 sections:

- **Overview**: Dashboard with financial scores and quick actions
- **Plan**: Retirement Planner, Tax Projector, Estate Planning, Risk Assessment, Income Projection, Social Security, Medicare, All Calculators
- **Protect**: Quick Bundle, Protection Score, Strategy Comparison, Insurance Analysis, Quick Quote Hub, Holistic Comparison
- **Grow**: Engine Dashboard, Owner Comp, Business Valuation, Business Income, Practice-to-Wealth, Financial Twin, Workflows
- **Tools**: Configurator, Sensitivity, What-If Analysis, Team Builder, Reference Hub

Sub-pages accept an `embedded` prop to skip the outer AppShell when rendered inside the hub.

### Key Files

- `client/src/pages/wealth-engine/WealthEngineHub.tsx` — Hub page with internal sidebar
- `client/src/pages/calculators/engine.ts` — Calculator engine (pure math)
- `client/src/pages/calculators/format.ts` — Number formatting utilities (fmt, fmtSm, pct)

## Status

Shell created — awaiting source extraction from Stewardly monolith.

## Installation

```bash
pnpm add @manus-next/wealth-engine
```

## Usage

```typescript
import { PACKAGE_NAME } from "@manus-next/wealth-engine";
```
