# audit/08 — Compliance and Regulatory Assessment

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit

---

## 1. Current Compliance Infrastructure

### 1.1 Implemented Compliance Rules

**File:** `server/routers/compliance.ts`

| Code | Name | Description |
|------|------|-------------|
| FINRA_2210_FAIR | Fair & Balanced | Content must be fair, balanced, and not misleading |
| FINRA_2210_GUARANTEE | No Performance Guarantees | Cannot guarantee future performance or returns |
| FINRA_2210_COMPARISON | Fair Comparisons | Product comparisons must be balanced |
| SEC_DISCLAIMER | Investment Disclaimer | Investment advice must include disclaimers |
| SEC_SUITABILITY | Suitability Statement | Recommendations must reference suitability |
| FINRA_2111_BASIS | Reasonable Basis | Recommendations must have reasonable basis |
| REG_BI | Reg BI Best Interest | Must act in client's best interest |
| MISLEADING_LANGUAGE | Misleading Language | Avoid superlatives, absolute claims |

### 1.2 Compliance Review Pipeline

- LLM-powered compliance review via `contextualLLM`
- `complianceReviews` table for audit trail
- `complianceFlags` table for flagged content
- Cadence compliance dashboard (`CadenceComplianceDashboard.tsx`)

### 1.3 Licensed Review Gate (G8)

**File:** `server/routers/agenticExecution.ts`

Universal compliance gate for agentic actions:
- Submit action for review
- Review with approve/reject/escalate
- Gate blocks execution until approved
- Audit trail for all gate decisions

### 1.4 Guardrails

**File:** `server/shared/guardrails/index.ts`

| Guardrail | Coverage |
|-----------|----------|
| PII Detection | SSN, credit card, email, phone, DOB, routing/account numbers |
| Injection Prevention | Ignore instructions, you-are-now, system prompt extraction |
| URL Hallucination | Detect and strip hallucinated URLs from LLM output |

---

## 2. Compliance Gaps (per Architecture Reference)

### 2.1 Sensitivity Classifier (GAP-S3)

**Required:** NPI/PII/ePHI/Privileged/Operational classification that gates tier routing.
**Impact:** Without classifier, sensitive data may route to CLOUD tier when it should stay LOCAL.
**Risk:** Regulatory exposure if financial PII leaves controlled environment.

### 2.2 Tier Indicators (GAP-P3)

**Required:** Users must see which tier is handling their data.
**Impact:** Transparency requirement for regulated financial services.
**Risk:** Client trust erosion if they can't verify data handling.

### 2.3 Audit Trail Completeness

**Required:** Every primitive call logged with sufficient detail for cost attribution and compliance verification.
**Current:** AI tool calls logged. Compliance reviews logged. Gate decisions logged.
**Gap:** Not all primitive calls have full audit trail (e.g., embedding generation, search queries, document processing).

### 2.4 Data Residency

**Required:** LOCAL routing for sensitive data; no network egress for classified content.
**Current:** All AI calls route through Forge API (cloud). No local processing option.
**Gap:** Cannot guarantee data residency until BYO-local and classifier are implemented.

---

## 3. Regulatory Framework Coverage

### 3.1 Currently Covered

| Regulation | Coverage | Implementation |
|-----------|----------|---------------|
| FINRA 2210 | Communications with public | Compliance review rules |
| FINRA 2111 | Suitability | Reasonable basis check |
| Reg BI | Best interest | Best interest flag |
| SEC Advertising | Investment disclaimers | Disclaimer check |

### 3.2 Not Yet Covered

| Regulation | Relevance | Priority |
|-----------|-----------|----------|
| SOC 2 Type II | Platform security certification | P3 (operational) |
| GDPR | EU data protection | P3 (if EU customers) |
| CCPA | California privacy | P3 (if CA customers) |
| HIPAA | Health information (ePHI) | P2 (if health insurance data) |
| Reg S-P | Customer privacy | P2 (financial privacy) |
| SEC Rule 17a-4 | Record retention | P2 (audit trail) |
| FINRA Rule 3110 | Supervision | P2 (admin spectrum) |

---

## 4. Administrative Spectrum Compliance Implications

Per Architecture Reference §12:

> "Compliance class permanently excluded from Automatic regardless of metrics."

This means:
- Compliance reviews can never be fully automated
- Licensed review gate (G8) must always require human approval for compliance-sensitive actions
- The administrative spectrum must enforce this exclusion as a hard constraint

---

## 5. Conflict-of-Interest Compliance

Per Architecture Reference §8:

> "In every decision Stewardly's substrate makes, the platform's incentives are aligned with the customer's outcomes."

Required compliance measures:
1. **Principle test** — every recommendation passes "would this be the same recommendation if Stewardly had no economic relationship with the provider?"
2. **Recommendation audit trail** — captures reasoning, alternatives considered, COI check result
3. **Counsel-reviewable logic** — recommendation algorithms can be inspected by legal counsel

---

## 6. EMBA Section 7 ToS Boundary

Per v2.0 §VIII.3 trigger 7:

> "EMBA Section 7 ToS boundary touch — even an inadvertent one. Halt entirely until verified clean."

This is a hard escalation trigger. The platform must not:
- Provide specific investment advice without appropriate disclaimers
- Make guarantees about investment performance
- Act as a registered investment advisor without proper registration
- Provide tax advice that constitutes unauthorized practice of law/accounting

---

## 7. Recommendations

| Item | Priority | Action |
|------|----------|--------|
| Build sensitivity classifier | P1 | Gates all other compliance improvements |
| Add tier indicators | P2 | Transparency for regulated clients |
| Complete audit trail | P2 | Every primitive call logged |
| Implement admin spectrum compliance exclusion | P2 | Hard constraint on compliance class |
| Add COI principle test | P2 | Middleware on all recommendations |
| SEC Rule 17a-4 record retention | P2 | Ensure audit logs meet retention requirements |
| FINRA 3110 supervision via admin spectrum | P2 | Wire supervision to spectrum positions |
