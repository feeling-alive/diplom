"""APScheduler-backed news fetcher + OpenRouter AI enrichment (Блок D).

``fetch_and_store_news`` runs every 4 hours and pulls articles from NewsAPI
across four financial query buckets. New articles (deduped by URL) are stored in
``news_articles`` with ``ai_processed=False``, then enriched sequentially by
``_enrich_articles`` which limits concurrency via asyncio.Semaphore(3) and
retries once on HTTP 429 with a 5-second backoff.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import NewsArticle

logger = logging.getLogger("backend.news_fetcher")

# Four NewsAPI query buckets for financial coverage.
_NEWSAPI_BASE = "https://newsapi.org/v2/everything"
_QUERIES = [
    {"q": "finance OR economy OR market", "pageSize": 30},
    {"q": "bitcoin OR ethereum OR crypto", "pageSize": 30},
    {"q": "stocks OR earnings OR S&P500", "pageSize": 30},
    {"q": "forex OR dollar OR euro OR Fed", "pageSize": 30},
]

# Semaphore limits concurrent OpenRouter calls to 3 to avoid free-tier 429s.
_ai_semaphore = asyncio.Semaphore(3)

_AI_PROMPT_TEMPLATE = """Analyze this financial news article and return ONLY valid JSON, no other text:

Title: {title}
Description: {description}

Return this exact JSON structure:
{{
  "title_ru": "translated title in Russian",
  "description_ru": "translated description in Russian",
  "category": "crypto|stocks|forex|general",
  "symbols": ["BTC", "ETH"],
  "keywords": ["ключевое слово 1", "ключевое слово 2"],
  "market_impact": "positive|negative|neutral"
}}

