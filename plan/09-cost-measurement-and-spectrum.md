# plan/09 — Cost-Measurement and Spectrum

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. Three-Property Criterion

A cost category feeds into MeasuredSavings if and only if it satisfies all three properties:

| Property | Definition | Test |
|----------|-----------|------|
| **Defensible** | The cost reduction is attributable to the platform's action, not external factors | Can you prove causation, not just correlation? |
| **Measurable within attribution window** | The savings can be quantified within the billing period | Can you measure it before the invoice is due? |
| **No customer friction** | Measuring the savings does not require customer action or disclosure beyond normal use | Does measurement happen transparently? |

---

## 2. Category Assessment

### 2.1 Categories That Pass (feed MeasuredSavings)

| Category | Defensible | Measurable | No Friction | Method |
|----------|-----------|------------|-------------|--------|
| **AI call cost optimization** | Yes — sovereign routing chose cheaper provider | Yes — per-call cost logged | Yes — automatic | Compare actual cost vs. default-provider cost |
| **Time savings (automated tasks)** | Yes — task was automated that previously required manual work | Yes — task completion time logged | Yes — automatic | Compare automated time vs. industry benchmark for manual |
| **Search efficiency** | Yes — search cascade found answer faster | Yes — query-to-answer time logged | Yes — automatic | Compare cascade time vs. single-provider time |
| **Document processing** | Yes — automated extraction vs. manual reading | Yes — processing time logged | Yes — automatic | Compare AI extraction time vs. industry benchmark |
| **Compliance automation** | Yes — automated review vs. manual compliance check | Yes — review completion logged | Yes — automatic | Compare automated review time vs. manual benchmark |
| **Memory-assisted context** | Yes — M8 reduced token usage | Yes — token count logged | Yes — automatic | Compare M8-assembled prompt vs. full-context prompt |

### 2.2 Categories That Fail (do NOT feed MeasuredSavings)

| Category | Fails On | Reason |
|----------|----------|--------|
| **Revenue increase** | Defensible | Cannot prove causation between platform use and revenue growth |
| **Client retention** | Measurable | Cannot measure within single billing period |
| **Reputation improvement** | Measurable + Defensible | Cannot quantify or attribute |
| **Stress reduction** | Measurable + No Friction | Would require self-reporting |

---

## 3. Energy Telemetry Sources

### 3.1 Available Sources (Web-Only Scope)

| Source | Data | Access Method |
|--------|------|---------------|
| **Forge API response headers** | Token counts, model used, latency | HTTP response parsing |
| **BYO-local inference server** | GPU utilization, tokens/sec, model loaded | User-configured endpoint (if exposed) |
| **Platform compute** | Server CPU/memory for processing | Internal metrics |
| **Search provider** | Queries made, results returned | API response metadata |

### 3.2 Sources Deferred (Require Native Shell)

| Source | Reason for Deferral |
|--------|-------------------|
| OS-level power APIs | Requires native shell (Tauri) — deferred per v2.0.3 §2.1 |
| GPU telemetry from same-process inference | Requires bundled sidecar — deferred |
| Battery consumption metrics | Requires native APIs — deferred |

### 3.3 BYO-Local GPU Telemetry (In Scope)

Per v2.0.3: "graphics processing unit telemetry from user-configured local inference servers IS in scope"

```typescript
interface BYOLocalTelemetry {
  // Queried from user's Ollama/vLLM/etc. API
  modelLoaded: string;
  gpuUtilization: number;      // 0-100%
  tokensPerSecond: number;
  vramUsedMB: number;
  vramTotalMB: number;
  inferenceLatencyMs: number;
}

// Polling endpoint (user configures in BYO settings)
async function pollBYOTelemetry(endpoint: string): Promise<BYOLocalTelemetry> {
  // Standard Ollama API: GET /api/ps
  // Standard vLLM API: GET /metrics
  // Unified adapter pattern
}
```

---

## 4. Software Displacement Tracking

### 4.1 Displacement Categories

| Displaced Software | Stewardly Equivalent | Measurement |
|-------------------|---------------------|-------------|
| Financial planning tools (MoneyGuidePro, eMoney) | Wealth Engine | Feature usage frequency × displaced tool monthly cost |
| CRM (Salesforce, Redtail) | People Engine | Contact management actions × displaced tool per-seat cost |
| LMS (various) | Learning Engine | Study sessions × displaced tool monthly cost |
| Research tools (Morningstar, Bloomberg terminal) | Intelligence Engine | Research queries × displaced tool per-query cost |
| Compliance tools (Smarsh, Global Relay) | Compliance features | Reviews completed × displaced tool per-review cost |

### 4.2 Displacement Calculation

```typescript
interface DisplacementCalculation {
  category: string;
  displacedToolMonthly: number;     // What the displaced tool costs per month
  stewardlyUsageRate: number;       // % of displaced tool's functionality used via Stewardly
  displacementValue: number;        // displacedToolMonthly × stewardlyUsageRate
}

// Only counts if user was previously paying for the displaced tool
// OR if industry benchmark shows typical cost for that function
```

