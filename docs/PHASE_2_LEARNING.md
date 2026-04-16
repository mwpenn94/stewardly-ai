# Stewardly Phase 2 — Learning / Training / Onboarding / Custom Workflows

> **Target repo:** `mwpenn94/stewardly-ai`
> **Phase:** 2 of 8
> **Scope:** Learning surface with full content import (emba_modules + 81-file library), rich interactive media, personalization, quiz engine, flashcards, custom workflows with hierarchy-based assignment
> **Prior phases:** Phase 1 (UI shell, progressive disclosure framework, sharing UI components, failover patterns) must be complete. Read `artifacts/PHASE_1_EXIT.md` for context.
> **Executor:** Manus (or any agentic executor with browser, terminal, and file-system access)

---

## CORE RULES (apply to every pass)

1. **Run continuously.** Assess → optimize/build → validate → ship, repeated.
2. **Every pass ships observable work.** No planning-only passes.
3. **Self-score honestly.** 5-8 criteria, must-have/nice-to-have. Score 1-10. Work lowest first. Exit at all must-have ≥8 × 3 consecutive.
4. **Visual evidence.** Screenshots at 3 viewports committed to `artifacts/pass-N/`.
5. **Anti-regression absolute.** Lint, type-check, build, test every pass. Phase 1 must not regress.
6. **Act as a real user.** Virtual-user walkthrough every pass.
7. **Commits:** `pass-[N] · phase-2 · [description]`
8. **Build-from-zero:** score 1-3 = construct. Don't defer must-haves.
9. **Prompt amendments:** log to `docs/PROMPT_AMENDMENTS.md`.

**Termination:** (1) User stop. (2) Platform limit → `HANDOFF.md`. (3) Merge-gate → `BLOCKED_ON.md`. (4) 1-hour active stall with ≥6 novel attempts → `STALLED.md`.

---

## KNOWN EXECUTION FAILURE — THE MOST CRITICAL ANTI-PATTERN

In prior Manus runs, **the learning surface appeared COMPLETELY UNCHANGED to users** despite the prompt specifying rich media and personalization. The executor either skipped Phase 2's content work entirely or made backend changes that never surfaced in the UI.

**This is the #1 failure mode for Phase 2: if the user cannot see the difference, the work hasn't shipped.**

After every Phase 2 pass, perform this verification:
1. Open the app in an incognito/fresh browser — no cached state.
2. Log in as a new user (or create a test account).
3. Navigate to the Learning section.
4. **Can you see modules organized by exam domain?** (not a flat list, not empty)
5. **Can you see interactive graphical aids inline within at least 1 module?** (not just text — an actual interactive diagram, chart, or visualization)
6. **Can you interact with the quiz engine?** (take a quiz, see score, see it tracked)
7. **Can you use flashcards?** (flip a card, mark known/unknown, shuffle)
8. **Can you see personalization controls?** (bookmark, difficulty toggle, "mark irrelevant", recommendations panel)
9. **Does rich media load on mobile (390×844)?** (not broken, not off-screen, touch-interactive)

If any of these are "no," the relevant criterion scores ≤3 regardless of backend state.

---

## WHAT PHASE 2 BUILDS

The learning surface is where new advisors start. It must be engaging, content-rich, and personalized — not a static documentation page. Phase 2 transforms whatever exists into a living knowledge base with:

1. **Full content import** from emba_modules repo + 81-file compressed library
2. **Rich interactive media** embedded inline within modules
3. **Functional quiz engine** with scoring, tracking, mastery assessment
4. **Interactive flashcards** with spaced repetition
5. **Personalization** — bookmarks, goals, difficulty, AI recommendations
6. **Custom workflows** with hierarchy-based assignment per Rule 15

---

## CONTENT TO IMPORT

### Source 1: `mwpenn94/emba_modules` repo
Clone/pull this repo. Inventory its module hierarchy, categories, lesson ordering. This structure is the floor — inherit it exactly before extending.

**If inaccessible:** log to `BLOCKED_ON.md`, proceed on internal assessment + library content, flag for user.

### Source 2: `WealthBridgeLibraryv11_QA.zip` (81 files, 7 directories)

**`Manuals_TTS/` — 12 TTS-optimized study manuals (.docx):**
Life & Health, P&C, General Insurance, Surplus Lines, Series 7, Series 66, SIE, CFP, Estate Planning, Financial Planning, Investment Advisory, Premium Financing.

**How to import:** Extract text content. Create a learning module per manual. Render as readable, scrollable content within the learning surface (not a download link). Support audio playback or text-to-speech for the TTS variants.

**`Manuals_Visual/` — 12 visual/complete study manuals (.docx) with embedded graphics:**
Same 12 domains, but with inline graphical aids for visual learners.

**How to import:** Extract text + images. Create learning modules that display the visual aids inline alongside the text. Images become interactive where appropriate (e.g., the Tax Bracket Waterfall becomes a slider-driven visualization).

