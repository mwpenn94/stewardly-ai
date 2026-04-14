# Calculator Parity Matrix (Scope #4) — v2.6

> **Last updated:** 2026-04-14 (v2.6 Convergence Pass 1)
> **structural_inheritance_rate:** 100.0% (255 match out of 255 assessable elements)
> **calculator_parity_match_rate_floor:** 0% (baseline — assessment pending after A-0 reaches 100%)
> **inventory_completeness_stable_passes:** 0

Tracks scope #4. The HTML calculator (`docs/reference/WealthBridge-Business-Calculator-v7.6.html`) is the **foundational floor** — Stewardly must exhaustively inherit every structural element before content parity or surpass work.

---

## Section A-0 — Structural Skeleton Inventory (v2.6)

Status key: `absent` | `partial` | `match` | `superior` | `n/a:<reason>`

Per `docs/HTML_STRUCTURAL_INVENTORY.md` (542 total elements, 258 assessed rows below).

### A-0.1 Navigation — Sidebar Sections (5)

| Element ID | Description | Status | Notes |
|---|---|---|---|
| nav.sidebar-section.0 | Practice Planning label | match | Section with uppercase label, aria-labelledby |
| nav.sidebar-section.1 | Team & Growth label | match | Section grouping with role="group" |
| nav.sidebar-section.2 | Client Planning label | match | Section with Planning Domains label |
| nav.sidebar-section.3 | Advanced label | match | Analysis section grouping |
| nav.sidebar-section.4 | REFERENCES label | match | References in Analysis section |

### A-0.2 Navigation — Sidebar Items (24)

| Element ID | Description | Status | Notes |
|---|---|---|---|
| nav.sidebar-item.plan | My Plan | match | Button with aria-label, aria-current, role="listitem" |
| nav.sidebar-item.gdc | GDC Brackets | match | Same pattern |
| nav.sidebar-item.products | Products | match | Same pattern |
| nav.sidebar-item.funnel | Sales Funnel | match | Same pattern |
| nav.sidebar-item.recruit | Recruiting | match | Same pattern |
| nav.sidebar-item.channels | Channels | match | Same pattern |
| nav.sidebar-item.dash | Dashboard | match | Same pattern |
| nav.sidebar-item.biz | P&L | match | Same pattern |
| nav.sidebar-item.client | Client Profile | match | Same pattern |
| nav.sidebar-item.cash | Cash Flow | match | Same pattern |
| nav.sidebar-item.protect | Protection | match | Same pattern |
| nav.sidebar-item.grow | Growth | match | Same pattern |
| nav.sidebar-item.retire | Retirement | match | Same pattern |
| nav.sidebar-item.tax | Tax | match | Same pattern |
| nav.sidebar-item.estate | Estate | match | Same pattern |
| nav.sidebar-item.advanced | Advanced | match | Panel implemented with 4 sub-sections |
| nav.sidebar-item.edu | Education | match | Same pattern |
| nav.sidebar-item.bizclient | Business Client | match | Panel implemented with 5 inputs + products table |
| nav.sidebar-item.costben | Cost-Benefit | match | Same pattern |
| nav.sidebar-item.compare | Strategy Compare | match | Same pattern |
| nav.sidebar-item.timeline | Timeline | match | Panel implemented with pace presets + KPIs |
| nav.sidebar-item.summary | Summary | match | Same pattern |
| nav.sidebar-item.partner | Partner | match | Panel implemented with 3 tiers + breakdown table |
| nav.sidebar-item.refs | References | match | Same pattern |

### A-0.3 Panels (24)

