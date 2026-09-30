"""In-memory application state. Everything is computed once at startup (PRD §15)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

STAGES = [
    "Loading transaction data...",
    "Building transaction network...",
    "Computing behavioural features...",
    "Analyzing temporal activity...",
    "Generating anomaly scores...",
]


@dataclass
class AppState:
    stage_index: int = -1
    ready: bool = False
    error: str | None = None
    # Precomputed, serialisable payloads
    summary: dict = field(default_factory=dict)
    wallets: list[dict] = field(default_factory=list)
    wallet_detail: dict[str, dict] = field(default_factory=dict)
    wallet_tx: dict[str, list[dict]] = field(default_factory=dict)
    nodes: dict[str, dict] = field(default_factory=dict)
    edges: list[dict] = field(default_factory=list)
    temporal: dict = field(default_factory=dict)
    evaluation: dict = field(default_factory=dict)
    # Runtime graph for ego slicing
    undirected: Any = None

    def status(self) -> dict:
        base = {"stages": STAGES}
        if self.error:
            return {**base, "stage": "Initialization failed", "stage_index": max(self.stage_index, 0),
                    "progress": 0, "ready": False, "error": self.error}
        if self.ready:
            return {**base, "stage": "Ready", "stage_index": len(STAGES), "progress": 100,
                    "ready": True, "wallet_count": self.summary.get("wallet_count")}
        idx = max(self.stage_index, 0)
        return {**base, "stage": STAGES[idx], "stage_index": idx,
                "progress": int(100 * idx / len(STAGES)), "ready": False}


state = AppState()
