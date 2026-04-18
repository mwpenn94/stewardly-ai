# GHL Automation Spec — Propensity-Driven Workflows

**Purpose:** Exact GoHighLevel configuration to route `ghl_import_top_decile.csv` into correct contact pipelines, workflows, and automations based on `geo_tier` × `segment` × `propensity_tier`.

**Assumes:** GHL sub-account provisioned for WealthBridge AZ Region 1. Custom fields from §4 of `WB_PROPENSITY_STRATEGY_GEO_EXPANSION.md` already created.

---

## 1 · Custom Field Setup (one-time)

Create these in **Settings → Custom Fields → Contact** before importing:

| Field Name (exact) | Field Type | Options / Notes |
|---|---|---|
| `propensity_score` | Numeric | 0–100 |
| `propensity_decile` | Numeric | 1–10 |
| `propensity_tier` | Dropdown | `A`, `B`, `C`, `D` |
| `geo_tier` | Dropdown | `tier_1_home_az`, `tier_2_az_adjacent`, `tier_3_nm_wa_licensed`, `tier_4_us_broader`, `tier_5_global` |
| `segment` | Dropdown | `Residential`, `Commercial` |
| `multi_property_count` | Numeric | |
| `entity_type` | Single-line text | Commercial only |
| `source_file` | Single-line text | Audit trail |
| `last_scored_date` | Date | |
| `outcome_status` | Dropdown | `not_contacted`, `contacted`, `responded`, `qualified`, `closed_won`, `closed_lost` |

Create a matching **Contact Tag** taxonomy (tags are easier for smart-list filtering than custom fields):
- `prop:A`, `prop:B`, `prop:C`, `prop:D`
- `geo:T1`, `geo:T2`, `geo:T3`, `geo:T4`, `geo:T5`
- `seg:res`, `seg:com`

Tags are redundant with custom fields but GHL's smart-list engine is faster on tags.

---

## 2 · Import Routine (weekly/monthly)

1. **Export** `ghl_import_top_decile.csv` from the pipeline.
2. **Contacts → Bulk Actions → Import Contacts.** Map columns to custom fields 1:1.
3. **Map `email` + `phone`** to core fields (not custom). If missing, the contact still imports with only name + address — you'll enrich later.
4. **Enable "Update existing contacts"** on `email OR phone OR owner_key` — important so re-scoring doesn't duplicate records.
5. After import, trigger a one-time **Bulk Tag** workflow:
   - For each imported contact, compute tags from custom-field values (see Workflow W0 below).

---

## 3 · Workflows

### W0 — "Propensity Intake" (trigger: Contact Created OR Contact Updated with `propensity_score` changed)

Assigns tags, routes into correct pipeline, sets stage.

```
Trigger: Contact Created  OR  Contact Custom Field Updated: propensity_score
Filter: propensity_score > 0

Action 1: Add Contact Tag
  - If propensity_tier = A → add tag `prop:A`
  - If propensity_tier = B → add tag `prop:B`
  - (same for C, D)

Action 2: Add Contact Tag
  - If geo_tier = tier_1_home_az → add tag `geo:T1`
  - (same for T2–T5)

Action 3: Add Contact Tag
  - If segment = Residential → add `seg:res`
  - If segment = Commercial → add `seg:com`

Action 4: Add to Pipeline (conditional)
  - If geo:T1 OR geo:T2 → add to pipeline "AZ Direct Production", stage "not_contacted"
  - If geo:T3          → add to pipeline "NM-WA Licensed Expansion", stage "not_contacted"
  - If geo:T4 OR geo:T5 → add to pipeline "Stewardly Nurture", stage "not_contacted"

Action 5: Assign to User
  - If geo:T1 OR geo:T2 → Mike
  - If geo:T3           → Mike (until NM/WA partner recruited)
  - If geo:T4 OR geo:T5 → Unassigned (Stewardly handles)
```

### W1 — "A-Tier AZ Direct Outreach" (trigger: tag `prop:A` added AND tag `geo:T1` present)

High-priority: call + letter within 72h.

```
Trigger: Contact Tag Added = prop:A
Filter: has tag geo:T1 OR geo:T2

Action 1: Create Task "Call — A-tier prospect" (due +24h, assigned to Mike)
Action 2: Wait 2 days
Action 3: Send Mailpiece (via Lob or Click2Mail integration)
           Template: res_a_tier_letter OR com_a_tier_letter (pick by seg: tag)
Action 4: Wait 5 days
Action 5: IF outcome_status still = not_contacted
          → Create Task "Second call attempt" (assigned to Mike)
Action 6: Wait 14 days
Action 7: IF outcome_status still = not_contacted
          → Move pipeline stage to "no_response_cold"
```

