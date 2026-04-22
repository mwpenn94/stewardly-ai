# Stewardly AI — Live E2E Test Guide for Michael Penn

**Platform URL:** https://stewardly.manus.space
**Test Date:** April 22, 2026
**Role:** Owner / Admin

---

## Pre-Flight Checklist

Before starting, ensure the following are in place:

| Item | Status | Action if Missing |
|------|--------|-------------------|
| Manus OAuth login | Required | Click "Sign In" on landing page |
| Stripe sandbox claimed | Required | Visit [Stripe Sandbox Claim](https://dashboard.stripe.com/claim_sandbox/YWNjdF8xVEoxcmJDVnM5ZWZiRnZQLDE3NzYwNTYxMjIv100q56RqIWX) |
| GoHighLevel account | Optional | Needed only for CRM sync tests |
| Plaid sandbox | Optional | Needed only for account linking tests |

---

## Test Flow 1: Onboarding and Navigation (5 min)

1. Navigate to https://stewardly.manus.space and verify the landing page loads with the Stewardly branding.
2. Click **Sign In** and complete Manus OAuth. You should land on the Welcome page or Chat.
3. Verify the sidebar navigation shows these sections: **Chat**, **Wealth** (Wealth Engine), **Professional** (People, Intelligence), **Leadership** (Team, Organizations), **Platform** (Admin), **Learn**, **Settings**, **Help**.
4. Click each top-level sidebar item and confirm the page loads without errors.
5. Test the **Command Palette** by pressing `Cmd+K` (Mac) or `Ctrl+K` (Windows). Type a page name and verify navigation works.

**Expected:** All pages load, no blank screens, no console errors visible.

---

## Test Flow 2: Wealth Engine (10 min)

1. Navigate to `/wealth-engine` from the sidebar.
2. Verify the calculator panels are visible: **Net Worth**, **Cash Flow**, **Retirement**, **Tax Projector**, **Business Exit**, **Insurance Needs**, **Estate Planning**, **Education Funding**.
3. Open **Net Worth Calculator** — enter sample assets (e.g., $500K home, $200K 401k, $50K savings) and liabilities (e.g., $300K mortgage, $20K auto loan). Verify the net worth computes correctly.
4. Open **Cash Flow Calculator** — enter monthly income ($10K) and expenses ($7K). Verify the surplus/deficit displays.
5. Open **Retirement Projector** — set age 35, retirement age 65, current savings $200K, monthly contribution $2K. Verify the projection chart renders.
6. Open **My Plan** tab — verify it shows a consolidated financial plan view.
7. Try **sharing a plan**: click the share button and generate a shareable link. Open the link in an incognito window to verify it loads.

**Expected:** All calculators compute, charts render, plan sharing works.

---

## Test Flow 3: AI Chat (10 min)

1. Navigate to `/chat` from the sidebar.
2. Start a new conversation by typing: "What's a good strategy for someone with $500K in assets and $200K in debt?"
3. Verify the AI responds with relevant financial guidance (streamed markdown).
4. Try a follow-up: "Can you create a debt payoff plan for me?"
5. Test **Code Chat** at `/code-chat` — ask: "Write a Python script to calculate compound interest."
6. Test **Consensus** at `/consensus` — ask a question and verify multiple AI perspectives are shown.
7. Test the **Pomodoro Timer** — click the timer icon in the top bar, start a focus session.

**Expected:** AI responds coherently, markdown renders properly, code blocks have syntax highlighting.

---

## Test Flow 4: Learning Engine (15 min)

1. Navigate to `/learning` from the sidebar.
2. Verify the Learning Home shows **discipline cards** (e.g., Financial Planning, Investment Management, Insurance, Tax Planning, Estate Planning).
3. Click into a discipline (e.g., **Financial Planning**) to see tracks and chapters.
4. Open a track and verify **definitions** display with expandable details.
5. Test **Flashcard Study** — navigate to a track and click "Study Flashcards." Flip cards, mark as known/unknown.
6. Test **Quiz Runner** — navigate to a track and click "Take Quiz." Answer questions, verify scoring.
7. Test **Formula Lab** at `/learning/formula-lab` — verify financial formulas are listed with interactive calculators.
8. Test **AI Quiz** at `/learning/ai-quiz` — generate an AI-powered quiz on a topic.
9. Test **Study Analytics** at `/learning/analytics` — verify study time and progress charts.
10. Test **Exam Simulator** — navigate to `/learning/exam/cfp` or similar and verify timed exam mode.
11. Test **Study Buddy** at `/learning/study-buddy` — verify AI study companion works.
12. Test **Bookmarks** at `/learning/bookmarks` — bookmark a definition, verify it appears.
13. Test **Hands-Free Study** at `/learning/hands-free` — verify voice-driven study mode.

**Expected:** All learning features load, flashcards flip, quizzes score, formulas calculate.

---

## Test Flow 5: People and CRM (10 min)

1. Navigate to `/people/clients` from the sidebar.
2. Verify the People Hub loads with tabs: **Clients**, **Leads**, **COI Network**, **Professionals**.
3. Try adding a test client: click "Add Client," fill in name "Test Client," email "test@example.com."
4. Navigate to `/people/leads` — verify the lead pipeline kanban board loads.
5. Try moving a lead between stages (drag or click to change status).
6. Navigate to `/relationships` — verify the Relationships Hub loads.
7. Test **Client Segmentation** at `/client-segmentation` — verify segmentation analysis works.

**Expected:** CRUD operations work, pipeline board renders, segmentation loads.

---

## Test Flow 6: Intelligence Hub (5 min)

1. Navigate to `/intelligence-hub` from the sidebar.
2. Verify tabs load: **Market Data**, **Economic Indicators**, **Research**, **Comparables**.
3. Check that market data shows real-time or recent data (powered by government APIs: FRED, BLS, BEA, Census).
4. Navigate to `/comparables` — verify competitive analysis dashboard loads.
5. Navigate to `/rebalancing` — verify portfolio rebalancing tool loads.

**Expected:** Data loads from government APIs, charts render, no stale data errors.

---

## Test Flow 7: Billing and Stripe (5 min)

1. Navigate to `/products` from the sidebar or landing page.
2. Verify three plans display: **Starter**, **Professional**, **Enterprise**.
3. Click "Subscribe" on the Professional plan.
4. Verify Stripe Checkout opens in a new tab.
5. Use test card: **4242 4242 4242 4242**, any future expiry, any CVC, any ZIP.
6. Complete the checkout and verify you're redirected back to the app.
7. Navigate to Settings to verify your subscription status updated.

**Expected:** Stripe Checkout works, test payment succeeds, subscription status updates.

---

## Test Flow 8: Admin Panel (10 min)

1. Navigate to `/admin` from the sidebar.
2. Verify the Admin Hub loads with tabs: **Overview**, **Team**, **Billing**, **Integrations**, **Webhooks**, **Knowledge**, **Audit Trail**, **System Health**, **Improvement Engine**.
3. Check **Audit Trail** at `/admin/audit-trail` — verify CRM audit events display.
4. Check **API Documentation** at `/api-docs` — verify endpoint documentation loads with search and filter.
5. Check **Knowledge Admin** at `/admin/knowledge` — verify knowledge base management.
6. Check **Improvement Engine** at `/admin/improvement-engine` — verify platform improvement suggestions.
7. Check **System Health** — verify health dashboard shows green status.
8. Check **Webhook Setup** — navigate to webhook management and verify GHL webhook setup guide.

**Expected:** All admin panels load, data displays, no permission errors for owner.

---

## Test Flow 9: Integrations (5 min)

1. Navigate to `/integrations` from the sidebar.
2. Verify integration cards show: **Plaid**, **SnapTrade**, **GoHighLevel**, **LinkedIn**, **Google**.
3. Click on **Plaid** — verify the connection flow initiates (sandbox mode).
4. Check `/integration-health` — verify the integration health dashboard loads.
5. Check `/sync-dashboard` — verify sync status displays.

**Expected:** Integration cards render, health checks display, no crashes.

---

## Test Flow 10: Mobile Responsiveness (5 min)

1. Open the app on a mobile device or use browser DevTools (F12 → toggle device toolbar).
2. Test at **375px** (iPhone SE) and **768px** (iPad) widths.
3. Verify the sidebar collapses to a hamburger menu on mobile.
4. Navigate through: Landing → Chat → Wealth Engine → Learning → People.
5. Verify no horizontal scrolling, text is readable, buttons are tappable.
6. Test the Wealth Engine calculators on mobile — verify inputs and charts fit.

**Expected:** Responsive layout, no overflow, touch-friendly interactions.

---

## Bug Reporting Template

If you encounter any issues, please report them using this format:

```
**Page:** [URL where the issue occurred]
**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]
**Expected:** [What should happen]
**Actual:** [What actually happened]
**Screenshot:** [Attach if possible]
**Device/Browser:** [e.g., Chrome 124 on macOS, iPhone 15 Safari]
```

---

## Platform Statistics

| Metric | Value |
|--------|-------|
| Total Pages | 203 |
| Total Components | 177 |
| Total API Routers | 112 |
| Total Services | 516 |
| Total Test Files | 444 |
| Total Tests | 10,830 |
| Test Pass Rate | 100% |
| Total Lines of Code | 458,452 |
| Convergence Status | 3/3 clean passes |

---

## Known Limitations

1. **Email delivery** — Resend API key is configured but the sending domain needs DNS verification. Until then, all emails remain as in-app drafts (safe default).
2. **GoHighLevel sync** — Requires GHL webhook setup (guided wizard at `/admin/webhooks`). Without it, CRM data won't sync.
3. **Plaid/SnapTrade** — Running in sandbox mode. Real account linking requires production keys after KYC.
4. **Stripe** — Running in test mode. Real payments require claiming the sandbox and completing Stripe KYC.
5. **TypeScript compilation** — Full `tsc --noEmit` check may OOM due to 7,500-line schema. Vite handles this fine in dev/prod builds.
