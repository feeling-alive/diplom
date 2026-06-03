"""Dashboard layout persistence API tests (Задача 1a + 7a).

Each test registers via ``/auth/register`` (which sets the auth cookie on the
shared httpx client) and then calls the protected ``/dashboard/config`` routes.
Since Задача 7 the canonical shape is the multi-dashboard envelope
``{dashboards: [{id, name, layout}], activeId}``.
"""

from __future__ import annotations

from httpx import AsyncClient

USER_A = {"email": "dash@example.com", "username": "dasher", "password": "secret123"}


def _widget(i: int) -> dict:
    return {"id": f"w_{i}", "type": "watchlist", "size": {"w": 2, "h": 2, "label": "2×2"},
            "x": 0, "y": 0, "w": 2, "h": 2}


async def test_get_config_seeds_default_envelope(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    resp = await client.get("/dashboard/config")
    assert resp.status_code == 200, resp.text
    env = resp.json()["layout"]
    assert isinstance(env, dict)
    assert len(env["dashboards"]) == 1
    dash = env["dashboards"][0]
    assert dash["name"] == "Основной"
    assert env["activeId"] == dash["id"]
    # The seeded dashboard carries the 4 default widgets.
    assert len(dash["layout"]) == 4
    types = {w["type"] for w in dash["layout"]}
    assert {"market_ticker", "watchlist", "allocation", "price_chart"} == types


async def test_get_config_unauthorized(client: AsyncClient) -> None:
    assert (await client.get("/dashboard/config")).status_code == 401


async def test_put_config_unauthorized(client: AsyncClient) -> None:
    resp = await client.put("/dashboard/config", json={"layout": []})
    assert resp.status_code == 401


async def test_put_bare_array_wrapped_as_envelope(client: AsyncClient) -> None:
    # Backward compatibility: a legacy bare array is wrapped into «Основной».
    await client.post("/auth/register", json=USER_A)
    custom = [_widget(1)]
    put = await client.put("/dashboard/config", json={"layout": custom})
    assert put.status_code == 200, put.text
    env = put.json()["layout"]
    assert env["dashboards"][0]["name"] == "Основной"
    assert env["dashboards"][0]["layout"] == custom


async def test_put_envelope_roundtrip(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    env = {
        "dashboards": [
            {"id": "d1", "name": "Основной", "layout": [_widget(1)]},
            {"id": "d2", "name": "Крипта", "layout": []},
        ],
        "activeId": "d2",
    }
    put = await client.put("/dashboard/config", json={"layout": env})
    assert put.status_code == 200, put.text
    assert put.json()["layout"] == env
    again = await client.get("/dashboard/config")
    assert again.json()["layout"] == env


async def test_put_bad_active_id_falls_back(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    env = {"dashboards": [{"id": "d1", "name": "Основной", "layout": []}], "activeId": "missing"}
    put = await client.put("/dashboard/config", json={"layout": env})
    assert put.status_code == 200, put.text
    assert put.json()["layout"]["activeId"] == "d1"


async def test_put_too_many_dashboards_rejected(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    env = {
        "dashboards": [{"id": f"d{i}", "name": f"Доска {i}", "layout": []} for i in range(6)],
        "activeId": "d0",
    }
    resp = await client.put("/dashboard/config", json={"layout": env})
    assert resp.status_code == 400


async def test_put_malformed_dashboard_rejected(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    env = {"dashboards": [{"id": "d1", "name": "Без layout"}], "activeId": "d1"}
    resp = await client.put("/dashboard/config", json={"layout": env})
    assert resp.status_code == 400


async def test_put_too_many_widgets_rejected(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    oversized = [_widget(i) for i in range(101)]
    resp = await client.put("/dashboard/config", json={"layout": oversized})
    assert resp.status_code == 400
