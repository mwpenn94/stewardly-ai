# Stewardly Phase 8 — Documentation + Test Suite + Comprehensive User Guide

> **Target repo:** `mwpenn94/stewardly-ai`
> **Phase:** 8 of 8
> **Scope:** In-app contextual help, codebase documentation, comprehensive user guide (in-app + PDF), failover documentation, Playwright E2E test suite (10 personas × 3 viewports), visual regression, performance benchmarks, accessibility, architecture docs
> **Prior phases:** All 1-7 complete. Read all `PHASE_*_EXIT.md` files.

---

## CORE RULES

Same as prior phases. **Anti-regression:** ALL phases 1-7 must not regress.

---

## WHAT PHASE 8 BUILDS

Phase 8 documents what's built and creates the automated test suite that validates it. This is the only phase where documentation-only passes are acceptable.

---

## COMPREHENSIVE USER GUIDE

A single, navigable guide covering EVERY capability. Accessible both in-app (searchable) and as exportable PDF.

**Must cover:**
- Every wealth engine surface (Practice Management, Client Planning, Advanced Strategies, References) with step-by-step and screenshots
- All 3 AI modes (Chat, Code, Agent) with examples of each
- Command center: contacts, campaigns, LinkedIn management, Workable, events, segmentation
- Learning: modules, quiz engine, flashcards, personalization, workflows
- Progressive disclosure: what each level shows, how to change, how managers set ceilings
- User/platform management: hierarchy setup, sharing/omitting items, view sharing, feature toggling, permission audit
- Campaign lifecycle: ideation through bidirectional sync troubleshooting
- Failover/degraded operation: what happens when each external dependency fails, what still works, how to work around it, how it recovers
- Custom workflow creation and assignment
- Dynamic segmentation: creating segments, using in campaigns, sharing
- Candidate/prospect/partner/client lifecycle management: stage definitions, transition triggers, reviews, handoffs

**The guide is a product feature.** Interactive, embedded videos/GIFs, progressive disclosure (quick-start → detailed reference → advanced configuration).

---

## FAILOVER DOCUMENTATION

For EVERY external dependency (LLM API, GHL, Plaid, Dripify, LinkedIn, SMS-iT, Workable, FRED, EDGAR, etc.):
- What happens when it fails
- What the user sees (the Phase 1 failover indicator)
- What capabilities are reduced
- What the user can still do
- How the system recovers when the dependency returns
- Troubleshooting steps

Both in-app (status indicators + inline guidance) and in the user guide.

---

## PLAYWRIGHT E2E TEST SUITE

**Infrastructure:** Playwright with Chromium + Firefox + WebKit. 3 viewports: 390×844, 820×1180, 1440×900. `@axe-core/playwright` for accessibility.

**File structure:** `tests/e2e/personas/persona-[N]-[name].spec.ts`

**Execution:** `npx playwright test` with HTML reporter → `artifacts/tests/report.html`

**10 personas × 3 viewports = 30 test runs:**

| # | Persona | Layer | Flow | Key assertions |
|---|---|---|---|---|
| 1 | Cold new advisor | Individual | Sign up → onboarding → wealth engine Tier 0 → save plan → learning recommendations | Onboarding auto-starts; Level 1 only; Tier 0 <200ms; save works; recommendations role-appropriate |
| 2 | Monday-morning advisor | Individual | Dashboard → client plan → modify → recalculate → compare scenarios → PDF export → AI chat "prep me for meeting" | Dashboard loads with data; calc updates instantly; PDF clean; AI has client context |
| 3 | Mid-meeting laptop | Individual | Tier 1 quick-check → share result with client via link → client link is view-only | Quick-check <3s; share works; shared link view-only, no full app access |
| 4 | Mid-meeting phone | Individual | Mobile nav → Tier 0 ×3 surfaces → AI chat with streaming on mobile | No horizontal scroll; touch targets ≥44px; streaming renders on mobile |
| 5 | Power-user MD | MD/RVP | Regional dashboard → team drill-down → override cascade → campaign template → share with region → workflow assignment → learning completion rates | Hierarchy correct; 26.375% override validates; sharing works; completion rolls up |
| 6 | Client on shared link | Client | Click shared link → see ONLY shared plan → no navigation, no other data | Scoped exactly; no feature leakage; no data leakage; works on mobile |
| 7 | Skeptical CFO | Individual | Premium Financing → due diligence summary → citations → reference sources → PDF export | Due diligence exists; citations present; PDF includes citations |
| 8 | Compliance reviewer | Org admin | Permission audit log → feature restriction check → direct URL 403 → AI compliance flags | Audit log complete; restriction enforced at URL level; AI flags visible |
| 9 | Slow-connection rural | Individual | 3G throttle → 5 surfaces → performance within thresholds → failover indicators → no crash | Tier 0 <500ms on 3G; failover shows; no hang; lazy-load works |
| 10 | Accessibility user | Individual | Keyboard-only → full workflow (nav → engine → input → calculate → save) → axe-core | Every element reachable; focus visible; ARIA complete; axe-core zero critical/serious |

