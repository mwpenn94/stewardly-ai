# GHL Multi-Segment Routing Spec v2

**Supersedes** `GHL_AUTOMATION_SPEC.md` for the full 8-segment WealthBridge taxonomy. Same field/tag/workflow architecture; expanded to handle recruit, partner, affiliate, HR, and nonprofit pipelines alongside the original residential/commercial client pipelines.

---

## 1 · Custom Field Additions (beyond v1 spec)

Add these to GHL contact custom fields:

| Field | Type | Purpose |
|---|---|---|
| `segment` | Dropdown | All 8 segment keys (see below) |
| `expected_value_usd` | Numeric | Pipeline-weighted dollar value |
| `source_kind` | Single-line text | The lead source (e.g., `finra_brokercheck`, `az_state_bar`, `davis_monthan_tap`) |
| `wealth_trigger_type` | Dropdown | `none`, `form4`, `refi`, `probate`, `business_sale`, `mls_sale`, `inheritance` |
| `license_status` | Dropdown | For affiliates/recruits: `none`, `lh`, `pc`, `securities`, `lh_securities` |
| `track_preference` | Dropdown | For affiliates: `A`, `B`, `C`, `D` (per Affiliate Program Guide) |

**Segment dropdown values (exact strings):**
```
residential_client
commercial_client
experienced_pro
new_associate
cpa_attorney_partner
affiliate
hr_director
nonprofit_leader
```

---

## 2 · Tag Taxonomy v2

Tags are still the routing primitive (faster than custom-field smart lists in GHL). Add segment + sub-tag set:

**Segment tags (one per contact):**
```
seg:res-client    seg:com-client
seg:exp-pro       seg:new-assoc
seg:cpa-atty      seg:affiliate
seg:hr-dir        seg:nonprof
```

**Geo tier tags (one per contact, depends on segment mode):**
- Production-mode segments (residential, commercial, partner, affiliate): `geo:T1`–`geo:T5`
- Proximity-mode segments (recruit, HR, nonprofit): `prox:T1`–`prox:T5`

**Wealth-trigger tags (zero or more per contact):**
```
trig:form4   trig:refi   trig:probate
trig:bizsale trig:mls    trig:aircraft
```

**Track tags (affiliates only):**
```
track:A  track:B  track:C  track:D
```

---

## 3 · Pipelines (one per segment)

Each segment gets its own pipeline so stages and conversion definitions are clean. All 8 share the same 5-stage spine:

| Stage | Definition (segment-specific) |
|---|---|
| `not_contacted` | Imported, no touch yet |
| `contacted` | Initial outreach delivered |
| `responded` | Any reply (yes/no/maybe) |
| `qualified` | Decision-maker engagement → next step agreed |
| Terminal | `closed_won` (became client/recruit/partner) or `closed_lost` |

**Recruit-segment terminal definitions:**
- `closed_won` for `experienced_pro`: signed contract, transitioned book
- `closed_won` for `new_associate`: licensed + completed New Associate Program week 1
- `closed_lost` for either: declined or ghosted past 90 days

**Partner-segment terminal definitions:**
- `closed_won` for `cpa_attorney_partner`: signed referral/collaboration agreement + first joint case
- `closed_won` for `affiliate`: signed affiliate agreement (Track A-D)

**Workshop-segment terminal definitions:**
- `closed_won` for `hr_director`: workshop scheduled OR group enrollment opened
- `closed_won` for `nonprofit_leader`: community workshop hosted

---

## 4 · Workflow W0v2 — "Multi-Segment Intake"

Replaces v1's W0. Fires on contact import or `propensity_score` change. Routes contact to correct pipeline.

```
Trigger: Contact Created OR Custom Field propensity_score changed
Filter:  segment IS NOT EMPTY

# Tag application
Action 1: If segment = residential_client → add tag seg:res-client, add to "Residential Client" pipeline
Action 2: If segment = commercial_client  → add tag seg:com-client, add to "Commercial Client" pipeline
Action 3: If segment = experienced_pro    → add tag seg:exp-pro, add to "Experienced Pro Recruit" pipeline
Action 4: If segment = new_associate      → add tag seg:new-assoc, add to "New Associate Pipeline"
Action 5: If segment = cpa_attorney_partner → add tag seg:cpa-atty, add to "Strategic Partner" pipeline
Action 6: If segment = affiliate          → add tag seg:affiliate, add to "Affiliate Program" pipeline
Action 7: If segment = hr_director        → add tag seg:hr-dir, add to "HR Director Workshop" pipeline
Action 8: If segment = nonprofit_leader   → add tag seg:nonprof, add to "Nonprofit Workshop" pipeline

# Tier tag (use prox: for recruit/HR/nonprofit, geo: for everything else)
Action 9: If segment IN (experienced_pro, new_associate, hr_director, nonprofit_leader)
            AND geo_tier starts with "tier_" → add tag prox:T<N>
          ELSE → add tag geo:T<N>

# Tier tag application by propensity_tier
Action 10: Add prop:A / prop:B / prop:C / prop:D based on propensity_tier

# Owner assignment
Action 11: All A-tier across ALL segments → assign to Mike for personal review (within 72h SLA)
Action 12: B-tier res/com/affiliate → Mike; B-tier recruit → Mike + Vince Colatriano (per orchestration doc); B-tier partner → Mike + dedicated Strategic Partner lead
Action 13: C/D-tier → automated nurture only, no human assignment
```

---

## 5 · Workflow W1v2 — "A-Tier Personal Outreach (Multi-Segment)"

