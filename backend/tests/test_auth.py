"""Auth API smoke tests: register, login, and the 401 wrong-password path."""

from __future__ import annotations

from httpx import AsyncClient

VALID = {"email": "user@example.com", "username": "tester", "password": "secret123"}


async def test_register_ok(client: AsyncClient) -> None:
    resp = await client.post("/auth/register", json=VALID)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == VALID["email"]
    assert body["username"] == VALID["username"]
    assert body["role"] == "user"
    # Auth cookie was set on the client.
    assert "access_token" in resp.cookies or "access_token" in client.cookies


async def test_register_duplicate_email(client: AsyncClient) -> None:
    await client.post("/auth/register", json=VALID)
    dup = {**VALID, "username": "other"}
    resp = await client.post("/auth/register", json=dup)
    assert resp.status_code == 409


async def test_login_ok(client: AsyncClient) -> None:
    await client.post("/auth/register", json=VALID)
    resp = await client.post(
        "/auth/login", json={"email": VALID["email"], "password": VALID["password"]}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == VALID["email"]


async def test_login_wrong_password(client: AsyncClient) -> None:
    await client.post("/auth/register", json=VALID)
    resp = await client.post(
        "/auth/login", json={"email": VALID["email"], "password": "wrong-password"}
    )
    assert resp.status_code == 401


async def test_me_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


async def test_me_after_register(client: AsyncClient) -> None:
    await client.post("/auth/register", json=VALID)
    resp = await client.get("/auth/me")
    assert resp.status_code == 200
    assert resp.json()["username"] == VALID["username"]


async def test_google_not_configured(client: AsyncClient) -> None:
    # GOOGLE_CLIENT_ID is empty by default -> 501.
    resp = await client.get("/auth/google", follow_redirects=False)
    assert resp.status_code == 501
