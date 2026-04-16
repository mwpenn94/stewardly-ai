# Stewardly Phase 1 — UI/UX Foundation + Progressive Disclosure + Stability

> **Target repo:** `mwpenn94/stewardly-ai`
> **Phase:** 1 of 8
> **Scope:** UI shell, navigation architecture, progressive disclosure framework, failover/stability patterns, sharing UI components, visual system coherence
> **Prior phases:** None — this is the foundation everything else builds on.
> **Executor:** Manus (or any agentic executor with browser, terminal, and file-system access)
> **Run mode:** Continuous assess → optimize/build → validate → ship until exit criteria met or termination condition fires.

---

## CORE RULES (apply to every pass)

1. **Run continuously.** Assess → optimize/build → validate → ship, repeated. Do not stop after one pass. Do not ask "should I continue?"
2. **Every pass ships observable work.** No planning-only passes. No "I assessed and found nothing."
3. **Self-score honestly.** Generate 5-8 specific, measurable criteria from actual codebase state. Tag must-have/nice-to-have (default must-have). Score 1-10. Work lowest first. Re-score every pass. Exit at all must-have ≥8 for 3 consecutive passes.
4. **Visual evidence.** Every UI-touching pass: screenshots at 390×844 (mobile), 820×1180 (tablet), 1440×900 (desktop). Committed to `artifacts/pass-N/`.
5. **Anti-regression absolute.** No pass breaks anything. Lint, type-check, build, test every pass.
6. **Act as a real user.** Virtual-user walkthrough every pass. Click through flows, try edge cases, use mobile viewport. Playwright when available.
7. **Commit messages:** `pass-[N] · phase-1 · [description]`
8. **Credentials:** env vars + mocks. Never hardcode, never commit `.env`.
9. **Test bootstrapping:** every pass that ships logic ships at least one test. Lint + type-check + build always.
10. **Build-from-zero:** score 1-3 = construct, not polish. MVP in as many passes as needed. Don't defer must-haves.
11. **Prompt amendments:** log gaps to `docs/PROMPT_AMENDMENTS.md`, don't stop.

**Termination conditions:** (1) User stop. (2) Platform hard limit → emit `HANDOFF.md`. (3) Merge-gate block → emit `BLOCKED_ON.md`. (4) 1-hour active-attempt stall with ≥6 novel approaches attempted → emit `STALLED.md`.

---

## WHAT PHASE 1 BUILDS

Phase 1 builds the **app shell** — the container that Phases 2-7 fill with content. If this shell is broken, inconsistent, or ugly, every subsequent phase inherits those problems. Phase 1's job is to make the shell stable, delightful, and architecturally correct so later phases can focus on their content without fighting the UI.

---

## KNOWN EXECUTION FAILURES FROM PRIOR MANUS RUNS

These failures have occurred in multiple prior runs. They are the highest-priority items to prevent. If any of these are present in the current codebase, fix them before doing anything else.

### ❌ FAILURE 1: Stock ticker at the top of the app
A highly distracting, useless stock/market data ticker was added to the top of the app in prior runs. **Remove it immediately if present.** If market data is desired, it belongs deep inside a wealth engine surface (Phase 3), not as a persistent top-of-app banner. No persistent tickers, marquees, or scrolling data displays in the app shell.

### ❌ FAILURE 2: Client Profile placed inside Practice Management
In prior runs, Client Profile was consistently placed under Practice Management in the wealth engine's internal nav. **Client Profile belongs under Client Planning.** Practice Management = advisor's business operations. Client Planning = advisor's clients. The wealth engine's page-internal nav has 4 sections: Practice Management / Client Planning / Advanced Strategies / References. Client Profile goes in Client Planning.

### ❌ FAILURE 3: Admin pages disappeared
After navigation changes in prior runs, admin pages (user management, org settings, compliance settings, feature permissions, audit log) disappeared and became inaccessible. **Admin pages must be present at all times for admin-role users.** After every pass that touches navigation, log in as an admin and verify all admin pages are reachable.

