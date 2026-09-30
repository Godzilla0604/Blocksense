"""NetworkX transaction graph construction and queries (PRD §5)."""
from __future__ import annotations

import networkx as nx
import pandas as pd


def build_graph(tx: pd.DataFrame) -> nx.MultiDiGraph:
    """One directed edge per transaction; parallel edges are kept."""
    g = nx.MultiDiGraph()
    g.add_nodes_from(pd.unique(tx[["sender", "receiver"]].values.ravel()))
    for row in tx.itertuples(index=False):
        g.add_edge(row.sender, row.receiver, key=row.tx_id,
                   weight=float(row.amount), timestamp=row.timestamp)
    return g


def collapse_weighted(g: nx.MultiDiGraph) -> nx.DiGraph:
    """Collapse parallel edges into one weighted edge (sum of BTC)."""
    d = nx.DiGraph()
    d.add_nodes_from(g.nodes)
    for u, v, data in g.edges(data=True):
        if d.has_edge(u, v):
            d[u][v]["weight"] += data["weight"]
            d[u][v]["count"] += 1
        else:
            d.add_edge(u, v, weight=data["weight"], count=1)
    return d


def network_metrics(g: nx.MultiDiGraph) -> pd.DataFrame:
    d = collapse_weighted(g)
    und = d.to_undirected()
    pagerank = nx.pagerank(d, weight="weight")
    betweenness = nx.betweenness_centrality(d)
    clustering = nx.clustering(und)
    comp_size = {n: len(c) for c in nx.weakly_connected_components(d) for n in c}
    rows = [{
        "wallet_id": n,
        "in_degree": d.in_degree(n),
        "out_degree": d.out_degree(n),
        "degree": und.degree(n),
        "pagerank": pagerank[n],
        "betweenness": betweenness[n],
        "clustering": clustering[n],
        "component_size": comp_size[n],
    } for n in d.nodes]
    return pd.DataFrame(rows).set_index("wallet_id")


def undirected_simple(g: nx.MultiDiGraph) -> nx.Graph:
    return nx.Graph(g.to_undirected(as_view=True))


def ego_hops(und: nx.Graph, wallet: str, depth: int) -> dict[str, int]:
    """{node: hop distance} for the undirected ego neighbourhood of `wallet`."""
    return dict(nx.single_source_shortest_path_length(und, wallet, cutoff=depth))
