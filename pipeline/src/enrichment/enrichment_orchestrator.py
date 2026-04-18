"""
Enrichment Orchestrator
========================
Runs the cost-disciplined enrichment progression:

  T0 (free, universal)         → all rows
  T1 (free-with-login)         → top 80% by partial-data score
  T2 (cheap paid, $0.02-0.50)  → top 30% (after T0+T1)
  T3 (premium paid, $0.50-5)   → A-tier only (top 5-10%)

Tracks per-tier costs and writes an audit log. Hard-stops at any
budget cap. Re-scores between tiers so the next tier targets the
right rows.

Usage:
  python enrichment_orchestrator.py \\
      --input data/raw/ \\
      --output data/enriched/ \\
      --budget-t2 200 \\
      --budget-t3 1000 \\
      --skip-t2 --skip-t3   # for testing
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from importlib import import_module
from pathlib import Path
from typing import Callable

import pandas as pd

# Module registry — tier → list of (module_path, function_name, applies_to_segments)
ENRICHMENT_PIPELINE = {
    "T0": [
        # Universal first — geo + address normalization
        ("src.enrichment.usps_address_normalizer",  "enrich",  None),
        ("src.enrichment.census_geocoder",          "geocode_df",  None),
        ("src.enrichment.acs_zip_income",           "apply_zip_affluence", None),
        # Cross-segment imputers
        ("src.enrichment.name_entity_inference",    "enrich",  None),
        ("src.enrichment.naics_classifier",         "enrich",  ["commercial_client", "hr_director", "cpa_attorney_partner"]),
        ("src.enrichment.multi_property_aggregator","enrich",  ["residential_client", "commercial_client"]),
        ("src.enrichment.age_imputer",              "enrich",  None),
        ("src.enrichment.revenue_imputer",          "enrich",  ["commercial_client", "hr_director", "cpa_attorney_partner"]),
        # Recruit-segment imputers
        ("src.enrichment.gdc_imputer",              "enrich",  ["experienced_pro"]),
        ("src.enrichment.firm_movability_classifier","enrich", ["experienced_pro"]),
        ("src.enrichment.new_associate_signals",    "enrich",  ["new_associate"]),
        # Partner + affiliate
        ("src.enrichment.practice_area_inferrer",   "enrich",  ["cpa_attorney_partner"]),
        ("src.enrichment.affiliate_signal_inferrer","enrich",  ["affiliate"]),
        # Nonprofit
        ("src.enrichment.irs_bmf_loader",           "enrich",  ["nonprofit_leader"]),
        # Universal — engagement (must run AFTER affiliate signal so it overrides correctly)
        ("src.enrichment.engagement_signal_aggregator", "enrich",  None),
        # Universal — DMF suppression (last, after all enrichment)
        ("src.enrichment.dmf_screener",             "enrich",  None),
        # Universal — contact enrichment (phone/email from source records + NPI + domain guess)
        ("src.enrichment.contact_enrichment",       "run_contact_enrichment_df",  None),
        # Contact-specific enrichment: email patterns + Google Places phone + multi-source aggregation
        ("src.connectors.professional_directories", "enrich", None),
        # Contact validation: phone/email format check, DNC flags, cross-source confidence
        ("src.enrichment.contact_validation",       "enrich", None),
    ],
    "T1": [
        # Wired to existing scrapers — when wired in, gates by login/credentials
        # ("src.enrichment.firm_movability_classifier", "enrich", ["experienced_pro"]),
        # ("src.enrichment.practice_area_inferrer",     "enrich", ["cpa_attorney_partner"]),
    ],
    "T2": [
        # Cheap paid ($0.02-0.15/record, budget-capped)
        # Only runs on prospects still missing phone or email after T0
        ("src.connectors.paid_enrichment", "enrich_batch_skip", None),     # BatchSkipTracing → phone
        ("src.connectors.paid_enrichment", "enrich_hunter", None),         # Hunter.io → email
    ],
    "T3": [
        # Premium paid ($0.50-2.00/record, A-tier only)
        ("src.connectors.paid_enrichment", "enrich_apollo", None),         # Apollo → phone + email + firmographic
    ],
}


def heuristic_partial_score(df: pd.DataFrame) -> pd.Series:
    """Quick partial-data score for ranking before full scoring run."""
    score = pd.Series(0.0, index=df.index)
    for col, weight in [("market_value", 0.30), ("equity_est", 0.30),
                        ("estimated_gdc", 0.30), ("annual_revenue", 0.30),
                        ("multi_property_count", 0.15), ("naics_confidence", 0.10),
                        ("entity_type_confidence", 0.10)]:
        if col in df.columns:
            ranked = pd.to_numeric(df[col], errors="coerce").rank(pct=True, na_option="bottom")
            score = score + ranked.fillna(0.5) * weight
    return score


def run_module(df: pd.DataFrame, module_path: str, func_name: str,
               segment_filter: list | None) -> tuple[pd.DataFrame, dict]:
    """Apply enrichment to relevant rows; return updated df + stats."""
    if segment_filter and "segment" in df.columns:
        mask = df["segment"].isin(segment_filter)
        if not mask.any():
            return df, {"skipped": True, "reason": f"no rows match segments {segment_filter}"}
        sub = df.loc[mask].copy()
    else:
        mask = pd.Series(True, index=df.index)
        sub = df.copy()
    try:
        module = import_module(module_path)
        func: Callable = getattr(module, func_name)
        result = func(sub)
        if isinstance(result, tuple):
            enriched, stats = result
        else:
            enriched, stats = result, {"n_input": len(sub)}
    except (ImportError, AttributeError, Exception) as e:
        return df, {"failed": True, "error": str(e), "module": module_path}
    # Merge enriched columns back
    # Merge enricher output back using combine_first:
    # - New columns from enricher get added to df
    # - For existing columns, enricher values overwrite ONLY where df has NaN
    # - Non-NaN values in df are preserved (earlier modules' work safe)
    for col in enriched.columns:
        if col not in df.columns:
            df[col] = pd.NA
        # Only update masked rows
        enriched_series = pd.Series(enriched[col].values, index=df.index[mask])
        # combine_first: keep df values where non-null, fill from enriched where df is null
        df.loc[mask, col] = df.loc[mask, col].combine_first(enriched_series)
    return df, stats


def run(input_dir: Path, output_dir: Path,
        budget_t2: float = 0.0, budget_t3: float = 0.0,
        skip_t2: bool = False, skip_t3: bool = False) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    audit = {
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "tiers": {}, "total_cost_usd": 0.0,
        "input_files": [], "output_files": [],
    }

    # Load all input CSVs
    frames = []
    for path in sorted(input_dir.glob("WB_*.csv")):
        df = pd.read_csv(path, low_memory=False)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        df["_source_file"] = path.name
        # Infer segment from filename if not present
        if "segment" not in df.columns:
            from phase0_propensity_scoring_v2 import parse_filename_v2
            meta = parse_filename_v2(path)
            df["segment"] = meta.get("segment") or "unknown"
        frames.append(df)
        audit["input_files"].append(path.name)
    if not frames:
        raise SystemExit(f"No WB_*.csv files in {input_dir}")
    df = pd.concat(frames, ignore_index=True, sort=False)
    print(f"[orchestrator] loaded {len(df):,} rows from {len(frames)} files")

    # ===== T0 =====
    print(f"\n=== T0 (free, universal) — {len(ENRICHMENT_PIPELINE['T0'])} modules ===")
    audit["tiers"]["T0"] = {"modules": [], "rows_processed": len(df), "cost_usd": 0.0}
    for module_path, func_name, seg_filter in ENRICHMENT_PIPELINE["T0"]:
        print(f"  → {module_path}.{func_name}")
        df, stats = run_module(df, module_path, func_name, seg_filter)
        audit["tiers"]["T0"]["modules"].append({"module": module_path, "stats": stats})

    # Score round 1 → rank for T1+
    df["_partial_score"] = heuristic_partial_score(df)

    # ===== T1 =====
    if ENRICHMENT_PIPELINE["T1"]:
        n_t1 = int(len(df) * 0.80)
        cutoff = df["_partial_score"].quantile(0.20)
        t1_mask = df["_partial_score"] >= cutoff
        df_t1 = df[t1_mask].copy()
        print(f"\n=== T1 (free-with-login) — top {n_t1:,} rows ({len(ENRICHMENT_PIPELINE['T1'])} modules) ===")
        audit["tiers"]["T1"] = {"modules": [], "rows_processed": int(t1_mask.sum()), "cost_usd": 0.0}
        for module_path, func_name, seg_filter in ENRICHMENT_PIPELINE["T1"]:
            print(f"  → {module_path}.{func_name}")
            df_t1, stats = run_module(df_t1, module_path, func_name, seg_filter)
            audit["tiers"]["T1"]["modules"].append({"module": module_path, "stats": stats})
        # Merge T1 results back
        df.update(df_t1)
        df["_partial_score"] = heuristic_partial_score(df)

    # ===== T2 =====
    if not skip_t2 and ENRICHMENT_PIPELINE["T2"] and budget_t2 > 0:
        n_t2 = int(len(df) * 0.30)
        cutoff = df["_partial_score"].quantile(0.70)
        t2_mask = df["_partial_score"] >= cutoff
        print(f"\n=== T2 (cheap paid) — top {int(t2_mask.sum()):,} rows, budget ${budget_t2} ===")
        audit["tiers"]["T2"] = {"modules": [], "rows_processed": int(t2_mask.sum()), "cost_usd": 0.0,
                                "budget_usd": budget_t2}
        df_t2 = df[t2_mask].copy()
        spent = 0.0
        for module_path, func_name, seg_filter in ENRICHMENT_PIPELINE["T2"]:
            if spent >= budget_t2:
                print(f"  [budget hit at ${spent:.2f}, halting T2]")
                break
            df_t2, stats = run_module(df_t2, module_path, func_name, seg_filter)
            cost = stats.get("cost_usd", 0.0)
            spent += cost
            audit["tiers"]["T2"]["modules"].append({"module": module_path, "stats": stats})
        audit["tiers"]["T2"]["cost_usd"] = spent
        audit["total_cost_usd"] += spent
        df.update(df_t2)
        df["_partial_score"] = heuristic_partial_score(df)
    elif not ENRICHMENT_PIPELINE["T2"]:
        print(f"\n=== T2 — no modules registered (placeholder) ===")

    # ===== T3 =====
    if not skip_t3 and ENRICHMENT_PIPELINE["T3"] and budget_t3 > 0:
        cutoff = df["_partial_score"].quantile(0.90)
        t3_mask = df["_partial_score"] >= cutoff
        print(f"\n=== T3 (premium) — A-tier {int(t3_mask.sum()):,} rows, budget ${budget_t3} ===")
        audit["tiers"]["T3"] = {"modules": [], "rows_processed": int(t3_mask.sum()), "cost_usd": 0.0,
                                "budget_usd": budget_t3}
        df_t3 = df[t3_mask].copy()
        spent = 0.0
        for module_path, func_name, seg_filter in ENRICHMENT_PIPELINE["T3"]:
            if spent >= budget_t3:
                print(f"  [budget hit at ${spent:.2f}, halting T3]")
                break
            df_t3, stats = run_module(df_t3, module_path, func_name, seg_filter)
            cost = stats.get("cost_usd", 0.0)
            spent += cost
            audit["tiers"]["T3"]["modules"].append({"module": module_path, "stats": stats})
        audit["tiers"]["T3"]["cost_usd"] = spent
        audit["total_cost_usd"] += spent
        df.update(df_t3)
    elif not ENRICHMENT_PIPELINE["T3"]:
        print(f"\n=== T3 — no modules registered (placeholder) ===")

    # Write enriched output (single combined CSV; phase0_v2 splits by segment)
    df = df.drop(columns=["_partial_score"], errors="ignore")
    out = output_dir / "enriched_combined.csv"
    df.to_csv(out, index=False)
    audit["output_files"].append(out.name)
    audit["final_row_count"] = len(df)
    audit["final_column_count"] = len(df.columns)

    # Audit log
    audit_path = output_dir / "enrichment_audit.json"
    with open(audit_path, "w") as f:
        json.dump(audit, f, indent=2, default=str)
    print(f"\n[orchestrator] wrote {len(df):,} enriched rows × {len(df.columns)} cols → {out}")
    print(f"[orchestrator] audit log → {audit_path}")
    print(f"[orchestrator] total enrichment cost: ${audit['total_cost_usd']:.2f}")
    return audit


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=Path("./data/raw"))
    ap.add_argument("--output", type=Path, default=Path("./data/enriched"))
    ap.add_argument("--budget-t2", type=float, default=0.0)
    ap.add_argument("--budget-t3", type=float, default=0.0)
    ap.add_argument("--skip-t2", action="store_true")
    ap.add_argument("--skip-t3", action="store_true")
    args = ap.parse_args()
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    run(args.input, args.output, args.budget_t2, args.budget_t3,
        args.skip_t2, args.skip_t3)
