# Stewardly — Recursive Optimization Project

## Overview
5-layer financial advisory AI platform. Reference architecture from which shared packages (@platform/intelligence, @platform/config) are extracted for Atlas, AEGIS, and Sovereign.

## Stack
TypeScript, tRPC, Drizzle ORM, TiDB, React 19
105 pages, 314 tables, 2,304 tests passing, 204 services, 69 routers, 40 seed modules
Current state: ~95% deep, 5% scaffolded (UI/UX optimized, 8 recursive passes converged)

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

## Known Gaps (current)
- Some DB tables not deployed (migration ready, needs TiDB IP whitelist)
- CRM credentials not configured (GHL, Wealthbox, Redtail — services ready)
- Optional env vars (FRED_API_KEY, CENSUS_API_KEY) not yet set
- Compliance review not yet performed (FINRA 2210, CAN-SPAM, TCPA, CCPA, Reg BI, Fair Lending)

## Intelligence Layer (wired and functional)
- contextualLLM: RAG-enabled with guardrails (PII + injection screening on all I/O)
- 5-layer config: platform → organization → manager → professional → user
- Multi-model: 16 models via model registry, task-based routing, fallback chain
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
- Workflows: onboarding checklist system (5 procedures — not multi-step orchestration engine)
- Consensus LLM: multi-model query for high-stakes recommendations (via advancedIntelligence router)
- Financial planning agent: 5-step orchestration with $2 budget cap (via advancedIntelligence router)
- Batch pipeline: bulk enrich/score for lead pipeline (via advancedIntelligence router)
- Report export: PDF/markdown with FINRA 17a-4 archiving (via advancedIntelligence router)
- Feedback: thumbs up/down ratings wired to advancedIntelligence.rateResponse
- Template optimizer: monthly model-per-domain testing (scheduled)
- Autonomous analysis: nightly client gap analysis with $0.50/client budget (scheduled)

## Not Yet Implemented (honest gaps — do NOT claim these work)
- Provider failover: providerRouter.ts exists but NOT wired into invokeLLM (forge handles routing)
- Gemini Live Audio: no Gemini-specific voice (Edge TTS only via msedge-tts)
- Multi-model ensemble: consensus queries same provider, not genuinely different providers
- Chrome extension: spec only, no code
- Conversation branching: not implemented
- Sound design / audio cues: not implemented
- LeadCaptureGate: component exists, only on 3 pages (not 20+ calculators as claimed)
- VerificationBadge: component exists, NOT on Professionals page
- EmbedCodeGenerator: component exists, NOT used in any page
- AccessibleChart: component exists, NOT replacing any existing Recharts usage
- Intelligence dashboard widget: NOT implemented (no component)
- Chat enrichment indicator: NOT implemented (no "Enhanced with N sources" shown)
- Autonomy Level settings UI: NOT implemented
- Memory management settings UI: NOT implemented
- Calculator pages directory: does NOT exist (calculators are in main pages)
- 34 seed scripts: only 18 exist (16 need web-search-verified financial data)

## Business Domains (new — April 2026 build-out)
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
