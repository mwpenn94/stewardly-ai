"""
DB-Backed Pipeline Bridge
===========================
Bridges the database layer to the existing enrichment + scoring modules.
The enrichment modules expect DataFrames; the DB stores rows. This module
translates between them, tracks what's been enriched/scored, and writes
results back.

Flow:
  1. Read un-enriched prospects from DB → DataFrame
  2. Run enrichment orchestrator (T0 → T1 → T2 → T3)
  3. Write enriched fields back to prospects table
  4. Log enrichment actions to enrichment_log table
  5. Read enriched prospects → run scorer → write scores to scores table
  6. Export top-tier scored prospects for GHL push

Usage:
  python pipeline_bridge.py --enrich           # enrich all un-enriched
  python pipeline_bridge.py --score            # score all enriched
  python pipeline_bridge.py --export-ghl       # push A+B to GHL
  python pipeline_bridge.py --full             # enrich + score + export
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from src.db.schema import (
    init_db, get_connection, table_counts, insert_score,
)


# ============================================================================
# DB → DataFrame extraction
# ============================================================================

def load_prospects_for_enrichment(conn, segment: str = None,
                                   only_unenriched: bool = True,
                                   limit: int = None) -> pd.DataFrame:
    """Load prospects needing enrichment as a DataFrame."""
    sql = "SELECT * FROM prospects WHERE is_deceased = 0 AND is_suppressed = 0"
    params = []
    if segment:
        sql += " AND segment = ?"
        params.append(segment)
    if only_unenriched:
        # Prospects with no enrichment_log entries, or last enrichment > 30 days ago
        sql += """ AND (id NOT IN (SELECT DISTINCT prospect_id FROM enrichment_log)
                   OR id IN (SELECT prospect_id FROM enrichment_log
                             GROUP BY prospect_id
                             HAVING MAX(enriched_at) < datetime('now', '-30 days')))"""
    if limit:
        sql += f" LIMIT {limit}"
    rows = conn.execute(sql, params).fetchall()
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame([dict(r) for r in rows])


def load_prospects_for_scoring(conn, segment: str = None,
                                limit: int = None) -> pd.DataFrame:
    """Load all active prospects for scoring."""
    sql = "SELECT * FROM prospects WHERE is_deceased = 0 AND is_suppressed = 0"
    params = []
    if segment:
        sql += " AND segment = ?"
        params.append(segment)
    if limit:
        sql += f" LIMIT {limit}"
    rows = conn.execute(sql, params).fetchall()
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame([dict(r) for r in rows])


# ============================================================================
# DataFrame → DB writeback
# ============================================================================

ENRICHABLE_FIELDS = [
    # Core shared fields
    "owner_name", "state", "county", "zip", "entity_type", "naics",
    "phone", "email", "linkedin_url", "owner_age",
    "estimated_gdc", "estimated_revenue_usd", "multi_property_count",
    "geo_tier", "is_deceased",
    # Segment-specific (enrichment may fill these)
    "market_value", "current_firm", "years_in_industry", "licenses",
    "firm_name", "years_in_practice", "practice_area",
    "current_role", "current_employer", "years_working", "has_degree", "is_veteran",
    "license_status", "preferred_track", "employee_count", "industry",
    "ntee_cd", "income_cd", "revenue_amt", "member_count",
]


def write_enrichment_back(conn, original_df: pd.DataFrame,
                           enriched_df: pd.DataFrame,
                           enricher_name: str = "t0_pipeline",
                           tier: str = "T0"):
    """Write enriched fields back to prospects table + log."""
    updated = 0
    for idx, row in enriched_df.iterrows():
        pid = row.get("id")
        if not pid:
            continue
        # Find which fields changed
        orig = original_df.loc[original_df["id"] == pid]
        if orig.empty:
            continue
        orig_row = orig.iloc[0]
        changed_fields = []
        set_parts, vals = [], []
        for col in ENRICHABLE_FIELDS:
            new_val = row.get(col)
            old_val = orig_row.get(col)
            if new_val is not None and not (isinstance(new_val, float) and pd.isna(new_val)):
                if old_val is None or (isinstance(old_val, float) and pd.isna(old_val)) or new_val != old_val:
                    set_parts.append(f"{col} = ?")
                    vals.append(new_val)
                    changed_fields.append(col)
        if set_parts:
            set_parts.append("last_updated_at = ?")
            vals.append(datetime.now().isoformat())
            vals.append(pid)
            conn.execute(
                f"UPDATE prospects SET {', '.join(set_parts)} WHERE id = ?",
                vals
            )
            # Log enrichment
            conn.execute(
                "INSERT INTO enrichment_log (prospect_id, enricher_name, tier, "
                "fields_updated, enriched_at) VALUES (?, ?, ?, ?, ?)",
                (pid, enricher_name, tier, json.dumps(changed_fields),
                 datetime.now().isoformat())
            )
            updated += 1
    return updated


def write_scores_to_db(conn, scored_df: pd.DataFrame, model_name: str = "phase0_heuristic"):
    """Write scoring results to scores table."""
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    written = 0
    for _, row in scored_df.iterrows():
        pid = row.get("id")
        if not pid:
            continue
        insert_score(
            conn, pid,
            segment=row.get("segment", ""),
            model=model_name,
            score=row.get("propensity_score", 0),
            decile=int(row.get("propensity_decile", 5)),
            tier=row.get("propensity_tier", "C"),
            ev=row.get("expected_value_usd", 0),
            run_id=run_id,
        )
        # Update prospect's last_scored_at
        conn.execute(
            "UPDATE prospects SET last_scored_at = ? WHERE id = ?",
            (datetime.now().isoformat(), pid)
        )
        written += 1
    return written, run_id


# ============================================================================
# Enrichment pipeline (DB-backed)
# ============================================================================

def run_enrichment(segment: str = None, limit: int = None) -> dict:
    """Run T0 enrichment on prospects from DB, write results back."""
    init_db()
    with get_connection() as conn:
        df = load_prospects_for_enrichment(conn, segment=segment, limit=limit)
        if df.empty:
            return {"status": "idle", "message": "No prospects needing enrichment"}
        print(f"[bridge] loaded {len(df)} prospects for enrichment")
        original = df.copy()

        # Run each T0 enrichment module
        enrichers = [
            ("usps_address_normalizer", "src.enrichment.usps_address_normalizer"),
            ("name_entity_inference", "src.enrichment.name_entity_inference"),
            ("naics_classifier", "src.enrichment.naics_classifier"),
            ("age_imputer", "src.enrichment.age_imputer"),
            ("revenue_imputer", "src.enrichment.revenue_imputer"),
            ("gdc_imputer", "src.enrichment.gdc_imputer"),
            ("firm_movability", "src.enrichment.firm_movability_classifier"),
            ("new_associate_signals", "src.enrichment.new_associate_signals"),
            ("practice_area_inferrer", "src.enrichment.practice_area_inferrer"),
            ("affiliate_signals", "src.enrichment.affiliate_signal_inferrer"),
            ("irs_bmf", "src.enrichment.irs_bmf_loader"),
            ("engagement", "src.enrichment.engagement_signal_aggregator"),
        ]
        for name, module_path in enrichers:
            try:
                from importlib import import_module
                mod = import_module(module_path)
                result = mod.enrich(df)
                if isinstance(result, tuple):
                    df, stats = result
                else:
                    df = result
                print(f"  [enrich] {name}: OK")
            except Exception as e:
                print(f"  [enrich] {name}: SKIP ({e})")

        # Write back
        updated = write_enrichment_back(conn, original, df, "t0_pipeline", "T0")
        print(f"[bridge] enrichment updated {updated} prospects")
        return {"status": "completed", "enriched": updated, "total": len(df)}


# ============================================================================
# Scoring pipeline (DB-backed)
# ============================================================================

def run_scoring(segment: str = None, limit: int = None) -> dict:
    """Score prospects from DB, write scores to scores table."""
    init_db()
    with get_connection() as conn:
        df = load_prospects_for_scoring(conn, segment=segment, limit=limit)
        if df.empty:
            return {"status": "idle", "message": "No prospects to score"}
        print(f"[bridge] loaded {len(df)} prospects for scoring")

        # Run the v2 scorer per segment
        try:
            from phase0_propensity_scoring_v2 import score_segment_v2, SEGMENT_CONFIG
        except ImportError:
            sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
            from phase0_propensity_scoring_v2 import score_segment_v2, SEGMENT_CONFIG

        all_scored = []
        for seg, sub in df.groupby("segment"):
            if seg not in SEGMENT_CONFIG:
                print(f"  [score] skip unknown segment: {seg}")
                continue
            try:
                scored = score_segment_v2(sub.copy(), seg)
                all_scored.append(scored)
                print(f"  [score] {seg}: {len(scored)} rows scored")
            except Exception as e:
                print(f"  [score] {seg}: FAILED ({e})")

        if not all_scored:
            return {"status": "completed", "scored": 0}

        combined = pd.concat(all_scored, ignore_index=True, sort=False)
        written, run_id = write_scores_to_db(conn, combined)
        print(f"[bridge] wrote {written} scores (run: {run_id})")
        return {"status": "completed", "scored": written, "run_id": run_id}


# ============================================================================
# GHL Export (DB-backed)
# ============================================================================

def run_ghl_export(min_tier: str = "B") -> dict:
    """Export top-tier prospects from DB to GHL."""
    init_db()
    tier_order = {"A": 1, "B": 2, "C": 3, "D": 4}
    cutoff = tier_order.get(min_tier, 2)

    with get_connection() as conn:
        # Get latest scores for each prospect
        sql = """
        SELECT p.*, s.propensity_score, s.propensity_decile, s.propensity_tier,
               s.expected_value_usd, s.scoring_run_id
        FROM prospects p
        JOIN scores s ON s.prospect_id = p.id
        WHERE s.id IN (
            SELECT MAX(id) FROM scores GROUP BY prospect_id
        )
        AND p.is_deceased = 0 AND p.is_suppressed = 0
        ORDER BY s.expected_value_usd DESC
        """
        rows = conn.execute(sql).fetchall()
        if not rows:
            return {"status": "idle", "message": "No scored prospects"}

        df = pd.DataFrame([dict(r) for r in rows])
        # Filter by tier
        df = df[df["propensity_tier"].map(lambda t: tier_order.get(t, 99)) <= cutoff]

        # Actionability gate: require at least one contact method
        has_phone = df["phone"].fillna("").astype(str).str.strip().str.len().gt(5)
        has_email = df["email"].fillna("").astype(str).str.strip().str.contains("@", na=False)
        has_address = df["property_address"].fillna("").astype(str).str.strip().str.len().gt(5) \
            if "property_address" in df.columns else pd.Series(False, index=df.index)
        actionable = has_phone | has_email | has_address
        n_gated = int((~actionable).sum())
        df_export = df[actionable].copy()
        if n_gated > 0:
            print(f"[bridge] actionability gate: {n_gated} prospects blocked (no phone/email/address)")
        print(f"[bridge] {len(df_export)} prospects qualify for GHL export (tier ≤ {min_tier}, actionable)")

        # Try GHL push if configured
        try:
            from src.connectors.ghl import GHLConnector
            ghl = GHLConnector()
            if ghl.test_connection():
                results = ghl.push_batch(df_export)
                print(f"[bridge] GHL push: {results}")
                return {"status": "completed", "exported": len(df_export), "gated": n_gated, "ghl_results": results}
            else:
                print("[bridge] GHL not configured — exporting to CSV instead")
        except Exception as e:
            print(f"[bridge] GHL push failed ({e}) — exporting to CSV instead")

        # Fallback: CSV export
        out = Path("./data/scored/ghl_import_master.csv")
        out.parent.mkdir(parents=True, exist_ok=True)
        export_cols = ["segment", "geo_tier", "state", "county", "owner_key",
                       "owner_name", "phone", "email", "propensity_score",
                       "propensity_decile", "propensity_tier", "expected_value_usd"]
        export_cols = [c for c in export_cols if c in df.columns]
        df_export[export_cols].to_csv(out, index=False)
        print(f"[bridge] wrote {len(df_export)} → {out}")
        return {"status": "completed", "exported": len(df_export), "gated": n_gated, "file": str(out)}


# ============================================================================
# Full pipeline
# ============================================================================

def run_full_pipeline(segment: str = None) -> dict:
    """Ingest → Enrich → Contact Enrich → Score → Export in one call."""
    results = {}

    # Step 1: Ingest (file-drop sources)
    print("\n=== STEP 1: INGEST ===")
    from src.connectors.ingestion_engine import ingest_all
    # file_drop ingests ALL WB_*.csv files from data/raw/ (covers all 8 segments)
    # assessor connectors also run for their specific file patterns
    ingest_results = ingest_all(force_full=False,
                                 sources=["file_drop",
                                           "az_assessor_pima", "az_assessor_mohave",
                                           "az_assessor_santa_cruz"])
    results["ingest"] = {k: {"new": v.records_new, "updated": v.records_updated}
                          for k, v in ingest_results.items()}

    # Step 2: Feature Enrich
    print("\n=== STEP 2: FEATURE ENRICH ===")
    results["enrich"] = run_enrichment(segment=segment)

    # Step 3: Contact Enrich (phone + email)
    print("\n=== STEP 3: CONTACT ENRICH ===")
    try:
        from src.enrichment.contact_enrichment import run_contact_enrichment
        results["contact"] = run_contact_enrichment(tier="T0")
    except Exception as e:
        print(f"[bridge] contact enrichment failed: {e}")
        results["contact"] = {"error": str(e)}

    # Step 4: Score
    print("\n=== STEP 4: SCORE ===")
    results["score"] = run_scoring(segment=segment)

    # Step 5: Export (with actionability gate)
    print("\n=== STEP 5: EXPORT ===")
    results["export"] = run_ghl_export()

    print(f"\n=== PIPELINE COMPLETE ===")
    print(f"DB: {table_counts()}")
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--enrich", action="store_true")
    ap.add_argument("--score", action="store_true")
    ap.add_argument("--export-ghl", action="store_true")
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--segment", type=str, default=None)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    if args.full:
        result = run_full_pipeline(segment=args.segment)
    elif args.enrich:
        result = run_enrichment(segment=args.segment, limit=args.limit)
    elif args.score:
        result = run_scoring(segment=args.segment, limit=args.limit)
    elif args.export_ghl:
        result = run_ghl_export()
    else:
        result = run_full_pipeline(segment=args.segment)

    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
