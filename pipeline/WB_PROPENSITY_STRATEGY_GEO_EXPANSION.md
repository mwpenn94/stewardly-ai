# WealthBridge Propensity Modeling — Geographic Expansion Strategy

**Companion to:** `phase0_propensity_scoring.py`
**Scope:** AZ (primary) · NM · WA · Broader US · Global
**Date:** April 14, 2026

---

## 1 · Geographic Tier Framework

The scoring pipeline assigns every prospect one of five geo tiers. Tier drives both the **CAC tolerance** and the **outreach modality** — not every tier should be worked the same way, and forcing a single model across them buries signal.

| Tier | Scope | Priority × | Outreach modality | Licensing gate |
|---|---|---|---|---|
| **T1 — AZ home** | Pima, Mohave, Santa Cruz | 1.00 | Direct production — full-stack (seminars, outbound, referrals) | AZ resident license (have it) |
| **T2 — AZ adjacent** | Cochise, Maricopa, Yuma, Pinal, Graham | 0.85 | Direct production, lower-cost channels only | AZ resident license (have it) |
| **T3 — NM + WA licensed** | All NM counties; all WA counties | 0.75 | Hybrid: partner-referral first, direct outbound second | Non-resident licenses (verify) |
| **T4 — Broader US** | All other US states | 0.50 | **Platform only** (Stewardly) + referral-to-network | No personal production |
| **T5 — Global** | Non-US | 0.30 | **Platform only** (Stewardly) | N/A |

**Licensing prerequisite for T3:** Non-resident producer licenses in NM and WA through ESI. Each ~$100 initial + state fee, 2–4 weeks to issue. Must complete before outbound in those states. If not already in motion, this is the gating action.

**T4 and T5 are not personal-production targets** — they're Stewardly top-of-funnel. The scoring still runs so that when Stewardly captures a US or international lead, it lands in a prioritized queue rather than a flat list. Score × geo-multiplier preserves ordering without promising a direct call-back.

---

## 2 · Segment Strategy Across Tiers

The Residential/Commercial split from the earlier analysis still holds, but modality shifts by tier:

| | T1 AZ Home | T3 NM + WA | T4 Broader US |
|---|---|---|---|
| **Residential** | Property-data scoring → direct mail + phone, seminar funnel | Partner-referral first (AZ-licensed CPAs with NM/WA clients), then targeted outbound | Stewardly inbound; refer out to licensed network advisor |
| **Commercial** | NAICS + entity-age scoring → LinkedIn outbound + COI referrals | Same stack, plus NM state corp filings scrape (free) and WA business license data (free) | Stewardly inbound; treat as top-of-funnel for advanced-planning content |

**Free data windfall per expansion state:**
- **New Mexico** — NM Secretary of State business search (free, includes filing date, entity type, registered agent). Combine with NM county assessor feeds (Bernalillo, Dona Ana, Santa Fe have the best open data).
- **Washington** — WA Dept of Revenue "Business Lookup" is a gold mine: NAICS, formation date, revenue-bracket UBI classification, all free. King/Pierce/Snohomish county parcel data is also open.

That alone can seed a 20,000–50,000 row NM+WA prospect DB at effectively $0 data acquisition cost, before any paid enrichment.

---

## 3 · Lead Source Economics by Geography

Cost and modality shift materially across tiers. Same source can be efficient in T1 and wasteful in T4.

### Tier 1 — AZ Home (full-stack direct production)

| Source | $ / qual conv | Time intensity | Notes |
|---|---|---|---|
| COI referrals (existing clients, partner CPAs/attorneys) | $0–50 | High relational | Systematize the ask. Highest LTV. |
| Your CSVs + tiered enrichment + outbound | $5–20 | Medium-high | Phase 0 top decile = immediate call list |
| Seminars ("SS for Business Owners", "Advanced Planning for AZ Ranchers") | $150–300 | High $, high close | 25–40% close on attendees |
| LinkedIn Sales Nav (commercial only) | $20–40 | Medium | $99/mo seat |
| Meta lead ads (residential only) | $60–200 | Low time, variable quality | Tight filtering required |

### Tier 3 — NM + WA (hybrid: partner-first, then direct)

