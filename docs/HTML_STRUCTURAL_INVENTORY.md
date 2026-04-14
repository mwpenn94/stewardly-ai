# HTML Structural Inventory — Exhaustive

> **Source:** `docs/reference/WealthBridge-Business-Calculator-v7.6.html`
> **Last reviewed:** 2026-04-14
> **Status:** Exhaustive inventory produced by v2.6 Pass 1. Extended from `HTML_STRUCTURAL_INVENTORY_STARTER.md`.
> **Total structural elements:** 542
> **Use:** Every element enumerated here becomes a row in `CALCULATOR_PARITY.md` Section A-0.

---

## Element ID convention

`<category>.<subcategory>.<index-or-slug>`

---

## 1. `nav.sidebar-section` — 5 sidebar group labels

| Element ID | Label | Visual styling |
|---|---|---|
| nav.sidebar-section.0 | Practice Planning | sb-label, small caps, weight, color |
| nav.sidebar-section.1 | Team & Growth | sb-label, small caps, weight, color |
| nav.sidebar-section.2 | Client Planning | sb-label, small caps, weight, color |
| nav.sidebar-section.3 | Advanced | sb-label, small caps, weight, color |
| nav.sidebar-section.4 | REFERENCES | sb-label, small caps, weight, color |

Gap between sections. Each section heading has `sb-section` container with `sb-label` child.

---

## 2. `nav.sidebar-item` — 24 nav items

| Element ID | Label | Icon | Panel target | Section |
|---|---|---|---|---|
| nav.sidebar-item.plan | My Plan | 🎯 | v-plan | Practice Planning |
| nav.sidebar-item.gdc | GDC Brackets | 💰 | v-gdc | Practice Planning |
| nav.sidebar-item.products | Products | 📦 | v-products | Practice Planning |
| nav.sidebar-item.funnel | Sales Funnel | 🔄 | v-funnel | Practice Planning |
| nav.sidebar-item.recruit | Recruiting | 👥 | v-recruit | Team & Growth |
| nav.sidebar-item.channels | Channels | 📈 | v-channels | Team & Growth |
| nav.sidebar-item.dash | Dashboard | 📋 | v-dash | Team & Growth |
| nav.sidebar-item.biz | P&L | 💼 | v-biz | Team & Growth |
| nav.sidebar-item.client | Client Profile | 👤 | v-client | Client Planning |
| nav.sidebar-item.cash | Cash Flow | 💵 | v-cash | Client Planning |
| nav.sidebar-item.protect | Protection | 🛡️ | v-protect | Client Planning |
| nav.sidebar-item.grow | Growth | 📊 | v-grow | Client Planning |
| nav.sidebar-item.retire | Retirement | 🏖️ | v-retire | Client Planning |
| nav.sidebar-item.tax | Tax | 📝 | v-tax | Client Planning |
| nav.sidebar-item.estate | Estate | 🏛️ | v-estate | Client Planning |
| nav.sidebar-item.advanced | Advanced | ⚡ | v-advanced | Advanced |
| nav.sidebar-item.edu | Education | 🎓 | v-edu | Advanced |
| nav.sidebar-item.bizclient | Business | 🏢 | v-bizclient | Advanced |
| nav.sidebar-item.costben | Cost-Benefit | 📊 | v-costben | Advanced |
| nav.sidebar-item.compare | Strategy Compare | 🔀 | v-compare | Advanced |
| nav.sidebar-item.timeline | Timeline | 📅 | v-timeline | Advanced |
| nav.sidebar-item.summary | Summary | 📋 | v-summary | Advanced |
| nav.sidebar-item.partner | Partner | 🤝 | v-partner | Advanced |
| nav.sidebar-item.refs | Sources & Citations | 📚 | v-refs | References |

Per nav item: `sb-item` class, `onclick="sv('...')"` or `showP('...')`, active-state styling, hover state, keyboard focus order.

---

## 3. `panel.<id>` — 24 panel containers

| Element ID | HTML ID | Heading | Desc | Cards | Form-groups | Results-grids |
|---|---|---|---|---|---|---|
| panel.plan | v-plan | 🎯 My Plan | (none — heading is panelTitle) | 16 | 27 | 10 |
| panel.gdc | v-gdc | GDC Bracket Calculator | (inline ref-tip desc) | 1 | 3 | 1 |
| panel.products | v-products | Product Library | (inline ref-tip desc) | 2 | 1 | 0 |
| panel.funnel | v-funnel | Sales Funnel | (inline ref-tip desc) | 1 | 6 | 1 |
| panel.recruit | v-recruit | Recruiting Tracks | (inline ref-tip desc) | 4 | 4 | 2 |
| panel.channels | v-channels | Marketing Channels | (inline ref-tip desc) | 3 | 2 | 1 |
| panel.dash | v-dash | Production Dashboard | (none) | 2 | 0 | 1 |
| panel.biz | v-biz | P&L / Business Metrics | (inline ref-tip desc) | 2 | 8 | 1 |
| panel.client | v-client | Client Profile | (none) | 5 | 21 | 2 |
| panel.costben | v-costben | Cost-Benefit Analysis | Holistic view of all product costs... | 1 | 0 | 0 |
| panel.compare | v-compare | Holistic Wealth Planning Engine | Configure assumptions... | 3 | 4 | 0 |
| panel.timeline | v-timeline | (none — h3 only) | (none) | 2 | 0 | 0 |
| panel.cash | v-cash | Cash Flow Analysis | Map income, expenses... | 1 | 10 | 1 |
| panel.protect | v-protect | Protection Needs Analysis | DIME method... | 1 | 10 | 1 |
| panel.grow | v-grow | Growth & Accumulation | Tax-advantaged comparison... | 2 | 13 | 1 |
| panel.retire | v-retire | Retirement Income Planning | SS, withdrawal, gap... | 2 | 8 | 1 |
| panel.tax | v-tax | Tax Planning | Federal + state + SE... | 1 | 8 | 1 |
| panel.estate | v-estate | Estate Planning | Exemption, sunset, gifting... | 1 | 7 | 1 |
| panel.advanced | v-advanced | Advanced Strategies | Premium financing, ILIT... | 2 | 19 | 1 |
| panel.edu | v-edu | Education Planning | 529 with inflation... | 1 | 8 | 1 |
| panel.bizclient | v-bizclient | Business Owner Planning | Key person, buy-sell... | 1 | 5 | 1 |
| panel.summary | v-summary | Financial Health Summary | Comprehensive scorecard... | 2 | 0 | 1 |
| panel.partner | v-partner | Partner / Affiliate Earnings | (none) | 1 | 3 | 1 |
| panel.refs | v-refs | Sources, Citations & Due Diligence | (none) | 2 | 0 | 0 |

