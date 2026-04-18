"""
WA Business Data Scraper
========================
Pulls Washington State business license data via the open Socrata API
at data.wa.gov. No API key required for reasonable volumes.

Endpoint:   https://data.wa.gov/resource/7xux-kdpf.json  (Business Lookup)
            https://data.wa.gov/resource/v9qv-ihvb.json  (UBI + NAICS)

Columns typically available (verify live — schema drifts):
  ubi, business_name, location_address, location_city, location_state,
  location_zip, county_code, naics, license_status, open_date, close_date,
  legal_entity_type

Output: CSV files compatible with phase0_propensity_scoring.py
        (WB_Commercial_<County>_County_WA.csv)

Usage:
  python wa_dor_scraper.py --out ./data/raw --limit 50000

Note: For production, set $APP_TOKEN and pass in headers to bypass anon
throttling. Anon limit = 1000 req/hour, which is plenty for paginated pulls.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests

BASE = "https://data.wa.gov/resource"
DATASET = "7xux-kdpf"  # Business Lookup — verify current ID before production run
PAGE_SIZE = 5000

# WA counties of interest — start with metros + eastern WA for expansion
TARGET_COUNTIES = [
    "KING", "PIERCE", "SNOHOMISH", "SPOKANE", "CLARK",
    "THURSTON", "KITSAP", "YAKIMA", "BENTON", "WHATCOM",
]


def fetch_page(offset: int, limit: int = PAGE_SIZE, app_token: str | None = None) -> list[dict]:
    url = f"{BASE}/{DATASET}.json"
    params = {"$limit": limit, "$offset": offset, "$order": "ubi"}
    headers = {"X-App-Token": app_token} if app_token else {}
    r = requests.get(url, params=params, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()


def fetch_all(max_rows: int, app_token: str | None = None) -> pd.DataFrame:
    """Paginate until max_rows or empty page."""
    collected = []
    offset = 0
    while len(collected) < max_rows:
        batch = fetch_page(offset, min(PAGE_SIZE, max_rows - len(collected)), app_token)
        if not batch:
            break
        collected.extend(batch)
        print(f"  [WA] fetched {len(collected):,} / {max_rows:,}")
        offset += PAGE_SIZE
        time.sleep(0.2)  # be polite
    return pd.DataFrame(collected)


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    """Map WA DOR columns to the Phase 0 scoring script's expected schema."""
    rename = {
        "business_name": "owner_name",
        "location_address": "property_address",
        "location_city": "city",
        "location_zip": "zip",
        "county_code": "county",
        "naics": "naics",
        "legal_entity_type": "entity_type",
        "open_date": "formed_date",
        "ubi": "ubi",
    }
    df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})
    df["state"] = "WA"
    df["segment"] = "Commercial"
    # Upper-case + standardize county names
    if "county" in df.columns:
        df["county"] = df["county"].astype(str).str.upper().str.replace(" COUNTY", "", regex=False).str.strip()
    return df


def split_by_county(df: pd.DataFrame, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    if "county" not in df.columns:
        out_path = out_dir / "WB_Commercial_Unknown_County_WA.csv"
        df.to_csv(out_path, index=False)
        print(f"  [WA] wrote {len(df):,} rows → {out_path.name} (no county column)")
        return
    for county, sub in df.groupby("county"):
        safe = str(county).replace(" ", "_").title() or "Unknown"
        out_path = out_dir / f"WB_Commercial_{safe}_County_WA.csv"
        sub.to_csv(out_path, index=False)
        print(f"  [WA] wrote {len(sub):,} rows → {out_path.name}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("./data/raw"))
    ap.add_argument("--limit", type=int, default=25000)
    ap.add_argument("--target-counties-only", action="store_true",
                    help="Filter to TARGET_COUNTIES post-fetch")
    args = ap.parse_args()

    app_token = os.environ.get("SOCRATA_APP_TOKEN")
    print(f"[WA scraper] max_rows={args.limit}  token={'yes' if app_token else 'anon'}")
    try:
        raw = fetch_all(args.limit, app_token)
    except requests.HTTPError as e:
        print(f"[WA scraper] HTTP error — dataset ID may have changed: {e}", file=sys.stderr)
        print("  Verify current dataset at https://data.wa.gov/browse?tags=business", file=sys.stderr)
        sys.exit(2)
    if raw.empty:
        print("[WA scraper] empty response — check dataset ID", file=sys.stderr)
        sys.exit(1)

    df = normalize(raw)
    if args.target_counties_only:
        df = df[df["county"].isin(TARGET_COUNTIES)]
    split_by_county(df, args.out)
    print(f"[WA scraper] done — {len(df):,} rows written")


if __name__ == "__main__":
    main()
