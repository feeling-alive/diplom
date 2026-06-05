"""Groq API client for financial-analysis chat responses.

Takes a user question, the current asset price, and a PatchTST prediction,
then calls Groq's ``llama-3.3-70b-versatile`` with a Russian-language
financial-analyst system prompt.

Graceful degradation: returns a polite fallback message when the API key
is absent or the upstream request fails.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("backend.groq_service")

_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_MODEL = "llama-3.3-70b-versatile"

_FALLBACK_MESSAGE = (
    "⚠️ Сервис ИИ-анализа временно недоступен. "
    "Пожалуйста, попробуйте позже."
)

_SYSTEM_PROMPT = (
    "Ты — профессиональный финансовый аналитик. Отвечай на русском языке. "
    "Твоя задача — дать развёрнутый анализ актива на основе данных: "
    "текущая цена, исторические цены закрытия и прогноз от модели временных рядов. "
    "Используй простой и понятный язык. "
    "Обязательно добавь дисклеймер: «Данная информация не является инвестиционной "
    "рекомендацией и предоставляется исключительно в ознакомительных целях.»"
)


def _build_user_prompt(
    user_message: str,
    symbol: str,
    current_price: float,
    prediction: dict[str, Any],
) -> str:
    direction = prediction.get("direction", "SIDEWAYS")
    probability = prediction.get("probability", 0.5)
    pred_source = prediction.get("source", "fallback")

    return (
        f"Актив: {symbol}\n"
        f"Текущая цена: {current_price:.4f}\n"
        f"Прогноз модели (источник: {pred_source}): "
        f"направление = {direction}, уверенность = {probability:.0%}\n\n"
        f"Вопрос пользователя: {user_message}"
    )


async def generate_response(
    user_message: str,
    symbol: str,
    current_price: float,
    prediction: dict[str, Any],
) -> str:
    """Call Groq and return the assistant's reply.

    Handles missing API keys, transport errors, and malformed responses
    transparently — the caller always gets a string.
    """
    if not settings.groq_api_key:
        logger.warning("[groq] GROQ_API_KEY absent — returning fallback")
        return _FALLBACK_MESSAGE

    user_prompt = _build_user_prompt(user_message, symbol, current_price, prediction)

    logger.info(
        "[groq] request symbol=%s price=%.4f direction=%s",
        symbol,
        current_price,
        prediction.get("direction", "?"),
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                _GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": _GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1024,
                },
            )
            resp.raise_for_status()
            raw: dict[str, Any] = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[groq] API error: %s", err)
        return _FALLBACK_MESSAGE

    try:
        reply: str = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as err:
        logger.warning("[groq] unexpected response structure: %s", err)
        return _FALLBACK_MESSAGE

    logger.info("[groq] response received (len=%d)", len(reply))
    return reply
