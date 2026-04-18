"""
Engagement Signal Aggregator (T0)
===================================
Aggregates engagement signals from multiple sources into a single
responsiveness/engagement score, usable across all segments.

Sources (any subset; missing → 0):
  - GHL: email opens, clicks, replies, SMS replies in last 90d
  - Calendly: meetings booked, attended, no-shows
  - LinkedIn (via Dripify): connection accepted, message replied
  - Stewardly: calculator submissions, content downloads
  - Phone: call connects, callbacks
  - Workshop / event attendance

Output:
  engagement_score_raw       (count-based composite, 0-100+)
  engagement_score_normalized (0-1, decile-ranked within segment)
  engagement_recency_days    (days since last touch)
  engagement_decay_factor    (exponential decay applied)
  engagement_imputed (False if any source data present, True if defaulted)

Use:
  - residential/commercial: feed responsiveness for tier escalation
  - affiliate: replaces the responsiveness_proxy_score in scoring
  - cpa_attorney_partner: signals partnership readiness
  - recruit segments: indicates discovery-call readiness
  - nonprofit/HR: indicates workshop receptivity
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Tuple
import math

import pandas as pd

try:
    from src.enrichment._helpers import first_valid_numeric
except ImportError:
    from _helpers import first_valid_numeric


# Per-action weights — calibrated from typical engagement asymmetry
# (a meeting attended is worth ~10x an email open)
ACTION_WEIGHTS = {
    "email_opens_90d":          1.0,
    "email_clicks_90d":          3.0,
    "email_replies_90d":        10.0,
    "sms_replies_90d":          12.0,
    "calls_connected_90d":      15.0,
    "callbacks_received_90d":   18.0,
    "linkedin_accepted":         6.0,
    "linkedin_replied":         12.0,
    "calendly_booked_90d":      25.0,
    "calendly_attended_90d":    35.0,
    "calendly_noshow_90d":      -5.0,   # negative — bad signal
    "stewardly_calc_submits":   20.0,
    "content_downloads_90d":     5.0,
    "workshops_attended":       40.0,
    "workshops_registered":     10.0,
}

# Recency decay: signal worth halves every 30 days
RECENCY_HALFLIFE_DAYS = 30


def _decay(days_ago: float) -> float:
    """Exponential decay factor."""
    if days_ago is None or pd.isna(days_ago) or days_ago < 0:
        return 0.5  # neutral if unknown
    return 0.5 ** (days_ago / RECENCY_HALFLIFE_DAYS)


def aggregate_one(row: pd.Series) -> dict:
    """Compute composite engagement score from any present action columns."""
    raw_score = 0.0
    sources_present = 0
    for action, weight in ACTION_WEIGHTS.items():
        v = first_valid_numeric(row.get(action))
        if v is not None and v != 0:
            raw_score += float(v) * weight
            sources_present += 1
    # Recency decay
    last_touch_days = first_valid_numeric(
        row.get("days_since_last_touch"), row.get("last_engagement_days_ago")
    )
    decay = _decay(last_touch_days) if last_touch_days is not None else 1.0
    # Normalize: cap raw at 200 (reasonable highly-engaged ceiling), then 0-1
    capped = min(raw_score * decay, 200.0)
    normalized = capped / 200.0
    return {
        "engagement_score_raw":         round(raw_score, 2),
        "engagement_score_normalized":  round(normalized, 3),
        "engagement_decay_factor":      round(decay, 3),
        "engagement_recency_days":      last_touch_days if last_touch_days is not None else None,
        "engagement_sources_present":   sources_present,
        "engagement_imputed":           sources_present == 0,
    }


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    # Apply to all rows — engagement is universal
    results = df.apply(aggregate_one, axis=1, result_type="expand")
    for col in results.columns:
        df[col] = results[col].values

    # If used to drive responsiveness_proxy_score (used in affiliate scoring),
    # only override when we have data — otherwise keep existing default
    has_data = df["engagement_sources_present"] > 0
    if "responsiveness_proxy_score" in df.columns:
        df.loc[has_data, "responsiveness_proxy_score"] = df.loc[has_data, "engagement_score_normalized"]
    else:
        df["responsiveness_proxy_score"] = df["engagement_score_normalized"].where(has_data, 0.5)

    return df, {
        "n_input": len(df),
        "n_with_engagement_data": int(has_data.sum()),
        "n_imputed_default": int((~has_data).sum()),
        "cost_usd": 0.0,
        "features_added": list(results.columns),
        "median_engagement": float(df["engagement_score_normalized"].median()),
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        # Highly engaged: opened lots, replied, attended workshop
        {"segment":"experienced_pro", "email_opens_90d":15, "email_replies_90d":2,
         "calls_connected_90d":3, "calendly_attended_90d":1, "days_since_last_touch":3},
        # Mildly engaged: opens but no replies, recent
        {"segment":"residential_client", "email_opens_90d":4, "days_since_last_touch":7},
        # Old engagement: bigger numbers but stale
        {"segment":"commercial_client", "email_opens_90d":12, "calls_connected_90d":2,
         "days_since_last_touch":120},
        # No engagement data — should default
        {"segment":"residential_client"},
        # Negative signal: noshows
        {"segment":"affiliate", "calendly_noshow_90d":2, "email_opens_90d":3,
         "days_since_last_touch":14},
    ])
    out, stats = enrich(samples)
    print(out[["segment","engagement_score_raw","engagement_score_normalized",
                "engagement_decay_factor","engagement_imputed"]].to_string(index=False))
    print("\nStats:", stats)
