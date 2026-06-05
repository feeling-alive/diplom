"""Tests for Groq API client service.

Covers:
  * Successful response returns the assistant's text
  * API error (HTTP 500) returns fallback message
  * Missing API key returns fallback message
  * HTTP timeout returns fallback message
  * Malformed response structure returns fallback message
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services.groq_service import get_groq_response

_SYSTEM_PROMPT = "You are a helpful assistant."
_USER_MESSAGE = "What is Bitcoin?"


async def test_groq_response_returns_text(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.groq_api_key", "test-key")

    async def fake_post(self: Any, url: str, **kwargs: Any) -> httpx.Response:
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Bitcoin is a cryptocurrency."}}]},
            request=httpx.Request("POST", url),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    reply = await get_groq_response(_SYSTEM_PROMPT, _USER_MESSAGE)
    assert reply == "Bitcoin is a cryptocurrency."


async def test_groq_response_api_error_returns_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.groq_api_key", "test-key")

    async def fake_post(self: Any, url: str, **kwargs: Any) -> httpx.Response:
        raise httpx.HTTPStatusError("500 Server Error", request=httpx.Request("POST", url), response=httpx.Response(500))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    reply = await get_groq_response(_SYSTEM_PROMPT, _USER_MESSAGE)
    assert "Не удалось" in reply


async def test_groq_response_missing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.groq_api_key", "")

    reply = await get_groq_response(_SYSTEM_PROMPT, _USER_MESSAGE)
    assert "не настроен" in reply


async def test_groq_response_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.groq_api_key", "test-key")

    async def fake_post(self: Any, url: str, **kwargs: Any) -> httpx.Response:
        raise httpx.TimeoutException("Request timed out")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    reply = await get_groq_response(_SYSTEM_PROMPT, _USER_MESSAGE)
    assert "Не удалось" in reply


async def test_groq_response_malformed_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.groq_api_key", "test-key")

    async def fake_post(self: Any, url: str, **kwargs: Any) -> httpx.Response:
        return httpx.Response(200, json={"wrong_key": "data"}, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    reply = await get_groq_response(_SYSTEM_PROMPT, _USER_MESSAGE)
    assert "Не удалось" in reply
