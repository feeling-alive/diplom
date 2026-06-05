"""Crypto ticker routes backed by OKX REST."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.services import okx

logger = logging.getLogger("backend.routes.crypto")

router = APIRouter(tags=["crypto"])


@router.get("/cryptos")
async def get_cryptos(
    symbols: str = Query(..., description="Comma-separated OKX instIds, e.g. BTC-USDT,ETH-USDT"),
) -> dict[str, Any]:
    """Batch crypto tickers. One upstream OKX call; per-request CORS-safe proxy
    so the frontend no longer hits okx.com directly."""
    parsed = [s.strip() for s in symbols.split(",") if s.strip()]
    if not parsed:
        raise HTTPException(status_code=400, detail="No symbols provided")
    logger.info("[crypto] batch %d symbols", len(parsed))
    try:
        return await okx.get_tickers(parsed)
    except httpx.HTTPError as err:
        logger.warning("[crypto] okx batch failed: %s", err)
        raise HTTPException(status_code=502, detail="OKX batch error") from err


@router.get("/crypto/{symbol}")
async def get_crypto(symbol: str) -> dict[str, Any]:
    """Crypto ticker for an OKX instId like ``BTC-USDT``."""
    logger.info("[crypto] %s", symbol)
    try:
        return await okx.get_ticker(symbol)
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except httpx.HTTPError as err:
        logger.warning("[crypto] okx failed for %s: %s", symbol, err)
        raise HTTPException(status_code=502, detail=f"OKX error for {symbol}") from err
