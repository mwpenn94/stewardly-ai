# Unified Master Plan — Project Context Reference

**Source:** `UNIFIED_MASTER_PLAN_COMPLETE(2).docx` (March 2026)
**Owner:** Mike Penn | WealthBridge Financial Group | AZ Region 1
**Rating:** 9.5/10 — Convergence reached after 12 recursive optimization passes

---

## 1. Four-Project Architecture

| Project | Architecture | Scale | Depth |
|---|---|---|---|
| **Stewardly (Reference)** | 5-Layer Financial Advisory | 62 pages / 262 tables / 1,746 tests / 174 services | 70% deep, 20% partial, 10% scaffolded |
| Sovereign Hybrid | AEGIS+ATLAS+Sovereign (3-Layer) | 25 pages / 66 tables / 231 tests / 8 services | ~15% deep (heuristic) |
| Atlas Hybrid | AEGIS+ATLAS (2-Layer) | 16 pages / 31 tables / 437 tests / 9 services | ~15% deep (heuristic) |
| AEGIS Hybrid | AEGIS only (1-Layer) | 21 pages / 34 tables / 160 tests / ~8 services | ~15% deep (heuristic) |

**Strategic implication:** Stewardly is the reference architecture. Extract intelligence services once (~20-24 hours) and integrate into the other 3 projects (~20-30 hours). Total: 40-54 hours vs 300+ hours building independently.

---

## 2. Stewardly's Existing Capabilities (vs Other Projects)

| Capability | Atlas/AEGIS/Sovereign | Stewardly |
|---|---|---|
| RAG / Deep Context | Raw invokeLLM, no context | contextualLLM.ts wrapping deepContextAssembler.ts (14 sources, 29 DB queries) |
| Memory | Session-scoped only | memoryEngine.ts: 3-tier persistent (facts, preferences, episodes) |
| Tool Calling | Zero | Chat loop with tool_choice:'auto', executeAITool/executeSearchTool |
| Tool Registry | None | aiToolsRegistry.ts: typed registration, discovery, OpenAI function-calling format |
| Graduated Autonomy | None | graduatedAutonomy.ts: 4 trust levels, 11 actions (PARTIAL: in-memory) |
| Provider Failover | Try/catch simulated | llmFailover.ts: multi-provider, circuit breaker, health metrics |
| Real-time Notifications | 30s polling | websocketNotifications.ts: Socket.io, typed payloads, quiet hours |
| Rate Limiting | Zero | adaptiveRateManagement.ts (567 lines) |
| Multi-tenancy | Zero | 64 org schema references, orgProviders.ts (709 lines) |
| Compliance | None | 36 schema refs, compliancePrescreening, regBIDocumentation |
| 5-Layer AI Config | None | aiLayers router (492 lines), aiConfigResolver.ts |
| Learning/Mastery | None | StudyBuddy.tsx, BehavioralCoach.tsx, AMP/HO frameworks |

---

## 3. Verified Gaps in Stewardly

| Gap | Evidence | Effort |
|---|---|---|
| 37 services still use raw invokeLLM bypassing RAG | grep confirms dual-import pattern | 8-12h |
| Main chat.send uses raw invokeLLM at lines ~230/~266 | Verified: tool-calling flow bypasses contextualLLM | 30 min |
| graduatedAutonomy uses in-memory Map, not database | 155 lines, no DB writes, resets on restart | 2-3h |
| 7-stage workflow engine does NOT exist | workflowRouter is onboarding checklist only | 15-20h |
| Tool calling is single-turn only (no ReAct loop) | LLM calls tools once, done | 3-4h |
| SSE streaming not implemented for chat | WebSocket exists for notifications but chat is fetch-and-wait | 6-8h |
| 262 tables with only 8 indexes | Schema verified | 6-8h |

---

## 4. The Core Problem: Heuristic Scaffolding vs. Real Intelligence

Many "intelligent" features are actually heuristic:

| Claimed Capability | Actual Code | Severity |
|---|---|---|
| LLM-powered task classification | Regex: checks for 'csv' -> data, 'research' -> research. Hardcoded novelty='familiar', confidence=0.75 | CRITICAL |
| 5-dimension quality scoring | accuracy=0.8 (constant), relevance=0.8 (constant), completeness=min(1, length/500) | CRITICAL |
| Intelligent routing cascade | if(complexity==='trivial') cheapest; else if('expert') quality; else default | CRITICAL |
| Semantic cache with similarity | SHA-256 hash only. Zero embedding similarity. Exact match only | HIGH |
| Provider failover | Try/catch returns simulated response string | HIGH |

