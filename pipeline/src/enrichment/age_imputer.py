"""
Age Imputer (T0)
=================
Imputes age when not directly available. Used by:
  - residential_client (age_fit_score)
  - commercial_client (owner_age_fit_score)
  - new_associate (career_stage_fit)

Cascading priors, in order of confidence:
  1. Direct (age column populated) → use as-is, conf 1.0
  2. Birth year column → calc, conf 1.0
  3. Years in industry/practice + assumed start age 25 → conf 0.75
  4. Ownership length + assumed first-purchase age 32 → conf 0.65 (residential)
  5. Entity-formed year + assumed founder age 35 → conf 0.55 (commercial)
  6. Block-group ACS age median (when geocoded) → conf 0.50
  7. Segment-default median → conf 0.30

The model deliberately under-confident on imputed values so the scorer's
confidence weighting de-rates them appropriately.
"""
from __future__ import annotations

from datetime import datetime
from typing import Tuple

import pandas as pd
import numpy as np

try:
    from src.enrichment._helpers import first_valid_numeric
except ImportError:
    from _helpers import first_valid_numeric


def _first_valid(*vals):
    """Backward-compat alias — use first_valid_numeric directly going forward."""
    return first_valid_numeric(*vals)

# Segment defaults — informed by industry/Census priors
SEGMENT_AGE_MEDIAN = {
    "residential_client":   55,
    "commercial_client":    52,
    "experienced_pro":      48,
    "new_associate":        34,
    "cpa_attorney_partner": 50,
    "affiliate":            46,
    "hr_director":          44,
    "nonprofit_leader":     53,
}
THIS_YEAR = datetime.now().year


def impute_one(row: pd.Series, segment: str | None = None) -> Tuple[float, float]:
    # 1. Direct
    age = _first_valid(row.get("age"), row.get("owner_age"), row.get("principal_age"))
    if age and 18 <= float(age) <= 100:
        return float(age), 1.0
    # 2. Birth year
    by = _first_valid(row.get("birth_year"), row.get("dob_year"))
    if by:
        try:
            return float(THIS_YEAR - int(by)), 1.0
        except (ValueError, TypeError):
            pass
    # 3. Industry tenure → derived age
    yrs = _first_valid(row.get("years_in_industry"), row.get("years_in_practice"),
                       row.get("years_working"), row.get("years_at_company"))
    if yrs:
        try:
            est = 25 + float(yrs)
            return min(est, 78), 0.75
        except (ValueError, TypeError):
            pass
    # 4. Residential: ownership length → derived age
    if segment == "residential_client":
        own = _first_valid(row.get("ownership_length_years"))
        if own:
            try:
                est = 32 + float(own)
                return min(est, 82), 0.65
            except (ValueError, TypeError):
                pass
    # 5. Commercial: entity formed year → founder age
    if segment in ("commercial_client", "cpa_attorney_partner"):
        ea = _first_valid(row.get("entity_age_years"))
        if ea:
            try:
                est = 35 + float(ea)
                return min(est, 80), 0.55
            except (ValueError, TypeError):
                pass
    # 6/7. Default by segment
    return float(SEGMENT_AGE_MEDIAN.get(segment, 50)), 0.30


def enrich(df: pd.DataFrame, segment_col: str = "segment") -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    age_col = "owner_age"  # canonical column name regardless of input
    # Always ensure the column exists — without this, the .isna() mask below
    # would skip the entire segment when input has no age column at all.
    if age_col not in df.columns:
        df[age_col] = pd.NA
    # Identify rows needing imputation (NaN OR out-of-bounds)
    coerced = pd.to_numeric(df[age_col], errors="coerce")
    needs = coerced.isna() | ~coerced.between(18, 100)
    n_needed = int(needs.sum())
    if n_needed == 0:
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "all ages observed"}
    # Vectorized: apply per row (pandas apply is fine for <1M rows)
    seg_series = df.get(segment_col, pd.Series([None] * len(df), index=df.index))
    results = df.loc[needs].apply(
        lambda r: impute_one(r, seg_series.get(r.name)), axis=1
    )
    df.loc[needs, age_col] = results.map(lambda t: t[0])
    df.loc[needs, "age_confidence"] = results.map(lambda t: t[1])
    df.loc[needs, "age_imputed"] = True
    return df, {
        "n_input": len(df), "n_imputed": n_needed, "cost_usd": 0.0,
        "features_added": [age_col, "age_confidence", "age_imputed"],
        "median_imputed_age": float(df.loc[needs, age_col].median()),
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        {"segment": "residential_client", "owner_age": 47, "ownership_length_years": 12},  # observed
        {"segment": "residential_client", "owner_age": None, "ownership_length_years": 18},  # impute via ownership
        {"segment": "commercial_client",  "owner_age": None, "entity_age_years": 22},        # impute via entity
        {"segment": "experienced_pro",    "owner_age": None, "years_in_industry": 15},       # impute via tenure
        {"segment": "new_associate",      "owner_age": None, "years_working": 8},            # impute via tenure
        {"segment": "nonprofit_leader",   "owner_age": None, "years_in_industry": None},     # default
    ])
    out, stats = enrich(samples)
    print(out[["segment", "owner_age", "age_confidence"]].to_string(index=False))
    print("\nStats:", stats)
