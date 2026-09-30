"""Isolation Forest anomaly engine (PRD §8)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from analytics.feature_engineering import FEATURE_GROUPS, assert_label_free
from config import IF_N_ESTIMATORS, IF_RANDOM_STATE

# Heavy-tailed features are log-scaled before standardisation so one whale
# transaction doesn't dominate the forest's split space.
LOG_FEATURES = {"total_volume", "net_flow_abs", "avg_tx_size", "max_tx_size",
                "median_interval_h", "turnaround_h"}


def _prepare(matrix: pd.DataFrame) -> np.ndarray:
    m = matrix.copy()
    for c in m.columns:
        if c in LOG_FEATURES:
            m[c] = np.log1p(m[c].clip(lower=0))
    return StandardScaler().fit_transform(m.values)


def _fit_scores(X: np.ndarray) -> np.ndarray:
    """Return raw anomaly strength (higher = more anomalous)."""
    model = IsolationForest(n_estimators=IF_N_ESTIMATORS, contamination="auto",
                            random_state=IF_RANDOM_STATE)
    model.fit(X)
    return -model.decision_function(X)


def normalize_0_100(raw: np.ndarray) -> np.ndarray:
    lo, hi = raw.min(), raw.max()
    if hi - lo < 1e-12:
        return np.full_like(raw, 50.0)
    return 100.0 * (raw - lo) / (hi - lo)


def score(matrix: pd.DataFrame) -> pd.DataFrame:
    """Fit unsupervised forests and return 0-100 scores.

    Columns:
      if_score      – Isolation Forest on the full concatenated feature matrix
      behavioural / temporal / network – forests fit on each feature group,
                      used for the component breakdown shown in the UI.
    """
    assert_label_free(matrix)
    out = pd.DataFrame(index=matrix.index)
    out["if_score"] = normalize_0_100(_fit_scores(_prepare(matrix)))
    for group, cols in FEATURE_GROUPS.items():
        out[group] = normalize_0_100(_fit_scores(_prepare(matrix[cols])))
    return out
