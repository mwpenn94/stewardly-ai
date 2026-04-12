# Mobile Audit Notes (375px viewport simulation)

## Chat Page — Desktop View (simulated mobile)
1. **~30 empty "New Conversation" entries** dominate the sidebar — major clutter
2. **Sidebar is always visible on desktop** — no mobile hamburger menu visible in this view
3. **AI Getting Started widget** shows 9/18 items — takes significant sidebar space
4. **Consent banner** still showing at bottom — "Terms of Service" and "Privacy Policy" links + "Got it" button
5. **Main content area**: Greeting, 4 suggestion cards, text input — looks reasonable
6. **Bottom bar**: Input area with "General" mode selector, attachment buttons

## Key Issues to Fix:
1. Empty conversations cleanup — need to handle on backend or add auto-cleanup
2. Consent banner persistence — should not reappear after dismissal
3. Mobile sidebar should be hidden by default (it is on actual mobile via lg: breakpoint)
4. Onboarding widget taking too much sidebar space on mobile
