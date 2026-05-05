# plan/06 — Compliance Memo Addenda (Drafts)

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

**Status:** Drafts for counsel review. Counsel review must be scheduled per §V.3.

---

## 1. Addendum A — Substrate-Specific Data Flows

### 1.1 Data Flow: User Input → Classifier → Routing Decision

```
User Input (text/voice/document)
    ↓
Classifier (LOCAL — in-process, no network)
    ↓ outputs: SensitivityLevel, RoutingTier
    ↓
┌─────────────────────────────────────────────┐
│ If NPI/PII/ePHI → LOCAL tier only           │
│ If Privileged → AUTO (prefer LOCAL)          │
│ If Operational → AUTO or CLOUD              │
└─────────────────────────────────────────────┘
    ↓
Sovereign Router → selects provider based on tier + cost + health
    ↓
AI Provider (Forge API / BYO-local / BYO-enterprise)
    ↓
Post-flight (AEGIS) → quality scoring, lesson extraction
    ↓
Response → User (with tier indicator)
```

### 1.2 Data Residency Implications

| Sensitivity Level | Permitted Destinations | Audit Requirement |
|-------------------|----------------------|-------------------|
| NPI (Non-Public Information) | LOCAL only; BYO-local if configured | Full audit trail; 7-year retention |
| PII (Personally Identifiable) | LOCAL preferred; CLOUD only with user consent | Audit trail; CCPA/GDPR deletion rights |
| ePHI (Electronic Protected Health) | LOCAL only; never CLOUD without BAA | HIPAA audit trail; encryption at rest |
| Privileged (Attorney-Client, etc.) | LOCAL preferred; CLOUD with explicit consent | Privilege log; no waiver risk |
| Operational (General business) | Any tier | Standard audit trail |

### 1.3 Counsel Review Questions

1. Does the classifier's LOCAL-only routing for NPI/PII/ePHI satisfy regulatory requirements when "LOCAL" means "in-process on the web server" (not user's device)?
2. What consent language is required before routing Privileged content to CLOUD tier?
3. Does the tier indicator satisfy transparency requirements under applicable regulations?
4. What retention period applies to routing decision audit trails?

---

## 2. Addendum B — Continuous-Improvement Meta-Role Data Flows

### 2.1 Data Flow: Platform Telemetry → Improvement Engine

```
Platform Telemetry (usage, errors, latency, cost)
    ↓
Signal Detection (pattern matching on aggregated metrics)
    ↓
Hypothesis Generation (LLM-assisted, using aggregated data only)
    ↓
Proposal Generation (structured improvement proposal)
    ↓
Administrative Spectrum Gate
    ↓
┌─────────────────────────────────────────────┐
│ Manual: Human reviews and executes          │
│ Supervised: AI proposes, human approves     │
│ Automatic: AI executes (non-compliance only)│
└─────────────────────────────────────────────┘
```

### 2.2 Data Minimization

The improvement engine operates on **aggregated metrics only**, never on individual user data:
- Error rates (not error content)
- Latency percentiles (not individual request timing)
- Feature usage counts (not user-specific usage)
- Cost totals per tier (not per-user cost)

### 2.3 Counsel Review Questions

1. Does aggregated-only access satisfy data minimization requirements?
2. What oversight is required for the "Automatic" position in the administrative spectrum?
3. Can the improvement engine's LLM calls (hypothesis generation) inadvertently expose user data through prompt construction?
4. What audit trail is required for automated platform changes?

---

## 3. Addendum C — Merge-Specific Data Flows

### 3.1 Data Flow: manus-next-app Pattern Absorption

No user data flows during absorption. Absorption is code-level only:
- Service implementations copied (no data)
- Schema additions are empty tables (no data migration)
- Configuration patterns adopted (no secrets transferred)

### 3.2 Post-Absorption Data Flows

New data flows introduced by absorbed patterns:

| Pattern | New Data Flow | Sensitivity |
|---------|--------------|-------------|
| Embedding service | User text → Forge API `/v1/embeddings` → vector stored in DB | Same as source text |
| Search cascade | User query → external search providers → results displayed | Query may contain sensitive terms |
| AEGIS cache | User prompts hashed (SHA-256) → cache lookup | Hash only; no plaintext stored in cache key |
| Semantic search | User query → embedding → cosine similarity → results | Query routed through classifier first |

