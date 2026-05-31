"""Forex rate routes backed by Frankfurter."""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from app.services import frankfurter

logger = logging.getLogger("backend.routes.forex")

router = APIRouter(tags=["forex"])


@router.get("/forex/{base}/{quote}")
async def get_forex(base: str, quote: str) -> dict[str, Any]:
    """Forex rate for a pair, e.g. ``/forex/EUR/USD``."""
    logger.info("[forex] %s/%s", base, quote)
    try:
        return await frankfurter.get_rate(base, quote)
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except httpx.HTTPError as err:
        logger.warning("[forex] frankfurter failed for %s/%s: %s", base, quote, err)
        raise HTTPException(status_code=502, detail=f"Frankfurter error for {base}/{quote}") from err
