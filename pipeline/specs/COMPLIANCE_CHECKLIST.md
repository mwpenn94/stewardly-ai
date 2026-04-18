# Compliance Checklist — Multi-State Propensity Pipeline

**Scope:** Activities enabled by this propensity system (AZ production, NM/WA expansion, Stewardly T4/T5 inbound).
**Owner:** Mike Penn, WealthBridge Financial Group / ESI registered rep.
**Not legal advice.** All items require final sign-off from ESI compliance and/or licensed counsel.

---

## 1 · State Licensing Prerequisites

### AZ (primary — already in place)
- [x] AZ resident producer license (Life + Health)
- [x] ESI registration, AZ
- [x] Appointments with NLG entities for states of business

### NM (expansion — must complete before any NM outbound)
- [ ] **Non-resident producer license, Life + Health** — ~$50 initial + state fee, typical 2–3 week issuance. Apply via [NIPR](https://www.nipr.com)
- [ ] ESI registration, NM — trigger via ESI ops after NIPR issuance
- [ ] NLG entity appointments, NM — trigger after ESI confirms
- [ ] Any required state-specific CE (varies; confirm with NM OSI)

### WA (expansion — must complete before any WA outbound)
- [ ] **Non-resident producer license, Life + Disability** — ~$55 + state fee, 2–4 week issuance. Apply via NIPR
- [ ] ESI registration, WA
- [ ] NLG entity appointments, WA
- [ ] WA has stricter disclosure requirements on annuity sales (see WA OIC bulletins) — confirm current standard
- [ ] Best-interest standard considerations (WAC 284-17)

### Broader US (Stewardly T4 — platform-only)
- [ ] **Do not personally engage with T4 prospects** until resident or non-resident licensing is in place for their state. Stewardly's role is referral/match only.
- [ ] If Stewardly refers to a partner advisor, document the referral relationship per each state's referral-fee rules (varies — some states prohibit non-licensed referral fees entirely).

### Global (Stewardly T5)
- [ ] **Do not solicit** under any circumstance without jurisdictional review. Most non-US jurisdictions require local licensing to solicit residents regardless of where solicitation originates.
- [ ] GDPR (EU/UK prospects): lawful basis for processing, opt-in required, DSR response process.
- [ ] CCPA (CA within US): technically US but has EU-like requirements — relevant if any Stewardly user is CA-resident.

---

## 2 · Marketing & Content Review

**Every piece of outbound content must be ESI compliance-reviewed before first use.** This includes:

- [ ] Landing pages (workshop, lead magnets, Stewardly calculators)
- [ ] Invitation letters
- [ ] Email templates (all sequences, all segments)
- [ ] SMS templates
- [ ] LinkedIn outreach templates
- [ ] Workshop slides + handouts
- [ ] Social posts + video scripts

**Typical turnaround:** 5–10 business days. Plan accordingly.

**Approved-once content can be re-used without re-review** unless material facts change (rates, product features, licensing states).

**State-specific adaptations require separate review:**
- NM-specific variants of any template
- WA-specific variants (WA has additional annuity disclosure requirements)

---

## 3 · Data Sourcing Legitimacy

The propensity pipeline consumes data from multiple sources. Each has different usage constraints:

| Source | Legitimate Use | Restrictions |
|---|---|---|
| **AZ county assessor parcel data** | Public record; use for prospecting is legal | No phone/email scraping attached — must enrich separately |
| **NM SOS business registry** | Public record via bulk download | Same — just filing data, no contact info |
| **WA DOR business lookup (data.wa.gov)** | Public open data, Socrata API | Abide by the terms on data.wa.gov (no redistribution of bulk data) |
| **ACS Census data (ZCTA income)** | Public, no restrictions | None |
| **BatchData / BatchSkipTracing phone append** | Paid, TOS allows marketing | **DNC-scrub before calling** — required |
| **LexisNexis / Apollo / ZoomInfo** | Paid, TOS generally allows marketing | Each has different redistribution and retention limits — read the TOS |
| **Purchased lists (D&B, Experian)** | Paid, industry-standard for B2B | US: CAN-SPAM compliant required; individual state laws vary |
| **Stewardly-generated inbound leads** | First-party, fully consented | Privacy policy must cover re-use for advisor matching |

---

## 4 · Telephone / SMS Compliance

**Before any outbound call campaign:**
- [ ] **DNC scrub** (National + state-level) on all target lists — required under TCPA + state mini-TCPAs
- [ ] Mike must be personally DNC-registered if using his personal phone for outbound
- [ ] Call scripts must open with required ID (name + firm) within 30 seconds
- [ ] "Do not call again" requests must be honored immediately + recorded in GHL (suppress via tag + exclude from all future workflows)
- [ ] Call recording: if used, state-by-state two-party-consent rules apply. WA is two-party consent; AZ and NM are one-party. Default: disclose recording everywhere to eliminate ambiguity.

**Before any SMS campaign:**
- [ ] Written express consent captured for every number — GHL's opt-in fields must be wired through
- [ ] STOP/HELP keyword handling enabled
- [ ] Campaign registered with CTIA (10DLC registration required since 2024)
- [ ] Time-of-day restrictions (TCPA: 8 AM – 9 PM local recipient time)

---

## 5 · PII Handling in the Pipeline

The scoring pipeline processes personal information (names, addresses, sometimes phone/email after enrichment). Treat accordingly:

- [ ] **Do not check raw enriched CSVs into git.** Use `.gitignore` for `data/raw/`, `data/enriched/`, `data/scored/`. Commit only the schema definitions.
- [ ] Scoring outputs stored locally or in a private GHL bucket — not in a shared Drive folder unless access-controlled.
- [ ] When sharing a scored file for collaboration (e.g., with Paul Barone or Kyle Siegel), redact PII columns (owner_name, property_address, phone, email) and share only `owner_key` (hashed), `propensity_score`, `geo_tier`, `segment`.
- [ ] **Stewardly integration:** if Stewardly reads/writes propensity data, the Stewardly privacy policy must cover this use explicitly. Stewardly's existing PII redaction protocol applies.
- [ ] Periodic purge: records older than 3 years with no engagement → archive or delete per GHL and ESI retention policies.

---

## 6 · Recordkeeping Obligations

FINRA 4511 + ESI policy require retention of:
- [ ] Customer communications (5+ years)
- [ ] Marketing pieces used (5+ years, plus pre-use approval evidence)
- [ ] Order tickets and suitability documentation (6+ years)
- [ ] Correspondence with state regulators (indefinite)

**Pipeline implication:** GHL's contact history + activity log satisfies most of this, but export monthly to a redundant archive (encrypted backup drive or dedicated retention bucket).

---

## 7 · Pre-Go-Live Checklist (before turning on outbound in any new state)

- [ ] Resident/non-resident license issued and confirmed in NIPR
- [ ] ESI registration in state confirmed
- [ ] NLG appointments active
- [ ] State-specific marketing variants compliance-reviewed
- [ ] DNC subscription current for state
- [ ] State CE requirements satisfied for coming renewal cycle
- [ ] ESI surveillance notified of expansion (they monitor state-specific activity)
- [ ] First 10 contacts' documentation reviewed by Mike personally before scaling cadence

---

## 8 · Red-Flag Stop Conditions

If any of these occur, pause the affected workflow and escalate to ESI compliance:

- Any prospect expresses dissatisfaction and mentions a regulator, the word "complaint," or the word "attorney"
- Any prospect appears to be a minor, incapacitated, or under undue influence
- Any inbound media inquiry (press, podcast) related to the business
- Any request from a state department of insurance
- Any suspected data breach or PII exposure event
- Any DNC complaint received (even one requires documented action)
