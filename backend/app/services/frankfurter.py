"""Frankfurter forex rates with Redis caching (TTL = settings.forex_ttl)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.frankfurter")

# frankfurter.app now 301-redirects to the .dev/v1 host; point straight at it.
_BASE_URL = "https://api.frankfurter.dev/v1/latest"


async def get_rate(base: str, quote: str) -> dict[str, Any]:
    """Return ``{symbol, from, to, rate, price}`` for a currency pair.

    Cache-first. Raises ``LookupError`` if Frankfurter has no rate for the pair,
    or ``httpx.HTTPError`` on a transport failure (handled by the route).
    """
    base = base.upper()
    quote = quote.upper()
    key = f"cache:forex:{base}:{quote}"

    cached = await get_cached(key)
    if cached is not None:
        return cached

    logger.info("[frankfurter] fetch %s/%s", base, quote)
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(_BASE_URL, params={"from": base, "to": quote})
        resp.raise_for_status()
        payload: dict[str, Any] = resp.json()

    rates = payload.get("rates") or {}
    if quote not in rates:
        logger.warning("[frankfurter] no rate for %s->%s", base, quote)
        raise LookupError(f"Frankfurter has no rate for {base}->{quote}")

    rate = safe_float(rates[quote])
    result = {
        "symbol": f"{base}/{quote}",
        "from": base,
        "to": quote,
        "rate": rate,
        "price": rate,  # alias so the shape resembles the quote endpoints
    }
    await set_cached(key, result, settings.forex_ttl)
    return result
