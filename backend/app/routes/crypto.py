"""Crypto ticker routes backed by OKX REST."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from app.services import okx

logger = logging.getLogger("backend.routes.crypto")

router = APIRouter(tags=["crypto"])


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
