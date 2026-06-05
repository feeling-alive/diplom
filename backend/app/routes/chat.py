"""AI chat route for asset analysis (prefix ``/api/chat``).

Endpoints:
  GET  /api/chat/predict/{symbol}  — public, returns PatchTST prediction
  POST /api/chat/message           — JWT-protected, hybrid AI analysis
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import cast, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import ChatSession, NewsArticle, User
from app.services.cache import get_cached, set_cached
from app.services.candles import get_candles
from app.services.groq_service import get_groq_response
from app.services.patchtst import get_prediction

logger = logging.getLogger("backend.chat")

router = APIRouter(prefix="/api/chat", tags=["chat"])

PREDICTION_CACHE_TTL = 60  # seconds

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User question")
    symbol: str = Field(default="general", max_length=32, description="Asset ticker or 'general'")


class PredictionOut(BaseModel):
    direction: str
    probability: float
    source: str


class ChatResponse(BaseModel):
    reply: str
    prediction: PredictionOut | None = None


class ChatMessageSaveRequest(BaseModel):
    symbol: Optional[str] = Field(
        default=None,
        description="Asset ticker or 'general' for general chat. None also means general.",
    )
    user_message: str = Field(
        ..., min_length=1, max_length=2000, description="User question"
    )
    ai_message: str = Field(
        ..., min_length=1, max_length=10000, description="AI response from frontend (Groq)"
    )


class SaveMessageResponse(BaseModel):
    status: str = "ok"
    symbol: str
    message_count: int


# ---------------------------------------------------------------------------
# Helper: manage chat session in DB
# ---------------------------------------------------------------------------


def _resolve_symbol(symbol: str | None) -> str:
    """Normalise symbol: ``None`` or ``"general"`` -> ``"general"``."""
    if symbol is None or symbol.strip().lower() in ("", "general"):
        return "general"
    return symbol.strip().upper()


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


def _get_last_history(history: list[dict[str, str]] | None, count: int = 6) -> list[dict[str, str]]:
    """Return the last *count* messages from history, excluding system prompts."""
    if not history:
        return []
    return history[-count:]


# ---------------------------------------------------------------------------
# Helpers: fetch & cache prediction
# ---------------------------------------------------------------------------


async def _get_prediction_cached(symbol: str) -> dict[str, Any]:
    """Return a prediction for *symbol*, checking Redis first."""
    cache_key = f"cache:predict:{symbol}"

    try:
        cached = await get_cached(cache_key)
        if cached is not None:
            logger.debug("[chat] prediction cache HIT for %s", symbol)
            return cached
    except Exception as exc:
        logger.warning("[chat] cache read error for %s: %s", symbol, exc)

    candles_data = await get_candles(symbol=symbol, timeframe="1H", limit=100)
    prediction = await get_prediction(
        candles_data.get("candles") or [], symbol=symbol
    )

    if prediction.get("source") == "huggingface":
        try:
            await set_cached(cache_key, prediction, PREDICTION_CACHE_TTL)
            logger.debug("[chat] prediction cached for %s ttl=%d", symbol, PREDICTION_CACHE_TTL)
        except Exception as exc:
            logger.warning("[chat] cache write error for %s: %s", symbol, exc)

    return prediction


# ---------------------------------------------------------------------------
# Helper: news context
# ---------------------------------------------------------------------------


async def _get_news_context(db: AsyncSession, symbol: str) -> str:
    """Return a text block with the latest 3-5 news for *symbol*."""
    result = await db.execute(
        select(NewsArticle)
        .where(cast(NewsArticle.symbols, JSONB).contains([symbol]))
        .order_by(NewsArticle.published_at.desc())
        .limit(5)
    )
    articles = list(result.scalars().all())

    if not articles:
        logger.debug("[chat] news context for %s: 0 articles", symbol)
        return "Нет свежих новостей по данному активу."

    lines: list[str] = []
    for a in articles:
        title = a.title_ru or a.title
        desc = a.description_ru or a.description or ""
        lines.append(f"- {title}. {desc[:200]}")

    logger.debug("[chat] news context for %s: %d articles", symbol, len(articles))
    return "Свежие новости:\n" + "\n".join(lines)


def _to_prediction_out(prediction: dict[str, Any]) -> PredictionOut:
    return PredictionOut(
        direction=prediction.get("prediction", "SIDEWAYS"),
        probability=float(prediction.get("probability", 0.5)),
        source=prediction.get("source", "fallback"),
    )


def _build_system_prompt(symbol: str, direction: str, probability: float, news_context: str) -> str:
    return (
        f"Ты — профессиональный финансовый аналитик. Проанализируй актив {symbol}.\n\n"
        f"Текущий тренд (технический анализ PatchTST): {direction} "
        f"(уверенность: {probability:.0%})\n\n"
        f"{news_context}\n\n"
        f"Дай краткий (3-5 предложений) взвешенный ответ на русском, "
        f"объединяя технический анализ и фундаментальные новости. "
        f"Не давай конкретных инвестиционных рекомендаций."
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/predict/{symbol}", response_model=PredictionOut)
async def predict_public(symbol: str) -> PredictionOut:
    """Public endpoint: return a prediction for *symbol*.

    No authentication required. Fetches OHLCV candles, runs the
    PatchTST classifier (with Redis cache), and returns the result.
    """
    symbol = symbol.strip().upper()

    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")

    prediction = await _get_prediction_cached(symbol)
    return _to_prediction_out(prediction)


@router.post("/message", response_model=ChatResponse)
async def chat_message(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """Generate a hybrid AI analysis response.

    Requires a valid JWT. Combines PatchTST technical prediction with
    recent news and sends to Groq LLM for a weighted analysis.
    Persists the exchange in the PostgreSQL ``ChatSession`` table.

    If *symbol* is ``"general"`` a simple Groq-only response is returned
    without technical prediction or news context.
    """
    symbol = _resolve_symbol(body.symbol)

    logger.info(
        "[chat] POST /message user=%s symbol=%s msg_len=%d",
        current_user.id,
        symbol,
        len(body.message),
    )

    prediction: dict[str, Any] | None = None
    is_general = symbol == "general"

    if is_general:
        # General chat — no prediction or news context, plain Groq
        system_prompt = (
            "Ты — финансовый AI-ассистент. Отвечай кратко (3-5 предложений), "
            "на русском языке. Помогай пользователю: объясняй термины, "
            "анализируй рыночную ситуацию, оценивай риски стратегий. "
            "Не давай конкретных инвестиционных рекомендаций."
        )
    else:
        # 1. Fetch technical prediction
        prediction = await _get_prediction_cached(symbol)
        direction = prediction.get("prediction", "SIDEWAYS")
        probability = float(prediction.get("probability", 0.5))
        pred_source = prediction.get("source", "fallback")
        logger.debug(
            "[chat] prediction: %s %.2f from=%s",
            direction, probability, pred_source,
        )

        # 2. Fetch news context
        news_context = await _get_news_context(db, symbol)

        # 3. Build system prompt with prediction + news
        system_prompt = _build_system_prompt(symbol, direction, probability, news_context)

    # 4. Load chat history for context
    session = await _get_or_create_session(db, current_user.id, symbol)
    history = _get_last_history(session.messages)

    # 5. Call Groq
    reply = await get_groq_response(system_prompt, body.message, history)
    logger.debug("[chat] groq reply received len=%d", len(reply))

    # 6. Save to DB
    session.messages = _merge_messages(session.messages, body.message, reply)
    await db.commit()
    await db.refresh(session)
    msg_count = len(session.messages) if session.messages else 0
    logger.debug("[chat] session saved user=%s symbol=%s msg_count=%d", current_user.id, symbol, msg_count)

    return ChatResponse(
        reply=reply,
        prediction=_to_prediction_out(prediction) if prediction else None,
    )


# Legacy save endpoint — kept for backward compatibility with ChatPage
@router.post("/save", response_model=SaveMessageResponse)
async def save_message(
    body: ChatMessageSaveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SaveMessageResponse:
    """Save a chat message exchange (legacy).

    Requires a valid JWT. Persists the user message + AI reply pair
    in the PostgreSQL ``ChatSession`` table.
    """
    symbol = _resolve_symbol(body.symbol)

    logger.info(
        "[chat] save user=%s symbol=%s user_msg_len=%d ai_msg_len=%d",
        current_user.id,
        symbol,
        len(body.user_message),
        len(body.ai_message),
    )

    try:
        session = await _get_or_create_session(db, current_user.id, symbol)
        session.messages = _merge_messages(
            session.messages, body.user_message, body.ai_message
        )
        await db.commit()
        await db.refresh(session)
        msg_count = len(session.messages) if session.messages else 0
        logger.debug(
            "[chat] session saved user=%s symbol=%s msg_count=%d",
            current_user.id,
            symbol,
            msg_count,
        )
    except Exception as exc:
        logger.error("[chat] DB persist error: %s", exc)
        raise HTTPException(status_code=500, detail="failed to save message") from exc

    return SaveMessageResponse(
        status="ok",
        symbol=symbol,
        message_count=msg_count,
    )