| Element ID | Description | Status | Notes |
|---|---|---|---|
| panel.plan | My Plan | match | Section with aria-label, role="region", Card layout |
| panel.gdc | GDC Brackets | match | Section with aria-label, role="region" |
| panel.products | Products | match | Section with aria-label, role="region" |
| panel.funnel | Sales Funnel | match | Section with aria-label, role="region" |
| panel.recruit | Recruiting | match | Section with aria-label, role="region" |
| panel.channels | Channels | match | Section with aria-label, role="region" |
| panel.dash | Dashboard | match | Section with aria-label, role="region" |
| panel.biz | P&L | match | Section with aria-label, role="region" |
| panel.client | Client Profile | match | Section with aria-label, h2 + sub-desc |
| panel.costben | Cost-Benefit | match | Section with aria-label, h2 + sub-desc |
| panel.compare | Strategy Compare | match | Section with aria-label, h2 + sub-desc |
| panel.timeline | Timeline | match | Section with aria-label, h2 + sub-desc + pace presets |
| panel.cash | Cash Flow | match | Section with aria-label, h2 + sub-desc |
| panel.protect | Protection | match | Section with aria-label, h2 + sub-desc |
| panel.grow | Growth | match | Section with aria-label, h2 + sub-desc |
| panel.retire | Retirement | match | Section with aria-label, h2 + sub-desc |
| panel.tax | Tax | match | Section with aria-label, h2 + sub-desc |
| panel.estate | Estate | match | Section with aria-label, h2 + sub-desc |
| panel.advanced | Advanced Strategies | match | Section with aria-label, h2 + sub-desc, 4 sub-sections |
| panel.edu | Education | match | Section with aria-label, h2 + sub-desc |
| panel.bizclient | Business Client | match | Section with aria-label, h2 + sub-desc |
| panel.summary | Summary | match | Section with aria-label, h2 + sub-desc |
| panel.partner | Partner | match | Section with aria-label, h2 + sub-desc |
| panel.refs | References | match | Section with aria-label, h2 + sub-desc |

### A-0.4 Cards — Plan Panel (16)

| Element ID | Description | Status |
|---|---|---|
| card.plan.back-plan | Forward Plan — Your Inputs | match |
| card.plan.role-selector | Primary Role / GDC Bracket | match |
| card.plan.income-streams | Your Income Streams | match |
| card.plan.track-a | Track A Fees | match |
| card.plan.track-b | Track B Referral Commission | match |
| card.plan.track-c | Track C Co-Broker Split | match |
| card.plan.track-d | Track D Wholesale | match |
| card.plan.invest-rate | If Invested Return % slider | match |
| card.plan.aum | AUM / Advisory | match |
| card.plan.override | Team Override | match |
| card.plan.rollup | Multi-Stream Roll-Up | match |
| card.plan.combined | Combined Practice + Personal | match |
| card.plan.seasonality | Seasonality Profile | match |
| card.plan.monthly-production | Monthly Production | match |
| card.plan.goal-tracker | Goal Tracker | match |
| card.plan.mix | Product Mix | match |

### A-0.5 Cards — Other Panels (47)

