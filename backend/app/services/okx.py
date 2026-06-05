"""OKX crypto ticker via REST (not WebSocket) with Redis caching.

The frontend keeps its own OKX WebSocket for realtime crypto on the asset page;
this REST endpoint is only for the dashboard's cached snapshots.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.okx")

_BASE_URL = "https://www.okx.com/api/v5/market/ticker"
_TICKERS_URL = "https://www.okx.com/api/v5/market/tickers"


def _normalize_ticker(ticker: dict[str, Any]) -> dict[str, Any]:
    """Map one OKX ticker row to the canonical ``{symbol, price, change, ...}`` shape."""
    inst_id = str(ticker.get("instId", "")).upper()
    last = safe_float(ticker.get("last"))
    open_24h = safe_float(ticker.get("open24h"))
    change = last - open_24h
    change_pct = (change / open_24h * 100) if open_24h > 0 else 0.0
    return {
        "symbol": inst_id,
        "price": last,
        "change": round(change, 8),
        "changePercent": round(change_pct, 4),
        "volume": round(safe_float(ticker.get("volCcy24h"))),
    }


async def get_tickers(symbols: list[str]) -> dict[str, Any]:
    """Batch crypto tickers via a single OKX SPOT ``tickers`` call.

    Replaces the frontend's direct browser->OKX fetch (CORS-fragile). One
    upstream request returns every SPOT pair; we filter to the requested
    instIds. Returns ``{tickers: [{symbol, price, change, changePercent, volume}]}``.
    Cache-first under a key derived from the sorted symbol set.
    """
    wanted = {s.strip().upper() for s in symbols if s.strip()}
    key = "cache:crypto:tickers:" + ",".join(sorted(wanted))

    cached = await get_cached(key)
    if cached is not None:
        return cached

    logger.info("[okx] batch tickers for %d symbols", len(wanted))
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(_TICKERS_URL, params={"instType": "SPOT"})
        resp.raise_for_status()
        payload: dict[str, Any] = resp.json()

    data = payload.get("data") or []
    tickers = [
        _normalize_ticker(row)
        for row in data
        if str(row.get("instId", "")).upper() in wanted
    ]
    logger.info("[okx] matched %d/%d requested tickers", len(tickers), len(wanted))

    result = {"tickers": tickers}
    await set_cached(key, result, settings.crypto_ttl)
    return result


async def get_ticker(symbol: str) -> dict[str, Any]:
    """Return ``{symbol, price, change, changePercent, volume}`` for a crypto pair.

    ``symbol`` is an OKX instId like ``BTC-USDT``. Cache-first.
    Raises ``LookupError`` if OKX returns no data for the pair (bad symbol),
    or ``httpx.HTTPError`` on a transport failure (handled by the route).
    """
    symbol = symbol.upper()
    key = f"cache:crypto:{symbol}"

    cached = await get_cached(key)
    if cached is not None:
        return cached

    logger.info("[okx] fetch %s", symbol)
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(_BASE_URL, params={"instId": symbol})
        resp.raise_for_status()
        payload: dict[str, Any] = resp.json()

    data = payload.get("data") or []
    if not data:
        # OKX answers 200 with code != "0" and empty data for unknown instId.
        logger.warning("[okx] no data for %s (payload code=%s)", symbol, payload.get("code"))
        raise LookupError(f"OKX has no ticker for {symbol}")

    result = _normalize_ticker(data[0])
    await set_cached(key, result, settings.crypto_ttl)
    return result
