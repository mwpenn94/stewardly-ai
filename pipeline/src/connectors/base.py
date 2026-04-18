"""
Connector Base Class + Source Registry
========================================
Every data source (free scraper, paid API, CRM sync, webhook) implements
the same interface so the ingestion engine can treat them uniformly.

A Connector does exactly four things:
  1. test_connection()  — verify credentials / reachability
  2. fetch_records()    — pull records (full or incremental)
  3. normalize()        — map source schema → canonical prospect schema
  4. get_sync_config()  — return scheduling / rate-limit metadata

The Source Registry (YAML/dict) maps source_type keys to Connector classes
and their configuration (API keys, URLs, cadence, budget caps).
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterator, Optional

import pandas as pd


# ============================================================================
# Connector interface
# ============================================================================

@dataclass
class SyncResult:
    """Return value from a connector sync run."""
    records_fetched: int = 0
    records_new: int = 0
    records_updated: int = 0
    records_unchanged: int = 0
    cost_usd: float = 0.0
    errors: list = field(default_factory=list)
    duration_seconds: float = 0.0
    sync_id: str = ""


class BaseConnector(ABC):
    """All data sources implement this interface."""

    source_type: str = ""          # e.g. "az_assessor_pima"
    source_name: str = ""          # human-friendly, e.g. "Pima County Assessor"
    segment: str = ""              # default segment for records from this source
    tier: str = "T0"               # enrichment cost tier
    requires_api_key: bool = False
    rate_limit_per_second: float = 10.0
    default_cadence_hours: int = 168  # weekly

    def __init__(self, config: dict = None):
        self.config = config or {}
        self._last_request_time = 0.0

    @abstractmethod
    def test_connection(self) -> bool:
        """Verify the source is reachable and credentials work."""
        ...

    @abstractmethod
    def fetch_records(self, since: datetime = None, limit: int = None) -> pd.DataFrame:
        """
        Pull records from the source.
        If `since` is provided, fetch only records modified after that date (incremental).
        If `since` is None, fetch all (full sync).
        Returns a DataFrame with source-native columns.
        """
        ...

    @abstractmethod
    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Map source-native columns to the canonical prospect schema:
          owner_key, owner_name, segment, state, county, zip, entity_type, ...
        Returns a DataFrame ready for upsert into the prospects table.
        """
        ...

    def get_sync_config(self) -> dict:
        """Return scheduling + rate-limit metadata."""
        return {
            "source_type": self.source_type,
            "source_name": self.source_name,
            "segment": self.segment,
            "tier": self.tier,
            "requires_api_key": self.requires_api_key,
            "rate_limit_per_second": self.rate_limit_per_second,
            "default_cadence_hours": self.default_cadence_hours,
            "is_configured": self._is_configured(),
        }

    def _is_configured(self) -> bool:
        """Check if required config (API keys, paths) is present."""
        if self.requires_api_key:
            key_field = self.config.get("api_key") or os.environ.get(
                f"WB_{self.source_type.upper()}_API_KEY"
            )
            return bool(key_field)
        return True

    def _rate_limit(self):
        """Simple rate limiter — sleep if calling too fast."""
        if self.rate_limit_per_second <= 0:
            return
        min_interval = 1.0 / self.rate_limit_per_second
        elapsed = time.time() - self._last_request_time
        if elapsed < min_interval:
            time.sleep(min_interval - elapsed)
        self._last_request_time = time.time()


