# Current Best State

> Tracks the current-best commit SHA for each scope and sub-scope. Updated after every pass that improves a scope without regressing another. The "current best" is the state that should be protected by the merge gate.

## Per-Scope Current Best

| Scope | Description | Current Best SHA | Pass | Notes |
|---|---|---|---|---|
| #1 AI Chat | AI chat parity vs Claude | `054c6bea` | 0 (pre-loop) | Chat exists with streaming, file upload, TTS, image gen; many gaps vs Claude |
| #2 Code Chat | Code chat parity vs Claude Code | `054c6bea` | 0 (pre-loop) | Code chat exists with multi-file edit, terminal, test runner; many gaps |
| #3 Agentic | Agentic parity vs Manus | `054c6bea` | 0 (pre-loop) | No agentic capabilities yet |
| #4 Calculators | Calculator parity vs HTML v7 files | `054c6bea` | 0 (pre-loop) | Wealth engine routes exist; calculator logic partial |
| #5 EMBA | EMBA module parity vs emba_modules repo | `054c6bea` | 0 (pre-loop) | Learning system exists with tracks, flashcards, spaced repetition |
| #6 Persona UX | Persona-driven UX quality | `054c6bea` | 0 (pre-loop) | 10 personas defined; routes reachable but not persona-optimized |
| #7 Integrations | Integration connector coverage | `054c6bea` | 0 (pre-loop) | SnapTrade, Plaid, Stripe, Google OAuth partial; dynamic framework partial |
| #8 Cohesion | Cross-scope cohesion | `054c6bea` | 0 (pre-loop) | Navigation exists; cross-scope links sparse |

## Protected Improvements

> Rows from PARITY.md that may never be regressed without explicit user confirmation.

| Scope | Capability | Protected Since | SHA | Reason |
|---|---|---|---|---|
| — | — | — | — | No protected improvements yet |

## Regression Events

| Pass | Scope | What Regressed | Cause | Resolution | SHA |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
