# HTML Structural Inventory — Starter

> **Last reviewed:** 2026-04-14
> **Status:** Starter skeleton. Pass 1 of v2.6 series walks the HTML (`docs/reference/WealthBridge-Business-Calculator-v7.6.html`) end-to-end and extends this to exhaustive row-per-element detail, producing `docs/HTML_STRUCTURAL_INVENTORY.md`.
> **Use:** every structural element enumerated here becomes a row in `CALCULATOR_PARITY.md` Section A-0 with status `absent | partial | match | superior | n/a:<reason>`.

---

## Element ID convention

`<category>.<subcategory>.<index-or-slug>`

Examples:
- `nav.sidebar-section.practice`
- `nav.sidebar-item.plan`
- `panel.plan`
- `card.plan.income-streams`
- `form-group.plan.fyc`
- `ref-tip.funnel.appointment-conversion`
- `results-grid.cashflow.balance-summary`
- `interaction.slider.range-pair`
- `ref-entry.citation.0062`

---

## Category inventory (~40 top-level; ALL require full sub-enumeration by Pass 1)

### 1. `nav.sidebar-section` — 5 sidebar group labels

Groups in HTML order:
1.1. Practice Management
1.2. Client Planning
1.3. Client Back-Planner
1.4. References
1.5. (implicit: footer utilities — slot-mgr + disclaimer + print)

Each section heading has visual styling (small caps, weight, color). Gap between sections.

### 2. `nav.sidebar-item` — 23 nav items

In HTML source order, grouped under section:
- Practice Management: My Plan, GDC Brackets, Products, Sales Funnel, Recruiting, Channels, Dashboard, P&L
- Client Planning: Client Profile, Cash Flow, Protection, Growth, Retirement, Tax, Estate, Advanced, Education, Business Client, Cost-Benefit, Strategy Compare, Timeline, Summary, Partner
- References: References
- Footer utilities: (slot-mgr UI, not a nav item per se; enumerated under sidebar.footer)

Per nav item: ID, label text, icon (if present), click behavior (panel switching), active-state styling, hover state, keyboard focus order.

### 3. `panel.<id>` — 23 panel containers (one per nav item)

Per panel: ID (matching nav item), heading h1/h2, desc paragraph, visibility logic (hide/show on nav click), scroll container, top-level structure (cards inside).

### 4. `card.<panel>.<id>` — Cards inside panels

Every panel contains 1-N cards. Per card: ID or index, h2/h3 heading, desc paragraph, body structure, border/shadow styling, corner-radius, internal padding. Card sub-structure varies — some have tabs, some have form-grid + results-grid, some have custom layouts (e.g., Combined Chart, scuiContainer).

### 5. `card.plan.*` — My Plan sub-cards

Income stream tracks as sub-cards:
- Track A (Life)
- Track B (Annuities)
- Track C (Disability/LTC/Supplemental)
- Track D (Securities commissions)
- AUM (Advisory fee-based)
- Team Override (override spread from direct-report production)

Plus:
- Multi-stream roll-up card (totals)
- Combined Practice + Personal chart (growth slider, savings rate slider, horizon slider, table + SVG chart)

Per track: FYC input, renewals input, product-mix inputs, cascade logic to roll-up.

### 6. `card.gdc.*` — GDC Brackets

Bracket table (tier breakpoints, % payout per tier), advisor-level inputs (trailing 12mo GDC, projection), effective payout calculation, visualization.

### 7. `card.products.*` — Products

Product catalog (life insurance, annuities, securities, advisory), per-product attributes (commission schedule, compliance notes, suitability), product-selection UI.

### 8. `card.funnel.*` — Sales Funnel

4-step conversion funnel:
- Prospects → Appointments (conversion rate input)
- Appointments → Proposals (conversion rate input)
- Proposals → Applications (conversion rate input)
- Applications → Sales (conversion rate input)
Plus:
- Activity math (daily / weekly / monthly calculations)
- Revenue linkage (tied to Plan FYC target)

Per step: input pair (rate + target count), ref-tips with industry benchmark citations.

### 9. `card.recruiting.*` — Recruiting

6-stage recruiting funnel (contacts, interviews, etc.), ramp schedule per new hire, roster management, timeline visualization, multi-track (different producer types).

### 10. `card.channels.*` — Marketing Channels

Multi-channel grid:
- Channel rows (Events, Digital, Referrals, LinkedIn, Custom 1-N)
- Per row: monthly spend, CPL (cost per lead), conversion rate, revenue per converted lead
- Roll-up totals (total spend, total revenue, ROI)

### 11. `card.dashboard.*` — Dashboard

Monthly tracking grid (12 months × metrics), target values from Plan + actuals entry, variance visualization.

### 12. `card.pl.*` — P&L

Revenue lines, expense lines, business metrics, margin calculations.

### 13. `card.profile.*` — Client Profile

Demographic inputs (age, marital, dependents), financial inputs (income, assets, liabilities), goals capture (retirement age, target income, risk tolerance).

### 14. `card.cashflow.*` — Cash Flow

Income sources, expense categories (fixed, variable, discretionary), savings rate calculation, emergency fund targeting, DTI calculation.

