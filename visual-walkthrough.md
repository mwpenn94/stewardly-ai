# Visual Walkthrough — Full Findings

## Page 1: Calculators (/calculators)
- LOADS for guest, no auth loop
- Retirement calculator works: sliders + Calculate Projection produces results table and chart
- 12 calculators grouped by Plan/Protect/Grow
- BUT: very basic — just sliders and a table. No holistic scorecard visible, no radar chart, no composite score ring
- The "Complete Your Financial Profile" CTA is shown instead of the scorecard (expected for guest)

## Page 2: Engine Dashboard (/engine-dashboard)
- LOADS for guest
- Has Quick-Load Scenarios (WealthBridge vs Do Nothing, Pro Biz Income, 4-Way Company Battle, Director Career Path)
- Client Profile sliders (Age, Income, Net Worth, Savings, Dependents, Mortgage, Projection)
- Strategies section (2/6) with WealthBridge Client and Do Nothing
- Tabs: Holistic, Income, Monte Carlo, Stress, Back-Plan, References
- "No projections yet" — needs Run All Engines
- This is the v7 UWE + BIE + HE + SCUI engine

## Page 3: Wealth Engine (/wealth-engine)
- LOADS for guest
- Has Quick Bundle with client inputs (Age, Income, Net Worth, Dependents, State, Homeowner, Biz owner)
- Run bundle button
- All/Plan/Protect/Grow tabs
- Plan section: Retirement, Tax Projector, Estate Planning, Risk Assessment, Income Projection, SS, Medicare, HSA, Education, Charitable
- Protect section: Quick Bundle, Protection Score, Strategy Comparison, Insurance Analysis, IUL, Premium Finance, DI, LTC
- Grow section: Engine Dashboard, Owner Comp, Business Valuation, Practice-to-Wealth, Monte Carlo, Financial Twin, Wealth Projection, Workflows
- This is a comprehensive hub/directory of all tools

## KEY ISSUES IDENTIFIED:

### 1. DUPLICATE PAGES — Wealth Engine vs Engine Dashboard vs Calculators
Three separate pages doing overlapping things:
- /wealth-engine = comprehensive tool directory + Quick Bundle
- /engine-dashboard = v7 holistic engine with strategies and projections
- /calculators = individual calculator panels with sliders

The user is right — this is confusing. The v7 HTML docs had ONE unified calculator suite, not 3 separate pages.

### 2. Calculators page is too basic
The v7 HTML had:
- 7-domain Financial Health Scorecard with composite score
- Radar chart visualization
- What-If scenario panel
- Recommended products with cost-benefit
- All integrated into ONE scrollable page with sidebar navigation

Current Calculators page has:
- Basic sliders
- Results table
- No scorecard (only shows when profile exists)
- No radar chart
- No integrated What-If panel

### 3. No auth loop detected
The user reported an auth loop — this might be on the published version, not dev. Need to check if there's a redirect loop in the code.

### 4. Sidebar has both "Wealth Engine" and "Engine Dashboard" — confusing
