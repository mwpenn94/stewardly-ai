"""
New Associate Signal Inferrer (T0)
====================================
For new_associate segment: infer coachability, credibility, veteran status
from role/employer/education text fields when not directly provided.

Coachability: roles indicating teaching/coaching/military/structured-environment
backgrounds tend to thrive in WealthBridge's NAP (New Associate Program).

Credibility: degree + years working + employer brand quality.

Veteran signal: military terms in role, employer, or branch field.

Output:
  coachability_proxy_score (0-1)
  credibility_score (0-1)
  veteran_signal (0 or 1)
  career_stage_fit (0-1, depends on age)
  *_imputed flags
"""
from __future__ import annotations

import re
from typing import Tuple
import pandas as pd

try:
    from src.enrichment._helpers import first_valid_numeric
except ImportError:
    from _helpers import first_valid_numeric

# Coachability indicator roles (sorted by signal strength)
COACHABILITY_ROLES = {
    1.00: [r"\b(MILITARY OFFICER|COMMISSIONED OFFICER|JAG|FLIGHT INSTRUCTOR)\b",
           r"\b(SCHOOL PRINCIPAL|HEAD COACH|HEAD TEACHER)\b"],
    0.90: [r"\b(OFFICER|CAPTAIN|COMMANDER|MAJOR|COLONEL|LIEUTENANT|SERGEANT)\b",
           r"\b(VETERAN|FORMER MILITARY|RETIRED MILITARY)\b",
           r"\b(TEACHER|EDUCATOR|PROFESSOR|INSTRUCTOR|TRAINER)\b",
           r"\b(COACH|ATHLETIC DIRECTOR|TRAINER)\b"],
    0.80: [r"\b(SALES MANAGER|TEAM LEAD|SUPERVISOR|FOREMAN)\b",
           r"\b(NURSE|RN|HEALTHCARE PROFESSIONAL)\b",
           r"\b(POLICE|FIRE|EMT|FIRST RESPONDER)\b"],
    0.70: [r"\b(ACCOUNT EXEC|BUSINESS DEVELOPMENT|REGIONAL SALES)\b",
           r"\b(CONSULTANT|ANALYST|PROJECT MANAGER)\b"],
    0.60: [r"\b(ENGINEER|DEVELOPER|TECHNICAL|IT)\b"],
}

# Employer brand quality (proxy for credibility — top employers indicate selective hiring)
TOP_EMPLOYER_PATTERNS = [
    r"\bUS (ARMY|NAVY|AIR FORCE|MARINES|COAST GUARD|SPACE FORCE)\b",
    r"\b(USAF|USN|USMC|USCG|USA)\b",
    r"\b(GOOGLE|MICROSOFT|APPLE|AMAZON|META|FACEBOOK|NETFLIX)\b",
    r"\b(MCKINSEY|BAIN|BCG|DELOITTE|EY|PWC|KPMG)\b",
    r"\b(GOLDMAN|MORGAN STANLEY|JPMORGAN|BLACKROCK)\b",
    r"\b(JOHNSON & JOHNSON|PFIZER|MERCK|MAYO CLINIC)\b",
    r"\b(STATE FARM|ALLSTATE|PROGRESSIVE)\b",  # insurance background = credibility for WB
    r"\bTHE\s+UNIVERSITY OF\s+ARIZONA\b", r"\bASU\b", r"\bARIZONA STATE\b",
    r"\bDAVIS-?MONTHAN\b", r"\bFORT HUACHUCA\b",  # AZ-local high-credibility
]

# Veteran signal patterns
VETERAN_PATTERNS = [
    r"\bVETERAN\b", r"\bVET\b(?!ERINARY)",
    r"\bMILITARY\b", r"\bACTIVE DUTY\b",
    r"\bUS (ARMY|NAVY|AIR FORCE|MARINES|COAST GUARD|SPACE FORCE)\b",
    r"\b(USAF|USN|USMC|USCG|USA|ARNG|USAR)\b",
    r"\b(VFW|AMERICAN LEGION|AMVETS|DAV)\b",
    r"\bRETIRED MILITARY\b",
    r"\bDD214\b",
]

COMPILED_COACHABILITY = {
    score: [re.compile(p, re.IGNORECASE) for p in patterns]
    for score, patterns in COACHABILITY_ROLES.items()
}
COMPILED_TOP_EMPLOYER = [re.compile(p, re.IGNORECASE) for p in TOP_EMPLOYER_PATTERNS]
COMPILED_VETERAN = [re.compile(p, re.IGNORECASE) for p in VETERAN_PATTERNS]


def infer_coachability(text: str) -> tuple[float, float]:
    if not text:
        return (0.50, 0.30)
    for score in sorted(COMPILED_COACHABILITY.keys(), reverse=True):
        for pat in COMPILED_COACHABILITY[score]:
            if pat.search(text):
                return (score, 0.85)
    return (0.50, 0.30)


