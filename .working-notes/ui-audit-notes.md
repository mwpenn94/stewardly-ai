# UI/UX Audit Notes — Recursive Optimization Landscape Pass

## Desktop View — Chat Page (Initial Load)

### Observations:
1. **What's New modal** appears on every load — blocks the main content. Should only show once per version.
2. **Onboarding tour** step 1 of 4 also appears simultaneously — two overlapping modals is overwhelming.
3. **Sidebar**: Shows many "New Conversation" entries — conversation list appears to have empty/duplicate entries.
4. **Left sidebar** has good structure: conversation list at top, tools section, admin section at bottom.
5. **AI Getting Started checklist** visible at bottom of sidebar — good onboarding feature.
6. **Welcome prompt suggestions** visible behind modals — need to verify they're working.
7. **Chat input bar** visible at bottom — "Ask Steward anything..." placeholder.
8. **Color scheme**: Dark theme with teal/sky accents — consistent with financial app aesthetic.
9. **Footer**: "Preview mode" banner at very bottom — this is a dev artifact.

### Issues Found:
- [ ] Multiple overlapping modals on first load (What's New + Onboarding Tour + Consent Banner = 3 overlays)
- [ ] Many empty "New Conversation" entries in sidebar — ~30 entries with no title, cluttering the list
- [ ] Consent banner persists even after clicking "Got it" — may not be saving dismissal state
- [ ] Sidebar conversation list is not grouped by date (today, yesterday, last week, etc.)
- [ ] TOOLS and ADMIN sections in sidebar are collapsed by default — good
- [ ] AI Getting Started checklist shows 9/18 — good progress tracking
- [ ] Welcome prompt suggestions are role-aware (admin prompts visible) — good
- [ ] Chat input bar has focus mode selector (General) — good
- [ ] Need to check mobile responsiveness
- [ ] Need to verify all sidebar navigation links work
- [ ] Need to check all hub pages render correctly
- [ ] Need to test actual chat functionality
- [ ] Need to verify voice mode works

## Desktop View — Settings Page

### Observations:
1. **Settings layout**: Left sidebar with full navigation + settings sub-nav + content area. Three-column layout.
2. **Settings sub-nav**: 12 tabs — Profile & Style, Connected Accounts, Financial Profile, Knowledge Base, AI Tuning, Voice & Speech, Notifications, Appearance, Guest Preferences, Privacy & Data, Data Sharing, Keyboard Shortcuts.
3. **Profile & Style tab**: AI Avatar upload, Communication Style textarea, Memories section with fact/financial categories.
4. **Memories section**: Shows existing memories with categories (Fact, Financial) — good.
5. **Breadcrumb**: "← Chat > Settings" — good navigation.
6. **Full sidebar navigation visible**: Chat, Operations, Intelligence, Advisory, Relationships, Market Data, Documents, Integrations, Integration Health, Passive Actions, My Progress, Portal, Organizations, Manager Dashboard, Global Admin, Improvement Engine, Help & Support, Settings.

### Issues Found:
- [ ] Settings page has consent banner still showing at bottom
- [ ] The sidebar shows ALL navigation items regardless of role — should be filtered
- [ ] "NAVIGATE" label at top of sidebar is truncated
- [ ] Some settings tab descriptions are cut off by the sidebar width

## Desktop View — Advisory Hub

### Observations:
1. **Advisory Hub loads** — initial blank page was caused by 429 rate limiting (too many rapid requests)
2. **Layout**: AppShell sidebar + content area with tabs (Products, Cases, Recommendations)
3. **Quick stats cards**: Products, Active Cases, Recommendations, Completed — all show "—" (no data)
4. **Product categories**: Life Insurance, Annuities, Estate Planning, Premium Finance, Investment Products, Marketplace
5. **Product Catalog**: Shows real products — Guardian Disability Income, Guardian Whole Life, MassMutual CareChoice One, etc.
6. **Suitability CTA**: "Start Suitability Assessment" link at bottom

### Issues Found:
- [ ] Page title "Advisory" is partially hidden behind back arrow — "visory" visible
- [ ] Quick stat values all show "—" — should show actual counts or "0"
- [ ] Product category cards have "Explore →" but may not navigate anywhere useful

## Desktop View — Operations Hub

### Observations:
1. **Layout**: AppShell sidebar + content with tabs (Active Work, Agents, Compliance, History)
2. **Quick stats**: Active Tasks, Running Agents, Pending Reviews, Compliance Flags — all "—"
3. **Workflows in Progress**: Empty state with "Ask the AI to start a workflow →" CTA
4. **Pending Reviews**: Shows loading spinner

## Desktop View — Intelligence Hub

### Observations:
1. **Layout**: AppShell sidebar + content with tabs (Overview, Models, Data, Analytics)
2. **Quick stats**: 8 AI Models, 5 Data Sources, — Insights Today, — Predictions
3. **Intelligence Feed**: Shows 3 items — Portfolio Risk Assessment Updated (2h ago), Retirement Gap Detected (5h ago), Product Match Found (1d ago)
4. **Quick Actions**: Run Full Analysis, Morning Brief, Compare Products, Market Insights

## Critical Issues Summary:
1. **Rate limiting (429)**: Pages go blank when navigating too quickly — need to handle this gracefully
2. **Nested button DOM error**: AIOnboardingWidget has button-inside-button nesting
3. **CSP blocking fontshare.com**: Satoshi font not loading — need to add to CSP or switch to Google Fonts
4. **Multiple overlapping modals on first load**: What's New + Onboarding Tour + Consent Banner
5. **Empty conversation entries**: ~30 "New Conversation" entries cluttering sidebar
