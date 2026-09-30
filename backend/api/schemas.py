"""Pydantic response models (PRD §4, §13). These double as the OpenAPI docs."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

RiskCategory = Literal["High", "Medium", "Low"]


class Meta(BaseModel):
    environment: str


class DateRange(BaseModel):
    start: str
    end: str


class RiskCluster(BaseModel):
    id: int
    size: int
    wallets: list[str]
    high: int
    medium: int


class Summary(BaseModel):
    wallet_count: int
    tx_count: int
    volume: float
    flagged_count: int
    clusters: int
    risk_cluster_count: int
    network_components: int
    risk_counts: dict[str, int]
    date_range: DateRange
    highest_risk_wallet: Optional[str]
    risk_clusters: list[RiskCluster]
    meta: Meta


class WalletRow(BaseModel):
    id: str
    risk_category: RiskCategory
    composite_score: float
    base_score: float
    propagated_score: float
    flagged: bool
    tx_count: int
    volume: float
    counterparties: int
    degree: int
    last_activity: str
    cluster: int
    primary_reason: str


class Explanation(BaseModel):
    factor: str
    feature: str
    group: Literal["behavioural", "temporal", "network"]
    value: float
    baseline: float
    deviation: float
    severity: Literal["strong", "supporting"]
    direction: str
    value_display: str
    baseline_display: str
    description: str


class ComponentScore(BaseModel):
    score: float
    weight: float
    share: float


class Counterparty(BaseModel):
    wallet: str
    in_volume: float
    out_volume: float
    tx_count: int
    risk_category: RiskCategory


class WalletDetail(WalletRow):
    metrics: dict[str, float | int | str]
    component_scores: dict[str, ComponentScore]
    model: dict[str, float]
    explanations: list[Explanation]
    top_counterparties: list[Counterparty]


class WalletTx(BaseModel):
    tx_id: str
    timestamp: str
    amount: float
    direction: Literal["in", "out"]
    counterparty: str


class GraphNode(BaseModel):
    id: str
    risk: RiskCategory
    score: float
    base_score: float
    flagged: bool
    tx_count: int
    volume: float
    counterparties: int
    last_activity: str
    cluster: int
    hop: Optional[int] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    weight: float
    timestamp: str


class Graph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class Temporal(BaseModel):
    dates: list[str]
    daily_txs: list[dict]
    daily_vol: list[dict]
    heatmap: list[dict]
    risk_timeline: list[dict]


class Evaluation(BaseModel):
    precision: float
    recall: float
    f1: float
    confusion: dict[str, int]
    threshold: float
    at_high_threshold: dict
    wallets_evaluated: int
    ground_truth_suspicious: int
    note: str


class Status(BaseModel):
    stage: str
    stage_index: int
    stages: list[str]
    progress: int
    ready: bool
    wallet_count: Optional[int] = None
    error: Optional[str] = None
