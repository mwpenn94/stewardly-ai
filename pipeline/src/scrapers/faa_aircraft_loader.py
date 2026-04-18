"""
FAA Aircraft Registry Loader
=============================
The FAA publishes a free, complete bulk download of all US-registered
aircraft, updated daily:

  https://registry.faa.gov/aircraftinquiry/Search/DownloadFile

Filename: ReleasableAircraft.zip  (~50 MB, ~300k aircraft)
Contents: MASTER.txt (registration), ACFTREF.txt (aircraft model)

Aircraft ownership is a strong wealth signal — most piston/turbine owners
are HNW or business-owners. Useful for:
  - Residential client propensity boost (owner cross-reference)
  - Commercial client signal (entity-owned aircraft)
  - Direct mail to aircraft-owner addresses (very high LTV)

This loader filters to AZ/NM/WA registered aircraft and outputs a
joinable CSV — match against owner_name in your existing prospect data.

Usage:
  python faa_aircraft_loader.py --download   # one-time bulk download
  python faa_aircraft_loader.py --states AZ,NM,WA --out ./data/enriched
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

# MASTER.txt is fixed-width then comma-delimited in newer extracts.
# Modern format (2020+): comma-separated with header row.
MASTER_COLS_2020 = [
    "n_number", "serial_number", "mfr_mdl_code", "eng_mfr_mdl",
    "year_mfr", "type_registrant", "name", "street", "street2",
    "city", "state", "zip_code", "region", "county_mail",
    "country_mail", "last_action_date", "cert_issue_date",
    "certification", "type_aircraft", "type_engine", "status_code",
    "mode_s_code", "fract_owner", "air_worth_date", "other_names_1",
    "other_names_2", "other_names_3", "other_names_4", "other_names_5",
    "expiration_date", "unique_id", "kit_mfr", "kit_model",
    "mode_s_code_hex",
]


def load_master(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)
    df.columns = [c.strip().upper().replace(" ", "_") for c in df.columns]
    return df


def filter_states(df: pd.DataFrame, states: list[str]) -> pd.DataFrame:
    state_col = next((c for c in ["STATE", "STATE_CODE"] if c in df.columns), None)
    if not state_col:
        raise ValueError(f"No state column found; available: {list(df.columns)[:10]}")
    return df[df[state_col].astype(str).str.upper().isin([s.upper() for s in states])]


def normalize_for_join(df: pd.DataFrame) -> pd.DataFrame:
    """Produce a canonical join-ready table."""
    name_col = next((c for c in ["NAME", "OWNER_NAME"] if c in df.columns), None)
    state_col = next((c for c in ["STATE", "STATE_CODE"] if c in df.columns), None)
    out = pd.DataFrame({
        "owner_name_raw": df[name_col].astype(str),
        "owner_name_norm": df[name_col].astype(str).str.upper().str.replace(r"[^A-Z0-9 ]", "", regex=True).str.strip(),
        "address": df.get("STREET", ""),
        "city":    df.get("CITY", ""),
        "state":   df[state_col].astype(str).str.upper(),
        "zip":     df.get("ZIP_CODE", ""),
        "n_number": df.get("N_NUMBER", ""),
        "year_mfr": df.get("YEAR_MFR", ""),
        "is_corporate_owner": df.get("TYPE_REGISTRANT", "").astype(str).isin(["3", "4", "5"]).astype(int),
        # 1=Individual, 2=Partnership, 3=Corporation, 4=Co-Owned, 5=Government, 7=LLC, 8=Non-Citizen Corp
    })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true",
                    help="Print download instructions (no automated download due to FAA throttling)")
    ap.add_argument("--master", type=Path, default=Path("./data/reference/MASTER.txt"),
                    help="Path to extracted MASTER.txt from FAA bulk download")
    ap.add_argument("--states", default="AZ,NM,WA")
    ap.add_argument("--out", type=Path, default=Path("./data/enriched"))
    args = ap.parse_args()

    if args.download:
        print("FAA Aircraft Registry — manual download (one-time, ~5 minutes):")
        print("  1. https://registry.faa.gov/database/ReleasableAircraft.zip")
        print("  2. Extract MASTER.txt to data/reference/MASTER.txt")
        print("  3. Re-run this script without --download")
        return

    if not args.master.exists():
        print(f"[faa] MASTER.txt not found at {args.master}", file=sys.stderr)
        print("  Run with --download for instructions", file=sys.stderr)
        sys.exit(1)

    df = load_master(args.master)
    print(f"[faa] loaded {len(df):,} registered aircraft")
    states = [s.strip().upper() for s in args.states.split(",")]
    df = filter_states(df, states)
    print(f"[faa] {','.join(states)}: {len(df):,} aircraft")
    out_df = normalize_for_join(df)
    args.out.mkdir(parents=True, exist_ok=True)
    out = args.out / "faa_aircraft_owners_normalized.csv"
    out_df.to_csv(out, index=False)
    print(f"[faa] wrote {len(out_df):,} → {out.name}")


if __name__ == "__main__":
    main()
