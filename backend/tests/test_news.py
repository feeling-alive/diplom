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
