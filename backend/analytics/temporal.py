"""Temporal analysis engine (PRD §7): per-wallet timing features and
network-wide time-series aggregates for the frontend charts."""
from __future__ import annotations

import numpy as np
import pandas as pd

from config import BURST_WINDOW_DAYS


def _wallet_events(tx: pd.DataFrame) -> pd.DataFrame:
    """One row per (wallet, transaction) with direction."""
    out = tx.assign(wallet=tx["sender"], direction="out", counterparty=tx["receiver"])
    inc = tx.assign(wallet=tx["receiver"], direction="in", counterparty=tx["sender"])
    ev = pd.concat([out, inc], ignore_index=True)
    return ev.sort_values(["wallet", "timestamp"]).reset_index(drop=True)


def _max_window_count(ts: pd.Series, window: pd.Timedelta) -> int:
    t = ts.sort_values().values
    j, best = 0, 0
    for i in range(len(t)):
        while t[i] - t[j] > window:
            j += 1
        best = max(best, i - j + 1)
    return best


def _burst_ratio(g: pd.DataFrame, window: pd.Timedelta) -> float:
    total = g["amount"].sum()
    if total <= 0:
        return 0.0
    t = g["timestamp"].values
    a = g["amount"].values
    best = 0.0
    for i in range(len(t)):
        mask = (t >= t[i]) & (t <= t[i] + window)
        best = max(best, a[mask].sum())
    return float(best / total)


def _turnaround_hours(g: pd.DataFrame) -> float:
    """Median delay between receiving funds and the next outgoing transfer."""
    last_in = None
    delays = []
    for row in g.itertuples(index=False):
        if row.direction == "in":
            last_in = row.timestamp
        elif last_in is not None:
            delays.append((row.timestamp - last_in).total_seconds() / 3600)
            last_in = None
    return float(np.median(delays)) if delays else np.nan


def temporal_features(tx: pd.DataFrame) -> pd.DataFrame:
    ev = _wallet_events(tx)
    window = pd.Timedelta(days=BURST_WINDOW_DAYS)
    rows = []
    for wallet, g in ev.groupby("wallet", sort=False):
        ts = g["timestamp"]
        gaps = ts.diff().dt.total_seconds().dropna() / 3600
        active_days = ts.dt.date.nunique()
        rows.append({
            "wallet_id": wallet,
            "burst_ratio": _burst_ratio(g, window),
            "max_tx_24h": _max_window_count(ts, pd.Timedelta(hours=24)),
            "median_interval_h": float(gaps.median()) if len(gaps) else np.nan,
            "turnaround_h": _turnaround_hours(g),
            "tx_per_active_day": len(g) / max(active_days, 1),
        })
    f = pd.DataFrame(rows).set_index("wallet_id")
    # Undefined timing (single tx, never forwards) -> network median, i.e. neutral.
    for col in ("median_interval_h", "turnaround_h"):
        f[col] = f[col].fillna(f[col].median())
    return f


def wallet_events(tx: pd.DataFrame) -> pd.DataFrame:
    return _wallet_events(tx)


def global_aggregates(tx: pd.DataFrame, tx_risk: pd.Series) -> dict:
    """Daily series, hour-of-day heatmap and activity split by risk level.

    `tx_risk` gives each transaction's risk category (the higher of its two
    endpoints' categories), aligned with `tx`.
    """
    t = tx.assign(date=tx["timestamp"].dt.strftime("%Y-%m-%d"),
                  hour=tx["timestamp"].dt.hour, risk=tx_risk.values)
    all_days = pd.date_range(tx["timestamp"].min().normalize(),
                             tx["timestamp"].max().normalize(), freq="D").strftime("%Y-%m-%d")

    daily = t.groupby("date").agg(count=("tx_id", "size"), volume=("amount", "sum")).reindex(
        all_days, fill_value=0)
    daily_txs = [{"date": d, "count": int(r["count"])} for d, r in daily.iterrows()]
    daily_vol = [{"date": d, "volume": round(float(r["volume"]), 6)} for d, r in daily.iterrows()]

    heat = t.groupby(["date", "hour"]).agg(count=("tx_id", "size"), volume=("amount", "sum"))
    heatmap = [{"date": d, "hour": int(h), "count": int(r["count"]),
                "volume": round(float(r["volume"]), 6)} for (d, h), r in heat.iterrows()]

    by_risk = t.pivot_table(index="date", columns="risk", values="tx_id",
                            aggfunc="size", fill_value=0).reindex(all_days, fill_value=0)
    vol_risk = t.pivot_table(index="date", columns="risk", values="amount",
                             aggfunc="sum", fill_value=0.0).reindex(all_days, fill_value=0.0)
    risk_timeline = []
    for d in all_days:
        entry = {"date": d}
        for cat in ("High", "Medium", "Low"):
            entry[cat] = int(by_risk.loc[d, cat]) if cat in by_risk.columns else 0
            entry[f"{cat}_volume"] = round(float(vol_risk.loc[d, cat]), 6) if cat in vol_risk.columns else 0.0
        risk_timeline.append(entry)

    return {
        "dates": list(all_days),
        "daily_txs": daily_txs,
        "daily_vol": daily_vol,
        "heatmap": heatmap,
        "risk_timeline": risk_timeline,
    }
