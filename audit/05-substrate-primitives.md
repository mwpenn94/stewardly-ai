# audit/05 — Substrate Primitive Assessment

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit

---

## 1. The Eight Primitives (per Architecture Reference §4)

The substrate publishes exactly eight primitives. This document assesses each primitive's current implementation state, gap severity, and absorption plan.

---

## 2. Primitive-by-Primitive Assessment

### 2.1 chat-surface

**Required contract:** Streaming chat UI with tier indicator, voice input/output, mobile-first responsive.

**Current state in stewardly-ai:**
- ✅ Streaming chat via SSE (`server/shared/streaming/sseStreamHandler.ts`)
- ✅ Voice input (Whisper transcription via Deepgram + built-in)
- ✅ Voice output (Edge TTS with 20+ neural voices, voice selector UI)
- ✅ Mobile-first responsive (PersonaSidebar5 with Sheet drawer on mobile)
- ❌ No tier indicator (user cannot see LOCAL/AUTO/CLOUD routing)
- ❌ No show-your-work affordances

**Gap:** Tier indicator + show-your-work. Severity: P2.

**Absorption plan:** Add tier badge component to chat message bubbles. Add expandable "show reasoning" section. Wire to classifier output (once GAP-S3 resolved).

---

### 2.2 agentic-runtime

**Required contract:** Multi-step agent execution with checkpoints, cancellation, resume.

**Current state in stewardly-ai:**
- ✅ ReAct multi-turn tool calling loop (`server/shared/intelligence/reactLoop.ts`)
- ✅ Agent instances with lifecycle management (`agentInstances` table)
- ✅ Agent actions with status tracking (`agentActions` table)
- ✅ Reasoning trace logging to DB (`reasoningTraces` table)
- ✅ OpenClaw Orchestrator (G1) for agent lifecycle
- ⚠️ Checkpointing exists (agent instances have state) but no explicit resume-from-checkpoint
- ❌ No user-visible cancellation UI (backend support unclear)

**Gap:** Explicit checkpoint/resume + cancellation UI. Severity: P2.

**Absorption plan:** Add checkpoint serialization to ReAct loop. Add cancel button to agent execution UI. Wire to existing agent instance state.

---

### 2.3 rag

**Required contract:** Retrieval-augmented generation over scoped corpora — embed, store, query, rank with citations.

**Current state in stewardly-ai:**
- ✅ Knowledge base with CRUD (`server/routers/knowledgeBase.ts`)
- ✅ Search endpoint (keyword-based)
- ✅ Content ingestion pipeline (`server/services/knowledgeIngestion.ts`)
- ✅ File processing with chunking (`server/services/fileProcessor.ts`)
- ❌ No vector embeddings stored
- ❌ No semantic similarity search
- ❌ No citation tracking in responses
- ❌ No corpus scoping (all content in one flat namespace)

**Gap:** Embeddings + semantic search + citations + scoping. Severity: P1.

**Absorption plan:**
1. Absorb embedding service from manus-next-app
2. Add embedding column to knowledge articles and file chunks
3. Implement semantic search with cosine similarity ranking
4. Add citation metadata to LLM responses (source article ID + chunk offset)
5. Add corpus scoping (per-user, per-firm, global)

---

### 2.4 embeddings

**Required contract:** Standalone embedding generation; deterministic; never network-egress.

**Current state in stewardly-ai:**
- ❌ Not implemented

**Current state in manus-next-app:**
- ✅ `server/services/embedding.ts` — Forge API `/v1/embeddings`
- ✅ Model: `text-embedding-3-small` (1536 dimensions)
- ✅ Fallback: keyword-based similarity
- ✅ Functions: `generateEmbedding(text)`, `cosineSimilarity(a, b)`

**Gap:** Entire primitive missing. Severity: P1.

**Absorption plan:**
1. Copy embedding service from manus-next-app
2. Adapt to stewardly-ai's env/config patterns
3. Add DB table for embedding storage (memory entries, knowledge chunks, file chunks)
4. Note: "never network-egress" requirement partially deferred — Forge API is network call. True local embeddings (fastembed-rs) deferred to native shell run. Keyword fallback satisfies offline degradation.

---

### 2.5 voice

**Required contract:** Automatic speech recognition + text-to-speech + voice-activated commands; tier-routed.

