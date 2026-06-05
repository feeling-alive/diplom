"""Fear & Greed index proxy with Redis caching (Phase 2 endpoint).

alternative.me exposes the index at ``/fng/?limit=1&format=json``. The cache TTL
is long (1 h) because the index is updated daily — frequent re-fetches just
waste the upstream's free quota.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.fng")

_FNG_URL = "https://api.alternative.me/fng/"


def _neutral_fallback() -> dict[str, Any]:
    """Return a 50/Neutral snapshot for cold starts or when alternative.me is down."""
    now = int(time.time())
    return {
        "value": 50,
        "label": "Neutral",
        "timestamp": now,
        "fetchedAt": now,
        "source": "fallback",
    }


async def get_fng() -> dict[str, Any]:
    """Return the latest FNG snapshot. Cache-first, fallback to a 50/Neutral
    stub if alternative.me is unreachable."""
    key = "cache:fng"
    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    logger.info("[fng] fetch")
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
            resp = await client.get(_FNG_URL, params={"limit": "1", "format": "json"})
            resp.raise_for_status()
            payload: dict[str, Any] = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[fng] upstream failed: %s", err)
        return _neutral_fallback()

    rows = payload.get("data") or []
    if not rows:
        logger.warning("[fng] empty data in payload")
        return _neutral_fallback()

    first = rows[0] if isinstance(rows[0], dict) else {}
    value = safe_float(first.get("value"))
    label = str(first.get("value_classification") or "Neutral")
    timestamp = int(safe_float(first.get("timestamp"), default=time.time()))

    result = {
        "value": value,
        "label": label,
        "timestamp": timestamp,
        "fetchedAt": int(time.time()),
        "source": "alternative.me",
    }
    await set_cached(key, result, settings.fng_ttl)
    return result
