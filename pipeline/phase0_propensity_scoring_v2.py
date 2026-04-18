"""
WealthBridge Phase 0 Propensity Scoring v2 — Multi-Segment
============================================================

Extends the original 2-segment scorer to the full 8-segment WealthBridge
taxonomy from the v5.1 multi-channel orchestration framework.

SEGMENTS:
  1. residential_client       — Individual life/annuity prospects
  2. commercial_client        — Business owner advanced planning
  3. experienced_pro          — $100K+ GDC advisor recruits
  4. new_associate            — Career changers / entry recruits
  5. cpa_attorney_partner     — Strategic partner referrals
  6. affiliate                — 4-track affiliate program (A/B/C/D)
  7. hr_director              — Group benefits / workplace workshops
  8. nonprofit_leader         — Community workshop hosts

Filename convention (extended):
  WB_<segment>_<source>_<state>.csv
  e.g.:
    WB_residential_client_pima_county_AZ.csv
    WB_experienced_pro_finra_brokercheck_AZ.csv
    WB_cpa_attorney_partner_az_state_bar_AZ.csv
    WB_affiliate_pc_agencies_AZ.csv

Each segment has its own SEGMENT_CONFIG entry defining:
  - features: which columns to engineer
  - weights:  how to combine them
  - tier:     which geo-tier multiplier to apply (recruits use a different
              tier model than client prospects — recruits care about
              proximity to AZ region 1 office, not "where can Mike sell")

Output:
  scored_<segment>.csv             per segment
  ghl_import_master.csv            unified A+B tier across segments
  scoring_diagnostics_v2.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# Bring forward original phase0 helpers
sys.path.insert(0, str(Path(__file__).parent))
try:
    from phase0_propensity_scoring import (
        GEO_TIERS, ENTITY_TYPE_FACTORS, age_fit_residential, age_fit_commercial,
        normalize_name, to_decile, assign_geo_tier,
    )
except ImportError:
    raise SystemExit("phase0_propensity_scoring.py must be importable from same dir")

# ============================================================================
# SEGMENT CONFIG — the heart of the multi-segment system
# ============================================================================

SEGMENT_CONFIG = {
    "residential_client": {
        "label_set": "buy",   # outcome label = bought a product
        "features": ["equity_decile", "ownership_length_decile", "age_fit_score",
                     "zip_affluence_decile", "recent_liquidity_event"],
        "weights":  {"equity_decile": 0.30, "ownership_length_decile": 0.20,
                     "age_fit_score": 0.20, "zip_affluence_decile": 0.15,
                     "recent_liquidity_event": 0.15},
        "ltv_proxy_usd": 5000,
    },
    "commercial_client": {
        "label_set": "buy",
        "features": ["entity_age_decile", "entity_type_factor", "revenue_band_decile",
                     "multi_property_count_decile", "owner_age_fit_score"],
        "weights":  {"entity_age_decile": 0.25, "entity_type_factor": 0.15,
                     "revenue_band_decile": 0.25, "multi_property_count_decile": 0.20,
                     "owner_age_fit_score": 0.15},
        "ltv_proxy_usd": 15000,
    },
    "experienced_pro": {
        "label_set": "join",  # outcome = joined firm
        "features": ["gdc_band_decile", "tenure_fit_score", "firm_movability_score",
                     "geographic_proximity_decile", "license_match_score"],
        "weights":  {"gdc_band_decile": 0.30, "tenure_fit_score": 0.15,
                     "firm_movability_score": 0.20, "geographic_proximity_decile": 0.20,
                     "license_match_score": 0.15},
        "ltv_proxy_usd": 60000,  # annual override on ~$200K transferred GDC
    },
    "new_associate": {
        "label_set": "join",
        "features": ["coachability_proxy_score", "credibility_score",
                     "geographic_proximity_decile", "career_stage_fit",
                     "veteran_signal"],
        "weights":  {"coachability_proxy_score": 0.20, "credibility_score": 0.25,
                     "geographic_proximity_decile": 0.20, "career_stage_fit": 0.20,
                     "veteran_signal": 0.15},
        "ltv_proxy_usd": 25000,
    },
    "cpa_attorney_partner": {
        "label_set": "partner",   # outcome = signed referral / collaboration agreement
        "features": ["practice_size_decile", "wealth_practice_fit_score",
                     "az_client_concentration", "tenure_fit_score",
                     "geographic_proximity_decile"],
        "weights":  {"practice_size_decile": 0.25, "wealth_practice_fit_score": 0.30,
                     "az_client_concentration": 0.20, "tenure_fit_score": 0.10,
                     "geographic_proximity_decile": 0.15},
        "ltv_proxy_usd": 40000,  # annual referred biz value
    },
    "affiliate": {
        "label_set": "partner",
        "features": ["license_status_score", "client_book_size_decile",
                     "track_fit_score", "geographic_proximity_decile",
                     "responsiveness_proxy_score"],
        "weights":  {"license_status_score": 0.25, "client_book_size_decile": 0.25,
                     "track_fit_score": 0.20, "geographic_proximity_decile": 0.15,
                     "responsiveness_proxy_score": 0.15},
        "ltv_proxy_usd": 12000,
    },
    "hr_director": {
        "label_set": "workshop",  # outcome = workshop scheduled / group enrolled
        "features": ["company_size_decile", "industry_fit_score", "tenure_fit_score",
                     "open_enrollment_proximity", "geographic_proximity_decile"],
        "weights":  {"company_size_decile": 0.30, "industry_fit_score": 0.20,
                     "tenure_fit_score": 0.10, "open_enrollment_proximity": 0.20,
                     "geographic_proximity_decile": 0.20},
        "ltv_proxy_usd": 18000,
    },
    "nonprofit_leader": {
        "label_set": "workshop",
        "features": ["org_size_decile", "mission_fit_score", "audience_reach_decile",
                     "geographic_proximity_decile", "engagement_history_score"],
        "weights":  {"org_size_decile": 0.20, "mission_fit_score": 0.20,
                     "audience_reach_decile": 0.30, "geographic_proximity_decile": 0.20,
                     "engagement_history_score": 0.10},
        "ltv_proxy_usd": 8000,
    },
}

# Map segment → which geo-tier model to use.
# Client/partner segments → "production" tier (where can Mike sell)
# Recruit/event segments  → "proximity" tier (where can people commute / attend)
GEO_TIER_MODE = {
    "residential_client": "production",
    "commercial_client":  "production",
    "experienced_pro":    "proximity",
    "new_associate":      "proximity",
    "cpa_attorney_partner": "production",
    "affiliate":          "production",
    "hr_director":        "proximity",
    "nonprofit_leader":   "proximity",
}

# Proximity tiers — different shape than production tiers. Office is in Tucson.
PROXIMITY_TIERS = {
    "tier_1_tucson_metro":   {"counties": {"PIMA"},                                "multiplier": 1.00},
    "tier_2_southern_az":    {"counties": {"COCHISE", "SANTA CRUZ", "PINAL", "GRAHAM"}, "multiplier": 0.85},
    "tier_3_phoenix_metro":  {"counties": {"MARICOPA", "YUMA", "MOHAVE"},          "multiplier": 0.70},
    "tier_4_nm_southern":    {"counties": {"DONA ANA", "LUNA", "HIDALGO", "GRANT"}, "multiplier": 0.60},  # NM near AZ
    "tier_5_remote":         {"counties": None,                                     "multiplier": 0.30},
}


def assign_proximity_tier(row: pd.Series) -> str:
    state = str(row.get("state", "")).upper().strip()
    county = str(row.get("county", "")).upper().strip()
    if state == "AZ":
        for tier, cfg in PROXIMITY_TIERS.items():
            if cfg["counties"] and county in cfg["counties"]:
                return tier
        return "tier_3_phoenix_metro"  # AZ default if county unknown
    if state == "NM":
        if county in PROXIMITY_TIERS["tier_4_nm_southern"]["counties"]:
            return "tier_4_nm_southern"
        return "tier_5_remote"
    return "tier_5_remote"


# ============================================================================
# FILENAME PARSING
# ============================================================================

NEW_FILENAME_RE = re.compile(
    r"WB_(?P<rest>.+)_(?P<state>[A-Z]{2})\.csv",
    re.IGNORECASE,
)

# Backward-compat: old WB_Residential_<County>_County(_<State>).csv
LEGACY_FILENAME_RE = re.compile(
    r"WB_(?P<segment>Residential|Commercial)_(?P<county>.+?)_County(?:_(?P<state>[A-Z]{2}))?\.csv",
    re.IGNORECASE,
)


def parse_filename_v2(path: Path) -> dict:
    # Legacy first (more specific)
    m = LEGACY_FILENAME_RE.match(path.name)
    if m:
        county = m.group("county").replace("_", " ").upper()
        if county == "UNKNOWN":
            county = None
        return {
            "segment": m.group("segment").lower() + "_client",
            "source":  "county_assessor",
            "state":   (m.group("state") or "AZ").upper(),
            "county":  county,
        }
    # New v2 format — match known segments at start
    m = NEW_FILENAME_RE.match(path.name)
    if m:
        rest = m.group("rest").lower()
        state = m.group("state").upper()
        # Sort segments by length desc so multi-word names match before subwords
        for seg_key in sorted(SEGMENT_CONFIG.keys(), key=len, reverse=True):
            if rest.startswith(seg_key + "_"):
                return {
                    "segment": seg_key,
                    "source":  rest[len(seg_key) + 1:],
                    "state":   state,
                    "county":  None,
                }
            if rest == seg_key:
                return {"segment": seg_key, "source": "", "state": state, "county": None}
        # Try short aliases for client segments
        for alias, seg in [("residential", "residential_client"), ("commercial", "commercial_client")]:
            if rest.startswith(alias + "_"):
                return {"segment": seg, "source": rest[len(alias)+1:], "state": state, "county": None}
    return {"segment": None, "source": None, "state": None, "county": None}


def _safe_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    """Return a numeric Series for a column, even when missing, always full-length."""
    if col in df.columns:
        return pd.to_numeric(df[col], errors="coerce")
    return pd.Series([np.nan] * len(df), index=df.index)


def _safe_text(df: pd.DataFrame, col: str) -> pd.Series:
    """Return a string Series for a column, even when missing.
    Handles pandas 2.x StringDtype where NaN survives .astype(str)."""
    if col in df.columns:
        return df[col].fillna("").astype(str)
    return pd.Series([""] * len(df), index=df.index)


# ============================================================================
# FEATURE ENGINEERING — segment-specific
# ============================================================================

def _zero_to_one_clip(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce").clip(0, 1).fillna(0.5)


def engineer_recruit_pro(df: pd.DataFrame) -> pd.DataFrame:
    """Experienced Pro: features from FINRA BrokerCheck + LinkedIn enrichment."""
    df["gdc_band_decile"] = to_decile(_safe_numeric(df, "estimated_gdc"))
    df["tenure_fit_score"] = _safe_numeric(df, "years_in_industry") \
        .map(lambda y: 1.0 if 5 <= (y or 0) <= 25 else 0.6 if 3 <= (y or 0) < 5 else 0.4).fillna(0.5)
    # firm_movability: lower for big captive firms (Edward Jones, NWM, MML), higher for indies
    captive_keywords = ["EDWARD JONES", "NORTHWESTERN", "NEW YORK LIFE", "MASS MUTUAL", "MASSMUTUAL",
                         "PRUDENTIAL", "STATE FARM", "MERRILL", "MORGAN STANLEY", "WELLS FARGO"]
    firm = _safe_text(df, "current_firm").str.upper()
    df["firm_movability_score"] = (~firm.apply(lambda f: any(k in f for k in captive_keywords))).astype(float) * 0.7 + 0.3
    df["geographic_proximity_decile"] = df["proximity_multiplier"] if "proximity_multiplier" in df.columns else 0.7
    # license_match: do they hold L&H? Series 6/7?
    licenses = _safe_text(df, "licenses").str.upper()
    df["license_match_score"] = licenses.apply(lambda x: 1.0 if "L&H" in x or "LIFE" in x else 0.5)
    return df


def engineer_recruit_new(df: pd.DataFrame) -> pd.DataFrame:
    """New Associate: features from LinkedIn + Workable + military registries."""
    # Coachability proxy: roles indicating teaching/coaching/military background
    role = _safe_text(df, "current_role").str.upper()
    coachable_keywords = ["TEACHER", "COACH", "TRAINER", "OFFICER", "INSTRUCTOR", "MILITARY", "VETERAN"]
    df["coachability_proxy_score"] = role.apply(lambda r: 1.0 if any(k in r for k in coachable_keywords) else 0.5)
    # Credibility: degree + years working
    df["credibility_score"] = ((_safe_numeric(df, "years_working") >= 3).astype(float) * 0.5
                                + ((_safe_text(df, "has_degree").str.upper().isin(["TRUE","1","YES"])).astype(float) * 0.5)).fillna(0.5)
    df["geographic_proximity_decile"] = df.get("proximity_multiplier", 0.7)
    # Career stage fit: mid-career (28-42) is target
    age = _safe_numeric(df, "age")
    df["career_stage_fit"] = age.map(lambda a: 1.0 if 28 <= (a or 0) <= 42
                                     else 0.7 if 22 <= (a or 0) < 28
                                     else 0.6 if 42 < (a or 0) <= 50 else 0.3).fillna(0.5)
    df["veteran_signal"] = (_safe_text(df, "is_veteran").str.upper().isin(["TRUE","1","YES"]) if "is_veteran" in df.columns else pd.Series([0.0]*len(df), index=df.index)).astype(float)
    return df


def engineer_partner_cpa(df: pd.DataFrame) -> pd.DataFrame:
    """CPA/Attorney: features from state bar / CPA society + firm data."""
    df["practice_size_decile"] = to_decile(_safe_numeric(df, "firm_headcount"))
    practice = _safe_text(df, "practice_area").str.upper()
    wealth_keywords = ["ESTATE", "TRUST", "TAX", "BUSINESS", "WEALTH", "PROBATE", "SUCCESSION", "M&A"]
    df["wealth_practice_fit_score"] = practice.apply(
        lambda p: min(1.0, sum(0.3 for k in wealth_keywords if k in p) + 0.2)
    )
    df["az_client_concentration"] = _safe_numeric(df, "az_client_pct").fillna(0.7) / 100 \
        if "az_client_pct" in df.columns else 0.7
    df["tenure_fit_score"] = _safe_numeric(df, "years_in_practice") \
        .map(lambda y: 1.0 if 8 <= (y or 0) <= 30 else 0.6).fillna(0.5)
    df["geographic_proximity_decile"] = df.get("proximity_multiplier", 0.7)
    return df


def engineer_affiliate(df: pd.DataFrame) -> pd.DataFrame:
    """Affiliate: features from license registries + agency data."""
    license_status = _safe_text(df, "license_status").str.upper()
    df["license_status_score"] = license_status.map(
        {"L&H + SECURITIES": 1.0, "L&H": 0.85, "P&C": 0.65, "NONE": 0.40}
    ).fillna(0.5)
    df["client_book_size_decile"] = to_decile(_safe_numeric(df, "estimated_client_count"))
    # Track fit — see Affiliate guide tracks A-D
    track_pref = df.get("preferred_track", pd.Series(["A"]*len(df))).astype(str).str.upper()
    df["track_fit_score"] = track_pref.map({"D": 1.0, "C": 0.85, "B": 0.70, "A": 0.55}).fillna(0.55)
    df["geographic_proximity_decile"] = df.get("proximity_multiplier", 0.7)
    df["responsiveness_proxy_score"] = _zero_to_one_clip(df.get("response_within_7d", pd.Series([0.5]*len(df))))
    return df


def engineer_hr_director(df: pd.DataFrame) -> pd.DataFrame:
    df["company_size_decile"] = to_decile(_safe_numeric(df, "employee_count"))
    industry = _safe_text(df, "industry").str.upper()
    high_fit = ["MANUFACTURING", "HEALTHCARE", "PROFESSIONAL", "FINANCE", "TECHNOLOGY"]
    df["industry_fit_score"] = industry.apply(lambda i: 0.9 if any(k in i for k in high_fit) else 0.5)
    yrs_series = pd.to_numeric(
        df["years_at_company"] if "years_at_company" in df.columns
        else pd.Series([None] * len(df), index=df.index),
        errors="coerce"
    )
    df["tenure_fit_score"] = yrs_series.map(
        lambda y: 1.0 if pd.notna(y) and 2 <= y <= 10 else 0.6 if pd.notna(y) else 0.5
    ).fillna(0.5)
    # Open enrollment cycle: peaks Sep-Nov for most plans
    today_month = datetime.now().month
    if 9 <= today_month <= 11:
        df["open_enrollment_proximity"] = 1.0
    elif today_month in (8, 12):
        df["open_enrollment_proximity"] = 0.7
    else:
        df["open_enrollment_proximity"] = 0.4
    df["geographic_proximity_decile"] = df.get("proximity_multiplier", 0.7)
    return df


def engineer_nonprofit(df: pd.DataFrame) -> pd.DataFrame:
    df["org_size_decile"] = to_decile(_safe_numeric(df, "annual_revenue"))
    mission = _safe_text(df, "mission_area").str.upper()
    high_fit = ["EDUCATION", "FAMILY", "VETERAN", "FAITH", "BUSINESS", "PROFESSIONAL"]
    df["mission_fit_score"] = mission.apply(lambda m: 0.9 if any(k in m for k in high_fit) else 0.5)
    df["audience_reach_decile"] = to_decile(_safe_numeric(df, "member_count"))
    df["geographic_proximity_decile"] = df.get("proximity_multiplier", 0.7)
    df["engagement_history_score"] = _zero_to_one_clip(df.get("prior_engagement", pd.Series([0.3]*len(df))))
    return df


SEGMENT_ENGINEERS = {
    "experienced_pro":      engineer_recruit_pro,
    "new_associate":        engineer_recruit_new,
    "cpa_attorney_partner": engineer_partner_cpa,
    "affiliate":            engineer_affiliate,
    "hr_director":          engineer_hr_director,
    "nonprofit_leader":     engineer_nonprofit,
    # residential_client and commercial_client use original phase0 engineers
}


# ============================================================================
# SCORING
# ============================================================================

def score_segment_v2(df: pd.DataFrame, segment: str) -> pd.DataFrame:
    cfg = SEGMENT_CONFIG[segment]
    weights = cfg["weights"]
    # Compute proximity_multiplier for recruit segments before engineering
    if GEO_TIER_MODE[segment] == "proximity":
        df["proximity_tier"] = df.apply(assign_proximity_tier, axis=1)
        df["proximity_multiplier"] = df["proximity_tier"].map(
            {t: c["multiplier"] for t, c in PROXIMITY_TIERS.items()}
        ).fillna(0.30)
    # Apply segment engineer
    if segment in SEGMENT_ENGINEERS:
        df = SEGMENT_ENGINEERS[segment](df)
    # If a feature is still missing, default to 0.5 (neutral)
    for f in cfg["features"]:
        if f not in df.columns:
            df[f] = 0.5
    raw = sum(df[f].fillna(0.5).astype(float) * w for f, w in weights.items())
    df["propensity_raw"] = raw
    if GEO_TIER_MODE[segment] == "production":
        df["geo_tier"] = df.apply(assign_geo_tier, axis=1)
        df["priority_multiplier"] = df["geo_tier"].map(
            {t: c["priority_multiplier"] for t, c in GEO_TIERS.items()}
        ).fillna(0.30)
    else:
        df["geo_tier"] = df["proximity_tier"]
        df["priority_multiplier"] = df["proximity_multiplier"]
    df["propensity_score"] = (df["propensity_raw"] * df["priority_multiplier"] * 100).round(1)

    # Contact completeness modifier: penalize unreachable prospects
    # Full contact (phone+email) = 1.0×, address-only = 0.90×, nothing = 0.60×
    if "contact_completeness" in df.columns:
        cc = pd.to_numeric(df["contact_completeness"], errors="coerce").fillna(0.0)
        # Sigmoid-like mapping: 0→0.60, 0.15→0.80, 0.40→0.90, 0.70→0.95, 1.0→1.0
        contact_modifier = 0.60 + 0.40 * cc.clip(0, 1)
        df["propensity_score"] = (df["propensity_score"] * contact_modifier).round(1)
        df["contact_modifier_applied"] = contact_modifier.round(3)

    df["propensity_decile"] = pd.qcut(
        df["propensity_score"].rank(method="first"), 10, labels=list(range(10, 0, -1))
    ).astype(int)
    tier_map = {d: "A" if d <= 2 else "B" if d <= 5 else "C" if d <= 8 else "D"
                for d in range(1, 11)}
    df["propensity_tier"] = df["propensity_decile"].map(tier_map)
    df["expected_value_usd"] = (df["propensity_score"] / 100) * SEGMENT_CONFIG[segment]["ltv_proxy_usd"]
    df["segment"] = segment
    return df


# ============================================================================
# MAIN
# ============================================================================

def load_all_v2(input_dir: Path) -> dict[str, pd.DataFrame]:
    """Returns {segment: combined_df}.

    If an enriched_combined.csv exists in a sibling 'enriched' directory,
    load that instead of raw — the enriched file already has all the
    feature columns the scorer expects.
    """
    enriched_path = input_dir.parent / "enriched" / "enriched_combined.csv"
    if enriched_path.exists():
        print(f"[load] using enriched file: {enriched_path}")
        df = pd.read_csv(enriched_path, low_memory=False)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        if "owner_key" not in df.columns:
            name_col = next((c for c in ["owner_name", "name", "full_name", "business_name", "firm_name"]
                             if c in df.columns), None)
            df["owner_key"] = df[name_col].map(normalize_name) if name_col else df.index.astype(str)
        return {seg: g for seg, g in df.groupby("segment")
                if seg in SEGMENT_CONFIG}
    by_segment: dict[str, list[pd.DataFrame]] = {}
    for path in sorted(input_dir.glob("WB_*.csv")):
        meta = parse_filename_v2(path)
        seg = meta.get("segment")
        if not seg or seg not in SEGMENT_CONFIG:
            print(f"[skip] unrecognized segment in {path.name}: {seg}")
            continue
        df = pd.read_csv(path, low_memory=False)
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
        df["_source_file"] = path.name
        df["_source_kind"] = meta["source"]
        if "state" not in df.columns: df["state"] = meta["state"]
        if "county" not in df.columns: df["county"] = meta.get("county")
        # Owner key normalization
        name_col = next((c for c in ["owner_name", "name", "full_name", "business_name", "firm_name"]
                         if c in df.columns), None)
        df["owner_key"] = df[name_col].map(normalize_name) if name_col else df.index.astype(str)
        by_segment.setdefault(seg, []).append(df)
        print(f"[load] {path.name} → segment={seg}  rows={len(df):,}")
    return {seg: pd.concat(frames, ignore_index=True, sort=False)
            for seg, frames in by_segment.items()}


def run_v2(input_dir: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    by_segment = load_all_v2(input_dir)
    if not by_segment:
        raise SystemExit(f"No recognizable WB_*.csv in {input_dir}")
    all_scored = []
    diagnostics = {"run_at": datetime.now().isoformat(timespec="seconds"), "by_segment": {}}
    for seg, df in by_segment.items():
        print(f"\n[score] {seg}: {len(df):,} rows")
        scored = score_segment_v2(df, seg)
        scored.to_csv(output_dir / f"scored_{seg}.csv", index=False)
        all_scored.append(scored)
        diagnostics["by_segment"][seg] = {
            "rows": int(len(scored)),
            "a_tier": int((scored["propensity_tier"] == "A").sum()),
            "b_tier": int((scored["propensity_tier"] == "B").sum()),
            "expected_value_total_usd": float(scored["expected_value_usd"].sum()),
            "score_mean": float(scored["propensity_score"].mean()),
            "geo_tier_dist": scored["geo_tier"].value_counts().to_dict(),
        }
    # Master GHL export — A+B across all segments
    master = pd.concat(all_scored, ignore_index=True, sort=False)
    top = master[master["propensity_tier"].isin(["A", "B"])].copy()
    top = top.sort_values("expected_value_usd", ascending=False)
    cols = ["segment", "geo_tier", "state", "county", "owner_key",
            "propensity_score", "propensity_decile", "propensity_tier",
            "expected_value_usd", "_source_file"]
    cols = [c for c in cols if c in top.columns]
    top[cols].to_csv(output_dir / "ghl_import_master.csv", index=False)
    with open(output_dir / "scoring_diagnostics_v2.json", "w") as f:
        json.dump(diagnostics, f, indent=2, default=str)
    print(f"\n[output] master GHL import: {len(top):,} A+B prospects across {len(by_segment)} segments")
    print(f"[output] estimated total expected value: ${master['expected_value_usd'].sum():,.0f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=Path("./data/raw"))
    ap.add_argument("--output", type=Path, default=Path("./data/scored"))
    args = ap.parse_args()
    run_v2(args.input, args.output)
