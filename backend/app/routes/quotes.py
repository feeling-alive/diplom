"""Stock quote routes backed by Finnhub, plus the Phase 2 endpoints that
proxy OHLCV candles / coin info / Fear & Greed / funding rates / gas oracle
through the same Redis-cached path the rest of the service uses."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.services import candles, coingecko, finnhub, fng, frankfurter, funding, gas, okx

logger = logging.getLogger("backend.routes.quotes")

router = APIRouter(tags=["quotes"])


@router.get("/stock/{symbol}")
async def get_stock(symbol: str) -> dict[str, Any]:
    """Single stock quote: ``{symbol, price, change, changePercent, volume}``."""
    logger.info("[quotes] stock %s", symbol)
    try:
        return await finnhub.get_quote(symbol)
    except httpx.HTTPError as err:
        logger.warning("[quotes] finnhub failed for %s: %s", symbol, err)
        raise HTTPException(status_code=502, detail=f"Finnhub error for {symbol}") from err


@router.get("/stocks")
async def get_stocks(
    symbols: str = Query(..., description="Comma-separated symbols, e.g. AAPL,MSFT,GOOGL"),
) -> dict[str, Any]:
    """Batch stock quotes. Per-symbol failures are isolated (do not fail the batch)."""
    parsed = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not parsed:
        raise HTTPException(status_code=400, detail="No symbols provided")

    logger.info("[quotes] batch %d symbols", len(parsed))

    async def fetch_one(sym: str) -> dict[str, Any]:
        try:
            return await finnhub.get_quote(sym)
        except httpx.HTTPError as err:
            logger.warning("[quotes] batch item %s failed: %s", sym, err)
            return {"symbol": sym, "error": "fetch_failed"}

    quotes = await asyncio.gather(*(fetch_one(s) for s in parsed))
    return {"quotes": quotes}


# --- Phase 2: new endpoints (widgets-redis-cleanup plan) ----------------------


@router.get("/ohlcv/{symbol}")
async def get_ohlcv(
    symbol: str,
    tf: str = Query("1H", description="1m/5m/15m/1H/4H/1D/1W/1M"),
    limit: int = Query(100, ge=1, le=1000),
) -> dict[str, Any]:
    """OHLCV candle history. Crypto (BTC-USDT) goes to OKX; stocks (AAPL) to Finnhub."""
    logger.info("[quotes] ohlcv %s tf=%s limit=%d", symbol, tf, limit)
    return await candles.get_candles(symbol, tf, limit)


@router.get("/coin/{coin_id}")
async def get_coin(coin_id: str) -> dict[str, Any]:
    """CoinGecko coin info, normalized to a small payload. Cached for 30 min."""
    logger.info("[quotes] coin %s", coin_id)
    return await coingecko.get_coin(coin_id)


@router.get("/fng")
async def get_fng() -> dict[str, Any]:
    """Fear & Greed index snapshot. Cached for 1 h; falls back to 50/Neutral."""
    return await fng.get_fng()


@router.get("/global")
async def get_global() -> dict[str, Any]:
    """Global crypto market metrics (CoinGecko /global) — total market cap,
    total 24h volume, BTC/ETH dominance. Cache-shared by the market_volume and
    global_market_cap widgets so the browser no longer hits CoinGecko directly."""
    return await coingecko.get_global()


@router.get("/price/{symbol}")
async def get_price(symbol: str) -> dict[str, Any]:
    """Single spot price routed by asset class (``candles.classify_symbol``).

    Returns a uniform ``{symbol, price, change24h, source}`` for crypto, stock,
    forex AND **metals**. Metals (``XAU-USD``/``XAG-USD``) have no free spot feed
    and used to be misrouted to the forex endpoint, where Frankfurter answered 502
    (it knows no metals) and the price came back broken (bug A1). Here metals take
    the last two daily closes from the COMEX continuous futures via yfinance
    (the same source that already draws their charts) so the number is real.
    """
    symbol = symbol.upper()
    kind = candles.classify_symbol(symbol)
    logger.info("[quotes] price %s route=%s", symbol, kind)

    try:
        if kind == "crypto":
            data = await okx.get_ticker(symbol)
            return {
                "symbol": symbol,
                "price": data.get("price", 0.0),
                "change24h": data.get("changePercent", 0.0),
                "source": "okx",
            }
        if kind == "stock":
            data = await finnhub.get_quote(symbol)
            return {
                "symbol": symbol,
                "price": data.get("price", 0.0),
                "change24h": data.get("changePercent", 0.0),
                "source": "finnhub",
            }
        if kind == "forex":
            base, quote = symbol.split("-", 1)
            data = await frankfurter.get_rate(base, quote)
            return {
                "symbol": symbol,
                "price": data.get("rate", 0.0),
                "change24h": 0.0,
                "source": "frankfurter",
            }
        # metal — last close from yfinance futures (GC=F/SI=F), via the candle layer.
        ohlcv = await candles.get_candles(symbol, "1D", 2)
        rows = ohlcv.get("candles") or []
        if not rows:
            raise HTTPException(status_code=502, detail=f"No price data for {symbol}")
        last_close = float(rows[-1].get("c", 0.0))
        change24h = 0.0
        if len(rows) >= 2:
            prev_close = float(rows[-2].get("c", 0.0))
            if prev_close > 0:
                change24h = (last_close - prev_close) / prev_close * 100.0
        logger.info("[quotes] metal %s price=%.2f change=%.2f", symbol, last_close, change24h)
        return {
            "symbol": symbol,
            "price": last_close,
            "change24h": round(change24h, 2),
            "source": ohlcv.get("source", "yfinance"),
        }
    except (LookupError, ValueError) as err:
        logger.warning("[quotes] price failed for %s (%s): %s", symbol, kind, err)
        raise HTTPException(status_code=502, detail=f"Price error for {symbol}") from err
    except httpx.HTTPError as err:
        logger.warning("[quotes] price upstream failed for %s (%s): %s", symbol, kind, err)
        raise HTTPException(status_code=502, detail=f"Price error for {symbol}") from err


@router.get("/trending")
async def get_trending() -> dict[str, Any]:
    """Top trending coins (CoinGecko /search/trending), Redis-cached. Shared by the
    trending_coins widget so the browser no longer hits CoinGecko directly."""
    return await coingecko.get_trending()


@router.get("/funding-rate")
async def get_funding_rate(
    symbols: str = Query(..., description="Comma-separated OKX instIds, e.g. BTC-USDT,ETH-USDT"),
) -> dict[str, Any]:
    """Batch funding rate. Per-symbol failures are excluded from the response."""
    parsed = [s.strip() for s in symbols.split(",") if s.strip()]
    if not parsed:
        raise HTTPException(status_code=400, detail="No symbols provided")
    return await funding.get_funding_rates(parsed)


@router.get("/gas")
async def get_gas() -> dict[str, Any]:
    """Ethereum gas oracle snapshot. Returns a static fallback with ``isStale``
    true when ``ETHERSCAN_API_KEY`` is absent or the upstream is rate-limited."""
    return await gas.get_gas()
