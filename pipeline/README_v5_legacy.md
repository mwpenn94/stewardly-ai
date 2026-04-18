# WealthBridge Propensity Modeling Pipeline

Geo-aware, segment-aware prospect scoring for WealthBridge AZ Region 1, with licensed expansion into NM + WA and Stewardly inbound support for broader US + Global.

**Status:** Phase 0 heuristic operational. Phase 1 logistic ready to train once ≥300 labeled outcomes accumulate in the Engagement Database.

---

## Why this exists

A single unified score across Residential + Commercial across all geographies buries signal. This pipeline splits on both axes:

- **Two segment models** (Residential, Commercial) with distinct feature sets
- **Five geography tiers** (AZ home, AZ adjacent, NM/WA licensed, broader US, global) with distinct CAC tolerances and outreach modalities
- **Phased model progression** (heuristic → logistic → GBM) as labels accumulate
- **GHL-native downstream** — tier-based workflow routing, not a flat call list

---

## Quickstart

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Drop your raw CSVs into data/raw/
#    Filename convention: WB_{Residential|Commercial}_{County}_County[_{State}].csv

# 3. Run the full pipeline
python src/orchestration/run_pipeline.py --skip-scrapers

# 4. Outputs land in data/scored/
#    - scored_residential.csv
#    - scored_commercial.csv
#    - ghl_import_top_decile.csv  ← import this into GHL
#    - scoring_diagnostics.json
```

---

## Architecture

```
Data sources                  Enrichment                 Modeling              Downstream
─────────────────             ──────────                 ────────              ──────────
AZ county CSVs         ┐                                                      ┌─ GHL import
NM SOS bulk            ├─► [Phase 0 scoring] ─┬─► scored_*.csv ──► ghl_top ─►│   (tier-routed
WA DOR API (Socrata)   │   ├ Dedup             │                              │    workflows)
Stewardly inbound      ┘   ├ ACS zip income    │   If labels ≥ 300:
                           ├ Census geocoding  │   ┌────────────────────┐
                           ├ Multi-property    └─► │ Phase 1 logistic   │
                           │   aggregation         │ (per segment)      │
                           └ Geo tier              └────────────────────┘
                             assignment                   │
                                                          ▼
                                                  phase1_scored_*.csv
                                                  (replaces ghl_top)
```

---

## Directory layout

```
.
├── README.md                                      ← this file
├── WB_PROPENSITY_STRATEGY_GEO_EXPANSION.md        ← strategic framework
├── phase0_propensity_scoring.py                   ← heuristic scorer (always runs)
├── requirements.txt
├── Makefile
├── src/
│   ├── scrapers/
│   │   ├── wa_dor_scraper.py                      ← data.wa.gov Socrata API
│   │   └── nm_sos_loader.py                       ← NM bulk-file parser
│   ├── enrichment/
│   │   ├── acs_zip_income.py                      ← Census ACS B19013 lookup
│   │   └── census_geocoder.py                     ← unknown-county resolution
│   ├── modeling/
│   │   └── phase1_logistic.py                     ← graduation from heuristic
│   └── orchestration/
│       └── run_pipeline.py                        ← one-command end-to-end
├── specs/
│   ├── GHL_AUTOMATION_SPEC.md                     ← workflow definitions
│   ├── SEMINAR_FUNNEL_SPEC.md                     ← AZ T1 workshop funnel
│   └── COMPLIANCE_CHECKLIST.md                    ← FINRA/ESI/state compliance
└── data/
    ├── raw/          ← drop CSVs here (gitignored)
    ├── enriched/     ← intermediate outputs (gitignored)
    ├── scored/       ← pipeline outputs (gitignored)
    ├── reference/    ← ACS cache, geocoder data
    └── models/       ← Phase 1 serialized models + reports
