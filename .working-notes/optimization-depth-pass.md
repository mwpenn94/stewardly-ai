# Recursive Optimization — Depth Pass

## Scope
Optimize the Stewardly AI platform UI/UX across desktop and mobile, focusing on the highest-impact issues identified in the landscape pass.

## Signal Assessment
- **Fundamental Redesign**: Absent — core architecture is sound
- **Landscape**: Completed — comprehensive audit done
- **Depth**: PRESENT — broad coverage exists but specific areas remain shallow, multiple untested assumptions
- **Adversarial**: Absent — not yet ready
- **Future-State/Synthesis**: Absent — not yet ready

## Executing: Depth Pass

## Priority Fixes (ordered by impact):

### P0 — Critical (breaks user experience)
1. **CSP blocking fontshare.com** — Satoshi font not loading, text may fall back to system font
2. **Nested button DOM error** in AIOnboardingWidget — React warning, accessibility issue
3. **Market Data watchlist shows "—" for all prices** — data not loading

### P1 — High (significant UX degradation)
4. **Multiple overlapping modals on first load** — What's New + Onboarding Tour + Consent Banner simultaneously
5. **~30 empty "New Conversation" entries** cluttering chat sidebar
6. **Page title truncation** on hub pages — "visory", "ationships", "erations" visible
7. **Consent banner not persisting dismissal** — reappears on navigation

### P2 — Medium (polish and consistency)
8. **Mobile responsiveness audit** — need to verify all pages work on mobile
9. **Footer "Preview mode" banner** — should only show in dev, not confuse users
10. **Quick stat cards all showing "—"** across Operations, Advisory, Relationships hubs
