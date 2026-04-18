"""
Practice Area Inferrer (T0)
============================
Infers practice area for cpa_attorney_partner segment when not directly
captured. Drives wealth_practice_fit_score in scoring (estate, tax, business
succession = high fit; litigation, criminal, family = low fit).

Also imputes firm headcount when missing (practice_size_decile feature).

Sources used (all in firm_name or other text):
  - Firm name keywords ("Estate", "Tax", "Trust", "Business", etc.)
  - Practice area free-text field
  - Bar admission specialty (when AZ State Bar data is appended)

Output:
  practice_area_inferred (e.g., "Estate Planning", "Tax", "Litigation")
  wealth_practice_fit_score (0-1, 1 = high fit for WB partnership)
  firm_headcount_imputed
  practice_area_imputed
"""
from __future__ import annotations

import re
from typing import Tuple
import pandas as pd

try:
    from src.enrichment._helpers import first_valid_numeric
except ImportError:
    from _helpers import first_valid_numeric

# Pattern → (canonical area, wealth_fit, confidence)
PRACTICE_AREAS = [
    # High wealth-fit
    (r"\b(ESTATE|TRUST|PROBATE|WEALTH TRANSFER|FIDUCIARY|LEGACY)\b",
     ("Estate Planning", 0.95, 0.88)),
    (r"\b(TAX|TAXATION|IRS|AUDIT DEFENSE)\b",
     ("Tax", 0.90, 0.85)),
    (r"\b(BUSINESS SUCCESSION|SUCCESSION PLANNING|BUY SELL|EXIT PLANNING)\b",
     ("Business Succession", 0.95, 0.92)),
    (r"\b(MERGERS|ACQUISITIONS|M&A|CORPORATE FINANCE|PRIVATE EQUITY)\b",
     ("M&A / Corporate", 0.85, 0.85)),
    (r"\b(BUSINESS LAW|CORPORATE LAW|COMMERCIAL LAW|ENTITY FORMATION)\b",
     ("Business Law", 0.75, 0.80)),
    # Medium wealth-fit
    (r"\b(REAL ESTATE|RE LAW|LAND USE|PROPERTY LAW)\b",
     ("Real Estate Law", 0.65, 0.85)),
    (r"\b(EMPLOYMENT|LABOR|ERISA|EXEC COMP)\b",
     ("Employment / ERISA", 0.55, 0.80)),
    (r"\b(INTELLECTUAL PROPERTY|\bIP\b|PATENTS|TRADEMARKS)\b",
     ("Intellectual Property", 0.50, 0.80)),
    (r"\b(BANKRUPTCY|RESTRUCTURING|INSOLVENCY)\b",
     ("Bankruptcy", 0.45, 0.85)),
    # Low wealth-fit (still partner-able for niches but not core)
    (r"\b(LITIGATION|TRIAL|LITIGATOR|PLAINTIFF|DEFENSE)\b",
     ("Litigation", 0.30, 0.80)),
    (r"\b(FAMILY LAW|DIVORCE|CUSTODY|MATRIMONIAL)\b",
     ("Family Law", 0.30, 0.85)),
    (r"\b(CRIMINAL|CRIMINAL DEFENSE|DUI|DWI)\b",
     ("Criminal", 0.10, 0.90)),
    (r"\b(IMMIGRATION|VISA|GREEN CARD)\b",
     ("Immigration", 0.20, 0.85)),
    (r"\b(PERSONAL INJURY|\bPI\b|TORT|MALPRACTICE)\b",
     ("Personal Injury", 0.25, 0.85)),
    # Generic fallbacks
    (r"\b(GENERAL PRACTICE|GENERAL COUNSEL|FULL SERVICE)\b",
     ("General Practice", 0.50, 0.50)),
    (r"\b(CPA|ACCOUNTING|ACCOUNTANT|BOOKKEEP)\b",
     ("Accounting (general)", 0.65, 0.70)),
]

COMPILED = [(re.compile(p, re.IGNORECASE), val) for p, val in PRACTICE_AREAS]

