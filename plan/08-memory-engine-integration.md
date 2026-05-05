# plan/08 — Memory Engine Integration

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. The Eight Memory Mechanisms

| # | Mechanism | Category | Description | Storage |
|---|-----------|----------|-------------|---------|
| M1 | Factual Memory | Factual | User-stated facts ("I have 2 kids", "My risk tolerance is moderate") | Structured key-value |
| M2 | Behavioral Memory | Behavioral | Interaction patterns (preferred response length, time-of-day patterns) | Aggregated metrics |
| M3 | Per-Corpus Memory | Factual | Document-derived knowledge (uploaded files, ingested content) | Embeddings + chunks |
| M4 | Relational Memory | Relational | Relationship graph (client→advisor, team→org, referral networks) | Graph edges |
| M5 | Temporal Memory | Behavioral | Time-aware context (recent topics, session continuity, seasonal patterns) | Time-series |
| M6 | Preference Memory | Behavioral | UI/communication preferences (dark mode, voice speed, notification prefs) | User settings |
| M7 | Goal Memory | Relational | Active objectives (retirement by 55, pass CFP exam, grow AUM 20%) | Structured goals |
| M8 | Personalized Prompt Engine | Cross-cutting | Assembles M1-M7 into context-optimized prompts | Computed (not stored) |

---

## 2. Integration with Engines

### 2.1 Per-Engine Memory Consumption

| Engine | Primary Mechanisms | Usage |
|--------|-------------------|-------|
| Wealth | M1, M3, M5, M7, M8 | Financial facts, uploaded docs, goals, temporal context |
| Learning | M2, M3, M5, M6, M8 | Study patterns, course content, session continuity, preferences |
| People | M1, M4, M5, M7, M8 | Contact facts, relationship graph, temporal context, goals |
| Intelligence | All (M1-M8) | Full context assembly for cross-engine queries |
| Continuous Improvement | M2, M5, M8 | Behavioral patterns, temporal trends, prompt optimization |

### 2.2 Per-Substrate Primitive Memory Integration

| Primitive | Memory Integration |
|-----------|-------------------|
| chat-surface | M6 (UI preferences), M5 (session continuity) |
| agentic-runtime | M7 (goal awareness), M2 (behavioral adaptation) |
| rag | M3 (per-corpus knowledge), M1 (factual context for relevance) |
| embeddings | M3 (chunk vectorization), M8 (prompt embedding) |
| voice | M6 (voice preferences — speed, voice selection) |
| document-intelligence | M3 (document classification context), M1 (entity recognition) |
| classifier | M1 (known sensitivity patterns per user) |
| proposal-generator | M2 (behavioral patterns), M7 (alignment with goals) |

---

## 3. M8 — Personalized Prompt Engine

### 3.1 Input Cost Reduction (5-10× per §III.8)

M8 reduces input tokens by assembling only relevant context:

```typescript
interface PromptAssembly {
  // Instead of sending full history, M8 assembles:
  relevantFacts: M1Fact[];        // Only facts relevant to current query
  behavioralContext: M2Pattern;    // Concise behavioral summary
  corpusContext: M3Chunk[];        // Only relevant chunks (via RAG)
  relationships: M4Edge[];         // Only relevant relationships
  temporalContext: M5Window;       // Recent relevant context
  preferences: M6Prefs;           // Communication preferences
  activeGoals: M7Goal[];          // Currently relevant goals
}

function assemblePrompt(query: string, assembly: PromptAssembly): string {
  // Produces a focused system prompt with only relevant context
  // Reduces typical 8000-token context to 800-1600 tokens
  // 5-10× input cost reduction
}
```

### 3.2 Assembly Strategy

```
User Query → Classify Intent → Identify Relevant Mechanisms
    ↓
For each relevant mechanism:
  - M1: Retrieve facts matching query entities
  - M2: Retrieve behavioral summary (pre-computed, <100 tokens)
  - M3: RAG query for relevant chunks (top-3, ~300 tokens)
  - M4: Retrieve 1-hop relationships from query entities
  - M5: Retrieve last-N relevant interactions (sliding window)
  - M6: Retrieve communication preferences (pre-computed, <50 tokens)
  - M7: Retrieve goals matching query domain
    ↓
Assemble into structured system prompt
    ↓
Total: 800-1600 tokens (vs. 8000+ for full history approach)
```

---

## 4. Memory Portability (First-Class, Not Paywalled)

Per §III.8 Anchor: Memory portability is first-class, not paywalled.

### 4.1 Export Paths

