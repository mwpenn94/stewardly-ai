# Calculator Parity Matrix (Scope #4) — v2.6

> **Last updated:** 2026-04-14 (v2.6 Pass 2)
> **structural_inheritance_rate:** 12.2% (31 match out of 255 assessable elements)
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
| nav.sidebar-section.0 | Practice Planning label | partial | Stewardly has section in internal sidebar |
| nav.sidebar-section.1 | Team & Growth label | partial | Section grouping exists, label differs |
| nav.sidebar-section.2 | Client Planning label | partial | Section exists |
| nav.sidebar-section.3 | Advanced label | partial | Section grouping exists |
| nav.sidebar-section.4 | REFERENCES label | partial | References nav item exists |

### A-0.2 Navigation — Sidebar Items (24)

| Element ID | Description | Status | Notes |
|---|---|---|---|
| nav.sidebar-item.plan | My Plan | partial | Exists in internal sidebar |
| nav.sidebar-item.gdc | GDC Brackets | partial | Exists |
| nav.sidebar-item.products | Products | partial | Exists |
| nav.sidebar-item.funnel | Sales Funnel | partial | Exists |
| nav.sidebar-item.recruit | Recruiting | partial | Exists |
| nav.sidebar-item.channels | Channels | partial | Exists |
| nav.sidebar-item.dash | Dashboard | partial | Exists |
| nav.sidebar-item.biz | P&L | partial | Exists |
| nav.sidebar-item.client | Client Profile | partial | Exists |
| nav.sidebar-item.cash | Cash Flow | partial | Exists |
| nav.sidebar-item.protect | Protection | partial | Exists |
| nav.sidebar-item.grow | Growth | partial | Exists |
| nav.sidebar-item.retire | Retirement | partial | Exists |
| nav.sidebar-item.tax | Tax | partial | Exists |
| nav.sidebar-item.estate | Estate | partial | Exists |
| nav.sidebar-item.advanced | Advanced | match | Panel implemented with 4 sub-sections |
| nav.sidebar-item.edu | Education | partial | Exists |
| nav.sidebar-item.bizclient | Business Client | match | Panel implemented with 5 inputs + products table |
| nav.sidebar-item.costben | Cost-Benefit | partial | Exists |
| nav.sidebar-item.compare | Strategy Compare | partial | Exists |
| nav.sidebar-item.timeline | Timeline | match | Panel implemented with pace presets + KPIs |
| nav.sidebar-item.summary | Summary | partial | Exists |
| nav.sidebar-item.partner | Partner | match | Panel implemented with 3 tiers + breakdown table |
| nav.sidebar-item.refs | References | partial | Exists |

### A-0.3 Panels (24)

| Element ID | Description | Status | Notes |
|---|---|---|---|
| panel.plan | My Plan | partial | Has plan panel with income streams |
| panel.gdc | GDC Brackets | partial | Has GDC panel |
| panel.products | Products | partial | Has Products panel |
| panel.funnel | Sales Funnel | partial | Has Funnel panel |
| panel.recruit | Recruiting | partial | Has Recruiting panel |
| panel.channels | Channels | partial | Has Channels panel |
| panel.dash | Dashboard | partial | Has Dashboard panel |
| panel.biz | P&L | partial | Has P&L panel |
| panel.client | Client Profile | partial | Has Client Profile panel |
| panel.costben | Cost-Benefit | partial | Has Cost-Benefit panel |
| panel.compare | Strategy Compare | partial | Has Strategy Compare panel |
| panel.timeline | Timeline | match | Implementation Timeline with pace presets + Client KPIs |
| panel.cash | Cash Flow | partial | Has Cash Flow panel |
| panel.protect | Protection | partial | Has Protection panel |
| panel.grow | Growth | partial | Has Growth panel |
| panel.retire | Retirement | partial | Has Retirement panel |
| panel.tax | Tax | partial | Has Tax panel |
| panel.estate | Estate | partial | Has Estate panel |
| panel.advanced | Advanced Strategies | match | Premium Financing, ILIT, Exec Comp, Charitable Vehicles |
| panel.edu | Education | partial | Has Education panel |
| panel.bizclient | Business Client | match | Key Person, Buy-Sell, Group Benefits |
| panel.summary | Summary | partial | Has Summary panel |
| panel.partner | Partner | match | 3-tier earnings with breakdown table |
| panel.refs | References | partial | Has References panel |

