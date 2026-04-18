"""
Firm Movability Classifier (T0)
================================
Predicts the probability that an experienced advisor will move firms.
Different firms have wildly different retention. Captive insurance firms
(NWM, MassMutual, NYL) lose 60-70% of new agents in 4 years but their
top producers are extremely sticky (vested commissions, training-debt
repayment, NDA-backed non-solicitations).

Wirehouses retain 80%+ of >$1M GDC producers but are losing share to
indies — current movability is HIGH for mid-tier wirehouse advisors.

True independents are already "moved" — they're not the recruiting
target unless WealthBridge offers something materially better.

Output:
  firm_movability_score (0-1)
  firm_movability_confidence
"""
from __future__ import annotations

from typing import Tuple
import re
import pandas as pd

# Firm classification → base movability + tenure modifier
FIRM_MOVABILITY = {
    # Captive insurance: low movability except for mid-career producers
    "captive_insurance_top": {
        "patterns": [r"NORTHWESTERN MUTUAL", r"NEW YORK LIFE", r"MASS\s?MUTUAL",
                     r"GUARDIAN LIFE", r"PRUDENTIAL", r"PENN MUTUAL"],
        "base": 0.45,
        "notes": "captive insurance — NDAs/vesting create friction, but mid-tier producers do leave",
    },
    # Edward Jones — distinct: heavy training investment, geographic constraints
    "edward_jones": {
        "patterns": [r"EDWARD JONES"],
        "base": 0.55,
        "notes": "EJ — consistent recruiter target, partnership track creates inflection points",
    },
    # State Farm / Allstate — captive but P&C-tilted, moving to financial advisor model
    "captive_pc": {
        "patterns": [r"STATE FARM", r"ALLSTATE", r"FARMERS INS", r"AMERICAN FAMILY"],
        "base": 0.65,
        "notes": "captive P&C — financial services side underdeveloped, primed to move",
    },
    # Wirehouses — current high-movability (industry-wide IBD migration)
    "wirehouse": {
        "patterns": [r"MORGAN STANLEY", r"MERRILL LYNCH", r"WELLS FARGO ADVISORS",
                     r"\bUBS\b"],
        "base": 0.70,
        "notes": "wirehouse — active migration to indep, especially at $300K-1M GDC tier",
    },
    # IBD — already on the indep side, lower marginal movability
    "ibd_large": {
        "patterns": [r"\bLPL\b", r"RAYMOND JAMES", r"AMERIPRISE", r"CETERA",
                     r"COMMONWEALTH", r"CAMBRIDGE"],
        "base": 0.30,
        "notes": "large IBD — already independent, would only switch for compensation upgrade",
    },
    # True indep / RIA — almost never move except to retire
    "independent": {
        "patterns": [r"INDEPENDENT", r"REGISTERED INVESTMENT ADVIS", r"\bRIA\b",
                     r"WEALTH MANAGEMENT", r"CAPITAL MGMT", r"FIDUCIARY"],
        "base": 0.20,
        "notes": "true indep — typically only moves for acquisition or retirement",
    },
}


def _tenure_movability_modifier(yrs: float | None) -> float:
    """Movability peaks at 5-12 years (book is built but ceiling visible)."""
    if yrs is None or pd.isna(yrs):
        return 1.0
    yrs = float(yrs)
    if yrs < 2:    return 0.5   # too new, won't move
    if yrs < 5:    return 0.95  # building book, some risk
    if yrs < 12:   return 1.30  # peak movability
    if yrs < 20:   return 1.10  # established, but can still move
    if yrs < 30:   return 0.75  # late career, less likely
    return 0.45                 # near retirement


def classify_one(row: pd.Series) -> Tuple[float, float, str]:
    firm = str(row.get("current_firm", "") or "").upper()
    if not firm:
        return (0.50, 0.30, "unknown_firm")  # neutral default
    yrs = row.get("years_in_industry")
    base, tier_name = None, None
    for name, cfg in FIRM_MOVABILITY.items():
        for pat in cfg["patterns"]:
            if re.search(pat, firm):
                base = cfg["base"]
                tier_name = name
                break
        if base is not None:
            break
    if base is None:
        # Unrecognized firm name → assume IBD-like
        base = 0.40
        tier_name = "ibd_default"
        confidence = 0.40
    else:
        confidence = 0.80
    score = min(1.0, base * _tenure_movability_modifier(yrs))
    return (round(score, 3), confidence, tier_name)


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    if "segment" in df.columns:
        mask = df["segment"] == "experienced_pro"
    else:
        mask = pd.Series(True, index=df.index)
    if not mask.any():
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "no experienced_pro rows"}
    results = df.loc[mask].apply(classify_one, axis=1)
    df.loc[mask, "firm_movability_score"] = results.map(lambda t: t[0])
    df.loc[mask, "firm_movability_confidence"] = results.map(lambda t: t[1])
    df.loc[mask, "firm_movability_tier"] = results.map(lambda t: t[2])
    df.loc[mask, "firm_movability_imputed"] = True
    return df, {
        "n_input": len(df), "n_imputed": int(mask.sum()), "cost_usd": 0.0,
        "features_added": ["firm_movability_score", "firm_movability_confidence",
                            "firm_movability_tier", "firm_movability_imputed"],
        "tier_distribution": df.loc[mask, "firm_movability_tier"].value_counts().to_dict(),
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        {"segment":"experienced_pro", "current_firm":"Northwestern Mutual",   "years_in_industry":3},
        {"segment":"experienced_pro", "current_firm":"Northwestern Mutual",   "years_in_industry":8},
        {"segment":"experienced_pro", "current_firm":"Edward Jones",          "years_in_industry":12},
        {"segment":"experienced_pro", "current_firm":"Morgan Stanley",        "years_in_industry":10},
        {"segment":"experienced_pro", "current_firm":"State Farm",            "years_in_industry":5},
        {"segment":"experienced_pro", "current_firm":"LPL Financial",         "years_in_industry":15},
        {"segment":"experienced_pro", "current_firm":"True Wealth RIA",       "years_in_industry":20},
        {"segment":"experienced_pro", "current_firm":"",                       "years_in_industry":None},
    ])
    out, stats = enrich(samples)
    print(out[["current_firm","years_in_industry","firm_movability_score","firm_movability_tier"]].to_string(index=False))
    print("\nStats:", stats)