| Source | $ / qual conv | Time intensity | Notes |
|---|---|---|---|
| Referral partnerships with AZ-based CPAs/attorneys serving NM/WA clients | $0 | High relational | Fastest path — leverage existing COI network |
| NM SOS business search + WA DOR business lookup → outbound | $3–10 | Medium | Free data; enrichment adds $0.20–0.50/record |
| LinkedIn Sales Nav (filter by state) | $25–50 | Medium | Same seat, different filters |
| Local seminars (Albuquerque, Santa Fe, Seattle metro) | $300–500 | High $, travel cost | Only after partner base establishes need |
| Meta/Google geo-targeted | $80–250 | Low time, high $ | Only if inbound lift justifies |

### Tier 4 — Broader US (Stewardly-only, no direct production)

| Source | $ / qual lead (not conv — no production) | Notes |
|---|---|---|
| Stewardly organic (SEO, content, thought leadership) | $5–25 | The strategic play — CAC approaches zero at scale |
| Stewardly paid (Meta, Google for financial content) | $30–80 | Only if LTV-to-network-advisor-share economics justify |
| Partner referrals into Stewardly from national networks | $0 hard | Business-dev time |
| Purchased US data lists | **Do not buy at this tier** | ROI is negative without production capability |

### Tier 5 — Global (Stewardly-only)

Same as T4 with even tighter discipline. International compliance (GDPR, various consumer-protection regimes) makes outbound legally hazardous unless Stewardly has region-specific legal review. Organic and inbound only.

---

## 4 · GHL Custom Fields + Pipeline Schema

The Phase 0 script emits `ghl_import_top_decile.csv` with fields that need to land cleanly in GoHighLevel. Schema:

### Contact custom fields (create these in GHL before import)

| Field name | Type | Purpose |
|---|---|---|
| `propensity_score` | Numeric | 0–100, from scoring script |
| `propensity_decile` | Numeric (1–10) | 1 = best |
| `propensity_tier` | Dropdown (A/B/C/D) | A = top 2 deciles |
| `geo_tier` | Dropdown (T1–T5) | Drives workflow routing |
| `segment` | Dropdown (Residential/Commercial) | |
| `multi_property_count` | Numeric | Commercial wealth-concentration signal |
| `entity_type` | Text | Commercial only |
| `source_file` | Text | Audit — which CSV this came from |
| `last_scored_date` | Date | Re-score trigger |
| `outcome_status` | Dropdown | **This is your label — critical** |

### `outcome_status` — the label taxonomy

Keep it tight. Five values, not more. This becomes your y-variable for Phase 1 logistic.

1. `not_contacted` — default on import
2. `contacted` — any touch delivered (call, email, letter)
3. `responded` — any response back (even "no")
4. `qualified` — economic decision-maker + surfaced need + agreed to next step
5. `closed_won` | `closed_lost` — terminal states

**Why five, not fifteen:** granular tagging feels rigorous but kills label density. Logistic regression needs ~30+ positives per feature to be stable; with 10 weighted features you need 300+ closed-won examples. At 5 outcome states the math works faster.

### Pipeline stages (mirror outcome_status)

Same five. Automation: when outcome moves to `qualified`, trigger the Assessment workflow (Stewardly HTML calculators, whichever fits the segment). When `closed_won`, write a new row to the Engagement Database with policy details — that row is the gold label for retraining.

### Nightly sync loop

```
CSVs (enriched) → phase0_propensity_scoring.py → ghl_import_top_decile.csv
                                                          ↓
                                          GHL Import (via Zapier or native CSV)
                                                          ↓
                                             Workflow routing by geo_tier:
                                               T1/T2 → Mike direct call queue
                                               T3     → Partner-referral outreach
                                               T4/T5 → Stewardly nurture sequence
                                                          ↓
                                              Outcome captured in GHL
                                                          ↓
                                    Weekly export → Engagement Database v4
                                                          ↓
                                   Monthly: retrain heuristic weights, then
                                   at 300+ labels: graduate to Phase 1 logistic
```

---

## 5 · Lead Sourcing — Ranked Cost-Efficient Process

Given the geographic expansion, here's the *efficient* execution order — do these in sequence, not in parallel, for first 90 days:

