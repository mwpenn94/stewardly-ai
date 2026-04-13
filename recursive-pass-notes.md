# Recursive Optimization — Calculator Section

## Pass 1 Audit (Apr 13, 2026)

### Current State (1,491 lines)
- Holistic scorecard with Plan/Protect/Grow pillars ✓
- What-If scenario comparison (6 presets) ✓
- 30-year wealth trajectory chart ✓
- 12 calculator panels (IUL, PF, Ret, Tax, SS, Medicare, HSA, Charitable, Divorce, Education, Stress, Monte Carlo) ✓
- Profile-driven pre-population ✓
- Deep-dive tools accordion (15 links) ✓
- QuickActions (Print/Discuss) on each panel ✓
- TypeScript clean, 65 holistic tests passing ✓

### Pass 1 — Issues Found

1. **Multiple income streams NOT supported** — todo item still open. Calculator hierarchy is flat; no way to model multiple roles, business entities, or income sources rolling up into holistic view.

2. **No save/persist for calculator inputs** — user loses all slider adjustments on page navigation. Need localStorage or tRPC persistence.

3. **No export/share** — Print/Share button just calls window.print(). No PDF generation, no shareable link, no email capability.

4. **Scenario engine only modifies returnRate and monthlySavings** — applyScenario doesn't handle inflationRate or incomeGrowth overrides despite defining them in ScenarioOverride.

5. **Trajectory chart doesn't show scenario overlays** — can only see baseline trajectory, not comparison lines for different scenarios.

6. **Calculator grid selector doesn't show pillar grouping** — CALCULATORS array has pillar field but the grid doesn't group by pillar visually.

7. **No keyboard navigation for calculator selector** — grid of buttons works but no arrow key navigation or visual focus indicators.

8. **Monte Carlo panel missing** — activeCalc === "montecarlo" case exists but the panel content is cut off in the read. Need to verify.

9. **Cost-benefit summary not surfaced** — holisticScoring.ts has CostBenefitSummary but it's not shown on the Calculators page.

10. **No recommended products section** — holisticScoring.ts has buildProducts() but products aren't shown.

11. **Trajectory projection doesn't interpolate composite scores** — only computes every 5 years, uses last value for in-between years (causes staircase effect).

12. **No "Compare to Peers" or benchmark context** — scores shown without reference to what's typical for age/income bracket.

13. **Actions strip only shows top 4** — holisticResult.actions may have many more; no way to see all.

14. **No calculator-to-calculator cross-linking** — e.g., Tax result should suggest running Charitable or HSA calculators.

15. **Empty state CTA could be more actionable** — "Set Up Profile" is vague; could offer quick inline inputs.

16. **No loading skeleton for holistic scorecard** — when profile loads, the section just appears.

17. **Slider ranges may be too narrow** — e.g., IUL premium max is $100K, PF face max is $50M, but HNW clients may need higher.

18. **No tooltips explaining what each score means** — pillar scores show numbers but no context.

19. **No "last calculated" timestamp** — user can't tell when they last ran a calculator.

20. **Stress test scenario buttons don't show descriptions** — only show name, not the impact details.

### Pass 1 — Actions to Take

Priority A (Critical):
- A1: Fix applyScenario to handle inflationRate and incomeGrowth overrides
- A2: Add localStorage persistence for calculator inputs
- A3: Group calculator selector by pillar (Plan/Protect/Grow tabs or sections)
- A4: Surface cost-benefit summary and recommended products from holistic engine
- A5: Add scenario overlay lines to trajectory chart

Priority B (Important):
- B1: Add cross-calculator recommendations (e.g., after Tax → suggest Charitable)
- B2: Show all actions with expandable list (not just top 4)
- B3: Add tooltips to pillar scores explaining what they mean
- B4: Add loading skeleton for scorecard section
- B5: Improve empty state with inline quick-entry fields

Priority C (Polish):
- C1: Add "last calculated" timestamps
- C2: Extend slider ranges for HNW edge cases
- C3: Add keyboard navigation for calculator grid
- C4: Add peer benchmark context to scores
- C5: Improve stress test scenario descriptions
