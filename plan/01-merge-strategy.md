# plan/01 — Merge Strategy

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan | **Informed by:** audit/01–09

---

## 1. Strategic Decision: In-Place Absorption (Not Monorepo)

The Phase 0 audit reveals that the canonical Phase M monorepo merge (§VI.1) is **not the optimal path** for this AFK run. The reasons:

1. **stewardly-ai is the production system** — 222 pages, 180+ tables, 35 secrets, 14 integrations, live at stewardly.manus.space. Moving to a monorepo creates unnecessary production risk.

2. **manus-next-app is the source, not a peer** — It provides patterns and services to absorb, not a parallel production system to maintain. After absorption, it archives.

3. **Web-only scope (per v2.0.3 §2.1)** — No native shell, no multi-package workspace needed. A single Express+React application is the correct deployment unit.

4. **No architectural impossibility detected (audit/03 §8)** — stewardly-ai's shared intelligence layer provides clean abstraction points for absorption without restructuring.

### 1.1 Chosen Strategy: In-Place Absorption

```
stewardly-ai (production) ← absorb patterns from ← manus-next-app (source)
                                                          ↓
                                                    archive after absorption
```

**Justification per §V.1:** The audit revealed that stewardly-ai already has the correct engine separation, the shared intelligence layer provides the substrate abstraction point, and manus-next-app patterns can be absorbed additively. This is the "already in stewardly-ai with manus-next-app patterns needed as additions" scenario from §V.1.

---

## 2. Capability Canonicalization

| Capability | Canonical Location (after absorption) | Source |
|-----------|--------------------------------------|--------|
| Embedding generation | `server/shared/intelligence/embedding.ts` | manus-next-app |
| Semantic search | `server/shared/intelligence/semanticSearch.ts` | New (uses embedding) |
| Sensitivity classifier | `server/shared/guardrails/sensitivityClassifier.ts` | New |
| AEGIS pre/post-flight | `server/shared/intelligence/aegis.ts` | manus-next-app (adapted) |
| Search cascade | `server/shared/automation/searchCascade.ts` | manus-next-app (replaces existing webSearch) |
| Sovereign routing | `server/shared/intelligence/sovereignRouting.ts` | manus-next-app (adapted) |
| Memory engine (M1-M8) | `server/shared/intelligence/memoryEngine.ts` | Extend existing |
| Tiered browser | `server/shared/automation/tieredBrowser.ts` | manus-next-app (extends existing webExtractor) |
| Agent action indicators | `client/src/components/AgentActionIndicator.tsx` | manus-next-app (adapted) |
| Workspace artifacts | `client/src/components/WorkspacePanel.tsx` | manus-next-app (adapted) |
| Tier indicator | `client/src/components/TierBadge.tsx` | New |
| Command palette | `client/src/components/CommandPalette.tsx` | New |
| BYO settings | `client/src/pages/settings/BYOSettings.tsx` | New |
| M&V dashboard | `client/src/pages/admin/MVDashboard.tsx` | New |
| Administrative spectrum | `server/services/administrativeSpectrum.ts` | New |
| Cost attribution | `server/services/costAttribution.ts` | New |

---

## 3. Cutover Sequence

### Phase A — UX Absorption (from manus-next-app)

| Step | Action | Risk | Rollback |
|------|--------|------|----------|
| A-1 | Absorb embedding service | Low | Remove file |
| A-2 | Absorb search cascade (replace webSearch.ts) | Medium | Restore webSearch.ts from git |
| A-3 | Absorb tiered browser (extend webExtractor) | Low | Remove additions |
| A-4 | Absorb AEGIS service (adapted) | Medium | Remove file |
| A-5 | Add agent action indicators to chat | Low | Remove component |
| A-6 | Add command palette (Cmd+K) | Low | Remove component |
| A-7 | Add tier badge component | Low | Remove component |

### Phase E — Substrate Primitives

