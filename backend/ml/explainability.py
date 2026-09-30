"""Deterministic explainability engine (PRD §11).

Every explanation is produced from real numbers: the wallet's feature value,
the network median (baseline), and the network standard deviation. No
free-text generation is involved.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analytics.feature_engineering import FEATURE_GROUPS, FEATURE_META, LOW_IS_SUSPICIOUS
from config import EXPLAIN_MAX_FACTORS, EXPLAIN_STRONG_SIGMA, EXPLAIN_SUPPORT_SIGMA

GROUP_OF = {f: g for g, cols in FEATURE_GROUPS.items() for f in cols}
RATIO_FEATURES = {"pass_through_ratio", "peel_match", "burst_ratio", "off_hours_ratio",
                  "rapid_forward", "clustering"}


def baselines(matrix: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame({"median": matrix.median(), "std": matrix.std(ddof=0)})


def _fmt(feature: str, v: float) -> str:
    unit = FEATURE_META.get(feature, ("", ""))[1]
    if feature in RATIO_FEATURES:
        return f"{v * 100:.0f}%"
    if feature in {"pagerank", "betweenness"}:
        return f"{v:.3f}"
    if unit == "BTC":
        return f"{v:.4f} BTC"
    if unit == "h":
        return f"{v * 60:.0f} min" if v < 2 else f"{v:.1f} h"
    if float(v).is_integer():
        return f"{int(v)}{(' ' + unit) if unit else ''}"
    return f"{v:.2f}{(' ' + unit) if unit else ''}"


def describe(feature: str, value: float, baseline: float) -> tuple[str, str]:
    """Return (description, direction-arrow)."""
    label = FEATURE_META.get(feature, (feature, ""))[0]
    low = feature in LOW_IS_SUSPICIOUS
    arrow = "↓" if low else "↑"
    if feature not in RATIO_FEATURES and baseline > 0 and value > 0:
        ratio = (baseline / value) if low else (value / baseline)
        if ratio >= 1.5:
            qualifier = "shorter than " if low else ""
            return f"{label}: {ratio:.1f}× {qualifier}network median {arrow}", arrow
    return f"{label}: {_fmt(feature, value)} vs network median {_fmt(feature, baseline)} {arrow}", arrow


def explain_wallet(row: pd.Series, base: pd.DataFrame) -> list[dict]:
    """Rank features by deviation in the *suspicious* direction."""
    candidates = []
    for feature, value in row.items():
        med, std = base.loc[feature, "median"], base.loc[feature, "std"]
        if not np.isfinite(std) or std < 1e-12:
            continue
        z = (value - med) / std
        if feature in LOW_IS_SUSPICIOUS:
            z = -z
        if z < EXPLAIN_SUPPORT_SIGMA:
            continue
        desc, arrow = describe(feature, float(value), float(med))
        candidates.append({
            "factor": FEATURE_META.get(feature, (feature, ""))[0],
            "feature": feature,
            "group": GROUP_OF.get(feature, "behavioural"),
            "value": round(float(value), 6),
            "baseline": round(float(med), 6),
            "deviation": round(float(z), 2),
            "severity": "strong" if z >= EXPLAIN_STRONG_SIGMA else "supporting",
            "direction": arrow,
            "value_display": _fmt(feature, float(value)),
            "baseline_display": _fmt(feature, float(med)),
            "description": desc,
        })
    candidates.sort(key=lambda c: c["deviation"], reverse=True)
    return candidates[:EXPLAIN_MAX_FACTORS]
