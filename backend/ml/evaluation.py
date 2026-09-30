"""Post-hoc evaluation against ground-truth labels (PRD §19).

This is the ONLY module that reads the label columns, and it runs after all
scores are final. A wallet's ground truth is "suspicious" if it appears in a
suspicious role (sender_label or receiver_label == SUSPICIOUS) in any
transaction. Prediction = flagged (propagated score >= Medium threshold).
"""
from __future__ import annotations

import pandas as pd

from config import HIGH_THRESHOLD, MEDIUM_THRESHOLD


def wallet_ground_truth(labels: pd.DataFrame) -> set[str]:
    sus = set()
    if "sender_label" in labels:
        sus |= set(labels.loc[labels["sender_label"].str.upper() == "SUSPICIOUS", "sender_wallet"])
    if "receiver_label" in labels:
        sus |= set(labels.loc[labels["receiver_label"].str.upper() == "SUSPICIOUS", "receiver_wallet"])
    return sus


def _prf(pred: pd.Series, truth: pd.Series) -> dict:
    tp = int((pred & truth).sum())
    fp = int((pred & ~truth).sum())
    fn = int((~pred & truth).sum())
    tn = int((~pred & ~truth).sum())
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"precision": round(p, 3), "recall": round(r, 3), "f1": round(f1, 3),
            "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn}}


def evaluate(scores: pd.DataFrame, labels: pd.DataFrame) -> dict:
    sus = wallet_ground_truth(labels)
    truth = pd.Series([w in sus for w in scores.index], index=scores.index)
    flagged = scores["propagated_score"] >= MEDIUM_THRESHOLD
    high = scores["propagated_score"] >= HIGH_THRESHOLD
    main = _prf(flagged, truth)
    return {
        **main,
        "threshold": MEDIUM_THRESHOLD,
        "at_high_threshold": _prf(high, truth),
        "wallets_evaluated": int(len(scores)),
        "ground_truth_suspicious": int(truth.sum()),
        "note": ("Post-hoc check on a 25-wallet synthetic dataset. Labels were never "
                 "used for fitting. Small-sample metrics are illustrative only."),
    }
