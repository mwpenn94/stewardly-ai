# Calculator Rebuild Plan — Align to v7 HTML Holistic Structure

## Problem Statement

The current Calculators.tsx page is a **fragmented mess** of ~12 disconnected
mini-calculators (most stubs), while the real power — the Wealth Engine — lives
on 16 separate `/wealth-engine/*` pages. The v7 HTML reference files provide a
**holistic single-view experience** organized by domain (Cash Flow → Protection
→ Growth → Retirement → Tax → Estate → Education) with a shared client profile
that drives ALL calculations simultaneously.

The user explicitly wants: "forward, back, roll-up, roll-down planning across
roles and multiple income streams and related production."

## v7 HTML Reference Architecture

### Client Calculator v7
- **Shared Client Profile** at the top — age, income, filing status, state,
  dependents, assets, liabilities, insurance, retirement accounts
- **Domain Panels** (sidebar navigation):
  1. Cash Flow Analysis
  2. Protection Analysis (life, disability, LTC, umbrella)
  3. Growth & Investment
  4. Retirement Planning
  5. Tax Planning
  6. Estate Planning
  7. Education Funding
  8. Cost-Benefit Analysis
  9. Strategy Comparison (side-by-side)
  10. Summary & Action Plan
- **Key Feature**: Change ONE profile field → ALL domain panels recalculate
  via the master `cA()` function. This is the "holistic" part.

### Business Calculator v7
- **Practice Profile** — revenue, expenses, staff, comp structure
- **Domain Panels**:
  1. Practice Overview
  2. Revenue Analysis
  3. Expense Management
  4. Compensation Optimization
  5. Growth Projections
  6. Combined Practice + Personal (THE key holistic roll-up)
  7. Multi-Stream Roll-Up (multiple income streams)
  8. My Plan (action items + timeline)

### Quick Quote v7
- Single scrolling page with 6 fields → instant multi-line results
- Sections: Protection Gap, Retirement Gap, Growth Opportunity,
  Next Steps, Cost-Benefit, Strategy Compare

## What Already Exists in the App

### WealthEngineHub (/wealth-engine)
- Already organized by Plan/Protect/Grow pillars
- Has Quick Bundle inline form
- Links to 30+ individual tool pages
- **Problem**: It's a DIRECTORY of links, not a holistic calculator

### HolisticComparison (/wealth-engine/holistic-comparison)
- Side-by-side 30-year projection comparing two strategies
- Uses shared FinancialProfile via useFinancialProfile hook
- Has 8 HE presets (Do Nothing, DIY, Wirehouse, RIA, etc.)
- **This is the closest to the v7 holistic view**

### Calculators (/calculators)
- 12 tab-switched mini-calculators
- 3 functional (IUL, Premium Finance, Retirement)
- 9 stubs (Tax, SS, Medicare, HSA, Charitable, Divorce, Education, LTC, Umbrella)
- **Problem**: Fragmented, no shared profile, no cross-domain recalculation

### Individual Pages
- /tax-planning, /estate, /risk-assessment, /income-projection,
  /social-security, /medicare, /insurance-analysis, /financial-planning
- Each is a standalone page with its own inputs
- No shared profile, no cross-domain awareness

## Rebuild Strategy

### Phase 1: Unify Calculators.tsx as Holistic Planning Hub

Replace the current 12-tab fragmented view with a **v7-aligned holistic view**:

1. **Shared Profile Bar** at the top — pulls from useFinancialProfile, shows
   key fields (age, income, filing status, dependents, net worth) with
   inline edit capability
2. **Domain Sections** organized as collapsible panels (not tabs):
   - Cash Flow & Income (links to /income-projection, shows summary)
   - Protection (links to /protection-score, /insurance-analysis, shows gap)
   - Growth & Investment (links to /financial-twin, shows trajectory)
   - Retirement (inline calculator + links to /wealth-engine/retirement)
   - Tax Planning (links to /tax-planning, shows bracket summary)
   - Estate Planning (links to /estate, shows coverage status)
   - Education (inline calculator for 529 projections)
3. **Roll-Up Summary** at the bottom — total protection gap, retirement
   readiness score, tax optimization opportunity, estate coverage status
4. **Strategy Comparison CTA** — "Compare strategies" button that navigates
   to HolisticComparison with the current profile pre-loaded

### Phase 2: Clean Chat UI Mobile Clutter

1. Remove the "AI Context Active" bar from ChatGreeting (it's noise)
2. Remove the "Proactive Insight" card (clutters mobile)
3. Keep "Resume where you left off" but make it 1 line, not 3 cards
4. Simplify the input toolbar on mobile — hide streaming toggle, model
   picker, and advanced controls behind a single "..." menu