**`HTML_Training_Modules/` — 13 interactive HTML training modules:**
12 domain-specific modules + `WealthBridge_Quiz_Engine.html` (cross-domain quiz engine).

**How to import:** These are self-contained HTML apps. **Do NOT serve as raw iframes.** Adapt each into stewardly-ai's component framework (React or equivalent). The quiz engine becomes a first-class learning feature integrated with the progress tracking system.

**The Quiz Engine specifically:**
- Multi-domain quizzing (user selects domain or takes cross-domain assessments)
- Per-question scoring with immediate feedback
- Per-user score history (persistent across sessions)
- Per-domain mastery tracking (% of questions answered correctly, improving over time)
- Adaptive difficulty (serve harder questions as mastery increases)
- Integration with Phase 2 progress tracking (quiz completion updates module progress)

**`Graphics/` — 20 PNG graphical aids:**
Capital Market Flow, Yield Curve Shapes, Bond Price-Yield Seesaw, Options Payoff, Regulatory Ecosystem, Account Types, Options Strategy Matrix, Underwriting Spread, Risk-Return Spectrum, Sharpe vs Treynor, CFP Planning Process, Tax Bracket Waterfall, Trust Decision Tree, GRAT Mechanics, Life Insurance Spectrum, Needs Analysis, Homeowners Forms, Coinsurance Penalty, Combined Ratio, Risk Management Matrix.

**How to import:** Each maps to a specific exam domain and module. Embed inline within the corresponding module. Where appropriate, make interactive:
- **Tax Bracket Waterfall** → slider-driven visualization (user adjusts income, sees brackets fill)
- **Trust Decision Tree** → clickable decision tree (user answers yes/no, tree highlights the path)
- **Options Payoff** → interactive payoff diagram (user selects strategy, chart updates)
- **Risk-Return Spectrum** → hover/click on asset classes for details
- **GRAT Mechanics** → animated flow diagram showing how assets transfer
- Remaining graphics: at minimum display inline with zoom capability; interactive versions are nice-to-have

**`Flashcards/` — 12 flashcard sets (.txt):**
One per domain. Import as interactive flip-card components:
- **Flip animation** — click/tap flips the card
- **Shuffle** — randomize order
- **Mastery marking** — mark each card known/unknown; track mastery per card
- **Spaced repetition** — cards marked "unknown" reappear more frequently
- **Per-user progress** — persistent across sessions
- **NOT static text** — if it looks like a bulleted list of Q&A pairs, it's wrong

**`Reference/verified_tax_numbers.md`:**
Current tax brackets, limits, thresholds. Import into:
- Phase 2: learning reference material (linkable from tax-related modules)
- Phase 3: wealth engine defaults (shared data layer — both surfaces consume the same source)

**`Tools/` — `MASTER_BUILD_PLAN.md`, `MANUS_PROMPT_Graphical_Aids.md`, `mb_class.py`, `emba_design.py`:**
Read for architectural guidance. Adapt where applicable.

### Source 3: Strategy taxonomy + leader persona archetypes

**10 leader personas** — each gets a dedicated learning module:
| Persona | Archetype | Module teaches |
|---|---|---|
| Jim Simons | Quantitative/Systematic | Data-driven portfolios, factor investing, rules-based rebalancing |
| Warren Buffett | Value Investing | Fundamental analysis, moats, long-horizon, concentrated equity |
| Peter Lynch | Growth Investing | Bottom-up research, "tenbagger" hunting, sector specialization |
| Dave Ramsey | Behavioral/Simplicity | Debt aversion, behavior coaching, simple accumulation |
| Ray Dalio | Macro/Risk-Parity | Global diversification, all-weather, regime modeling |
| Nelson Nash | Insurance-Centric/IBC | Permanent insurance as banking, policy loans, tax-advantaged accumulation |
| HNW Estate Planners | Premium Finance/Estate | Bank-financed premiums, ILIT, multi-generational transfer |
| CFP Fiduciaries | Holistic Planning | Goals-based, cash-flow mapping, retirement sequencing, 5-axis coverage |
| Modern CIOs | Alternatives/Private Markets | Private credit, PE, illiquidity premium, non-correlated |
| FIRE Leaders | Financial Independence | Extreme savings, low-cost indexing, early retirement |

Each module: who they are → what they believe → how it applies to advisory practice → which clients it fits → **cross-link to the relevant wealth engine surface** (Phase 3) where the approach is modeled.

**12 strategy categories** form the organizing structure for advanced advisory training:
Core Planning, Insurance-Driven, Investment-Driven, Tax, Estate/Legacy, Business Owner, Retirement Income, Premium Financing, Retirement Plan/Employer, Advanced Wealth, Client Acquisition, AI-Enabled Advisory.

---

## PERSONALIZATION

