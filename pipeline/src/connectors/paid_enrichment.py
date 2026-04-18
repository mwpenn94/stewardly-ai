"""
Paid Enrichment Connectors (T2/T3)
=====================================
API connectors for paid data vendors. Each enforces a budget cap and
tracks cumulative cost. All require API keys via environment variables
or config.

Usage pattern:
  1. Set API key: export WB_HUNTER_IO_API_KEY=xxx
  2. Enable in registry: SOURCE_REGISTRY["hunter_io"]["enabled"] = True
  3. Set budget: SOURCE_REGISTRY["hunter_io"]["config"]["budget_usd"] = 100
  4. Run ingestion engine — connector auto-stops at budget cap
"""
from __future__ import annotations

import os
import time
from datetime import datetime

import pandas as pd
import requests

try:
    from src.connectors.base import BaseConnector, normalize_owner_key
except ImportError:
    from base import BaseConnector, normalize_owner_key


# ============================================================================
# Hunter.io (Email Finder) — T2
# ============================================================================

class HunterConnector(BaseConnector):
    """
    Finds professional email addresses using Hunter.io API.
    Cost: ~$0.01-0.03 per search (depends on plan).
    Enriches prospects that have owner_name + company/domain but no email.
    """
    source_type = "hunter_io"
    source_name = "Hunter.io Email Finder"
    tier = "T2"
    requires_api_key = True
    rate_limit_per_second = 10.0
    default_cadence_hours = 168  # weekly

    API = "https://api.hunter.io/v2"

    def _get_key(self) -> str:
        return self.config.get("api_key") or os.environ.get("WB_HUNTER_IO_API_KEY", "")

    def test_connection(self) -> bool:
        key = self._get_key()
        if not key: return False
        try:
            r = requests.get(f"{self.API}/account", params={"api_key": key}, timeout=10)
            return r.status_code == 200
        except Exception:
            return False

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        # Hunter is an enrichment API — it doesn't return records on its own.
        # Instead, it enriches existing prospect records. The ingestion engine
        # calls this with a DF of prospects needing email enrichment.
        return pd.DataFrame()  # no standalone fetch

    def normalize(self, df):
        return df

    def enrich_email(self, first_name: str, last_name: str, domain: str) -> dict | None:
        """Find email for a person at a domain. Returns {email, confidence, cost}."""
        key = self._get_key()
        if not key: return None
        self._rate_limit()
        params = {"domain": domain, "first_name": first_name,
                  "last_name": last_name, "api_key": key}
        try:
            r = requests.get(f"{self.API}/email-finder", params=params, timeout=15)
            r.raise_for_status()
            data = r.json().get("data", {})
            if data.get("email"):
                return {
                    "email": data["email"],
                    "confidence": data.get("score", 0) / 100,
                    "cost_usd": 0.02,  # approx per-search cost
                }
        except Exception:
            pass
        return None

    def enrich_batch(self, prospects: pd.DataFrame, budget_usd: float = 100.0) -> tuple[pd.DataFrame, dict]:
        """Enrich email for a batch of prospects within budget."""
        prospects = prospects.copy()
        total_cost = 0.0
        enriched_count = 0
        for idx, row in prospects.iterrows():
            if total_cost >= budget_usd:
                break
            if row.get("email") and pd.notna(row.get("email")):
                continue  # already has email
            name = str(row.get("owner_name", ""))
            parts = name.split()
            if len(parts) < 2: continue
            first, last = parts[0], parts[-1]
            # Try firm domain
            firm = str(row.get("current_firm") or row.get("firm_name") or "")
            if not firm: continue
            domain = firm.lower().replace(" ", "") + ".com"  # naive domain guess
            result = self.enrich_email(first, last, domain)
            if result:
                prospects.at[idx, "email"] = result["email"]
                prospects.at[idx, "email_confidence"] = result["confidence"]
                prospects.at[idx, "email_source"] = "hunter_io"
                total_cost += result["cost_usd"]
                enriched_count += 1
        return prospects, {"enriched": enriched_count, "cost_usd": total_cost,
                           "budget_remaining": budget_usd - total_cost}


