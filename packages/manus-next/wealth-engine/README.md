# @manus-next/wealth-engine

Unified Wealth Engine v7 — comprehensive financial planning calculator suite with 56 interactive panels, cascade data propagation, WORM audit trail, and FINRA/SEC compliance integration.

## Architecture (Pass 123 — Unified + Enriched)

The Wealth Engine is a **single unified page** (`/wealth-engine`) with an internal sidebar containing 56 tools organized into 6 groups. The original comprehensive Calculators architecture is the canonical implementation — all new panels (Advisory, Data) are integrated INTO this structure rather than replacing it.

### Navigation Groups

| Group | Panels | Description |
|-------|--------|-------------|
| **Practice Management** | 16 | My Plan, GDC Brackets, Products, Sales Funnel, Recruiting, Channels, Dashboard, P&L, Goal Tracker, Monthly Production, Partner, Income, AUM Override/Pipeline, Affiliate Pipeline |
| **Client Planning** | 12 | Client Profile, Cash Flow, Protection, Growth, Retirement, Tax, Estate, Education, Planning Hierarchy, Business Client, Balance Sheet, Debt Management |
| **Advanced** | 10 | Cost/Benefit, Strategy Comparison, Product Optimizer, Channel Diversification, Marketing ROI, Recruit Funnel, P&L Business Economics, GDC Override, Monte Carlo, Stock Comp, Premium Financing, ILIT, Exec Comp, Charitable Planning |
| **Advisory** | 4 | Strategy Archetypes, Unified Client Plan, Firm Comparison, Cascade Alerts |
| **Data** | 2 | Advanced Workflows, Financial Data Hub |
| **References & Due Diligence** | 3 | Summary, Timeline, Implementation Timeline, References, Due Diligence |

### Cascade Data Flow

All panels cascade up/down/forward/back through a unified data propagation layer:

- **Client Profile → All Panels**: age, income, dependents, net worth, savings, mortgage, debt, insurance
- **Practice Management → Client Planning**: practiceIncome cross-links GDC, AUM, overrides into personal financial planning
- **Scores → Recommendations → Horizon Data**: scorecard cascades into product recommendations which cascade into horizon projections
- **Tax → Cash Flow → Protection → Growth → Retirement → Estate → Education**: each result feeds the next
- **WealthEngineContext**: React context providing computed engine results to all 7 new panels (Advisory + Data groups)

### WORM Audit Trail

Calculator interactions are logged to the hash-chained audit trail via `calculators.logAudit` tRPC procedure. Events tracked:

- `calc_panel_change` — panel navigation
- `calc_save_session` — session save
- `calc_load_session` — session load
- `calc_export_pdf` — PDF export
- `calc_export_csv` — CSV export
- `calc_import_data` — data import
- `calc_share_session` — session sharing
- `calc_reset` — session reset

### Key Files

| File | Purpose |
|------|---------|
| `client/src/pages/Calculators.tsx` | Main unified component (1450+ lines) — sidebar, state, panel rendering |
| `client/src/pages/calculators/engine.ts` | Calculator engine (pure math — 46 methods) |
| `client/src/pages/calculators/format.ts` | Number formatting utilities (fmt, fmtSm, pct) |
| `client/src/pages/calculators/industryBenchmarks.ts` | Industry benchmarks for advisory panels |
| `client/src/pages/calculators/costTransparency.ts` | 5-layer advisor cost transparency utility |
| `client/src/pages/calculators/parityMapping.ts` | Competitive parity mapping and gap analysis |
| `client/src/hooks/useCascadeToast.ts` | Real-time cascade toast notifications |
| `client/src/contexts/WealthEngineContext.tsx` | Cascade data propagation context |
| `client/src/pages/calculators/PanelsA.tsx` | Practice Management panels |
| `client/src/pages/calculators/PanelsB.tsx` | Client Planning panels |
| `client/src/pages/calculators/PanelsC.tsx` | Advanced panels |
| `client/src/pages/calculators/PanelsD.tsx` | My Plan panel (unified income plan) |
| `client/src/pages/wealth-engine/*.tsx` | Advisory + Data panels (lazy-loaded) |

### Routes

- `/wealth-engine` — Primary route (Unified Wealth Engine)
- `/calculators` — Alias (same component)
- `/wealth-engine?panel=myplan` — Deep-link to specific panel
- `/my-plan` — Redirect to `/wealth-engine?panel=myplan`

## Status

Production — fully integrated with cascade engine, WORM audit, compliance layer, 12+ financial data adapters, cost transparency, parity mapping, cascade toast notifications, and jurisdictional compliance awareness.

### Pass 123 Additions

- **LeadDetail score history panel** — propensity score timeline with enrichment data
- **AdminLeadSources health badges** — connector health, sync status, quality scores
- **Cascade toast notifications** — real-time alerts when panel changes trigger cascade events
- **Cost transparency utility** — 5-layer fee analysis (advisory, fund, platform, insurance, transaction)
- **Parity mapping data** — competitive positioning across 8 capability domains
- **Jurisdictional compliance** — Federal (10), State (4), International (3) regulatory coverage
- **ContextualHelp entries** — /lead-pipeline and /compliance-audit help documentation
- **Virtual user validation** — 118 feature tests across 10 financial professional personas, all passing

## Installation

```bash
pnpm add @manus-next/wealth-engine
```

## Usage

```typescript
import { PACKAGE_NAME } from "@manus-next/wealth-engine";
```
