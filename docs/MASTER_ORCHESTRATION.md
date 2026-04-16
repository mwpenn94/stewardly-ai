# Stewardly Build Loop — Master Orchestration

> **Target repo:** `mwpenn94/stewardly-ai`
> **Additional repos:** `mwpenn94/emba_modules` (learning), `mwpenn94/stewardly-command-center` (CRM/marketing)
> **Execution model:** One deep-dive prompt per phase, run sequentially. Each is self-contained and paste-ready for a Manus session. Complete one phase's exit criteria before moving to the next.

---

## PHASE EXECUTION ORDER

| Phase | Prompt file | Scope | Dependencies |
|---|---|---|---|
| 1 | `PHASE_1_UI_UX.md` | UI/UX foundation, progressive disclosure, failover, nav architecture, stability | None — this is the shell |
| 2 | `PHASE_2_LEARNING.md` | Learning, training, onboarding, custom workflows, rich media, personalization | Phase 1 (UI shell, progressive disclosure patterns, sharing components) |
| 3 | `PHASE_3_WEALTH_ENGINE.md` | Wealth engine: HTML inheritance, multi-channel production planning, AUM overrides, 4-domain strategy suite, continuous improvement architecture | Phase 1 (UI shell), Phase 2 (cross-linking) |
| 4 | `PHASE_4_UNIFIED_AI.md` | Unified AI surface: Chat (Claude.ai parity) + Code (Claude Code parity) + Agent (Manus parity), progressive disclosure modes, infrastructure | Phase 1 (UI shell), Phase 3 (engine surfaces for agent to orchestrate) |
| 5 | `PHASE_5_COMMAND_CENTER.md` | Command center: CRM, campaign lifecycle, Workable ATS, LinkedIn management, bidirectional sync, dynamic segmentation, marketing asset library | Phase 1 (UI shell), Phase 3 (client data), Phase 4 (AI drives campaigns) |
| 6 | `PHASE_6_INTEGRATIONS.md` | Data integrations: Plaid, FRED, EDGAR, PFM apps (Empower, EveryDollar), agent-driven scraping | Phase 4 (agent browser-operator), Phases 2-5 (consuming surfaces) |
| 7 | `PHASE_7_HOLISTIC_AUDIT.md` | Cross-surface optimization, competitive audit, integration quality, progressive disclosure coherence | All prior phases |
| 8 | `PHASE_8_DOCS_TESTS.md` | Documentation, comprehensive user guide, Playwright E2E test suite, visual regression, performance, accessibility | All prior phases |

---

## HOW TO RUN

1. **Paste Phase 1 prompt** into Manus with the reference docs and zips. Let it run until it emits `PHASE_1_EXIT.md` or hits a termination condition.
2. **Review `PHASE_1_EXIT.md`** — check criteria scores, verify the exit criteria are genuinely met (not just claimed). If not met, re-paste Phase 1 prompt with a note about what's still wrong.
3. **Paste Phase 2 prompt.** It will read `PHASE_1_EXIT.md` for context and begin Phase 2 work.
4. **Repeat for each subsequent phase.**
5. **After Phase 8,** the post-convergence cycles (≥9 → ≥10 → P1 promotion → continuous deepening) are described in Phase 8's prompt. Re-paste the relevant phase prompt at the higher bar.

---

## REFERENCE DOCS (deliver alongside every phase prompt)

- `WealthBridge-Business-Calculator-v7.6.html` — wealth engine structural + content floor
- `HTML_STRUCTURAL_INVENTORY_STARTER.md` — ~40 structural categories
- `ADVISORY_TAXONOMY_v2_AND_ENGINE_MAP.md` — ~90 approaches, 14 categories, P0/P1/P2
- `ADVISORY_OPERATING_SYSTEM_AXES.md` — 5-axis closure framework
- `AI_CAPABILITY_MATURITY_MODEL.md` — 5 maturity levels
- `FINANCIAL_DATA_TOOLS_TIERED.md` — cost-tiered sourcing reference
- `MANUS_PROMPT_COMMAND_CENTER.md` — command center integration spec
- `WealthBridgeLibraryv11_QA.zip` — 81-file learning library (Phase 2)
- 6 marketing asset zips (Phase 5)
- Strategy taxonomy + leader persona archetypes docs (Phase 2 + 3)
- `mwpenn94/stewardly-command-center` repo (Phase 5)