---

## 5. Recursive Improvement Engine Architecture

### 5.1 Signal Types (Priority Order)

1. **FUNDAMENTAL** — Pre-flight bypass, quality score flatness, static routing, silent RAG degradation
2. **LANDSCAPE** — Unused tools, empty context sources, HO domain blind spots
3. **DEPTH** — Quality score clustering, cache hit rate plateau, AMP phase imbalance
4. **ADVERSARIAL** — Silent cache failure, promoted hypothesis regression, framework drift
5. **FUTURE-STATE** — New uncalibrated providers

### 5.2 Engine Loop

1. Signal Detection -> 2. Priority Routing -> 3. Hypothesis Generation -> 4. Testing (N>=5) -> 5. Anti-Regression (z-score < -1.5) -> 6. Promotion or Rejection -> 7. Convergence Check -> 8. Hypothesis Timeout (7 days)

### 5.3 Anti-Regression

- z-score threshold: < -1.5 per dimension (rigorous), < -1.0 (aggressive)
- Dimension weights: completeness 0.25, accuracy 0.25, relevance 0.20, clarity 0.15, efficiency 0.15
- Minimum N=5 samples (rigorous), N=3 (aggressive)
- Config switch: aggressive-era promotions enter re-validation queue when switching to rigorous

### 5.4 Database Tables

- `improvement_signals` — Event-driven signal log
- `improvement_hypotheses` — Scoped, budgeted hypothesis lifecycle
- `hypothesis_test_results` — Per-test comparison with anti-regression
- `reasoning_traces` — ReAct step-by-step traces
- `user_amp_engagement` — Per-user AMP phase tracking
- `user_ho_domain_scores` — Per-user HO 10-domain trajectory
- `framework_evolution_log` — AMP/HO framework self-improvement audit trail

---

## 6. Hybrid Autonomy: AMP/HO Living Learning System

### Three Connected Loops

- **Loop 1 (memoryEngine):** Per-user personalization — AMP phase tracking, HO domain trajectories
- **Loop 2 (exponentialEngine):** Cross-user pattern discovery with upward propagation (N=1 user -> N=5 role -> N=10 org -> N=20 platform)
- **Loop 3 (improvementEngine):** Framework self-improvement — validates patterns, promotes framework updates through 5-layer cascade

**Flywheel:** Loop 1 collects -> Loop 2 discovers patterns -> Loop 3 validates and promotes -> updated frameworks cascade down -> Loop 1 collects on updated frameworks

---

## 7. Hidden Failure Modes

1. **Silent RAG Degradation** — contextualLLM catches ALL context assembly failures with console.warn
2. **Goodhart's Law** — Same LLM generates and judges; optimize for LLM preferences, not user satisfaction
3. **Extraction Drift** — Bugs fixed in one project's copy won't propagate
4. **Quality Score Type Safety** — Mixed 0-1 and 0-100 scales
5. **Model Drift Invalidation** — Manus model upgrades invalidate all quality scores and cached responses
6. **Platform Lock-in** — Zero abstraction over Manus auth, database, storage

---

## 8. Complete Priority Stack (22 Items)

| # | Work Item | Hours | When |
|---|---|---|---|
| 1 | Security hardening (all projects) | 6-8 | Sprint H1-4 |
| 2 | Extract @platform/intelligence + @platform/config | 8-10 | Sprint H4-8 |
| 3 | Integrate intelligence into 3 projects + fix Stewardly gaps | 6-8 | Sprint H8-12 |
| 4 | SSE streaming for chat | 4-6 | Sprint H12-14 |
| 5 | Recursive improvement engine | 4-6 | Sprint H14-16 |
| 6 | ReAct loop + reasoning traces | 3-4 | Sprint H18-20 |
| 7 | Documentation integrity audit | 2-3 | Sprint H20-22 |
| 8 | Calculator PDF export | 4-6 | Week 2 |
| 9 | WebSocket real-time notifications | 4-6 | Week 2 |
| 10 | LLM-powered classifyTask + scoreQuality | 8-12 | Week 2 |
| 11 | Stewardly workflow engine (7-stage) | 15-20 | Week 3-4 |
| 12 | Monorepo unification | 15-20 | Week 3-4 |
| 13 | Embedding-based semantic cache | 8-12 | Week 4-5 |
| 14 | E2E browser tests (Playwright) | 12-16 | Week 4-5 |
| 15 | Public REST API + OpenAPI spec | 15-20 | Month 2 |
| 16 | Multi-tenancy | 20-30 | Month 2 |
| 17 | CI/CD pipeline | 10-15 | Month 2 |
| 18 | Cross-project learning transfer | 15-20 | Month 3 |
| 19 | Full agentic capabilities | 40-60 | Month 3-4 |
| 20 | MCP-dual-format tool registry | 2 | During extraction |
| 21 | AMP/HO cross-layer shared capabilities | 8-12 | Sprint extraction |
| 22 | Hybrid learning loop wiring (3 loops) | 10-15 | Week 3 |

