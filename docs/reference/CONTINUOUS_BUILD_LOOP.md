# Stewardly Continuous Build Loop — Execution Engine (paste-ready)

> **Target repo:** `mwpenn94/stewardly-ai`
> **Executor:** Manus (or any agentic executor with browser, terminal, and file-system access)
> **Purpose:** Continuous, autonomous optimization across 8 phases in strict sequence. Runs until user returns with stop signal.
> **Reference docs (all in repo at `docs/reference/` or delivered alongside):**
> - `WealthBridge-Business-Calculator-v7.6.html` — scope #4 structural + content floor
> - `HTML_STRUCTURAL_INVENTORY_STARTER.md` — ~40 structural categories to extend exhaustively
> - `ADVISORY_TAXONOMY_v2_AND_ENGINE_MAP.md` — ~90 approaches, 14 categories, P0/P1/P2
> - `ADVISORY_OPERATING_SYSTEM_AXES.md` — 5-axis closure framework (Return/Risk/Behavior/Governance/Purpose)
> - `AI_CAPABILITY_MATURITY_MODEL.md` — 5 maturity levels (retrospect → automated)
> - `FINANCIAL_DATA_TOOLS_TIERED.md` — cost-tiered sourcing reference (🟢/🟡/🔴)

---

## CORE RULES

1. **Run continuously.** Do not stop after one pass. Do not ask "should I continue?" Do not summarize and wait. The only reasons to stop are the four termination conditions below.

2. **Phase-ordered execution.** Eight phases in strict sequence. Each phase runs until its exit criteria are met, then the next begins. No skipping. No rotation. The ordering is intentional — later phases depend on earlier phases being stable.

3. **Every pass ships observable work.** Every iteration produces at minimum one user-visible change committed to the repo. No planning-only passes. No documentation-only passes (except Phase 8). No "I assessed and found nothing to do" passes.

4. **Self-score honestly.** On entering each phase, generate 5-8 specific, measurable criteria from the actual codebase state (not from imagination). Score each 1-10. Work the lowest-scoring criteria first. Re-score after each pass. Phase exit requires all criteria ≥8 for 3 consecutive passes.

5. **Visual evidence.** Every UI-touching pass produces screenshots at 390×844 (mobile), 820×1180 (tablet), 1440×900 (desktop). Screenshots committed to `artifacts/pass-N/`.

6. **Anti-regression absolute.** No pass may break anything that was working before. If it does, fix before commit. Run tests. Lint. Type-check. Build. Every pass.

7. **Act as a real user.** On every pass, use the deployed preview (or local dev server) as a real user would. Click through flows. Try edge cases. Use on mobile viewport. The virtual-user walkthrough is not optional — it's how regressions and gaps surface.

8. **Commit messages are structured:** `pass-[N] · phase-[1-8] · [one-line description of shipped change]`

9. **Cross-phase regression checks.** Every 5th pass (regardless of current phase), re-run a lightweight validation of all completed phases: load each completed phase's last-scored criteria, spot-check the 2 lowest-scored criteria from that phase against current state. If any dropped below 8, pause current phase, re-enter the regressed phase, fix, then resume. Log regression to `artifacts/regression-log.md` with: which phase regressed, which criterion, what caused it (usually current-phase work), fix applied.

10. **Phase handoff protocol.** When a phase exits (all criteria ≥8 for 3 consecutive passes), the executor commits a `PHASE_[N]_EXIT.md` file to `artifacts/` containing: final criteria scores with evidence references, known risks for future phases (e.g., "Phase 1 mobile layouts are tight at 390×844 — Phase 4 agent progress display may not fit"), and recommended first-action for the next phase. The next phase reads this file on entry before generating its own criteria.

11. **Prompt self-amendment logging.** During execution, if the executor discovers that the prompt itself has a gap, ambiguity, or incorrect assumption (e.g., a phase dependency is wrong, a criterion is unmeasurable, a benchmark task is infeasible), log it to `docs/PROMPT_AMENDMENTS.md` with: what's wrong, proposed fix, which pass discovered it. Do NOT stop to fix the prompt — continue executing with the best interpretation. The user reviews `PROMPT_AMENDMENTS.md` on return and decides which amendments to adopt.

12. **Credentials and secrets.** The executor will encounter API keys, service credentials, and environment variables it doesn't have (LLM API keys for Phases 4-6, integration credentials for Phase 7, deployment secrets). Protocol: (a) check the repo for `.env.example`, `docker-compose.yml`, or similar config files that document required secrets; (b) for missing credentials, implement with environment-variable placeholders (`process.env.ANTHROPIC_API_KEY`) and document required vars in README; (c) for local development, use mock/stub implementations that simulate the external service (mock LLM responses for testing, mock Plaid responses for pipeline architecture); (d) log missing credentials to `BLOCKED_ON.md` only if the mock path is genuinely infeasible for the current criterion; (e) never hardcode credentials, never commit `.env` files, never invent fake API keys that look real. The goal: architecture and UI work can proceed with mocks; live-service validation is deferred to when credentials are available.

13. **Test suite bootstrapping.** Early passes (especially Phase 1) may encounter a repo with zero tests. "Run full test suite" in the pass structure means: (a) if tests exist, run them; (b) if zero tests exist, the first pass that touches testable logic must also add at minimum one test for the code it ships; (c) test count should grow monotonically — every pass that ships business logic ships at least one test; (d) "lint + type-check + build" always applies even when test count is zero. By the time Phase 8 begins, the test suite should be substantial from incremental growth across Phases 1-7.

---

## TERMINATION CONDITIONS

Stop if and only if:

1. **User stop signal** — user says `stop`, `halt`, `pause`, `end`, or returns with any directive.
2. **Platform hard limit** — context exhaustion with no remaining actionable work. Emit `HANDOFF.md` with: current phase, current pass number, last 3 criteria scores per criterion, next action (specific: "fix the mobile layout of the Retirement Tier 0 surface at 390×844"), what's blocking if anything, and a paste-ready continuation prompt that a new executor instance can use to resume exactly where this instance left off. The continuation prompt should include: phase, pass number, current criteria with scores, the specific next action, and "continue from here per the Stewardly Continuous Build Loop execution engine."
3. **Merge-gate block** — tests failing + can't fix within current context. Emit `BLOCKED_ON.md`.
4. **Full convergence** — all 8 phases complete, all criteria ≥8 for 3 consecutive passes each, and a final full-sweep validation pass finds zero issues. Emit `CONVERGED.md`.