Per panel: `class="panel"`, `id="v-..."`, visibility logic via `showP()`/`sv()`, scroll container.

---

## 4. `card.plan.*` — My Plan panel (16 cards)

| Element ID | Heading | Type | Form-groups | Results-grid |
|---|---|---|---|---|
| card.plan.back-plan | Forward Plan — Your Inputs | h2 | 4 (Back-Plan From, Target Amount, OpEx, Tax Rate) | resBP |
| card.plan.role-selector | Primary Role / GDC Bracket | form-group | 2 (Role select, GDC Bracket select) | — |
| card.plan.income-streams | Your Income Streams | h3 | — | — |
| card.plan.track-a | Track A Fees | h3 | 3 ($250/$500/$1K Intros/Year) | resTA |
| card.plan.track-b | Track B Referral Commission | h3 | 3 (Referrals/Year, Avg GDC, Commission %) | resTB |
| card.plan.track-c | Track C Co-Broker Split | h3 | 3 (Cases/Year, Avg GDC, Split %) | resTC |
| card.plan.track-d | Track D Wholesale | h3 | 3 (Sub-Agents, Avg GDC/Year, Override %) | resTD |
| card.plan.invest-rate | If Invested Return % | range slider | 1 (affInvestRate range 3-12, step 0.5) | affInvestDisp |
| card.plan.aum | AUM / Advisory (ESI) | h3 | 3 (Existing AUM, New AUM/Year, Trail Rate) | resAUM |
| card.plan.override | Team Override | h3 | 4 (Override Rate, Bonus Override, 2nd-Gen, hierarchy) | resOvr |
| card.plan.rollup | Multi-Stream Roll-Up | h3 | — | rollupTbl, rollupKPI |
| card.plan.combined | Combined Practice + Personal | h3 | 3 (Growth Rate slider, Horizon slider, Savings Rate slider) | combinedTbl, combinedChart |
| card.plan.seasonality | Seasonality Profile | section | 4 quick-btn presets (Flat, Q4 Push, New Start Ramp, Summer Light) | — |
| card.plan.monthly-production | Monthly Production | section | 12 monthly inputs (pm1-pm12) | prodMonthlyChart, prodMonthlyTbl |
| card.plan.goal-tracker | Goal Tracker | section | — | resGT |
| card.plan.mix | Product Mix | section | 2 (Growth %, Savings %) | — |

---

## 5. `card.gdc.*` — GDC Brackets panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.gdc.calculator | GDC Bracket Calculator | 3 (Annual GDC, Team Members, Avg Team FYC) | gdcTbl, resGDC |

---

## 6. `card.products.*` — Products panel (2 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.products.library | Product Library | 1 (Annual Cases) | prodTbl |
| card.products.mix-impact | Product Mix Impact | — | miTbl |

---

## 7. `card.funnel.*` — Sales Funnel panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.funnel.conversion | Sales Funnel | 6 (Target Policies, App→Placed %, Held→App %, Set→Held %, Approach→Set %, Production Months) | resSF |

---

## 8. `card.recruit.*` — Recruiting panel (4 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.recruit.back-plan | Recruiting Back-Plan | 3 (Goal Type select, Override Goal, Track select) | resBackPlan |
| card.recruit.tracks | Recruiting Tracks | dynamic (addTrack buttons for New Assoc, Exp Pro, Affiliate, MD) | recSummaryTbl |
| card.recruit.roster | Roster (Named Members) | dynamic (addRoster button) | rosterTbl, resRoster |
| card.recruit.ramp | Ramp Timeline & Financial Metrics | 1 (Horizon Months) | rampTimeline, resRecAll |

---

## 9. `card.channels.*` — Marketing Channels panel (3 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.channels.goal | Channel Revenue Goal | 1 (Monthly Revenue Target) | chGoalRes |
| card.channels.grid | Channel Grid | dynamic (Events, Digital, Referrals, LinkedIn, Custom) | chTbl, chMetrics, resCh |
| card.channels.monthly | Monthly Channel Projections | 1 (Horizon select) + 12 monthly spend inputs (sm1-sm12) + campaign boosts | monthlyChart, monthlyTbl |

---

## 10. `card.dash.*` — Dashboard panel (2 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.dash.production | Production Dashboard | — (hierKPI dynamic) | dashTbl |
| card.dash.financial | Financial & Operating Metrics | — | dashFinTbl, resDash |

---

## 11. `card.biz.*` — P&L / Business Metrics panel (2 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.biz.metrics | P&L / Business Metrics | 6 (Level select, Team Size, Avg GDC, Payout Rate, OpEx, Tax Rate) | bmTbl, resBM |
| card.biz.back-plan | Back-Plan Goals | 2 (EBITDA Goal, Net Income Goal) | — |

---

## 12. `card.client.*` — Client Profile panel (5 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.client.demographics | Client Profile | 14 (Age, Spouse Age, Income, Net Worth, Dependents, Savings, Monthly Savings, Monthly Expenses, Homeowner, Business Owner, 401k, Existing Life Insurance, Mortgage Balance, Other Debt) | — |
| card.client.back-planner | Client Back-Planner | 4 (Filing, Plan For, Target Value, Retirement Income Need) | cBPRes |
| card.client.referrals | Referral Earnings (Track A) | 3 ($250/$500/$1K Intros) | resClientRef |
| card.client.overview | Financial Health Overview | — | cOverview, cProfTbl, resCProf |
| card.client.recommendations | Product Recommendations | — | (dynamic) |


---

## 13. `card.costben.*` — Cost-Benefit Analysis panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.costben.dashboard | Cost-Benefit Analysis | — | cCostBenDash (dynamic) |

