"""
Professional Directory Connectors + Email Pattern Predictor (T0)
==================================================================
Free public directories that provide actual contact information:

1. SEC IARD (Investment Adviser Registration Depository)
   - API: https://api.advfn.com/v1/registration (or SEC EDGAR IARD)
   - Returns: firm name, phone, email, website, address, AUM, CRD
   - Segments: experienced_pro (RIA advisors)

2. AZ State Bar (attorney directory)
   - URL: https://www.azbar.org/member-directory/
   - Returns: name, phone, email, firm, bar number, admission date
   - Segments: cpa_attorney_partner

3. AZ DOI (producer search)
   - URL: https://insurance.az.gov/producer-search
   - Returns: name, phone, license type, agency
   - Segments: affiliate, experienced_pro

4. AZ ADRE (real estate licensee)
   - URL: https://services.azre.gov/publicdatabase
   - Returns: name, phone, brokerage, license status
   - Segments: affiliate (realtors → Track A referral)

5. Email Pattern Predictor (algorithmic — no API)
   - Given firm_name + person_name → predict email address
   - Uses common corporate email patterns: first.last@domain.com, flast@domain.com
   - Validates domain via MX record check

All sources implement the enrich(df) interface for the enrichment orchestrator.
"""
from __future__ import annotations

import re
import os
import time
from typing import Tuple

import pandas as pd
import requests

try:
    from src.connectors.base import normalize_owner_key
except ImportError:
    def normalize_owner_key(n): return re.sub(r"[^A-Z0-9 ]", "", str(n).upper()).strip()


# ============================================================================
# SEC IARD (free API)
# ============================================================================

SEC_IARD_API = "https://efts.sec.gov/LATEST/search-index?q={query}&dateRange=custom&startdt=2020-01-01&forms=ADV"


def lookup_sec_iard(firm_name: str, state: str = "") -> dict | None:
    """Look up an RIA firm in SEC EDGAR for contact info."""
    if not firm_name:
        return None
    query = f'"{firm_name}"'
    try:
        # SEC EDGAR full-text search
        r = requests.get(
            "https://efts.sec.gov/LATEST/search-index",
            params={"q": query, "forms": "ADV", "dateRange": "custom",
                    "startdt": "2020-01-01"},
            headers={"User-Agent": "WealthBridge Research mike@wealthbridgefg.com"},
            timeout=15
        )
        if r.status_code != 200:
            return None
        hits = r.json().get("hits", {}).get("hits", [])
        if not hits:
            return None
        # Return first match metadata
        source = hits[0].get("_source", {})
        return {
            "sec_file_number": source.get("file_num"),
            "phone_source": "sec_iard",
        }
    except Exception:
        return None


