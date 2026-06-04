"""News API routes (prefix ``/api/news``, Блок D).

Endpoints:
  GET  /api/news              — paginated feed (Redis cache 300 s)
  GET  /api/news/favorites    — current user's favorites
  GET  /api/news/{id}         — single article with counts
  GET  /api/news/{id}/comments
  POST /api/news/{id}/comments
  DELETE /api/news/comments/{comment_id}
  POST /api/news/{id}/react   — like/dislike toggle
  POST /api/news/{id}/favorite — toggle favorite

Comment rows live in the existing ``comments`` table keyed by ``article_url``
(unchanged schema from previous blocks).
"""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_optional_user
from app.database import get_db
from app.models import Comment, NewsArticle, NewsFavorite, NewsReaction, User
from app.services.cache import get_cached, set_cached

logger = logging.getLogger("backend.news")
router = APIRouter(prefix="/api/news", tags=["news"])

NEWS_CACHE_TTL = 300  # seconds


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ArticleSummary(BaseModel):
    id: uuid.UUID
    title: str
    title_ru: str | None
    description: str | None
    description_ru: str | None
    url: str
    url_to_image: str | None
    source_name: str
    published_at: str
    category: str
    symbols: list | None
    keywords: list | None
    market_impact: str | None
    ai_processed: bool
    likes_count: int = 0
    dislikes_count: int = 0
    comments_count: int = 0
    is_favorited: bool = False
    user_reaction: str | None = None

    model_config = {"from_attributes": True}


class FeedResponse(BaseModel):
    articles: list[ArticleSummary]
    total: int
    page: int
    has_more: bool


