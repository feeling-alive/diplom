"""Tests for symbol normalisation (``base_ticker``)."""

from __future__ import annotations

import pytest

from app.services.symbols import base_ticker


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("BTC-USDT", "BTC"),
        ("ETH-USDT", "ETH"),
        ("eth-usdt-swap", "ETH"),
        ("SOL-USDT", "SOL"),
        ("AAPL", "AAPL"),
        ("aapl", "AAPL"),
        (" btc ", "BTC"),
        ("", ""),
        (None, ""),
    ],
)
def test_base_ticker(raw: str | None, expected: str) -> None:
    assert base_ticker(raw) == expected
