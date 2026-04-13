# Calculator Rebuild — Architecture Analysis

## Current Problem
The user has THREE separate calculator surfaces that fragment the experience:
1. `/calculators` — Calculators.tsx (1328 lines) — 12 inline mini-calculators (IUL, PF, Retirement, Tax, SS, Medicare, HSA, Charitable, Divorce, Education, Stress Test, Monte Carlo) — most are stubs
2. `/wealth-engine` — WealthEngineHub.tsx (521 lines) — 30+ tool cards linking to 16 wealth-engine sub-pages
3. `/engine-dashboard` — EngineDashboard.tsx — Multi-engine comparison dashboard

This creates a confusing, fragmented experience where users hop between ~20+ calculators to assemble a holistic picture.

## What the HTML v7 Files Provided (the "floor")
Per CALCULATOR_PARITY.md:
- `client-calculator-v7.html` (6,176 lines, 86 inputs, 8 selects, 44 buttons) — Client-facing holistic calculator
- `business-calculator-v7.html` (8,683 lines, 198 inputs, 24 selects, 60 buttons) — Business/practice calculator
- `quick-quote-v7.html` (5,675 lines, 16 inputs, 2 selects, 34 buttons) — Quick quoting

These were HOLISTIC — a single view that lets you see forward/back, roll-up/roll-down across the entire hierarchy.

## What the Backend Already Supports
The engine layer is solid:
- **UWE** (uwe.ts): 14 product models + simulate — single-strategy year-by-year wealth simulation
- **BIE** (bie.ts): Business income engine with forward/back/roll-up/roll-down across roles and income streams
- **HE** (he.ts): Holistic engine combining UWE + BIE — multi-strategy comparison with presets
- **Monte Carlo** (monteCarlo.ts): Probability bands
- **Benchmarks** (benchmarks.ts): Guardrails + industry benchmarks

The tRPC router has: simulate, holisticSimulate, holisticCompare, projectBizIncome, backPlanBizIncome, rollUpTeam, rollDownOrg, calcBizEconomics, findWinners, backPlanHolistic, runPreset, etc.

## Target Architecture
UNIFY the three surfaces into ONE coherent hierarchy:

### Level 1: Holistic Dashboard (the single entry point)
- Shows the user's complete financial picture at a glance
- Roll-up view: total net worth trajectory, income streams, protection gaps
- Quick actions: Run full simulation, Compare strategies, Quick Quote

### Level 2: Three Pillars (tabs or sections within the dashboard)
1. **Plan** — Retirement, Tax, Estate, Income, SS, Medicare, HSA, Education, Charitable
2. **Protect** — Insurance analysis, Quick Quote, IUL, Premium Finance, DI, LTC
3. **Grow** — Practice-to-Wealth, Business Income, Team Builder, Owner Comp, Business Valuation

### Level 3: Deep-dive pages (existing wealth-engine sub-pages)
- Each pillar drills into the existing wealth-engine pages
- Forward/back navigation between related calculators
- Roll-up always visible — changes in any calculator propagate to the holistic view

### Key UX Principles
- NO standalone stub calculators — everything connects to the holistic engine
- Roll-up/roll-down: changes at any level propagate up and down
- Forward/back: users can plan forward (project) or back (what do I need to hit X?)
- Multiple income streams visible simultaneously
- Cross-calculator context: results from one calculator inform inputs of another