### ❌ FAILURE 4: Inconsistent progressive disclosure across sidebar sections
In prior runs, only the Client nav section was collapsible while all other sidebar sections were static. **ALL sidebar sections must have identical expand/collapse behavior.** If one section collapses, all sections collapse. No exceptions. Test by clicking expand/collapse on every sidebar section and verifying they all behave the same way.

### ❌ FAILURE 5: Inconsistent nav nesting patterns
The wealth engine consolidated multiple features within a page-internal nav (tab bar or sub-nav within the content area). Other sections (learning, AI, command center, settings) used different nesting patterns — some deeply nested in the sidebar, some flat, some mixed. **ALL sections must follow the same pattern:** sidebar has top-level section entries; clicking a section reveals its page-internal nav for sub-items, the same way the wealth engine does.

### ❌ FAILURE 6: Settings nav inaccessible for all items
Settings had an internal nav that was not scrollable or accessible for all items, especially on mobile. **Settings must use the same page-internal nav pattern as the wealth engine** — clean tab bar or scrollable sub-nav with ALL items reachable. Test by navigating to every settings item on mobile (390×844).

---

## NAVIGATION ARCHITECTURE (the correct architecture)

The app has a **two-level navigation system:**

**Level 1 — App-shell sidebar (app-wide):**
The sidebar contains top-level section entries. These are the major areas of the app:
- **Wealth Engine** — the core financial planning/practice management tool
- **Learning** — training, onboarding, modules, workflows (Phase 2)
- **AI** — the unified AI surface with Chat/Code/Agent modes (Phase 4)
- **Command Center** — CRM, campaigns, recruiting, outreach (Phase 5)
- **Settings** — user preferences, account, integrations configuration
- **Admin** — user management, org settings, compliance, permissions, audit log (visible only to admin-role users)

Each sidebar entry is a **section**, not a deep tree. Clicking a section navigates to that section's page. The sidebar does NOT contain sub-items for individual features within a section — that's what page-internal nav does.

**Level 2 — Page-internal nav (within each section):**
When the user clicks into a section (e.g., Wealth Engine), that section's page has its own internal navigation. For the wealth engine, this is the 4-section structure from the HTML reference:
- **Practice Management** — production planning, recruiting, team economics, P&L, override cascade
- **Client Planning** — client profile, financial plans, retirement, tax, protection, estate, governance
- **Advanced Strategies** — premium financing, ILIT, exec comp, charitable planning
- **References** — due diligence summaries, citations, market data reference

Other sections should similarly use page-internal nav for their sub-items:
- **Learning:** page-internal nav for: Modules by Domain, Quiz Engine, Flashcards, My Progress, Workflows
- **AI:** page-internal nav is the mode indicator (Chat / Code / Agent) — progressive disclosure controls which modes are visible
- **Command Center:** page-internal nav for: Contacts, Campaigns, Events, Pipeline, Recruiting/Workable, Analytics
- **Settings:** page-internal nav for: Profile, Preferences, Integrations, Notifications, Appearance, Data Export
- **Admin:** page-internal nav for: Users, Roles & Permissions, Org Settings, Compliance, Audit Log, Feature Toggles

**The key principle:** sidebar is shallow (6-8 top-level entries); page-internal nav goes deep (5-10 sub-items per section). This keeps the sidebar clean and scannable while giving each section room for rich sub-navigation.

**Progressive disclosure applies to BOTH levels:**
- At Level 1 (sidebar), an advisor who hasn't been granted Command Center access (per Rule 15 feature permissions) doesn't see "Command Center" in the sidebar at all.
- At Level 2 (page-internal), a new advisor at progressive disclosure Level 1 sees only basic sub-items within each section. A power-user MD at Level 3 sees everything.

---

## PROGRESSIVE DISCLOSURE FRAMEWORK (the central UX principle)

Progressive disclosure is not a feature — it is the organizing principle of the entire app. Every surface, every nav item, every feature follows this pattern:

**4 levels, consistently applied across ALL surfaces:**

| Level | What's visible | Who defaults here | How to change |
|---|---|---|---|
| 1 — Simple | Core features, 80% of use cases. Clean, minimal, no advanced options. | New advisors, clients on shared links | User can request upgrade; manager approves |
| 2 — Standard | Level 1 + configuration options, multi-step workflows, deeper inputs | Advisors after onboarding completion | User toggles in settings; manager can set ceiling |
| 3 — Advanced | Level 2 + power-user features, full configuration, batch operations, AI agent mode | MDs, team leads, experienced advisors | User toggles; some features may require manager approval |
| 4 — Full | Everything — multi-agent orchestration, scheduled tasks, webhook triggers, developer tools | Platform admins, explicitly authorized power users | Requires explicit manager authorization |

**Implementation requirements:**
- Global level setting (user preference, defaults per role, ceiling set by hierarchy manager per Rule 15)
- Per-surface level override (user can be Level 2 globally but Level 3 on the wealth engine)
- Every UI component checks the user's effective level before rendering
- Level transitions are smooth — no jarring layout shifts when switching levels
- The level indicator is visible in the UI (small badge or indicator) so the user knows what level they're at
- "Show more" / "Show less" affordances are available inline for surfaces that have disclosure-eligible content

**How to verify consistency:**
After every pass, switch between Level 1 and Level 3 on at minimum 3 different surfaces. Verify:
- Level 1 hides the same category of features across all surfaces (advanced config, batch operations, AI agent mode)
- Level 3 reveals the same category of features across all surfaces
- The visual pattern of disclosure (how features appear/disappear) is the same across surfaces — not animated in one place and instant in another

---

## FAILOVER AND STABILITY PATTERNS

Phase 1 establishes reusable failover components that Phases 2-7 consume. For every external dependency the app has or will have:

**The 3-state pattern (build as reusable components):**

| State | What the user sees | Technical behavior |
|---|---|---|
| **Connected** | Green indicator, full functionality | Normal operation |
| **Degraded** | Amber indicator, "Using cached data from [time]" | Cached/fallback data, reduced functionality clearly labeled |
| **Unavailable** | Red indicator, "Service unavailable — [what still works]" | Graceful failure, no crash, user told what they CAN do |

