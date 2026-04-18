# Enrichment & Imputation Architecture

**Problem:** Raw lead-source data is sparse. County parcel records have property value but no phone. FINRA BrokerCheck has CRD but no email. NM SOS has entity name but rarely a contact person. Without enrichment, propensity scores are dominated by the 0.5 neutral fallback and the model can't discriminate.

**Solution:** Layered enrichment pipeline that fills features in cost-ascending order, with imputation as a last resort for features that can't be appended.

---

## 1 · The four enrichment tiers

| Tier | Cost / record | Sources | Run on | Latency |
|---|---|---|---|---|
| **T0 — Free public** | $0 | Census ACS, county recorder, FAA, SEC EDGAR, IRS BMF, NPI Registry, SSA Death Master, OFAC, FCC, USPS | Everything | Daily |
| **T1 — Free with login** | $0 | NM SOS, AZ ACC, WA DOR, FINRA BrokerCheck, AZ DOI, AZ State Bar, GuideStar/Candid | Everything in scope | Weekly |
| **T2 — Cheap paid** | $0.02–0.50 | BatchData, BatchSkipTracing, Hunter.io, Apollo (limited), ZeroBounce | Top 30% by heuristic score | Monthly delta |
| **T3 — Premium paid** | $0.50–5.00 | LexisNexis, Apollo unlimited, Clay, ZoomInfo, D&B Hoovers, Pitchbook | Top 5% (A-tier only) | Quarterly |

**The cost discipline that makes this work:** never enrich beyond a tier without a justifying score signal. T0 is free so it runs on everything. T1 is free-ish but rate-limited so it runs on top 80%. T2 costs real money so it runs only on top 30% (after T0+T1 have improved scores). T3 is premium so it runs only on A-tier where LTV justifies the $5/record spend.

If you skip the discipline and run T2/T3 on everything, a 100k-row prospect DB costs $5,000–500,000 to enrich. Run with discipline, the same DB costs $200–800.

---

## 2 · The two paths: Append vs. Impute

**Append** = "fill in the missing value from an external source"
- Best for: phone, email, age, entity-type, NAICS, license status
- Source: paid or free data vendors
- Failure mode: vendor doesn't have it → value stays missing

**Impute** = "predict the missing value from other features in the row"
- Best for: numeric features where pattern can be learned (estimated income, equity, owner age, GDC)
- Method: kNN, regression, or class-conditional means
- Failure mode: imputed value is wrong but model treats it as observed → calibration drift

**Rule of thumb:** Append first, impute only what can't be appended. Track imputed-vs-observed at the feature level — never let an imputed feature outweigh observed features in the score (apply a confidence discount).

---

## 3 · Feature-by-feature enrichment plan

### Residential Client features

| Feature | Append source | Impute fallback | Confidence weight |
|---|---|---|---|
| `equity_est` | County recorder (lien) | County median × LTV | 1.0 if observed, 0.7 if imputed |
| `ownership_length_years` | Deed date | Census block median | 1.0 / 0.6 |
| `owner_age` | LexisNexis (T3) / BatchData (T2) | Block-group median + name-based prior | 1.0 / 0.5 |
| `zip_affluence_decile` | Census ACS B19013 (T0) | National median | 1.0 / 0.5 |
| `recent_liquidity_event` | County recorder, SEC Form 4 | None — leave 0 if unknown | 1.0 / N.A. |
| `phone` | BatchSkipTracing (T2) / Hunter (T2) | None — actionability gate | binary |
| `email` | Hunter.io (T2) / Apollo (T3) | None — actionability gate | binary |
| `entity_type_owner` | NPI / state corp comm | Heuristic from name (Inc/LLC/Trust suffix) | 1.0 / 0.7 |

### Commercial Client features

