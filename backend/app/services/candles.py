"""OHLCV candle proxy with Redis caching (Phase 2 endpoint).

Crypto pairs go to OKX REST; stocks fall back to Finnhub. The cache key
encodes ``(symbol, timeframe, limit)`` so a different ``limit`` query gets
its own bucket.

OKX bar parameter maps directly to the timeframe string from the frontend
(``1m``, ``5m``, ``15m``, ``1H``, ``4H``, ``1D``, ``1W``, ``1M``). Finnhub
resolutions are minute/hour/day, expressed as ``1``, ``5``, ``15``, ``60``,
``240``, ``D``, ``W``, ``M`` — we map server-side to keep callers simple.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.candles")

_OKX_URL = "https://www.okx.com/api/v5/market/candles"
_FINNHUB_URL = "https://finnhub.io/api/v1/stock/candle"

# Maps frontend timeframes -> Finnhub resolution parameter.
# OKX accepts the same strings as-is, so no OKX-side map is needed.
_FINNHUB_TF_MAP: dict[str, str] = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "1H": "60",
    "4H": "240",
    "1D": "D",
    "1W": "W",
    "1M": "M",
}

_MOCK_PATH = Path(__file__).resolve().parent.parent / "mock" / "candles.json"


def _is_stock_symbol(symbol: str) -> bool:
    """Crypto OKX instId uses ``-`` as separator (BTC-USDT); stocks don't."""
    return "-" not in symbol


def _mock_candles(symbol: str, timeframe: str, limit: int) -> dict[str, Any]:
    """Return a fixed candle shape so the route never fails on cold start."""
    try:
        raw = json.loads(_MOCK_PATH.read_text(encoding="utf-8"))
        base_candles = raw.get("candles", [])
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("[candles] mock file unreadable: %s", err)
        base_candles = []

    sliced = base_candles[: max(1, min(limit, len(base_candles)))]
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": sliced,
        "source": "mock",
    }


async def _fetch_okx(symbol: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
    """Fetch from OKX and normalize into the canonical candle shape."""
    logger.info("[candles] OKX fetch %s tf=%s limit=%d", symbol, timeframe, limit)
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(
            _OKX_URL,
            params={"instId": symbol, "bar": timeframe, "limit": str(limit)},
        )
        resp.raise_for_status()
        payload: dict[str, Any] = resp.json()

    rows = payload.get("data") or []
    if not rows:
        raise LookupError(f"OKX returned no candles for {symbol} tf={timeframe}")

    out: list[dict[str, Any]] = []
    for row in rows:  # OKX returns newest first; oldest first is friendlier
        if not isinstance(row, list) or len(row) < 6:
            continue
        # OKX returns [ts, o, h, l, c, vol, volCcy] where ts is unix ms (string).
        # Normalize to an integer — the frontend expects ``PricePoint.timestamp`` in ms.
        try:
            ts_ms = int(row[0])
        except (TypeError, ValueError):
            continue
        out.append(
            {
                "t": ts_ms,
                "o": safe_float(row[1]),
                "h": safe_float(row[2]),
                "l": safe_float(row[3]),
                "c": safe_float(row[4]),
                "v": safe_float(row[5]),
            }
        )
    out.reverse()
    return out


async def _fetch_finnhub(symbol: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
    """Fetch from Finnhub. Requires ``FINNHUB_API_KEY``."""
    if not settings.finnhub_api_key:
        raise LookupError("FINNHUB_API_KEY not configured for stock candles")
    resolution = _FINNHUB_TF_MAP.get(timeframe)
    if resolution is None:
        raise LookupError(f"Unsupported timeframe for Finnhub: {timeframe}")

    # Finnhub needs unix-second ``from``/``to``. We just need ``limit`` candles,
    # so derive the window from the resolution in seconds.
    sec_per_bar: dict[str, int] = {
        "1": 60, "5": 300, "15": 900, "60": 3600, "240": 14400,
        "D": 86400, "W": 604800, "M": 2592000,
    }
    span = sec_per_bar.get(resolution, 86400) * max(1, limit)

    import time
    now = int(time.time())
    params = {
        "symbol": symbol,
        "resolution": resolution,
        "from": str(now - span),
        "to": str(now),
        "token": settings.finnhub_api_key,
    }
    logger.info("[candles] Finnhub fetch %s tf=%s limit=%d", symbol, timeframe, limit)
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(_FINNHUB_URL, params=params)
        resp.raise_for_status()
        payload: dict[str, Any] = resp.json()

    if payload.get("s") != "ok":
        raise LookupError(f"Finnhub returned status={payload.get('s')} for {symbol}")

    out: list[dict[str, Any]] = []
    ts: list[int] = payload.get("t") or []
    for i, t in enumerate(ts):
        # Finnhub returns unix seconds; promote to ms so the frontend gets a
        # uniform ``PricePoint.timestamp`` shape from both providers.
        out.append(
            {
                "t": int(t) * 1000,
                "o": safe_float((payload.get("o") or [])[i] if i < len(payload.get("o") or []) else 0),
                "h": safe_float((payload.get("h") or [])[i] if i < len(payload.get("h") or []) else 0),
                "l": safe_float((payload.get("l") or [])[i] if i < len(payload.get("l") or []) else 0),
                "c": safe_float((payload.get("c") or [])[i] if i < len(payload.get("c") or []) else 0),
                "v": safe_float((payload.get("v") or [])[i] if i < len(payload.get("v") or []) else 0),
            }
        )
    return out


async def get_candles(symbol: str, timeframe: str, limit: int = 100) -> dict[str, Any]:
    """Return ``{symbol, timeframe, candles, source}``.

    ``source`` is one of ``"cache"``, ``"okx"``, ``"finnhub"``, ``"mock"``.
    Crypto symbol contains ``-`` (e.g. ``BTC-USDT``); anything else routes to
    Finnhub. On cold start with no upstream the mock fixture is returned.
    """
    symbol = symbol.upper()
    timeframe = timeframe.strip()
    limit = max(1, min(limit, 1000))
    key = f"cache:ohlcv:{symbol}:{timeframe}:{limit}"

    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    try:
        if _is_stock_symbol(symbol):
            candles = await _fetch_finnhub(symbol, timeframe, limit)
            source = "finnhub"
            ttl = settings.ohlcv_stock_ttl
        else:
            candles = await _fetch_okx(symbol, timeframe, limit)
            source = "okx"
            ttl = settings.ohlcv_crypto_ttl
    except (httpx.HTTPError, LookupError) as err:
        logger.warning("[candles] upstream failed for %s tf=%s: %s", symbol, timeframe, err)
        return _mock_candles(symbol, timeframe, limit)

    result = {"symbol": symbol, "timeframe": timeframe, "candles": candles, "source": source}
    await set_cached(key, result, ttl)
    logger.info("[candles] fetched %d candles from %s", len(candles), source)
    return result
