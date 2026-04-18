"""
Affiliate Signal Inferrer (T0)
================================
For affiliate segment: imputes license_status, client_book_size, and
responsiveness signals when not directly observed.

License status: parsed from license_status free-text or inferred from
employer/role (P&C agency owner → likely P&C; insurance broker → L&H+).

Client book size: imputed from years in role + employer type.

Track fit: defaults to A (non-licensed) when license is unknown,
upgrades to B/C/D as license stack improves.

Output:
  license_status_score (0-1)  per license_status_score in scoring
  license_status_normalized   (canonical: "none", "lh", "pc", "securities", "lh_securities", "full_stack")
  client_book_size_decile     (0-1)
  estimated_client_count
  track_fit_score
  responsiveness_proxy_score
"""
from __future__ import annotations

import re
from typing import Tuple
import pandas as pd

try:
    from src.enrichment._helpers import first_valid_numeric
except ImportError:
    from _helpers import first_valid_numeric


# License taxonomy → normalization
LICENSE_PATTERNS = [
    # Most-comprehensive first
    (r"(L&?H|LIFE).*?(SECURITIES|SERIES\s*[67]|RIA|S6|S7).*?(CFP|CHFC|CLU|CIMA|CFA)", "full_stack",     1.00, 0.92),
    (r"(L&?H|LIFE).*?(SECURITIES|SERIES\s*[67]|RIA|S6|S7)",                            "lh_securities", 0.90, 0.90),
    (r"(SECURITIES|SERIES\s*[67]|RIA|REGISTERED REP)",                                  "securities",    0.75, 0.85),
    (r"(L&?H|LIFE.*?HEALTH)",                                                            "lh",            0.65, 0.85),
    (r"(P&?C|PROPERTY.*?CASUALTY)",                                                     "pc",            0.55, 0.85),
    (r"\b(NONE|UNLICENSED|NO LICENSE)\b",                                               "none",          0.40, 0.95),
]
COMPILED = [(re.compile(p, re.IGNORECASE), val, score, conf) for p, val, score, conf in LICENSE_PATTERNS]

# Employer type → likely license profile (used only when license_status missing)
EMPLOYER_INFERENCE = {
    "p&c_agency": (r"\b(STATE FARM|ALLSTATE|FARMERS|GEICO|PROGRESSIVE|LIBERTY MUTUAL|"
                    r"AAA INSURANCE|INSURANCE AGENCY|P&C AGENCY)\b",                 "pc",            0.60),
    "wirehouse":  (r"\b(MORGAN STANLEY|MERRILL|UBS|WELLS FARGO ADVISORS)\b",         "securities",    0.85),
    "ibd":        (r"\b(\bLPL\b|RAYMOND JAMES|CETERA|CAMBRIDGE|COMMONWEALTH)\b",      "lh_securities", 0.80),
    "captive":    (r"\b(NORTHWESTERN MUTUAL|MASSMUTUAL|NEW YORK LIFE|PRUDENTIAL)\b", "lh_securities", 0.85),
    "realty":     (r"\b(REALTY|REAL ESTATE|REALTORS?|BROKERAGE.*REAL)\b",            "none",          0.60),
    "law":        (r"\b(LAW FIRM|ATTORNEYS?|LEGAL)\b",                                "none",          0.70),
    "cpa":        (r"\b(CPA|ACCOUNTING|TAX SERVICES)\b",                              "none",          0.70),
}
EMPLOYER_COMPILED = {
    name: (re.compile(p, re.IGNORECASE), lic, conf)
    for name, (p, lic, conf) in EMPLOYER_INFERENCE.items()
}


def normalize_license(text: str) -> Tuple[str, float, float]:
    """Returns (normalized, license_score, confidence)."""
    if not text:
        return ("unknown", 0.50, 0.20)
    s = str(text).upper()
    for pat, norm, score, conf in COMPILED:
        if pat.search(s):
            return (norm, score, conf)
    return ("unknown", 0.50, 0.30)


def infer_from_employer(employer: str) -> Tuple[str, float, float] | None:
    if not employer:
        return None
    s = str(employer).upper()
    for name, (pat, lic, conf) in EMPLOYER_COMPILED.items():
        if pat.search(s):
            score_map = {"none": 0.40, "pc": 0.55, "lh": 0.65,
                         "securities": 0.75, "lh_securities": 0.90, "full_stack": 1.00}
            return (lic, score_map[lic], conf)
    return None


# Track preference inference from license stack
TRACK_FROM_LICENSE = {
    "none":          ("A", 0.55),
    "pc":            ("B", 0.65),
    "lh":            ("B", 0.70),
    "securities":    ("C", 0.80),
    "lh_securities": ("D", 0.95),
    "full_stack":    ("D", 1.00),
    "unknown":       ("A", 0.55),
}


