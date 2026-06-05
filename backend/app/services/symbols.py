"""Symbol normalisation helpers.

The app uses full exchange instrument ids for candles (OKX ``BTC-USDT``,
``ETH-USDT-SWAP``) while news enrichment stores bare tickers (``BTC``, ``ETH``,
``AAPL``). :func:`base_ticker` bridges the two so the chat news lookup can match
``symbols`` arrays populated by the OpenRouter enrichment step.
"""

from __future__ import annotations

import logging

logger = logging.getLogger("backend.symbols")

# OKX-style quote/suffix segments that are not part of the base asset ticker.
# ``BTC-USDT`` -> ``BTC``; ``ETH-USDT-SWAP`` -> ``ETH``.
_QUOTE_SEGMENTS = {"USDT", "USD", "USDC", "BUSD", "SWAP", "PERP", "SPOT"}


def base_ticker(symbol: str | None) -> str:
    """Return the bare asset ticker for *symbol*.

    Examples::

        base_ticker("BTC-USDT")       -> "BTC"
        base_ticker("eth-usdt-swap")  -> "ETH"
        base_ticker("AAPL")           -> "AAPL"
        base_ticker(" btc ")          -> "BTC"
        base_ticker(None)             -> ""

    The first hyphen-separated segment is treated as the base asset; any
    trailing quote/contract segments are dropped. A symbol with no separator
    (stocks like ``AAPL``) is returned uppercased as-is.
    """
    if not symbol:
        return ""

    cleaned = symbol.strip().upper()
    if not cleaned:
        return ""

    if "-" not in cleaned:
        return cleaned

    segments = [s for s in cleaned.split("-") if s]
    if not segments:
        return ""

    # The base asset is the leading segment unless it is itself a quote token
    # (defensive — real inputs always lead with the base).
    base = segments[0]
    if base in _QUOTE_SEGMENTS and len(segments) > 1:
        base = segments[1]

    logger.debug("[symbols] base_ticker %s -> %s", symbol, base)
    return base
