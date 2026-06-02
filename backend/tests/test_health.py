"""Smoke test for the /health endpoint.

Uses TestClient which drives the app lifespan. The lifespan's create_all is
wrapped in try/except, so an unreachable DB degrades gracefully and the health
check still returns 200 — exactly what this test asserts.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_ok() -> None:
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
