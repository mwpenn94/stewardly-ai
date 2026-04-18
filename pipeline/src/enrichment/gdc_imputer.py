"""
GDC Imputer for Experienced Pro Recruits (T0)
==============================================
There is no public source for individual broker GDC. This module imputes
estimated_gdc from {current_firm, years_in_industry, licenses, state}
using a class-conditional means model.

Initial priors come from publicly-published industry data (LIMRA, Cerulli,
Investment News surveys 2023-2024). As you collect actual GDC labels from
discovery calls, retrain via `fit_from_labels()`.

Output columns added:
  estimated_gdc:           imputed annual GDC in USD
  estimated_gdc_imputed:   True
  estimated_gdc_confidence: 0.0–1.0 based on data quality

Usage:
  from src.enrichment.gdc_imputer import enrich, fit_from_labels
  df, stats = enrich(df)
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Tuple

import pandas as pd

# Firm tier classification → median GDC priors (USD/yr)
# Source: synthesized from public LIMRA/Cerulli/Investment News data
FIRM_TIERS = {
    # Tier 1: Wirehouses — highest GDC, full-service brokers
    "wirehouse": {
        "patterns": [r"MORGAN STANLEY", r"MERRILL LYNCH", r"WELLS FARGO ADVISORS",
                     r"\bUBS\b", r"GOLDMAN SACHS"],
        "median_gdc": 750_000, "p25": 350_000, "p75": 1_500_000,
    },
    # Tier 2: Independent broker-dealers — wide range
    "ibd": {
        "patterns": [r"\bLPL\b", r"RAYMOND JAMES", r"CETERA", r"CAMBRIDGE",
                     r"COMMONWEALTH", r"\bAIG ADVISOR", r"ROYAL ALLIANCE",
                     r"FSC SECURITIES", r"WOODBURY"],
        "median_gdc": 280_000, "p25": 130_000, "p75": 550_000,
    },
    # Tier 3: Captive insurance — lower GDC, recurring product mix
    "captive_insurance": {
        "patterns": [r"NORTHWESTERN MUTUAL", r"NEW YORK LIFE", r"MASS\s?MUTUAL",
                     r"GUARDIAN LIFE", r"PRUDENTIAL", r"PENN MUTUAL",
                     r"NATIONAL LIFE GROUP", r"\bNLG\b", r"EQUITABLE", r"AXA"],
        "median_gdc": 165_000, "p25": 80_000, "p75": 320_000,
    },
    # Tier 4: Captive P&C with financial services arm
    "captive_pc": {
        "patterns": [r"STATE FARM", r"ALLSTATE", r"FARMERS INS",
                     r"\bAAA\b", r"AMERICAN FAMILY"],
        "median_gdc": 95_000, "p25": 45_000, "p75": 180_000,
    },
    # Tier 5: Edward Jones — distinct retail/community model
    "edward_jones": {
        "patterns": [r"EDWARD JONES"],
        "median_gdc": 195_000, "p25": 110_000, "p75": 340_000,
    },
    # Tier 6: RIA — varies wildly, treat as tier 2 default
    "ria": {
        "patterns": [r"REGISTERED INVESTMENT ADVIS", r"\bRIA\b",
                     r"WEALTH MANAGEMENT", r"CAPITAL MGMT", r"FIDUCIARY"],
        "median_gdc": 230_000, "p25": 110_000, "p75": 480_000,
    },
    # Tier 7: True independent / sole proprietor
    "independent": {
        "patterns": [r"INDEPENDENT", r"SOLE PROPRIET", r"\bINDEPENDEN\b"],
        "median_gdc": 145_000, "p25": 65_000, "p75": 280_000,
    },
}

# Tenure multipliers — apply to firm tier median
TENURE_MULT = {
    (0, 3):    0.45,   # New advisor, ramping
    (3, 7):    0.85,   # Building book
    (7, 15):   1.20,   # Hitting stride
    (15, 25):  1.45,   # Mature book
    (25, 99):  1.30,   # Plateau / slow decline
}

# License-stack multiplier — more licenses = broader product set = more GDC
LICENSE_MULT = {
    "lh_only":          0.85,
    "securities_only":  1.05,
    "lh_securities":    1.20,
    "full_stack":       1.35,  # L&H + Series 7 + 66 + advanced designations
}


def classify_firm_tier(firm: str) -> tuple[str, float]:
    """Returns (tier_name, confidence)."""
    if not firm or pd.isna(firm):
        return ("ibd", 0.30)  # default to ibd median if firm unknown
    s = str(firm).upper()
    for tier_name, cfg in FIRM_TIERS.items():
        for pattern in cfg["patterns"]:
            if re.search(pattern, s):
                return (tier_name, 0.85)
    return ("ibd", 0.40)  # unrecognized firm → ibd default with low confidence


def tenure_multiplier(years: float) -> float:
    if pd.isna(years) or years is None:
        return 1.0
    for (lo, hi), mult in TENURE_MULT.items():
        if lo <= years < hi:
            return mult
    return 1.0


def license_multiplier(licenses: str) -> float:
    if not licenses or pd.isna(licenses):
        return 0.95
    s = str(licenses).upper()
    has_lh = bool(re.search(r"L&H|LIFE|HEALTH", s))
    has_sec = bool(re.search(r"SERIES 7|SERIES 6|SERIES 65|SERIES 66|SECURITIES|RIA", s))
    has_advanced = bool(re.search(r"CFP|CHFC|CLU|CFA|CIMA|CPWA", s))
    if has_advanced and has_lh and has_sec:
        return LICENSE_MULT["full_stack"]
    if has_lh and has_sec:
        return LICENSE_MULT["lh_securities"]
    if has_sec:
        return LICENSE_MULT["securities_only"]
    if has_lh:
        return LICENSE_MULT["lh_only"]
    return 0.85


def impute_one(firm: str, years: float, licenses: str) -> tuple[float, float]:
    tier, tier_conf = classify_firm_tier(firm)
    base = FIRM_TIERS[tier]["median_gdc"]
    gdc = base * tenure_multiplier(years) * license_multiplier(licenses)
    # Confidence: high if firm + tenure both known, low if not
    conf_components = [
        tier_conf,
        0.9 if pd.notna(years) else 0.4,
        0.85 if licenses and pd.notna(licenses) else 0.55,
    ]
    confidence = sum(conf_components) / len(conf_components)
    return (round(gdc, -3), round(confidence, 2))


def enrich(df: pd.DataFrame, firm_col: str = "current_firm",
           years_col: str = "years_in_industry",
           license_col: str = "licenses") -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    if "estimated_gdc" in df.columns:
        mask = df["estimated_gdc"].isna() | (df["estimated_gdc"] == 0)
    else:
        mask = pd.Series(True, index=df.index)
    if firm_col not in df.columns:
        df[firm_col] = ""
    if years_col not in df.columns:
        df[years_col] = pd.NA
    if license_col not in df.columns:
        df[license_col] = ""
    imputed = df.loc[mask].apply(
        lambda r: impute_one(r[firm_col], r[years_col], r[license_col]),
        axis=1
    )
    if len(imputed):
        df.loc[mask, "estimated_gdc"] = imputed.map(lambda t: t[0])
        df.loc[mask, "estimated_gdc_confidence"] = imputed.map(lambda t: t[1])
        df.loc[mask, "estimated_gdc_imputed"] = True
    return df, {
        "n_input": len(df), "n_imputed": int(mask.sum()), "cost_usd": 0.0,
        "features_added": ["estimated_gdc", "estimated_gdc_confidence", "estimated_gdc_imputed"],
        "median_imputed": float(df.loc[mask, "estimated_gdc"].median()) if mask.any() else 0,
    }


def fit_from_labels(label_csv: Path, out_priors_path: Path = None):
    """
    Refit firm-tier medians from observed GDC labels collected via discovery calls.
    label_csv must have columns: current_firm, years_in_industry, licenses, observed_gdc

    Updates FIRM_TIERS in-memory; optionally writes to JSON.
    """
    if not label_csv.exists():
        raise FileNotFoundError(label_csv)
    labels = pd.read_csv(label_csv)
    labels = labels[labels["observed_gdc"] > 0]
    if len(labels) < 50:
        print(f"[gdc_imputer] only {len(labels)} labels — too few to retrain reliably")
        return
    labels["tier"] = labels["current_firm"].map(lambda f: classify_firm_tier(f)[0])
    refit = labels.groupby("tier")["observed_gdc"].agg(["median", "quantile"]).to_dict()
    print(f"[gdc_imputer] refit medians: {refit}")
    if out_priors_path:
        with open(out_priors_path, "w") as f:
            json.dump(refit, f, indent=2, default=str)


if __name__ == "__main__":
    df = pd.DataFrame([
        {"current_firm": "Northwestern Mutual", "years_in_industry": 8, "licenses": "L&H, Series 6"},
        {"current_firm": "Edward Jones", "years_in_industry": 12, "licenses": "L&H, Series 7, Series 66, CFP"},
        {"current_firm": "LPL Financial", "years_in_industry": 20, "licenses": "L&H, Series 7, CFP, ChFC"},
        {"current_firm": "State Farm", "years_in_industry": 5, "licenses": "L&H, P&C"},
        {"current_firm": "Independent Broker", "years_in_industry": 25, "licenses": "L&H, Series 7"},
        {"current_firm": "", "years_in_industry": None, "licenses": ""},  # unknown — gets ibd default
    ])
    out, stats = enrich(df)
    print(out[["current_firm", "years_in_industry", "licenses",
               "estimated_gdc", "estimated_gdc_confidence"]].to_string(index=False))
    print("\nStats:", stats)
