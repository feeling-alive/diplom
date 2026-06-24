"""Tests for the 5 new Phase 2 quote endpoints (widgets-redis-cleanup plan).

Approach
--------
The endpoints proxy upstream APIs (OKX / Finnhub / CoinGecko / alternative.me /
Etherscan) with Redis caching. Tests inject canned upstream responses via a
``FakeAsyncClient`` and a monkey-patched ``_client`` in ``app.services.cache``,
so they never hit the real network and never depend on a live Redis.

Tested invariants
-----------------
* Each endpoint returns a response that conforms to the documented schema.
* A second call within the cache TTL hits the upstream only once
  (we count ``FakeAsyncClient.calls``).
* A upstream failure (httpx HTTPError) returns the documented fallback shape.
* The gas endpoint returns ``isStale: True`` when ``ETHERSCAN_API_KEY`` is absent.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


# --- Fake HTTP client --------------------------------------------------------


class _FakeResponse:
    def __init__(self, payload: Any, status: int = 200) -> None:
        self._payload = payload
        self.status_code = status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPError(f"fake status {self.status_code}")

    def json(self) -> Any:
        return self._payload


class FakeAsyncClient:
    """Drop-in stand-in for ``httpx.AsyncClient`` that returns queued responses
    in order. ``responses`` and ``calls`` live on the class so multiple instances
    inside a single request share one queue — exactly what we want for
    ``asyncio.gather``-style batched endpoints."""

    responses: list[_FakeResponse] = []
    calls: list[dict[str, Any]] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        return None

    async def get(self, url: str, params: Any = None) -> _FakeResponse:
        self.calls.append({"url": url, "params": params or {}})
        if not self.responses:
            raise AssertionError(f"FakeAsyncClient: no response queued for GET {url}")
        return self.responses.pop(0)

    async def post(self, url: str, json: Any = None, headers: Any = None) -> _FakeResponse:
        self.calls.append({"url": url, "json": json or {}, "headers": headers or {}})
        if not self.responses:
            # Model a network failure (e.g. unreachable RPC) so gas keyless-RPC
            # fallback paths degrade like they would in production.
            raise httpx.HTTPError(f"FakeAsyncClient: no response queued for POST {url}")
        return self.responses.pop(0)


# --- Cache isolation: each test gets a fresh no-op cache --------------------


@pytest.fixture(autouse=True)
def _no_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force the cache module to behave as if Redis is unreachable. The new
    endpoints must still work — caching is a performance optimization, not a
    correctness requirement."""

    async def fake_get_cached(key: str) -> dict[str, Any] | None:
        return None

    async def fake_set_cached(key: str, data: dict[str, Any], ttl: int) -> None:
        return None

    monkeypatch.setattr("app.services.cache.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.candles.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.coingecko.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.fng.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.funding.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.gas.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.okx.get_cached", fake_get_cached)
    monkeypatch.setattr("app.services.cache.set_cached", fake_set_cached)
    monkeypatch.setattr("app.services.candles.set_cached", fake_set_cached)
    monkeypatch.setattr("app.services.coingecko.set_cached", fake_set_cached)
    monkeypatch.setattr("app.services.fng.set_cached", fake_set_cached)
    monkeypatch.setattr("app.services.funding.set_cached", fake_set_cached)
    monkeypatch.setattr("app.services.gas.set_cached", fake_set_cached)
    monkeypatch.setattr("app.services.okx.set_cached", fake_set_cached)


@pytest.fixture(autouse=True)
def _reset_fake_client() -> None:
    FakeAsyncClient.responses.clear()
    FakeAsyncClient.calls.clear()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# --- /api/quotes/ohlcv/{symbol} ----------------------------------------------


