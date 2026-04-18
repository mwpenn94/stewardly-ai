"""
Ingestion Engine
=================
The core loop that orchestrates data pulls from all enabled connectors,
deduplicates records, merges into the canonical prospects table, tracks
freshness, and logs every sync.

Flow per source:
  1. Check sync_log — skip if last successful sync < cadence window
  2. connector.test_connection()
  3. connector.fetch_records(since=last_sync_time) — incremental
  4. connector.normalize() — map to canonical schema
  5. For each record: compute owner_key → upsert prospect → insert source_record
  6. Log sync result

Source-of-truth merge rules:
  - Newer record wins on non-null fields (last-write-wins by timestamp)
  - Exception: phone/email from paid enrichment (T2+) trumps free (T0)
  - is_deceased / is_suppressed are sticky (once True, never reverted)
  - multi_property_count is MAX across all source records, not last-write

Usage:
  python ingestion_engine.py                   # sync all enabled sources
  python ingestion_engine.py --source finra_brokercheck  # single source
  python ingestion_engine.py --full            # force full sync (ignore cadence)
  python ingestion_engine.py --status          # show sync status for all sources
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.db.schema import (
    init_db, get_connection, upsert_prospect, insert_source_record,
    table_counts,
)
from src.connectors.base import (
    BaseConnector, SyncResult, SOURCE_REGISTRY,
    get_enabled_sources, load_connector, record_hash, normalize_owner_key,
)


def get_last_sync(conn, source_type: str) -> Optional[datetime]:
    """Return the timestamp of the last successful sync for a source."""
    row = conn.execute(
        "SELECT sync_completed_at FROM sync_log "
        "WHERE source_type = ? AND status = 'completed' "
        "ORDER BY sync_completed_at DESC LIMIT 1",
        (source_type,)
    ).fetchone()
    if row and row[0]:
        return datetime.fromisoformat(row[0])
    return None


def should_sync(conn, source_type: str, cadence_hours: int, force: bool = False) -> bool:
    """Check if enough time has passed since last sync."""
    if force:
        return True
    last = get_last_sync(conn, source_type)
    if last is None:
        return True  # never synced
    return datetime.now() - last > timedelta(hours=cadence_hours)


def merge_fields(existing: dict, new: dict, new_tier: str = "T0") -> dict:
    """
    Source-of-truth merge: apply new fields to existing record.
    Rules:
      - Non-null new value overwrites null existing
      - Paid tier (T2/T3) trumps free (T0/T1) on contact fields
      - Sticky booleans (is_deceased, is_suppressed) never revert
      - multi_property_count = max(existing, new)
    """
    merged = dict(existing)
    contact_fields = {"phone", "email", "linkedin_url"}
    sticky_fields = {"is_deceased", "is_suppressed"}
    max_fields = {"multi_property_count"}

    for k, v in new.items():
        if v is None or (isinstance(v, float) and pd.isna(v)):
            continue  # skip null updates
        if k in sticky_fields:
            if v:
                merged[k] = True  # sticky on
            continue
        if k in max_fields:
            merged[k] = max(merged.get(k, 0) or 0, v or 0)
            continue
        if k in contact_fields:
            # Paid enrichment trumps free
            existing_val = merged.get(k)
            if not existing_val or new_tier in ("T2", "T3"):
                merged[k] = v
            continue
        # Default: newer non-null wins
        if merged.get(k) is None or v is not None:
            merged[k] = v
    return merged


def ingest_source(source_type: str, force_full: bool = False) -> SyncResult:
    """Run a single source sync."""
    result = SyncResult(sync_id=f"{source_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    start = time.time()

    try:
        connector = load_connector(source_type)
    except (KeyError, ImportError, AttributeError) as e:
        result.errors.append(f"Failed to load connector: {e}")
        return result

    config = connector.get_sync_config()
    if not config.get("is_configured"):
        result.errors.append(f"Source {source_type} not configured (missing API key?)")
        return result

    init_db()

    with get_connection() as conn:
        cadence = config.get("default_cadence_hours", 168)
        if not should_sync(conn, source_type, cadence, force_full):
            result.errors.append(f"Skipped — last sync within {cadence}h window")
            return result

        # Start sync log entry
        conn.execute(
            "INSERT INTO sync_log (source_type, sync_started_at, status, config_snapshot) "
            "VALUES (?, ?, 'running', ?)",
            (source_type, datetime.now().isoformat(), json.dumps(config, default=str))
        )
        from src.db.schema import USE_MYSQL
        _lid = "SELECT LAST_INSERT_ID()" if USE_MYSQL else "SELECT last_insert_rowid()"
        sync_log_id = conn.execute(_lid).fetchone()[0]

        try:
            # Test connection
            if not connector.test_connection():
                raise ConnectionError(f"Connection test failed for {source_type}")

            # Fetch records (incremental if possible)
            since = None if force_full else get_last_sync(conn, source_type)
            print(f"  [{source_type}] fetching {'full' if not since else f'since {since.isoformat()}'}")
            raw_df = connector.fetch_records(since=since)
            result.records_fetched = len(raw_df)

            if raw_df.empty:
                print(f"  [{source_type}] no records returned")
                conn.execute(
                    "UPDATE sync_log SET sync_completed_at = ?, status = 'completed', "
                    "records_fetched = 0 WHERE id = ?",
                    (datetime.now().isoformat(), sync_log_id)
                )
                return result

            # Normalize
            normalized = connector.normalize(raw_df)
            print(f"  [{source_type}] {len(normalized)} records normalized")

            # Upsert each record
            for _, row in normalized.iterrows():
                owner_key = normalize_owner_key(row.get("owner_name", ""))
                if not owner_key:
                    continue
                segment = row.get("segment") or connector.segment
                if not segment:
                    continue

                # Build field dict (only non-null values)
                fields = {}
                for col in ["owner_name", "state", "county", "zip", "entity_type",
                            "naics", "phone", "email", "linkedin_url", "owner_age",
                            "estimated_gdc", "estimated_revenue_usd",
                            "multi_property_count", "geo_tier",
                            # Segment-specific fields (MUST be included or scores are flat)
                            "property_address", "city", "market_value", "owner_since",
                            "formed_date", "current_firm", "years_in_industry", "licenses",
                            "current_role", "current_employer", "years_working",
                            "has_degree", "is_veteran", "firm_name", "years_in_practice",
                            "practice_area", "license_status", "preferred_track",
                            "employee_count", "industry", "ntee_cd", "income_cd",
                            "revenue_amt", "member_count"]:
                    val = row.get(col)
                    if val is not None and not (isinstance(val, float) and pd.isna(val)):
                        fields[col] = val

                # Use upsert_prospect which handles SQLite/MySQL table and column differences
                pid = upsert_prospect(conn, owner_key, segment, **fields)

                # Insert source record with hash for change detection
                raw_dict = row.to_dict()
                rhash = record_hash(raw_dict)
                is_new = insert_source_record(
                    conn, pid, source_type, json.dumps(raw_dict, default=str),
                    rhash, connector.source_name
                )
                if is_new:
                    result.records_new += 1
                else:
                    result.records_updated += 1

            # Update sync log
            conn.execute(
                "UPDATE sync_log SET sync_completed_at = ?, status = 'completed', "
                "records_fetched = ?, records_new = ?, records_updated = ?, records_unchanged = ? "
                "WHERE id = ?",
                (datetime.now().isoformat(), result.records_fetched,
                 result.records_new, result.records_updated, result.records_unchanged,
                 sync_log_id)
            )

        except Exception as e:
            result.errors.append(f"{type(e).__name__}: {e}")
            conn.execute(
                "UPDATE sync_log SET sync_completed_at = ?, status = 'failed', "
                "error_message = ? WHERE id = ?",
                (datetime.now().isoformat(), str(e), sync_log_id)
            )
            traceback.print_exc()

    result.duration_seconds = round(time.time() - start, 2)
    return result


def ingest_all(force_full: bool = False, sources: list[str] = None) -> dict:
    """Sync all enabled (or specified) sources."""
    init_db()
    target = sources or get_enabled_sources()
    results = {}
    for source_type in target:
        print(f"\n[ingest] {source_type}")
        result = ingest_source(source_type, force_full)
        results[source_type] = result
        status = "OK" if not result.errors else f"ERR: {result.errors[0][:60]}"
        print(f"  [{source_type}] fetched={result.records_fetched} new={result.records_new} "
              f"updated={result.records_updated} unchanged={result.records_unchanged} "
              f"cost=${result.cost_usd:.2f} {result.duration_seconds}s — {status}")
    print(f"\n[ingest] done. DB counts: {table_counts()}")
    return results


def show_status():
    """Display sync status for all registered sources."""
    init_db()
    print(f"{'Source':<30} {'Enabled':<8} {'Last Sync':<22} {'Status':<12} {'Records':<10}")
    print("-" * 90)
    with get_connection() as conn:
        for source_type, entry in SOURCE_REGISTRY.items():
            enabled = "✓" if entry.get("enabled") else "–"
            last_row = conn.execute(
                "SELECT sync_completed_at, status, records_fetched FROM sync_log "
                "WHERE source_type = ? ORDER BY sync_completed_at DESC LIMIT 1",
                (source_type,)
            ).fetchone()
            if last_row:
                last_sync = last_row[0][:19] if last_row[0] else "never"
                status = last_row[1]
                records = str(last_row[2])
            else:
                last_sync = "never"
                status = "–"
                records = "–"
            print(f"{source_type:<30} {enabled:<8} {last_sync:<22} {status:<12} {records:<10}")
    print(f"\nDB totals: {table_counts()}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=str, default=None, help="Single source to sync")
    ap.add_argument("--full", action="store_true", help="Force full sync (ignore cadence)")
    ap.add_argument("--status", action="store_true", help="Show sync status")
    ap.add_argument("--all", action="store_true", help="Sync all enabled sources")
    args = ap.parse_args()

    if args.status:
        show_status()
    elif args.source:
        result = ingest_source(args.source, args.full)
        print(json.dumps(vars(result), indent=2, default=str))
    else:
        ingest_all(args.full)


if __name__ == "__main__":
    main()