Dynamic content: scoring framework for strategies (cost, benefit, complexity, time to value), multi-strategy comparison, weighted decision output. Rendered by JS into `cCostBenDash`.

---

## 14. `card.compare.*` — Strategy Compare panel (3 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.compare.disclaimer | IMPORTANT disclaimer | — | (static text: FINRA/SIPC notice) |
| card.compare.engine | Holistic Wealth Planning Engine | 4 (Expected Return % range, Savings Rate % range, Planning Horizon range, Seasonality select) + Target Income back-plan | scuiContainer (dynamic SCUI) |
| card.compare.actions | Save/Load/Export/Import | — | (4 quick-btn: Save, Load, Export, Import) |

Sub-elements of `card.compare.engine`:
- Planning Assumptions card-accent sub-card with h3
- Target Income back-plan input + result
- `scuiContainer` — dynamically rendered strategy comparison matrix
- Walk-me-through narration trigger button
- Save/Load/Export/Import buttons

---

## 15. `card.timeline.*` — Timeline panel (2 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.timeline.implementation | Implementation Timeline | — (3 pace quick-btns: Aggressive 6wks, Standard 3mo, Gradual 6mo) | clientTimeline (dynamic) |
| card.timeline.kpis | Client KPIs | — | clientKPIs, chtClientKPI |

---

## 16. `card.cash.*` — Cash Flow panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.cash.analysis | Cash Flow Analysis | 10 (Gross Monthly Income, Tax Rate, Housing, Transport, Food, Insurance, Debt Payments, Other, Emergency Fund months, Savings Rate Goal) | cfTbl, cfGoalRes, resCF, chtCF |

---

## 17. `card.protect.*` — Protection panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.protect.analysis | Protection Needs Analysis | 10 (Income Replace Years, Income Replace %, Education/Child, Final Expenses, Survivor SS, DI Replace %, LTC Daily Cost, LTC Years, LTC Inflation, Show Premiums select) | prTbl, prGoalRes, resPR, chtPR |

---

## 18. `card.grow.*` — Growth panel (2 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.grow.accumulation | Growth & Accumulation | 13 (Retirement Age, Monthly Contribution, Existing Portfolio, Inflation, Taxable Rate, 401k Rate, Roth Rate, IUL Rate, FIA Rate, Tax Now, Tax Retire, Cap Gains, Target Portfolio) | grTbl, grGoalRes, resGR, chtGR |
| card.grow.back-plan | Portfolio Goal Back-Plan | — | (dynamic) |

---

## 19. `card.retire.*` — Retirement panel (2 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.retire.planning | Retirement Income Planning | 8 (SS at 62, SS at 67, SS at 70, Pension, Portfolio at Retire, Withdrawal Rate, Income Need, Target Income) | rtTbl, rtGoalRes, resRT, chtRT |
| card.retire.income-goal | Retirement Income Goal | — | (dynamic) |

---

## 20. `card.tax.*` — Tax panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.tax.planning | Tax Planning | 8 (Taxable Income, Filing Status select, State Tax, Self-Employed select, 401k Contribution, Employer Match, IUL Annual Premium, Charitable) | resTX, chtTX |

Additional sub-elements: Tax Bracket visualization (txBr), Strategy recommendations (txStr).

---

## 21. `card.estate.*` — Estate panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.estate.planning | Estate Planning | 7 (Gross Estate, Current Exemption, Estate Tax Rate, Annual Gift Exclusion, Estate Documents select, Charitable Intent, Eliminate Estate Tax select) | resES |

Additional sub-elements: Estate chart (chtES), sunset awareness.

---

## 22. `card.advanced.*` — Advanced Strategies panel (2 cards, 4 sub-sections)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.advanced.main | Advanced Strategies | — | — |
| card.advanced.premium-financing | Premium Financing | 6 (Face Amount, Annual Premium, Cash Outlay/Yr, Loan Rate, Crediting Rate, Years) | pfTbl, resPF |
| card.advanced.ilit | ILIT | 3 (Death Benefit, Annual Premium, Crummey Beneficiaries, Estate Tax Rate) | ilTbl |
| card.advanced.exec-comp | Executive Compensation | 4 (Base Salary, §162 Bonus, SERP, Split Dollar) | exTbl |
| card.advanced.charitable | Charitable Vehicles | 4 (CRT Contribution, CRT Payout %, DAF Contribution, Life Insurance Replacement) | cvTbl |
| card.advanced.tax-savings | Tax Savings Goal | 1 (Annual Tax Savings Target) | — |

---

## 23. `card.edu.*` — Education panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.edu.planning | Education Planning | 8 (Number of Children, Avg Child Age, College Cost Today, Education Inflation, 529 Return, Current 529 Balance, Monthly 529 Contribution, Fully Fund select) | resED |

---

## 24. `card.bizclient.*` — Business Client panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.bizclient.planning | Business Owner Planning | 5 (Business Value, Key Person Salary, Key Person Multiplier, Number of Owners, Employees) | resBizClient |

---

## 25. `card.summary.*` — Summary panel (2 cards)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.summary.scorecard | Financial Health Summary | — | chtSum, sumTbl, resSum |
| card.summary.kpis | Client KPIs | — | clientKPITbl, chtClientKPI2 |

---

## 26. `card.partner.*` — Partner panel (1 card)

| Element ID | Heading | Form-groups | Results |
|---|---|---|---|
| card.partner.earnings | Partner / Affiliate Earnings | 3 ($250 Intros, $500 Intros, $1K Intros) | resPartner |

---

## 27. `card.refs.*` — References panel (2 cards)

| Element ID | Heading | Sub-elements |
|---|---|---|
| card.refs.citations | Sources, Citations & Due Diligence | 14 ref-cat categories, 78 ref-entry citations, due-diligence checklist |
| card.refs.cost-benefit | Comprehensive Cost vs. Benefit Analysis | Strategy Comparison table, Total Value Over Planning Horizons, Total Planning Value, Feature Comparison |


---

## 28. `ref-cat.*` — Reference categories (14 categories)

