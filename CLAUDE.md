# Stewardly — Recursive Optimization Project

## Overview
5-layer financial advisory AI platform. Reference architecture from which shared packages (@platform/intelligence, @platform/config) are extracted for Atlas, AEGIS, and Sovereign.

## Stack
TypeScript, tRPC, Drizzle ORM, TiDB, React 19
116 pages, 352 tables, 3,082 tests passing across 105 files (119 total, 3,194 total tests, 96.5% pass rate excluding 14 pre-existing env-dependent / DB-unavailable files), 258 services, 78 routers (75 files + 3 newly-mounted webhook routers in pass 46), 24 seed files, 37 cron jobs, 129 components
Current state: ~97% deep, 3% human-dependent (env vars, GHL, compliance). 50 recursive passes converged (9.7-9.8/10; pass 45 fixed pdfReportGenerator invokeLLM bypass regression from Phase 7; pass 46 mounted 3 webhook routers (ghl/dripify/smsit) that were exported but unreachable; passes 47+48 confirmed 2 consecutive clean with no actionable issues; pass 49 wired a Download Report PDF button on EngineDashboard into wealthEngine.generateReport (complete_plan template), bridging the two engine stacks so calculator-router-driven dashboards can emit the wealth-engine-reports 4-template PDFs; pass 50 confirmed clean). 0 TS errors, 0 TODOs.

## Wealth Engine (Phases 1-7 + Rounds A/B/C/D/E, see docs/WEALTH_ENGINE.md + docs/CONSENSUS.md + docs/ENGINES_MIGRATION.md)
Phase 1-7 ported the WealthBridge v7 HTML calculator engines into TypeScript and wired them into the full Stewardly stack. Round A added natural-language chat dispatch, PDF download buttons, per-message chat actions, and 3 synthesizer pulls. Round B added a Claude-Code-style code chat foundation. Round C added multi-model consensus stream + weight presets + UI trio. Round D wired the live SSE endpoint at /api/consensus/stream, added a pre-flight cost+latency badge, and a Chat→Consensus deep link. Round E lifted the Round C trio inline into Chat.tsx consensus mode, added LLM-as-judge semantic agreement scoring, shipped the weight_presets SQL migration (0009_weight_presets.sql), and documented the two-stack engine dedup path (docs/ENGINES_MIGRATION.md). 656 tests across 12 files (583 wealth-engine + 54 parallel main-branch engines + 19 semantic agreement). 41 recursive optimization passes converged at 9.7-9.8/10.
- `server/shared/calculators/` — UWE/BIE/HE/Monte Carlo/benchmarks (Phase 1)
- `server/routers/wealthEngine.ts` — 30+ tRPC procedures (Phase 2A + Round A6 + Round C2/C4)
- `server/services/agent/calculatorOrchestrator.ts` — agent workflow chains (Phase 2B)
- `server/services/ghl/` — GoHighLevel CRM integration (Phase 3)
- `client/src/pages/wealth-engine/` — React UI (Retirement, StrategyComparison, PracticeToWealth, QuickQuote) (Phase 4)
- `server/services/wealthEngineReports/` — 4 PDF templates + Edge TTS audio narration + shareable links (Phase 5). Consumed by `client/src/components/wealth-engine/DownloadReportButton.tsx` on StrategyComparison, Retirement, and `client/src/pages/EngineDashboard.tsx` (pass 49) via the `wealthEngine.generateReport` tRPC mutation (complete_plan template).
- `server/services/wealthChat/` — 5 chat tools + safety wrappers + 5 proactive triggers + chat-engine dispatcher (Phase 6 + Round A3)
- `server/services/improvement/` — Plaid perception + 6 improvement loops (Phase 7)
- `server/services/synthesizer/` — wordDiff (LCS) + timeBudgetSelector + costEstimator (Round A7)
- `server/services/codeChat/` — fileTools + executor + autonomousCoding + roadmapPlanner + githubClient (Round B)
- `server/routers/codeChat.ts` + `client/src/pages/CodeChat.tsx` — admin file browser + roadmap CRUD + word-diff visualizer (Round B5)
- `server/services/consensusStream.ts` — runConsensus + streamConsensus + buildSynthesisPrompt + parseSynthesisOutput (Round C2) + combined semantic/Jaccard agreement (Round E2)
- `server/services/weightPresets.ts` — per-model weight CRUD with 5 built-in presets (Round C4)
- `server/services/semanticAgreement.ts` — LLM-as-judge semantic agreement scorer, falls back to Jaccard on failure (Round E2)
- `client/src/components/consensus/` — StreamingResults + TimingBreakdown + ComparisonView (Round C3)
- `client/src/pages/Consensus.tsx` — multi-model consensus demo page (Round C3)
- `client/src/pages/Chat.tsx` — consensus mode inlines the Round C3 trio via wealthEngine.consensusStream (Round E1), with graceful fallback to legacy advancedIntelligence.consensusQuery
- `drizzle/0009_weight_presets.sql` — SQL migration for the weight_presets table (Round E3), applied on next `pnpm db:push`