def impute_one(row: pd.Series) -> dict:
    # 1. License normalization
    license_text = str(row.get("license_status") or "")
    norm, license_score, license_conf = normalize_license(license_text)
    # 2. If unknown, try employer inference
    if norm == "unknown":
        employer = str(row.get("current_employer") or row.get("employer") or "")
        emp_inf = infer_from_employer(employer)
        if emp_inf:
            norm, license_score, license_conf = emp_inf
    # 3. Client book size — proxy from years × employer type
    client_count_obs = first_valid_numeric(row.get("estimated_client_count"),
                                            row.get("client_count"))
    if client_count_obs and client_count_obs > 0:
        est_clients = client_count_obs
        client_imputed = False
        client_conf = 1.0
    else:
        years = first_valid_numeric(row.get("years_in_practice"), row.get("years_in_industry"),
                                     row.get("years_at_company"), row.get("years_working"))
        if years:
            # Heuristic: 30 active clients/year for licensed pros, 15/yr for non-licensed referrers
            multiplier = 30 if norm in ("lh", "securities", "lh_securities", "full_stack") else 15
            est_clients = min(years * multiplier, 1500)
            client_conf = 0.55
        else:
            est_clients = 50  # neutral default
            client_conf = 0.25
        client_imputed = True
    # 4. Track preference
    track_pref_obs = str(row.get("preferred_track") or "").upper().strip()
    if track_pref_obs in {"A", "B", "C", "D"}:
        track = track_pref_obs
        track_score = {"A": 0.55, "B": 0.70, "C": 0.85, "D": 1.00}[track]
        track_imputed = False
    else:
        track, track_score = TRACK_FROM_LICENSE[norm]
        track_imputed = True
    # 5. Responsiveness proxy — defaults to 0.5 unless engagement data appended
    resp = first_valid_numeric(row.get("response_within_7d"), row.get("response_rate"),
                                row.get("engagement_score"))
    if resp is None:
        resp = 0.5
        resp_imputed = True
    else:
        resp_imputed = False
    return {
        "license_status_normalized": norm,
        "license_status_score":      license_score,
        "license_status_confidence": license_conf,
        "license_status_imputed":    norm != "unknown" and not license_text,
        "estimated_client_count":    est_clients,
        "client_book_size_decile":   None,  # filled below as a rank
        "client_book_imputed":       client_imputed,
        "client_book_confidence":    client_conf,
        "track_fit_score":           track_score,
        "preferred_track_inferred":  track,
        "track_imputed":             track_imputed,
        "responsiveness_proxy_score": resp,
        "responsiveness_imputed":    resp_imputed,
    }


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    if "segment" in df.columns:
        mask = df["segment"] == "affiliate"
    else:
        mask = pd.Series(True, index=df.index)
    if not mask.any():
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "no affiliate rows"}
    results = df.loc[mask].apply(impute_one, axis=1, result_type="expand")
    for col in results.columns:
        df.loc[mask, col] = results[col].values
    # Compute client_book_size_decile within affiliate cohort
    sub_clients = df.loc[mask, "estimated_client_count"]
    df.loc[mask, "client_book_size_decile"] = sub_clients.rank(pct=True, na_option="keep").fillna(0.5)
    return df, {
        "n_input": len(df), "n_imputed": int(mask.sum()), "cost_usd": 0.0,
        "features_added": list(results.columns) + ["affiliate_signals_imputed"],
        "license_distribution": df.loc[mask, "license_status_normalized"].value_counts().to_dict(),
        "track_distribution": df.loc[mask, "preferred_track_inferred"].value_counts().to_dict(),
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        {"segment": "affiliate", "license_status": "L&H, Series 7, CFP", "current_employer": "LPL Financial", "years_in_practice": 10},
        {"segment": "affiliate", "license_status": "P&C",                "current_employer": "State Farm Agency",  "years_in_practice": 8},
        {"segment": "affiliate", "license_status": "",                    "current_employer": "Sahuarita Realty",   "years_in_practice": 5},
        {"segment": "affiliate", "license_status": "",                    "current_employer": "",                    "years_in_practice": None, "preferred_track": "C"},
        {"segment": "affiliate", "license_status": "L&H",                 "current_employer": "Independent Insurance Agency", "years_in_practice": 15, "estimated_client_count": 280},
    ])
    out, stats = enrich(samples)
    print(out[["license_status","license_status_normalized","license_status_score",
                "estimated_client_count","preferred_track_inferred","track_fit_score"]].to_string(index=False))
    print("\nStats:", stats)
