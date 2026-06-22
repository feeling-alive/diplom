"""Tests for the chat-tools bug fixes (raw function-call leak, crypto ticker
normalisation, bilingual news search, history sanitisation).

Covers:
  * groq_service: leaked `<function=...>` parsing/stripping + history sanitisation
  * _tool_get_asset: bare crypto ticker -> OKX pair normalisation
  * _tool_search_news: bilingual (en+ru) + symbols[] search
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest
from sqlalchemy.ext.asyncio import AsyncSession


# ---------------------------------------------------------------------------
# Helpers: a fake httpx.AsyncClient that replays scripted Groq responses.
# ---------------------------------------------------------------------------


def _install_fake_groq(monkeypatch: pytest.MonkeyPatch, responses: list[dict[str, Any]]) -> dict[str, int]:
    """Patch groq_service.httpx.AsyncClient to return *responses* in order.

    Returns a counter dict whose ``n`` key reflects how many calls were made.
    """
    from app.config import settings
    from app.services import groq_service

    monkeypatch.setattr(settings, "groq_api_key", "test-key")
    calls = {"n": 0}

    class _Resp:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            data = responses[calls["n"]]
            calls["n"] += 1
            return data

    class _Client:
        def __init__(self, *a: Any, **k: Any) -> None: ...
        async def __aenter__(self) -> "_Client": return self
        async def __aexit__(self, *a: Any) -> None: return None
        async def post(self, *a: Any, **k: Any) -> _Resp: return _Resp()

    monkeypatch.setattr(groq_service.httpx, "AsyncClient", _Client)
    return calls


def _msg(content: str | None, tool_calls: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    m: dict[str, Any] = {"role": "assistant", "content": content}
    if tool_calls is not None:
        m["tool_calls"] = tool_calls
    return {"choices": [{"message": m}]}


# ---------------------------------------------------------------------------
# Bug #1/#2: leaked textual function call must never reach the reply
# ---------------------------------------------------------------------------


async def test_leaked_function_call_is_parsed_and_executed(monkeypatch: pytest.MonkeyPatch) -> None:
    """A textual `<function=...>` leak with no structured tool_calls is parsed,
    the tool runs as a fallback, and the model is re-asked for a clean reply."""
    from app.services import groq_service

    # round 0: leaks a textual call; round 1: returns a clean natural answer.
    responses = [
        _msg('Сейчас посмотрю <function=search_news{"query": "btc etf"}>'),
        _msg("Нашёл свежую новость про Bitcoin ETF."),
    ]
    _install_fake_groq(monkeypatch, responses)

    ran: list[tuple[str, dict[str, Any]]] = []

    async def runner(name: str, args: dict[str, Any]) -> tuple[str, dict[str, Any] | None]:
        ran.append((name, args))
        return "Найдена новость", {"type": "news", "title": "ETF", "href": "/news/1"}

    reply, cards = await groq_service.get_groq_response_with_tools(
        "sys", "найди новости про биткоин", None, [{"type": "function"}], runner,
    )

    assert ran == [("search_news", {"query": "btc etf"})]
    assert "<function" not in reply
    assert reply == "Нашёл свежую новость про Bitcoin ETF."
    assert len(cards) == 1 and cards[0]["href"] == "/news/1"


async def test_unparseable_function_leak_is_stripped(monkeypatch: pytest.MonkeyPatch) -> None:
    """A leak we cannot parse (no JSON args) is removed from the reply and the
    tool runner is never invoked."""
    from app.services import groq_service

    responses = [_msg("Извините, <function=foo> не получилось.")]
    _install_fake_groq(monkeypatch, responses)

    ran: list[str] = []

    async def runner(name: str, args: dict[str, Any]) -> tuple[str, dict[str, Any] | None]:
        ran.append(name)
        return "x", None

    reply, cards = await groq_service.get_groq_response_with_tools(
        "sys", "вопрос", None, [{"type": "function"}], runner,
    )

    assert ran == []  # nothing executed
    assert "<function" not in reply
    assert "Извините" in reply and "не получилось" in reply
    assert cards == []


def test_sanitize_history_strips_old_leaks() -> None:
    """Polluted history loaded from the DB must be cleaned before re-sending so
    the model stops copying the broken pattern."""
    from app.services.groq_service import _sanitize_history, _strip_function_syntax

    history = [
        {"role": "user", "content": "цена btc?"},
        {"role": "assistant", "content": 'Вот <function=get_asset{"symbol": "BTC"}> цена.'},
    ]
    cleaned = _sanitize_history(history)
    assert len(cleaned) == 2
    assert "<function" not in cleaned[1]["content"]
    assert cleaned[0]["content"] == "цена btc?"  # untouched
    # tag form is handled too
    assert _strip_function_syntax('a<function=x>{"q":1}</function>b') == "ab"


# ---------------------------------------------------------------------------
# Bug #3: bare crypto ticker normalised to OKX pair before fetching candles
# ---------------------------------------------------------------------------


async def test_get_asset_normalises_bare_crypto_ticker(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.routes import chat as chat_module

    seen: dict[str, str] = {}

    async def fake_candles(symbol: str, tf: str = "1D", limit: int = 2) -> dict[str, Any]:
        seen["symbol"] = symbol
        return {"candles": [{"c": 100.0}, {"c": 110.0}]}

    monkeypatch.setattr(chat_module, "get_candles", fake_candles)
    content, card = await chat_module._tool_get_asset({"symbol": "BTC"})
    assert seen["symbol"] == "BTC-USDT"  # normalised
    assert card["href"] == "/asset/BTC-USDT"


async def test_get_asset_leaves_dashed_and_unknown_symbols(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.routes import chat as chat_module

    seen: list[str] = []

    async def fake_candles(symbol: str, tf: str = "1D", limit: int = 2) -> dict[str, Any]:
        seen.append(symbol)
        return {"candles": []}

    monkeypatch.setattr(chat_module, "get_candles", fake_candles)
    # forex pair already has a separator; unknown stock ticker stays as-is
    await chat_module._tool_get_asset({"symbol": "EUR-USD"})
    await chat_module._tool_get_asset({"symbol": "AAPL"})
    assert seen == ["EUR-USD", "AAPL"]


# ---------------------------------------------------------------------------
# Bug #3 (news): bilingual + symbols search in search_news
# ---------------------------------------------------------------------------


async def test_search_news_matches_russian_title(db_session: AsyncSession) -> None:
    from app.models import NewsArticle
    from app.routes.chat import _tool_search_news

    db_session.add(
        NewsArticle(
            title="Bitcoin hits new high",
            title_ru="Биткоин достиг нового максимума",
            description="en text",
            description_ru="русское описание",
            url="http://news.test/ru",
            source_name="Wire",
            published_at=datetime.now(tz=timezone.utc),
            category="crypto",
        )
    )
    await db_session.commit()

    # Russian query hits title_ru even though the base title is English.
    # (sqlite LIKE only folds ASCII case, so we match the exact Cyrillic case
    # present; real Postgres ILIKE folds Cyrillic too.)
    content, card = await _tool_search_news(db_session, {"query": "Биткоин"})
    assert card is not None
    assert "Биткоин" in content
    # And a description_ru-only term matches too.
    content2, card2 = await _tool_search_news(db_session, {"query": "русское"})
    assert card2 is not None


async def test_search_news_no_match_returns_none(db_session: AsyncSession) -> None:
    from app.routes.chat import _tool_search_news

    content, card = await _tool_search_news(db_session, {"query": "absolutelynothing-xyz"})
    assert card is None
    assert "не найдено" in content