**Each persona test also validates:**
- Progressive disclosure: persona's Level setting filters correctly
- Error state: ≥1 deliberate error trigger → user-friendly message (not blank/crash)
- Empty state: navigate to surface with no data → guiding content (not blank table)
- Animation smoothness: no >50ms frame gaps on route transitions

---

## ADDITIONAL TEST TYPES

**Visual regression:** screenshot comparison per surface × viewport. 0.1% pixel-diff threshold. Baselines update on intentional visual commits.

**Performance:** FMP <2s on 3G (<200ms Tier 0), TTI, CLS target 0, LCP, memory plateau after 5 min.

**Accessibility:** axe-core zero critical/serious. Keyboard-only full workflow. Focus order logical.

**Unit tests:** ≥80% of business logic (calculations, permissions, lifecycle transitions, segment evaluation).

**Integration tests:** every P6 integration + every P5 platform has happy + error + sync-idempotency tests.

---

## CODEBASE DOCUMENTATION

- **README:** setup, architecture overview, deployment, contribution guide
- **API docs:** every endpoint / tRPC procedure with types, examples, error codes
- **Architecture doc:** dependency graph showing cross-surface data flow, feature permission enforcement points, test coverage mapping
- **Phase-order rationale:** which surfaces depend on which, shown visually

---

## POST-CONVERGENCE CYCLES

After Phase 8 exits, the full app has been built, tested, and documented. The post-convergence cycles continue improving:

**Cycle 1 — Excellence (≥9):** Re-enter the lowest-scoring phase at the ≥9 bar. Emit `CONVERGED_EXCELLENT.md`.
**Cycle 2 — Best-in-class (≥10 or 9-capped):** Side-by-side ≥75% superior. Emit `CONVERGED_BEST_IN_CLASS.md`.
**Cycle 3 — Queue promotion:** P1 taxonomy → must-have. Expanded benchmarks. Through Cycles 0→1→2. Emit `CONVERGED_P1_PROMOTED.md`.
**Cycle 4 — Continuous deepening:** Permanent. P2→P1 promotion, 9-capped re-attempts, 50-pass competitive refresh. No convergence condition — runs until user stops or 1-hour active-attempt stall.

To run a cycle: re-paste the relevant phase prompt at the higher bar.

---

## EXIT CRITERIA

- [ ] All criteria ≥8 × 3 consecutive passes
- [ ] Comprehensive user guide complete (in-app searchable + exportable PDF)
- [ ] Failover paths documented for every external dependency
- [ ] Full Playwright E2E suite passes (10 personas × 3 viewports = 30 runs, zero failures)
- [ ] Visual regression baseline established with zero unintended diffs
- [ ] Performance benchmarks captured with zero threshold violations
- [ ] axe-core accessibility zero critical/serious violations
- [ ] Zero documentation gaps for shipped features
- [ ] Phases 1-7 have not regressed

**Emit `PHASE_8_EXIT.md` + `CONVERGED_FLOOR.md`.**

---

Begin. Read all prior exit files. Inventory current docs and tests. Score. Build the lowest-scoring. Ship. Continue.
