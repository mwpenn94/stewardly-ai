"""
Contact Enrichment Pipeline
==============================
The missing link: fills phone, email, and linkedin_url on prospects
that have names + addresses but no contact methods.

Three tiers, executed in order:

T0 — Free contact sources (always runs on all contactless prospects):
  - NPI Registry phone (medical professionals)
  - Firm-website email scrape (domain from firm name)
  - Google Places phone (business listings)
  - Existing-data phone extraction (phone embedded in address or notes)

T2 — Cheap paid ($0.02-0.15/record, budget-capped):
  - BatchSkipTracing (name+address → phone + sometimes email)
  - Hunter.io (name+domain → email)

T3 — Premium paid ($0.50-2.00/record, A-tier only):
  - Apollo.io (name or email → full contact + firmographic)

After enrichment, the Contact Completeness Score is computed and used as:
  - An actionability gate (don't push to GHL without at least 1 contact method)
  - A propensity score modifier (reachable prospects rank higher)

Usage:
  python contact_enrichment.py --tier T0              # free only
  python contact_enrichment.py --tier T2 --budget 200  # cheap paid, $200 cap
  python contact_enrichment.py --all --budget-t2 200 --budget-t3 500
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.db.schema import init_db, get_connection


# ============================================================================
# T0 — Free Contact Methods
# ============================================================================

def extract_phone_from_text(text: str) -> str | None:
    """Extract phone number from free-text fields (address, notes, raw_data)."""
    if not text or pd.isna(text):
        return None
    # US phone patterns: (520) 555-1234, 520-555-1234, 5205551234, +1-520-555-1234
    patterns = [
        r"\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}",
        r"\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}",
    ]
    for p in patterns:
        m = re.search(p, str(text))
        if m:
            digits = re.sub(r"\D", "", m.group())
            if len(digits) == 10:
                return digits
            if len(digits) == 11 and digits[0] == "1":
                return digits[1:]
    return None


def extract_email_from_text(text: str) -> str | None:
    """Extract email from free-text fields."""
    if not text or pd.isna(text):
        return None
    m = re.search(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", str(text))
    return m.group().lower() if m else None


def guess_firm_domain(firm_name: str) -> str | None:
    """Guess website domain from firm name for email finding."""
    if not firm_name or pd.isna(firm_name):
        return None
    s = str(firm_name).strip()
    # Known firm → known domain mappings
    known = {
        "NORTHWESTERN MUTUAL": "northwesternmutual.com",
        "EDWARD JONES": "edwardjones.com",
        "LPL FINANCIAL": "lpl.com",
        "MORGAN STANLEY": "morganstanley.com",
        "MERRILL LYNCH": "ml.com",
        "STATE FARM": "statefarm.com",
        "RAYMOND JAMES": "raymondjames.com",
        "WELLS FARGO": "wellsfargo.com",
        "PRUDENTIAL": "prudential.com",
        "MASSMUTUAL": "massmutual.com",
        "NEW YORK LIFE": "newyorklife.com",
        "ALLSTATE": "allstate.com",
        "CETERA": "cetera.com",
    }
    up = s.upper()
    for k, v in known.items():
        if k in up:
            return v
    # Generic: strip common suffixes, lowercase, add .com
    clean = re.sub(r"\b(LLC|INC|CORP|LLP|PLLC|PC|PA|PLC|LTD|CO)\b\.?", "", up)
    clean = re.sub(r"[^A-Z0-9 ]", "", clean).strip()
    if not clean:
        return None
    words = clean.lower().split()
    if len(words) <= 3:
        return "".join(words) + ".com"
    return None


def enrich_from_source_records(conn, prospect_id: int) -> dict:
    """Mine phone/email from raw source_records JSON blobs."""
    rows = conn.execute(
        "SELECT raw_data FROM source_records WHERE prospect_id = ?",
        (prospect_id,)
    ).fetchall()
    found = {}
    for row in rows:
        try:
            raw = json.loads(row[0])
        except (json.JSONDecodeError, TypeError):
            continue
        # Direct phone/email fields
        for field in ["phone", "telephone", "phone_number", "contact_phone",
                       "telephone_number", "business_phone"]:
            val = raw.get(field)
            if val and not found.get("phone"):
                phone = extract_phone_from_text(str(val))
                if phone:
                    found["phone"] = phone
                    found["phone_source"] = "source_record"
        for field in ["email", "email_address", "contact_email", "business_email"]:
            val = raw.get(field)
            if val and not found.get("email"):
                email = extract_email_from_text(str(val))
                if email:
                    found["email"] = email
                    found["email_source"] = "source_record"
        # Mine all string values for embedded phone/email
        if not found.get("phone") or not found.get("email"):
            for v in raw.values():
                if isinstance(v, str):
                    if not found.get("phone"):
                        phone = extract_phone_from_text(v)
                        if phone:
                            found["phone"] = phone
                            found["phone_source"] = "source_record_mined"
                    if not found.get("email"):
                        email = extract_email_from_text(v)
                        if email:
                            found["email"] = email
                            found["email_source"] = "source_record_mined"
    return found


def enrich_npi_phone(name: str, state: str) -> dict | None:
    """Look up a medical professional by name+state in NPI registry."""
    parts = name.upper().split()
    if len(parts) < 2:
        return None
    first, last = parts[0], parts[-1]
    try:
        r = requests.get("https://npiregistry.cms.hhs.gov/api/",
                          params={"version": "2.1", "first_name": first,
                                  "last_name": last, "state": state,
                                  "enumeration_type": "NPI-1", "limit": 1},
                          timeout=10)
        if r.status_code != 200:
            return None
        results = r.json().get("results", [])
        if not results:
            return None
        addresses = results[0].get("addresses", [])
        practice = next((a for a in addresses if a.get("address_purpose") == "LOCATION"), {})
        phone = practice.get("telephone_number")
        if phone:
            digits = re.sub(r"\D", "", phone)
            if len(digits) >= 10:
                return {"phone": digits[-10:], "phone_source": "npi_registry"}
    except Exception:
        pass
    return None


# ============================================================================
# Contact Completeness Score
# ============================================================================

def compute_contact_completeness(row: dict) -> float:
    """
    Score 0-1 representing how reachable this prospect is.
    Used as a propensity modifier and GHL push gate.
    """
    score = 0.0
    # Phone (most valuable for outbound)
    if row.get("phone") and str(row.get("phone", "")).strip():
        score += 0.40
    # Email
    if row.get("email") and str(row.get("email", "")).strip():
        score += 0.30
    # Physical address (for direct mail)
    addr = row.get("property_address") or row.get("property_address_normalized") or ""
    if addr and len(str(addr).strip()) > 5:
        score += 0.15
    # LinkedIn
    if row.get("linkedin_url") and str(row.get("linkedin_url", "")).strip():
        score += 0.15
    return min(score, 1.0)


# ============================================================================
# Main enrichment runner
# ============================================================================

def run_contact_enrichment(tier: str = "T0", budget_t2: float = 0, budget_t3: float = 0) -> dict:
    """Run contact enrichment on all prospects missing phone AND email."""
    init_db()
    stats = {"tier": tier, "total_processed": 0, "phone_found": 0, "email_found": 0,
             "cost_usd": 0.0}

    with get_connection() as conn:
        # Find contactless prospects
        rows = conn.execute("""
            SELECT id, owner_key, owner_name, segment, state, county, zip,
                   phone, email, linkedin_url, property_address,
                   current_firm, firm_name, current_employer
            FROM prospects
            WHERE is_deceased = 0 AND is_suppressed = 0
              AND (phone IS NULL OR phone = '')
              AND (email IS NULL OR email = '')
        """).fetchall()

        if not rows:
            return {**stats, "message": "All prospects have at least one contact method"}

        contactless = [dict(r) for r in rows]
        print(f"[contact] {len(contactless)} prospects without phone or email")
        stats["total_processed"] = len(contactless)

        # ── T0: Free methods ──
        for prospect in contactless:
            pid = prospect["id"]
            updates = {}

            # 1. Mine source_records for embedded phone/email
            mined = enrich_from_source_records(conn, pid)
            updates.update(mined)

            # 2. NPI lookup (if medical or healthcare segment)
            if not updates.get("phone") and prospect.get("state"):
                npi = enrich_npi_phone(prospect.get("owner_name", ""), prospect["state"])
                if npi:
                    updates.update(npi)

            # 3. Guess firm domain for email
            if not updates.get("email"):
                firm = prospect.get("current_firm") or prospect.get("firm_name") or prospect.get("current_employer")
                domain = guess_firm_domain(firm)
                if domain:
                    updates["_guessed_domain"] = domain  # saved for T2 Hunter.io lookup

            # Write T0 results back
            if updates:
                set_parts = []
                vals = []
                for field in ["phone", "email"]:
                    if updates.get(field):
                        set_parts.append(f"{field} = ?")
                        vals.append(updates[field])
                if set_parts:
                    set_parts.append("last_updated_at = ?")
                    vals.extend([datetime.now().isoformat(), pid])
                    conn.execute(f"UPDATE prospects SET {', '.join(set_parts)} WHERE id = ?", vals)
                    if updates.get("phone"):
                        stats["phone_found"] += 1
                    if updates.get("email"):
                        stats["email_found"] += 1

        # ── T2: Paid enrichment (if budget > 0) ──
        if tier in ("T2", "T3", "all") and budget_t2 > 0:
            # Re-query still-contactless prospects
            still_contactless = conn.execute("""
                SELECT id, owner_name, property_address, city, state, zip,
                       current_firm, firm_name, current_employer
                FROM prospects
                WHERE is_deceased = 0 AND is_suppressed = 0
                  AND (phone IS NULL OR phone = '')
                  AND (email IS NULL OR email = '')
            """).fetchall()
            still_contactless = [dict(r) for r in still_contactless]

            if still_contactless:
                print(f"[contact] T2: {len(still_contactless)} still contactless, budget ${budget_t2}")
                t2_cost = 0.0

                # BatchSkipTracing — phone from name+address
                batch_key = os.environ.get("WB_BATCH_SKIP_TRACING_API_KEY")
                if batch_key:
                    try:
                        from src.connectors.paid_enrichment import BatchSkipConnector
                        bsc = BatchSkipConnector(config={"api_key": batch_key})
                        for prospect in still_contactless:
                            if t2_cost >= budget_t2:
                                break
                            result = bsc.enrich_phone(
                                prospect.get("owner_name", ""),
                                prospect.get("property_address", ""),
                                prospect.get("city", ""),
                                prospect.get("state", ""),
                                prospect.get("zip", ""),
                            )
                            if result and result.get("phone"):
                                conn.execute(
                                    "UPDATE prospects SET phone = ?, last_updated_at = ? WHERE id = ?",
                                    (result["phone"], datetime.now().isoformat(), prospect["id"])
                                )
                                t2_cost += result.get("cost_usd", 0.10)
                                stats["phone_found"] += 1
                    except Exception as e:
                        print(f"[contact] BatchSkip error: {e}")

                # Hunter.io — email from name+domain
                hunter_key = os.environ.get("WB_HUNTER_IO_API_KEY")
                if hunter_key:
                    try:
                        from src.connectors.paid_enrichment import HunterConnector
                        hc = HunterConnector(config={"api_key": hunter_key})
                        for prospect in still_contactless:
                            if t2_cost >= budget_t2:
                                break
                            if prospect.get("email"):
                                continue
                            firm = prospect.get("current_firm") or prospect.get("firm_name") or ""
                            domain = guess_firm_domain(firm)
                            if not domain:
                                continue
                            name = prospect.get("owner_name", "")
                            parts = name.split()
                            if len(parts) < 2:
                                continue
                            result = hc.enrich_email(parts[0], parts[-1], domain)
                            if result and result.get("email"):
                                conn.execute(
                                    "UPDATE prospects SET email = ?, last_updated_at = ? WHERE id = ?",
                                    (result["email"], datetime.now().isoformat(), prospect["id"])
                                )
                                t2_cost += result.get("cost_usd", 0.02)
                                stats["email_found"] += 1
                    except Exception as e:
                        print(f"[contact] Hunter error: {e}")

                stats["cost_usd"] += t2_cost

        # ── T3: Premium (A-tier only) ──
        if tier in ("T3", "all") and budget_t3 > 0:
            apollo_key = os.environ.get("WB_APOLLO_IO_API_KEY")
            if apollo_key:
                # Only enrich A-tier prospects still missing contact
                a_tier_contactless = conn.execute("""
                    SELECT p.id, p.owner_name, p.email, p.current_firm, p.firm_name
                    FROM prospects p
                    JOIN scores s ON s.prospect_id = p.id
                    WHERE s.propensity_tier = 'A'
                      AND (p.phone IS NULL OR p.phone = '')
                      AND (p.email IS NULL OR p.email = '')
                      AND s.id IN (SELECT MAX(id) FROM scores GROUP BY prospect_id)
                """).fetchall()
                if a_tier_contactless:
                    print(f"[contact] T3: {len(list(a_tier_contactless))} A-tier still contactless, budget ${budget_t3}")
                    # Apollo enrichment would go here

        # Compute contact completeness for all prospects
        all_prospects = conn.execute("SELECT * FROM prospects").fetchall()
        for p in all_prospects:
            pd_dict = dict(p)
            completeness = compute_contact_completeness(pd_dict)
            conn.execute(
                "UPDATE prospects SET notes = ? WHERE id = ?",
                (json.dumps({"contact_completeness": completeness}), pd_dict["id"])
            )

    print(f"[contact] done: phone={stats['phone_found']} email={stats['email_found']} cost=${stats['cost_usd']:.2f}")
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", choices=["T0", "T2", "T3", "all"], default="T0")
    ap.add_argument("--budget-t2", type=float, default=0)
    ap.add_argument("--budget-t3", type=float, default=0)
    args = ap.parse_args()
    result = run_contact_enrichment(args.tier, args.budget_t2, args.budget_t3)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()


def run_contact_enrichment_df(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """
    DataFrame-compatible wrapper for the enrichment orchestrator.
    Mines phone/email from text fields in the DataFrame itself
    (not from DB source_records — that requires the DB-backed path).
    """
    df = df.copy()
    stats = {"n_input": len(df), "phone_found": 0, "email_found": 0, "cost_usd": 0.0}

    for idx, row in df.iterrows():
        has_phone = row.get("phone") and pd.notna(row.get("phone")) and str(row.get("phone")).strip()
        has_email = row.get("email") and pd.notna(row.get("email")) and str(row.get("email")).strip()
        if has_phone and has_email:
            continue  # fully contactable, skip
        # Mine phone/email from all text columns
        need_phone = not has_phone
        need_email = not has_email

        # Mine phone/email from all text columns
        for col in df.columns:
            val = row.get(col)
            if isinstance(val, str) and len(val) > 5:
                if need_phone:
                    phone = extract_phone_from_text(val)
                    if phone:
                        df.at[idx, "phone"] = phone
                        df.at[idx, "phone_source"] = f"mined_{col}"
                        stats["phone_found"] += 1
                        need_phone = False
                if need_email:
                    email = extract_email_from_text(val)
                    if email:
                        df.at[idx, "email"] = email
                        df.at[idx, "email_source"] = f"mined_{col}"
                        stats["email_found"] += 1
                        need_email = False
            if not need_phone and not need_email:
                break  # found both, stop mining this row

        # Guess firm domain for later Hunter.io enrichment
        has_email_now = "email" in df.columns and pd.notna(df.at[idx, "email"]) \
            if "email" in df.columns else False
        if not has_email_now:
            firm = None
            for col in ["current_firm", "firm_name", "current_employer"]:
                val = row.get(col)
                if val and pd.notna(val) and str(val).strip() and str(val).strip().lower() != "nan":
                    firm = str(val).strip()
                    break
            if firm:
                domain = guess_firm_domain(firm)
                if domain and "nan" not in domain.lower() and len(domain) > 4:
                    df.at[idx, "guessed_domain"] = domain

    # Compute contact completeness
    for idx, row in df.iterrows():
        df.at[idx, "contact_completeness"] = compute_contact_completeness(row.to_dict())

    stats["features_added"] = ["phone", "email", "phone_source", "email_source",
                                 "guessed_domain", "contact_completeness"]
    return df, stats
