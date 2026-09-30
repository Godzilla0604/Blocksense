"""Unit tests: propagation safeguards, explainability math, label isolation."""
import networkx as nx
import numpy as np
import pandas as pd
import pytest

import config
from analytics.feature_engineering import (assert_label_free, behavioural_features,
                                           build_feature_matrix)
from analytics.temporal import temporal_features
from analytics.typologies import typology_features
from core.data_loader import load_transactions
from core.graph_engine import build_graph, network_metrics
from ml.explainability import baselines, explain_wallet
from ml.risk_scoring import categorize, propagate


def test_propagation_is_bounded_and_capped():
    g = nx.complete_graph(["a", "b", "c", "d"])
    base = {"a": 100.0, "b": 0.0, "c": 0.0, "d": 0.0}
    out = propagate(base, g, iterations=1000)  # request far more than the cap
    capped = propagate(base, g, iterations=config.PROPAGATION_ITERATIONS)
    assert out == capped, "iterations must be capped"
    assert all(0 <= v <= 100 for v in out.values())
    # self weight 0.7 anchors the score to the wallet's own base
    assert out["a"] >= 0.7 * 100


def test_propagation_isolated_node_keeps_base():
    g = nx.Graph()
    g.add_node("solo")
    assert propagate({"solo": 42.0}, g) == {"solo": 42.0}


def test_propagation_formula_single_round():
    g = nx.path_graph(["a", "b"])
    out = propagate({"a": 80.0, "b": 20.0}, g, iterations=1)
    assert out["a"] == pytest.approx(0.7 * 80 + 0.3 * 20)


def test_categorize_thresholds():
    assert categorize(75) == "High"
    assert categorize(74.9) == "Medium"
    assert categorize(50) == "Medium"
    assert categorize(49.9) == "Low"


def test_explainability_detects_over_two_sigma():
    rng = np.random.default_rng(0)
    m = pd.DataFrame({"tx_count": rng.normal(10, 1, 50)}, index=[f"w{i}" for i in range(50)])
    m.loc["w0", "tx_count"] = 30  # extreme outlier
    base = baselines(m)
    ex = explain_wallet(m.loc["w0"], base)
    assert ex and ex[0]["feature"] == "tx_count"
    assert ex[0]["severity"] == "strong" and ex[0]["deviation"] > 2
    assert ex[0]["baseline"] == pytest.approx(float(m["tx_count"].median()), rel=1e-6)
    # a typical wallet gets no strong reasons
    assert all(e["severity"] != "strong" for e in explain_wallet(m.loc["w5"], base))


def test_labels_never_reach_features():
    data = load_transactions(config.DATA_PATH)
    tx = data.transactions
    for col in config.LABEL_COLUMNS:
        assert col not in tx.columns
    g = build_graph(tx)
    m = build_feature_matrix(behavioural_features(tx), temporal_features(tx),
                             network_metrics(g), typology_features(tx))
    assert_label_free(m)
    assert not any("label" in c or "scenario" in c for c in m.columns)


def test_assert_label_free_raises():
    with pytest.raises(RuntimeError):
        assert_label_free(pd.DataFrame({"sender_label": [1]}))
