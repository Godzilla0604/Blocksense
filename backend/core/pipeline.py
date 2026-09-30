"""Startup pipeline: runs every stage once and fills the in-memory cache."""
from __future__ import annotations

import logging
import time

import pandas as pd

import config
from analytics.clustering import risk_clusters
from analytics.feature_engineering import (FEATURE_GROUPS, behavioural_features,
                                           build_feature_matrix)
from analytics.temporal import global_aggregates, temporal_features
from analytics.typologies import typology_features, typology_score
from core.cache import STAGES, AppState
from core.data_loader import load_transactions
from core.graph_engine import build_graph, network_metrics, undirected_simple
from ml.anomaly_detection import score
from ml.evaluation import evaluate
from ml.explainability import baselines, explain_wallet
from ml.risk_scoring import base_scores, categorize, propagate

log = logging.getLogger("blocksense.pipeline")
RISK_ORDER = {"High": 3, "Medium": 2, "Low": 1}


def _iso(ts) -> str:
    return pd.Timestamp(ts).isoformat().replace("+00:00", "Z")


def _stage(state: AppState, idx: int) -> None:
    state.stage_index = idx
    log.info("Stage %d/%d: %s", idx + 1, len(STAGES), STAGES[idx])
    if config.STAGE_DELAY_SECONDS > 0:
        time.sleep(config.STAGE_DELAY_SECONDS)


def run_pipeline(state: AppState, data_path=None) -> None:
    try:
        _run(state, data_path or config.DATA_PATH)
    except Exception as exc:  # surfaced via /api/status, never a stack trace
        log.exception("Initialization failed")
        state.error = f"{type(exc).__name__}: {exc}"


