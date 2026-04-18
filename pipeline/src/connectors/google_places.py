"""
Google Places Phone Finder (T0 — Free tier: 28,000 calls/mo)
===============================================================
Looks up business phone numbers via Google Places Text Search API.
The single highest-impact free contact source — every business that has
a Google listing has a phone number.

API: https://maps.googleapis.com/maps/api/place/textsearch/json
     https://maps.googleapis.com/maps/api/place/details/json

Free tier: $200/mo credit ≈ 28,000 text searches or 14,000 detail lookups.
No credit card required for the free tier if using "Places API (New)".

Segments served: commercial_client, cpa_attorney_partner, affiliate,
hr_director, nonprofit_leader — any entity with a business name.

Output: phone, website, google_place_id, formatted_address

Usage:
  # As enrichment (requires GOOGLE_PLACES_API_KEY env var):
  from src.connectors.google_places import enrich_phone_batch

  # As standalone:
  python google_places.py --name "Acme Roofing" --city "Tucson" --state "AZ"
"""
from __future__ import annotations

import os
import re
import time
from typing import Tuple

import pandas as pd
import requests

try:
    from src.connectors.base import BaseConnector
except ImportError:
    pass


PLACES_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACES_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"


def _get_key() -> str:
    return os.environ.get("GOOGLE_PLACES_API_KEY", os.environ.get("WB_GOOGLE_PLACES_API_KEY", ""))


def find_business_phone(name: str, city: str = "", state: str = "",
                         api_key: str = "") -> dict | None:
    """
    Look up a business by name+location → returns phone, website, address.
    Returns None if not found or API unavailable.
    """
    key = api_key or _get_key()
    if not key:
        return None
    query = f"{name} {city} {state}".strip()
    if not query:
        return None
    try:
        # Step 1: Text search to find place_id
        r = requests.get(PLACES_TEXT_SEARCH,
                          params={"query": query, "key": key},
                          timeout=10)
        r.raise_for_status()
        results = r.json().get("results", [])
        if not results:
            return None
        place_id = results[0].get("place_id")
        if not place_id:
            return None
        # Step 2: Place details for phone
        time.sleep(0.05)  # light rate limit
        r2 = requests.get(PLACES_DETAILS,
                           params={"place_id": place_id, "key": key,
                                   "fields": "formatted_phone_number,international_phone_number,"
                                              "website,formatted_address,name"},
                           timeout=10)
        r2.raise_for_status()
        detail = r2.json().get("result", {})
        phone_raw = detail.get("formatted_phone_number") or detail.get("international_phone_number")
        phone = None
        if phone_raw:
            digits = re.sub(r"\D", "", phone_raw)
            if len(digits) == 10:
                phone = digits
            elif len(digits) == 11 and digits[0] == "1":
                phone = digits[1:]
        return {
            "phone": phone,
            "website": detail.get("website"),
            "google_place_id": place_id,
            "formatted_address": detail.get("formatted_address"),
            "google_name": detail.get("name"),
            "phone_source": "google_places",
            "cost_usd": 0.0,  # free tier
        }
    except Exception:
        return None


def enrich_phone_batch(df: pd.DataFrame, name_col: str = "owner_name",
                        city_col: str = "city", state_col: str = "state",
                        budget_calls: int = 500) -> Tuple[pd.DataFrame, dict]:
    """
    Enrich business phone numbers for a batch of prospects.
    Only processes rows missing phone AND having a business-like name.
    """
    key = _get_key()
    if not key:
        return df, {"skipped": True, "reason": "GOOGLE_PLACES_API_KEY not set",
                     "cost_usd": 0.0, "features_added": []}
    df = df.copy()
    stats = {"calls_made": 0, "phone_found": 0, "website_found": 0, "cost_usd": 0.0}

    # Only enrich rows missing phone
    needs_phone = df["phone"].isna() | (df["phone"].astype(str).str.strip() == "") \
        if "phone" in df.columns else pd.Series(True, index=df.index)
    # Only business entities (skip individuals)
    is_business = df.get("entity_type", pd.Series([""] * len(df))).astype(str).str.upper() \
        .isin(["LLC", "CORP", "PC", "PLLC", "LLP", "LP", "INC", "HOA", "RELIGIOUS", "NONPROFIT", ""])

    candidates = df[needs_phone & is_business].head(budget_calls)
    for idx in candidates.index:
        row = df.loc[idx]
        name = str(row.get(name_col, ""))
        city = str(row.get(city_col, "")) if city_col in df.columns else ""
        state = str(row.get(state_col, "")) if state_col in df.columns else ""
        result = find_business_phone(name, city, state, key)
        stats["calls_made"] += 1
        if result:
            if result.get("phone"):
                df.at[idx, "phone"] = result["phone"]
                df.at[idx, "phone_source"] = "google_places"
                stats["phone_found"] += 1
            if result.get("website"):
                df.at[idx, "website"] = result["website"]
                stats["website_found"] += 1
                # Also extract domain for Hunter.io email lookup
                import urllib.parse
                domain = urllib.parse.urlparse(result["website"]).netloc
                if domain:
                    df.at[idx, "guessed_domain"] = domain
            if result.get("google_place_id"):
                df.at[idx, "google_place_id"] = result["google_place_id"]
        time.sleep(0.1)  # stay well under rate limit

    stats["features_added"] = ["phone", "phone_source", "website", "guessed_domain", "google_place_id"]
    return df, stats


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """Standard enrichment interface for the orchestrator."""
    return enrich_phone_batch(df)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--city", default="")
    ap.add_argument("--state", default="AZ")
    args = ap.parse_args()
    result = find_business_phone(args.name, args.city, args.state)
    if result:
        print(f"Phone: {result.get('phone')}")
        print(f"Website: {result.get('website')}")
        print(f"Address: {result.get('formatted_address')}")
    else:
        key = _get_key()
        if not key:
            print("Set GOOGLE_PLACES_API_KEY env var")
        else:
            print("Not found")
