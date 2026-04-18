"""
File-Drop Connector
====================
Backward-compatible connector that ingests manually-dropped CSV files
from data/raw/. This is how county assessor data, NM SOS bulk exports,
and other manual-request sources enter the pipeline.

Also serves as the base class for assessor-specific connectors that
add county/state metadata and schema normalization.
"""
from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

import pandas as pd

try:
    from src.connectors.base import BaseConnector, normalize_owner_key
except ImportError:
    from base import BaseConnector, normalize_owner_key


class FileDropConnector(BaseConnector):
    """Ingests any WB_*.csv file from the configured directory."""

    source_type = "file_drop"
    source_name = "Manual CSV File Drop"
    tier = "T0"
    requires_api_key = False
    default_cadence_hours = 24  # check daily for new files

    def __init__(self, config: dict = None):
        super().__init__(config)
        self.input_dir = Path(config.get("input_dir", "./data/raw"))
        self.file_pattern = config.get("file_pattern", "WB_*.csv")

    def test_connection(self) -> bool:
        return self.input_dir.exists()

    def fetch_records(self, since: datetime = None, limit: int = None) -> pd.DataFrame:
        frames = []
        for path in sorted(self.input_dir.glob(self.file_pattern)):
            # Incremental: skip files not modified since last sync
            if since and datetime.fromtimestamp(path.stat().st_mtime) < since:
                continue
            df = pd.read_csv(path, low_memory=False)
            df["_source_file"] = path.name
            frames.append(df)
        if not frames:
            return pd.DataFrame()
        combined = pd.concat(frames, ignore_index=True, sort=False)
        return combined.head(limit) if limit else combined

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        # Infer segment from filename
        if "segment" not in df.columns:
            df["segment"] = df.get("_source_file", "").apply(self._infer_segment)
        # Normalize owner key
        name_col = next((c for c in ["owner_name", "name", "full_name", "business_name"]
                         if c in df.columns), None)
        if name_col:
            df["owner_key"] = df[name_col].apply(normalize_owner_key)
            if name_col != "owner_name":
                df["owner_name"] = df[name_col]
        return df

    @staticmethod
    def _infer_segment(filename: str) -> str:
        f = str(filename).lower()
        if "residential" in f: return "residential_client"
        if "commercial" in f: return "commercial_client"
        if "experienced_pro" in f: return "experienced_pro"
        if "new_associate" in f: return "new_associate"
        if "cpa_attorney" in f: return "cpa_attorney_partner"
        if "affiliate" in f: return "affiliate"
        if "hr_director" in f: return "hr_director"
        if "nonprofit" in f: return "nonprofit_leader"
        return "unknown"


class PimaAssessorConnector(FileDropConnector):
    source_type = "az_assessor_pima"
    source_name = "Pima County Assessor"
    segment = "residential_client"

    def __init__(self, config=None):
        super().__init__(config or {})
        self.input_dir = Path(config.get("input_dir", "./data/raw") if config else "./data/raw")
        self.file_pattern = "WB_Residential_Pima*"

    def normalize(self, df):
        df = super().normalize(df)
        df["county"] = "PIMA"
        df["state"] = "AZ"
        df["segment"] = self.segment
        return df


class MohaveAssessorConnector(PimaAssessorConnector):
    source_type = "az_assessor_mohave"
    source_name = "Mohave County Assessor"

    def __init__(self, config=None):
        super().__init__(config or {})
        self.file_pattern = "WB_Residential_Mohave*"

    def normalize(self, df):
        df = super().normalize(df)
        df["county"] = "MOHAVE"
        return df


class SantaCruzAssessorConnector(PimaAssessorConnector):
    source_type = "az_assessor_santa_cruz"
    source_name = "Santa Cruz County Assessor"

    def __init__(self, config=None):
        super().__init__(config or {})
        self.file_pattern = "WB_Residential_Santa_Cruz*"

    def normalize(self, df):
        df = super().normalize(df)
        df["county"] = "SANTA CRUZ"
        return df
