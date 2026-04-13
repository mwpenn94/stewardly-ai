# Gap Map: v7 HTML ↔ Current App

## v7 Client Calculator Domain Functions → App Pages

| v7 Domain | v7 Function | v7 Scoring | App Page | App Status | Gap |
|-----------|-------------|------------|----------|------------|-----|
| Client Profile | calcCProf() | Scorecard + Recs | useFinancialProfile hook | ✅ Profile exists, no scorecard | Need scorecard roll-up |
| Cash Flow | calcCF() | SS.cash (0-3) | IncomeProjection.tsx (468L) | ✅ Functional | No domain score |
| Protection | calcPR() | SS.protect (0-3) | InsuranceAnalysis.tsx (457L), FinancialProtectionScore.tsx (281L) | ✅ Functional | No DIME gap calc |
| Growth | calcGR() | SS.growth (0-3) | FinancialPlanning.tsx (801L) | ✅ Functional | No domain score |
| Retirement | calcRT() | SS.retire (0-3) | wealth-engine/Retirement.tsx (615L) | ✅ Functional | No domain score |
| Tax | calcTX() | SS.tax (0-3) | TaxPlanning.tsx (458L) | ✅ Functional | No domain score |
| Estate | calcES() | SS.estate (0-3) | EstatePlanning.tsx (359L) | ✅ Functional | No domain score |
| Education | calcED() | SS.edu (0-3) | Calculators.tsx (stub) | ❌ Stub only | Need full calc |
| Cost-Benefit | buildCostBenDash() | ROI ratio | — | ❌ Missing | Need cost-benefit panel |
| Strategy Compare | calcCompare() | Side-by-side | StrategyComparison.tsx (1123L) | ✅ Functional | Already exists |
| Summary | calcSum() | Overall % | — | ❌ Missing | Need summary roll-up |
| Timeline | calcTimeline() | Action plan | — | ❌ Missing | Need action timeline |

## v7 Business Calculator → App Pages

| v7 Domain | App Page | Status | Gap |
|-----------|----------|--------|-----|
| GDC Brackets | BusinessIncome.tsx (1098L) | ✅ | — |
| Products & Mix | BusinessIncome.tsx | ✅ | — |
| Sales Funnel | — | ❌ | Missing |
| Recruiting | TeamBuilder.tsx (768L) | ✅ | — |
| Marketing Channels | — | ❌ | Missing |
| Dashboard (P&L) | EngineDashboard.tsx | ✅ | — |
| Combined Practice + Personal | PracticeToWealth.tsx (393L) | ✅ Partial | Missing cost-benefit roll-up |
| Multi-Stream Roll-Up | TeamBuilder.tsx (rollUp) | ✅ | — |
| My Plan | — | ❌ | Missing action plan |

## v7 Quick Quote → App Pages

| v7 Section | App Page | Status |
|------------|----------|--------|
| 6-field input | QuickQuoteFlow.tsx (431L) | ✅ |
| Protection Gap | QuickQuoteFlow.tsx | ✅ |
| Retirement Gap | QuickQuoteFlow.tsx | ✅ |
| Growth Opportunity | QuickQuoteFlow.tsx | ✅ |
| Next Steps | QuickQuoteFlow.tsx | ✅ |
| Cost-Benefit | — | ❌ Missing |
| Strategy Compare | — | ❌ Missing |

## Current Calculators.tsx — What Exists

| Calculator | Status | Lines | Quality |
|------------|--------|-------|---------|
| IUL | ✅ Functional | ~100 | Good inline calc |
| Premium Finance | ✅ Functional | ~100 | Good inline calc |
| Retirement | ✅ Functional | ~80 | Good inline calc |
| Tax Projector | ❌ Stub | ~30 | CalcPanel placeholder |
| Social Security | ❌ Stub | ~30 | CalcPanel placeholder |
| Medicare | ❌ Stub | ~30 | CalcPanel placeholder |
| HSA | ❌ Stub | ~30 | CalcPanel placeholder |
| Charitable | ❌ Stub | ~30 | CalcPanel placeholder |
| Divorce | ❌ Stub | ~30 | CalcPanel placeholder |
| Education | ❌ Stub | ~30 | CalcPanel placeholder |
| LTC | ❌ Stub | ~30 | CalcPanel placeholder |
| Umbrella | ❌ Stub | ~30 | CalcPanel placeholder |

## THE CORE PROBLEM

The v7 HTML files have ONE master function `cA()` that:
1. Reads a shared client profile (age, income, assets, dependents, etc.)
2. Runs ALL domain calculations simultaneously (CF, PR, GR, RT, TX, ES, ED)
3. Each domain produces a score (0-3)
4. Scores roll up to a composite Financial Health % (0-100)
5. An action timeline prioritizes what to do first

The current app has:
- ✅ The shared profile (useFinancialProfile)
- ✅ Individual domain pages that are functional
- ❌ NO composite scoring system
- ❌ NO cross-domain roll-up view
- ❌ NO action timeline
- ❌ NO cost-benefit analysis
- ❌ The Calculators page is 12 disconnected tabs, 9 of which are stubs

## WHAT THE REBUILD MUST DO

Replace Calculators.tsx with a **Holistic Planning Hub** that:

1. **Profile Bar** — Shows key profile fields with inline edit, completeness gauge
2. **Domain Scorecard** — 7 domains, each scored 0-3, rolling up to composite %
   - Each domain card shows: score, key metric, gap, and link to deep-dive page
   - Scoring logic mirrors v7: calcCF, calcPR, calcGR, calcRT, calcTX, calcES, calcED
3. **Financial Health Gauge** — Circular gauge showing composite score
4. **Recommended Products** — Based on profile gaps (mirrors v7 calcCProf)
5. **Action Timeline** — Prioritized actions by urgency (mirrors v7 calcTimeline)
6. **Cost-Benefit Summary** — Total planning cost vs total benefit value
7. **Quick Actions** — "Run Strategy Comparison", "Generate Report", "Quick Quote"

This is NOT about adding more mini-calculators. It's about creating the
HOLISTIC VIEW that ties all existing domain pages together through a
shared scoring system.
