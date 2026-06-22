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
import re
from typing import Any, Awaitable, Callable

import httpx

from app.config import settings

logger = logging.getLogger("backend.groq_service")

# A tool runner executes one tool call and returns (content_for_model, card_or_None).
# ``card`` is an arbitrary dict the route turns into a frontend link card.
ToolRunner = Callable[[str, dict[str, Any]], Awaitable[tuple[str, dict[str, Any] | None]]]

_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_MODEL = "llama-3.3-70b-versatile"
# Deterministic temperature for the tool-calling path so the model returns
# structured tool_calls instead of a textual function-call leak (bug #1).
_TOOLS_TEMPERATURE = 0.2
_FALLBACK_MESSAGE = (
    "Не удалось получить ответ от ИИ-модели. Попробуйте позже."
)
_MISSING_KEY_MESSAGE = (
    "ИИ-ассистент не настроен. Добавьте GROQ_API_KEY в .env."
)


# ---------------------------------------------------------------------------
# Leaked function-call cleanup (bug: raw `<function=...>` syntax in chat)
# ---------------------------------------------------------------------------
#
# Llama sometimes prints a textual tool call into ``content`` instead of
# returning a structured ``tool_calls`` entry, e.g.
#   <function=search_news{"query": "btc"}>
#   <function=get_asset>{"symbol": "BTC"}</function>
# This must never reach the user or the saved history. We parse such fragments
# (to run the tool as a fallback) and always strip them from the final text.

# Tag form first: <function=name>{...}</function>
_FUNC_TAG_RE = re.compile(
    r"<function\s*=\s*(?P<name>\w+)\s*>\s*(?P<args>\{.*?\})?\s*</function\s*>",
    re.DOTALL,
)
# Inline form: <function=name{...}>  (args optional, may self-close)
_FUNC_INLINE_RE = re.compile(
    r"<function\s*=\s*(?P<name>\w+)\s*(?P<args>\{.*?\})?\s*/?>",
    re.DOTALL,
)
# Any leftover stray <function ...> / </function> token.
_FUNC_RESIDUE_RE = re.compile(r"</?function[^>]*>", re.DOTALL)


def _parse_function_leaks(text: str) -> tuple[str, list[tuple[str, dict[str, Any]]]]:
    """Extract leaked textual function calls and strip them from *text*.

    Returns ``(cleaned_text, parsed_calls)`` where *parsed_calls* contains only
    fragments we could turn into ``(name, args_dict)`` — i.e. a name plus a JSON
    object that decodes to a dict. Fragments we cannot parse are still stripped
    (so the user never sees them) but are not returned for execution.
    """
    if not text or "<function" not in text:
        return (text or ""), []

    parsed: list[tuple[str, dict[str, Any]]] = []

    def _consume(match: re.Match[str]) -> str:
        name = match.group("name")
        raw_args = match.group("args")
        if name and raw_args:
            try:
                args = json.loads(raw_args)
                if isinstance(args, dict):
                    parsed.append((name, args))
            except (json.JSONDecodeError, TypeError):
                pass  # unparseable args → strip only, don't execute
        return ""

    cleaned = _FUNC_TAG_RE.sub(_consume, text)
    cleaned = _FUNC_INLINE_RE.sub(_consume, cleaned)
    cleaned = _FUNC_RESIDUE_RE.sub("", cleaned)
    return cleaned.strip(), parsed


def _strip_function_syntax(text: str) -> str:
    """Return *text* with every leaked ``<function...>`` fragment removed."""
    cleaned, _ = _parse_function_leaks(text)
    return cleaned


def _sanitize_history(
    history: list[dict[str, str]] | None,
) -> list[dict[str, Any]]:
    """Strip leaked function syntax from prior messages before re-sending.

    Old polluted assistant turns saved in ``chat_sessions.messages`` otherwise
    teach the model to keep copying the broken pattern (bug: raw syntax in chat).
    """
    if not history:
        return []
    sanitized: list[dict[str, Any]] = []
    stripped = 0
    for msg in history:
        content = msg.get("content", "")
        clean = _strip_function_syntax(content)
        if clean != content:
            stripped += 1
        item = dict(msg)
        item["content"] = clean
        sanitized.append(item)
    if stripped:
        logger.debug("[groq] sanitized %d/%d history msgs", stripped, len(history))
    return sanitized


def _dedupe_cards(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop duplicate link cards (same type+href) — a leaked call may repeat one."""
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, Any]] = []
    for c in cards:
        key = (str(c.get("type")), str(c.get("href")))
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


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
    messages.extend(_sanitize_history(history))
    messages.append({"role": "user", "content": user_message})

    cards: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            for round_no in range(max_rounds):
                payload: dict[str, Any] = {
                    "model": _GROQ_MODEL,
                    "messages": messages,
                    # Low temperature makes the model emit structured ``tool_calls``
                    # deterministically instead of leaking a textual ``<function=...>``
                    # call into ``content`` (bug: raw function syntax in chat).
                    "temperature": _TOOLS_TEMPERATURE,
                    "max_tokens": 700,
                    "tools": tools,
                    "tool_choice": "auto",
                }
                logger.debug(
                    "[groq] tools payload temperature=%.2f round=%d msg_count=%d",
                    _TOOLS_TEMPERATURE, round_no, len(messages),
                )
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
                    raw_content = msg.get("content") or ""
                    cleaned, leaked = _parse_function_leaks(raw_content)

                    # Fallback path: the model printed a textual tool call instead
                    # of a structured one. Execute the parsed calls, then loop once
                    # more so the model phrases a natural reply from the results —
                    # but never on the final round (no budget left to re-ask).
                    if leaked and round_no < max_rounds - 1:
                        logger.warning(
                            "[groq] raw function-call leaked in content (%d call(s)) — executing as fallback",
                            len(leaked),
                        )
                        tool_outputs: list[str] = []
                        for name, args in leaked:
                            logger.debug("[groq] leaked tool_call name=%s args=%s", name, args)
                            content, card = await tool_runner(name, args)
                            if card is not None:
                                cards.append(card)
                            tool_outputs.append(f"{name}: {content}")
                        messages.append({"role": "assistant", "content": cleaned or "(вызов инструмента)"})
                        messages.append({
                            "role": "user",
                            "content": (
                                "Результаты инструментов:\n" + "\n".join(tool_outputs)
                                + "\n\nОтветь пользователю на русском по этим данным. "
                                "НЕ пиши синтаксис вызова функций."
                            ),
                        })
                        continue

                    reply = cleaned or _FALLBACK_MESSAGE
                    if raw_content and cleaned != raw_content:
                        logger.debug("[groq] stripped raw function syntax from reply")
                    cards = _dedupe_cards(cards)
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
            return _FALLBACK_MESSAGE, _dedupe_cards(cards)
    except (KeyError, IndexError, TypeError) as err:
        logger.warning("[groq] unexpected tools response structure: %s", err)
        return _FALLBACK_MESSAGE, cards
    except httpx.HTTPError as err:
        logger.warning("[groq] tools API error: %s", err)
        return _FALLBACK_MESSAGE, cards
