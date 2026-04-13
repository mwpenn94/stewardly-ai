# Calculator Review Notes

## Current State (1,328 lines)
- Wrapped in AppShell with title="Calculators"
- Has its own redundant sticky header inside AppShell (lines 172-183) — should be removed since AppShell provides mobile header
- Three sections:
  1. Holistic Wealth Engine link (button navigating to /wealth-engine)
  2. Wealth Engine grid (13 tool cards linking to sub-pages)
  3. Planning & Analysis grid (6 tool cards linking to sub-pages)
  4. Calculator selector cards (12 calculators: IUL, PF, Ret, Tax, SS, Medicare, HSA, Charitable, Divorce, Education, Stress, Monte Carlo)

## Issues Found
1. **Redundant header**: Lines 172-183 create a sticky header with back button + "Financial Calculators" label, but AppShell already provides mobile header with hamburger menu
2. **Too many sections**: Page is overwhelming — 3 link grids + 12 calculator tabs
3. **No holistic scorecard**: The holisticScoring engine exists but isn't surfaced on this page
4. **No profile pre-population**: Calculator inputs use hardcoded defaults instead of reading from useFinancialProfile
5. **No What-If scenarios**: The holisticScoringExtensions.ts has scenario engine but it's not used here
6. **No trajectory chart**: The projectTrajectory function exists but isn't visualized
7. **Inconsistent panel structure**: IUL, PF, Retirement are inline; Tax, SS, Medicare, HSA, Charitable, Divorce, Education use CalcPanel wrapper
8. **Stress Test and Monte Carlo** use different tRPC routers (wealthEngine vs calculatorEngine)
9. **Missing profile-driven defaults**: All sliders start at hardcoded values instead of reading from financial profile
10. **No empty state guidance**: When no profile exists, should guide user to fill out profile first

## Architecture
- holisticScoring.ts: 750 lines, 7-domain scoring engine, 37 tests passing
- holisticScoringExtensions.ts: 300 lines, pillar groupings, scenario engine, trajectory projection
- useFinancialProfile.ts: shared profile hook with localStorage persistence
- tRPC routers: calculators (IUL, PF, Ret), taxProjector, ssOptimizer, hsaOptimizer, medicareNav, charitableGiving, divorce, educationPlanner, wealthEngine (stress/backtest), calculatorEngine (Monte Carlo)

## Plan
1. Remove redundant header (AppShell handles it)
2. Add holistic scorecard at top (Plan/Protect/Grow pillars from profile)
3. Add What-If scenario comparison section
4. Add wealth trajectory mini-chart
5. Pre-populate calculator inputs from useFinancialProfile
6. Consolidate the link grids into a cleaner "Deep Dive Tools" section
7. Keep all 12 calculator panels but improve consistency
8. Add empty state with profile entry prompt when no profile data exists
