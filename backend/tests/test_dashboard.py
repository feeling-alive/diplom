"""Dashboard layout persistence API tests (Задача 1a).

Each test registers via ``/auth/register`` (which sets the auth cookie on the
shared httpx client) and then calls the protected ``/dashboard/config`` routes
with that cookie. Mirrors the structure of ``test_profile.py``.
"""

from __future__ import annotations

from httpx import AsyncClient

USER_A = {"email": "dash@example.com", "username": "dasher", "password": "secret123"}


async def test_get_config_seeds_default(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    resp = await client.get("/dashboard/config")
    assert resp.status_code == 200, resp.text
    layout = resp.json()["layout"]
    # First access seeds the 4-widget default.
    assert isinstance(layout, list)
    assert len(layout) == 4
    types = {w["type"] for w in layout}
    assert {"market_ticker", "watchlist", "allocation", "price_chart"} == types


async def test_get_config_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/dashboard/config")
    assert resp.status_code == 401


async def test_put_config_unauthorized(client: AsyncClient) -> None:
    resp = await client.put("/dashboard/config", json={"layout": []})
    assert resp.status_code == 401


async def test_put_then_get_roundtrip(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    custom = [
        {"id": "w_1", "type": "watchlist", "size": {"w": 2, "h": 2, "label": "2×2"},
         "x": 0, "y": 0, "w": 2, "h": 2},
    ]
    put = await client.put("/dashboard/config", json={"layout": custom})
    assert put.status_code == 200, put.text
    assert put.json()["layout"] == custom
    # Persisted: a fresh GET returns the saved layout, not the default.
    again = await client.get("/dashboard/config")
    assert again.json()["layout"] == custom


async def test_put_empty_layout_respected(client: AsyncClient) -> None:
    # Clearing all widgets ([]) must persist as empty, not re-seed defaults.
    await client.post("/auth/register", json=USER_A)
    await client.put("/dashboard/config", json={"layout": []})
    again = await client.get("/dashboard/config")
    assert again.json()["layout"] == []


async def test_put_envelope_shape(client: AsyncClient) -> None:
    # The multi-dashboard envelope (Задача 7) is stored opaquely.
    await client.post("/auth/register", json=USER_A)
    envelope = {"dashboards": [{"id": "d1", "name": "Основной", "layout": []}], "activeId": "d1"}
    put = await client.put("/dashboard/config", json={"layout": envelope})
    assert put.status_code == 200, put.text
    assert put.json()["layout"] == envelope


async def test_put_too_many_widgets_rejected(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    oversized = [{"id": f"w_{i}", "type": "watchlist"} for i in range(101)]
    resp = await client.put("/dashboard/config", json={"layout": oversized})
    assert resp.status_code == 400
