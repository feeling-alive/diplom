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
from sqlalchemy import cast, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.models import ChatSession, NewsArticle, User
from app.services.cache import get_cached, set_cached
from app.services.candles import get_candles
from app.services.groq_service import get_groq_response
from app.services.patchtst import get_prediction
from app.services.symbols import base_ticker

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
    low_confidence: bool = False
    raw_probabilities: dict[str, float] | None = None
    # Hybrid signal fields (optional — backward compatible with old fallbacks).
    patchtst_prob: float | None = None
    rule_score: float | None = None
    signals_agree: bool | None = None
    indicator_details: dict[str, Any] | None = None


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

    candles_data = await get_candles(
        symbol=symbol,
        timeframe=settings.prediction_timeframe,
        limit=settings.prediction_seq_len,
    )
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


def _format_news_lines(articles: list[NewsArticle]) -> str:
    """Render articles as a Russian bullet block for the system prompt."""
    lines: list[str] = []
    for a in articles:
        title = a.title_ru or a.title
        desc = a.description_ru or a.description or ""
        lines.append(f"- {title}. {desc[:200]}")
    return "Свежие новости:\n" + "\n".join(lines)


async def _get_news_context(db: AsyncSession, symbol: str) -> str:
    """Return a text block with the latest news relevant to *symbol*.

    News ``symbols`` are stored as bare tickers (``BTC``), while *symbol* may be
    a full instrument id (``BTC-USDT``) — so we match on :func:`base_ticker`.
    Falls back through text search and a category feed so the context is rarely
    empty.
    """
    ticker = base_ticker(symbol)
    limit = settings.news_context_limit
    is_crypto = "-" in symbol

    # 1. Exact tag match on the enriched ``symbols`` array (PostgreSQL JSONB).
    # The JSONB cast does not compile on the sqlite test DB — treat that as
    # "no match" and fall through to the portable fallbacks below. The compile
    # error happens before any DB round-trip, so the session stays clean.
    articles: list[NewsArticle] = []
    path = "symbols"
    try:
        result = await db.execute(
            select(NewsArticle)
            .where(cast(NewsArticle.symbols, JSONB).contains([ticker]))
            .order_by(NewsArticle.published_at.desc())
            .limit(limit)
        )
        articles = list(result.scalars().all())
    except Exception as exc:  # noqa: BLE001 — non-PG dialect: skip JSONB path
        logger.debug("[chat] symbols JSONB query unsupported (%s); using fallback", exc)

    # 2. Fallback: free-text search by ticker in title/description.
    if not articles and ticker:
        like = f"%{ticker}%"
        result = await db.execute(
            select(NewsArticle)
            .where(
                or_(
                    NewsArticle.title.ilike(like),
                    NewsArticle.title_ru.ilike(like),
                    NewsArticle.description.ilike(like),
                )
            )
            .order_by(NewsArticle.published_at.desc())
            .limit(limit)
        )
        articles = list(result.scalars().all())
        path = "text"

    # 3. Fallback: latest articles in the asset's broad category.
    if not articles:
        category = "crypto" if is_crypto else "stocks"
        result = await db.execute(
            select(NewsArticle)
            .where(NewsArticle.category == category)
            .order_by(NewsArticle.published_at.desc())
            .limit(limit)
        )
        articles = list(result.scalars().all())
        path = f"category:{category}"

    if not articles:
        logger.debug("[chat] news context for %s (%s): 0 articles", symbol, ticker)
        return _NO_NEWS_SENTINEL

    logger.debug(
        "[chat] news context for %s (%s): %d articles via %s",
        symbol, ticker, len(articles), path,
    )
    return _format_news_lines(articles)


async def _get_general_news_context(db: AsyncSession) -> str:
    """Return the latest market news (any category) for the general chat."""
    result = await db.execute(
        select(NewsArticle)
        .order_by(NewsArticle.published_at.desc())
        .limit(settings.news_context_limit)
    )
    articles = list(result.scalars().all())
    if not articles:
        return ""
    return _format_news_lines(articles)


def _to_prediction_out(prediction: dict[str, Any]) -> PredictionOut:
    patchtst_prob = prediction.get("patchtst_prob")
    rule_score = prediction.get("rule_score")
    signals_agree = prediction.get("signals_agree")
    return PredictionOut(
        direction=prediction.get("prediction", "SIDEWAYS"),
        probability=float(prediction.get("probability", 0.5)),
        source=prediction.get("source", "fallback"),
        low_confidence=bool(prediction.get("low_confidence", False)),
        raw_probabilities=prediction.get("raw_probabilities") or None,
        patchtst_prob=float(patchtst_prob) if patchtst_prob is not None else None,
        rule_score=float(rule_score) if rule_score is not None else None,
        signals_agree=bool(signals_agree) if signals_agree is not None else None,
        indicator_details=prediction.get("indicator_details") or None,
    )


# Single source of truth for the "no news" case — returned by _get_news_context
# and matched by _build_news_block so the wording can never drift between them.
_NO_NEWS_SENTINEL = "Нет свежих новостей по данному активу."

_DISCLAIMER = (
    "⚠️ Материал носит информационный характер. "
    "Все торговые решения вы принимаете самостоятельно."
)