| Feature | Append source | Impute fallback | Confidence weight |
|---|---|---|---|
| `entity_age_years` | State corp comm (T1) | Industry median | 1.0 / 0.5 |
| `entity_type` | State corp comm (T1) | Suffix heuristic | 1.0 / 0.7 |
| `revenue_band` | D&B (T3) / Apollo (T3) | NAICS × employee-count proxy | 1.0 / 0.5 |
| `naics` | State corp comm (T1) / D&B (T3) | Name-based classifier | 1.0 / 0.4 |
| `employee_count` | D&B (T3) / Apollo (T3) | Industry median | 1.0 / 0.4 |
| `multi_property_count` | Cross-county join (T0) | None — count as 1 | 1.0 / N.A. |
| `owner_age` | BatchData (T2) | Industry median | 1.0 / 0.5 |
| `aircraft_owner` | FAA registry (T0) | None — boolean signal | 1.0 / N.A. |

### Experienced Pro (recruit) features

| Feature | Append source | Impute fallback | Confidence weight |
|---|---|---|---|
| `crd` | FINRA BrokerCheck (T1) | None — required | 1.0 / N.A. |
| `years_in_industry` | FINRA BrokerCheck (T1) | None — required | 1.0 / N.A. |
| `current_firm` | FINRA BrokerCheck (T1) | LinkedIn (T2) | 1.0 / 0.8 |
| `licenses` | FINRA BrokerCheck (T1) | None | 1.0 / N.A. |
| `estimated_gdc` | **No public source** | Industry tenure × firm × license bands | N.A. / 0.5 |
| `email` | Hunter.io firm-domain (T2) / Apollo (T3) | None — actionability gate | binary |
| `linkedin_url` | LinkedIn search (T2) / Apollo (T3) | None | binary |

