# COMPREHENSIVE GUIDE — Stewardly AI

## 1. Setup

### Environment Variables

Required (see `.env.example` for full list):
```
JWT_SECRET=           # Session token signing (required in production)
DATABASE_URL=         # mysql://user:pass@host:port/db
VITE_APP_ID=          # Manus application ID
OAUTH_SERVER_URL=     # Manus OAuth server
BUILT_IN_FORGE_API_URL= # LLM API endpoint
BUILT_IN_FORGE_API_KEY=  # LLM API key
```

Optional integrations:
```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   # Social login
LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY
INTEGRATION_ENCRYPTION_KEY   # AES-256-GCM for credential storage
ALLOWED_ORIGINS              # CORS whitelist (comma-separated)
```

### Install & Run

```bash
pnpm install              # Install dependencies
pnpm run dev              # Development server (tsx watch, port 3000+)
pnpm run build            # Production build (Vite + esbuild)
pnpm run start            # Production server
pnpm test                 # Run vitest (1,877 passing)
pnpm run check            # TypeScript type check
pnpm run db:deploy-missing # Deploy 131 missing tables
```

---

## 2. Architecture

### Layer Overview

```
┌─────────────────────────────────────────────────┐
│  Client (React 19 + Tailwind 4 + shadcn/ui)     │
│  72+ pages, Wouter routing, TanStack Query       │
├─────────────────────────────────────────────────┤
│  tRPC API Layer (53 routers, 1,700+ lines)       │
│  Express 4, middleware chain, session auth        │
├─────────────────────────────────────────────────┤
│  Service Layer (104 services)                     │
│  contextualLLM, memoryEngine, aiToolCalling,     │
│  deepContextAssembler, compliancePrescreening    │
├─────────────────────────────────────────────────┤
│  Data Layer (Drizzle ORM, 262 tables)            │
│  TiDB Cloud (MySQL-compatible), S3 storage       │
└─────────────────────────────────────────────────┘
```

### Data Flow (Chat Request)

```
User Message
  → Context Assembly (deepContextAssembler.ts)
    → Document chunks (RAG retrieval)
    → User memories (fact, preference, goal, financial, temporal)
    → Suitability profile
    → Knowledge base articles
    → Integration data (portfolio, transactions)
  → 5-Layer Config Resolution (aiConfigResolver.ts)
    → Platform defaults → Org overrides → Manager → Professional → User
  → contextualLLM (contextualLLM.ts)
    → Injects <platform_context> block into system prompt
    → PII masking (detectPII, maskPIIForLLM)
    → Tool detection (aiToolCalling.ts)
    → LLM API call (with failover via llmFailover.ts)
  → Post-Processing
    → Compliance prescreening (5-point check)
    → Dynamic disclaimer injection
    → Memory extraction (extractMemoriesFromMessage)
    → Audit trail logging (SHA-256 hash chain)
    → Quality rating
  → Response to Client
```

---

## 3. Intelligence Layer (contextualLLM)

### How It Works

`contextualLLM()` in `server/services/contextualLLM.ts` wraps every LLM call:

1. Calls `deepContextAssembler.ts` to gather relevant context
2. Prepends a `<platform_context>` XML block to the system message
3. Falls back to plain `invokeLLM()` if context assembly fails
4. Used by **34 service files** across the platform

### Context Sources

| Source | Table/Service | What It Provides |
|--------|--------------|------------------|
| Documents | `documents`, `documentChunks` | RAG-retrieved text chunks |
| Memories | `memories`, `memoryEpisodes` | User facts, preferences, goals |
| Suitability | `suitabilityAssessments` | Risk tolerance, horizon, experience |
| Knowledge Base | `knowledgeArticles` | Platform knowledge articles |
| Conversations | `conversations`, `messages` | Recent conversation history |
| Integrations | `snaptradeAccounts`, `plaidHoldings` | Portfolio, transaction data |
| Compliance | `compliancePrescreening` | Compliance flags, disclaimers |
| Gap Feedback | `knowledgeGapFeedback` | User-flagged knowledge gaps |

