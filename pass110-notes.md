# Pass 110 Assessment Notes

## Issue 1: "My Plan" page broken
- The Calculators page defaults to `activePanel='profile'` (Client Profile), not 'myplan'
- No URL query param support to deep-link to specific panels
- FIX: Add ?panel= query param support so /calculators?panel=myplan works
- FIX: Add a direct /my-plan route that redirects to /calculators?panel=myplan

## Issue 2: Breadcrumb nested <li> warning
- BreadcrumbSeparator renders as <li>, BreadcrumbItem also renders as <li>
- When BreadcrumbSeparator is inside BreadcrumbItem, it creates nested <li>
- In PageBreadcrumb.tsx, the structure is correct (they're siblings in React.Fragment)
- The error in browser logs is from a different page (AdminAuditTrail) — not PageBreadcrumb
- FIX: Check AdminAuditTrail page for breadcrumb nesting issue

## Issue 3: Progressive Disclosure Nav
- Already have a 4-level disclosure system (Essential/Standard/Professional/Expert)
- PersonaSidebar5 already filters by disclosureLevel
- Need to enhance: group related items into sub-menus, use the Wealth Engine nested sidebar pattern
- Key improvement: reduce visible items at each level, use expandable sub-groups

## Issue 4: Portal Analytics Charts
- Currently shows static metric cards
- Need to add Recharts line/area charts for engagement trends over time