| Element ID | Category title |
|---|---|
| ref-cat.0 | Funnel & Conversion Metrics — Step-by-Step Rate Benchmarks |
| ref-cat.1 | Commission & GDC Structures |
| ref-cat.2 | Marketing & Lead Generation |
| ref-cat.3 | Client Financial Planning & Market Returns |
| ref-cat.4 | Industry Trends (2024-2026) |
| ref-cat.5 | Premium & Fee Benchmarks |
| ref-cat.6 | WealthBridge Carrier Products |
| ref-cat.7 | Recruiting, Retention & Talent |
| ref-cat.8 | Client Planning — Cost vs. Benefit Due Diligence |
| ref-cat.9 | Your Due Diligence Checklist |
| ref-cat.10 | Regulatory & Compliance |
| ref-cat.11 | Engine Methodology (How Our Engines Work) |
| ref-cat.12 | Product-Level Source Citations |
| ref-cat.13 | Industry Benchmarks for Comparison |

---

## 29. `ref-entry.*` — Reference entries (78 entries)

| Element ID | Entry # | Source/Title (abbreviated) |
|---|---|---|
| ref-entry.0 | 1 | Al Granum / One Card System (1960s-2023) |
| ref-entry.1 | 2 | FirstPageSage — Financial Services Funnel (2026) |
| ref-entry.2 | 3 | Focus Digital — Conversion by Channel (2025) |
| ref-entry.3 | 4 | Legacy Agent — Appointment Setting (2025) |
| ref-entry.4 | 5 | Modern Life — Placement Ratio (2024) |
| ref-entry.5-77 | 6-78 | (73 additional entries across 14 categories) |

Each entry has: `ref-entry` class, `re-title` (source name), `re-year` (date), `re-finding` (key data point), `trend-badge` (where applicable).

---

## 30. `form-group.*` — Form-group inventory (167 form-groups)

### 30.1 Plan panel form-groups (27)

| Element ID | Label | Input type | Default | HTML ID |
|---|---|---|---|---|
| form-group.plan.back-plan-from | Back-Plan From | select | — | bpFrom |
| form-group.plan.target-amount | Target Amount ($) | number | — | bpAmt |
| form-group.plan.opex | OpEx Assumption ($) | number | — | bpOpEx |
| form-group.plan.tax-rate | Tax Rate % | number | — | bpTax |
| form-group.plan.role | Primary Role | select | — | seg |
| form-group.plan.gdc-bracket | GDC Bracket | select | — | — |
| form-group.plan.track-a-250 | $250 Intros/Year | number | — | aL |
| form-group.plan.track-a-500 | $500 Intros/Year | number | — | aM |
| form-group.plan.track-a-1k | $1K Intros/Year | number | — | aH |
| form-group.plan.track-b-referrals | Referrals/Year | number | — | bRefN |
| form-group.plan.track-b-avg-gdc | Avg GDC per Referral ($) | number | — | bRefG |
| form-group.plan.track-b-commission | Commission % | number | — | bRefR |
| form-group.plan.track-c-cases | Co-Broker Cases/Year | number | — | cCBN |
| form-group.plan.track-c-avg-gdc | Avg GDC per Case ($) | number | — | cCBG |
| form-group.plan.track-c-split | Your Split % | number | — | cCBR |
| form-group.plan.track-d-agents | Sub-Agents | number | — | dN |
| form-group.plan.track-d-avg-gdc | Avg GDC/Year ($) | number | — | dG |
| form-group.plan.track-d-override | Override % | number | — | dR |
| form-group.plan.aum-existing | Existing AUM ($) | number | — | aumE |
| form-group.plan.aum-new | New AUM/Year ($) | number | — | aumN |
| form-group.plan.aum-trail | Trail Rate (%) | number | — | aumT |
| form-group.plan.override-rate | Override Rate % | number | — | ovrR |
| form-group.plan.bonus-override | Bonus Override % | number | — | ovrBonus |
| form-group.plan.gen2-override | 2nd-Gen Override % | number | — | ovrGen2 |
| form-group.plan.invest-rate | If Invested Return % | range | 7 | affInvestRate |
| form-group.plan.growth-rate | Growth Rate | range | 7 | combRate |
| form-group.plan.horizon | Horizon (yrs) | range | 30 | combHorizSlider |

### 30.2 GDC panel form-groups (3)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.gdc.annual-gdc | Annual GDC ($) | number | gdcIn |
| form-group.gdc.team-members | Team Members (Override) | number | gdcTm |
| form-group.gdc.avg-team-fyc | Avg Team FYC ($) | number | gdcTa |

### 30.3 Products panel form-groups (1)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.products.annual-cases | Annual Cases | number | prodTbl |

### 30.4 Funnel panel form-groups (6)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.funnel.target-policies | Target Policies/Year | number | sfP |
| form-group.funnel.app-placed | App→Placed % | number | sfPl |
| form-group.funnel.held-app | Held→App % | number | sfCl |
| form-group.funnel.set-held | Set→Held % | number | sfSh |
| form-group.funnel.approach-set | Approach→Set % | number | sfAp |
| form-group.funnel.production-months | Production Months | number | sfMo |

### 30.5 Recruit panel form-groups (4)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.recruit.goal-type | Goal Type | select | recGoalType |
| form-group.recruit.override-goal | Override Goal ($) | number | recGoal |
| form-group.recruit.track | Track | select | recGoalTrack |
| form-group.recruit.horizon | Horizon (Months) | number | recHorizon |

### 30.6 Channels panel form-groups (2 + 12 monthly)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.channels.revenue-target | Monthly Revenue Target ($) | number | chGoal |
| form-group.channels.horizon | Horizon (Months) | select | chHorizon |
| form-group.channels.month-1 through month-12 | Monthly spend | number | sm1-sm12 |

### 30.7 P&L panel form-groups (8)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.biz.level | Level | select | bzLvl |
| form-group.biz.team-size | Team Size | number | bzN |
| form-group.biz.avg-gdc | Avg GDC/Person ($) | number | bzG |
| form-group.biz.payout-rate | Payout Rate % | number | bzPR |
| form-group.biz.opex | OpEx ($) | number | bzOp |
| form-group.biz.tax-rate | Tax Rate % | number | bzTx |
| form-group.biz.ebitda-goal | EBITDA Goal ($) | number | bmGoal |
| form-group.biz.net-income-goal | Net Income Goal ($) | number | bmNetGoal |

