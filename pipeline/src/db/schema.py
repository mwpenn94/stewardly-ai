"""
WealthBridge Data Layer — SQLite (standalone) / MySQL-TiDB (stewardly-ai)
==========================================================================
Dual-mode. All pipeline modules import from this file.

DATABASE_URL=mysql://...  → MySQL/TiDB (writes to stewardly-ai Drizzle tables)
DATABASE_URL empty        → SQLite (local standalone)

In MySQL mode, pipeline tables map to Drizzle tables:
  prospects → lead_pipeline | scores → propensity_scores | sync_log → ingestion_jobs
"""
from __future__ import annotations
import hashlib, json, os, sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional
import pandas as pd

DATABASE_URL = os.environ.get("DATABASE_URL", "")
DB_PATH = Path(os.environ.get("WB_DB_PATH", "./data/wealthbridge.db"))
USE_MYSQL = DATABASE_URL.startswith("mysql://")

if USE_MYSQL:
    try:
        import mysql.connector
    except ImportError:
        print("[db] mysql-connector-python not installed — falling back to SQLite")
        USE_MYSQL = False

TIER_TO_SAI = {"A": "hot", "B": "warm", "C": "cool", "D": "cold"}

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, owner_key TEXT NOT NULL UNIQUE, owner_name TEXT,
    segment TEXT NOT NULL, state TEXT, county TEXT, zip TEXT, geo_tier TEXT, entity_type TEXT,
    naics TEXT, phone TEXT, email TEXT, linkedin_url TEXT, property_address TEXT, city TEXT,
    owner_age REAL, estimated_gdc REAL, estimated_revenue_usd REAL,
    multi_property_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_scored_at TIMESTAMP,
    is_deceased BOOLEAN DEFAULT FALSE, is_suppressed BOOLEAN DEFAULT FALSE, notes TEXT,
    market_value REAL, owner_since TEXT, formed_date TEXT, current_firm TEXT,
    years_in_industry REAL, licenses TEXT, current_role TEXT, current_employer TEXT,
    years_working REAL, has_degree BOOLEAN, is_veteran BOOLEAN, firm_name TEXT,
    years_in_practice REAL, practice_area TEXT, license_status TEXT, preferred_track TEXT,
    employee_count REAL, industry TEXT, ntee_cd TEXT, income_cd INTEGER,
    revenue_amt REAL, member_count REAL
);
CREATE TABLE IF NOT EXISTS source_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id INTEGER REFERENCES prospects(id),
    source_type TEXT NOT NULL, source_name TEXT, raw_data TEXT,
    ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, file_origin TEXT, record_hash TEXT,
    UNIQUE(prospect_id, source_type, record_hash)
);
CREATE TABLE IF NOT EXISTS enrichment_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id INTEGER REFERENCES prospects(id),
    enricher_name TEXT NOT NULL, tier TEXT NOT NULL, fields_updated TEXT,
    cost_usd REAL DEFAULT 0.0, confidence REAL,
    enriched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, imputed BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id INTEGER REFERENCES prospects(id),
    segment TEXT NOT NULL, scoring_model TEXT NOT NULL, propensity_score REAL,
    propensity_decile INTEGER, propensity_tier TEXT, expected_value_usd REAL,
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, scoring_run_id TEXT
);
CREATE TABLE IF NOT EXISTS outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, prospect_id INTEGER REFERENCES prospects(id),
    ghl_contact_id TEXT, outcome_status TEXT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, changed_by TEXT, notes TEXT,
    propensity_score_at_change REAL
);
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, source_type TEXT NOT NULL,
    sync_started_at TIMESTAMP, sync_completed_at TIMESTAMP,
    records_fetched INTEGER DEFAULT 0, records_new INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0, records_unchanged INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running', error_message TEXT, config_snapshot TEXT
);
CREATE INDEX IF NOT EXISTS idx_prospects_segment ON prospects(segment);
CREATE INDEX IF NOT EXISTS idx_prospects_owner_key ON prospects(owner_key);
CREATE INDEX IF NOT EXISTS idx_scores_prospect ON scores(prospect_id);
"""

def _parse_mysql_url(url):
    from urllib.parse import urlparse
    p = urlparse(url)
    return {"host": p.hostname or "localhost", "port": p.port or 4000,
            "user": p.username or "root", "password": p.password or "",
            "database": p.path.lstrip("/") or "stewardly"}

def _hash_pii(val):
    if not val or (isinstance(val, float) and pd.isna(val)): return ""
    return hashlib.sha256(str(val).strip().lower().encode()).hexdigest()

def _split_name(name):
    if not name or (isinstance(name, float) and pd.isna(name)): return ("", "")
    parts = str(name).strip().split()
    return (parts[0], " ".join(parts[1:])) if len(parts) > 1 else (parts[0] if parts else "", "")

class _MySQLWrap:
    def __init__(self, conn): self._conn = conn
    def execute(self, sql, params=None):
        cur = self._conn.cursor(dictionary=True)
        cur.execute(sql.replace("?", "%s"), params or ())
        return _CurWrap(cur)
    def executescript(self, sql):
        cur = self._conn.cursor()
        for s in sql.split(";"):
            s = s.strip()
            if s: cur.execute(s)
    def commit(self): self._conn.commit()
    def rollback(self): self._conn.rollback()

class _CurWrap:
    def __init__(self, c): self._c = c
    def fetchone(self):
        r = self._c.fetchone()
        return _DRow(r) if r else None
    def fetchall(self): return [_DRow(r) for r in self._c.fetchall()]
    @property
    def lastrowid(self): return self._c.lastrowid

class _DRow:
    def __init__(self, d): self._d = dict(d)
    def __getitem__(self, k):
        return list(self._d.values())[k] if isinstance(k, int) else self._d.get(k)
    def __iter__(self): return iter(self._d.values())
    def keys(self): return self._d.keys()
    def get(self, k, d=None): return self._d.get(k, d)

def get_db_path():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return DB_PATH

@contextmanager
def get_connection():
    if USE_MYSQL:
        conn = mysql.connector.connect(**_parse_mysql_url(DATABASE_URL))
        conn.autocommit = False
        w = _MySQLWrap(conn)
        try: yield w; conn.commit()
        except: conn.rollback(); raise
        finally: conn.close()
    else:
        conn = sqlite3.connect(str(get_db_path()), timeout=30)
        conn.execute("PRAGMA journal_mode=WAL"); conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        try: yield conn; conn.commit()
        except: conn.rollback(); raise
        finally: conn.close()

def init_db():
    if USE_MYSQL:
        with get_connection() as c:
            c.execute("SELECT 1")
            # Create pipeline's own tables alongside Drizzle tables.
            # Pipeline modules do raw SQL on these tables internally.
            # The upsert_prospect() and insert_score() functions ALSO
            # write to Drizzle's lead_pipeline and propensity_scores
            # tables so the stewardly-ai UI can read them.
            for ddl in [
                """CREATE TABLE IF NOT EXISTS prospects (
                    id INT PRIMARY KEY AUTO_INCREMENT, owner_key VARCHAR(255) NOT NULL UNIQUE,
                    owner_name VARCHAR(255), segment VARCHAR(100) NOT NULL,
                    state VARCHAR(50), county VARCHAR(100), zip VARCHAR(20), geo_tier VARCHAR(10),
                    entity_type VARCHAR(100), naics VARCHAR(20), phone VARCHAR(50), email VARCHAR(255),
                    linkedin_url VARCHAR(500), property_address VARCHAR(500), city VARCHAR(100),
                    owner_age FLOAT, estimated_gdc FLOAT, estimated_revenue_usd FLOAT,
                    multi_property_count INT DEFAULT 1, first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_scored_at TIMESTAMP NULL,
                    is_deceased TINYINT DEFAULT 0, is_suppressed TINYINT DEFAULT 0, notes TEXT,
                    market_value FLOAT, owner_since VARCHAR(50), formed_date VARCHAR(50),
                    current_firm VARCHAR(255), years_in_industry FLOAT, licenses VARCHAR(500),
                    current_role VARCHAR(200), current_employer VARCHAR(255), years_working FLOAT,
                    has_degree TINYINT, is_veteran TINYINT, firm_name VARCHAR(255),
                    years_in_practice FLOAT, practice_area VARCHAR(200), license_status VARCHAR(100),
                    preferred_track VARCHAR(100), employee_count FLOAT, industry VARCHAR(200),
                    ntee_cd VARCHAR(20), income_cd INT, revenue_amt FLOAT, member_count FLOAT,
                    INDEX idx_prospects_segment (segment), INDEX idx_prospects_owner_key (owner_key))""",
                """CREATE TABLE IF NOT EXISTS source_records (
                    id INT PRIMARY KEY AUTO_INCREMENT, prospect_id INT, source_type VARCHAR(100) NOT NULL,
                    source_name VARCHAR(200), raw_data LONGTEXT, ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    file_origin VARCHAR(500), record_hash VARCHAR(64),
                    UNIQUE KEY uq_sr (prospect_id, source_type, record_hash))""",
                """CREATE TABLE IF NOT EXISTS enrichment_log (
                    id INT PRIMARY KEY AUTO_INCREMENT, prospect_id INT, enricher_name VARCHAR(100) NOT NULL,
                    tier VARCHAR(10) NOT NULL, fields_updated TEXT, cost_usd FLOAT DEFAULT 0,
                    confidence FLOAT, enriched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, imputed TINYINT DEFAULT 0)""",
                """CREATE TABLE IF NOT EXISTS scores (
                    id INT PRIMARY KEY AUTO_INCREMENT, prospect_id INT, segment VARCHAR(100) NOT NULL,
                    scoring_model VARCHAR(100) NOT NULL, propensity_score FLOAT, propensity_decile INT,
                    propensity_tier VARCHAR(5), expected_value_usd FLOAT,
                    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, scoring_run_id VARCHAR(100),
                    INDEX idx_scores_prospect (prospect_id), INDEX idx_scores_run (scoring_run_id))""",
                """CREATE TABLE IF NOT EXISTS outcomes (
                    id INT PRIMARY KEY AUTO_INCREMENT, prospect_id INT, ghl_contact_id VARCHAR(200),
                    outcome_status VARCHAR(100) NOT NULL, changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    changed_by VARCHAR(100), notes TEXT, propensity_score_at_change FLOAT)""",
                """CREATE TABLE IF NOT EXISTS sync_log (
                    id INT PRIMARY KEY AUTO_INCREMENT, source_type VARCHAR(100) NOT NULL,
                    sync_started_at TIMESTAMP NULL, sync_completed_at TIMESTAMP NULL,
                    records_fetched INT DEFAULT 0, records_new INT DEFAULT 0,
                    records_updated INT DEFAULT 0, records_unchanged INT DEFAULT 0,
                    status VARCHAR(50) DEFAULT 'running', error_message TEXT, config_snapshot TEXT)""",
            ]:
                try:
                    c.execute(ddl)
                except Exception:
                    pass  # table already exists
        print("[db] MySQL/TiDB connected + pipeline tables ensured")
    else:
        with get_connection() as c: c.executescript(SCHEMA_SQL)
        print(f"[db] SQLite at {get_db_path()}")

def table_counts():
    """Row counts — pipeline tables exist in both SQLite and MySQL modes."""
    tables = ["prospects","source_records","enrichment_log","scores","outcomes","sync_log"]
    counts = {}
    with get_connection() as c:
        for t in tables:
            try: counts[t] = c.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            except: counts[t] = -1
    return counts

def upsert_prospect(conn, owner_key, segment, **fields):
    if USE_MYSQL:
        # Write to pipeline's own 'prospects' table first (so raw SQL in other modules works)
        _OK = {"owner_name","state","county","zip","geo_tier","entity_type","naics",
               "phone","email","linkedin_url","property_address","city","owner_age",
               "estimated_gdc","estimated_revenue_usd","multi_property_count",
               "is_deceased","is_suppressed","notes","market_value","owner_since",
               "formed_date","current_firm","years_in_industry","licenses",
               "current_role","current_employer","years_working","has_degree",
               "is_veteran","firm_name","years_in_practice","practice_area",
               "license_status","preferred_track","employee_count","industry",
               "ntee_cd","income_cd","revenue_amt","member_count"}
        safe_fields = {k:v for k,v in fields.items() if k in _OK}
        existing_p = conn.execute("SELECT id FROM prospects WHERE owner_key=?", (owner_key,)).fetchone()
        if existing_p:
            pid = existing_p[0]
            if safe_fields:
                sc = ", ".join(f"{k}=?" for k in safe_fields)
                conn.execute(f"UPDATE prospects SET {sc},last_updated_at=NOW() WHERE id=?",
                             list(safe_fields.values())+[pid])
        else:
            cols = ["owner_key","segment"]+list(safe_fields.keys())
            conn.execute(f"INSERT INTO prospects ({','.join(cols)}) VALUES ({','.join('?'*len(cols))})",
                         [owner_key,segment]+list(safe_fields.values()))
            pid = conn.execute("SELECT LAST_INSERT_ID()").fetchone()[0]

        # ALSO sync to Drizzle's lead_pipeline table (so stewardly-ai UI works)
        email = str(fields.get("email","")).strip()
        eh = _hash_pii(email) if email and "@" in email else _hash_pii(owner_key)
        existing = conn.execute("SELECT id FROM lead_pipeline WHERE email_hash=?", (eh,)).fetchone()
        first, last = _split_name(fields.get("owner_name") or owner_key)
        tier = TIER_TO_SAI.get(str(fields.get("propensity_tier","")))
        enrich = {k:v for k,v in fields.items()
                  if k in ("entity_type","naics","owner_age","estimated_gdc","estimated_revenue_usd",
                           "multi_property_count","current_firm","years_in_industry","licenses","firm_name",
                           "years_in_practice","practice_area","employee_count","industry","ntee_cd",
                           "market_value","contact_completeness","phone_source","email_source")
                  and v is not None and not (isinstance(v,float) and pd.isna(v))}
        seg_d = {k:v for k,v in fields.items()
                 if k in ("geo_tier","entity_type_inferred","naics_inferred","firm_movability_score")
                 and v is not None and not (isinstance(v,float) and pd.isna(v))}
        lp_args = (first,last,segment,json.dumps(enrich) if enrich else None,json.dumps(seg_d) if seg_d else None,
                   fields.get("propensity_score"),tier,fields.get("city",""),fields.get("state",""),fields.get("zip",""),
                   fields.get("current_firm") or fields.get("firm_name") or "")
        if existing:
            conn.execute("UPDATE lead_pipeline SET first_name=?,last_name=?,target_segment=?,enrichment_data=?,segment_data=?,propensity_score=?,propensity_tier=?,city=?,state=?,zip=?,company=?,updated_at=NOW() WHERE id=?",
                lp_args + (existing[0],))
        else:
            conn.execute("INSERT INTO lead_pipeline (email_hash,first_name,last_name,target_segment,enrichment_data,segment_data,propensity_score,propensity_tier,city,state,zip,company,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'new',NOW(),NOW())",
                (eh,) + lp_args)
        # ALWAYS return prospects.id (pipeline table) — not lead_pipeline.id
        return pid
    else:
        _OK = {"owner_name","state","county","zip","geo_tier","entity_type","naics",
               "phone","email","linkedin_url","property_address","city","owner_age",
               "estimated_gdc","estimated_revenue_usd","multi_property_count",
               "is_deceased","is_suppressed","notes","market_value","owner_since",
               "formed_date","current_firm","years_in_industry","licenses",
               "current_role","current_employer","years_working","has_degree",
               "is_veteran","firm_name","years_in_practice","practice_area",
               "license_status","preferred_track","employee_count","industry",
               "ntee_cd","income_cd","revenue_amt","member_count"}
        fields = {k:v for k,v in fields.items() if k in _OK}
        existing = conn.execute("SELECT id FROM prospects WHERE owner_key=?", (owner_key,)).fetchone()
        if existing:
            pid = existing[0]
            if fields:
                sc = ", ".join(f"{k}=?" for k in fields)
                conn.execute(f"UPDATE prospects SET {sc},last_updated_at=? WHERE id=?",
                             list(fields.values())+[datetime.now().isoformat(),pid])
            return pid
        cols = ["owner_key","segment"]+list(fields.keys())
        conn.execute(f"INSERT INTO prospects ({','.join(cols)}) VALUES ({','.join('?'*len(cols))})",
                     [owner_key,segment]+list(fields.values()))
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]

def insert_source_record(conn, prospect_id, source_type, raw_data, record_hash, source_name="", file_origin=""):
    # Pipeline's source_records table exists in both modes (created by init_db)
    existing = conn.execute("SELECT id FROM source_records WHERE prospect_id=? AND source_type=? AND record_hash=?",
                            (prospect_id,source_type,record_hash)).fetchone()
    if existing: return False
    conn.execute("INSERT INTO source_records (prospect_id,source_type,source_name,raw_data,record_hash,file_origin) VALUES (?,?,?,?,?,?)",
                 (prospect_id,source_type,source_name,raw_data,record_hash,file_origin))
    return True

def insert_score(conn, prospect_id, segment, model, score, decile, tier, ev, run_id):
    # Always write to pipeline's own scores table
    conn.execute("INSERT INTO scores (prospect_id,segment,scoring_model,propensity_score,propensity_decile,propensity_tier,expected_value_usd,scoring_run_id) VALUES (?,?,?,?,?,?,?,?)",
                 (prospect_id,segment,model,score,decile,tier,ev,run_id))
    if USE_MYSQL:
        # Look up the corresponding lead_pipeline.id (may differ from prospects.id)
        p_row = conn.execute("SELECT owner_key FROM prospects WHERE id=?", (prospect_id,)).fetchone()
        if p_row:
            eh = _hash_pii(p_row[0])
            lp_row = conn.execute("SELECT id FROM lead_pipeline WHERE email_hash=?", (eh,)).fetchone()
            if lp_row:
                lp_id = lp_row[0]
                # Get or create model
                mr = conn.execute("SELECT id FROM propensity_models WHERE model_name=?", (model,)).fetchone()
                if mr: mid = mr[0]
                else:
                    conn.execute("INSERT INTO propensity_models (model_name,model_type,active,created_at) VALUES (?,'expert_weights',1,NOW())", (model,))
                    mid = conn.execute("SELECT LAST_INSERT_ID()").fetchone()[0]
                # Write score with correct lead_pipeline.id
                conn.execute("INSERT INTO propensity_scores (lead_id,model_id,score,features_used,scored_at) VALUES (?,?,?,?,NOW())",
                             (lp_id,mid,score,json.dumps({"segment":segment,"decile":decile,"tier":tier,"ev":ev,"run_id":run_id})))
                conn.execute("UPDATE lead_pipeline SET propensity_score=?,propensity_tier=?,status='scored',updated_at=NOW() WHERE id=?",
                             (score,TIER_TO_SAI.get(tier,"cold"),lp_id))

def insert_outcome(conn, prospect_id, status, ghl_id="", score_at_change=None, changed_by="manual"):
    conn.execute("INSERT INTO outcomes (prospect_id,ghl_contact_id,outcome_status,propensity_score_at_change,changed_by) VALUES (?,?,?,?,?)",
                 (prospect_id,ghl_id,status,score_at_change,changed_by))
    if USE_MYSQL:
        p_row = conn.execute("SELECT owner_key FROM prospects WHERE id=?", (prospect_id,)).fetchone()
        if p_row:
            eh = _hash_pii(p_row[0])
            conn.execute("UPDATE lead_pipeline SET status=?,ghl_contact_id=?,updated_at=NOW() WHERE email_hash=?", (status,ghl_id,eh))

def get_prospects_for_scoring(conn, segment=None, limit=None):
    """Pipeline tables exist in both modes — same SQL."""
    sql, p = "SELECT * FROM prospects WHERE is_deceased=0 AND is_suppressed=0", []
    if segment: sql += " AND segment=?"; p.append(segment)
    if limit: sql += f" LIMIT {limit}"
    rows = conn.execute(sql, p).fetchall()
    return [dict(r._d) if hasattr(r,'_d') else dict(r) for r in rows]

def get_label_data(conn, min_outcomes=1):
    """Pipeline tables exist in both modes — same SQL."""
    rows = conn.execute(
        "SELECT p.*,o.outcome_status,s.propensity_score FROM prospects p "
        "JOIN outcomes o ON o.prospect_id=p.id "
        "LEFT JOIN scores s ON s.prospect_id=p.id "
        "WHERE o.outcome_status IN ('qualified','closed_won','closed_lost') "
        "ORDER BY o.changed_at DESC"
    ).fetchall()
    return [dict(r._d) if hasattr(r,'_d') else dict(r) for r in rows]

if __name__ == "__main__":
    init_db()
    print(f"Mode: {'MySQL/TiDB' if USE_MYSQL else 'SQLite'}")
    print(f"Counts: {table_counts()}")
