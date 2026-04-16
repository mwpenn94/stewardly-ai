# Stewardly Phase 3 — Holistic Income / Wealth Engine

> **Target repo:** `mwpenn94/stewardly-ai`
> **Phase:** 3 of 8
> **Scope:** Full HTML structural inheritance → content parity → multi-channel production planning (insurance + AUM + affiliate + custom) → AUM upline override cascade (p² + p − 1/3 = 0 → 26.375%) → 4-domain strategy/approach suite (Practice Management, Client Planning, Advanced Strategies, Rich References) → continuous improvement architecture
> **Prior phases:** Phase 1 (UI shell), Phase 2 (learning cross-links). Read `artifacts/PHASE_1_EXIT.md` and `artifacts/PHASE_2_EXIT.md`.
> **Reference docs needed:** `WealthBridge-Business-Calculator-v7.6.html`, `HTML_STRUCTURAL_INVENTORY_STARTER.md`, `ADVISORY_TAXONOMY_v2_AND_ENGINE_MAP.md`, `ADVISORY_OPERATING_SYSTEM_AXES.md`, `FINANCIAL_DATA_TOOLS_TIERED.md`

---

## CORE RULES (apply to every pass)

1. **Run continuously.** Assess → optimize/build → validate → ship, repeated.
2. **Every pass ships observable work.**
3. **Self-score honestly.** 5-8 criteria, must-have default. Score 1-10. Work lowest first. Exit at all must-have ≥8 × 3 consecutive.
4. **Visual evidence.** Screenshots at 3 viewports.
5. **Anti-regression absolute.** Phases 1-2 must not regress.
6. **Act as a real user.** Virtual-user walkthrough every pass.
7. **Commits:** `pass-[N] · phase-3 · [description]`
8. **Build-from-zero:** score 1-3 = construct, not polish.

**Termination:** (1) User stop. (2) Platform limit → `HANDOFF.md`. (3) Merge-gate → `BLOCKED_ON.md`. (4) 1-hour active stall with ≥6 novel attempts → `STALLED.md`.

---

## KNOWN EXECUTION FAILURES — ALL THREE OCCURRED IN PRIOR RUNS

### ❌ FAILURE 1: AUM/advisory and affiliate channels have NO production planning widgets
In prior runs, insurance tracks (A/B/C/D per HTML) had production planning and funnel analysis widgets, but the AUM/advisory and affiliate channels had NOTHING equivalent — no pipeline funnel, no activity metrics, no production forecasting, no ramp modeling.

**The fix:** EVERY channel must have equivalent production planning capability. If the insurance track has a funnel analysis widget, the AUM track needs:
- **AUM pipeline funnel:** prospects → discovery → proposal → investment agreement → AUM onboarded → billing active → under management
- **Activity metrics:** calls, meetings, proposals, closes — tracked per period with trend
- **Production forecasting:** based on pipeline stage and historical conversion rates
- **Ramp schedule modeling:** projected AUM growth over 12/24/36 months based on current pipeline velocity

The affiliate channel needs a similar funnel: identified → outreach → exploratory → MOU → active referrals → strategic alliance.

### ❌ FAILURE 2: AUM override calculation never implemented
The formula p² + p − 1/3 = 0 → 26.375% was specified in the prompt but NEVER implemented in the app. The override cascade either didn't exist or was non-functional.

**The fix and validation test:**
1. Create an advisor with 80% GDC retained on $1M AUM annual trails
2. The payable portion = $1M × 80% = $800K
3. The MD override at the next tier should calculate to ~26.375% of the payable portion = ~$211K
4. The tier cascade: MD/RVP earns 20% of their immediate reports' payable earnings
5. Change the GDC % to 70% → payable drops to $700K → override recalculates → entire cascade updates
6. Add 3 advisors to the team → team economics roll up → verify totals
7. If ANY of these don't work, the criterion scores 1-3 (absent/broken).

