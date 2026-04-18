"""
Free Public Source Connectors (T0)
====================================
API-based connectors for free public data sources.
Each implements BaseConnector for the ingestion engine.
"""
from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

import pandas as pd
import requests

try:
    from src.connectors.base import BaseConnector, normalize_owner_key
except ImportError:
    from base import BaseConnector, normalize_owner_key


# ============================================================================
# WA DOR (Socrata API)
# ============================================================================

class WADORConnector(BaseConnector):
    source_type = "wa_dor"
    source_name = "Washington State DOR Business Lookup"
    segment = "commercial_client"
    tier = "T0"
    rate_limit_per_second = 5.0
    default_cadence_hours = 168  # weekly

    BASE = "https://data.wa.gov/resource"

    def test_connection(self) -> bool:
        try:
            r = requests.get(f"{self.BASE}/{self.config.get('dataset_id', '7xux-kdpf')}.json",
                             params={"$limit": 1}, timeout=10)
            return r.status_code == 200
        except Exception:
            return False

    def fetch_records(self, since: datetime = None, limit: int = None) -> pd.DataFrame:
        dataset = self.config.get("dataset_id", "7xux-kdpf")
        max_rows = limit or self.config.get("max_rows", 25000)
        collected, offset = [], 0
        page_size = 5000
        while len(collected) < max_rows:
            self._rate_limit()
            params = {"$limit": min(page_size, max_rows - len(collected)),
                      "$offset": offset, "$order": "ubi"}
            if since:
                params["$where"] = f"last_update_date > '{since.strftime('%Y-%m-%dT%H:%M:%S')}'"
            r = requests.get(f"{self.BASE}/{dataset}.json", params=params, timeout=30)
            r.raise_for_status()
            batch = r.json()
            if not batch: break
            collected.extend(batch)
            offset += page_size
        return pd.DataFrame(collected)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        rename = {"business_name": "owner_name", "location_city": "city",
                  "location_zip": "zip", "county_code": "county",
                  "legal_entity_type": "entity_type", "open_date": "formed_date",
                  "naics": "naics", "ubi": "ubi"}
        df = df.rename(columns={k: v for k, v in rename.items() if k in df.columns})
        df["state"] = "WA"
        df["segment"] = self.segment
        if "county" in df.columns:
            df["county"] = df["county"].astype(str).str.upper().str.replace(" COUNTY", "")
        if "owner_name" in df.columns:
            df["owner_key"] = df["owner_name"].apply(normalize_owner_key)
        return df


# ============================================================================
# FINRA BrokerCheck
# ============================================================================

class FINRAConnector(BaseConnector):
    source_type = "finra_brokercheck"
    source_name = "FINRA BrokerCheck Individual Search"
    segment = "experienced_pro"
    tier = "T0"
    rate_limit_per_second = 2.0  # FINRA throttles aggressively
    default_cadence_hours = 336  # biweekly

    API = "https://api.brokercheck.finra.org/search/individual"

    def test_connection(self) -> bool:
        try:
            r = requests.get(self.API, params={"query": "test", "nrows": 1},
                             timeout=10, headers={"User-Agent": "WB-Research/1.0"})
            return r.status_code == 200
        except Exception:
            return False

    def fetch_records(self, since: datetime = None, limit: int = None) -> pd.DataFrame:
        states = self.config.get("target_states", ["AZ"])
        max_per_state = (limit or 2000) // len(states)
        all_docs = []
        for state in states:
            docs, offset = [], 0
            while len(docs) < max_per_state:
                self._rate_limit()
                params = {"query": "", "filter": f"isBrokerActive=true&state={state}",
                          "nrows": 50, "start": offset, "wt": "json"}
                try:
                    r = requests.get(self.API, params=params, timeout=20,
                                     headers={"User-Agent": "WB-Research/1.0"})
                    r.raise_for_status()
                    hits = r.json().get("hits", {}).get("hits", [])
                except Exception:
                    break
                if not hits: break
                for h in hits:
                    src = h.get("_source", {})
                    docs.append({
                        "owner_name": f"{src.get('ind_firstname','')} {src.get('ind_lastname','')}".strip(),
                        "crd_number": src.get("ind_source_id"),
                        "current_firm": ", ".join(src.get("ind_current_employments_display", [])),
                        "years_in_industry": src.get("ind_yrs_industry"),
                        "licenses": ", ".join(src.get("ind_industry_titles", []) or []),
                        "state": state,
                        "city": src.get("ind_main_off_city", ""),
                        "zip": src.get("ind_main_off_postal_code", ""),
                    })
                offset += 50
            all_docs.extend(docs)
        return pd.DataFrame(all_docs)

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["segment"] = self.segment
        if "owner_name" in df.columns:
            df["owner_key"] = df["owner_name"].apply(normalize_owner_key)
        return df


# ============================================================================
# AZ Corporation Commission (file-based — bulk request)
# ============================================================================

class AZCorpCommConnector(BaseConnector):
    source_type = "az_corp_commission"
    source_name = "AZ Corporation Commission"
    segment = "commercial_client"
    tier = "T0"
    default_cadence_hours = 720  # monthly

    def test_connection(self) -> bool:
        path = self.config.get("bulk_file")
        return bool(path) and pd.io.common.file_exists(path)

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        path = self.config.get("bulk_file")
        if not path:
            return pd.DataFrame()
        df = pd.read_csv(path, low_memory=False)
        return df.head(limit) if limit else df

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        col_map = {"entity_name": "owner_name", "business_name": "owner_name",
                    "formation_date": "formed_date", "entity_type": "entity_type",
                    "principal_city": "city", "principal_zip": "zip"}
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
        df["state"] = "AZ"
        df["segment"] = self.segment
        if "status" in df.columns:
            df = df[df["status"].astype(str).str.upper().str.contains("ACTIVE|GOOD", na=False)]
        if "owner_name" in df.columns:
            df["owner_key"] = df["owner_name"].apply(normalize_owner_key)
        return df