### A-0.4 Cards — Plan Panel (16)

| Element ID | Description | Status |
|---|---|---|
| card.plan.back-plan | Forward Plan — Your Inputs | partial |
| card.plan.role-selector | Primary Role / GDC Bracket | partial |
| card.plan.income-streams | Your Income Streams | partial |
| card.plan.track-a | Track A Fees | partial |
| card.plan.track-b | Track B Referral Commission | partial |
| card.plan.track-c | Track C Co-Broker Split | partial |
| card.plan.track-d | Track D Wholesale | partial |
| card.plan.invest-rate | If Invested Return % slider | partial |
| card.plan.aum | AUM / Advisory | partial |
| card.plan.override | Team Override | partial |
| card.plan.rollup | Multi-Stream Roll-Up | partial |
| card.plan.combined | Combined Practice + Personal | partial |
| card.plan.seasonality | Seasonality Profile | partial |
| card.plan.monthly-production | Monthly Production | partial |
| card.plan.goal-tracker | Goal Tracker | partial |
| card.plan.mix | Product Mix | partial |

### A-0.5 Cards — Other Panels (47)

| Element ID | Description | Status |
|---|---|---|
| card.gdc.calculator | GDC Bracket Calculator | partial |
| card.products.library | Product Library | partial |
| card.products.mix-impact | Product Mix Impact | partial |
| card.funnel.conversion | Sales Funnel | partial |
| card.recruit.back-plan | Recruiting Back-Plan | partial |
| card.recruit.tracks | Recruiting Tracks | partial |
| card.recruit.roster | Roster (Named Members) | partial |
| card.recruit.ramp | Ramp Timeline | partial |
| card.channels.goal | Channel Revenue Goal | partial |
| card.channels.grid | Channel Grid | partial |
| card.channels.monthly | Monthly Channel Projections | partial |
| card.dash.production | Production Dashboard | partial |
| card.dash.financial | Financial & Operating Metrics | partial |
| card.biz.metrics | P&L / Business Metrics | partial |
| card.biz.back-plan | Back-Plan Goals | partial |
| card.client.demographics | Client Profile | partial |
| card.client.back-planner | Client Back-Planner | partial |
| card.client.referrals | Referral Earnings | partial |
| card.client.overview | Financial Health Overview | partial |
| card.client.recommendations | Product Recommendations | partial |
| card.costben.dashboard | Cost-Benefit Dashboard | partial |
| card.compare.disclaimer | FINRA/SIPC disclaimer | match |
| card.compare.engine | Holistic Wealth Planning Engine | partial |
| card.compare.actions | Save/Load/Export/Import | partial |
| card.timeline.implementation | Implementation Timeline | match |
| card.timeline.kpis | Client KPIs (timeline) | match |
| card.cash.analysis | Cash Flow Analysis | partial |
| card.protect.analysis | Protection Needs Analysis | partial |
| card.grow.accumulation | Growth & Accumulation | partial |
| card.grow.back-plan | Portfolio Goal Back-Plan | partial |
| card.retire.planning | Retirement Income Planning | partial |
| card.retire.income-goal | Retirement Income Goal | partial |
| card.tax.planning | Tax Planning | partial |
| card.estate.planning | Estate Planning | partial |
| card.advanced.main | Advanced Strategies | match |
| card.advanced.premium-financing | Premium Financing | match |
| card.advanced.ilit | ILIT | match |
| card.advanced.exec-comp | Executive Compensation | match |
| card.advanced.charitable | Charitable Vehicles | match |
| card.advanced.tax-savings | Tax Savings Goal | match |
| card.edu.planning | Education Planning | partial |
| card.bizclient.planning | Business Owner Planning | match |
| card.summary.scorecard | Financial Health Summary | partial |
| card.summary.kpis | Client KPIs (summary) | partial |
| card.partner.earnings | Partner / Affiliate Earnings | match |
| card.refs.citations | Sources & Citations | partial |
| card.refs.cost-benefit | Comprehensive Cost-Benefit | partial |