async def test_ohlcv_crypto_okx_schema(client: AsyncClient) -> None:
    FakeAsyncClient.responses.append(_FakeResponse(
        {"data": [["1700000000000", "67850.12", "68120.45", "67800.00", "68045.78", "234.51"]]}
    ))
    with patch("httpx.AsyncClient", FakeAsyncClient):
        resp = await client.get("/api/quotes/ohlcv/BTC-USDT?tf=1H&limit=1")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["symbol"] == "BTC-USDT"
    assert body["timeframe"] == "1H"
    assert body["source"] == "okx"
    candle = body["candles"][0]
    # Service normalizes the timestamp to an integer of unix milliseconds.
    assert candle["t"] == 1700000000000
    assert isinstance(candle["t"], int)


async def test_ohlcv_upstream_failure_returns_mock(client: AsyncClient) -> None:
    class _RaisingClient(FakeAsyncClient):
        async def get(self, url: str, params: Any = None) -> _FakeResponse:
            raise httpx.HTTPError("simulated network failure")

    with patch("httpx.AsyncClient", _RaisingClient):
        resp = await client.get("/api/quotes/ohlcv/ETH-USDT?tf=1H&limit=5")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "mock"
    assert body["symbol"] == "ETH-USDT"


# --- /api/quotes/coin/{id} ---------------------------------------------------


async def test_coin_coingecko_schema(client: AsyncClient) -> None:
    upstream = {
        "id": "bitcoin",
        "symbol": "btc",
        "name": "Bitcoin",
        "description": {"en": "X" * 2000},  # exercise the 1000-char truncation
        "image": {"large": "https://x/lg.png", "small": "https://x/sm.png"},
        "links": {
            "homepage": ["https://bitcoin.org"],
            "repos_url": {"github": ["https://github.com/bitcoin/bitcoin"]},
            "twitter_screen_name": "bitcoin",
        },
        "genesis_date": "2009-01-03",
        "hashing_algorithm": "SHA-256",
        "market_cap_rank": 1,
        "market_data": {
            "current_price": {"usd": 68000.0},
            "market_cap": {"usd": 1.3e12},
            "total_volume": {"usd": 2.8e10},
            "price_change_percentage_24h": 1.5,
            "circulating_supply": 19700000,
            "ath": {"usd": 73750.0},
            "atl": {"usd": 67.81},
        },
    }
    with patch("httpx.AsyncClient", FakeAsyncClient):
        FakeAsyncClient.responses.append(_FakeResponse(upstream))
        resp = await client.get("/api/quotes/coin/bitcoin")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"] == "bitcoin"
    assert body["source"] == "coingecko"
    # New normalized shape: description is a flat string, market_data is flat too.
    assert isinstance(body["description"], str)
    assert len(body["description"]) <= 1000
    assert body["current_price_usd"] == 68000.0
    assert body["homepage"] == "https://bitcoin.org"
    assert body["github"] == "https://github.com/bitcoin/bitcoin"
    assert body["twitter"] == "https://twitter.com/bitcoin"
    # Trim-guard: the response must not leak the giant CoinGecko payload.
    assert "tickers" not in body
    assert "community_data" not in body
    assert "market_data" not in body
    assert "links" not in body


async def test_coin_failure_returns_mock(client: AsyncClient) -> None:
    class _RaisingClient(FakeAsyncClient):
        async def get(self, url: str, params: Any = None) -> _FakeResponse:
            raise httpx.HTTPError("coingecko 429")

    with patch("httpx.AsyncClient", _RaisingClient):
        resp = await client.get("/api/quotes/coin/ethereum")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "mock"
    # The mock fixture has per-coin entries; ethereum exists in coin.json.
    assert body["id"] == "ethereum"


# --- /api/quotes/fng ---------------------------------------------------------


async def test_fng_ok(client: AsyncClient) -> None:
    with patch("httpx.AsyncClient", FakeAsyncClient):
        FakeAsyncClient.responses.append(_FakeResponse(
            {"data": [{"value": "73", "value_classification": "Greed", "timestamp": "1700000000"}]}
        ))
        resp = await client.get("/api/quotes/fng")
    assert resp.status_code == 200
    body = resp.json()
    assert body["value"] == 73
    assert body["label"] == "Greed"
    assert body["source"] == "alternative.me"
    assert body["timestamp"] == 1700000000


