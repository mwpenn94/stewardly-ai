"""
NM Secretary of State Business Data Loader
===========================================
NM SOS does NOT expose a stable public JSON API for business search.
Three viable paths, ordered by effort:

  1. BULK DOWNLOAD (recommended): NM SOS provides periodic bulk exports of
     the active business registry via public records request. Request a CSV
     of all LLCs + Corporations via sos.business.services@sos.nm.gov.
     Typical turnaround: 5–10 business days, $0 cost.
     File format varies — this script parses the common schema.

  2. UI SCRAPING: https://enterprise.sos.nm.gov/search
     Form-based search, ASP.NET ViewState-backed. Requires Playwright or
     similar browser automation. Brittle; SOS updates the UI periodically.
     Stub included below — fill in selectors per current page.

  3. CASE-BY-CASE: For specific high-value named entities, use the live
     search UI manually. Not appropriate for bulk propensity data.

This script focuses on path #1 (bulk file parsing) because it's the only
reliable, legal, scalable option. Output is CSV files compatible with
phase0_propensity_scoring.py (WB_Commercial_<County>_County_NM.csv).

Usage:
  python nm_sos_loader.py --input ./nm_sos_bulk.csv --out ./data/raw

Column mapping is configured via COLUMN_MAP below — adjust once you see
the actual bulk file headers (NM SOS has changed them twice in 5 years).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

# Common NM SOS bulk-export column names → Phase 0 schema
# Update these after inspecting the actual file headers
COLUMN_MAP_CANDIDATES = {
    "owner_name": ["business_name", "entity_name", "name", "legal_name"],
    "entity_type": ["entity_type", "business_type", "type"],
    "formed_date": ["date_filed", "formation_date", "filing_date", "incorporation_date"],
    "status": ["status", "entity_status"],
    "property_address": ["principal_address", "street_address", "mailing_address"],
    "city": ["principal_city", "city", "mailing_city"],
    "state": ["principal_state", "state"],
    "zip": ["principal_zip", "zip", "zip_code"],
    "county": ["principal_county", "county"],
    "registered_agent": ["registered_agent", "agent_name"],
}


def resolve_columns(df: pd.DataFrame) -> dict:
    """Find which candidate column names exist in the bulk file."""
    lower = {c.lower().strip().replace(" ", "_"): c for c in df.columns}
    resolved = {}
    for target, candidates in COLUMN_MAP_CANDIDATES.items():
        for cand in candidates:
            if cand in lower:
                resolved[target] = lower[cand]
                break
    return resolved


def normalize(df: pd.DataFrame) -> pd.DataFrame:
    mapping = resolve_columns(df)
    missing = [k for k in ["owner_name", "entity_type", "formed_date"] if k not in mapping]
    if missing:
        print(f"[NM loader] WARNING: missing required columns {missing}", file=sys.stderr)
        print(f"  Found columns: {list(df.columns)[:20]}", file=sys.stderr)
    # Rename resolved columns
    df = df.rename(columns={v: k for k, v in mapping.items()})
    df["state"] = "NM"
    df["segment"] = "Commercial"
    # Filter to active entities if status present
    if "status" in df.columns:
        before = len(df)
        df = df[df["status"].astype(str).str.upper().str.contains("ACTIVE|GOOD STANDING", na=False)]
        print(f"[NM loader] active-entity filter: {before:,} → {len(df):,}")
    # Normalize county
    if "county" in df.columns:
        df["county"] = df["county"].astype(str).str.upper().str.replace(" COUNTY", "", regex=False).str.strip()
    return df


def split_by_county(df: pd.DataFrame, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    if "county" not in df.columns or df["county"].isna().all():
        # Fall back: infer county from zip via ACS crosswalk (requires separate enrichment)
        out_path = out_dir / "WB_Commercial_Unknown_County_NM.csv"
        df.to_csv(out_path, index=False)
        print(f"[NM loader] no county column — wrote {len(df):,} rows → {out_path.name}")
        print("  Run enrichment/census_geocoder.py afterwards to resolve county from address")
        return
    for county, sub in df.groupby("county"):
        safe = str(county).replace(" ", "_").title() if county and str(county) != "nan" else "Unknown"
        out_path = out_dir / f"WB_Commercial_{safe}_County_NM.csv"
        sub.to_csv(out_path, index=False)
        print(f"[NM loader] wrote {len(sub):,} rows → {out_path.name}")


def scrape_live_ui(query: str):
    """
    Stub for Playwright-based live scraping of enterprise.sos.nm.gov/search.
    Not recommended for bulk — use path #1 (bulk file) instead.
    """
    raise NotImplementedError(
        "Live UI scraping not implemented. Use bulk file path.\n"
        "Request at: sos.business.services@sos.nm.gov"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True,
                    help="NM SOS bulk CSV (from public records request)")
    ap.add_argument("--out", type=Path, default=Path("./data/raw"))
    args = ap.parse_args()

    if not args.input.exists():
        print(f"[NM loader] input not found: {args.input}", file=sys.stderr)
        print("  Request a bulk export at sos.business.services@sos.nm.gov", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(args.input, low_memory=False)
    print(f"[NM loader] loaded {len(df):,} rows from {args.input.name}")
    df = normalize(df)
    split_by_county(df, args.out)


if __name__ == "__main__":
    main()