### 4.3 Measurement Method

1. At onboarding, user optionally indicates current tools (no friction — optional)
2. If not indicated, use industry benchmarks for role-appropriate tools
3. Track feature usage that maps to displaced tool functionality
4. Calculate displacement value based on usage rate × tool cost

---

## 5. Administrative Spectrum

### 5.1 Four Positions Per Integration Class

| Position | Description | Who Decides | Audit |
|----------|-------------|-------------|-------|
| **Manual** | AI provides information only; human executes all actions | Human | Full audit trail |
| **Supervised** | AI proposes actions; human approves before execution | Human approves | Proposal + approval trail |
| **Guided** | AI executes routine actions; human reviews periodically | AI executes, human reviews | Execution + review trail |
| **Automatic** | AI executes within defined parameters; human notified | AI executes | Execution + notification trail |

### 5.2 Integration Classes

| Class | Examples | Default Position | Max Position (without counsel) |
|-------|----------|-----------------|-------------------------------|
| **Communication** | Email, SMS, social posts | Supervised | Guided |
| **Financial** | Transactions, transfers, rebalancing | Manual | Supervised |
| **Compliance** | Reviews, filings, disclosures | Manual | Manual (never automatic) |
| **Administrative** | Scheduling, CRM updates, document filing | Guided | Automatic |
| **Research** | Web search, data queries, analysis | Automatic | Automatic |
| **Content** | Report generation, marketing copy, study materials | Supervised | Guided |

### 5.3 Trust Progression

Per-integration-class progression from default to higher positions:

```
Default Position → Demonstrate reliability → Request promotion → Review period → Promoted
```

| Progression Step | Criteria |
|-----------------|----------|
| **Demonstrate reliability** | N successful executions with zero errors in supervised mode |
| **Request promotion** | Admin or user requests position change |
| **Review period** | 30-day observation at new position; auto-demote on error |
| **Promoted** | Position locked until error or manual demotion |

### 5.4 State Machine

```typescript
interface SpectrumState {
  integrationClass: IntegrationClass;
  currentPosition: Position;
  successCount: number;        // Consecutive successes at current position
  errorCount: number;          // Errors at current position
  lastPromotion: number;       // Timestamp of last position change
  reviewPeriodEnd: number | null; // If in review period
}

type PositionTransition = 
  | { type: 'promote'; from: Position; to: Position; reason: string }
  | { type: 'demote'; from: Position; to: Position; reason: string }
  | { type: 'review_start'; position: Position; endsAt: number }
  | { type: 'review_complete'; position: Position; result: 'promoted' | 'demoted' };
```

---

## 6. Database Schema

```sql
-- Administrative spectrum state
CREATE TABLE administrative_spectrum (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  integration_class VARCHAR(50) NOT NULL,
  current_position ENUM('manual', 'supervised', 'guided', 'automatic') NOT NULL,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  last_promotion BIGINT DEFAULT NULL,
  review_period_end BIGINT DEFAULT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id),
  UNIQUE KEY (user_id, integration_class)
);

-- Spectrum transition audit trail
CREATE TABLE spectrum_transitions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  integration_class VARCHAR(50) NOT NULL,
  transition_type ENUM('promote', 'demote', 'review_start', 'review_complete') NOT NULL,
  from_position VARCHAR(20) NOT NULL,
  to_position VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Cost measurement results
CREATE TABLE cost_measurements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category VARCHAR(50) NOT NULL,
  measurement_period_start BIGINT NOT NULL,
  measurement_period_end BIGINT NOT NULL,
  baseline_cost_cents INT NOT NULL,
  actual_cost_cents INT NOT NULL,
  savings_cents INT NOT NULL,
  measurement_method ENUM('direct', 'benchmark', 'displacement') NOT NULL,
  passes_criterion BOOLEAN NOT NULL,
  criterion_details JSON NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Software displacement tracking
CREATE TABLE software_displacement (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  displaced_tool VARCHAR(100) NOT NULL,
  displaced_tool_monthly_cents INT NOT NULL,
  stewardly_usage_rate DECIMAL(5,4) DEFAULT 0.0,
  displacement_value_cents INT DEFAULT 0,
  source ENUM('user_reported', 'industry_benchmark') NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);
```

---

## 7. Implementation Steps

| Step | Action | Dependency |
|------|--------|-----------|
| P-7.1 | Create spectrum schema tables | None |
| P-7.2 | Implement spectrum state machine | P-7.1 |
| P-7.3 | Implement trust progression logic | P-7.2 |
| P-7.4 | Create cost_measurements table | None |
| P-7.5 | Implement three-property criterion evaluator | P-7.4 |
| P-7.6 | Implement energy telemetry collection | Sovereign routing |
| P-7.7 | Implement BYO-local GPU telemetry polling | BYO settings |
| P-7.8 | Create software_displacement table + UI | None |
| P-7.9 | Implement displacement calculation | P-7.8 |
| P-7.10 | Build spectrum console (admin UI) | P-7.2 |
| P-7.11 | Build cost measurement dashboard | P-7.5 |
