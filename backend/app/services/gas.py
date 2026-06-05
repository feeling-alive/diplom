"""Etherscan gas oracle proxy with Redis caching (Phase 2 endpoint).

Requires ``ETHERSCAN_API_KEY`` for live data. Without a key (or when the
upstream is rate-limited / quota-exhausted) the route returns a static
fallback with ``isStale: true`` so the UI can mark the widget accordingly.
The 15 s TTL is short on purpose — gas moves quickly during congestion.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.gas")

_GAS_URL = "https://api.etherscan.io/api"


def _static_fallback(is_stale: bool, reason: str) -> dict[str, Any]:
    """Return a reasonable middle-of-the-road gas snapshot."""
    now = int(time.time())
    return {
        "slow": {"gwei": 18, "usd": 1.10},
        "standard": {"gwei": 24, "usd": 1.45},
        "fast": {"gwei": 32, "usd": 1.95},
        "baseFee": 20,
        "lastBlock": 0,
        "fetchedAt": now,
        "isStale": is_stale,
        "reason": reason,
        "source": "fallback",
    }


async def get_gas() -> dict[str, Any]:
    """Return ``{slow, standard, fast, baseFee, lastBlock, isStale, source}``.

    When the Etherscan key is absent or the upstream call fails the response
    is the static fallback with ``isStale: true`` and a ``reason`` field so the
    UI can show a «stale data» badge.
    """
    key = "cache:gas"
    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    if not settings.etherscan_api_key:
        logger.info("[gas] ETHERSCAN_API_KEY absent; returning fallback")
        return _static_fallback(is_stale=True, reason="no_api_key")

    logger.info("[gas] fetch")
    params = {
        "module": "gastracker",
        "action": "gasoracle",
        "apikey": settings.etherscan_api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
            resp = await client.get(_GAS_URL, params=params)
            resp.raise_for_status()
            payload: dict[str, Any] = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[gas] upstream failed: %s", err)
        return _static_fallback(is_stale=True, reason="upstream_error")

    status = str(payload.get("status") or "")
    message = str(payload.get("message") or "")
    if status != "1":
        # Etherscan returns status=0 + result="NOTOK" / "Max rate limit reached".
        logger.warning("[gas] Etherscan non-OK: status=%s message=%s", status, message)
        return _static_fallback(is_stale=True, reason=message or "etherscan_status_0")

    result_field = payload.get("result") or {}
    if not isinstance(result_field, dict):
        return _static_fallback(is_stale=True, reason="malformed_result")

    # Etherscan's "Usd" estimate is per-21000-gas; the frontend can show it
    # directly. ``gwei`` figures are already in gwei.
    def tier(prefix: str) -> dict[str, Any]:
        return {
            "gwei": int(safe_float(result_field.get(f"{prefix}GasPrice"))),
            "usd": round(safe_float(result_field.get(f"{prefix}GasPriceUsd")), 4),
        }

    snapshot = {
        "slow": tier("Safe"),
        "standard": tier("Propose"),
        "fast": tier("Fast"),
        "baseFee": int(safe_float(result_field.get("suggestBaseFee"))),
        "lastBlock": int(safe_float(result_field.get("LastBlock"))),
        "fetchedAt": int(time.time()),
        "isStale": False,
        "source": "etherscan",
    }
    await set_cached(key, snapshot, settings.gas_ttl)
    return snapshot
