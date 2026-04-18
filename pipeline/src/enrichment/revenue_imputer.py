"""
Revenue + Employee Count Imputer (T0)
======================================
Imputes annual revenue and employee count for commercial entities when
not directly available.

Used by:
  - commercial_client (revenue_band_decile)
  - hr_director (company_size_decile)
  - cpa_attorney_partner (practice_size_decile)

Approach: NAICS-conditional revenue-per-employee + entity-age scaling.
Source priors: IRS SOI Tax Stats (gross receipts by NAICS), BLS QCEW
(employment by sector), Census County Business Patterns. Synthesized
to per-NAICS medians.

Output columns:
  estimated_revenue_usd
  estimated_employee_count
  revenue_imputed (bool)
  employee_count_imputed (bool)
  revenue_confidence
"""
from __future__ import annotations

from typing import Tuple
import pandas as pd
import numpy as np

try:
    from src.enrichment._helpers import first_valid_numeric
except ImportError:
    from _helpers import first_valid_numeric

# NAICS 2-digit → (median revenue per employee USD, median employee count for "small biz")
# Synthesized from IRS SOI + BLS QCEW. Conservative, AZ-tilted where possible.
NAICS_PRIORS = {
    "11": (180_000,  6),   # Agriculture/Ranching — labor-light, capital-heavy
    "21": (520_000, 10),   # Mining — high capex/employee
    "22": (480_000, 25),   # Utilities — high revenue, mid employment
    "23": (165_000, 12),   # Construction — labor-heavy
    "31": (220_000, 28),   # Manufacturing — varies wildly
    "42": (340_000, 14),   # Wholesale — inventory turn drives revenue
    "44": (140_000, 11),   # Retail — labor-heavy, lower margin
    "48": (180_000, 18),   # Transportation/Warehousing
    "51": (310_000, 14),   # Information/Tech — high revenue/employee
    "52": (380_000, 12),   # Finance/Insurance — fee-based, leveraged
    "53": (210_000, 8),    # Real Estate — small teams, large transactions
    "5411": (220_000, 8),  # Legal — billable hours model
    "5412": (190_000, 7),  # Accounting — similar to legal
    "5413": (175_000, 14), # Architecture/Engineering
    "5416": (185_000, 9),  # Mgmt Consulting
    "5418": (155_000, 12), # Marketing/Advertising
    "56":  (95_000, 16),   # Admin/Support — labor-heavy, low margin
    "61":  (90_000, 28),   # Education — many staff, modest revenue/head
    "62":  (190_000, 18),  # Healthcare — mid revenue, high employee
    "71":  (105_000, 22),  # Entertainment/Recreation
    "72":  (75_000, 24),   # Hospitality/Food — labor-heavy
    "81":  (110_000, 8),   # Other Services
    "92":  (95_000, 50),   # Public admin
    "8131":(85_000, 6),    # Religious — low revenue, mostly volunteer
    "8134":(95_000, 9),    # Civic/Social
}
DEFAULT_REV_PER_EMP = 175_000
DEFAULT_EMP_COUNT = 10

# Entity-age scaling: years 0-3 ramp up, 3-15 plateau, 15-30 mature, 30+ slow growth
def age_revenue_multiplier(yrs: float | None) -> float:
    if yrs is None or pd.isna(yrs):
        return 0.85
    yrs = float(yrs)
    if yrs < 1:    return 0.20
    if yrs < 3:    return 0.55
    if yrs < 8:    return 1.00
    if yrs < 15:   return 1.45
    if yrs < 25:   return 1.75
    if yrs < 40:   return 1.65
    return 1.40


def impute_one(row: pd.Series) -> dict:
    naics = str(row.get("naics", "") or row.get("naics_inferred", ""))
    naics2 = naics[:4] if naics.startswith("541") or naics.startswith("813") else naics[:2]
    rev_per_emp, default_emp = NAICS_PRIORS.get(naics2, (DEFAULT_REV_PER_EMP, DEFAULT_EMP_COUNT))
    entity_age = row.get("entity_age_years")
    age_mult = age_revenue_multiplier(entity_age)

    # Employee count imputation
    emp_observed = first_valid_numeric(row.get("employee_count"), row.get("firm_headcount"))
    if emp_observed and emp_observed > 0:
        emp = emp_observed
        emp_imputed = False
        emp_conf = 1.0
    else:
        emp = default_emp * age_mult
        emp_imputed = True
        emp_conf = 0.55 if naics2 in NAICS_PRIORS else 0.30

    # Revenue imputation
    rev_observed = first_valid_numeric(row.get("revenue"), row.get("annual_revenue"),
                                        row.get("estimated_revenue_usd"))
    if rev_observed and rev_observed > 0:
        rev = rev_observed
        rev_imputed = False
        rev_conf = 1.0
    else:
        # Use property value as a rough proxy if available (≈ 1.5–2× annual revenue for owner-occupied biz RE)
        prop_val = first_valid_numeric(row.get("market_value"), row.get("assessed_value"))
        if prop_val and prop_val > 0:
            rev = prop_val * 0.6  # rough heuristic
            rev_conf = 0.50
        else:
            rev = emp * rev_per_emp
            rev_conf = 0.55 if naics2 in NAICS_PRIORS else 0.30
        rev_imputed = True

    return {
        "estimated_revenue_usd": round(rev, -3),
        "estimated_employee_count": round(emp, 0),
        "revenue_imputed": rev_imputed,
        "employee_count_imputed": emp_imputed,
        "revenue_confidence": rev_conf,
    }


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    # Apply to all rows in commercial-like segments
    target_segments = {"commercial_client", "cpa_attorney_partner", "hr_director"}
    if "segment" in df.columns:
        mask = df["segment"].isin(target_segments)
    else:
        mask = pd.Series(True, index=df.index)
    if not mask.any():
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "no commercial-like rows"}
    results = df.loc[mask].apply(impute_one, axis=1, result_type="expand")
    for col in results.columns:
        df.loc[mask, col] = results[col].values
    n_rev_imputed = int(df.loc[mask, "revenue_imputed"].sum()) if "revenue_imputed" in df.columns else 0
    return df, {
        "n_input": len(df), "n_imputed": int(mask.sum()), "cost_usd": 0.0,
        "n_revenue_imputed": n_rev_imputed,
        "features_added": ["estimated_revenue_usd", "estimated_employee_count",
                            "revenue_imputed", "employee_count_imputed", "revenue_confidence"],
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        {"segment": "commercial_client", "naics_inferred": "23",   "entity_age_years": 12, "market_value": 850_000},
        {"segment": "commercial_client", "naics_inferred": "5411", "entity_age_years": 18, "employee_count": 12},
        {"segment": "commercial_client", "naics_inferred": "62",   "entity_age_years": 8},
        {"segment": "hr_director",       "naics_inferred": "31",   "entity_age_years": 25, "employee_count": 240},
        {"segment": "cpa_attorney_partner", "naics_inferred": "5412", "entity_age_years": 22},
        {"segment": "commercial_client", "naics_inferred": "",     "entity_age_years": 5},
    ])
    out, stats = enrich(samples)
    print(out[["segment", "naics_inferred", "entity_age_years",
               "estimated_revenue_usd", "estimated_employee_count", "revenue_confidence"]].to_string(index=False))
    print("\nStats:", stats)
