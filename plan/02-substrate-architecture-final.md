# plan/02 — Substrate Architecture Final

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. Substrate Location

The substrate lives at `server/shared/` within the stewardly-ai monolith. This is the existing location of the shared intelligence layer. No restructuring to `packages/ai-substrate/` is needed for web-only scope (per plan/01 deviation justification).

---

## 2. The Eight Primitives — Final Form

### 2.1 chat-surface

**Location:** `client/src/components/` (ChatSurface, AgentActionIndicator, TierBadge, WorkspacePanel)

**Source:** Existing stewardly-ai + manus-next-app UX patterns

**Contract:**
```typescript
interface ChatSurfaceProps {
  sessionId: string;
  onMessage: (msg: UserMessage) => void;
  tierIndicator: TierIndicator; // NEW: shows LOCAL/AUTO/CLOUD
  actionIndicator?: AgentAction; // NEW: shows what agent is doing
  workspaceArtifacts?: Artifact[]; // NEW: side panel artifacts
  voiceEnabled: boolean;
  streamingEnabled: boolean;
}
```

**Dependencies:** voice primitive (for voice I/O), agentic-runtime (for action indicators), classifier (for tier indicator data)

### 2.2 agentic-runtime

**Location:** `server/shared/intelligence/reactLoop.ts` (existing) + `server/shared/intelligence/aegis.ts` (new)

**Source:** Existing stewardly-ai ReAct loop + manus-next-app AEGIS pre/post-flight

**Contract:**
```typescript
interface AgenticExecution {
  // Existing
  execute(input: AgentInput): AsyncGenerator<AgentStep>;
  checkpoint(executionId: string): Promise<CheckpointState>;
  resume(checkpoint: CheckpointState): AsyncGenerator<AgentStep>;
  cancel(executionId: string): Promise<void>;
  
  // New (from AEGIS absorption)
  preFlight(input: AgentInput): Promise<PreFlightResult>;
  postFlight(output: AgentOutput): Promise<PostFlightResult>;
}
```

**Dependencies:** classifier (pre-flight classification), sovereign routing (provider selection), embeddings (semantic cache)

### 2.3 rag

**Location:** `server/shared/intelligence/rag.ts` (new) + existing knowledge base

**Source:** Existing stewardly-ai knowledge base + manus-next-app embedding service

**Contract:**
```typescript
interface RAGPrimitive {
  ingest(document: Document, corpus: CorpusId): Promise<ChunkId[]>;
  query(question: string, corpus: CorpusId, topK?: number): Promise<RankedChunk[]>;
  cite(responseId: string, chunks: ChunkId[]): Promise<Citation[]>;
}

interface RankedChunk {
  content: string;
  score: number; // cosine similarity
  source: { articleId: number; chunkOffset: number; title: string };
  citation: Citation;
}
```

**Dependencies:** embeddings (for vector generation), classifier (for corpus access control)

### 2.4 embeddings

**Location:** `server/shared/intelligence/embedding.ts` (new)

**Source:** manus-next-app `server/services/embedding.ts`

**Contract:**
```typescript
interface EmbeddingPrimitive {
  generate(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
  similarity(a: number[], b: number[]): number; // cosine
}

// Configuration
const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
```

**Dependencies:** Forge API `/v1/embeddings` endpoint (via BUILT_IN_FORGE_API_URL)

**Fallback:** Keyword-based TF-IDF similarity when API unavailable

### 2.5 voice

**Location:** `server/edgeTTS.ts` (existing TTS) + `server/_core/voiceTranscription.ts` (existing ASR) + Deepgram

**Source:** Existing stewardly-ai (already mature)

**Contract:**
```typescript
interface VoicePrimitive {
  synthesize(text: string, voice: VoiceId): Promise<AudioBuffer>;
  transcribe(audio: AudioBuffer, options?: TranscribeOptions): Promise<Transcript>;
  listVoices(): VoiceCatalog;
}
```

**Dependencies:** Edge TTS (free), Deepgram (premium), Whisper (platform)

**Tier routing (new):** When sovereign routing is active, voice provider selection considers cost and quality tier.

### 2.6 document-intelligence

**Location:** `server/services/multiModal.ts` (existing) + `server/services/fileProcessor.ts` (existing)

**Source:** Existing stewardly-ai (already mature)

**Contract:**
```typescript
interface DocumentIntelligencePrimitive {
  extract(file: FileBuffer, mimeType: string): Promise<ExtractedContent>;
  classify(content: ExtractedContent): Promise<DocumentClassification>;
  summarize(content: ExtractedContent, maxLength?: number): Promise<Summary>;
  chunk(content: ExtractedContent, strategy: ChunkStrategy): Promise<Chunk[]>;
}
```

