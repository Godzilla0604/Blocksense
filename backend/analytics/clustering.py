"""Cluster analysis via weakly connected components (PRD §12).

The synthetic network is a single connected component, so "clusters" at the
whole-graph level is always small. The more useful investigative number is
how many *separate groups of flagged wallets* exist: we take the subgraph
induced by flagged wallets and count its weakly connected components.
"""
from __future__ import annotations

import networkx as nx


def component_map(g: nx.MultiDiGraph) -> dict[str, int]:
    """wallet -> network component id (0 = largest)."""
    comps = sorted(nx.weakly_connected_components(g), key=len, reverse=True)
    return {n: i for i, comp in enumerate(comps) for n in comp}


def risk_clusters(g: nx.MultiDiGraph, flagged: set[str], category: dict[str, str]) -> dict:
    """Group flagged wallets into connected risk clusters.

    Returns {"cluster_of": {wallet: id}, "clusters": [...], "high_risk_count": int}
    Non-flagged wallets get cluster id -1.
    """
    sub = g.subgraph(flagged)
    comps = sorted(nx.weakly_connected_components(sub), key=len, reverse=True)
    cluster_of = {n: -1 for n in g.nodes}
    out = []
    for i, comp in enumerate(comps):
        for n in comp:
            cluster_of[n] = i
        cats = [category[n] for n in comp]
        out.append({"id": i, "size": len(comp), "wallets": sorted(comp),
                    "high": cats.count("High"), "medium": cats.count("Medium")})
    return {
        "cluster_of": cluster_of,
        "clusters": out,
        "high_risk_count": sum(1 for c in out if c["high"] > 0),
        "network_components": nx.number_weakly_connected_components(g),
    }