### 15. `card.protection.*` — Protection

DIME method (Debt, Income, Mortgage, Education — life insurance need), disability gap (income replacement shortfall), LTC gap (care cost projection vs assets), per-gap recommendation output.

### 16. `card.growth.*` — Growth / Accumulation

Tax-advantaged vehicle comparison (401k, IRA, Roth, HSA, 529, taxable), contribution optimization, asset allocation basic view.

### 17. `card.retirement.*` — Retirement Planning

Social Security estimation (age, earnings, claiming strategy), withdrawal calculator (systematic withdrawal rate, rising-equity glide path, Monte Carlo basic), income gap (projected income vs projected spending), sequence-of-returns awareness.

### 18. `card.tax.*` — Tax Planning

Federal bracket calculation (AGI, deductions, effective rate, marginal rate), state tax (state selector), self-employment (SE tax), strategy optimization (Roth conversion, capital gains harvest, QBI).

### 19. `card.estate.*` — Estate Planning

Federal exemption tracking, TCJA sunset awareness (post-2025), annual gifting calculator, document checklist (will, POA, healthcare directive, trust), generation-skipping considerations.

### 20. `card.advanced.*` — Advanced Strategies

Four sub-cards:
- **Premium Financing** — premium schedule, loan amount, collateral requirements, cash flow projection, exit strategy
- **ILIT** — trust structure, Crummey letters, premium gifting, insurance policy coordination
- **Exec Comp** — NQDC, split-dollar, §162 bonus, REBA
- **Charitable** — DAF, CRT, CLT, private foundation comparison

Each with its own form-grid + results-grid + ref-tips + narration.

### 21. `card.education.*` — Education Planning

529 calculator with inflation, contribution schedule, superfunding option, grandparent-owned timing, FAFSA impact note.

### 22. `card.business.*` — Business Client

Business-owner planning:
- Key person insurance (coverage calculation)
- Buy-sell funding (entity vs cross-purchase)
- Group benefits (employee coverage, group life/DI)
- Exec comp (supplemental for key execs)

### 23. `card.cost-benefit.*` — Cost-Benefit Analysis

Scoring framework for strategies (cost, benefit, complexity, time to value), multi-strategy comparison, weighted decision output.

### 24. `card.compare.*` — Strategy Compare (Holistic Wealth Planning Engine)

Multi-component card:
- Planning assumptions (time horizon, return expectation, volatility)
- Target income back-plan
- `scuiContainer` (Strategy Compare UI — comparison matrix, results display)
- Save/load/export/import buttons (slot management, JSON export/import)
- Walk-me-through narration trigger (`CalcNarrator.walkThrough()`)

### 25. `card.timeline.*` — Timeline

Implementation timeline (milestones, durations, dependencies), client KPIs (targets over time, variance tracking).

### 26. `card.summary.*` — Summary

Financial health scorecard (aggregate across all planning surfaces), per-category scoring, overall health indicator.

### 27. `card.partner.*` — Partner

Affiliate earnings calculator (referral commissions, revenue share, payout schedules).

### 28. `card.references.*` — References panel

- Quick-reference table (most-cited sources)
- 17 `ref-cat` citation categories (major source domains — e.g., IRS, FINRA, SSA, CMS, Morningstar, etc.)
- 88 `ref-entry` numbered citation entries
- Per-entry: number, title/description, URL or source, date accessed, relevance note
- Due-diligence checklist (recommended verification steps per source)

### 29. `sidebar.footer.*` — Sidebar footer utilities

- `slot-mgr` — save slot management (10 slots, load/save/delete per slot)
- Version display: "v3.1"
- Disclaimer: "All calculations are estimates. Consult your compliance team before use."
- Print button (triggers `window.print()`)

### 30. `form-group.*` — Form-group interaction pattern

Standard structure:
```
<div class="form-group">
  <label>Label text <i class="ref-tip">... (optional)</i></label>
  <input type="..." value="..." step="..." oninput="...">
  <p class="hint">Hint text (optional)</p>
</div>
```

Variants:
- Number input with range slider pair (bidirectional sync)
- Select box with options list
- Text input (rare)
- Textarea (rare)

Per variant: HTML structure, CSS styling, keyboard accessibility, ARIA attributes, mobile touch target size.

### 31. `results-grid.*` — Results-grid rendering pattern

Standard structure: grid layout (auto-fit minmax), per-output label + value + sub-label (units/explanation). Formatting conventions (currency, percentages, counts, durations). Conditional display (hide if N/A). Color coding (positive/negative, threshold-based).

### 32. `ref-tip.*` — Ref-tip tooltip system

27 inline `<i class="ref-tip">` elements identified in HTML. Per tip:
- Host element (which label/field it annotates)
- `tip-text` — the explanation text (shown on hover/focus)
- `tip-src` — the citation source (number referencing ref-entry)
- Position logic (tooltip placement relative to host)
- Accessibility (keyboard focus, ARIA tooltip role)

Enumerate all 27 (Pass 1 deliverable).

### 33. `interaction.*` — Interaction patterns