### 3.3 Counsel Review Questions

1. Does sending user queries to external search providers (Serper, Brave, Tavily) require user consent?
2. What data processing agreements are needed with search providers?
3. Does the AEGIS cache (storing prompt hashes + responses) create data retention obligations?
4. Should the classifier gate search queries (prevent sensitive queries from reaching external providers)?

---

## 4. Addendum D — Phase 11 Memory Data Flows

### 4.1 Data Flow: Memory Engine (M1-M8)

```
User Interactions
    ↓
Memory Extraction (per mechanism)
    ↓
┌─────────────────────────────────────────────┐
│ M1 Factual: User-stated facts → DB          │
│ M2 Behavioral: Interaction patterns → DB    │
│ M3 Per-corpus: Document embeddings → DB     │
│ M4 Relational: Relationship graph → DB      │
│ M5 Temporal: Time-aware context → DB        │
│ M6 Preference: UI/comm preferences → DB     │
│ M7 Goal: Active objectives → DB             │
│ M8 Prompt Engine: Context assembly → LLM    │
└─────────────────────────────────────────────┘
    ↓
Embedding Generation (for semantic retrieval)
    ↓
Storage (encrypted at rest in TiDB)
```

### 4.2 Memory Portability

Per §III.8 Anchor: Memory portability is first-class, not paywalled.

| Export Format | Contents | User Rights |
|--------------|----------|-------------|
| JSON export | All M1-M7 data in structured format | On-demand, no restrictions |
| Embedding export | Raw vectors + source text | On-demand |
| Full deletion | All memory data purged | GDPR/CCPA right to erasure |

### 4.3 Counsel Review Questions

1. Does M2 (behavioral memory — interaction patterns) require explicit consent beyond ToS?
2. What is the retention period for each memory mechanism?
3. Does memory portability export satisfy GDPR data portability requirements (Article 20)?
4. Can M4 (relational memory) create liability if it infers relationships incorrectly?
5. Does M8 (prompt engine) sending assembled context to LLM create new data flow obligations?

---

## 5. Addendum E — Phase 12 Cost-Measurement Data Flows

### 5.1 Data Flow: Cost Attribution

```
Every Primitive Call
    ↓
Cost Attribution Logger
    ↓
┌─────────────────────────────────────────────┐
│ Records: timestamp, primitive, provider,     │
│ tokens_in, tokens_out, estimated_cost,       │
│ user_id, engine, tier_used                   │
└─────────────────────────────────────────────┘
    ↓
M&V Calculation Engine
    ↓
┌─────────────────────────────────────────────┐
│ Baseline: What this would cost without AI    │
│ Actual: What it actually cost                │
│ Savings: Baseline - Actual                   │
│ Customer share: Savings × share_rate         │
└─────────────────────────────────────────────┘
    ↓
Customer Invoice (monthly true-up)
```

### 5.2 Aggregate-Assumption Credits

Day-1 savings use industry benchmarks (not measured). Transition to empirical over 90 days:

| Day Range | Baseline Source | Weight |
|-----------|----------------|--------|
| 0-30 | Industry benchmark (aggregate assumption) | 100% assumption |
| 31-60 | Blended (70% assumption, 30% measured) | Transitioning |
| 61-90 | Blended (30% assumption, 70% measured) | Transitioning |
| 90+ | Empirical (measured baseline) | 100% measured |

### 5.3 Counsel Review Questions

1. Can "aggregate-assumption credits" be characterized as guaranteed savings? (Must avoid guarantee language per FINRA 2210)
2. What disclosure is required for the assumption-to-empirical transition?
3. Does the "customer protection ceiling" (never invoiced above cost-plus equivalent) create a contractual obligation?
4. What audit rights do customers have over the M&V calculation?
5. Does cost attribution data (per-user, per-call) create additional privacy obligations?

---

## 6. Counsel Review Scheduling

**Required timing:** Before Phase E-3 (People engine integration) ships, per §VI.2.

**Review scope:** All five addenda above, plus:
- Updated Terms of Service reflecting BYO scenarios
- Updated Privacy Policy reflecting memory engine data flows
- Updated Data Processing Agreement reflecting search provider data flows
- Stewardship framing language review (per P-9)

**Logistics:** Counsel review is scheduled out-of-band. This is the only acceptable halt-and-surface condition for synchronous human input per §V.3.
