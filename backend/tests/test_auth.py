"""Auth API smoke tests: register, login, and the 401 wrong-password path."""

from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient

from app.config import settings

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


async def test_google_not_configured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # With no GOOGLE_CLIENT_ID configured, /auth/google returns 501. Force it empty
    # so the test is independent of any real credentials in a local .env.
    monkeypatch.setattr(settings, "google_client_id", "")
    resp = await client.get("/auth/google", follow_redirects=False)
    assert resp.status_code == 501


async def test_google_login_redirect_uri_uses_frontend_origin(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The OAuth redirect_uri must point at the frontend proxy origin, not the
    backend, so the callback's auth cookie lands on the SPA origin (bug #1)."""
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(settings, "google_client_secret", "test-secret")
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")
    monkeypatch.setattr(settings, "backend_url", "http://localhost:8000")

    resp = await client.get("/auth/google", follow_redirects=False)
    assert resp.status_code in (302, 307), resp.text

    location = resp.headers["location"]
    params = parse_qs(urlparse(location).query)
    redirect_uri = params["redirect_uri"][0]
    assert redirect_uri == "http://localhost:5173/auth/google/callback"
    assert "localhost:8000" not in redirect_uri