---

## 9. Verified Scorecard

| Dimension | Stewardly Now | After Sprint | 90-Day |
|---|---|---|---|
| Intelligence Depth | 3.5 | 3.5 (shared) | 4.5 |
| Proactive Behavior | 2.5 | 3.5 (engine) | 4.5 |
| UI/UX Quality | 3.5 | 4.0 (SSE) | 4.5 |
| Personalization | 3.5 | 3.5 (shared) | 4.0 |
| Test Rigor | 3.0 | 3.0 | 4.0 |
| Code Architecture | 3.5 | 3.0 | 4.0 |
| Continuous Improvement | 3.0 | 4.0 (engine) | 4.5 |
| Security | 2.5 | 3.5 | 4.0 |
| Performance | 2.0 | 3.0 (indexes) | 4.0 |
| Agentic Depth | 2.5 | 3.0 (ReAct) | 4.0 |
| Doc Integrity | 3.0 | 4.0 (audit) | 4.5 |

---

## 10. Quantified Business ROI

| Improvement | Annual Value (10 advisors) |
|---|---|
| Workflow Engine (7-stage) | $112,500/yr |
| contextualLLM (RAG) | $37,500/yr |
| Recursive Improvement Engine | $15K-$50K/yr |
| Security Hardening | $50K-$500K risk avoidance |
| Graduated Autonomy | $7,500/yr |
| Semantic Cache | $3,600-$7,200/yr |
| **TOTAL** | **$175K-$225K + $50K-$500K risk** |

---

## 11. Definition of Done (Stewardly)

- Every LLM call uses contextualLLM with full RAG (0 raw invokeLLM calls)
- 7-stage workflow engine operational
- Graduated autonomy DB-persisted and capability-aware
- Multi-turn ReAct tool calling
- FINRA/SEC compliance met
- Multi-tenancy enforced per WealthBridge region
- AMP 5-phase pipeline and HO 10-domain framework configurable per layer AND actively learning
- Frameworks evolve from usage data, personalizing per user while improving defaults for all

---

## 12. Deployment Strategy

| Phase | Mechanism | Timeline |
|---|---|---|
| Sprint (24hr) | Copy-paste extraction with @shared-source/@shared-hash annotations | Immediate |
| Week 2-4 | Test git submodule in Manus sandbox | If submodule works |
| Month 2+ | Private npm package (@platform/intelligence) via GitHub Packages | Clean long-term |
| Month 3+ | True pnpm monorepo | Ideal state |

---

## 13. Future-State Projections (12-36 Months)

| Shift | Timeline | Adaptation |
|---|---|---|
| LLM costs drop 50-75%/yr | Underway | Auto-shift optimization from 'balanced' to 'quality_maximized' |
| MCP becomes standard | 12-18mo | Extract aiToolsRegistry in MCP-dual-format |
| Multi-modal LLMs baseline | 12mo | Extend deepContextAssembler content type |
| FINRA AI-specific guidance | 12-24mo | Wire ReAct reasoning traces into gateReviews |
| Agent-to-agent protocols (A2A) | 18-36mo | @platform/agents with message passing |
| Edge/local LLMs viable | 24-36mo | Sovereign's router already supports Ollama |

---

## 14. Recursive Optimization Prompt

The companion document `recursive-optimization-converged-final(2).md` contains the recursive optimization prompt used to produce this plan. It implements signal-based pass routing (Fundamental > Landscape > Depth > Adversarial > Future-State) with anti-regression rules, convergence detection, and re-entry triggers. Apply this prompt to sprint output for continuous improvement.

---

## 15. Convergence Declaration

Convergence reached after 12 passes. No further pass would produce new content, correct errors, or remove weakening elements. Remaining optimization is execution-dependent (sprint must run) or condition-dependent (FINRA guidance, MCP maturation, LLM cost trajectory).

**Re-Entry Triggers:**
- After 24-hour sprint: Adversarial pass against deployed code
- After 30 days production: Depth pass against real promotion rates
- After FINRA AI guidance: Landscape pass for new compliance gaps
- After monorepo migration: Adversarial pass on shared package boundaries
