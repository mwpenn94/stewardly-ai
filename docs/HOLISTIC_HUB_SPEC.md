# Holistic Planning Hub — Architecture Spec

## Overview

Replace the current fragmented Calculators.tsx (12 disconnected tabs, 9 stubs)
with a **Holistic Planning Hub** that mirrors the v7 HTML architecture:
one shared profile drives all domain calculations simultaneously, producing
a composite Financial Health score with domain-level drill-down.

## Design Principles

1. **Profile-driven, not input-driven** — The hub reads the shared
   FinancialProfile and computes all domains. No separate input forms per domain.
2. **Score everything** — Each domain gets a 0-3 score. Scores roll up to
   a composite Financial Health percentage.
3. **Link, don't duplicate** — Domain deep-dives already exist as standalone
   pages (TaxPlanning, EstatePlanning, etc.). The hub shows summaries and
   links to them.
4. **Action-oriented** — The bottom of the hub shows a prioritized action
   timeline based on which domains score lowest.
5. **Mobile-first** — The hub must work beautifully on mobile. No horizontal
   scrolling, no cramped tables.

## Component Architecture

```
HolisticPlanningHub (replaces Calculators.tsx)
├── ProfileBar
│   ├── Key fields: age, income, filing status, dependents, net worth
│   ├── Completeness gauge (0-100%)
│   └── "Edit Profile" link → Financial Profile panel
├── FinancialHealthGauge
│   ├── Circular SVG gauge (composite score %)
│   ├── Score fraction (e.g., 14/21)
│   └── Stage label (Young Professional, Mid-Career, etc.)
├── DomainScorecard (7 domain cards in a responsive grid)
│   ├── DomainCard: Cash Flow
│   │   ├── Score badge (0-3, color-coded)
│   │   ├── Key metric: Savings rate, DTI, emergency fund status
│   │   ├── Status: "Healthy" / "Needs attention" / "Critical"
│   │   └── Link → /income-projection
│   ├── DomainCard: Protection
│   │   ├── Score badge
│   │   ├── Key metric: Life gap, DI gap, total premium
│   │   └── Link → /protection-score, /insurance-analysis
│   ├── DomainCard: Growth & Investment
│   │   ├── Score badge
│   │   ├── Key metric: Projected balance at retirement
│   │   └── Link → /financial-planning
│   ├── DomainCard: Retirement
│   │   ├── Score badge
│   │   ├── Key metric: Readiness %, income replacement ratio
│   │   └── Link → /wealth-engine/retirement
│   ├── DomainCard: Tax Planning
│   │   ├── Score badge
│   │   ├── Key metric: Effective rate, optimization opportunity
│   │   └── Link → /tax-planning
│   ├── DomainCard: Estate Planning
│   │   ├── Score badge
│   │   ├── Key metric: Estate tax exposure, trust status
│   │   └── Link → /estate
│   └── DomainCard: Education (if dependents > 0)
│       ├── Score badge
│       ├── Key metric: 529 gap, years to college
│       └── Link → (inline or future page)
├── RecommendedProducts
│   ├── Table: Product, Coverage, Est. Premium, Priority, Carrier
│   ├── Based on profile gaps (mirrors v7 calcCProf)
│   └── Total annual planning cost + % of income
├── CostBenefitSummary
│   ├── Annual planning cost vs total benefit value
│   ├── ROI ratio (e.g., 47:1)
│   └── Net planning cost after referral offset
├── ActionTimeline
│   ├── Prioritized list: URGENT → Important → Maintain
│   ├── Each action: Area, Action, Timeline, Est. Cost
│   └── Mirrors v7 calcTimeline logic
└── QuickActions
    ├── "Run Strategy Comparison" → /wealth-engine/strategy-comparison
    ├── "Generate Report" → triggers report generation
    ├── "Quick Quote" → /wealth-engine/quick-quote
    └── "What-If Analysis" → /wealth-engine/sensitivity
```

## Domain Scoring Logic (Client-Side)

All scoring happens client-side using the shared FinancialProfile.
This mirrors the v7 `cA()` master function.

```typescript
interface DomainScore {
  domain: string;
  score: 0 | 1 | 2 | 3;  // 0=not scored, 1=critical, 2=needs work, 3=strong
  label: string;
  metrics: { name: string; value: string; status: "good" | "warn" | "bad" }[];
  actions: string[];
  deepDiveUrl: string;
}

// Cash Flow: savings rate ≥15% → 3, ≥10% → 2, else 1
// Protection: life gap ≤ 0 AND DI gap ≤ 0 → 3, gap < 5× income → 2, else 1
// Growth: projected balance ≥ target → 3, ≥ 75% → 2, else 1
// Retirement: income replacement ≥ 80% → 3, ≥ 60% → 2, else 1
// Tax: effective rate ≤ optimal → 3, within 5% → 2, else 1
// Estate: coverage ≥ estate value → 3, ≥ 50% → 2, else 1
// Education: 529 balance ≥ projected cost → 3, ≥ 50% → 2, else 1
```

## Recommended Products Logic (Client-Side)

Mirrors v7 `calcCProf()` product recommendation engine:
- Term Life: if existing insurance < DIME need × 50%
- IUL: always recommended for accumulation
- Whole Life: consider for estate planning
- Disability: if age < 65
- LTC Hybrid: if age ≥ 30
- FIA: if age ≥ 35 or net worth > $100K
- 401k/Roth: always recommended
- Advisory/AUM: if net worth > $50K
- 529: if dependents > 0
- Premium Finance: if net worth > $2M and income > $250K
- Key Person / Buy-Sell: if business owner
- Estate Plan: if net worth > $500K (high priority)

## File Structure

```
client/src/lib/holisticScoring.ts     — Pure scoring functions (no React)
client/src/lib/holisticScoring.test.ts — Tests for scoring logic
client/src/pages/Calculators.tsx       — Rebuilt as HolisticPlanningHub
```

## What Gets Removed

- All 12 tab-switched mini-calculators
- All 9 CalcPanel stubs
- The CALCULATORS array and tab switcher
- The "More Tools" links section (replaced by domain cards with links)

## What Gets Preserved

- The 3 functional inline calculators (IUL, PF, Retirement) remain accessible
  via their existing wealth-engine pages
- All existing standalone pages (TaxPlanning, Estate, etc.) remain unchanged
- The sidebar navigation remains unchanged
- The WealthEngineHub remains as the "power user" entry point

## Mobile Layout

- ProfileBar: horizontal scroll on small screens, key fields visible
- FinancialHealthGauge: centered, 120px diameter
- DomainScorecard: 1 column on mobile, 2 columns on tablet, 3-4 on desktop
- RecommendedProducts: card list on mobile, table on desktop
- ActionTimeline: card list on mobile, table on desktop
