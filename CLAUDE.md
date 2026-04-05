# Stewardly — Recursive Optimization Project

## Overview
5-layer financial advisory AI platform. Reference architecture from which shared packages (@platform/intelligence, @platform/config) are extracted for Atlas, AEGIS, and Sovereign.

## Stack
TypeScript, tRPC, Drizzle ORM, TiDB, React 19
76 pages, 314 tables, 2,254 tests passing, 199 services, 68 routers
Current state: ~80% deep, 15% partial, 5% scaffolded

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
- 131 of 309 DB tables not deployed (migration ready, needs TiDB IP whitelist)
- 34 seed scripts not yet created (financial data requiring web search verification)
- 14 new UI pages not yet built (lead pipeline, import, dashboards, community)
- 28 cron jobs not yet wired (service implementations exist, scheduling pending)
- CRM credentials not configured (GHL, Wealthbox, Redtail — services ready)

## Intelligence Layer (complete)
- contextualLLM: RAG-enabled with guardrails (PII + injection screening on all I/O)
- 5-layer config: platform → organization → manager → professional → user
- Graduated autonomy: DB-backed with write-through cache, default fallback
- ReAct loop: multi-turn tool calling with trace logging
- Improvement engine: signal detection on 6h schedule
- SSE streaming: POST /api/chat/stream
- Memory engine: 6 categories, episodic summaries
- Event bus: prompt.scored, compliance.flagged, goal.completed
- OpenTelemetry: GenAI spans on every contextualLLM call
- MCP server: 6 financial tools at /mcp/sse + /mcp/call
- Multi-tenant: tenantId in tRPC context + AsyncLocalStorage middleware

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