GDC is the critical example of **must impute** — there is no public source for individual broker GDC. The imputation model uses {firm, tenure, licenses, state, # of disclosures} as features and trains on whatever labeled GDC data you accumulate from discovery calls. Until then, use industry medians by firm tier (e.g., NWM/Edward Jones avg ~$120k, indep avg ~$200k, wirehouse avg ~$350k).

### CPA / Attorney Partner features

| Feature | Append source | Impute fallback |
|---|---|---|
| `firm_headcount` | State Bar / ASCPA (T1) / Apollo (T3) | Imputed from city + practice area |
| `practice_area` | State Bar (T1) | Name-based classifier ("Estate Plan", "Tax", etc.) |
| `years_in_practice` | State Bar admit date (T1) | None |
| `az_client_concentration` | **No source** — must survey | Default 0.7 (assume mostly local) |
| `email` | Firm website scrape (T0) / Hunter (T2) | None |

---

## 4 · The enrichment runner pattern

Every enrichment module follows the same interface:

```python
def enrich(df: pd.DataFrame, **kwargs) -> tuple[pd.DataFrame, dict]:
    """
    Returns:
      df:    enriched dataframe (same row count, additional columns)
      stats: {'n_input': int, 'n_appended': int, 'n_imputed': int,
              'cost_usd': float, 'features_added': [str]}
    """
```

Stats let the orchestrator track cumulative cost + which features were appended vs. imputed, written to `enrichment_log.json` for audit and budget tracking.

---

## 5 · Cost-discipline orchestrator

```
Input: 100,000 raw prospects, $0 sunk cost so far
  ↓
Pass 0 — Universal T0 (free): 100,000 records → +9 features avg, $0
  ↓
Pass 1 — Heuristic score round 1: rank all 100,000 by partial-data score
  ↓
Take top 30% (30,000) → T1 free-with-login enrichment → +5 features avg, $0
Bottom 70% → frozen (will be re-scored next month)
  ↓
Pass 2 — Heuristic score round 2: re-rank top 30k with better data
  ↓
Take top 30% of those (9,000) → T2 paid enrichment → +3 features avg, ~$0.30/record = $2,700
  ↓
Pass 3 — Heuristic score round 3 + impute missing
  ↓
Take A-tier only (top 20% = 1,800) → T3 premium → +5 features avg, ~$2/record = $3,600
  ↓
Final scoring + GHL push of A+B tier (top 50% of 1,800 = ~900 records)
  ↓
Total spent: $6,300 to fully enrich 900 high-conversion prospects out of 100,000
```

Compare to brute-force premium enrichment of all 100k: $200,000+. That's 30x cost reduction with no quality loss because the premium enrichment lands where conversion probability justifies it.

---

## 6 · Imputation safety rails

For every imputed feature value:
1. Track an `_imputed` flag column (e.g., `owner_age_imputed: bool`)
2. Apply confidence discount in scoring: `score_contribution = weight × value × (1.0 if observed else 0.7)`
3. Never impute the dependent variable (outcome_status) — exclude unimputed rows from training
4. Periodically validate: hold out 100 records with observed values, impute them anyway, compare. If imputation MAE > 25% of feature range, that imputer needs retraining.

---

## 7 · Module map (v6.2 — convergence complete on T0 layer)

| Module | Tier | Status | Feeds segments |
|---|---|---|---|
| `_helpers.py` | shared | ✅ done | All — NaN-safe value extraction |
| `usps_address_normalizer.py` | T0 | ✅ done | All — address standardization |
| `census_geocoder.py` | T0 | ✅ done | All — county resolution |
| `acs_zip_income.py` | T0 | ✅ done | residential, commercial — affluence |
| `name_entity_inference.py` | T0 impute | ✅ done | residential, commercial — entity-type from name |
| `naics_classifier.py` | T0 impute | ✅ done | commercial, hr_director, partner |
| `multi_property_aggregator.py` | T0 | ✅ done | commercial, residential — wealth concentration |
| `age_imputer.py` | T0 impute | ✅ done | residential, commercial, recruit, partner |
| `revenue_imputer.py` | T0 impute | ✅ done | commercial, hr_director, partner |
| `gdc_imputer.py` | T0 impute | ✅ done | experienced_pro |
| `firm_movability_classifier.py` | T0 impute | ✅ done | experienced_pro |
| `new_associate_signals.py` | T0 impute | ✅ done | new_associate (vet, coachability, credibility, stage) |
| `practice_area_inferrer.py` | T0 impute | ✅ done | cpa_attorney_partner |
| `affiliate_signal_inferrer.py` | T0 impute | ✅ done | affiliate (license, book size, track) |
| `irs_bmf_loader.py` | T0 | ✅ done | nonprofit_leader (mission, revenue, audience) |
| `engagement_signal_aggregator.py` | T0 | ✅ done | All — cross-source responsiveness |
| `dmf_screener.py` | T0 | ✅ done | All — death suppression (graceful skip if no SSDI) |
| `enrichment_orchestrator.py` | meta | ✅ done | Drives cost-discipline T0→T1→T2→T3 |
| `email_finder.py` | T2 | ⬜ planned | All — Hunter.io connector |
| `phone_appender.py` | T2 | ⬜ planned | All — BatchSkipTracing connector |
| `lexis_appender.py` | T3 | ⬜ planned | residential, commercial — age/HHI |
| `apollo_appender.py` | T3 | ⬜ planned | All — firmographic + email |

**T0 layer convergence:** 17/17 modules built, smoke-tested, integrated. End-to-end run on synthetic 8-segment data: 488 rows × 12 cols → 488 rows × 102 cols, **97.8% feature fill rate** at $0 cost.

**T2/T3 paid layers:** Stubs registered in orchestrator with budget caps; activate once vendor accounts exist.

---

## 8 · What this architecture explicitly does not do

- **Doesn't replace ESI compliance review of enrichment data sourcing.** Every paid vendor TOS must be checked before the first record runs through.
- **Doesn't auto-buy paid enrichment.** Every T2/T3 module should require an explicit `--budget-usd` flag and stop when hit. No surprise bills.
- **Doesn't dedupe across enrichment vendors.** If the same record gets phone-appended by both Batch and Apollo, it's billed by both. Wire dedup at the orchestrator level.
- **Doesn't handle DNC scrub.** That's a separate compliance step, not enrichment. See `COMPLIANCE_CHECKLIST.md` §4.
