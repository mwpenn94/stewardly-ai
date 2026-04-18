"""
Shared helpers for enrichment modules.

The most important thing here is `first_valid` — Python's `or` operator
treats `float('nan')` as truthy, so chains like `row.get('a') or row.get('b')`
return NaN instead of falling through to the next field. This caused a
silent bug in the age_imputer where 8 years_working was discarded for the
segment-default median.

Use first_valid() instead of `or` chains whenever the values may be NaN.
"""
from __future__ import annotations
import pandas as pd


def first_valid(*vals):
    """Return first non-None, non-NaN, non-empty value, or None.

    Treats:
      None, NaN, empty string, 0, False  → falsy
      anything else                       → return it
    """
    for v in vals:
        if v is None:
            continue
        try:
            if pd.isna(v):
                continue
        except (TypeError, ValueError):
            pass  # non-scalar, fall through
        if isinstance(v, str) and not v.strip():
            continue
        if isinstance(v, (int, float)) and v == 0:
            continue
        return v
    return None


def first_valid_numeric(*vals):
    """Like first_valid, but coerces strings to float and skips bad casts."""
    for v in vals:
        if v is None:
            continue
        try:
            if pd.isna(v):
                continue
        except (TypeError, ValueError):
            pass
        try:
            num = float(v)
            if num == 0:
                continue
            return num
        except (TypeError, ValueError):
            continue
    return None