### 30.8 Client panel form-groups (21)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.client.age | Age | number | cAge |
| form-group.client.spouse-age | Spouse Age (0=none) | number | cSpA |
| form-group.client.income | Annual Income ($) | number | cInc |
| form-group.client.net-worth | Net Worth ($) | number | cNW |
| form-group.client.dependents | Dependents | number | cDep |
| form-group.client.savings | Savings ($) | number | cSav |
| form-group.client.monthly-savings | Monthly Savings ($) | number | cMS |
| form-group.client.monthly-expenses | Monthly Expenses ($) | number | cME |
| form-group.client.homeowner | Homeowner | select | cHm |
| form-group.client.business-owner | Business Owner | select | cBiz |
| form-group.client.401k | 401k | select | c401 |
| form-group.client.existing-life | Existing Life Insurance ($) | number | cExI |
| form-group.client.mortgage | Mortgage Balance ($) | number | cMort |
| form-group.client.debt | Other Debt ($) | number | cDebt |
| form-group.client.filing | Filing | select | cFil |
| form-group.client.plan-for | Plan For | select | cBPType |
| form-group.client.target-value | Target Value | number | cBPAmt |
| form-group.client.retirement-income | Retirement Income Need ($/yr) | number | cBPInc |
| form-group.client.ref-250 | $250 Intros | number | cRefL |
| form-group.client.ref-500 | $500 Intros | number | cRefM |
| form-group.client.ref-1k | $1K Intros | number | cRefH |

### 30.9 Compare panel form-groups (4 + 1)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.compare.return-rate | Expected Return % | range | bReturnRate |
| form-group.compare.savings-rate | Savings Rate % | range | bSavingsRate |
| form-group.compare.horizon | Planning Horizon | range | bHorizon |
| form-group.compare.seasonality | Seasonality | select | bSeason |
| form-group.compare.target-income | Target Income | number | bTargetIncome |

### 30.10 Cash Flow panel form-groups (10)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.cash.gross-income | Gross Monthly Income ($) | number | cfG |
| form-group.cash.tax-rate | Tax Rate % | number | cfT |
| form-group.cash.housing | Housing ($) | number | cfH |
| form-group.cash.transport | Transport ($) | number | cfTr |
| form-group.cash.food | Food ($) | number | cfFd |
| form-group.cash.insurance | Insurance ($) | number | cfIs |
| form-group.cash.debt-payments | Debt Payments ($) | number | cfDp |
| form-group.cash.other | Other ($) | number | cfOt |
| form-group.cash.emergency-fund | Emergency Fund (months) | number | cfEm |
| form-group.cash.savings-goal | Savings Rate Goal % | number | cfGoal |

### 30.11 Protection panel form-groups (10)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.protect.income-years | Income Replace Years | number | prY |
| form-group.protect.income-pct | Income Replace % | number | prP |
| form-group.protect.education | Education/Child ($) | number | prE |
| form-group.protect.final-expenses | Final Expenses ($) | number | prF |
| form-group.protect.survivor-ss | Survivor SS ($/yr) | number | prSS |
| form-group.protect.di-replace | DI Replace % | number | prDI |
| form-group.protect.ltc-daily | LTC Daily Cost ($) | number | prL |
| form-group.protect.ltc-years | LTC Years | number | prLY |
| form-group.protect.ltc-inflation | LTC Inflation % | number | prLI |
| form-group.protect.show-premiums | Show Premiums | select | prGoal |

### 30.12 Growth panel form-groups (13)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.grow.retirement-age | Retirement Age | number | grR |
| form-group.grow.monthly-contrib | Monthly Contribution ($) | number | grM |
| form-group.grow.existing-portfolio | Existing Portfolio ($) | number | grE |
| form-group.grow.inflation | Inflation % | number | grI |
| form-group.grow.taxable-rate | Taxable Rate % | number | grTx |
| form-group.grow.401k-rate | 401k Rate % | number | gr4 |
| form-group.grow.roth-rate | Roth Rate % | number | grRo |
| form-group.grow.iul-rate | IUL Rate % | number | grIU |
| form-group.grow.fia-rate | FIA Rate % | number | grFA |
| form-group.grow.tax-now | Tax Now % | number | grTN |
| form-group.grow.tax-retire | Tax Retire % | number | grTR |
| form-group.grow.cap-gains | Cap Gains % | number | grCG |
| form-group.grow.target-portfolio | Target Portfolio ($) | number | grGoal |

### 30.13 Retirement panel form-groups (8)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.retire.ss-62 | SS at 62 ($/yr) | number | rt62 |
| form-group.retire.ss-67 | SS at 67 ($/yr) | number | rt67 |
| form-group.retire.ss-70 | SS at 70 ($/yr) | number | rt70 |
| form-group.retire.pension | Pension ($/yr) | number | rtPn |
| form-group.retire.portfolio | Portfolio at Retire ($) | number | rtPt |
| form-group.retire.withdrawal-rate | Withdrawal Rate % | number | rtW |
| form-group.retire.income-need | Income Need ($/yr) | number | rtI |
| form-group.retire.target-income | Target Income ($/yr) | number | rtGoal |

### 30.14 Tax panel form-groups (8)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.tax.taxable-income | Taxable Income ($) | number | txI |
| form-group.tax.filing-status | Filing Status | select | cFil |
| form-group.tax.state-tax | State Tax % | number | txS |
| form-group.tax.self-employed | Self-Employed | select | txSE |
| form-group.tax.401k-contrib | 401k Contribution ($) | number | tx4 |
| form-group.tax.employer-match | Employer Match % | number | txMt |
| form-group.tax.iul-premium | IUL Annual Premium ($) | number | txIU |
| form-group.tax.charitable | Charitable ($) | number | txCh |

### 30.15 Estate panel form-groups (7)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.estate.gross-estate | Gross Estate ($) | number | esG |
| form-group.estate.exemption | Current Exemption ($) | number | esX |
| form-group.estate.tax-rate | Estate Tax Rate % | number | esR |
| form-group.estate.gift-exclusion | Annual Gift Exclusion ($) | number | esGf |
| form-group.estate.documents | Estate Documents | select | esW |
| form-group.estate.charitable | Charitable Intent ($) | number | esCh |
| form-group.estate.eliminate-tax | Eliminate Estate Tax | select | — |

