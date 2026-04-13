# Recursive Pass 2 Audit — Calculators Section

## Fresh Perspective: Data Flow, Business Logic, Cross-Feature Integration

### Findings

1. **QuickActions missing export props on 5 inline panels** — IUL, PF, Ret had QuickActions without calcId/data props. Stress and MC had no QuickActions at all.
   - **FIXED**: All 5 inline panels now pass calcId and data to QuickActions for PDF export.

2. **savedSessionsQuery.data access** — Badge at line 1019 uses `savedSessionsQuery.data.length` but it's inside `savedSessionsQuery.data?.length` ternary, so it's safe. The `.map()` at line 1048 is inside `savedSessionsQuery.data && savedSessionsQuery.data.length > 0` guard. **SAFE**.

3. **Income stream add flow** — uses a hardcoded $50k amount for all new streams. This is reasonable as a default since the user can edit it. **ACCEPTABLE**.

4. **Holistic score doesn't incorporate income streams** — the `computeHolisticScore` function uses the profile's `annualIncome` field, not the custom income streams. The streams are a separate visualization layer. This is correct — the holistic score should reflect the profile data, and streams are an overlay for planning. **CORRECT DESIGN**.

5. **All inline panels (IUL, PF, Ret, Stress, MC) data access** — all are inside conditional blocks (`iulCalc.data ? (...)`) so null access is impossible. **SAFE**.

6. **TypeScript compilation** — 0 errors after all changes.

7. **All 85 tests passing** — holistic (37), extensions (28), income streams (20).

## Actions Taken
- Added QuickActions with calcId/data to IUL, PF, Ret inline panels
- Added QuickActions with calcId/data to Stress and MonteCarlo inline panels

## Verdict
2 actionable items found and fixed. All other items verified as safe/correct.
Pass 2 NOT converged (had fixes). Pass 3 needed.
