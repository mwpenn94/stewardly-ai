# Depth Pass Progress

## Completed Fixes
1. **CSP for fontshare.com** — Added to style-src and font-src. Satoshi font now loads correctly.
2. **Hub page headers** — Removed redundant back-to-chat buttons from Advisory, Relationships, Operations, Intelligence hubs (AppShell already provides navigation).
3. **Nested anchor fix** — Fixed Link wrapping Button in AdvisoryHub (creates nested `<a>` tags).
4. **Unused imports cleanup** — Removed ArrowLeft from all 4 hub pages.
5. **Raw SQL column name fix** — Fixed `messages.created_at` → `messages.createdAt` in improvementEngine.ts.
6. **Empty conversation filtering** — Frontend now hides "New Conversation" entries with no messages (unless active or recently created).
7. **Empty conversation cleanup job** — Added to scheduler: deletes empty conversations older than 1 hour.

## Remaining Priority Fixes
- [ ] Mobile responsiveness audit and fixes
- [ ] Help page content enhancement
- [ ] Settings page tab navigation on mobile
- [ ] Market Data page empty state improvement
- [ ] Landing page mobile optimization
- [ ] Test suite expansion
- [ ] Comprehensive guide document
- [ ] Admin-only in-app design specs page
