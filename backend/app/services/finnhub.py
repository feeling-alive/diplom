"""Finnhub stock quotes with Redis caching (TTL = settings.stock_ttl)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.api_keys import get_api_key
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.finnhub")

_BASE_URL = "https://finnhub.io/api/v1"


def _empty_quote(symbol: str) -> dict[str, Any]:
    return {"symbol": symbol, "price": 0.0, "change": 0.0, "changePercent": 0.0, "volume": 0}


async def get_quote(symbol: str) -> dict[str, Any]:
    """Return ``{symbol, price, change, changePercent, volume}`` for a stock.

    Cache-first. Finnhub ``/quote`` returns no volume, so ``volume`` is always 0.
    Raises ``httpx.HTTPError`` on a hard external failure (handled by the route).
    """
    symbol = symbol.upper()
    key = f"cache:stock:{symbol}"

    cached = await get_cached(key)
    if cached is not None:
        return cached

    api_key = await get_api_key("finnhub")
    if not api_key:
        # Without a key we cannot fetch; return zeros and do NOT cache so the
        # value refreshes as soon as a key is configured (panel or .env).
        logger.warning("[finnhub] no finnhub key (panel/.env); returning empty quote for %s", symbol)
        return _empty_quote(symbol)

    logger.info("[finnhub] fetch %s", symbol)
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(
            f"{_BASE_URL}/quote",
            params={"symbol": symbol, "token": api_key},
        )
        resp.raise_for_status()
        raw: dict[str, Any] = resp.json()

    quote = {
        "symbol": symbol,
        "price": safe_float(raw.get("c")),
        "change": safe_float(raw.get("d")),
        "changePercent": safe_float(raw.get("dp")),
        "volume": 0,  # Finnhub /quote does not provide volume
    }
    await set_cached(key, quote, settings.stock_ttl)
    return quote