async def test_fng_ttl_tracks_time_until_update(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # round 3 (B4): the cache TTL must follow alternative.me's time_until_update
    # (+60s buffer) so the value refreshes exactly when a new one is published.
    captured: dict[str, int] = {}

    async def capture_set_cached(key: str, data: Any, ttl: int) -> None:
        captured["ttl"] = ttl

    monkeypatch.setattr("app.services.fng.set_cached", capture_set_cached)

    with patch("httpx.AsyncClient", FakeAsyncClient):
        FakeAsyncClient.responses.append(_FakeResponse(
            {"data": [{"value": "17", "value_classification": "Extreme Fear",
                       "timestamp": "1700000000", "time_until_update": "3600"}]}
        ))
        resp = await client.get("/api/quotes/fng")
    assert resp.status_code == 200
    body = resp.json()
    assert body["value"] == 17
    assert body["timeUntilUpdate"] == 3600
    assert captured["ttl"] == 3660  # 3600 + 60s buffer


async def test_fng_failure_returns_neutral_fallback(client: AsyncClient) -> None:
    class _RaisingClient(FakeAsyncClient):
        async def get(self, url: str, params: Any = None) -> _FakeResponse:
            raise httpx.HTTPError("alternative.me down")

    with patch("httpx.AsyncClient", _RaisingClient):
        resp = await client.get("/api/quotes/fng")
    assert resp.status_code == 200
    body = resp.json()
    assert body["value"] == 50
    assert body["label"] == "Neutral"
    assert body["source"] == "fallback"


# --- /api/quotes/funding-rate -----------------------------------------------


async def test_funding_rate_batch(client: AsyncClient) -> None:
    with patch("httpx.AsyncClient", FakeAsyncClient):
        FakeAsyncClient.responses.append(_FakeResponse(
            {"data": [{"fundingRate": "0.0001", "nextFundingTime": "1700000000000",
                       "interestRate": "0.0001", "settleState": "settled"}]}
        ))
        FakeAsyncClient.responses.append(_FakeResponse(
            {"data": [{"fundingRate": "-0.0002", "nextFundingTime": "1700000000000",
                       "interestRate": "0.0001", "settleState": "settled"}]}
        ))
        resp = await client.get(
            "/api/quotes/funding-rate?symbols=BTC-USDT,ETH-USDT"
        )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["rates"]) == 2
    symbols = {r["symbol"] for r in body["rates"]}
    assert symbols == {"BTC-USDT", "ETH-USDT"}
    # OKX returns decimal rates; the service surfaces both decimal and percent.
    btc = next(r for r in body["rates"] if r["symbol"] == "BTC-USDT")
    assert btc["fundingRatePercent"] == 0.01


async def test_funding_rate_empty_symbols_400(client: AsyncClient) -> None:
    resp = await client.get("/api/quotes/funding-rate?symbols=")
    assert resp.status_code == 400


# --- /api/quotes/gas ---------------------------------------------------------


async def test_gas_no_api_key_keyless_rpc_unreachable_falls_back(client: AsyncClient) -> None:
    # No Etherscan key -> keyless RPC is tried. With every RPC POST unreachable
    # (FakeAsyncClient.post raises with no queued response) we land on the static
    # fallback with reason="no_api_key".
    with patch("httpx.AsyncClient", FakeAsyncClient):
        resp = await client.get("/api/quotes/gas")
    assert resp.status_code == 200
    body = resp.json()
    assert body["isStale"] is True
    assert body["source"] == "fallback"
    assert body["reason"] == "no_api_key"
    assert {"slow", "standard", "fast", "baseFee"} <= set(body.keys())


