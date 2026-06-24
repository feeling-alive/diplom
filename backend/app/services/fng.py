"""Fear & Greed index proxy with Redis caching (Phase 2 endpoint).

alternative.me exposes the index at ``/fng/?limit=1&format=json``. The index is
recomputed once a day, and the upstream conveniently returns ``time_until_update``
(seconds until the next value). round 3 (B4): instead of a blind 1 h TTL — which
either lagged the daily update or re-fetched the identical value — we cache exactly
until the next update (clamped to a sane [5 min, 24 h] range). So the value really
refreshes when alternative.me publishes a new one, and is never served from a
"forever" cache.
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
    time_until_update = int(safe_float(first.get("time_until_update"), default=settings.fng_ttl))

    result = {
        "value": value,
        "label": label,
        "timestamp": timestamp,
        "timeUntilUpdate": time_until_update,
        "fetchedAt": int(time.time()),
        "source": "alternative.me",
    }
    # Cache exactly until the next daily publish (+1 min buffer), clamped to a sane
    # range so a malformed/huge value can never pin the cache forever.
    ttl = max(300, min(time_until_update + 60, 24 * 60 * 60))
    logger.info("[fng] value=%s label=%s ttl=%ds (time_until_update=%ds)", value, label, ttl, time_until_update)
    await set_cached(key, result, ttl)
    return result
