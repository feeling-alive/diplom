"""Groq API client for financial-analysis chat responses.

Sends messages to Groq's Llama model with a system prompt and conversation
history. Designed to be called from the chat route which assembles the
prompt with PatchTST prediction and news context.

Graceful degradation: returns a polite fallback message when the API key
is absent or the upstream request fails.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

import httpx

from app.config import settings

logger = logging.getLogger("backend.groq_service")

# A tool runner executes one tool call and returns (content_for_model, card_or_None).
# ``card`` is an arbitrary dict the route turns into a frontend link card.
ToolRunner = Callable[[str, dict[str, Any]], Awaitable[tuple[str, dict[str, Any] | None]]]

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


async def get_groq_response_with_tools(
    system_prompt: str,
    user_message: str,
    history: list[dict[str, str]] | None,
    tools: list[dict[str, Any]],
    tool_runner: ToolRunner,
    max_rounds: int = 3,
) -> tuple[str, list[dict[str, Any]]]:
    """Call Groq with function-calling enabled and resolve any tool calls.

    Returns ``(reply, cards)`` where *cards* are the structured link-card dicts
    collected from executed tools (frontend renders them as clickable cards).
    Falls back gracefully to a plain string + empty cards on any failure.
    """
    if not settings.groq_api_key:
        logger.warning("[groq] GROQ_API_KEY absent — returning fallback")
        return _MISSING_KEY_MESSAGE, []

    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    cards: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            for round_no in range(max_rounds):
                payload: dict[str, Any] = {
                    "model": _GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 700,
                    "tools": tools,
                    "tool_choice": "auto",
                }
                resp = await client.post(
                    _GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                resp.raise_for_status()
                choice = resp.json()["choices"][0]
                msg = choice["message"]
                tool_calls = msg.get("tool_calls")

                if not tool_calls:
                    reply = msg.get("content") or _FALLBACK_MESSAGE
                    logger.info("[groq] tools done round=%d cards=%d reply_len=%d", round_no, len(cards), len(reply))
                    return reply, cards

                # Echo the assistant tool-call message, then append each tool result.
                messages.append(msg)
                for tc in tool_calls:
                    name = tc.get("function", {}).get("name", "")
                    try:
                        args = json.loads(tc.get("function", {}).get("arguments") or "{}")
                    except (json.JSONDecodeError, TypeError):
                        args = {}
                    logger.debug("[groq] tool_call name=%s args=%s", name, args)
                    content, card = await tool_runner(name, args)
                    if card is not None:
                        cards.append(card)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "content": content,
                    })
            logger.warning("[groq] tool rounds exhausted (%d)", max_rounds)
            return _FALLBACK_MESSAGE, cards
    except (KeyError, IndexError, TypeError) as err:
        logger.warning("[groq] unexpected tools response structure: %s", err)
        return _FALLBACK_MESSAGE, cards
    except httpx.HTTPError as err:
        logger.warning("[groq] tools API error: %s", err)
        return _FALLBACK_MESSAGE, cards
