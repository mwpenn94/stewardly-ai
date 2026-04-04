# Stewardly — Recursive Optimization Project

## Overview
5-layer financial advisory AI platform. Reference architecture from which shared packages (@platform/intelligence, @platform/config) are extracted for Atlas, AEGIS, and Sovereign.

## Stack
TypeScript, tRPC, Drizzle ORM, TiDB, React 19
62 pages, 262 tables, 1,746 tests, 174 services
Current state: ~70% deep, 20% partial, 10% scaffolded

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

## Known Gaps
main `chat.send` bypasses `contextualLLM` (38 raw invokeLLM calls)
`graduatedAutonomy` uses in-memory Map (resets on restart)
7-stage workflow engine doesn't exist (workflowRouter is onboarding checklist)
Tool calling is single-turn only — no ReAct loop

## Extraction Targets
contextualLLM (deepContextAssembler, adaptivePrompts, promptCascade)
memoryEngine (semanticCache, conversationMemory, entityExtraction)
aiToolsRegistry (toolDefinitions, toolCalling, resultIntegration)
graduatedAutonomy (autonomyLevels, permissionGating, escalation)
adaptiveRateManagement (rateLimiting, llmFailover, costTracking)
qualityScoring (replace hardcoded 0.8 scores with LLM-as-judge)

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
