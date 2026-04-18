"""
Multi-Property Aggregator (T0)
==============================
Detects when the same owner appears across multiple property records
(across counties, across segments). High multi-property count is a strong
wealth-concentration signal — especially valuable for commercial_client
segment scoring.

Handles:
  - Exact owner_key matching (already done by phase0 dedup)
  - Fuzzy name matching (LLC suffix variations, "AND" vs "&", "JR" vs "JR.")
  - Trust-name parent extraction ("SMITH FAMILY TRUST" → "SMITH FAMILY")
  - Address co-occurrence (different name same address = same owner)

Output columns added:
  multi_property_count        — count of records sharing this owner
  total_property_value_usd    — sum of all property values for this owner
  property_concentration_decile — 0..1 normalized rank
  unique_counties_count       — geographic spread

Usage:
  from src.enrichment.multi_property_aggregator import enrich
  df, stats = enrich(df, name_col='owner_name', value_col='market_value')
"""
from __future__ import annotations

import re
from typing import Tuple

import pandas as pd


# Suffixes/tokens to strip for fuzzy matching
STRIP_TOKENS = re.compile(
    r"\b(LLC|L\.?L\.?C\.?|INC|CORP|CO|LTD|LP|LLP|PLLC|PC|ESQ|JR|SR|II|III|IV|"
    r"TRUST|TR|FAMILY|FAM|REVOCABLE|IRREVOCABLE|LIVING|TRUSTEES?|ESTATE|EST)\b\.?",
    re.IGNORECASE,
)
PUNCT_RE = re.compile(r"[^\w\s]")
WHITESPACE_RE = re.compile(r"\s+")


def fuzzy_key(name: str) -> str:
    """Aggressive normalization for fuzzy matching."""
    if not name or pd.isna(name):
        return ""
    s = str(name).upper()
    s = s.replace("&", "AND")
    s = STRIP_TOKENS.sub("", s)
    s = PUNCT_RE.sub(" ", s)
    s = WHITESPACE_RE.sub(" ", s).strip()
    # Sort tokens to handle "SMITH JOHN" vs "JOHN SMITH"
    tokens = sorted(s.split())
    return " ".join(tokens)


def address_key(addr: str) -> str:
    """Normalize address for co-occurrence detection."""
    if not addr or pd.isna(addr):
        return ""
    s = str(addr).upper()
    # Strip common abbreviations
    for old, new in [(" STREET", " ST"), (" AVENUE", " AVE"), (" BOULEVARD", " BLVD"),
                     (" DRIVE", " DR"), (" ROAD", " RD"), (" LANE", " LN"),
                     (" COURT", " CT"), (" PLACE", " PL"), ("#", " UNIT ")]:
        s = s.replace(old, new)
    s = PUNCT_RE.sub(" ", s)
    s = WHITESPACE_RE.sub(" ", s).strip()
    return s


def enrich(df: pd.DataFrame, name_col: str = "owner_name",
           value_col: str = "market_value",
           address_col: str = "property_address",
           county_col: str = "county") -> Tuple[pd.DataFrame, dict]:
    if name_col not in df.columns:
        return df, {"n_input": len(df), "n_appended": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": f"no {name_col}"}
    df = df.copy()
    df["_fuzzy_owner_key"] = df[name_col].astype(str).map(fuzzy_key)

    # Optional second pass: co-resident addresses → same owner
    use_address = address_col in df.columns
    if use_address:
        df["_address_key"] = df[address_col].astype(str).map(address_key)
        # If two distinct fuzzy keys share same address, link them
        addr_to_keys = df[df["_address_key"] != ""].groupby("_address_key")["_fuzzy_owner_key"].agg(set)
        link_map = {}
        for keys in addr_to_keys:
            if len(keys) > 1:
                canonical = sorted(keys, key=len, reverse=True)[0]  # longest = most info
                for k in keys:
                    if k != canonical:
                        link_map[k] = canonical
        if link_map:
            df["_fuzzy_owner_key"] = df["_fuzzy_owner_key"].replace(link_map)

    # Aggregate by fuzzy key
    grp = df.groupby("_fuzzy_owner_key")
    counts = grp.size().rename("multi_property_count")
    df = df.merge(counts, left_on="_fuzzy_owner_key", right_index=True, how="left",
                  suffixes=("", "_dup"))
    if "multi_property_count_dup" in df.columns:
        df["multi_property_count"] = df["multi_property_count_dup"]
        df = df.drop(columns=["multi_property_count_dup"])

    if value_col in df.columns:
        df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
        totals = grp[value_col].sum().rename("total_property_value_usd")
        df = df.merge(totals, left_on="_fuzzy_owner_key", right_index=True, how="left",
                      suffixes=("", "_dup"))
        if "total_property_value_usd_dup" in df.columns:
            df["total_property_value_usd"] = df["total_property_value_usd_dup"]
            df = df.drop(columns=["total_property_value_usd_dup"])
    else:
        df["total_property_value_usd"] = pd.NA

    if county_col in df.columns:
        unique_counties = grp[county_col].nunique().rename("unique_counties_count")
        df = df.merge(unique_counties, left_on="_fuzzy_owner_key", right_index=True, how="left",
                      suffixes=("", "_dup"))
        if "unique_counties_count_dup" in df.columns:
            df["unique_counties_count"] = df["unique_counties_count_dup"]
            df = df.drop(columns=["unique_counties_count_dup"])
    else:
        df["unique_counties_count"] = 1

    # Concentration decile (rank by total value, normalized 0-1)
    if "total_property_value_usd" in df.columns:
        ranked = df["total_property_value_usd"].rank(pct=True, na_option="keep")
        df["property_concentration_decile"] = ranked.fillna(0.5)

    df = df.drop(columns=["_fuzzy_owner_key"], errors="ignore")
    df = df.drop(columns=["_address_key"], errors="ignore")
    n_multi = int((df["multi_property_count"] > 1).sum())

    return df, {
        "n_input": len(df), "n_appended": n_multi, "cost_usd": 0.0,
        "features_added": ["multi_property_count", "total_property_value_usd",
                            "unique_counties_count", "property_concentration_decile"],
        "n_multi_property_owners": int(df.loc[df["multi_property_count"] > 1, name_col].nunique()),
    }


if __name__ == "__main__":
    # Self-test
    df = pd.DataFrame([
        # Same owner, different LLC suffix variations
        {"owner_name": "ACME WIDGETS LLC", "market_value": 500_000, "county": "PIMA",
         "property_address": "123 Main St"},
        {"owner_name": "Acme Widgets, L.L.C.", "market_value": 750_000, "county": "MOHAVE",
         "property_address": "456 Elm Ave"},
        # Co-resident different name
        {"owner_name": "JOHN SMITH", "market_value": 300_000, "county": "PIMA",
         "property_address": "789 Oak Dr"},
        {"owner_name": "MARY SMITH", "market_value": 0, "county": "PIMA",
         "property_address": "789 Oak Dr"},  # spouse, same address
        # Singleton
        {"owner_name": "ACME WIDGETS LLC", "market_value": 1_200_000, "county": "SANTA CRUZ",
         "property_address": "111 Pine Ln"},  # also Acme — should aggregate
        {"owner_name": "BLUE SKY HOLDINGS INC", "market_value": 250_000, "county": "PIMA",
         "property_address": "222 Cedar Ct"},
    ])
    out, stats = enrich(df)
    print(out[["owner_name", "county", "multi_property_count", "total_property_value_usd",
               "unique_counties_count"]].to_string(index=False))
    print("\nStats:", stats)
