"""
ACS Zip-Level Affluence Lookup
==============================
Fills in `zip_affluence_decile` feature in Phase 0 scoring.

Data source: US Census ACS 5-year estimates, table B19013 (median household
income by zip code tabulation area — ZCTA).

Approach:
  1. One-time download of the ACS table for all ZCTAs (free, no key needed
     for the summary tables via the Census API).
  2. Cache as a local parquet/CSV.
  3. Join against prospect data on zip → compute decile rank.

For a one-off build, you can download the ACS table manually from
data.census.gov and save as data/reference/acs_b19013_zcta.csv with columns:
  zip, median_household_income

This script fetches the table programmatically and writes the cache.

Usage:
  # One-time: build the cache
  python acs_zip_income.py --build-cache --out ./data/reference/acs_zcta_income.csv

  # Apply to a scoring run
  from src.enrichment.acs_zip_income import apply_zip_affluence
  df = apply_zip_affluence(df)
"""
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import requests

ACS_API = "https://api.census.gov/data/2022/acs/acs5"
CACHE_DEFAULT = Path("./data/reference/acs_zcta_income.csv")


def build_cache(out: Path = CACHE_DEFAULT) -> pd.DataFrame:
    """Fetch median HH income (B19013_001E) for all ZCTAs and cache."""
    out.parent.mkdir(parents=True, exist_ok=True)
    params = {
        "get": "NAME,B19013_001E",
        "for": "zip code tabulation area:*",
    }
    print("[ACS] fetching B19013 for all ZCTAs (~33k rows)...")
    r = requests.get(ACS_API, params=params, timeout=60)
    r.raise_for_status()
    data = r.json()
    header, rows = data[0], data[1:]
    df = pd.DataFrame(rows, columns=header)
    df = df.rename(columns={"B19013_001E": "median_household_income",
                            "zip code tabulation area": "zip"})
    df["median_household_income"] = pd.to_numeric(df["median_household_income"], errors="coerce")
    df = df[df["median_household_income"] > 0][["zip", "median_household_income"]]
    df.to_csv(out, index=False)
    print(f"[ACS] cached {len(df):,} ZCTAs → {out}")
    return df


def load_cache(path: Path = CACHE_DEFAULT) -> pd.DataFrame:
    if not path.exists():
        print(f"[ACS] cache not found at {path}; building...")
        return build_cache(path)
    return pd.read_csv(path, dtype={"zip": str})


def apply_zip_affluence(df: pd.DataFrame, zip_col: str = "zip",
                        cache_path: Path = CACHE_DEFAULT) -> pd.DataFrame:
    """Add `zip_affluence_decile` column to df (0..1 normalized decile rank)."""
    if zip_col not in df.columns:
        print(f"[ACS] no {zip_col} column; skipping affluence join")
        df["zip_affluence_decile"] = 0.5
        return df
    acs = load_cache(cache_path)
    acs["zip"] = acs["zip"].astype(str).str.zfill(5)
    df["_zip_str"] = df[zip_col].astype(str).str.extract(r"(\d{5})")[0]
    merged = df.merge(acs, left_on="_zip_str", right_on="zip", how="left", suffixes=("", "_acs"))
    ranked = merged["median_household_income"].rank(pct=True, na_option="keep")
    merged["zip_affluence_decile"] = (ranked.fillna(0.5)).astype(float)
    merged = merged.drop(columns=["_zip_str", "zip_acs"], errors="ignore")
    print(f"[ACS] joined affluence for {merged['median_household_income'].notna().sum():,} / {len(merged):,} rows")
    return merged


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build-cache", action="store_true")
    ap.add_argument("--out", type=Path, default=CACHE_DEFAULT)
    args = ap.parse_args()
    if args.build_cache:
        build_cache(args.out)
    else:
        df = load_cache(args.out)
        print(df.describe())


if __name__ == "__main__":
    main()
