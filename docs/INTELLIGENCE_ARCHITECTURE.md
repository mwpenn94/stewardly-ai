# Stewardly Intelligence Architecture

> Last updated: 2026-04-01 | Pass 12 (Depth — Phase 2 Integration)

## Overview

Stewardly's intelligence layer provides RAG-augmented LLM calls, persistent memory, graduated autonomy, SSE streaming, multi-turn ReAct tool calling, and compliance-safe AI interactions for financial advisory workflows. All LLM access flows through a single wiring layer that ensures context injection, quality normalization, and observability.

## Import Convention

**All application code MUST import from the wiring layer, never directly from service files.**

```typescript
// ✅ CORRECT — from routers/ or server/ level
import { contextualLLM } from "./shared/stewardlyWiring";
import { contextualLLM } from "../shared/stewardlyWiring";

// ✅ CORRECT — also available from wiring
import { contextualLLM, normalizeQualityScore, executeReActLoop } from "../shared/stewardlyWiring";

// ❌ WRONG — direct service import
import { contextualLLM } from "./services/contextualLLM";
import { contextualLLM } from "../services/contextualLLM";
```

**Exception**: `server/memoryEngine.ts` uses raw `invokeLLM` from `_core/llm` to avoid a circular dependency (memoryEngine → contextualLLM → deepContextAssembler → memoryEngine).

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│  Application Layer (routers, services)              │
│  imports: contextualLLM, executeReActLoop           │
│           from shared/stewardlyWiring               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  Wiring Layer: server/shared/stewardlyWiring.ts     │
│  Re-exports: contextualLLM, getQuickContext,        │
│              rawInvokeLLM, normalizeQualityScore,   │
│              executeReActLoop, ReActConfig/Result    │
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
│  Shared Modules                                     │
│  ├── shared/intelligence/reactLoop.ts (ReAct loop)  │
│  ├── shared/streaming/sseStreamHandler.ts (SSE)     │
│  └── shared/engine/improvementEngine.ts (signals)   │
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

### SSE Stream Handler (`server/shared/streaming/sseStreamHandler.ts`)

Server-Sent Events streaming for real-time token-by-token chat display:
1. **Context injection parity**: Calls `getQuickContext()` before streaming to ensure the same RAG context as the non-streaming `contextualLLM` path
2. **Native streaming**: Uses `fetch` with `ReadableStream` to forward LLM tokens as SSE events
3. **Fallback**: If native streaming fails, falls back to `contextualLLM` for a complete response sent as a single SSE event
4. **Lifecycle management**: Heartbeat keepalive (every 15s), `AbortController` for client disconnect cleanup, proper SSE framing with `data:` prefix and `[DONE]` sentinel
5. **Security**: Protected by `generalLimiter` rate limiting and Clerk auth; `sessionId` input validated as positive number
6. **Endpoint**: `POST /api/chat/stream` in `server/_core/index.ts`

### ReAct Multi-Turn Tool Calling (`server/shared/intelligence/reactLoop.ts`)

Structured thought/action/observation loop for multi-step tool execution:
1. **Max rounds**: Configurable (default 5) to prevent infinite loops
2. **Escape hatch**: Breaks early if 2 consecutive iterations produce similar content with no tool calls (detects LLM repetition)
3. **Trace logging**: Each step records `thought`, `action`, `observation`, `toolName`, and `durationMs` to the `reasoning_traces` table for observability
4. **Error resilience**: Tool execution errors are caught and passed as error observations to the LLM, allowing self-correction
5. **Guard**: `logTrace` skips DB writes when `db` or `sessionId` is undefined (unit test safety)
6. **Wired into**: `server/routers.ts` chat.send mutation, replacing the prior inline 65-line tool loop

### Recursive Improvement Engine (`server/shared/engine/improvementEngine.ts`)

Infrastructure for detecting optimization signals and tracking convergence:
1. **`detectSignals(db)`**: Scans 6 signal types:
   - `CONTEXT_BYPASS`: Messages without contextualLLM context injection
   - `TOOL_UNDERUSE`: Active tools not called in the last 30 days
   - `QUALITY_DRIFT`: Average quality rating below 4.0 in the last 7 days
   - `RETRY_SPIKE`: Excessive LLM retries indicating model instability
   - `STALE_HYPOTHESIS`: Promoted improvement hypotheses older than 30 days without validation
   - `MODEL_CONCENTRATION`: Over-reliance on a single model version (>80% of messages)
2. **`checkConvergence(db)`**: Returns true when zero signals are detected
3. **`antiRegressionCheck(db, baseline)`**: Compares current signal count against a baseline to detect regressions
4. **Schema tables**: `improvement_signals`, `improvement_passes`, `improvement_convergence`, `improvement_anti_regression`

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
- **SSE streaming**: Graceful degradation — if context assembly fails, streams without context rather than crashing; if native streaming fails, falls back to complete response

## Future Considerations

### 12 Months
- ~~**Streaming support**: contextualLLM should support streaming responses for real-time chat UX~~ ✅ **DONE** (SSE Stream Handler)
- **Vector embeddings**: Replace TF-IDF retrieval with vector similarity search for better recall
- **Context window management**: Dynamic MAX_CONTEXT_CHARS based on model's context window size
- **Improvement engine consumers**: Wire `detectSignals` into a scheduled background job for continuous monitoring

### 24 Months
- **Multi-model routing**: Route different context types to specialized models (compliance → high-accuracy, chat → fast)
- **Memory consolidation**: Periodic background job to merge/deduplicate memories
- **Observability dashboard**: Track context assembly latency, retrieval quality, and model performance via `reasoning_traces` and `improvement_signals` tables
- **Streaming tool calling**: Extend SSE handler to support ReAct loop with streamed intermediate steps

### 36 Months
- ~~**Agent orchestration**: Graduate from single-turn RAG to multi-step agent workflows~~ ✅ **DONE** (ReAct Loop)
- **Federated context**: Cross-organization context sharing for multi-advisor scenarios
- **Regulatory AI compliance**: Automated SEC/FINRA audit trail generation from the compliance copilot

## Re-entry Triggers

The optimization loop should re-open when:
1. A new LLM provider or model is integrated (requires failover chain update)
2. Context window sizes change significantly (requires MAX_CONTEXT_CHARS adjustment)
3. New data sources are added to deepContextAssembler
4. The 113 pre-existing test failures are addressed
5. Vector search replaces TF-IDF retrieval
6. The improvement engine is wired to a scheduled consumer
7. Streaming tool calling is implemented (ReAct + SSE integration)