| Step | Action | Risk | Rollback |
|------|--------|------|----------|
| E-1 | Build sensitivity classifier | Low | Remove file |
| E-2 | Wire classifier to routing decisions | Medium | Disconnect wire |
| E-3 | Build sovereign routing (adapted from manus-next-app) | Medium | Remove file, restore direct LLM calls |
| E-4 | Add RAG with embeddings to knowledge base | Medium | Remove embedding columns, restore keyword search |
| E-5 | Extend memory engine (M1-M8) | Medium | Restore previous memoryEngine.ts |
| E-6 | Add checkpoint/resume to agentic runtime | Low | Remove additions |

### Phase P — Pricing, M&V, Memory

| Step | Action | Risk | Rollback |
|------|--------|------|----------|
| P-1 | Add per-call cost attribution to usage tracker | Low | Remove additions |
| P-2 | Build M&V calculation engine | Low | Remove file |
| P-3 | Build administrative spectrum state machine | Medium | Remove file |
| P-4 | Add BYO settings page with setup agent | Medium | Remove page |
| P-5 | Wire pricing formula (DirectCost + MeasuredSavings) | Medium | Restore simple subscription |
| P-6 | Add savings dashboard | Low | Remove page |

---

## 4. Rollback Plan

### 4.1 Per-Step Rollback

Every step above has a defined rollback action. The rollback procedure:

1. `webdev_rollback_checkpoint` to the checkpoint immediately before the step
2. Verify all preservation targets (audit/09 checklist)
3. Resume from the previous step

### 4.2 Full Rollback

If absorption causes irrecoverable issues:

1. Rollback to the pre-absorption checkpoint (tagged before Phase A begins)
2. All 527 tests must pass
3. All 222 pages must render
4. All 14 integrations must be functional

### 4.3 Rollback Triggers

- Any existing test fails after a step
- Any existing route returns 500
- Any existing integration stops receiving/sending data
- Any preservation target from audit/09 is violated

---

## 5. Pre-Merge Snapshots

Per §V.3:

- **stewardly-ai:** Checkpoint saved before Phase A begins (tagged `pre-absorption-stewardly-ai-20260505`)
- **manus-next-app:** Repository already cloned at `/home/ubuntu/manus-next-app` for reference; no modifications needed (read-only source)

---

## 6. Dependencies Between Phases

```
Phase A (UX Absorption)
  ├── A-1 (embedding) ← required by E-4 (RAG)
  ├── A-2 (search cascade) ← independent
  ├── A-3 (tiered browser) ← independent
  ├── A-4 (AEGIS) ← required by E-3 (sovereign routing)
  ├── A-5 (action indicators) ← independent
  ├── A-6 (command palette) ← independent
  └── A-7 (tier badge) ← required by E-2 (classifier wire)

Phase E (Substrate)
  ├── E-1 (classifier) ← independent
  ├── E-2 (classifier wire) ← requires A-7, E-1
  ├── E-3 (sovereign routing) ← requires A-4, E-1
  ├── E-4 (RAG) ← requires A-1
  ├── E-5 (memory engine) ← requires A-1
  └── E-6 (checkpoint/resume) ← independent

Phase P (Pricing/M&V)
  ├── P-1 (cost attribution) ← requires E-3 (sovereign routing provides cost data)
  ├── P-2 (M&V engine) ← requires P-1
  ├── P-3 (admin spectrum) ← independent
  ├── P-4 (BYO settings) ← requires E-3
  ├── P-5 (pricing formula) ← requires P-1, P-2
  └── P-6 (savings dashboard) ← requires P-2
```

---

## 7. Deviations from Canonical Structure

| Canonical (§VI.1) | This Plan | Justification |
|-------------------|-----------|---------------|
| Phase M (monorepo merge) | Skipped | Web-only scope; single deployment unit; no native shell; production risk avoidance |
| `packages/ai-substrate/` layout | `server/shared/` flat structure | Already exists and works; no benefit to restructuring for web-only |
| Native shell integration (M-4) | Deferred per v2.0.3 §2.1 | Subsequent AFK run |
| App Store submissions (D-1) | Deferred per v2.0.3 §2.2 | Subsequent AFK run |

These deviations are explicitly authorized by v2.0.3 §2.1 (web-only scope) and §2.2 (Phase D simplification).
