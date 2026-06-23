"""APScheduler-backed news fetcher + AI enrichment (Блок D).

``fetch_and_store_news`` runs every 4 hours and pulls articles from NewsAPI
across four financial query buckets. New articles (deduped by URL) are stored in
``news_articles`` with ``ai_processed=False``, then enriched sequentially by
``_enrich_articles`` which limits concurrency via asyncio.Semaphore(3) and
retries once on HTTP 429 with a 5-second backoff.

Enrichment (translate + categorize) tries **OpenRouter first, then Groq** as a
fallback (bug #5): OpenRouter's free tier was unreachable in practice, leaving
English titles and no market-impact badges, while the Groq key already powers the
chat. Both providers speak the OpenAI chat-completions shape.
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
from app.services.api_keys import get_api_key

logger = logging.getLogger("backend.news_fetcher")

# Four NewsAPI query buckets for financial coverage.
_NEWSAPI_BASE = "https://newsapi.org/v2/everything"
_QUERIES = [
    {"q": "finance OR economy OR market", "pageSize": 30},
    {"q": "bitcoin OR ethereum OR crypto", "pageSize": 30},
    {"q": "stocks OR earnings OR S&P500", "pageSize": 30},
    {"q": "forex OR dollar OR euro OR Fed", "pageSize": 30},
]

# Semaphore limits concurrent enrichment calls to 2 to avoid free-tier 429 bursts
# (lowered from 3 — combined with the per-slot throttle and provider 429 retries).
_ai_semaphore = asyncio.Semaphore(2)

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


async def _fetch_bucket(client: httpx.AsyncClient, params: dict, news_key: str) -> list[dict]:
    """Fetch one NewsAPI bucket. Returns article dicts or [] on error."""
    if not news_key:
        logger.warning("[news_fetcher] no NewsAPI key (panel/.env) — skipping bucket %s", params.get("q", ""))
        return []
    try:
        resp = await client.get(
            _NEWSAPI_BASE,
            params={**params, "apiKey": news_key, "language": "en"},
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
    news_key = await get_api_key("newsapi")
    if not news_key:
        logger.warning("[news_fetcher] no NewsAPI key (panel/.env) — aborting fetch")
        return

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[_fetch_bucket(client, q, news_key) for q in _QUERIES])

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

    # Enrich the freshly-inserted articles, then pick up a tail batch of older
    # articles that are still untranslated (transient failures from earlier cycles)
    # and not yet over the attempt cap.
    await _enrich_articles(inserted)

    async with AsyncSessionLocal() as session:
        tail_rows = await session.execute(
            select(NewsArticle.id)
            .where(
                NewsArticle.title_ru.is_(None),
                NewsArticle.enrich_attempts < settings.enrich_max_attempts,
            )
            .order_by(NewsArticle.published_at.desc())
            .limit(settings.enrich_tail_batch)
        )
        tail_ids = [row[0] for row in tail_rows.all() if row[0] not in set(inserted)]

    if tail_ids:
        logger.info("[news_fetcher] backfilling %d untranslated tail articles", len(tail_ids))
        await _enrich_articles(tail_ids)


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


_GROQ_ENRICH_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_ENRICH_MODEL = "llama-3.3-70b-versatile"


def _parse_enrichment(content: str) -> dict:
    """Parse the model's JSON reply, tolerating ```json code fences."""
    content = re.sub(r"^```(?:json)?\s*", "", content.strip())
    content = re.sub(r"\s*```$", "", content)
    return json.loads(content)


def _retry_after_seconds(resp: "httpx.Response", default: float = 5.0) -> float:
    """Extract the server-requested wait before retrying a 429.

    Prefers the standard ``Retry-After`` header, then OpenRouter's JSON
    ``error.metadata.retry_after_seconds``; clamps to a sane [1, 30] range and
    falls back to *default* when neither is present.
    """
    raw = resp.headers.get("Retry-After")
    if raw:
        try:
            return max(1.0, min(30.0, float(raw)))
        except ValueError:
            pass
    try:
        meta = resp.json().get("error", {}).get("metadata", {})
        val = meta.get("retry_after_seconds") or meta.get("retry_after_seconds_raw")
        if val is not None:
            return max(1.0, min(30.0, float(val)))
    except Exception:  # noqa: BLE001 — body may not be JSON
        pass
    return default