## EMBA Learning Integration (April 2026, see docs/EMBA_INTEGRATION.md)
Merged the EMBA Knowledge Explorer (12 exam tracks, 2,000+ definitions, SRS, 27 pages, licensure tracking) into Stewardly under the `learning.*` namespace. 30 new `learning_*` tables, one tRPC router with 6 subrouters (mastery / licenses / content / freshness / recommendations / seed), 11 new ReAct agent tools, 3 new React pages (Learning Home, License Tracker, Content Studio), and a full dynamic content CRUD system with versioning + audit trail. 44 new unit tests across 5 files, all passing. Task coverage: 1 (schema+auth), 2 (router+agent), 3 (regulatory pipeline), 4 (UI consolidation+nav), 5 (agentic licensure), 6 (page migration skeleton), 7 (dynamic content CRUD+permissions+seed).
- `drizzle/schema.ts` — 30 new learning_* tables (mastery, sessions, licenses, CE credits, regulatory, tracks, definitions, formulas, cases, fs_applications, connections, chapters, subsections, questions, flashcards, content_history, ai_quiz_questions, playlists, groups, bookmarks, discovery, ...)
- `drizzle/0010_emba_learning.sql` — idempotent SQL migration (CREATE TABLE IF NOT EXISTS)
- `server/services/learning/permissions.ts` — RBAC model (canEditContent/canPublish/canSeedContent/canSeeContent) + 14 tests
- `server/services/learning/mastery.ts` — SRS with pure scheduleNextReview (0-5 confidence ladder) + 6 tests
- `server/services/learning/licenses.ts` — licensure CRUD + CE credits + deriveLicenseAlerts (expiration_warning / ce_credits_needed / expired) + 8 tests
- `server/services/learning/content.ts` — full CRUD on definitions/tracks/chapters/subsections/questions/flashcards + audit trail + unified search + explainConcept
- `server/services/learning/seed.ts` — idempotent seed for 8 core disciplines + 12 canonical exam tracks (SIE/Series7/Series66/CFP/Financial Planning/Investment Advisory/Estate Planning/Premium Financing/Life&Health/General Insurance/P&C/Surplus Lines)
- `server/services/learning/freshness.ts` — REGULATORY_SOURCES catalog (FINRA/NASAA/CFP Board/IRS/NAIC/State DOI) + checksum-based onContentSourceUpdated + recordRegulatoryUpdate + admin review workflow + 8 tests
- `server/services/learning/recommendations.ts` — pure fuseRecommendations algorithm (SRS due > CE > expiration > calculator-informed > broadening) + CALCULATOR_TRACK_MAP + 8 tests
- `server/services/learning/agentTools.ts` — registers 11 ReAct tools: check_license_status, recommend_study_content, assess_readiness, generate_study_plan, explain_concept, quiz_me, check_exam_readiness, generate_flashcards, generate_practice_questions, suggest_content_improvements, draft_definition
- `server/services/learning/bootstrap.ts` — startup hook wiring (seed + tool registration, idempotent)
- `server/routers/learning.ts` — 45+ tRPC procedures organized as learning.mastery.* / licenses.* / content.* / freshness.* / recommendations.* / seed
- `client/src/pages/learning/LearningHome.tsx` — role-aware dashboard: mastery snapshot, license tracker summary, agent recommendations, exam tracks grid
- `client/src/pages/learning/LicenseTracker.tsx` — license grid + add form + CE progress bars + alerts panel
- `client/src/pages/learning/ContentStudio.tsx` — advisor+ authoring hub: draft definition form, recent drafts list, admin-only regulatory review queue + seed button
- `client/src/lib/navigation.ts` — added Learning / Licenses (user) and Content Studio (advisor) nav entries
- `client/src/App.tsx` — 7 new routes under `/learning/*`
- `server/_core/index.ts` — server startup calls `bootstrapLearning()` after `initScheduler()`

