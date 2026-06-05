"""Stock quote routes backed by Finnhub, plus the Phase 2 endpoints that
proxy OHLCV candles / coin info / Fear & Greed / funding rates / gas oracle
through the same Redis-cached path the rest of the service uses."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.services import candles, coingecko, finnhub, fng, funding, gas

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