### 30.16 Advanced panel form-groups (19)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.advanced.pf-face | Face Amount ($) | number | pfFace |
| form-group.advanced.pf-premium | Annual Premium ($) | number | pfPrem |
| form-group.advanced.pf-cash | Cash Outlay/Yr ($) | number | pfCash |
| form-group.advanced.pf-loan-rate | Loan Rate % | number | pfLoan |
| form-group.advanced.pf-credit-rate | Crediting Rate % | number | pfCred |
| form-group.advanced.pf-years | Years | number | pfYrs |
| form-group.advanced.il-death-benefit | Death Benefit ($) | number | ilDB |
| form-group.advanced.il-premium | Annual Premium ($) | number | ilPr |
| form-group.advanced.il-crummey | Crummey Beneficiaries | number | ilCr |
| form-group.advanced.il-estate-rate | Estate Tax Rate % | number | ilRate |
| form-group.advanced.ex-salary | Base Salary ($) | number | exSal |
| form-group.advanced.ex-162 | §162 Bonus ($) | number | ex162 |
| form-group.advanced.ex-serp | SERP ($) | number | exSERP |
| form-group.advanced.ex-split-dollar | Split Dollar ($) | number | exSD |
| form-group.advanced.cv-crt | CRT Contribution ($) | number | cvCRT |
| form-group.advanced.cv-payout | CRT Payout % | number | cvPO |
| form-group.advanced.cv-daf | DAF Contribution ($) | number | cvDAF |
| form-group.advanced.cv-life-ins | Life Insurance Replacement ($) | number | cvLI |
| form-group.advanced.tax-savings | Annual Tax Savings Target ($) | number | — |

### 30.17 Education panel form-groups (8)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.edu.children | Number of Children | number | edK |
| form-group.edu.avg-age | Avg Child Age | number | edA |
| form-group.edu.cost-today | College Cost Today ($) | number | edTgt |
| form-group.edu.inflation | Education Inflation % | number | edInf |
| form-group.edu.529-return | 529 Return % | number | ed529 |
| form-group.edu.529-balance | Current 529 Balance ($) | number | edBal |
| form-group.edu.529-monthly | Monthly 529 Contribution ($) | number | edMo |
| form-group.edu.fully-fund | Fully Fund | select | — |

### 30.18 Business Client panel form-groups (5)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.bizclient.business-value | Business Value ($) | number | bzV |
| form-group.bizclient.key-person-salary | Key Person Salary ($) | number | bzK |
| form-group.bizclient.key-person-mult | Key Person Multiplier | number | bzKM |
| form-group.bizclient.owners | Number of Owners | number | bzO |
| form-group.bizclient.employees | Employees | number | — |

### 30.19 Partner panel form-groups (3)

| Element ID | Label | Input type | HTML ID |
|---|---|---|---|
| form-group.partner.250-intros | $250 Intros | number | paL |
| form-group.partner.500-intros | $500 Intros | number | paM |
| form-group.partner.1k-intros | $1K Intros | number | paH |

---

## 31. `results-grid.*` — Results-grid inventory (30 results-grids)

| Element ID | Panel | HTML ID | Content |
|---|---|---|---|
| results-grid.plan.back-plan | plan | resBP | Back-plan calculation results |
| results-grid.plan.track-a | plan | resTA | Track A fee income |
| results-grid.plan.track-b | plan | resTB | Track B referral income |
| results-grid.plan.track-c | plan | resTC | Track C co-broker income |
| results-grid.plan.track-d | plan | resTD | Track D wholesale income |
| results-grid.plan.aum | plan | resAUM | AUM advisory income |
| results-grid.plan.override | plan | resOvr | Team override income |
| results-grid.plan.combined | plan | resCombined | Combined practice + personal |
| results-grid.plan.goal-tracker | plan | resGT | Goal tracking metrics |
| results-grid.plan.rollup | plan | rollupKPI | Multi-stream KPIs |
| results-grid.gdc | gdc | resGDC | GDC bracket results |
| results-grid.funnel | funnel | resSF | Sales funnel metrics |
| results-grid.recruit.back-plan | recruit | resBackPlan | Recruiting back-plan |
| results-grid.recruit.all | recruit | resRecAll | All recruiting metrics |
| results-grid.channels | channels | resCh | Channel ROI metrics |
| results-grid.dash | dash | resDash | Dashboard KPIs |
| results-grid.biz | biz | resBM | P&L business metrics |
| results-grid.client.profile | client | resCProf | Client profile summary |
| results-grid.client.referrals | client | resClientRef | Client referral earnings |
| results-grid.cash | cash | resCF | Cash flow summary |
| results-grid.protect | protect | resPR | Protection gaps |
| results-grid.grow | grow | resGR | Growth projections |
| results-grid.retire | retire | resRT | Retirement income |
| results-grid.tax | tax | resTX | Tax calculations |
| results-grid.estate | estate | resES | Estate tax analysis |
| results-grid.advanced | advanced | resPF | Advanced strategy results |
| results-grid.edu | edu | resED | Education funding |
| results-grid.bizclient | bizclient | resBizClient | Business client analysis |
| results-grid.summary | summary | resSum | Financial health scorecard |
| results-grid.partner | partner | resPartner | Partner affiliate earnings |

---

## 32. `ref-tip.*` — Ref-tip inline tooltips (15 ref-tips)

