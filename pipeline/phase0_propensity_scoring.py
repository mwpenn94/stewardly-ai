"""
WealthBridge Phase 0 Propensity Scoring
========================================

Geo-aware, segment-aware, rules-based prospect scoring.

Inputs expected (in INPUT_DIR, any combination):
  - WB_Residential_<County>_County.csv
  - WB_Commercial_<County>_County.csv
  - WB_Residential_<County>_County_<State>.csv  (for NM, WA expansion)
  - WB_Commercial_<County>_County_<State>.csv

Outputs (in OUTPUT_DIR):
  - scored_residential.csv       — all residential, scored
  - scored_commercial.csv        — all commercial, scored
  - ghl_import_top_decile.csv    — top decile combined, ready for GHL
  - scoring_diagnostics.json     — distribution + calibration stats

Phases:
  0. Load + standardize schemas across county/state files
  1. Resolve "Unknown" county via address geocoding (stub — plug in your geocoder)
  2. Dedupe by owner + aggregate multi-property counts (commercial signal)
  3. Append geo tier
  4. Compute segment-specific propensity scores
  5. Decile-rank within each (segment × geo tier)
  6. Emit GHL-ready top-decile file with custom-field columns

Run:
  python phase0_propensity_scoring.py --input ./data/raw --output ./data/scored

Dependencies:
  pandas, numpy
  (optional for geocoding: requests + US Census geocoder — free, no API key)
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# ============================================================================
# CONFIGURATION — tune these as data accumulates
# ============================================================================

GEO_TIERS = {
    "tier_1_home_az": {
        "states": {"AZ"},
        "counties": {"PIMA", "MOHAVE", "SANTA CRUZ"},
        "priority_multiplier": 1.00,
        "description": "Primary AZ Region 1 territory",
    },
    "tier_2_az_adjacent": {
        "states": {"AZ"},
        "counties": {"COCHISE", "MARICOPA", "YUMA", "PINAL", "GRAHAM"},
        "priority_multiplier": 0.85,
        "description": "AZ expansion — adjacent counties",
    },
    "tier_3_nm_wa_licensed": {
        "states": {"NM", "WA"},
        "counties": None,  # None = all counties in state
        "priority_multiplier": 0.75,
        "description": "Licensed-state expansion: NM regions + WA",
    },
    "tier_4_us_broader": {
        "states": "OTHER_US",
        "counties": None,
        "priority_multiplier": 0.50,
        "description": "Broader US — referral / Stewardly platform only",
    },
    "tier_5_global": {
        "states": "NON_US",
        "counties": None,
        "priority_multiplier": 0.30,
        "description": "International — Stewardly platform only",
    },
}

# Residential scoring weights (must sum to 1.0)
RESIDENTIAL_WEIGHTS = {
    "equity_decile":               0.30,
    "ownership_length_decile":     0.20,
    "age_fit_score":               0.20,
    "zip_affluence_decile":        0.15,
    "recent_liquidity_event":      0.15,
}

# Commercial scoring weights (must sum to 1.0)
COMMERCIAL_WEIGHTS = {
    "entity_age_decile":           0.25,
    "entity_type_factor":          0.15,
    "revenue_band_decile":         0.25,
    "multi_property_count_decile": 0.20,
    "owner_age_fit_score":         0.15,
}

# Commercial entity type fit factors (0-1, 1 = best fit for advanced planning)
ENTITY_TYPE_FACTORS = {
    "S-CORP": 1.00, "S CORP": 1.00, "S CORPORATION": 1.00,
    "LLC": 0.90, "L.L.C.": 0.90, "LIMITED LIABILITY": 0.90,
    "C-CORP": 0.85, "C CORP": 0.85, "CORPORATION": 0.85, "INC": 0.85,
    "PARTNERSHIP": 0.75, "LP": 0.75, "LLP": 0.75, "L.P.": 0.75,
    "PROFESSIONAL CORPORATION": 0.80, "PC": 0.80, "PLLC": 0.80,
    "TRUST": 0.60,
    "SOLE PROPRIETORSHIP": 0.50, "DBA": 0.50,
    "UNKNOWN": 0.40,
}

# Residential age-fit curve: peak 45-65
def age_fit_residential(age: Optional[float]) -> float:
    if age is None or pd.isna(age):
        return 0.50  # unknown — neutral
    if 45 <= age <= 65: return 1.00
    if 40 <= age < 45:  return 0.80
    if 65 < age <= 70:  return 0.85
    if 35 <= age < 40:  return 0.55
    if 70 < age <= 75:  return 0.70
    if 30 <= age < 35:  return 0.30
    if 75 < age <= 80:  return 0.50
    return 0.15

# Commercial owner age-fit curve: peak 50-70 (succession planning)
def age_fit_commercial(age: Optional[float]) -> float:
    if age is None or pd.isna(age):
        return 0.50
    if 50 <= age <= 70: return 1.00
    if 45 <= age < 50:  return 0.75
    if 70 < age <= 75:  return 0.90
    if 40 <= age < 45:  return 0.55
    return 0.30

# ============================================================================
# LOADING + SCHEMA STANDARDIZATION
# ============================================================================

FILENAME_RE = re.compile(
    r"WB_(?P<segment>Residential|Commercial)_(?P<county>.+?)_County"
    r"(?:_(?P<state>[A-Z]{2}))?\.csv",
    re.IGNORECASE,
)

def parse_filename(path: Path) -> dict:
    m = FILENAME_RE.match(path.name)
    if not m:
        return {"segment": None, "county": None, "state": None}
    county = m.group("county").replace("_", " ").upper()
    state = (m.group("state") or "AZ").upper()  # default AZ per original files
    if county == "UNKNOWN":
        county = None
    return {
        "segment": m.group("segment").capitalize(),
        "county": county,
        "state": state,
    }

def load_all(input_dir: Path) -> pd.DataFrame:
    frames = []
    for path in sorted(input_dir.glob("WB_*.csv")):
        meta = parse_filename(path)
        if not meta["segment"]:
            print(f"[skip] unrecognized filename: {path.name}")
            continue
        df = pd.read_csv(path, low_memory=False)
        df["_source_file"] = path.name
        df["segment"] = meta["segment"]
        # Only fill from filename if not present in data
        if "state" not in df.columns: df["state"] = meta["state"]
        if "county" not in df.columns or df["county"].isna().all():
            df["county"] = meta["county"]
        frames.append(df)
        print(f"[load] {path.name}: {len(df):,} rows")
    if not frames:
        raise SystemExit(f"No WB_*.csv files found in {input_dir}")
    combined = pd.concat(frames, ignore_index=True, sort=False)
    combined.columns = [c.strip().lower().replace(" ", "_") for c in combined.columns]
    return combined

# ============================================================================
# GEO TIER ASSIGNMENT
# ============================================================================

def assign_geo_tier(row: pd.Series) -> str:
    state = str(row.get("state", "")).upper().strip()
    county = str(row.get("county", "")).upper().strip()
    us_states = {
        "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
        "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
        "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
        "VA","WA","WV","WI","WY","DC",
    }
    # Explicit tier matches first
    for tier, cfg in GEO_TIERS.items():
        s = cfg["states"]; c = cfg["counties"]
        if isinstance(s, set):
            if state in s and c is not None and county in c:
                return tier
    # State matches a home/licensed state but county is unknown → adjacent tier
    if state == "AZ":
        return "tier_2_az_adjacent"
    if state in {"NM", "WA"}:
        return "tier_3_nm_wa_licensed"
    # Fallback: US vs non-US
    if state in us_states:
        return "tier_4_us_broader"
    return "tier_5_global"

# ============================================================================
# DEDUP + MULTI-PROPERTY AGGREGATION
# ============================================================================

def normalize_name(s: str) -> str:
    if pd.isna(s): return ""
    return re.sub(r"[^A-Z0-9 ]", "", str(s).upper()).strip()

def dedupe_and_aggregate(df: pd.DataFrame) -> pd.DataFrame:
    """Collapse to one row per owner, carry multi_property_count as a signal."""
    name_col = next((c for c in ["owner_name", "owner", "name", "owner_1"] if c in df.columns), None)
    if not name_col:
        df["owner_key"] = df.index.astype(str)
        df["multi_property_count"] = 1
        return df
    df["owner_key"] = df[name_col].map(normalize_name)
    counts = df.groupby(["segment", "owner_key"]).size().rename("multi_property_count")
    df = df.merge(counts, on=["segment", "owner_key"], how="left")
    # Keep highest-value parcel per owner as the representative row
    value_col = next((c for c in ["market_value", "assessed_value", "total_value", "property_value"] if c in df.columns), None)
    if value_col:
        df = df.sort_values(value_col, ascending=False).drop_duplicates(subset=["segment", "owner_key"])
    else:
        df = df.drop_duplicates(subset=["segment", "owner_key"])
    return df.reset_index(drop=True)

# ============================================================================
# FEATURE ENGINEERING
# ============================================================================

def to_decile(s: pd.Series) -> pd.Series:
    """Rank → decile 1..10. NaN-safe."""
    ranked = s.rank(pct=True, na_option="keep")
    return (ranked * 10).clip(upper=10).fillna(5).astype(float) / 10  # normalized 0..1

def engineer_residential(df: pd.DataFrame) -> pd.DataFrame:
    value_col = next((c for c in ["market_value", "assessed_value", "total_value", "property_value"] if c in df.columns), None)
    lien_col = next((c for c in ["lien_amount", "mortgage_balance", "loan_amount"] if c in df.columns), None)
    if value_col:
        if lien_col:
            df["equity_est"] = df[value_col].astype(float) - df[lien_col].fillna(0).astype(float)
        else:
            df["equity_est"] = df[value_col].astype(float) * 0.60  # assume 40% LTV avg
    else:
        df["equity_est"] = np.nan
    df["equity_decile"] = to_decile(df["equity_est"])

    owner_since = next((c for c in ["owner_since", "purchase_date", "sale_date", "deed_date"] if c in df.columns), None)
    if owner_since:
        years = (pd.Timestamp.today() - pd.to_datetime(df[owner_since], errors="coerce")).dt.days / 365.25
        df["ownership_length_years"] = years
    else:
        df["ownership_length_years"] = np.nan
    df["ownership_length_decile"] = to_decile(df["ownership_length_years"])

    age_col = next((c for c in ["owner_age", "age"] if c in df.columns), None)
    df["age_fit_score"] = df[age_col].map(age_fit_residential) if age_col else 0.50

    zip_col = next((c for c in ["zip", "zipcode", "zip_code", "postal_code"] if c in df.columns), None)
    # Try ACS join; fall back to neutral 0.5 if helper not available
    try:
        import sys
        from pathlib import Path as _P
        sys.path.insert(0, str(_P(__file__).parent))
        from src.enrichment.acs_zip_income import apply_zip_affluence
        if zip_col and zip_col != "zip":
            df = df.rename(columns={zip_col: "zip"})
        df = apply_zip_affluence(df)
    except Exception as _e:
        print(f"[phase0] ACS affluence unavailable ({_e.__class__.__name__}); using neutral 0.5")
        df["zip_affluence_decile"] = 0.5

    recent_refi = next((c for c in ["recent_refi", "last_refi_date", "liquidity_event"] if c in df.columns), None)
    if recent_refi:
        if "date" in recent_refi:
            days_ago = (pd.Timestamp.today() - pd.to_datetime(df[recent_refi], errors="coerce")).dt.days
            df["recent_liquidity_event"] = (days_ago <= 730).astype(float)
        else:
            df["recent_liquidity_event"] = df[recent_refi].fillna(0).astype(float).clip(0, 1)
    else:
        df["recent_liquidity_event"] = 0.0
    return df

def engineer_commercial(df: pd.DataFrame) -> pd.DataFrame:
    formed_col = next((c for c in ["formed_date", "incorporation_date", "entity_formed", "filing_date"] if c in df.columns), None)
    if formed_col:
        years = (pd.Timestamp.today() - pd.to_datetime(df[formed_col], errors="coerce")).dt.days / 365.25
        df["entity_age_years"] = years
    else:
        df["entity_age_years"] = np.nan
    df["entity_age_decile"] = to_decile(df["entity_age_years"])

    entity_col = next((c for c in ["entity_type", "business_type", "legal_form"] if c in df.columns), None)
    if entity_col:
        up = df[entity_col].astype(str).str.upper().str.strip()
        df["entity_type_factor"] = up.map(lambda x: next((v for k, v in ENTITY_TYPE_FACTORS.items() if k in x), 0.40))
    else:
        df["entity_type_factor"] = 0.40

    rev_col = next((c for c in ["revenue", "annual_revenue", "sales_volume"] if c in df.columns), None)
    prop_val_col = next((c for c in ["market_value", "assessed_value", "total_value"] if c in df.columns), None)
    rev_proxy = df[rev_col] if rev_col else (df[prop_val_col] * 0.5 if prop_val_col else pd.Series(np.nan, index=df.index))
    df["revenue_proxy"] = pd.to_numeric(rev_proxy, errors="coerce")
    df["revenue_band_decile"] = to_decile(df["revenue_proxy"])

    df["multi_property_count_decile"] = to_decile(df["multi_property_count"].astype(float))

    age_col = next((c for c in ["owner_age", "principal_age"] if c in df.columns), None)
    df["owner_age_fit_score"] = df[age_col].map(age_fit_commercial) if age_col else 0.50
    return df

# ============================================================================
# SCORING
# ============================================================================

def score_segment(df: pd.DataFrame, weights: dict) -> pd.DataFrame:
    score = sum(df[f].fillna(0.5).astype(float) * w for f, w in weights.items())
    df["propensity_raw"] = score
    df["priority_multiplier"] = df["geo_tier"].map(
        {t: c["priority_multiplier"] for t, c in GEO_TIERS.items()}
    ).fillna(0.30)
    df["propensity_score"] = (df["propensity_raw"] * df["priority_multiplier"] * 100).round(1)
    df["propensity_decile"] = pd.qcut(
        df["propensity_score"].rank(method="first"),
        10, labels=list(range(10, 0, -1))
    ).astype(int)
    tier_map = {d: "A" if d <= 2 else "B" if d <= 5 else "C" if d <= 8 else "D"
                for d in range(1, 11)}
    df["propensity_tier"] = df["propensity_decile"].map(tier_map)
    return df

# ============================================================================
# MAIN PIPELINE
# ============================================================================

def run(input_dir: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    df = load_all(input_dir)
    print(f"\n[total loaded] {len(df):,} rows across {df['segment'].nunique()} segments")

    df["geo_tier"] = df.apply(assign_geo_tier, axis=1)
    print(f"[geo tiers] {df['geo_tier'].value_counts().to_dict()}")

    df = dedupe_and_aggregate(df)
    print(f"[after dedup] {len(df):,} unique owner rows")

    res = engineer_residential(df[df["segment"] == "Residential"].copy())
    com = engineer_commercial(df[df["segment"] == "Commercial"].copy())

    if len(res):
        res = score_segment(res, RESIDENTIAL_WEIGHTS)
        res.to_csv(output_dir / "scored_residential.csv", index=False)
        print(f"[scored] residential: {len(res):,}  | A-tier: {(res['propensity_tier']=='A').sum():,}")
    if len(com):
        com = score_segment(com, COMMERCIAL_WEIGHTS)
        com.to_csv(output_dir / "scored_commercial.csv", index=False)
        print(f"[scored] commercial:  {len(com):,}  | A-tier: {(com['propensity_tier']=='A').sum():,}")

    combined = pd.concat([res, com], ignore_index=True, sort=False)
    top = combined[combined["propensity_tier"].isin(["A", "B"])].copy()
    ghl_cols = [
        "segment", "geo_tier", "state", "county", "owner_key",
        "propensity_score", "propensity_decile", "propensity_tier",
        "multi_property_count", "_source_file",
    ]
    ghl_cols = [c for c in ghl_cols if c in top.columns]
    top[ghl_cols].to_csv(output_dir / "ghl_import_top_decile.csv", index=False)
    print(f"\n[GHL export] {len(top):,} A+B tier prospects → ghl_import_top_decile.csv")

    diag = {
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "totals": {"all": int(len(combined)), "residential": int(len(res)), "commercial": int(len(com))},
        "geo_tier_distribution": combined["geo_tier"].value_counts().to_dict(),
        "tier_distribution": combined.groupby(["segment", "propensity_tier"]).size().unstack(fill_value=0).to_dict(),
        "score_stats_by_segment": combined.groupby("segment")["propensity_score"].describe().to_dict(),
    }
    with open(output_dir / "scoring_diagnostics.json", "w") as f:
        json.dump(diag, f, indent=2, default=str)
    print(f"[diagnostics] → scoring_diagnostics.json")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=Path("./data/raw"))
    ap.add_argument("--output", type=Path, default=Path("./data/scored"))
    args = ap.parse_args()
    run(args.input, args.output)