# ============================================================================
# BatchSkipTracing (Phone Append) — T2
# ============================================================================

class BatchSkipConnector(BaseConnector):
    """
    Appends phone numbers using BatchSkipTracing / BatchData API.
    Cost: ~$0.05-0.15 per record.
    """
    source_type = "batch_skip_tracing"
    source_name = "BatchSkipTracing Phone Append"
    tier = "T2"
    requires_api_key = True
    rate_limit_per_second = 5.0
    default_cadence_hours = 168

    API = "https://api.batchdata.com/api/v1/property/skip-trace"

    def _get_key(self) -> str:
        return self.config.get("api_key") or os.environ.get("WB_BATCH_SKIP_TRACING_API_KEY", "")

    def test_connection(self) -> bool:
        return bool(self._get_key())

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        return pd.DataFrame()  # enrichment only

    def normalize(self, df):
        return df

    def enrich_phone(self, name: str, address: str, city: str, state: str, zip_code: str) -> dict | None:
        key = self._get_key()
        if not key: return None
        self._rate_limit()
        payload = {"requests": [{"name": name, "address": {"street": address,
                    "city": city, "state": state, "zip": zip_code}}]}
        try:
            r = requests.post(self.API, json=payload, timeout=20,
                              headers={"Authorization": f"Bearer {key}"})
            r.raise_for_status()
            results = r.json().get("results", {}).get("persons", [])
            if results:
                phones = results[0].get("phoneNumbers", [])
                if phones:
                    return {
                        "phone": phones[0].get("number"),
                        "phone_type": phones[0].get("type", ""),
                        "cost_usd": 0.10,
                    }
        except Exception:
            pass
        return None

    def enrich_batch(self, prospects: pd.DataFrame, budget_usd: float = 200.0) -> tuple[pd.DataFrame, dict]:
        prospects = prospects.copy()
        total_cost = 0.0
        enriched_count = 0
        for idx, row in prospects.iterrows():
            if total_cost >= budget_usd:
                break
            if row.get("phone") and pd.notna(row.get("phone")):
                continue
            name = str(row.get("owner_name", ""))
            addr = str(row.get("property_address") or row.get("property_address_normalized") or "")
            city = str(row.get("city", ""))
            state = str(row.get("state", ""))
            zip_code = str(row.get("zip") or row.get("zip_normalized") or "")
            if not name or not addr: continue
            result = self.enrich_phone(name, addr, city, state, zip_code)
            if result:
                prospects.at[idx, "phone"] = result["phone"]
                prospects.at[idx, "phone_source"] = "batch_skip_tracing"
                total_cost += result["cost_usd"]
                enriched_count += 1
        return prospects, {"enriched": enriched_count, "cost_usd": total_cost,
                           "budget_remaining": budget_usd - total_cost}


# ============================================================================
# Apollo.io (Firmographic + Contact) — T3
# ============================================================================

