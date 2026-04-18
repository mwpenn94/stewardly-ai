# v4 → v5 Schema Migration

## Filename mapping (1:1)

| v4 | v5 | Changes |
|---|---|---|
| `WealthBridge_Prospect_Database_v4.xlsx` | `WealthBridge_Prospect_Database_v5.xlsx` | +propensity columns, +geo_tier, +multi_property_count, +phase1 columns |
| `WealthBridge_Engagement_Database_v4.xlsx` | `WealthBridge_Engagement_Database_v5.xlsx` | Formalized 6-value outcome taxonomy, scoring snapshot per event |
| `WealthBridge_Combined_Pipeline_v4.xlsx` | `WealthBridge_Combined_Pipeline_v5.xlsx` | Propensity-sorted, A-tier action list, funnel view |
| `WealthBridge_Executive_Summary_v4.xlsx` | `WealthBridge_Executive_Summary_v5.xlsx` | Propensity-tier + geo-tier breakdowns, Phase 1 readiness indicator |
| `WealthBridge_Event_Schedule_v4.xlsx` | `WealthBridge_Event_Schedule_v5.xlsx` | Tier attribution, formula-driven rates and cost-per-outcome |
| *(new)* | `WealthBridge_Scoring_Control_v5.xlsx` | Control panel for weights / tiers / taxonomy |

## Column additions (Prospect Database)

| New column | Type | Source | Purpose |
|---|---|---|---|
| `propensity_score` | 0-100 | phase0 scorer | Sortable rank |
| `propensity_decile` | 1-10 | phase0 scorer | 1=top |
| `propensity_tier` | A/B/C/D | phase0 scorer | Coarse action bucket |
| `priority_multiplier` | 0.30-1.00 | geo tier map | Shows multiplier applied |
| `geo_tier` | tier_1..tier_5 | filename + state/county | Routing key |
| `multi_property_count` | int | dedup aggregation | Commercial wealth signal |
| `phase1_proba` | 0-1 | phase1 logistic | Calibrated probability (populated when trained) |
| `phase1_decile` | 1-10 | phase1 logistic | Replaces heuristic decile when available |
| `fips` | 5-char | census geocoder | Regulatory reporting |
| `last_scored_date` | date | scoring run | Staleness detection |

## Backward compatibility

- All v4 columns retained — v5 is additive, no renames
- `owner_name` kept for display; `owner_key` added as join key (hashed, PII-safe)
- v4 import routines work unchanged against v5 Prospects sheet