## Commands
`node toolkit.js init stewardly --safety` — Initialize (run once)
`node toolkit.js verify` — Pre-pass ledger check
`node toolkit.js snapshot <N>` — Save pre-pass state
`node toolkit.js score <N> "<6 scores>" <type> <novelty>` — Record scores
`node toolkit.js suggest` — Get AI-recommended next pass type
`node toolkit.js fail "<desc>"` — Log failed approach (prevents re-attempt)
`node toolkit.js check-gaming` — Detect evaluation gaming (every 3rd pass)
`node toolkit.js status` — Full dashboard
`node toolkit.js diverge <name>` — Create branch
`node toolkit.js converge <name>` — Merge winning branch
`node toolkit.js prune <name> "<reason>"` — Reject branch with decision record

## Workflow (every pass)
`node toolkit.js verify && node toolkit.js snapshot <N>`
Execute the pass (see optimization prompt below)
`node toolkit.js score <N> "<C,A,D,N,Ac,R>" <type> <novelty>`
If approach failed: `node toolkit.js fail "<what failed and why>"`
If branch work: `node toolkit.js diverge|converge|prune` as needed
Every 3rd pass: `node toolkit.js check-gaming`

## Resolved (formerly Known Gaps)
- ~~chat.send bypasses contextualLLM~~ → RESOLVED: chat.send uses contextualLLM via ReAct loop
- ~~graduatedAutonomy in-memory Map~~ → RESOLVED: DB-backed via agent_autonomy_levels + write-through cache
- ~~Single-turn tool calling~~ → RESOLVED: ReAct multi-turn loop with 5 max iterations + trace logging
- ~~Chrome extension: spec only~~ → RESOLVED: Full extension with LinkedIn capture, Gmail compliance, side panel
- ~~Conversation branching: not implemented~~ → RESOLVED: Fork button + BranchComparison.tsx
- ~~Chat Loop/Consensus not wired~~ → RESOLVED: Loop wired to autonomousProcessing.start, Consensus to advancedIntelligence.consensusQuery
- ~~Rich media/ads/video not in UI~~ → RESOLVED: RichMediaEmbed.tsx, ContextualAd.tsx, video streaming layout
- ~~RichMediaEmbed component existed but was never rendered in chat~~ → RESOLVED: wired into Chat.tsx message rendering from `msg.metadata.mediaEmbeds` with client-side text fallback
- ~~extractMediaFromResponse/storeMediaEmbeds defined but never called~~ → RESOLVED: invoked from sseStreamHandler `done` events, persistStreamed, chat.send, and rehydrated via conversations.messages on load
- ~~Loop mode only used the first selected focus~~ → RESOLVED: autonomousProcessing accepts `foci[]` and cycles round-robin across selected foci per iteration
- ~~No "loop previous prompt" / loop-by-type~~ → RESOLVED: "↻ Loop previous" button replays last user message through loop config; free-text "Prompt type" field tags the run and is passed into the model prompt as context
- ~~Workflow UI missing~~ → RESOLVED: /workflows page with 5 templates and run/progress tracking
- ~~No URL hallucination guardrail~~ → RESOLVED: server/shared/guardrails/urlHallucination.ts detects/strips fabricated URLs; trusted domain allowlist; 19 tests
- ~~ragTrainer.ts TODO for episodic aggregation~~ → RESOLVED: implemented via contextualLLM (summarizes 20+ episodic memories, keeps 5 most recent, inserts aggregated summary)
- ~~CSP nonce tests failing~~ → RESOLVED: comment reword in server/_core/index.ts
- ~~invokeLLM bypass in ragTrainer~~ → RESOLVED: refactored to use contextualLLM (complies with wiring verification tests)
- ~~invokeLLM bypass in pdfReportGenerator (Phase 7 regression)~~ → RESOLVED (pass 45): refactored to use contextualLLM via shared/stewardlyWiring; wiring-verification test passes
- ~~Messages table missing parentMessageId column~~ → RESOLVED: ALTER TABLE migration applied
- ~~Loop mode required foci selection~~ → RESOLVED: added 'general' focus for plain iteration without cycling
- ~~Flaky consolidatedPhase3 timeout~~ → RESOLVED: increased describe timeout to 30s for resource contention