**Dependencies:** Forge LLM (for summarization/classification), embeddings (for chunk vectorization)

### 2.7 classifier

**Location:** `server/shared/guardrails/sensitivityClassifier.ts` (new) + existing guardrails

**Source:** New build (extends existing PII detection)

**Contract:**
```typescript
interface ClassifierPrimitive {
  classifySensitivity(content: string): SensitivityClassification;
  classifyIntent(content: string): IntentClassification;
  
  // Gating function — determines routing tier
  determineRoutingTier(classification: SensitivityClassification): RoutingTier;
}

type SensitivityLevel = "NPI" | "PII" | "ePHI" | "Privileged" | "Operational";
type RoutingTier = "LOCAL" | "AUTO" | "CLOUD_ONLY";

interface SensitivityClassification {
  level: SensitivityLevel;
  confidence: number;
  detectedPatterns: string[];
  routingTier: RoutingTier;
}
```

**Dependencies:** None (rule-based, runs in-process, no network calls)

**Critical constraint:** Always LOCAL. Never makes network calls. Deterministic.

### 2.8 proposal-generator

**Location:** `server/shared/engine/improvementEngine.ts` (existing)

**Source:** Existing stewardly-ai (already complete)

**Contract:**
```typescript
interface ProposalGeneratorPrimitive {
  detectSignals(context: PlatformContext): Promise<Signal[]>;
  generateHypothesis(signal: Signal): Promise<Hypothesis>;
  generateProposal(hypothesis: Hypothesis): Promise<ImprovementProposal>;
  evaluateProposal(proposal: ImprovementProposal): Promise<Evaluation>;
}
```

**Dependencies:** Forge LLM (for generation), embeddings (for signal similarity)

---

## 3. Dependency Graph

```
classifier (no deps — always LOCAL)
    ↓
embeddings (Forge API)
    ↓
rag (embeddings + classifier)
    ↓
agentic-runtime (classifier + embeddings + sovereign routing)
    ↓
chat-surface (agentic-runtime + voice + classifier)

voice (independent — Edge TTS + Deepgram)
document-intelligence (embeddings + Forge LLM)
proposal-generator (embeddings + Forge LLM)

sovereign-routing [cross-cutting] (classifier → routing decisions)
```

---

## 4. Build Order (respects dependency graph)

| Order | Primitive | Reason |
|-------|-----------|--------|
| 1 | classifier | No dependencies; gates everything else |
| 2 | embeddings | Only depends on Forge API (already available) |
| 3 | rag | Depends on embeddings + classifier |
| 4 | sovereign routing | Depends on classifier |
| 5 | agentic-runtime extensions | Depends on classifier + embeddings + sovereign |
| 6 | chat-surface extensions | Depends on agentic-runtime + classifier |
| 7 | voice extensions | Independent but benefits from sovereign routing |
| 8 | document-intelligence extensions | Benefits from embeddings |
| 9 | proposal-generator extensions | Benefits from embeddings |

---

## 5. Engine Consumption Pattern

> "The substrate has zero engine-specific code. Engines consume substrate primitives via the Intent contract."

Each engine imports from `server/shared/stewardlyWiring.ts` which re-exports all primitives:

```typescript
// server/shared/stewardlyWiring.ts (extended)
export { classifySensitivity, classifyIntent, determineRoutingTier } from './guardrails/sensitivityClassifier';
export { generateEmbedding, generateBatchEmbeddings, cosineSimilarity } from './intelligence/embedding';
export { ragIngest, ragQuery, ragCite } from './intelligence/rag';
export { runPreFlight, runPostFlight } from './intelligence/aegis';
export { routeRequest } from './intelligence/sovereignRouting';
// ... existing exports unchanged
```

---

## 6. Schema Additions

New tables required for substrate primitives:

| Table | Purpose | Primitive |
|-------|---------|-----------|
| `embeddings` | Vector storage for knowledge chunks | embeddings + rag |
| `semantic_cache` | AEGIS prompt cache | agentic-runtime |
| `routing_decisions` | Audit trail for tier routing | classifier + sovereign |
| `cost_attribution` | Per-call cost tracking | sovereign routing |
| `memory_mechanisms` | M1-M8 memory storage | memory engine |
| `administrative_spectrum` | Per-class automation positions | admin spectrum |

All schema additions are **purely additive** — no existing tables modified.