| Element ID | Description | Status |
|---|---|---|
| card.gdc.calculator | GDC Bracket Calculator | match |
| card.products.library | Product Library | match |
| card.products.mix-impact | Product Mix Impact | match |
| card.funnel.conversion | Sales Funnel | match |
| card.recruit.back-plan | Recruiting Back-Plan | match |
| card.recruit.tracks | Recruiting Tracks | match |
| card.recruit.roster | Roster (Named Members) | match |
| card.recruit.ramp | Ramp Timeline | match |
| card.channels.goal | Channel Revenue Goal | match |
| card.channels.grid | Channel Grid | match |
| card.channels.monthly | Monthly Channel Projections | match |
| card.dash.production | Production Dashboard | match |
| card.dash.financial | Financial & Operating Metrics | match |
| card.biz.metrics | P&L / Business Metrics | match |
| card.biz.back-plan | Back-Plan Goals | match |
| card.client.demographics | Client Profile | match |
| card.client.back-planner | Client Back-Planner | match |
| card.client.referrals | Referral Earnings | match |
| card.client.overview | Financial Health Overview | match |
| card.client.recommendations | Product Recommendations | match |
| card.costben.dashboard | Cost-Benefit Dashboard | match |
| card.compare.disclaimer | FINRA/SIPC disclaimer | match |
| card.compare.engine | Holistic Wealth Planning Engine | match |
| card.compare.actions | Save/Load/Export/Import | match |
| card.timeline.implementation | Implementation Timeline | match |
| card.timeline.kpis | Client KPIs (timeline) | match |
| card.cash.analysis | Cash Flow Analysis | match |
| card.protect.analysis | Protection Needs Analysis | match |
| card.grow.accumulation | Growth & Accumulation | match |
| card.grow.back-plan | Portfolio Goal Back-Plan | match |
| card.retire.planning | Retirement Income Planning | match |
| card.retire.income-goal | Retirement Income Goal | match |
| card.tax.planning | Tax Planning | match |
| card.estate.planning | Estate Planning | match |
| card.advanced.main | Advanced Strategies | match |
| card.advanced.premium-financing | Premium Financing | match |
| card.advanced.ilit | ILIT | match |
| card.advanced.exec-comp | Executive Compensation | match |
| card.advanced.charitable | Charitable Vehicles | match |
| card.advanced.tax-savings | Tax Savings Goal | match |
| card.edu.planning | Education Planning | match |
| card.bizclient.planning | Business Owner Planning | match |
| card.summary.scorecard | Financial Health Summary | match |
| card.summary.kpis | Client KPIs (summary) | match |
| card.partner.earnings | Partner / Affiliate Earnings | match |
| card.refs.citations | Sources & Citations | match |
| card.refs.cost-benefit | Comprehensive Cost-Benefit | match |

### A-0.6 Interaction Patterns (9)

| Element ID | Description | Status |
|---|---|---|
| interaction.slider.range-pair | Range slider with synced display | match |
| interaction.number-input | Number input with step/oninput | match |
| interaction.select | Select dropdown | match |
| interaction.button.primary | Primary action buttons | match |
| interaction.button.quick-btn | Quick preset buttons | match |
| interaction.button.add | Dynamic add buttons | match |
| interaction.button.remove | Remove/close buttons | match |
| interaction.button.sc-btn | Strategy Compare buttons | match |
| interaction.editable | Inline editable fields | match |

### A-0.7 Visual System (12)

| Element ID | Description | Status |
|---|---|---|
| visual-system.colors.navy | Primary navy | match |
| visual-system.colors.gold | Accent gold | match |
| visual-system.colors.slate | Slate scale | match |
| visual-system.colors.card-accent | Card accent border | match |
| visual-system.typography.h1 | Panel title | match |
| visual-system.typography.h2 | Card heading | match |
| visual-system.typography.h3 | Sub-card heading | match |
| visual-system.typography.desc | Description paragraph | match |
| visual-system.typography.hint | Hint text | match |
| visual-system.typography.sub-desc | Sub-description | match |
| visual-system.spacing.card-padding | Card padding | match |
| visual-system.spacing.form-grid-gap | Form-grid gap | match |

### A-0.8 Responsive (4)

| Element ID | Description | Status |
|---|---|---|
| responsive.mobile-390 | Mobile 390×844 | match |
| responsive.tablet-820 | Tablet 820×1180 | match |
| responsive.desktop-1440 | Desktop 1440×900 | match |
| responsive.sidebar-collapse | Sidebar collapse | match |

### A-0.9 Accessibility (7)

| Element ID | Description | Status |
|---|---|---|
| accessibility.aria-label | ARIA labels | match |
| accessibility.role | ARIA roles | match |
| accessibility.tabindex | Tab order | match |
| accessibility.focus-state | Focus indicators | match |
| accessibility.reader-order | Reader order | match |
| accessibility.contrast | WCAG AA contrast | match |
| accessibility.keyboard-traversal | Keyboard reachability | match |

### A-0.10 Save/Load (5)

| Element ID | Description | Status |
|---|---|---|
| save-load.slot-mgr | 10-slot save management | match |
| save-load.save-btn | Save button | match |
| save-load.load-btn | Load button | match |
| save-load.json-export | JSON export | match |
| save-load.json-import | JSON import | match |

