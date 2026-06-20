"""Password-reset flow tests: forgot-password + reset-password (6-digit code).

Redis is replaced with an in-memory fake (monkeypatched ``get_redis`` inside the
router module), and ``send_reset_code`` is replaced with a recorder — no real
SMTP or Redis is touched.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

import app.auth.router as auth_router

VALID = {"email": "user@example.com", "username": "tester", "password": "secret123"}

NEUTRAL = "Если аккаунт существует, письмо отправлено"


class FakeRedis:
    """Минимальный in-memory заменитель Redis для кодов сброса."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.last_ttl: int | None = None

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value
        self.last_ttl = ex

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def delete(self, key: str) -> None:
        self.store.pop(key, None)


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeRedis:
    fake = FakeRedis()
    monkeypatch.setattr(auth_router, "get_redis", lambda: fake)
    return fake


@pytest.fixture
def email_mock(monkeypatch: pytest.MonkeyPatch) -> AsyncMock:
    mock = AsyncMock()
    monkeypatch.setattr(auth_router, "send_reset_code", mock)
    return mock


async def test_forgot_password_user_not_found(
    client: AsyncClient, fake_redis: FakeRedis, email_mock: AsyncMock
) -> None:
    """Несуществующий email → 200 с нейтральным сообщением, письмо не отправляется."""
    resp = await client.post("/auth/forgot-password", json={"email": "ghost@example.com"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["message"] == NEUTRAL
    email_mock.assert_not_awaited()
    assert fake_redis.store == {}


async def test_forgot_password_user_exists(
    client: AsyncClient, fake_redis: FakeRedis, email_mock: AsyncMock
) -> None:
    """Существующий пользователь → 6-значный код в Redis под reset:{email} (TTL 900)."""
    await client.post("/auth/register", json=VALID)

    resp = await client.post("/auth/forgot-password", json={"email": VALID["email"]})
    assert resp.status_code == 200, resp.text
    assert resp.json()["message"] == NEUTRAL

    key = f"reset:{VALID['email']}"
    assert key in fake_redis.store
    assert fake_redis.last_ttl == 900
    code = fake_redis.store[key]
    assert len(code) == 6 and code.isdigit()

    # Письмо получает email + тот же код (не ссылку).
    email_mock.assert_awaited_once()
    to_arg, code_arg = email_mock.await_args.args
    assert to_arg == VALID["email"]
    assert code_arg == code


async def test_reset_password_invalid_code(
    client: AsyncClient, fake_redis: FakeRedis
) -> None:
    """Неверный код → 400 «Код недействителен или истёк»."""
    await client.post("/auth/register", json=VALID)
    resp = await client.post(
        "/auth/reset-password",
        json={"email": VALID["email"], "code": "000000", "new_password": "newpass123"},
    )
    assert resp.status_code == 400
    assert "Код недействителен" in resp.json()["detail"]


async def test_reset_password_success(
    client: AsyncClient, fake_redis: FakeRedis, email_mock: AsyncMock
) -> None:
    """Валидный код → пароль обновлён, код удалён, логин по новому паролю работает."""
    await client.post("/auth/register", json=VALID)
    await client.post("/auth/forgot-password", json={"email": VALID["email"]})
    code = fake_redis.store[f"reset:{VALID['email']}"]

    resp = await client.post(
        "/auth/reset-password",
        json={"email": VALID["email"], "code": code, "new_password": "brandnew456"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["message"] == "Пароль успешно изменён"
    assert fake_redis.store == {}  # код удалён

    # Старый пароль больше не работает, новый — работает.
    old = await client.post(
        "/auth/login", json={"email": VALID["email"], "password": VALID["password"]}
    )
    assert old.status_code == 401
    new = await client.post(
        "/auth/login", json={"email": VALID["email"], "password": "brandnew456"}
    )
    assert new.status_code == 200, new.text


@pytest.mark.parametrize(
    "bad_password",
    ["short1", "nodigitshere"],  # < 8 символов; без цифры
)
async def test_reset_password_validation(
    client: AsyncClient, fake_redis: FakeRedis, bad_password: str
) -> None:
    """Слабый пароль → 422 validation error (не доходит до Redis)."""
    resp = await client.post(
        "/auth/reset-password",
        json={"email": VALID["email"], "code": "123456", "new_password": bad_password},
    )
    assert resp.status_code == 422


async def test_reset_password_bad_code_format(
    client: AsyncClient, fake_redis: FakeRedis
) -> None:
    """Код не из 6 цифр → 422 (валидация схемы, не доходит до Redis)."""
    resp = await client.post(
        "/auth/reset-password",
        json={"email": VALID["email"], "code": "12ab", "new_password": "newpass123"},
    )
    assert resp.status_code == 422


async def test_reset_code_single_use(
    client: AsyncClient, fake_redis: FakeRedis, email_mock: AsyncMock
) -> None:
    """Повторное использование кода → 400."""
    await client.post("/auth/register", json=VALID)
    await client.post("/auth/forgot-password", json={"email": VALID["email"]})
    code = fake_redis.store[f"reset:{VALID['email']}"]

    first = await client.post(
        "/auth/reset-password",
        json={"email": VALID["email"], "code": code, "new_password": "brandnew456"},
    )
    assert first.status_code == 200
    second = await client.post(
        "/auth/reset-password",
        json={"email": VALID["email"], "code": code, "new_password": "another789"},
    )
    assert second.status_code == 400
