"""Tests for AI chat pipeline: public predict endpoint and hybrid chat.

Covers:
  * GET  /api/chat/predict/{symbol} — public, returns PatchTST prediction
  * POST /api/chat/message          — requires auth, hybrid AI analysis
  * General chat (symbol="general")
  * Fallback behaviour on missing candles / API failure
"""

from __future__ import annotations

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

USER = {"email": "u@example.com", "username": "user", "password": "secret123"}


# ---------------------------------------------------------------------------
# Fixtures: mock external layers so tests never hit the real network.
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _no_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_cached(key: str) -> dict[str, Any] | None:
        return None

    async def fake_set_cached(key: str, data: dict[str, Any], ttl: int) -> None:
        return None

    monkeypatch.setattr("app.services.cache.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.cache.set_cached", fake_set_cached)


_FAKE_CANDLES = {
    "symbol": "BTC",
    "timeframe": "1H",
    "source": "mock",
    "candles": [{"t": 1700000000000, "o": 67000, "h": 68100, "l": 66900, "c": 68045.78, "v": 234.51}],
}


@pytest.fixture(autouse=True)
def _mock_candles(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_candles(symbol: str, timeframe: str = "1H", limit: int = 100) -> dict[str, Any]:
        return _FAKE_CANDLES

    monkeypatch.setattr("app.services.candles.get_candles", fake_get_candles)


_FAKE_PREDICTION = {
    "symbol": "BTC",
    "prediction": "UP",
    "probability": 0.82,
    "source": "huggingface",
}


@pytest.fixture(autouse=True)
def _mock_prediction(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_prediction(candles: list[dict[str, Any]], symbol: str = "unknown") -> dict[str, Any]:
        return _FAKE_PREDICTION

    monkeypatch.setattr("app.routes.chat.get_prediction", fake_get_prediction)


_FAKE_GROQ_REPLY = "Анализ показывает положительный тренд для BTC."


@pytest.fixture(autouse=True)
def _mock_groq(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_groq_response(system_prompt: str, user_message: str, history: list | None = None) -> str:
        return _FAKE_GROQ_REPLY

    monkeypatch.setattr("app.routes.chat.get_groq_response", fake_groq_response)


# ---------------------------------------------------------------------------
# GET /api/chat/predict/{symbol}  — public, no auth required
# ---------------------------------------------------------------------------


async def test_predict_public_ok(client: AsyncClient) -> None:
    resp = await client.get("/api/chat/predict/BTC")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["direction"] == "UP"
    assert body["probability"] == 0.82
    assert body["source"] == "huggingface"


async def test_predict_public_empty_symbol_returns_400(client: AsyncClient) -> None:
    resp = await client.get("/api/chat/predict/")
    assert resp.status_code >= 400


async def test_predict_public_fallback_on_missing_data(
    monkeypatch: pytest.MonkeyPatch,
    client: AsyncClient,
) -> None:
    async def fake_get_prediction_fallback(
        candles: list[dict[str, Any]], symbol: str = "unknown"
    ) -> dict[str, Any]:
        return {"symbol": symbol, "prediction": "SIDEWAYS", "probability": 0.5, "source": "no_candle_data"}

    monkeypatch.setattr("app.routes.chat.get_prediction", fake_get_prediction_fallback)
    resp = await client.get("/api/chat/predict/ETH")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["direction"] == "SIDEWAYS"
    assert body["probability"] == 0.5
    assert body["source"] == "no_candle_data"


# ---------------------------------------------------------------------------
# POST /api/chat/message  — requires JWT auth, hybrid AI analysis
# ---------------------------------------------------------------------------


async def test_chat_unauthorized(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/chat/message",
        json={"message": "hello", "symbol": "BTC"},
    )
    assert resp.status_code == 401


async def test_chat_with_symbol_returns_reply_and_prediction(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER)
    resp = await client.post(
        "/api/chat/message",
        json={"message": "Should I buy?", "symbol": "BTC"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["reply"] == _FAKE_GROQ_REPLY
    assert body["prediction"] is not None
    assert body["prediction"]["direction"] == "UP"
    assert body["prediction"]["probability"] == 0.82


async def test_chat_general_returns_reply_no_prediction(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER)
    resp = await client.post(
        "/api/chat/message",
        json={"message": "hello", "symbol": "general"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["reply"] == _FAKE_GROQ_REPLY
    assert body["prediction"] is None


async def test_chat_persists_history(client: AsyncClient, db_session: AsyncSession) -> None:
    await client.post("/auth/register", json=USER)
    resp1 = await client.post("/api/chat/message", json={"message": "q1", "symbol": "BTC"})
    assert resp1.status_code == 200
    resp2 = await client.post("/api/chat/message", json={"message": "q2", "symbol": "BTC"})
    assert resp2.status_code == 200
    # Two exchanges = 4 messages in session
    from app.models import ChatSession
    from sqlalchemy import select
    result = await db_session.execute(select(ChatSession))
    sessions = result.scalars().all()
    assert len(sessions) == 1
    assert len(sessions[0].messages) == 4


async def test_chat_symbol_missing_defaults_to_general(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER)
    resp = await client.post(
        "/api/chat/message",
        json={"message": "hello"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["prediction"] is None


# ---------------------------------------------------------------------------
# POST /api/chat/save  — legacy save endpoint
# ---------------------------------------------------------------------------


async def test_save_unauthenticated(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/chat/save",
        json={"user_message": "hello", "ai_message": "hi"},
    )
    assert resp.status_code == 401


async def test_save_with_symbol(client: AsyncClient) -> None:
    await client.post("/auth/register", json=USER)
    resp = await client.post(
        "/api/chat/save",
        json={"symbol": "BTC", "user_message": "Should I buy?", "ai_message": "Prediction: UP"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok"
    assert body["symbol"] == "BTC"
    assert body["message_count"] == 2
