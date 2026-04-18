"""
WealthBridge Propensity Pipeline — Orchestrator
================================================
One-command run of the full pipeline:

  1. (optional) Pull WA data from data.wa.gov
  2. (optional) Parse NM bulk file if present
  3. Geocode records with missing county
  4. Join ACS zip-income affluence
  5. Phase 0 scoring (always)
  6. If Engagement Database labels present → Phase 1 logistic

Usage:
  python run_pipeline.py                           # defaults: ./data/raw → ./data/scored
  python run_pipeline.py --skip-scrapers           # use existing raw CSVs
  python run_pipeline.py --refresh-acs             # rebuild ACS cache
  python run_pipeline.py --phase1-labels ./data/labels/engagement_export.csv
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def run_step(name: str, cmd: list[str], skip: bool = False) -> bool:
    if skip:
        print(f"\n=== [skip] {name} ===")
        return True
    print(f"\n=== [run] {name} ===")
    print(f"    $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=REPO_ROOT)
    ok = result.returncode == 0
    if not ok:
        print(f"    [fail] {name} exited with code {result.returncode}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, default=Path("./data/raw"))
    ap.add_argument("--scored", type=Path, default=Path("./data/scored"))
    ap.add_argument("--skip-scrapers", action="store_true")
    ap.add_argument("--skip-wa", action="store_true")
    ap.add_argument("--nm-bulk-file", type=Path, default=None)
    ap.add_argument("--skip-geocoding", action="store_true")
    ap.add_argument("--skip-enrichment", action="store_true",
                    help="Skip the T0 enrichment step entirely")
    ap.add_argument("--budget-t2", type=float, default=0.0,
                    help="Max USD spend on T2 paid enrichment per run")
    ap.add_argument("--budget-t3", type=float, default=0.0,
                    help="Max USD spend on T3 premium enrichment per run")
    ap.add_argument("--skip-t2", action="store_true")
    ap.add_argument("--skip-t3", action="store_true")
    ap.add_argument("--refresh-acs", action="store_true")
    ap.add_argument("--wa-limit", type=int, default=25000)
    ap.add_argument("--phase1-labels", type=Path, default=None,
                    help="Engagement Database export CSV — triggers Phase 1 training")
    args = ap.parse_args()

    py = sys.executable
    steps_ok = []

    # 1. WA scraper
    if not args.skip_scrapers and not args.skip_wa:
        steps_ok.append(run_step(
            "WA DOR scraper",
            [py, "src/scrapers/wa_dor_scraper.py", "--out", str(args.raw),
             "--limit", str(args.wa_limit), "--target-counties-only"],
        ))

    # 2. NM bulk file
    if args.nm_bulk_file and args.nm_bulk_file.exists():
        steps_ok.append(run_step(
            "NM SOS bulk loader",
            [py, "src/scrapers/nm_sos_loader.py",
             "--input", str(args.nm_bulk_file), "--out", str(args.raw)],
        ))
    elif args.nm_bulk_file:
        print(f"[warn] --nm-bulk-file {args.nm_bulk_file} not found; skipping")

    # 3a. Enrichment (always — runs T0 free modules at minimum)
    if not args.skip_enrichment:
        steps_ok.append(run_step(
            "Enrichment (T0 free + T1/T2/T3 if budget set)",
            [py, "src/enrichment/enrichment_orchestrator.py",
             "--input", str(args.raw),
             "--output", str(args.raw.parent / "enriched"),
             "--budget-t2", str(args.budget_t2),
             "--budget-t3", str(args.budget_t3)]
            + (["--skip-t2"] if args.skip_t2 else [])
            + (["--skip-t3"] if args.skip_t3 else []),
        ))

    # 3. ACS cache refresh (optional)
    if args.refresh_acs:
        steps_ok.append(run_step(
            "ACS zip income — build cache",
            [py, "src/enrichment/acs_zip_income.py", "--build-cache"],
        ))

    # 4. Phase 0 scoring — auto-detect v1 vs v2 file presence
    # If any non-legacy filename exists, run v2 (which also handles legacy)
    raw_files = list(args.raw.glob("WB_*.csv"))
    has_v2_files = any("_AZ.csv" in f.name or "_NM.csv" in f.name or "_WA.csv" in f.name
                       and "_County" not in f.name for f in raw_files)
    if has_v2_files:
        steps_ok.append(run_step(
            "Phase 0 propensity scoring (v2 — multi-segment)",
            [py, "phase0_propensity_scoring_v2.py",
             "--input", str(args.raw), "--output", str(args.scored)],
        ))
    else:
        steps_ok.append(run_step(
            "Phase 0 propensity scoring (v1 — legacy 2-segment)",
            [py, "phase0_propensity_scoring.py",
             "--input", str(args.raw), "--output", str(args.scored)],
        ))

    # 5. Phase 1 logistic (if labels available)
    if args.phase1_labels and args.phase1_labels.exists():
        for seg in ["Residential", "Commercial"]:
            scored_file = args.scored / f"scored_{seg.lower()}.csv"
            if not scored_file.exists():
                print(f"[skip] {seg} phase 1 — {scored_file} not found")
                continue
            steps_ok.append(run_step(
                f"Phase 1 logistic — {seg}",
                [py, "src/modeling/phase1_logistic.py",
                 "--features", str(scored_file),
                 "--labels", str(args.phase1_labels),
                 "--segment", seg,
                 "--out", "./data/models"],
            ))

    print(f"\n=== Pipeline complete: {sum(steps_ok)} / {len(steps_ok)} steps succeeded ===")
    sys.exit(0 if all(steps_ok) else 1)


if __name__ == "__main__":
    main()
