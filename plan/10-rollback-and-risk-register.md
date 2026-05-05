# plan/10 — Rollback and Risk Register

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. Rollback Procedures

### 1.1 Per-Phase Rollback

| Phase | Rollback Trigger | Procedure | Recovery Time |
|-------|-----------------|-----------|---------------|
| **A (UX Absorption)** | Existing tests fail; route returns 500; integration breaks | `webdev_rollback_checkpoint` to pre-Phase-A checkpoint | < 5 minutes |
| **E (Substrate)** | Classifier produces false negatives; routing loops; embedding service unavailable | `webdev_rollback_checkpoint` to pre-Phase-E checkpoint | < 5 minutes |
| **P (Pricing/M&V)** | Billing calculation error; Stripe webhook failure; cost attribution drift | `webdev_rollback_checkpoint` to pre-Phase-P checkpoint | < 5 minutes |
| **V (Validation)** | Architectural failure detected (not fixable without redesign) | Hard escalation per §VIII.3 | Depends on issue |
| **D (Distribution)** | Production smoke test fails; BYO setup flow broken | `webdev_rollback_checkpoint` to pre-Phase-D checkpoint | < 5 minutes |

### 1.2 Per-Step Rollback (Within Phases)

Every step in plan/01 §3 has a defined rollback action. The general procedure:

1. Identify which step introduced the failure
2. `webdev_rollback_checkpoint` to the checkpoint immediately before that step
3. Run full test suite to verify restoration
4. Verify all preservation targets (audit/09 checklist)
5. Document the failure in the risk register
6. Determine fix or alternative approach before retrying

### 1.3 Full Rollback (Nuclear Option)

If the entire absorption is irrecoverable:

1. `webdev_rollback_checkpoint` to `pre-absorption-stewardly-ai-20260505`
2. Verify: All 527+ tests pass
3. Verify: All 222+ pages render
4. Verify: All 14 integrations functional
5. Verify: All preservation targets from audit/09 intact
6. Hard escalation to user with full failure report

---

## 2. Consolidated Risk Register

### 2.1 Technical Risks

| ID | Risk | Likelihood | Impact | Mitigation | Contingency |
|----|------|-----------|--------|------------|-------------|
| T-1 | Embedding service latency degrades search UX | Medium | Medium | Implement semantic cache; fallback to keyword search | Disable embeddings; revert to existing keyword search |
| T-2 | Classifier false negatives (sensitive content routed to CLOUD) | Low | High | Rule-based (deterministic); comprehensive test suite | Hard escalation; immediate classifier update |
| T-3 | Sovereign routing loops (provider A fails → B fails → A) | Low | Medium | Circuit breaker pattern; max-retry limit | Fallback to single-provider (Forge API direct) |
| T-4 | AEGIS cache poisoning (bad response cached) | Low | Medium | TTL-based expiration; quality score threshold for caching | Flush cache; disable caching temporarily |
| T-5 | Memory engine storage growth (unbounded) | Medium | Low | Per-user storage limits; M5 temporal expiration | Prune oldest entries; increase storage |
| T-6 | Search cascade provider outage | Medium | Low | Multi-provider fallback; graceful degradation | Fall back to single available provider |
| T-7 | BYO-local inference server unreachable | Medium | Low | Health check polling; automatic failover to cloud | Route through Stewardly providers; notify user |
| T-8 | Cost attribution drift (calculated cost ≠ actual cost) | Medium | Medium | Reconciliation job; Stripe invoice comparison | Manual reconciliation; credit customer difference |

### 2.2 Architectural Risks

| ID | Risk | Likelihood | Impact | Mitigation | Contingency |
|----|------|-----------|--------|------------|-------------|
| A-1 | Substrate primitives create circular dependencies | Low | High | Dependency graph enforced (plan/02 §3); no circular imports | Refactor dependency; split primitive |
| A-2 | Engine integration breaks existing engine isolation | Low | High | Additive-only changes; no existing table modifications | Rollback to pre-integration checkpoint |
| A-3 | Cross-engine query routing produces incoherent responses | Medium | Medium | Merger quality scoring; fallback to single-engine response | Disable cross-engine; route to primary engine only |
| A-4 | Administrative spectrum state machine has edge cases | Medium | Low | Comprehensive state transition tests; default to Manual on error | Reset to default position; log anomaly |