**Completing a pass is never a stop condition.** After every commit, immediately begin the next pass.

---

## THE EIGHT PHASES

### Phase 1 — UI/UX Foundation
*Stability, delightfulness, flexibility, simplicity, progressive disclosure, holistic cohesion*

**Why first:** Everything built in Phases 2-7 lives inside the UI shell. A broken, inconsistent, or ugly shell undermines every feature. Stabilize the container before filling it.

**On entry, assess and score (generate 5-8 from actual state):**
- Navigation coherence: can a new user find every major feature within 3 clicks from root?
- Mobile stability: does every route render correctly at 390×844 without horizontal scroll, broken layouts, or unreachable controls?
- Progressive disclosure consistency: do all surfaces follow the same pattern (simple default → configure deeper → advanced)?
- Visual system coherence: consistent spacing, typography hierarchy, color usage, card structure, interaction patterns across all surfaces?
- Loading/error states: does every async operation show loading state? Do errors surface user-friendly messages?
- Delightful micro-interactions: smooth transitions between views, responsive feedback on inputs, pleasant animations that don't slow down the experience?
- Accessibility baseline: keyboard navigation, focus states, ARIA labels, contrast ratios passing WCAG AA?
- Performance baseline: first meaningful paint <2s on 3G? No layout shifts after initial render?

**Work pattern per pass:**
1. Open deployed preview at all 3 viewports. Screenshot baseline.
2. Pick the lowest-scoring criterion. Identify the worst specific instance of it.
3. Fix that instance. If the fix is systemic (e.g., spacing inconsistency across all cards), apply the systemic fix.
4. Re-test at all 3 viewports. Screenshot after.
5. Run full test suite + lint + type-check + build.
6. Commit.
7. Re-score all criteria. If all ≥8 for 3 consecutive passes, advance to Phase 2.

**Phase 1 specific guidance:**
- The visual system should feel intentional and cohesive — not generic AI-generated aesthetics. The app serves financial advisors; the tone should be professional, warm, confident. Think: a well-designed Bloomberg terminal meets a modern fintech app — information-dense but not overwhelming, with clear hierarchy and generous breathing room.
- Progressive disclosure is the central UX principle. Every surface should have a simple default state that covers 80% of use cases, with a clear path to configure deeper for the other 20%. The 80/20 split should be calibrated per surface based on actual advisor behavior patterns.
- Sidebar navigation should be clean, grouped logically (Practice Management, Client Planning, Advanced, References — per the HTML reference structure), with clear active states and smooth transitions between panels.
- Mobile is not a shrunken desktop. Mobile surfaces should be redesigned for touch, with larger targets, stacked layouts, and swipe interactions where appropriate.

**Exit criteria:** all generated criteria ≥8 for 3 consecutive passes AND a fresh virtual-user walkthrough (cold start, no prior context, mobile viewport) can navigate to every major feature without confusion.

---

### Phase 2 — Learning / Training / Onboarding / Workflows
*Dynamic, CRUD-able, comprehensive — built from `mwpenn94/emba_modules` + optimization items*

**Why second:** Onboarding and learning surfaces are the first thing a new user encounters. If these are incomplete or broken, the user never reaches the wealth engine or AI features.

**On entry:**
1. Clone / pull `mwpenn94/emba_modules` repo. **If the repo is private, empty, or inaccessible:** (a) log to `BLOCKED_ON.md` with the specific access error; (b) do NOT skip Phase 2 — instead, assess the learning/training/onboarding surfaces that already exist in stewardly-ai independently of the emba_modules source; (c) generate criteria from what's in stewardly-ai now + what a best-in-class advisor learning platform should have (onboarding flow, CRUD module management, progress tracking, search, cross-linking to engine); (d) proceed with Phase 2 on internal-assessment basis; (e) when user returns, flag the emba_modules access issue for resolution. The phase still converges on its own criteria; emba_modules content is additive, not gating.
2. Inventory every module, lesson, workflow, and onboarding flow in that repo (if accessible).
3. Compare against what's currently live in stewardly-ai.
4. Generate gap list: what exists in emba_modules but not in stewardly-ai?
5. Generate optimization list: what exists in stewardly-ai but could be better (stale content, broken interactivity, missing CRUD, non-dynamic content that should be dynamic)?

**Score criteria (generate 5-8 from actual gap + optimization lists):**
- Module completeness: % of emba_modules content represented in stewardly-ai.
- CRUD functionality: can an admin create, read, update, delete every learning module / lesson / workflow / onboarding step?
- Dynamic content: are modules data-driven (stored in DB / CMS, not hardcoded)?
- Cross-linking to engine: does every learning module that teaches a concept link to the relevant engine surface where that concept is applied?
- Onboarding flow: does a brand-new advisor get a guided first-run experience that introduces the platform's key capabilities in <5 minutes?
- Search and filter: can a user find a specific module by topic, keyword, or skill level?
- Progress tracking: does the system track which modules a user has completed, and surface next-recommended?
- Mobile learning: do learning surfaces work well on phone (not just "render" — actually work well for reading and interacting)?

**Work pattern:** same as Phase 1 — lowest-scoring criterion, worst instance, fix, re-test, commit, re-score.

