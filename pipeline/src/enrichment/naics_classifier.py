"""
NAICS Classifier (T0 imputer)
==============================
Infer NAICS industry code from business name when not explicitly available.
Used by commercial_client and hr_director scoring (industry_fit_score).

Rules-based; covers ~85% of common industries with high confidence.
For deeper classification, plug in a paid vendor (D&B firmographic).

Output columns added:
  naics_inferred:    2-digit NAICS sector
  naics_label:       Human-readable label
  naics_confidence:  0.0–1.0
  naics_imputed:     True

Usage:
  from src.enrichment.naics_classifier import enrich
  df, stats = enrich(df, name_col='owner_name')
"""
from __future__ import annotations

import re
from typing import Tuple

import pandas as pd

# Keyword → (NAICS 2-digit, label, confidence)
NAICS_KEYWORDS = [
    # 11 — Agriculture
    (r"\b(RANCH|FARM|CATTLE|LIVESTOCK|DAIRY|ORCHARD|VINEYARD|GROVE|AGRI|AG\b)\b",
     ("11", "Agriculture/Ranching", 0.85)),
    # 21 — Mining
    (r"\b(MINING|MINE|MINERAL|EXTRACTION|QUARRY|COAL|GOLD|COPPER|OIL|GAS WELL)\b",
     ("21", "Mining/Extraction", 0.85)),
    # 22 — Utilities
    (r"\b(UTILITY|UTILITIES|POWER|ELECTRIC CO|WATER CO|GAS CO)\b",
     ("22", "Utilities", 0.80)),
    # 23 — Construction
    (r"\b(CONSTRUCTION|CONTRACTOR|BUILDERS?|HOMES|ROOFING|PLUMBING|HVAC|"
     r"ELECTRICAL|EXCAVAT|CONCRETE|FRAMING|REMODEL|RENOVAT|MASONRY)\b",
     ("23", "Construction", 0.80)),
    # 31-33 — Manufacturing
    (r"\b(MANUFACTUR[A-Z]*|MFG|MILL|FOUNDRY|FABRICAT[A-Z]*|PROCESSING|ASSEMBLY|INDUSTRIES)\b",
     ("31", "Manufacturing", 0.75)),
    # 42 — Wholesale
    (r"\b(WHOLESALE|DISTRIBUT|SUPPLY CO|TRADERS)\b",
     ("42", "Wholesale Trade", 0.75)),
    # 44-45 — Retail
    (r"\b(RETAIL|STORE|SHOP|MARKET|BOUTIQUE|MART|EMPORIUM|OUTLET)\b",
     ("44", "Retail Trade", 0.70)),
    # 48-49 — Transportation/Logistics
    (r"\b(TRANSPORT|TRUCKING|LOGISTICS|FREIGHT|HAULING|DELIVERY|EXPRESS|CARRIER)\b",
     ("48", "Transportation/Warehousing", 0.80)),
    # 51 — Information
    (r"\b(SOFTWARE|TECH|TECHNOLOG|DIGITAL|MEDIA|PUBLISHING|TELECOM|DATA|CYBER|IT\b|SAAS)\b",
     ("51", "Information/Tech", 0.80)),
    # 52 — Finance/Insurance
    (r"\b(BANK|FINANCIAL|FINANCE|CAPITAL|INVESTMENT|INSURANCE|MORTGAGE|"
     r"WEALTH|ADVISORY|SECURITIES|EQUITY|LENDING)\b",
     ("52", "Finance/Insurance", 0.85)),
    # 53 — Real Estate
    (r"\b(REAL ESTATE|REALTY|REALTORS|PROPERTIES|PROPERTY MGMT|REIT|HOLDINGS|"
     r"DEVELOPMENT CO|LAND CO)\b",
     ("53", "Real Estate", 0.85)),
    # 54 — Professional Services
    (r"\b(LAW FIRM|ATTORNEYS?|LEGAL|LAW OFFICES?)\b",
     ("5411", "Legal Services", 0.95)),
    (r"\b(CPA|ACCOUNTANT|ACCOUNTING|BOOKKEEP|TAX SERVICES?|TAX PREP)\b",
     ("5412", "Accounting", 0.95)),
    (r"\b(ARCHITECT|ENGINEERING|ENGINEERS|DESIGN STUDIO)\b",
     ("5413", "Architecture/Engineering", 0.85)),
    (r"\b(CONSULT|ADVISORS?|STRATEGIC|MGMT CONSULT)\b",
     ("5416", "Management Consulting", 0.75)),
    (r"\b(MARKETING|ADVERTISING|PR\b|PUBLIC RELATIONS|AGENCY)\b",
     ("5418", "Marketing/Advertising", 0.75)),
    # 56 — Admin / Waste
    (r"\b(STAFFING|TEMPORARY|EMPLOYMENT|RECRUITING|JANITORIAL|LANDSCAPING|WASTE|RECYCL)\b",
     ("56", "Administrative/Support", 0.75)),
    # 61 — Education
    (r"\b(SCHOOL|ACADEMY|EDUCATION|LEARNING|TUTORING|UNIVERSITY|COLLEGE|TRAINING CTR)\b",
     ("61", "Educational Services", 0.85)),
    # 62 — Health Care
    (r"\b(MEDICAL|HEALTH|HOSPITAL|CLINIC|PRACTICE|PHYSICIANS?|DOCTORS?|DENTAL|"
     r"DENTIST|VETERINARY|PHARMACY|NURSING|REHAB|WELLNESS|"
     r"OPHTHALMOLOGY?|CARDIOLOGY?|DERMATOLOGY?|ORTHOPEDIC|PEDIATRIC|RADIOLOGY?|"
     r"SURGERY|SURGICAL|UROLOGY?|ONCOLOGY?|GYNECOLOGY?|OBSTETRIC|PSYCHIAT[A-Z]*|"
     r"NEUROLOGY?|GASTROENTEROLOGY?|ENDOCRIN[A-Z]*|ANESTHES[A-Z]*|PATHOLOGY?|CHIROPRAC[A-Z]*)\b",
     ("62", "Healthcare", 0.85)),
    # 71 — Entertainment / Recreation
    (r"\b(ENTERTAINMENT|RECREATION|THEATER|THEATRE|GYM|FITNESS|GOLF|COUNTRY CLUB|SPORTS)\b",
     ("71", "Entertainment/Recreation", 0.80)),
    # 72 — Hospitality / Food
    (r"\b(RESTAURANT|CAFE|BISTRO|GRILL|CATERING|BAR & GRILL|TAVERN|"
     r"HOTEL|MOTEL|INN|RESORT|LODGE|BED.AND.BREAKFAST)\b",
     ("72", "Hospitality/Food", 0.85)),
    # 81 — Other Services / Repair
    (r"\b(REPAIR|AUTO BODY|MECHANIC|GARAGE|SALON|BARBER|CLEANERS|LAUNDRY|FUNERAL)\b",
     ("81", "Other Services", 0.75)),
    # 92 — Public Admin
    (r"\b(CITY OF|COUNTY OF|STATE OF|MUNICIPAL|GOVT|GOVERNMENT|FEDERAL)\b",
     ("92", "Public Administration", 0.95)),
    # 813 — Religious / Civic / Nonprofit
    (r"\b(CHURCH|MINISTRY|MISSION|TEMPLE|SYNAGOGUE|MOSQUE|FAITH)\b",
     ("8131", "Religious", 0.90)),
    (r"\b(FOUNDATION|CHARITY|NONPROFIT|NON.PROFIT|UNITED WAY|YMCA|YWCA)\b",
     ("8134", "Civic/Social Organization", 0.85)),
]