### ❌ FAILURE 3: Strategy/approach surfaces entirely non-existent
The wealth engine had basic calculators but ZERO strategy surfaces — no retirement income engineering approaches, no tax-bracket engineering, no trust engineering, no governance layer, no Monte Carlo, no practice management strategy widgets, no advanced strategy surfaces, no due diligence reference layer. The entire 4-domain strategy suite was absent.

**The fix:** These are not optional enhancements. They ARE the wealth engine's core value proposition. Score each domain A-D at 1-3 if no surfaces exist. Build via Rule 14 build-from-zero.

---

## PHASE 3 EXECUTION ORDER — HARD GATES

**Gate 1: Structural inheritance (must be 100% before Gate 2)**
Walk the `WealthBridge-Business-Calculator-v7.6.html` end-to-end. Produce `docs/HTML_STRUCTURAL_INVENTORY.md` if it doesn't exist (300-500+ rows). Every structural element in the HTML must have a match or superior implementation in stewardly-ai. The HTML has: 23 nav items, 17 citation categories, 88 reference entries, 27 ref-tip inline tooltips, 10-slot save system, forward/back planning, hierarchy cascade, holistic wealth planning engine.

**Gate 2: Content parity (must be 100% before Gate 3)**
For every surface that exists in both the HTML and stewardly-ai, given identical inputs, the outputs must match. Every input field, every calculation, every reference, every tooltip.

**Gate 3: Surpass work (Domains A-D, multi-channel production, AUM overrides)**
Only after Gates 1 and 2 are at 100%.

---

## MULTI-CHANNEL PRODUCTION PLANNING

The HTML has insurance tracks A/B/C/D + AUM + Team Override. The expanded engine adds:

### AUM/advisory channel (must-have)
- Adjustable fee schedules (% of AUM with breakpoint tiers)
- Billing frequency (quarterly, semi-annual, annual)
- Trail commission calculation (ongoing vs front-loaded)
- Upline override cascade (see AUM Override Math below)
- **AUM pipeline funnel** with stage-by-stage visualization
- **Activity metrics dashboard** (calls/meetings/proposals/closes per period)
- **Production forecasting** from pipeline + historical conversion rates
- **Ramp schedule modeling** (12/24/36 month projected AUM growth)

### Affiliate/referral channel (must-have)
- Referral fee structures (flat fee, %, revenue share)
- Revenue share percentages, payout schedules
- **Affiliate pipeline funnel** (identified → outreach → exploratory → MOU → active referrals → strategic alliance)
- **Affiliate activity metrics** (referrals sent/received/converted per period)

### Custom channels (nice-to-have for Phase 3 exit, must-have for Cycle 1)
- User-defined channels with flexible field configuration
- An advisor with a unique revenue stream (speaking fees, consulting, real estate referrals) can model it
- Each custom channel has its own pipeline funnel definition

### Roll-up unification (must-have)
All channels feed into the same totals, combined chart, P&L, and GDC brackets. The "My Plan" surface shows the complete practice picture across all channels. A user can see: "I made $X from insurance, $Y from AUM, $Z from affiliates — total GDC $W, after overrides my take-home is $V."

---

## AUM UPLINE OVERRIDE MATH (critical business logic)

**The formula:** p² + p − 1/3 = 0 has a positive root of approximately **0.26375 (26.375%)**. This is the default standard tiered upline override rate for Managing Directors and RVPs.

**Implementation:**
- For an individual advisor with X% of GDC retained (anything less than 90% individual GDC triggers upline override calculation)
- The upline at the next tier earns 20% of the advisor's payable earnings on that channel
- The 26.375% represents the blended effective override rate when computed across the hierarchy
- The hierarchy cascade flows: individual → team lead → MD/RVP → regional

