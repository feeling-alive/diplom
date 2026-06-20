"""Tests for OHLCV candle routing: crypto/forex/stock classification, the
yfinance and Frankfurter sources, and graceful mock fallback.

Network is never hit — the per-source fetchers are monkeypatched, and the cache
is stubbed to behave as if Redis is unreachable.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services import candles
from app.services.candles import classify_symbol, get_candles


# --- classify_symbol --------------------------------------------------------


@pytest.mark.parametrize(
    "symbol,expected",
    [
        ("BTC-USDT", "crypto"),
        ("eth-usdt", "crypto"),
        ("SOL-USDC", "crypto"),
        ("EUR-USD", "forex"),
        ("USD-JPY", "forex"),
        ("gbp-usd", "forex"),
        ("AAPL", "stock"),
        ("MSFT", "stock"),
    ],
)
def test_classify_symbol(symbol: str, expected: str) -> None:
    assert classify_symbol(symbol) == expected


# --- get_candles routing ----------------------------------------------------


@pytest.fixture(autouse=True)
def _no_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_cached(key: str) -> dict[str, Any] | None:
        return None

    async def fake_set_cached(key: str, data: dict[str, Any], ttl: int) -> None:
        return None

    monkeypatch.setattr("app.services.candles.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.candles.set_cached", fake_set_cached)


_FAKE = [{"t": 1700000000000, "o": 1.0, "h": 2.0, "l": 0.5, "c": 1.5, "v": 10.0}]


async def test_get_candles_crypto_routes_okx(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_okx(symbol: str, tf: str, limit: int) -> list[dict[str, Any]]:
        return _FAKE

    monkeypatch.setattr(candles, "_fetch_okx", fake_okx)
    result = await get_candles("BTC-USDT", "1H", 1)
    assert result["source"] == "okx"
    assert result["candles"] == _FAKE


async def test_get_candles_stock_routes_yfinance(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def fake_yf(symbol: str, tf: str, limit: int) -> list[dict[str, Any]]:
        captured.update(symbol=symbol, tf=tf, limit=limit)
        return _FAKE

    monkeypatch.setattr(candles, "_fetch_yfinance", fake_yf)
    result = await get_candles("AAPL", "1D", 50)
    assert result["source"] == "yfinance"
    assert captured == {"symbol": "AAPL", "tf": "1D", "limit": 50}


async def test_get_candles_forex_routes_frankfurter(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    async def fake_series(base: str, quote: str, limit: int) -> list[dict[str, Any]]:
        captured.update(base=base, quote=quote, limit=limit)
        return _FAKE

    monkeypatch.setattr(candles, "_fetch_frankfurter_series", fake_series)
    result = await get_candles("EUR-USD", "1D", 30)
    assert result["source"] == "frankfurter"
    assert captured == {"base": "EUR", "quote": "USD", "limit": 30}


async def test_get_candles_stock_failure_returns_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(symbol: str, tf: str, limit: int) -> list[dict[str, Any]]:
        raise LookupError("yfinance down")

    monkeypatch.setattr(candles, "_fetch_yfinance", boom)
    result = await get_candles("AAPL", "1D", 10)
    assert result["source"] == "mock"
    assert result["symbol"] == "AAPL"


async def test_get_candles_forex_http_error_returns_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(base: str, quote: str, limit: int) -> list[dict[str, Any]]:
        raise httpx.HTTPError("frankfurter down")

    monkeypatch.setattr(candles, "_fetch_frankfurter_series", boom)
    result = await get_candles("USD-JPY", "1D", 10)
    assert result["source"] == "mock"


async def test_frankfurter_series_builds_flat_candles(monkeypatch: pytest.MonkeyPatch) -> None:
    """The Frankfurter parser turns one rate/day into a flat o=h=l=c candle."""

    class _Resp:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {
                "base": "EUR",
                "rates": {
                    "2024-01-02": {"USD": 1.09},
                    "2024-01-03": {"USD": 1.10},
                },
            }

    class _Client:
        def __init__(self, *a: Any, **k: Any) -> None:
            pass

        async def __aenter__(self) -> "_Client":
            return self

        async def __aexit__(self, *a: Any) -> None:
            return None

        async def get(self, url: str, params: Any = None) -> _Resp:
            return _Resp()

    monkeypatch.setattr("app.services.candles.httpx.AsyncClient", _Client)
    out = await candles._fetch_frankfurter_series("EUR", "USD", 100)
    assert len(out) == 2
    first = out[0]
    assert first["o"] == first["h"] == first["l"] == first["c"] == 1.09
    assert first["v"] == 0.0
    assert isinstance(first["t"], int)
    assert out[1]["c"] == 1.10  # ascending date order
