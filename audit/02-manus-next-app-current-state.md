# audit/02 — manus-next-app Current State

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit | **Repo:** manus-next-app

---

## 1. Repository Metrics

| Metric | Value |
|--------|-------|
| Client pages | 44 |
| Client components | 395 |
| Server routers | 53 |
| Server services | 17 core services |
| Routes (App.tsx) | 30 |

---

## 2. Architecture — The 4-Layer Agent Stack

manus-next-app implements a four-layer autonomous agent architecture:

| Layer | Service | Purpose |
|-------|---------|---------|
| **AEGIS** | `server/services/aegis.ts` | Pre/post-flight pipeline: task classification, semantic cache, prompt optimization, cost estimation, output validation, quality scoring, fragment/lesson extraction |
| **ATLAS** | `server/services/atlas.ts` | Goal decomposition kernel: break complex goals into sub-task DAGs, budget guards, execution orchestration, failure recovery, reflection |
| **Sovereign** | `server/services/sovereign.ts` | Multi-provider routing: cost/health/capability-based selection, circuit breaker (closed→open→half-open), guardrails, failover, usage tracking |
| **Orchestration** | `server/services/orchestration.ts` | Multi-agent coordination: parallel execution, delegation, consensus |

---

## 3. Key Patterns for Absorption

### 3.1 Search Engine — Tiered Quality-First Degradation

**File:** `server/services/searchEngine.ts`

**Current canonical name:** Search Engine Service (Tiered Quality-First Degradation)

**Contract:**
- Input: `SearchOptions { query, numResults?, dateRange?, searchType? }`
- Output: `SearchResult[] { title, url, snippet, source, publishedDate?, score? }`

**Cascade tiers:**
| Tier | Provider | Cost | Notes |
|------|----------|------|-------|
| 0 | Serper.dev | 2,500 free | Google results |
| 1 | Brave Search API | $5 free/mo | |
| 2 | Tavily | 1,000 free/mo | AI-optimized |
| 3 | DuckDuckGo HTML | Free unlimited | May CAPTCHA |
| 4 | SearXNG | Free unlimited | Rate-limited |
| 5 | Wikipedia + HN | Free unlimited | Always available |
| U | User upgrades | Varies | Google CSE, Bing, custom SearXNG |

### 3.2 Tiered Browser / Content Extraction

**File:** `server/services/tieredBrowser.ts`

**Current canonical name:** Tiered Browser (Content Extraction Service)

**Cascade tiers:**
| Tier | Provider | Capability |
|------|----------|-----------|
| 0 | Cloud Browser | Full Chromium (click/scroll/input) |
| 1 | Jina Reader API | Free, handles JS-rendered pages |
| 2 | HTTP + Readability | Fast, no JS rendering |
| 3 | Basic HTTP fetch | Raw HTML stripping |
| U | Browserbase, Apify, ScrapingBee | User upgrades |

### 3.3 Tiered Voice

**File:** `server/services/tieredVoice.ts`

Tier-aware voice services (ASR + TTS) with quality degradation.

### 3.4 Tiered Image Generation

**File:** `server/services/tieredImageGen.ts`

Multi-provider image generation with cost-based routing.

### 3.5 Embedding Service

**File:** `server/services/embedding.ts`

**Contract:**
- Uses Forge API `/v1/embeddings` endpoint
- Model: `text-embedding-3-small` (1536 dimensions)
- Fallback: keyword-based similarity when API unavailable
- Functions: `generateEmbedding(text)`, `cosineSimilarity(a, b)`

### 3.6 Memory System

**File:** `server/routers/memory.ts`

**Contract:**
- CRUD for memory entries (key-value pairs per user)
- Embedding generation per entry (fire-and-forget)
- Semantic search via cosine similarity on embeddings
- Active/Archived tabs with bulk actions
- Drag-and-drop multi-file upload with auto-categorization
- Categories: facts, preferences, context, instructions

### 3.7 Bridge Context (WebSocket Protocol)

**File:** `client/src/contexts/BridgeContext.tsx`

**Contract:**
- Exponential backoff reconnection (max 5 retries)
- Heartbeat ping/pong with latency measurement
- Auth token handshake
- Structured message protocol: `task:start`, `task:step`, `task:complete`, `task:error`
- Connection quality indicator (latency, reconnect count, uptime)

### 3.8 Task Context (Agent Execution)

**File:** `client/src/contexts/TaskContext.tsx`

**Contract:**
- Client-side nanoid for stable task IDs
- Agent action types: browsing, scrolling, clicking, executing, creating, searching, generating, thinking, writing, researching
- Workspace artifact pipeline from Bridge events
- Per-task message loading with server persistence

### 3.9 Connectors System

**File:** `client/src/pages/ConnectorsPage.tsx` + `server/routers/connector.ts`

**Contract:**
- OAuth-capable connectors: GitHub, Google Drive, Notion, Slack, Calendar, Microsoft 365
- API key connectors: various AI providers, search engines, custom endpoints
- Per-connector health monitoring, rate limit display
- Custom connector creation (user-defined API endpoints)

