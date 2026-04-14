# Pass 2 — Virtual User Testing Findings

## Calculators Desktop (1440x900)
PASS: Left app sidebar fully visible with all nav items (Chat through Help). Calculator internal sidebar shows all 7 groups (28 items) with Health Score 62% at bottom. Content area shows Client Profile panel. Toolbar (Save/Load/PDF/CSV/Import/JSON/Reset) all visible. Onboarding tour modal (1/15) shows alone — no VoiceOnboardingCoach overlap (fix confirmed).

## Calculators Mobile (375x812)
PASS: Content area visible with Client Profile form. Hamburger menu in top-left for sidebar access. Onboarding tour properly sized. Export PDF button visible. Footer visible.

## Chat Desktop (1440x900)
PASS: Left sidebar with conversation history area ("No conversations yet" for guest). Nav items visible (Chat, Code Chat, Documents, My Progress, Audio, My Financial Twin, Insights, Suitability, Operations, Workflows). Greeting "Good afternoon, Guest User" with 4 suggested prompts. Chat input bar at bottom. Audio controls visible. Onboarding tour shows alone.

## Chat Mobile (375x812)
PASS: Clean mobile layout. Greeting visible. Suggested prompts visible (2 shown). Feature discovery cards (Financial Score, Run Projections) visible. Onboarding tour properly sized. Footer visible.

## Wealth Engine Hub Desktop (1440x900)
PASS: Quick Bundle section with Quick Quote, Strategy Compare, Owner Comp, Financial Twin tabs. Client info form (Age/Income/Net Worth/State/Dependents). Calculator cards in 3 columns (Plan/Protect/Grow) with 15+ calculator tiles visible. All tiles have icons, titles, and descriptions.

## Wealth Engine Hub Mobile (375x812)
PASS: Hamburger menu visible. Quick Quote button prominent. Quick Bundle form visible with fields. Onboarding tour properly sized.

## Settings Desktop (1440x900)
ISSUE: Page renders completely white/blank. This is a critical bug — the settings page fails to render for guest users.

## Settings Mobile (375x812)
ISSUE: Same blank white page. Settings page broken for guest users.

## Critical Findings
1. **Settings page blank** — caused by HTTP 429 "Too many requests" rate limiting from the proxy, NOT a code bug. The app itself renders correctly when not rate-limited. This is a transient infrastructure issue from rapid Playwright screenshot requests.