# ============================================================================
# NM SOS (file-based — bulk request)
# ============================================================================

class NMSOSConnector(AZCorpCommConnector):
    source_type = "nm_sos"
    source_name = "NM Secretary of State"

    def normalize(self, df):
        df = super().normalize(df)
        df["state"] = "NM"
        return df


# ============================================================================
# SEC EDGAR Form 4 (free API)
# ============================================================================

class SECForm4Connector(BaseConnector):
    source_type = "sec_edgar_form4"
    source_name = "SEC EDGAR Form 4 Insider Transactions"
    segment = "residential_client"
    tier = "T0"
    rate_limit_per_second = 8.0  # SEC: max 10 req/sec
    default_cadence_hours = 168  # weekly

    def test_connection(self) -> bool:
        try:
            r = requests.get("https://www.sec.gov/cgi-bin/browse-edgar",
                             params={"action": "getcompany", "type": "4", "count": 1, "output": "atom"},
                             timeout=10, headers={"User-Agent": "WB mike@wealthbridgefg.com"})
            return r.status_code == 200
        except Exception:
            return False

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        # Stub — full implementation is in src/scrapers/sec_form4_monitor.py
        # Re-uses that module's logic but wraps it in the connector interface
        try:
            from src.scrapers.sec_form4_monitor import fetch_form4_index
            from datetime import datetime
            year, qtr = datetime.now().year, (datetime.now().month - 1) // 3 + 1
            return fetch_form4_index(year, qtr).head(limit or 200)
        except Exception:
            return pd.DataFrame()

    def normalize(self, df):
        df = df.copy()
        df["segment"] = self.segment
        df["recent_liquidity_event"] = 1.0
        df["trigger_type"] = "form4_insider_transaction"
        if "company_name" in df.columns:
            df["owner_name"] = df["company_name"]
            df["owner_key"] = df["owner_name"].apply(normalize_owner_key)
        return df


# ============================================================================
# FAA Aircraft Registry (bulk download)
# ============================================================================

class FAAConnector(BaseConnector):
    source_type = "faa_aircraft"
    source_name = "FAA Aircraft Registry"
    segment = "residential_client"  # enrichment signal, not a primary segment
    tier = "T0"
    default_cadence_hours = 720  # monthly

    def test_connection(self) -> bool:
        master = self.config.get("master_path", "./data/reference/MASTER.txt")
        return pd.io.common.file_exists(master)

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        master = self.config.get("master_path", "./data/reference/MASTER.txt")
        if not pd.io.common.file_exists(master):
            return pd.DataFrame()
        df = pd.read_csv(master, low_memory=False)
        df.columns = [c.strip().upper() for c in df.columns]
        states = self.config.get("states", ["AZ"])
        state_col = next((c for c in ["STATE", "STATE_CODE"] if c in df.columns), None)
        if state_col:
            df = df[df[state_col].astype(str).str.upper().isin(states)]
        return df.head(limit) if limit else df

    def normalize(self, df):
        df = df.copy()
        name_col = next((c for c in ["NAME", "OWNER_NAME"] if c in df.columns), None)
        if name_col:
            df["owner_name"] = df[name_col]
            df["owner_key"] = df[name_col].apply(normalize_owner_key)
        df["segment"] = self.segment
        return df


# ============================================================================
# IRS BMF (bulk download)
# ============================================================================

class IRSBMFConnector(BaseConnector):
    source_type = "irs_bmf"
    source_name = "IRS Exempt Organizations BMF"
    segment = "nonprofit_leader"
    tier = "T0"
    default_cadence_hours = 720  # monthly

    def test_connection(self) -> bool:
        path = self.config.get("bmf_path")
        return bool(path) and pd.io.common.file_exists(path)

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        path = self.config.get("bmf_path")
        if not path: return pd.DataFrame()
        df = pd.read_csv(path, low_memory=False, encoding="latin-1")
        df.columns = [c.strip().upper() for c in df.columns]
        states = self.config.get("states", ["AZ"])
        if "STATE" in df.columns:
            df = df[df["STATE"].astype(str).str.upper().isin(states)]
        return df.head(limit) if limit else df

    def normalize(self, df):
        df = df.copy()
        col_map = {"NAME": "owner_name", "STATE": "state", "CITY": "city",
                    "ZIP": "zip", "NTEE_CD": "ntee_cd"}
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
        df["segment"] = self.segment
        if "owner_name" in df.columns:
            df["owner_key"] = df["owner_name"].apply(normalize_owner_key)
        return df


# ============================================================================
# Census ACS (free API, no key needed)
# ============================================================================

class CensusACSConnector(BaseConnector):
    source_type = "census_acs"
    source_name = "US Census ACS 5-Year (B19013)"
    tier = "T0"
    default_cadence_hours = 2160  # quarterly

    def test_connection(self) -> bool:
        try:
            r = requests.get("https://api.census.gov/data/2022/acs/acs5",
                             params={"get": "NAME", "for": "state:04"}, timeout=10)
            return r.status_code == 200
        except Exception:
            return False

    def fetch_records(self, since=None, limit=None) -> pd.DataFrame:
        # Delegates to acs_zip_income.build_cache
        try:
            from src.enrichment.acs_zip_income import build_cache
            return build_cache()
        except Exception:
            return pd.DataFrame()

    def normalize(self, df):
        return df  # ACS is a reference table, not prospect records
