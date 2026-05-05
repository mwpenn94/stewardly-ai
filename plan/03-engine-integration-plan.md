# plan/03 — Engine Integration Plan

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. Engine Inventory

| Engine | Current State | v1.0 AI Features | Primitives Composed |
|--------|-------------|-------------------|---------------------|
| Wealth | Mature (30+ procedures, 656 tests) | Financial twin, Monte Carlo, tax planning, estate, product comparison, WealthChat | chat-surface, rag, voice, document-intelligence, classifier, proposal-generator |
| Learning | Mature (FSRS-5, assessments, CE credits) | Adaptive study, content recommendation, audio study, knowledge assessment | chat-surface, rag, voice, embeddings, classifier |
| People | Mature (CRM, cadence, compliance) | Lead scoring, outreach automation, compliance review, COI network | chat-surface, classifier, proposal-generator, document-intelligence |
| Intelligence | Operational (deep context, ReAct, web search) | Multi-modal processing, web research, agentic workflows, knowledge base | All 8 primitives |
| Continuous Improvement | Operational (signals, hypotheses, proposals) | Platform self-assessment, improvement cycles, quality rating | proposal-generator, embeddings, classifier |

---

## 2. Per-Engine Integration Plan

### 2.1 Wealth Engine

**Already there:**
- WealthChat with 5 tools (financial twin, calculators, tax, estate, products)
- Monte Carlo simulation
- PDF report generation with Edge TTS narration
- Shareable links
- 656 calculator tests

**Needs reconciling:**
- WealthChat currently uses `contextualLLM` directly → wire through sovereign routing for cost tracking
- Knowledge base queries (product research) → wire through RAG with embeddings for semantic search
- Compliance checks on recommendations → wire through classifier for sensitivity gating
- Report generation → wire through document-intelligence for structured output

**Integration steps:**
1. Replace direct `contextualLLM` calls with sovereign-routed calls (preserves existing behavior, adds cost tracking)
2. Add RAG query for product knowledge base (supplements existing keyword search)
3. Add classifier check before financial recommendations (gates sensitive content)
4. Add tier indicator to WealthChat responses

**Risk:** Medium — WealthChat is the most-used feature; changes must be backward-compatible.

### 2.2 Learning Engine

**Already there:**
- FSRS-5 spaced repetition
- Assessment sessions with scoring
- CE credit tracking
- Content CMS with freshness
- Audio study with segment tracking
- Social/collaborative features

**Needs reconciling:**
- Content search → wire through RAG for semantic content discovery
- Study recommendations → wire through embeddings for similarity-based suggestions
- Audio study → already uses voice primitive (Edge TTS); add tier routing
- Assessment generation → wire through sovereign routing for cost tracking

**Integration steps:**
1. Add embedding generation on content creation/update (background job)
2. Replace keyword content search with RAG semantic search
3. Add sovereign routing to assessment generation LLM calls
4. Add classifier to user-submitted content (detect sensitive information in study materials)

**Risk:** Low — Learning engine is self-contained; changes are additive.

### 2.3 People Engine

**Already there:**
- Lead pipeline with scoring
- GHL bidirectional sync
- Cadence engine (7 cadences)
- Compliance review (FINRA 2210/SEC)
- COI network
- Email campaigns
- Marketing asset generation

**Needs reconciling:**
- Compliance review → wire through classifier (sensitivity classification on outbound content)
- Marketing content generation → wire through sovereign routing
- Lead scoring → wire through embeddings for semantic lead matching
- Cadence content → wire through classifier before send (compliance gate)

**Integration steps:**
1. Add classifier as pre-send gate on all outbound communications
2. Wire marketing content generation through sovereign routing
3. Add embedding-based lead similarity scoring (supplement existing scoring)
4. Add tier indicator to compliance review results

**Risk:** Medium — Compliance is critical; classifier must not produce false negatives.

### 2.4 Intelligence Engine

**Already there:**
- Deep context assembler
- Contextual LLM
- ReAct loop
- Web search
- Multi-modal processing
- Knowledge base with ingestion

**Needs reconciling:**
- Web search → replace with search cascade (multi-provider)
- Content extraction → replace with tiered browser
- LLM calls → wire through sovereign routing + AEGIS pre/post-flight
- Knowledge base → wire through RAG with embeddings
- ReAct loop → add AEGIS pre/post-flight wrapping

**Integration steps:**
1. Replace `webSearch.ts` with search cascade service
2. Extend `webExtractor.ts` with tiered browser degradation
3. Wrap ReAct loop with AEGIS pre-flight (classification, cache check) and post-flight (quality scoring, lesson extraction)
4. Add sovereign routing to all LLM calls within intelligence engine
5. Add RAG to knowledge base queries
6. Add embedding generation to knowledge ingestion pipeline

**Risk:** Medium-High — Intelligence engine is the most interconnected; changes affect all other engines that use it.

### 2.5 Continuous Improvement Engine

**Already there:**
- Signal detection
- Hypothesis generation
- Improvement proposals
- Platform self-assessment
- Quality rating
- Convergence checks

**Needs reconciling:**
- Signal detection → add embedding-based signal deduplication
- Hypothesis generation → wire through sovereign routing
- Self-assessment → add substrate health metrics (AEGIS cache hit rate, sovereign routing health, classifier accuracy)

**Integration steps:**
1. Add embedding-based signal similarity (deduplicate similar signals)
2. Wire hypothesis generation through sovereign routing
3. Extend self-assessment to include substrate primitive health metrics
4. Add cost-measurement data to improvement signal sources

**Risk:** Low — Improvement engine is meta-level; changes are additive.

---

## 3. Cross-Engine Query Routing (E-6)

The chat-router primitive enables queries that span multiple engines:

```typescript
interface CrossEngineQuery {
  classify(query: string): EngineTarget[];
  route(query: string, targets: EngineTarget[]): Promise<RoutedResponse>;
  merge(responses: EngineResponse[]): Promise<MergedResponse>;
}
```

**Example:** "What's my tax liability on the investment property I'm studying in Module 3?"
- Classifier detects: Wealth (tax) + Learning (Module 3)
- Router: Queries both engines in parallel
- Merger: Combines responses with proper attribution

**Implementation:** Extend existing contextualLLM's deep context assembler to pull context from multiple engine registries based on classifier output.

---

## 4. Integration Order (respects dependencies)

| Order | Step | Engine | Dependency |
|-------|------|--------|-----------|
| 1 | Substrate primitives built (Phase A + E) | — | — |
| 2 | Intelligence engine integration | Intelligence | All primitives |
| 3 | Wealth engine integration | Wealth | Sovereign routing, RAG, classifier |
| 4 | People engine integration | People | Classifier, sovereign routing |
| 5 | Learning engine integration | Learning | RAG, embeddings, sovereign routing |
| 6 | Continuous Improvement integration | CI | Embeddings, sovereign routing |
| 7 | Cross-engine query routing | All | All engines integrated |

---

## 5. Verification Per Engine

After each engine integration:

1. All existing tests for that engine pass unchanged
2. New substrate-wired paths produce equivalent or better results
3. Cost tracking captures all LLM calls within the engine
4. Tier indicators appear on all AI-generated responses
5. Classifier gates prevent sensitive data from routing to inappropriate tiers