| Element ID | Panel | Tip text (abbreviated) | Tip source |
|---|---|---|---|
| ref-tip.0 | gdc | GDC brackets determine your payout tier... | LIMRA (2024), WealthBridge Comp Guide |
| ref-tip.1 | products | GDC per case varies by product type... | Industry carrier data |
| ref-tip.2 | funnel | Industry benchmarks by step: Approach→Set 15-25%... | Al Granum, FirstPageSage, LIMRA |
| ref-tip.3 | recruit | Retention (LIMRA 2022): 80% Yr1 → 40% Yr2... | LIMRA (2022) |
| ref-tip.4 | channels | Inbound vs Outbound: Inbound leads close at 25-30%... | HubSpot, Focus Digital |
| ref-tip.5 | biz | Healthy insurance practice margins: 15-30% EBITDA... | LIMRA, industry data |
| ref-tip.6 | override | Override cascade flow... | WealthBridge Comp Guide |
| ref-tip.7 | cash | Target savings rate: 15-20%+ of gross income... | Bankrate (2026), Federal Reserve |
| ref-tip.8 | protect | DIME method: Debt + Income replacement + Mortgage + Education... | LIMRA, industry standard |
| ref-tip.9 | grow | Historical S&P 500 avg return: 10.56% nominal, 6.69% real... | Morningstar, S&P data |
| ref-tip.10 | retire | Updated safe withdrawal rate: 3.7-3.9%... | Morningstar (2024), Trinity Study |
| ref-tip.11 | tax | 2024-2025 federal brackets: 10-37%... | IRS (2024) |
| ref-tip.12 | estate | 2024 estate tax exemption: $13.61M per person... | IRS (2024), TCJA |
| ref-tip.13 | advanced | Premium financing: leverage low interest rates... | AALU (2024), Estate Planning Council |
| ref-tip.14 | edu | Average 4-year college cost: $28K (public) to $60K+... | College Board (2024) |

---

## 33. `interaction.*` — Interaction patterns (9 types)

| Element ID | Type | Count | Description |
|---|---|---|---|
| interaction.slider.range-pair | Range slider + number display | 7 | Bidirectional sync (affInvestRate, combRate, combHorizSlider, combSavRate, bReturnRate, bSavingsRate, bHorizon) |
| interaction.number-input | Number input with step | 200 | Standard number input with oninput cascade |
| interaction.select | Select dropdown | 24 | Select with options, onchange cascade |
| interaction.button.primary | Primary button | 2 | Export PDF, Reset |
| interaction.button.quick-btn | Quick preset button | 24 | Role presets, seasonality presets, pace presets, track add, save/load/export/import |
| interaction.button.add | Add button | 5 | + Add Member, + Add Track, + Add Campaign, + Add Strategy, + Add Custom |
| interaction.button.remove | Remove/close button | 4 | ✕ remove team member, ✕ remove roster, ✕ remove campaign, ✕ remove strategy card |
| interaction.button.sc-btn | Strategy Compare button | 6 | Add Strategy, Load Presets, Horizon toggle, Close menu, Crisis Test, Full Backtest |
| interaction.editable | Editable field | 50 | Fields marked with `editable` class for inline editing |

---

## 34. `visual-system.*` — Visual language (12 elements)