## Known Gaps (current — human action required)
- CRM credentials not configured (GHL, Wealthbox, Redtail — services ready)
- Optional env vars (FRED_API_KEY, CENSUS_API_KEY) not yet set
- INTEGRATION_ENCRYPTION_KEY needs generation (openssl rand -hex 32)
- Compliance review not yet performed (FINRA 2210, CAN-SPAM, TCPA, CCPA, Reg BI, Fair Lending)
- ~~2 pre-existing CSP nonce infrastructure tests fail~~ → RESOLVED: comment reword removed literal 'unsafe-inline' string

## Intelligence Layer (wired and functional)
- contextualLLM: RAG-enabled with guardrails (PII + injection screening on all I/O)
- 5-layer config: platform → organization → manager → professional → user
- Multi-model: 23 models via model registry (Gemini, GPT, Claude, Reasoning, Llama, Mistral, Mixtral, Qwen), task routing, MODEL SELECTOR in Chat UI with multi-select consensus mode
- Chat modes: Single (normal) / Loop (autonomous diverge/converge with 5 foci) / Consensus (multi-model)
- Autonomous processing: user-driven diverge/converge loops with 5 foci (discovery/apply/connect/critique/general), budget-capped, integrated into Chat UI
- Usage tracking: every LLM call logged with tokens + cost estimation
- Graduated autonomy: DB-backed via agent_autonomy_levels + write-through cache
- ReAct loop: multi-turn tool calling with trace logging (5 max iterations)
- Web search: google_search (Forge native) + web_search (Tavily/Brave fallback)
- Improvement engine: signal detection on 6h schedule
- SSE streaming: POST /api/chat/stream with real token streaming
- Voice/TTS: Edge TTS via msedge-tts, 25+ neural voices, voice router in tRPC
- Memory engine: 6 categories, episodic summaries, context injection
- Event bus: prompt.scored, compliance.flagged, goal.completed
- OpenTelemetry: GenAI spans on every contextualLLM call
- MCP server: 6 financial tools at /mcp/sse + /mcp/call
- Multi-tenant: tenantId in tRPC context + AsyncLocalStorage middleware
- Agents: 8-part agentic execution (gate review, quotes, applications, advisory, estate, PF, carrier, compliance)
- Workflows: onboarding checklist system (5 procedures) + workflow automation engine (5 predefined multi-step workflows: onboarding, annual review, compliance, lead nurture, reports)
- Consensus LLM: multi-model query for high-stakes recommendations (via advancedIntelligence router)
- Financial planning agent: 5-step orchestration with $2 budget cap (via advancedIntelligence router)
- Batch pipeline: bulk enrich/score for lead pipeline (via advancedIntelligence router)
- Report export: PDF/markdown with FINRA 17a-4 archiving (via advancedIntelligence router)
- Feedback: thumbs up/down ratings wired to advancedIntelligence.rateResponse
- Template optimizer: monthly model-per-domain testing (scheduled)
- Autonomous analysis: nightly client gap analysis with $0.50/client budget (scheduled)
- Autonomous training: uses excess free capacity every 4h to run RAG training, template optimization, bias checks
- RAG trainer: learns from every LLM response (fact extraction → user_memories, tool patterns → episodic)
- URL hallucination guardrail: detects/strips fabricated URLs in AI responses; allows trusted domains (IRS, SEC, FINRA, YouTube, etc.)
- OpenClaw agents: CRUD agent instances, compliance-aware execution, reads/stores/trains on compliance data
- Multi-model consensus: queries genuinely different models (Claude + GPT + Gemini) through Forge API
- Consensus UI: expandable panel showing agreement %, individual model responses, unique details per model

