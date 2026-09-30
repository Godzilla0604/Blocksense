"""Risk scoring and propagation (PRD §9-§10)."""
from __future__ import annotations

import networkx as nx
import pandas as pd

from config import (ANOMALY_WEIGHT, COMPONENT_WEIGHTS, TYPOLOGY_WEIGHT, HIGH_THRESHOLD, MEDIUM_THRESHOLD,
                    PROPAGATION_ITERATIONS, PROPAGATION_NEIGHBOR_WEIGHT,
                    PROPAGATION_SELF_WEIGHT)


def categorize(score: float) -> str:
    if score >= HIGH_THRESHOLD:
        return "High"
    if score >= MEDIUM_THRESHOLD:
        return "Medium"
    return "Low"


def base_scores(scores: pd.DataFrame, typology: pd.Series) -> pd.DataFrame:
    """Combine unsupervised anomaly strength with typology direction.

    anomaly  = 0.5 * IF(full matrix) + 0.5 * (0.4*B + 0.3*T + 0.3*N)
    base     = ANOMALY_WEIGHT * anomaly + TYPOLOGY_WEIGHT * typology

    The forest says *how unusual* a wallet is; the typology signal says
    whether that unusualness points toward laundering-style behaviour.
    Big legitimate hubs are unusual but carry little typology signal.
    """
    out = scores.copy()
    weighted = sum(out[g] * w for g, w in COMPONENT_WEIGHTS.items())
    out["anomaly_score"] = 0.5 * out["if_score"] + 0.5 * weighted
    out["typology_score"] = typology.reindex(out.index).fillna(0.0)
    blended = ANOMALY_WEIGHT * out["anomaly_score"] + TYPOLOGY_WEIGHT * out["typology_score"]
    # Min-max to 0-100 (PRD §8) so thresholds are relative to this network.
    lo, hi = blended.min(), blended.max()
    out["base_score"] = 100 * (blended - lo) / (hi - lo) if hi > lo else 50.0
    # Contribution of each component to the weighted part, as shares summing to 1
    total = weighted.replace(0, 1e-9)
    for g, w in COMPONENT_WEIGHTS.items():
        out[f"{g}_share"] = (out[g] * w) / total
    return out


def propagate(base: dict[str, float], und: nx.Graph,
              iterations: int = PROPAGATION_ITERATIONS) -> dict[str, float]:
    """propagated = 0.7*self_base + 0.3*mean(neighbour score).

    Capped at `iterations` rounds (default 2). Each round anchors on the
    wallet's own *base* score, so scores cannot inflate without bound.
    """
    iterations = max(0, min(int(iterations), PROPAGATION_ITERATIONS))
    current = dict(base)
    for _ in range(iterations):
        nxt = {}
        for n, b in base.items():
            nbrs = [m for m in und.neighbors(n) if m != n] if n in und else []
            if nbrs:
                avg = sum(current[m] for m in nbrs) / len(nbrs)
                nxt[n] = PROPAGATION_SELF_WEIGHT * b + PROPAGATION_NEIGHBOR_WEIGHT * avg
            else:
                nxt[n] = b
        current = nxt
    return {k: max(0.0, min(100.0, v)) for k, v in current.items()}
