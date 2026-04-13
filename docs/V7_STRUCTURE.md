# V7 HTML Calculator Suite — Structure Analysis

## Three Calculators, One Holistic System

### 1. Client Calculator (6,176 lines)
**Sidebar Navigation — 4 sections:**
- **Your Profile:** Client Profile, Cash Flow
- **Planning Domains:** Protection, Growth, Retirement, Tax Planning, Estate, Education
- **Analysis:** Cost-Benefit, Strategy Compare, Summary, Action Plan
- **Resources:** References

**Key Feature:** All tabs update automatically from the client profile. One profile, all domains connected.

**Holistic Engine Panel (v-compare):**
- Planning Assumptions (growth rate, inflation, horizon 1-100 yrs)
- Income Streams & Business Planning (role selector, GDC, team, overrides, affiliates, AUM)
- Back-Plan: Target Annual Income (reverse-engineer required inputs)
- Strategy Comparison output (SCUI container)
- Save/Load/Export/Import

### 2. Business Calculator (8,806 lines)
**Sidebar Navigation — 5 sections:**
- **Practice Planning:** My Plan, GDC Brackets, Products, Sales Funnel
- **Team & Growth:** Recruiting, Channels, Dashboard, P&L
- **Client Planning:** Client Profile, Cash Flow, Protection, Growth, Retirement, Tax, Estate
- **Advanced:** Advanced, Education, Business, Cost-Benefit, Strategy Compare, Timeline, Summary, Partner
- **References:** Sources & Citations

**Key Feature:** Combined Practice + Personal panel with:
- Adjustable growth rate, horizon (5-100+ yrs), savings rate
- SVG wealth trajectory chart
- Forward-plan from inputs OR back-plan from target income
- Roll-up/roll-down across all hierarchy levels

### 3. Quick Quote (5,675 lines)
- Single-product illustrations with multi-carrier comparison
- Term, UL, IUL, Whole Life, FIA, DI, LTC

## Core Architecture: 4 Engines as IIFEs
1. **UWE** (Universal Wealth Engine) — product-level simulation
2. **BIE** (Business Income Engine) — practice income modeling
3. **HE** (Holistic Engine) — combines BIE + UWE; business income feeds savings → product growth → tax savings reinvestment
4. **SCUI** (Strategy Compare UI) — comparison rendering

## The Holistic Principle
> "All value channels flow forward/back, roll-up/roll-down across all hierarchy levels."

- Business income feeds savings contributions (net income × savings rate)
- Savings feed product growth
- Product growth compounds with tax savings reinvestment
- One profile drives everything — change age and ALL domains recalculate
- Forward planning: given inputs, project outcomes
- Back planning: given target, reverse-engineer required inputs
- Roll-up: aggregate team/org economics
- Roll-down: decompose targets to individual requirements

## What the Current App Gets WRONG
The current Calculators.tsx has:
- 12+ disconnected mini-calculators in tabs (IUL, PF, Retirement, MC, Tax, SS, Medicare, HSA, Charitable, Divorce, Education)
- Each operates independently with its own inputs
- No shared profile driving all calculations
- No forward/back planning toggle
- No roll-up/roll-down across hierarchy
- No connection between business income and personal wealth
- Wealth Engine pages are separate routes, not integrated

## What Needs to Change
The Calculators page should be rebuilt as a **unified hub** that mirrors the v7 structure:
1. **Single client profile** at the top that drives all calculations
2. **Domain panels** (Protection, Growth, Retirement, Tax, Estate, Education) that auto-update from profile
3. **Holistic Engine** panel that combines business + personal
4. **Strategy Compare** that shows all strategies side-by-side
5. **Summary** with holistic wealth trajectory
6. Links to deep-dive Wealth Engine pages for advanced analysis
