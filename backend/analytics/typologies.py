"""Direction-aware AML typology indicators (label-free, deterministic).

Isolation Forest answers "how *unusual* is this wallet?". On its own that
flags big legitimate hubs (exchanges, treasuries) because they are rare. These
indicators encode *which direction* of unusual matters for laundering-style
behaviour, following common AML typologies:

  off_hours_ratio   share of activity between 00:00-05:59 UTC
  rapid_forward     share of outgoing BTC sent within 60 min of receiving funds
  peel_match        share of outgoing tx that re-send ~the amount just received
                    (<=3% smaller, within 6h) — peel-chain / multi-hop layering
  window_fan        max distinct counterparties inside any 2h window (fan-in/out)
  structuring       max count of similar-sized (±10%) sends inside a 2h window

Each is computed only from timestamps, amounts and wallet IDs.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from analytics.temporal import wallet_events

TYPOLOGY_FEATURES = ["off_hours_ratio", "rapid_forward", "peel_match",
                     "window_fan", "structuring"]


def _window_fan(g: pd.DataFrame, window: pd.Timedelta) -> int:
    t = g["timestamp"].values
    c = g["counterparty"].values
    best = 0
    for i in range(len(t)):
        mask = (t >= t[i]) & (t <= t[i] + window)
        best = max(best, len(set(c[mask])))
    return best


def _structuring(outs: pd.DataFrame, window: pd.Timedelta) -> int:
    if outs.empty:
        return 0
    t = outs["timestamp"].values
    a = outs["amount"].values
    best = 1
    for i in range(len(t)):
        mask = (t >= t[i]) & (t <= t[i] + window) & (np.abs(a - a[i]) <= 0.10 * a[i])
        best = max(best, int(mask.sum()))
    return best


def typology_features(tx: pd.DataFrame) -> pd.DataFrame:
    ev = wallet_events(tx)
    rows = []
    two_h = pd.Timedelta(hours=2)
    for wallet, g in ev.groupby("wallet", sort=False):
        g = g.sort_values("timestamp")
        ins = g[g["direction"] == "in"]
        outs = g[g["direction"] == "out"]
        hours = g["timestamp"].dt.hour

        rapid_vol, peel_hits = 0.0, 0
        for o in outs.itertuples(index=False):
            prior = ins[ins["timestamp"] <= o.timestamp]
            if prior.empty:
                continue
            gap_h = (o.timestamp - prior["timestamp"].iloc[-1]).total_seconds() / 3600
            if gap_h <= 1.0:
                rapid_vol += o.amount
            recent = prior[(o.timestamp - prior["timestamp"]) <= pd.Timedelta(hours=6)]
            if ((recent["amount"] >= o.amount) & (recent["amount"] <= o.amount * 1.03)).any():
                peel_hits += 1

        out_vol = outs["amount"].sum()
        rows.append({
            "wallet_id": wallet,
            "off_hours_ratio": float((hours < 6).mean()),
            "rapid_forward": float(rapid_vol / out_vol) if out_vol > 0 else 0.0,
            "peel_match": float(peel_hits / len(outs)) if len(outs) else 0.0,
            "window_fan": _window_fan(g, two_h),
            "structuring": _structuring(outs, two_h),
        })
    return pd.DataFrame(rows).set_index("wallet_id")


def typology_score(f: pd.DataFrame) -> pd.Series:
    """Combine indicators into a 0-100 signal. Count-style indicators are
    scaled so that 1 counterparty / 1 send = 0 and >=5 = 1."""
    fan = ((f["window_fan"] - 1) / 4).clip(0, 1)
    struct = ((f["structuring"] - 1) / 4).clip(0, 1)
    s = (0.30 * f["off_hours_ratio"] + 0.25 * f["rapid_forward"]
         + 0.20 * f["peel_match"] + 0.15 * fan + 0.10 * struct)
    return 100 * s
