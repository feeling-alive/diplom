"""Groq API client for financial-analysis chat responses.

Sends messages to Groq's Llama model with a system prompt and conversation
history. Designed to be called from the chat route which assembles the
prompt with PatchTST prediction and news context.

Graceful degradation: returns a polite fallback message when the API key
is absent or the upstream request fails.
"""

from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger("backend.groq_service")

_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_MODEL = "llama-3.3-70b-versatile"
_FALLBACK_MESSAGE = (
    "Не удалось получить ответ от ИИ-модели. Попробуйте позже."
)
_MISSING_KEY_MESSAGE = (
    "ИИ-ассистент не настроен. Добавьте GROQ_API_KEY в .env."
)


async def get_groq_response(
    system_prompt: str,
    user_message: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """Call Groq and return the assistant's reply.

    Handles missing API keys, transport errors, and malformed responses
    transparently — the caller always gets a string.
    """
    if not settings.groq_api_key:
        logger.warning("[groq] GROQ_API_KEY absent — returning fallback")
        return _MISSING_KEY_MESSAGE

    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
    ]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    logger.info(
        "[groq] request model=%s prompt_len=%d msg_count=%d",
        _GROQ_MODEL,
        len(system_prompt) + len(user_message),
        len(messages),
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
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 512,
                },
            )
            resp.raise_for_status()
            raw: dict = resp.json()
    except httpx.HTTPError as err:
        logger.warning("[groq] API error: %s", err)
        return _FALLBACK_MESSAGE

    try:
        reply: str = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as err:
        logger.warning("[groq] unexpected response structure: %s", err)
        return _FALLBACK_MESSAGE

    logger.info("[groq] response received status=200 reply_len=%d", len(reply))
    return reply
