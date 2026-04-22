# Simulation/Fake Implementation Audit

## CRITICAL — Must Replace (User-facing fake data)

### 1. server/services/marketStreaming.ts
- `getMarketSnapshot()` returns random prices from hardcoded base prices
- Uses `Math.random()` for price, volume, change
- Source marked as "simulated"
- **FIX**: Use FRED API or Yahoo Finance API for real market data

### 2. server/services/infrastructureResilience.ts (lines 207-240)
- `getCarrierQuotes()` returns simulated carrier insurance quotes
- Uses `Math.random()` for premium variance
- Comment says "Simulated carrier API — in production, this would call real carrier APIs"
- **FIX**: Use COMPULIFE API (already integrated) or real carrier rate tables

### 3. server/services/creditBureau.ts (lines 72-150)
- `performSoftPull()` returns placeholder data when no DB record exists
- Comment says "simulates a soft pull response structure"
- **FIX**: Already partially DB-backed (returns real data if exists). Fix the fallback to return proper error instead of fake data

### 4. server/services/integrationFailover.ts
- Generates demo contacts, pipelines, opportunities with random data
- `generateGHLDemoContacts()`, `generateGHLDemoPipelines()`, `generateGHLDemoOpportunities()`
- **FIX**: This is intentional failover/sandbox data. Mark clearly as demo, but keep as fallback. Ensure real data is preferred.

### 5. server/services/templateOptimizer.ts (line 28-29)
- `optimizeTemplates()` uses `Math.random()` for scores
- Comment: "Score is simulated for now — in production, run actual template through model and score"
- **FIX**: Use LLM to actually evaluate template quality

### 6. server/services/retentionEnforcement.ts (line 49)
- `enforceRetention()` simulates enforcement, doesn't execute actual DB operations
- Comment: "Simulate enforcement (in production, would execute actual DB operations)"
- **FIX**: Execute real DB delete/archive operations

### 7. server/services/loadTesting.ts (line 96)
- `simulateLoadTest()` generates fake performance metrics
- **FIX**: This is a dev/admin tool. Replace with real HTTP request-based load testing.

### 8. server/aiToolCalling.ts (line 1247)
- `model_product_suitability` returns random suitabilityScore: `Math.round(70 + Math.random() * 25)`
- **FIX**: Calculate real suitability score based on client profile

### 9. server/services/adaptivePrompts.ts (line 49)
- Slight randomization for variety in prompt scoring
- **STATUS**: Acceptable — intentional variety mechanism, not fake data

### 10. server/services/promptABTesting.ts (line 128)
- Similarity check simulated
- **FIX**: Use LLM for actual similarity comparison

## LEGITIMATE — Monte Carlo / Financial Simulations (Keep)
- server/engines/bie.ts — BIE financial simulation engine (REAL)
- server/engines/he.ts — Holistic Engine simulation (REAL)
- server/engines/uwe.ts — Unified Wealth Engine simulation (REAL)
- server/calculatorChatTools.ts — Monte Carlo simulation (REAL)
- server/services/statisticalModels.ts — Monte Carlo retirement sim (REAL)
- server/services/investmentIntelligence.ts — Monte Carlo (REAL)

## ACCEPTABLE — Infrastructure patterns (Keep)
- server/_core/llm.ts — Retry jitter with Math.random (standard practice)
- server/apiCache.ts — In-memory cache (appropriate for hot data)
- server/api/v1/rateLimit.ts — In-memory rate limit store (appropriate)
- server/_core/circuitBreaker.ts — Circuit breaker pattern (appropriate)
- server/services/adaptivePrompts.ts — Slight randomization for variety (acceptable)
- ID generation with Math.random (crypto.randomUUID preferred but functional)
