# Phase 1 — UI/UX Foundation Assessment (Pass 66 Entry)

## Criteria (all must-have unless noted)

### C1: Navigation Coherence (Score: 7/10)
**Evidence:** 148 routes in App.tsx, PersonaSidebar5 with disclosure-filtered nav groups, 139 pages. Sidebar is well-organized with logical grouping (Core, Practice, Advisory, Admin). However: some deep features require 4+ clicks to reach (e.g., specific calculator sub-tabs). No breadcrumb navigation on deep pages. Search/command palette exists (PlatformIntelligence) which helps.
**Gap:** Need breadcrumbs on nested pages, ensure all major features reachable in ≤3 clicks.

### C2: Mobile Stability (Score: 6/10)
**Evidence:** Responsive classes used extensively (sm:, md:, lg: breakpoints). Mobile sidebar collapse works. Touch targets improved in Pass 63 (min-h-[44px]). However: no actual testing at 390×844 viewport. Tables with min-w values may overflow. Some complex pages (Calculators, WealthEngine) likely have layout issues at narrow widths. No Playwright E2E at mobile viewport.
**Gap:** Need actual mobile viewport testing and fixes for complex pages.

### C3: Progressive Disclosure Consistency (Score: 6/10)
**Evidence:** DisclosureContext with 4 levels (Essential/Standard/Professional/Expert). PersonaSidebar5 filters nav items by disclosureLevel. UnifiedAI uses it for mode filtering. FinancialPlanning uses useDisclosureGate. However: only 3 pages actually consume disclosure level. Most pages (136/139) don't implement progressive disclosure — they show everything regardless of level. The pattern exists but is not uniformly applied.
**Gap:** Need to apply disclosure filtering to more surfaces, especially complex ones like WealthEngine, Calculators, Learning.

### C4: Visual System Coherence (Score: 8/10)
**Evidence:** 208 CSS custom properties/oklch values in index.css. Consistent use of shadcn/ui components (217 components). Design tokens for spacing, radius, shadows. Consistent card structure across pages. Professional dark theme with warm amber accents. Typography hierarchy with Inter + JetBrains Mono.
**Gap:** Minor inconsistencies in some older pages. Generally strong.

### C5: Loading/Error/Empty States (Score: 7/10)
**Evidence:** 678 loading state references, 98 error state references, 193 empty state references. QueryErrorBanner component exists and is used. Skeleton loaders on critical pages. However: some pages still lack explicit empty state guidance (just show blank). Some error states are generic.
**Gap:** Need empty state illustrations/guidance on remaining pages.

### C6: Micro-interactions & Delight (Score: 7/10)
**Evidence:** 1122 animation/transition references. Framer Motion used in some components. Smooth transitions on sidebar, cards, modals. WhatsNewModal, onboarding checklist, keyboard shortcuts. However: some interactions feel abrupt (page transitions, tab switches). No route transition progress indicator.
**Gap:** Add route transition indicator, smoother page transitions.

### C7: Accessibility Baseline (Score: 7/10)
**Evidence:** 1042 ARIA/role/tabIndex references. Keyboard handlers on clickable elements (fixed in Pass 63). sr-only labels. Focus rings. However: no formal WCAG AA audit. Color contrast not verified systematically. Skip navigation link not present.
**Gap:** Add skip nav link, verify contrast ratios on key surfaces.

### C8: Performance + Failover Baseline (Score: 5/10)
**Evidence:** 300 failover-related references. IntegrationHealth page shows connected/degraded/error. However: no actual service status indicators on the main UI (only on admin IntegrationHealth page). No "Using cached data" indicators. No graceful degradation UI when LLM is down. No offline mode. No service health context provider that surfaces consume.
**Gap:** Build ServiceStatusProvider with real-time health indicators. Add degraded-mode UI for LLM, integrations, market data.

### C9: Sharing UI Patterns (Score: 5/10)
**Evidence:** ShareKit component exists with ShareButton, PermissionSelector, RecipientPicker. Used on FinancialPlanning and MarketData pages. Sharing router exists with CRUD operations. However: only 2 pages use ShareButton. No omission toggle. No bulk sharing. No sharing status indicators on most content. The kit exists but adoption is minimal.
**Gap:** Add ShareButton to all major content pages. Build omission toggle. Add sharing indicators.

## Summary

| Criterion | Score | Priority |
|-----------|-------|----------|
| C1: Navigation Coherence | 7 | must-have |
| C2: Mobile Stability | 6 | must-have |
| C3: Progressive Disclosure | 6 | must-have |
| C4: Visual System Coherence | 8 | must-have |
| C5: Loading/Error/Empty | 7 | must-have |
| C6: Micro-interactions | 7 | nice-to-have |
| C7: Accessibility | 7 | must-have |
| C8: Performance + Failover | 5 | must-have |
| C9: Sharing UI Patterns | 5 | must-have |

**Lowest must-have scores:** C8 (5), C9 (5), C2 (6), C3 (6)
**Next action:** Build ServiceStatusProvider and failover UI patterns (C8) — this is the lowest-scoring must-have and a cross-cutting infrastructure need.