| Format | Contents | Trigger |
|--------|----------|---------|
| **JSON Full Export** | All M1-M7 data in structured format | User request (Settings → Data → Export) |
| **JSON Selective** | Specific mechanisms only | User request with mechanism selection |
| **Embedding Export** | Raw vectors + source text + metadata | User request (advanced) |
| **Deletion** | Complete purge of all memory data | User request (GDPR/CCPA right to erasure) |

### 4.2 Import Paths

| Source | Mechanism | Process |
|--------|-----------|---------|
| **Stewardly JSON export** | All | Direct import (same schema) |
| **Generic JSON** | M1 (facts) | Parse and validate against fact schema |
| **Documents** | M3 (per-corpus) | Document-intelligence → chunk → embed → store |
| **Conversation history** | M1, M2, M5 | LLM extraction of facts, patterns, temporal context |

### 4.3 Portability API

```typescript
// Export
router.get('/api/memory/export', protectedProcedure, async (ctx) => {
  const mechanisms = ctx.input.mechanisms || ['M1','M2','M3','M4','M5','M6','M7'];
  const data = await memoryEngine.export(ctx.user.id, mechanisms);
  return { format: 'stewardly-memory-v1', data, exportedAt: Date.now() };
});

// Import
router.post('/api/memory/import', protectedProcedure, async (ctx) => {
  const { format, data } = ctx.input;
  await memoryEngine.import(ctx.user.id, format, data);
  return { imported: true, mechanisms: Object.keys(data) };
});

// Delete
router.delete('/api/memory', protectedProcedure, async (ctx) => {
  await memoryEngine.purge(ctx.user.id, ctx.input.mechanisms);
  return { purged: true };
});
```

---

## 5. Database Schema

```sql
-- M1: Factual memory
CREATE TABLE memory_facts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category VARCHAR(50) NOT NULL,
  key_name VARCHAR(100) NOT NULL,
  value_text TEXT NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 1.0,
  source VARCHAR(50) NOT NULL, -- 'user_stated' | 'inferred' | 'imported'
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id),
  UNIQUE KEY (user_id, category, key_name)
);

-- M2: Behavioral memory (aggregated)
CREATE TABLE memory_behavioral (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  pattern_type VARCHAR(50) NOT NULL,
  pattern_data JSON NOT NULL,
  sample_count INT DEFAULT 1,
  last_observed BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id),
  UNIQUE KEY (user_id, pattern_type)
);

-- M3: Per-corpus (embeddings table shared with RAG)
-- Uses existing embeddings table with user_id scoping

-- M4: Relational memory
CREATE TABLE memory_relationships (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  entity_a_type VARCHAR(50) NOT NULL,
  entity_a_id VARCHAR(100) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL,
  entity_b_type VARCHAR(50) NOT NULL,
  entity_b_id VARCHAR(100) NOT NULL,
  strength DECIMAL(3,2) DEFAULT 1.0,
  metadata JSON DEFAULT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- M5: Temporal memory
CREATE TABLE memory_temporal (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  context_data JSON NOT NULL,
  relevance_score DECIMAL(3,2) DEFAULT 1.0,
  expires_at BIGINT DEFAULT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- M7: Goal memory
CREATE TABLE memory_goals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  goal_text TEXT NOT NULL,
  domain VARCHAR(50) NOT NULL,
  target_date BIGINT DEFAULT NULL,
  progress DECIMAL(5,2) DEFAULT 0.0,
  status ENUM('active', 'completed', 'paused', 'abandoned') DEFAULT 'active',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);
```

---

## 6. Implementation Steps

| Step | Action | Dependency |
|------|--------|-----------|
| P-5.1 | Create memory schema tables | None |
| P-5.2 | Implement M1 (factual) extraction from conversations | LLM (sovereign routing) |
| P-5.3 | Implement M2 (behavioral) aggregation from usage telemetry | Usage tracking (existing) |
| P-5.4 | Implement M3 (per-corpus) via RAG integration | Embeddings primitive |
| P-5.5 | Implement M4 (relational) from People engine data | People engine |
| P-5.6 | Implement M5 (temporal) sliding window | Conversation history |
| P-5.7 | Implement M6 (preference) from settings | User settings (existing) |
| P-5.8 | Implement M7 (goal) extraction and tracking | LLM + user input |
| P-5.9 | Implement M8 (prompt engine) assembly | M1-M7 all available |
| P-5.10 | Implement export/import/delete API | M1-M7 all available |
| P-5.11 | Build memory settings UI | Export/import API |