### RAG Pipeline

1. Document uploaded → text extracted (`documentExtractor.ts`)
2. Text chunked → stored in `documentChunks` with category
3. Query arrives → `searchDocumentChunks()` finds relevant chunks
4. Chunks injected into `<platform_context>` block
5. LLM responds with document-grounded answer

---

## 4. Memory Engine

### Categories (6 types)

| Category | Example | Persistence |
|----------|---------|-------------|
| `fact` | "User is 45 years old" | Permanent until deleted |
| `preference` | "Prefers conservative investments" | Permanent |
| `goal` | "Saving for daughter's college" | Permanent |
| `relationship` | "Works with CPA named John" | Permanent |
| `financial` | "Has $500K in 401(k)" | Permanent |
| `temporal` | "Just got married last month" | Time-bounded |

### Extraction

`extractMemoriesFromMessage()` in `memoryEngine.ts`:
- Analyzes each user message for extractable facts
- Assigns category, confidence score (0-1), and optional time bounds
- Persists via `saveExtractedMemories()` to `memories` table

### Retrieval

`getUserMemories()` returns all active memories for context injection:
- Filtered by category if needed
- Ordered by confidence and recency
- Injected into `<platform_context>` by `deepContextAssembler.ts`

### Episodes

`memoryEpisodes` groups related memories with temporal context:
- Links to multiple memory IDs
- Tracks episode start/end timestamps
- Enables narrative-level memory recall

---

## 5. Configuration Cascade (5-Layer)

### Layer Hierarchy

```
Layer 1: platformAISettings     (global defaults — admin only)
  ↓ overrides
Layer 2: organizationAISettings (org-level — org_admin)
  ↓ overrides
Layer 3: professionalAISettings (professional-level)
  ↓ overrides
Layer 4: managerAISettings      (manager-level)
  ↓ overrides
Layer 5: userPreferences        (user-level — self-service)
```

### Resolution

`resolveAIConfig()` in `aiConfigResolver.ts`:
1. Loads all applicable layers for the user
2. Merges with lower layers overriding higher ones
3. Returns resolved config: model, temperature, token budget, prompt overlays
4. `buildLayerOverlayPrompt()` converts config to system prompt additions

### Configurable Fields

- `defaultModel`, `fallbackModel`
- `temperature`, `maxTokens`
- `ensembleWeights` (multi-model blending)
- `promptOverlay` (custom system prompt additions)
- `complianceLevel`, `disclaimerPolicy`
- `autonomyLevel` (graduated autonomy default)

---

## 6. Streaming

### Current Implementation

Chat responses are delivered via tRPC's standard HTTP response mechanism. The `infrastructureDocs.ts` documents the `/api/trpc/chat.send` endpoint as supporting streaming responses.

**How it works:**
- Client sends message via `trpc.chat.send.mutate()`
- Server processes through contextualLLM pipeline
- Response delivered as complete tRPC response
- Client renders with markdown processing

**Planned upgrade:** Dedicated SSE streaming endpoint (`text/event-stream`) for token-by-token delivery with `streamdown` library (already installed as dependency).

---

## 7. Graduated Autonomy

### Levels

| Level | Name | Behavior |
|-------|------|----------|
| 0 | Manual | All actions require human approval |
| 1 | Assisted | Simple actions auto-approved, complex flagged |
| 2 | Autonomous | Most actions auto-approved, only high-risk flagged |

### Schema (`agentAutonomyLevels`)

```
agentTemplateId, currentLevel, level1Runs, level2Runs,
promotedAt, promotedBy
```

### Escalation

`proactiveEscalation.ts` detects when human intervention is needed:
- Hard triggers: user requests human, compliance score <50, negative sentiment
- Soft triggers: complexity above threshold, topic sensitivity
- Books video consultation via Daily.co integration

---

