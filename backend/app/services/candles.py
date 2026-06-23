"""OHLCV candle proxy with Redis caching (Phase 2 endpoint).

Routing by symbol type (crypto and forex both use ``-`` as separator, so the
quote currency decides):

* **crypto** (``BTC-USDT``, ``ETH-USDT``)  -> OKX REST.
* **forex**  (``EUR-USD``, ``USD-JPY``)    -> Frankfurter ``/timeseries`` (daily
  only — Frankfurter has no intraday data; one rate/day is expanded into a flat
  ``o=h=l=c=rate`` candle).
* **stock**  (``AAPL``, ``MSFT``)          -> yfinance daily/intraday history.

Graceful degradation is **asset-class aware**: a crypto failure falls back to the
crypto mock fixture (cold-start safety), but a stock/forex failure returns an
EMPTY candle set (``source="empty"``) — never the crypto mock. Serving $68k
crypto candles under a $379 stock was bug #6; an empty set lets the frontend
render a proper empty state instead. The response contract is stable:
``{symbol, timeframe, candles:[{t,o,h,l,c,v}], source}`` with ``t`` in unix ms,
oldest candle first.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.utils import safe_float

logger = logging.getLogger("backend.candles")

_OKX_URL = "https://www.okx.com/api/v5/market/candles"
_FRANKFURTER_BASE = "https://api.frankfurter.dev/v1"

# Fiat currencies recognised for forex routing. A ``XXX-YYY`` symbol whose both
# segments are here is forex; anything else with ``-`` is treated as crypto.
# Covers the app's forex pairs (frontend/src/data/prices.json) plus majors.
_FIAT_CURRENCIES: frozenset[str] = frozenset(
    {
        "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
        "CNY", "HKD", "SGD", "SEK", "NOK", "DKK", "PLN", "CZK",
        "HUF", "TRY", "ZAR", "MXN", "INR", "BRL", "KRW", "RON",
        "BGN", "ILS", "THB", "MYR", "PHP", "IDR", "ISK",
    }
)

# Maps frontend timeframes -> (yfinance interval, yfinance period). Intraday
# windows are capped by yfinance, so periods are sized generously and the last
# ``limit`` rows are sliced afterwards.
_YF_TF_MAP: dict[str, tuple[str, str]] = {
    "30m": ("30m", "1mo"),
    "1H": ("60m", "3mo"),
    "1D": ("1d", "1y"),
    "1W": ("1wk", "5y"),
    "1M": ("1mo", "max"),
}

_MOCK_PATH = Path(__file__).resolve().parent.parent / "mock" / "candles.json"

# Spot-metal pseudo-pairs the frontend uses (``XAU-USD`` gold, ``XAG-USD`` silver).
# No free spot-metal OHLCV feed exists, and Frankfurter only covers fiat — so these
# were misrouted to OKX as crypto and painted the crypto mock fixture. Chart them
# from the COMEX continuous futures via yfinance instead.
_METAL_YF_MAP: dict[str, str] = {
    "XAU-USD": "GC=F",  # gold futures
    "XAG-USD": "SI=F",  # silver futures
}


def classify_symbol(symbol: str) -> str:
    """Return ``"crypto"``, ``"forex"``, ``"metal"`` or ``"stock"`` for *symbol*.

    * spot-metal pseudo-pair (``XAU-USD``/``XAG-USD``)        -> ``"metal"``.
    * ``"-"`` present and both segments are fiat currencies   -> ``"forex"``.
    * ``"-"`` present otherwise (e.g. ``BTC-USDT``)           -> ``"crypto"``.
    * no ``"-"`` (e.g. ``AAPL``)                              -> ``"stock"``.
    """
    upper = symbol.upper()
    if upper in _METAL_YF_MAP:
        return "metal"
    if "-" in upper:
        parts = upper.split("-")
        if len(parts) == 2 and parts[0] in _FIAT_CURRENCIES and parts[1] in _FIAT_CURRENCIES:
            return "forex"
        return "crypto"
    return "stock"


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


def _empty_candles(symbol: str, timeframe: str) -> dict[str, Any]:
    """Return an empty candle set so the frontend renders an empty state.

    Used when a stock/forex upstream fails: serving the crypto mock fixture here
    would paint misleading $68k candles under an unrelated symbol (bug #6).
    """
    logger.warning("[candles] no data for %s tf=%s — returning empty set", symbol, timeframe)
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "candles": [],
        "source": "empty",
    }


def _degraded_candles(symbol: str, timeframe: str, limit: int, kind: str) -> dict[str, Any]:
    """Asset-class-aware fallback: crypto -> mock fixture, everything else -> empty."""
    if kind == "crypto":
        return _mock_candles(symbol, timeframe, limit)
    return _empty_candles(symbol, timeframe)


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


def _fetch_yfinance_sync(symbol: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
    """Blocking yfinance fetch (run off the event loop via a worker thread).

    Returns canonical candles oldest-first. Raises ``LookupError`` when yfinance
    yields no rows so the caller can fall back to mock.
    """
    interval, period = _YF_TF_MAP.get(timeframe, ("1d", "1y"))
    logger.info(
        "[candles] yfinance fetch %s interval=%s period=%s limit=%d",
        symbol, interval, period, limit,
    )
    import yfinance as yf  # lazy: heavy import, only needed for stock history

    ticker = yf.Ticker(symbol)
    frame = ticker.history(period=period, interval=interval, auto_adjust=False)
    if frame is None or frame.empty:
        # Ticker.history can come back empty (rate-limit/session quirks) while the
        # batch download path still returns rows — try it before giving up.
        logger.warning("[candles] yfinance Ticker.history empty for %s — trying download()", symbol)
        frame = yf.download(
            symbol, period=period, interval=interval,
            auto_adjust=False, progress=False, threads=False,
        )
        # yf.download returns MultiIndex columns for a single ticker; flatten them.
        if frame is not None and not frame.empty and hasattr(frame.columns, "nlevels"):
            if frame.columns.nlevels > 1:
                frame.columns = frame.columns.get_level_values(0)
    if frame is None or frame.empty:
        raise LookupError(f"yfinance returned no candles for {symbol}")

    out: list[dict[str, Any]] = []
    for index, row in frame.tail(limit).iterrows():
        # index is a pandas Timestamp; .value is ns -> ms.
        ts_ms = int(index.value // 1_000_000)
        out.append(
            {
                "t": ts_ms,
                "o": safe_float(row.get("Open", 0)),
                "h": safe_float(row.get("High", 0)),
                "l": safe_float(row.get("Low", 0)),
                "c": safe_float(row.get("Close", 0)),
                "v": safe_float(row.get("Volume", 0)),
            }
        )
    if not out:
        raise LookupError(f"yfinance produced empty candles for {symbol}")
    return out


async def _fetch_yfinance(symbol: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
    """Async wrapper around the blocking yfinance fetch."""
    return await asyncio.to_thread(_fetch_yfinance_sync, symbol, timeframe, limit)


async def _fetch_frankfurter_series(
    base: str, quote: str, limit: int
) -> list[dict[str, Any]]:
    """Fetch a daily forex time series from Frankfurter ``/timeseries``.

    Frankfurter returns one rate per (business) day, so each day becomes a flat
    candle ``o=h=l=c=rate, v=0``. Only daily granularity is available — intraday
    timeframes still return daily candles by design.
    """
    end = datetime.now(timezone.utc).date()
    # Pad the window for weekends/holidays so we still get ~``limit`` business days.
    start = end - timedelta(days=int(limit * 1.6) + 5)
    url = f"{_FRANKFURTER_BASE}/{start.isoformat()}..{end.isoformat()}"
    logger.info("[candles] Frankfurter timeseries %s-%s limit=%d", base, quote, limit)
    async with httpx.AsyncClient(timeout=settings.http_timeout, follow_redirects=True) as client:
        resp = await client.get(url, params={"base": base, "symbols": quote})
        resp.raise_for_status()
        payload: dict[str, Any] = resp.json()

    rates: dict[str, Any] = payload.get("rates") or {}
    if not rates:
        raise LookupError(f"Frankfurter returned no series for {base}->{quote}")

    out: list[dict[str, Any]] = []
    for day in sorted(rates):  # ascending date order (oldest first)
        rate = safe_float((rates[day] or {}).get(quote, 0))
        if rate <= 0:
            continue
        ts_ms = int(
            datetime.fromisoformat(day)
            .replace(tzinfo=timezone.utc)
            .timestamp()
            * 1000
        )
        out.append({"t": ts_ms, "o": rate, "h": rate, "l": rate, "c": rate, "v": 0.0})

    if not out:
        raise LookupError(f"Frankfurter produced empty series for {base}->{quote}")
    return out[-limit:]


async def get_candles(symbol: str, timeframe: str, limit: int = 100) -> dict[str, Any]:
    """Return ``{symbol, timeframe, candles, source}``.

    ``source`` is one of ``"cache"``, ``"okx"``, ``"yfinance"``,
    ``"frankfurter"``, ``"mock"``. Routing is by :func:`classify_symbol`. On any
    upstream error the mock fixture is returned (graceful degradation).
    """
    symbol = symbol.upper()
    timeframe = timeframe.strip()
    limit = max(1, min(limit, 1000))
    key = f"cache:ohlcv:{symbol}:{timeframe}:{limit}"

    cached = await get_cached(key)
    if cached is not None:
        return {**cached, "source": "cache"}

    kind = classify_symbol(symbol)
    logger.debug("[candles] symbol %s -> route=%s", symbol, kind)

    try:
        if kind == "crypto":
            candles = await _fetch_okx(symbol, timeframe, limit)
            source = "okx"
            ttl = settings.ohlcv_crypto_ttl
        elif kind == "forex":
            base, quote = symbol.split("-", 1)
            candles = await _fetch_frankfurter_series(base, quote, limit)
            source = "frankfurter"
            ttl = settings.forex_ttl
        elif kind == "metal":
            yf_symbol = _METAL_YF_MAP[symbol]
            logger.debug("[candles] metal %s -> yfinance futures %s", symbol, yf_symbol)
            candles = await _fetch_yfinance(yf_symbol, timeframe, limit)
            source = "yfinance"
            ttl = settings.ohlcv_stock_ttl
        else:  # stock
            candles = await _fetch_yfinance(symbol, timeframe, limit)
            source = "yfinance"
            ttl = settings.ohlcv_stock_ttl
    except (httpx.HTTPError, LookupError, ValueError) as err:
        logger.warning("[candles] upstream failed for %s tf=%s (%s): %s", symbol, timeframe, kind, err)
        return _degraded_candles(symbol, timeframe, limit, kind)
    except Exception as err:  # noqa: BLE001 — yfinance can raise arbitrary errors; degrade gracefully
        logger.warning("[candles] unexpected error for %s tf=%s (%s): %s", symbol, timeframe, kind, err)
        return _degraded_candles(symbol, timeframe, limit, kind)

    result = {"symbol": symbol, "timeframe": timeframe, "candles": candles, "source": source}
    await set_cached(key, result, ttl)
    logger.info("[candles] fetched %d candles from %s", len(candles), source)
    return result