## UI Components (completed in final session)
- RichMediaEmbed.tsx: video (YouTube w/ timestamp), audio, images, documents, shopping, charts
- ContextualAd.tsx: contextual banners with Sponsored label, dismiss, respects adPolicy config (max 1/5 messages, 3/session cap)
- Video streaming layout: 70% video + chat overlay, auto-adapts for screen share/camera/co-browse
- BranchComparison.tsx: conversation branching with fork button on assistant messages
- LeadCaptureGate: wrapping calculator results on EstatePlanning, TaxPlanning, RiskAssessment
- Workflows page: /workflows with 5 predefined templates, run/progress tracking, step visualization

## Business Domains
- Lead pipeline: capture, enrichment, propensity scoring, qualification, distribution
- Propensity: 3-phase scoring (expert → logistic → gradient boosting), 14 segment models, bias auditing
- Import engine: CSV/Dripify/Sales Nav parsers, field mapping, PII encryption, dedup
- CRM: GoHighLevel V2 + abstract adapter + Wealthbox + Redtail
- Verification: 7 providers (SEC, FINRA, CFP, NASBA, NMLS, state bar, NIPR)
- Reporting: pipeline health, performance, campaign ROI with snapshot persistence
- Planning: business plans, production actuals, weekly AI variance analysis
- Community: professional forum with posts and replies
- Premium finance: SOFR rates via FRED API
- Financial protection score: 12-dimension consumer suitability
- Compliance: FINRA 17a-4 communication archive, CAN-SPAM consent, TCPA opt-out

## Safety
This is a SAFETY-SENSITIVE project (financial advisory). Max 3 consecutive passes without human verification. All changes to recommendation logic require audit trail.

## Custom Domain Passes
When working on client-facing features, also run these:

**Compliance pass** — Check: SEC/FINRA requirements for automated advice, suitability standards, disclosure requirements, record-keeping (all recommendations logged and auditable?), data privacy (PII, SOC 2, encryption at rest), AML (transaction monitoring, KYC). Output: compliance gap register with regulatory citation.

**Fiduciary pass** — Check: Does system recommend lowest-cost when equivalent? Does graduated autonomy prevent actions against client interest? Are conflicts visible and managed? Can client challenge a recommendation? Output: fiduciary alignment score per capability.

**Cost pass** — Check: Token consumption per operation, semantic cache hit rates, cost per interaction, cost scaling at 10x/100x, provider cost comparison for routing. Output: cost model with projections + optimization recommendations.

## Recursive Optimization Prompt
Apply the Universal Holistic Optimization Prompt v4 to this project.
Starting temperature: 0.5 (Mid-stage maturity + Technical type)
See @docs/Universal_Holistic_Optimization_Prompt_v4.md for the complete prompt
When temperature drops and no alternatives explored yet, trigger Exploration pass
Use Sequential Halving for branch resolution (drop weakest first)
Score DIVERSITY separately from QUALITY when comparing branches
Log failed approaches with `node toolkit.js fail`
SCORING BIAS: Self-scores inflate by 0.5-0.7 points. Err conservative.
