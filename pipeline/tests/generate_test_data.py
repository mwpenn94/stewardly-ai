"""
Test Data Generator
=====================
Generates synthetic test data for all 8 segments to verify
end-to-end pipeline functionality. Creates realistic-looking
records with embedded contact info for mining tests.

Usage:
  python pipeline/tests/generate_test_data.py
  python pipeline/tests/generate_test_data.py --output /path/to/data/raw
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def generate_residential(n: int = 40) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": np.random.choice(
            ["SMITH JOHN R", "GARCIA MARIA", "JONES LLC", "ACME ROOFING LLC",
             "DESERT SUN PC", "WHITE ALICE MD", "DR HIDALGO JOSE", "SAGUARO HOLDINGS",
             "MARTINEZ CARLOS", "WONG FAMILY TRUST"], n),
        "county": "Pima", "state": "AZ",
        "zip": np.random.choice(["85701", "85710", "85750", "85718", "85704"], n),
        "market_value": np.random.lognormal(12.5, 0.6, n).round(),
        "owner_since": pd.to_datetime(np.random.choice(pd.date_range("2000", "2023"), n)),
        "property_address": np.random.choice([
            "123 N Main St", "456 E Speedway Blvd", "789 S 6th Ave",
            "100 W Stone Ave", "500 N Congress St Phone: (520) 555-1234",
            "600 N Oracle Rd", "700 E Broadway Blvd",
            "800 W Grant Rd email: info@saguaroholdings.com",
            "900 E 22nd St", "1001 S Craycroft Rd"
        ], n),
    })


def generate_commercial(n: int = 20) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": np.random.choice(
            ["ACME MANUFACTURING LLC", "SONORAN MEDICAL GROUP PC", "TUCSON TECH INC",
             "SOUTHWEST HOSPITALITY LP", "DESERT CONSTRUCTION CORP"], n),
        "county": "Pima", "state": "AZ",
        "zip": np.random.choice(["85701", "85710", "85716"], n),
        "market_value": np.random.lognormal(13, 0.7, n).round(),
        "formed_date": pd.to_datetime(np.random.choice(pd.date_range("2005", "2022"), n)),
    })


def generate_experienced_pro(n: int = 15) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": [f"PRO_{name}" for name in np.random.choice(
            ["JANE SMITH", "MARK JONES", "ANA GARCIA", "BOB WHITE", "SARAH CHEN"], n)],
        "current_firm": np.random.choice(
            ["Northwestern Mutual", "Morgan Stanley", "LPL Financial",
             "Edward Jones", "State Farm", "Raymond James"], n),
        "years_in_industry": np.random.randint(3, 25, n),
        "licenses": np.random.choice(["L&H", "L&H, Series 7", "L&H, Series 7, CFP"], n),
        "state": "AZ", "county": "Pima", "zip": "85701",
    })


def generate_new_associate(n: int = 10) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": [f"NA_{name}" for name in np.random.choice(
            ["JAMES TAYLOR", "LINDA MARTINEZ", "ROBERT CHEN", "SARAH JOHNSON"], n)],
        "current_role": np.random.choice(["Teacher", "Sales Manager", "Officer", "Engineer"], n),
        "current_employer": np.random.choice(["US Air Force", "TUSD", "Google", "Raytheon"], n),
        "years_working": np.random.randint(2, 15, n),
        "has_degree": np.random.choice([True, False], n),
        "state": "AZ", "county": "Pima", "zip": "85701",
    })


def generate_cpa_attorney(n: int = 10) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": [f"CPA_{name}" for name in np.random.choice(
            ["SMITH ESTATE LAW", "JONES TAX ADVISORY", "TUCSON TRIAL ATTORNEYS",
             "DESERT PLANNING LLC", "SAGUARO BUSINESS LAW"], n)],
        "firm_name": np.random.choice(
            ["Smith Estate Planning Law", "Jones CPA Tax", "Tucson Trial Attorneys",
             "Desert Planning LLC", "Saguaro Business Law Group"], n),
        "years_in_practice": np.random.randint(5, 30, n),
        "state": "AZ", "county": "Pima", "zip": "85701",
    })


def generate_affiliate(n: int = 8) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": [f"AFF_{name}" for name in np.random.choice(
            ["MIKE REALTOR", "LISA AGENT", "DAVE BROKER", "AMY INS"], n)],
        "license_status": np.random.choice(["L&H", "P&C", "None", "L&H, P&C"], n),
        "current_employer": np.random.choice(["State Farm", "Independent", "Allstate", "Keller Williams"], n),
        "years_in_practice": np.random.randint(2, 20, n),
        "state": "AZ", "county": "Pima", "zip": "85701",
    })


def generate_hr_director(n: int = 8) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": [f"HR_{name}" for name in np.random.choice(
            ["TUCSON MFG CO", "DESERT HOSPITALITY", "SUN HEALTHCARE", "TECH SOLUTIONS"], n)],
        "firm_name": np.random.choice(
            ["Tucson Manufacturing Co", "Desert Hospitality Group", "Sun Healthcare LLC", "Tech Solutions Inc"], n),
        "employee_count": np.random.choice([50, 100, 250, 500, 1000], n),
        "industry": np.random.choice(["Manufacturing", "Healthcare", "Technology", "Hospitality"], n),
        "state": "AZ", "county": "Pima", "zip": "85701",
    })


def generate_nonprofit(n: int = 8) -> pd.DataFrame:
    return pd.DataFrame({
        "owner_name": np.random.choice(
            ["TUCSON EDUCATION FOUNDATION", "SAHUARITA COMMUNITY CHURCH",
             "PIMA COUNTY VETERANS SUPPORT", "DESERT MUSEUM FOUNDATION"], n),
        "ntee_cd": np.random.choice(["B12", "X20", "P82", "A80"], n),
        "income_cd": np.random.choice([5, 6, 7, 8], n),
        "state": "AZ", "county": "Pima", "zip": "85701",
    })


def generate_all(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    np.random.seed(42)

    generators = {
        "WB_Residential_Pima_County.csv": generate_residential,
        "WB_commercial_client_az_corp_AZ.csv": generate_commercial,
        "WB_experienced_pro_finra_brokercheck_AZ.csv": generate_experienced_pro,
        "WB_new_associate_workable_AZ.csv": generate_new_associate,
        "WB_cpa_attorney_partner_bar_AZ.csv": generate_cpa_attorney,
        "WB_affiliate_doi_AZ.csv": generate_affiliate,
        "WB_hr_director_linkedin_AZ.csv": generate_hr_director,
        "WB_nonprofit_leader_bmf_AZ.csv": generate_nonprofit,
    }

    total = 0
    for filename, gen_func in generators.items():
        df = gen_func()
        df.to_csv(output_dir / filename, index=False)
        total += len(df)
        print(f"  {filename}: {len(df)} rows")

    print(f"\nTotal: {total} test records across {len(generators)} segments")
    print(f"Output: {output_dir}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", type=Path, default=Path("./pipeline/data/raw"))
    args = ap.parse_args()
    generate_all(args.output)