```
Trigger: Tag prop:A added

# Branch by segment for cadence + script
If seg:res-client OR seg:com-client:
  → use existing W1 from v1 spec (24h call SLA, 72h letter)

If seg:exp-pro:
  → Day 0: Schedule personal call task for Mike (24h SLA)
  → Day 0: Send Loom video (Experienced Pro overview) via GHL email
  → Day 3: SMS — "[FirstName], following up on the call attempt"
  → Day 7: Second outbound call task (Mike)
  → Day 14: Third touch via LinkedIn Sales Nav (Dripify message 3)
  → Day 21: Move to long-term nurture if no response

If seg:new-assoc:
  → Day 0: Send Workable application link via GHL email
  → Day 1: Schedule call task for Mike (intake conversation)
  → Day 5: SMS reminder
  → Day 10: Discovery booked OR move to long-term nurture

If seg:cpa-atty:
  → Day 0: Personal email from Mike (template: cpa_a_tier_intro)
  → Day 5: Call task for Mike
  → Day 14: Invite to next CE event in pipeline
  → Day 30: Follow-up if no engagement

If seg:affiliate:
  → Day 0: Track-aware email (template per track:A/B/C/D)
  → Day 3: Call task
  → Day 10: Send Affiliate Program Guide PDF
  → Day 21: Final follow-up

If seg:hr-dir:
  → Day 0: Email — workshop offer + financial wellness data
  → Day 7: Call task
  → Day 14: Calendar link for workshop scoping call

If seg:nonprof:
  → Day 0: Email — community workshop offer
  → Day 7: Call task
  → Day 14: Co-branded event proposal
```

---

## 6 · Wealth-Trigger Workflows (NEW — high-priority interrupts)

Wealth-trigger events override normal cadence — they're time-sensitive.

### W6 — "Wealth Trigger Detected"
```
Trigger: Tag trig:form4 OR trig:refi OR trig:probate OR trig:bizsale added
Filter:  Contact already exists in DB OR new contact created from trigger feed

Action 1: Mark propensity_score temporarily as max(current, 90)
Action 2: Move contact to "Trigger Hot List" pipeline (regardless of normal segment pipeline)
Action 3: SMS Mike immediately — "Wealth trigger detected for [Name] ([trigger type])"
Action 4: Schedule personal call task for Mike within 24h
Action 5: After 30 days, decay back to original propensity_score
```

This is the highest-conversion path in the entire system. SEC Form 4 events alone can produce 8-15% close rates if contacted within 30 days of filing.

---

## 7 · Smart Lists — Multi-Segment (extend v1)

Add to the existing smart-list set:

| List Name | Filter |
|---|---|
| **Trigger Hot List** | Any `trig:*` tag in last 30 days |
| **A-Tier Recruits (today)** | seg:exp-pro OR seg:new-assoc, prop:A, outcome_status = not_contacted |
| **A-Tier Partners (this week)** | seg:cpa-atty OR seg:affiliate, prop:A, outcome_status ∈ (not_contacted, contacted) |
| **HR Workshop Ready (Aug-Nov)** | seg:hr-dir, prop:A OR prop:B, in months 8-11 |
| **Nonprofit Workshop Pipeline** | seg:nonprof, prop:A OR prop:B |
| **Multi-Segment Cross-Reference** | Owner_key appears in ≥2 segments (e.g., a CPA who's also a Commercial Client) |

The cross-reference list is uniquely valuable — a person who shows up in BOTH the Commercial Client list AND the Strategic Partner list is a 2x signal.

---

## 8 · Webhook Schema Update

Adds `segment` and `expected_value_usd` to the v1 webhook payload:

```json
{
  "owner_key": "...",
  "contact_id": "...",
  "segment": "experienced_pro",
  "outcome_status_from": "contacted",
  "outcome_status_to": "qualified",
  "changed_at": "2026-04-14T15:30:00",
  "geo_tier": "tier_2_southern_az",
  "propensity_score": 78.3,
  "propensity_tier": "A",
  "expected_value_usd": 47000,
  "wealth_triggers_30d": ["form4"]
}
```

---

## 9 · Per-Segment KPI Targets (monthly)

Match the orchestration doc's per-segment goals:

| Segment | Discovery convs / mo | Closed-won / mo | Notes |
|---|---|---|---|
| `residential_client` | 12-20 | 4-8 | Volume base |
| `commercial_client` | 6-10 | 2-4 | Higher value, lower count |
| `experienced_pro` | 8-12 | 1-2 | Long cycle, big payoff |
| `new_associate` | 6-10 | 3-5 | Per orchestration doc |
| `cpa_attorney_partner` | 4-8 | 2-3 | Per orchestration doc |
| `affiliate` | 5-10 | 2-4 | Track A fastest |
| `hr_director` | 3-6 (workshops scoped) | 1-2 (workshops held) | Concentrate Aug-Nov |
| `nonprofit_leader` | 2-4 (workshops scoped) | 1 (workshop held) | Brand-build mostly |

If a segment runs <50% of target for 60 days → review channel mix per `AZ_LEAD_SOURCING_MASTER.md`.

---

## 10 · Compliance Cross-References

Specific per-segment compliance gates, beyond the general checklist:

| Segment | Gate |
|---|---|
| `experienced_pro` | All transition-capital language is `[PENDING TC APPROVAL]` per orchestration doc — keep in Draft until ESI signs off |
| `cpa_attorney_partner` | Revenue-sharing language flagged `[PENDING TC APPROVAL]` until compliance reviews per state |
| `affiliate` | Track B/C/D agreements require state-by-state confirmation that referral fees are permissible |
| `hr_director` | Group benefits require AZ Group L&H endorsement on producer license; verify before workshop |
| `nonprofit_leader` | Charitable planning content (CGAs, CRTs) requires advanced markets review |
| All `seg:exp-pro` and `seg:cpa-atty` outreach | Use only Track A safe content from `linkedin_posts_enhanced.md` for unattended automation |