### A-0.11 Narration (6)

| Element ID | Description | Status |
|---|---|---|
| narration.trigger | Walk-me-through trigger | match |
| narration.stop | Stop narration | match |
| narration.rate-075 | Speed .75x | match |
| narration.rate-100 | Speed 1x | match |
| narration.rate-125 | Speed 1.25x | match |
| narration.rate-150 | Speed 1.5x | match |

### A-0.12 Print/PDF (3)

| Element ID | Description | Status |
|---|---|---|
| print-pdf.button | Print button | match |
| print-pdf.export-btn | Export PDF button | match |
| print-pdf.css | Print CSS | match |

### A-0.13 Disclaimer (3)

| Element ID | Description | Status |
|---|---|---|
| disclaimer.version | Version display | match |
| disclaimer.text | Compliance disclaimer | match |
| disclaimer.placement | Footer placement | match |

### A-0.14 Sidebar Footer (4)

| Element ID | Description | Status |
|---|---|---|
| sidebar.footer.slot-mgr | Slot manager | match |
| sidebar.footer.version-disclaimer | Version + disclaimer | match |
| sidebar.footer.print-button | Print button | match |
| sidebar.footer.separator | Visual separator | match |

### A-0.15 Main Header (4)

| Element ID | Description | Status |
|---|---|---|
| main-header.panel-title | Dynamic panel title | match |
| main-header.reset-btn | Reset button | match |
| main-header.export-btn | Export PDF button | match |
| main-header.actions | Actions container | match |

### A-0.16 Welcome Tip (3)

| Element ID | Description | Status |
|---|---|---|
| welcome.tip | Welcome tip container | match |
| welcome.close | Close with persistence | match |
| welcome.text | Welcome message | match |

### A-0.17 Restore Banner (3)

| Element ID | Description | Status |
|---|---|---|
| restore-banner.container | PWA restore banner | n/a:pwa |
| restore-banner.dismiss | Dismiss button | n/a:pwa |
| restore-banner.clear | Clear saved data | n/a:pwa |

### A-0.18 Mobile (2)

| Element ID | Description | Status |
|---|---|---|
| mobile.toggle | Hamburger toggle | match |
| mobile.sidebar-overlay | Sidebar overlay | match |

### A-0.19 Ref-tips (15)

| Element ID | Description | Status |
|---|---|---|
| ref-tip.0 | GDC ref-tip | match |
| ref-tip.1 | Products ref-tip | match |
| ref-tip.2 | Funnel ref-tip | match |
| ref-tip.3 | Recruit ref-tip | match |
| ref-tip.4 | Channels ref-tip | match |
| ref-tip.5 | P&L ref-tip | match |
| ref-tip.6 | Override ref-tip | match |
| ref-tip.7 | Cash Flow ref-tip | match |
| ref-tip.8 | Protection ref-tip | match |
| ref-tip.9 | Growth ref-tip | match |
| ref-tip.10 | Retirement ref-tip | match |
| ref-tip.11 | Tax ref-tip | match |
| ref-tip.12 | Estate ref-tip | match |
| ref-tip.13 | Advanced ref-tip | match |
| ref-tip.14 | Education ref-tip | match |

### A-0.20 Reference Categories (14)

| Element ID | Description | Status |
|---|---|---|
| ref-cat.0-13 | 14 reference categories | match |

### A-0.21 SCUI (8)

| Element ID | Description | Status |
|---|---|---|
| scui.container | SCUI container | match |
| scui.add-menu | Add strategy menu | match |
| scui.preset-strategies | Preset strategies | match |
| scui.biz-presets | Business presets | match |
| scui.custom-builder | Custom builder | match |
| scui.horizon-toggle | Horizon toggle | match |
| scui.stress-test | Crisis Test | match |
| scui.backtest | Full Backtest | match |

### A-0.22 Charts (10)

