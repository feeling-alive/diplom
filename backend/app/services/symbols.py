"""Symbol normalisation helpers.

The app uses full exchange instrument ids for candles (OKX ``BTC-USDT``,
``ETH-USDT-SWAP``) while news enrichment stores bare tickers (``BTC``, ``ETH``,
``AAPL``). :func:`base_ticker` bridges the two so the chat news lookup can match
``symbols`` arrays populated by the OpenRouter enrichment step.
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger("backend.symbols")

# OKX-style quote/suffix segments that are not part of the base asset ticker.
# ``BTC-USDT`` -> ``BTC``; ``ETH-USDT-SWAP`` -> ``ETH``.
_QUOTE_SEGMENTS = {"USDT", "USD", "USDC", "BUSD", "SWAP", "PERP", "SPOT"}

# Shared asset snapshot (same file the search route reads). Used to map a bare
# crypto ticker (``BTC``) back to its full instrument id (``BTC-USDT``) so the
# candle source classifies it as crypto rather than a stock (bug #3).
_PRICES_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "frontend" / "src" / "data" / "prices.json"
)


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


@lru_cache(maxsize=1)
def _crypto_instrument_map() -> dict[str, str]:
    """Map a bare crypto ticker to its full instrument id from prices.json.

    ``{"BTC": "BTC-USDT", "ETH": "ETH-USDT", ...}``. Built once per process and
    derived from the shared snapshot (not hardcoded) so it tracks the real asset
    list. Returns an empty map if the snapshot is unreadable (graceful: caller
    then leaves the symbol unchanged).
    """
    try:
        data = json.loads(_PRICES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        logger.warning("[symbols] failed to load prices.json: %s", err)
        return {}

    mapping: dict[str, str] = {}
    for asset in data:
        if asset.get("type") != "crypto":
            continue
        full = str(asset.get("symbol", "")).strip().upper()
        if not full:
            continue
        mapping[base_ticker(full)] = full
    logger.debug("[symbols] crypto instrument map built: %d entries", len(mapping))
    return mapping


def normalize_to_instrument(symbol: str | None) -> str:
    """Return a candle-source-friendly instrument id for *symbol*.

    A bare crypto ticker (``BTC``, ``eth``) is mapped to its full OKX pair
    (``BTC-USDT``) using the prices.json snapshot. Symbols that already contain
    a separator (``BTC-USDT``, ``EUR-USD``) and unknown bare tickers (stocks like
    ``AAPL``, or crypto not in the snapshot) are returned uppercased unchanged.
    """
    if not symbol:
        return ""
    cleaned = symbol.strip().upper()
    if not cleaned or "-" in cleaned:
        return cleaned
    full = _crypto_instrument_map().get(cleaned)
    if full and full != cleaned:
        logger.debug("[symbols] normalize_to_instrument %s -> %s", cleaned, full)
        return full
    return cleaned