### Week 1 — Zero-cost wins
1. Run Phase 0 scoring on existing AZ CSVs → top decile call list (≈ 100–200 names per segment). Cost: $0.
2. Audit GHL for the 10 custom fields above; create missing ones. Cost: $0, 1 hour.
3. Scrape NM SOS business search (free) for top 5 NM counties → 5,000–15,000 rows. Cost: $0, 2–3 hours in Claude Code.
4. Scrape WA DOR + King County parcel (free) → 10,000–25,000 rows. Cost: $0, 3–4 hours.

### Week 2 — Licensing + partner motion
5. Apply for NM + WA non-resident producer licenses through ESI. Cost: ≈$200 total, 2–4 weeks processing.
6. Identify 10 AZ CPAs/attorneys whose client base extends to NM or WA. Cost: $0, outreach is time.

### Weeks 3–4 — Cheap enrichment on top deciles only
7. Run expanded dataset through Phase 0. Enrich only T1+T3 A-tier prospects: BatchData or LexisNexis for phone/email append, ≈$0.05–0.30/record. Budget: $200–500 for ~1,500 records.
8. Optional: D&B or Apollo firmographic overlay on Commercial A-tier only. Budget: $200–400.

### Weeks 5–8 — Outreach discipline
9. Fixed cadence: 100 AZ A-tier calls/wk + 100 AZ A-tier letters/wk + 50 NM/WA A-tier LinkedIn touches/wk (pending license issuance). Capture every outcome in GHL.
10. First seminar booked (AZ T1 only — don't travel yet).

### Weeks 9–12 — Measure + recalibrate
11. Extract outcomes. Check: are residential equity-decile weights predicting? Commercial entity-age weights? Adjust `RESIDENTIAL_WEIGHTS` / `COMMERCIAL_WEIGHTS` in the script.
12. At ≥300 qualified/closed outcomes, graduate to Phase 1 logistic regression. Retrain in ~1 afternoon.

### 90-day total budget

| Category | Low | High |
|---|---|---|
| Non-resident licensing (NM + WA) | $200 | $300 |
| Enrichment (BatchData/LexisNexis, Apollo) | $400 | $900 |
| LinkedIn Sales Navigator (3 mo) | $297 | $297 |
| One AZ seminar (venue + food, ~25 attendees) | $800 | $1,500 |
| Misc (GHL add-ons, scraping proxies if needed) | $0 | $200 |
| **Total** | **$1,697** | **$3,197** |

Time: ≈20–25 hours of setup (most of it Claude Code doing the data work), then 6–10 hours/wk of disciplined outreach + outcome logging.

---

## 6 · What This Does NOT Solve (Honest Limits)

- **Does not validate that equity or entity-age actually predict conversion** for *your* book specifically. The weights in the script are informed priors, not empirical. That's the whole point of Phase 0 → Phase 1 — you earn the empirical calibration by logging outcomes.
- **Does not replace compliance review** for NM/WA marketing materials. Each state has its own insurance marketing rules. ESI compliance team reviews required before outbound content goes live in a new state.
- **Does not build Stewardly's T4/T5 inbound engine** — that's a separate platform-level build, not a propensity-modeling exercise. This framework just ensures that when Stewardly captures those leads, they land in a prioritized structure instead of a flat dump.
- **Does not solve licensing lag.** If NM/WA licenses take 6 weeks instead of 2, the NM/WA outreach in the 90-day plan slides accordingly. Plan the partner-referral motion to run during that window so the time isn't wasted.

---

## 7 · Next Actionable Items (pick any, all are 20–40 min of my work)

1. **Scraper for NM SOS + WA DOR** — produces raw CSVs in the same schema the scoring script expects.
2. **GHL automation spec** — exact workflow definitions for the T1/T2/T3/T4-T5 routing logic above, ready to drop into GHL's workflow builder.
3. **Phase 1 logistic regression notebook** — trains on `Engagement_Database_v4.xlsx` once you export it to CSV + sets up proper train/test split + calibration plot.
4. **Seminar funnel spec** — landing page content, registration form fields, follow-up sequence, tuned for AZ T1 commercial owners.

Pick one (or more) and I'll produce it.