### 3.10 Client-Side Inference

**File:** `client/src/pages/ClientInferencePage.tsx`

**Contract:**
- WebGPU capability detection
- Local TTS via Kokoro (82M params, 100% in-browser)
- Voice cloning via Chatterbox TTS (Transformers.js)
- Model download/cache management
- Offline capability indicator

### 3.11 Document Studio

**File:** `client/src/pages/DocumentStudioPage.tsx`

Unified document generation: DOCX, XLSX, PDF, Diagrams, AI-assisted.

### 3.12 Deep Research

**File:** `client/src/pages/DeepResearchPage.tsx`

Autonomous multi-source research agent with cited reports.

### 3.13 Data Pipelines

**File:** `client/src/pages/DataPipelinesPage.tsx`

5 source classes, 4 ingestion modes, 3 pipeline topologies, 5 operation categories, 3 storage tiers, 4 runbook templates, governance plane.

### 3.14 Sovereign Dashboard (4-Layer Control Center)

**File:** `client/src/pages/SovereignDashboard.tsx`

Surfaces AEGIS pre/post-flight metrics, ATLAS goal decomposition state, Sovereign multi-provider routing health.

---

## 4. UX Language Patterns

### 4.1 Design Tokens (Light-first)

| Token | Value | Semantic |
|-------|-------|----------|
| --background | oklch(0.98 0.003 80) | Warm editorial (#f8f8f7) |
| --foreground | oklch(0.25 0.01 70) | Warm dark (#34322d) |
| --primary | oklch(0.608 0.1937 254) | Manus blue (#0081f2) |
| --font-sans | System stack (-apple-system, etc.) | |
| --font-heading | Instrument Serif, Libre Baskerville | |
| --font-mono | System monospace | |
| --radius | 0.5rem | |

### 4.2 Interaction Patterns

- **Progressive disclosure** — features reveal as user demonstrates capability
- **Agent action indicators** — real-time display of what the agent is doing (browsing, clicking, executing, etc.)
- **Workspace artifacts** — side panel showing generated files, screenshots, terminal output
- **Connection quality** — latency badge, reconnect indicator
- **Empty states** — branded illustrations with clear CTAs
- **Toast notifications** — sonner for transient feedback
- **Keyboard-first** — command palette, shortcuts, focus management

### 4.3 Navigation Pattern

- Sidebar with conversation list (like Claude/ChatGPT)
- Top-level pages: Home, Library, Projects, Discover, Schedule
- Task view: three-panel (sidebar, chat, workspace)
- Settings: tabbed interface with sub-navigation

---

## 5. Naming Changes from Prior Prompt References

| Prompt Reference | Actual Current Name | Notes |
|-----------------|--------------------|----|
| "Intent Checker" / "GitHub Query Guard" | Not found as named pattern | Functionality distributed across AEGIS task classification + guardrails |
| "iterate-on-validate convergence" | Process improvement router (`processImprovement.ts`) | Implemented as improvement cycle with proposals |
| "multi-engine search cascade" | Search Engine Service (Tiered Quality-First Degradation) | 7-tier cascade in `searchEngine.ts` |
| "Sovereign Mode" | Sovereign Service + SovereignDashboard | Multi-provider routing with circuit breaker |
| "tiered live preview" | Live Preview Service (`livePreview.ts`) | |
| "sandbox execution" | Not found as standalone | Integrated into task execution flow |

---

## 6. Integration Points Affecting Absorption

| Pattern | Dependencies | Absorption Risk |
|---------|-------------|----------------|
| AEGIS | Forge LLM API, DB (cache, fragments, lessons) | Medium — needs schema additions |
| ATLAS | AEGIS (pre/post-flight), Sovereign (routing), DB (goals, tasks) | Medium — needs schema additions |
| Sovereign | Provider configs, circuit breaker state, usage DB | Medium — needs provider registry |
| Search Engine | External API keys (Serper, Brave, Tavily) | Low — additive |
| Tiered Browser | Jina API, Readability lib | Low — additive |
| Embedding | Forge API `/v1/embeddings` | Low — additive |
| Memory | Embedding service, DB (entries, embeddings) | Medium — schema + service |
| Bridge/WebSocket | Custom protocol, auth handshake | High — architectural |
| Client Inference | WebGPU, Kokoro, Chatterbox | Low — frontend-only |
| Connectors | OAuth flows, API key storage, health monitoring | Medium — schema + UI |

---

## 7. Archival Readiness

The repository contains extensive session artifacts (50+ analysis files, video analyses, test scripts, debug notes) that are historical documentation. The core application code is well-structured for absorption. Key archival actions per v2.0.2:

1. Tag `archived-final-state-YYYYMMDD`
2. Update README to direct development to stewardly-ai
3. Preserve historical documentation
4. Sunset deployment with redirect/notice