class CommentOut(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str | None
    text: str
    created_at: str


class CommentIn(BaseModel):
    text: str = Field(..., min_length=3, max_length=1000)


class ReactionIn(BaseModel):
    type: str  # like | dislike


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cache_key(params: dict) -> str:
    raw = json.dumps(params, sort_keys=True)
    return f"news:list:{hashlib.md5(raw.encode()).hexdigest()}"


async def _article_counts(session: AsyncSession, article_id: uuid.UUID) -> dict[str, int]:
    likes = await session.scalar(
        select(func.count()).where(
            NewsReaction.article_id == article_id, NewsReaction.reaction_type == "like"
        )
    )
    dislikes = await session.scalar(
        select(func.count()).where(
            NewsReaction.article_id == article_id, NewsReaction.reaction_type == "dislike"
        )
    )
    return {"likes_count": likes or 0, "dislikes_count": dislikes or 0}


async def _user_meta(
    session: AsyncSession, article_id: uuid.UUID, user_id: uuid.UUID
) -> dict[str, Any]:
    reaction = await session.scalar(
        select(NewsReaction.reaction_type).where(
            NewsReaction.article_id == article_id, NewsReaction.user_id == user_id
        )
    )
    fav = await session.scalar(
        select(NewsFavorite.id).where(
            NewsFavorite.article_id == article_id, NewsFavorite.user_id == user_id
        )
    )
    return {"user_reaction": reaction, "is_favorited": fav is not None}


async def _build_summary(
    session: AsyncSession,
    article: NewsArticle,
    user: User | None = None,
) -> dict[str, Any]:
    counts = await _article_counts(session, article.id)
    comments_count = await session.scalar(
        select(func.count()).where(Comment.article_url == article.url)
    )
    meta = {}
    if user:
        meta = await _user_meta(session, article.id, user.id)
    return {
        "id": str(article.id),
        "title": article.title,
        "title_ru": article.title_ru,
        "description": article.description,
        "description_ru": article.description_ru,
        "url": article.url,
        "url_to_image": article.url_to_image,
        "source_name": article.source_name,
        "published_at": article.published_at.isoformat(),
        "category": article.category,
        "symbols": article.symbols,
        "keywords": article.keywords,
        "market_impact": article.market_impact,
        "ai_processed": article.ai_processed,
        "comments_count": comments_count or 0,
        **counts,
        **meta,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("", response_model=FeedResponse)
async def get_news(
    query: str | None = Query(None),
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> FeedResponse:
    logger.debug("[news] GET /api/news page=%d category=%s query=%s", page, category, query)

    cache_key = _cache_key({"query": query, "category": category, "page": page, "limit": limit})
    cached = await get_cached(cache_key)
    if cached and not user:
        # Cache hit only for anonymous requests (user-specific fields would be wrong).
        return FeedResponse(**cached)

    stmt = select(NewsArticle).order_by(NewsArticle.published_at.desc())
    if category and category != "all":
        stmt = stmt.where(NewsArticle.category == category)
    if query:
        q = f"%{query}%"
        from sqlalchemy import or_
        stmt = stmt.where(
            or_(NewsArticle.title.ilike(q), NewsArticle.description.ilike(q),
                NewsArticle.title_ru.ilike(q))
        )

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = await session.scalars(stmt.offset((page - 1) * limit).limit(limit))
    articles_rows = list(rows)

    articles = [await _build_summary(session, a, user) for a in articles_rows]

    result: dict[str, Any] = {
        "articles": articles,
        "total": total or 0,
        "page": page,
        "has_more": (page * limit) < (total or 0),
    }

    if not user:
        await set_cached(cache_key, result, ttl=NEWS_CACHE_TTL)

    return FeedResponse(**result)


@router.get("/favorites", response_model=FeedResponse)
async def get_favorites(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FeedResponse:
    logger.debug("[news] GET /api/news/favorites user=%s", user.id)
    rows = await session.scalars(
        select(NewsArticle)
        .join(NewsFavorite, NewsFavorite.article_id == NewsArticle.id)
        .where(NewsFavorite.user_id == user.id)
        .order_by(NewsFavorite.created_at.desc())
    )
    articles_rows = list(rows)
    articles = [await _build_summary(session, a, user) for a in articles_rows]
    return FeedResponse(articles=articles, total=len(articles), page=1, has_more=False)


@router.get("/{article_id}", response_model=ArticleSummary)
async def get_article(
    article_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
) -> ArticleSummary:
    article = await session.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    data = await _build_summary(session, article, user)
    return ArticleSummary(**data)


@router.get("/{article_id}/comments", response_model=list[CommentOut])
async def get_comments(
    article_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
) -> list[CommentOut]:
    article = await session.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    rows = await session.scalars(
        select(Comment).where(Comment.article_url == article.url).order_by(Comment.created_at.desc())
    )
    result = []
    for c in rows:
        author = await session.get(User, c.user_id)
        result.append(CommentOut(
            id=c.id,
            username=author.username if author else "unknown",
            avatar_url=author.avatar_url if author else None,
            text=c.text,
            created_at=c.created_at.isoformat(),
        ))
    return result


@router.post("/{article_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    article_id: uuid.UUID,
    body: CommentIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CommentOut:
    article = await session.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    comment = Comment(user_id=user.id, article_url=article.url, text=body.text)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    logger.debug("[news] comment added article=%s user=%s", article_id, user.id)
    return CommentOut(
        id=comment.id,
        username=user.username,
        avatar_url=user.avatar_url,
        text=comment.text,
        created_at=comment.created_at.isoformat(),
    )


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    comment = await session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id and user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    await session.delete(comment)
    await session.commit()
    logger.debug("[news] comment deleted %s by user=%s", comment_id, user.id)


@router.post("/{article_id}/react", status_code=200)
async def react_to_article(
    article_id: uuid.UUID,
    body: ReactionIn,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    if body.type not in ("like", "dislike"):
        raise HTTPException(status_code=422, detail="type must be 'like' or 'dislike'")
    article = await session.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    existing = await session.scalar(
        select(NewsReaction).where(
            NewsReaction.article_id == article_id, NewsReaction.user_id == user.id
        )
    )
    if existing:
        if existing.reaction_type == body.type:
            await session.delete(existing)
            action = "removed"
        else:
            existing.reaction_type = body.type
            action = "updated"
    else:
        session.add(NewsReaction(user_id=user.id, article_id=article_id, reaction_type=body.type))
        action = "added"

    await session.commit()
    logger.info("[news] reaction %s %s article=%s user=%s", body.type, action, article_id, user.id)
    return {"status": action}


@router.post("/{article_id}/favorite", status_code=200)
async def toggle_favorite(
    article_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    article = await session.get(NewsArticle, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    existing = await session.scalar(
        select(NewsFavorite).where(
            NewsFavorite.article_id == article_id, NewsFavorite.user_id == user.id
        )
    )
    if existing:
        await session.delete(existing)
        action = "removed"
    else:
        session.add(NewsFavorite(user_id=user.id, article_id=article_id))
        action = "added"

    await session.commit()
    logger.info("[news] favorite %s article=%s user=%s", action, article_id, user.id)
    return {"status": action}