def infer_veteran(text: str, explicit: bool | None = None) -> tuple[int, float]:
    if explicit is not None and pd.notna(explicit):
        return (int(bool(explicit)), 1.0)
    if not text:
        return (0, 0.30)
    for pat in COMPILED_VETERAN:
        if pat.search(text):
            return (1, 0.85)
    return (0, 0.50)


def infer_credibility(row: pd.Series) -> tuple[float, float]:
    score = 0.0
    components = 0
    # Degree
    has_degree = row.get("has_degree")
    if has_degree is not None and pd.notna(has_degree):
        score += 0.35 if bool(has_degree) else 0.05
        components += 1
    # Years working
    yrs = first_valid_numeric(row.get("years_working"), row.get("years_in_industry"))
    if yrs:
        if yrs >= 8:    score += 0.35
        elif yrs >= 4:  score += 0.25
        elif yrs >= 2:  score += 0.15
        else:           score += 0.05
        components += 1
    # Top employer
    employer_text = " | ".join(str(row.get(c, "") or "") for c in
                                ["current_employer", "employer", "current_role", "previous_employer"]
                                if c in row.index).upper()
    if any(pat.search(employer_text) for pat in COMPILED_TOP_EMPLOYER):
        score += 0.30
    components += 1  # always evaluate, even if no match (counts toward denom)
    if components == 0:
        return (0.50, 0.20)
    final = min(1.0, score)
    confidence = min(1.0, 0.40 + 0.20 * components)
    return (final, confidence)


def infer_career_stage_fit(age: float | None) -> tuple[float, float]:
    """Mid-career (28-42) is the sweet spot for new_associate role."""
    if age is None or pd.isna(age):
        return (0.50, 0.25)
    age = float(age)
    if 28 <= age <= 42: score = 1.00
    elif 22 <= age < 28: score = 0.70
    elif 42 < age <= 50: score = 0.65
    elif 50 < age <= 58: score = 0.40
    else: score = 0.20
    return (score, 0.85)


def enrich(df: pd.DataFrame) -> Tuple[pd.DataFrame, dict]:
    df = df.copy()
    if "segment" in df.columns:
        mask = df["segment"] == "new_associate"
    else:
        mask = pd.Series(True, index=df.index)
    if not mask.any():
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": "no new_associate rows"}

    def per_row(r):
        text_blob = " | ".join(
            str(r.get(c, "") or "") for c in
            ["current_role", "current_employer", "previous_employer", "background", "branch"]
            if c in r.index
        ).upper()
        coach, coach_conf = infer_coachability(text_blob)
        vet_explicit = r.get("is_veteran")
        vet, vet_conf = infer_veteran(text_blob, vet_explicit)
        cred, cred_conf = infer_credibility(r)
        age_val = r.get("owner_age") or r.get("age")
        cs, cs_conf = infer_career_stage_fit(age_val)
        return pd.Series({
            "coachability_proxy_score": coach,
            "coachability_confidence":  coach_conf,
            "veteran_signal":           vet,
            "veteran_signal_confidence": vet_conf,
            "credibility_score":        cred,
            "credibility_confidence":   cred_conf,
            "career_stage_fit":         cs,
            "career_stage_confidence":  cs_conf,
        })

    results = df.loc[mask].apply(per_row, axis=1)
    for col in results.columns:
        df.loc[mask, col] = results[col].values
    return df, {
        "n_input": len(df), "n_imputed": int(mask.sum()), "cost_usd": 0.0,
        "features_added": list(results.columns) + ["new_associate_signals_imputed"],
        "veteran_count": int(df.loc[mask, "veteran_signal"].sum()),
        "median_coachability": float(df.loc[mask, "coachability_proxy_score"].median()),
    }


if __name__ == "__main__":
    samples = pd.DataFrame([
        {"segment":"new_associate", "current_role":"Air Force Captain", "owner_age":32,  "has_degree":True,  "years_working":10, "current_employer":"US Air Force"},
        {"segment":"new_associate", "current_role":"High School Teacher","owner_age":45, "has_degree":True,  "years_working":18, "current_employer":"TUSD"},
        {"segment":"new_associate", "current_role":"Software Engineer", "owner_age":28,  "has_degree":True,  "years_working":5,  "current_employer":"Google"},
        {"segment":"new_associate", "current_role":"Sales Manager",     "owner_age":38,  "has_degree":False, "years_working":12, "current_employer":"Local Auto Dealer"},
        {"segment":"new_associate", "current_role":"",                   "owner_age":None,"has_degree":None,  "years_working":None},
    ])
    out, stats = enrich(samples)
    print(out[["current_role","veteran_signal","coachability_proxy_score","credibility_score","career_stage_fit"]].to_string(index=False))
    print("\nStats:", stats)
