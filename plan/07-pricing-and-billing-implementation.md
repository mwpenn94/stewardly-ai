# plan/07 — Pricing and Billing Implementation

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. Unified Pricing Formula

```
MonthlyInvoice = PlatformFee + DirectCost(0% markup) + InfrastructureMargin − CustomerSavingsShare × MeasuredSavings
```

| Component | Definition | Source |
|-----------|-----------|--------|
| **PlatformFee** | Fixed subscription fee per billing mode | Stripe subscription |
| **DirectCost** | Actual AI provider costs passed through at 0% markup | Cost attribution logger |
| **InfrastructureMargin** | Platform operating costs (hosting, storage, compute) | Fixed percentage |
| **CustomerSavingsShare** | Portion of measured savings returned to customer | Configurable per plan |
| **MeasuredSavings** | Empirically measured cost reduction vs. baseline | M&V engine |

### 1.1 Customer Protection Ceiling

> The customer is never invoiced above what an equivalent cost-plus model would charge.

```
if (MonthlyInvoice > CostPlusEquivalent) {
  MonthlyInvoice = CostPlusEquivalent;
  // Log ceiling hit for M&V reporting
}
```

---

## 2. Three Billing Modes

| Mode | Structure | True-Up | Best For |
|------|-----------|---------|----------|
| **On-Demand** | No PlatformFee; DirectCost + InfrastructureMargin per call | Real-time | Low-volume users; trial exploration |
| **Subscription** | Fixed PlatformFee; included usage allowance; overage at DirectCost | Monthly true-up | Predictable users; most common |
| **Hybrid** | Reduced PlatformFee + reduced per-call rate | Monthly true-up | High-volume users; enterprise |

### 2.1 Monthly True-Up Process

```
End of billing period:
  1. Calculate total DirectCost for period
  2. Calculate MeasuredSavings for period
  3. Apply CustomerSavingsShare credit
  4. Compare to CostPlusEquivalent ceiling
  5. Generate invoice (Stripe)
  6. Apply aggregate-assumption credits if within 90-day window
```

### 2.2 Trial Availability

Trial available across all billing modes per §III.8 Anchor 6:
- On-Demand trial: First $X of DirectCost free
- Subscription trial: First N days at $0 PlatformFee
- Hybrid trial: First N days at reduced rates

---

## 3. BYOM Scenarios (S1-S4)

