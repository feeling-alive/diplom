"""OKX funding-rate batch proxy with Redis caching (Phase 2 endpoint).

Fetches ``/public/funding-rate?instId=...`` for each requested symbol, in
parallel. Each symbol has its own cache entry so adding/removing a pair from
the request does not invalidate the rest. The batch endpoint aggregates
without caching the full batch — a partial upstream failure should not poison
the whole response, and per-symbol caching is the right granularity anyway.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.funding")

_FUNDING_URL = "https://www.okx.com/api/v5/public/funding-rate"


async def _fetch_one(symbol: str) -> dict[str, Any] | None:
    """Fetch a single funding rate. Returns ``None`` on a 4xx/5xx so the batch
    aggregator can report it without raising.

    OKX ``/public/funding-rate`` only serves perpetual (SWAP) contracts — a
    plain spot instId like ``BTC-USDT`` returns 400. We append ``-SWAP`` here
    so the caller can keep using the same canonical pair names they use
    elsewhere (``useOHLCV`` etc).
    """
    symbol = symbol.upper()
    inst_id = symbol if symbol.endswith("-SWAP") else f"{symbol}-SWAP"
    key = f"cache:funding:{symbol}"
    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    logger.info("[funding] fetch %s (instId=%s)", symbol, inst_id)
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
            resp = await client.get(_FUNDING_URL, params={"instId": inst_id})
            resp.raise_for_status()
            payload: dict[str, Any] = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[funding] %s failed: %s", symbol, err)
        return None

    rows = payload.get("data") or []
    if not rows:
        return None
    first = rows[0] if isinstance(rows[0], dict) else {}
    rate_pct = safe_float(first.get("fundingRate")) * 100  # OKX returns decimal

    result = {
        "symbol": symbol,
        "fundingRate": safe_float(first.get("fundingRate")),
        "fundingRatePercent": round(rate_pct, 4),
        "nextFundingTime": first.get("nextFundingTime"),
        "interestRate": safe_float(first.get("interestRate")),
        "settleState": first.get("settleState"),
    }
    await set_cached(key, result, settings.funding_ttl)
    return result


async def get_funding_rates(symbols: list[str]) -> dict[str, Any]:
    """Return ``{rates: [...]}`` with one entry per requested symbol. Per-symbol
    failures are excluded (so the UI can keep rendering the rest)."""
    if not symbols:
        return {"rates": []}
    parsed = [s.strip().upper() for s in symbols if s.strip()]

    fetched = await asyncio.gather(*(_fetch_one(s) for s in parsed))
    rates = [r for r in fetched if r is not None]
    logger.info("[funding] fetched %d/%d rates", len(rates), len(parsed))
    return {"rates": rates}
