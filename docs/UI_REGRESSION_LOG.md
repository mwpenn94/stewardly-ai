# UI Regression Log

> Canonical routes for the mobile-screenshot ratchet. Top 10 most persona-reachable routes. Every UI-touching pass must capture 390x844 screenshots of these routes and diff against the prior baseline. A regression = clipped content, overlapping elements, missing controls, or unscrollable regions vs. prior baseline.

## Canonical Routes (persona-reachability proxy)

### Tier 1 — All personas (top priority for regression)
| Route | Personas | Baseline Pass | Baseline Screenshot |
|---|---|---|---|
| `/` | 10 / all | 1 | `artifacts/pass-1/baseline/landing-{vp}.png` |
| `/chat` | 10 / all | 1 | `artifacts/pass-1/baseline/chat-{vp}.png` |
| `/code-chat` | 10 / all | 1 | `artifacts/pass-1/baseline/code-chat-{vp}.png` |

### Tier 2 — Most personas (8-9)
| Route | Personas | Baseline Pass | Baseline Screenshot |
|---|---|---|---|
| `/calculators` | 9 / 1-9 | 1 | `artifacts/pass-1/baseline/calculators-{vp}.png` |
| `/wealth-engine` | 9 / 1-5,7-10 | 1 | `artifacts/pass-1/baseline/wealth-engine-{vp}.png` |
| `/financial-twin` | 8 / 1-5,7,8,10 | 1 | `artifacts/pass-1/baseline/financial-twin-{vp}.png` |
| `/intelligence-hub` | 8 / 1-3,5,7-9,10 | 1 | `artifacts/pass-1/baseline/intelligence-hub-{vp}.png` |

### Tier 3 — Many personas (5-7)
| Route | Personas | Baseline Pass | Baseline Screenshot |
|---|---|---|---|
| `/learning` | 7 / 1,2,4,5,8,9,10 | 1 | `artifacts/pass-1/baseline/learning-{vp}.png` |
| `/relationships` | 6 / 1,2,3,5,7,8 | 1 | `artifacts/pass-1/baseline/relationships-{vp}.png` |
| `/settings` | 6 / 1,2,5,7,8,10 | 1 | `artifacts/pass-1/baseline/settings-{vp}.png` |
| `/operations` | 6 / 1,2,7,8,9,10 | 1 | `artifacts/pass-1/baseline/operations-{vp}.png` |
| `/leads` | 5 / 1,2,3,7,8 | 1 | `artifacts/pass-1/baseline/leads-{vp}.png` |
| `/my-work` | 5 / 1,2,7,8,9 | 1 | `artifacts/pass-1/baseline/my-work-{vp}.png` |
| `/protection-score` | 5 / 1,2,3,5,7 | 1 | `artifacts/pass-1/baseline/protection-score-{vp}.png` |
| `/tax-planning` | 5 / 1,2,3,5,7 | 1 | `artifacts/pass-1/baseline/tax-planning-{vp}.png` |
| `/financial-planning` | 5 / 1,2,3,5,7 | 1 | `artifacts/pass-1/baseline/financial-planning-{vp}.png` |

> `{vp}` = viewport suffix: `1440` (desktop), `820` (tablet), `390` (mobile)

## Persona Roster Reference
1. Cold new advisor (first visit)
2. Monday-morning returning advisor
3. Mid-meeting laptop (client present)
4. Mid-meeting phone (mobile)
5. Skeptical CFO / compliance officer
6. Client on shared link (read-only, possibly unauthenticated)
7. Power user / regional manager (roll-up)
8. Back-office ops / admin
9. New hire in onboarding
10. Tech-savvy advisor exploring integrations

## Regression History

| Pass | Route | Regression Description | Severity | Fixed Pass | Evidence |
|---|---|---|---|---|---|
| — | — | No regressions recorded yet | — | — | — |
