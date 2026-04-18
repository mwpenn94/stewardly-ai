"""
US Census Geocoder
==================
Resolves addresses to county FIPS + county name using the free US Census
Geocoding Services API. No key required; rate limit is generous (~per-second).

API docs: https://geocoding.geo.census.gov/geocoder/

Used to fill in county for records where:
  - county is missing/Unknown in source data
  - needed to correctly tier (T1 AZ home vs T2 AZ adjacent)

Usage (standalone):
  python census_geocoder.py --input records.csv --out records_geocoded.csv

Usage (programmatic):
  from src.enrichment.census_geocoder import geocode_df
  df = geocode_df(df, address_col="property_address", city_col="city",
                  state_col="state", zip_col="zip")
"""
from __future__ import annotations

import argparse
import time
from pathlib import Path

import pandas as pd
import requests

GEOCODE_URL = "https://geocoding.geo.census.gov/geocoder/geographies/address"

# FIPS → county name for AZ, NM, WA (subset we care about)
FIPS_TO_COUNTY = {
    # AZ
    "04019": ("AZ", "PIMA"), "04015": ("AZ", "MOHAVE"), "04023": ("AZ", "SANTA CRUZ"),
    "04003": ("AZ", "COCHISE"), "04013": ("AZ", "MARICOPA"), "04027": ("AZ", "YUMA"),
    "04021": ("AZ", "PINAL"), "04009": ("AZ", "GRAHAM"),
    # NM — top 10 by population
    "35001": ("NM", "BERNALILLO"), "35013": ("NM", "DONA ANA"), "35049": ("NM", "SANTA FE"),
    "35043": ("NM", "SANDOVAL"), "35045": ("NM", "SAN JUAN"), "35031": ("NM", "MCKINLEY"),
    "35015": ("NM", "EDDY"), "35029": ("NM", "LUNA"), "35005": ("NM", "CHAVES"),
    "35025": ("NM", "LEA"),
    # WA — top 10
    "53033": ("WA", "KING"), "53053": ("WA", "PIERCE"), "53061": ("WA", "SNOHOMISH"),
    "53063": ("WA", "SPOKANE"), "53011": ("WA", "CLARK"), "53067": ("WA", "THURSTON"),
    "53035": ("WA", "KITSAP"), "53077": ("WA", "YAKIMA"), "53005": ("WA", "BENTON"),
    "53073": ("WA", "WHATCOM"),
}


def geocode_one(street: str, city: str, state: str, zipcode: str, benchmark: str = "Public_AR_Current",
                vintage: str = "Current_Current") -> dict | None:
    """Geocode a single address. Returns {state, county, fips, lat, lon} or None."""
    params = {
        "street": street, "city": city, "state": state, "zip": zipcode,
        "benchmark": benchmark, "vintage": vintage, "format": "json",
    }
    try:
        r = requests.get(GEOCODE_URL, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        matches = data.get("result", {}).get("addressMatches", [])
        if not matches:
            return None
        m = matches[0]
        geos = m.get("geographies", {}).get("Counties", [{}])
        if not geos:
            return None
        county_data = geos[0]
        fips = county_data.get("GEOID", "")
        state_name, county_name = FIPS_TO_COUNTY.get(fips, ("", county_data.get("NAME", "").upper()))
        coords = m.get("coordinates", {})
        return {
            "state": state_name or state.upper(),
            "county": county_name,
            "fips": fips,
            "lat": coords.get("y"),
            "lon": coords.get("x"),
        }
    except (requests.RequestException, ValueError, KeyError):
        return None


def geocode_df(df: pd.DataFrame, address_col: str = "property_address",
               city_col: str = "city", state_col: str = "state",
               zip_col: str = "zip", only_missing_county: bool = True,
               rate_limit_sec: float = 0.1) -> pd.DataFrame:
    """Enrich dataframe in place with county + fips for records missing county."""
    df = df.copy()
    mask = df["county"].isna() | (df["county"].astype(str).str.upper().isin(["", "UNKNOWN", "NAN"])) \
        if only_missing_county and "county" in df.columns else pd.Series(True, index=df.index)
    n_to_process = int(mask.sum())
    print(f"[geocoder] processing {n_to_process:,} rows")
    resolved = 0
    for idx in df[mask].index:
        row = df.loc[idx]
        result = geocode_one(
            str(row.get(address_col, "")), str(row.get(city_col, "")),
            str(row.get(state_col, "")), str(row.get(zip_col, "")),
        )
        if result:
            df.at[idx, "county"] = result["county"]
            df.at[idx, "state"] = result["state"]
            if "fips" not in df.columns:
                df["fips"] = None
            df.at[idx, "fips"] = result["fips"]
            resolved += 1
        time.sleep(rate_limit_sec)
        if resolved % 100 == 0 and resolved > 0:
            print(f"  [geocoder] resolved {resolved:,} / {n_to_process:,}")
    print(f"[geocoder] resolved {resolved:,} / {n_to_process:,} ({resolved/max(n_to_process,1)*100:.1f}%)")
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    df = pd.read_csv(args.input, low_memory=False)
    df = geocode_df(df)
    df.to_csv(args.out, index=False)
    print(f"[geocoder] wrote {args.out}")


if __name__ == "__main__":
    main()