---

## CORE RULES (included in every phase prompt)

These 15 rules are universal — they appear in every phase prompt so the executor always has them.

1. **Run continuously** — assess → optimize/build → validate → ship, repeated until exit criteria met or termination condition fires.
2. **Every pass ships observable work** — no planning-only passes, no "I assessed and found nothing."
3. **Self-score honestly** — 5-8 criteria from actual codebase state, tagged must-have/nice-to-have. Work lowest first. Exit at all must-have ≥8 for 3 consecutive passes.
4. **Visual evidence** — screenshots at 390×844, 820×1180, 1440×900. Committed to `artifacts/pass-N/`.
5. **Anti-regression absolute** — no pass breaks anything. Tests, lint, type-check, build every pass.
6. **Act as a real user** — virtual-user walkthrough every pass. Playwright when available.
7. **Commit messages structured** — `pass-[N] · phase-[P] · [description]`
8. **Cross-phase regression checks** — every 5th pass, spot-check completed phases.
9. **Phase handoff** — emit `PHASE_[N]_EXIT.md` with scores, risks, next-action.
10. **Prompt self-amendment** — log gaps to `docs/PROMPT_AMENDMENTS.md`, don't stop.
11. **Credentials** — env vars + mocks, never hardcode, never commit `.env`.
12. **Test bootstrapping** — every pass that ships logic ships a test. Count grows monotonically.
13. **Build-from-zero** — score 1-3 means construct, not polish. MVP in as many passes as needed. Don't defer must-haves.
14. **Must-have definition** — default is must-have. Tag fixed at phase entry. No mid-phase downgrades.
15. **User/platform management (Rule 15)** — 6-layer hierarchy, granular sharing/omission, feature-level access, view sharing, aspect control, progressive disclosure as permission, audit trail. ONE sharing system consumed by all surfaces.

---

## TERMINATION CONDITIONS (same in every phase prompt)

1. **User stop** — primary expected termination.
2. **Platform hard limit** — emit `HANDOFF.md` with paste-ready continuation prompt.
3. **Merge-gate block** — emit `BLOCKED_ON.md`.
4. **1-hour active-attempt stall** — ≥1 hour since last shipped change AND ≥6 distinct novel approaches attempted during that hour, all failing to improve without regression. Document all attempts in `STALLED.md`.

---

## POST-CONVERGENCE (after all 8 phases complete)

After Phase 8 exits, run full-sweep validation, then escalation cycles:
- **Cycle 0 floor (≥8)** → `CONVERGED_FLOOR.md`
- **Cycle 1 excellence (≥9)** → `CONVERGED_EXCELLENT.md`
- **Cycle 2 best-in-class (≥10 or 9-capped)** → `CONVERGED_BEST_IN_CLASS.md`
- **Cycle 3 queue promotion (P1→must-have)** → `CONVERGED_P1_PROMOTED.md`
- **Cycle 4 continuous deepening (permanent)** — no convergence condition

To run a cycle: re-paste the relevant phase prompt(s) at the higher bar. The phase prompt's exit criteria scale to the target cycle.

---

## PHASE STATUS TRACKER

Update this as you progress:

| Phase | Status | Exit date | Notes |
|---|---|---|---|
| 1 — UI/UX | Not started | | |
| 2 — Learning | Not started | | |
| 3 — Wealth Engine | Not started | | |
| 4 — Unified AI | Not started | | |
| 5 — Command Center | Not started | | |
| 6 — Integrations | Not started | | |
| 7 — Holistic Audit | Not started | | |
| 8 — Docs/Tests | Not started | | |