class ApolloConnector(BaseConnector):
    """
    Full firmographic + contact enrichment via Apollo.io API.
    Cost: ~$0.30-2.00 per enrichment (depends on plan tier).
    Provides: email, phone, title, company revenue, employee count, industry.
    """
    source_type = "apollo_io"
    source_name = "Apollo.io Firmographic Enrichment"
    tier = "T3"
    requires_api_key = True
    rate_limit_per_second = 5.0
    default_cadence_hours = 720  # monthly

    API = "https://api.apollo.io/v1"

    def _get_key(self) -> str:
        return self.config.get("api_key") or os.environ.get("WB_APOLLO_IO_API_KEY", "")

    def test_connection(self) -> bool:
        key = self._get_key()
        if not key: return False
        try:
            r = requests.get(f"{self.API}/auth/health",
                             headers={"X-Api-Key": key}, timeout=10)
            return r.status_code in (200, 401)  # 401 = key format ok, auth may fail
        except Exception:
            return False

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        return pd.DataFrame()  # enrichment only

    def normalize(self, df):
        return df

    def enrich_person(self, email: str = "", name: str = "", domain: str = "") -> dict | None:
        key = self._get_key()
        if not key: return None
        self._rate_limit()
        payload = {}
        if email: payload["email"] = email
        if name:
            parts = name.split()
            if len(parts) >= 2:
                payload["first_name"] = parts[0]
                payload["last_name"] = parts[-1]
        if domain: payload["organization_name"] = domain
        if not payload: return None
        try:
            r = requests.post(f"{self.API}/people/match",
                              json=payload,
                              headers={"X-Api-Key": key, "Content-Type": "application/json"},
                              timeout=15)
            r.raise_for_status()
            person = r.json().get("person", {})
            org = person.get("organization", {})
            return {
                "email": person.get("email"),
                "phone": person.get("phone_numbers", [{}])[0].get("sanitized_number") if person.get("phone_numbers") else None,
                "linkedin_url": person.get("linkedin_url"),
                "title": person.get("title"),
                "org_name": org.get("name"),
                "org_revenue": org.get("estimated_annual_revenue"),
                "org_employees": org.get("estimated_num_employees"),
                "org_industry": org.get("industry"),
                "cost_usd": 1.00,
            }
        except Exception:
            return None

    def enrich_batch(self, prospects: pd.DataFrame, budget_usd: float = 500.0) -> tuple[pd.DataFrame, dict]:
        prospects = prospects.copy()
        total_cost = 0.0
        enriched_count = 0
        for idx, row in prospects.iterrows():
            if total_cost >= budget_usd:
                break
            email = str(row.get("email", "")) if pd.notna(row.get("email")) else ""
            name = str(row.get("owner_name", ""))
            firm = str(row.get("current_firm") or row.get("firm_name") or "")
            result = self.enrich_person(email=email, name=name, domain=firm)
            if result:
                for field in ["email", "phone", "linkedin_url"]:
                    if result.get(field) and not (row.get(field) and pd.notna(row.get(field))):
                        prospects.at[idx, field] = result[field]
                if result.get("org_revenue"):
                    prospects.at[idx, "estimated_revenue_usd"] = result["org_revenue"]
                if result.get("org_employees"):
                    prospects.at[idx, "estimated_employee_count"] = result["org_employees"]
                prospects.at[idx, "apollo_enriched"] = True
                total_cost += result.get("cost_usd", 1.0)
                enriched_count += 1
        return prospects, {"enriched": enriched_count, "cost_usd": total_cost,
                           "budget_remaining": budget_usd - total_cost}


# ============================================================================
# Orchestrator-compatible wrappers
# ============================================================================
# These wrap the per-connector enrich_batch() methods into the standard
# enrich(df) -> (df, stats) interface expected by the enrichment pipeline.

import os as _os

def enrich_batch_skip(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Orchestrator wrapper for BatchSkipTracing phone append."""
    key = _os.environ.get("WB_BATCH_SKIP_TRACING_API_KEY", "")
    if not key:
        return df, {"skipped": True, "reason": "WB_BATCH_SKIP_TRACING_API_KEY not set",
                     "cost_usd": 0.0, "features_added": []}
    budget = float(_os.environ.get("WB_BATCH_SKIP_BUDGET", "200"))
    connector = BatchSkipConnector(config={"api_key": key})
    return connector.enrich_batch(df, budget_usd=budget)


def enrich_hunter(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Orchestrator wrapper for Hunter.io email finder."""
    key = _os.environ.get("WB_HUNTER_IO_API_KEY", "")
    if not key:
        return df, {"skipped": True, "reason": "WB_HUNTER_IO_API_KEY not set",
                     "cost_usd": 0.0, "features_added": []}
    budget = float(_os.environ.get("WB_HUNTER_BUDGET", "100"))
    connector = HunterConnector(config={"api_key": key})
    return connector.enrich_batch(df, budget_usd=budget)


def enrich_apollo(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Orchestrator wrapper for Apollo.io full contact enrichment."""
    key = _os.environ.get("WB_APOLLO_IO_API_KEY", "")
    if not key:
        return df, {"skipped": True, "reason": "WB_APOLLO_IO_API_KEY not set",
                     "cost_usd": 0.0, "features_added": []}
    budget = float(_os.environ.get("WB_APOLLO_BUDGET", "500"))
    connector = ApolloConnector(config={"api_key": key})
    return connector.enrich_batch(df, budget_usd=budget)
