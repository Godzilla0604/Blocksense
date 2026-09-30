"""Export every API response as static JSON for GitHub Pages hosting.

Runs the exact same pipeline the FastAPI server runs at startup, then writes
each endpoint's payload to disk. Every payload is validated against the same
Pydantic schemas the API uses, so the static site and the live API share one
contract.

Usage:
    python export_static.py                      # -> ../frontend/public/data
    python export_static.py --out some/dir
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

os.environ.setdefault("BLOCKSENSE_STAGE_DELAY", "0")

import config  # noqa: E402
from api.routes import _node  # noqa: E402
from api.schemas import (Evaluation, Graph, Summary, Temporal, WalletDetail,  # noqa: E402
                         WalletRow, WalletTx)
from core.cache import state  # noqa: E402
from core.graph_engine import ego_hops  # noqa: E402
from core.pipeline import run_pipeline  # noqa: E402


def dump(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":"), ensure_ascii=False))


def validate(model, payload):
    """Round-trip through the API schema; fails loudly on contract drift."""
    if isinstance(payload, list):
        return [model.model_validate(p).model_dump() for p in payload]
    return model.model_validate(payload).model_dump()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"))
    args = ap.parse_args()
    out = Path(args.out)

    run_pipeline(state)
    if state.error or not state.ready:
        print(f"Pipeline failed: {state.error}", file=sys.stderr)
        return 1

    if out.exists():
        shutil.rmtree(out)

    exported_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    summary = validate(Summary, state.summary)
    summary["exported_at"] = exported_at
    summary["source_file"] = Path(config.DATA_PATH).name

    dump(out / "summary.json", summary)
    dump(out / "wallets.json", validate(WalletRow, state.wallets))
    dump(out / "network.json", validate(Graph, {
        "nodes": [_node(w) for w in state.nodes], "edges": state.edges}))
    dump(out / "temporal.json", validate(Temporal, state.temporal))
    dump(out / "evaluation.json", validate(Evaluation, state.evaluation))

    for w in state.wallet_detail:
        base = out / "wallet" / w
        dump(base / "detail.json", validate(WalletDetail, state.wallet_detail[w]))
        dump(base / "transactions.json", validate(WalletTx, state.wallet_tx[w]))
        for depth in range(1, config.MAX_EGO_DEPTH + 1):
            hops = ego_hops(state.undirected, w, depth)
            dump(base / f"network-{depth}.json", validate(Graph, {
                "nodes": [_node(n, h) for n, h in hops.items()],
                "edges": [e for e in state.edges if e["source"] in hops and e["target"] in hops],
            }))

    files = sum(1 for _ in out.rglob("*.json"))
    print(f"Exported {files} JSON files for {len(state.wallet_detail)} wallets to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
