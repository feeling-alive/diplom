"""Profile API tests.

Each test registers via ``/auth/register`` (which sets the auth cookie on the
shared httpx client) and then calls the protected ``/users`` routes with that
cookie. Registering a second user simply overwrites the cookie, which is how the
"username taken" path is exercised.
"""

from __future__ import annotations

from httpx import AsyncClient

USER_A = {"email": "a@example.com", "username": "alice", "password": "secret123"}
USER_B = {"email": "b@example.com", "username": "bobby", "password": "secret123"}


async def test_get_profile_authenticated(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    resp = await client.get("/users/me")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["username"] == "alice"
    assert body["email"] == "a@example.com"
    # Subscription/premium removed — the profile no longer carries that field.
    assert "subscription" not in body


async def test_get_profile_unauthorized(client: AsyncClient) -> None:
    resp = await client.get("/users/me")
    assert resp.status_code == 401


async def test_update_username(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    resp = await client.patch("/users/me", json={"username": "alice2"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["username"] == "alice2"
    # Persisted: a fresh GET reflects the new name.
    again = await client.get("/users/me")
    assert again.json()["username"] == "alice2"


async def test_username_taken(client: AsyncClient) -> None:
    # Register A (alice), then B (bobby) — cookie now belongs to B.
    await client.post("/auth/register", json=USER_A)
    await client.post("/auth/register", json=USER_B)
    resp = await client.patch("/users/me", json={"username": "alice"})
    assert resp.status_code == 409


async def test_check_username_available(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    free = await client.get("/users/me/check-username", params={"username": "totally_free"})
    assert free.status_code == 200
    assert free.json()["available"] is True
    # Own name counts as available.
    own = await client.get("/users/me/check-username", params={"username": "alice"})
    assert own.json()["available"] is True


async def test_check_username_taken(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    await client.post("/auth/register", json=USER_B)  # cookie -> bobby
    taken = await client.get("/users/me/check-username", params={"username": "alice"})
    assert taken.status_code == 200
    assert taken.json()["available"] is False


async def test_subscription_routes_removed(client: AsyncClient) -> None:
    """The /subscription surface was removed — its endpoints must 404."""
    await client.post("/auth/register", json=USER_A)
    resp = await client.post("/subscription/upgrade")
    assert resp.status_code == 404
