# Changelog — April 14, 2026

**Build**: Convergence session with 92+ passes (20 consecutive clean in Rounds 2, 3, and 4)
**Unit Tests**: 7,716 passed across 320 test files
**E2E Tests**: 68 Playwright tests across 22 suites (100% pass rate)
**TypeScript**: 0 errors

---

## New Features

### Income Streams Panel (PanelsF.tsx)
Full integration of the Income Streams calculator panel into the Calculators page. Users can add, edit, and remove multiple income streams with source, amount, frequency, tax treatment, and growth rate. Each stream shows its contribution to the Plan/Protect/Grow pillars. The panel is wired into `gatherInputs()` and `restoreInputs()` for session persistence.

### PDF Export (pdfExport.ts)
Every calculator panel now has an **Export PDF** button in its header. The PDF generation utility uses jsPDF with html2canvas to capture the panel content and produce a multi-page branded report. Each PDF includes:
- Branded header with Stewardly AI logo and generation timestamp
- Full panel content captured as high-resolution images
- Compliance disclaimer footer on every page
- Page numbering

### TF-IDF Search Scoring (db.ts)
The `searchDocumentChunks` function has been upgraded from simple keyword matching to a TF-IDF-inspired relevance scoring system. Improvements include:
- Stop word filtering (the, is, a, an, etc.)
- Bigram matching for multi-word queries
- Position bonus (earlier matches score higher)
- Exact phrase bonus (2x multiplier)
- Results sorted by composite relevance score

### Collaborative Document Annotations (DocumentAnnotations.tsx)
A new annotation system integrated into the Knowledge Base tab. Users can add comments to documents with:
- Threaded annotations with user attribution
- Timestamp display
- Delete capability for own annotations
- Real-time updates via tRPC invalidation

### Spotlight Onboarding Tour (OnboardingTour.tsx)
A 14-step guided walkthrough that auto-starts for first-time users. The tour covers three categories (Getting Started, Key Features, Personalization) and highlights key sidebar navigation items with data-tour attributes. Progress is saved to localStorage.

### Contextual First Response (prompts.ts)
Enhanced the system prompt with explicit instructions for the AI's first response in a new conversation. The AI now:
- References the user's name and known context
- Mentions connected integrations
- Offers 2-3 personalized action suggestions
- Adapts complexity to the user's financial literacy level

### Financial Narrative Context (prompts.ts)
Added system prompt instructions for presenting financial numbers with narrative context:
- Comparison to relevant benchmarks (national averages, peer groups)
- Relative framing ("This is 2x the recommended emergency fund")
- Goal-specific explanations tied to the user's stated objectives
- Trend indicators showing improvement or decline over time

---

## Bug Fixes

### Overlapping Onboarding Modals
VoiceOnboardingCoach and OnboardingTour were both appearing simultaneously on first visit. Fixed by gating VoiceOnboardingCoach behind the `onboarding_tour_completed` localStorage key.

### Wealth Engine Mobile Sidebar Cutoff
The calculator sidebar was cut off on mobile devices, making bottom nav items inaccessible. Fixed with:
- `inset-y-0` for proper fixed positioning
- `max-h-[100dvh]` for dynamic viewport height
- `min-h-0` on ScrollArea for proper flex shrinking
- `overflow-y-auto` fallback

### PanelsA.tsx Double Brace Syntax
Two function definitions in PanelsA.tsx had `)) {{` instead of `)) {`, causing an extra nesting level. Fixed CashFlowPanel and ProtectionPanel.

### PanelsC.tsx Set Typing
`Set<unknown>` changed to `Set<number>` for proper type safety in the scenario comparison panel.

### PanelsF.tsx Undefined Scores Guard
Added a default empty object guard for the `scores` prop in CrossCalcRecs to prevent undefined access.

### Chat Mobile UX Cleanup
- Hidden AI Context Active bar on mobile (saves vertical space)
- Limited resume conversation cards to 2 on mobile (was showing all)
- Hidden audio toggle and streaming toggle on mobile toolbar (kept essential buttons)