**Current state in stewardly-ai:**
- ✅ TTS: Edge TTS with 20+ curated neural voices, voice catalog, voice selector UI
- ✅ ASR: Whisper transcription via platform helper (`server/_core/voiceTranscription.ts`)
- ✅ ASR: Deepgram integration for real-time transcription
- ✅ Audio study with segment-level tracking and spaced repetition
- ⚠️ No voice-activated commands (push-to-talk exists but no wake-word)
- ❌ No tier routing for voice (all goes through single provider)

**Gap:** Voice-activated commands + tier routing. Severity: P3.

**Absorption plan:** Voice commands are primarily a native-shell feature (wake-word requires always-on mic). For web: push-to-talk is sufficient. Tier routing for voice added when Sovereign routing absorbed.

---

### 2.6 document-intelligence

**Required contract:** OCR, layout analysis, form extraction, summarization, classification.

**Current state in stewardly-ai:**
- ✅ OCR via multi-modal processing (`server/routers/multiModalProcessing.ts`)
- ✅ Document extraction (`server/services/multiModal.ts` — documentProcessor)
- ✅ Video transcription
- ✅ Unified search across documents
- ✅ Annotation service
- ✅ File processing pipeline with chunking
- ⚠️ Layout analysis depth unclear (may be basic OCR only)
- ⚠️ Form extraction depth unclear

**Gap:** Verify layout analysis and form extraction depth. Severity: P3.

**Absorption plan:** Test existing OCR against structured documents (tax forms, insurance applications). If insufficient, enhance with vision LLM for layout understanding.

---

### 2.7 classifier

**Required contract:** Sensitivity classification (NPI/PII/ePHI/Privileged/Operational), intent classification, custom-trained heads. Always LOCAL. Gates every other primitive's tier routing.

**Current state in stewardly-ai:**
- ✅ PII detection (SSN, credit card, email, phone, DOB, routing/account numbers)
- ✅ Injection attack detection (ignore instructions, you-are-now, etc.)
- ✅ URL hallucination detection
- ❌ No 5-category sensitivity taxonomy (NPI/PII/ePHI/Privileged/Operational)
- ❌ No intent classification
- ❌ No custom-trained heads
- ❌ No tier routing gating
- ❌ Not enforced as LOCAL-only

**Gap:** Full classifier with sensitivity taxonomy + intent classification + routing gate. Severity: P1.

**Absorption plan:**
1. Build classifier service with 5-category output
2. Implement intent classification (financial advice, general chat, document processing, etc.)
3. Wire classifier output to routing decisions (once Sovereign absorbed)
4. Enforce LOCAL execution (rule-based classifier runs in-process, no network call)
5. Add classifier verdict to audit trail

---

### 2.8 proposal-generator

**Required contract:** Structured artifact generation for improvement proposals.

**Current state in stewardly-ai:**
- ✅ Improvement engine generates proposals (`server/shared/engine/improvementEngine.ts`)
- ✅ Hypothesis generation with structured output
- ✅ Improvement cycle runner (`server/services/improvement/improvementCycleRunner.ts`)
- ✅ Platform self-assessment (`server/services/improvement/platformSelfAssessment.ts`)
- ✅ Auto quality rater

**Gap:** None significant. Severity: None.

**Absorption plan:** No action needed. Primitive is implemented.

---

## 3. Summary Matrix

| Primitive | Status | Gap Severity | Absorption Source |
|-----------|--------|-------------|-------------------|
| chat-surface | ⚠️ 90% | P2 | Internal (add tier indicator) |
| agentic-runtime | ⚠️ 80% | P2 | Internal (add checkpoint/cancel) |
| rag | ⚠️ 40% | P1 | manus-next-app (embedding) + internal |
| embeddings | ❌ 0% | P1 | manus-next-app (full absorb) |
| voice | ⚠️ 85% | P3 | Internal (tier routing) |
| document-intelligence | ⚠️ 75% | P3 | Internal (verify depth) |
| classifier | ⚠️ 30% | P1 | Internal (new build) |
| proposal-generator | ✅ 100% | None | N/A |

---

## 4. Architectural Rule Verification

> "The substrate has zero engine-specific code. Engines consume substrate primitives via the Intent contract. Engines never import other engines."

**Verification result:** The shared intelligence layer (`server/shared/`) is engine-agnostic. The `stewardlyWiring.ts` file re-exports through standard interface. Individual engines (wealth, learning, people) import from `shared/stewardlyWiring` not from each other. **Rule satisfied.**

**ESLint enforcement:** Not currently configured. Recommend adding import restriction rules to prevent cross-engine imports.