For symbols: only include if explicitly mentioned (BTC, ETH, SOL, AAPL, MSFT, GOOGL, etc.)
For category: crypto if about cryptocurrency, stocks if about equities, forex if about currencies/Fed, general otherwise"""


async def _fetch_bucket(client: httpx.AsyncClient, params: dict) -> list[dict]:
    """Fetch one NewsAPI bucket. Returns article dicts or [] on error."""
    if not settings.news_api_key:
        logger.warning("[news_fetcher] NEWS_API_KEY absent — skipping bucket %s", params.get("q", ""))
        return []
    try:
        resp = await client.get(
            _NEWSAPI_BASE,
            params={**params, "apiKey": settings.news_api_key, "language": "en"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        articles = data.get("articles", [])
        logger.debug("[news_fetcher] bucket q=%s got %d articles", params.get("q"), len(articles))
        return articles
    except Exception as exc:  # noqa: BLE001
        logger.warning("[news_fetcher] bucket fetch error: %s", exc)
        return []


async def fetch_and_store_news() -> None:
    """Fetch all 4 buckets in parallel, deduplicate by URL, persist new articles."""
    logger.info("[news_fetcher] fetch started")
    if not settings.news_api_key:
        logger.warning("[news_fetcher] NEWS_API_KEY not set — aborting fetch")
        return

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[_fetch_bucket(client, q) for q in _QUERIES])

    # Flatten + deduplicate within the batch by URL.
    seen_urls: set[str] = set()
    all_articles: list[dict] = []
    for bucket in results:
        for art in bucket:
            url = art.get("url", "")
            if url and url not in seen_urls and "[Removed]" not in (art.get("title") or ""):
                seen_urls.add(url)
                all_articles.append(art)

    logger.debug("[news_fetcher] deduplicated batch size: %d", len(all_articles))

    inserted: list[uuid.UUID] = []
    async with AsyncSessionLocal() as session:
        async with session.begin():
            for art in all_articles:
                url = art.get("url", "")
                if not url:
                    continue
                # Check DB duplicate.
                exists = await session.scalar(
                    select(NewsArticle.id).where(NewsArticle.url == url)
                )
                if exists:
                    continue
                try:
                    published_raw = art.get("publishedAt") or ""
                    published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
                except ValueError:
                    published_at = datetime.now(tz=timezone.utc)

                article = NewsArticle(
                    title=art.get("title") or "Untitled",
                    description=art.get("description"),
                    content=art.get("content"),
                    url=url,
                    url_to_image=art.get("urlToImage"),
                    source_name=(art.get("source") or {}).get("name", "Unknown"),
                    published_at=published_at,
                    ai_processed=False,
                )
                session.add(article)
                await session.flush()  # get the UUID before commit
                inserted.append(article.id)

    logger.info("[news_fetcher] inserted %d new articles", len(inserted))

    # Enrich articles sequentially via semaphore-bounded concurrency (max 3 parallel
    # OpenRouter calls) with 1-second inter-request delay and retry on 429.
    await _enrich_articles(inserted)


async def _enrich_articles(ids: list[uuid.UUID]) -> None:
    """Enrich a batch of articles through OpenRouter with rate-limit protection."""
    if not ids:
        return

    enriched = 0
    skipped = 0
    lock = asyncio.Lock()

    async def _bounded(article_id: uuid.UUID) -> None:
        nonlocal enriched, skipped
        logger.debug("[news_fetcher] semaphore acquiring for %s", article_id)
        async with _ai_semaphore:
            logger.debug("[news_fetcher] semaphore acquired for %s", article_id)
            success = await process_article_with_ai(article_id)
            async with lock:
                if success:
                    enriched += 1
                else:
                    skipped += 1
            # 1-second throttle between OpenRouter calls within the semaphore slot.
            await asyncio.sleep(1)

    await asyncio.gather(*[_bounded(aid) for aid in ids])
    logger.info(
        "[news_fetcher] enrichment done: enriched=%d skipped=%d total=%d",
        enriched,
        skipped,
        len(ids),
    )


async def process_article_with_ai(article_id: uuid.UUID) -> bool:
    """Call OpenRouter to translate + categorize one article, then update DB.

    Returns True on success, False if the article was skipped (no API key, 429 after
    retries, parse error, or network error). In all failure cases the article is marked
    ai_processed=True to prevent indefinite retries on the next fetch cycle.
    """
    logger.debug("[news_fetcher] ai processing article %s", article_id)

    if not settings.openrouter_api_key:
        logger.warning("[news_fetcher] OPENROUTER_API_KEY absent — skipping AI for %s", article_id)
        await _mark_processed(article_id)
        return False

    async with AsyncSessionLocal() as session:
        article = await session.get(NewsArticle, article_id)
        if article is None:
            logger.warning("[news_fetcher] article %s not found", article_id)
            return False

        prompt = _AI_PROMPT_TEMPLATE.format(
            title=article.title,
            description=article.description or "",
        )

    # Retry up to 2 times on HTTP 429 with 5-second backoff.
    max_retries = 2
    for attempt in range(1, max_retries + 2):  # attempts: 1, 2, 3 (initial + 2 retries)
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{settings.openrouter_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.openrouter_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                    },
                    timeout=30,
                )

            if resp.status_code == 429:
                if attempt <= max_retries:
                    logger.warning(
                        "[news_fetcher] 429 rate limit for %s, retry %d/%d in 5s",
                        article_id,
                        attempt,
                        max_retries,
                    )
                    await asyncio.sleep(5)
                    continue
                # Exhausted retries — save without AI enrichment.
                logger.warning(
                    "[news_fetcher] 429 exhausted retries for %s — saving without AI",
                    article_id,
                )
                await _mark_processed(article_id)
                return False

            resp.raise_for_status()
            raw = resp.json()
            content = raw["choices"][0]["message"]["content"]

            # Strip markdown code fences if the model wrapped the JSON.
            content = re.sub(r"^```(?:json)?\s*", "", content.strip())
            content = re.sub(r"\s*```$", "", content)
            data = json.loads(content)

            async with AsyncSessionLocal() as session:
                async with session.begin():
                    article = await session.get(NewsArticle, article_id)
                    if article is None:
                        return False
                    article.title_ru = data.get("title_ru")
                    article.description_ru = data.get("description_ru")
                    article.category = data.get("category", "general")
                    article.symbols = data.get("symbols", [])
                    article.keywords = data.get("keywords", [])
                    article.market_impact = data.get("market_impact")
                    article.ai_processed = True

            logger.debug("[news_fetcher] ai done for %s category=%s", article_id, data.get("category"))
            return True

        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            logger.warning("[news_fetcher] ai parse error for %s: %s", article_id, exc)
            await _mark_processed(article_id)
            return False
        except Exception as exc:  # noqa: BLE001
            logger.warning("[news_fetcher] ai request error for %s: %s", article_id, exc)
            await _mark_processed(article_id)
            return False

    # Should not reach here, but satisfy the type checker.
    await _mark_processed(article_id)
    return False


async def _mark_processed(article_id: uuid.UUID) -> None:
    """Mark article as processed to prevent retrying failed AI enrichment."""
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                article = await session.get(NewsArticle, article_id)
                if article:
                    article.ai_processed = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[news_fetcher] _mark_processed error: %s", exc)