async def _openrouter_complete(prompt: str) -> str | None:
    """Enrichment completion via OpenRouter. Returns content, or None when the key
    is absent / rate-limited / failing so the caller can fall back to Groq."""
    openrouter_key = await get_api_key("openrouter")
    if not openrouter_key:
        return None

    max_retries = 2
    for attempt in range(1, max_retries + 2):  # attempts: 1, 2, 3 (initial + 2 retries)
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{settings.openrouter_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
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
                    # Respect the server's Retry-After (header or JSON metadata)
                    # instead of a fixed 5s — free models often ask for a few seconds.
                    delay = _retry_after_seconds(resp, default=5.0)
                    logger.warning(
                        "[news_fetcher] openrouter 429, retry %d/%d in %.1fs",
                        attempt, max_retries, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.warning("[news_fetcher] openrouter 429 exhausted — falling back")
                return None
            if resp.status_code >= 400:
                # Surface the real reason (invalid key, bad model id, etc.) instead
                # of swallowing it — previously this hid 401s and made it look like
                # OpenRouter "was never called".
                logger.warning(
                    "[news_fetcher] openrouter HTTP %s: %s",
                    resp.status_code, resp.text[:300],
                )
                return None
            content = resp.json()["choices"][0]["message"]["content"]
            logger.info(
                "[news_fetcher] openrouter OK (model=%s, len=%d)",
                settings.openrouter_model, len(content),
            )
            return content
        except Exception as exc:  # noqa: BLE001 — any failure means "try the fallback"
            logger.warning("[news_fetcher] openrouter error: %s: %s", type(exc).__name__, exc)
            return None
    return None


async def _groq_complete(prompt: str) -> str | None:
    """Enrichment completion via Groq (fallback). Returns content or None on failure.

    Uses JSON response_format so the reply is guaranteed-parseable JSON."""
    groq_key = await get_api_key("groq")
    if not groq_key:
        return None

    max_retries = 2
    for attempt in range(1, max_retries + 2):  # attempts: 1, 2, 3 (initial + 2 retries)
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    _GROQ_ENRICH_URL,
                    headers={
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": _GROQ_ENRICH_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                        "response_format": {"type": "json_object"},
                    },
                )
            # Mirror OpenRouter's 429 handling: back off and retry before giving up.
            if resp.status_code == 429:
                if attempt <= max_retries:
                    logger.warning("[news_fetcher] groq 429, retry %d/%d in 5s", attempt, max_retries)
                    await asyncio.sleep(5)
                    continue
                logger.warning("[news_fetcher] groq 429 exhausted — giving up")
                return None
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001
            logger.warning("[news_fetcher] groq enrichment error: %s", exc)
            return None
    return None


async def _polza_complete(prompt: str) -> str | None:
    """Enrichment completion via Polza AI (third fallback after OpenRouter→Groq).

    Polza is an OpenAI-compatible API (POST /chat/completions, ``Authorization:
    Bearer``, model as ``provider/model``), so the request/response shape mirrors
    :func:`_groq_complete`. Returns content or None on failure. NB: Polza is paid —
    not exercised by tests; only wired into the chain.
    """
    polza_key = await get_api_key("polza")
    if not polza_key:
        return None

    max_retries = 2
    for attempt in range(1, max_retries + 2):  # attempts: 1, 2, 3 (initial + 2 retries)
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{settings.polza_base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {polza_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": settings.polza_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                        "response_format": {"type": "json_object"},
                    },
                )
            if resp.status_code == 429:
                if attempt <= max_retries:
                    delay = _retry_after_seconds(resp, default=5.0)
                    logger.warning(
                        "[news_fetcher] polza 429, retry %d/%d in %.1fs",
                        attempt, max_retries, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.warning("[news_fetcher] polza 429 exhausted — giving up")
                return None
            if resp.status_code >= 400:
                logger.warning(
                    "[news_fetcher] polza HTTP %s: %s", resp.status_code, resp.text[:300],
                )
                return None
            content = resp.json()["choices"][0]["message"]["content"]
            logger.info("[news_fetcher] polza OK (model=%s, len=%d)", settings.polza_model, len(content))
            return content
        except Exception as exc:  # noqa: BLE001 — any failure means "no third fallback"
            logger.warning("[news_fetcher] polza error: %s: %s", type(exc).__name__, exc)
            return None
    return None


async def _enrich_complete(prompt: str) -> str | None:
    """OpenRouter → Groq → Polza. Returns raw model content or None if all fail."""
    content = await _openrouter_complete(prompt)
    if content is not None:
        return content
    logger.info("[news_fetcher] OpenRouter unavailable — falling back to Groq")
    content = await _groq_complete(prompt)
    if content is not None:
        return content
    logger.info("[news_fetcher] Groq unavailable — falling back to Polza")
    return await _polza_complete(prompt)


async def process_article_with_ai(article_id: uuid.UUID) -> bool:
    """Translate + categorize one article via OpenRouter→Groq, then update DB.

    Returns True on success, False otherwise. Failure handling distinguishes
    *transient* from *permanent* failures:

    * **Provider failure** (both providers returned None — outage / rate-limit):
      increment ``enrich_attempts`` and leave ``ai_processed=False`` so the next
      pass retries — until ``settings.enrich_max_attempts`` is reached, after which
      the article is flagged processed to stop an infinite retry loop.
    * **No keys at all** / **parse error** (malformed JSON): flag ``ai_processed``
      immediately — retrying cannot help.
    """
    logger.debug("[news_fetcher] ai processing article %s", article_id)

    if (
        not await get_api_key("openrouter")
        and not await get_api_key("groq")
        and not await get_api_key("polza")
    ):
        logger.warning(
            "[news_fetcher] no enrichment key (openrouter/groq/polza, panel/.env) — skipping %s",
            article_id,
        )
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

    content = await _enrich_complete(prompt)
    if content is None:
        # Transient: bump attempts and retry next pass (give up only after the cap).
        attempts = await _bump_attempts(article_id)
        if attempts >= settings.enrich_max_attempts:
            logger.warning(
                "[news_fetcher] enrichment failed for %s (both providers), attempts=%d >= %d — giving up",
                article_id, attempts, settings.enrich_max_attempts,
            )
            await _mark_processed(article_id)
        else:
            logger.warning(
                "[news_fetcher] enrichment failed for %s (both providers), attempts=%d — will retry",
                article_id, attempts,
            )
        return False

    try:
        data = _parse_enrichment(content)
    except (json.JSONDecodeError, KeyError, ValueError) as exc:
        logger.warning("[news_fetcher] ai parse error for %s: %s — flagging processed", article_id, exc)
        await _mark_processed(article_id)
        return False

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


async def reenrich_unprocessed(limit: int = 200) -> dict[str, int]:
    """Re-run enrichment for articles that still lack a Russian translation.

    Targets ``title_ru IS NULL`` rather than ``ai_processed=False`` because failed
    articles are flagged processed to avoid retry loops — so a provider outage (or a
    missing key, now fixed by the Groq fallback) leaves them processed-but-raw. This
    lets an admin backfill the existing raw articles after the fallback is in place.
    Articles that already exhausted ``enrich_max_attempts`` are excluded so a
    permanently-failing item is not retried forever.
    """
    async with AsyncSessionLocal() as session:
        rows = await session.execute(
            select(NewsArticle.id)
            .where(
                NewsArticle.title_ru.is_(None),
                NewsArticle.enrich_attempts < settings.enrich_max_attempts,
            )
            .limit(limit)
        )
        ids = [row[0] for row in rows.all()]

    logger.info("[news_fetcher] reenrich: %d articles missing title_ru (attempts<%d)",
                len(ids), settings.enrich_max_attempts)
    await _enrich_articles(ids)
    return {"requested": len(ids)}


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


async def _bump_attempts(article_id: uuid.UUID) -> int:
    """Increment ``enrich_attempts`` for an article; return the new count (0 on error)."""
    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                article = await session.get(NewsArticle, article_id)
                if article is None:
                    return 0
                article.enrich_attempts = (article.enrich_attempts or 0) + 1
                count = article.enrich_attempts
        logger.debug("[news_fetcher] enrich_attempts for %s -> %d", article_id, count)
        return count
    except Exception as exc:  # noqa: BLE001
        logger.warning("[news_fetcher] _bump_attempts error: %s", exc)
        return 0
