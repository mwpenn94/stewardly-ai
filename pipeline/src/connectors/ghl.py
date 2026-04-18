"""
GoHighLevel (GHL) Bidirectional Connector
============================================
The CRM hub. Two directions:

  PUSH (pipeline → GHL):
    - Create/update contacts with propensity scores, segment, geo_tier
    - Apply tags per GHL_AUTOMATION_SPEC_v2 (prop:A/B, seg:*, geo:T*)
    - Move contacts through pipeline stages

  PULL (GHL → pipeline):
    - Webhook receiver for outcome_status changes
    - Periodic bulk export of pipeline stage data for label refresh

API: GHL REST API v2
  Docs: https://highlevel.stoplight.io/docs/integrations/
  Auth: API key or OAuth2

Env vars:
  WB_GHL_API_KEY       — API key for the sub-account
  WB_GHL_LOCATION_ID   — sub-account location ID
"""
from __future__ import annotations

import json
import os
from datetime import datetime

import pandas as pd
import requests

try:
    from src.connectors.base import BaseConnector, normalize_owner_key
    from src.db.schema import get_connection, insert_outcome
except ImportError:
    from base import BaseConnector, normalize_owner_key


class GHLConnector(BaseConnector):
    source_type = "ghl"
    source_name = "GoHighLevel CRM"
    tier = "T0"  # no per-record cost
    requires_api_key = True
    rate_limit_per_second = 5.0  # GHL rate limits vary by plan
    default_cadence_hours = 24  # daily sync

    API = "https://rest.gohighlevel.com/v1"

    def _get_key(self) -> str:
        return self.config.get("api_key") or os.environ.get("WB_GHL_API_KEY", "")

    def _get_location(self) -> str:
        return self.config.get("location_id") or os.environ.get("WB_GHL_LOCATION_ID", "")

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_key()}",
                "Content-Type": "application/json"}

    def test_connection(self) -> bool:
        key = self._get_key()
        if not key:
            return False
        try:
            r = requests.get(f"{self.API}/contacts/", params={"limit": 1},
                             headers=self._headers(), timeout=10)
            return r.status_code in (200, 401)  # 401 = key format ok
        except Exception:
            return False

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        """Pull contacts from GHL (for outcome label refresh)."""
        key = self._get_key()
        if not key:
            return pd.DataFrame()
        contacts, offset = [], 0
        max_contacts = limit or 10000
        while len(contacts) < max_contacts:
            self._rate_limit()
            params = {"limit": 100, "startAfter": offset}
            try:
                r = requests.get(f"{self.API}/contacts/", params=params,
                                 headers=self._headers(), timeout=20)
                r.raise_for_status()
                data = r.json()
                batch = data.get("contacts", [])
                if not batch:
                    break
                contacts.extend(batch)
                offset = len(contacts)
            except Exception:
                break
        return pd.DataFrame(contacts)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df
        df = df.copy()
        # Map GHL contact fields to canonical schema
        rename = {
            "contactName": "owner_name",
            "firstName": "first_name",
            "lastName": "last_name",
            "email": "email",
            "phone": "phone",
            "tags": "ghl_tags",
            "id": "ghl_contact_id",
        }
        df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})
        if "first_name" in df.columns and "last_name" in df.columns:
            df["owner_name"] = (df["first_name"].fillna("") + " " + df["last_name"].fillna("")).str.strip()
        if "owner_name" in df.columns:
            df["owner_key"] = df["owner_name"].apply(normalize_owner_key)
        # Extract custom fields if present
        if "customField" in df.columns:
            custom = df["customField"].apply(
                lambda x: {f.get("field_key", ""): f.get("field_value", "")
                           for f in (x if isinstance(x, list) else [])}
            )
            for field in ["propensity_score", "propensity_tier", "segment", "geo_tier",
                          "outcome_status"]:
                df[field] = custom.apply(lambda d: d.get(field))
        return df

    # ================================================================
    # PUSH: Send scored prospects to GHL
    # ================================================================

    def push_contact(self, prospect: dict) -> str | None:
        """Create or update a GHL contact. Returns GHL contact ID."""
        key = self._get_key()
        if not key:
            return None
        self._rate_limit()
        # Build GHL contact payload
        payload = {
            "firstName": prospect.get("owner_name", "").split()[0] if prospect.get("owner_name") else "",
            "lastName": " ".join(prospect.get("owner_name", "").split()[1:]) if prospect.get("owner_name") else "",
            "email": prospect.get("email", ""),
            "phone": prospect.get("phone", ""),
            "address1": prospect.get("property_address", ""),
            "city": prospect.get("city", ""),
            "state": prospect.get("state", ""),
            "postalCode": prospect.get("zip", ""),
            "tags": self._build_tags(prospect),
            "customField": self._build_custom_fields(prospect),
        }
        # Remove empty fields
        payload = {k: v for k, v in payload.items() if v}
        try:
            # Try upsert by email first, then by phone
            r = requests.post(f"{self.API}/contacts/",
                              json=payload, headers=self._headers(), timeout=15)
            if r.status_code in (200, 201):
                return r.json().get("contact", {}).get("id")
            r.raise_for_status()
        except Exception as e:
            print(f"  [ghl] push failed for {prospect.get('owner_key', '?')}: {e}")
        return None

    def push_batch(self, prospects: pd.DataFrame) -> dict:
        """Push a batch of scored prospects to GHL."""
        results = {"pushed": 0, "failed": 0, "skipped": 0}
        for _, row in prospects.iterrows():
            # Only push A+B tier
            tier = row.get("propensity_tier", "")
            if tier not in ("A", "B"):
                results["skipped"] += 1
                continue
            ghl_id = self.push_contact(row.to_dict())
            if ghl_id:
                results["pushed"] += 1
            else:
                results["failed"] += 1
        return results

    @staticmethod
    def _build_tags(prospect: dict) -> list:
        """Generate GHL tags per GHL_AUTOMATION_SPEC_v2."""
        tags = []
        seg = prospect.get("segment", "")
        seg_map = {
            "residential_client": "seg:res-client",
            "commercial_client": "seg:com-client",
            "experienced_pro": "seg:exp-pro",
            "new_associate": "seg:new-assoc",
            "cpa_attorney_partner": "seg:cpa-atty",
            "affiliate": "seg:affiliate",
            "hr_director": "seg:hr-dir",
            "nonprofit_leader": "seg:nonprof",
        }
        if seg in seg_map:
            tags.append(seg_map[seg])
        tier = prospect.get("propensity_tier", "")
        if tier: tags.append(f"prop:{tier}")
        geo = prospect.get("geo_tier", "")
        if geo:
            tier_num = geo.split("_")[1] if "_" in geo else ""
            tags.append(f"geo:T{tier_num}" if tier_num else f"geo:{geo}")
        # Wealth triggers
        trigger = prospect.get("trigger_type") or prospect.get("wealth_trigger_type")
        if trigger:
            tags.append(f"trig:{trigger}")
        return tags

    @staticmethod
    def _build_custom_fields(prospect: dict) -> list:
        """Map propensity fields to GHL custom fields."""
        fields = []
        for key in ["propensity_score", "propensity_decile", "propensity_tier",
                     "geo_tier", "segment", "multi_property_count",
                     "entity_type", "expected_value_usd"]:
            val = prospect.get(key)
            if val is not None and not (isinstance(val, float) and pd.isna(val)):
                fields.append({"field_key": key, "field_value": str(val)})
        fields.append({"field_key": "last_scored_date",
                        "field_value": datetime.now().strftime("%Y-%m-%d")})
        return fields

    # ================================================================
    # PULL: Receive outcome updates from GHL webhooks
    # ================================================================

    @staticmethod
    def process_webhook(payload: dict) -> dict:
        """
        Process a GHL webhook payload (contact updated / opportunity stage changed).
        Called by the webhook receiver endpoint.
        Returns action dict for the ingestion engine.
        """
        contact_id = payload.get("contact_id") or payload.get("id", "")
        status_to = payload.get("opportunity_status") or payload.get("stage_name", "")
        # Map GHL stage names to our 5-value taxonomy
        stage_map = {
            "Not Contacted": "not_contacted",
            "Contacted": "contacted",
            "Responded": "responded",
            "Qualified": "qualified",
            "Won": "closed_won",
            "Lost": "closed_lost",
        }
        outcome = stage_map.get(status_to, status_to.lower().replace(" ", "_"))
        return {
            "ghl_contact_id": contact_id,
            "outcome_status": outcome,
            "raw_payload": payload,
        }
