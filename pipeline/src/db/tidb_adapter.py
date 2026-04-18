"""
TiDB/MySQL Adapter for Stewardly AI
======================================
Maps the Python pipeline's operations to the existing Drizzle ORM schema
in stewardly-ai's TiDB (MySQL-compatible) database.

Tables used (already exist via Drizzle migrations):
  lead_pipeline        ← pipeline prospects
  lead_sources         ← pipeline source registry  
  lead_source_perf     ← source performance metrics
  propensity_scores    ← scoring results
  propensity_models    ← model metadata
  data_sources         ← ingestion source config
  ingestion_jobs       ← sync log
  ingested_records     ← raw source data
  compliance_rules     ← DNC/TCPA/FINRA flags

Column mapping (pipeline name → Drizzle name):
  owner_key          → email_hash (SHA-256 of email or name+address)
  owner_name         → first_name + last_name (split on first space)
  segment            → target_segment
  phone              → phone_hash (SHA-256, stored hashed for PII)
  email              → email_hash (SHA-256)
  propensity_score   → propensity_score (decimal 5,4)
  propensity_tier    → propensity_tier (hot/warm/cool/cold, NOT A/B/C/D)
  enrichment fields  → enrichment_data (JSON blob)
  segment fields     → segment_data (JSON blob)

Env: DATABASE_URL=mysql://user:pass@host:4000/stewardly
"""
from __future__ import annotations

import hashlib
import json
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

import pandas as pd

DATABASE_URL = os.environ.get("DATABASE_URL", "")

try:
    import mysql.connector
    HAS_MYSQL = True
except ImportError:
    HAS_MYSQL = False


def _hash(value: str) -> str:
    """SHA-256 hash for PII fields (email, phone)."""
    if not value or pd.isna(value):
        return ""
    return hashlib.sha256(str(value).strip().lower().encode()).hexdigest()


def _split_name(full_name: str) -> tuple[str, str]:
    """Split 'SMITH JOHN R' into (first='JOHN', last='SMITH R')."""
    if not full_name or pd.isna(full_name):
        return ("", "")
    parts = str(full_name).strip().split()
    if len(parts) == 0:
        return ("", "")
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], " ".join(parts[1:]))


TIER_MAP = {"A": "hot", "B": "warm", "C": "cool", "D": "cold"}
TIER_MAP_REVERSE = {v: k for k, v in TIER_MAP.items()}


def _parse_mysql_url(url: str) -> dict:
    """Parse mysql://user:pass@host:port/db into connection kwargs."""
    from urllib.parse import urlparse
    p = urlparse(url.replace("mysql://", "mysql://"))
    return {
        "host": p.hostname or "localhost",
        "port": p.port or 4000,
        "user": p.username or "root",
        "password": p.password or "",
        "database": p.path.lstrip("/") or "stewardly",
    }


@contextmanager
def get_tidb_connection():
    """Context manager for TiDB/MySQL connection."""
    if not HAS_MYSQL or not DATABASE_URL:
        raise RuntimeError("MySQL not available — set DATABASE_URL and install mysql-connector-python")
    config = _parse_mysql_url(DATABASE_URL)
    conn = mysql.connector.connect(**config)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def upsert_lead(conn, prospect: dict) -> int:
    """Insert or update a lead in lead_pipeline table. Returns lead ID."""
    cursor = conn.cursor(dictionary=True)

    # Build dedup key
    email = str(prospect.get("email", "")).strip()
    name = str(prospect.get("owner_name", "")).strip()
    address = str(prospect.get("property_address", "")).strip()
    email_hash = _hash(email) if email and "@" in email else _hash(f"{name}|{address}")

    # Check existing
    cursor.execute("SELECT id FROM lead_pipeline WHERE email_hash = %s", (email_hash,))
    existing = cursor.fetchone()

    first, last = _split_name(prospect.get("owner_name", ""))
    segment = prospect.get("segment", "")
    tier = TIER_MAP.get(str(prospect.get("propensity_tier", "")), None)

    # Build enrichment_data JSON from segment-specific fields
    enrichment_fields = {}
    for k in ["entity_type", "naics", "owner_age", "estimated_gdc", "estimated_revenue_usd",
              "multi_property_count", "current_firm", "years_in_industry", "licenses",
              "firm_name", "years_in_practice", "practice_area", "employee_count",
              "industry", "ntee_cd", "market_value", "contact_completeness",
              "phone_source", "email_source", "email_predicted", "email_predicted_confidence"]:
        val = prospect.get(k)
        if val is not None and not (isinstance(val, float) and pd.isna(val)):
            enrichment_fields[k] = val

    segment_data = {}
    for k in ["geo_tier", "entity_type_inferred", "naics_inferred", "naics_label",
              "firm_movability_score", "firm_movability_tier"]:
        val = prospect.get(k)
        if val is not None and not (isinstance(val, float) and pd.isna(val)):
            segment_data[k] = val

    if existing:
        lead_id = existing["id"]
        cursor.execute("""
            UPDATE lead_pipeline SET
                first_name = %s, last_name = %s,
                target_segment = %s,
                enrichment_data = %s,
                segment_data = %s,
                propensity_score = %s,
                propensity_tier = %s,
                city = %s, state = %s, zip = %s,
                company = %s,
                updated_at = NOW()
            WHERE id = %s
        """, (
            first, last, segment,
            json.dumps(enrichment_fields),
            json.dumps(segment_data),
            prospect.get("propensity_score"),
            tier,
            prospect.get("city", ""), prospect.get("state", ""), prospect.get("zip", ""),
            prospect.get("current_firm") or prospect.get("firm_name") or "",
            lead_id,
        ))
    else:
        cursor.execute("""
            INSERT INTO lead_pipeline
                (email_hash, first_name, last_name, target_segment,
                 enrichment_data, segment_data, propensity_score, propensity_tier,
                 city, state, zip, company, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'new', NOW(), NOW())
        """, (
            email_hash, first, last, segment,
            json.dumps(enrichment_fields),
            json.dumps(segment_data),
            prospect.get("propensity_score"),
            tier,
            prospect.get("city", ""), prospect.get("state", ""), prospect.get("zip", ""),
            prospect.get("current_firm") or prospect.get("firm_name") or "",
        ))
        lead_id = cursor.lastrowid

    cursor.close()
    return lead_id


