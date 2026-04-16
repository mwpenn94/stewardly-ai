# Stewardly Continuous Build Loop — Execution Engine (paste-ready)

> **Target repo:** `mwpenn94/stewardly-ai`
> **Additional repos to inherit:** `mwpenn94/emba_modules` (learning), `mwpenn94/stewardly-command-center` (CRM/marketing command layer)
> **Executor:** Manus (or any agentic executor with browser, terminal, and file-system access)
> **Purpose:** Continuous, autonomous optimization across 8 phases in strict sequence. Runs until user returns with stop signal. Designed for extended AFK execution — every rule and phase specification is exhaustively detailed so the executor can resolve ambiguity without human input.
> **Reference docs (all in repo at `docs/reference/` or delivered alongside):**
> - `WealthBridge-Business-Calculator-v7.6.html` — wealth engine structural + content floor
> - `HTML_STRUCTURAL_INVENTORY_STARTER.md` — ~40 structural categories to extend exhaustively
> - `ADVISORY_TAXONOMY_v2_AND_ENGINE_MAP.md` — ~90 approaches, 14 categories, P0/P1/P2
> - `ADVISORY_OPERATING_SYSTEM_AXES.md` — 5-axis closure framework (Return/Risk/Behavior/Governance/Purpose)
> - `AI_CAPABILITY_MATURITY_MODEL.md` — 5 maturity levels (retrospect → automated)
> - `FINANCIAL_DATA_TOOLS_TIERED.md` — cost-tiered sourcing reference (🟢/🟡/🔴)
> - `MANUS_PROMPT_COMMAND_CENTER.md` — command center integration spec (GHL/Dripify/LinkedIn/SMS-iT)
> - `WealthBridgeLibraryv11_QA.zip` — compressed learning library (81 files, see Phase 2 for full inventory)
> - Strategy taxonomy + leader persona archetypes (12 categories × 10 archetypes — see Phase 2 + Phase 3 for integration points)
> - `mwpenn94/stewardly-command-center` — CRM/marketing command center repo
> - **Marketing/outreach asset library (6 zips delivered alongside, see Phase 5 for full inventory):**
>   - `WealthBridge_180_Drip_Campaign_Emails__3_.zip` — 180 HTML drip emails segmented by audience (residential, commercial, etc.) with A/B/R sequences each
>   - `WealthBridge_Final_Package__1_.zip` — production-ready scripts (Call, SMS), playbooks, GHL implementation specs, Dripify templates, LinkedIn deploy-now content, FB/IG deploy-now content, engagement guides, optimization phase docs
>   - `WealthBridge_Final_Deliverables_v4__4_.zip` — CRM-ready spreadsheets (Prospect/Candidate/Combined Pipeline/Engagement/Event Schedule databases), inbound assessments by region (AZ/NM/R1-R7), outbound prospect kits by region. **Live Google Sheets versions also exist** (Combined Pipeline, Engagement Database, Event Schedule, Executive Summary at minimum) with auto-updating formulas — use these as bidirectional-sync sources per Phase 5 guidance, not just one-time xlsx imports. The live sheets are the source of truth for lifecycle stage definitions, segment canonical names/counts, tier/region taxonomy, and cross-file reference architecture.
>   - `WealthBridge_v5_1_CTA_Enhanced.zip` + `WealthBridge_v3_Final.zip` — visual assets: 6 LinkedIn carousel PDFs, 3 featured graphics, event materials (pullup banner/table tent/business card), 24 monthly social graphics (LinkedIn + FB/IG × 12 months)
>   - `07_SMS_Scripts.zip` — SMS campaigns, outbound call scripts, campaign playbook, content calendar, master content strategy, digital ads (Google/LinkedIn/Meta/YouTube), webinar outlines, roundtable guides, community event playbooks, year-long social content (LinkedIn + FB/IG)

---

## CORE RULES

1. **Run continuously.** Do not stop after one pass. Do not ask "should I continue?" Do not summarize and wait. The loop is a continuous recursive cycle of **assess → optimize/build → validate → ship**, repeated indefinitely until the user returns or the 1-hour stall condition fires. The loop's natural state is running. Stopping is the exception. Every pass through the cycle makes the product measurably better — there is no "maintenance mode" or "done for now." If everything scores 10, refresh competitive benchmarks, promote deferred capabilities, scan for emerging opportunities, harden stability, deepen test coverage.

2. **Phase-ordered execution.** Eight phases in strict sequence. Each phase runs until its exit criteria are met, then the next begins. No skipping. No rotation. The ordering is intentional — later phases depend on earlier phases being stable.

3. **Every pass ships observable work.** Every iteration produces at minimum one user-visible change committed to the repo. No planning-only passes. No documentation-only passes (except Phase 8). No "I assessed and found nothing to do" passes.

4. **Self-score honestly.** On entering each phase, generate 5-8 specific, measurable criteria from the actual codebase state (not from imagination). Tag each as **must-have** or **nice-to-have** per Rule 14(f) — default is must-have. Score each 1-10. Work the lowest-scoring criteria first. Re-score after each pass. Phase exit requires all **must-have** criteria ≥8 for 3 consecutive passes; nice-to-have criteria are tracked but don't block exit. Throughout the rest of this prompt, "all criteria ≥8" means "all must-have criteria ≥8" unless explicitly stated otherwise.

5. **Visual evidence.** Every UI-touching pass produces screenshots at 390×844 (mobile), 820×1180 (tablet), 1440×900 (desktop). Screenshots committed to `artifacts/pass-N/`.

6. **Anti-regression absolute.** No pass may break anything that was working before. If it does, fix before commit. Run tests. Lint. Type-check. Build. Every pass.

7. **Act as a real user.** On every pass, use the deployed preview (or local dev server) as a real user would. Click through flows. Try edge cases. Use on mobile viewport. The virtual-user walkthrough is not optional — it's how regressions and gaps surface. **When Playwright infrastructure exists (built in Phase 4 or earlier if feasible), automated virtual-user walkthroughs replace manual spot-checks.** The agent or the CI pipeline runs Playwright scripts that navigate core flows at all 3 viewports and report pass/fail with screenshots. Manual walkthroughs are the fallback when Playwright isn't yet set up.

8. **Commit messages are structured:** `pass-[N] · phase-[1-8] · [one-line description of shipped change]`

9. **Cross-phase regression checks.** Every 5th pass (regardless of current phase), re-run a lightweight validation of all completed phases: load each completed phase's last-scored criteria, spot-check the 2 lowest-scored criteria from that phase against current state. If any dropped below 8, pause current phase, re-enter the regressed phase, fix, then resume. Log regression to `artifacts/regression-log.md`.

10. **Phase handoff protocol.** When a phase exits, the executor commits a `PHASE_[N]_EXIT.md` file to `artifacts/` containing: final criteria scores with evidence references, known risks for future phases, and recommended first-action for the next phase. The next phase reads this file on entry before generating its own criteria.

11. **Prompt self-amendment logging.** If the executor discovers the prompt has a gap, ambiguity, or incorrect assumption, log it to `docs/PROMPT_AMENDMENTS.md` with: what's wrong, proposed fix, which pass discovered it. Do NOT stop — continue executing with the best interpretation. User reviews on return.

12. **Credentials and secrets.** Protocol: (a) check repo for `.env.example` or similar; (b) implement with environment-variable placeholders; (c) use mock/stub implementations for development; (d) log to `BLOCKED_ON.md` only if mock path is genuinely infeasible; (e) never hardcode credentials, never commit `.env`. Architecture and UI proceed with mocks; live validation deferred to when credentials are available.

13. **Test suite bootstrapping and growth.** "Run full test suite" means: (a) if tests exist, run them; (b) if zero tests exist, the first pass that touches testable logic adds at minimum one test; (c) test count grows monotonically; (d) lint + type-check + build always applies. **Test types expected per phase:**
   - **Phase 1:** Playwright E2E smoke tests for core navigation (sidebar click → panel renders at 3 viewports), progressive disclosure toggle (level switch changes visible content), and failover display (mock a service failure → verify degraded-mode UI renders). These are the foundation — every subsequent phase's tests build on them.
   - **Phase 2:** Unit tests for CRUD operations on learning modules/workflows. Playwright E2E for: module navigation, quiz engine scoring, flashcard interaction, workflow step completion, progress tracking update, and hierarchy-based workflow assignment (assign workflow as MD → verify it appears for the target advisor).
   - **Phase 3:** Unit tests for every calculation (given identical inputs, output matches HTML reference). Playwright E2E for: engine surface navigation, input entry → output render → save → reload → verify persistence, AUM override cascade (change a rate → verify downstream recalculation), multi-channel rollup (add a channel → verify totals update), and tier-0 instant view (<200ms load verified programmatically).
   - **Phase 4:** Unit tests for task queue, artifact storage, mock LLM response handling. Playwright E2E for: Mode 1 chat (send message → verify streaming response renders), Mode 2 code (enter code prompt → verify diff/output renders), Mode 3 agent (submit task → verify plan display → verify progress streaming → verify artifact delivery), and mode switching (start in chat → switch to agent → verify context preserved). Async test: submit agent task → navigate away → return → verify completed deliverable.
   - **Phase 5:** Unit tests for multitenancy data isolation (query as tenant A → verify no tenant B data), dynamic segment evaluation (compound condition correctness), bidirectional sync idempotency (same event 2x → 1 update). Playwright E2E for: contact CRUD, campaign creation → scheduling → status display, layered dashboard (login as MD → verify regional rollup; login as advisor → verify only own data), LinkedIn profile edit round-trip, Workable job posting → candidate sync → pipeline advancement → hire trigger Phase 2 onboarding, custom segment creation → use in campaign → share per Rule 15.
   - **Phase 6:** Integration tests for each P0 connector (mock API → verify normalized pipeline output). Playwright E2E for: integration status display (connected/disconnected/cached indicators), data refresh trigger → verify surface updates.
   - **Phase 7:** Cross-surface Playwright E2E only — the integration flows that validate the app works as a unified product, not individual surfaces.
   - **Phase 8:** The comprehensive suite described in Phase 8 specification below.
   
   **Playwright is the primary E2E tool.** Install and configure Playwright with Chromium + Firefox + WebKit. Run E2E tests at 390×844, 820×1180, and 1440×900 viewports. Every E2E test captures before/after screenshots committed to `artifacts/tests/`. If Playwright cannot be installed (environment limitation), fall back to Puppeteer or Cypress — log the deviation to `PROMPT_AMENDMENTS.md`.

14. **Build-from-zero protocol for absent capabilities.** When a criterion scores 1-3 (absent or non-functional), the work pattern is construction, not polish:
   - **(a)** Define the minimum viable functional version (2-3 sentences).
   - **(b)** Identify and resolve architectural prerequisites (DB tables, routes, libs, env vars).
   - **(c)** Build and ship the MVP in as many passes as it actually takes. Each pass ships an observable component. **The MVP is not "done" until a real user can use the capability end-to-end for its primary purpose.**
   - **(d)** Re-score after MVP exists. Standard improve-existing pattern applies from here.
   - **(e)** Don't defer absent must-have capabilities to "later." A phase cannot exit with a must-have at 1-3.
   - **(f) Must-have definition.** Default is must-have. A criterion is nice-to-have only if the phase can exit without it AND user value is meaningfully delivered without it. Criteria listed in this prompt's "score criteria" sections are all must-have unless the executor has documented reason. The tag is fixed at phase entry — no mid-phase downgrades.
   
   **This is the most important rule for new builds.** The prompt's assess-and-improve pattern can over-polish what exists while ignoring what's missing. If a phase has any must-have at 1-3, the next pass builds that capability, not polishes something else.