# Practice area → typical solo/small firm headcount priors
HEADCOUNT_PRIORS = {
    "Estate Planning":    7,
    "Tax":                6,
    "Business Succession":8,
    "M&A / Corporate":    18,
    "Business Law":       12,
    "Real Estate Law":    8,
    "Employment / ERISA": 10,
    "Intellectual Property": 14,
    "Bankruptcy":         5,
    "Litigation":         15,
    "Family Law":         4,
    "Criminal":           4,
    "Immigration":        5,
    "Personal Injury":    11,
    "General Practice":   6,
    "Accounting (general)": 8,
}


def infer_one(row: pd.Series) -> dict:
    # Pull text from all candidate fields
    candidates = []
    for col in ["practice_area", "specialty", "firm_name", "owner_name", "description"]:
        v = row.get(col)
        if v and pd.notna(v):
            candidates.append(str(v).upper())
    text = " | ".join(candidates)
    if not text:
        return {
            "practice_area_inferred": "Unknown",
            "wealth_practice_fit_score": 0.50,
            "practice_area_confidence": 0.0,
        }
    matches = [(area, fit, conf) for pat, (area, fit, conf) in COMPILED
               if pat.search(text)]
    if not matches:
        return {
            "practice_area_inferred": "Unknown",
            "wealth_practice_fit_score": 0.50,
            "practice_area_confidence": 0.0,
        }
    # If multiple matches, take the highest-confidence one
    matches.sort(key=lambda t: t[2], reverse=True)
    area, fit, conf = matches[0]
    return {
        "practice_area_inferred": area,
        "wealth_practice_fit_score": fit,
        "practice_area_confidence": conf,
    }


def impute_headcount(row: pd.Series) -> tuple[int, bool, float]:
    obs = first_valid_numeric(row.get("firm_headcount"), row.get("employee_count"))
    if obs and obs > 0:
        return int(obs), False, 1.0
    area = row.get("practice_area_inferred", "General Practice")
    return HEADCOUNT_PRIORS.get(area, 8), True, 0.45


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    if "segment" in df.columns:
        mask = df["segment"] == "cpa_attorney_partner"
    else:
        mask = pd.Series(True, index=df.index)
    if not mask.any():
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "no cpa_attorney_partner rows"}
    # Practice area inference
    pa = df.loc[mask].apply(infer_one, axis=1, result_type="expand")
    for col in pa.columns:
        df.loc[mask, col] = pa[col].values
    # Headcount imputation (depends on practice_area_inferred)
    hc = df.loc[mask].apply(impute_headcount, axis=1)
    df.loc[mask, "firm_headcount"] = hc.map(lambda t: t[0])
    df.loc[mask, "firm_headcount_imputed"] = hc.map(lambda t: t[1])
    df.loc[mask, "firm_headcount_confidence"] = hc.map(lambda t: t[2])
    return df, {
        "n_input": len(df), "n_imputed": int(mask.sum()), "cost_usd": 0.0,
        "features_added": ["practice_area_inferred", "wealth_practice_fit_score",
                            "practice_area_confidence", "firm_headcount",
                            "firm_headcount_imputed", "firm_headcount_confidence"],
        "area_distribution": pa["practice_area_inferred"].value_counts().to_dict(),
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        {"segment":"cpa_attorney_partner", "firm_name":"Smith Estate Planning Law",   "practice_area":""},
        {"segment":"cpa_attorney_partner", "firm_name":"Jones, CPA — Tax & Audit",     "practice_area":""},
        {"segment":"cpa_attorney_partner", "firm_name":"Tucson Trial Attorneys",       "practice_area":"Litigation, Trial, Plaintiff"},
        {"segment":"cpa_attorney_partner", "firm_name":"Sonoran Family Law Group",     "practice_area":""},
        {"segment":"cpa_attorney_partner", "firm_name":"Saguaro Business Law",         "practice_area":"M&A, Business Succession"},
        {"segment":"cpa_attorney_partner", "firm_name":"Border Immigration Center",    "practice_area":""},
    ])
    out, stats = enrich(samples)
    print(out[["firm_name","practice_area_inferred","wealth_practice_fit_score","firm_headcount"]].to_string(index=False))
    print("\nStats:", stats)
