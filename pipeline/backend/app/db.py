"""Backend DB — extends pipeline schema with API-specific tables (pipeline_runs, budget_tracking)."""
import os
from src.db.schema import get_connection, init_db as pipeline_init_db, table_counts as pipeline_counts, USE_MYSQL

def init_db():
    """Initialize pipeline tables + API-specific tables."""
    pipeline_init_db()
    with get_connection() as conn:
        for ddl in [
            """CREATE TABLE IF NOT EXISTS pipeline_runs (
                id INTEGER PRIMARY KEY {},
                run_id TEXT NOT NULL UNIQUE, status TEXT DEFAULT 'running',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP,
                steps_completed TEXT, total_ingested INTEGER DEFAULT 0,
                total_enriched INTEGER DEFAULT 0, total_scored INTEGER DEFAULT 0,
                total_exported INTEGER DEFAULT 0, error_message TEXT
            )""".format("AUTO_INCREMENT" if USE_MYSQL else "AUTOINCREMENT"),
            """CREATE TABLE IF NOT EXISTS budget_tracking (
                id INTEGER PRIMARY KEY {},
                source_type TEXT NOT NULL, month TEXT NOT NULL,
                spend_usd REAL DEFAULT 0.0, budget_usd REAL DEFAULT 0.0,
                records_enriched INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""".format("AUTO_INCREMENT" if USE_MYSQL else "AUTOINCREMENT"),
        ]:
            try:
                conn.execute(ddl)
            except Exception:
                pass
    print("[db] API tables ensured")

def table_counts():
    counts = pipeline_counts()
    with get_connection() as conn:
        for t in ["pipeline_runs", "budget_tracking"]:
            try:
                counts[t] = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            except Exception:
                counts[t] = -1
    return counts