15. **User & platform management architecture (cross-cutting).** Every phase must account for a hierarchical user management system with granular sharing and permissions. This is not a single-phase feature — it is architectural infrastructure that every surface consumes.

   **Organizational hierarchy layers:**
   - **Platform admin** — manages the platform itself (tenants, global settings, system health).
   - **Organization admin** — manages one organization/BD (org settings, compliance, global templates).
   - **Regional VP / Managing Director** — manages a region or division (team oversight, production rollups, campaign management, workflow assignment).
   - **Team lead** — manages a team (direct reports, team production, onboarding workflows).
   - **Individual advisor** — manages their own practice (clients, plans, production, learning).
   - **Client (view-only / limited)** — views shared items (plans, reports, shared links).

   **Cascading visibility:** each layer sees their own data + aggregated view of all layers below them in their hierarchy subtree. An MD sees every advisor in their region. A team lead sees their direct reports. An advisor sees only their own data. Data never flows upward without explicit sharing — an advisor's private notes are not visible to their MD unless shared.

   **Granular sharing and omission:**
   - **Per-item sharing:** any shareable item (calculator plan, AI conversation, learning module, workflow, campaign, document, client report) can be shared with specific individuals, specific roles, specific hierarchy levels, or specific teams. Sharing is additive — sharing with "my team" doesn't share with other teams.
   - **Bulk sharing:** a user can select multiple items and share them all at once with a selection of recipients.
   - **Omission / redaction:** a user can explicitly omit items from sharing, even if a bulk-share rule would otherwise include them. Example: an MD shares all their campaign templates with their region, but omits 2 specific templates that are not ready for distribution.
   - **Permission levels per share:** view (read-only), comment (can annotate but not modify), edit (can modify), admin (can re-share and manage access).
   - **Share inheritance vs override:** when a parent item is shared (e.g., a workflow), child items (steps, documents within the workflow) inherit the share setting. A user can override inheritance at any child level (e.g., share the workflow but omit step 3 from a specific recipient).
   - **Share visibility:** every item shows its sharing status — who has access, at what permission level, when it was shared. The owner can revoke or modify sharing at any time.

   **Feature-level access control (views, features, aspects, permissions within the app):**
   Sharing extends beyond content items to the app's capabilities themselves. A hierarchy manager can control which features, views, and functional aspects are available to users in their subtree.
   
   - **Feature toggling per user/role/layer:** an org admin or MD can enable or disable specific app features for specific users, roles, or layers. Examples: "New hires see only Learning + basic Client Planning for their first 90 days — Advanced Strategies, Agent mode, and Command Center are hidden until they complete onboarding." "Compliance-restricted advisors cannot access Premium Financing surfaces until compliance approval is logged." "Client-facing shared links show only the specific plan shared, not the full app."
   - **View sharing:** a user can save a specific view configuration (dashboard layout, calculator with pre-filled inputs, filtered report, custom chart) and share it with others. The recipient sees exactly that view — not a generic surface they have to re-configure. Examples: an MD shares a "Regional Production Dashboard" view with their team leads. An advisor shares a pre-configured "Retirement Readiness Review" calculator view with a client.
   - **Aspect control:** within a feature, specific aspects can be shown or hidden per user/role. Examples: the wealth engine's P&L surface is visible to team leads and above but hidden from individual advisors who don't need it. The AUM upline override cascade view is visible to MDs but simplified for individual advisors (they see their own payout, not the full hierarchy economics). The AI Agent's compliance-sensitive task templates are visible only to users with compliance clearance.
   - **Progressive disclosure level as a permission.** The global progressive disclosure levels (Level 1-4) can be set per user by their hierarchy manager, not just by the user themselves. An MD can set a new hire's default to Level 1 (simple) and unlock Level 2-3 as they demonstrate proficiency. Level 4 (full AI orchestration) can require explicit manager authorization. Users can always request a level upgrade; managers approve or deny.
   - **Feature permission inheritance:** when a new user is added to a team, they inherit the team's default feature permissions. The team lead or MD can then customize per-user. Customizations override the team default for that specific user.
   - **Audit trail for permission changes:** every feature enable/disable, view share, aspect toggle, and progressive-disclosure-level change is logged with: who changed it, when, what changed, and why (optional reason field). This is compliance-relevant — an org admin can audit "who gave this advisor access to Premium Financing, and when?"

   **Workflow assignment (hierarchy-driven):**
   - Any layer can create a workflow and assign it to users in their subtree (e.g., MD assigns onboarding workflow to a new advisor hire).
   - Workflows can also be proposed/invited (soft assignment — recipient can accept or decline) vs. required (hard assignment — appears in their task list, completion tracked).
   - Completion status rolls up: a team lead sees which of their reports have completed assigned workflows; an MD sees team-level completion rates.

   **Implementation requirements:**
   - Every database model that stores user-generated content needs: `owner_id`, `org_id`, `team_id`, `visibility` (private/team/org/public), plus a `shares` relation (many-to-many with users/roles/teams + permission level).
   - Every API route that returns user content must filter by the requesting user's access scope.
   - Every UI surface that displays content must show sharing indicators and respect access controls.
   - The sharing UI should be consistent across all surfaces — same "Share" button, same recipient picker, same permission selector, same omission toggle. Not re-invented per surface.
   - **Feature-level access control data model:** a `feature_permissions` table mapping (user_id or role or layer) → (feature_id) → (enabled/disabled). Plus a `user_disclosure_level` field (1-4) settable by the user's hierarchy manager AND by the user themselves (within the ceiling set by the manager). A `view_shares` table mapping saved view configurations to share recipients. A `permission_audit_log` capturing every change with actor, timestamp, what changed, and optional reason.
   - **Navigation and AI must respect feature permissions.** If a feature is disabled for a user, it must not appear in sidebar navigation, must not be suggested by AI (Phase 4) recommendations, must not be included in learning path recommendations (Phase 2), and must not be accessible via direct URL. This is enforced at the API layer (return 403), not just the UI layer (hiding a button).
   - **Phase 1** establishes the sharing UI components, feature permission infrastructure, and patterns.
   - **Phase 2** applies sharing to learning modules, workflows, onboarding content. Applies feature access to which learning content is visible based on user's enabled features.
   - **Phase 3** applies sharing to calculator plans, scenarios, client reports, practice management models, due diligence summaries. Applies feature access to which engine domains/surfaces are visible.
   - **Phase 4** applies sharing to AI conversations, agent task results, generated artifacts. AI respects feature permissions in recommendations and tool use.
   - **Phase 5** applies sharing to campaigns, contact lists, CRM templates. Applies feature access to which command center capabilities are available per role.
   - **Phase 6** applies sharing to integration configurations and data pipeline outputs.
   - **Phase 7** validates cross-surface sharing AND feature-access coherence.
   - **Phase 8** documents content sharing, feature access control, view sharing, permission audit, and new-hire permission management in the user guide.

---

## TERMINATION CONDITIONS

Stop if and only if:

1. **User stop signal** — user says `stop`, `halt`, `pause`, `end`, or returns with any directive. This is the primary expected termination. The loop runs until the user returns.
2. **Platform hard limit** — context exhaustion. Emit `HANDOFF.md` with: current phase, pass number, all criteria scores, specific next action, and a paste-ready continuation prompt for a new executor instance to resume exactly where this one left off. The new instance picks up where this one stopped — continuity is preserved.
3. **Merge-gate block** — tests failing + can't fix within current context. Emit `BLOCKED_ON.md`. If the block is resolvable by a different approach, try that approach before declaring blocked.
4. **1-hour active-attempt stall** — it has been ≥1 hour since the last shipped change (last commit that produced a user-observable improvement) AND during that entire hour the executor has been **actively attempting** fresh, novel, deep, comprehensive approaches to improve the product — not just assessing and declaring nothing actionable, but actually building, testing, and validating improvement attempts. The hour must be filled with genuine work, not idle scanning.

   **What the hour looks like (mandatory active work, not passive assessment):**
   - The executor continues running full assess → optimize/build → validate → ship passes throughout the hour.
   - Each pass attempts a **fresh novel approach** — not repeating the same fix that didn't work, but trying fundamentally different angles: a different architectural pattern, a different UX approach, a different optimization technique, a different competitive benchmark to chase, a different persona's perspective, a different surface to cross-integrate.
   - "Deep and comprehensive" means: don't skim surfaces looking for quick wins. Go deep on one area — rebuild a component, redesign an interaction flow, rearchitect a data pipeline, rewrite a test suite, re-benchmark against a competitor's latest release.
   - If a pass produces an improvement (criterion score goes up without regression), the 1-hour clock resets — the stall condition is not approaching.
   - If a pass attempts an improvement but it doesn't actually improve the score OR it causes a regression that must be reverted, the pass still counts as active work and the clock keeps running (not reset, but the executor is working, not idle).
   - The executor should try at minimum **6 distinct novel approaches** during the hour (roughly one every 10 minutes). Each must be a different angle, not variations on the same theme.

   **Only after ≥1 hour of continuous active attempts, all of which failed to ship a score-improving change, does the stall trigger.** Before emitting `STALLED.md`, the executor must also confirm:
   - (a) Full Playwright E2E suite run, zero failures (the product is stable, not broken).
   - (b) Competitive benchmark refresh completed (no new gaps surfaced from current competitor versions).
   - (c) P1/P2 queue scanned for promotable items (no deferred capabilities worth advancing).
   - (d) `PROMPT_AMENDMENTS.md` reviewed (no logged issues that could be addressed).
   - (e) All 6+ attempted approaches are documented in `STALLED.md` with: what was tried, why it didn't improve the score, and what would need to change externally for it to become viable.

   Emit `STALLED.md` with: timestamp of last successful change, full criteria scores, all attempted approaches with outcomes, and what external input would unblock further progress. **The user may return, review `STALLED.md`, and provide direction that unblocks.**

**Convergence milestones (CONVERGED_FLOOR at ≥8, CONVERGED_EXCELLENT at ≥9, CONVERGED_BEST_IN_CLASS at ≥10, CONVERGED_P1_PROMOTED) are milestones logged to the repo, not termination signals.** The loop continues through all of them. Reaching ≥10 on every criterion does not stop the loop — the loop continues with competitive refresh, P2 promotion, and landscape scanning.

**Completing a pass is never a stop condition.** After every commit, immediately begin the next pass. The loop's default state is running. Stopping is the exception, not the norm.

---

## THE EIGHT PHASES

### Phase 1 — UI/UX Foundation + Progressive Disclosure + Stability
*Stability, delightfulness, flexibility, simplicity, progressive disclosure, holistic cohesion, failover resilience*

**Why first:** Everything built in Phases 2-7 lives inside the UI shell. A broken, inconsistent, or unstable shell undermines every feature. Stabilize the container before filling it.

**On entry, assess and score (generate 5-8 from actual state):**
- Navigation coherence: can a new user find every major feature within 3 clicks from root?
- Mobile stability: does every route render correctly at 390×844 without horizontal scroll, broken layouts, or unreachable controls?
- Progressive disclosure consistency: do all surfaces follow the same pattern (simple default → configure deeper → advanced → AI-powered)? Is the pattern uniform across the entire app — not just some surfaces?
- Visual system coherence: consistent spacing, typography hierarchy, color usage, card structure, interaction patterns across all surfaces?
- Loading/error/empty states: does every async operation show loading? Do errors surface user-friendly messages? Do empty states guide the user (not blank screens)?
- Delightful micro-interactions: smooth transitions, responsive feedback, pleasant animations that don't slow the experience?
- Accessibility baseline: keyboard navigation, focus states, ARIA labels, contrast ratios passing WCAG AA?
- Performance + failover baseline: first meaningful paint <2s on 3G? No layout shifts? Do external-service failures (LLM timeout, integration error, API rate limit) degrade gracefully with user-visible fallback rather than crash? Are fallback/workaround paths built for every external dependency?
- User management + sharing UI patterns: are the reusable components for sharing (share button, recipient picker, permission selector, omission toggle, sharing status indicator) built as a consistent kit that all phases consume? Does the hierarchy-scoped data filtering work correctly (each user sees only what they should)?

**Phase 1 specific guidance:**
- The visual system should feel intentional and cohesive — professional, warm, confident. Information-dense but not overwhelming, with clear hierarchy and generous breathing room.
- **Progressive disclosure is the central UX principle for the entire app.** Every surface — wealth engine, AI chat, learning modules, command center — follows the same disclosure pattern: (Level 1) simple default for 80% of use cases, (Level 2) configure deeper, (Level 3) advanced/power-user, (Level 4) AI-powered automation. The user controls which level they operate at globally (via settings) and per-surface (via inline toggles). A user who wants simplicity sees only Level 1; a power user who wants everything sees all levels. This framework applies consistently across ALL phases — it's not re-invented per phase.

**KNOWN EXECUTION FAILURES TO PREVENT (from prior Manus runs):**

- **❌ DO NOT add a stock ticker or market data ticker to the top of the app.** This has been added in prior runs. It is distracting, not useful for the primary advisor workflow, and must be omitted. If market data is wanted, it belongs deep inside a wealth engine surface, not as a persistent top-of-app banner. Remove it immediately if it exists.
- **❌ DO NOT place Client Profile inside Practice Management.** Client Profile belongs under **Client Planning** within the wealth engine's page-internal nav. Practice Management is about the advisor's business operations; Client Planning is about the advisor's clients. This has been consistently mis-categorized in prior runs. The wealth engine's internal nav has 4 sections (Practice Management / Client Planning / Advanced Strategies / References) — Client Profile goes in Client Planning.
- **❌ Admin pages must be present and accessible.** In prior runs, admin pages disappeared after changes to other surfaces. Admin pages (user management, org settings, compliance settings, feature permissions, audit log per Rule 15) must be present at all times for users with admin roles. Test by logging in as an admin after every pass that touches navigation.
- **❌ Progressive disclosure must be CONSISTENT across ALL sidebar sections.** In prior runs, only the Client nav section was collapsible while all other sections were not. ALL sidebar sections must have the same expand/collapse behavior. If one section collapses, all sections collapse. No exceptions.
- **❌ Sidebar navigation nesting must be clean and consistent.** The wealth engine already consolidates multiple features within a page-internal nav (tab bar or sub-nav within the content area) alongside the sidebar. ALL other sections (learning, AI/agent, command center, settings, admin) must follow the same pattern: sidebar has top-level section entries; clicking a section reveals its page-internal nav for sub-items. Do NOT create deeply nested sidebar trees that differ structurally from the wealth engine pattern.
- **❌ Settings navigation must be accessible for ALL items.** In prior runs, settings had an internal nav that was not scrollable or accessible for all items. Settings should use the same page-internal nav pattern as the wealth engine — clean tab bar or scrollable sub-nav with all items reachable. Test by navigating to every settings item on mobile viewport (390×844).

- Sidebar navigation should be clean, grouped logically, with clear active states. The **app-shell sidebar** has top-level section entries: **Wealth Engine, Learning, AI, Command Center, Settings, Admin** (and user profile). These are the app-wide navigation. When the user clicks into a section (e.g., Wealth Engine), that section's **page-internal nav** appears — for the wealth engine, this is the 4-section structure per the HTML reference: **Practice Management, Client Planning, Advanced Strategies, References**. The page-internal nav is INSIDE the wealth engine page, not in the app-shell sidebar. Other sections (Learning, AI, Command Center, Settings, Admin) should similarly use page-internal nav for their sub-items rather than deeply nesting in the app-shell sidebar.
- Mobile is not a shrunken desktop. Redesign for touch: larger targets, stacked layouts, swipe interactions.
- **Failover and stability patterns established here apply everywhere.** For every external dependency (LLM API, integrations, third-party data), define: (a) the happy path, (b) the degraded-but-functional path (cached data, simplified calculation, offline mode), (c) the user-visible indicator that shows current state ("Connected" / "Using cached data from 2h ago" / "Service unavailable — limited features available"). These patterns are reusable components that Phase 2-7 surfaces consume.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND fresh virtual-user walkthrough (cold start, mobile) navigates every major feature without confusion AND failover patterns demonstrated on ≥3 external dependencies AND no stock ticker present AND Client Profile is in Client Planning (not Practice Management) AND admin pages accessible to admin-role users AND all sidebar sections have consistent expand/collapse behavior AND settings nav is fully accessible on mobile.

---

### Phase 2 — Learning / Training / Onboarding / Custom Workflows
*Dynamic, CRUD-able, comprehensive — fully inherits `mwpenn94/emba_modules` structure + compressed library content + rich media + personalization + hierarchical custom workflows*

**Why second:** Onboarding and learning are what a new user encounters first. If incomplete or broken, the user never reaches the wealth engine or AI features.

**On entry:**
1. Clone / pull `mwpenn94/emba_modules`. **If inaccessible:** log to `BLOCKED_ON.md`; proceed on internal-assessment basis; flag for user. Phase still converges on its own criteria.
2. Inventory every module, lesson, workflow, onboarding flow in emba_modules.
3. Extract and inventory `WealthBridgeLibraryv11_QA.zip` (the compressed library — 81 files across 7 directories):

   **`Manuals_TTS/` — 12 TTS-optimized study manuals (.docx):**
   Life & Health, P&C, General Insurance, Surplus Lines, Series 7, Series 66, SIE, CFP, Estate Planning, Financial Planning, Investment Advisory, Premium Financing.
   
   **`Manuals_Visual/` — 12 visual/complete study manuals (.docx) with embedded graphics:**
   Same 12 exam domains as TTS, but with inline graphical aids for visual learners.
   
   **`HTML_Training_Modules/` — 13 interactive HTML training modules:**
   One per exam domain (12) + `WealthBridge_Quiz_Engine.html` (cross-domain quiz engine). These are self-contained interactive web pages — they should be embedded or adapted into stewardly-ai's learning surface, not just linked.
   
   **`Graphics/` — 20 PNG graphical aids:**
   Capital Market Flow, Yield Curve Shapes, Bond Price-Yield Seesaw, Options Payoff, Regulatory Ecosystem, Account Types, Options Strategy Matrix, Underwriting Spread, Risk-Return Spectrum, Sharpe vs Treynor, CFP Planning Process, Tax Bracket Waterfall, Trust Decision Tree, GRAT Mechanics, Life Insurance Spectrum, Needs Analysis, Homeowners Forms, Coinsurance Penalty, Combined Ratio, Risk Management Matrix. Each maps to a specific exam domain and learning module — cross-reference during import.
   
   **`Flashcards/` — 12 flashcard sets (.txt):**
   One per exam domain. Import as interactive flashcard components (flip, shuffle, track mastery).
   
   **`Reference/` — `verified_tax_numbers.md`:**
   Current tax brackets, limits, thresholds. Import into wealth engine defaults (Phase 3) AND learning reference material.
   
   **`Tools/` — Build tools and design specs:**
   `MASTER_BUILD_PLAN.md`, `MANUS_PROMPT_Graphical_Aids.md`, `mb_class.py`, `emba_design.py`. Read for architectural guidance; adapt where applicable to stewardly-ai's architecture.

