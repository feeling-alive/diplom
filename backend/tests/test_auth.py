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


class _FakeResp:
    """Minimal stand-in for an httpx.Response used by the OAuth callback."""

    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:  # pragma: no cover - always ok in tests
        return None

    def json(self) -> dict:
        return self._payload


class _FakeGoogleClient:
    """Fake AsyncClient: POST -> token, GET -> userinfo profile."""

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self) -> "_FakeGoogleClient":
        return self

    async def __aexit__(self, *exc) -> None:
        return None

    async def post(self, *args, **kwargs) -> _FakeResp:
        return _FakeResp({"access_token": "google-access-token"})

    async def get(self, *args, **kwargs) -> _FakeResp:
        return _FakeResp(
            {"id": "google-123", "email": "googleuser@example.com", "name": "Google User"}
        )


async def test_google_callback_sets_cookie_on_200_html(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Variant A: the callback returns a 200 HTML page (not a 307 redirect) with the
    auth cookie set on that 200 response and a JS redirect to '/'. A 200-origin
    cookie is what the browser reliably persists (the proxied-307 cookie was dropped)."""
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(settings, "google_client_secret", "test-secret")
    monkeypatch.setattr(settings, "frontend_url", "http://localhost:5173")

    import app.auth.router as router_mod

    monkeypatch.setattr(router_mod.httpx, "AsyncClient", _FakeGoogleClient)

    resp = await client.get(
        "/auth/google/callback", params={"code": "auth-code"}, follow_redirects=False
    )
    assert resp.status_code == 200, resp.text
    # Cookie set on the 200 response itself.
    assert "access_token" in resp.cookies or "access_token" in client.cookies
    # Body carries the JS redirect to the SPA root.
    assert "window.location.replace('/')" in resp.text
    # And the new user can immediately authenticate with that cookie.
    me = await client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "googleuser@example.com"
