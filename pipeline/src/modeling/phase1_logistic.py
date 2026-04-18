"""
Phase 1 Propensity Model — Logistic Regression
===============================================
Graduation path from the Phase 0 heuristic scorer.

When to run:
  - After ≥300 labeled outcomes are in the Engagement Database (outcome_status
    ∈ {qualified, closed_won, closed_lost}).
  - Ideally separate models for Residential and Commercial.

What it produces:
  - Calibrated probability of `qualified_or_won` per prospect
  - Feature-coefficient report (explainability — important for FINRA/ESI compliance)
  - Calibration curve + AUC on held-out set
  - Serialized model (joblib) to re-score nightly
  - Updated GHL import file with Phase-1 scores

Inputs:
  - features CSV (output of phase0 pipeline, before score column)
  - labels CSV (export of Engagement Database with outcome_status per owner_key)

Usage:
  python phase1_logistic.py \\
      --features ./data/scored/scored_residential.csv \\
      --labels   ./data/labels/engagement_export.csv \\
      --segment  Residential \\
      --out      ./data/models/
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

POSITIVE_LABELS = {"qualified", "closed_won"}
NEGATIVE_LABELS = {"closed_lost"}
# `not_contacted`, `contacted`, `responded` are excluded from training (censored)

RES_FEATURES = ["equity_decile", "ownership_length_decile", "age_fit_score",
                "zip_affluence_decile", "recent_liquidity_event", "priority_multiplier"]
COM_FEATURES = ["entity_age_decile", "entity_type_factor", "revenue_band_decile",
                "multi_property_count_decile", "owner_age_fit_score", "priority_multiplier"]


def prepare_training(features_df: pd.DataFrame, labels_df: pd.DataFrame,
                     segment: str) -> tuple[pd.DataFrame, pd.Series]:
    """Join features to labels, filter to terminal outcomes."""
    label_col = "outcome_status"
    if label_col not in labels_df.columns:
        raise ValueError(f"labels file must have `{label_col}` column")
    labels_df = labels_df[labels_df[label_col].str.lower().isin(POSITIVE_LABELS | NEGATIVE_LABELS)]
    labels_df = labels_df[["owner_key", label_col]].drop_duplicates("owner_key")
    labels_df["y"] = labels_df[label_col].str.lower().isin(POSITIVE_LABELS).astype(int)
    feat_cols = RES_FEATURES if segment == "Residential" else COM_FEATURES
    merged = features_df.merge(labels_df[["owner_key", "y"]], on="owner_key", how="inner")
    if len(merged) < 100:
        print(f"[phase1] WARNING: only {len(merged)} labeled rows — model will be unstable")
    X = merged[feat_cols].fillna(0.5).astype(float)
    y = merged["y"]
    return X, y


def train(X: pd.DataFrame, y: pd.Series, random_state: int = 42) -> dict:
    """Train logistic regression with cross-validation + calibration."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score, brier_score_loss
    from sklearn.calibration import CalibratedClassifierCV

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25,
                                              random_state=random_state, stratify=y)
    base = LogisticRegression(max_iter=1000, class_weight="balanced")
    base.fit(X_tr, y_tr)

    # Calibrate for trustworthy probabilities
    cal = CalibratedClassifierCV(base, method="isotonic", cv=3)
    cal.fit(X_tr, y_tr)

    proba_te = cal.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(y_te, proba_te)
    brier = brier_score_loss(y_te, proba_te)

    coefs = dict(zip(X.columns, base.coef_[0].tolist()))
    intercept = float(base.intercept_[0])

    return {
        "model": cal, "base_model": base, "auc": float(auc), "brier": float(brier),
        "coefficients": coefs, "intercept": intercept,
        "n_train": len(X_tr), "n_test": len(X_te),
        "positive_rate": float(y.mean()),
    }


def score_full(features_df: pd.DataFrame, model, feat_cols: list[str]) -> pd.Series:
    X = features_df[feat_cols].fillna(0.5).astype(float)
    return pd.Series(model.predict_proba(X)[:, 1], index=features_df.index)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", type=Path, required=True)
    ap.add_argument("--labels", type=Path, required=True)
    ap.add_argument("--segment", choices=["Residential", "Commercial"], required=True)
    ap.add_argument("--out", type=Path, default=Path("./data/models"))
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    features_df = pd.read_csv(args.features, low_memory=False)
    labels_df = pd.read_csv(args.labels, low_memory=False)

    X, y = prepare_training(features_df, labels_df, args.segment)
    print(f"[phase1] training on {len(X):,} labeled rows | positive rate {y.mean():.2%}")

    result = train(X, y)
    print(f"[phase1] AUC={result['auc']:.3f}  Brier={result['brier']:.3f}")
    print("[phase1] coefficients:")
    for f, c in sorted(result["coefficients"].items(), key=lambda kv: -abs(kv[1])):
        print(f"    {f:<32} {c:+.3f}")

    # Re-score all features
    feat_cols = RES_FEATURES if args.segment == "Residential" else COM_FEATURES
    features_df["phase1_proba"] = score_full(features_df, result["model"], feat_cols)
    features_df["phase1_decile"] = pd.qcut(
        features_df["phase1_proba"].rank(method="first"), 10, labels=list(range(10, 0, -1))
    ).astype(int)

    out_csv = args.out / f"phase1_scored_{args.segment.lower()}.csv"
    features_df.to_csv(out_csv, index=False)

    # Persist model + report
    try:
        import joblib
        joblib.dump(result["model"], args.out / f"phase1_model_{args.segment.lower()}.joblib")
    except ImportError:
        print("[phase1] joblib not installed; skipping model serialization")

    report = {
        "segment": args.segment,
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "auc": result["auc"], "brier": result["brier"],
        "n_train": result["n_train"], "n_test": result["n_test"],
        "positive_rate": result["positive_rate"],
        "coefficients": result["coefficients"], "intercept": result["intercept"],
    }
    with open(args.out / f"phase1_report_{args.segment.lower()}.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"[phase1] written: {out_csv.name}, phase1_report_{args.segment.lower()}.json")


if __name__ == "__main__":
    main()
