# audit/06 — Pricing, Billing, and M&V Assessment

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit

---

## 1. Current Pricing Implementation

### 1.1 Stripe Products Configuration

**File:** `server/stripe/products.ts`

| Plan | Monthly | Yearly | Clients | Advisors | AI Conversations | Reports/mo | Storage |
|------|---------|--------|---------|----------|-----------------|-----------|---------|
| Starter | $49 | $470 (~20% off) | 50 | 1 | 100 | 5 | 2 GB |
| Professional | $149 | $1,430 (~20% off) | 250 | 5 | 1,000 | Unlimited | 10 GB |
| Enterprise | $499 | $4,790 (~20% off) | Unlimited | Unlimited | Unlimited | Unlimited | 100 GB |

### 1.2 Billing Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| Stripe checkout sessions | ✅ Implemented | `server/stripe/billingRouter.ts` |
| Webhook handler | ✅ Implemented | `server/stripe/webhookHandler.ts` |
| Test event detection | ✅ Implemented | `evt_test_` prefix check |
| Subscription management | ✅ Implemented | Via Stripe API |
| Usage tracking | ✅ Implemented | `server/services/usageTracker.ts` |
| Plan limits enforcement | ⚠️ Partial | Limits defined but enforcement unclear |

---

## 2. Architecture Reference Pricing Formula

Per §9 of the Architecture Reference:

```
CustomerInvoice(t) =
  PlatformFee(tier)
  + DirectCost(usage, t)
  - MeasuredSavings(baseline, actual, t)
  + OverageFee(usage, limits, t)
```

Where:
- **PlatformFee** — the subscription tier price (Starter/Professional/Enterprise)
- **DirectCost** — actual AI provider costs passed through at zero markup. For BYO scenarios, this term is zero
- **MeasuredSavings** — savings measured by the substrate's M&V machinery against baseline
- **OverageFee** — charges for usage exceeding plan limits

### 2.1 Current Implementation vs. Formula

| Component | Required | Current Status |
|-----------|----------|---------------|
| PlatformFee(tier) | ✅ | Implemented via Stripe subscriptions |
| DirectCost(usage, t) | ❌ | Not implemented — no per-call cost tracking |
| MeasuredSavings(baseline, actual, t) | ❌ | Not implemented — no M&V machinery |
| OverageFee(usage, limits, t) | ⚠️ | Limits defined; overage billing not wired |

---

## 3. Three Billing Modes (per Architecture Reference §9)

| Mode | Description | Current Status |
|------|-------------|---------------|
| **Subscription** | Fixed monthly/yearly fee per tier | ✅ Implemented |
| **Usage-based** | Pay per AI primitive call + storage | ❌ Not implemented |
| **Hybrid** | Subscription base + usage overage | ⚠️ Partially (limits exist, no overage billing) |

### 3.1 Monthly True-Up

**Required:** Monthly reconciliation of actual usage vs. plan allocation.
**Current:** Not implemented. No true-up process.

---

## 4. Four BYOM Scenarios (per Architecture Reference §9)

| Scenario | Description | Current Status |
|----------|-------------|---------------|
| **BYO-Local** | User's own hardware (Ollama, LM Studio, etc.) | ❌ Not implemented |
| **BYO-Enterprise** | User's enterprise AI contract (Azure, Anthropic, OpenAI) | ❌ Not implemented |
| **BYO-Self-Hosted** | User's self-hosted infrastructure | ❌ Not implemented |
| **Stewardly-Provided** | Default — Stewardly's Forge API | ✅ Current default |

**Impact on DirectCost:** For BYO scenarios, DirectCost = 0 on Stewardly's invoice (customer pays provider directly).

---

## 5. M&V (Measurement & Verification) Machinery

### 5.1 Required Components

Per Architecture Reference §11:

| Component | Purpose | Current Status |
|-----------|---------|---------------|
| Audit log as meter | Every primitive call logged with cost attribution | ⚠️ AI tool calls logged but no cost attribution |
| Baseline establishment | Aggregate-assumption credits at activation | ❌ Not implemented |
| Empirical baseline blending | Transition from assumptions to measured over 90 days | ❌ Not implemented |
| Savings calculation | `MeasuredSavings = baseline_cost - actual_cost` | ❌ Not implemented |
| Customer protection ceiling | Never invoiced above cost-plus equivalent | ❌ Not implemented |
| Savings display | Customer-facing dashboard showing savings | ❌ Not implemented |

### 5.2 Current Usage Tracking

**File:** `server/services/usageTracker.ts`

Current capabilities:
- Tracks AI tool calls (function name, duration, success/failure)
- Tracks conversation counts
- Tracks report generation counts
- Does NOT track: token counts per call, cost per call, provider used, tier routing decisions

### 5.3 Gap Assessment

The M&V machinery is the most significant billing gap. It requires:

1. **Per-call cost attribution** — extend usage tracker to record tokens consumed and estimated cost
2. **Baseline model** — define industry benchmarks for "what this work would cost without Stewardly"
3. **Savings calculation engine** — compute delta between baseline and actual
4. **Customer dashboard** — display savings, costs, and value delivered
5. **Monthly true-up** — reconcile and generate invoice adjustments
6. **Protection ceiling** — cap customer invoice at cost-plus equivalent

---

## 6. Administrative Spectrum (Phase 12)

### 6.1 Required Positions

Per Architecture Reference §12:

| Position | Description | Promotion Criteria |
|----------|-------------|-------------------|
| **Manual** | Human initiates every action | Default for new integrations |
| **Supervised** | AI proposes, human approves | 30-day window, ≥90% success |
| **Automatic** | AI executes autonomously | 90-day window, ≥95% success, ≤1 regression/20 deploys, zero compliance violations, ≤10% admin override, admin confirmation |

**Compliance class:** Permanently excluded from Automatic regardless of metrics.

### 6.2 Current State

No administrative spectrum implementation exists. All integrations operate at implicit fixed automation levels:
- Chat: Automatic (AI responds without approval)
- Compliance review: Manual (human reviews)
- Cadence execution: Supervised (configured but requires activation)
- Report generation: Automatic

### 6.3 Gap

Need to build:
1. Spectrum state machine (per integration class)
2. Promotion criteria evaluation (90-day rolling window)
3. Automatic demotion on threshold breach
4. Admin UI for position management and override
5. Compliance class exclusion enforcement
6. Audit trail for all position changes

---

## 7. Trial Availability

**Required:** Trial available across all billing modes.
**Current:** No trial implementation. No free tier. No trial period.
**Gap:** Need trial flow (likely 14-day free trial with full access, converting to paid).

---

## 8. Priority Ordering

| Item | Priority | Dependency |
|------|----------|-----------|
| Per-call cost attribution in usage tracker | P1 | None |
| Savings baseline model | P2 | Cost attribution |
| M&V calculation engine | P2 | Baseline model |
| Customer savings dashboard | P2 | M&V engine |
| Administrative spectrum state machine | P2 | None |
| Usage-based billing mode | P3 | Cost attribution |
| Monthly true-up process | P3 | M&V engine |
| BYO cost handling (DirectCost = 0) | P3 | BYO infrastructure |
| Trial flow | P3 | None |
| Protection ceiling | P3 | M&V engine |