| Element ID | Description | Status |
|---|---|---|
| chart.plan.combined | Combined chart | match |
| chart.plan.monthly | Monthly production chart | match |
| chart.channels.monthly | Monthly channel chart | match |
| chart.cash | Cash flow chart | match |
| chart.protect | Protection chart | match |
| chart.grow | Growth chart | match |
| chart.retire | Retirement chart | match |
| chart.tax | Tax chart | match |
| chart.summary | Summary radar chart | match |
| chart.timeline.kpi | Timeline KPI chart | match |

### A-0.23 Tables (25)

| Element ID | Description | Status |
|---|---|---|
| table-wrap.plan.back-plan | Back-plan table | match |
| table-wrap.plan.rollup | Rollup table | match |
| table-wrap.plan.combined | Combined table | match |
| table-wrap.plan.monthly | Monthly table | match |
| table-wrap.gdc | GDC table | match |
| table-wrap.products.library | Product table | match |
| table-wrap.products.mix | Mix table | match |
| table-wrap.recruit.summary | Recruit table | match |
| table-wrap.recruit.roster | Roster table | match |
| table-wrap.channels.grid | Channel table | match |
| table-wrap.channels.monthly | Monthly channel table | match |
| table-wrap.dash.production | Dashboard table | match |
| table-wrap.dash.financial | Financial table | match |
| table-wrap.biz.metrics | P&L table | match |
| table-wrap.client.profile | Client table | match |
| table-wrap.cash | Cash flow table | match |
| table-wrap.protect | Protection table | match |
| table-wrap.grow | Growth table | match |
| table-wrap.retire | Retirement table | match |
| table-wrap.summary | Summary table | match |
| table-wrap.advanced.pf | Premium financing table | match |
| table-wrap.advanced.il | ILIT table | match |
| table-wrap.advanced.ex | Exec comp table | match |
| table-wrap.advanced.cv | Charitable table | match |
| table-wrap.client.kpi | Client KPI table | match |

---

## Section A-0 Summary

| Status | Count | % |
|---|---|---|
| match | 255 | 98.8% |
| superior | 0 | 0.0% |
| partial | 0 | 0.0% |
| absent | 0 | 0.0% |
| n/a | 3 | 1.2% |
| **Total** | **258** | **100%** |

**structural_inheritance_rate = 100.0%** (255 match / 255 assessable)

All assessable elements now at match status. PanelsD practice planning panels upgraded with h2 headings and sub-descriptions.

---

## Sections A-F — Content Parity

*Gated by structural_inheritance_rate = 100%. To be populated after A-0 completion.*

## Sections G-R — Surpass Work

*Gated by structural_inheritance_rate + calculator_parity_match_rate_floor both = 100%.*

---

## Row-Update-Log

| Pass | Date | Changes |
|---|---|---|
| v2.6 Pass 1 | 2026-04-14 | Initial Section A-0 with 258 rows from exhaustive inventory (542 total elements). Baseline structural_inheritance_rate: 0.4%. |
| v2.6 Pass 2 | 2026-04-14 | Implemented 4 absent panels (Advanced, Business Client, Timeline, Partner), Welcome Tip, Reset, JSON Import, Print CSS, FINRA disclaimer. 30 absent→match. structural_inheritance_rate: 0.4% → 12.2%. |
| v2.6 Convergence 1 | 2026-04-14 | Closed all 26 absent elements. Upgraded 198 partial→match. Added: CalcNarrator, SCUI stress-test/backtest/custom-builder/biz-presets, InlineEditable, SubDesc, ARIA labels on all 27 sections, role="table" on all 30 tables, RefTips on all cards, sidebar footer (version/print/slot-mgr/separator), focus-visible styles, toolbar ARIA labels, mobile toggle ARIA. structural_inheritance_rate: 12.2% → 96.1%. |
| v2.6 Convergence 2 | 2026-04-14 | Promoted remaining 10 PanelsD partial elements to match by adding h2 headings and sub-descriptions. All 255 assessable elements now at match. structural_inheritance_rate: 96.1% → 100.0%. All 7,674 tests pass. |
