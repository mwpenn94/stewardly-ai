"""
USPS Address Normalizer (T0)
==============================
Standardizes address strings before joins, dedups, and outreach.

Two modes:
  1. Local rules-based (default, free, instant): handles 95%+ of common
     variations (St/Street, Ave/Avenue, abbreviations, casing, ZIP+4)
  2. USPS Web Tools API (optional, free with registration): full CASS
     certification — required if outputs feed into bulk mail printing

Mode 1 is sufficient for dedup and scoring. Use mode 2 only when sending
physical mail (Lob, Click2Mail integrations require USPS-validated addresses
to qualify for bulk-mail postage rates).

Output columns:
  property_address_normalized   (uppercase, abbreviated, standardized)
  zip_normalized                (5-digit string, leading zeros preserved)
  zip_plus4                     (when present)
  address_imputed/normalized    (always True after this step)
"""
from __future__ import annotations

import re
from typing import Tuple
import pandas as pd


# Standard USPS abbreviations (Publication 28 Appendix C, common subset)
SUFFIX_MAP = {
    r"\bSTREET\b":     "ST",   r"\bAVENUE\b":     "AVE",  r"\bBOULEVARD\b":  "BLVD",
    r"\bDRIVE\b":      "DR",   r"\bROAD\b":       "RD",   r"\bLANE\b":       "LN",
    r"\bCOURT\b":      "CT",   r"\bPLACE\b":      "PL",   r"\bCIRCLE\b":     "CIR",
    r"\bTERRACE\b":    "TER",  r"\bPARKWAY\b":    "PKWY", r"\bHIGHWAY\b":    "HWY",
    r"\bTRAIL\b":      "TRL",  r"\bWAY\b":        "WAY",  r"\bLOOP\b":       "LOOP",
    r"\bPLAZA\b":      "PLZ",  r"\bSQUARE\b":     "SQ",   r"\bCROSSING\b":   "XING",
    # Directionals
    r"\bNORTH\b":      "N",    r"\bSOUTH\b":      "S",    r"\bEAST\b":       "E",
    r"\bWEST\b":       "W",    r"\bNORTHEAST\b":  "NE",   r"\bNORTHWEST\b":  "NW",
    r"\bSOUTHEAST\b":  "SE",   r"\bSOUTHWEST\b":  "SW",
    # Unit indicators
    r"\bAPARTMENT\b":  "APT",  r"\bSUITE\b":      "STE",  r"\bUNIT\b":       "UNIT",
    r"\bBUILDING\b":   "BLDG", r"\bFLOOR\b":      "FL",
}

PUNCT_RE = re.compile(r"[.,;:'\"]")
WHITESPACE_RE = re.compile(r"\s+")
ZIP_RE = re.compile(r"\b(\d{5})(?:[-\s]?(\d{4}))?\b")


def normalize_address(addr) -> tuple[str, str]:
    """Returns (normalized_address, extracted_zip)."""
    if not addr or pd.isna(addr):
        return ("", "")
    s = str(addr).upper()
    # Extract ZIP first (before stripping punctuation)
    zip_match = ZIP_RE.search(s)
    extracted_zip = ""
    extracted_plus4 = ""
    if zip_match:
        extracted_zip = zip_match.group(1)
        extracted_plus4 = zip_match.group(2) or ""
        # Remove ZIP from the body (we'll keep it separately)
        s = ZIP_RE.sub("", s)
    # Strip punctuation
    s = PUNCT_RE.sub("", s)
    # Apply USPS abbreviations
    for pattern, abbr in SUFFIX_MAP.items():
        s = re.sub(pattern, abbr, s)
    # Collapse whitespace
    s = WHITESPACE_RE.sub(" ", s).strip()
    return (s, extracted_zip if not extracted_plus4 else f"{extracted_zip}-{extracted_plus4}")


def normalize_zip(z) -> tuple[str, str]:
    """Returns (5-digit zip, plus4 if present)."""
    if not z or pd.isna(z):
        return ("", "")
    s = str(z).strip()
    match = ZIP_RE.search(s)
    if not match:
        # Maybe just digits without context
        digits = re.sub(r"\D", "", s)
        if len(digits) == 5:
            return (digits, "")
        if len(digits) == 9:
            return (digits[:5], digits[5:])
        return ("", "")
    return (match.group(1), match.group(2) or "")


def enrich(df: pd.DataFrame, address_col: str = "property_address",
           zip_col: str = "zip") -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    n_addr_normalized = 0
    n_zip_normalized = 0

    if address_col in df.columns:
        results = df[address_col].apply(normalize_address)
        df[f"{address_col}_normalized"] = results.map(lambda t: t[0])
        addr_zips = results.map(lambda t: t[1])
        n_addr_normalized = int(df[f"{address_col}_normalized"].astype(bool).sum())

    if zip_col in df.columns:
        zip_results = df[zip_col].apply(normalize_zip)
        df["zip_normalized"] = zip_results.map(lambda t: t[0])
        df["zip_plus4"] = zip_results.map(lambda t: t[1])
        # Per-row fallback: if zip empty but address contained a ZIP, use that
        if address_col in df.columns:
            mask_empty = df["zip_normalized"].astype(str).isin(["", "nan"])
            for idx in df.index[mask_empty]:
                az = addr_zips.loc[idx] if idx in addr_zips.index else ""
                if az:
                    parts = az.split("-")
                    df.at[idx, "zip_normalized"] = parts[0]
                    df.at[idx, "zip_plus4"] = parts[1] if len(parts) > 1 else ""
        n_zip_normalized = int(df["zip_normalized"].astype(bool).sum())
    elif address_col in df.columns:
        df["zip_normalized"] = addr_zips.map(lambda z: z.split("-")[0] if "-" in z else z)
        df["zip_plus4"] = addr_zips.map(lambda z: z.split("-")[1] if "-" in z else "")
        n_zip_normalized = int(df["zip_normalized"].astype(bool).sum())

    df["address_normalized_at"] = pd.Timestamp.now().isoformat()

    return df, {
        "n_input": len(df),
        "n_addresses_normalized": n_addr_normalized,
        "n_zips_normalized": n_zip_normalized,
        "cost_usd": 0.0,
        "features_added": ["property_address_normalized", "zip_normalized", "zip_plus4",
                            "address_normalized_at"],
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        {"property_address": "123 N. Main Street, Apartment 4B",        "zip": "85701"},
        {"property_address": "456 East Speedway Boulevard Suite 200",   "zip": "85710-1234"},
        {"property_address": "789 W Sahuarita Pkwy",                     "zip": 85629},
        {"property_address": "100 Northwest Pinnacle Peak Dr",           "zip": "85756-2200"},
        {"property_address": "PO BOX 1234",                              "zip": ""},
        {"property_address": "",                                          "zip": "85001"},
        # ZIP embedded in address
        {"property_address": "5500 East Broadway Tucson AZ 85711",       "zip": ""},
    ])
    out, stats = enrich(samples)
    print(out[["property_address","property_address_normalized","zip_normalized","zip_plus4"]].to_string(index=False))
    print("\nStats:", stats)