**User-controlled personalization features (must be visible in the UI):**
- **Bookmarks** — save any module/lesson for quick access
- **Learning goals** — set goals ("complete Series 7 prep by June")
- **Difficulty/depth adjustment** — toggle between introductory / intermediate / advanced content within a module
- **Mark irrelevant** — hide modules not relevant to the user's practice (e.g., a pure insurance agent marks "Series 7" as irrelevant)
- **Recommendations panel** — AI-powered (if Phase 4 available) or rule-based: "Based on your role (new advisor) and completion history, I recommend the Life & Health module next"

**AI-powered recommendations (when Phase 4 is available):**
"Based on your client book (heavy on pre-retirees) and your recent work (Roth conversion analysis), I recommend the 'Sequence of Returns Risk' module and the Ramsey behavioral approach for your debt-burdened clients."

**When Phase 4 is NOT yet available:** use rule-based recommendations (role + experience level + completion history + what modules in the same domain are popular).

---

## CUSTOM WORKFLOWS (Rule 15 hierarchy-based)

Workflows are sequences of steps that can be created, assigned, and tracked through the organizational hierarchy.

**Who can create workflows:** any user at any layer (individual → team lead → MD → RVP → admin). Workflows are visible to the creator's subtree.

**Who can assign workflows:** the creator can assign to anyone in their subtree.
- **Required assignment** — appears in the recipient's task list, completion tracked, rolls up to manager dashboard
- **Proposed/invited assignment** — recipient can accept or decline

**What a workflow contains:** ordered steps, each of which can be:
- A learning module (user must complete the module)
- A task (user marks done, optionally with evidence)
- A form (user fills and submits)
- A document upload (user uploads a file)
- An external link (user visits and confirms)
- A quiz assessment (user achieves minimum score)

**Step completion:** self-reported OR verifiable (quiz score, document uploaded, form submitted).

**Completion rollup:** team lead sees which direct reports have completed; MD sees team-level rates; org admin sees org-level rates.

**Sharing per Rule 15:** workflows are shareable, omittable, fork-able. An MD's "New Hire Onboarding" workflow can be shared org-wide as a template; another MD can fork and customize for their region.

**Example workflows to validate:**
1. "New Advisor Onboarding" — 12 steps: welcome module → compliance training → Life & Health study → quiz assessment (≥80%) → shadow a mentor meeting → submit first fact-find → manager review → Series 66 prep → quiz assessment → first client meeting observed → 30-day review → 90-day review
2. "Annual CE Compliance" — 4 steps: complete required CE modules → pass CE quiz → upload CE certificate → manager attestation
3. "Recruiting Pipeline" — 6 steps: identify candidate → initial outreach → discovery meeting → WB overview → senior leadership intro → offer decision

---

## SCORE CRITERIA (generate 5-8 from actual state)

- **Structure inheritance:** does the learning surface mirror emba_modules' organizational structure?
- **Content completeness:** % of 81-file library content imported/adapted. Target ≥90%.
- **Rich media inline:** do ≥3 modules contain interactive graphical aids VISIBLE INLINE (not download links, not separate pages)?
- **Quiz engine functional:** can a user take a quiz, see scoring, see tracked mastery per domain?
- **Flashcards interactive:** can a user flip, shuffle, mark known/unknown? Is progress tracked?
- **Personalization visible:** are bookmarks, difficulty toggle, "mark irrelevant," and recommendations panel visible and functional?
- **Custom workflows functional:** can an MD create a workflow, assign it to an advisor, and see completion status?
- **Cross-linking to engine:** do ≥5 learning modules link to relevant wealth engine surfaces?
- **Mobile learning:** does the learning surface work well on 390×844 (not just render — interactive elements are usable)?

---

## EXIT CRITERIA

- [ ] All must-have criteria ≥8 × 3 consecutive passes
- [ ] emba_modules structure fully inherited
- [ ] Library content fully inventoried with ≥90% imported/adapted
- [ ] All 12 exam domains represented with ≥2 content formats each
- [ ] Quiz engine functional with per-user score tracking and per-domain mastery
- [ ] Flashcards interactive (flip, shuffle, mastery marking, spaced repetition)
- [ ] ≥3 modules with rich interactive media VISIBLE INLINE (verified with fresh user account)
- [ ] ≥1 custom workflow demonstrated across 2+ user layers with hierarchy-based assignment
- [ ] Sharing/permissions demonstrated on ≥3 learning items (using Phase 1's sharing UI kit)
- [ ] Personalization controls visible and functional (bookmarks, difficulty, recommendations)
- [ ] Phase 1 has not regressed (spot-check nav, progressive disclosure, admin pages)

**Emit `PHASE_2_EXIT.md`** with: all criteria scores, evidence references, known risks for Phase 3, recommended first-action for Phase 3.

---

Begin. Read `artifacts/PHASE_1_EXIT.md`. Pull `mwpenn94/emba_modules`. Extract `WealthBridgeLibraryv11_QA.zip`. Inventory all 81 files. Assess the current learning surface. Generate criteria. Score. Build the lowest-scoring. Ship. Continue.
