"""REST endpoints (PRD §13). Every handler is a thin serializer over the
in-memory cache built at startup — no computation happens per request except
slicing the ego graph."""
from __future__ import annotations

import re
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response

from api.schemas import (Evaluation, Graph, Status, Summary, Temporal, WalletDetail,
                         WalletRow, WalletTx)
from config import MAX_EGO_DEPTH
from core.cache import state
from core.graph_engine import ego_hops

router = APIRouter(prefix="/api")

WALLET_RE = re.compile(r"^[A-Za-z0-9]{8,100}$")
CACHE_HEADERS = {"Cache-Control": "private, max-age=300"}
VALID_RISK = {"High", "Medium", "Low"}
SORT_KEYS = {
    "risk": "composite_score", "score": "composite_score", "tx_count": "tx_count",
    "volume": "volume", "counterparties": "counterparties", "degree": "degree",
    "last_activity": "last_activity",
}


class ApiError(Exception):
    def __init__(self, code: int, message: str, details: str = ""):
        self.code, self.message, self.details = code, message, details


def require_ready() -> None:
    if state.error:
        raise ApiError(503, "Analysis failed to initialize", state.error)
    if not state.ready:
        raise ApiError(503, "Analysis is still initializing",
                       f"Current stage: {state.status()['stage']}")


def _wallet_or_404(wallet_id: str) -> str:
    if not WALLET_RE.match(wallet_id):
        raise ApiError(400, "Invalid wallet ID", "Wallet IDs are 8-100 alphanumeric characters.")
    if wallet_id not in state.wallet_detail:
        raise ApiError(404, "Wallet not found", f"No wallet {wallet_id} in the monitored network.")
    return wallet_id


def _parse_risk(risk: Optional[str]) -> Optional[set[str]]:
    if not risk:
        return None
    vals = {r.strip().capitalize() for r in risk.split(",") if r.strip()}
    bad = vals - VALID_RISK
    if bad:
        raise ApiError(400, "Invalid risk filter", f"Unknown categories: {sorted(bad)}")
    return vals


def _parse_flag(flag: str) -> Optional[bool]:
    flag = flag.lower()
    if flag in ("all", ""):
        return None
    if flag in ("flagged", "true"):
        return True
    if flag in ("non-flagged", "unflagged", "false"):
        return False
    raise ApiError(400, "Invalid flag filter", "Use all, flagged or non-flagged.")


def _node(w: str, hop: Optional[int] = None) -> dict:
    n = state.nodes[w]
    return {"id": w, "risk": n["risk_category"], "score": n["propagated_score"],
            "base_score": n["base_score"], "flagged": n["flagged"], "tx_count": n["tx_count"],
            "volume": n["volume"], "counterparties": n["counterparties"],
            "last_activity": n["last_activity"], "cluster": n["cluster"], "hop": hop}


@router.get("/status", response_model=Status)
def status():
    return state.status()


@router.get("/summary", response_model=Summary, dependencies=[Depends(require_ready)])
def summary(response: Response):
    response.headers.update(CACHE_HEADERS)
    response.headers["X-BlockSense-Environment"] = "synthetic_demo"
    return state.summary


@router.get("/wallets", response_model=list[WalletRow], dependencies=[Depends(require_ready)])
def wallets(
    response: Response,
    sort: str = Query("risk"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    flag: str = Query("all"),
    risk: Optional[str] = Query(None, description="Comma list: High,Medium,Low"),
    min_score: float = Query(0, ge=0, le=100),
    max_score: float = Query(100, ge=0, le=100),
    q: Optional[str] = Query(None, max_length=100),
    limit: int = Query(500, ge=1, le=5000),
):
    if sort not in SORT_KEYS:
        raise ApiError(400, "Invalid sort key", f"Use one of {sorted(SORT_KEYS)}")
    risk_set, flagged = _parse_risk(risk), _parse_flag(flag)
    rows = [
        w for w in state.wallets
        if (risk_set is None or w["risk_category"] in risk_set)
        and (flagged is None or w["flagged"] == flagged)
        and min_score <= w["composite_score"] <= max_score
        and (not q or q.lower() in w["id"].lower())
    ]
    rows.sort(key=lambda w: w[SORT_KEYS[sort]], reverse=(order == "desc"))
    response.headers.update(CACHE_HEADERS)
    return rows[:limit]


@router.get("/wallet/{wallet_id}", response_model=WalletDetail,
            dependencies=[Depends(require_ready)])
def wallet(wallet_id: str, response: Response):
    response.headers.update(CACHE_HEADERS)
    return state.wallet_detail[_wallet_or_404(wallet_id)]


@router.get("/wallet/{wallet_id}/transactions", response_model=list[WalletTx],
            dependencies=[Depends(require_ready)])
def wallet_transactions(wallet_id: str, response: Response):
    response.headers.update(CACHE_HEADERS)
    return state.wallet_tx[_wallet_or_404(wallet_id)]


@router.get("/wallet/{wallet_id}/network", response_model=Graph,
            dependencies=[Depends(require_ready)])
def wallet_network(wallet_id: str, response: Response, depth: int = Query(1)):
    if depth < 1 or depth > MAX_EGO_DEPTH:
        raise ApiError(400, "Invalid depth", f"depth must be between 1 and {MAX_EGO_DEPTH}.")
    w = _wallet_or_404(wallet_id)
    hops = ego_hops(state.undirected, w, depth)
    nodes = [_node(n, h) for n, h in hops.items()]
    edges = [e for e in state.edges if e["source"] in hops and e["target"] in hops]
    response.headers.update(CACHE_HEADERS)
    return {"nodes": nodes, "edges": edges}


@router.get("/network", response_model=Graph, dependencies=[Depends(require_ready)])
def network(
    response: Response,
    risk: Optional[str] = None,
    flag: str = "all",
    cluster: Optional[int] = None,
):
    risk_set, flagged = _parse_risk(risk), _parse_flag(flag)
    keep = {
        w for w, n in state.nodes.items()
        if (risk_set is None or n["risk_category"] in risk_set)
        and (flagged is None or n["flagged"] == flagged)
        and (cluster is None or n["cluster"] == cluster)
    }
    edges = [e for e in state.edges if e["source"] in keep and e["target"] in keep]
    response.headers.update(CACHE_HEADERS)
    return {"nodes": [_node(w) for w in state.nodes if w in keep], "edges": edges}


@router.get("/temporal", response_model=Temporal, dependencies=[Depends(require_ready)])
def temporal(response: Response):
    response.headers.update(CACHE_HEADERS)
    return state.temporal


@router.get("/evaluation", response_model=Evaluation, dependencies=[Depends(require_ready)])
def evaluation(response: Response):
    response.headers.update(CACHE_HEADERS)
    return state.evaluation
