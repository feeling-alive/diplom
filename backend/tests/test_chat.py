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
    "source": "local",
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


@pytest.fixture(autouse=True)
def _allow_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default: rate limiter allows every request (no real Redis in tests).

    The dedicated 429 test overrides this with its own monkeypatch.
    """
    async def fake_check(scope: str, identity: str, limit: int, window: int = 60) -> bool:
        return True

    monkeypatch.setattr("app.routes.chat.check_rate_limit", fake_check)


# ---------------------------------------------------------------------------
# GET /api/chat/predict/{symbol}  — public, no auth required
# ---------------------------------------------------------------------------


async def test_predict_public_ok(client: AsyncClient) -> None:
    resp = await client.get("/api/chat/predict/BTC")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["direction"] == "UP"
    assert body["probability"] == 0.82
    assert body["source"] == "local"


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
            "source": "local",
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
    # Asset analyses get the disclaimer hardcoded onto the reply.
    assert body["reply"].startswith(_FAKE_GROQ_REPLY)
    assert "Материал носит информационный характер" in body["reply"]
    assert body["prediction"] is not None
    assert body["prediction"]["direction"] == "UP"
    assert body["prediction"]["probability"] == 0.82


async def test_chat_rate_limit_exceeded_returns_429(
    monkeypatch: pytest.MonkeyPatch, client: AsyncClient
) -> None:
    await client.post("/auth/register", json=USER)

    async def deny_rate(scope: str, identity: str, limit: int, window: int = 60) -> bool:
        assert scope == "ai"
        return False

    monkeypatch.setattr("app.routes.chat.check_rate_limit", deny_rate)
    resp = await client.post("/api/chat/message", json={"message": "q", "symbol": "BTC"})
    assert resp.status_code == 429, resp.text
    # The limit value must not leak into the user-facing error message.
    detail = resp.json()["detail"]
    assert "30" not in detail
    assert "Слишком много запросов" in detail


async def test_chat_rate_limit_fail_open_when_redis_down(client: AsyncClient) -> None:
    """check_rate_limit fails open (returns True) when Redis is unreachable, so
    the request still succeeds. Exercises the real helper against a (likely)
    absent Redis without asserting on Redis state."""
    from app.services.cache import check_rate_limit

    allowed = await check_rate_limit("ai", "nobody", 1)
    assert allowed is True  # fail-open regardless of Redis availability


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


_DETAILS_DOWN = {
    "rsi": 32.0,
    "rsi_zone": "перепродан",
    "macd_position": "ниже сигнальной",
    "macd_cross": "нет пересечения",
    "trend": "нисходящий",
    "price_vs_sma20": -3.4,
    "atr": 12.34,
    "volume_zscore": 2.1,
}


def test_build_system_prompt_structure() -> None:
    from app.routes.chat import _build_system_prompt

    prompt = _build_system_prompt(
        symbol="BTC-USDT",
        indicator_details=_DETAILS_DOWN,
        rule_score=0.5,
        news_context="Свежие новости:\n- BTC растёт.",
    )
    assert "ТЕХНИЧЕСКИЙ АНАЛИЗ: BTC-USDT" in prompt
    assert "RSI(14): 32.0 — перепродан" in prompt
    assert "MACD: ниже сигнальной, нет пересечения" in prompt
    assert "Тренд: нисходящий (цена -3.4% от SMA20)" in prompt
    assert "ATR(14): 12.34" in prompt
    assert "Z-оценка объёма: +2.10" in prompt
    assert "бычьи" in prompt  # rule_score_text(0.5)
    assert "ЗАДАЧА" in prompt
    assert "Актуальные новости из базы:" in prompt
    assert "Материал носит информационный характер" in prompt


def test_build_system_prompt_no_news_branch() -> None:
    from app.routes.chat import _NO_NEWS_SENTINEL, _build_system_prompt

    prompt = _build_system_prompt(
        symbol="ETH-USDT",
        indicator_details={},  # degraded: no candle history
        rule_score=0.0,
        news_context=_NO_NEWS_SENTINEL,
    )
    assert "ВАЖНО: новостей нет" in prompt
    assert "Актуальные новости из базы:" not in prompt
    assert "нейтральные" in prompt
    # Empty details render with safe defaults, not a KeyError.
    assert "нет данных" in prompt
    assert "Материал носит информационный характер" in prompt


def test_build_news_block_branches() -> None:
    from app.routes.chat import _NO_NEWS_SENTINEL, _build_news_block

    assert _build_news_block("Свежие новости:\n- X").startswith("Актуальные новости из базы:")
    assert _build_news_block(_NO_NEWS_SENTINEL).startswith("ВАЖНО: новостей нет")
    assert _build_news_block("").startswith("ВАЖНО: новостей нет")


async def test_chat_does_not_duplicate_disclaimer(
    monkeypatch: pytest.MonkeyPatch, client: AsyncClient
) -> None:
    reply_with = (
        "Вывод по активу. ⚠️ Материал носит информационный характер. "
        "Все торговые решения вы принимаете самостоятельно."
    )

    async def fake_groq(system_prompt: str, user_message: str, history: list | None = None) -> str:
        return reply_with

    monkeypatch.setattr("app.routes.chat.get_groq_response", fake_groq)
    await client.post("/auth/register", json=USER)
    resp = await client.post("/api/chat/message", json={"message": "q", "symbol": "BTC"})
    assert resp.status_code == 200, resp.text
    # Already present → not appended a second time.
    assert resp.json()["reply"].count("информационный характер") == 1
