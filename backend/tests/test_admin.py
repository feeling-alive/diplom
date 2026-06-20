"""Admin panel API tests.

Pattern:
  1. Register a regular user via /auth/register (sets auth cookie on client)
  2. Promote to admin directly in the test DB via db_session
  3. Re-login to get a fresh JWT with role=admin
  4. Call /admin/* endpoints — cookie is automatically sent by the AsyncClient
"""

from __future__ import annotations

import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import update

from app.models import User, UserRole

ADMIN = {"email": "admin@test.com", "username": "testadmin", "password": "Admin1234!"}
USER_A = {"email": "usera@test.com", "username": "usera", "password": "Pass1234!"}
USER_B = {"email": "userb@test.com", "username": "userb", "password": "Pass1234!"}


@pytest_asyncio.fixture
async def admin_client(client: AsyncClient, db_session):
    """Register a user, promote to admin in DB, re-login → yields admin-authed client."""
    await client.post("/auth/register", json=ADMIN)
    await db_session.execute(
        update(User)
        .where(User.email == ADMIN["email"])
        .values(role=UserRole.admin)
    )
    await db_session.commit()
    # Re-login to get a fresh JWT that carries role=admin in the cookie.
    await client.post("/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    return client


# ---------------------------------------------------------------------------
# Auth guard tests
# ---------------------------------------------------------------------------

async def test_stats_unauthenticated(client: AsyncClient) -> None:
    resp = await client.get("/admin/stats")
    assert resp.status_code == 401


async def test_stats_forbidden_regular_user(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER_A)
    resp = await client.get("/admin/stats")
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

async def test_stats_ok(admin_client: AsyncClient) -> None:
    resp = await admin_client.get("/admin/stats")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "total_users" in body
    assert "new_users_7d" in body
    assert "total_news" in body
    assert body["total_users"] >= 1  # at least the admin itself


# ---------------------------------------------------------------------------
# Users list
# ---------------------------------------------------------------------------

async def test_list_users_ok(admin_client: AsyncClient, db_session) -> None:
    # Register a second user so there's something to list
    await admin_client.post("/auth/register", json=USER_B)
    # Re-login as admin (register above overwrites cookie)
    await admin_client.post("/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})

    resp = await admin_client.get("/admin/users")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "items" in body and "total" in body
    assert body["total"] >= 2


async def test_list_users_search(admin_client: AsyncClient) -> None:
    await admin_client.post("/auth/register", json=USER_B)
    await admin_client.post("/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})

    resp = await admin_client.get("/admin/users", params={"search": "userb"})
    assert resp.status_code == 200
    body = resp.json()
    assert all("userb" in u["username"].lower() or "userb" in u["email"].lower() for u in body["items"])


# ---------------------------------------------------------------------------
# Patch user
# ---------------------------------------------------------------------------

async def test_patch_user_block_unblock(admin_client: AsyncClient, db_session) -> None:
    await admin_client.post("/auth/register", json=USER_A)
    await admin_client.post("/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})

    # Get user id
    users_resp = await admin_client.get("/admin/users", params={"search": USER_A["username"]})
    uid = users_resp.json()["items"][0]["id"]

    # Block
    patch_resp = await admin_client.patch(f"/admin/users/{uid}", json={"is_blocked": True})
    assert patch_resp.status_code == 200, patch_resp.text
    assert patch_resp.json()["is_active"] is False

    # Unblock
    patch_resp2 = await admin_client.patch(f"/admin/users/{uid}", json={"is_blocked": False})
    assert patch_resp2.status_code == 200
    assert patch_resp2.json()["is_active"] is True


async def test_patch_user_not_found(admin_client: AsyncClient) -> None:
    resp = await admin_client.patch(
        "/admin/users/00000000-0000-0000-0000-000000000000",
        json={"is_blocked": True},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Delete user
# ---------------------------------------------------------------------------

async def test_delete_user_ok(admin_client: AsyncClient) -> None:
    await admin_client.post("/auth/register", json=USER_A)
    await admin_client.post("/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})

    users_resp = await admin_client.get("/admin/users", params={"search": USER_A["username"]})
    uid = users_resp.json()["items"][0]["id"]

    del_resp = await admin_client.delete(f"/admin/users/{uid}")
    assert del_resp.status_code == 204

    # Deleted user no longer appears in the list
    after = await admin_client.get("/admin/users", params={"search": USER_A["username"]})
    assert after.json()["total"] == 0


async def test_delete_self_forbidden(admin_client: AsyncClient) -> None:
    users_resp = await admin_client.get("/admin/users", params={"search": ADMIN["username"]})
    own_id = users_resp.json()["items"][0]["id"]
    resp = await admin_client.delete(f"/admin/users/{own_id}")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Create admin
# ---------------------------------------------------------------------------

async def test_create_admin_ok(admin_client: AsyncClient) -> None:
    resp = await admin_client.post(
        "/admin/users/create-admin",
        json={"email": "newadmin@test.com", "username": "newadmin", "password": "NewAdmin1234!"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["role"] == "admin"
    assert body["is_active"] is True


async def test_create_admin_duplicate_email(admin_client: AsyncClient) -> None:
    resp = await admin_client.post(
        "/admin/users/create-admin",
        json={"email": ADMIN["email"], "username": "another_admin", "password": "NewAdmin1234!"},
    )
    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

async def test_list_comments_empty(admin_client: AsyncClient) -> None:
    resp = await admin_client.get("/admin/comments")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


# ---------------------------------------------------------------------------
# API keys
# ---------------------------------------------------------------------------

async def test_api_keys_empty(admin_client: AsyncClient) -> None:
    resp = await admin_client.get("/admin/api-keys")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {}


async def test_api_keys_save_and_list(admin_client: AsyncClient) -> None:
    save_resp = await admin_client.post("/admin/api-keys", json={"finnhub": "test_key_12345"})
    assert save_resp.status_code == 204

    list_resp = await admin_client.get("/admin/api-keys")
    assert list_resp.status_code == 200
    body = list_resp.json()
    assert "finnhub" in body
    # Value should be masked (not the original plaintext)
    assert body["finnhub"] != "test_key_12345"
    assert body["finnhub"].endswith("2345")


async def test_api_keys_test_unknown_service(admin_client: AsyncClient) -> None:
    resp = await admin_client.post("/admin/api-keys/test/nonexistent_service")
    assert resp.status_code == 400


async def test_api_keys_test_not_saved(admin_client: AsyncClient) -> None:
    resp = await admin_client.post("/admin/api-keys/test/finnhub")
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert "не сохранён" in body["message"].lower()


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

async def test_logs_empty_initially(admin_client: AsyncClient) -> None:
    resp = await admin_client.get("/admin/logs")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "items" in body and "total" in body


async def test_logs_populated_after_action(admin_client: AsyncClient) -> None:
    # Save an API key — this creates a log entry
    await admin_client.post("/admin/api-keys", json={"groq": "test_groq_key_xyz"})

    resp = await admin_client.get("/admin/logs")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    actions = [log["action"] for log in body["items"]]
    assert "save_api_key" in actions
