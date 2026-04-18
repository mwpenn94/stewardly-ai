"""
NPI Registry Connector (T0 — Free)
=====================================
The NPPES (National Plan & Provider Enumeration System) publishes the
complete NPI registry monthly as a free bulk download (~8GB) AND exposes
a free API for individual lookups.

API: https://npiregistry.cms.hhs.gov/api/?version=2.1
Bulk: https://download.cms.gov/nppes/NPI_Files.html

Returns for each provider:
  - Full name (first, last, credential)
  - Practice address + phone + fax
  - Taxonomy (specialty)
  - Entity type (1=individual, 2=organization)

Useful for:
  - residential_client (high-income medical professionals)
  - hr_director (medical practice HR contacts)
  - commercial_client (medical practices as entities)

Usage:
  python npi_registry.py --state AZ --taxonomy 207R  # Internal Medicine
  python npi_registry.py --state AZ --limit 5000
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

try:
    from src.connectors.base import BaseConnector, normalize_owner_key
except ImportError:
    from base import BaseConnector, normalize_owner_key


NPI_API = "https://npiregistry.cms.hhs.gov/api/"
PAGE_SIZE = 200  # API max


class NPIRegistryConnector(BaseConnector):
    source_type = "npi_registry"
    source_name = "CMS NPI Registry"
    segment = "residential_client"  # default; medical pros are high-income individuals
    tier = "T0"
    rate_limit_per_second = 5.0
    default_cadence_hours = 720  # monthly

    def test_connection(self) -> bool:
        try:
            r = requests.get(NPI_API, params={"version": "2.1", "limit": 1,
                             "state": "AZ", "enumeration_type": "NPI-1"}, timeout=10)
            return r.status_code == 200
        except Exception:
            return False

    def fetch_records(self, since: datetime = None, limit: int = None) -> pd.DataFrame:
        states = self.config.get("target_states", ["AZ"])
        taxonomy = self.config.get("taxonomy_filter", "")  # e.g., "207R" for internal medicine
        max_rows = limit or self.config.get("max_rows", 5000)
        all_records = []

        for state in states:
            records, skip = [], 0
            while len(records) < max_rows // len(states):
                self._rate_limit()
                params = {
                    "version": "2.1",
                    "state": state,
                    "enumeration_type": "NPI-1",  # individuals only
                    "limit": PAGE_SIZE,
                    "skip": skip,
                }
                if taxonomy:
                    params["taxonomy_description"] = taxonomy
                try:
                    r = requests.get(NPI_API, params=params, timeout=20)
                    r.raise_for_status()
                    data = r.json()
                    results = data.get("results", [])
                    if not results:
                        break
                    records.extend(results)
                    skip += PAGE_SIZE
                    if data.get("result_count", 0) <= skip:
                        break
                except Exception:
                    break
            all_records.extend(records)

        return pd.DataFrame(all_records) if all_records else pd.DataFrame()

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        df = df.copy()
        rows = []
        for _, record in df.iterrows():
            basic = record.get("basic", {}) or {}
            addresses = record.get("addresses", []) or []
            taxonomies = record.get("taxonomies", []) or []

            # Get practice location address (type = "DOM" = domicile/practice)
            practice_addr = next((a for a in addresses if a.get("address_purpose") == "LOCATION"), {})
            if not practice_addr and addresses:
                practice_addr = addresses[0]

            first = basic.get("first_name", "")
            last = basic.get("last_name", "")
            name = f"{first} {last}".strip()
            credential = basic.get("credential", "")

            # Primary taxonomy (specialty)
            primary_tax = next((t for t in taxonomies if t.get("primary")), {})
            specialty = primary_tax.get("desc", "")

            rows.append({
                "owner_name": name,
                "owner_key": normalize_owner_key(name),
                "npi": record.get("number"),
                "credential": credential,
                "specialty": specialty,
                "entity_type": "Individual",
                "property_address": practice_addr.get("address_1", ""),
                "address_2": practice_addr.get("address_2", ""),
                "city": practice_addr.get("city", ""),
                "state": practice_addr.get("state", ""),
                "zip": practice_addr.get("postal_code", "")[:5],
                "phone": practice_addr.get("telephone_number", ""),
                "fax": practice_addr.get("fax_number", ""),
                "segment": self.segment,
                "naics": "62",  # Healthcare
                "naics_label": "Healthcare",
            })

        return pd.DataFrame(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--state", default="AZ")
    ap.add_argument("--taxonomy", default="", help="Taxonomy filter (e.g., 207R for Internal Medicine)")
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--out", type=Path, default=Path("./data/raw"))
    args = ap.parse_args()

    connector = NPIRegistryConnector(config={
        "target_states": [args.state],
        "taxonomy_filter": args.taxonomy,
        "max_rows": args.limit,
    })

    if not connector.test_connection():
        print("[npi] API not reachable", file=sys.stderr)
        sys.exit(1)

    raw = connector.fetch_records(limit=args.limit)
    if raw.empty:
        print("[npi] no results")
        sys.exit(0)

    norm = connector.normalize(raw)
    phone_count = norm["phone"].astype(str).str.len().gt(5).sum()
    print(f"[npi] {len(norm)} providers, {phone_count} with phone numbers ({100*phone_count/len(norm):.0f}%)")

    args.out.mkdir(parents=True, exist_ok=True)
    out = args.out / f"WB_residential_client_npi_{args.state}.csv"
    norm.to_csv(out, index=False)
    print(f"[npi] wrote → {out}")


if __name__ == "__main__":
    main()