## 8. AI Tool Calling (ReAct Pattern)

### Available Tools

Defined in `aiToolCalling.ts` as LLM function-calling definitions:

| Tool | Purpose |
|------|---------|
| `calc_iul_projection` | IUL back-testing with S&P 500 data |
| `calc_premium_finance` | Premium finance ROI with SOFR rates |
| `calc_retirement` | Monte Carlo retirement projection |
| `calc_debt_optimizer` | Debt payoff strategies (avalanche/snowball) |
| `calc_tax_optimizer` | Tax bracket analysis, Roth conversion |
| `calc_insurance_needs` | Coverage gap analysis |
| `calc_estate_planning` | Estate tax, trust strategies |
| `calc_education_funding` | 529 plan projections |

### Execution Flow

1. LLM detects tool call needed in response
2. Tool parameters extracted from LLM output
3. Calculator function executed with parameters
4. Results formatted and returned to LLM
5. LLM incorporates results into final response

### Max Iterations

Tool calling supports multi-turn execution — the LLM can chain multiple tool calls in sequence (e.g., calculate retirement → assess insurance gap → recommend products).

---

## 9. Improvement Engine

### Signal Detection

`improvementEngine.ts` monitors:
- User feedback (thumbs up/down on messages)
- Compliance prescreening failures
- Low confidence scores
- Knowledge gap reports

### Hypothesis Generation

- Prompt A/B testing (`promptVariants`, `promptExperiments` tables)
- Tracks variant performance across user segments
- Auto-promotes winning variants based on engagement metrics

### Convergence

- `improvementActions` table tracks all improvement actions
- `improvementFeedback` captures effectiveness ratings
- `layerAudits` and `layerMetrics` monitor layer-level performance
- Knowledge base health score (0-100) tracks coverage, freshness, gaps

---

## 10. API Reference

### tRPC Procedures (53 routers)

**Core:**
- `chat.send` — Send message with contextual LLM processing
- `chat.conversations` — List user conversations
- `chat.messages` — Get conversation messages
- `chat.feedback` — Rate AI responses

**Documents:**
- `documents.list` — User documents
- `documents.upload` — Upload with AI categorization
- `documents.search` — RAG chunk search

**Suitability:**
- `suitability.save` — Save assessment
- `suitability.get` — Get user suitability profile

**AI Config:**
- `aiLayers.resolve` — Get resolved 5-layer config
- `aiLayers.updatePlatform` — Update platform defaults (admin)
- `aiLayers.updateOrg` — Update org settings (org_admin)

**Memory:**
- `memory.list` — Get user memories
- `memory.delete` — Delete a memory

**Compliance:**
- `compliance.prescreen` — Run 5-point compliance check
- `compliance.auditTrail` — Get audit entries

### REST Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/oauth/callback` | GET | Public | OAuth callback |
| `/api/auth/guest-session` | POST | Public | Create guest session |
| `/api/auth/migrate-guest` | POST | Required | Migrate guest data |
| `/api/auth/google/callback` | GET | Public | Google OAuth |
| `/api/auth/linkedin/callback` | GET | Public | LinkedIn OAuth |
| `/api/webhooks/:provider` | POST | HMAC | Webhook ingestion |

---

## 11. Limitations & Planned Improvements

### Current Limitations

1. **131 of 262 tables not deployed** — migration ready, needs DB access
2. **Streaming** is tRPC-implicit, not token-by-token SSE
3. **Integration connectors** require API key registration for live activation
4. **No `amp_engagement` or `ho_domain_trajectory`** memory categories (standard 6 categories used)
5. **No frontend tests** — all 1,877 tests are server-side
6. **~101 pre-existing TypeScript errors** in 6 service files

### Planned Improvements

1. Dedicated SSE streaming endpoint with `streamdown`
2. Live carrier integration for insurance
3. Paper trading simulation
4. Multi-tenant white-label support
5. Browser automation foundation
6. Server-side notification filtering
7. Frontend component test suite
