# Phase 4 — Security & Compliance · Scoring

## Criteria

| # | Criterion | Description |
|---|---|---|
| C1 | **Authentication Security** | JWT properly signed, expiry enforced, refresh rotation. No token leakage. |
| C2 | **Authorization Enforcement** | Role-based access control. No privilege escalation. Admin routes gated. |
| C3 | **Input Sanitization** | XSS prevention. SQL injection prevention. CSRF protection. Content-Security-Policy. |
| C4 | **Data Privacy** | PII handled appropriately. Consent management. Data minimization. |
| C5 | **Transport Security** | HTTPS enforced. Secure cookies. CORS properly configured. |
| C6 | **Dependency Security** | No known vulnerabilities in deps. Dependencies up to date. |
| C7 | **Financial Data Protection** | Stripe integration secure. No card data stored. Webhook signatures verified. |
| C8 | **Audit Trail** | Security events logged. Login/logout tracked. Admin actions recorded. |

## Baseline Assessment