**Known dependencies to build failover for (even if the service isn't integrated yet — the UI pattern must exist):**
- LLM API (Claude, OpenAI) — affects AI surface (Phase 4)
- GHL API — affects command center (Phase 5)
- Plaid — affects integrations (Phase 6)
- Dripify / LinkedIn API — affects command center (Phase 5)
- SMS-iT — affects command center (Phase 5)
- Workable API — affects command center (Phase 5)
- External data sources (FRED, EDGAR, etc.) — affects wealth engine defaults (Phase 3)

**Build these as React components (or equivalent) that any surface can import:**
- `<ConnectionStatus service="llm" />` — renders the indicator
- `<DegradedBanner service="llm" fallbackDescription="AI features limited to cached responses" />`
- `useServiceStatus('llm')` — hook that returns current status, last successful connection, cached data age

---

## SHARING UI COMPONENTS (Rule 15 — build once, use everywhere)

Phase 1 builds the sharing/permission UI kit that all subsequent phases consume. These components must be built, styled, and tested in Phase 1 even if no shareable content exists yet.

**Components to build:**
- **ShareButton** — consistent placement, consistent icon, appears on every shareable item
- **RecipientPicker** — search/select users, roles, teams, hierarchy levels. Supports individual and bulk selection.
- **PermissionSelector** — view / comment / edit / admin levels per recipient
- **OmissionToggle** — explicitly exclude specific items from bulk shares
- **SharingStatusIndicator** — shows who has access, at what level, when shared. Appears on every shared item.
- **FeaturePermissionManager** — admin UI for toggling features per user/role (used in Admin section)
- **DisclosureLevelManager** — admin UI for setting per-user progressive disclosure levels and ceilings

**These must be consistent:** same visual treatment, same interaction pattern, same placement conventions across every surface that uses them. Define and document the conventions in Phase 1.

---

## SCORE CRITERIA (generate 5-8 from actual state, these are starting suggestions)

- **Navigation coherence:** can a new user find every major feature within 3 clicks from root? Are all 6 sidebar sections present? Does page-internal nav work for every section?
- **Mobile stability:** does every route render at 390×844 without horizontal scroll, broken layouts, or unreachable controls?
- **Progressive disclosure consistency:** do ALL surfaces follow the same 4-level pattern? Is behavior uniform — not just some surfaces?
- **Visual system coherence:** consistent spacing, typography, color, card structure, interaction patterns across all surfaces?
- **Loading/error/empty states:** every async operation shows loading? Errors show user-friendly messages? Empty states guide the user?
- **Failover components built:** are the 3-state failover components (Connected/Degraded/Unavailable) built, styled, and reusable? Do they render correctly with mock data?
- **Sharing UI kit built:** are all 7 sharing components built, styled, and testable? Do they follow a consistent pattern?
- **Admin pages accessible:** can an admin-role user reach every admin page (Users, Roles, Org Settings, Compliance, Audit Log, Feature Toggles)?
- **Sidebar consistency:** do ALL sidebar sections expand/collapse identically? No section behaves differently from the others?
- **Settings fully accessible:** can every settings item be reached on mobile (390×844)?
- **No stock ticker:** is the top of the app clean (no ticker, no marquee, no scrolling banner)?

---

## PASS STRUCTURE

```
## Pass N · Phase 1 · Criterion: [lowest-scoring] · Score before: X/10

--- ASSESS ---
1. Pull latest. Read current scores.
2. Re-examine all criteria. Identify lowest must-have.
3. Branch: 1-3 (absent) → build-from-zero. 4-7 (rough) → worst sub-feature fix. 8-9 → push toward next tier.

--- OPTIMIZE / BUILD ---
4. Plan (1-3 sentences).
5. Implement. Ship observable work.
6. Run tests (lint, type-check, build, test suite).

--- VALIDATE ---
7. Screenshots at 3 viewports.
8. Virtual-user walkthrough. Confirm improvement from user perspective.
9. Check for known failures: stock ticker present? Client Profile in wrong section? Admin pages missing? Sidebar inconsistent? Settings inaccessible?
10. If regression: fix NOW before commit.

--- SHIP ---
11. Commit: `pass-[N] · phase-1 · [description]`
12. Re-score all criteria with user-observable evidence.
13. If all must-have ≥8 × 3 consecutive: emit PHASE_1_EXIT.md, stop.
```

---

## EXIT CRITERIA

All of the following must be true for 3 consecutive passes:

- [ ] All must-have criteria ≥8
- [ ] Fresh virtual-user walkthrough (cold start, mobile viewport) navigates every major feature without confusion
- [ ] No stock ticker or distracting banner at the top of the app
- [ ] Client Profile is under Client Planning in wealth engine's page-internal nav (not Practice Management)
- [ ] Admin pages accessible to admin-role users (test by logging in as admin)
- [ ] ALL sidebar sections have identical expand/collapse behavior
- [ ] Settings nav fully accessible on mobile (390×844) — every item reachable
- [ ] Progressive disclosure levels (at minimum 1 and 3) demonstrated on ≥3 different surfaces with consistent behavior
- [ ] Failover components (Connected/Degraded/Unavailable) demonstrated on ≥3 mock external dependencies
- [ ] Sharing UI kit (ShareButton, RecipientPicker, PermissionSelector, OmissionToggle, SharingStatusIndicator) built and styled consistently

**Emit `PHASE_1_EXIT.md`** with: all criteria scores, evidence references (screenshots), known risks for Phase 2, recommended first-action for Phase 2.

---

Begin. Pull `mwpenn94/stewardly-ai`. Assess the current UI/UX state. Generate criteria. Score. Fix the lowest-scoring criterion. Ship. Continue.