def _run(state: AppState, data_path) -> None:
    # 1. Load -----------------------------------------------------------------
    _stage(state, 0)
    loaded = load_transactions(data_path)
    tx = loaded.transactions

    # 2. Graph ----------------------------------------------------------------
    _stage(state, 1)
    g = build_graph(tx)
    und = undirected_simple(g)
    net = network_metrics(g)

    # 3. Behavioural ------------------------------------------------------------
    _stage(state, 2)
    beh = behavioural_features(tx)

    # 4. Temporal ---------------------------------------------------------------
    _stage(state, 3)
    tem = temporal_features(tx)
    typ = typology_features(tx)

    # 5. Anomaly scoring ------------------------------------------------------
    _stage(state, 4)
    matrix = build_feature_matrix(beh, tem, net, typ)
    scores = base_scores(score(matrix), typology_score(typ))
    propagated = propagate(scores["base_score"].to_dict(), und)
    scores["propagated_score"] = pd.Series(propagated)
    scores["risk_category"] = scores["propagated_score"].map(categorize)
    scores["flagged"] = scores["propagated_score"] >= config.MEDIUM_THRESHOLD

    category = scores["risk_category"].to_dict()
    flagged = set(scores.index[scores["flagged"]])
    cl = risk_clusters(g, flagged, category)
    base = baselines(matrix)

    explanations = {w: explain_wallet(matrix.loc[w], base) for w in matrix.index}

    # --- Assemble payloads -----------------------------------------------------
    wallets, details, wallet_tx, nodes = [], {}, {}, {}
    for w in matrix.index:
        b, s = beh.loc[w], scores.loc[w]
        ex = explanations[w]
        primary = ex[0]["description"] if ex else "No significant deviation from network baseline"
        common = {
            "id": w,
            "risk_category": s["risk_category"],
            "composite_score": round(float(s["propagated_score"]), 1),
            "base_score": round(float(s["base_score"]), 1),
            "propagated_score": round(float(s["propagated_score"]), 1),
            "flagged": bool(s["flagged"]),
            "tx_count": int(b["tx_count"]),
            "volume": round(float(b["total_volume"]), 6),
            "counterparties": int(b["counterparties"]),
            "degree": int(net.loc[w, "degree"]),
            "last_activity": _iso(b["last_activity"]),
            "cluster": int(cl["cluster_of"][w]),
        }
        wallets.append({**common, "primary_reason": primary})
        nodes[w] = {**common}

        events = tx[(tx["sender"] == w) | (tx["receiver"] == w)]
        wallet_tx[w] = [{
            "tx_id": r.tx_id,
            "timestamp": _iso(r.timestamp),
            "amount": round(float(r.amount), 6),
            "direction": "out" if r.sender == w else "in",
            "counterparty": r.receiver if r.sender == w else r.sender,
        } for r in events.itertuples(index=False)]

        cp = {}
        for t in wallet_tx[w]:
            c = cp.setdefault(t["counterparty"], {"wallet": t["counterparty"], "in_volume": 0.0,
                                                  "out_volume": 0.0, "tx_count": 0})
            c["in_volume" if t["direction"] == "in" else "out_volume"] += t["amount"]
            c["tx_count"] += 1
        top_cp = sorted(cp.values(), key=lambda c: c["in_volume"] + c["out_volume"], reverse=True)
        for c in top_cp:
            c["in_volume"] = round(c["in_volume"], 6)
            c["out_volume"] = round(c["out_volume"], 6)

        details[w] = {
            **common,
            "primary_reason": primary,
            "metrics": {
                "tx_count": int(b["tx_count"]), "in_tx": int(b["in_tx"]), "out_tx": int(b["out_tx"]),
                "total_volume": round(float(b["total_volume"]), 6),
                "in_volume": round(float(b["in_volume"]), 6),
                "out_volume": round(float(b["out_volume"]), 6),
                "net_flow": round(float(b["net_flow"]), 6),
                "counterparties": int(b["counterparties"]),
                "fan_in": int(b["fan_in"]), "fan_out": int(b["fan_out"]),
                "avg_tx_size": round(float(b["avg_tx_size"]), 6),
                "max_tx_size": round(float(b["max_tx_size"]), 6),
                "degree": int(net.loc[w, "degree"]),
                "in_degree": int(net.loc[w, "in_degree"]),
                "out_degree": int(net.loc[w, "out_degree"]),
                "pagerank": round(float(net.loc[w, "pagerank"]), 5),
                "betweenness": round(float(net.loc[w, "betweenness"]), 5),
                "clustering": round(float(net.loc[w, "clustering"]), 4),
                "first_activity": _iso(b["first_activity"]),
                "last_activity": _iso(b["last_activity"]),
                "activity_span_days": float(b["activity_span_days"]),
                "burst_ratio": round(float(tem.loc[w, "burst_ratio"]), 4),
                "median_interval_h": round(float(tem.loc[w, "median_interval_h"]), 3),
            },
            "component_scores": {
                g_: {"score": round(float(s[g_]), 1),
                     "weight": config.COMPONENT_WEIGHTS[g_],
                     "share": round(float(s[f"{g_}_share"]), 3)}
                for g_ in FEATURE_GROUPS
            },
            "model": {
                "isolation_forest": round(float(s["if_score"]), 1),
                "anomaly_score": round(float(s["anomaly_score"]), 1),
                "typology_score": round(float(s["typology_score"]), 1),
            },
            "explanations": ex,
            "top_counterparties": [
                {**c, "risk_category": category.get(c["wallet"], "Low")} for c in top_cp[:8]
            ],
        }

    wallets.sort(key=lambda x: x["composite_score"], reverse=True)

    edges = [{
        "id": r.tx_id, "source": r.sender, "target": r.receiver,
        "weight": round(float(r.amount), 6), "timestamp": _iso(r.timestamp),
    } for r in tx.itertuples(index=False)]

    # Transaction risk = the higher-risk endpoint (for the risk timeline)
    tx_risk = tx.apply(lambda r: max(category[r.sender], category[r.receiver],
                                     key=lambda c: RISK_ORDER[c]), axis=1)
    temporal = global_aggregates(tx, tx_risk)

    counts = scores["risk_category"].value_counts()
    summary = {
        "wallet_count": int(len(matrix)),
        "tx_count": int(len(tx)),
        "volume": round(float(tx["amount"].sum()), 6),
        "flagged_count": int(len(flagged)),
        "clusters": int(cl["high_risk_count"]),
        "risk_cluster_count": int(len(cl["clusters"])),
        "network_components": int(cl["network_components"]),
        "risk_counts": {k: int(counts.get(k, 0)) for k in ("High", "Medium", "Low")},
        "date_range": {"start": _iso(tx["timestamp"].min()), "end": _iso(tx["timestamp"].max())},
        "highest_risk_wallet": wallets[0]["id"] if wallets else None,
        "risk_clusters": cl["clusters"],
        "meta": {"environment": "synthetic_demo"},
    }

    # Post-hoc evaluation: labels are read here for the first time.
    state.evaluation = evaluate(scores, loaded.labels)

    state.summary = summary
    state.wallets = wallets
    state.wallet_detail = details
    state.wallet_tx = wallet_tx
    state.nodes = nodes
    state.edges = edges
    state.temporal = temporal
    state.undirected = und
    state.ready = True
    log.info("Ready: %d wallets, %d flagged", len(wallets), len(flagged))