**All rates must be user-adjustable:**
- Individual GDC % (default varies by contract; slider or input)
- Per-tier override % (default 20% of immediate reports' payable; adjustable)
- Number of tiers (default 3-4; expandable)
- Defaults come from the formula; user overrides persist per user

**The engine surface for this must show:**
- Hierarchy visualization (org chart showing who reports to whom)
- Per-person GDC and effective payout (after overrides)
- Per-tier override rates (with formula-derived defaults highlighted, user-customized values shown differently)
- Total team/hierarchy economics roll-up
- **"What if" modeling:** "what if I add 3 advisors to my team at $X production level?" → cascade recalculates

---

## 4-DOMAIN STRATEGY/APPROACH SUITE

### Domain A — Practice Management

Surfaces for how to run and grow a practice. Each needs a functional engine surface (not just a description), leading-persona references, and cross-links to learning modules (Phase 2).

| Strategy surface | What it models | Leading personas |
|---|---|---|
| Production optimization | Weekly structure, pipeline metrics, activity targets | Million-dollar producers, top-10% MDRT |
| Recruiting funnel | 6-stage cascade, ramp schedule, retention | Successful MDs who built 20+ teams |
| Channel diversification | Insurance vs AUM vs affiliate mix modeling with override impact | Hybrid advisors with dual books |
| Marketing/acquisition ROI | Campaign cost vs revenue, funnel economics, COI partnership modeling | Advisors who built $1M+ practices via systematic marketing |
| P&L / business economics | Practice profitability, expense management, scaling economics, break-even | Ensemble firm builders, practice management consultants |
| GDC/override optimization | Compensation structure modeling, what-if team scenarios | (Feeds from AUM override math above) |

### Domain B — Client Planning

Every P0 approach from the taxonomy must have a functional engine surface:

| Strategy surface | Key capabilities |
|---|---|
| Retirement income engineering | Buckets, floor-upside, Guyton-Klinger guardrails, SS claiming optimization, Medicare planning |
| Tax-bracket engineering | Roth conversion ladder, tax-efficient withdrawal sequencing, asset location |
| Protection suite | LTC, DI, annuity income flooring — with needs analysis and product comparison |
| Stock-based comp / concentration | RSU/ISO/ESPP analysis, diversification strategies, 10b5-1 planning |
| Balance-sheet view | Aggregated net worth, asset allocation, liability management |
| Debt-side management | Mortgage optimization, student loan strategies, debt paydown modeling |
| Trust engineering | SLAT, IDGT, GRAT, CRT, QPRT, dynasty — each with when-to-use decision framework |
| Governance layer | IPS generator, leverage governance matrix — framework for managing advisor-client relationship |
| Monte Carlo engine | Probability-weighted scenario analysis for retirement, investment, planning outcomes |

Best-practice client workflows per domain: discovery → analysis → presentation → implementation → review. Each has "how the best advisors do this" reference with leading personas.

Per the 5-axis closure framework (Return/Risk/Behavior/Governance/Purpose): the approach-selection engine surfaces a coaching note when a plan underweights an axis.

### Domain C — Advanced Strategies (practitioner-grade detail)

| Strategy surface | What it must cover |
|---|---|
| Premium financing design | Full design process: carrier selection, collateral structuring, exit strategy modeling, stress testing, governance framework |
| ILIT/trust structuring | Each trust type with: when-to-use decision tree, implementation checklist, common-mistake notes, tax implications |
| Executive compensation | Split-dollar (endorsement vs collateral), §162 bonus, SERP, NQDC — side-by-side comparison, tax implications, client-ready summaries |
| Charitable planning | DAF, CRT, CLT, private foundation, QCD — with tax modeling, donor-impact analysis |

References: AALU case studies, Leimberg information services, tax code citations (§162, §409A, §1035, §7702, §1202, etc.), carrier product guides.

### Domain D — Rich References for digest and due diligence

Every strategy in the engine is backed by citable references:

- **Practice management references:** industry benchmarking (MDRT, NAIFA, FPA surveys), compensation studies, recruiting best practices
- **Advanced strategy references:** AALU, Leimberg, estate planning journals, tax code sections, carrier guides
- **Due diligence summaries:** for every strategy, a 1-page summary: what it is, who it's for, risks, compliance considerations, alternatives, authoritative citations
- **Searchable, filterable** by domain/topic/authority-tier
- **Auto-updatable** via Phase 6 integrations and Phase 4 AI

**Minimum exit requirement:** ≥10 due diligence summaries completed for the most common strategies.

---

## CONTINUOUS IMPROVEMENT ARCHITECTURE

**No hardcoded values.** Every calculation default, reference citation, strategy model parameter, tax bracket, mortality table, and interest rate is stored in a configurable data layer (DB, config, API-sourced). When Phase 6 integrations deliver fresh data (new FRED rates, new IRS brackets), the surfaces update automatically. When Phase 4 AI identifies a new strategy insight, it can propose a parameter update for advisor review.

**`verified_tax_numbers.md`** feeds both Phase 2 (learning reference) and Phase 3 (engine defaults) via a shared data layer. Update once, both surfaces reflect.

---

## SHARING PER RULE 15

Calculator plans, client scenarios, strategy comparisons, advisor templates, practice management models, due diligence summaries, and reference collections are all shareable items. Use Phase 1's sharing UI components. An MD shares a "recommended retirement analysis template" with their region. An advisor shares a client plan with their team lead for review.

---

## SCORE CRITERIA (generate 5-8 from actual state)

- **Structural inheritance rate:** % of HTML elements matched. Target 100%.
- **Content parity rate:** % of HTML calculations matched. Target 100%.
- **Multi-channel production planning:** are AUM and affiliate channels present WITH production planning widgets equivalent to insurance tracks? (funnel, metrics, forecasting, ramp)
- **AUM override cascade functional:** does the formula-derived 26.375% default calculate correctly? Does the cascade recalculate on input change? Does what-if modeling work?
- **Domain A (Practice Management):** how many of the 6 strategy surfaces are functional?
- **Domain B (Client Planning):** how many P0 approaches have functional surfaces?
- **Domain C (Advanced Strategies):** how many of the 4 advanced strategy surfaces have practitioner-grade detail?
- **Domain D (References/Due Diligence):** are ≥10 due diligence summaries complete? Is the reference system searchable?
- **Continuous improvement readiness:** are defaults sourced from configurable data layer (not hardcoded)?

---

## EXIT CRITERIA

- [ ] Structural inheritance 100%
- [ ] Content parity 100%
- [ ] Multi-channel production planning functional with ≥3 channels (insurance + AUM + affiliate minimum), each with pipeline funnel + activity metrics + production forecasting
- [ ] AUM upline override cascade correct with formula-derived 26.375% default, recalculates on input change, what-if modeling works (validated with the specific test: 80% GDC on $1M → $800K payable → ~$211K MD override)
- [ ] All P0 taxonomy approaches have functional surfaces (Domain B)
- [ ] Practice management domain (Domain A) has ≥3 functional strategy surfaces with persona references
- [ ] Advanced strategies domain (Domain C) has practitioner-grade detail for ≥3 strategies
- [ ] Due diligence summaries (Domain D) exist for ≥10 strategies
- [ ] Sharing demonstrated for ≥2 engine items
- [ ] Feature-level access control demonstrated (≥1 feature toggled per hierarchy layer)
- [ ] No hardcoded defaults — all via configurable data layer
- [ ] All must-have criteria ≥8 × 3 consecutive passes
- [ ] Phases 1-2 have not regressed

**Emit `PHASE_3_EXIT.md`.**

---

Begin. Read `artifacts/PHASE_2_EXIT.md`. Read `WealthBridge-Business-Calculator-v7.6.html`. Produce the structural inventory if it doesn't exist. Assess the current wealth engine. Score. Build the lowest-scoring. Ship. Continue.