def record_hash(data: dict) -> str:
    """Deterministic hash of a record dict for change detection."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()[:16]


def normalize_owner_key(name: str) -> str:
    """Canonical dedup key from owner name."""
    import re
    if not name or pd.isna(name):
        return ""
    s = str(name).upper()
    s = re.sub(r"[^A-Z0-9 ]", "", s).strip()
    return s


# ============================================================================
# Source Registry
# ============================================================================

# Config-driven registry. In production, load from YAML/JSON config file.
# Each entry: source_type → {connector_class, config, enabled}
# Connector classes are strings that get resolved at runtime via importlib.

SOURCE_REGISTRY = {
    # ── Free public (T0) ──
    "az_assessor_pima": {
        "module": "src.connectors.az_assessor",
        "class": "PimaAssessorConnector",
        "config": {"county": "PIMA", "state": "AZ"},
        "enabled": True,
    },
    "az_assessor_mohave": {
        "module": "src.connectors.az_assessor",
        "class": "MohaveAssessorConnector",
        "config": {"county": "MOHAVE", "state": "AZ"},
        "enabled": True,
    },
    "az_assessor_santa_cruz": {
        "module": "src.connectors.az_assessor",
        "class": "SantaCruzAssessorConnector",
        "config": {"county": "SANTA CRUZ", "state": "AZ"},
        "enabled": True,
    },
    "az_corp_commission": {
        "module": "src.connectors.free_public",
        "class": "AZCorpCommConnector",
        "config": {},
        "enabled": True,
    },
    "nm_sos": {
        "module": "src.connectors.free_public",
        "class": "NMSOSConnector",
        "config": {},
        "enabled": True,
    },
    "wa_dor": {
        "module": "src.connectors.free_public",
        "class": "WADORConnector",
        "config": {"dataset_id": "7xux-kdpf"},
        "enabled": True,
    },
    "finra_brokercheck": {
        "module": "src.connectors.free_public",
        "class": "FINRAConnector",
        "config": {"target_states": ["AZ", "NM", "WA"]},
        "enabled": True,
    },
    "sec_edgar_form4": {
        "module": "src.connectors.free_public",
        "class": "SECForm4Connector",
        "config": {"days_back": 30, "min_usd": 1_000_000, "states": ["AZ", "NM", "WA"]},
        "enabled": True,
    },
    "faa_aircraft": {
        "module": "src.connectors.free_public",
        "class": "FAAConnector",
        "config": {"states": ["AZ", "NM", "WA"]},
        "enabled": True,
    },
    "irs_bmf": {
        "module": "src.connectors.free_public",
        "class": "IRSBMFConnector",
        "config": {"states": ["AZ", "NM", "WA"]},
        "enabled": True,
    },
    "census_acs": {
        "module": "src.connectors.free_public",
        "class": "CensusACSConnector",
        "config": {},
        "enabled": True,
    },
    "npi_registry": {
        "module": "src.connectors.npi_registry",
        "class": "NPIRegistryConnector",
        "config": {"target_states": ["AZ", "NM", "WA"], "max_rows": 5000},
        "enabled": True,
    },
    "file_drop": {
        "module": "src.connectors.az_assessor",
        "class": "FileDropConnector",
        "config": {"input_dir": "./data/raw"},
        "enabled": True,
    },
    # ── Paid enrichment (T2) ──
    "hunter_io": {
        "module": "src.connectors.paid_enrichment",
        "class": "HunterConnector",
        "config": {"budget_usd": 100},
        "enabled": False,  # enable when API key is set
    },
    "batch_skip_tracing": {
        "module": "src.connectors.paid_enrichment",
        "class": "BatchSkipConnector",
        "config": {"budget_usd": 200},
        "enabled": False,
    },
    # ── Premium enrichment (T3) ──
    "apollo_io": {
        "module": "src.connectors.paid_enrichment",
        "class": "ApolloConnector",
        "config": {"budget_usd": 500},
        "enabled": False,
    },
    # ── CRM / Marketing (bidirectional) ──
    "ghl": {
        "module": "src.connectors.ghl",
        "class": "GHLConnector",
        "config": {},
        "enabled": False,
    },
    "dripify": {
        "module": "src.connectors.ghl",
        "class": "GHLConnector",
        "config": {},
        "enabled": False,
    },
    "calendly": {
        "module": "src.connectors.ghl",
        "class": "GHLConnector",
        "config": {},
        "enabled": False,
    },
    "workable": {
        "module": "src.connectors.ghl",
        "class": "GHLConnector",
        "config": {},
        "enabled": False,
    },
}


def get_enabled_sources() -> list[str]:
    """Return source_types that are enabled in the registry."""
    return [k for k, v in SOURCE_REGISTRY.items() if v.get("enabled")]


def get_configured_sources() -> list[str]:
    """Return source_types that are enabled AND have required config."""
    configured = []
    for key in get_enabled_sources():
        entry = SOURCE_REGISTRY[key]
        if entry.get("requires_api_key", False):
            # Check for API key in config or env
            api_key = entry.get("config", {}).get("api_key") or \
                       os.environ.get(f"WB_{key.upper()}_API_KEY")
            if api_key:
                configured.append(key)
        else:
            configured.append(key)
    return configured


def load_connector(source_type: str) -> BaseConnector:
    """Instantiate a connector from the registry by source_type."""
    from importlib import import_module
    entry = SOURCE_REGISTRY.get(source_type)
    if not entry:
        raise KeyError(f"Unknown source_type: {source_type}")
    mod = import_module(entry["module"])
    cls = getattr(mod, entry["class"])
    return cls(config=entry.get("config", {
    "az_state_bar": {
        "module": "src.connectors.az_professional_dirs",
        "class": "AZStateBarConnector",
        "config": {},
        "enabled": True,
    },
    "az_doi_producer": {
        "module": "src.connectors.az_professional_dirs",
        "class": "AZDOIConnector",
        "config": {},
        "enabled": True,
    },
    "az_adre": {
        "module": "src.connectors.az_professional_dirs",
        "class": "AZADREConnector",
        "config": {},
        "enabled": True,
    },
    "google_places": {
        "module": "src.connectors.google_places",
        "class": "GooglePlacesConnector",
        "config": {},
        "enabled": False,
    },
}))
