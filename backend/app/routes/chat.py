"""AI chat route for asset analysis (prefix ``/api/chat``).

Pipeline:
  POST /api/chat/message
    1. Validate JWT (``get_current_user``)
    2. Fetch OHLCV candles via existing ``candles.get_candles()``
    3. Check Redis cache for a cached prediction (key ``cache:predict:{symbol}``)
    4. If cache miss → call Hugging Face PatchTST → store in Redis (TTL 60 s)
    5. Call Groq (Llama 3.3) with the prediction + user message
    6. Persist the conversation in ``ChatSession`` (merge by symbol per user)
    7. Return the AI reply + prediction metadata
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import ChatSession, User
from app.services.cache import get_cached, set_cached
from app.services.candles import get_candles
from app.services.groq_service import generate_response
from app.services.patchtst import get_prediction

logger = logging.getLogger("backend.chat")

router = APIRouter(prefix="/api/chat", tags=["chat"])

PREDICTION_CACHE_TTL = 60  # seconds

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=32, description="Asset ticker")
    message: str = Field(
        ..., min_length=1, max_length=2000, description="User question"
    )


class PredictionOut(BaseModel):
    direction: str
    probability: float
    source: str


class ChatResponse(BaseModel):
    reply: str
    prediction: PredictionOut


# ---------------------------------------------------------------------------
# Helper: extract current price from candles
# ---------------------------------------------------------------------------


def _current_price(candles_data: dict[str, Any]) -> float:
    """Return the close price of the most recent candle, or 0.0."""
    candle_list = candles_data.get("candles") or []
    if not candle_list:
        return 0.0
    last = candle_list[-1]
    try:
        if isinstance(last, dict):
            return float(last.get("c", 0))
        if isinstance(last, (list, tuple)) and len(last) > 4:
            return float(last[4])
    except (TypeError, ValueError):
        pass
    return 0.0


# ---------------------------------------------------------------------------
# Helper: manage chat session in DB
# ---------------------------------------------------------------------------


async def _get_or_create_session(
    db: AsyncSession,
    user_id: Any,
    symbol: str,
) -> ChatSession:
    """Return existing ChatSession for (user, symbol) or create a new one."""
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == user_id,
            ChatSession.symbol == symbol,
        )
    )
    session = result.scalar_one_or_none()
    if session is not None:
        return session
    session = ChatSession(user_id=user_id, symbol=symbol, messages=[])
    db.add(session)
    await db.commit()
    await db.refresh(session)
    logger.debug("[chat] created session user=%s symbol=%s", user_id, symbol)
    return session


def _merge_messages(
    existing: list[dict[str, str]] | None,
    user_msg: str,
    assistant_msg: str,
) -> list[dict[str, str]]:
    """Append a new user-assistant exchange, preserving prior history."""
    history = list(existing) if existing else []
    history.append({"role": "user", "content": user_msg})
    history.append({"role": "assistant", "content": assistant_msg})
    return history


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.post("/message", response_model=ChatResponse)
async def chat_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Process a user message about an asset and return an AI-generated analysis.

    The request requires a valid JWT cookie. The response includes both
    the text reply and the raw prediction metadata.
    """
    symbol = body.symbol.upper().strip()
    logger.info(
        "[chat] message user=%s symbol=%s msg_len=%d",
        current_user.id,
        symbol,
        len(body.message),
    )

    # --- 1. Fetch candles ----------------------------------------------------
    candles_data = await get_candles(symbol=symbol, timeframe="1H", limit=100)
    price = _current_price(candles_data)
    logger.debug("[chat] candles source=%s price=%.4f", candles_data.get("source"), price)

    # --- 2. Prediction with Redis cache --------------------------------------
    cache_key = f"cache:predict:{symbol}"
    prediction: dict[str, Any] | None = None

    try:
        cached_pred = await get_cached(cache_key)
        if cached_pred is not None:
            prediction = cached_pred
            logger.debug("[chat] prediction cache HIT for %s", symbol)
    except Exception as exc:
        logger.warning("[chat] cache read error for %s: %s", symbol, exc)

    if prediction is None:
        prediction = await get_prediction(
            candles_data.get("candles") or [], symbol=symbol
        )
        if prediction.get("source") == "huggingface":
            try:
                await set_cached(cache_key, prediction, PREDICTION_CACHE_TTL)
                logger.debug("[chat] prediction cached for %s ttl=%d", symbol, PREDICTION_CACHE_TTL)
            except Exception as exc:
                logger.warning("[chat] cache write error for %s: %s", symbol, exc)

    # --- 3. Groq response ----------------------------------------------------
    reply = await generate_response(
        user_message=body.message,
        symbol=symbol,
        current_price=price,
        prediction=prediction,
    )

    # --- 4. Persist to ChatSession -------------------------------------------
    try:
        session = await _get_or_create_session(db, current_user.id, symbol)
        session.messages = _merge_messages(
            session.messages, body.message, reply
        )
        await db.commit()
        logger.debug(
            "[chat] session updated user=%s symbol=%s msg_count=%d",
            current_user.id,
            symbol,
            len(session.messages) if session.messages else 0,
        )
    except Exception as exc:
        logger.warning("[chat] DB persist error: %s — response still returned", exc)

    # --- 5. Response ---------------------------------------------------------
    return ChatResponse(
        reply=reply,
        prediction=PredictionOut(
            direction=prediction.get("direction", "SIDEWAYS"),
            probability=float(prediction.get("probability", 0.5)),
            source=prediction.get("source", "fallback"),
        ),
    )