### A-0.6 Interaction Patterns (9)

| Element ID | Description | Status |
|---|---|---|
| interaction.slider.range-pair | Range slider with synced display | partial |
| interaction.number-input | Number input with step/oninput | partial |
| interaction.select | Select dropdown | partial |
| interaction.button.primary | Primary action buttons | partial |
| interaction.button.quick-btn | Quick preset buttons | partial |
| interaction.button.add | Dynamic add buttons | partial |
| interaction.button.remove | Remove/close buttons | partial |
| interaction.button.sc-btn | Strategy Compare buttons | partial |
| interaction.editable | Inline editable fields | absent |

### A-0.7 Visual System (12)

| Element ID | Description | Status |
|---|---|---|
| visual-system.colors.navy | Primary navy | partial |
| visual-system.colors.gold | Accent gold | partial |
| visual-system.colors.slate | Slate scale | partial |
| visual-system.colors.card-accent | Card accent border | partial |
| visual-system.typography.h1 | Panel title | partial |
| visual-system.typography.h2 | Card heading | partial |
| visual-system.typography.h3 | Sub-card heading | partial |
| visual-system.typography.desc | Description paragraph | partial |
| visual-system.typography.hint | Hint text | partial |
| visual-system.typography.sub-desc | Sub-description | absent |
| visual-system.spacing.card-padding | Card padding | partial |
| visual-system.spacing.form-grid-gap | Form-grid gap | partial |

### A-0.8 Responsive (4)

| Element ID | Description | Status |
|---|---|---|
| responsive.mobile-390 | Mobile 390×844 | partial |
| responsive.tablet-820 | Tablet 820×1180 | partial |
| responsive.desktop-1440 | Desktop 1440×900 | partial |
| responsive.sidebar-collapse | Sidebar collapse | partial |

### A-0.9 Accessibility (7)

| Element ID | Description | Status |
|---|---|---|
| accessibility.aria-label | ARIA labels | partial |
| accessibility.role | ARIA roles | partial |
| accessibility.tabindex | Tab order | partial |
| accessibility.focus-state | Focus indicators | partial |
| accessibility.reader-order | Reader order | partial |
| accessibility.contrast | WCAG AA contrast | partial |
| accessibility.keyboard-traversal | Keyboard reachability | partial |

### A-0.10 Save/Load (5)

| Element ID | Description | Status |
|---|---|---|
| save-load.slot-mgr | 10-slot save management | partial |
| save-load.save-btn | Save button | partial |
| save-load.load-btn | Load button | partial |
| save-load.json-export | JSON export | partial |
| save-load.json-import | JSON import | match |

### A-0.11 Narration (6)

| Element ID | Description | Status |
|---|---|---|
| narration.trigger | Walk-me-through trigger | absent |
| narration.stop | Stop narration | absent |
| narration.rate-075 | Speed .75x | absent |
| narration.rate-100 | Speed 1x | absent |
| narration.rate-125 | Speed 1.25x | absent |
| narration.rate-150 | Speed 1.5x | absent |

### A-0.12 Print/PDF (3)

| Element ID | Description | Status |
|---|---|---|
| print-pdf.button | Print button | partial |
| print-pdf.export-btn | Export PDF button | partial |
| print-pdf.css | Print CSS | match |

### A-0.13 Disclaimer (3)

| Element ID | Description | Status |
|---|---|---|
| disclaimer.version | Version display | absent |
| disclaimer.text | Compliance disclaimer | match |
| disclaimer.placement | Footer placement | partial |

### A-0.14 Sidebar Footer (4)

| Element ID | Description | Status |
|---|---|---|
| sidebar.footer.slot-mgr | Slot manager | absent |
| sidebar.footer.version-disclaimer | Version + disclaimer | partial |
| sidebar.footer.print-button | Print button | absent |
| sidebar.footer.separator | Visual separator | absent |

### A-0.15 Main Header (4)

| Element ID | Description | Status |
|---|---|---|
| main-header.panel-title | Dynamic panel title | partial |
| main-header.reset-btn | Reset button | match |
| main-header.export-btn | Export PDF button | partial |
| main-header.actions | Actions container | partial |

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
| mobile.toggle | Hamburger toggle | partial |
| mobile.sidebar-overlay | Sidebar overlay | partial |

