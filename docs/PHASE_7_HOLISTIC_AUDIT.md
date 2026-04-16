# Stewardly Phase 7 — Holistic Optimization + Best-vs-Comparables Audit

> **Target repo:** `mwpenn94/stewardly-ai`
> **Phase:** 7 of 8
> **Scope:** Cross-surface integration quality, comprehensive competitive audit, progressive disclosure coherence, performance under load, mobile holistic experience, gap closure
> **Prior phases:** All 1-6 complete. Read all `PHASE_*_EXIT.md` files.

---

## CORE RULES

Same as prior phases. **Anti-regression:** ALL phases 1-6 must not regress. **Commits:** `pass-[N] · phase-7 · [description]`

---

## WHAT PHASE 7 DOES

Phase 7 does NOT build new capabilities. Phases 1-6 build the individual capabilities. Phase 7 steps back and audits the app **holistically** — as an integrated product, not surface-by-surface. This is where cross-surface rough edges, competitive gaps, integration seams, and inconsistencies get caught and fixed.

---

## COMPETITIVE AUDIT

Deploy the full app. Walk through as 5 personas (new advisor, power-user MD, client on shared link, compliance reviewer, mobile-only user). Side-by-side with top comparables per category:

| Category | Top comparables | What to benchmark |
|---|---|---|
| Wealth engine | RightCapital, eMoney, MoneyGuidePro, Holistiplan, FP Alpha | Planning depth, calculation accuracy, UX polish, progressive disclosure |
| AI/agent | Manus, Claude Code, Claude.ai, ChatGPT, Perplexity | Response quality, streaming UX, agent task completion, code capabilities |
| CRM/marketing | GHL standalone, Wealthbox, Redtail, Salesforce FSC | Contact management, campaign lifecycle, automation, reporting |
| Recruiting/ATS | Workable standalone, Lever, Greenhouse, JazzHR | Pipeline management, candidate communication, hiring workflow |
| Learning | Kitces.com, CFP Board CE, in-house BD training | Content depth, interactivity, personalization, progress tracking |
| Integrations | Orion, Envestnet/Tamarac, Addepar | Integration breadth, data freshness, cross-surface flow |

**The audit is honest.** If RightCapital does tax planning better, log it. If Manus executes faster, log it. The goal is to close every real gap.

---

## CROSS-SURFACE INTEGRATION CHECKS

The primary Phase 7 work. These end-to-end flows must work flawlessly:

1. **Chat → Agent → Engine → Command Center → Learning:**
   Chat about a client → agent runs their retirement analysis → results appear in command center CRM → learning module recommends relevant training based on analysis

2. **Campaign → Contact lifecycle → Wealth engine:**
   Launch email campaign → prospect opens → lifecycle advances → advisor notified → opens wealth engine plan for the prospect → engagement logged in command center

3. **Workable → Onboarding → Learning:**
   Hire decision in Workable → Stewardly creates user account → onboarding workflow assigned → learning modules enrolled → manager notified

4. **Sharing across surfaces:**
   MD creates a wealth engine template → shares with region → team lead customizes → shares with client as view-only → client sees ONLY the shared plan, no other features

5. **Feature access coherence:**
   Admin disables Premium Financing for a user → feature disappears from wealth engine nav → AI stops recommending it → learning stops suggesting related modules → direct URL returns 403

---

## PROGRESSIVE DISCLOSURE COHERENCE (holistic check)

Across the ENTIRE app — not just individual surfaces:
- Can a user set "Level 1" globally and have EVERY surface respect it?
- Can a power user enable "Level 3" and see everything without being overwhelmed?
- Is the disclosure pattern visually consistent (same toggle treatment, same animation, same layout shift behavior)?
- Do per-surface overrides work (Level 2 globally, Level 3 on wealth engine only)?

---

## PERFORMANCE UNDER REAL-WORLD CONDITIONS

With multiple surfaces open, integrations connected, AI chat active, and agent task running:
- App stays responsive (no UI freezes, no cascading failures)
- Memory doesn't leak (5-minute interaction → memory plateaus, doesn't climb)
- Navigation between surfaces is instant (<200ms)
- No layout shifts when surfaces load data

---

## EXIT CRITERIA

- [ ] All criteria ≥8 × 3 consecutive passes
- [ ] Competitive audit documented with zero "clearly inferior" verdicts on core capabilities
- [ ] ≥5 cross-surface integration flows demonstrated end-to-end
- [ ] Progressive disclosure coherent across entire app (Level 1 and Level 3 tested holistically)
- [ ] Mobile holistic walkthrough passes (390×844, every section)
- [ ] Performance under load acceptable (no freezes, no memory leaks, <200ms nav transitions)
- [ ] Feature access control coherent across all surfaces (disabled feature truly invisible everywhere)
- [ ] Phases 1-6 have not regressed

**Emit `PHASE_7_EXIT.md`.**

---

Begin. Deploy full app. Walk through as each of 5 personas. Run competitive audit. Identify gaps. Fix. Ship. Continue.