def write_score(conn, lead_id: int, model_id: int, score: float,
                features: dict, run_id: str = ""):
    """Write a propensity score to propensity_scores table."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO propensity_scores (lead_id, model_id, score, features_used, scored_at)
        VALUES (%s, %s, %s, %s, NOW())
    """, (lead_id, model_id, score, json.dumps(features)))
    cursor.close()


def log_ingestion_job(conn, source_type: str, records_fetched: int,
                       records_new: int, records_updated: int,
                       status: str = "completed", error: str = None):
    """Log a sync run to ingestion_jobs table. Column names match Drizzle schema."""
    cursor = conn.cursor()
    now_ms = int(datetime.now().timestamp() * 1000)

    # Find or create data source (data_sources uses camelCase columns)
    cursor.execute("SELECT id FROM data_sources WHERE name = %s LIMIT 1", (source_type,))
    row = cursor.fetchone()
    source_id = row[0] if row else None
    if not source_id:
        cursor.execute("""
            INSERT INTO data_sources (name, sourceType, is_active, createdAt, updatedAt)
            VALUES (%s, 'api_feed', 1, %s, %s)
        """, (source_type, now_ms, now_ms))
        source_id = cursor.lastrowid
    else:
        cursor.execute(
            "UPDATE data_sources SET lastRunAt = %s, lastSuccessAt = %s, updatedAt = %s WHERE id = %s",
            (now_ms, now_ms if status == "completed" else None, now_ms, source_id)
        )

    # ingestion_jobs uses camelCase columns + bigint timestamps
    cursor.execute("""
        INSERT INTO ingestion_jobs
            (dataSourceId, status, recordsProcessed, recordsCreated, recordsUpdated,
             startedAt, completedAt, createdAt)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (source_id, status, records_fetched, records_new, records_updated,
          now_ms, now_ms, now_ms))
    cursor.close()


def get_or_create_model(conn, model_name: str = "pipeline_phase0",
                         model_type: str = "expert_weights") -> int:
    """Get or create a propensity model record. Returns model_id."""
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id FROM propensity_models WHERE model_name = %s LIMIT 1",
                   (model_name,))
    row = cursor.fetchone()
    if row:
        cursor.close()
        return row["id"]
    cursor.execute("""
        INSERT INTO propensity_models (model_name, model_type, active, created_at)
        VALUES (%s, %s, 1, NOW())
    """, (model_name, model_type))
    model_id = cursor.lastrowid
    cursor.close()
    return model_id


def sync_scored_prospects_to_tidb(scored_df: pd.DataFrame):
    """
    Write a scored DataFrame to stewardly-ai's TiDB tables.
    Called after the pipeline runs scoring.
    """
    if not HAS_MYSQL or not DATABASE_URL:
        print("[tidb] skipped — no MySQL connection")
        return {"written": 0, "skipped": True}

    with get_tidb_connection() as conn:
        model_id = get_or_create_model(conn)
        written = 0
        for _, row in scored_df.iterrows():
            lead_id = upsert_lead(conn, row.to_dict())
            score = row.get("propensity_score")
            if score is not None and not pd.isna(score):
                features = {}
                for k in row.index:
                    if k.endswith("_score") or k.endswith("_decile") or k.endswith("_fit"):
                        val = row[k]
                        if val is not None and not (isinstance(val, float) and pd.isna(val)):
                            features[k] = float(val)
                write_score(conn, lead_id, model_id, float(score), features)
            written += 1
        conn.commit()
    print(f"[tidb] synced {written} scored prospects")
    return {"written": written}