COMPILED = [(re.compile(p, re.IGNORECASE), val) for p, val in NAICS_KEYWORDS]


def classify_one(name: str) -> Tuple[str, str, float]:
    if not name or pd.isna(name):
        return ("", "", 0.0)
    s = str(name).upper()
    matches = [(naics, label, conf) for pat, (naics, label, conf) in COMPILED
               if pat.search(s)]
    if not matches:
        return ("", "Unknown", 0.0)
    # Take highest-confidence match
    matches.sort(key=lambda x: x[2], reverse=True)
    return matches[0]


def enrich(df: pd.DataFrame, name_col: str = "owner_name") -> Tuple[pd.DataFrame, dict]:
    df = df.copy() if not df.columns.duplicated().any() else df
    # Build the candidate text per row: prefer firm_name + industry + owner_name combined
    # so we maximize signal for any commercial-like row
    text_cols = [c for c in [name_col, "firm_name", "industry", "business_name"] if c in df.columns]
    if not text_cols:
        return df, {"n_input": len(df), "n_imputed": 0, "cost_usd": 0.0,
                    "features_added": [], "skipped_reason": f"no text columns to classify"}
    df["_naics_input"] = df[text_cols].fillna("").astype(str).agg(" | ".join, axis=1)
    candidate_col = "_naics_input"
    df = df.copy() if not df.columns.duplicated().any() else df
    has_existing = "naics" in df.columns
    if has_existing:
        mask = df["naics"].isna() | (df["naics"].astype(str).str.strip().isin(["", "nan"]))
    else:
        mask = pd.Series(True, index=df.index)
    classified = df.loc[mask, candidate_col].astype(str).map(classify_one)
    df.loc[mask, "naics_inferred"] = classified.map(lambda t: t[0])
    df.loc[mask, "naics_label"] = classified.map(lambda t: t[1])
    df.loc[mask, "naics_confidence"] = classified.map(lambda t: t[2])
    df.loc[mask, "naics_imputed"] = True
    if not has_existing:
        df["naics"] = df["naics_inferred"]
    else:
        df.loc[mask, "naics"] = df.loc[mask, "naics_inferred"]
    n_filled = int(df.loc[mask, "naics_confidence"].fillna(0).gt(0).sum())
    df = df.drop(columns=["_naics_input"], errors="ignore")
    return df, {
        "n_input": len(df), "n_imputed": n_filled, "cost_usd": 0.0,
        "features_added": ["naics_inferred", "naics_label", "naics_confidence", "naics_imputed"],
    }


if __name__ == "__main__":
    samples = [
        "DESERT VIEW ROOFING LLC",
        "TUCSON OPHTHALMOLOGY ASSOCIATES PC",
        "RANCHO SAHUARITA CATTLE CO",
        "FIRST BAPTIST CHURCH",
        "ACME LAW FIRM PLLC",
        "ARIZONA CAPITAL ADVISORS",
        "BLUE MESA TAX SERVICES",
        "ZACOPI ENTERPRISES LLC",  # Unknown — should classify as Unknown
        "GREEN VALLEY MEDICAL CLINIC",
    ]
    df = pd.DataFrame({"owner_name": samples})
    out, stats = enrich(df)
    print(out[["owner_name", "naics_inferred", "naics_label", "naics_confidence"]].to_string(index=False))
    print("\nStats:", stats)
