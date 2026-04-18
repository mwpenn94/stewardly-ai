"""
AZ Corporation Commission Loader
=================================
The AZ Corporation Commission (eCorp) maintains the public business registry.
No public bulk download API — but ACC publishes free CSV/Excel snapshots
periodically and has a manual entity search UI.

Two paths supported:
  1. Bulk file (recommended) — request from ACC public records office at
     publicrecords@azcc.gov, $0 cost, typical 5-7 business days
  2. Entity search results CSV — manually-saved search results

Output: WB_commercial_client_az_corp_commission_AZ.csv  matching the v2
filename schema, ready for phase0_propensity_scoring_v2.

Usage:
  python az_corp_commission_loader.py --input ./acc_bulk.csv --out ./data/raw
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

# Common ACC bulk file column variants → canonical schema
COL_MAP_CANDIDATES = {
    "owner_name":   ["entity_name", "name", "legal_name", "business_name"],
    "entity_type":  ["entity_type", "domestic_entity_type", "filing_type", "type"],
    "formed_date":  ["formation_date", "incorporation_date", "filing_date", "date_filed"],
    "status":       ["status", "entity_status", "active_status"],
    "naics":        ["naics", "naics_code", "industry_code"],
    "property_address": ["principal_address", "principal_office_address", "street_address"],
    "city":         ["principal_city", "city"],
    "zip":          ["principal_zip", "zip", "zip_code"],
    "county":       ["principal_county", "county"],
    "registered_agent": ["registered_agent", "agent_name", "statutory_agent"],
    "ein":          ["ein", "fein", "tax_id"],
}


def resolve_columns(df: pd.DataFrame) -> dict:
    lower = {c.lower().strip().replace(" ", "_"): c for c in df.columns}
    resolved = {}
    for target, candidates in COL_MAP_CANDIDATES.items():
        for cand in candidates:
            if cand in lower:
                resolved[target] = lower[cand]
                break
    return resolved


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    mapping = resolve_columns(df)
    df = df.rename(columns={v: k for k, v in mapping.items()})
    df["state"] = "AZ"
    if "status" in df.columns:
        before = len(df)
        df = df[df["status"].astype(str).str.upper().str.contains("ACTIVE|GOOD", na=False)]
        print(f"[ACC] active-entity filter: {before:,} → {len(df):,}")
    if "county" in df.columns:
        df["county"] = df["county"].astype(str).str.upper().str.replace(" COUNTY", "", regex=False).str.strip()
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=Path("./data/raw"))
    args = ap.parse_args()
    if not args.input.exists():
        print(f"[ACC] input not found: {args.input}", file=sys.stderr)
        print("  Request ACC bulk extract at publicrecords@azcc.gov", file=sys.stderr)
        sys.exit(1)
    df = pd.read_csv(args.input, low_memory=False)
    print(f"[ACC] loaded {len(df):,} rows from {args.input.name}")
    df = normalize(df)
    args.out.mkdir(parents=True, exist_ok=True)
    out = args.out / "WB_commercial_client_az_corp_commission_AZ.csv"
    df.to_csv(out, index=False)
    print(f"[ACC] wrote {len(df):,} rows → {out.name}")


if __name__ == "__main__":
    main()
