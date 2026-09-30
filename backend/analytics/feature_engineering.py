"""Behavioural feature extraction and feature-matrix assembly (PRD §6).

Every function here operates on the label-free transaction frame produced by
core.data_loader. `assert_label_free` is a guard used before model fitting.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import LABEL_COLUMNS

BEHAVIOURAL_FEATURES = [
    "tx_count", "total_volume", "net_flow_abs", "counterparties",
    "fan_in", "fan_out", "avg_tx_size", "max_tx_size", "pass_through_ratio",
    "peel_match",
]
TEMPORAL_FEATURES = [
    "burst_ratio", "max_tx_24h", "median_interval_h", "turnaround_h", "tx_per_active_day",
    "off_hours_ratio", "rapid_forward", "window_fan", "structuring",
]
NETWORK_FEATURES = ["degree", "pagerank", "betweenness", "clustering", "component_size"]

FEATURE_GROUPS = {
    "behavioural": BEHAVIOURAL_FEATURES,
    "temporal": TEMPORAL_FEATURES,
    "network": NETWORK_FEATURES,
}

# Human-readable names and units for explanations / UI
FEATURE_META = {
    "tx_count": ("Transaction count", "tx"),
    "total_volume": ("Total BTC volume", "BTC"),
    "net_flow_abs": ("Absolute net BTC flow", "BTC"),
    "counterparties": ("Unique counterparties", ""),
    "fan_in": ("Distinct senders (fan-in)", ""),
    "fan_out": ("Distinct receivers (fan-out)", ""),
    "avg_tx_size": ("Average transaction size", "BTC"),
    "max_tx_size": ("Largest single transaction", "BTC"),
    "pass_through_ratio": ("Pass-through ratio (in ≈ out)", ""),
    "burst_ratio": ("Share of volume in busiest 3-day window", ""),
    "max_tx_24h": ("Peak transactions in 24h", "tx"),
    "median_interval_h": ("Median time between transactions", "h"),
    "turnaround_h": ("Median receive→forward delay", "h"),
    "tx_per_active_day": ("Transactions per active day", "tx"),
    "peel_match": ("Share of sends re-forwarding a just-received amount", ""),
    "off_hours_ratio": ("Share of activity 00:00–06:00 UTC", ""),
    "rapid_forward": ("Share of outflow sent <60 min after receiving", ""),
    "window_fan": ("Peak distinct counterparties in 2h", "wallets"),
    "structuring": ("Peak similar-sized sends in 2h", "tx"),
    "degree": ("Network degree", ""),
    "pagerank": ("PageRank centrality", ""),
    "betweenness": ("Betweenness centrality", ""),
    "clustering": ("Clustering coefficient", ""),
    "component_size": ("Connected cluster size", "wallets"),
}

# Features where a LOW value is the anomalous direction
LOW_IS_SUSPICIOUS = {"median_interval_h", "turnaround_h"}


def assert_label_free(df: pd.DataFrame) -> None:
    leaked = [c for c in df.columns if c in LABEL_COLUMNS or "label" in c.lower()]
    if leaked:
        raise RuntimeError(f"Ground-truth columns leaked into features: {leaked}")


def behavioural_features(tx: pd.DataFrame) -> pd.DataFrame:
    assert_label_free(tx)
    out_g = tx.groupby("sender")
    in_g = tx.groupby("receiver")
    wallets = pd.Index(pd.unique(tx[["sender", "receiver"]].values.ravel()), name="wallet_id")

    f = pd.DataFrame(index=wallets)
    f["out_tx"] = out_g.size().reindex(wallets, fill_value=0)
    f["in_tx"] = in_g.size().reindex(wallets, fill_value=0)
    f["out_volume"] = out_g["amount"].sum().reindex(wallets, fill_value=0.0)
    f["in_volume"] = in_g["amount"].sum().reindex(wallets, fill_value=0.0)
    f["fan_out"] = out_g["receiver"].nunique().reindex(wallets, fill_value=0)
    f["fan_in"] = in_g["sender"].nunique().reindex(wallets, fill_value=0)

    f["tx_count"] = f["out_tx"] + f["in_tx"]
    f["total_volume"] = f["out_volume"] + f["in_volume"]
    f["net_flow"] = f["in_volume"] - f["out_volume"]
    f["net_flow_abs"] = f["net_flow"].abs()

    # unique counterparties across both directions
    pairs = pd.concat([
        tx[["sender", "receiver"]].rename(columns={"sender": "w", "receiver": "c"}),
        tx[["receiver", "sender"]].rename(columns={"receiver": "w", "sender": "c"}),
    ])
    f["counterparties"] = pairs.groupby("w")["c"].nunique().reindex(wallets, fill_value=0)

    amounts = pd.concat([
        tx[["sender", "amount"]].rename(columns={"sender": "w"}),
        tx[["receiver", "amount"]].rename(columns={"receiver": "w"}),
    ])
    ag = amounts.groupby("w")["amount"]
    f["avg_tx_size"] = ag.mean().reindex(wallets)
    f["max_tx_size"] = ag.max().reindex(wallets)
    f["min_tx_size"] = ag.min().reindex(wallets)

    # 1.0 when a wallet forwards (almost) exactly what it receives — a layering signal
    hi = np.maximum(f["in_volume"], f["out_volume"])
    lo = np.minimum(f["in_volume"], f["out_volume"])
    f["pass_through_ratio"] = np.where(hi > 0, lo / hi, 0.0)

    times = pd.concat([
        tx[["sender", "timestamp"]].rename(columns={"sender": "w"}),
        tx[["receiver", "timestamp"]].rename(columns={"receiver": "w"}),
    ]).groupby("w")["timestamp"]
    f["first_activity"] = times.min().reindex(wallets)
    f["last_activity"] = times.max().reindex(wallets)
    f["activity_span_days"] = (
        (f["last_activity"] - f["first_activity"]).dt.total_seconds() / 86400
    ).round(2)
    return f


def build_feature_matrix(behavioural: pd.DataFrame, temporal: pd.DataFrame,
                         network: pd.DataFrame, typology: pd.DataFrame) -> pd.DataFrame:
    full = (behavioural.join(temporal, how="left").join(typology, how="left")
            .join(network, how="left"))
    cols = BEHAVIOURAL_FEATURES + TEMPORAL_FEATURES + NETWORK_FEATURES
    matrix = full[cols].astype(float).fillna(0.0)
    assert_label_free(matrix)
    return matrix
