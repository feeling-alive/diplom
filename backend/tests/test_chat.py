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


async def test_predict_public_exposes_low_confidence(
    monkeypatch: pytest.MonkeyPatch,
    client: AsyncClient,
) -> None:
    async def fake_low_conf(
        candles: list[dict[str, Any]], symbol: str = "unknown"
    ) -> dict[str, Any]:
        return {
            "symbol": symbol,
            "prediction": "SIDEWAYS",
            "probability": 0.51,
            "raw_probabilities": {"UP": 0.51, "DOWN": 0.30, "SIDEWAYS": 0.19},
            "low_confidence": True,
            "source": "huggingface",
        }

    monkeypatch.setattr("app.routes.chat.get_prediction", fake_low_conf)
    resp = await client.get("/api/chat/predict/BTC")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["low_confidence"] is True
    assert body["raw_probabilities"]["UP"] == 0.51


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


# ---------------------------------------------------------------------------
# News context binding (base ticker + fallbacks)
# ---------------------------------------------------------------------------


async def test_news_context_matches_by_base_ticker(db_session: AsyncSession) -> None:
    """A full instrument id (BTC-USDT) should surface BTC-tagged/keyword news.

    On the sqlite test DB the JSONB tag query is skipped and the text fallback
    matches the base ticker in the title.
    """
    from datetime import datetime, timezone

    from app.models import NewsArticle
    from app.routes.chat import _get_news_context

    db_session.add(
        NewsArticle(
            title="BTC rallies past resistance",
            url="http://news.test/btc-1",
            source_name="TestWire",
            published_at=datetime.now(tz=timezone.utc),
            category="crypto",
        )
    )
    await db_session.commit()

    ctx = await _get_news_context(db_session, "BTC-USDT")
    assert "BTC rallies" in ctx


async def test_news_context_empty_when_no_articles(db_session: AsyncSession) -> None:
    from app.routes.chat import _get_news_context

    ctx = await _get_news_context(db_session, "BTC-USDT")
    assert "Нет свежих новостей" in ctx


# ---------------------------------------------------------------------------
# System prompt builder (Block 3) — pure functions, no network
# ---------------------------------------------------------------------------


def test_rule_score_text_thresholds() -> None:
    from app.routes.chat import _rule_score_text

    assert "бычьи" in _rule_score_text(0.5)
    assert "медвежьи" in _rule_score_text(-0.5)
    assert "нейтральные" in _rule_score_text(0.0)


def test_build_system_prompt_structure() -> None:
    from app.routes.chat import _build_system_prompt

    prompt = _build_system_prompt(
        symbol="BTC-USDT",
        direction="UP",
        probability=0.62,
        news_context="Свежие новости:\n- BTC растёт.",
        low_confidence=False,
        patchtst_prob=0.70,
        rule_score=0.5,
        signals_agree=True,
    )
    assert "АНАЛИЗ АКТИВА: BTC-USDT" in prompt
    assert "PatchTST (трансформер): 70%" in prompt
    assert "бычьи" in prompt
    assert "Сигналы согласованы: да" in prompt
    assert "Уверенность: 62%" in prompt
    assert "Материал носит информационный характер" in prompt


def test_build_system_prompt_low_confidence_branch() -> None:
    from app.routes.chat import _build_system_prompt

    prompt = _build_system_prompt(
        symbol="ETH-USDT",
        direction="SIDEWAYS",
        probability=0.51,
        news_context="Нет свежих новостей по данному активу.",
        low_confidence=True,
        patchtst_prob=0.51,
        rule_score=0.0,
        signals_agree=False,
    )
    assert "слабый" in prompt  # uncertainty note rendered
    assert "Сигналы согласованы: нет" in prompt
    assert "нейтральные" in prompt
    assert "Материал носит информационный характер" in prompt