4. Read the strategy taxonomy (12 categories: Core Planning, Insurance-Driven, Investment-Driven, Tax, Estate/Legacy, Business Owner, Retirement Income, Premium Financing, Retirement Plan/Employer, Advanced Wealth, Client Acquisition, AI-Enabled) + leader persona archetypes (10: Simons/Quant, Buffett/Value, Lynch/Growth, Ramsey/Behavioral, Dalio/Macro, Nash/Insurance-Centric, HNW Estate/Premium Finance, CFP/Holistic, Modern CIO/Alternatives, FIRE). Map each to relevant learning modules — every strategy category should have at least one teaching module; every leader persona should appear as a "learn from this approach" reference.
5. Compare all inventoried content against what's currently live in stewardly-ai.
6. Generate gap list + optimization list.

**Score criteria (generate 5-8):**
- **Structure inheritance:** does stewardly-ai's learning surface fully mirror the organizational structure of emba_modules (module hierarchy, lesson ordering, category groupings)?
- **Content completeness:** % of emba_modules content + compressed library content represented. Every piece of advisor-relevant content must be either imported/adapted OR explicitly flagged out-of-scope with rationale.
- **CRUD functionality:** can an admin create, read, update, delete, reorder, and archive every learning module / lesson / workflow / onboarding step without touching code?
- **Rich media support:** can modules include embedded video, interactive graphical aids (calculators, diagrams, decision trees, charts), downloadable PDFs, audio, and inline quizzes/assessments? Do these render well on mobile?
- **Personalization:** can each user customize their learning experience — bookmark content, set learning goals, choose learning paths, adjust difficulty/depth level, mark modules as relevant/irrelevant to their practice, receive AI-generated recommendations based on their role, experience level, and current work context?
- **Custom workflows across user layers:** can workflows (recruiting, onboarding, training, business processes, personal processes) be created by admins and assigned or proposed/invited to users based on organizational hierarchy? Can a Managing Director define a workflow and assign it to their direct reports? Can a direct report see their assigned workflows, complete steps, and report status up the hierarchy? Can workflows be templated and reused?
- **Cross-linking to engine:** does every learning module that teaches a concept link to the relevant wealth engine surface? "Learn about Roth conversion ladders → try it in the Tax-Bracket Engineering calculator."
- **Progress tracking + recommendations:** does the system track completion, surface next-recommended modules (both admin-assigned and AI-recommended), and show progress dashboards per user and per team (for managers)?

**Phase 2 specific guidance:**
- **Fully inherit emba_modules structure first, then extend.** The structure (module hierarchy, categories, ordering) is the floor. Don't reorganize until the floor is matched.
- **Library content import is exhaustive, not selective.** All 12 exam domains × 4 formats (TTS manual, visual manual, HTML training module, flashcards) must be represented. The HTML training modules and quiz engine should be adapted into stewardly-ai's component framework (React or equivalent), not served as raw HTML iframes. The 20 graphical aids should be used inline within their corresponding modules as interactive visual references — a module about options should display the Options Payoff diagram; a module about estate planning should display the Trust Decision Tree.

**KNOWN EXECUTION FAILURE TO PREVENT:** In prior Manus runs, the learning surface appeared **completely unchanged to users** despite the prompt specifying rich media and personalization. The executor either skipped this phase's content work or made backend changes that didn't surface in the UI. **This is the most important anti-pattern for Phase 2: if the user cannot see the difference, the work hasn't shipped.** Specifically:
- A user navigating to Learning must see **visually different content** than what existed before Phase 2 work: interactive graphical aids inline within modules (not just text), embedded quiz engine with score tracking, flashcard components with flip/shuffle, downloadable PDFs, and personalization controls (bookmarks, difficulty adjustment, "mark as irrelevant" toggle).
- If the learning surface looks the same as before Phase 2 passes, score the relevant criteria at 1-3 (absent) regardless of what the backend does. User-visible change is the only valid evidence.
- **Test with a fresh user account.** Log in as a new user, navigate to Learning, and verify: (a) modules are organized by the 12 exam domains, (b) at least 3 modules contain interactive graphical aids (not just text), (c) the quiz engine is functional and scores are tracked, (d) flashcards are interactive (flip, not static text), (e) personalization controls are visible and functional (bookmark a module, change difficulty, get recommendations), (f) rich media loads on mobile viewport.

- **The WealthBridge Quiz Engine is a first-class learning feature.** It supports multi-domain quizzing, score tracking, and mastery assessment. Adapt it into stewardly-ai's learning surface with: per-user score history, per-domain mastery tracking, adaptive difficulty (serve harder questions as mastery increases), and progress integration with the Phase 2 progress tracking system.
- **Flashcards are interactive study tools.** Import as flip-card components with: shuffle, mastery marking (known/unknown), spaced-repetition scheduling, and per-user progress tracking. Not static text display.
- **Strategy archetypes and leader personas are learning content.** Each of the 10 leader archetypes (Simons, Buffett, Lynch, Ramsey, Dalio, Nash, HNW Estate, CFP Holistic, Modern CIO, FIRE) should have a dedicated learning module: who they are, what they believe, how their approach applies to advisory practice, which clients it fits, and a cross-link to the relevant wealth engine surface (Phase 3) where the approach is modeled. The 12 strategy categories are the organizing structure for advanced advisory training.
- **Rich media is not optional.** At minimum: embedded video support, interactive graphical aids (the 20 PNGs adapted as explorable interactive components where appropriate — e.g., Tax Bracket Waterfall as a slider-driven visualization), downloadable PDFs (the visual manuals), audio (TTS manuals as playable audio or text-to-speech integration).
- **Custom workflows are a multi-layer system per Rule 15.** User layers: individual → team lead → MD → RVP → admin. Each layer can create workflows visible to their subtree, assign (required) or propose/invite (optional) to users. Workflows can contain: learning modules, tasks, forms, document uploads, external links, quiz assessments. Completion rolls up through hierarchy. Workflows are shareable and omittable per Rule 15's granular sharing model.
- **Personalization is AI-powered where possible.** Learning recommendations based on role + experience + client book composition + completion history. "Based on your client book (heavy on pre-retirees), I recommend the Sequence of Returns Risk module and the Ramsey behavioral approach for your debt-burdened clients."
- **`verified_tax_numbers.md` feeds both Phase 2 (learning reference) and Phase 3 (engine defaults).** Import the tax numbers into a shared data layer that both surfaces consume. When tax numbers update (via Phase 6 integrations or manual edit), both surfaces reflect the change.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND emba_modules structure fully inherited AND library content fully inventoried with ≥90% imported/adapted AND all 12 exam domains represented with ≥2 content formats each AND quiz engine functional AND ≥3 modules with rich interactive media AND ≥1 custom workflow demonstrated across 2+ user layers with hierarchy-based assignment AND sharing/permissions demonstrated on ≥3 learning items.

---

### Phase 3 — Holistic Income / Wealth Engine
*Full structural inheritance from HTML → content parity → production planning across all channels → AUM override calculations → full strategy/approach suite → continuous improvement via integrations*

**Why third:** The wealth engine is the core value proposition. Depends on Phase 1 (UI shell + failover patterns) and Phase 2 (learning modules cross-link to engine surfaces).

**On entry:**
1. Read `docs/reference/WealthBridge-Business-Calculator-v7.6.html` (8806-line HTML business calculator).
2. Read `docs/reference/HTML_STRUCTURAL_INVENTORY_STARTER.md` (40 structural categories).
3. If `docs/HTML_STRUCTURAL_INVENTORY.md` doesn't exist, produce it: walk HTML end-to-end, enumerate every structural element (300-500+ rows expected).
4. Compare inventory against stewardly-ai's current engine surfaces.
5. Generate gap list: structural elements present in HTML but absent in stewardly-ai.
6. Read `docs/reference/ADVISORY_TAXONOMY_v2_AND_ENGINE_MAP.md` for surpass targets.
7. Read `docs/reference/ADVISORY_OPERATING_SYSTEM_AXES.md` for 5-axis coverage checks.

**Score criteria (generate 5-8):**
- **Structural inheritance rate:** % of HTML structural elements with match/superior implementation. Target 100% before any surpass work.
- **Content parity rate:** % of HTML inputs/calculations/references/outputs with functional equivalent. Target 100% before any surpass work.
- **Multi-channel production planning:** does the engine support production planning not just for insurance (Track A/B/C/D per HTML) but also for AUM/advisory, affiliate, and other practice channels? Are these flexibly adjustable by users? Can a user add custom channels? Do all channels feed into the same roll-up totals, combined chart, and P&L?
- **AUM upline/tiered overrides:** does the engine correctly calculate tiered upline overrides for AUM? Specifically: the individual's payable portion of GDC is adjustable. The standard default override rate for Managing Directors and RVPs is derived from p² + p − 1/3 = 0, yielding **26.375%** of the payable portion of trails. Tiered overrides follow the same cascade pattern as insurance production: the MD/RVP earns 20% of their immediate reports' earnings (FYC on insurance, payable portion of trails on AUM). All of these rates must be user-adjustable while defaulting to the formula-derived values. The engine must show: individual GDC %, override rate per tier, effective payout after overrides, and total team/hierarchy economics.
- **Strategy/approach suite completeness:** does the engine represent the full suite of advisory approaches from the taxonomy doc (~90 approaches across 14 categories)? At minimum all P0 approaches must be represented with functional surfaces. Per the 5-axis closure framework, every typical client plan should touch all 5 axes (Return/Risk/Behavior/Governance/Purpose) with coverage gaps flagged to the advisor.
- **Continuous improvement readiness:** are the engine's data sources, default values, reference citations, and strategy models architectured to update via integrations (Phase 6) and AI/agentic intelligence (Phase 4)? No calculation should depend on hardcoded values that can only be updated by a developer — every default should be sourced from a configurable data layer that can be refreshed by integration pipelines or AI-driven updates.
- **Reference/citation system + save/load/narration:** per HTML — ref-tip tooltips (17 categories, 88 entries), 10-slot save, JSON export/import, CalcNarrator walkthrough.
- **Progressive disclosure across tiers:** Tier 0 Instant (1-2 inputs, <200ms, one-thumb mobile zone, "Retirement adequacy: 72/100 · configure ›"), Tier 1 Quick-check (3-5 inputs), Tier 2 Current engine (full HTML-equivalent), Tier 3 Advanced (multi-scenario, multi-client, custom templates), Tier 4 AI-driven (approach selection, live-integration-fed defaults, agentic orchestration).

**Phase 3 specific guidance:**

**Structural inheritance first, then parity, then surpass. Hard gate.**
- Do not start surpass work until structural inheritance AND content parity are at 100%. The HTML is the floor.
- The HTML has 23 nav items, 17 citation categories, 88 reference entries, 27 ref-tip inline tooltips, a 10-slot save system, forward/back planning, hierarchy cascade, and a holistic wealth planning engine.

**Multi-channel production planning (expansion beyond HTML):**
- The HTML has insurance tracks A/B/C/D + AUM + Team Override. The expanded engine adds:
  - **AUM/advisory channel:** with adjustable fee schedules, breakpoint tiers, billing frequency, trail commission calculation, and upline override cascade.
  - **Affiliate/referral channel:** with referral fee structures, revenue share percentages, payout schedules.
  - **Custom channels:** user-defined with flexible field configuration. An advisor who has a unique revenue stream (speaking fees, consulting, real estate referrals) can model it.
  - **Roll-up unification:** all channels feed into the same totals, combined chart, P&L, and GDC brackets. The "My Plan" surface shows the complete practice picture across all channels.

**KNOWN EXECUTION FAILURES TO PREVENT (from prior Manus runs):**

- **❌ AUM/advisory and affiliate income widgets were never updated to enable production planning and funnel analysis.** In prior runs, the insurance tracks had production planning/funnel analysis widgets (Track A/B/C/D per HTML) but the AUM/advisory and affiliate channels had no equivalent. **Every channel must have the same production planning widget capability as the insurance tracks:** pipeline funnel visualization, activity metrics (calls/meetings/proposals/closes), production forecasting, and ramp schedule modeling. If the insurance track has a funnel analysis widget, the AUM/advisory track must have an equivalent AUM funnel (prospects → discovery → proposal → agreement → AUM onboarded → billing active).
- **❌ The override calc for AUM/advisory was never implemented.** In prior runs, the AUM upline override cascade (p² + p − 1/3 = 0 → 26.375% default) was either absent or non-functional. This is **critical business logic.** Validate by: enter an advisor with 80% GDC retained on $1M AUM trails, verify the MD override calculates to ~26.375% of the payable portion, verify the tier cascade shows 20% of immediate reports' payable, verify changing the GDC % recalculates the entire cascade. If this doesn't work, the criterion scores 1-3 regardless of how pretty the UI is.
- **❌ Leading strategies, approaches, and widgets across all 4 domains (Practice Management, Client Planning, Advanced Strategies, Rich References) were entirely non-existent.** In prior runs, the wealth engine had basic calculators but NO strategy surfaces — no retirement income engineering approaches (buckets, floor-upside, Guyton-Klinger), no tax-bracket engineering, no trust engineering surfaces, no governance layer (IPS generator), no Monte Carlo engine, no practice management strategy widgets (channel diversification modeling, GDC optimization), no advanced strategy surfaces (premium finance design, ILIT structuring, exec comp comparison), and no due diligence reference layer. **These are the core wealth engine value — not just calculators but strategy-driven planning surfaces.** Score Domains A-D at 1-3 (absent) if the surfaces don't exist, and build them via Rule 14 build-from-zero protocol.

**AUM upline override math (critical business logic):**
- The formula p² + p − 1/3 = 0 has a positive root of approximately 0.26375 (26.375%). This is the **default standard tiered upline override rate** for Managing Directors and RVPs.
- Implementation: for an individual advisor with X% of GDC retained (anything less than 90% individual GDC triggers upline override calculation), the upline at the next tier earns 20% of the advisor's payable earnings on that channel. The 26.375% represents the blended effective override rate when computed across the hierarchy.
- All rates must be user-adjustable: individual GDC %, per-tier override %, number of tiers. Defaults come from the formula; overrides persist per user.
- The hierarchy cascade flows: individual → team lead → MD/RVP → regional, with override percentages compounding per tier (same pattern as insurance FYC cascade).
- The engine surface for this should show: a hierarchy visualization (who reports to whom), per-person GDC and effective payout, per-tier override rates, and total hierarchy economics — with the ability to model "what if I add 3 advisors to my team at X production level?"

