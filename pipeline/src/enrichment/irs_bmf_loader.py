"""
IRS Business Master File (BMF) Loader + Nonprofit Signal Inferrer (T0)
========================================================================
The IRS publishes BMF extracts for all 501(c) organizations — totally free,
updated monthly, at:

  https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf

State-by-state files (eo1.csv, eo2.csv, eo3.csv, eo4.csv).

Schema includes: EIN, NAME, ICO, STREET, CITY, STATE, ZIP, GROUP, SUBSECTION,
AFFILIATION, CLASSIFICATION, RULING, DEDUCTIBILITY, FOUNDATION, ACTIVITY,
ORGANIZATION, STATUS, TAX_PERIOD, ASSET_CD, INCOME_CD, FILING_REQ_CD,
PF_FILING_REQ_CD, ACCT_PD, ASSET_AMT, INCOME_AMT, REVENUE_AMT, NTEE_CD

NTEE_CD = National Taxonomy of Exempt Entities — gold for mission_fit.

This module:
  1. Loads a downloaded BMF CSV
  2. Filters to AZ + NM + WA (or whatever states you target)
  3. Normalizes columns to v6 schema
  4. Outputs WB_nonprofit_leader_irs_bmf_<state>.csv

Plus a separate `enrich()` function that imputes mission_fit_score,
audience_reach, and engagement_history for nonprofit_leader segment.

Usage:
  python irs_bmf_loader.py --download   # prints download URL
  python irs_bmf_loader.py --input ./eo_az.csv --out ./data/raw

  from src.enrichment.irs_bmf_loader import enrich
  df, stats = enrich(df)
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Tuple

import pandas as pd

try:
    from src.enrichment._helpers import first_valid_numeric
except ImportError:
    from _helpers import first_valid_numeric


# NTEE major codes → wealth-fit + mission-affinity prior
# Source: IRS NTEE classification system + WB strategic priors
# Higher mission_fit_score = more aligned with WB workshop content
NTEE_MISSION_FIT = {
    # A — Arts, Culture, Humanities
    "A": (0.55, "Arts/Culture"),
    # B — Education
    "B": (0.85, "Education"),       # high fit — financial education workshops
    # C — Environmental
    "C": (0.45, "Environmental"),
    # D — Animal-Related
    "D": (0.40, "Animal-Related"),
    # E — Health
    "E": (0.70, "Health"),
    # F — Mental Health
    "F": (0.60, "Mental Health"),
    # G — Disease-Specific
    "G": (0.55, "Disease-Specific"),
    # H — Medical Research
    "H": (0.50, "Medical Research"),
    # I — Crime & Legal
    "I": (0.60, "Crime/Legal"),
    # J — Employment
    "J": (0.85, "Employment"),      # high fit — career workshops
    # K — Food/Agriculture
    "K": (0.50, "Food/Agriculture"),
    # L — Housing
    "L": (0.75, "Housing"),
    # M — Public Safety
    "M": (0.65, "Public Safety"),
    # N — Recreation/Sports
    "N": (0.45, "Recreation"),
    # O — Youth Development
    "O": (0.85, "Youth Development"),
    # P — Human Services
    "P": (0.80, "Human Services"),
    # Q — International
    "Q": (0.40, "International"),
    # R — Civil Rights
    "R": (0.55, "Civil Rights"),
    # S — Community Improvement
    "S": (0.85, "Community Improvement"),
    # T — Philanthropy/Voluntarism
    "T": (0.90, "Philanthropy"),    # peer organizations — partnership potential
    # U — Science/Tech Research
    "U": (0.45, "Science/Tech"),
    # V — Social Science
    "V": (0.45, "Social Science"),
    # W — Public/Societal Benefit
    "W": (0.70, "Public Benefit"),
    # X — Religion
    "X": (0.85, "Religion"),        # high fit — faith communities
    # Y — Mutual Benefit
    "Y": (0.80, "Mutual Benefit"),  # business associations, fraternals
    # Z — Unknown
    "Z": (0.50, "Unknown"),
}

# IRS income code → revenue band (from BMF documentation)
# 1 = $0, 2 = $1-9.999, 3 = $10K-24.999K, ..., 9 = $50M+
INCOME_CODE_BANDS = {
    1: 0, 2: 5_000, 3: 17_500, 4: 75_000, 5: 175_000,
    6: 350_000, 7: 750_000, 8: 2_500_000, 9: 50_000_000,
}


def parse_ntee(ntee_code: str) -> tuple[float, str]:
    """Returns (mission_fit_score, mission_label)."""
    if not ntee_code or pd.isna(ntee_code):
        return (0.50, "Unknown")
    code = str(ntee_code).strip().upper()
    if not code:
        return (0.50, "Unknown")
    major = code[0]
    fit, label = NTEE_MISSION_FIT.get(major, (0.50, "Unknown"))
    return (fit, label)


def revenue_from_income_code(code) -> float | None:
    if code is None or pd.isna(code):
        return None
    try:
        c = int(code)
        return INCOME_CODE_BANDS.get(c)
    except (ValueError, TypeError):
        return None


# === Loader (BMF file → WB CSV) ===

def load_bmf(input_csv: Path) -> pd.DataFrame:
    """Load IRS BMF extract, normalize column names."""
    df = pd.read_csv(input_csv, low_memory=False, encoding="latin-1")
    df.columns = [c.strip().upper().replace(" ", "_") for c in df.columns]
    return df


def normalize_bmf(df: pd.DataFrame) -> pd.DataFrame:
    """Map BMF columns to WB v6 schema for nonprofit_leader segment."""
    out = pd.DataFrame()
    out["owner_name"] = df.get("NAME", "")
    out["ico"]        = df.get("ICO", "")  # In Care Of — often the leader's name
    out["ein"]        = df.get("EIN", "")
    out["property_address"] = df.get("STREET", "")
    out["city"]       = df.get("CITY", "")
    out["state"]      = df.get("STATE", "")
    out["zip"]        = df.get("ZIP", "")
    out["ntee_cd"]    = df.get("NTEE_CD", "")
    out["subsection"] = df.get("SUBSECTION", "")  # 3 = 501(c)(3), etc.
    out["foundation"] = df.get("FOUNDATION", "")
    out["asset_amt"]  = pd.to_numeric(df.get("ASSET_AMT"), errors="coerce")
    out["income_amt"] = pd.to_numeric(df.get("INCOME_AMT"), errors="coerce")
    out["revenue_amt"] = pd.to_numeric(df.get("REVENUE_AMT"), errors="coerce")
    out["income_cd"]  = df.get("INCOME_CD")
    out["asset_cd"]   = df.get("ASSET_CD")
    out["ruling_date"] = df.get("RULING")  # ruling date, used for org age
    out["segment"]    = "nonprofit_leader"
    return out


def split_by_state(df: pd.DataFrame, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    for state, sub in df.groupby("state"):
        if not state:
            continue
        path = out_dir / f"WB_nonprofit_leader_irs_bmf_{state}.csv"
        sub.to_csv(path, index=False)
        print(f"  [bmf] wrote {len(sub):,} → {path.name}")


# === Enricher ===

def impute_one(row: pd.Series) -> dict:
    # Mission fit from NTEE
    fit, label = parse_ntee(row.get("ntee_cd"))
    # Revenue: prefer revenue_amt, then income_amt, then income_cd band
    rev = first_valid_numeric(
        row.get("revenue_amt"), row.get("annual_revenue"), row.get("income_amt")
    )
    if rev is None:
        rev = revenue_from_income_code(row.get("income_cd"))
    rev_imputed = rev is None or first_valid_numeric(
        row.get("revenue_amt"), row.get("annual_revenue")) is None
    if rev is None:
        rev = 100_000  # last-resort default for small AZ nonprofit
    # Audience reach: imputed from revenue (rough heuristic — $50/member median dues)
    reach = first_valid_numeric(row.get("member_count"), row.get("audience_size"))
    if reach is None:
        # Estimate: revenue / (avg dues + program revenue per beneficiary)
        # Religious (X): smaller ratio (donations not dues); Education (B): larger
        major = str(row.get("ntee_cd") or "")[:1].upper() if row.get("ntee_cd") else ""
        per_person = {"X": 200, "B": 800, "T": 5_000}.get(major, 500)
        reach = max(20, min(50_000, rev / per_person))
        reach_imputed = True
    else:
        reach_imputed = False
    # Engagement history — defaults to low (no prior interaction)
    engagement = first_valid_numeric(row.get("prior_engagement"), row.get("past_engagement_score"))
    if engagement is None:
        engagement = 0.30  # neutral-low default
        engagement_imputed = True
    else:
        engagement_imputed = False
    return {
        "mission_fit_score":        fit,
        "mission_label":            label,
        "mission_fit_confidence":   0.85 if row.get("ntee_cd") else 0.30,
        "estimated_revenue_usd":    round(rev, -3) if rev else 0,
        "revenue_imputed":          rev_imputed,
        "audience_reach":           int(reach) if reach else 0,
        "audience_reach_imputed":   reach_imputed,
        "engagement_history_score": engagement,
        "engagement_imputed":       engagement_imputed,
    }


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    if "segment" in df.columns:
        mask = df["segment"] == "nonprofit_leader"
    else:
        mask = pd.Series(True, index=df.index)
    if not mask.any():
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "no nonprofit_leader rows"}
    results = df.loc[mask].apply(impute_one, axis=1, result_type="expand")
    for col in results.columns:
        df.loc[mask, col] = results[col].values
    # Decile rank for org_size + audience_reach
    if "estimated_revenue_usd" in df.columns:
        sub = df.loc[mask, "estimated_revenue_usd"]
        df.loc[mask, "org_size_decile"] = sub.rank(pct=True, na_option="keep").fillna(0.5)
    if "audience_reach" in df.columns:
        sub = df.loc[mask, "audience_reach"]
        df.loc[mask, "audience_reach_decile"] = sub.rank(pct=True, na_option="keep").fillna(0.5)
    return df, {
        "n_input": len(df), "n_imputed": int(mask.sum()), "cost_usd": 0.0,
        "features_added": list(results.columns) + ["org_size_decile", "audience_reach_decile",
                                                    "nonprofit_signals_imputed"],
        "mission_distribution": df.loc[mask, "mission_label"].value_counts().to_dict(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true")
    ap.add_argument("--input", type=Path)
    ap.add_argument("--out", type=Path, default=Path("./data/raw"))
    args = ap.parse_args()
    if args.download:
        print("IRS BMF Download (free, monthly):")
        print("  https://www.irs.gov/charities-non-profits/")
        print("  exempt-organizations-business-master-file-extract-eo-bmf")
        print("State files: eo1.csv (AL-IA), eo2.csv (KS-MO), eo3.csv (MT-OH), eo4.csv (OK-WY)")
        print("AZ + NM are in eo3.csv. WA is in eo4.csv.")
        return
    if not args.input or not args.input.exists():
        print(f"[bmf] input file required: {args.input}", file=sys.stderr)
        sys.exit(1)
    raw = load_bmf(args.input)
    print(f"[bmf] loaded {len(raw):,} rows")
    df = normalize_bmf(raw)
    split_by_state(df, args.out)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        main()
    else:
        # Self-test on enrich()
        samples = pd.DataFrame([
            {"segment":"nonprofit_leader", "owner_name":"Tucson Education Foundation",  "ntee_cd":"B12", "revenue_amt":850_000},
            {"segment":"nonprofit_leader", "owner_name":"Sahuarita Community Church",   "ntee_cd":"X20", "revenue_amt":350_000},
            {"segment":"nonprofit_leader", "owner_name":"Pima Veterans Outreach",       "ntee_cd":"P82", "income_cd":5},
            {"segment":"nonprofit_leader", "owner_name":"Mission Family Services",      "ntee_cd":"P50", "income_cd":6, "member_count":1200},
            {"segment":"nonprofit_leader", "owner_name":"Nogales Civic League",          "ntee_cd":"S20"},  # no revenue
        ])
        out, stats = enrich(samples)
        print(out[["owner_name","ntee_cd","mission_label","mission_fit_score",
                    "estimated_revenue_usd","audience_reach"]].to_string(index=False))
        print("\nStats:", stats)