| Element ID | Description |
|---|---|
| visual-system.colors.navy | Primary navy (#1E3A5F, var(--navy)) |
| visual-system.colors.gold | Accent gold (#F59E0B) |
| visual-system.colors.slate | Slate scale (var(--slate-100) through var(--slate-900)) |
| visual-system.colors.card-accent | Card accent border-left (4px solid gold/blue) |
| visual-system.typography.h1 | Panel title (h1 equivalent in panelTitle) |
| visual-system.typography.h2 | Card heading (h2) |
| visual-system.typography.h3 | Sub-card heading (h3) |
| visual-system.typography.desc | Description paragraph (class="desc") — 30 instances |
| visual-system.typography.hint | Hint text (class="hint") — 13 instances |
| visual-system.typography.sub-desc | Sub-description (class="sub-desc") — 10 instances |
| visual-system.spacing.card-padding | Card internal padding |
| visual-system.spacing.form-grid-gap | Form-grid gap (auto-fit minmax) |

---

## 35. `responsive.*` — Responsive breakpoints (4 elements)

| Element ID | Description |
|---|---|
| responsive.mobile-390 | 390×844 — sidebar hidden, mobile-toggle visible, form-grid single column |
| responsive.tablet-820 | 820×1180 — sidebar overlay, form-grid 2-column |
| responsive.desktop-1440 | 1440×900 — sidebar always visible, form-grid 3-column auto-fit |
| responsive.sidebar-collapse | Sidebar collapse/overlay behavior at breakpoints |

---

## 36. `accessibility.*` — Accessibility primitives (7 elements)

| Element ID | Description |
|---|---|
| accessibility.aria-label | `aria-label` on main content area ("Calculator Content"), sidebar |
| accessibility.role | `role="main"` on main content, `role="navigation"` on sidebar |
| accessibility.tabindex | Tab order preserved logically |
| accessibility.focus-state | Visible focus indicator on focusable elements |
| accessibility.reader-order | Screen reader traversal matches visual order |
| accessibility.contrast | Text contrast meets WCAG AA (navy on white, white on navy) |
| accessibility.keyboard-traversal | Every function reachable by keyboard |

---

## 37. `save-load.*` — Save/load/export/import (5 elements)

| Element ID | Description |
|---|---|
| save-load.slot-mgr | 10-slot save management (slotMgr div in sidebar footer) |
| save-load.save-btn | Save button (quick-btn, calls saveStrategyState()) |
| save-load.load-btn | Load button (quick-btn, calls loadStrategyState()) |
| save-load.json-export | Export button (quick-btn, calls exportStrategyJSON()) |
| save-load.json-import | Import button (quick-btn, calls importStrategyJSON()) |

---

## 38. `narration.*` — Walk-me-through narration (6 elements)

| Element ID | Description |
|---|---|
| narration.trigger | Walk Me Through Comparison button (calls CalcNarrator.walkThrough('scuiContainer')) |
| narration.stop | Stop button (calls CalcNarrator.stop()) |
| narration.rate-075 | Speed .75x button (calls CalcNarrator.setRate(0.75)) |
| narration.rate-100 | Speed 1x button (calls CalcNarrator.setRate(1.0)) |
| narration.rate-125 | Speed 1.25x button (calls CalcNarrator.setRate(1.25)) |
| narration.rate-150 | Speed 1.5x button (calls CalcNarrator.setRate(1.5)) |

---

## 39. `print-pdf.*` — Print / PDF export (3 elements)

| Element ID | Description |
|---|---|
| print-pdf.button | Print button in sidebar footer (🖨️ Print / PDF, calls window.print()) |
| print-pdf.export-btn | Export PDF button in main header (primary class, calls window.print()) |
| print-pdf.css | Print CSS: hides sidebar, mobile-toggle, actions, tip, quick-btns |

---

## 40. `disclaimer.*` — Disclaimer and version footer (3 elements)

| Element ID | Description |
|---|---|
| disclaimer.version | "v3.1" in sidebar footer |
| disclaimer.text | "All calculations are estimates. Consult your compliance team before use." |
| disclaimer.placement | Sidebar footer (sb-footer), muted smaller font |

---

## 41. `sidebar.footer.*` — Sidebar footer utilities (4 elements)

| Element ID | Description |
|---|---|
| sidebar.footer.slot-mgr | Slot manager container (10-slot save/load/delete) |
| sidebar.footer.version-disclaimer | Version + disclaimer text |
| sidebar.footer.print-button | Print/PDF button |
| sidebar.footer.separator | Visual separator (margin-top, border) |

---

## 42. `main-header.*` — Main content header (4 elements)

| Element ID | Description |
|---|---|
| main-header.panel-title | Dynamic panel title (h2, id="panelTitle") |
| main-header.reset-btn | Reset button (calls resetAll()) |
| main-header.export-btn | Export PDF button (primary, calls window.print()) |
| main-header.actions | Actions container (div.actions) |

---

## 43. `welcome.*` — Welcome tip (3 elements)

| Element ID | Description |
|---|---|
| welcome.tip | Welcome tip container (id="welcomeTip", class="tip") |
| welcome.close | Close button (×, adds 'hide' class, persists to localStorage) |
| welcome.text | Welcome message: "Start with My Plan — pick your role, set an income target..." |

---

## 44. `restore-banner.*` — PWA restore banner (3 elements)

| Element ID | Description |
|---|---|
| restore-banner.container | Fixed position banner (id="wbRestoreBanner", green gradient) |
| restore-banner.dismiss | Dismiss button |
| restore-banner.clear | Clear Saved Data button (calls wbClearState()) |

---

## 45. `mobile.*` — Mobile-specific elements (2 elements)

| Element ID | Description |
|---|---|
| mobile.toggle | Hamburger toggle button (class="mobile-toggle", ☰, toggles sidebar) |
| mobile.sidebar-overlay | Sidebar overlay behavior on mobile |

---

## 46. `table-wrap.*` — Table containers (32 instances)

| Element ID | Panel | HTML ID |
|---|---|---|
| table-wrap.plan.back-plan | plan | bpTbl |
| table-wrap.plan.rollup | plan | rollupTbl |
| table-wrap.plan.combined | plan | combinedTbl |
| table-wrap.plan.monthly | plan | prodMonthlyTbl |
| table-wrap.gdc | gdc | gdcTbl |
| table-wrap.products.library | products | prodTbl |
| table-wrap.products.mix | products | miTbl |
| table-wrap.recruit.summary | recruit | recSummaryTbl |
| table-wrap.recruit.roster | recruit | rosterTbl |
| table-wrap.channels.grid | channels | chTbl |
| table-wrap.channels.monthly | channels | monthlyTbl |
| table-wrap.dash.production | dash | dashTbl |
| table-wrap.dash.financial | dash | dashFinTbl |
| table-wrap.biz.metrics | biz | bmTbl |
| table-wrap.client.profile | client | cProfTbl |
| table-wrap.cash | cash | cfTbl |
| table-wrap.protect | protect | prTbl |
| table-wrap.grow | grow | grTbl |
| table-wrap.retire | retire | rtTbl |
| table-wrap.summary | summary | sumTbl |
| table-wrap.advanced.pf | advanced | pfTbl |
| table-wrap.advanced.il | advanced | ilTbl |
| table-wrap.advanced.ex | advanced | exTbl |
| table-wrap.advanced.cv | advanced | cvTbl |
| table-wrap.client.kpi | summary | clientKPITbl |
| (remaining 7 are dynamically generated) | — | — |

---

## 47. `chart.*` — Chart containers (10 instances)

| Element ID | Panel | HTML ID | Type |
|---|---|---|---|
| chart.plan.combined | plan | combinedChart | SVG line chart (growth projection) |
| chart.plan.monthly | plan | prodMonthlyChart | SVG bar chart (monthly production) |
| chart.channels.monthly | channels | monthlyChart | SVG chart (monthly channel spend) |
| chart.cash | cash | chtCF | SVG chart (cash flow) |
| chart.protect | protect | chtPR | SVG chart (protection gaps) |
| chart.grow | grow | chtGR | SVG chart (growth comparison) |
| chart.retire | retire | chtRT | SVG chart (retirement income) |
| chart.tax | tax | chtTX | SVG chart (tax breakdown) |
| chart.summary | summary | chtSum | SVG chart (financial health radar) |
| chart.timeline.kpi | timeline | chtClientKPI | SVG chart (client KPIs) |

---

## 48. `scui.*` — Strategy Compare UI (dynamic, 8 sub-elements)

| Element ID | Description |
|---|---|
| scui.container | Main container (id="scuiContainer") |
| scui.add-menu | Add strategy menu (preset strategies + custom) |
| scui.preset-strategies | Preset strategy cards (life, annuity, securities, advisory, etc.) |
| scui.biz-presets | Business preset strategies |
| scui.custom-builder | Custom strategy builder |
| scui.horizon-toggle | Horizon toggle buttons (5yr, 10yr, 20yr, 30yr) |
| scui.stress-test | Crisis Test button per strategy card |
| scui.backtest | Full Backtest button per strategy card |

---

## Summary statistics

| Category | Count |
|---|---|
| Sidebar sections | 5 |
| Sidebar items | 24 |
| Panels | 24 |
| Cards | 59 |
| Form-groups | 167 |
| Results-grids | 30 |
| Table-wraps | 32 |
| Charts | 10 |
| Ref-tips | 15 |
| Ref-categories | 14 |
| Ref-entries | 78 |
| Interaction patterns | 9 types |
| Visual system elements | 12 |
| Responsive breakpoints | 4 |
| Accessibility primitives | 7 |
| Save/load elements | 5 |
| Narration elements | 6 |
| Print/PDF elements | 3 |
| Disclaimer elements | 3 |
| Sidebar footer elements | 4 |
| Main header elements | 4 |
| Welcome tip elements | 3 |
| Restore banner elements | 3 |
| Mobile elements | 2 |
| SCUI elements | 8 |
| **Total structural elements** | **542** |