**Strategy/approach suite (from taxonomy doc + strategy archetypes + leader personas):**

The wealth engine spans four major domains. Each domain needs leading strategies, approaches, and personas — not just the financial planning domain.

**Domain A — Practice Management strategies/approaches/personas:**
- **Production optimization:** how top producers structure their weeks, pipelines, and activity metrics. Personas: million-dollar producers, top-10% MDRT qualifiers, agency builders who scaled from solo to 50+ advisors.
- **Recruiting and team building:** proven recruiting funnels (6-stage per HTML), ramp schedules, retention strategies, comp structure optimization. Personas: successful MDs who built 20+ person teams, top-recruiting RVPs.
- **Channel diversification:** how to build across insurance, AUM, affiliate, and custom channels simultaneously without diluting any. Personas: hybrid advisors who successfully run insurance + advisory books.
- **Marketing and client acquisition:** campaign strategies (drip, event-based, referral, digital funnel, COI partnerships). Personas: advisors who built $1M+ practices primarily through systematic marketing.
- **P&L and business economics:** practice profitability modeling, expense management, scaling economics, break-even analysis. Personas: practice management consultants, successful ensemble firm builders.
- **GDC and override optimization:** compensation structure modeling, team economics, override cascade optimization. The engine should let a user model "what does my practice look like at 50% insurance / 50% AUM vs 80/20?" with full override and hierarchy impact.

**Domain B — Client Planning strategies/approaches/personas:**
- Every P0 approach from the taxonomy must have a functional engine surface. The taxonomy doc's P0 list: retirement income engineering (buckets, floor-upside, Guyton-Klinger, SS claiming, Medicare), tax-bracket engineering (Roth conversion), protection depth (LTC, DI, annuity flooring), stock-based comp / concentration, balance-sheet view, debt-side management (mortgage, student loans), trust engineering (SLAT/IDGT/GRAT/CRT), governance layer (IPS generator + leverage governance matrix), Monte Carlo engine.
- **Best-practice client workflows:** not just calculators but the advisor's workflow for each planning domain — discovery → analysis → presentation → implementation → review. Each workflow should have a "how the best advisors do this" reference with leading personas (top CFPs, top estate planners, top retirement income specialists).
- Per the 5-axis closure framework, every client plan should touch all 5 axes (Return/Risk/Behavior/Governance/Purpose) with coverage gaps flagged.

**Domain C — Advanced Strategies with practitioner-grade detail:**
- **Premium financing:** not just a calculator but the full design process — carrier selection, collateral structuring, exit strategy modeling, stress testing, governance framework. Reference: leading premium finance designers, private banking groups, AALU case studies.
- **ILIT/trust structures:** SLAT, IDGT, GRAT, CRT, QPRT, dynasty — each with when-to-use decision framework, implementation checklist, practitioner notes on common mistakes. Reference: top estate planning attorneys, trust companies, Leimberg information services.
- **Executive compensation:** split-dollar (endorsement vs collateral), §162 bonus, SERP, NQDC — with side-by-side comparison, tax implications, client-presentation-ready summaries. Reference: leading exec comp designers.
- **Charitable planning:** DAF, CRT, CLT, private foundation, QCD — with tax modeling and donor-impact analysis. Reference: National Philanthropic Trust, community foundation best practices.

**Domain D — Rich references for user digest and due diligence:**
- Every strategy, approach, and calculation in the engine should be backed by citable references that an advisor can: (a) read to deepen their own understanding, (b) share with clients as credibility/education material, (c) use for compliance documentation and due diligence.
- The reference system (per HTML: 17 citation categories, 88 entries, 27 ref-tip inline tooltips) expands to cover all four domains — not just client planning.
- **Practice management references:** industry benchmarking (MDRT, NAIFA, FPA practice management surveys), compensation studies, recruiting best practices.
- **Advanced strategy references:** AALU, Leimberg, estate planning journals, tax code citations (§162, §409A, §1035, §7702, §1202, etc.), carrier product guides.
- **Due diligence layer:** for every strategy the engine recommends, the advisor can access a one-page due diligence summary: what the strategy is, who it's for, what the risks are, what the compliance considerations are, what the alternatives are, and citations to authoritative sources. This is the "show your work" capability that compliance reviewers and skeptical clients need.
- References should be searchable, filterable by domain/topic/authority-tier, and automatically updated when Phase 6 integrations deliver fresh data.

**Strategy archetypes (12 categories) map to engine surfaces across all 4 domains.** Each of the 12 strategy categories (Core Planning, Insurance-Driven, Investment-Driven, Tax, Estate/Legacy, Business Owner, Retirement Income, Premium Financing, Retirement Plan/Employer, Advanced Wealth, Client Acquisition, AI-Enabled) should have its relevant strategies modeled as engine surfaces or calculators. The archetype taxonomy from the attached doc is additive to the existing ADVISORY_TAXONOMY — reconcile and merge.

**Leader personas (10+ archetypes) as approach-selection aids across all domains.** When the approach-selection engine (or the AI in Phase 4) recommends strategies, it frames recommendations through persona lenses: "A Buffett-style approach for this client would emphasize..." / "A Dalio risk-parity perspective suggests..." / "A Ramsey behavioral framework would prioritize..." / "A top-producing MD's approach to this recruiting challenge would be..." The persona lens is optional (progressive disclosure Level 3+). Practice management personas (successful MDs, agency builders, top recruiters) are as important as investment personas for the wealth engine's practice-management domain.

- **Continuous improvement architecture:** every calculation default, every reference citation, every strategy model parameter is stored in a data layer (DB, config, API-sourced) — not hardcoded. When Phase 6 integrations deliver fresh data (new FRED rates, new IRS brackets, new mortality tables from `verified_tax_numbers.md`), the engine surfaces update automatically. When Phase 4 AI identifies a new strategy insight, it can propose a parameter update for advisor review.
- **Sharing per Rule 15:** calculator plans, client scenarios, strategy comparisons, advisor templates, practice management models, due diligence summaries, and reference collections are all shareable items. An MD can create a "recommended retirement analysis template" and share it with their entire region. An advisor can share a specific client plan with their team lead for review. Sharing respects permission levels.

**Per the financial data tools reference:** Tier 0/1 defaults source from 🟢 FREE sources only. Tier 2+ may use 🟡/🔴.

**Exit criteria:** structural inheritance 100% AND content parity 100% AND multi-channel production planning functional with ≥3 channels AND AUM upline override calculation correct with formula-derived defaults AND all P0 taxonomy approaches have functional surfaces AND practice management domain has ≥3 strategy surfaces with leading-persona references AND advanced strategies domain has practitioner-grade detail for ≥3 strategies (premium finance, ILIT, exec comp minimum) AND due diligence summaries exist for ≥10 strategies AND sharing demonstrated for ≥2 engine items AND feature-level access control demonstrated (≥1 feature toggled per hierarchy layer) AND all criteria ≥8 for 3 consecutive passes.

---

### Phase 4 — Unified AI Surface (Consolidated: Agent + Code + Chat)
*Single AI interface consolidating autonomous agent (Manus clone), code capabilities (Claude Code clone), and conversational AI (Claude.ai comparable) — with progressive disclosure modes*

**Why fourth:** Consolidation per user directive. Three separate AI surfaces → one unified interface with mode switching via progressive disclosure. The agent is the most general capability (subsumes code execution + browser operation + workflows); code chat is a specialized mode; conversational AI is the default mode. Building as one surface prevents redundant infrastructure, inconsistent UX, and user confusion about which AI surface to use.

**What this surface must do (consolidated capabilities):**

**KNOWN EXECUTION FAILURES TO PREVENT (from prior Manus runs — these are the most severe):**

- **❌ "AI Studio" (or whatever the AI surface is named) does nothing except reroute users.** In prior runs, the AI surface was a shell — clicking it redirected to other parts of the app or showed a placeholder. It did NOT function as a conversational AI, did NOT accept input, did NOT produce responses, did NOT stream tokens, and had ZERO functional AI capability. **This is a complete failure of Phase 4.** The AI surface must be a WORKING conversational AI from its very first functional pass. A user types a message; the LLM backend processes it; tokens stream back in real time. If mock LLM is used (per Rule 12), mock responses must still stream token-by-token and the UI must render them the same way real responses would render. A static placeholder page or a redirect is NOT an AI surface — it scores 1 (absent).
- **❌ The Manus clone (Mode 3 Agent) was not functional and did not mirror Manus UI/UX at all.** In prior runs, there was no task submission, no plan display, no real-time execution view, no browser screenshots, no artifact delivery — none of the defining Manus UX elements existed. **The executor must open manus.im, screenshot every UI element, and build functional equivalents.** Specifically: (a) task input area where user describes what they want done, (b) plan display showing decomposed steps, (c) live execution view with browser screenshots / terminal output / tool call display streaming in real time, (d) artifact delivery panel showing completed deliverables. Mock the backend if needed (per Rule 12) — simulate a multi-step task with synthetic progress events — but the UI must look and behave like Manus.
- **❌ The Claude Code clone (Mode 2 Code) did not mirror Claude Code UI/UX/capabilities.** In prior runs, there was no terminal aesthetic, no diff rendering, no file tree, no inline code execution display. **The executor must open Claude Code (or Cursor/Windsurf), screenshot the interface, and build functional equivalents.** Specifically: (a) terminal-style dark-background code rendering, (b) syntax-highlighted code blocks, (c) diff view showing before/after, (d) file tree panel showing project structure, (e) inline execution output panel. Again, mock the backend if needed — the UI must be functional even with mock responses.
- **The fix pattern for these failures:** build-from-zero protocol (Rule 14) with explicit Phase 4a substeps:
  - **Phase 4a-0:** Build the INFRASTRUCTURE first — LLM API client with streaming (or mock), WebSocket/SSE transport, message persistence, conversation state management. Verify: send a hardcoded prompt to the API (or mock), receive streaming tokens, display them in a basic chat UI.
  - **Phase 4a-1:** Build Mode 1 (Chat) to functional parity with Claude.ai — streaming responses, markdown rendering, code blocks, conversation history. This should be the FIRST functional deliverable. Do NOT proceed to Mode 2 or Mode 3 until Mode 1 works.
  - **Phase 4a-2:** Build Mode 2 (Code) on top of Mode 1's infrastructure — add terminal aesthetic, diff rendering, file tree, inline execution.
  - **Phase 4a-3:** Build Mode 3 (Agent) on top of Modes 1+2 infrastructure — add task queue, progress streaming, browser-operator integration, artifact delivery.
  - **Phase 4a-4:** Build mode switching and context preservation across all 3 modes.

**Mode 1 — Chat (default, Claude.ai parity):**
The default mode. Conversational AI for questions, analysis, reasoning, document review. UI/UX nearly indistinguishable from Claude.ai at first glance.
- Streaming responses (tokens appear as generated — non-negotiable).
- Artifact/rich-output rendering: code blocks with syntax highlighting + copy button, markdown, tables, and inline calculator/engine previews ("here's a Roth conversion analysis" renders a mini wealth-engine surface inline).
- Conversation management: edit-and-regenerate, conversation branching, search/filter across history, export/share.
- Multi-modal: text, images, file uploads, code blocks.
- Memory/context: conversation history, user context (role, clients, preferences), platform-aware (knows about wealth engine surfaces, learning modules, command center).
- Tool use: search, calculate, fetch data, open engine surfaces, trigger agent tasks — all from within chat.
- Mobile chat: responsive input, readable output, smooth scrolling.
- **Benchmarks:** Claude.ai, ChatGPT, Gemini, Perplexity. Parity or superiority on ≥5 representative conversations.

**Mode 2 — Code (Claude Code parity):**
Activated via progressive disclosure (mode toggle, slash command, or auto-detected from coding context). Same conversation thread — user doesn't navigate away.
- Terminal-native aesthetic: diff rendering, file tree, inline code execution, output display.
- Code generation, editing, multi-file operations, refactoring — all at Claude Code quality.
- Context-aware of the stewardly-ai codebase.
- Agent handoff: complex multi-step coding tasks handed to Mode 3.
- **Benchmarks:** Claude Code, Cursor, Windsurf. Parity or superiority on ≥5 coding tasks.

**Mode 3 — Agent (Manus parity):**
Activated via progressive disclosure (mode toggle, "do this for me" phrasing, or explicit task submission). The defining shift: from conversational to autonomous execution.
- **Task submission + async execution:** user describes task. Agent decomposes, executes, delivers artifacts. User can walk away.
- **Browser operator:** headless browser (Playwright) — clicks, types, navigates, scrolls, screenshots, validates UI state on arbitrary web applications.
- **Real-time progress:** live execution view via WebSocket/SSE — browser screenshots, terminal output, tool calls, intermediate results.
- **Artifact delivery:** files, rendered previews, structured data. Clear "done" state.
- **Code writing + sandboxed execution:** writes code in Docker container, captures output, iterates.
- **Approval workflow:** reversible auto-executes; irreversible pauses for approval.
- **Advisor-specific templates:** "Monday-morning client review," "batch IPS generation," "quarterly review outreach for RMD clients," "analyze prospect from uploaded documents."
- **Engine-surface orchestration:** navigates wealth engine, enters data, runs calculations, compares scenarios, synthesizes results.
- **Compliance-aware:** flags regulated-territory actions, pauses for human review.
- **Benchmarks:** Manus, OpenClaw, Devin, Cursor Agent, Replit Agent, Windsurf Cascade. Parity or superiority on ≥7 tasks:
  1. "Build me a landing page for a retirement planning seminar"
  2. "Analyze this CSV of client data and produce a summary report with charts"
  3. "Go to [website], fill out this form, submit it, screenshot confirmation"
  4. "Review my top 5 clients' retirement readiness using the wealth engine"
  5. "Research latest SECURE Act 2.0 changes, summarize implications for my book"
  6. "Set up a new calculator surface for student loan optimization from the taxonomy spec"
  7. "Draft quarterly review emails for all clients with upcoming RMD events"
  8. "Launch a recruiting campaign for AZ Region 3 — segment the prospect database (or define a new segment if needed), post the job to Workable + LinkedIn Jobs + Indeed via Workable's distribution, update my LinkedIn page with the hiring announcement, select appropriate templates from the asset library, personalize content, schedule across email + LinkedIn DM + SMS with coordinated timing, monitor responses + Workable applicants, advance qualified candidates through the Workable pipeline, and hand off to me for interviews — with bidirectional sync ensuring my CRM always reflects current state across all platforms" (full Phase 5 lifecycle through the agent including LinkedIn profile/page management, Workable ATS, and dynamic segmentation)

