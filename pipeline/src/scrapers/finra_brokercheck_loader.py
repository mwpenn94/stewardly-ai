"""
FINRA BrokerCheck Loader
=========================
FINRA publishes a free downloadable dataset of all registered brokers
("Disciplinary History Reports" + "Individual Reports") at:

  https://brokercheck.finra.org/   (UI)
  https://www.finra.org/registration-exams-ce/registration-information/registration-statistics  (datasets)

For bulk: the FINRA Aggregator Site provides quarterly extracts to firms.
For ad-hoc: scrape individual broker reports via the public BrokerCheck JSON API:
  https://api.brokercheck.finra.org/search/individual

This loader handles the JSON search API path (rate-limited but free).

Output: WB_experienced_pro_finra_brokercheck_AZ.csv compatible with
phase0_propensity_scoring_v2.

Usage:
  python finra_brokercheck_loader.py --state AZ --out ./data/raw --max 5000
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import pandas as pd
import requests

API = "https://api.brokercheck.finra.org/search/individual"
PAGE_SIZE = 50


def fetch_state(state: str, offset: int = 0, size: int = PAGE_SIZE) -> dict:
    params = {
        "query": "",
        "filter": f"isBrokerActive=true&state={state}",
        "includePrevious": "false",
        "hl": "false",
        "nrows": size,
        "start": offset,
        "r": 25,
        "sort": "score+desc",
        "wt": "json",
    }
    r = requests.get(API, params=params, timeout=20,
                     headers={"User-Agent": "WealthBridge-Recruit-Research/1.0"})
    r.raise_for_status()
    return r.json()


def parse_doc(doc: dict) -> dict:
    """Pull the fields we care about for propensity scoring."""
    src = doc.get("_source", {})
    info = src.get("ind_other_names", [{}])
    return {
        "owner_name":        f"{src.get('ind_firstname', '')} {src.get('ind_lastname', '')}".strip(),
        "crd_number":        src.get("ind_source_id"),
        "current_firm":      ", ".join(src.get("ind_current_employments_display", [])),
        "years_in_industry": _calc_tenure(src.get("ind_yrs_industry") or src.get("ind_industry_calendar_yrs")),
        "licenses":          ", ".join(src.get("ind_industry_titles", []) or []),
        "state":             ", ".join(src.get("ind_other_us_state_locations", []) or [src.get("ind_main_off_state", "")]),
        "city":              src.get("ind_main_off_city", ""),
        "zip":               src.get("ind_main_off_postal_code", ""),
        "estimated_gdc":     None,  # not in BrokerCheck — append from external
    }


def _calc_tenure(val) -> int | None:
    try:
        return int(val) if val else None
    except (TypeError, ValueError):
        return None


def fetch_all(state: str, max_rows: int) -> pd.DataFrame:
    docs = []
    offset = 0
    while len(docs) < max_rows:
        try:
            data = fetch_state(state, offset, min(PAGE_SIZE, max_rows - len(docs)))
        except requests.HTTPError as e:
            print(f"[finra] HTTP error at offset {offset}: {e}", file=sys.stderr)
            break
        hits = data.get("hits", {}).get("hits", [])
        if not hits:
            break
        docs.extend(parse_doc(h) for h in hits)
        print(f"  [finra] {state}: fetched {len(docs):,} / {max_rows:,}")
        offset += PAGE_SIZE
        time.sleep(0.5)  # polite — FINRA throttles aggressively
    return pd.DataFrame(docs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default="AZ")
    ap.add_argument("--max", type=int, default=2000)
    ap.add_argument("--out", type=Path, default=Path("./data/raw"))
    args = ap.parse_args()
    df = fetch_all(args.state, args.max)
    if df.empty:
        print("[finra] no results — API schema may have changed", file=sys.stderr)
        sys.exit(1)
    args.out.mkdir(parents=True, exist_ok=True)
    out = args.out / f"WB_experienced_pro_finra_brokercheck_{args.state}.csv"
    df.to_csv(out, index=False)
    print(f"[finra] wrote {len(df):,} → {out.name}")


if __name__ == "__main__":
    main()