### W2 — "B-Tier AZ Direct Outreach" (trigger: tag `prop:B`, geo T1/T2)

Same as W1 but with 7-day first-call SLA instead of 24h, email-first instead of letter.

### W3 — "T3 NM/WA Partner-First Outreach" (trigger: `geo:T3` + license-active flag)

```
Trigger: Contact Tag Added = geo:T3
Filter: user custom value `license_nm_active` = true  (or `license_wa_active`)

Action 1: IF segment = Commercial
          → Check for COI match (partner CPA with AZ+NM client base)
          → Send partner introduction email template
Action 2: Wait 7 days
Action 3: IF no response, direct LinkedIn outreach (manual task for Mike)
```

### W4 — "T4/T5 Stewardly Nurture"

```
Trigger: Contact Tag Added = geo:T4 OR geo:T5

Action 1: Send Email — Stewardly welcome + resource library link
Action 2: Enroll in Stewardly monthly newsletter sequence
Action 3: Do NOT assign to Mike — Stewardly platform handles
Action 4: IF contact submits Stewardly calculator → promote to "qualified_inbound"
          and trigger W5
```

### W5 — "Qualified Inbound Promotion"

```
Trigger: outcome_status = qualified OR custom event "stewardly_calculator_submit"

Action 1: If geo:T1 OR geo:T2 → Assign to Mike immediately, SMS notification
Action 2: If geo:T3 and licensed → Assign to Mike
Action 3: If geo:T3 and not licensed → Assign to partner advisor (referral out)
Action 4: If geo:T4 OR geo:T5 → Queue for Stewardly network-advisor matching
```

---

## 4 · Pipeline Stages (mirror outcome_status)

Each pipeline has the same 5-stage structure to keep the label taxonomy clean:

1. `not_contacted` (entry)
2. `contacted` (any touch delivered)
3. `responded` (any response, including "no")
4. `qualified` (economic decision-maker + need surfaced + next step agreed)
5. Terminal: `closed_won` or `closed_lost`

**Automation:** when a contact moves to stage `qualified`, fire a webhook to the Engagement Database updater (nightly sync reads this webhook log → writes labeled rows that feed Phase 1 retraining).

---

## 5 · Smart Lists (for daily ops)

Pre-built smart lists Mike should see in the sidebar:

| List Name | Filter |
|---|---|
| **Today — A-tier AZ to call** | tag `prop:A` AND tag `geo:T1` AND outcome_status = `not_contacted` |
| **This week — B-tier AZ email queue** | tag `prop:B` AND tag `geo:T1` AND outcome_status ∈ {not_contacted, contacted} |
| **NM/WA partner-referral queue** | tag `geo:T3` AND outcome_status = `not_contacted` |
| **Multi-property commercial (wealth signal)** | tag `seg:com` AND multi_property_count ≥ 3 |
| **Qualified, awaiting assessment** | outcome_status = `qualified` AND no Stewardly calculator submitted |
| **Closed-won last 90 days** | outcome_status = `closed_won` AND last_status_change > 90 days ago — for retraining label audit |

---

## 6 · Webhook / Sync Back to Engagement DB

Configure GHL Webhook: trigger on `outcome_status` change →
POST to an endpoint that appends a row to `WealthBridge_Engagement_Database_v4.xlsx`
(or a CSV mirror of it).

Minimum payload:
```json
{
  "owner_key": "...",
  "contact_id": "...",
  "outcome_status_from": "contacted",
  "outcome_status_to": "qualified",
  "changed_at": "2026-04-14T15:30:00",
  "segment": "Commercial",
  "geo_tier": "tier_1_home_az",
  "propensity_score": 78.3,
  "propensity_tier": "A"
}
```

This is the label-flow backbone. Without it, Phase 1 logistic retraining has no new data.

---

## 7 · What This Spec Does Not Define

- **Mailpiece templates.** Build separately — res_a_tier_letter, com_a_tier_letter, etc.
- **Email templates.** Likewise — should be compliance-reviewed by ESI before activation.
- **Partner CPA assignment logic for T3.** Needs a table of licensed partners and their state coverage — out of scope here.
- **Opt-out / suppression handling.** Use GHL's native DNC and unsubscribe suppressions; never work around them.