- `interaction.slider` — range input with synced number input, oninput update cascade
- `interaction.number-input` — standalone number with step values
- `interaction.select` — select box with options, onchange cascade
- `interaction.button` — button styles (primary/secondary/ghost/danger), click handlers
- `interaction.tab` — tab navigation (if present in a card)
- `interaction.toggle` — checkbox/switch where present
- `interaction.chip` — small labeled pill (for categories, filters)
- `interaction.save-slot` — save slot interaction pattern
- `interaction.walk-through` — narration start/next/finish controls

### 34. `visual-system.*` — Visual language

- `visual-system.colors` — navy primary (#1e3a8a-ish), gold accent, slate scales, white backgrounds
- `visual-system.typography` — heading hierarchy (h1/h2/h3), body text, desc text, hint text, label text, disclaimer text
- `visual-system.spacing` — card padding, form-grid gaps, results-grid gaps, vertical rhythm
- `visual-system.borders` — card borders, border-radius values
- `visual-system.shadows` — card elevation, button hover
- `visual-system.icons` — inline ref-tip icon, nav icons if present

### 35. `responsive.*` — Responsive breakpoints

- `responsive.mobile-390` — 390×844 (iPhone default viewport)
- `responsive.tablet-820` — 820×1180 (iPad portrait)
- `responsive.desktop-1440` — 1440×900 (standard laptop)
- Sidebar behavior at each breakpoint (collapse, overlay, or always-visible)
- Form-grid reflow at each breakpoint (auto-fit minmax behavior)
- Card sizing at each breakpoint

### 36. `accessibility.*` — Accessibility primitives

- `accessibility.aria-label` — every interactive element has aria-label
- `accessibility.role` — ARIA roles on semantic elements
- `accessibility.tabindex` — tab order preserved logically
- `accessibility.focus-state` — visible focus indicator on every focusable element
- `accessibility.reader-order` — screen reader traversal matches visual order
- `accessibility.contrast` — text contrast meets WCAG AA
- `accessibility.keyboard-traversal` — every function reachable by keyboard

### 37. `save-load.*` — Save/load/export/import

- `save-load.slot-mgr` — 10-slot save management (save, load, delete per slot)
- `save-load.json-export` — `exportStrategyJSON()` function (scope + structure)
- `save-load.json-import` — `importStrategyJSON()` function
- `save-load.validation` — import validation (schema check, version check)
- `save-load.persistence` — localStorage backing + migration (if version-bumped)

### 38. `narration.*` — Walk-me-through narration

- `narration.trigger` — how narration starts (button click, first-visit, help menu)
- `narration.calc-narrator` — `CalcNarrator.walkThrough()` function
- `narration.scope` — which surfaces have narration (enumerate)
- `narration.content` — narration text per surface
- `narration.navigation` — next/previous/finish controls
- `narration.focus-move` — how narration moves user focus through the surface

### 39. `print-pdf.*` — Print / PDF export

- `print-pdf.button` — print trigger button location
- `print-pdf.action` — `window.print()` invocation
- `print-pdf.css` — print-specific CSS (hide nav, hide sidebar, page breaks, clean layout)
- `print-pdf.per-panel` — which panels are print-optimized

### 40. `disclaimer.*` — Disclaimer and version footer

- `disclaimer.version` — "v3.1"
- `disclaimer.text` — "All calculations are estimates. Consult your compliance team before use."
- `disclaimer.placement` — sidebar footer, bottom of panels (if applicable)
- `disclaimer.styling` — muted, smaller font

---

## Pass 1 deliverable checklist

Pass 1 of v2.6 series extends this starter by:

1. For each of the 40 top-level categories above, walk the HTML end-to-end and enumerate every sub-element not already listed here.
2. For each enumerated element, assign element ID per convention.
3. For each enumerated element, create a row in `CALCULATOR_PARITY.md` Section A-0 with initial status `absent` (since Stewardly is starting fresh) and link to HTML source line(s).
4. Commit `docs/HTML_STRUCTURAL_INVENTORY.md` as the exhaustive inventory.
5. Commit extended `CALCULATOR_PARITY.md` Section A-0 rows.
6. Emit Pass 1 summary: total inventory row count, total Section A-0 rows added, baseline `structural_inheritance_rate: 0%`.

**Expected scale:** the full inventory is expected to exceed 500 rows. If Pass 1 produces fewer than ~300 rows, it's likely missing sub-enumeration and the inventory-completeness check will fail in subsequent passes.

---

## Amendment protocol

Agent cannot self-edit this starter or the full inventory after Pass 1. Amendments:
1. Agent logs proposed amendment to `docs/PROMPT_ISSUES.md`.
2. User reviews, edits inventory directly.
3. `Last reviewed` timestamp updated.

During Passes 2+, if a scope-#4 pass discovers a structural element not in the inventory:
1. Agent logs discovery as `inventory-gap-discovered` in `PROMPT_ISSUES.md`.
2. Agent does NOT add the row to inventory itself (directive floor).
3. Reset trigger fires (convergence streak resets).
4. User reviews; if legitimate gap, user extends inventory.

This protocol protects against agent "completing" the inventory by narrowing scope rather than expanding coverage.
