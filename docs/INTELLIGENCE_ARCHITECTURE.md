# Stewardly Intelligence Architecture

> Last updated: 2026-04-01 | Pass 9 (Future-State & Synthesis)

## Overview

Stewardly's intelligence layer provides RAG-augmented LLM calls, persistent memory, graduated autonomy, and compliance-safe AI interactions for financial advisory workflows. All LLM access flows through a single wiring layer that ensures context injection, quality normalization, and observability.

## Import Convention

**All application code MUST import from the wiring layer, never directly from service files.**

```typescript
// ✅ CORRECT — from routers/ or server/ level
import { contextualLLM } from "./shared/stewardlyWiring";
import { contextualLLM } from "../shared/stewardlyWiring";

// ✅ CORRECT — also available from wiring
import { contextualLLM, normalizeQualityScore } from "../shared/stewardlyWiring";

// ❌ WRONG — direct service import
import { contextualLLM } from "./services/contextualLLM";
import { contextualLLM } from "../services/contextualLLM";
```

**Exception**: `server/memoryEngine.ts` uses raw `invokeLLM` from `_core/llm` to avoid a circular dependency (memoryEngine → contextualLLM → deepContextAssembler → memoryEngine).

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│  Application Layer (routers, services)              │
│  imports: contextualLLM from shared/stewardlyWiring │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Wiring Layer: server/shared/stewardlyWiring.ts     │
│  Re-exports: contextualLLM, getQuickContext,        │
│              rawInvokeLLM, normalizeQualityScore    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Service Layer                                      │
│  ├── services/contextualLLM.ts     (RAG wrapper)    │
│  ├── services/deepContextAssembler.ts (15 sources)  │
│  ├── services/graduatedAutonomy.ts (DB-backed)      │
│  └── memoryEngine.ts              (extraction/save) │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Core Layer: _core/llm.ts                           │
│  Raw invokeLLM with circuit breaker                 │
└─────────────────────────────────────────────────────┘
```

## Key Components

### contextualLLM (`server/services/contextualLLM.ts`)

Drop-in replacement for `invokeLLM` that:
1. Extracts the user's query from the messages array
2. Calls `getQuickContext()` to assemble RAG context from 15+ sources
3. Injects a `<platform_context>` block into the system message
4. Falls back to plain `invokeLLM` if context assembly fails
5. Tracks `__modelVersion` on every response for observability
6. **Safety**: Truncates context to `MAX_CONTEXT_CHARS` (12,000) to prevent token overflow

### deepContextAssembler (`server/services/deepContextAssembler.ts`)

Assembles context from 15 parallel sources:
1. Document chunks (enhanced TF-IDF retrieval)
2. Knowledge base articles
3. User profile
4. Suitability assessment
5. Memory engine (extracted memories)
6. Knowledge graph
7. Pipeline data (economic indicators from FRED)
8. Recent conversation history
9. Integration data (Plaid, SnapTrade)
10. Calculator scenarios
11. Proactive insights
12. Client data
13. Activity log
14. Document tags
15. Gap feedback

All sources use `Promise.allSettled` for resilience — individual failures are logged at debug level and do not block the response.

### normalizeQualityScore (`server/shared/intelligence/types.ts`)

Normalizes quality/confidence scores to the [0, 1] range:
- Handles `number | string | null | undefined`
- Scores 1-10 are divided by 10
- Scores > 10 are clamped to 1
- `NaN`, `Infinity`, negative values return 0
- Used in: compliance audit, memory confidence, review queue, AI response quality

### graduatedAutonomy (`server/services/graduatedAutonomy.ts`)

DB-backed autonomy levels with write-through cache:
- Table: `agent_autonomy_levels`
- Levels: supervised → assisted → autonomous → proactive
- Promotion based on trust score thresholds and interaction counts
- Cache: in-memory `Map<number, AutonomyProfile>` for fast reads

### memoryEngine (`server/memoryEngine.ts`)

Extracts and persists user memories from conversations:
- Uses raw `invokeLLM` (NOT contextualLLM) to avoid circular dependency
- Categories: fact, preference, goal, relationship, financial, insurance, estate, tax, compliance, risk, life_event, family, business, document, market_view
- Stores in `memories` and `memoryEpisodes` tables

## Error Handling Policy

- **Intelligence layer**: All catch blocks MUST log with `logger.debug()` including source identifier and error string
- **Silent catch `{}` blocks**: Prohibited in the intelligence layer; acceptable in peripheral services for fire-and-forget event tracking
- **LLM failures**: Circuit breaker in `_core/llm.ts` opens after consecutive failures, auto-resets after cooldown

## Future Considerations

### 12 Months
- **Streaming support**: contextualLLM should support streaming responses for real-time chat UX
- **Vector embeddings**: Replace TF-IDF retrieval with vector similarity search for better recall
- **Context window management**: Dynamic MAX_CONTEXT_CHARS based on model's context window size

### 24 Months
- **Multi-model routing**: Route different context types to specialized models (compliance → high-accuracy, chat → fast)
- **Memory consolidation**: Periodic background job to merge/deduplicate memories
- **Observability dashboard**: Track context assembly latency, retrieval quality, and model performance

### 36 Months
- **Agent orchestration**: Graduate from single-turn RAG to multi-step agent workflows
- **Federated context**: Cross-organization context sharing for multi-advisor scenarios
- **Regulatory AI compliance**: Automated SEC/FINRA audit trail generation from the compliance copilot

## Re-entry Triggers

The optimization loop should re-open when:
1. A new LLM provider or model is integrated (requires failover chain update)
2. Context window sizes change significantly (requires MAX_CONTEXT_CHARS adjustment)
3. New data sources are added to deepContextAssembler
4. The 113 pre-existing test failures are addressed
5. Streaming LLM responses are implemented
6. Vector search replaces TF-IDF retrieval
