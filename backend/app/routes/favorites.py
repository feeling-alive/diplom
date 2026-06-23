"""User asset-favorites routes (prefix ``/favorites``).

Wires the previously-unused :class:`app.models.Favorite` model: the watchlist
widget and the asset-page star toggle persist a user's favourite asset symbols
here. All endpoints require authentication via :func:`get_current_user`.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Favorite, User

logger = logging.getLogger("backend.routes.favorites")

router = APIRouter(prefix="/favorites", tags=["favorites"])


class FavoriteIn(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32)


class FavoritesResponse(BaseModel):
    symbols: list[str]


@router.get("", response_model=FavoritesResponse)
async def list_favorites(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavoritesResponse:
    """Return the current user's favourited asset symbols (newest first)."""
    rows = await db.execute(
        select(Favorite.symbol).where(Favorite.user_id == user.id).order_by(Favorite.added_at.desc())
    )
    symbols = [r[0] for r in rows.all()]
    logger.debug("[favorites] list user=%s count=%d", user.id, len(symbols))
    return FavoritesResponse(symbols=symbols)


@router.post("", response_model=FavoritesResponse, status_code=status.HTTP_201_CREATED)
async def add_favorite(
    payload: FavoriteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavoritesResponse:
    """Add a symbol to favourites. Idempotent — re-adding an existing symbol is a no-op."""
    symbol = payload.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Empty symbol")

    exists = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.symbol == symbol)
    )
    if exists.scalar_one_or_none() is None:
        db.add(Favorite(user_id=user.id, symbol=symbol))
        await db.commit()
        logger.info("[favorites] add user=%s symbol=%s", user.id, symbol)
    else:
        logger.debug("[favorites] add no-op (exists) user=%s symbol=%s", user.id, symbol)

    return await list_favorites(user=user, db=db)


@router.delete("/{symbol}", response_model=FavoritesResponse)
async def remove_favorite(
    symbol: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FavoritesResponse:
    """Remove a symbol from favourites. Idempotent."""
    norm = symbol.strip().upper()
    await db.execute(
        delete(Favorite).where(Favorite.user_id == user.id, Favorite.symbol == norm)
    )
    await db.commit()
    logger.info("[favorites] remove user=%s symbol=%s", user.id, norm)
    return await list_favorites(user=user, db=db)
