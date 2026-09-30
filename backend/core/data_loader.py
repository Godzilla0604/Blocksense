"""CSV ingestion, validation and label stripping (PRD §3)."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from config import LABEL_COLUMNS

log = logging.getLogger("blocksense.loader")

REQUIRED = ["transaction_id", "timestamp", "sender_wallet", "receiver_wallet", "amount_btc"]


@dataclass
class LoadedData:
    transactions: pd.DataFrame  # label-free: tx_id, timestamp, sender, receiver, amount
    labels: pd.DataFrame        # held aside for post-hoc evaluation ONLY
    stats: dict


def load_transactions(path: Path) -> LoadedData:
    raw = pd.read_csv(path, dtype=str)
    missing = [c for c in REQUIRED if c not in raw.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    df = raw.copy()
    for col in REQUIRED:
        df[col] = df[col].astype(str).str.strip()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df["amount_btc"] = pd.to_numeric(df["amount_btc"], errors="coerce").abs()

    bad = (
        df[REQUIRED].isna().any(axis=1)
        | df["sender_wallet"].isin(["", "nan"])
        | df["receiver_wallet"].isin(["", "nan"])
    )
    if bad.any():
        log.warning("Dropping %d rows with null/invalid critical fields", int(bad.sum()))
    df = df[~bad]

    # Split labels off immediately; the analytical pipeline never sees them.
    label_cols = [c for c in LABEL_COLUMNS if c in df.columns]
    labels = df[["transaction_id", "sender_wallet", "receiver_wallet", *label_cols]].copy()

    tx = (
        df[REQUIRED]
        .rename(columns={
            "transaction_id": "tx_id", "sender_wallet": "sender",
            "receiver_wallet": "receiver", "amount_btc": "amount",
        })
        .sort_values("timestamp")
        .reset_index(drop=True)
    )

    wallets = pd.unique(tx[["sender", "receiver"]].values.ravel())
    stats = {
        "rows": int(len(tx)),
        "unique_wallets": int(len(wallets)),
        "min_date": tx["timestamp"].min().isoformat(),
        "max_date": tx["timestamp"].max().isoformat(),
        "total_volume": float(tx["amount"].sum()),
    }
    log.info("Loaded %s", stats)
    return LoadedData(transactions=tx, labels=labels, stats=stats)
