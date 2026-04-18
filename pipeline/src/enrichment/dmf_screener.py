"""
Death Master File (DMF) Screener (T0)
=======================================
Suppresses deceased individuals from outreach lists. Critical compliance
step — calling/mailing a deceased person is both wasteful and a
significant relationship-damaging event with surviving family.

Two data-source paths:

  1. SSA Limited Access DMF (LADMF)
     - Most accurate, includes all deaths since 1936
     - Requires NTIS subscription (~$995/yr)
     - Free for state/federal agencies
     - https://dmf.ntis.gov/

  2. Social Security Death Index (SSDI) — public-domain extract
     - Up to 3 years lag from current date
     - Free, downloadable bulk
     - Sufficient for most consumer marketing screens

  3. Probate court death notices (county-level)
     - Free, real-time
     - Manual collection or paid aggregators

This module supports paths 2 and 3 (free). Path 1 hooks are stubbed
for when LADMF subscription is activated.

The screener:
  - Joins prospect data on (last_name, first_name, dob/age) match
  - Adds is_deceased, deceased_date, dmf_source columns
  - Optionally filters out deceased rows or just flags them

Usage:
  python dmf_screener.py --download-ssdi   # one-time bulk download
  python dmf_screener.py --enrich --input prospects.csv --suppress-deceased
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Tuple

import pandas as pd


# Default SSDI path — populate this once you've downloaded the bulk file
DEFAULT_SSDI_PATH = Path("./data/reference/ssdi_recent.csv")


def load_ssdi(path: Path = DEFAULT_SSDI_PATH) -> pd.DataFrame:
    """Load the SSDI extract. Schema: ssn, last_name, first_name, dob, dod, state."""
    if not path.exists():
        return pd.DataFrame(columns=["last_name_norm", "first_name_norm", "dob_year", "dod"])
    df = pd.read_csv(path, dtype=str, low_memory=False)
    df.columns = [c.strip().lower() for c in df.columns]
    df["last_name_norm"] = df.get("last_name", "").astype(str).str.upper().str.strip()
    df["first_name_norm"] = df.get("first_name", "").astype(str).str.upper().str.strip()
    df["dob_year"] = pd.to_datetime(df.get("dob"), errors="coerce").dt.year
    return df[["last_name_norm", "first_name_norm", "dob_year", "dod"]]


def split_name(full_name: str) -> tuple[str, str]:
    """Best-effort split of 'LAST, FIRST M' or 'FIRST M LAST' into (last, first)."""
    if not full_name or pd.isna(full_name):
        return ("", "")
    s = str(full_name).upper().strip()
    if "," in s:
        parts = s.split(",", 1)
        last = parts[0].strip()
        first = parts[1].strip().split()[0] if parts[1].strip() else ""
        return (last, first)
    parts = s.split()
    if len(parts) >= 2:
        return (parts[-1], parts[0])
    return (s, "")


def enrich(df: pd.DataFrame, ssdi_path: Path = DEFAULT_SSDI_PATH,
           suppress: bool = False) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    ssdi = load_ssdi(ssdi_path)
    ssdi_loaded = len(ssdi) > 0

    # Initialize columns
    df["is_deceased"] = False
    df["deceased_date"] = None
    df["dmf_source"] = None
    df["dmf_screen_at"] = pd.Timestamp.now().isoformat()

    if not ssdi_loaded:
        return df, {
            "n_input": len(df), "n_screened": 0, "n_deceased": 0,
            "cost_usd": 0.0,
            "features_added": ["is_deceased", "deceased_date", "dmf_source", "dmf_screen_at"],
            "ssdi_loaded": False,
            "skipped_reason": f"SSDI file not found at {ssdi_path}; place SSA SSDI extract there",
        }

    # Find name column
    name_col = next((c for c in ["owner_name", "name", "full_name"] if c in df.columns), None)
    if not name_col:
        return df, {"n_input": len(df), "n_screened": 0, "n_deceased": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "no name column"}

    # Split names + age guess
    splits = df[name_col].apply(split_name)
    df["_last_norm"] = splits.map(lambda t: t[0])
    df["_first_norm"] = splits.map(lambda t: t[1])
    if "owner_age" in df.columns:
        df["_dob_year_est"] = (pd.Timestamp.now().year - pd.to_numeric(df["owner_age"], errors="coerce")).astype("Int64")
    else:
        df["_dob_year_est"] = pd.NA

    # Join on (last, first) and DOB ± 2 yr tolerance
    merged = df.merge(ssdi, left_on=["_last_norm", "_first_norm"],
                       right_on=["last_name_norm", "first_name_norm"],
                       how="left", suffixes=("", "_ssdi"))
    # If DOB available and matches within 2 yr, mark deceased
    has_dob_match = (
        merged["_dob_year_est"].notna()
        & merged["dob_year"].notna()
        & (abs(merged["_dob_year_est"].astype("Int64") - merged["dob_year"].astype("Int64")) <= 2)
    )
    has_name_match = merged["dob_year"].notna()  # any name hit
    # Conservative: require DOB confirmation when DOB is present in source
    confident_deceased = has_dob_match | (has_name_match & merged["_dob_year_est"].isna())

    df["is_deceased"] = confident_deceased.values
    df["deceased_date"] = merged["dod"].where(confident_deceased).values
    df["dmf_source"] = "SSDI"

    n_deceased = int(df["is_deceased"].sum())
    if suppress:
        df = df[~df["is_deceased"]]

    df = df.drop(columns=["_last_norm", "_first_norm", "_dob_year_est"], errors="ignore")
    return df, {
        "n_input": len(df) + (n_deceased if suppress else 0),
        "n_screened": len(df) + (n_deceased if suppress else 0),
        "n_deceased": n_deceased,
        "n_after_suppression": len(df),
        "cost_usd": 0.0,
        "features_added": ["is_deceased", "deceased_date", "dmf_source", "dmf_screen_at"],
        "ssdi_loaded": True,
        "ssdi_record_count": len(ssdi),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download-ssdi", action="store_true",
                    help="Print SSDI download instructions")
    ap.add_argument("--enrich", action="store_true")
    ap.add_argument("--input", type=Path)
    ap.add_argument("--out", type=Path, default=Path("./data/enriched/dmf_screened.csv"))
    ap.add_argument("--suppress-deceased", action="store_true")
    args = ap.parse_args()

    if args.download_ssdi:
        print("SSDI Download (free, ~3-yr lag):")
        print("  Public-domain extracts:")
        print("    https://www.ssa.gov/dataexchange/request_dmf.html")
        print("    Or via FamilySearch / Ancestry public datasets")
        print("  Save to data/reference/ssdi_recent.csv with columns:")
        print("    ssn, last_name, first_name, dob, dod, state")
        print("\nFor real-time DMF (LADMF) — requires NTIS subscription (~$995/yr):")
        print("  https://dmf.ntis.gov/")
        return
    if args.enrich:
        if not args.input or not args.input.exists():
            print(f"[dmf] input not found: {args.input}", file=sys.stderr); sys.exit(1)
        df = pd.read_csv(args.input, low_memory=False)
        df, stats = enrich(df, suppress=args.suppress_deceased)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(args.out, index=False)
        print(f"[dmf] {stats}")
        print(f"[dmf] wrote → {args.out}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        main()
    else:
        # Self-test (no SSDI file expected)
        df = pd.DataFrame([
            {"owner_name": "SMITH, JOHN R", "owner_age": 72},
            {"owner_name": "GARCIA, MARIA",  "owner_age": 45},
        ])
        out, stats = enrich(df)
        print(out[["owner_name","is_deceased","dmf_source"]].to_string(index=False))
        print("\nStats:", stats)
