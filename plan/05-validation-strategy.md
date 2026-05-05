# plan/05 — Validation Strategy

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. Validation Matrix Structure

**Formula:** 6 role-bound personas × 11 cross-cutting overlays × surfaces = 360+ validation streams

### 1.1 Role-Bound Personas

| # | Persona | Role | Device | Session Pattern |
|---|---------|------|--------|----------------|
| 1 | Client | user | Mobile-first | Brief, intermittent |
| 2 | Advisor | advisor | Mixed mobile/desktop | Daily, extended |
| 3 | Assistant | user (delegated) | Desktop | Workflow-focused |
| 4 | Supervisor | manager | Desktop | Weekly, audit-focused |
| 5 | Admin | admin | Desktop | As-needed, technical |
| 6 | Nontechnical BYO User | user | Desktop | Setup-focused |

### 1.2 Cross-Cutting Validation Personas

| # | Persona | Focus | Key Metrics |
|---|---------|-------|-------------|
| 7 | Speed-test daemon | Latency | Every interaction < budget |
| 8 | Edge-case hunter | Robustness | Malformed inputs, network drops, mid-action nav |
| 9 | Accessibility user | A11y | VoiceOver/TalkBack, keyboard-only, dynamic type |
| 10 | Compliance-aware advisor | Regulatory | Every interaction passes regulator test |
| 11 | Adversarial auditor | Security | Contract violations, capability bypasses, egress leaks |
| 12 | Battery-anxious user | Efficiency | Flag battery-draining interactions |
| 13 | Slow-network user | Resilience | 3G simulation, intermittent disconnects |
| 14 | Privacy-aware user | Transparency | Tier indicators verified, mode switches tested |
| 15 | Voice-first user | Voice UX | Push-to-talk only, hands-free flows |
| 16 | Keyboard-only power user | Keyboard UX | Global hotkey, command palette, no mouse |
| 17 | Nontechnical BYO user | Setup UX | Single-button-press BYO flows |

---

## 2. Canonical Task Lists

### 2.1 Advisor Task List (most extensive — 16 steps)

1. Cold launch + authentication
2. Chat cross-engine query ("What's the tax impact on Client X's portfolio?")
3. Drill into Wealth Engine from chat response
4. Contextual chat within Wealth Engine scope
5. Run agentic workflow with checkpoints (generate client report)
6. Mode switching (chat → engine UI → chat)
7. Voice interaction (push-to-talk question + voice response)
8. Mobile-desktop handoff (start on mobile, continue on desktop)
9. Network disconnect recovery (mid-operation)
10. Document import + classification (upload client document)
11. Export work product (download generated report)
12. BYO model switch (change routing preference)
13. Review tier indicators on responses
14. Command palette navigation (Cmd+K workflow)
15. Keyboard shortcut workflow (g-chord navigation)
16. Logout + session cleanup

### 2.2 Client Task List (8 steps)

1. Cold launch + authentication (mobile)
2. Ask financial question in chat
3. View portfolio summary
4. Run what-if scenario (calculator)
5. Voice interaction (hands-free question)
6. Review study progress (learning)
7. Upload document (drag-drop)
8. Logout

### 2.3 Supervisor Task List (12 steps)

1. Cold launch + authentication
2. Review compliance queue
3. Approve/reject flagged action
4. Search audit trail
5. Review spectrum positions
6. Sign-off on recommendation (contextual chat)
7. Generate compliance report
8. Review cost attribution
9. Check system health
10. Review improvement proposals
11. Verify tier indicators on sensitive content
12. Logout

### 2.4 Admin Task List (14 steps)

1. Cold launch + authentication
2. Monitor system health dashboard
3. Review spectrum console
4. Promote/demote integration class position
5. Configure BYO infrastructure
6. Review M&V dashboard
7. Manage user roles
8. Review improvement engine proposals
9. Execute improvement cycle
10. Verify cost attribution accuracy
11. Test rollback procedure
12. Review audit logs
13. Configure integration settings
14. Logout

---

## 3. Success Thresholds

### 3.1 Per Gate Type

| Gate | Threshold | Measurement |
|------|-----------|-------------|
| **Behavioral** | 100% task completion | All canonical steps complete without error |
| **Performance** | P95 < 2s for interactions, P95 < 5s for AI responses | Latency measurement per interaction |
| **Contract** | Zero violations | No primitive called outside its contract |
| **Compliance** | Zero violations | No regulatory flag triggered |
| **Coverage** | 100% route coverage | Every route visited by at least one persona |

### 3.2 Delight Rubric

| Axis | Green Threshold | Measurement |
|------|----------------|-------------|
| **Speed** | P95 interaction < 200ms, P95 AI response < 3s | Automated timing |
| **Polish** | Zero visual glitches, consistent spacing, no layout shifts | Visual regression |
| **Coherence** | Cross-engine queries produce unified responses | Manual review |
| **Trust** | Tier indicators always accurate, audit trail complete | Automated verification |
| **Recovery** | Graceful degradation on network/service failure | Chaos testing |

---

## 4. Production-Equivalent Environment

| Aspect | Configuration |
|--------|--------------|
| URL | stewardly.manus.space (actual production) |
| Database | Production TiDB (with test tenant isolation) |
| AI providers | Production Forge API |
| Integrations | Production keys (test mode for Stripe) |
| Network | Real network conditions (no simulation for production tests) |
| Seeded data | Test tenant with representative data across all engines |

---

## 5. Validation Execution Strategy

### 5.1 Parallel Async Tracks

Cannot complete serially in reasonable time. Strategy:

1. **Automated tracks** (run in parallel):
   - Speed-test daemon (automated latency measurement)
   - Edge-case hunter (automated fuzzing)
   - Accessibility checks (automated a11y audit)
   - Contract verification (automated type checking)
   - Coverage tracking (automated route coverage)

2. **Semi-automated tracks** (scripted with manual verification):
   - Each role-bound persona × task list (scripted browser automation)
   - Compliance review (LLM-assisted with human spot-check)
   - Visual regression (screenshot comparison)

3. **Manual tracks** (require human judgment):
   - Delight rubric scoring
   - Coherence evaluation
   - Trust perception
   - BYO setup flow usability

### 5.2 Implementation

Validation harness implemented as Vitest test suites:

```
server/validation/
├── personas/
│   ├── client.test.ts
│   ├── advisor.test.ts
│   ├── assistant.test.ts
│   ├── supervisor.test.ts
│   ├── admin.test.ts
│   └── byo-user.test.ts
├── cross-cutting/
│   ├── speed-daemon.test.ts
│   ├── edge-case-hunter.test.ts
│   ├── accessibility.test.ts
│   ├── compliance.test.ts
│   ├── adversarial.test.ts
│   ├── slow-network.test.ts
│   ├── privacy.test.ts
│   ├── voice-first.test.ts
│   ├── keyboard-only.test.ts
│   └── byo-nontechnical.test.ts
└── harness/
    ├── runner.ts
    ├── reporter.ts
    └── config.ts
```

---

## 6. Confirmation Pass Protocol

After all validation streams pass:

1. **Pass 1:** Full suite run. Record results.
2. **Pass 2:** Full suite run. Compare to Pass 1. Any regression = counter resets.
3. **Pass 3:** Full suite run. Compare to Pass 2. If no substantive update, counter = 3.

Counter must reach 3 with no substantive update. A "substantive update" is any change that:
- Fixes a bug
- Modifies behavior
- Adds a feature
- Changes a test assertion

Non-substantive updates (documentation, comments, formatting) do not reset the counter.