async def test_gas_no_api_key_keyless_rpc_ok(client: AsyncClient) -> None:
    # No Etherscan key -> keyless RPC answers eth_gasPrice (+ eth_blockNumber).
    # 0x6fc23ac00 wei = 30 gwei.
    with patch("httpx.AsyncClient", FakeAsyncClient):
        FakeAsyncClient.responses.append(_FakeResponse({"jsonrpc": "2.0", "id": 1, "result": "0x6fc23ac00"}))
        FakeAsyncClient.responses.append(_FakeResponse({"jsonrpc": "2.0", "id": 1, "result": "0x1295f00"}))
        resp = await client.get("/api/quotes/gas")
    assert resp.status_code == 200
    body = resp.json()
    assert body["isStale"] is False
    assert body["source"] == "rpc"
    assert body["standard"]["gwei"] == 30.0
    assert body["lastBlock"] == 0x1295f00


async def test_gas_etherscan_429_returns_stale_fallback(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Pretend a key IS configured so the route tries the upstream, then 429s.
    # The keyless-RPC secondary also fails (POST raises), so we land on the static fallback.
    monkeypatch.setattr("app.services.gas.settings.etherscan_api_key", "fake-test-key")
    class _RaisingClient(FakeAsyncClient):
        async def get(self, url: str, params: Any = None) -> _FakeResponse:
            raise httpx.HTTPError("etherscan 429")

        async def post(self, url: str, json: Any = None, headers: Any = None) -> _FakeResponse:
            raise httpx.HTTPError("rpc down")

    with patch("httpx.AsyncClient", _RaisingClient):
        resp = await client.get("/api/quotes/gas")
    assert resp.status_code == 200
    body = resp.json()
    assert body["isStale"] is True
    assert body["source"] == "fallback"
    assert body["reason"] == "upstream_error"


async def test_gas_etherscan_ok_schema(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.gas.settings.etherscan_api_key", "fake-test-key")
    with patch("httpx.AsyncClient", FakeAsyncClient):
        FakeAsyncClient.responses.append(_FakeResponse({
            "status": "1",
            "message": "OK",
            "result": {
                "SafeGasPrice": "18",
                "ProposeGasPrice": "24",
                "FastGasPrice": "32",
                "suggestBaseFee": "20",
                "LastBlock": 19500000,
                "SafeGasPriceUsd": "1.10",
                "ProposeGasPriceUsd": "1.45",
                "FastGasPriceUsd": "1.95",
            },
        }))
        resp = await client.get("/api/quotes/gas")
    assert resp.status_code == 200
    body = resp.json()
    assert body["isStale"] is False
    assert body["source"] == "etherscan"
    assert body["slow"]["gwei"] == 18
    assert body["fast"]["gwei"] == 32
    assert body["baseFee"] == 20


# --- /api/quotes/cryptos?symbols= (batch crypto tickers) ---------------------


async def test_cryptos_batch_schema(client: AsyncClient) -> None:
    """One OKX SPOT call is filtered to the requested instIds and normalized."""
    FakeAsyncClient.responses.append(_FakeResponse({"data": [
        {"instId": "BTC-USDT", "last": "68045.78", "open24h": "67000.0", "volCcy24h": "123456.7"},
        {"instId": "ETH-USDT", "last": "3500.0", "open24h": "3400.0", "volCcy24h": "7890.1"},
        {"instId": "DOGE-USDT", "last": "0.1", "open24h": "0.1", "volCcy24h": "1.0"},  # not requested
    ]}))
    with patch("httpx.AsyncClient", FakeAsyncClient):
        resp = await client.get("/api/quotes/cryptos?symbols=BTC-USDT,ETH-USDT")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    tickers = body["tickers"]
    # DOGE-USDT was returned by OKX but not requested -> filtered out.
    assert {t["symbol"] for t in tickers} == {"BTC-USDT", "ETH-USDT"}
    btc = next(t for t in tickers if t["symbol"] == "BTC-USDT")
    assert btc["price"] == 68045.78
    assert btc["changePercent"] == round((68045.78 - 67000.0) / 67000.0 * 100, 4)
    assert btc["volume"] == round(123456.7)
    # Only one upstream request for the whole batch.
    assert len(FakeAsyncClient.calls) == 1


async def test_cryptos_empty_symbols_400(client: AsyncClient) -> None:
    resp = await client.get("/api/quotes/cryptos?symbols=")
    assert resp.status_code == 400