**Phase 2 specific guidance:**
- Every piece of content from emba_modules that's relevant to the Stewardly advisory context should be imported and adapted. Content that's purely academic (not advisor-applicable) can be flagged for user review rather than imported.
- CRUD is non-negotiable. Hardcoded content is a dead end — an admin must be able to add new modules, edit existing ones, reorder them, and archive them without touching code.
- The learning system should feel like a living knowledge base, not a static course catalog. New content should be addable at any time; relevance should be surfaceable based on what the advisor is currently working on (context-aware recommendations).
- Cross-linking to the engine (scope #4 surfaces) is the highest-leverage integration. "Learn about Roth conversion ladders → try it in the Tax-Bracket Engineering calculator" is the ideal flow.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND every module from emba_modules is either imported or explicitly flagged as out-of-scope with rationale.

---

### Phase 3 — Holistic Income / Wealth Engine
*Structural inheritance from HTML → content parity → surpass*

**Why third:** The wealth engine is the product's core value proposition. But it depends on Phase 1 (UI/UX stability) and benefits from Phase 2 (learning modules can reference engine surfaces).

**On entry:**
1. Read `docs/reference/WealthBridge-Business-Calculator-v7.6.html` (the 8806-line HTML business calculator).
2. Read `docs/reference/HTML_STRUCTURAL_INVENTORY_STARTER.md` (40 structural categories).
3. If `docs/HTML_STRUCTURAL_INVENTORY.md` doesn't exist yet, produce it: walk the HTML end-to-end, enumerate every structural element (expected: 300-500+ rows).
4. Compare inventory against stewardly-ai's current engine surfaces.
5. Generate gap list: structural elements present in HTML but absent in stewardly-ai.
6. Generate surpass list: per the taxonomy doc (`ADVISORY_TAXONOMY_v2_AND_ENGINE_MAP.md`), which P0 approaches are not yet represented?

**Score criteria (generate 5-8 from actual gap + surpass lists):**
- Structural inheritance rate: % of HTML structural elements with match/superior implementation in stewardly-ai.
- Content parity rate: % of HTML inputs/calculations/references/outputs with functional equivalent.
- Navigation structure match: does stewardly-ai's sidebar match the HTML's 23-item nav structure (Practice Management, Client Planning, Advanced, References)?
- Calculation accuracy: for surfaces that exist, do calculations match the HTML's output given identical inputs?
- Reference/citation system: does stewardly-ai have the ref-tip inline tooltip system with 17 citation categories and 88 entries?
- Save/load/export: does stewardly-ai support save-slot management, JSON export/import, per the HTML?
- Walk-me-through narration: does stewardly-ai support the CalcNarrator-style guided walkthrough?
- Progressive disclosure across tiers: does each engine surface offer a spectrum from simple (1-2 inputs, instant answer) to complex (full configuration, multi-scenario)?

**Work pattern:** structural inheritance first (get the skeleton right), then content parity (fill in calculations), then surpass items from the P0 taxonomy queue.

**Phase 3 specific guidance:**
- **Do not start surpass work until structural inheritance and content parity are at 100%.** The HTML is the floor. Match it exhaustively before extending beyond it.
- The HTML has 23 nav items, 17 citation categories, 88 reference entries, 27 ref-tip inline tooltips, a 10-slot save system, forward/back planning, hierarchy cascade, and a holistic wealth planning engine. All of this must be present before any taxonomy-driven extensions.
- Per the taxonomy doc: P0 extensions include retirement income engineering (buckets, floor-upside, Guyton-Klinger, SS claiming, Medicare), tax-bracket engineering (Roth conversion ladder), protection suite depth (LTC, DI, annuity income flooring), stock-based comp / concentration, balance-sheet view, debt-side management, trust engineering, governance layer (IPS + leverage matrix), Monte Carlo engine.
- Tier 0 "Instant" for every engine surface: 1-2 inputs max, single primary output, <200ms load, one-thumb mobile zone. Design ethos: Zillow zestimate. "Retirement adequacy: 72/100 · configure ›"
- Per the financial data tools reference: Tier 0/1 surfaces should source defaults from 🟢 FREE sources only (FRED, BLS, Treasury, SSA, IRS data). Tier 2+ may use 🟡/🔴 sources.

**Exit criteria:** structural inheritance 100% AND content parity 100% AND all generated criteria ≥8 for 3 consecutive passes. (P0 surpass items continue in subsequent optimization cycles if this prompt re-enters Phase 3 after Phase 8.)

---

### Phase 4 — Autonomous Agent (Manus Clone)
*Full autonomous agent platform — acts, not just answers — UI/UX parity with Manus → progressive disclosure for additions → functional/performant parity or better vs Manus + top comparables*

**Why fourth (ahead of Code Chat):** The autonomous agent is the most general capability — it subsumes code execution, browser operation, multi-step workflow orchestration, and app interaction. Code Chat (Phase 5) is a specialized subset. Building the general agent platform first means Phase 5 can leverage it rather than building a parallel capability stack. Dependency chain: Phase 1 (UI shell) → Phase 3 (engine surfaces the agent drives) → **Phase 4 (general agent)** → Phase 5 (specialized code agent inherits from Phase 4's infrastructure).

**What Manus is (ground truth for parity target):**

Manus is a next-generation autonomous AI agent platform (now owned by Meta) that can execute tasks, operate a browser, interact with apps, and complete multi-step workflows independently. It is not a chatbot. It is a virtual operator that can plan, act, and validate work visually.

Core differentiators vs chatbots:
- **Acts, not just answers.** Given a task ("build me a website," "analyze this dataset," "fill out this form"), Manus executes the task end-to-end rather than telling the user how to do it.
- **Operates asynchronously in the cloud.** User submits a task and can walk away. Manus works in the background. User returns to completed deliverables.
- **Browser operator.** Manus controls a real browser — it clicks, types, navigates, scrolls, takes screenshots, validates UI state. It can operate any web application the way a human would.
- **Multi-step workflow execution.** Manus decomposes complex tasks into steps, executes each step, validates the result, and proceeds to the next. It handles branching, error recovery, and intermediate checkpoints.
- **Runs without human supervision.** After task submission, Manus operates autonomously. It only pauses for human input when it encounters an ambiguity it can't resolve or when an action requires explicit approval (irreversible operations).
- **Artifact delivery.** Completed work is delivered as downloadable artifacts — files, deployed sites, filled forms, structured data, reports.

Meta positions Manus as an "action engine" that extends human capability by automating workflows.

**On entry:**
1. Open Manus (or its latest documented interface at manus.im) as the primary reference. Document every UI surface, interaction pattern, and capability.
2. Open OpenClaw as secondary reference. Document where it diverges from or extends Manus.
3. Open Devin, Cursor Agent, Replit Agent, Windsurf Cascade as tertiary references for feature coverage.
4. Compare against stewardly-ai's current agentic surface.
5. Generate gap list: what Manus does that stewardly-ai doesn't.
6. Generate surpass list: what stewardly-ai could do beyond Manus given its advisory context (advisor-specific task templates, compliance-aware execution, engine-surface orchestration).

**Score criteria (generate 5-8 from actual state):**

*Core autonomous agent capabilities (must match Manus):*
- **Task submission + async execution:** can a user submit a natural-language task and walk away? Does the agent work asynchronously in the background? Does the user return to completed deliverables?
- **Browser operator:** can the agent control a real browser? Click buttons, fill forms, navigate between pages, scroll, read page content, take screenshots, validate UI state? Can it operate arbitrary web applications (not just stewardly-ai's own surfaces)?
- **Multi-step planning + execution:** given a complex task, does the agent decompose it into steps, execute each, validate results, handle branching and errors, and proceed to completion?
- **Real-time progress transparency:** can the user watch the agent work? Streaming progress display showing what the agent is doing now (which tool it's calling, what it sees in the browser, what step it's on, what it's thinking)?
- **Artifact delivery:** does the agent produce downloadable deliverables (files, deployed sites, structured data, reports, filled documents)?
- **Code writing + execution:** can the agent write code, run it in a sandboxed environment, see the output, iterate if it fails, and deliver working code as an artifact?

*Stewardly-specific surpass capabilities (beyond Manus baseline):*
- **Advisor-context task templates:** pre-built task types for advisor workflows — "Monday-morning client review," "batch IPS generation across my book," "draft quarterly review outreach for clients with RMD events," "analyze this prospect's financial picture from uploaded documents"?
- **Engine-surface orchestration:** can the agent navigate stewardly-ai's own wealth engine surfaces, enter data, run calculations, compare scenarios, and synthesize results across surfaces (e.g., walk through Retirement → Tax → Estate for a single client)?
- **Compliance-aware execution:** does the agent flag when its actions touch regulated territory (insurance recommendations, investment advice, ERISA-adjacent operations)? Does it pause for human review on compliance-sensitive outputs?
- **Cross-surface integration:** can the agent invoke code chat (Phase 5), learning modules (Phase 2), and engine surfaces (Phase 3) during a multi-step task?
- **Approval workflow for irreversible actions:** does the agent distinguish between reversible actions (draft generation, data analysis, scenario comparison) and irreversible actions (sending client communications, modifying live data, executing integrations)? Does it auto-execute reversible actions and pause for approval on irreversible ones?

**Phase 4 specific guidance:**

**UI/UX fidelity with Manus:**
- The primary UX flow is: **task input → plan display → real-time execution → artifact delivery.** Replicate this exactly before extending.
- Task input: clean, prominent text area or chat-like input where the user describes what they want done. Supports natural language, file uploads, URL references, and context from other stewardly-ai surfaces.
- Plan display: after task submission, the agent shows its decomposed plan (steps it will take) before or as it begins executing. User can review and optionally modify the plan.
- Real-time execution: a live execution view showing the agent's actions — browser screenshots, terminal output, tool calls, intermediate results. This is the signature Manus UX element. The user can watch the agent work or navigate away and return later.
- Artifact delivery: completed work presented as downloadable files, rendered previews (HTML, images, documents), or structured data. Clear "done" state with summary of what was accomplished.

**Progressive disclosure beyond Manus baseline:**
- Default view: Manus-like task → execution → delivery flow. Intuitive for anyone who's used Manus.
- Level 2: advisor-specific task templates visible in a sidebar or command palette. Pre-built workflows for common advisor tasks.
- Level 3: advanced configuration — execution environment settings, integration credentials, compliance sensitivity toggles, batch operations across multiple clients.
- Level 4: full agentic orchestration — multi-agent coordination, parallel task execution, scheduled recurring tasks, webhook-triggered workflows.

**Minimum infrastructure requirements (what must exist for this to work):**
- **Headless browser:** Playwright or Puppeteer running in a server-side environment. The agent needs to control a real browser programmatically — navigate URLs, click elements, fill inputs, read page content, take screenshots, handle auth flows. Playwright is preferred (better cross-browser support, better async handling).
- **Sandboxed code execution:** a containerized environment (Docker or similar) where the agent can write and execute code without risking the host system. Code the agent writes runs in the sandbox; output (files, stdout, rendered HTML) is captured and delivered as artifacts.
- **LLM backend:** API access to a capable model (Claude API, OpenAI API, or similar) for planning, reasoning, code generation, and natural-language understanding. Per Rule 12, use environment-variable-based configuration with mock fallback for development.
- **Task queue / async execution:** a mechanism for the user to submit a task and the agent to execute it asynchronously. This can be as simple as a database-backed job queue (task submitted → status: running → status: complete with artifacts) or as sophisticated as a dedicated worker process. The key requirement: the user can navigate away and the task keeps running.
- **Artifact storage:** completed work (files, screenshots, rendered HTML, structured data) needs to be stored and retrievable. File system with signed URLs, S3-compatible storage, or database BLOBs all work.
- **WebSocket or SSE for real-time progress:** the live execution view requires streaming updates from the agent to the UI. WebSocket for bidirectional (user can send "stop" or "approve" mid-task) or SSE for unidirectional progress streaming.
- If any of these infrastructure pieces don't exist in the repo, the first Phase 4 passes build them. Per Rule 12, mock external services (mock LLM, mock browser) for development; real services when credentials are available.

**Benchmark tasks for parity testing (use these for exit-criteria comparisons):**
1. "Build me a landing page for a retirement planning seminar" → agent writes HTML/CSS/JS, deploys to preview, delivers link.
2. "Analyze this CSV of client data and produce a summary report with charts" → agent reads file, writes analysis code, executes, delivers PDF/HTML report.
3. "Go to [website], fill out this form with this information, submit it, and screenshot the confirmation" → agent operates browser, completes form, validates submission.
4. "Review my top 5 clients' retirement readiness using the wealth engine" → agent navigates stewardly-ai engine surfaces, enters data per client, compares results, produces advisor brief.
5. "Research the latest SECURE Act 2.0 changes and summarize implications for my book" → agent searches web, reads sources, synthesizes, delivers structured summary with citations.
6. "Set up a new calculator surface for student loan optimization based on the taxonomy doc spec" → agent reads taxonomy, writes code, creates UI surface, tests it, delivers working feature.
7. "Draft quarterly review emails for all clients with upcoming RMD events" → agent queries client data, identifies RMD-relevant clients, drafts personalized emails, queues for advisor approval.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND side-by-side task comparison with Manus shows parity or superiority on ≥7 representative benchmark tasks (the 7 above) AND browser-operator capability demonstrated on ≥3 external websites AND async execution demonstrated (user submits task, navigates away, returns to completed deliverable).

---

### Phase 5 — Code Chat (Claude Code Clone)
*UI/UX parity with Claude Code → progressive disclosure for additions → functional/performant parity or better*

**Why fifth (after Manus clone):** Code Chat is a specialized coding surface. Phase 4's autonomous agent already handles code writing + execution as one of its capabilities. Phase 5 builds the dedicated, optimized coding UX that leverages Phase 4's infrastructure for execution while providing the terminal-native, diff-oriented, file-tree-aware interface that developers expect from a tool like Claude Code.

**On entry:**
1. Open Claude Code (or its latest documented interface) as reference.
2. Inventory every UI element, interaction pattern, and capability.
3. Compare against stewardly-ai's code chat surface.
4. Generate gap list: what Claude Code does that stewardly-ai doesn't.
5. Generate surpass list: what stewardly-ai could do beyond Claude Code given its advisory context + Phase 4 agent infrastructure.

**Score criteria (generate 5-8 from actual state):**
- UI fidelity: does the code chat surface look and feel like Claude Code? Same or extremely similar layout, input patterns, output rendering, file tree, diff views?
- Terminal interaction: can the user execute commands, see output, interact with the file system?
- Code generation quality: given the same prompt, does stewardly-ai's code chat produce output at least as good as Claude Code?
- Multi-file editing: can the user work across multiple files in a single session?
- Context awareness: does the code chat understand the stewardly-ai codebase specifically (not generic code generation)?
- Progressive disclosure: does the surface start simple (chat input + output) and reveal advanced features (file tree, diff view, terminal, multi-file) progressively?
- Integration with wealth engine: can an advisor say "customize the Retirement calculator's default assumptions" and have code chat identify and modify the relevant code?
- Agent handoff: can the code chat hand off complex multi-step coding tasks to the Phase 4 agent for autonomous execution?
- Performance: response latency comparable to or better than Claude Code for equivalent operations?

**Phase 5 specific guidance:**
- The primary AI backend is whatever LLM API stewardly-ai has access to (Claude API, etc.). The code chat should leverage this for all code generation, editing, and reasoning.
- UI/UX should be nearly indistinguishable from Claude Code at first glance — same terminal aesthetic, same diff rendering, same file tree. Then progressive disclosure reveals Stewardly-specific capabilities (engine customization, compliance-aware code review, advisor-context-aware suggestions, agent handoff for complex tasks).
- "Meet or exceed functional/performant parity" means: for any task Claude Code can do, the stewardly-ai code chat should do it at least as well. Test with representative tasks: "fix this bug," "add a new calculator surface," "refactor this component," "write tests for this module."
- **Key differentiator vs standalone Claude Code:** stewardly-ai's code chat can invoke Phase 4's autonomous agent for tasks that go beyond single-turn code generation (e.g., "implement the entire Student Loan Optimization surface from the taxonomy spec" → code chat decomposes into subtasks, hands to agent, agent executes, code chat presents results with diffs).

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND side-by-side task comparison with Claude Code shows parity or superiority on ≥5 representative tasks AND agent-handoff demonstrated for ≥2 complex multi-step coding tasks.

---

### Phase 6 — AI Chat
*UI/UX parity with best-in-class chat (Claude.ai) → progressive disclosure → functional/performant parity or better*

**Why sixth:** AI chat is the conversational backbone. It depends on Phase 1 (UI shell) and benefits from Phases 3-5 (it can reference engine surfaces, hand off to the autonomous agent, invoke code chat).

**On entry:**
1. Open Claude.ai (and optionally ChatGPT, Gemini, Perplexity) as references.
2. Inventory UI elements, interaction patterns, capabilities.
3. Compare against stewardly-ai's AI chat surface.
4. Generate gap and surpass lists.

**Score criteria (generate 5-8):**
- UI fidelity: does the chat surface match Claude.ai's polish? Clean message threading, code block rendering, image display, artifact rendering, conversation management?
- Conversation quality: given the same prompt, is the response quality at parity with Claude.ai?
- Context awareness: does the chat understand the stewardly-ai context (advisor role, client data, engine surfaces, codebase)?
- Multi-modal: does the chat handle text, images, file uploads, code blocks?
- Memory / history: does the chat maintain conversation history, allow search, support multiple threads?
- Tool use: can the chat call tools (search, calculate, fetch data) during conversation?
- Cross-surface integration: can the chat open engine surfaces, invoke code chat, trigger agent tasks from within conversation?
- Mobile chat experience: does the chat work well on phone with responsive input, readable output, smooth scrolling?

**Phase 6 specific guidance:**
- The chat surface should be nearly indistinguishable from Claude.ai at first glance. Clean, professional, warm. Then progressive disclosure reveals Stewardly-specific capabilities: advisor-context-awareness, engine-surface linking, compliance-source citation, client-profile awareness.
- **Streaming responses are non-negotiable.** Modern AI chat UX requires tokens to appear as they're generated, not as a complete block after generation finishes. A non-streaming chat that displays a loading spinner for 10 seconds then dumps a complete response feels fundamentally broken compared to Claude.ai or ChatGPT. Implement SSE or WebSocket streaming from the LLM backend to the UI. If using mock LLM responses (per Rule 12), simulate streaming by emitting tokens with realistic inter-token delay.
- **Artifact / rich-output rendering is expected.** Claude.ai renders code artifacts, React components, HTML previews, SVGs, and Mermaid diagrams inline in the conversation. Stewardly-ai's chat should render at minimum: code blocks with syntax highlighting and copy button, markdown with proper formatting, tables, and — critically for the advisory context — inline calculator previews (a chat response that says "here's a Roth conversion analysis" should render a mini wealth-engine surface inline, not just text output).
- **Conversation management:** edit-and-regenerate (user edits a prior message, response regenerates from that point), conversation branching (multiple response paths), conversation search/filter across history, export/share conversations.
- "Meet or exceed" means: for any conversational task Claude.ai can do, stewardly-ai's chat should do it at least as well. Test with: general questions, code generation, document analysis, multi-turn reasoning, advisor-specific queries.

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND side-by-side conversational comparison shows parity or superiority on ≥5 representative conversations.

---

### Phase 7 — Data Integrations / Pipelines / Scraping / Ingestion / Modeling
*Meet or exceed functional/performant parity vs top comparables*

**Why seventh:** Integrations feed live data into Phases 3-6 surfaces. But building integrations before the consuming surfaces are stable would be premature — you'd be piping data into surfaces that don't exist yet or that change shape every pass. Additionally, Phase 4's autonomous agent provides browser-operator infrastructure that Phase 7 can leverage for data retrieval, and Phase 6's AI chat provides the conversational interface through which integration status and data freshness are communicated to users. All consumers must be stable before the data pipeline is built.

**On entry:**
1. Read `docs/reference/FINANCIAL_DATA_TOOLS_TIERED.md` for the cost-tiered sourcing reference.
2. Inventory current integrations in stewardly-ai.
3. Compare against the reference's P0 integration list: Plaid, edgartools/SEC EDGAR, FRED, GLEIF + OpenFIGI, NAIC + FFIEC.
4. Compare against top comparable platforms' integration capabilities (OpenBB, Wealthbox API, GHL API, etc.).
5. Generate gap list.

**Score criteria (generate 5-8):**
- P0 integrations live: count of 5 P0 integrations functional (Plaid, edgartools, FRED, GLEIF+OpenFIGI, NAIC+FFIEC).
- Data freshness: are connected integrations returning current data? Stale-data detection live?
- Error handling: do failed integrations degrade gracefully (fallback to cached data, user notification, no crash)?
- Ingestion pipeline: is there a unified pipeline that normalizes data from different sources into a common schema?
- Scraping resilience: for sources that require scraping (where no API exists), is the scraper resilient to page changes with retry logic?
- Data modeling: is ingested data modeled in a way that supports cross-surface queries (e.g., a client's aggregated holdings from Plaid feeding into the Retirement, Tax, and Estate surfaces)?
- Cost-tier compliance: are all defaults at Tier 0/1 surfaces sourced from 🟢 FREE sources?
- Performance: do integration-fed surfaces load within acceptable latency (<3s for Tier 2, <200ms for Tier 0)?

**Phase 7 specific guidance:**
- Per the financial data tools reference: start with the Zero Budget stack (FRED, edgartools, OpenFIGI, GLEIF, NAIC, ccxt, FinanceToolkit, pandas-ta, Riskfolio-Lib) to source Tier 0/1 defaults at zero vendor cost.
- Plaid is the only true P0 paid integration (no free alternative for banking aggregation). If Plaid isn't feasible immediately, implement the ingestion pipeline with CSV/manual import as fallback so the pipeline architecture is correct even without the live connector.
- Data normalization matters more than connector count. Five well-integrated sources with a unified schema beat twenty half-integrated sources with inconsistent schemas.
- **Leverage Phase 4 agent infrastructure.** The autonomous agent (Phase 4) can operate browsers, scrape web pages, fill forms, and automate multi-step data retrieval workflows. Phase 7 should use Phase 4's browser-operator capability for data sources that don't have clean APIs — instead of building custom scrapers, build agent task templates that retrieve and normalize data. This means Phase 7's "scraping resilience" criterion is partially solved by Phase 4's browser automation: if a page layout changes, the agent adapts (it reads the page visually) rather than a brittle CSS-selector scraper breaking silently.
- **Integration testing should include agent-driven ingestion.** At minimum one P0 integration should demonstrate an agent-driven data retrieval workflow (e.g., agent navigates to FRED, retrieves specific time series, normalizes into pipeline schema, delivers as structured data).

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND P0 integrations functional (or architecturally ready with fallback) AND zero stale-data incidents on connected sources.

---

### Phase 8 — Documentation + Test Suite
*In-app docs, codebase docs, comprehensive live virtual-user test suite*

**Why last:** Documentation and tests describe what's built. Building them before the features are stable means rewriting them every time a feature changes. Do it last, when things are stable.

**On entry:**
1. Inventory all in-app help, tooltips, onboarding text, contextual documentation.
2. Inventory all codebase documentation (README, API docs, architecture docs, deployment docs).
3. Inventory test suite: unit tests, integration tests, E2E tests.
4. Compare against what exists in the codebase vs what should exist given Phases 1-7 work.

**Score criteria (generate 5-8):**
- In-app documentation: every major feature has contextual help accessible within the UI (tooltip, help panel, "learn more" link to Phase 2 learning module).
- Codebase README: up-to-date, covers setup, architecture, contribution, deployment.
- API documentation: every API endpoint / tRPC procedure documented with input/output types, examples, error codes.
- Architecture documentation: high-level architecture doc showing how surfaces, services, integrations, and AI capabilities connect.
- Unit test coverage: ≥80% of business logic functions have unit tests.
- Integration test coverage: every integration (Phase 7) has at minimum one happy-path and one error-path integration test.
- E2E test suite: a virtual-user test suite that walks through every persona's primary flow end-to-end across core features (engine surfaces, code chat, agent task, AI chat conversation, learning module). At minimum 10 E2E tests covering the 10 persona archetypes.
- Peripheral feature coverage: E2E tests also cover edge cases and peripheral features (save/load, export/import, print, mobile-specific interactions, error states, empty states, loading states).

**Phase 8 specific guidance:**
- E2E tests should simulate real user behavior, not just check that elements exist. A test for the Retirement surface should: navigate to it, enter realistic inputs, verify calculation output matches expected, change an input, verify output updates, try saving, try exporting, try on mobile viewport.
- The 10-persona E2E suite should cover: (1) cold new advisor onboarding, (2) Monday-morning returning advisor, (3) mid-meeting laptop advisor, (4) mid-meeting phone advisor, (5) power-user multi-region MD, (6) client on shared link, (7) skeptical CFO due-diligence, (8) compliance reviewer, (9) slow-connection rural user, (10) accessibility-dependent user (keyboard-only, screen reader).
- **Leverage Phase 4 agent for E2E test execution.** The autonomous agent (Phase 4) can operate the browser, navigate surfaces, fill inputs, validate outputs, and take screenshots. Use it to run the E2E test suite as a virtual user — the agent walks each persona's flow and reports pass/fail with evidence. This simultaneously validates Phase 4's browser-operator capability and Phase 8's test coverage.
- Documentation is a product feature, not an afterthought. In-app contextual help should feel as polished as the features themselves.
- **Architecture documentation should include a dependency graph** showing the phase-order rationale: which surfaces consume which capabilities, which data flows between which components. This graph is both documentation and a regression-detection tool (if a dependency is broken, the graph shows what's affected).

**Exit criteria:** all criteria ≥8 for 3 consecutive passes AND full E2E test suite passes AND zero documentation gaps for shipped features.

---

## AFTER ALL EIGHT PHASES

If all 8 phases complete (all exit criteria met), run a **full-sweep validation pass:**

1. Fresh clone of repo. Clean install. Run full test suite. All tests must pass.
2. Deploy to preview. Virtual-user walkthrough of every major flow at all 3 viewports (390×844, 820×1180, 1440×900). Specifically: navigate to every sidebar item, interact with at least one input per surface, verify output renders, verify mobile doesn't break.
3. Side-by-side comparisons: autonomous agent vs Manus (7 benchmark tasks from Phase 4 spec), code chat vs Claude Code (5 representative tasks), chat vs Claude.ai (5 representative conversations). Document each comparison with: task description, stewardly-ai result, reference product result, verdict (parity / superior / inferior), evidence (screenshot or recorded flow).
4. Cross-surface integration check: from AI chat, trigger an agent task that navigates an engine surface and produces a deliverable. From code chat, invoke agent handoff. From learning module, navigate to engine surface. Verify all cross-links work.
5. Score all criteria across all 8 phases from scratch (not from cached scores — re-assess against actual current state).
6. If any criterion dropped below 8 (regression from later phases affecting earlier work), re-enter that phase and fix.
7. If all criteria ≥8 across all 8 phases AND cross-surface integration passes AND side-by-side comparisons show parity or superiority on all benchmark tasks, emit `CONVERGED.md` and stop.

If full convergence isn't reached (common — later phases often surface Phase 1 regressions), the cycle re-enters the lowest-scoring phase and continues.

---

## PARITY MEASUREMENT METHODOLOGY

"Meet or exceed parity" against live commercial products (Manus, Claude Code, Claude.ai) requires a concrete measurement protocol, not subjective judgment.

**For each benchmark task / representative conversation:**

1. **Define the task** in writing before executing on either platform. Same prompt, same inputs, same constraints.
2. **Execute on stewardly-ai first** (to avoid anchoring on the reference product's approach).
3. **Execute on the reference product** with identical prompt/inputs.
4. **Score both on 4 dimensions:**
   - **Completeness:** did it finish the task? (binary: yes/no/partial)
   - **Quality:** is the output correct, well-structured, professional? (1-10)
   - **Speed:** wall-clock time from submission to completed deliverable. (seconds)
   - **UX friction:** how many unexpected steps, errors, or confusions did the user encounter? (count)
5. **Verdict per task:**
   - **Superior:** stewardly-ai scores higher on ≥3 of 4 dimensions.
   - **Parity:** scores within ±1 on all dimensions, no dimension inferior by >2.
   - **Inferior:** stewardly-ai scores lower on ≥2 dimensions by >2 points.
6. **Phase exit requires:** zero "inferior" verdicts AND ≥50% "superior" verdicts on benchmark tasks.

**Document all comparisons** in `artifacts/parity-comparisons/phase-[N]/` with screenshots, timing data, and dimension scores. This is the evidence that parity claims are grounded.

---

## DIMINISHING RETURNS PROTOCOL

If a criterion is stuck (3+ consecutive passes with no score improvement despite genuine effort):

**If stuck at 7 (functional but rough):**
1. Re-examine: is this criterion actually two separate issues? Split if so.
2. Try a fundamentally different technical approach (not just iterating on the same fix).
3. Check if an external dependency is the real blocker (API key, commercial service, hardware limitation).
4. If after 5 total passes at 7 with no improvement: log to `docs/PROMPT_AMENDMENTS.md` with honest assessment of what's blocking, mark criterion as `7-capped:<reason>`, and continue to next lowest criterion. A phase can exit with one criterion at 7-capped IF all others are ≥8 AND the capped criterion has a documented reason AND the reason is an external dependency (not a skill gap or prioritization choice).

**If stuck at ≤6 (significant issues):**
- This should not happen if the work pattern is followed honestly. A score of ≤6 means the capability doesn't work for the happy path.
- If genuinely stuck at ≤6 for 5+ passes: the issue is likely architectural (wrong approach entirely, not incremental improvement). Step back, reassess the technical design, and consider whether a different architecture would score higher. Log the reassessment.

**The goal is honest convergence, not stalled perfection.** One criterion at 7-capped with a legitimate external-dependency reason is better than infinite passes trying to reach 8 on something that requires a $24K/yr Bloomberg subscription to fix.

---

## PASS STRUCTURE (every pass, every phase)

```
## Pass N · Phase P · Criterion: [lowest-scoring criterion] · Score before: X/10

1. Pull latest. Read current scores. If pass N is divisible by 5, run cross-phase regression check (Rule 9) before proceeding.
2. Identify the specific worst instance of the lowest-scoring criterion.
3. Plan the fix (1-3 sentences max, not a dissertation).
4. Implement.
5. Test (lint, type-check, build, test suite).
6. Visual validate at 3 viewports (if UI-touching). Screenshot.
7. Re-test as virtual user. Verify no regression.
8. Commit: `pass-[N] · phase-[P] · [description]`
9. Re-score all criteria for current phase. If any completed-phase criterion dropped below 8, log regression and re-enter that phase next pass.
10. If all ≥8 for 3 consecutive: commit PHASE_[P]_EXIT.md, advance phase. Else: continue.

## Pass N+1 · Phase P · ...
[immediately continues]
```

---

## SCORING MECHANICS

**How to score each criterion (1-10):**

- **1-3:** Fundamentally broken or absent. The capability doesn't exist, or exists but is unusable.
- **4-5:** Exists but has significant issues. A real user would notice problems immediately.
- **6-7:** Functional but rough. Works for the happy path; edge cases break; polish missing.
- **8:** Production-quality. A real user would have a good experience. Minor improvements possible but nothing breaking or confusing.
- **9:** Excellent. Exceeds expectations. Delightful details. Handles edge cases gracefully.
- **10:** Best-in-class. Genuinely better than comparable products. The user would be impressed.

**Phase exit threshold is ≥8, not ≥10.** 8 is production-quality. 9-10 are aspirational — achievable over multiple optimization cycles but not required for phase advancement. Chasing 10 on every criterion would stall progress.

**Honesty over optimism.** If a criterion is at 4, score it 4. Don't score it 7 because "it mostly works." The gap between the score and reality is where regressions hide.

**Re-scoring happens every pass, not every 5 passes.** Criteria can go up (fix landed) or down (regression from this pass's changes). Both are information.

**Scoring criteria that span multiple sub-features.** Some criteria (e.g., "navigation coherence," "mobile stability") span many surfaces or features. Score these by their **weakest sub-feature that a user would encounter on a common path**, not by averaging. If sidebar nav scores 9 but mobile nav scores 4, the criterion scores 4 — because a mobile user hits the 4 on a common path. The goal is to pull up the floor, not celebrate the ceiling. When re-scoring, if the floor sub-feature improved, the criterion score rises; if a previously-fine sub-feature regressed, the criterion score drops to the new floor.

---

## WHAT TO DO WHEN STUCK

If 3 consecutive passes on the same criterion show no score improvement:

1. **Split the criterion.** It might actually be two separate issues where one is dragging down the other. Redefine as two criteria; the one that's actually improving will show progress.
2. **Change the technical approach.** If the same fix pattern isn't working, try a fundamentally different architecture or library, not just another iteration of the same approach.
3. **Check upstream dependencies.** Maybe this criterion can't improve because an earlier phase regressed. Re-score earlier phases; re-enter if needed (per Rule 9 cross-phase regression checks).
4. **Log to `BLOCKED_ON.md`** if genuinely blocked by an external dependency (missing API key, commercial service requirement, hardware limitation). Never log as blocked if the issue is "I don't know how to do this" — research, prototype, iterate.
5. **If stuck for 5+ passes,** follow the Diminishing Returns Protocol above: assess whether this is a 7-capped criterion with a legitimate external reason, or whether the architectural approach needs rethinking.

---

## REFERENCE DOC USAGE PER PHASE

| Phase | Primary reference docs |
|---|---|
| 1 (UI/UX) | Existing codebase + design system files |
| 2 (Learning) | `mwpenn94/emba_modules` repo |
| 3 (Wealth Engine) | `WealthBridge-Business-Calculator-v7.6.html` + `HTML_STRUCTURAL_INVENTORY_STARTER.md` + `ADVISORY_TAXONOMY_v2_AND_ENGINE_MAP.md` + `ADVISORY_OPERATING_SYSTEM_AXES.md` |
| 4 (Autonomous Agent / Manus Clone) | Manus (manus.im) + OpenClaw + Devin + Cursor Agent + Replit Agent + Windsurf Cascade (live references) |
| 5 (Code Chat / Claude Code Clone) | Claude Code (live reference) + Phase 4 agent infrastructure |
| 6 (AI Chat) | Claude.ai + ChatGPT + Gemini (live references) |
| 7 (Integrations) | `FINANCIAL_DATA_TOOLS_TIERED.md` |
| 8 (Docs/Tests) | All above + codebase itself |

---

## FORBIDDEN BEHAVIORS

- ❌ Stopping after one pass.
- ❌ Asking "should I continue?"
- ❌ "I've completed an assessment and here are my findings" without shipping code.
- ❌ Scoring everything 8+ on first assessment (dishonest — real codebases always have gaps).
- ❌ Skipping phases (Phase 3 before Phase 1 is complete).
- ❌ Planning-only passes (every pass ships observable work).
- ❌ Ignoring mobile (390×844 is a first-class viewport, not an afterthought).
- ❌ Breaking existing functionality to add new functionality.
- ❌ Committing without running tests.
- ❌ Closing a criterion as "done" without evidence.
- ❌ Skipping cross-phase regression checks on the cadence (every 5th pass per Rule 9).
- ❌ Advancing to a new phase without committing the `PHASE_[N]_EXIT.md` handoff (per Rule 10).
- ❌ Silently modifying the prompt's intent — log amendments to `docs/PROMPT_AMENDMENTS.md` instead (per Rule 11).
- ❌ Claiming "no user-visible change possible" on an infrastructure pass — for infrastructure work (agent backend, pipeline architecture, test scaffolding), the user-visible change can be: a new route/surface that renders (even if empty), a status indicator, a log output visible in the UI, a settings toggle, or a health-check endpoint. Something observable must ship.

---

Begin. Pull the repo. Assess Phase 1 state. Generate criteria. Score. Start fixing the lowest-scoring criterion. Ship. Continue.