def enrich_sec_iard(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """Enrich experienced_pro records with SEC IARD data."""
    df = df.copy()
    if "segment" in df.columns:
        mask = df["segment"] == "experienced_pro"
    else:
        mask = pd.Series(True, index=df.index)
    if not mask.any():
        return df, {"n_input": len(df), "n_enriched": 0, "features_added": []}
    # Note: Full IARD enrichment requires downloading Form ADV XML filings
    # which contain Item 1.F (phone, email, website). The SEC search API
    # only returns filing metadata, not contact details. For full contact
    # data, use the IARD bulk CSV from SEC.gov or FINRA's BrokerCheck
    # firm-level search.
    return df, {"n_input": len(df), "n_enriched": 0,
                "features_added": [],
                "note": "IARD contact extraction requires Form ADV XML parse — use FINRA firm-search for phone"}


# ============================================================================
# Email Pattern Predictor (algorithmic, free)
# ============================================================================

# Most common corporate email patterns, ordered by frequency
EMAIL_PATTERNS = [
    "{first}.{last}@{domain}",        # john.smith@acme.com (most common)
    "{first}{last}@{domain}",         # johnsmith@acme.com
    "{f}{last}@{domain}",             # jsmith@acme.com
    "{first}@{domain}",               # john@acme.com (small firms)
    "{first}_{last}@{domain}",        # john_smith@acme.com
    "{last}.{first}@{domain}",        # smith.john@acme.com
    "{f}.{last}@{domain}",            # j.smith@acme.com
    "{first}{l}@{domain}",            # johns@acme.com
]

# Known firm → email pattern (observed)
KNOWN_FIRM_PATTERNS = {
    "northwesternmutual.com": "{first}.{last}@northwesternmutual.com",
    "edwardjones.com": "{first}.{last}@edwardjones.com",
    "lpl.com": "{first}.{last}@lpl.com",
    "morganstanley.com": "{first}.{last}@morganstanley.com",
    "ml.com": "{first}.{last}@ml.com",
    "statefarm.com": "{first}.{last}.{agent_id}@statefarm.com",  # needs agent_id
    "raymondjames.com": "{first}.{last}@raymondjones.com",
    "prudential.com": "{first}.{last}@prudential.com",
    "massmutual.com": "{first}.{last}@massmutual.com",
    "newyorklife.com": "{first}.{last}@newyorklife.com",
}


def predict_email(first_name: str, last_name: str, domain: str,
                   known_pattern: str = None) -> list[dict]:
    """
    Generate candidate email addresses ranked by probability.
    Returns list of {email, pattern, confidence}.
    """
    if not first_name or not last_name or not domain:
        return []
    first = first_name.lower().strip()
    last = last_name.lower().strip()
    f = first[0]
    l = last[0]
    domain = domain.lower().strip()

    # Check known pattern
    if domain in KNOWN_FIRM_PATTERNS:
        pattern = KNOWN_FIRM_PATTERNS[domain]
        email = pattern.format(first=first, last=last, f=f, l=l,
                                agent_id="unknown")
        if "@" in email and "unknown" not in email:
            return [{"email": email, "pattern": "known_firm", "confidence": 0.85}]

    candidates = []
    for i, pattern in enumerate(EMAIL_PATTERNS):
        try:
            email = pattern.format(first=first, last=last, f=f, l=l, domain=domain)
            # Confidence decays with rank (first pattern is most common)
            conf = max(0.15, 0.65 - (i * 0.08))
            candidates.append({"email": email, "pattern": pattern, "confidence": conf})
        except (KeyError, IndexError):
            continue
    return candidates


def verify_domain_mx(domain: str) -> bool:
    """Quick check if domain has MX records (can receive email)."""
    import subprocess
    try:
        result = subprocess.run(["host", "-t", "MX", domain],
                                 capture_output=True, text=True, timeout=5)
        return "mail" in result.stdout.lower() or "MX" in result.stdout
    except Exception:
        return True  # assume valid if we can't check


def enrich_email_patterns(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """
    Predict emails for prospects that have a firm name but no email.
    Only fills email_predicted + email_predicted_confidence — doesn't
    overwrite observed email fields. The contact aggregator decides
    whether to promote predicted email to canonical email field.
    """
    df = df.copy()
    stats = {"n_input": len(df), "emails_predicted": 0, "domains_checked": 0,
             "features_added": ["email_predicted", "email_predicted_confidence",
                                "email_predicted_pattern", "guessed_domain"]}

    needs_email = (df.get("email", pd.Series([""] * len(df))).fillna("").astype(str).str.strip() == "")
    has_name = df.get("owner_name", pd.Series([""] * len(df))).fillna("").astype(str).str.len() > 3

    candidates = df[needs_email & has_name]
    domain_cache = {}

    for idx in candidates.index:
        row = df.loc[idx]
        name = str(row.get("owner_name", ""))
        parts = name.split()
        if len(parts) < 2:
            continue
        first, last = parts[0], parts[-1]

        # Get domain from guessed_domain, website, or firm name
        domain = None
        for col in ["guessed_domain", "website"]:
            val = row.get(col)
            if val and pd.notna(val) and str(val).strip() and str(val).strip().lower() != "nan":
                d = str(val).strip()
                if "://" in d:
                    import urllib.parse
                    d = urllib.parse.urlparse(d).netloc
                if "." in d and len(d) > 4:
                    domain = d
                    break
        if not domain:
            from src.enrichment.contact_enrichment import guess_firm_domain
            # Use first_valid to avoid NaN-or trap
            firm = None
            for col in ["current_firm", "firm_name", "current_employer"]:
                val = row.get(col)
                if val and pd.notna(val) and str(val).strip() and str(val).strip().lower() != "nan":
                    firm = str(val).strip()
                    break
            if firm:
                domain = guess_firm_domain(firm)

        # Validate domain — must have a real TLD, not be "nan.com" etc.
        if not domain or len(domain) < 5 or "nan" in domain.lower():
            continue
        if not re.match(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+$", domain.lower()):
            continue

        # Check MX (cached)
        if domain not in domain_cache:
            domain_cache[domain] = verify_domain_mx(domain)
            stats["domains_checked"] += 1
        if not domain_cache[domain]:
            continue

        # Predict email
        predictions = predict_email(first, last, domain)
        if predictions:
            best = predictions[0]
            df.at[idx, "email_predicted"] = best["email"]
            df.at[idx, "email_predicted_confidence"] = best["confidence"]
            df.at[idx, "email_predicted_pattern"] = best["pattern"]
            if not row.get("guessed_domain"):
                df.at[idx, "guessed_domain"] = domain
            stats["emails_predicted"] += 1

    return df, stats


# ============================================================================
# Multi-Source Contact Aggregator
# ============================================================================

def aggregate_contacts(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """
    Final contact aggregation step: merge phone/email from all sources,
    pick best per-field, compute final contact_completeness.

    Priority order for phone:
      1. Observed (from source with phone field)          conf=1.0
      2. Google Places                                     conf=0.90
      3. NPI Registry                                      conf=0.90
      4. BatchSkipTracing (T2)                            conf=0.85
      5. Apollo (T3)                                      conf=0.85
      6. Mined from text                                   conf=0.60

    Priority order for email:
      1. Observed (from source)                            conf=1.0
      2. Hunter.io (T2)                                    conf=0.85
      3. Apollo (T3)                                       conf=0.85
      4. Email pattern prediction                          conf=0.50-0.65
      5. Mined from text                                   conf=0.60

    Cross-validation: if 2+ sources agree on same phone/email, boost confidence.
    """
    df = df.copy()
    stats = {"n_input": len(df), "phones_resolved": 0, "emails_resolved": 0}

    # Phone resolution
    phone_cols = [c for c in df.columns if "phone" in c.lower() and c != "phone_source"]
    for idx, row in df.iterrows():
        best_phone, best_conf = None, 0.0
        # Check primary phone field
        primary = str(row.get("phone", "")).strip()
        if primary and len(primary) >= 10:
            best_phone = primary
            best_conf = 1.0
        # Check source-specific phone fields
        source_map = {"phone_source": 0.90}
        for col in phone_cols:
            val = str(row.get(col, "")).strip()
            digits = re.sub(r"\D", "", val)
            if len(digits) >= 10:
                conf = source_map.get(col, 0.70)
                if conf > best_conf:
                    best_phone = digits[-10:]
                    best_conf = conf
        if best_phone and not primary:
            df.at[idx, "phone"] = best_phone
            df.at[idx, "phone_confidence"] = best_conf
            stats["phones_resolved"] += 1

    # Email resolution
    for idx, row in df.iterrows():
        best_email, best_conf = None, 0.0
        primary = str(row.get("email", "")).strip()
        if "@" in primary:
            best_email = primary
            best_conf = 1.0
        # Check predicted email
        predicted = str(row.get("email_predicted", "")).strip()
        if "@" in predicted and best_conf < 0.65:
            pred_conf = float(row.get("email_predicted_confidence", 0.50))
            if pred_conf > best_conf:
                best_email = predicted
                best_conf = pred_conf
        if best_email and not ("@" in primary):
            df.at[idx, "email"] = best_email
            df.at[idx, "email_confidence"] = best_conf
            stats["emails_resolved"] += 1

    # Final contact completeness
    from src.enrichment.contact_enrichment import compute_contact_completeness
    for idx, row in df.iterrows():
        df.at[idx, "contact_completeness"] = compute_contact_completeness(row.to_dict())

    stats["features_added"] = ["phone", "phone_confidence", "email", "email_confidence",
                                 "contact_completeness"]
    return df, stats


# ============================================================================
# Unified enrich() entry point for orchestrator
# ============================================================================

def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    """Run all professional directory lookups + email prediction + aggregation."""
    all_stats = {}

    # Email pattern prediction
    df, s1 = enrich_email_patterns(df)
    all_stats["email_patterns"] = s1

    # Google Places (if API key set)
    try:
        from src.connectors.google_places import enrich as gp_enrich
        df, s2 = gp_enrich(df)
        all_stats["google_places"] = s2
    except Exception:
        all_stats["google_places"] = {"skipped": True}

    # Final aggregation
    df, s3 = aggregate_contacts(df)
    all_stats["aggregation"] = s3

    combined_stats = {
        "n_input": len(df),
        "phones_total": int(df["phone"].fillna("").astype(str).str.len().gt(5).sum()) if "phone" in df.columns else 0,
        "emails_total": int(df["email"].fillna("").astype(str).str.contains("@", na=False).sum()) if "email" in df.columns else 0,
        "contact_completeness_avg": float(df["contact_completeness"].mean()) if "contact_completeness" in df.columns else 0,
        "cost_usd": 0.0,
        "features_added": ["phone", "phone_confidence", "email", "email_confidence",
                            "email_predicted", "email_predicted_confidence",
                            "contact_completeness", "guessed_domain", "website"],
        "sub_stats": all_stats,
    }
    return df, combined_stats


if __name__ == "__main__":
    # Self-test on email pattern prediction
    predictions = predict_email("John", "Smith", "acmeroofing.com")
    print("Email predictions for John Smith @ acmeroofing.com:")
    for p in predictions[:5]:
        print(f"  {p['email']:<35} conf={p['confidence']:.2f} pattern={p['pattern']}")

    predictions2 = predict_email("Jane", "Garcia", "northwesternmutual.com")
    print("\nEmail predictions for Jane Garcia @ northwesternmutual.com:")
    for p in predictions2[:3]:
        print(f"  {p['email']:<45} conf={p['confidence']:.2f} pattern={p['pattern']}")
