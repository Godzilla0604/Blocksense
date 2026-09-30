"""End-to-end: startup -> poll status -> fetch the top wallet and validate."""
import time

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        seen = set()
        for _ in range(200):
            s = c.get("/api/status").json()
            seen.add(s["stage"])
            if s["ready"]:
                break
            time.sleep(0.05)
        assert s["ready"], s
        c.seen_stages = seen
        yield c


def test_summary(client):
    s = client.get("/api/summary").json()
    assert s["tx_count"] == 75 and s["wallet_count"] == 25
    assert s["meta"]["environment"] == "synthetic_demo"


def test_top_wallet_explanations(client):
    top = client.get("/api/wallets?sort=risk&order=desc").json()[0]
    d = client.get(f"/api/wallet/{top['id']}").json()
    assert 0 <= d["base_score"] <= 100 and 0 <= d["propagated_score"] <= 100
    assert d["risk_category"] in {"High", "Medium", "Low"}
    assert 3 <= len(d["explanations"]) <= 5
    for e in d["explanations"]:
        assert {"factor", "value", "baseline", "description", "group"} <= e.keys()
        assert isinstance(e["baseline"], float)


def test_ego_graph_fast(client):
    wid = client.get("/api/wallets").json()[0]["id"]
    t = time.perf_counter()
    r = client.get(f"/api/wallet/{wid}/network?depth=1")
    assert r.status_code == 200
    assert (time.perf_counter() - t) < 0.2
    assert any(n["id"] == wid and n["hop"] == 0 for n in r.json()["nodes"])


def test_errors(client):
    assert client.get("/api/wallet/nope").status_code == 400
    assert client.get("/api/wallet/bc1qdoesnotexist000").status_code == 404
    r = client.get("/api/wallet/bc1qyu3cddy9fshg38hwllep2qluenf6kc584q54e8/network?depth=10")
    assert r.status_code == 400 and "error" in r.json()


def test_filters(client):
    flagged = client.get("/api/wallets?flag=flagged").json()
    assert flagged and all(w["flagged"] for w in flagged)
    high = client.get("/api/network?risk=High").json()
    assert all(n["risk"] == "High" for n in high["nodes"])


def test_evaluation(client):
    e = client.get("/api/evaluation").json()
    assert 0 <= e["precision"] <= 1 and 0 <= e["recall"] <= 1
