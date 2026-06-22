"""Global search endpoint (GET /api/search?q=...).

Returns up to 5 matching assets and 5 matching news articles grouped by type.
Assets are loaded from the shared prices.json snapshot; news is queried via
ILIKE on title/description from the database.
"""

from __future__ import annotations

import asyncio
import json
import logging
from functools import lru_cache
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import NewsArticle
from app.services import finnhub, frankfurter, okx

logger = logging.getLogger("backend.search")
router = APIRouter(prefix="/api/search", tags=["search"])

_PRICES_PATH = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "src" / "data" / "prices.json"
_ASSET_LIMIT = 5
_NEWS_LIMIT = 5


class AssetResult(BaseModel):
    symbol: str
    name: str
    type: str
    price: float | None = None


class NewsResult(BaseModel):
    id: str
    title: str
    title_ru: str | None = None
    published_at: str
    category: str | None = None


class SearchResponse(BaseModel):
    assets: list[AssetResult]
    news: list[NewsResult]


@lru_cache(maxsize=1)
def _load_assets() -> list[dict]:
    """Load assets from the frontend prices.json snapshot (cached for process lifetime)."""
    try:
        data = json.loads(_PRICES_PATH.read_text(encoding="utf-8"))
        logger.info("[search] loaded %d assets from prices.json", len(data))
        return data
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("[search] failed to load prices.json: %s", err)
        return []


def _search_assets(q: str) -> list[AssetResult]:
    q_lower = q.lower()
    results: list[AssetResult] = []
    for asset in _load_assets():
        symbol: str = asset.get("symbol", "")
        name: str = asset.get("name", "")
        if q_lower in symbol.lower() or q_lower in name.lower():
            results.append(
                AssetResult(
                    symbol=symbol,
                    name=name,
                    type=asset.get("type", ""),
                    price=asset.get("price"),
                )
            )
        if len(results) >= _ASSET_LIMIT:
            break
    return results


async def _live_price(asset: AssetResult) -> float | None:
    """Fetch the current price for one matched asset via the quotes layer.

    Routes by asset type to the existing Redis-cached services:
      - crypto -> OKX (instId like ``BTC-USDT``)
      - stock  -> Finnhub
      - forex  -> Frankfurter (``EUR-USD`` -> base EUR, quote USD)

    Returns the live price, or ``None`` when it cannot be fetched (caller keeps
    the snapshot price). Never raises — transport/lookup errors are swallowed.
    Note: Frankfurter is fiat-only, so metals like ``XAU-USD``/``XAG-USD`` raise
    ``LookupError`` and gracefully fall back to the snapshot (expected).
    """
    symbol = asset.symbol
    try:
        if asset.type == "crypto":
            data = await okx.get_ticker(symbol)
        elif asset.type == "stock":
            data = await finnhub.get_quote(symbol)
        elif asset.type == "forex":
            base, _, quote = symbol.partition("-")
            if not base or not quote:
                logger.debug("[search] malformed forex symbol %s — keeping snapshot", symbol)
                return None
            data = await frankfurter.get_rate(base, quote)
        else:
            logger.debug("[search] unknown asset type %r for %s — keeping snapshot", asset.type, symbol)
            return None
    except (httpx.HTTPError, LookupError) as err:
        logger.debug("[search] live price failed for %s (%s) — snapshot", symbol, err)
        return None

    price = data.get("price")
    if not price:  # None or 0 (e.g. Finnhub without API key) -> snapshot
        logger.debug("[search] %s live price empty (%r) — snapshot", symbol, price)
        return None

    logger.debug("[search] %s live price=%s", symbol, price)
    return float(price)


async def _enrich_assets(assets: list[AssetResult]) -> list[AssetResult]:
    """Replace snapshot prices with live quotes where available (concurrent).

    Builds new ``AssetResult`` copies (never mutates the lru_cache'd snapshot).
    """
    if not assets:
        return assets

    live_prices = await asyncio.gather(*(_live_price(a) for a in assets))
    enriched: list[AssetResult] = []
    live_count = 0
    for asset, price in zip(assets, live_prices):
        if price is not None:
            live_count += 1
            enriched.append(asset.model_copy(update={"price": price}))
        else:
            enriched.append(asset)

    logger.info("[search] enriched %d/%d assets with live price", live_count, len(assets))
    return enriched


@router.get("", response_model=SearchResponse)
async def global_search(
    q: str | None = Query(None, min_length=0),
    session: AsyncSession = Depends(get_db),
) -> SearchResponse:
    logger.debug("[search] GET /api/search q=%s", q)

    if not q or len(q.strip()) < 2:
        logger.debug("[search] query too short — returning empty")
        return SearchResponse(assets=[], news=[])

    q = q.strip()

    # Asset search (in-memory, no DB) + live-price enrichment via quotes layer
    assets = _search_assets(q)
    assets = await _enrich_assets(assets)

    # News search (DB, ILIKE)
    pattern = f"%{q}%"
    rows = await session.scalars(
        select(NewsArticle)
        .where(
            or_(
                NewsArticle.title.ilike(pattern),
                NewsArticle.description.ilike(pattern),
                NewsArticle.title_ru.ilike(pattern),
            )
        )
        .order_by(NewsArticle.published_at.desc())
        .limit(_NEWS_LIMIT)
    )
    news_rows = list(rows)
    news = [
        NewsResult(
            id=str(row.id),
            title=row.title,
            title_ru=row.title_ru,
            published_at=row.published_at.isoformat() if row.published_at else "",
            category=row.category,
        )
        for row in news_rows
    ]

    logger.info("[search] q=%s → assets=%d news=%d", q, len(assets), len(news))
    logger.debug("[search] assets hit: %s", [a.symbol for a in assets])

    return SearchResponse(assets=assets, news=news)
