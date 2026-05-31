"""Stock quote routes backed by Finnhub."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.services import finnhub

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
