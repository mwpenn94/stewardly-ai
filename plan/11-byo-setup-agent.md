# Plan Deliverable 11 — BYO Setup Agent

## 1. Purpose

This document specifies the Bring-Your-Own (BYO) setup agent that enables nontechnical users to configure local models, enterprise AI contracts, and self-hosted infrastructure through a single-button-press experience.

## 2. Covered BYO Paths

| Path | Description | Setup Complexity |
|------|-------------|-----------------|
| S1 — Local Model | Ollama, LM Studio, llama.cpp server on user hardware | High (agent-automated) |
| S2 — Enterprise Key | Azure OpenAI, Anthropic Enterprise, OpenAI Enterprise | Medium (OAuth flow) |
| S3 — Mixed | Combination of local + cloud for different task types | High (multi-step) |
| S4 — Full BYO | All inference on user infrastructure, platform routing only | High (comprehensive) |

## 3. Single-Button-Press Standard

The setup agent adheres to the single-button-press standard defined in v2.0.3 §3.1:

1. **User clicks one button** — "Set Up BYO" from the BYO Model settings tab
2. **Agent does the technical work** — detects hardware, recommends models, configures endpoints
3. **User confirms at 1-2 human-judgment points** — which model to download, which provider to connect
4. **End state** — working BYO configuration with verified inference

## 4. Setup Agent Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BYO Setup Agent                        │
├─────────────────────────────────────────────────────────┤
│  Detection Layer                                         │
│  ├── Hardware probe (GPU, RAM, disk)                     │
│  ├── Network probe (local endpoints, enterprise URLs)    │
│  └── Existing config probe (prior BYO state)             │
├─────────────────────────────────────────────────────────┤
│  Recommendation Engine                                   │
│  ├── Model selection (size vs. hardware fit)             │
│  ├── Provider recommendation (cost vs. quality)          │
│  └── Configuration template generation                   │
├─────────────────────────────────────────────────────────┤
│  Execution Layer                                         │
│  ├── Installer automation (Ollama, LM Studio)            │
│  ├── OAuth flow navigation (enterprise providers)        │
│  ├── Endpoint verification (health check, inference)     │
│  └── Failover and recovery (diagnose + retry)            │
├─────────────────────────────────────────────────────────┤
│  Verification Layer                                      │
│  ├── Intent Checker pattern (confirm setup works)        │
│  ├── Iterate-on-validate convergence                     │
│  └── Rollback on failure                                 │
└─────────────────────────────────────────────────────────┘
```

## 5. Conflict-of-Interest Compliance

The setup agent operates within the conflict-of-interest architecture:

- Does NOT favor providers Stewardly has economic relationships with
- Recommends based on customer benefit (cost, quality fit, hardware suitability)
- Recommendation logic is auditable and counsel-reviewable
- No platform-internal metric influences recommendations
- The AEGIS pre-flight pipeline validates setup agent recommendations

## 6. Privacy Discipline

- Browser automation runs in user-visible sessions (not headless) for OAuth flows
- Credentials never transit Stewardly servers when not necessary for routing
- Failed setup attempts do not leak partial configuration
- Audit trail captures what was done for user review

## 7. One-Button Actions

| Action | Description | Agent Work |
|--------|-------------|-----------|
| Test BYO Setup | Verify existing BYO config works | Run inference test, report results |
| Add BYO Endpoint | Configure a new local/enterprise endpoint | Detect, configure, verify |
| Switch to BYO | Move from Stewardly providers to user's BYO | Update routing, verify fallback |
| Switch Back | Return to Stewardly-managed providers | Restore default routing |

## 8. Failover Capabilities

When setup fails, the agent uses:

1. **Search cascade** — find alternative installers, documentation, troubleshooting guides
2. **Sandbox execution** — test configurations in isolation before applying
3. **Iterate-on-validate** — retry with adjusted parameters until convergence
4. **Hard escalation** (§VIII.3.10) — if single-button-press cannot be achieved, surface to user with alternatives

## 9. Implementation in Stewardly

The BYO setup agent is implemented as:

- **Server**: `server/services/substrate/sovereign.ts` — routing logic with BYO provider registration
- **Router**: `server/routers/substrate.ts` — `registerBYOProvider`, `testBYOEndpoint`, `getBYOStatus` procedures
- **UI**: `client/src/pages/settings/BYOModelTab.tsx` — settings interface with one-button actions
- **UI**: `client/src/components/substrate/SovereignModeIndicator.tsx` — real-time routing indicator

## 10. Validation

- Persona 17 (Nontechnical BYO user) exercises all paths
- Each path must complete within reasonable time
- No technical error messages requiring technical interpretation
- Agent failover handles deliberately-introduced failures