def _rule_score_text(rule_score: float) -> str:
    """Render the rule-based score as a human-readable Russian verdict."""
    if rule_score > 0.3:
        return "бычьи (RSI/MACD/тренд указывают на рост)"
    if rule_score < -0.3:
        return "медвежьи (RSI/MACD/тренд указывают на падение)"
    return "нейтральные (смешанные сигналы)"


def _build_news_block(news_context: str) -> str:
    """Render the news section: real news, or an explicit no-news instruction."""
    has_news = bool(news_context) and news_context.strip() != _NO_NEWS_SENTINEL
    if has_news:
        return f"Актуальные новости из базы:\n{news_context}"
    return "ВАЖНО: новостей нет — не упоминай никакие события."


def _build_system_prompt(
    symbol: str,
    indicator_details: dict[str, Any],
    rule_score: float,
    news_context: str,
) -> str:
    """Build the indicator-driven Russian system prompt for asset analysis.

    Grounded ONLY in the rule-based technical indicators (RSI, MACD, trend,
    price-vs-SMA20) plus the aggregate ``rule_score`` verdict — the raw PatchTST
    UP/DOWN call is intentionally not surfaced to the LLM here. ``indicator_details``
    may be empty (short candle history); every field is read with a safe default
    so formatting never raises.
    """
    rsi = indicator_details.get("rsi", "—")
    rsi_zone = indicator_details.get("rsi_zone", "нет данных")
    macd_position = indicator_details.get("macd_position", "нет данных")
    macd_cross = indicator_details.get("macd_cross", "нет данных")
    trend = indicator_details.get("trend", "нет данных")
    price_vs_sma20 = indicator_details.get("price_vs_sma20", 0.0)
    news_block = _build_news_block(news_context)

    return (
        "Ты — финансовый аналитик платформы FinTrack.\n"
        "Отвечай ТОЛЬКО на вопросы о финансах и рынках.\n"
        "На нефинансовые вопросы — вежливо откажи одним предложением.\n\n"
        f"══ ТЕХНИЧЕСКИЙ АНАЛИЗ: {symbol} ══\n\n"
        "Индикаторы (реальные значения):\n"
        f"• RSI(14): {rsi} — {rsi_zone}\n"
        f"• MACD: {macd_position}, {macd_cross}\n"
        f"• Тренд: {trend} (цена {price_vs_sma20:+.1f}% от SMA20)\n"
        f"• Общий технический сигнал: {_rule_score_text(rule_score)}\n\n"
        f"{news_block}\n\n"
        "ЗАДАЧА: напиши технический анализ по структуре:\n"
        "1. Что сейчас происходит с активом (на основе индикаторов)\n"
        "2. На что обратить внимание трейдеру\n"
        "3. Общий вывод (1 предложение)\n\n"
        "Требования:\n"
        "- 4-5 предложений, русский язык\n"
        "- Опирайся ТОЛЬКО на данные индикаторов выше\n"
        "- Если нет новостей в блоке выше — НЕ упоминай никаких новостей вообще\n"
        f"- Последняя строка ВСЕГДА:\n  {_DISCLAIMER}"
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
        # General chat — no prediction; optional market-news block.
        system_prompt = (
            "Ты — финансовый AI-ассистент. Отвечай кратко (3-5 предложений), "
            "на русском языке. Помогай пользователю: объясняй термины, "
            "анализируй рыночную ситуацию, оценивай риски стратегий. "
            "Не давай конкретных инвестиционных рекомендаций."
        )
        if settings.general_news_enabled:
            news_block = await _get_general_news_context(db)
            if news_block:
                system_prompt = f"{system_prompt}\n\n{news_block}"
                logger.debug("[chat] general news context attached to prompt")
    else:
        # 1. Fetch technical prediction
        prediction = await _get_prediction_cached(symbol)
        direction = prediction.get("prediction", "SIDEWAYS")
        probability = float(prediction.get("probability", 0.5))
        low_confidence = bool(prediction.get("low_confidence", False))
        patchtst_prob = float(prediction.get("patchtst_prob", probability))
        rule_score = float(prediction.get("rule_score", 0.0))
        signals_agree = bool(prediction.get("signals_agree", False))
        indicator_details = prediction.get("indicator_details") or {}
        pred_source = prediction.get("source", "fallback")
        logger.debug(
            "[chat] prediction: %s %.2f low_conf=%s patchtst=%.2f rule=%.2f agree=%s from=%s",
            direction, probability, low_confidence, patchtst_prob, rule_score, signals_agree, pred_source,
        )

        # 2. Fetch news context
        news_context = await _get_news_context(db, symbol)

        # 3. Build the indicator-driven system prompt
        system_prompt = _build_system_prompt(
            symbol,
            indicator_details,
            rule_score,
            news_context,
        )

    # 4. Load chat history for context
    session = await _get_or_create_session(db, current_user.id, symbol)
    history = _get_last_history(session.messages)

    # 5. Call Groq
    reply = await get_groq_response(system_prompt, body.message, history)
    logger.debug("[chat] groq reply received len=%d", len(reply))

    # Enforce the disclaimer on asset analyses — it is part of the prompt contract,
    # so append it hardcoded if the model omitted it. Done before save so the
    # persisted assistant message also carries it.
    if prediction is not None and "информационный характер" not in reply:
        reply += "\n\n" + _DISCLAIMER
        logger.debug("[chat] disclaimer appended to reply")

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