### A-0.19 Ref-tips (15)

| Element ID | Description | Status |
|---|---|---|
| ref-tip.0 | GDC ref-tip | partial |
| ref-tip.1 | Products ref-tip | partial |
| ref-tip.2 | Funnel ref-tip | partial |
| ref-tip.3 | Recruit ref-tip | partial |
| ref-tip.4 | Channels ref-tip | partial |
| ref-tip.5 | P&L ref-tip | partial |
| ref-tip.6 | Override ref-tip | partial |
| ref-tip.7 | Cash Flow ref-tip | partial |
| ref-tip.8 | Protection ref-tip | partial |
| ref-tip.9 | Growth ref-tip | partial |
| ref-tip.10 | Retirement ref-tip | partial |
| ref-tip.11 | Tax ref-tip | partial |
| ref-tip.12 | Estate ref-tip | partial |
| ref-tip.13 | Advanced ref-tip | absent |
| ref-tip.14 | Education ref-tip | partial |

### A-0.20 Reference Categories (14)

| Element ID | Description | Status |
|---|---|---|
| ref-cat.0-13 | 14 reference categories | partial |

### A-0.21 SCUI (8)

| Element ID | Description | Status |
|---|---|---|
| scui.container | SCUI container | partial |
| scui.add-menu | Add strategy menu | partial |
| scui.preset-strategies | Preset strategies | partial |
| scui.biz-presets | Business presets | absent |
| scui.custom-builder | Custom builder | absent |
| scui.horizon-toggle | Horizon toggle | partial |
| scui.stress-test | Crisis Test | absent |
| scui.backtest | Full Backtest | absent |

### A-0.22 Charts (10)

| Element ID | Description | Status |
|---|---|---|
| chart.plan.combined | Combined chart | partial |
| chart.plan.monthly | Monthly production chart | partial |
| chart.channels.monthly | Monthly channel chart | partial |
| chart.cash | Cash flow chart | partial |
| chart.protect | Protection chart | partial |
| chart.grow | Growth chart | partial |
| chart.retire | Retirement chart | partial |
| chart.tax | Tax chart | partial |
| chart.summary | Summary radar chart | partial |
| chart.timeline.kpi | Timeline KPI chart | absent |

### A-0.23 Tables (25)

| Element ID | Description | Status |
|---|---|---|
| table-wrap.plan.back-plan | Back-plan table | partial |
| table-wrap.plan.rollup | Rollup table | partial |
| table-wrap.plan.combined | Combined table | partial |
| table-wrap.plan.monthly | Monthly table | partial |
| table-wrap.gdc | GDC table | partial |
| table-wrap.products.library | Product table | partial |
| table-wrap.products.mix | Mix table | partial |
| table-wrap.recruit.summary | Recruit table | partial |
| table-wrap.recruit.roster | Roster table | partial |
| table-wrap.channels.grid | Channel table | partial |
| table-wrap.channels.monthly | Monthly channel table | partial |
| table-wrap.dash.production | Dashboard table | partial |
| table-wrap.dash.financial | Financial table | partial |
| table-wrap.biz.metrics | P&L table | partial |
| table-wrap.client.profile | Client table | partial |
| table-wrap.cash | Cash flow table | partial |
| table-wrap.protect | Protection table | partial |
| table-wrap.grow | Growth table | partial |
| table-wrap.retire | Retirement table | partial |
| table-wrap.summary | Summary table | partial |
| table-wrap.advanced.pf | Premium financing table | match |
| table-wrap.advanced.il | ILIT table | match |
| table-wrap.advanced.ex | Exec comp table | match |
| table-wrap.advanced.cv | Charitable table | match |
| table-wrap.client.kpi | Client KPI table | partial |

---

## Section A-0 Summary

| Status | Count | % |
|---|---|---|
| match | 31 | 12.0% |
| superior | 0 | 0.0% |
| partial | 198 | 76.7% |
| absent | 26 | 10.1% |
| n/a | 3 | 1.2% |
| **Total** | **258** | **100%** |

**structural_inheritance_rate = 12.2%** (31 match / 255 assessable)

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