```

---

## The five geography tiers

| Tier | Scope | Priority × | Modality |
|---|---|---|---|
| **T1** | AZ Pima, Mohave, Santa Cruz | 1.00 | Direct production, full-stack |
| **T2** | AZ adjacent counties | 0.85 | Direct production, cheap channels |
| **T3** | All NM + WA counties | 0.75 | Partner-first, then direct (after licensing) |
| **T4** | Broader US | 0.50 | Stewardly inbound only, no direct production |
| **T5** | Global (non-US) | 0.30 | Stewardly inbound only, platform plays |

Adjust weights in `phase0_propensity_scoring.py` → `GEO_TIERS` as your conversion data refines the priors.

---

## The two segment models

| | Residential | Commercial |
|---|---|---|
| **Target products** | Life insurance, annuities, premium-financed personal policies | Key-person, buy-sell, advanced planning, premium-financed entity policies |
| **Top features** | Estimated equity, ownership length, owner age, zip affluence, recent liquidity event | Entity age, entity type, revenue band, multi-property ownership, owner age |
| **Primary outreach** | Direct mail + phone + seminars | LinkedIn + COI referrals + seminars |
| **Typical CAC (T1)** | $60–200 per qual (mail + call) | $20–40 per qual (LinkedIn + referral) |

---

## Phase progression

**Phase 0 — Heuristic (operating now)**
Expert-weighted linear score. Always runs. Generates the outcome labels that Phase 1 needs.

**Phase 1 — Logistic (graduate at ~300 labeled outcomes)**
Interpretable, compliance-friendly. Coefficients tell you which features matter. Re-train monthly.

**Phase 2 — GBM or Look-alike (graduate at ~500–1000 labels, only if Phase 1 plateaus)**
XGBoost/LightGBM or a look-alike service like Clay/Apollo trained on closed-wons. Only worth the cost if Phase 1 isn't delivering lift.

---

## Running just part of the pipeline

```bash
# Only pull WA data
python src/scrapers/wa_dor_scraper.py --limit 10000 --target-counties-only

# Only parse NM bulk file
python src/scrapers/nm_sos_loader.py --input /path/to/nm_bulk.csv

# Only geocode a file
python src/enrichment/census_geocoder.py --input unknown_county.csv --out geocoded.csv

# Only (re-)build ACS cache
python src/enrichment/acs_zip_income.py --build-cache

# Only train Phase 1 (requires labels export from Engagement Database)
python src/modeling/phase1_logistic.py \
    --features data/scored/scored_commercial.csv \
    --labels   data/labels/engagement_export.csv \
    --segment  Commercial
```

---

## Weekly operational rhythm

| Cadence | Action | Time |
|---|---|---|
| Weekly | Run pipeline, export new top-decile, import to GHL | 20 min |
| Weekly | 100 A-tier T1 calls + 100 A-tier T1 letters + 50 T3 LinkedIn touches | 6–10 hr |
| Monthly | Recalibrate heuristic weights against outcome data | 1 hr |
| Monthly | Re-train Phase 1 (once labels ≥ 300) | 30 min |
| Quarterly | Refresh ACS cache, re-pull WA data, reassess NM bulk freshness | 2 hr |
| Quarterly | Review compliance checklist, any new state expansions | 1 hr |

---

## Known limitations / honest boundaries

1. **Feature weights are informed priors, not empirical.** Phase 0 is calibrated by intuition. Earn empirical weights by logging outcomes and graduating to Phase 1.
2. **NM bulk-file path requires manual request.** Not fully automated — NM SOS hasn't published a stable API.
3. **Non-US (T5) support is structural only.** Compliance, GDPR, and jurisdictional licensing mean T5 is Stewardly-only — this pipeline just preserves ordering.
4. **No phone/email data unless enriched.** Raw county/SOS/DOR data has names + addresses. Enrichment is a $0.05–0.50/record paid step; only run it on top deciles.
5. **ESI compliance review is required for all outbound content.** Pipeline doesn't obviate that — plan 5–10 business days per piece.

---

## Next on the roadmap

- AZ assessor data freshness monitor (detect stale files)
- GHL webhook sync → Engagement Database (currently manual)
- Stewardly inbound connector — tag T4/T5 leads with geo_tier on capture
- XGBoost Phase 2 notebook (when Phase 1 plateaus)
- Partner-CPA assignment logic for T3 routing