### 2.3 Compliance Risks

| ID | Risk | Likelihood | Impact | Mitigation | Contingency |
|----|------|-----------|--------|------------|-------------|
| C-1 | Aggregate-assumption credits characterized as guaranteed savings | Medium | High | Counsel review (plan/06 §5); disclaimer language | Remove credits until counsel approves language |
| C-2 | Memory engine violates data minimization (GDPR Art. 5) | Low | High | M2 uses aggregated metrics only; M1 is user-stated | Purge mechanism; provide deletion API |
| C-3 | BYO terms-stacking creates liability | Low | Medium | Counsel review; clear separation of responsibility | Simplify to single-terms model |
| C-4 | Stewardship framing implies fiduciary duty | Medium | High | Counsel review; explicit non-fiduciary disclaimer | Change framing language |
| C-5 | Search cascade sends sensitive queries to external providers | Low | High | Classifier gates queries before cascade | Disable cascade for sensitive queries |

### 2.4 Operational Risks

| ID | Risk | Likelihood | Impact | Mitigation | Contingency |
|----|------|-----------|--------|------------|-------------|
| O-1 | Forge API rate limits during high usage | Medium | Medium | Request queuing; backpressure; BYO as overflow | Degrade gracefully; queue responses |
| O-2 | TiDB connection pool exhaustion | Low | High | Connection pooling; query optimization | Increase pool size; add read replicas |
| O-3 | Stripe webhook delivery failure | Low | Medium | Retry logic; idempotency keys; manual reconciliation | Manual invoice generation; customer notification |
| O-4 | Edge TTS service degradation | Medium | Low | Fallback to Deepgram; text-only mode | Disable voice; show text responses |

---

## 3. Risk Monitoring

### 3.1 Automated Monitoring

| Monitor | Checks | Alert Threshold |
|---------|--------|----------------|
| Classifier accuracy | Sample classification results against known labels | < 95% accuracy |
| Routing health | Provider response rates and latencies | > 5% failure rate |
| Cost attribution accuracy | Compare calculated vs. actual (Stripe) | > 5% drift |
| Memory storage growth | Per-user storage size | > 100MB per user |
| Test suite health | Full test suite run | Any failure |
| Embedding service latency | P95 embedding generation time | > 500ms |

### 3.2 Manual Review Triggers

| Trigger | Action |
|---------|--------|
| Compliance risk materialized | Immediate hard escalation |
| Architectural risk materialized | Assess scope; rollback if needed |
| 3 technical risks in same area | Review architecture decision |
| Customer complaint about billing | Manual reconciliation + review |

---

## 4. Decision Log

| Date | Decision | Rationale | Reversible? |
|------|----------|-----------|-------------|
| 2026-05-05 | In-place absorption (not monorepo) | Web-only scope; production risk avoidance; single deployment unit | Yes (but costly) |
| 2026-05-05 | `server/shared/` for substrate (not `packages/`) | Already exists; no benefit to restructuring for web-only | Yes |
| 2026-05-05 | Classifier is rule-based (not ML) | Deterministic; no network; no training data needed; auditable | Yes (can add ML later) |
| 2026-05-05 | Additive-only schema changes | Zero risk to existing data; no migration complexity | N/A |
| 2026-05-05 | BYO-local telemetry via polling (not push) | User's server may not support webhooks; polling is universal | Yes |

---

## 5. Checkpoint Strategy

| Checkpoint | When | Purpose |
|-----------|------|---------|
| `pre-absorption-20260505` | Before Phase A starts | Full rollback point |
| `post-phase-a-YYYYMMDD` | After Phase A completes + tests pass | Phase A rollback point |
| `post-phase-e-YYYYMMDD` | After Phase E completes + tests pass | Phase E rollback point |
| `post-phase-p-YYYYMMDD` | After Phase P completes + tests pass | Phase P rollback point |
| `post-validation-YYYYMMDD` | After Phase V converges | Validation baseline |
| `production-ready-YYYYMMDD` | After Phase D-6 go/no-go | Production deployment point |