| Scenario | Description | Pricing Impact | Terms |
|----------|-------------|----------------|-------|
| **S1** | BYO-local (user's own Ollama/etc.) | DirectCost = $0 for local calls; PlatformFee unchanged | User responsible for local infra |
| **S2** | BYO-enterprise (user's own OpenAI/Anthropic key) | DirectCost = $0 for BYO calls; PlatformFee unchanged | User responsible for provider costs |
| **S3** | Mixed (some BYO, some Stewardly) | DirectCost only for Stewardly-routed calls | Sovereign router tracks attribution |
| **S4** | Full BYO (all calls through user's providers) | PlatformFee only; DirectCost = $0 | Maximum user control |

### 3.1 Terms-Stacking Protocol

When BYO is active:
1. Stewardly's Terms of Service apply to platform usage
2. User's provider Terms apply to AI calls routed through BYO
3. No conflict: Stewardly does not modify, intercept, or store BYO call content beyond what the classifier requires (classification is LOCAL, no network)
4. Conflict resolution: If BYO provider terms conflict with Stewardly terms, Stewardly terms govern platform behavior; BYO provider terms govern AI call behavior

---

## 4. Aggregate-Assumption Credits

### 4.1 Day-1 Savings Methodology

New users receive savings credits based on industry benchmarks from activation:

```typescript
interface AggregateAssumption {
  category: string;           // e.g., "financial_planning_time"
  industryBaseline: number;   // hours/month without AI
  assumedReduction: number;   // percentage reduction
  monetaryValue: number;      // dollar value of saved time
  source: string;             // citation for benchmark
  confidence: number;         // 0-1 confidence in assumption
}
```

### 4.2 Transition to Empirical

| Period | Method | Weight Formula |
|--------|--------|---------------|
| Days 0-30 | Aggregate assumption only | `credit = assumption × 1.0` |
| Days 31-60 | Blended | `credit = assumption × 0.7 + measured × 0.3` |
| Days 61-90 | Blended | `credit = assumption × 0.3 + measured × 0.7` |
| Days 90+ | Empirical only | `credit = measured × 1.0` |

### 4.3 Empirical Baseline Calculation

90-day weighted blend:
```typescript
function calculateEmpiricalBaseline(history: UsageHistory[]): number {
  const weights = history.map((h, i) => {
    const recency = (90 - h.daysAgo) / 90; // More recent = higher weight
    return { value: h.costWithoutAI, weight: recency };
  });
  return weightedAverage(weights);
}
```

---

## 5. Implementation Plan

### 5.1 Database Schema Additions

```sql
-- Cost attribution per AI call
CREATE TABLE cost_attribution (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  engine VARCHAR(50) NOT NULL,
  primitive VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  tier_used ENUM('LOCAL', 'AUTO', 'CLOUD') NOT NULL,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  estimated_cost_cents INT DEFAULT 0,
  is_byo BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- M&V calculations per billing period
CREATE TABLE mv_calculations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  period_start BIGINT NOT NULL,
  period_end BIGINT NOT NULL,
  total_direct_cost_cents INT DEFAULT 0,
  measured_savings_cents INT DEFAULT 0,
  assumption_credits_cents INT DEFAULT 0,
  customer_share_cents INT DEFAULT 0,
  ceiling_applied BOOLEAN DEFAULT FALSE,
  calculation_method ENUM('assumption', 'blended', 'empirical') NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

-- Aggregate assumptions (industry benchmarks)
CREATE TABLE aggregate_assumptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  industry_baseline_value DECIMAL(10,2) NOT NULL,
  assumed_reduction_pct DECIMAL(5,2) NOT NULL,
  monetary_value_cents INT NOT NULL,
  source_citation TEXT NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  effective_from BIGINT NOT NULL,
  effective_to BIGINT DEFAULT NULL,
  created_at BIGINT NOT NULL
);
```

### 5.2 Stripe Integration Points

| Stripe Object | Purpose | When Created |
|---------------|---------|--------------|
| Customer | Maps to user | On first subscription |
| Subscription | PlatformFee billing | On plan selection |
| Usage Record | DirectCost metering | Per billing period (true-up) |
| Invoice | Monthly bill | End of period |
| Credit Note | CustomerSavingsShare | When savings measured |
| Promotion Code | Trial/discount | On activation |

### 5.3 Implementation Steps

| Step | Action | Dependency |
|------|--------|-----------|
| P-1 | Add cost_attribution table + logger middleware | Sovereign routing (provides cost data) |
| P-2 | Add mv_calculations table + M&V engine | P-1 (needs cost data) |
| P-3 | Add aggregate_assumptions table + seed data | Independent |
| P-4 | Wire Stripe subscription for PlatformFee | Independent |
| P-5 | Wire Stripe usage records for DirectCost true-up | P-1 |
| P-6 | Implement CustomerSavingsShare credit notes | P-2 |
| P-7 | Implement customer protection ceiling | P-2 |
| P-8 | Build M&V dashboard (admin view) | P-2 |
| P-9 | Build savings dashboard (user view) | P-2 |
| P-10 | Implement BYOM cost attribution (S1-S4) | P-1 + sovereign routing |

---

## 6. Counsel Review Items (per P-9)

1. Aggregate-assumption methodology — can credits be characterized as "guaranteed savings"?
2. Guarantee language — what claims can be made about cost reduction?
3. BYOM terms-stacking — does dual-terms create liability?
4. Stewardship framing — does "stewardship company" language create fiduciary obligations?
5. Customer protection ceiling — is this a contractual guarantee?