**The unified surface architecture:**
- **One URL, one surface, one conversation thread.** User never navigates to a different page for different AI capabilities.
- **Mode indicator** in header: "Chat" / "Code" / "Agent" — one-click toggle.
- **Progressive disclosure governs mode visibility:**
  - Level 1 (default): Chat mode only. Clean, Claude.ai-like. New users see this.
  - Level 2: Chat + Code toggle visible. Auto-switches on coding context.
  - Level 3: Chat + Code + Agent toggle visible. Autonomous task submission.
  - Level 4: Full orchestration — multi-agent, scheduled tasks, webhook triggers, batch operations.
- **Context carries across modes.** Chat context available to Agent. Agent code available in Code mode.
- **Settings determine default level.** Power-user MD → Level 3. New advisor → Level 1. Adjustable anytime.

**Minimum infrastructure:**
- Headless browser (Playwright) for Mode 3.
- Sandboxed code execution (Docker) for Mode 2/3.
- LLM backend with streaming (Claude API / similar). Mock per Rule 12.
- Task queue with async execution for Mode 3.
- Artifact storage for Mode 3 deliverables.
- WebSocket/SSE for all modes' streaming.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND Mode 1 parity on ≥5 conversations AND Mode 2 parity on ≥5 coding tasks AND Mode 3 parity on ≥8 benchmark tasks (the 7 above plus the end-to-end campaign orchestration) AND smooth mode switching with context preservation AND async Mode 3 demonstrated AND AI conversations/artifacts shareable per Rule 15 (demonstrated with ≥2 share scenarios: share conversation with team lead for review, share agent deliverable with client as view-only).

---

### Phase 5 — Command Center Integration + End-to-End Campaign Lifecycle + Recruiting/ATS + Dynamic Segmentation
*Fully incorporate `mwpenn94/stewardly-command-center` — comprehensive cross-platform CRM/marketing/recruiting command layer over GHL/Dripify/LinkedIn/SMS-iT/Workable + LinkedIn profile/page management + Workable ATS integration + dynamic user-defined segmentation — with multitenancy, end-to-end campaign management, candidate/prospect lifecycle tracking, and complete inheritance of the marketing asset library*

**Why fifth:** The command center adds CRM, marketing automation, recruiting/ATS, and outreach across all platforms. Depends on Phase 1 (UI shell), Phase 3 (client data from wealth engine), Phase 4 (AI/agent drives campaign ideation, content generation, profile updates, recruiting orchestration).

**KNOWN EXECUTION FAILURE TO PREVENT:** In prior Manus runs, the `stewardly-command-center` repo was **entirely non-existent in the app.** No CRM surface, no campaign management, no contact database, no marketing automation — nothing from the command center repo was incorporated. This is a complete Phase 5 failure. **The executor MUST actually clone the `mwpenn94/stewardly-command-center` repo, read its code, and build the CRM/campaign surfaces into stewardly-ai.** If the repo is inaccessible, the executor builds CRM/campaign capabilities from scratch per Rule 14 — it does NOT skip this phase. A command center that is completely absent scores 1 on every Phase 5 criterion. Build-from-zero protocol applies to the entire phase if nothing exists.