---

## Documentation

- Created `docs/QUICKSTART.md` — beginner-friendly 5-minute guide
- Created `docs/CHANGELOG_APR14.md` — this file
- Updated `docs/convergence-log-apr14.md` — full 30-pass convergence log
- Updated `todo.md` — all completed items marked with implementation notes

---

## Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| server/pdfExport.test.ts | 14 | All pass |
| server/april14-features.test.ts | 12 | All pass |
| server/orgBranding.test.ts | 14 | All pass |
| Total suite | 7,715 | All pass |

---

## Org Branding (White-Label) — Late Addition

### Org Branding Editor (OrgBrandingEditor.tsx)
Enhanced the existing branding editor with 5 tabs:
- **Content**: Headline, subtitle, CTA text, trust signals, disclaimer
- **Colors & Logo**: 3-color palette (primary, accent, secondary) with visual swatches + logo URL
- **Fonts**: 12 Google Fonts with live specimen preview (Inter, Playfair Display, Roboto, Lora, etc.)
- **Media**: Hero image URL with preview + favicon URL with preview
- **Advanced**: Background pattern selector (5 options: mesh, dots, lines, radial, solid) + custom CSS with XSS sanitization

Includes live desktop/mobile preview toggle.

### Org Landing Page (OrgLanding.tsx)
Updated the public landing page renderer at `/org/:slug` to apply all new branding fields:
- Dynamic Google Font loading via CDN link injection
- Hero image with gradient overlay
- 5 background patterns (CSS-generated)
- Secondary color support for gradient accents
- Custom CSS injection with XSS sanitization (strips HTML tags, `expression()`, `javascript:`, `data:` URIs, `@import`)
- Dynamic favicon injection

### Schema Migration
Added 6 new columns to `organization_landing_page_config`:
- `secondaryColor` (varchar 20)
- `fontFamily` (varchar 100)
- `heroImageUrl` (text)
- `customCss` (text)
- `backgroundPattern` (varchar 50)
- `faviconUrl` (text)

### Security
- CSS sanitization function strips dangerous patterns before injection
- All branding fields validated via Zod schemas in tRPC router


---

## Playwright E2E Test Suite

Added comprehensive end-to-end testing with Playwright covering all critical user journeys. The suite includes 68 tests across 22 test files, all running against the live dev server in headless Chromium.

### Test Coverage

The E2E tests cover onboarding tour completion and skip flows, sidebar navigation to all 7 guest-accessible pages, AI Chat conversation rendering (greeting, action cards, input area, mode selector, new conversation button), Code Chat page interaction, Wealth Engine Hub with 8 tests covering sections, Quick Bundle form, calculator panels, toolbar actions, and panel navigation, Settings page with tab navigation and form rendering, Learning page with KPI cards and exam tracks, Help page with guide/FAQ/architecture tabs, Documents page, Command Palette search, Financial Twin dashboard, Products marketplace, Workflows page, Client Onboarding flow, Operations Hub, mobile responsive layout verification (sidebar collapse, touch targets), dark theme consistency, compliance footer and disclosure verification, accessibility checks (heading hierarchy, ARIA labels, focus management), landing page and public routes (terms, privacy, 404), Integrations/Community/Changelog pages, and Wealth Engine sub-pages (Passive Actions, Insights, Suitability).

### Infrastructure

The test framework uses a `setupPage` helper that pre-sets `localStorage` to bypass the onboarding tour overlay, preventing the z-index 10000 overlay from blocking test interactions. Console error tracking filters known transient errors. Rate limits are set to 100,000 in development mode to accommodate test parallelism.

### Running Tests

```bash
# Run all E2E tests
pnpm exec playwright test --project=desktop-chrome

# Run specific test suite
pnpm exec playwright test e2e/03-ai-chat.spec.ts --project=desktop-chrome

# Run with visual browser
pnpm exec playwright test --headed
```
