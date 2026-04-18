# WealthBridge Propensity Modeling Pipeline — v6.2

Geo-aware, segment-aware propensity scoring for **all 8 WealthBridge target audiences** with **17-module enrichment layer** that lifts feature fill rates from ~30% raw → 97.8% enriched, at $0 cost on the T0 free tier.

**v6.2** = v6 (8-segment scoring) + 17-module enrichment + critical bug fixes (NaN-or trap, scalar-fallback trap, orchestrator merge bug, NAICS word-boundary)

---

## What v6.2 adds vs. v6.1

| | v6.1 | v6.2 |
|---|---|---|
| Enrichment modules | 6 | **17** |
| Avg feature fill rate (synthetic 8-seg test) | ~60% | **97.8%** |
| Bug-hardening | NaN-or trap caught in 1 module | **Fixed across 5 modules + scalar-fallback fix in scorer** |
| Cost discipline | Designed | Operational orchestrator with T0→T1→T2→T3 budget caps |

## Honest convergence assessment after 9 passes

**Functional convergence achieved:**
- 8 segments × 5 geo tiers × 17 enrichers, 102 feature columns produced from ~12 raw input columns
- All 17 modules smoke-tested individually + end-to-end via orchestrator
- 97.8% feature fill rate on synthetic test (488 rows, 8 segments)
- Master GHL export: 243 A+B prospects, $3M expected value across 8 segments

**Bug-hardening:**
- The Python `NaN or X → NaN` trap was identified in 5 modules; fixed via shared `first_valid_numeric()` helper
- The `df.get(col, scalar_default)` trap was identified in 8 spots in the v2 scorer; fixed via `_safe_numeric()` and `_safe_text()` helpers
- The orchestrator's merge-only-new-columns bug was silently dropping segment-specific feature updates; fixed
- NAICS word-boundary regex traps on `MANUFACTURING`, `OPHTHALMOLOGY`, etc.; fixed

**Further code recursion at this point would be decorative.** Remaining work is operational: drop bulk files into data/raw/, let outcomes accumulate, retrain monthly.

## Empirical results (synthetic 8-segment data)

| Segment | Rows | A-tier | Total expected value |
|---|---|---|---|
| residential_client | 75 | 30 | $187,500 |
| commercial_client | 48 | 19 | $360,000 |
| **experienced_pro** | **30** | **12** | **$1,296,780** |
| new_associate | 20 | 8 | $292,800 |
| cpa_attorney_partner | 25 | 10 | $553,920 |
| affiliate | 17 | 7 | $125,976 |
| hr_director | 12 | 5 | $134,820 |
| nonprofit_leader | 16 | 7 | $76,800 |
| **TOTAL** | **243** | **98** | **$3,028,596** |

The experienced_pro segment dominates (~43% of total expected value).

## Quickstart

```bash
pip install -r requirements.txt
python src/orchestration/run_pipeline.py --skip-scrapers --skip-t2 --skip-t3
# Outputs: data/enriched/enriched_combined.csv (97.8% feature fill)
#          data/scored/ghl_import_master.csv (A+B tier, all 8 segments)
```

## See also

- `specs/ENRICHMENT_ARCHITECTURE.md` — full 17-module map + tier discipline
- `specs/AZ_LEAD_SOURCING_MASTER.md` — 38 channels × 8 segments matrix
- `specs/GHL_AUTOMATION_SPEC_v2.md` — workflow + smart-list spec
- `specs/COMPLIANCE_CHECKLIST.md` — licensing, marketing review, DNC, PII
- `specs/SEMINAR_FUNNEL_SPEC.md` — AZ T1 commercial workshop funnel
