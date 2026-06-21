"""News API tests (Блок D): /api/news routes.

Tests cover: feed pagination, single article, reaction toggle, favorite toggle,
comment validation. APScheduler and the AI fetcher are never started — they
depend on external API keys and are not relevant to route correctness.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import NewsArticle

USER_NEWS = {"email": "newsuser@example.com", "username": "newsuser", "password": "secret123"}


def _make_article(**kwargs) -> dict:
    """Default NewsArticle field dict, overridable via kwargs."""
    return {
        "title": kwargs.get("title", "Test headline"),
        "url": kwargs.get("url", f"https://example.com/{uuid.uuid4()}"),
        "source_name": "TestSource",
        "published_at": datetime.now(tz=timezone.utc),
        "category": kwargs.get("category", "general"),
    }


@pytest.fixture
async def article(db_session: AsyncSession) -> NewsArticle:
    """Insert one NewsArticle and return it."""
    art = NewsArticle(**_make_article())
    db_session.add(art)
    await db_session.commit()
    await db_session.refresh(art)
    return art


# ---------------------------------------------------------------------------
# Feed
# ---------------------------------------------------------------------------


async def test_get_news_returns_feed(client: AsyncClient, article: NewsArticle) -> None:
    resp = await client.get("/api/news")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "articles" in data
    assert "total" in data
    assert "page" in data
    assert "has_more" in data
    assert data["total"] >= 1


async def test_get_news_category_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    art = NewsArticle(**_make_article(category="crypto", url=f"https://example.com/{uuid.uuid4()}"))
    db_session.add(art)
    await db_session.commit()

    resp = await client.get("/api/news", params={"category": "crypto"})
    assert resp.status_code == 200
    for a in resp.json()["articles"]:
        assert a["category"] == "crypto"


async def test_get_news_symbol_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    """The symbol filter matches the base ticker inside the symbols[] JSON array (bug #5)."""
    btc = NewsArticle(**_make_article(title="BTC rally", url=f"https://example.com/{uuid.uuid4()}"))
    btc.symbols = ["BTC", "ETH"]
    aapl = NewsArticle(**_make_article(title="Apple earnings", url=f"https://example.com/{uuid.uuid4()}"))
    aapl.symbols = ["AAPL"]
    db_session.add_all([btc, aapl])
    await db_session.commit()

    resp = await client.get("/api/news", params={"symbol": "BTC"})
    assert resp.status_code == 200
    titles = [a["title"] for a in resp.json()["articles"]]
    assert "BTC rally" in titles
    assert "Apple earnings" not in titles

    # Case-insensitive and works for stocks too.
    resp2 = await client.get("/api/news", params={"symbol": "aapl"})
    titles2 = [a["title"] for a in resp2.json()["articles"]]
    assert titles2 == ["Apple earnings"]


# ---------------------------------------------------------------------------
# Single article
# ---------------------------------------------------------------------------


async def test_get_article_200(client: AsyncClient, article: NewsArticle) -> None:
    resp = await client.get(f"/api/news/{article.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(article.id)


async def test_get_article_404(client: AsyncClient) -> None:
    resp = await client.get(f"/api/news/{uuid.uuid4()}")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Reactions
# ---------------------------------------------------------------------------


async def test_react_401_without_auth(client: AsyncClient, article: NewsArticle) -> None:
    resp = await client.post(f"/api/news/{article.id}/react", json={"type": "like"})
    assert resp.status_code == 401


async def test_react_toggle(client: AsyncClient, article: NewsArticle) -> None:
    await client.post("/auth/register", json=USER_NEWS)

    # Add like
    r1 = await client.post(f"/api/news/{article.id}/react", json={"type": "like"})
    assert r1.status_code == 200
    assert r1.json()["status"] == "added"

    # Toggle off (same type)
    r2 = await client.post(f"/api/news/{article.id}/react", json={"type": "like"})
    assert r2.json()["status"] == "removed"

    # Switch to dislike
    await client.post(f"/api/news/{article.id}/react", json={"type": "like"})
    r3 = await client.post(f"/api/news/{article.id}/react", json={"type": "dislike"})
    assert r3.json()["status"] == "updated"


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


async def test_favorite_401_without_auth(client: AsyncClient, article: NewsArticle) -> None:
    resp = await client.post(f"/api/news/{article.id}/favorite")
    assert resp.status_code == 401


async def test_favorite_toggle(client: AsyncClient, article: NewsArticle) -> None:
    await client.post("/auth/register", json=USER_NEWS)

    r1 = await client.post(f"/api/news/{article.id}/favorite")
    assert r1.json()["status"] == "added"

    r2 = await client.post(f"/api/news/{article.id}/favorite")
    assert r2.json()["status"] == "removed"


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------


async def test_comment_401_without_auth(client: AsyncClient, article: NewsArticle) -> None:
    resp = await client.post(f"/api/news/{article.id}/comments", json={"text": "hello"})
    assert resp.status_code == 401


async def test_comment_min_length(client: AsyncClient, article: NewsArticle) -> None:
    await client.post("/auth/register", json=USER_NEWS)
    resp = await client.post(f"/api/news/{article.id}/comments", json={"text": "ab"})
    assert resp.status_code == 422


async def test_comment_add_and_list(client: AsyncClient, article: NewsArticle) -> None:
    await client.post("/auth/register", json=USER_NEWS)
    await client.post(f"/api/news/{article.id}/comments", json={"text": "Great article!"})
    resp = await client.get(f"/api/news/{article.id}/comments")
    assert resp.status_code == 200
    comments = resp.json()
    assert any(c["text"] == "Great article!" for c in comments)


# ---------------------------------------------------------------------------
# Comment reactions: per-user like/dislike toggle (bug #9)
# ---------------------------------------------------------------------------


async def _add_comment(client: AsyncClient, article: NewsArticle, text: str = "hi there") -> str:
    resp = await client.post(f"/api/news/{article.id}/comments", json={"text": text})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def test_comment_react_requires_auth(client: AsyncClient, article: NewsArticle) -> None:
    # Create a comment as an authed user, then drop auth.
    await client.post("/auth/register", json=USER_NEWS)
    cid = await _add_comment(client, article)
    client.cookies.clear()
    resp = await client.post(f"/api/news/comments/{cid}/react", json={"type": "like"})
    assert resp.status_code == 401


async def test_comment_react_toggle_and_switch(client: AsyncClient, article: NewsArticle) -> None:
    await client.post("/auth/register", json=USER_NEWS)
    cid = await _add_comment(client, article)

    # Add like
    r1 = await client.post(f"/api/news/comments/{cid}/react", json={"type": "like"})
    assert r1.status_code == 200, r1.text
    b1 = r1.json()
    assert b1["status"] == "added"
    assert b1["likes_count"] == 1 and b1["dislikes_count"] == 0
    assert b1["user_reaction"] == "like"

    # Same type again toggles off (no infinite counter — the bug being fixed)
    r2 = await client.post(f"/api/news/comments/{cid}/react", json={"type": "like"})
    assert r2.json()["status"] == "removed"
    assert r2.json()["likes_count"] == 0
    assert r2.json()["user_reaction"] is None

    # Switch like -> dislike
    await client.post(f"/api/news/comments/{cid}/react", json={"type": "like"})
    r3 = await client.post(f"/api/news/comments/{cid}/react", json={"type": "dislike"})
    b3 = r3.json()
    assert b3["status"] == "updated"
    assert b3["likes_count"] == 0 and b3["dislikes_count"] == 1
    assert b3["user_reaction"] == "dislike"


async def test_comment_react_invalid_type(client: AsyncClient, article: NewsArticle) -> None:
    await client.post("/auth/register", json=USER_NEWS)
    cid = await _add_comment(client, article)
    resp = await client.post(f"/api/news/comments/{cid}/react", json={"type": "love"})
    assert resp.status_code == 422


async def test_comment_react_reflected_in_list(client: AsyncClient, article: NewsArticle) -> None:
    await client.post("/auth/register", json=USER_NEWS)
    cid = await _add_comment(client, article)
    await client.post(f"/api/news/comments/{cid}/react", json={"type": "like"})

    resp = await client.get(f"/api/news/{article.id}/comments")
    assert resp.status_code == 200
    target = next(c for c in resp.json() if c["id"] == cid)
    assert target["likes_count"] == 1
    assert target["user_reaction"] == "like"


# ---------------------------------------------------------------------------
# AI enrichment: OpenRouter -> Groq fallback (bug #5)
# ---------------------------------------------------------------------------


def test_parse_enrichment_strips_code_fences() -> None:
    from app.services.news_fetcher import _parse_enrichment

    fenced = '```json\n{"title_ru": "Привет", "category": "crypto"}\n```'
    data = _parse_enrichment(fenced)
    assert data["title_ru"] == "Привет"
    assert data["category"] == "crypto"


async def test_enrich_complete_prefers_openrouter(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import news_fetcher

    async def fake_or(prompt: str) -> str:
        return '{"from": "openrouter"}'

    async def fake_groq(prompt: str) -> str:
        raise AssertionError("Groq must not be called when OpenRouter succeeds")

    monkeypatch.setattr(news_fetcher, "_openrouter_complete", fake_or)
    monkeypatch.setattr(news_fetcher, "_groq_complete", fake_groq)
    result = await news_fetcher._enrich_complete("prompt")
    assert result == '{"from": "openrouter"}'


async def test_enrich_complete_falls_back_to_groq(monkeypatch: pytest.MonkeyPatch) -> None:
    """When OpenRouter is unavailable (returns None), Groq is used (bug #5)."""
    from app.services import news_fetcher

    async def fake_or(prompt: str) -> None:
        return None

    async def fake_groq(prompt: str) -> str:
        return '{"from": "groq"}'

    monkeypatch.setattr(news_fetcher, "_openrouter_complete", fake_or)
    monkeypatch.setattr(news_fetcher, "_groq_complete", fake_groq)
    result = await news_fetcher._enrich_complete("prompt")
    assert result == '{"from": "groq"}'


async def test_enrich_complete_none_when_both_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import news_fetcher

    async def fake_none(prompt: str) -> None:
        return None

    monkeypatch.setattr(news_fetcher, "_openrouter_complete", fake_none)
    monkeypatch.setattr(news_fetcher, "_groq_complete", fake_none)
    assert await news_fetcher._enrich_complete("prompt") is None
