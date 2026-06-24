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

# Keyless on-chain fallback: public Ethereum JSON-RPC nodes answer ``eth_gasPrice``
# without an API key. Gives one gwei figure (the suggested gas price) which we fan
# out into slow/standard/fast tiers — real on-chain data, so the widget is no longer
# «демо» when ETHERSCAN_API_KEY is absent.
#
# round 3 (B3): один эндпоинт (publicnode) периодически не отвечает/блокирует запрос,
# и виджет залипал на статичном «демо» 24 gwei. Теперь перебираем НЕСКОЛЬКО публичных
# RPC по очереди и шлём явный User-Agent (некоторые ноды отбивают запросы без него),
# берём первый успешный ответ.
_PUBLIC_RPC_URLS: tuple[str, ...] = (
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://rpc.ankr.com/eth",
    "https://cloudflare-eth.com",
    "https://1rpc.io/eth",
)

_RPC_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "FinTrack/1.0 (+gas-tracker)",
}


async def _rpc_call(client: httpx.AsyncClient, url: str, method: str) -> Any:
    """Single JSON-RPC call, returns the ``result`` field (or ``None`` on error)."""
    resp = await client.post(
        url,
        headers=_RPC_HEADERS,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": []},
    )
    resp.raise_for_status()
    payload: dict[str, Any] = resp.json()
    return payload.get("result")


async def _fetch_rpc_gas() -> dict[str, Any] | None:
    """Fetch a live gas price from the first responsive keyless public RPC.

    Returns ``None`` only when every endpoint fails."""
    for url in _PUBLIC_RPC_URLS:
        logger.info("[gas] keyless RPC fetch %s", url)
        try:
            async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
                raw = await _rpc_call(client, url, "eth_gasPrice")
                if not isinstance(raw, str):
                    logger.warning("[gas] keyless RPC %s malformed result: %r", url, raw)
                    continue
                try:
                    gwei = int(raw, 16) / 1e9
                except (TypeError, ValueError):
                    logger.warning("[gas] keyless RPC %s unparseable gwei: %r", url, raw)
                    continue
                # Latest block number is best-effort — failure here must not drop the
                # otherwise-valid gas reading.
                last_block = 0
                try:
                    block_raw = await _rpc_call(client, url, "eth_blockNumber")
                    if isinstance(block_raw, str):
                        last_block = int(block_raw, 16)
                except (httpx.HTTPError, TypeError, ValueError) as err:
                    logger.debug("[gas] keyless RPC %s blockNumber skipped: %s", url, err)
        except httpx.HTTPError as err:
            logger.warning("[gas] keyless RPC %s failed: %s", url, err)
            continue

        # Fan the single suggested price into tiers. Round to 1 decimal so sub-gwei
        # values (common post-merge) still render meaningfully.
        standard = round(gwei, 1)
        logger.info("[gas] keyless RPC %s OK gwei=%.2f block=%d", url, standard, last_block)
        return {
            "slow": {"gwei": round(gwei * 0.9, 1), "usd": 0.0},
            "standard": {"gwei": standard, "usd": 0.0},
            "fast": {"gwei": round(gwei * 1.25, 1), "usd": 0.0},
            "baseFee": standard,
            "lastBlock": last_block,
            "fetchedAt": int(time.time()),
            "isStale": False,
            "source": "rpc",
        }

    logger.warning("[gas] all keyless RPC endpoints failed")
    return None


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
        # Без ключа Etherscan пробуем keyless on-chain источник, и только если он
        # недоступен — статичный демо-fallback (isStale=true).
        logger.info("[gas] ETHERSCAN_API_KEY absent; trying keyless RPC")
        rpc = await _fetch_rpc_gas()
        if rpc is not None:
            await set_cached(key, rpc, settings.gas_ttl)
            return rpc
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
        logger.warning("[gas] upstream failed: %s; trying keyless RPC", err)
        rpc = await _fetch_rpc_gas()
        if rpc is not None:
            await set_cached(key, rpc, settings.gas_ttl)
            return rpc
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