**On entry:**
1. Clone / pull `mwpenn94/stewardly-command-center`. **If inaccessible:** log to `BLOCKED_ON.md`; proceed with internal CRM/marketing assessment; flag for user.
2. Read `docs/reference/MANUS_PROMPT_COMMAND_CENTER.md` (GHL/Dripify/LinkedIn/SMS-iT, 5 parity matrices, 8 personas, 3 competitor classes).
3. Extract and inventory the marketing asset library (6 zips):

   **`WealthBridge_180_Drip_Campaign_Emails__3_.zip`:** 180 production-ready HTML drip emails organized by audience segment (residential, commercial, etc.). Each segment has three sequence types: **A-sequence (A1-A6)** initial outreach (overview → curiosity → social proof → value angle 1 → value angle 2 → close), **B-sequence (B1-B6)** alternative angle outreach (different value prop), **R-sequence (R1-R6)** retargeting/response-based (opened, clicked, didn't book, objection handling, nurture). Import as email template library — each template editable, taggable by segment/sequence/stage, deployable to GHL or other email platforms.
   
   **`WealthBridge_Final_Package__1_.zip`:** Production-ready content + source files + optimization phase docs:
   - **Production-ready scripts:** `Call_Scripts_Complete_v2.md`, `SMS_Campaigns_Complete_v2.md`, `Engagement_Guides_v2.md`, `LinkedIn_Track_A_Deploy_Now.md`, `Dripify_Sequence_Templates.md`, `LinkedIn_Profile_Optimization.md`, `GHL_Implementation_Specs.md`, `Digital_Ad_Copy_v2.md`, `Event_Capture_and_Workable_Posts.md`, `FBIG_Track_A_Deploy_Now.md`, `WealthBridge_Unified_Rollup_Strategy.md`.
   - **Source files (presentations + docs):** `WealthBridge_Drip_Campaign_Architecture.docx`, `WealthBridge_Campaign_Playbook_2026_v2.docx`, Affiliate Program Guide (pptx), Strategic Partner Program Guide (pptx), Client Guide (pptx), Engagement Guides All Segments (md), Experienced Professional Guide (pptx), New Associate Guide (pptx).
   - **Optimization passes:** Phase 1-5 audit/depth/expansion/adversarial/convergence docs documenting how this content was iterated to production-ready quality.
   
   **`WealthBridge_Final_Deliverables_v4__4_.zip`:** CRM-ready data (import directly into command center contact DB):
   - **Spreadsheets:** `Prospect_Database_v4.xlsx`, `Candidate_Database_v4.xlsx`, `Combined_Pipeline_v4.xlsx`, `Engagement_Database_v4.xlsx`, `Event_Schedule_v4.xlsx`, `Executive_Summary_v4.xlsx`.
   - **Inbound assessments by region:** AZ, NM, OOS, R1-R7, Addendum, Complete, TBD, AZ Region 1 Candidate Assessment.
   - **Outbound prospect kits by region:** AZ, NM, R1-R4.
   
   **`WealthBridge_v5_1_CTA_Enhanced.zip` + `WealthBridge_v3_Final.zip` (visual assets, overlapping content):**
   - **6 LinkedIn carousels (PDFs):** Seven Planning Areas, Living Benefits Explained, Tuition Rewards, Sequence of Returns Risk, Open Enrollment Checklist, Year-End Tax Actions.
   - **3 featured graphics (PNGs):** Now Hiring AZ/NM, Free Financial Assessment, CPA/Attorney Partnerships.
   - **Event materials (PDFs):** 33×80 Pullup Banner, 4×6 Table Tent, 3.5×2 Business Card.
   - **24 monthly social graphics (PNGs):** 12 months × 2 platforms (LinkedIn + FB/IG).
   
   **`07_SMS_Scripts.zip`:** Multi-channel script + strategy library:
   - **Scripts:** `SMS_Campaigns_Complete.md`, `Call_Scripts_Complete.md`, `Digital_Ad_Copy_Complete.md`.
   - **Strategy docs:** `WealthBridge_Campaign_Playbook.md`, `WealthBridge_Content_Calendar.md`, `WealthBridge_Master_Content_Strategy.md`.
   - **Channel-specific folders:** Digital Ads (Google/LinkedIn/Meta/YouTube), Webinars (`Webinar_Outlines_Complete.md`), Roundtables (`Roundtable_Guides_Complete.md`), Community Events (`Community_Events_Complete.md`).
   - **Year-long social content:** `LinkedIn_YearLong_Content.md` (27KB), `FB_IG_YearLong_Content.md` (19KB).

4. Inventory the command center's: platform integrations, contact management, campaign management, outreach automation, analytics, content asset library.
5. Compare against stewardly-ai's current CRM/marketing surfaces. Generate gap list across THREE dimensions: (a) infrastructure (integrations, multitenancy, data model), (b) content library (the 6 zips above), (c) campaign lifecycle workflow (ideation → generation → deployment → sync).
6. Design multitenancy architecture: which data is per-advisor, per-team, per-region, per-organization? How does shared content (templates) inherit through the hierarchy?

**Score criteria (generate 5-8):**

*Infrastructure & data:*
- **Structure inheritance:** does stewardly-ai fully mirror the stewardly-command-center's structure, routes, and capabilities?
- **Platform integrations operational:** GHL (primary CRM), Dripify (LinkedIn outreach automation), LinkedIn (profile/page management — see dedicated criterion below), SMS-iT (text campaigns), email service provider (for the 180 drip emails), Workable (recruiting/ATS — see dedicated criterion below), calendar/booking (Calendly or GHL booking). Each operational or mock per Rule 12.
- **LinkedIn profile/page management (beyond outreach):** in addition to Dripify-driven outreach, the command center can directly manage LinkedIn presence: (a) edit advisor profile sections (about, experience, skills, featured content) from within Stewardly; (b) manage company/page content (banner, about, posts, articles, employee advocacy); (c) schedule and publish LinkedIn posts and articles directly (not just via Dripify); (d) coordinate employee advocacy — an MD posts content, the system suggests team members re-share it, tracks adoption; (e) profile optimization recommendations powered by Phase 4 AI ("your headline could mention your specialization"); (f) profile/page change history and rollback. Per Rule 12, mock fallback simulates these actions when LinkedIn API access is restricted.
- **Workable ATS integration:** the command center integrates with Workable for recruiting workflow: (a) create and publish job postings from Stewardly directly to Workable + downstream boards (Indeed, LinkedIn Jobs, ZipRecruiter); (b) candidate pipeline management (sourced → screened → interview → offer → hired/declined); (c) bidirectional sync — Workable candidate progression updates the Stewardly candidate record + GHL contact lifecycle, and vice versa; (d) interview scheduling integrated with calendar; (e) candidate communication (templated emails, SMS, LinkedIn messages) launchable from the candidate record; (f) hiring decision triggers downstream workflows (onboarding workflow assignment per Phase 2, learning module enrollment per Phase 2, equipment provisioning task list, etc.). Per Rule 12, mock fallback simulates Workable operations when the live integration is unavailable.
- **Multitenancy across layers per Rule 15:** correct data isolation and cascade. Same permission model as rest of platform. Reuse Phase 1's sharing components.
- **CRM-ready data import:** the 6 spreadsheets from `WealthBridge_Final_Deliverables_v4__4_.zip` are importable into the contact DB. Field mapping matches command center schema. Duplicates detected and merged on import. Imported records auto-categorize into prospect (`Prospect_Database_v4`), candidate (`Candidate_Database_v4`), or combined pipeline records based on source database.

*Content asset library:*
- **Content library completeness:** ≥95% of marketing assets from the 6 zips imported into command center as reusable, editable, taggable templates. Templates organized by: channel (email/SMS/LinkedIn-outreach/LinkedIn-post/LinkedIn-profile/FB-IG/Google/YouTube/call/event/Workable-job-posting), audience (residential/commercial/affiliate/recruiting/by-region/user-defined), sequence stage (A1-A6/B1-B6/R1-R6), purpose (top-of-funnel/nurture/closing/retention/recruiting/onboarding).
- **Asset accessibility per Rule 15:** templates inherit through hierarchy (org-level templates available to all; team-level to team; user-level private). Sharing permissions respected. Feature-access controls determine which templates each user can view/use/edit.

*Candidate / prospect lifecycle (first-class capability):*
- **Unified contact lifecycle across prospects, candidates, partners, clients, and events.** A single contact record carries through every lifecycle, with role-specific stages visible per context. The canonical stage definitions are established in the live `WealthBridge_Combined_Pipeline_v4`, `WealthBridge_Engagement_Database_v4`, and `WealthBridge_Event_Schedule_v4` spreadsheets (Google Sheets + xlsx versions) and must be preserved exactly in Stewardly's contact data model:

  - **Outbound / prospect lifecycle (8 stages, per Combined Pipeline):**
    Prospect Identified → Initial Outreach → Confidential Exploration → Deal Structure Discussion → Licensing & Transition → Converted / Declined / On Hold
  
  - **Inbound / candidate lifecycle (12 stages, per Combined Pipeline):**
    Lead Identified → Initial Outreach → Discovery Meeting → WB Overview Presented → Senior Leadership Intro → Business Plan Review → Offer Extended → Offer Accepted → Licensing & Onboarding → Active Advisor / Declined / On Hold
  
  - **Partner / referral network lifecycle (7 stages, per Engagement Database):**
    Partner Identified → Initial Outreach → Meeting Scheduled → Active Referrals → Strategic Alliance / Inactive / Declined
    
    Partner segmentation matches the Engagement Database canonical segments with their counts and average scores:
    - CPAs & Tax Advisors (~329, ~27% of partners, avg score 5.0)
    - Agricultural Clients (~302, ~25%, 4.7)
    - Nonprofits & Foundations (~204, ~17%, 5.5)
    - Estate & Trust Attorneys (~177, ~15%, 5.0)
    - Referring Agencies (~128, ~11%, 5.1)
    - HR & Benefits Consultants (~74, ~6%, 4.3)
    
    These baseline partner segments seed the Phase 5 segmentation system; additional partner segments are addable per the dynamic segmentation criterion below.
  
  - **Event journey (8 stages, per Event Schedule):**
    Event Identified → Planning → Outreach Sent → Confirmed → Completed → Follow-Up → Closed / Cancelled
    
    Event schedule is a first-class command center surface with tracking columns: Event Journey Stage, Assigned MD, Assigned RVP, Event Lead, Last Update Date, Next Action Date, Event Notes. Event tabs mirror the Event Schedule v4: Event Summary, Master Event Schedule (~646 entries seed), Opportunity Organizations (~159), Recruiting Pipeline (~142), Region Summary, Organizations Directory (~171), Limitations & Gaps (~19).
  
  - **Client lifecycle (advisory/wealth engine-aligned):**
    prospect → lead → qualified → consultation → planning → client → retained → reactivation/lost
  
  - **Affiliate lifecycle (business partnership):**
    identified → outreach → exploratory → MOU/agreement → active partnership → review/renewal → terminated

- **Tier and region classifications** (from Combined Pipeline structure): 4-tier distribution (Tier 1/2/3/4) and 9 regions (R1-R7, NM, OOS/Out-of-State, TBD) must be preserved as first-class contact attributes. Pipeline composition metrics (by state: Arizona/New Mexico/Other, by tier, by region) are surfaced in the executive dashboard with live formula semantics (recompute on record change).

- **Cross-file reference integrity:** the 6 v4 spreadsheets form a cross-linked system per the Event Schedule's "Cross-File References" tab. The command center must preserve these relationships as actual database relationships (foreign keys, not denormalized copies):
  - `Engagement_Database` ↔ partner contacts who may attend/host events
  - `Prospect_Database` ↔ outbound prospects targeted for event invitations
  - `Candidate_Database` ↔ inbound candidates who may attend events
  - `Combined_Pipeline` ↔ unified view for event-driven conversions
  - `Executive_Summary` ↔ org-level KPIs rolling up from all databases
  - `Event_Schedule` ↔ event calendar referencing all contact types

- **Live Google Sheets as an import + sync source (not just one-time xlsx import):** in addition to importing the xlsx files from `WealthBridge_Final_Deliverables_v4__4_.zip`, the command center supports live connection to the Google Sheets versions. User provides the Sheet ID (or OAuth-authorizes the Drive folder); Stewardly polls for updates on a configurable cadence; changes in the Sheet flow into the contact DB; changes in the contact DB flow back to the Sheet (bidirectional sync, per the same model as the other platform integrations). Users who prefer to work in Sheets can continue to do so; users who prefer the Stewardly UI get the same data; conflict resolution follows the same rules as cross-platform sync.

- **Lifecycle stage transitions trigger downstream actions:** stage advance automatically triggers configured actions — assign onboarding workflow (Phase 2), enroll in learning path (Phase 2), grant feature permissions (Rule 15), kick off welcome campaign, schedule check-ins, notify manager. Stage regression (candidate withdraws, prospect goes cold) triggers retention/recovery sequences.
- **Reviews and notes per lifecycle stage:** every stage transition can require or recommend a review note (interview feedback for candidate stages, discovery call notes for prospect stages, plan presentation notes for client stages, meeting outcome notes for partner stages, event outcome notes for event stages). Notes are searchable, attributable, shareable per Rule 15.
- **Cross-team handoffs:** candidate hired → handoff from recruiter (MD/team lead) to onboarding owner; receiving party acknowledges. Partner escalated to Strategic Alliance → handoff from individual advisor to MD. Event Lead handoff between Planning and Outreach Sent stages.

*Dynamic user-defined segmentation:*
- **Predefined segments preserved:** the segments built into the marketing assets (residential, commercial, recruiting candidates, affiliates, regions AZ/NM/R1-R7, etc.) are preserved as the starting taxonomy. These don't disappear when users define their own.
- **User-defined segmentation:** users can create custom segments by any combination of: contact attributes (state, age range, income bracket, role, company size), engagement behavior (opened email in last 30 days, attended event, downloaded resource, replied to outreach), pipeline stage (any of the lifecycle stages above), tags (free-form user-applied tags), or compound conditions (AND/OR logic across multiple attributes).
- **Segment persistence and sharing:** user-defined segments are saved per user, shareable per Rule 15 (an MD can share a segment definition like "AZ pre-retirees who attended the May webinar but haven't booked" with their team), and applicable to any campaign, template, workflow, or analytics dashboard.
- **Dynamic vs static segments:** segments can be defined as dynamic (recompute membership on every reference — e.g., "anyone whose lifecycle stage = qualified" updates as records change) or static (snapshot at moment of creation, doesn't update). Dynamic is the default; static is for campaign cohort analysis where you want to lock the population.
- **Segment-aware campaign targeting:** any campaign can target any segment (predefined or user-defined). The same template + sequence + cross-channel orchestration works regardless of how the audience was defined. AI suggestions adapt to the segment characteristics.
- **Segment analytics:** every segment has a dashboard showing size, growth/shrinkage trend, engagement rate, conversion rate, and breakdown by source/region/lifecycle.

*Campaign lifecycle (the new dimension):*
- **End-to-end campaign management — from ideation to implementation:**
  - **Stage 1 — Ideation:** advisor (or AI agent per Phase 4) defines a campaign goal ("recruit 5 candidates in NM Region 3 over 60 days," "convert prospects who attended last month's webinar into discovery calls," "reactivate dormant clients with quarterly review offer"). The system suggests campaign approaches based on goal, available templates, target segment (predefined or user-defined), channels, and historical performance.
  - **Stage 2 — AI-assisted content generation:** Phase 4 AI generates personalized content from base templates — adapting tone, segment-appropriate language, regional references, advisor's voice. AI can compose entirely new content where templates don't fit. Compliance checks flag anything that touches regulated language (per Phase 4's compliance-aware execution).
  - **Stage 3 — Multi-platform deployment:** the system schedules and deploys across all selected channels simultaneously: GHL (email), Dripify (LinkedIn outreach), SMS-iT (text), direct LinkedIn/FB/IG posts, Workable (recruiting job postings + candidate communication). Cross-channel timing is coordinated (no contact gets simultaneous email+SMS+LinkedIn outreach within a configurable cooldown window).
  - **Stage 4 — Live monitoring + bidirectional sync (the most critical capability):**
    - **GHL ↔ Stewardly:** when a contact's lifecycle stage advances in GHL (prospect → lead → client), Stewardly's contact record updates. When a Stewardly user updates client data via wealth engine, GHL contact reflects the change.
    - **LinkedIn engagement ↔ GHL:** when a prospect engages with a LinkedIn post (like, comment, message reply, profile visit), Dripify captures it, the event flows to Stewardly, and GHL contact lifecycle stage advances accordingly. Connection request accepted in Dripify creates/updates a GHL contact.
    - **LinkedIn profile/page changes ↔ Stewardly:** profile or company-page edits made via Stewardly are pushed to LinkedIn (where API permits) and reflected back. Page post engagement metrics (impressions, clicks, comments, shares) flow to Stewardly analytics. Employee advocacy adoption tracked.
    - **Workable ↔ GHL ↔ Stewardly (recruiting):** new applicant in Workable → creates/updates Stewardly candidate record + GHL contact at "sourced" stage. Stage progression in either system propagates to the other. Hire decision in Workable triggers Stewardly onboarding workflow assignment + learning path enrollment.
    - **Email engagement ↔ GHL ↔ all surfaces:** when an email is opened/clicked/replied via GHL, the engagement event updates the contact's lifecycle stage AND triggers downstream actions (next sequence step, SMS follow-up, LinkedIn touch). Dropped from R-sequence if they book.
    - **SMS ↔ GHL:** SMS-iT delivery/read/reply events sync to GHL. SMS reply triggers immediate notification to the advisor + auto-pause of further outbound on that contact.
    - **Calendar/event ↔ GHL ↔ campaigns:** when a contact books a meeting (via Calendly/GHL booking), they're auto-removed from active drip sequences and added to "active conversation" workflow. When they attend an event (per Event Schedule database), engagement is logged and post-event campaign triggers.
    - **Wealth engine ↔ Command center:** when an advisor opens a wealth engine plan for a contact, the contact record reflects "active engagement"; when a plan is shared with the contact (per Rule 15 view sharing), GHL logs the touch.
  - **Stage 5 — Analytics + iteration:** per-campaign dashboards show: sends/delivered/opens/clicks/replies/conversions per channel + per template + per segment + per region. AI-suggested optimizations: "your A3 social-proof email has 22% lower open rate than B3 — consider rotating subject lines" / "LinkedIn carousel #4 has highest engagement; consider amplifying with paid spend." / "candidates from Workable source X convert at 2.3× the rate of source Y — concentrate sourcing there."
- **Coordinated cross-channel orchestration:** can a single campaign use email + SMS + LinkedIn + paid ads + Workable simultaneously with coordinated timing? Does the system prevent over-contact (e.g., never send email + SMS + LinkedIn DM to the same contact within 24 hours unless explicitly enabled)?

*AI-driven and management:*
- **AI-driven campaign and recruiting operations:** Phase 4 agent drives end-to-end workflows: "Launch a recruiting campaign for AZ Region 3 — pull eligible candidates from prospect database, post job to Workable + LinkedIn Jobs + Indeed, segment outreach by experience tier, personalize and schedule multi-channel deployment, monitor responses, advance candidates through Workable pipeline, hand off engaged candidates to me for interviews." → agent reviews database, segments (using user-defined or predefined segments), creates Workable job posting, selects templates, personalizes, schedules, monitors, hands off.
- **Layered management dashboards:** each org layer has appropriate dashboard (MD: team + pipeline + campaign performance + cross-region rollup + Workable hiring pipeline; team lead: team metrics + assigned campaigns + onboarding candidate progress; advisor: own contacts + campaigns + tasks).

**Phase 5 specific guidance:**

- **README reconciliation first.** Stewardly-command-center may contain stale property-management boilerplate from its origin. Reconcile against actual code on Pass 1. Strip non-Stewardly content; preserve Stewardly-relevant architecture.
- **Multitenancy is architectural, not cosmetic.** Every database query, every API route, every UI surface must be tenant-scoped. Implement row-level security or equivalent. Test with ≥2 simulated tenants.
- **Progressive disclosure applies per Rule 15:** Level 1: contact list + basic campaign creation from existing templates + predefined segment selection. Level 2: multi-channel campaigns + pipeline management + content editing + custom segment creation + LinkedIn profile editing. Level 3: automation rules + A/B testing + cross-channel orchestration + AI-assisted content generation + Workable integration + dynamic segmentation with compound logic. Level 4: full AI-orchestrated end-to-end campaigns + AI-driven recruiting + AI-suggested segment discovery ("Run a recruiting campaign for me, autonomously, until 5 qualified candidates have booked discovery calls").
- **Bidirectional sync is the differentiator.** Most CRM/marketing platforms are unidirectional (CRM → outbound channels). Stewardly's command center is bidirectional across ALL platforms — every channel reports back to GHL, every CRM update flows to channels, LinkedIn profile changes round-trip, Workable candidate progressions sync both ways. This means: (a) webhook/event subscription infrastructure is critical; (b) idempotency is required (same event arriving twice doesn't double-update); (c) conflict resolution rules are needed (if two channels report conflicting state on the same contact in the same minute, define resolution); (d) sync status is user-visible (contact card shows "Last GHL sync: 2 minutes ago, last Workable sync: 5 minutes ago, last LinkedIn sync: synced"); (e) sync failures surface as actionable alerts, not silent.
- **LinkedIn profile/page management has API constraints.** LinkedIn's official API restricts what third-party tools can do with profiles vs pages. For profile edits, the system may need to: (a) use approved partner API endpoints where available; (b) leverage Phase 4 agent's browser-operator capability for actions LinkedIn doesn't expose via API (e.g., editing About sections, managing Featured content); (c) fall back to "draft and copy-paste" workflow where automation isn't possible — generate the content, present it to the user, let them paste into LinkedIn manually. Document which actions are automated vs assisted vs manual.
- **Workable integration uses Workable's REST API.** Standard ATS operations are supported: create/update jobs, list candidates, update candidate stage, attach notes, schedule interviews, send candidate communication, fetch analytics. Per Rule 12, mock fallback simulates Workable when credentials are unavailable.
- **Dynamic segmentation needs careful UX.** Segment building can become a power-user-only feature if the UI is poorly designed. Provide: (a) starter segments (predefined and templated common ones); (b) visual query builder (no SQL required) with drag-drop conditions; (c) preview ("this segment currently contains 247 contacts") before saving; (d) test runs against the segment before sending real campaigns. AI can suggest useful segments based on user behavior ("you frequently filter for AZ + pre-retiree + email-engaged — want to save this as a segment?").
- **Content asset library uses the same Rule 15 sharing model as everything else.** Templates created at the org level are available to all (read-only). MDs can fork/customize for their region. Advisors can fork for their personal use. Forks track lineage (you can see "this template was originally from the org library, customized by MD Penn on 2026-04-01").
- **Integration credentials:** check `docs/reference/` and `.env.example` for delivered credential placeholders. GHL, Dripify, LinkedIn, SMS-iT, Workable all require API keys / OAuth tokens. Per Rule 12, mock fallback simulates: contact CRUD, campaign creation, message sending (logged but not actually sent), engagement events (synthetic data on a schedule), analytics with synthetic data, candidate pipeline progression, profile updates.
- **The 180 drip emails are HTML files ready for GHL deployment.** Don't re-author them — adapt the existing HTML to use GHL's merge fields, preserve the segment/sequence/stage taxonomy, and preserve the optimization (these went through 5+ optimization passes).
- **Recruiting workflow integrates with Phase 2 onboarding.** When a Workable hire decision is logged, the system automatically: (a) creates the new user account in stewardly-ai with role-appropriate feature permissions per Rule 15; (b) assigns the appropriate onboarding workflow (per Phase 2's hierarchical workflow assignment); (c) enrolls them in role-specific learning paths (per Phase 2's library content); (d) notifies the assigned manager and onboarding owner; (e) provisions any pre-configured templates and shared resources at their hierarchy level.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND command center structure fully inherited AND multitenancy demonstrated with ≥2 tenants AND content asset library imported with ≥95% completeness AND canonical lifecycle stages (Outbound 8-stage, Inbound 12-stage, Partner 7-stage, Event 8-stage) implemented exactly per the live v4 spreadsheets AND tier/region taxonomy (4 tiers, 9 regions) preserved as first-class attributes AND cross-file reference relationships enforced as DB foreign keys (not denormalized) AND Event Schedule surface operational with all 7 tabs (Event Summary, Master Event Schedule, Opportunity Organizations, Recruiting Pipeline, Region Summary, Organizations Directory, Limitations & Gaps) AND end-to-end campaign lifecycle demonstrated (ideation → AI content generation → multi-platform deployment → bidirectional sync → analytics) on ≥1 complete campaign AND bidirectional sync demonstrated for ≥6 platform pairs (GHL↔LinkedIn engagement, GHL↔email events, GHL↔SMS replies, GHL↔Workable candidates, LinkedIn profile/page round-trip, Google Sheets↔contact DB) AND LinkedIn profile/page management demonstrated (≥1 profile edit + ≥1 page post + ≥1 employee advocacy coordination) AND Workable integration demonstrated end-to-end (job posting → candidate sourcing → pipeline progression → hire → Phase 2 onboarding workflow auto-trigger) AND ≥3 user-defined custom segments demonstrated (created, used in a campaign, shared per Rule 15) AND coordinated cross-channel cooldown demonstrated (no over-contact).

---

### Phase 6 — Data Integrations / Pipelines / Scraping / Ingestion / Modeling
*Including Empower, EveryDollar, and Plaid-adjacent personalized capabilities*

**Why sixth:** Integrations feed live data into Phases 2-5 surfaces. Phase 4's agent provides browser-operator infrastructure.

**On entry:**
1. Read `docs/reference/FINANCIAL_DATA_TOOLS_TIERED.md`.
2. Inventory current integrations.
3. Compare against: (a) P0 list (Plaid, edgartools/EDGAR, FRED, GLEIF+OpenFIGI, NAIC+FFIEC), (b) consumer PFM apps (Empower, EveryDollar, Monarch, YNAB, Tiller), (c) command center integrations (GHL API, Dripify API).
4. Generate gap list.

**Score criteria (generate 5-8):**
- **P0 integrations:** all 5 functional (Plaid, edgartools, FRED, GLEIF+OpenFIGI, NAIC+FFIEC).
- **Consumer PFM integration:** ≥1 path to Empower/EveryDollar/similar enabling client data ingestion (direct API, Plaid middleware, agent-driven browser scraping, or CSV import fallback).
- **Data freshness + failover:** current data, stale detection, graceful degradation per Phase 1 patterns.
- **Unified pipeline:** normalized ingestion from API, scraper, CSV, PFM app into common schema feeding wealth engine + AI + command center.
- **Cost-tier compliance:** Tier 0/1 from 🟢 FREE sources only.
- **Agent-driven ingestion:** Phase 4 agent drives ≥1 data retrieval workflow.
- **Cross-platform data flow:** ingested data flows correctly across all surfaces (holdings in Retirement + Tax + Estate + CRM simultaneously).

**Phase 6 specific guidance:**
- **Empower/EveryDollar/PFM integration is a differentiator.** "Empower + EveryDollar covers 60-70% of consumer PFM market at $0." Even CSV import is valuable. Consider: Plaid for banking aggregation (paid), Empower's Yodlee-backed free data (no public API — agent browser-operator may be the integration path), EveryDollar manual entry export, Monarch/YNAB REST APIs.
- **Plaid is the only true P0 paid integration.** Implement pipeline with CSV fallback if credentials unavailable.
- **Agent-driven scraping replaces brittle custom scrapers.** Browser-operator adapts to page changes visually.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND P0 integrations functional or architecturally ready AND ≥1 PFM integration path demonstrated AND zero stale-data incidents.

---

### Phase 7 — Holistic Optimization + Best-vs-Comparables Audit
*Comprehensive competitive audit, cross-surface optimization, gap closure*

**Why seventh:** Phases 1-6 build individual capabilities. Phase 7 audits the app holistically against competitors — not surface-by-surface but as an integrated product.

**On entry:**
1. Deploy full app to preview.
2. Walk through as 5 personas (new advisor, power-user MD, client on shared link, compliance reviewer, mobile-only).
3. Side-by-side with top comparables per category:
   - Wealth engine: RightCapital, eMoney, MoneyGuidePro, Holistiplan, FP Alpha.
   - AI/agent: Manus, Claude Code, Claude.ai, ChatGPT, Perplexity.
   - CRM/marketing: GHL standalone, Wealthbox, Redtail, Salesforce FSC.
   - Recruiting/ATS: Workable standalone, Lever, Greenhouse, JazzHR (Stewardly's recruiting must match or exceed core ATS capabilities + the integration with broader campaign/CRM is the differentiator).
   - Learning: Kitces.com, CFP Board CE, in-house BD training.
   - Integrations: Orion, Envestnet/Tamarac, Addepar.
4. Generate gap and strength lists.

**Score criteria (generate 5-8):**
- **Cross-surface integration quality:** seamless data flow across engine → AI → command center → learning. **Sharing model consistent across all surfaces** — same sharing UI, same permission model, same hierarchy scoping. An item shared in the engine looks and works the same as an item shared in the command center. **Feature-level access control coherent** — a feature disabled for a user in one surface is also properly hidden/disabled in all related surfaces (e.g., if Premium Financing is disabled for a user, it's hidden in the wealth engine, not surfaced by AI recommendations, and not included in learning recommendations).
- **Competitive parity per category:** at parity or superior on core capabilities vs best comparable per category.
- **Progressive disclosure consistency (holistic):** unified pattern across entire app with global + per-surface level control.
- **Performance under load:** multiple surfaces active, integrations connected, AI active, agent task running — app stays responsive.
- **Onboarding-to-productivity:** <15 minutes from first login to productive wealth engine use.
- **Mobile holistic experience:** full app walkthrough on 390×844 is first-class.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND zero "clearly inferior" verdicts on core capabilities AND ≥5 cross-surface integration flows demonstrated AND mobile walkthrough passes.

---

### Phase 8 — Documentation + Test Suite + Comprehensive User Guide
*In-app docs, codebase docs, comprehensive user guide, failover documentation, exhaustive virtual-user test suite*

**Why last:** Documentation describes what's built. User guide requires full feature knowledge. Test suite requires stable features.

**On entry:**
1. Inventory in-app help, tooltips, onboarding text, contextual docs.
2. Inventory codebase docs (README, API, architecture, deployment).
3. Inventory test suite.
4. Identify gaps against Phases 1-7 work.

**Score criteria (generate 5-8):**
- **Comprehensive user guide:** covers every capability, step-by-step with screenshots, progressive disclosure levels, failover/degraded operation, org hierarchy setup, custom workflow creation, **user/platform management across layers (Rule 15), how to share/omit content items, how to share views and dashboard configurations, how to control feature-level access for team members (enable/disable features, set progressive disclosure levels, manage aspect visibility), how to audit permission changes, how to manage team visibility, how to set up new-hire onboarding permissions (restricted feature set → graduated unlock), how to run end-to-end campaigns from ideation through bidirectional sync (campaign creation, AI content generation, multi-platform deployment, monitoring, cross-platform sync troubleshooting), how to manage LinkedIn profiles and company pages from within Stewardly, how to use the Workable ATS integration for recruiting (job posting, candidate pipeline, hire-to-onboard auto-trigger), how to create and use dynamic user-defined segments (visual query builder, dynamic vs static, segment sharing per Rule 15), how to manage candidate/prospect/client lifecycles (stage transitions, downstream action triggers, cross-team handoffs, reviews and notes)**. Accessible in-app (searchable) and as exportable PDF.
- **In-app contextual help:** every major feature has tooltip, help panel, or "learn more" link.
- **Codebase docs:** README (setup, architecture, deploy), API docs (every endpoint), architecture doc (dependency graph, data flow).
- **Failover documentation:** every external dependency's failover path documented — what fails, what the user sees, what still works, how to work around it, how it recovers.
- **Unit tests:** ≥80% of business logic functions including: every wealth engine calculation, every AUM override cascade path, every sharing permission check, every feature-access-control decision, every multitenancy data-isolation filter.
- **Integration tests:** every Phase 6 integration has happy-path + error-path + stale-data-detection tests. Every Phase 5 platform integration (GHL, Dripify, LinkedIn outreach + profile/page, SMS-iT, Workable, calendar/booking) has mock-based integration tests covering happy path + error path + bidirectional sync idempotency.
- **Visual regression tests:** Playwright screenshot comparison between passes. For every core surface (≥20 surfaces covering all phases), capture a baseline screenshot at 3 viewports. On every subsequent test run, compare against baseline. Flag pixel-difference above threshold (configurable, default 0.1%) as visual regression. This catches: unintended layout shifts, broken spacing, missing elements, color changes, font changes, animation glitches. Baselines update when intentional visual changes are committed (tagged in commit message).
- **Performance tests:** for every core surface, measure: first meaningful paint (target <2s on 3G, <200ms for Tier 0 Instant), time to interactive, cumulative layout shift (target 0), largest contentful paint, memory usage after 5 minutes of interaction (no leaks — memory should plateau, not climb). Run via Playwright with network throttling (slow 3G profile). Log results to `artifacts/tests/performance/`. Regressions above 20% from baseline are test failures.
- **Accessibility tests:** run axe-core (via @axe-core/playwright) on every core surface. Zero critical or serious violations. Keyboard-only navigation test: Playwright tabs through every interactive element on each surface and verifies focus order is logical and every action is keyboard-reachable.

**Persona-based E2E test suite (Playwright-driven, 10 personas × specific flows):**

Each persona test is a complete Playwright script that: logs in as the persona (with appropriate hierarchy layer and feature permissions), walks a realistic primary flow, validates functional correctness AND UI/UX quality at all 3 viewports, and reports pass/fail with annotated screenshots.

| # | Persona | Layer | Test flow | Key assertions |
|---|---------|-------|-----------|----------------|
| 1 | **Cold new advisor (first login)** | Individual | Sign up → onboarding flow starts automatically → complete ≥3 onboarding steps → navigate to wealth engine → Tier 0 Instant view loads → configure deeper to Tier 1 → save first plan → navigate to learning → see recommended modules based on role | Onboarding auto-starts; progressive disclosure at Level 1 (no advanced features visible); Tier 0 loads <200ms; save/load works; learning recommendations are role-appropriate; mobile viewport is touch-friendly |
| 2 | **Monday-morning returning advisor** | Individual | Login → dashboard shows this week's tasks and client priorities → open a client's retirement plan → modify an assumption → recalculate → compare 2 scenarios side-by-side → export to PDF → check AI chat for "prep me for my 2pm meeting" → receive context-aware prep brief | Dashboard loads quickly with relevant data; calculation updates instantly on input change; PDF export produces clean output; AI chat has client context without re-prompting; all at desktop viewport |
| 3 | **Mid-meeting laptop advisor** | Individual | Already logged in → navigate to client's plan → enter quick inputs → Tier 1 quick-check generates result → share result screen with client via shared link → client link shows view-only plan without full app access | Quick-check produces result in <3s; share generates working link; shared link is view-only with no navigation to other features; works at 1440×900 |
| 4 | **Mid-meeting phone advisor** | Individual | Mobile viewport (390×844) → navigate via mobile nav → open Tier 0 Instant for 3 different surfaces (Retirement, Protection, Tax) → each shows single-output result → one-thumb reachability verified → switch to AI chat → voice-to-text hypothetical → streaming response renders correctly on mobile | All Tier 0 surfaces load <200ms; no horizontal scroll; touch targets ≥44px; streaming chat renders without layout jump on mobile |
| 5 | **Power-user MD (multi-region)** | MD/RVP | Login → regional dashboard shows team production rollup + pipeline + override economics → drill into a specific team → view team member's production → model "add 3 advisors at X production" → view hierarchy cascade impact → navigate to command center → create a campaign template → share it with region → check learning module completion rates across team → assign a workflow to a new hire | Hierarchy data is correct and scoped; override cascade math matches formula (26.375% default); campaign sharing works; learning completion rolls up by team; workflow assignment appears in new hire's account; all work at desktop; drill-down works without page reload |
| 6 | **Client on shared link** | Client (view-only) | Click shared link → see only the specific shared plan/report → NO navigation to full app → NO access to other clients, other features, or the AI → can view, scroll, and read the plan → can download/print if permitted → responsive at all 3 viewports | Shared link is scoped to exactly the shared item; no feature leakage; no data leakage; permission level (view/comment/edit) is correctly enforced; works on mobile |
| 7 | **Skeptical CFO / due diligence reviewer** | Individual | Login → navigate to a complex strategy (Premium Financing) → view practitioner-grade detail → access the due diligence summary → verify all claims have citations → click through to reference sources → export due diligence package as PDF → check the reference panel for authority-tier and recency tags | Due diligence summary exists with all required fields; references are citable and tagged; PDF export includes citations; reference panel is searchable and filterable |
| 8 | **Compliance reviewer** | Org admin | Login → view permission audit log → verify recent permission changes are logged → check that a compliance-restricted feature (Premium Financing) is correctly hidden for restricted users → attempt to access restricted feature via direct URL → receive 403 → review AI agent's compliance flags on a recent task → export compliance report | Audit log shows all permission changes; feature restriction enforced at URL level (not just UI); AI agent's compliance flags are visible and accurate; export produces clean report |
| 9 | **Slow-connection rural user** | Individual | Playwright with slow-3G network throttling → login → navigate to 5 core surfaces → verify each loads within acceptable time (Tier 0 <500ms on 3G, Tier 1 <3s, Tier 2 <5s) → verify failover indicators show when integrations are slow ("Using cached data") → verify no surfaces crash or hang → verify images lazy-load and don't block interaction | Performance within thresholds; failover indicators appear appropriately; no crash/hang; lazy loading works; core functionality available even on slow connection |
| 10 | **Accessibility-dependent user** | Individual | Playwright keyboard-only mode (no mouse clicks) → tab through entire app → verify every interactive element is reachable → verify focus indicators are visible → verify ARIA labels are present → verify screen-reader-compatible structure (headings, landmarks, alt text) → complete a full workflow (navigate to engine → enter data → calculate → save) using only keyboard → run axe-core → zero critical/serious violations | Every element keyboard-reachable; focus visible; ARIA complete; axe-core passes; full workflow completable without mouse |

**UI/UX quality assertions embedded in every persona test:**
Beyond functional correctness, each test also validates:
- **Progressive disclosure consistency:** the persona's Level setting (Level 1 for new advisor, Level 3 for power-user MD) correctly filters what's visible. No advanced features leak into Level 1. No features are missing from Level 3+ that should be there.
- **Animation/transition smoothness:** Playwright measures frame timing on route transitions and panel switches. Janky transitions (frame drops >50ms gap) are flagged.
- **Visual system coherence:** automated check that card padding, heading sizes, and spacing match the design system tokens (extract computed styles via Playwright, compare against design-system constants).
- **Error state rendering:** each test includes ≥1 deliberate error trigger (bad input, network failure mock, permission denied) to verify error states render correctly with user-friendly messages, not blank screens or raw error dumps.
- **Empty state rendering:** each test navigates to a surface that has no data yet (new user's dashboard, empty client list) to verify empty states have guiding content ("No clients yet — add your first client" rather than a blank table).

**Test suite execution and reporting:**
- All tests run via `npx playwright test` with HTML reporter generating `artifacts/tests/report.html`.
- Screenshots committed to `artifacts/tests/screenshots/[persona]-[viewport]-[surface].png`.
- Performance metrics committed to `artifacts/tests/performance/[surface]-[viewport].json`.
- Visual regression diffs committed to `artifacts/tests/visual-regression/[surface]-diff.png`.
- The Phase 4 agent can also execute the test suite as a virtual user (per earlier guidance), providing a second validation layer — the automated Playwright tests validate structure/timing/assertions, while the agent validates "does this feel right as a user?"

**Phase 8 specific guidance:**
- **Playwright is the primary E2E testing infrastructure.** Install with all 3 browser engines (Chromium, Firefox, WebKit). Configure viewports at 390×844, 820×1180, 1440×900. Use `@axe-core/playwright` for accessibility. Use Playwright's built-in network throttling for slow-3G performance tests. Use `page.screenshot()` for visual regression baselines. Use `page.evaluate()` to extract computed styles for design-system coherence checks.
- **Every persona test is a self-contained Playwright spec file** at `tests/e2e/personas/persona-[N]-[name].spec.ts`. Each file contains the full flow from the persona table above, with assertions at every step. Tests are parameterized by viewport (each persona × 3 viewports = 30 test runs from 10 personas).
- **Leverage Phase 4 agent for exploratory testing beyond scripted scenarios.** Playwright covers scripted happy paths and key edge cases. The Phase 4 agent runs unscripted exploratory walkthroughs: "Walk through the entire app as a new advisor and report anything confusing, broken, or ugly." Agent findings → logged as issues → scripted tests added to prevent regression.
- **User guide is a product feature.** Interactive, embedded videos/GIFs, progressive disclosure (quick-start → reference → advanced). Must also document the testing/monitoring tools so a platform admin can run the test suite.
- **Failover docs are critical for AFK operation.** Every user must understand "why is this showing cached data?" and "what can I do while LLM is down?"
- **Architecture doc includes dependency graph** showing cross-surface data flow, feature permission enforcement points, and test coverage mapping (which tests cover which surfaces/features).

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND user guide complete (in-app + PDF) AND failover paths documented for every external dependency AND full Playwright E2E suite passes (10 personas × 3 viewports = 30 runs, zero failures) AND visual regression baseline established with zero unintended diffs AND performance benchmarks captured with zero threshold violations AND axe-core accessibility passes with zero critical/serious violations AND zero documentation gaps for shipped features.

---

## AFTER ALL EIGHT PHASES — POST-CONVERGENCE CYCLES

First time all 8 phases complete, run **full-sweep validation:**

1. Fresh clone. Clean install. Full test suite passes including Playwright E2E persona suite (10 personas × 3 viewports = 30 runs, zero failures).
2. Deploy to preview. Full walkthrough at all 3 viewports.
3. Side-by-side: AI Mode 3 vs Manus (7 tasks), Mode 2 vs Claude Code (5 tasks), Mode 1 vs Claude.ai (5 conversations), engine vs RightCapital (5 scenarios), command center vs GHL (3 campaigns).
4. Cross-surface round-trip: chat → agent → engine → command center → learning.
5. Visual regression: zero unintended diffs. Performance: zero threshold violations. Accessibility: axe-core zero critical/serious.
6. Re-score all criteria from scratch.
7. Fix regressions. Emit `CONVERGED_FLOOR.md`.
8. **Floor (≥8) is a milestone, not a stop.**

### Post-convergence escalation cycles

**Cycle 1 — Excellence (≥9).** Emit `CONVERGED_EXCELLENT.md`.
**Cycle 2 — Best-in-class (≥10 or 9-capped with external reason).** Side-by-side ≥75% superior. Emit `CONVERGED_BEST_IN_CLASS.md`.
**Cycle 3 — Queue promotion.** P1 taxonomy → must-have. P1 integrations (Empower deep, OpenBB, Wealthbox/Redtail) → must-have. Manus benchmarks expand 7→15. Through Cycles 0→1→2. Emit `CONVERGED_P1_PROMOTED.md`.
**Cycle 4 — Continuous deepening (the permanent state).** P2→P1 promotion, 9-capped re-attempts, 50-pass competitive refresh against current versions of all reference products (Manus, Claude Code, Claude.ai, RightCapital, GHL), landscape scanning for newly-emerging capabilities worth adding. **Cycle 4 has no convergence condition.** It runs indefinitely — assessing, optimizing, building, validating — until the user returns with a stop signal or the 1-hour stall condition triggers per Termination Condition #4. The loop's natural state is running, not stopped.

---

## PASS STRUCTURE (every pass, every phase)

Every pass is a complete **assess → optimize/build → validate → ship** cycle. All four activities happen every pass. No pass does only one.

```
## Pass N · Phase P · Criterion: [lowest-scoring] · Score before: X/10

--- ASSESS ---
1. Pull latest. Read scores. If N%5==0, cross-phase regression check (Rule 9).
2. Re-examine all criteria. Identify lowest-scoring must-have. If multiple tied, pick the one with highest user-impact.
3. Branch: 1-3 (absent) → build-from-zero (Rule 14). 4-7 (rough) → worst sub-feature fix. 8-9 → push toward next tier. 10 → scan for regression risk, competitive gap, or queue-promotable item.

--- OPTIMIZE / BUILD ---
4. Plan (1-3 sentences). If building from zero, define MVP increment.
5. Implement. Ship observable work — never plan-only.
6. Run tests (lint, type-check, build, Playwright suite per Rule 13). Fix anything that breaks before proceeding.

--- VALIDATE ---
7. Visual validate at 3 viewports (390×844, 820×1180, 1440×900). Screenshot before/after.
8. Virtual-user walkthrough (Playwright automated or manual). Confirm no regression. Confirm the change actually improves the targeted criterion from a user's perspective, not just technically.
9. If any regression detected: fix it NOW, before commit. Do not commit regressions.

--- SHIP ---
10. Commit: `pass-[N] · phase-[P] · [description]`
11. Re-score all criteria for current phase (with user-observable evidence per scoring rules).
12. Log: which criterion improved, by how much, what evidence supports the score change.
13. Phase advancement check: all must-have ≥8 × 3 consecutive → commit PHASE_[P]_EXIT.md, advance. Else: continue.

## Pass N+1 · Phase P · ...
[immediately continues — no pause, no summary, no reflection paragraph]
```

**The loop never idles.** If a criterion is at 10 and the executor can't find an obvious improvement, it doesn't stop looking — it tries fresh novel approaches: (a) rebuilds a component with a different architecture to see if it's faster/cleaner, (b) re-benchmarks against the latest version of a competitor, (c) promotes a P1/P2 item and builds the MVP, (d) re-runs the Playwright suite with new edge-case scenarios, (e) redesigns a surface from a different persona's perspective, (f) deepens a due-diligence reference with additional citations. Each attempt is a full pass that ships observable work or reverts if it regresses. Only after ≥1 hour of these active attempts all failing to improve does the stall condition trigger per Termination Condition #4.

---

## SCORING MECHANICS

**1-3:** Absent. **4-5:** Significant issues. **6-7:** Rough. **8:** Production-quality. **9:** Excellent. **10:** Best-in-class.

Phase exit threshold is ≥8. Post-convergence cycles target ≥9, then ≥10. Score by **weakest sub-feature on a common path**. Every score cites user-observable evidence. Gaming prevention: oscillating scores lock at lower value pending shipped evidence.

**What work looks like at each score range (since the loop never stops):**
- **At 1-3:** Build from zero (Rule 14). Construction work — the capability doesn't exist yet.
- **At 4-7:** Fix and polish. Find worst sub-feature, improve it. Standard improvement work.
- **At 8:** Production-quality but not delightful. Push toward 9: add edge-case handling, improve animations, tighten performance, refine copy/microcopy, add contextual help, improve empty states, smooth transitions.
- **At 9:** Excellent but not best-in-class. Push toward 10: competitive benchmark refresh (does Manus do this better now?), advanced feature additions, delight details (micro-interactions, surprise-and-delight moments), deep accessibility polish, performance optimization beyond thresholds.
- **At 10:** Best-in-class on current benchmarks. Work shifts to: competitive landscape monitoring (has a competitor shipped something that makes our 10 a 9?), P1/P2 queue promotion (add capabilities that weren't must-have before), stability hardening (can the test suite catch more edge cases?), documentation depth, cross-surface integration polish, user-guide enrichment. **A criterion at 10 is not "done" — it's "best right now."**

---

## PARITY MEASUREMENT METHODOLOGY

Per benchmark: (1) define identically, (2) execute stewardly-ai first, (3) execute reference, (4) score: completeness (binary), quality (1-10), speed (seconds), UX friction (count). **Superior:** ≥3/4 higher. **Parity:** ±1, none >2 lower. **Inferior:** ≥2 dimensions >2 lower. Exit requires zero inferior, ≥50% superior. Document in `artifacts/parity-comparisons/`.

---

## DIMINISHING RETURNS + STUCK PROTOCOL

Stuck at 7 for 5+ passes → `7-capped:<reason>` if external dependency. Stuck at ≤6 → architectural reassessment. Steps: split criterion, change approach, check upstream, log to `BLOCKED_ON.md`, follow diminishing returns if 5+ passes.

---

## REFERENCE DOCS PER PHASE

| Phase | Primary references |
|---|---|
| 1 (UI/UX) | Existing codebase + design system |
| 2 (Learning) | `mwpenn94/emba_modules` + compressed library folder |
| 3 (Wealth Engine) | HTML + inventory + taxonomy + axes + financial data tools |
| 4 (Unified AI) | Manus + Claude Code + Claude.ai + OpenClaw + Devin + Cursor + ChatGPT + Gemini + Perplexity |
| 5 (Command Center) | `mwpenn94/stewardly-command-center` + `MANUS_PROMPT_COMMAND_CENTER.md` |
| 6 (Integrations) | `FINANCIAL_DATA_TOOLS_TIERED.md` + Phase 4 agent |
| 7 (Holistic Audit) | All above + competitive products |
| 8 (Docs/Tests) | All above + codebase |

---

## FORBIDDEN BEHAVIORS

**CRITICAL — KNOWN FAILURES FROM PRIOR MANUS RUNS (top priority to prevent):**
- ❌ Building an AI surface that is just a redirect or placeholder page. The AI surface must accept input, call an LLM (or mock), and stream real responses. A page that says "AI Studio" but does nothing is a Phase 4 score of 1.
- ❌ Building a Manus clone that doesn't mirror Manus UI/UX. The executor must open manus.im, screenshot it, and build functional equivalents of: task input, plan display, real-time execution view, artifact delivery.
- ❌ Building a Claude Code clone that doesn't mirror Claude Code UI/UX. The executor must open Claude Code, screenshot it, and build: terminal aesthetic, diff rendering, file tree, inline execution output.
- ❌ Leaving AUM/advisory and affiliate channels without production planning/funnel analysis widgets equivalent to the insurance tracks' widgets.
- ❌ Not implementing the AUM override cascade (p² + p − 1/3 = 0 → 26.375%). This is critical business logic — test it with specific numbers.
- ❌ Having zero strategy/approach surfaces in the wealth engine. Domains A-D (Practice Management, Client Planning, Advanced Strategies, Rich References) must have FUNCTIONAL surfaces, not just nav entries.
- ❌ Placing Client Profile inside Practice Management. It belongs under Client Planning within the wealth engine's page-internal nav.
- ❌ Adding a stock ticker or market data ticker to the top of the app. Remove immediately if present.
- ❌ Letting admin pages disappear. Test admin page accessibility after every nav-touching pass.
- ❌ Inconsistent sidebar expand/collapse — all sections must behave the same.
- ❌ Leaving the learning surface visually unchanged — if a user can't see the difference (interactive graphical aids, quiz engine, flashcards, personalization controls), the work hasn't shipped.
- ❌ Not incorporating stewardly-command-center at all. The command center is an entire phase; skipping it is a Phase 5 score of 1 on every criterion.
- ❌ Settings nav that is inaccessible on mobile or doesn't show all items.

**GENERAL FORBIDDEN BEHAVIORS:**

- ❌ Stopping after one pass.
- ❌ Asking "should I continue?"
- ❌ Stopping because "convergence reached" — convergence milestones are logged, not termination signals.
- ❌ Stopping because all criteria are at 10 — refresh benchmarks, promote queue items, harden stability instead.
- ❌ Triggering the 1-hour stall after passive assessment only — the hour must be filled with ≥6 distinct active improvement attempts, each a fresh novel approach, all documented in `STALLED.md`.
- ❌ Assessment without shipping code.
- ❌ Scoring 8+ on first assessment.
- ❌ Skipping phases.
- ❌ Planning-only passes.
- ❌ Ignoring mobile.
- ❌ Breaking existing functionality.
- ❌ Committing without tests.
- ❌ Shipping a Phase 2+ pass without the corresponding Playwright E2E test additions per Rule 13.
- ❌ Marking a persona E2E test as "passing" when it skips assertions or catches errors silently.
- ❌ Disabling visual regression or performance checks to make the suite pass faster.
- ❌ Closing criterion without evidence.
- ❌ Skipping cross-phase regression checks.
- ❌ Advancing without `PHASE_[N]_EXIT.md`.
- ❌ Silently modifying prompt intent — log to `PROMPT_AMENDMENTS.md`.
- ❌ Polishing while must-haves sit at 1-3.
- ❌ Treating 1-3 as low priority.
- ❌ "No observable change possible" — ship a route, indicator, toggle, or endpoint.
- ❌ Building three separate AI surfaces instead of one consolidated surface with modes.
- ❌ Hardcoding calculation defaults, override rates, or strategy parameters.
- ❌ Ignoring multitenancy in command center surfaces.
- ❌ Skipping failover/degraded-mode paths for external dependencies.
- ❌ Building a separate permission/sharing system per surface — Rule 15 sharing is ONE system consumed by all surfaces.
- ❌ Exposing data to users outside their hierarchy scope without explicit sharing.
- ❌ Allowing sharing permission downgrades without the owner's action (e.g., auto-removing access).
- ❌ Showing a disabled/restricted feature in one surface while hiding it in another — feature access control must be coherent across ALL surfaces including AI recommendations, learning suggestions, and navigation items.
- ❌ Allowing users to bypass progressive disclosure level restrictions set by their hierarchy manager.
- ❌ Building unidirectional channel→CRM sync — every channel must report back to GHL bidirectionally per Phase 5.
- ❌ Sending overlapping outreach (email + SMS + LinkedIn) to the same contact within the configured cooldown window without explicit override.
- ❌ Re-authoring the 180 drip emails or other production-ready content from `WealthBridge_Final_Package__1_.zip` — these went through 5+ optimization passes; adapt them to GHL merge fields, don't rewrite.
- ❌ Skipping the engagement event sync (LinkedIn engagement, email opens, SMS replies, calendar bookings, Workable candidate progression must all flow back to GHL contact lifecycle stage updates).
- ❌ Treating LinkedIn as outreach-only — profile/page management is a first-class capability, not optional.
- ❌ Treating Workable as a stand-alone integration disconnected from CRM/onboarding — hire decisions must auto-trigger Phase 2 onboarding workflows + learning path enrollment + Rule 15 feature permission grants.
- ❌ Hardcoding only the predefined segments (residential/commercial/regions) — dynamic user-defined segmentation must be a first-class capability with persistence, sharing, and dynamic vs static evaluation.
- ❌ Building lifecycle stages as a single linear pipeline — different contact types (prospect/candidate/partner/client/affiliate/event) need their own lifecycle stages while still being unified in one contact record.
- ❌ Renaming or reordering the canonical lifecycle stages from the v4 spreadsheets (Outbound 8-stage, Inbound 12-stage, Partner 7-stage, Event 8-stage) — these are the source of truth; the executor can add stages or add metadata but cannot drift from the canonical sequence.
- ❌ Flattening cross-file references (Engagement ↔ Prospect ↔ Candidate ↔ Combined Pipeline ↔ Event ↔ Executive Summary) into denormalized copies — preserve as actual database relationships with referential integrity.

---

Begin. Pull `mwpenn94/stewardly-ai`. Pull `mwpenn94/emba_modules`. Pull `mwpenn94/stewardly-command-center`. Extract `WealthBridgeLibraryv11_QA.zip` and inventory all 81 files. Extract the 6 marketing asset zips (`WealthBridge_180_Drip_Campaign_Emails__3_.zip`, `WealthBridge_Final_Package__1_.zip`, `WealthBridge_Final_Deliverables_v4__4_.zip`, `WealthBridge_v5_1_CTA_Enhanced.zip`, `WealthBridge_v3_Final.zip`, `07_SMS_Scripts.zip`) and inventory all marketing/CRM assets for Phase 5 inheritance. Read the strategy taxonomy and leader persona archetypes. Assess Phase 1 state. Generate criteria. Score. Start fixing the lowest-scoring criterion. Ship. Continue.